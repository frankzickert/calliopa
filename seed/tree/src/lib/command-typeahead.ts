import type { PointedReference } from "./command-target";

/**
 * Naming a reference by typing `#` in the composer. BO_0227_015
 *
 * Typing `#` offers the document's references by number, narrowing as digits
 * follow, and choosing one writes `#<number>` where the reader was typing.
 * Typing a number that exists creates nothing and needs nothing: the words
 * already name it. Pure, so where a pending reference begins and what
 * choosing inserts are settled without a textarea.
 */

export interface PendingReference {
  /** Where the `#` stands, in UTF-16 units — a textarea's own offsets. */
  readonly start: number;
  /** The digits typed after it. */
  readonly typed: string;
}

/**
 * The reference being typed at the caret: a `#` followed by digits only,
 * standing at the start of the text or after whitespace or an opening
 * bracket, so `C#` and `issue#3` are not taken for one.
 */
export function pendingReference(
  text: string,
  caret: number,
): PendingReference | null {
  const before = text.slice(0, caret);
  const match = /(^|[\s(\[])#(\d*)$/u.exec(before);
  if (match === null) return null;
  const typed = match[2] ?? "";
  return { start: caret - typed.length - 1, typed };
}

/** The references a pending `#` could mean, in mark order. */
export function referenceMatches(
  references: readonly PointedReference[],
  typed: string,
): readonly PointedReference[] {
  return references.filter((reference) =>
    String(reference.number).startsWith(typed),
  );
}

/** The text with the pending reference written out as `#<number>`, and the
 * caret after it, a space following so the reader types on. */
export function insertReference(
  text: string,
  pending: PendingReference,
  caret: number,
  number: number,
): { readonly text: string; readonly caret: number } {
  const written = `#${number} `;
  const after = text.slice(caret).replace(/^ /u, "");
  return {
    text: `${text.slice(0, pending.start)}${written}${after}`,
    caret: pending.start + written.length,
  };
}

/**
 * The reference numbers the command's words name, in the order written: `#n`
 * standing where a reference is typed — at the start or after whitespace or
 * an opening bracket — and not running on into a word.
 */
export function namedNumbers(text: string): readonly number[] {
  const numbers: number[] = [];
  for (const match of text.matchAll(/(?:^|[\s(\[])#(\d+)(?![\p{L}\p{N}_])/gu)) {
    const number = Number(match[1]);
    if (!numbers.includes(number)) numbers.push(number);
  }
  return numbers;
}

/**
 * The numbers the words name that no reference stands under — a mark taken
 * back after its number was written. A command carrying one would name a
 * reference with nothing behind it, which is why a stale passage stops a
 * command too.
 */
export function danglingNumbers(
  text: string,
  references: readonly PointedReference[],
): readonly number[] {
  return namedNumbers(text).filter(
    (number) => !references.some((reference) => reference.number === number),
  );
}
