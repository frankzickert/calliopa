/**
 * What "desktop" means to the editor: a pointer that can hover, whatever the
 * width — a tablet with a mouse is one, and so is a narrow desktop window.
 * There one click edits a block and hovering shows its controls and depth;
 * everywhere else a first press focuses and a second edits. User decision,
 * 2026-09-18. DO_0004_001
 */
export const HOVER_POINTER = "(hover: hover) and (pointer: fine)";

/** Whether the page is read with a pointer that can hover, asked at the
 * press; false where no page can say, which keeps the two-press rule. */
export const hoverPointer = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(HOVER_POINTER).matches;

/** How long the pointer rests on a row before it focuses it, so a pointer
 * crossing the page takes nothing on the way. It lives here, beside the
 * query, because a block row and a proposal row measure the same rest.
 * DO_0004_002 DO_0006_008 */
export const HOVER_DEPTH_MS = 200;
