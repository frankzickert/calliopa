import { randomUUID } from "node:crypto";

import type { DocumentView } from "~/extensions/documents/server/assemble";
import { readDocument } from "~/extensions/documents/server/documents";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";
import { readWork } from "~/extensions/bibliography/server/works";
import { blobHash, blobReference, objectIdOfHash, putBlob, readBlob } from "~/server/ccgw/blobs";
import { commit } from "~/server/ccgw/script";
import { call } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";

import { MANUSCRIPT_TYPE, isOutcome, type Outcome, type Venue } from "../lib/manuscript";
import { project, type Projection } from "./project";

/**
 * A manuscript made and kept (`BO_0293_021`): the document read, its cited
 * works read from the bibliography, the projection sent with the figures'
 * bytes to the typesetting service through the kernel forward, and what came
 * back kept — the LaTeX source, its `.bib` and the PDF as blobs, and one
 * `manuscript` node naming the document, the dataRevision projected, the
 * venue, when, by whom, the outcome, the log and what was left out. A
 * typesetting that failed is kept too, with its source, so the person can
 * read why and take the source elsewhere. Every manuscript made is kept (user
 * decision, 2026-09-23); the node is written as the person's truth, in their
 * branch when their tab is in one.
 *
 * The transport is the kernel client's `call` unless a test hands one in.
 */

export type Transport = (path: string, init: RequestInit) => Promise<Response>;

const FORWARD = "/__kernel/typeset";

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

/** What the service answered, as this extension reads it. */
interface Typeset {
  readonly outcome: Outcome;
  readonly tex: string;
  readonly bib: string;
  readonly pdf?: string;
  readonly log: readonly string[];
}

export interface Made {
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly outcome: Outcome;
  readonly dataRevision: string;
}

async function words(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? text;
  } catch {
    return text === "" ? `the service answered ${response.status}` : text;
  }
}

/** The venues the typesetting service carries, from its own health answer. */
export async function readVenues(transport: Transport = call): Promise<{ readonly reachable: boolean; readonly venues: readonly Venue[] }> {
  try {
    const answered = await transport(`${FORWARD}/health`, { method: "GET" });
    if (!answered.ok) return { reachable: false, venues: [] };
    const body = (await answered.json()) as { venues?: unknown };
    const venues = Array.isArray(body.venues)
      ? body.venues.flatMap((entry) =>
          typeof entry === "object" && entry !== null && typeof (entry as Venue).id === "string"
            ? [{ id: (entry as Venue).id, name: typeof (entry as Venue).name === "string" ? (entry as Venue).name : (entry as Venue).id }]
            : [],
        )
      : [];
    return { reachable: true, venues };
  } catch {
    return { reachable: false, venues: [] };
  }
}

/** The works a document cites, by identity, as the bibliography holds them. */
export async function citedWorks(document: DocumentView): Promise<Map<string, WorkRecord>> {
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (block.kind !== "text") continue;
    for (const run of block.runs) if (run.cite !== undefined) ids.add(run.cite.work);
  }
  const works = new Map<string, WorkRecord>();
  for (const id of ids) {
    const read = await readWork(id);
    if (read.outcome === "success") works.set(id, read.result.record);
  }
  return works;
}

/** Sends a projection to the service and reads its answer, or a refusal. */
export async function typeset(projection: Projection, venue: string, transport: Transport = call): Promise<{ readonly typeset: Typeset } | { readonly failure: string }> {
  const files: Record<string, string> = {};
  for (const file of projection.files) {
    try {
      files[file.name] = Buffer.from(await readBlob(blobHash(file.objectId))).toString("base64");
    } catch {
      return { failure: `the picture ${file.name} could not be read from the store` };
    }
  }
  const answered = await transport(`${FORWARD}/v1/manuscripts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venue, ast: projection.ast, references: projection.references, files }),
  });
  if (!answered.ok) return { failure: await words(answered) };
  const body = (await answered.json()) as Partial<Typeset>;
  if (!isOutcome(body.outcome) || typeof body.tex !== "string") return { failure: "the typesetting service answered no manuscript" };
  return {
    typeset: {
      outcome: body.outcome,
      tex: body.tex,
      bib: typeof body.bib === "string" ? body.bib : "",
      ...(typeof body.pdf === "string" ? { pdf: body.pdf } : {}),
      log: Array.isArray(body.log) ? body.log.filter((line): line is string => typeof line === "string") : [],
    },
  };
}

async function keep(bytes: Uint8Array, mediaType: string, filename: string): Promise<GraphOutcome<Record<string, unknown>>> {
  const stored = await putBlob(bytes);
  if (stored.outcome !== "success") return stored as GraphOutcome<never>;
  const objectId = objectIdOfHash(stored.result.hash);
  if (objectId === null) return refuse("store", `the store answered no object for ${filename}`);
  return { outcome: "success", result: { ...blobReference(objectId, mediaType, stored.result.size), filename } };
}

/**
 * Makes one manuscript of a document for a venue — the document's own when
 * none is named, else the generic article — and keeps it.
 */
export async function makeManuscript(input: {
  readonly documentId: string;
  readonly venue?: string;
  readonly by: string;
  readonly transport?: Transport;
}): Promise<GraphOutcome<Made>> {
  const read = await readDocument(input.documentId);
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const document = read.result;
  const venue = input.venue ?? document.frontMatter?.venue ?? "generic";
  const revision = document.dataRevision ?? 0;
  const projection = project(document, await citedWorks(document), revision);
  const answered = await typeset(projection, venue, input.transport ?? call);
  if ("failure" in answered) return refuse("typesetting", answered.failure);
  const made = answered.typeset;

  const files: Record<string, unknown>[] = [];
  const kept = [
    await keep(new TextEncoder().encode(made.tex), "text/x-tex", "manuscript.tex"),
    ...(made.bib !== "" ? [await keep(new TextEncoder().encode(made.bib), "text/x-bibtex", "references.bib")] : []),
    ...(made.pdf !== undefined ? [await keep(Buffer.from(made.pdf, "base64"), "application/pdf", "manuscript.pdf")] : []),
  ];
  for (const file of kept) {
    if (file.outcome !== "success") return file as GraphOutcome<never>;
    files.push(file.result);
  }

  const manuscriptId = randomUUID();
  return commit(
    `CREATE (m:${MANUSCRIPT_TYPE} {id: $m_id, of: $m_of, title: $m_title, revision: $m_revision, venue: $m_venue, files: $m_files, made: $m_made, by: $m_by, outcome: $m_outcome, log: $m_log, omitted: $m_omitted, status: "established"})`,
    {
      m_id: manuscriptId,
      m_of: input.documentId,
      m_title: document.title,
      m_revision: revision,
      m_venue: venue,
      m_files: files,
      m_made: new Date().toISOString(),
      m_by: input.by,
      m_outcome: made.outcome,
      m_log: made.log,
      m_omitted: projection.omitted,
    },
    `make a ${venue} manuscript of ${document.title === "" ? input.documentId : document.title}`,
    async (dataRevision, revisionOf) => ({ manuscriptId, revisionId: await revisionOf(manuscriptId), outcome: made.outcome, dataRevision }),
  );
}
