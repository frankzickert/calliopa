import type { TabKind } from "./tabs";

export const DRAG_OPERATIONS = [
  "move",
  "copy",
  "link",
  "open-in-tab",
  "attach-to-command",
  "process-input",
] as const;
export type DragOperation = (typeof DRAG_OPERATIONS)[number];

/** Where a drag started, so a target can reason about its source context. */
export type DragSource = "tab-strip" | "library" | "workspace" | "dock";

export interface DragPayload {
  readonly itemId: string;
  readonly kind: TabKind;
  readonly source: DragSource;
  readonly operations: readonly DragOperation[];
  readonly preview: string | null;
}

export interface DropTarget {
  readonly id: string;
  readonly accepts: readonly DragOperation[];
}

/**
 * A target takes the first operation the draggable offers that it accepts, so
 * the draggable states preference and the target states capability.
 */
export function resolveOperation(
  payload: DragPayload,
  target: DropTarget,
): DragOperation | null {
  return (
    payload.operations.find((operation) =>
      target.accepts.includes(operation),
    ) ?? null
  );
}

export const LONG_PRESS_MS = 400;
export const DRAG_MOVE_TOLERANCE_PX = 8;

/**
 * How far a coarse pointer travels, and how much more across than down,
 * before a target that offers a swipe reads it as one rather than as a
 * scroll. Vertical wins ties: the page scrolls far more often than a block
 * changes standing. The values the disposition swipe closed on (`BO_0138`).
 * BO_0227_007
 */
export const SWIPE_LOCK_PX = 12;
export const SWIPE_DOMINANCE = 1.4;

/** `wait` keeps the gesture undecided; the pointer has done too little. */
export type PointerIntent = "drag" | "scroll" | "swipe" | "wait";

/**
 * The one reading of what a pointer is doing, which every gesture asks — so
 * the shell's drag and a view's swipe cannot disagree about one press.
 *
 * `swipe` is offered by the target rather than assumed: only a caller that
 * passes the travel's axes can be answered `swipe`, so the tab strip and the
 * library, which offer none, read every early touch movement as a scroll
 * exactly as before. A mouse never swipes: a horizontal drag under a mouse is
 * a text selection or a drag.
 */
export function pointerIntent({
  pointerType,
  heldMs,
  movedPx,
  swipe,
}: {
  pointerType: string;
  heldMs: number;
  movedPx: number;
  /** The travel's axes, from a target that offers a swipe. */
  swipe?: { readonly dx: number; readonly dy: number };
}): PointerIntent {
  if (pointerType === "mouse") {
    return movedPx > DRAG_MOVE_TOLERANCE_PX ? "drag" : "wait";
  }
  if (heldMs >= LONG_PRESS_MS) return "drag";
  if (swipe !== undefined) {
    if (movedPx < SWIPE_LOCK_PX) return "wait";
    return Math.abs(swipe.dx) >= Math.abs(swipe.dy) * SWIPE_DOMINANCE
      ? "swipe"
      : "scroll";
  }
  return movedPx > DRAG_MOVE_TOLERANCE_PX ? "scroll" : "wait";
}

export function movedDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}
