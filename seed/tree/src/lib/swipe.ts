import { swipeTargets, type Standing } from "./disposition";

/**
 * The disposition swipe's physics, as numbers in and a standing out.
 * BO_0227_011
 *
 * A horizontal drag with two thresholds per direction: the row follows the
 * finger, the reveal names what release would commit, and release inside the
 * neutral zone commits nothing. Pure, because where the thresholds fall and
 * what a flick may do are the parts worth being sure of; the adapter that
 * moves the row (`components/views/block-swipe.ts`) holds no decisions.
 *
 * The numbers are the ones `BO_0138` closed on after three rounds of use on a
 * phone, each with the measurement that set it.
 */

/** Proportions of the room the finger has, above the floors. */
export const NEAR_FRACTION = 0.18;
export const FAR_FRACTION = 0.55;

/**
 * Absolute floors, and they are the load-bearing half. Proportion alone
 * collapsed on a phone, where the reading column measured 172px: the near
 * threshold came to 44px and the far to 107px, and Resolve was a 63px sliver
 * on the way to Discard. The ceilings keep a wide column from asking for
 * travel no thumb makes.
 */
export const NEAR_MIN = 64;
export const NEAR_MAX = 120;
export const FAR_MIN = 200;
export const FAR_MAX = 380;

/** However far the proportions say, the far action stays inside a thumb's
 * reach on the actual screen. */
export const FAR_OF_VIEWPORT = 0.72;

/**
 * A flick commits what is already revealed and never the next state along —
 * fast travel is a statement about intent, not about distance. It needs this
 * speed, in pixels per millisecond, and to have come this far towards the near
 * threshold.
 */
export const FLICK_VELOCITY = 0.55;
export const FLICK_REACH = 0.6;

/** The screen's edges belong to the system's own back gesture. */
export const EDGE_GUARD = 24;

export interface Thresholds {
  readonly near: number;
  readonly far: number;
}

/**
 * The thresholds for a row of this width on a screen of this width. The room
 * is the lesser of the two: a gesture cannot use room that is not on the
 * screen, nor borrow room the row does not have.
 */
export function thresholds(
  rowWidth: number,
  viewportWidth: number,
): Thresholds {
  const room = Math.min(rowWidth, viewportWidth);
  const near = Math.min(NEAR_MAX, Math.max(NEAR_MIN, room * NEAR_FRACTION));
  const far = Math.min(
    FAR_MAX,
    Math.max(FAR_MIN, room * FAR_FRACTION),
    viewportWidth * FAR_OF_VIEWPORT,
  );
  return { near, far };
}

/** Whether a press this close to a screen edge is the system's, not ours. */
export const startsAtEdge = (x: number, viewportWidth: number): boolean =>
  x < EDGE_GUARD || x > viewportWidth - EDGE_GUARD;

/** What travel of `offset` pixels reveals, from where the block stands:
 * the standing it would commit, which is the current one inside the neutral
 * zone. */
export function swipeTarget(
  current: Standing,
  offset: number,
  limits: Thresholds,
): Standing {
  const distance = Math.abs(offset);
  if (distance < limits.near) return current;
  const [near, far] = swipeTargets(current, offset > 0 ? "right" : "left");
  return distance >= limits.far ? far : near;
}

/**
 * What the reveal says while the finger travels: the action armed now, and
 * the one further along the scale in the direction the finger is going — so
 * the reader can tell there is somewhere to stop, and somewhere beyond it.
 * Neither is named when it would change nothing.
 */
export function swipeReveal(
  current: Standing,
  offset: number,
  limits: Thresholds,
): { readonly armed: Standing | null; readonly further: Standing | null } {
  if (offset === 0) return { armed: null, further: null };
  const [near, far] = swipeTargets(current, offset > 0 ? "right" : "left");
  const distance = Math.abs(offset);
  // Past the far threshold nothing lies further; between the two the far
  // target lies ahead; inside the neutral zone the near one does.
  const [armed, further]: readonly [Standing | null, Standing | null] =
    distance >= limits.far
      ? [far, null]
      : distance >= limits.near
        ? [near, far]
        : [null, near];
  const named = (standing: Standing | null): Standing | null =>
    standing === current ? null : standing;
  return {
    armed: named(armed),
    further: further === armed ? null : named(further),
  };
}

/**
 * The standing a release commits: what the travel revealed, or — for a flick
 * that had not reached the near threshold but came most of the way — the
 * near threshold's target. A flick never carries a gesture past the near
 * threshold's target to the far one.
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
    Math.abs(velocity) > FLICK_VELOCITY &&
    Math.sign(velocity) === Math.sign(offset) &&
    Math.abs(offset) > limits.near * FLICK_REACH;
  if (!flicked) return current;
  return swipeTargets(current, offset > 0 ? "right" : "left")[0];
}
