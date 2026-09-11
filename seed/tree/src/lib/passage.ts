/**
 * Passage anchors: pointing at words inside a block, and knowing later
 * whether the pointer still points at them. BO_0227_008
 *
 * The anchor is the quote, not a position. Runs carry no offsets anywhere in
 * this system (`block-document-model.md`) because a stored offset names a
 * different character in each runtime the moment text carries an emoji, so a
 * passage remembers its words: it resolves while its exact text is there and
 * goes stale when it is not. It never silently retargets — the quote has to
 * match exactly, so a reference cannot drift onto words the reader did not
 * point at.
 *
 * Offsets here count code points, as the editor's do (`editor-dom.ts`), so a
 * range read from a selection and a range this answers name the same
 * characters. Ported from the retired artifact editor's `lib/passage.ts`
 * (`BO_0137`), which counted UTF-16 units.
 */

/**
 * How much text either side of the words is kept to tell repeated
 * occurrences apart: long enough to separate two uses of one sentence in a
 * paragraph, short enough that ordinary editing nearby does not consume it. It
 * only ever orders candidates; it never decides whether a passage resolves.
 */
export const CONTEXT_CHARS = 32;

/**
 * The most words a passage may quote, in code points — the bound the kernel
 * holds a run's references to (`MaxPassageQuote`), counted the same way. A
 * passage is a clause or a few sentences; a reader pointing at more marks the
 * block.
 */
export const MAX_PASSAGE_QUOTE = 2000;

export interface PassageAnchor {
  /** The exact words. They are the passage's identity. */
  readonly quote: string;
  /** The text immediately before and after, for telling repeats apart. */
  readonly prefix: string;
  readonly suffix: string;
  /** Where the words sat when they were taken, in code points. A hint that
   * orders identical candidates and nothing more. */
  readonly hint: number;
}

export interface PassageRange {
  readonly start: number;
  readonly end: number;
}

/** A quote's length as the bound counts it. */
export const quoteLength = (quote: string): number => [...quote].length;

/** Whether words can be a passage: some, and no more than the bound. */
export const quotable = (quote: string): boolean =>
  quote !== "" && quoteLength(quote) <= MAX_PASSAGE_QUOTE;

/** Anchors the range `[start, end)` of a block's current text. */
export function anchorAt(
  text: string,
  start: number,
  end: number,
): PassageAnchor {
  const characters = [...text];
  return {
    quote: characters.slice(start, end).join(""),
    prefix: characters
      .slice(Math.max(0, start - CONTEXT_CHARS), start)
      .join(""),
    suffix: characters.slice(end, end + CONTEXT_CHARS).join(""),
    hint: start,
  };
}

function sharedTail(left: readonly string[], right: readonly string[]): number {
  let count = 0;
  while (
    count < left.length &&
    count < right.length &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count++;
  }
  return count;
}

function sharedHead(left: readonly string[], right: readonly string[]): number {
  let count = 0;
  while (
    count < left.length &&
    count < right.length &&
    left[count] === right[count]
  ) {
    count++;
  }
  return count;
}

/**
 * Where the anchor's words are in `text` now, or `null` when they are gone.
 *
 * The quote decides: no occurrence is stale, and nothing is guessed. The
 * context either side, then the hint, only choose among occurrences that are
 * already the same words, so neither can move a reference onto different
 * words. The one residual case, stated rather than engineered around: a block
 * holding one sentence twice whose referenced instance is deleted resolves to
 * the surviving twin — the words the reader pointed at, at another place.
 */
export function resolvePassage(
  anchor: PassageAnchor,
  text: string,
): PassageRange | null {
  if (anchor.quote === "") return null;
  const characters = [...text];
  const quote = [...anchor.quote];
  const prefix = [...anchor.prefix];
  const suffix = [...anchor.suffix];
  let best: number | null = null;
  let bestScore = -1;
  for (let at = 0; at + quote.length <= characters.length; at++) {
    if (
      !quote.every((character, index) => characters[at + index] === character)
    )
      continue;
    const score =
      sharedTail(characters.slice(0, at), prefix) +
      sharedHead(characters.slice(at + quote.length), suffix);
    if (
      best === null ||
      score > bestScore ||
      (score === bestScore &&
        Math.abs(at - anchor.hint) < Math.abs(best - anchor.hint))
    ) {
      best = at;
      bestScore = score;
    }
  }
  return best === null ? null : { start: best, end: best + quote.length };
}
