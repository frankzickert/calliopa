import type { IconName } from "~/components/shell/icons";

/**
 * The working mode a person chose for a document (`BO_0306`): whether the
 * agent widens or narrows the field — explore or consolidate — and whether it
 * reads or makes — understand or create. Every run the document starts
 * carries it; the kernel names it in the run's instructions and judges what
 * the run staged against it. Pure, so the bar, the chip and the route cannot
 * disagree about what the poles are.
 */

export type Field = "explore" | "consolidate";
export type Work = "understand" | "create";
export type Pole = Field | Work;

export interface WorkingMode {
  readonly field: Field;
  readonly work: Work;
}

/** A person's first mode in a document: the closest to what a run did before
 * modes existed. User decision, 2026-09-29 (`BO_0306_Q2`). */
export const FIRST_MODE: WorkingMode = { field: "explore", work: "create" };

/** The mode each pinch works in, its own and not the block's: zooming in
 * searches outside the block and adds to it, zooming out gathers and
 * summarizes. User decisions, 2026-09-30 (`BO_0322_Q19`, `BO_0322_Q22`). */
export const PINCH_MODE: Readonly<Record<"in" | "out", WorkingMode>> = {
  in: { field: "explore", work: "create" },
  out: { field: "consolidate", work: "understand" },
};

/** Each pole in words and as the icon its toggle wears while it is in force. */
export const POLES: Readonly<Record<Pole, { readonly label: string; readonly doing: string; readonly icon: IconName }>> = {
  explore: { label: "Explore", doing: "Exploring", icon: "arrows-out-simple" },
  consolidate: { label: "Consolidate", doing: "Consolidating", icon: "arrows-in-simple" },
  understand: { label: "Understand", doing: "Understanding", icon: "book-open-text" },
  create: { label: "Create", doing: "Creating", icon: "pencil-simple-line" },
};

const OTHER: Readonly<Record<Pole, Pole>> = {
  explore: "consolidate",
  consolidate: "explore",
  understand: "create",
  create: "understand",
};

/** The mode with one axis switched to its other pole. */
export function switched(mode: WorkingMode, axis: "field" | "work"): WorkingMode {
  return axis === "field" ? { ...mode, field: OTHER[mode.field] as Field } : { ...mode, work: OTHER[mode.work] as Work };
}

/** What a toggle is named: the pole in force and what a press switches to. */
export const toggleName = (pole: Pole): string => `${POLES[pole].doing} — switch to ${POLES[OTHER[pole]].label.toLowerCase()}`;

/** The kind of work the two poles make together. */
export function quadrantOf(mode: WorkingMode): string {
  if (mode.field === "explore") return mode.work === "understand" ? "Reconnaissance" : "Prototyping";
  return mode.work === "understand" ? "Synthesis" : "Commitment support";
}

/** A mode read from a record or a body, or null when it names no pole. */
export function readWorkingMode(value: unknown): WorkingMode | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { field, work } = value as { field?: unknown; work?: unknown };
  if (field !== "explore" && field !== "consolidate") return null;
  if (work !== "understand" && work !== "create") return null;
  return { field, work };
}
