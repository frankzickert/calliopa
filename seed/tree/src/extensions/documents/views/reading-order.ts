import type { BlockView } from "../server/assemble";
import type { ProposedChange } from "../server/documents";

/**
 * Which rows the block editor draws, and in what order: the document's blocks,
 * the retired ones where they sat, and proposed changes against what they
 * concern. Pure, so what the reader sees in which state of the panel's
 * toggles is settled without a browser.
 */

export interface ReadingEntry {
  readonly block: BlockView;
  /** Out of the reading order, shown where it sat because the panel asked:
   * a retired block, or a rejected proposal (`rejected`). BO_0315_015 */
  readonly retired: boolean;
  /** The rejected rewrite, insert or move this removed row draws, where its
   * staged key puts it. BO_0315_015 */
  readonly rejected?: ProposedChange;
  /** Sent as a command, and shown because the bar asked; a prompt is
   * otherwise not drawn at all. BO_0267_015 */
  readonly prompt?: boolean;
}

export const isPrompt = (block: BlockView): boolean =>
  block.kind === "text" && block.standing === "prompt";

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
 * A block carrying no usable key sorts after the placed ones by identity, the
 * same rule the document read already applies.
 */
export function readingOrder(
  blocks: readonly BlockView[],
  retired: readonly BlockView[],
  showPrompts = false,
  rejected: readonly ProposedChange[] = [],
): readonly ReadingEntry[] {
  const entries = [
    ...blocks
      // A prompt leaves the flow and stays in the document. BO_0267_015
      .filter((block) => showPrompts || !isPrompt(block))
      .map((block) => ({
        block,
        retired: false,
        ...(isPrompt(block) ? { prompt: true } : {}),
      })),
    ...retired.map((block) => ({ block, retired: true })),
    ...rejected.flatMap((item) => (item.block === null ? [] : [{ block: item.block, retired: true, rejected: item }])),
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
  | {
      readonly kind: "proposal";
      readonly item: ProposedChange;
      /** The block a shown rewrite stands in place of, whose row is not
       * drawn: the rewrite takes its place, its position and its key.
       * CA_0055_005 */
      readonly replaces?: ReadingEntry;
    };

/**
 * The proposed changes to draw, placed where each concerns the document.
 *
 * An item that would insert a block carries an order key, so it sorts among
 * the blocks by the comparison siblings already sort by. A rewrite takes the
 * place of the block it rewrites, whose row is not drawn: the reader sees the
 * document as it would read, and hides the change to see the block again
 * (CA_0055_005). A block a removal or a move frames keeps its row, and so
 * does `keep`, the block being edited, which must not leave under the caret;
 * a rewrite of either is drawn after it. Any other item that names a block
 * the reader can see is drawn immediately after that block.
 *
 * An item whose block is not in the reading order — one naming a block that
 * has gone since — is drawn at the end rather than dropped, so a group the
 * reader has to answer never hides an item they cannot find.
 */
export function placeProposals(
  entries: readonly ReadingEntry[],
  items: readonly ProposedChange[],
  keep: string | null = null,
): readonly ProposalRow[] {
  // A rewrite the reader moved stands where its staged key puts it, as a new
  // block does, and its block's row is not drawn: accepting it lands the
  // block where the reader sees it. DO_0004_008
  const moved = new Map<string, { readonly entry: ReadingEntry; readonly item: ProposedChange }>();
  for (const entry of entries) {
    const blockId = entry.block.blockId;
    if (entry.retired || blockId === keep) continue;
    const own = items.filter((item) => item.blockId === blockId && item.elsewhere !== true);
    if (own.some((item) => item.kind === "remove" || item.kind === "move")) continue;
    const rewrite = own.find((item) => item.kind === "replace");
    const key = rewrite?.block?.order ?? "";
    if (rewrite !== undefined && key !== "" && key !== entry.block.order) moved.set(blockId, { entry, item: rewrite });
  }
  const movedItems = [...moved.values()].map((value) => value.item);
  const inserts = items.filter(
    (item) => (item.kind === "insert" && (item.block?.order ?? "") !== "") || movedItems.includes(item),
  );
  const attached = new Map<string, ProposedChange[]>();
  for (const item of items) {
    if (inserts.includes(item)) continue;
    // A relation whose source is in another document is drawn there; this
    // document counts it and draws nothing. BO_0244_010
    if (item.elsewhere === true) continue;
    attached.set(item.blockId, [...(attached.get(item.blockId) ?? []), item]);
  }

  const rows: ProposalRow[] = [];
  // The entries keep the order the reading order gave them, and a proposed
  // insert lands among the blocks by its key, before the first block whose
  // key is above it, and after the last one otherwise.
  // Ties are broken by block, as the reading order breaks them, so a drawn
  // proposal stands where accepting it puts it even beside a block that
  // shares its key. DO_0004_008
  const pending = [...inserts].sort((left, right) => {
    const a = left.block?.order ?? "";
    const b = right.block?.order ?? "";
    if (a !== b) return a < b ? -1 : 1;
    return left.blockId < right.blockId ? -1 : left.blockId > right.blockId ? 1 : 0;
  });
  const before = (item: ProposedChange, entry: ReadingEntry): boolean => {
    const key = item.block?.order ?? "";
    return key < entry.block.order || (key === entry.block.order && item.blockId < entry.block.blockId);
  };
  const drawn = new Set<string>();
  const draw = (item: ProposedChange) => {
    const replaces = movedItems.includes(item) ? moved.get(item.blockId)?.entry : undefined;
    rows.push(replaces === undefined ? { kind: "proposal", item } : { kind: "proposal", item, replaces });
    drawn.add(item.itemId);
    // The block's other items follow the rewrite that stands for it.
    if (replaces !== undefined) {
      for (const other of attached.get(item.blockId) ?? []) {
        rows.push({ kind: "proposal", item: other });
        drawn.add(other.itemId);
      }
    }
  };
  for (const entry of entries) {
    while (pending.length > 0 && entry.block.order !== "" && before(pending[0] as ProposedChange, entry)) {
      draw(pending.shift() as ProposedChange);
    }
    // A rejected proposal's row carries none of the block's open items.
    // BO_0315_015
    const own = entry.rejected !== undefined ? [] : (attached.get(entry.block.blockId) ?? []);
    if (entry.rejected !== undefined) {
      rows.push({ kind: "block", ...entry });
      continue;
    }
    // The block a moved rewrite stands for elsewhere is not drawn here.
    if (moved.has(entry.block.blockId)) continue;
    const rewrite =
      entry.retired || entry.block.blockId === keep || own.some((item) => item.kind === "remove" || item.kind === "move")
        ? undefined
        : // A gather's summary stands in its block's place as a rewrite does.
          // BO_0322_013
          own.find((item) => item.kind === "replace" || item.kind === "gather");
    if (rewrite === undefined) {
      rows.push({ kind: "block", ...entry });
    } else {
      rows.push({ kind: "proposal", item: rewrite, replaces: entry });
      drawn.add(rewrite.itemId);
    }
    for (const item of own) if (item !== rewrite) draw(item);
  }
  while (pending.length > 0) draw(pending.shift() as ProposedChange);
  for (const item of items) {
    if (drawn.has(item.itemId) || item.elsewhere === true) continue;
    rows.push({ kind: "proposal", item });
  }
  return rows;
}

/**
 * Where a drawn row is as a place to drop a block (BO_0263_002): a block of
 * the document, a revealed removed row, by its identity, and a
 * proposed insert by its item — a new block has a place before it is
 * accepted. A rewrite, a removal and a move stay with the block they concern,
 * which is their place, and a work item has none.
 */
export function positionOf(row: ProposalRow): string | null {
  // A rejected proposal is reopened, not dropped on or moved. BO_0315_015
  if (row.kind === "block") return row.rejected !== undefined ? null : row.block.blockId;
  // A rewrite standing in its block's place is that place. CA_0055_005
  if (row.replaces !== undefined) return row.replaces.block.blockId;
  const item = row.item;
  if (item.kind !== "insert") return null;
  if ((item.block?.order ?? "") === "") return null;
  return `proposal:${item.itemId}`;
}

/** The order key a row sorts by, "" when it carries none. */
const keyOf = (row: ProposalRow): string =>
  row.kind === "block"
    ? row.block.order
    : row.replaces !== undefined
      ? // A rewrite carries its block's key unless the reader moved it.
        // DO_0004_008
        row.item.block?.order || row.replaces.block.order
      : (row.item.block?.order ?? "");

/**
 * What a drop on a drawn row compiles into: the dragged block goes directly
 * before that row, between the key of the row and the greatest key drawn
 * below it, so it lands where the drop mark showed it whatever the row is —
 * a proposed insert, a removed row as well as a block of the
 * document. The end is after the greatest key drawn. A row carrying no key
 * falls back to the block it is. Null for a position that is not drawn.
 * BO_0263_002
 */
export function dropPlacement(
  rows: readonly ProposalRow[],
  target: string,
):
  | { readonly between: readonly [string | null, string | null] }
  | { readonly before: string }
  | null {
  const keys = rows
    .filter((row) => positionOf(row) !== null)
    .map(keyOf)
    .filter((key) => key !== "")
    .sort();
  if (target === "end") return { between: [keys[keys.length - 1] ?? null, null] };
  const row = rows.find((candidate) => positionOf(candidate) === target);
  if (row === undefined) return null;
  const high = keyOf(row);
  if (high === "") return row.kind === "block" ? { before: row.block.blockId } : null;
  const below = keys.filter((key) => key < high);
  return { between: [below[below.length - 1] ?? null, high] };
}

/** The drawn rows that have a place, in the order they are drawn, with the
 * key each sorts by. */
const positioned = (rows: readonly ProposalRow[]) =>
  rows.flatMap((row) => {
    const position = positionOf(row);
    const key = keyOf(row);
    return position === null || key === "" ? [] : [{ position, key }];
  });

/**
 * One arrow press on a row's grip (BO_0263_013): up lands it directly before
 * the row drawn above it, down directly after the row drawn below it — over
 * every drawn row, a proposed insert or a retired row as well as a block.
 * Null at either end, where the arrow is disabled.
 */
export function stepPlacement(
  rows: readonly ProposalRow[],
  target: string,
  direction: -1 | 1,
): { readonly between: readonly [string | null, string | null] } | null {
  const placed = positioned(rows);
  const at = placed.findIndex((row) => row.position === target);
  if (at < 0) return null;
  const others = placed.filter((_, index) => index !== at);
  // The slot the row takes among the others: before the one it passes going
  // up, after the one it passes going down.
  const slot = direction === -1 ? at - 1 : at + 1;
  if (slot < 0 || slot > others.length) return null;
  const low = others[slot - 1]?.key ?? null;
  const high = others[slot]?.key ?? null;
  if (low !== null && high !== null && low >= high) return null;
  return { between: [low, high] };
}

/**
 * Where *Restore* puts a retired block: where its row is drawn, between the
 * keys drawn on either side of it (BO_0263_012).
 */
export function restorePlacement(
  rows: readonly ProposalRow[],
  blockId: string,
): { readonly between: readonly [string | null, string | null] } | { readonly at: "end" } {
  const placed = positioned(rows);
  const at = placed.findIndex((row) => row.position === blockId);
  if (at < 0) return { at: "end" };
  const low = placed[at - 1]?.key ?? null;
  const high = placed[at + 1]?.key ?? null;
  if (low !== null && high !== null && low >= high) return { at: "end" };
  return { between: [low, high] };
}

/** A drawn row a new block goes below: a block's row (of the document, or a
 * revealed removed one) by its identity, a proposal's by its
 * item, or the lowest row the body draws. DO_0016_001 */
export type RowTarget = { readonly blockId: string } | { readonly itemId: string } | "end";

/**
 * Where a new block goes to read directly below a drawn row (DO_0016_001):
 * between the key that row sorts by and the next key the document knows,
 * hidden rows included — a proposal the reader has hidden or a prompt not
 * shown — so a row the reader cannot see still follows the
 * new block once it is drawn. A row carrying no key of its own — a removal or
 * a relation drawn after its block — is below the nearest keyed row above it.
 * The end goes below the lowest row. An established block
 * with no key at all is named as the anchor; nothing keyed to go below is the
 * end.
 */
export function belowPlacement(
  rows: readonly ProposalRow[],
  target: RowTarget,
  keys: readonly string[],
):
  | { readonly between: readonly [string | null, string | null] }
  | { readonly after: string }
  | { readonly at: "end" } {
  const body = rows;
  const matches = (row: ProposalRow): boolean =>
    target !== "end" &&
    ("itemId" in target
      ? row.kind === "proposal" && row.item.itemId === target.itemId
      : row.kind === "block" && row.block.blockId === target.blockId);
  let at = target === "end" ? body.length - 1 : body.findIndex(matches);
  if (at < 0) {
    if (rows.some(matches)) at = body.length - 1;
    else return target !== "end" && "blockId" in target ? { after: target.blockId } : { at: "end" };
  }
  const own = body[at];
  if (own?.kind === "block" && own.block.order === "") return { after: own.block.blockId };
  let low: string | null = null;
  for (let index = at; index >= 0 && low === null; index -= 1) {
    const key = keyOf(body[index] as ProposalRow);
    if (key !== "") low = key;
  }
  if (low === null) return { at: "end" };
  const floor = low;
  const above = [...keys, ...body.map(keyOf)].filter((key) => key > floor).sort();
  return { between: [floor, above[0] ?? null] };
}
