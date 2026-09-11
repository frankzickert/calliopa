import { rangeAt } from "../editor-dom";

/**
 * Draws resolved passages where they sit, and answers where each one's number
 * goes. BO_0227_009
 *
 * The CSS Custom Highlight API paints a `Range` without writing a node into
 * the text, which is what the rule every slice of the old editor relearned
 * asks for: nothing that changes while the reader is pointing may re-render
 * the words they are pointing at. A browser without the API draws no tint and
 * still gets the numbers, which carry the passage without colour anyway.
 */

/** The one highlight a document's passages are painted under. */
export const PASSAGE_HIGHLIGHT = "calliopa-passage";

export interface PaintedPassage {
  readonly blockId: string;
  readonly number: number;
  readonly start: number;
  readonly end: number;
}

/** Where a passage's number sits, relative to its row. */
export interface PassageBadge {
  readonly number: number;
  readonly top: number;
  readonly left: number;
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

const registry = (page: Document): HighlightRegistry | null => {
  const frame = page.defaultView as
    (Window & { CSS?: { highlights?: HighlightRegistry } }) | null;
  return frame?.CSS?.highlights ?? null;
};

/**
 * Paints `passages` over their rows' reading text and answers each number's
 * place, per block. Replaces whatever was painted before, so calling it with
 * nothing clears it.
 */
export function paintPassages(
  root: HTMLElement,
  passages: readonly PaintedPassage[],
): Readonly<Record<string, readonly PassageBadge[]>> {
  const page = root.ownerDocument;
  const ranges: Range[] = [];
  const badges: Record<string, PassageBadge[]> = {};
  for (const passage of passages) {
    const row =
      Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]")).find(
        (candidate) => candidate.dataset.blockId === passage.blockId,
      ) ?? null;
    const text =
      row?.querySelector<HTMLElement>("[data-block-reading]") ?? null;
    if (row === null || text === null) continue;
    const range = rangeAt(text, passage.start, passage.end);
    ranges.push(range);
    const first = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    (badges[passage.blockId] ??= []).push({
      number: passage.number,
      top: first.top - box.top,
      left: first.left - box.left,
    });
  }
  const highlights = registry(page);
  const Highlight = (
    page.defaultView as
      (Window & { Highlight?: new (...ranges: Range[]) => unknown }) | null
  )?.Highlight;
  if (highlights !== null) {
    if (ranges.length === 0 || Highlight === undefined)
      highlights.delete(PASSAGE_HIGHLIGHT);
    else highlights.set(PASSAGE_HIGHLIGHT, new Highlight(...ranges));
  }
  return badges;
}
