import type { PointedReference } from "./command-target";

/**
 * Naming a reference by typing `#` in a block being written as a command.
 * BO_0227_015 BO_0267_013
 *
 * Typing `#` offers the prompt's references by number, narrowing as digits
 * follow, and choosing one writes `#<number>` where the reader was typing
 * (`command-control.tsx`). Typing a number that exists creates nothing and
 * needs nothing: the words already name it. Pure, so where a pending
 * reference begins is settled without an editor.
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
  const match = /(^|[\s(\[\uFFFC])#(\d*)$/u.exec(before);
  if (match === null) return null;
  const typed = match[2] ?? "";
  return { start: caret - typed.length - 1, typed };
}

/**
 * A `#` and whatever was typed after it, for a reference to a block of the
 * document (`BO_0300_005`): at the start or after whitespace or an opening
 * bracket, running to the caret, any characters but a space or another `#`.
 * Where `pendingReference` reads the digits of a mark, this reads the words
 * a block is found by.
 */
export function pendingBlockReference(text: string, caret: number): PendingReference | null {
  const before = text.slice(0, caret);
  // An atom — a citation, a reference — stands as U+FFFC in the points a
  // block is measured in, and a `#` may follow one directly, so two
  // references can stand side by side (BO_0300 walk, 2026-09-25).
  const match = /(^|[\s(\[\uFFFC])#([^\s#\uFFFC]*)$/u.exec(before);
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
