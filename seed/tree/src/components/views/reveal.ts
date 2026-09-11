import type { RevealTarget } from "~/lib/command-target";
import { passageState, type Marking } from "~/lib/references";
import { runsText } from "~/lib/runs";
import type { BlockView } from "~/server/documents/assemble";
import { rangeAt } from "./editor-dom";
import type { PaintedPassage } from "./passages/painter";

/**
 * Shows the reader what a chip in the composer points at: the block scrolled
 * into view and briefly emphasized, or the passage's words. CA_0039_005
 *
 * Written onto the row rather than rendered, so revealing never re-renders the
 * rows, and the emphasis ends by itself: nothing about it is state the reader
 * has to undo, and it leaves no trace in the markup once it is over. A passage
 * is painted with the CSS Custom Highlight API under a highlight of its own,
 * beside the one command mode paints its passages under, so it shows in
 * reading mode too; a browser without the API still gets the row's emphasis.
 */

/** The one highlight a revealed passage is painted under. */
export const REVEAL_HIGHLIGHT = "calliopa-reveal";

/** How long the emphasis stays. */
export const REVEAL_MS = 1600;

/**
 * The passage a target names, where its words stand now, or null when there
 * are none to show: a block target, a number no passage carries, or a passage
 * gone stale — for which the block is revealed instead.
 */
export function revealedPassage(
  target: RevealTarget,
  marking: Marking,
  blocks: readonly BlockView[],
): PaintedPassage | null {
  if (target.kind !== "passage") return null;
  const reference = marking.references.find(
    (candidate) =>
      candidate.kind === "passage" &&
      candidate.number === target.number &&
      candidate.blockId === target.blockId,
  );
  if (reference === undefined || reference.kind !== "passage") return null;
  const block = blocks.find(
    (candidate) => candidate.blockId === target.blockId,
  );
  if (block === undefined || block.kind !== "text") return null;
  const state = passageState(reference, runsText(block.runs));
  return state.stale
    ? null
    : { blockId: target.blockId, number: target.number, ...state.range };
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

/**
 * Scrolls the target's row into view and emphasizes it: the row for a block,
 * the words for a passage. Answers what ends the emphasis early, which a
 * second reveal calls before starting its own.
 */
export function showArea(
  root: HTMLElement,
  target: RevealTarget,
  passage: PaintedPassage | null,
): () => void {
  const row =
    Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]")).find(
      (candidate) => candidate.getAttribute("data-block-id") === target.blockId,
    ) ?? null;
  if (row === null) return () => undefined;
  if (typeof row.scrollIntoView === "function")
    row.scrollIntoView({ block: "center" });
  row.setAttribute("data-revealed", passage === null ? "block" : "passage");

  const page = row.ownerDocument.defaultView as
    | (Window & {
        CSS?: { highlights?: HighlightRegistry };
        Highlight?: new (...ranges: Range[]) => unknown;
      })
    | null;
  const highlights = page?.CSS?.highlights ?? null;
  const text = row.querySelector<HTMLElement>("[data-block-reading]");
  if (passage !== null && text !== null && highlights !== null && page?.Highlight) {
    highlights.set(
      REVEAL_HIGHLIGHT,
      new page.Highlight(rangeAt(text, passage.start, passage.end)),
    );
  }

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    row.removeAttribute("data-revealed");
    highlights?.delete(REVEAL_HIGHLIGHT);
  };
  const timer = setTimeout(end, REVEAL_MS);
  return end;
}
