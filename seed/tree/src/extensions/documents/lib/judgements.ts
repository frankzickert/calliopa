import type { Run } from "~/lib/runs";

/**
 * Judgements as the shell reads them (`BO_0248`): the system's own record of
 * what a refinement judged about a block or a relation — an edit's class, the
 * pressure a change put on a dependent block, a silence, a threshold — and
 * the derivations the surfaces draw from them, pure, so the server that reads
 * the graph and the editor that draws cannot disagree: which pressure is
 * unresolved, what a block's classification is, a relation's track record,
 * and the document's derived state. Nothing here is stored; every answer is
 * computed from the judgements on record.
 */

export const CHANGE_OUTCOMES = ["reworded", "clarified", "narrowed", "broadened", "changed"] as const;
export type ChangeOutcome = (typeof CHANGE_OUTCOMES)[number];
export const isChangeOutcome = (value: unknown): value is ChangeOutcome =>
  typeof value === "string" && (CHANGE_OUTCOMES as readonly string[]).includes(value);

export const PRESSURE_OUTCOMES = ["unaffected", "possiblyRelevant", "material", "invalidated"] as const;
export type PressureOutcome = (typeof PRESSURE_OUTCOMES)[number];

/** One judgement as the graph holds it, flattened for the derivations. */
export interface Judgement {
  readonly judgementId: string;
  readonly about: string;
  readonly outcome: string;
  readonly explanation: readonly Run[];
  readonly dataRevision: number;
  readonly recordedAt: number;
  /** The run that recorded it, or null when a person did. */
  readonly run: string | null;
  readonly by: string;
  /** The block or relation the judgement is on: the first `judges` edge. */
  readonly subject: string;
  /** The block a pressure judgement concerns beside its relation. */
  readonly target: string | null;
  /** An earlier judgement this one resolves, by id. */
  readonly resolves: string | null;
  /** Who marked it seen and when, once the reader did. */
  readonly resolved: string | null;
}

/** The outcomes that stand on a block as pressure; `unaffected` is the
 * recorded silence and stands on nothing. */
const STANDING_OUTCOMES: readonly string[] = ["possiblyRelevant", "material", "invalidated"];

/**
 * The pressure judgements on a block that still stand: the newest per
 * relation — a later pressure judgement on the same relation resolves the
 * earlier — with no `resolved`, not named by any later judgement's
 * `resolves`, and an outcome that is pressure rather than silence. Newest
 * first. BO_0248_010
 */
export function unresolvedPressure(judgements: readonly Judgement[], blockId: string): readonly Judgement[] {
  const resolvedIds = new Set(judgements.map((judgement) => judgement.resolves).filter((id): id is string => id !== null));
  const pressure = judgements.filter((judgement) => judgement.about === "pressure" && judgement.target === blockId);
  return pressure
    .filter(
      (judgement) =>
        !pressure.some(
          (later) =>
            later.judgementId !== judgement.judgementId && later.subject === judgement.subject && later.dataRevision > judgement.dataRevision,
        ),
    )
    .filter((judgement) => judgement.resolved === null && !resolvedIds.has(judgement.judgementId))
    .filter((judgement) => STANDING_OUTCOMES.includes(judgement.outcome))
    .sort((left, right) => right.dataRevision - left.dataRevision);
}

/** The newest `change` judgement on a block, or null. BO_0248_010 */
export function classificationOf(judgements: readonly Judgement[], blockId: string): Judgement | null {
  return (
    judgements
      .filter((judgement) => judgement.about === "change" && judgement.subject === blockId)
      .sort((left, right) => right.dataRevision - left.dataRevision)[0] ?? null
  );
}

/** A relation's track record: how often it fired, stayed quiet, and was
 * corrected by a person; and, when it needs review, why. BO_0248_010 */
export interface RelationRecord {
  readonly fired: number;
  readonly quiet: number;
  readonly corrected: number;
  readonly needsReview: readonly Run[] | null;
}

export function recordOf(judgements: readonly Judgement[], relationId: string, state: string): RelationRecord {
  const own = judgements.filter((judgement) => judgement.subject === relationId);
  const pressure = own.filter((judgement) => judgement.about === "pressure").sort((left, right) => right.dataRevision - left.dataRevision);
  return {
    fired: pressure.filter((judgement) => judgement.outcome === "material" || judgement.outcome === "invalidated").length,
    quiet: pressure.filter((judgement) => judgement.outcome === "unaffected").length,
    corrected: own.filter((judgement) => judgement.run === null).length,
    needsReview: state === "needsReview" ? (pressure[0]?.explanation ?? []) : null,
  };
}

export type DocumentState = "underPressure" | "needsReview" | null;

/** The document's derived state from its blocks' unresolved pressure:
 * needs review while any is invalidated, under pressure while any is
 * material, neither otherwise. BO_0248_010 */
export function documentStateOf(pressureByBlock: Readonly<Record<string, readonly Judgement[]>>): DocumentState {
  const outcomes = Object.values(pressureByBlock).flat().map((judgement) => judgement.outcome);
  if (outcomes.includes("invalidated")) return "needsReview";
  if (outcomes.includes("material")) return "underPressure";
  return null;
}

/** The judgements on a block, newest first: the audit's record. BO_0248_016 */
export const judgementsOn = (judgements: readonly Judgement[], subject: string): readonly Judgement[] =>
  judgements.filter((judgement) => judgement.subject === subject || judgement.target === subject).sort((left, right) => right.dataRevision - left.dataRevision);

/** The pressure layer's opening line for an outcome. BO_0248_008 */
export const pressureHeadline = (outcome: string): string =>
  outcome === "possiblyRelevant" ? "This change may be relevant here." : "A dependent premise has changed.";

/** Whether an outcome marks the block at rest: only material and invalidated
 * do; possibly relevant reads on focus alone. BO_0248_008 */
export const marksAtRest = (outcome: string): boolean => outcome === "material" || outcome === "invalidated";

/** The classification's line: *Treated as a material change*. BO_0248_009 */
export function classificationWords(outcome: string): string {
  switch (outcome) {
    case "reworded":
      return "Treated as a rewording";
    case "clarified":
      return "Treated as a clarification";
    case "narrowed":
      return "Treated as narrowing";
    case "broadened":
      return "Treated as broadening";
    case "changed":
      return "Treated as a material change";
    default:
      return `Treated as ${outcome}`;
  }
}

/** The correction control's three choices, each the outcome it records. BO_0248_009 */
export const CORRECTIONS: readonly { readonly label: string; readonly outcome: ChangeOutcome }[] = [
  { label: "Reword", outcome: "reworded" },
  { label: "Clarification", outcome: "clarified" },
  { label: "Material", outcome: "changed" },
];

/** The record line under a relation: zero parts left out. BO_0248_016 */
export function recordWords(record: RelationRecord): string {
  const parts: string[] = [];
  if (record.fired > 0) parts.push(`fired correctly on ${record.fired} ${record.fired === 1 ? "change" : "changes"}`);
  if (record.quiet > 0) parts.push(`stayed quiet on ${record.quiet}`);
  if (record.corrected > 0) parts.push(`corrected by a person ${record.corrected === 1 ? "once" : `${record.corrected} times`}`);
  return parts.join(" · ");
}

/** *2 hours ago*, from a millisecond stamp; an unknown stamp says nothing. */
export function relativeTime(at: number, now = Date.now()): string {
  if (!(at > 0)) return "";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}
