/**
 * What a figure or a table reference is drawn as, and what a numbered figure
 * or table is labelled (`BO_0295_010`, `BO_0295_012`): one set of words for
 * the reading row, the editing surface and the block's own label, so the three
 * never disagree. A reference whose block is gone from the document, or asks
 * for no number, says so in words — never a stale number and never nothing.
 */
export type NumberedKind = "figure" | "table";

const NAME: Readonly<Record<NumberedKind, string>> = { figure: "Figure", table: "Table" };

/** The label a reference run is drawn as. */
export const referenceLabel = (kind: NumberedKind, number: number | undefined): string =>
  number === undefined ? `(${kind} gone)` : `${NAME[kind]} ${number}`;

/** The label a numbered figure or table carries before its caption. */
export const numberLabel = (kind: NumberedKind, number: number): string => `${NAME[kind]} ${number}.`;
