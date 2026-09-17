import { clampedOffsets } from "../editor-dom";

/**
 * The words a reader has selected in command mode, as the block they began
 * in and a character range within its text. BO_0227_009
 *
 * The block is the one the selection began in (its anchor), and the range is
 * clamped to it: a passage is one block's words, so a selection dragged past a
 * block's edge keeps the part inside the block it started in rather than
 * being refused.
 */
export interface SelectedWords {
  readonly blockId: string;
  readonly start: number;
  readonly end: number;
  /** Where the selection is on screen, for placing the affordance beside it. */
  readonly bottom: number;
  readonly left: number;
}

export function selectedWords(page: Document): SelectedWords | null {
  const selection = page.getSelection?.() ?? null;
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const anchor = selection.anchorNode;
  const from =
    anchor instanceof Element ? anchor : (anchor?.parentElement ?? null);
  const row =
    from?.closest<HTMLElement>('[data-block-id][data-block-kind="text"]') ??
    null;
  const text = row?.querySelector<HTMLElement>("[data-block-reading]") ?? null;
  const blockId = row?.dataset.blockId;
  if (row === null || text === null || blockId === undefined) return null;
  const range = selection.getRangeAt(0);
  const { start, end } = clampedOffsets(text, range);
  if (start === end) return null;
  const box = range.getBoundingClientRect();
  return { blockId, start, end, bottom: box.bottom, left: box.left };
}
