/**
 * The pinch, pure (`CA_0047_006`): two fingers moving apart — the zoom-in
 * gesture — open the block under them as focused work, two fingers moving
 * closer go back one crumb. User decision, 2026-09-14, after the walk on a
 * phone: going into a block is zooming in. The adapter (`block-pinch.ts`)
 * reads the touches and calls these; nothing here touches the DOM, so what
 * a release means is settled without a browser.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The distance between two fingers. */
export const spread = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** How far the spread must change, as a fraction of where it began, before a
 * release means anything: a pinch that barely moved is a tap that landed on
 * two fingers. */
export const PINCH_THRESHOLD = 0.25;

export type PinchOutcome = "open" | "back" | null;

/** What a release means, from the spread at the start and at the end. */
export function pinchOutcome(startSpread: number, endSpread: number): PinchOutcome {
  if (!(startSpread > 0) || !(endSpread >= 0)) return null;
  const change = (endSpread - startSpread) / startSpread;
  if (change >= PINCH_THRESHOLD) return "open";
  if (change <= -PINCH_THRESHOLD) return "back";
  return null;
}

/** How far a pinch has come toward meaning something, for the feedback
 * under the fingers: 0 at rest, 1 when an outward pinch reaches the
 * threshold, -1 when an inward one does, clamped there. */
export function pinchProgress(startSpread: number, endSpread: number): number {
  if (!(startSpread > 0) || !(endSpread >= 0)) return 0;
  const change = (endSpread - startSpread) / startSpread / PINCH_THRESHOLD;
  return Math.max(-1, Math.min(1, change));
}

/** The midpoint of two fingers: where the gesture is aimed. */
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
