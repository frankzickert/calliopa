import { DERIVED_SECTIONS, derivedSection, type DerivedSection } from "~/extensions/documents/lib/depth";
import type { BlockView } from "../server/assemble";
import type { ProposedChange } from "../server/documents";

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
  /** The derived section this block renders in after the body, and the
   * heading it opens when it is the section's first. CA_0046_005 */
  readonly section?: DerivedSection;
  readonly heading?: string;
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
  return withSections([...placed, ...unplaced]);
}

/**
 * The body first, in its order, then the derived sections in their fixed
 * order — *What matters now*, *Tension*, *Alternatives*, *If accepted*,
 * *Next* — each in order-key order, the first entry of a section carrying its
 * heading. A derived block keeps its row: it focuses, expands, pins and is
 * edited like any block. CA_0046_005
 */
export function withSections(entries: readonly ReadingEntry[]): readonly ReadingEntry[] {
  const body = entries.filter((entry) => derivedSection(entry.block) === null);
  const sections = DERIVED_SECTIONS.flatMap(({ kind, heading }) =>
    entries
      .filter((entry) => derivedSection(entry.block) === kind)
      .map((entry, index) => ({ ...entry, section: kind, ...(index === 0 ? { heading } : {}) })),
  );
  return [...body, ...sections];
}

export type ProposalRow =
  | ({ readonly kind: "block" } & ReadingEntry)
  | {
      readonly kind: "proposal";
      readonly item: ProposedChange;
      /** A derived candidate's section, and the heading it opens when no
       * established block opened it. BO_0246_006 */
      readonly section?: DerivedSection;
      readonly heading?: string;
    };

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
  // A derived candidate a system run inserts belongs to its section, under
  // its heading, never among the body by its key: the section is where the
  // reader looks for what matters now. BO_0246_006
  const sectioned = items.filter(
    (item) => item.kind === "insert" && item.derived === true && item.block !== null && derivedSection(item.block) !== null,
  );
  const inserts = items.filter(
    (item) => item.kind === "insert" && (item.block?.order ?? "") !== "" && !sectioned.includes(item),
  );
  const attached = new Map<string, ProposedChange[]>();
  for (const item of items) {
    if (inserts.includes(item) || sectioned.includes(item)) continue;
    // A relation whose source is in another document is drawn there; this
    // document counts it and draws nothing. BO_0244_010
    if (item.elsewhere === true) continue;
    attached.set(item.blockId, [...(attached.get(item.blockId) ?? []), item]);
  }

  const rows: ProposalRow[] = [];
  // The entries keep the order the reading order gave them — the body, then
  // the derived sections (CA_0046_005) — and a proposed insert lands among
  // the body's blocks by its key, before the first body block whose key is
  // above it, and after the last one otherwise; never inside a section.
  const pending = [...inserts].sort((left, right) => {
    const a = left.block?.order ?? "";
    const b = right.block?.order ?? "";
    if (a !== b) return a < b ? -1 : 1;
    return left.itemId < right.itemId ? -1 : 1;
  });
  const drawn = new Set<string>();
  const draw = (item: ProposedChange) => {
    rows.push({ kind: "proposal", item });
    drawn.add(item.itemId);
  };
  for (const entry of entries) {
    if (entry.section === undefined) {
      while (pending.length > 0 && (pending[0]?.block?.order ?? "") <= entry.block.order && entry.block.order !== "") {
        draw(pending.shift() as ProposedChange);
      }
    } else {
      while (pending.length > 0) draw(pending.shift() as ProposedChange);
    }
    rows.push({ kind: "block", ...entry });
    for (const item of attached.get(entry.block.blockId) ?? []) draw(item);
  }
  while (pending.length > 0) draw(pending.shift() as ProposedChange);
  // The sectioned candidates: after their section's last row, or, for a
  // section no established block opened, as rows of their own under the
  // heading, in the sections' fixed order.
  for (const { kind, heading } of DERIVED_SECTIONS) {
    const own = sectioned.filter((item) => item.block !== null && derivedSection(item.block) === kind);
    if (own.length === 0) continue;
    let at = -1;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (row !== undefined && row.kind === "block" && row.section === kind) {
        at = index;
        break;
      }
    }
    const opened = at >= 0;
    const placedRows: ProposalRow[] = own.map((item, index) => ({
      kind: "proposal",
      item,
      section: kind,
      ...(!opened && index === 0 ? { heading } : {}),
    }));
    if (opened) {
      // After the section's last block and whatever is attached to it.
      let end = at + 1;
      while (end < rows.length && rows[end]?.kind === "proposal" && rows[end]?.section === undefined) end += 1;
      rows.splice(end, 0, ...placedRows);
    } else {
      // Before the first later section, so the fixed order holds.
      const later = DERIVED_SECTIONS.slice(DERIVED_SECTIONS.findIndex((section) => section.kind === kind) + 1).map((section) => section.kind);
      const before = rows.findIndex((row) => (row.kind === "block" ? row.section : row.section) !== undefined && later.includes((row.kind === "block" ? row.section : row.section) as DerivedSection));
      if (before >= 0) rows.splice(before, 0, ...placedRows);
      else rows.push(...placedRows);
    }
    for (const item of own) drawn.add(item.itemId);
  }
  for (const item of items) {
    if (drawn.has(item.itemId) || item.elsewhere === true) continue;
    rows.push({ kind: "proposal", item });
  }
  return rows;
}
