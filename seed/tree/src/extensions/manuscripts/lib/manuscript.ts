/**
 * A kept manuscript (`BO_0293_018`): a root node with no parent and no block
 * flag, as a bibliography's work is, recording one manuscript made of one
 * document — `of` the document, `revision` the dataRevision it projects, the
 * venue, the files as the core's blob references hoisted to a top-level list
 * so the core recognizes them as live references, when and by whom, and what
 * the typesetting answered: its outcome, its log, and what the projection
 * left out and why. Every manuscript made is kept, so what was submitted and
 * what a reviewer saw is on the record (user decision, 2026-09-23).
 */
export const MANUSCRIPT_TYPE = "manuscript";

export const OUTCOMES = ["ok", "errors", "failed", "timed out"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** One of a manuscript's files, as the read answers it: the object the blob
 * route takes, with its name, type and size — never the reference. */
export interface ManuscriptFile {
  readonly objectId: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly size: number;
}

export interface ManuscriptView {
  readonly manuscriptId: string;
  readonly revisionId: string;
  readonly of: string;
  /** The document's title at the revision projected, for the listing. */
  readonly title: string;
  readonly revision: number;
  readonly venue: string;
  readonly files: readonly ManuscriptFile[];
  readonly made: string;
  readonly by: string;
  readonly outcome: Outcome;
  readonly log: readonly string[];
  readonly omitted: readonly string[];
}

/** The venues a manuscript is made for, as the typesetting service answers
 * them; the service is the one list, so adding a venue is a template there
 * and nothing here. */
export interface Venue {
  readonly id: string;
  readonly name: string;
}

export const isOutcome = (value: unknown): value is Outcome => OUTCOMES.includes(value as Outcome);

/** The words a manuscript's outcome is said in. */
export const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = {
  ok: "Typeset",
  errors: "Typeset with errors",
  failed: "Not typeset — the source is kept",
  "timed out": "Stopped at the time limit — the source is kept",
};
