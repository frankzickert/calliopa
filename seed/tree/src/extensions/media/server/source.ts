import { readSession } from "~/server/session";
import { readDocument } from "~/extensions/documents/server/documents";

import { roster } from "./media";

/**
 * What made a picture, and whether anything can make one (`BO_0273_019`,
 * `BO_0273_020`).
 *
 * `source` is the record this extension wrote and the document model never
 * interprets. It is read only when the reader turns to the block, so a
 * document full of pictures costs nothing to read.
 */

export interface MadeBy {
  readonly service?: string;
  readonly model?: string;
  readonly prompt?: string;
  readonly cost?: string;
  readonly job?: string;
  readonly at?: string;
  readonly by?: string;
}

/** What made the picture in this block, or null when nothing did. */
export async function sourceOf(documentId: string, blockId: string): Promise<MadeBy | null> {
  const person = await readSession();
  if (person === null) return null;
  const read = await readDocument(documentId);
  if (read.outcome !== "success") return null;
  const block = read.result.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined || (block.kind !== "image" && block.kind !== "video")) return null;
  const source = block.source;
  if (source === undefined) return null;

  const held = (name: string): string | null =>
    typeof source[name] === "string" && source[name] !== "" ? (source[name] as string) : null;
  const made: Record<string, string> = {};
  for (const [to, from] of [["service", "service"], ["model", "model"], ["prompt", "prompt"],
                            ["cost", "cost"], ["job", "job"], ["by", "proposedBy"]] as const) {
    const value = held(from);
    if (value !== null) made[to] = value;
  }
  // When it was made if it was made, else when it was proposed.
  const when = held("madeAt") ?? held("proposedAt");
  if (when !== null) made["at"] = when;
  return made as MadeBy;
}

/**
 * Whether any generator is signed in. The extension ships active, so the first
 * person to open a document meets its controls before it can do anything: what
 * they must never meet is a failed call or a dead button (`BO_0273_020`).
 */
export async function anyGeneratorSignedIn(): Promise<{ readonly any: boolean; readonly words: string }> {
  const services = await roster();
  if (services.some((service) => service.signedIn)) return { any: true, words: "" };
  return {
    any: false,
    words: "No generator is signed in. Sign in to Higgsfield or OpenArt in Settings, with your own subscription.",
  };
}
