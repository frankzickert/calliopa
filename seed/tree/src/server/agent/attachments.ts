import { randomUUID } from "node:crypto";

import {
  MAX_ATTACHMENT_BYTES,
  type AttachmentDescriptor,
} from "~/lib/command-target";
import { graphEnv } from "../ccgw/env";
import { query, write } from "../ccgw/client";
import { forwardedHeaders } from "../request-context";
import { isRecordId } from "../uuid";
import { readBridgeRun } from "./bridge";
import { runForProcess } from "./conductor";

/**
 * Files a person attaches to a command (`BO_0229`). The shell keeps none of
 * them: the kernel stores each through CCGW's blob door and extracts its text
 * once, the run route writes one `attachment` node per file as the person
 * when the command is sent — the reference is what keeps the bytes past the
 * blob store's staging TTL — and a file opens again from the node.
 */

export type Uploaded =
  | { readonly ok: true; readonly descriptor: AttachmentDescriptor }
  | { readonly ok: false; readonly status: number; readonly error: string };

/**
 * Hands one file to the kernel's upload. The name travels percent-encoded,
 * since a header carries ASCII alone, and the session's cookie with it, as
 * every kernel call carries the person. Nothing reaches the graph here: a
 * file taken back before *Run* lapses with the staging TTL. BO_0229_008
 */
export async function uploadAttachment(
  body: ArrayBuffer,
  filename: string,
  mediaType: string,
): Promise<Uploaded> {
  if (body.byteLength > MAX_ATTACHMENT_BYTES) {
    return { ok: false, status: 413, error: `${filename} is larger than 10 MB, the most a command can carry per file.` };
  }
  let response: Response;
  try {
    response = await fetch(`${graphEnv().kernelUrl}/__kernel/attachments`, {
      method: "POST",
      headers: {
        ...forwardedHeaders(),
        "content-type": mediaType === "" ? "application/octet-stream" : mediaType,
        "x-calliopa-filename": encodeURIComponent(filename),
      },
      body,
    });
  } catch (error) {
    return { ok: false, status: 503, error: `The kernel could not be reached: ${String(error)}` };
  }
  const text = await response.text();
  let answered: unknown = null;
  try {
    answered = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    answered = null;
  }
  if (!response.ok) {
    const refused = answered as { diagnostics?: { message?: string }[]; error?: string } | null;
    return {
      ok: false,
      status: response.status,
      error: refused?.diagnostics?.[0]?.message ?? refused?.error ?? `The kernel answered ${response.status} for ${filename}.`,
    };
  }
  return { ok: true, descriptor: answered as AttachmentDescriptor };
}

export type Written =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly status: number; readonly error: string };

/**
 * Writes one `attachment` node per file, as the signed-in person, before the
 * run starts, and answers their ids. A file whose upload outlived the staging
 * TTL while the composer held it is refused by name; nodes written before a
 * later refusal stay, recording what was sent. BO_0229_009
 */
export async function writeAttachments(descriptors: readonly AttachmentDescriptor[]): Promise<Written> {
  const ids: string[] = [];
  for (const descriptor of descriptors) {
    const id = randomUUID();
    const file = {
      _kind: "blob",
      hash: descriptor.hash,
      size: descriptor.size,
      mediaType: descriptor.mediaType,
      filename: descriptor.filename,
    };
    const text =
      descriptor.text === null
        ? null
        : { _kind: "blob", hash: descriptor.text.hash, size: descriptor.text.size, mediaType: "text/plain; charset=utf-8" };
    const written = await write(
      // Established as it is written, as a document's creation is: without the
      // status the node is no one's truth, and the run's read at its pin finds
      // nothing. Found in the walk, 2026-09-16.
      `CREATE (a:attachment {id: $id, filename: $filename, mediaType: $mediaType, size: $size, file: $file, ${text === null ? "" : "text: $text, "}textStatus: $textStatus, status: "established"})`,
      {
        id,
        filename: descriptor.filename,
        mediaType: descriptor.mediaType,
        size: descriptor.size,
        file,
        ...(text === null ? {} : { text }),
        textStatus: descriptor.textStatus,
      },
      `attachment ${descriptor.filename} sent with a command`,
    );
    if (written.outcome === "success") {
      ids.push(`node:${id}`);
      continue;
    }
    const detail = "detail" in written ? written.detail : "failures" in written ? written.failures.map((f) => f.detail).join("; ") : written.outcome;
    if (detail.includes("dangling_blob_reference")) {
      return {
        ok: false,
        status: 400,
        error: `${descriptor.filename} is no longer stored: it was attached too long ago. Attach it again.`,
      };
    }
    return { ok: false, status: written.outcome === "refused" ? 403 : 502, error: `${descriptor.filename} could not be recorded: ${detail}` };
  }
  return { ok: true, ids };
}

/** An attachment node as its file route reads it. */
export interface StoredAttachment {
  readonly id: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly fileHash: string;
}

/** Reads one attachment node, or null when the graph holds none by that id. BO_0229_011 */
export async function readAttachment(id: string): Promise<StoredAttachment | null> {
  const nodeId = id.startsWith("node:") ? id : `node:${id}`;
  const read = await query({
    statement: "MATCH (a:attachment) RETURN GRAPH a",
    roots: [nodeId],
    purpose: "attachment file",
  });
  if (read.outcome !== "success") return null;
  const node = read.result.nodes.find((candidate) => candidate.id === nodeId);
  const content = node?.revision.content as Record<string, unknown> | undefined;
  if (content === undefined || content["_type"] !== "attachment") return null;
  const file = content["file"] as { hash?: unknown } | undefined;
  if (typeof file?.hash !== "string") return null;
  return {
    id: nodeId,
    filename: typeof content["filename"] === "string" ? content["filename"] : "attachment",
    mediaType: typeof content["mediaType"] === "string" ? content["mediaType"] : "application/octet-stream",
    fileHash: file.hash,
  };
}

/** The file's bytes from CCGW's blob door, streamed as they arrive. */
export async function fetchAttachmentFile(hash: string): Promise<Response> {
  return fetch(`${graphEnv().ccgwUrl}/v1/blobs/${hash}`);
}

/**
 * The headers a file opens with: always a download, never sniffed, so an HTML
 * or SVG file cannot render in the shell's origin. BO_0229_011
 */
export function fileHeaders(attachment: StoredAttachment): Record<string, string> {
  const fallback = attachment.filename.replace(/[^\x20-\x7e]|["\\]/gu, "_");
  return {
    "content-type": attachment.mediaType,
    "content-disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    "x-content-type-options": "nosniff",
  };
}

/**
 * The attachment a process's run carried, read as the person asking: the
 * process's run through the kernel, which serves it to its person and the
 * owner alone, and the attachment only when that run names it. Null for
 * anything else — no such process, a run the kernel does not serve this
 * person, or an attachment the run did not carry. BO_0232_008
 */
export async function attachmentForProcess(processId: string, id: string): Promise<StoredAttachment | null> {
  const runId = isRecordId(processId) ? await runForProcess(processId) : null;
  if (runId === null) return null;
  const run = await readBridgeRun(runId);
  const nodeId = id.startsWith("node:") ? id : `node:${id}`;
  if (!run.ok || !(run.value.attachments ?? []).some((attachment) => attachment.id === nodeId)) return null;
  return readAttachment(nodeId);
}
