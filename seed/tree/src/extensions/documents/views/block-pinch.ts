import { midpoint, pinchOutcome, pinchProgress, spread, type Point } from "~/lib/pinch";

/**
 * The pinch on touch, kept outside Qwik like the swipe (`block-swipe.ts`):
 * two fingers on a reading row, and the release decides. Zooming in past the
 * threshold deepens that block; zooming out gathers its neighbours into its
 * focused work. Each is a run with no words, which `pinched` sends; a pinch
 * off a reading row or on a proposal does nothing, and no pinch opens or leaves focused work.
 * Every decision about a release is `~/lib/pinch`'s; this reads the touches.
 * The surface's `touch-action` keeps the browser's own zoom off it, and every
 * two-finger move takes the default besides, so the page never zooms under
 * the gesture. A mouse never pinches. CA_0047_006 BO_0322_010
 *
 * The gesture shows itself while it runs: the row under the fingers carries
 * `data-pinch` with `--pinch` set to the progress, so it grows as the fingers
 * spread, draws in as they close, and reads as armed once the threshold is
 * passed either way. While the fingers close, the rows around it as far as
 * its section runs — up to the nearest heading each way — carry
 * `data-pinch-neighbour` and draw toward it: a hint only, since what is
 * gathered is the run's to say. Everything is cleared on release.
 * BO_0322_011
 */
export function installPinch(page: Document, pinched: (pinch: "in" | "out", blockId: string) => void): () => void {
  type Neighbour = { readonly row: HTMLElement; readonly side: "above" | "below" };
  let start: { spread: number; row: HTMLElement | null; neighbours: Neighbour[] } | null = null;

  const points = (event: TouchEvent): [Point, Point] | null => {
    const touches = event.touches as TouchList | undefined;
    if (touches === undefined || touches.length !== 2) return null;
    const a = touches[0];
    const b = touches[1];
    if (a === undefined || b === undefined) return null;
    return [
      { x: a.clientX, y: a.clientY },
      { x: b.clientX, y: b.clientY },
    ];
  };
  // An element that can be styled, read without the page's globals, which a
  // document built outside a browser does not define.
  const reading = (element: Element | null): element is HTMLElement =>
    element !== null &&
    typeof (element as HTMLElement).style === "object" &&
    element.matches("[data-block-id]") &&
    element.querySelector("[data-block-reading]") !== null;
  // A proposal is answered, not pinched: a pinch on one does nothing.
  const rowAt = (at: Point): HTMLElement | null => {
    const under = page.elementFromPoint(at.x, at.y);
    if (under === null || under.closest("[data-proposal-id]") !== null) return null;
    const row = under.closest("[data-block-id]");
    return reading(row) ? row : null;
  };
  const heading = (row: Element): boolean => /^h[1-6]$/.test(row.querySelector("[data-block-reading]")?.getAttribute("data-role") ?? "");
  /** The rows around a row as far as its section runs, nearest first each way. */
  const neighboursOf = (row: HTMLElement): Neighbour[] => {
    const around: Neighbour[] = [];
    for (const [step, side] of [
      ["previousElementSibling", "above"],
      ["nextElementSibling", "below"],
    ] as const) {
      let next = row[step];
      while (next !== null && !(next.matches("[data-block-id]") && heading(next))) {
        if (reading(next)) around.push({ row: next, side });
        next = next[step];
      }
    }
    return around;
  };
  const clear = (element: HTMLElement) => {
    element.style.removeProperty("--pinch");
    element.removeAttribute("data-pinch");
    element.removeAttribute("data-pinch-neighbour");
  };
  const clearAll = () => {
    if (start === null) return;
    if (start.row !== null) clear(start.row);
    for (const neighbour of start.neighbours) clear(neighbour.row);
  };
  let last = 0;
  const began = (event: TouchEvent) => {
    const pair = points(event);
    if (pair === null) return;
    const row = rowAt(midpoint(pair[0], pair[1]));
    start = { spread: spread(pair[0], pair[1]), row, neighbours: row === null ? [] : neighboursOf(row) };
    last = start.spread;
  };
  const moved = (event: TouchEvent) => {
    const pair = points(event);
    if (pair === null || start === null) return;
    last = spread(pair[0], pair[1]);
    // The page must not zoom under the gesture the surface is reading: from
    // the first two-finger move, not from the threshold, since a zoom the
    // browser has begun is not taken back.
    if (event.cancelable) event.preventDefault();
    const { row, neighbours } = start;
    if (row === null) return;
    const progress = pinchProgress(start.spread, last);
    if (progress === 0) {
      clearAll();
      return;
    }
    row.style.setProperty("--pinch", String(progress));
    row.setAttribute("data-pinch", progress >= 1 ? "in" : progress <= -1 ? "out" : progress > 0 ? "zooming-in" : "zooming-out");
    for (const neighbour of neighbours) {
      if (progress < 0) {
        neighbour.row.style.setProperty("--pinch", String(progress));
        neighbour.row.setAttribute("data-pinch-neighbour", neighbour.side);
      } else {
        clear(neighbour.row);
      }
    }
  };
  const ended = () => {
    if (start === null) return;
    const outcome = pinchOutcome(start.spread, last);
    const blockId = start.row?.getAttribute("data-block-id") ?? null;
    clearAll();
    start = null;
    if (outcome !== null && blockId) pinched(outcome, blockId);
  };
  page.addEventListener("touchstart", began, { passive: true });
  page.addEventListener("touchmove", moved, { passive: false });
  page.addEventListener("touchend", ended);
  page.addEventListener("touchcancel", ended);
  return () => {
    page.removeEventListener("touchstart", began);
    page.removeEventListener("touchmove", moved);
    page.removeEventListener("touchend", ended);
    page.removeEventListener("touchcancel", ended);
  };
}
