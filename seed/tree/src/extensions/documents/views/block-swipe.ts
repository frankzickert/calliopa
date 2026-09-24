import { LABEL, readStanding, type Standing } from "../lib/disposition";
import { movedDistance, pointerIntent } from "~/lib/drag";
import {
  startsAtEdge,
  swipeOutcome,
  swipeReveal,
  thresholds,
  type Thresholds,
} from "../lib/swipe";

/**
 * The disposition swipe's adapter: pointer events on a reading row in, one
 * committed standing out. BO_0227_011
 *
 * It holds no decisions. Whether the gesture is a swipe is the one arbiter's
 * answer (`pointerIntent`, offered the travel's axes); where the thresholds
 * fall, what the travel reveals and what a release commits are `swipe.ts`'s.
 * What is here is the part a test cannot hold: moving the row with the finger
 * and drawing the reveal.
 *
 * The gesture lives outside Qwik and the row is moved by writing its style,
 * because a signal the surface renders from would rewrite the row's text on
 * every frame — the rule every slice of the old editor relearned. The reveal
 * is drawn in the page's body, over the row, so nothing is ever written into
 * an element Qwik renders. Only the committed standing goes through the
 * surface, once, at release.
 */

/** A swipe ends in a click on the row it began on; the click lands within
 * this and is the swipe's, not a press. */
const QUIET_MS = 400;
/** How long the row takes to spring back after release. */
const SPRING_MS = 160;

let quietUntil = 0;

/**
 * Whether a click belongs to a swipe that has just ended. The one answer the
 * row's press handlers ask, so neither a mark nor an activation follows a
 * swipe — the fallout `BO_0153` found when a swipe left a block editable.
 */
export const swipeJustEnded = (): boolean => Date.now() < quietUntil;

interface Gesture {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly row: HTMLElement;
  /** What the release commits against: a block of the document, or the
   * proposal the swipe answers first. BO_0272_008 */
  readonly swiped: Swiped;
  readonly current: Standing;
  readonly limits: Thresholds;
  readonly startX: number;
  readonly startY: number;
  readonly startedAt: number;
  lastX: number;
  lastAt: number;
  velocity: number;
  locked: boolean;
  reveal: HTMLElement | null;
}

/** The kinds of proposal a swipe may answer: the three that leave a text
 * block standing to carry the standing. A removal retires its block, and a
 * work item or a relation card is not a block at all. BO_0272_008 */
export const SWIPEABLE_PROPOSALS: readonly string[] = [
  "replace",
  "insert",
  "move",
];

/**
 * The row a press began on, when it is one a swipe may move: a text block's
 * reading text, not the block being edited, or a proposed rewrite, insert or
 * move, whose swipe accepts it before the block it becomes takes the standing
 * (BO_0272_008).
 */
export function rowOf(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null;
  const text = element?.closest("[data-block-reading]") ?? null;
  const row =
    text?.closest<HTMLElement>('[data-block-id][data-block-kind="text"]') ??
    null;
  if (row !== null) return row;
  const proposal = element?.closest<HTMLElement>("[data-proposal-id]") ?? null;
  if (proposal === null) return null;
  // `getAttribute`, not `dataset`: this is asked of a rendered row, and the
  // render harness's elements carry the attribute without the map.
  return SWIPEABLE_PROPOSALS.includes(
    proposal.getAttribute("data-proposal-kind") ?? "",
  )
    ? proposal
    : null;
}

/**
 * Draws the reveal in the strip the row has vacated, so it never covers the
 * words, and names what release would commit. One action each way, so one
 * word — said from the first movement, in a chip at the row's moving edge
 * where the finger already is, and marked armed once the travel reaches the
 * threshold. The strip is a sliver at that point, so the chip is not clipped
 * by it. BO_0272_007 BO_0272_016
 */
function paintReveal(gesture: Gesture, offset: number): void {
  const reveal = gesture.reveal;
  if (reveal === null) return;
  const { action, armed } = swipeReveal(gesture.current, offset, gesture.limits);
  const box = gesture.row.getBoundingClientRect();
  const travel = Math.abs(offset);
  reveal.dataset.direction = offset < 0 ? "left" : "right";
  reveal.dataset.action = action ?? "";
  reveal.dataset.armed = armed ? "true" : "false";
  reveal.style.left = `${offset < 0 ? box.left + box.width - travel : box.left}px`;
  reveal.style.width = `${travel}px`;
  (reveal.firstElementChild as HTMLElement).textContent =
    action === null ? "" : LABEL[action];
}

function openReveal(page: Document, gesture: Gesture): void {
  const box = gesture.row.getBoundingClientRect();
  const reveal = page.createElement("div");
  reveal.className = "block-swipe-reveal";
  reveal.setAttribute("aria-hidden", "true");
  Object.assign(reveal.style, {
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: "0px",
    height: `${box.height}px`,
  });
  reveal.append(page.createElement("span"));
  page.body.append(reveal);
  gesture.reveal = reveal;
  gesture.row.dataset.swiping = "true";
}

function settle(gesture: Gesture): void {
  const { row, reveal } = gesture;
  row.style.transition = `transform ${SPRING_MS}ms ease-out`;
  row.style.transform = "";
  delete row.dataset.swiping;
  setTimeout(() => {
    row.style.transition = "";
    reveal?.remove();
  }, SPRING_MS + 40);
}

/** What a swipe was made on: a block of the document, or a proposed change
 * whose acceptance the release asks for. BO_0272_008 */
export type Swiped =
  | { readonly kind: "block"; readonly blockId: string }
  | { readonly kind: "proposal"; readonly itemId: string };

/**
 * Installs the swipe on a page; answers the uninstall. `commit` hears a
 * released swipe that changes a standing, once.
 */
export function installSwipe(
  page: Document,
  commit: (swiped: Swiped, to: Standing) => void,
): () => void {
  let gesture: Gesture | null = null;
  const frame = page.defaultView;
  if (frame === null) return () => undefined;

  const down = (event: PointerEvent) => {
    // A mouse never swipes: a horizontal drag under a mouse selects text.
    if (event.pointerType === "mouse" || event.button !== 0 || !event.isPrimary)
      return;
    const row = rowOf(event.target);
    if (row === null) return;
    // The screen's edges are the system's back gesture, and a live selection
    // is the reader choosing words, not a block.
    if (startsAtEdge(event.clientX, frame.innerWidth)) return;
    if (page.getSelection()?.isCollapsed === false) return;
    const itemId = row.getAttribute("data-proposal-id") ?? undefined;
    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      row,
      swiped:
        itemId === undefined
          ? { kind: "block", blockId: row.dataset.blockId ?? "" }
          : { kind: "proposal", itemId },
      // A proposal carries no standing of its own: it starts from keep, the
      // state the block it becomes would be in. BO_0272_008
      current:
        itemId === undefined
          ? readStanding(row.getAttribute("data-standing"))
          : "keep",
      limits: thresholds(row.getBoundingClientRect().width, frame.innerWidth),
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      velocity: 0,
      locked: false,
      reveal: null,
    };
  };

  const move = (event: PointerEvent) => {
    const live = gesture;
    if (live === null || event.pointerId !== live.pointerId) return;
    const dx = event.clientX - live.startX;
    const dy = event.clientY - live.startY;
    if (!live.locked) {
      const intent = pointerIntent({
        pointerType: live.pointerType,
        heldMs: event.timeStamp - live.startedAt,
        movedPx: movedDistance(
          { x: live.startX, y: live.startY },
          { x: event.clientX, y: event.clientY },
        ),
        swipe: { dx, dy },
      });
      if (intent === "wait") return;
      if (intent !== "swipe") {
        gesture = null;
        return;
      }
      live.locked = true;
      openReveal(page, live);
    }
    const elapsed = event.timeStamp - live.lastAt;
    if (elapsed > 0) live.velocity = (event.clientX - live.lastX) / elapsed;
    live.lastX = event.clientX;
    live.lastAt = event.timeStamp;
    live.row.style.transform = `translateX(${Math.round(dx)}px)`;
    paintReveal(live, dx);
  };

  const up = (event: PointerEvent) => {
    const live = gesture;
    if (live === null || event.pointerId !== live.pointerId) return;
    gesture = null;
    if (!live.locked) return;
    quietUntil = Date.now() + QUIET_MS;
    settle(live);
    const outcome = swipeOutcome(
      live.current,
      event.clientX - live.startX,
      live.limits,
      live.velocity,
    );
    if (outcome !== live.current) commit(live.swiped, outcome);
  };

  const cancel = (event: PointerEvent) => {
    const live = gesture;
    if (live === null || event.pointerId !== live.pointerId) return;
    gesture = null;
    if (live.locked) settle(live);
  };

  page.addEventListener("pointerdown", down);
  page.addEventListener("pointermove", move);
  page.addEventListener("pointerup", up);
  page.addEventListener("pointercancel", cancel);
  return () => {
    page.removeEventListener("pointerdown", down);
    page.removeEventListener("pointermove", move);
    page.removeEventListener("pointerup", up);
    page.removeEventListener("pointercancel", cancel);
    if (gesture?.locked) settle(gesture);
    gesture = null;
  };
}
