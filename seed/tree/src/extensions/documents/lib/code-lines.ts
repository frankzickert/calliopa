/**
 * The lines of a code block, counted once for every place that numbers them
 * (`BO_0302_005`, `BO_0302_006`): the read resolving where a block starts,
 * the gutter drawing a number per line, and the manuscript's first number.
 *
 * A line is a run of characters ended by a newline or by the end of the
 * source; a final newline ends the last line rather than starting another,
 * so a formatted block — every formatter ends its answer with a newline —
 * counts the lines a reader sees and not an empty one after them. An empty
 * source has one line, since the field draws one row to type into.
 */
export function lineCount(source: string): number {
  if (source === "") return 1;
  const lines = source.split("\n").length;
  return source.endsWith("\n") ? Math.max(1, lines - 1) : lines;
}

/** The numbers a gutter draws for a block: `count` of them from `first`. */
export function lineNumbersFrom(first: number, count: number): readonly number[] {
  return Array.from({ length: count }, (_, at) => first + at);
}

/** What the resolver needs of a block: its identity, whether it is code,
 * whether it continues, and its source as the read holds it. */
export interface CountedBlock {
  readonly blockId: string;
  readonly kind: string;
  readonly continues?: boolean | undefined;
  /** The code block's source; another kind's `source` is not read. */
  readonly source?: unknown;
}

/**
 * Where each code block's numbering starts, resolved over the reading order
 * (`BO_0302_005`) — the one rule for the read and for the editor: a block
 * that does not continue starts at one; a block that continues starts after
 * the last line of the nearest code block above it, whatever stands between
 * them; a chain counts on; a continuing block with nothing above it starts
 * at one. `typed` holds the line count of a block as it is being written,
 * so the blocks below it re-number while the edit is still under the caret
 * (`BO_0302_006`); a block not in it counts its source as read.
 */
export function resolveFirstLines(blocks: readonly CountedBlock[], typed: Readonly<Record<string, number>> = {}): Record<string, number> {
  const firstLines: Record<string, number> = {};
  let nextLine = 1;
  for (const block of blocks) {
    if (block.kind !== "sourcecode") continue;
    const firstLine = block.continues === true ? nextLine : 1;
    firstLines[block.blockId] = firstLine;
    nextLine = firstLine + (typed[block.blockId] ?? lineCount(typeof block.source === "string" ? block.source : ""));
  }
  return firstLines;
}
