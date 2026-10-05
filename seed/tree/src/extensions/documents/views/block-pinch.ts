import { midpoint, pinchOutcome, pinchProgress, spread, type Point } from "~/lib/pinch";

/**
 * The pinch on touch, kept outside Qwik like the swipe (`block-swipe.ts`):
 * two fingers on a reading row, and the release decides. Zooming in past the
 * threshold deepens that block; zooming out gathers its neighbours into its
 * focused work. Each is a run with no words, which `pinched` sends; a pinch
 * off a reading row or on a proposal that is no card's does nothing, and no
 * pinch opens or leaves focused work.
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
 *
 * On a card the pinch changes how finely the reader decides, and starts no
 * run: zooming in unfolds the card into its items, zooming out folds it again
 * (`carded`). On a desktop a trackpad's pinch reaches a card the same way: the
 * browser sends it as a `wheel` with `ctrlKey`, whose scale this adds up until
 * `pinchOutcome` reads it as in or out. A wheel off a card is the browser's.
 * BO_0350_003 BO_0350_004
 */
export function installPinch(
  page: Document,
  pinched: (pinch: "in" | "out", blockId: string) => void,
  carded: (pinch: "in" | "out", groupId: string) => void = () => undefined,
): () => void {
  type Neighbour = { readonly row: HTMLElement; readonly side: "above" | "below" };
  let start: { spread: number; row: HTMLElement | null; card: string | null; neighbours: Neighbour[] } | null = null;

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
  /** The card under a point, by its group. BO_0350_003 */
  const cardAt = (at: Point): string | null =>
    page.elementFromPoint(at.x, at.y)?.closest("[data-card-group]")?.getAttribute("data-card-group") ?? null;
  // A proposal that is not a card's is answered, not pinched: a pinch on one
  // does nothing.
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
    const at = midpoint(pair[0], pair[1]);
    const card = cardAt(at);
    const row = card === null ? rowAt(at) : null;
    start = { spread: spread(pair[0], pair[1]), row, card, neighbours: row === null ? [] : neighboursOf(row) };
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
    const card = start.card;
    clearAll();
    start = null;
    if (outcome !== null && card !== null) carded(outcome, card);
    else if (outcome !== null && blockId) pinched(outcome, blockId);
  };
  // The trackpad's pinch over a card: each event's scale multiplied in, the
  // sum read once the fingers rest. A wheel event's `deltaY` under `ctrlKey`
  // is the browser's zoom step, negative zooming in.
  const WHEEL_REST_MS = 200;
  let wheel: { card: string; scale: number; timer: ReturnType<typeof setTimeout> } | null = null;
  const wheeled = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    const card = cardAt({ x: event.clientX, y: event.clientY });
    if (card === null) return;
    // The page must not zoom while the reader works a card.
    if (event.cancelable) event.preventDefault();
    if (wheel !== null && wheel.card !== card) {
      clearTimeout(wheel.timer);
      wheel = null;
    }
    const scale = (wheel?.scale ?? 1) * Math.exp(-event.deltaY / 100);
    if (wheel !== null) clearTimeout(wheel.timer);
    wheel = {
      card,
      scale,
      timer: setTimeout(() => {
        const held = wheel;
        wheel = null;
        if (held === null) return;
        const outcome = pinchOutcome(1, held.scale);
        if (outcome !== null) carded(outcome, held.card);
      }, WHEEL_REST_MS),
    };
  };
  page.addEventListener("touchstart", began, { passive: true });
  page.addEventListener("touchmove", moved, { passive: false });
  page.addEventListener("touchend", ended);
  page.addEventListener("touchcancel", ended);
  page.addEventListener("wheel", wheeled, { passive: false });
  return () => {
    page.removeEventListener("wheel", wheeled);
    if (wheel !== null) clearTimeout(wheel.timer);
    page.removeEventListener("touchstart", began);
    page.removeEventListener("touchmove", moved);
    page.removeEventListener("touchend", ended);
    page.removeEventListener("touchcancel", ended);
  };
}
