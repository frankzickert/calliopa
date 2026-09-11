import type { BlockView } from "~/server/documents/assemble";
import type { ProposedChange } from "~/server/documents/documents";

/**
 * Which rows the block editor draws, and in what order: the document's blocks,
 * the retired ones and the discarded ones where they sat, and proposed
 * changes against what they concern. Pure, so what the reader sees in which
 * state of the panel's toggles is settled without a browser. Moved out of the
 * editor's component file with `BO_0227_014`, which added the discarded
 * toggle.
 */

export interface ReadingEntry {
  readonly block: BlockView;
  /** Out of the reading order, shown where it sat because the panel asked. */
  readonly retired: boolean;
  /** Set aside by the reader and shown because the panel asked; a discarded
   * block is otherwise not drawn at all. */
  readonly discarded: boolean;
}

export const isDiscarded = (block: BlockView): boolean =>
  block.kind === "text" && block.standing === "discarded";

/**
 * The blocks to draw, in reading order, with retired blocks interleaved where
 * they sat when they were retired.
 *
 * Position comes from the order key the block held at that moment. The key
 * lives on the block and its last revision still carries it, so a retired
 * block sorts among current siblings by the same string comparison they sort
 * by. A key that no longer falls between two current siblings still sorts
 * somewhere, and that is where it appears: the position is where the block
 * was, not a promise about where restoring would put it.
 *
 * A discarded block keeps its place in the document's order, so it is drawn
 * where it sits when the reader asks to see what they set aside, and not at
 * all otherwise — the call `document-panel.md` made for retired blocks, for
 * the same reason: the position is what makes it mean anything.
 *
 * A block carrying no usable key sorts after the placed ones by identity, the
 * same rule the document read already applies.
 */
export function readingOrder(
  blocks: readonly BlockView[],
  retired: readonly BlockView[],
  showDiscarded: boolean,
): readonly ReadingEntry[] {
  const entries = [
    ...blocks
      .filter((block) => showDiscarded || !isDiscarded(block))
      .map((block) => ({
        block,
        retired: false,
        discarded: isDiscarded(block),
      })),
    ...retired.map((block) => ({ block, retired: true, discarded: false })),
  ];
  const placed = entries.filter((entry) => entry.block.order !== "");
  const unplaced = entries
    .filter((entry) => entry.block.order === "")
    .sort((left, right) => (left.block.blockId < right.block.blockId ? -1 : 1));
  placed.sort((left, right) => {
    if (left.block.order !== right.block.order) {
      return left.block.order < right.block.order ? -1 : 1;
    }
    return left.block.blockId < right.block.blockId ? -1 : 1;
  });
  return [...placed, ...unplaced];
}

export type ProposalRow =
  | ({ readonly kind: "block" } & ReadingEntry)
  | { readonly kind: "proposal"; readonly item: ProposedChange };

/**
 * The proposed changes to draw, placed where each concerns the document.
 *
 * An item that would insert a block carries an order key, so it sorts among
 * the blocks by the comparison siblings already sort by. An item that names a
 * block the reader can see is drawn immediately after that block, because
 * judging a rewrite means seeing it against what it would replace.
 *
 * An item whose block is not in the reading order — one naming a block that
 * has gone since — is drawn at the end rather than dropped, so a group the
 * reader has to answer never hides an item they cannot find.
 */
export function placeProposals(
  entries: readonly ReadingEntry[],
  items: readonly ProposedChange[],
): readonly ProposalRow[] {
  const inserts = items.filter(
    (item) => item.kind === "insert" && (item.block?.order ?? "") !== "",
  );
  const attached = new Map<string, ProposedChange[]>();
  for (const item of items) {
    if (inserts.includes(item)) continue;
    attached.set(item.blockId, [...(attached.get(item.blockId) ?? []), item]);
  }

  const rows: ProposalRow[] = [];
  const placed = [
    ...entries.map((entry) => ({
      order: entry.block.order,
      id: entry.block.blockId,
      row: { kind: "block" as const, ...entry },
    })),
    ...inserts.map((item) => ({
      order: item.block?.order ?? "",
      id: item.itemId,
      row: { kind: "proposal" as const, item },
    })),
  ];
  placed.sort((left, right) => {
    if (left.order === "" || right.order === "") {
      return left.order === right.order ? 0 : left.order === "" ? 1 : -1;
    }
    if (left.order !== right.order) return left.order < right.order ? -1 : 1;
    return left.id < right.id ? -1 : 1;
  });

  const drawn = new Set<string>();
  for (const entry of placed) {
    rows.push(entry.row);
    if (entry.row.kind !== "block") continue;
    for (const item of attached.get(entry.row.block.blockId) ?? []) {
      rows.push({ kind: "proposal", item });
      drawn.add(item.itemId);
    }
  }
  for (const item of items) {
    if (inserts.includes(item) || drawn.has(item.itemId)) continue;
    rows.push({ kind: "proposal", item });
  }
  return rows;
}
