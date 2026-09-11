import { MARK, type Standing } from "~/lib/disposition";
import type { EditorMode } from "~/lib/references";

/**
 * A block row's accessible name: which block, and what command mode and the
 * disposition scale say about it — its reference, its passages and whether
 * any is stale, and its standing. The number badges and the standing mark are
 * decoration to a screen reader, so this is where those facts are said.
 * `CA_0020_003`'s names stand as they were when a row has neither passages
 * nor a standing. BO_0227_009 BO_0227_012
 */
export interface RowFacts {
  readonly position: number;
  readonly mode: EditorMode;
  readonly reference: number | null;
  readonly passages: readonly {
    readonly number: number;
    readonly stale: boolean;
  }[];
  readonly standing: Standing;
}

const listed = (numbers: readonly number[]): string =>
  numbers.length === 1
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;

function passagesSaid(passages: RowFacts["passages"]): string {
  const standing = passages
    .filter((passage) => !passage.stale)
    .map((passage) => passage.number);
  const stale = passages
    .filter((passage) => passage.stale)
    .map((passage) => passage.number);
  return [
    standing.length === 0
      ? ""
      : `, ${standing.length === 1 ? "passage" : "passages"} ${listed(standing)}`,
    stale.length === 0
      ? ""
      : `, ${stale.length === 1 ? "passage" : "passages"} ${listed(stale)} stale`,
  ].join("");
}

const standingSaid = (standing: Standing): string =>
  MARK[standing] === undefined ? "" : `, ${MARK[standing]}`;

/** The name of a row in command mode, where the row is what a press marks. */
export function markingName(facts: RowFacts): string {
  const base =
    facts.reference === null
      ? `Mark block ${facts.position}`
      : `Block ${facts.position}, reference ${facts.reference}`;
  return `${base}${passagesSaid(facts.passages)}${standingSaid(facts.standing)}`;
}

/** The name of a reading block, which is the way into editing it. */
export const readingName = (facts: RowFacts): string =>
  `Edit block ${facts.position}${standingSaid(facts.standing)}`;
