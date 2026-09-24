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
export type DragSource = "tab-strip" | "library" | "workspace" | "panel";

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

/**
 * A library icon dragged to reorder the column. It is a draggable of its own
 * kind, and the column's targets are ids under `PANEL_ICON_TARGET`: an icon
 * lands only there, and nothing else does, whatever the operations say.
 * CA_0068_008
 */
export const PANEL_ICON_KIND = "panel-icon";
export const PANEL_ICON_TARGET = "panel-icon:";

/** The operation a drop over `target` performs: `resolveOperation`, once the
 * payload's kind and the target agree about the icon column. CA_0068_008 */
export function resolveDrop(payload: DragPayload, target: DropTarget): DragOperation | null {
  const iconTarget = target.id.startsWith(PANEL_ICON_TARGET);
  if (iconTarget !== (payload.kind === PANEL_ICON_KIND)) return null;
  return resolveOperation(payload, target);
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

/** How far across a swipe on the phone's *Minimum* header travels before it
 * switches the tab, and how wide the screen's edge zones are where the
 * system's back gesture starts, which no switch may. CA_0054_008 */
export const TAB_SWIPE_PX = 40;
export const BACK_GESTURE_EDGE_PX = 24;

/**
 * The tab step a finished swipe on the header's line asks for: 1 for the next
 * tab (the line moved left, as a carousel does), -1 for the previous, 0 for
 * none. A mouse never swipes; a travel short of `TAB_SWIPE_PX`, one not
 * `SWIPE_DOMINANCE` times more across than down, or one that started in an
 * edge zone switches nothing. CA_0054_008
 */
export function tabSwipeStep({
  pointerType,
  from,
  to,
  width,
}: {
  pointerType: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
}): -1 | 0 | 1 {
  if (pointerType === "mouse") return 0;
  if (from.x < BACK_GESTURE_EDGE_PX || from.x > width - BACK_GESTURE_EDGE_PX)
    return 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < TAB_SWIPE_PX) return 0;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return 0;
  return dx < 0 ? 1 : -1;
}

export function movedDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/**
 * Scrolling while dragging (BO_0263_017): a drag held near the top or the
 * bottom edge of the area it scrolls moves that area toward the edge, faster
 * the nearer the pointer is, so every place a row can go is in reach on a
 * desktop and a phone alike. The zone is at most a quarter of the area, so a
 * short area keeps a middle where nothing scrolls; a pointer past the edge —
 * over the header — scrolls at full speed.
 */
export const EDGE_SCROLL_ZONE_PX = 56;
export const EDGE_SCROLL_MAX_PX = 16;

/** How far to scroll this frame for a pointer at `y` over an area whose
 * visible part spans `top` to `bottom`: negative up, positive down, 0 in the
 * middle. */
export function edgeScroll(y: number, top: number, bottom: number): number {
  const zone = Math.min(EDGE_SCROLL_ZONE_PX, Math.max(0, bottom - top) / 4);
  if (zone <= 0) return 0;
  const speed = (depth: number) => Math.ceil(EDGE_SCROLL_MAX_PX * Math.min(1, depth / zone));
  if (y < top + zone) return -speed(top + zone - y);
  if (y > bottom - zone) return speed(y - (bottom - zone));
  return 0;
}
