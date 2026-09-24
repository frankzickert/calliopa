import { createContextId } from "@builder.io/qwik";

/**
 * What a citation's hover card shows (`BO_0291_026`), by the cited work's
 * identity: who, when and what, the address, whether the work holds a file.
 * The editor fills it from the bibliography's `references` route when the
 * document cites anything and again when the document changes; a tree with
 * no bibliography answers nothing, and a citation then draws its number with
 * no card. It is the bibliography's to say what a work is, which is why this
 * is read rather than derived here.
 */
export interface CitedWork {
  readonly workId: string;
  readonly number: number;
  readonly title: string;
  readonly line: string;
  readonly doi?: string;
  readonly url?: string;
  readonly file: boolean;
}

export interface CitedWorks {
  byWork: Record<string, CitedWork>;
  /** The document's own numbering and the works cited that are not at the
   * pin, as its last read answered them — refreshed after a save that
   * carries a citation — so the editing surface and a proposed sentence
   * draw what the read derives. BO_0291_025 */
  numbers: Record<string, number>;
  missing: readonly string[];
  /** Each citation's label in the document's style, by `citationKey` of
   * `~/lib/runs`; empty when nothing answers. BO_0291_030 */
  labels: Record<string, string>;
}

export const CitedWorksContext = createContextId<CitedWorks>("documents.cited-works");
