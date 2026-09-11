import { LABEL, readStanding, type Standing } from "~/lib/disposition";
import { movedDistance, pointerIntent } from "~/lib/drag";
import {
  startsAtEdge,
  swipeOutcome,
  swipeReveal,
  thresholds,
  type Thresholds,
} from "~/lib/swipe";

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
  readonly blockId: string;
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

/** The reading row a press began on, when it is one a swipe may move: a text
 * block's reading text, not the block being edited. */
function rowOf(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null;
  const text = element?.closest("[data-block-reading]") ?? null;
  const row =
    text?.closest<HTMLElement>('[data-block-id][data-block-kind="text"]') ??
    null;
  return row;
}

/**
 * Draws the reveal in the strip the row has vacated, so it never covers the
 * words, and names what release would commit: the armed action against the
 * row's moving edge and the one further along beyond it, outward — in the
 * direction the finger is already going (`BO_0138`'s last correction).
 */
function paintReveal(gesture: Gesture, offset: number): void {
  const reveal = gesture.reveal;
  if (reveal === null) return;
  const { armed, further } = swipeReveal(
    gesture.current,
    offset,
    gesture.limits,
  );
  const box = gesture.row.getBoundingClientRect();
  const travel = Math.abs(offset);
  reveal.dataset.direction = offset < 0 ? "left" : "right";
  reveal.dataset.armed = armed ?? "";
  reveal.style.left = `${offset < 0 ? box.left + box.width - travel : box.left}px`;
  reveal.style.width = `${travel}px`;
  const armedWord = armed === null ? "" : LABEL[armed];
  const furtherWord = further === null ? "" : `… ${LABEL[further]}`;
  const words =
    offset < 0 ? [armedWord, furtherWord] : [furtherWord, armedWord];
  (reveal.firstElementChild as HTMLElement).textContent = words
    .filter((word) => word !== "")
    .join("  ");
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

/**
 * Installs the swipe on a page; answers the uninstall. `commit` hears a
 * released swipe that changes a block's standing, once.
 */
export function installSwipe(
  page: Document,
  commit: (blockId: string, to: Standing) => void,
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
    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      row,
      blockId: row.dataset.blockId ?? "",
      current: readStanding(row.dataset.standing),
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
    if (outcome !== live.current) commit(live.blockId, outcome);
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
