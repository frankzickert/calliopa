import { swipeJustEnded } from "./block-swipe";

/**
 * What a press or a key on a block row means, decided in one place so no two
 * handlers arbitrate one event. BO_0227_007 BO_0227_012
 */

/**
 * Whether a click in command mode marks its block. A press that did not move
 * does; a press that dragged selected words, and a release that ended a swipe
 * left a click behind — neither marks. The one answer the row's one click
 * handler asks, which is what closes `BO_0137`'s defect: a drag selecting a
 * sentence used to mark its block, because a browser fires the click on the
 * row both ends of the drag were in. BO_0227_007
 */
export function clickMarks(row: HTMLElement): boolean {
  if (swipeJustEnded()) return false;
  const selection = row.ownerDocument.getSelection?.() ?? null;
  return (
    selection === null ||
    selection.isCollapsed ||
    !row.contains(selection.anchorNode)
  );
}

/**
 * The key chord that steps a focused reading row along the disposition scale:
 * `Alt`+`Shift` with a horizontal arrow. A bare `Alt`+arrow is the browser's
 * history. Never on the block being edited, where `Option`+`Shift`+arrow is
 * macOS's word selection and the bar's control is the path. BO_0227_012
 */
/**
 * The passage whose number a press landed on, or null. Pressing a passage's
 * number takes that passage back, stale or not — decided by the row's one
 * click handler before it marks or unmarks the block, so the block below the
 * number is never toggled by it. BO_0227_009
 */
export function passageNumberAt(target: EventTarget | null): number | null {
  const element =
    target !== null && typeof (target as Element).closest === "function"
      ? (target as Element)
      : null;
  const badge =
    element?.closest("[data-passage-number], [data-passage-stale]") ?? null;
  if (badge === null) return null;
  const number = Number(
    badge.getAttribute("data-passage-number") ??
      badge.getAttribute("data-passage-stale"),
  );
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Whether a press or a key landed in a block's standing toolbar. The toolbar's
 * buttons answer their own press, and the row's one handler leaves it to them
 * rather than also marking the block. BO_0231_003
 */
export function inStandingToolbar(target: EventTarget | null): boolean {
  const element =
    target !== null && typeof (target as Element).closest === "function"
      ? (target as Element)
      : null;
  return (element?.closest("[data-standing-toolbar]") ?? null) !== null;
}

export function chordDirection(event: KeyboardEvent): "left" | "right" | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey)
    return null;
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  return null;
}
