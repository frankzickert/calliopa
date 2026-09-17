import { midpoint, pinchOutcome, pinchProgress, spread, type Point } from "~/lib/pinch";

/**
 * The pinch on touch, kept outside Qwik like the swipe (`block-swipe.ts`):
 * two fingers on the surface, and the release decides — outward past the
 * threshold on a reading row zooms into that block, opening it as focused
 * work; inward anywhere goes back one crumb. Every decision is
 * `~/lib/pinch`'s; this reads the touches. The surface's `touch-action`
 * keeps the browser's own zoom off it, and every two-finger move takes the
 * default besides, so the page never zooms under the gesture. A mouse never
 * pinches. CA_0047_006
 *
 * The gesture shows itself while it runs: the row under the fingers carries
 * `data-pinch` with `--pinch` set to the progress, so it grows with an
 * outward pinch and reads as armed once the threshold is passed; an inward
 * pinch marks the surface the same way, so the page draws back and the
 * route's *Back* reads as armed. Both are cleared on release. User request,
 * 2026-09-14, from the walk on a phone.
 */
export function installPinch(
  page: Document,
  commit: (outcome: "open", blockId: string) => void,
  back: () => void,
): () => void {
  let start: { spread: number; at: Point; row: HTMLElement | null; surface: HTMLElement | null } | null = null;

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
  const rowAt = (at: Point): HTMLElement | null => {
    const target = page.elementFromPoint(at.x, at.y);
    const row = target?.closest("[data-block-id]");
    return row instanceof HTMLElement && row.querySelector("[data-block-reading]") !== null ? row : null;
  };
  const show = (element: HTMLElement | null, progress: number, armed: string, moving: string) => {
    if (element === null) return;
    element.style.setProperty("--pinch", String(progress));
    element.setAttribute("data-pinch", Math.abs(progress) >= 1 ? armed : moving);
  };
  const clear = (element: HTMLElement | null) => {
    if (element === null) return;
    element.style.removeProperty("--pinch");
    element.removeAttribute("data-pinch");
  };
  let last = 0;
  const began = (event: TouchEvent) => {
    const pair = points(event);
    if (pair === null) return;
    const at = midpoint(pair[0], pair[1]);
    const row = rowAt(at);
    const surface = row?.closest("[data-block-surface]") ?? page.querySelector("[data-block-surface]");
    start = { spread: spread(pair[0], pair[1]), at, row, surface: surface instanceof HTMLElement ? surface : null };
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
    const progress = pinchProgress(start.spread, last);
    if (progress > 0) {
      clear(start.surface);
      show(start.row, progress, "open", "opening");
    } else if (progress < 0) {
      clear(start.row);
      show(start.surface, progress, "back", "backing");
    } else {
      clear(start.row);
      clear(start.surface);
    }
  };
  const ended = () => {
    if (start === null) return;
    const outcome = pinchOutcome(start.spread, last);
    const { row, surface } = start;
    start = null;
    clear(row);
    clear(surface);
    if (outcome === "back") {
      back();
      return;
    }
    if (outcome !== "open") return;
    const blockId = row?.getAttribute("data-block-id");
    if (row !== null && blockId) commit("open", blockId);
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
