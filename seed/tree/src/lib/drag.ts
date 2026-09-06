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

/** `wait` keeps the gesture undecided; the pointer has done too little. */
export type PointerIntent = "drag" | "scroll" | "wait";

export function pointerIntent({
  pointerType,
  heldMs,
  movedPx,
}: {
  pointerType: string;
  heldMs: number;
  movedPx: number;
}): PointerIntent {
  if (pointerType === "mouse") {
    return movedPx > DRAG_MOVE_TOLERANCE_PX ? "drag" : "wait";
  }
  if (heldMs >= LONG_PRESS_MS) return "drag";
  return movedPx > DRAG_MOVE_TOLERANCE_PX ? "scroll" : "wait";
}

export function movedDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}
