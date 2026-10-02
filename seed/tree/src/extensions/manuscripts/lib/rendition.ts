/**
 * A rendition (`calliopa-bootstrap`'s `BO_0312_021`): what a profile produced
 * of a document carrying *Format*, kept on that document — a root node with no
 * parent and no block flag, as a bibliography's work is. It records one
 * output made of a document's whole reading order — `of` the document, or a
 * block for one kept on a block before *Format* became the document's alone
 * (`BO_0332`), `document` the document it stands in, `revision` the dataRevision it projects, `type` what was produced — the
 * files as the core's blob references hoisted to a top-level list so the core
 * recognizes them as live references, when and by whom, and what the
 * producing service answered: its outcome, its log, and what the projection
 * left out and why. Every rendition made is kept, so what was submitted and
 * what a reviewer saw is on the record (user decision, 2026-09-23).
 */
export const RENDITION_TYPE = "formatRendition";

/** The kept manuscripts before `BO_0312`, closed by its migration and still
 * declared until every install has run it. */
export const MANUSCRIPT_TYPE = "manuscript";

export const OUTCOMES = ["ok", "errors", "failed", "timed out"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** What a rendition is of the kinds *Format* names; the manuscript tool
 * makes `pdf`. */
export const RENDITION_TYPES = ["text", "table", "image", "video", "pdf", "structured"] as const;
export type RenditionType = (typeof RENDITION_TYPES)[number];

/** One of a rendition's files, as the read answers it: the object the blob
 * route takes, with its name, type and size — never the reference. */
export interface RenditionFile {
  readonly objectId: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly size: number;
}

export interface RenditionView {
  readonly renditionId: string;
  readonly revisionId: string;
  /** The document carrying *Format*; a block's id for one kept on a block
   * before *Format* became the document's alone (`BO_0332`). */
  readonly of: string;
  readonly document: string;
  readonly type: RenditionType;
  /** The title at the revision projected. */
  readonly title: string;
  readonly revision: number;
  /** The venue template it was made for, when it was typeset. */
  readonly venue: string;
  readonly files: readonly RenditionFile[];
  readonly made: string;
  readonly by: string;
  readonly outcome: Outcome;
  readonly log: readonly string[];
  readonly omitted: readonly string[];
}

export const isOutcome = (value: unknown): value is Outcome => OUTCOMES.includes(value as Outcome);
export const isRenditionType = (value: unknown): value is RenditionType => RENDITION_TYPES.includes(value as RenditionType);

/** The words a rendition's outcome is said in. */
export const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = {
  ok: "Typeset",
  errors: "Typeset with errors",
  failed: "Not typeset — the source is kept",
  "timed out": "Stopped at the time limit — the source is kept",
};
