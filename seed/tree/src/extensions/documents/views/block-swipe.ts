import { readStanding } from "../lib/disposition";
import { movedDistance, pointerIntent } from "~/lib/drag";
import {
  ACTION_LABEL,
  startsAtEdge,
  swipeOutcome,
  swipeReveal,
  thresholds,
  type SwipeAction,
  type SwipeRow,
  type Thresholds,
} from "../lib/swipe";

/**
 * The swipe's adapter: pointer events on a reading row in, one committed
 * action out. BO_0227_011 BO_0315_010
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
 * an element Qwik renders. Only the committed action goes through the
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
  /** Every row the finger moves: the row itself, or each row of the folded
   * card it is part of. BO_0350_002 */
  readonly rows: readonly HTMLElement[];
  /** What the release commits against: a block of the document, or the
   * proposal the swipe answers. BO_0315_010 */
  readonly swiped: Swiped;
  readonly subject: SwipeRow;
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

/** The kinds of proposal a swipe may answer: the three that are a text block
 * the reader reads, and a gather, answered whole from its summary or from any
 * row it moves. A removal retires its block, and a work item or a relation
 * card is not a block at all. BO_0272_008 BO_0315_010 BO_0322_013 */
export const SWIPEABLE_PROPOSALS: readonly string[] = [
  "replace",
  "insert",
  "move",
  "gather",
];

/**
 * The row a press began on, when it is one a swipe may move: a text block's
 * reading text, not the block being edited, or a proposed rewrite, insert or
 * move, which a swipe accepts or rejects (BO_0315_010).
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
/** The box the moving rows take together: a card's rows from the top of its
 * first to the bottom of its last. */
function boxOf(rows: readonly HTMLElement[]): { top: number; left: number; width: number; height: number } {
  const boxes = rows.map((row) => row.getBoundingClientRect());
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  return { top, left, width: right - left, height: bottom - top };
}

function paintReveal(gesture: Gesture, offset: number): void {
  const reveal = gesture.reveal;
  if (reveal === null) return;
  const { action, armed } = swipeReveal(gesture.subject, offset, gesture.limits);
  const box = boxOf(gesture.rows);
  const travel = Math.abs(offset);
  reveal.dataset.direction = offset < 0 ? "left" : "right";
  reveal.dataset.action = action ?? "";
  reveal.dataset.armed = armed ? "true" : "false";
  reveal.style.left = `${offset < 0 ? box.left + box.width - travel : box.left}px`;
  reveal.style.width = `${travel}px`;
  (reveal.firstElementChild as HTMLElement).textContent =
    action === null ? "" : ACTION_LABEL[action];
}

function openReveal(page: Document, gesture: Gesture): void {
  const box = boxOf(gesture.rows);
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
  for (const row of gesture.rows) row.dataset.swiping = "true";
}

function settle(gesture: Gesture): void {
  const { rows, reveal } = gesture;
  for (const row of rows) {
    row.style.transition = `transform ${SPRING_MS}ms ease-out`;
    row.style.transform = "";
    delete row.dataset.swiping;
  }
  setTimeout(() => {
    for (const row of rows) row.style.transition = "";
    reveal?.remove();
  }, SPRING_MS + 40);
}

/** What a swipe was made on: a block of the document, or a proposed change
 * the release answers. BO_0315_010 */
export type Swiped =
  | { readonly kind: "block"; readonly blockId: string }
  | { readonly kind: "proposal"; readonly itemId: string }
  | { readonly kind: "card"; readonly groupId: string; readonly itemIds: readonly string[] };

/**
 * The rows a swipe on a row moves, and what it answers: on a folded card,
 * every row of the card, answering its group; anywhere else, the row alone.
 * BO_0350_002
 */
export function swipedRows(page: Document, row: HTMLElement): { readonly rows: readonly HTMLElement[]; readonly groupId: string | null } {
  const groupId = row.getAttribute("data-card-group");
  if (groupId === null || row.getAttribute("data-card-folded") !== "true") return { rows: [row], groupId: null };
  // The card's own place: a group the reading order splits is a card in each
  // place, and a swipe moves and answers the one it is on. BO_0351_024
  const segment = row.getAttribute("data-card-segment");
  const rows = [...page.querySelectorAll<HTMLElement>("[data-card-group]")].filter(
    (other) =>
      other.getAttribute("data-card-group") === groupId &&
      other.getAttribute("data-card-folded") === "true" &&
      other.getAttribute("data-card-segment") === segment,
  );
  return { rows: rows.length > 0 ? rows : [row], groupId };
}

/**
 * Installs the swipe on a page; answers the uninstall. `commit` hears a
 * released swipe that does something, once, with what the reveal named.
 */
export function installSwipe(
  page: Document,
  commit: (swiped: Swiped, action: SwipeAction) => void,
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
    const card = swipedRows(page, row);
    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      row,
      rows: card.rows,
      swiped:
        itemId === undefined
          ? { kind: "block", blockId: row.dataset.blockId ?? "" }
          : card.groupId !== null
            ? { kind: "card", groupId: card.groupId, itemIds: card.rows.map((one) => one.getAttribute("data-proposal-id") ?? "").filter((id) => id !== "") }
            : { kind: "proposal", itemId },
      subject:
        itemId === undefined
          ? { kind: "block", standing: readStanding(row.getAttribute("data-standing")) }
          : { kind: "proposal" },
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
    for (const row of live.rows) row.style.transform = `translateX(${Math.round(dx)}px)`;
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
      live.subject,
      event.clientX - live.startX,
      live.limits,
      live.velocity,
    );
    if (outcome !== null) commit(live.swiped, outcome);
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
