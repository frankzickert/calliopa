import { useStore, useVisibleTask$, type Signal } from "@builder.io/qwik";

import type { Marking } from "../lib/references";

/**
 * Which rows a text selection marks while reading (`DO_0023_002`): every row
 * of the reading order it touches, the first and last it covers only in part
 * included, in reading order. A block of the document — kept or fixated —
 * and a proposal are rows alike; a retired row is out
 * of the document and is never marked. User decision, 2026-09-29.
 *
 * It is the editor's text selection, not command mode's marks: it sets no
 * reference, and in command mode nothing is marked here.
 */
export interface MarkedRows {
  /** The blocks of the document the selection touches. */
  readonly blocks: readonly string[];
  /** The proposals the selection touches, by item. */
  readonly items: readonly string[];
}

export const NO_ROWS: MarkedRows = { blocks: [], items: [] };

/** The rows a selection can mark, and what each is called. */
const ROWS = ".block-row[data-block-id], .proposal-block[data-proposal-id]";

/** What a row draws that is not what it says: its grips, toolbars, chip and
 * label. A selection running over them has not reached the row's words. */
const CONTROLS = "button, [data-row-grip], .block-toolbars, .standing-toolbar, .proposal-block__mark, .block-card-label, [aria-hidden='true']";

/**
 * Whether a range reaches into a row: it holds the whole row — which is how a
 * picture, a table or a divider is marked, having no words of its own — or
 * some of the row's words. A selection ending at a row's first edge, or
 * running over its grip alone, has not reached it.
 */
const touches = (range: Range, row: Element): boolean => {
  if (!range.intersectsNode(row)) return false;
  const page = row.ownerDocument;
  const whole = page.createRange();
  whole.selectNodeContents(row);
  // `Range.START_TO_START` and `Range.END_TO_END`, spelled out: the
  // constructor is the page's, and a render harness has none.
  if (range.compareBoundaryPoints(0, whole) <= 0 && range.compareBoundaryPoints(2, whole) >= 0) return true;
  const walker = page.createTreeWalker(row, 4);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const control = node.parentElement?.closest(CONTROLS) ?? null;
    if (control !== null && row.contains(control)) continue;
    if (!range.intersectsNode(node)) continue;
    const words = node.textContent ?? "";
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : words.length;
    if (words.slice(from, to).trim() !== "") return true;
  }
  return false;
};

/** The rows under `root` the selection touches, in document order. */
export function rowsMarked(root: Element, selection: Selection | null): MarkedRows {
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return NO_ROWS;
  const range = selection.getRangeAt(0);
  const blocks: string[] = [];
  const items: string[] = [];
  for (const row of Array.from(root.querySelectorAll(ROWS))) {
    if (!touches(range, row)) continue;
    const item = row.getAttribute("data-proposal-id");
    if (item !== null) {
      items.push(item);
      continue;
    }
    const block = row.getAttribute("data-block-id");
    if (block !== null) blocks.push(block);
  }
  return { blocks, items };
}

/** Whether more than one row is marked: then no row is the bar's subject. */
export const marksSeveral = (rows: MarkedRows): boolean => rows.blocks.length + rows.items.length > 1;

export interface MarkedRowsStore {
  rows: MarkedRows;
  /** A pointer press under way anywhere on the page. While one is, no row
   * takes the focus from a rest of the pointer: redrawing a row moves its
   * words, and a selection anchored in them would jump to the row's end. */
  pressed: boolean;
}

/**
 * The selection's marked rows, kept as the page's selection changes, and the
 * pointer press the page is in. The root carries `data-marks-several` while
 * several rows are marked, written on the element rather than rendered: a
 * render of the view would draw its rows again, and redrawing the row the
 * selection started in takes the start away. The stylesheet hides every
 * row's controls under it. `DO_0023_002`
 */
export function useMarkedRows(input: {
  readonly root: Signal<HTMLElement | undefined>;
  /** Command mode's marking, read at each change: in command mode nothing
   * is marked here. */
  readonly marking: { readonly marking: Marking };
}): MarkedRowsStore {
  const { root, marking } = input;
  const store = useStore<MarkedRowsStore>({ rows: NO_ROWS, pressed: false });
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const element = root.value;
    const page = element?.ownerDocument;
    if (element === undefined || page === undefined) return;
    const changed = () => {
      const next = marking.marking.mode === "reading" ? rowsMarked(element, page.getSelection?.() ?? null) : NO_ROWS;
      const same =
        next.blocks.length === store.rows.blocks.length &&
        next.items.length === store.rows.items.length &&
        next.blocks.every((id, index) => store.rows.blocks[index] === id) &&
        next.items.every((id, index) => store.rows.items[index] === id);
      if (!same) store.rows = next;
      if (marksSeveral(next)) element.setAttribute("data-marks-several", "");
      else element.removeAttribute("data-marks-several");
    };
    const down = () => {
      store.pressed = true;
    };
    const up = () => {
      store.pressed = false;
    };
    page.addEventListener("selectionchange", changed);
    page.addEventListener("pointerdown", down, true);
    page.addEventListener("pointerup", up, true);
    page.addEventListener("pointercancel", up, true);
    cleanup(() => {
      page.removeEventListener("selectionchange", changed);
      page.removeEventListener("pointerdown", down, true);
      page.removeEventListener("pointerup", up, true);
      page.removeEventListener("pointercancel", up, true);
    });
  });
  return store;
}
