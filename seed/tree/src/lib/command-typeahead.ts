import type { PointedReference } from "./command-target";
import type { MarkRef, Run } from "./runs";

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

/** What a mark is, as a prompt's reference, a reported mark and a stored one
 * all say it: its kind and what it names, and the number it goes by. */
export interface MarkLike {
  readonly number: number;
  readonly kind: string;
  readonly document?: string | undefined;
  readonly blockId?: string | undefined;
  readonly quote?: string | undefined;
  readonly target?: string | undefined;
  readonly group?: string | undefined;
  readonly item?: string | undefined;
}

/** A mark's identity: what it names, never its number, which is only an
 * alias. */
const markKey = (mark: Omit<MarkLike, "number">): string =>
  [mark.kind, mark.document ?? "", mark.blockId ?? "", mark.quote ?? "", mark.target ?? "", mark.group ?? "", mark.item ?? ""].join("\u0000");

/**
 * The mark standing on what a prompt's reference names, matched by what was
 * marked rather than by the number written, so a mark taken back and another
 * given its number is never taken for it. `BO_0352_007`
 */
export function standingMark<T extends MarkLike>(reference: MarkRef, references: readonly T[]): T | undefined {
  const key = markKey(reference);
  return references.find((standing) => markKey(standing) === key);
}

/**
 * The words a command sends: the block's text with each prompt's reference
 * as `#<n>`, the number of the mark standing on its target now — the number
 * the run is told the reference by. One with no mark standing keeps the
 * number it was written with; the send refuses it first (`unboundMarks`).
 * `BO_0352_007`
 */
export function commandWords(
  runs: readonly Run[],
  references: readonly MarkLike[],
): string {
  return runs
    .map((entry) =>
      entry.markRef === undefined
        ? entry.text
        : `#${standingMark(entry.markRef, references)?.number ?? entry.markRef.number}`,
    )
    .join("");
}

/**
 * The prompt's references no mark stands on any more, by the number each
 * was written with: a command carrying one would name nothing, as a dangling
 * `#n` does. `BO_0352_007`
 */
export function unboundMarks(
  runs: readonly Run[],
  references: readonly MarkLike[],
): readonly number[] {
  const numbers: number[] = [];
  for (const entry of runs) {
    if (entry.markRef === undefined || standingMark(entry.markRef, references) !== undefined) continue;
    if (!numbers.includes(entry.markRef.number)) numbers.push(entry.markRef.number);
  }
  return numbers;
}
