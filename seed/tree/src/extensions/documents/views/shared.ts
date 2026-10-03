import type { Captured } from "~/server/port/port";
import { capturedFile } from "~/lib/capture";
import type { Run } from "~/lib/runs";

import { describeOutcome, sendCommand, uploadDocumentFile } from "./documents-client";

/**
 * What capture and a share hand into a document (`docs/system/foundation/device.md`,
 * `calliopa-bootstrap`'s BO_0319_050), placed one after another below a block
 * or at the end, by the user's decisions: a text is a paragraph — one for each
 * stretch between blank lines — an address is a source cited in a new
 * paragraph, and an image an image block. A source is the bibliography's: it
 * is added through its own route, and an address already a source is cited as
 * the one it is; with no bibliography here, the address stands in its
 * paragraph as a link. A file that is no image is named and left out: it
 * belongs on a command's paperclip.
 */

export type Shareable =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "address"; readonly address: string }
  | { readonly kind: "file"; readonly file: File };

/**
 * The event a share for the open document is handed to its editor by
 * (`share.ts`), dispatched on the page's document: the editor showing that
 * document claims it with `taken`.
 */
export const SHARED_EVENT = "documents:shared";
export interface SharedHere {
  readonly documentId: string;
  readonly items: readonly Captured[];
  taken: boolean;
}

/** What the host captured, as what a document takes. */
export function shareables(items: readonly Captured[]): Shareable[] {
  return items.flatMap((item): Shareable[] => {
    if (item.kind === "text") return item.text.trim() === "" ? [] : [{ kind: "text", text: item.text }];
    if (item.kind === "address") return [{ kind: "address", address: item.address }];
    const file = capturedFile(item);
    return file === null ? [] : [{ kind: "file", file }];
  });
}

/** The title of a document made from what was shared: its first line, the address, or the file's name. */
export function sharedTitle(items: readonly Shareable[]): string {
  const first = items[0];
  const words =
    first === undefined
      ? "Shared"
      : first.kind === "text"
        ? (first.text.trim().split("\n")[0] ?? "")
        : first.kind === "address"
          ? first.address.replace(/^https?:\/\//u, "").replace(/\/$/u, "")
          : first.file.name;
  const title = words.trim() === "" ? "Shared" : words.trim();
  return title.length > 80 ? `${title.slice(0, 79).trimEnd()}…` : title;
}

/** The paragraphs of a shared text: each stretch between blank lines. */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

interface Placed {
  /** Why placing stopped, or the files left out, in words; null when all landed. */
  readonly notice: string | null;
  /** The last block placed, to place the next one below. */
  readonly last: string | null;
}

/** The source an address is, added when it is none yet; null without a bibliography. */
async function sourceFor(address: string): Promise<string | null> {
  const added = await fetch("/api/x/bibliography/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: "addWork", record: { kind: "webpage", title: address, URL: address } }),
  }).catch(() => null);
  if (added === null || added.status === 404) return null;
  const answer = (await added.json().catch(() => ({}))) as { outcome?: string; result?: { workId?: string } };
  if (answer.outcome === "success" && answer.result?.workId !== undefined) return answer.result.workId;
  // An address already a source is cited as the one it is.
  const listed = await fetch("/api/x/bibliography/works").catch(() => null);
  if (listed === null || !listed.ok) return null;
  const works = (await listed.json().catch(() => ({}))) as {
    result?: readonly { workId: string; record?: { URL?: string } }[];
  };
  return works.result?.find((work) => work.record?.URL === address)?.workId ?? null;
}

/** Each item placed below `after`, or at the end, in order. */
export async function placeShared(documentId: string, items: readonly Shareable[], after: string | null): Promise<Placed> {
  const left: string[] = [];
  let below = after;
  const insert = async (block: Record<string, unknown>): Promise<string | { notice: string }> => {
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block,
      placement: below === null ? { at: "end" } : { after: below },
    });
    if (outcome.outcome !== "success") return { notice: describeOutcome(outcome) };
    below = outcome.result.blockId;
    return outcome.result.revisionId;
  };
  for (const item of items) {
    try {
      if (item.kind === "text") {
        for (const paragraph of paragraphsOf(item.text)) {
          const written = await insert({ kind: "text", runs: [{ text: paragraph }] });
          if (typeof written !== "string") return { notice: written.notice, last: below };
        }
        continue;
      }
      if (item.kind === "address") {
        const work = await sourceFor(item.address);
        const runs: Run[] =
          work === null ? [{ text: item.address, link: item.address }] : [{ text: `${item.address} ` }, { text: "", cite: { work } }];
        const written = await insert({ kind: "text", runs });
        if (typeof written !== "string") return { notice: written.notice, last: below };
        continue;
      }
      const file = item.file;
      if (file.type !== "" && !file.type.startsWith("image/")) {
        left.push(file.name);
        continue;
      }
      let width: number;
      let height: number;
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        left.push(file.name);
        continue;
      }
      // The bytes go first, so one that will not upload leaves no empty block.
      const uploaded = await uploadDocumentFile(file);
      if (uploaded.outcome !== "success") return { notice: describeOutcome(uploaded), last: below };
      const revisionId = await insert({ kind: "image" });
      if (typeof revisionId !== "string") return { notice: revisionId.notice, last: below };
      const filled = await sendCommand(documentId, {
        command: "fillMediaBlock",
        blockId: below,
        baseRevisionId: revisionId,
        reference: uploaded.result.reference,
        width,
        height,
      });
      if (filled.outcome !== "success") return { notice: describeOutcome(filled), last: below };
    } catch (error) {
      return { notice: `What was handed in could not be placed: ${error instanceof Error ? error.message : String(error)}`, last: below };
    }
  }
  return {
    notice:
      left.length === 0
        ? null
        : `${left.join(", ")} ${left.length === 1 ? "is" : "are"} not an image this document can show; a file for a run goes on a command's paperclip.`,
    last: below,
  };
}
