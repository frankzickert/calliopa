import { step, type Standing } from "./disposition";

/**
 * The disposition swipe's physics, as numbers in and a standing out.
 * BO_0227_011 BO_0272_007
 *
 * A horizontal drag with one threshold per direction: the row follows the
 * finger, the reveal names what release would commit, and release short of
 * the threshold commits nothing. Pure, because where the threshold falls and
 * what a flick may do are the parts worth being sure of; the adapter that
 * moves the row (`views/block-swipe.ts`) holds no decisions.
 *
 * The table is configuration, not code: `SWIPE` is the one this product uses,
 * and every function takes another, so a different table — two thresholds
 * again, other distances — is a value rather than a rewrite.
 */

export interface SwipeTable {
  /** Proportion of the room the finger has, above the floor. */
  readonly fraction: number;
  /** Absolute floor and ceiling, in pixels. */
  readonly min: number;
  readonly max: number;
  /** However far the proportion says, the action stays inside a thumb's
   * reach on the actual screen. */
  readonly ofViewport: number;
  /** A flick commits what is already revealed — fast travel is a statement
   * about intent, not about distance. It needs this speed, in pixels per
   * millisecond, and to have come this far towards the threshold. */
  readonly flickVelocity: number;
  readonly flickReach: number;
  /** The screen's edges belong to the system's own back gesture. */
  readonly edgeGuard: number;
}

/**
 * The table in use. The distance sits between the two `BO_0138` closed on —
 * its near threshold (18% of the room, floored at 64–120px) and its far one
 * (55%, 200–380px) — because with one action each way there is no long pull
 * left to make discard deliberate and no short one left to make fixate cheap.
 * The floors are the load-bearing half: proportion alone collapsed on a phone
 * whose reading column measured 172px. User decision, 2026-09-21.
 */
export const SWIPE: SwipeTable = {
  fraction: 0.36,
  min: 132,
  max: 250,
  ofViewport: 0.72,
  flickVelocity: 0.55,
  flickReach: 0.6,
  edgeGuard: 24,
};

export interface Thresholds {
  /** The travel a release must have to commit, in pixels. */
  readonly commit: number;
  readonly table: SwipeTable;
}

/**
 * The threshold for a row of this width on a screen of this width. The room
 * is the lesser of the two: a gesture cannot use room that is not on the
 * screen, nor borrow room the row does not have.
 */
export function thresholds(
  rowWidth: number,
  viewportWidth: number,
  table: SwipeTable = SWIPE,
): Thresholds {
  const room = Math.min(rowWidth, viewportWidth);
  const commit = Math.min(
    table.max,
    Math.max(table.min, room * table.fraction),
    viewportWidth * table.ofViewport,
  );
  return { commit, table };
}

/** Whether a press this close to a screen edge is the system's, not ours. */
export const startsAtEdge = (
  x: number,
  viewportWidth: number,
  table: SwipeTable = SWIPE,
): boolean => x < table.edgeGuard || x > viewportWidth - table.edgeGuard;

/** What travel of `offset` pixels reveals, from where the block stands: the
 * standing it would commit, which is the current one short of the threshold. */
export function swipeTarget(
  current: Standing,
  offset: number,
  limits: Thresholds,
): Standing {
  if (Math.abs(offset) < limits.commit) return current;
  return step(current, offset > 0 ? "right" : "left");
}

/**
 * What the reveal says while the finger travels: the action this direction
 * would commit, named from the first movement, and whether the travel has
 * reached the threshold that commits it. Naming it only once armed left the
 * reader swiping at nothing until it appeared — found in the walk, 2026-09-21.
 * An action that would change nothing is named at no point.
 */
export function swipeReveal(
  current: Standing,
  offset: number,
  limits: Thresholds,
): { readonly action: Standing | null; readonly armed: boolean } {
  if (offset === 0) return { action: null, armed: false };
  const action = step(current, offset > 0 ? "right" : "left");
  if (action === current) return { action: null, armed: false };
  return { action, armed: Math.abs(offset) >= limits.commit };
}

/**
 * The standing a release commits: what the travel revealed, or — for a flick
 * that had not reached the threshold but came most of the way — the action of
 * that direction.
 */
export function swipeOutcome(
  current: Standing,
  offset: number,
  limits: Thresholds,
  velocity: number,
): Standing {
  const revealed = swipeTarget(current, offset, limits);
  if (revealed !== current) return revealed;
  const flicked =
    Math.abs(velocity) > limits.table.flickVelocity &&
    Math.sign(velocity) === Math.sign(offset) &&
    Math.abs(offset) > limits.commit * limits.table.flickReach;
  if (!flicked) return current;
  return step(current, offset > 0 ? "right" : "left");
}
