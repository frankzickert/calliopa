/**
 * A block's lines as its line breaks make them: what Up and Down read where
 * nothing is measured. The browser's drawn lines, wraps included, are
 * `views/editor-dom.ts`'s `caretLine`, which falls back to these. DO_0003_002
 */

/** Where a caret stands among a text's lines: on the first, on the last, and
 * how many characters from its line's start. */
export interface LinePlace {
  readonly first: boolean;
  readonly last: boolean;
  readonly column: number;
}

export function linePlace(text: string, offset: number): LinePlace {
  const characters = [...text];
  const at = Math.max(0, Math.min(offset, characters.length));
  const before = characters.slice(0, at);
  const lineStart = before.lastIndexOf("\n") + 1;
  return {
    first: !before.includes("\n"),
    last: !characters.slice(at).includes("\n"),
    column: at - lineStart,
  };
}

/**
 * The offset a caret arriving in a text lands at: on its last line coming up,
 * its first coming down, as many characters in as it stood, or at the line's
 * end when the line is shorter.
 */
export function landingOffset(text: string, column: number, direction: -1 | 1): number {
  const characters = [...text];
  if (direction === 1) {
    const end = characters.indexOf("\n");
    return Math.min(column, end === -1 ? characters.length : end);
  }
  const start = characters.lastIndexOf("\n") + 1;
  return start + Math.min(column, characters.length - start);
}
