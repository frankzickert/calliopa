import {
  $,
  component$,
  Slot,
  sync$,
  useSignal,
  useStore,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { DRAG_MOVE_TOLERANCE_PX, LONG_PRESS_MS, movedDistance } from "~/lib/drag";
import {
  faceOf,
  heldEdit,
  PROPOSAL_PAUSE_MS,
  proposalNames,
  toneOf,
  type Proposer,
  type TypedProposal,
} from "~/lib/proposals";
import type { Run } from "~/lib/runs";
import type { BlockView, TextBlockView } from "~/server/documents/assemble";
import type { ProposedChange } from "~/server/documents/documents";
import { ROLE_TAG } from "../block-text";
import { paintRuns, runsFrom, selectionIn, selectRange } from "../editor-dom";

const isText = (block: BlockView): block is TextBlockView => block.kind === "text";

/** The caret or selection in the proposed text, or null when the page
 * cannot say. */
const liveOffsets = (element: HTMLElement): { start: number; end: number } | null => {
  try {
    return selectionIn(element);
  } catch {
    return null;
  }
};

/**
 * A proposed change drawn as the block it would become: in its proposer's
 * colour, with the proposer's face centred on its left border and its answers
 * as icons on its top edge, so a reader sees who proposed what before reading
 * a word and the text keeps the accepted blocks' width and typography.
 *
 * A rewrite and a new block carry their own proposed text, which the reader
 * may edit: a change accepts the item once the typing pauses (`HeldEdit`),
 * and what was typed becomes the established block's. A removal and a move concern a block
 * that stands, so they frame that block — its row is the slot — and the
 * block keeps being the editor's.
 *
 * The face is the handle: it drags the proposal to another place, and the
 * arrow keys move it one place, without answering it. Every decision is
 * `~/lib/proposals`'s; this draws and sends. BO_0233_004 BO_0233_005
 * BO_0233_006 BO_0233_007
 */
export const ProposalBlock = component$<{
  item: ProposedChange;
  proposer: Proposer;
  groupSize: number;
  /** Where accepting would move the block, in words, when it would move one. */
  destination: string | null;
  answer$: QRL<(itemId: string, answer: "accepted" | "rejected") => void>;
  acceptGroup$: QRL<(groupId: string) => void>;
  settle$: QRL<
    (itemId: string, blockId: string, typed$: QRL<() => TypedProposal>) => Promise<boolean>
  >;
  startDrag$: QRL<(itemId: string, preview: string, event: PointerEvent) => void>;
  step$: QRL<(itemId: string, direction: -1 | 1) => void>;
}>(({ item, proposer, groupSize, destination, answer$, acceptGroup$, settle$, startDrag$, step$ }) => {
  const root = useSignal<HTMLElement>();
  const tone = toneOf(proposer);
  const face = faceOf(proposer);
  const names = proposalNames(item.kind, proposer, destination);
  const movable = item.kind !== "remove";
  const block = item.block;
  const ownText = (item.kind === "replace" || item.kind === "insert") && block !== null && isText(block);

  // A long press anywhere on the proposal starts its drag on touch, where the
  // face alone was too small a thing to find, and it held nothing a reader
  // pressing the block expected. The drag itself is the shell's own, which
  // arms after the same hold; what this adds is what only a native listener
  // can: once the hold has armed, the page stops scrolling under the finger
  // (a non-passive touchmove) and the long-press menu is kept away. A press
  // that moves first is a scroll, and a tap still places the caret. A mouse
  // keeps the face as its handle, since pressing and dragging in text is how
  // a mouse selects. BO_0233_012
  useVisibleTask$(({ cleanup }) => {
    const element = root.value;
    if (element === undefined || !movable) return;
    let from: { x: number; y: number } | null = null;
    let armed = false;
    let timer = 0;
    const reset = () => {
      clearTimeout(timer);
      from = null;
      armed = false;
      element.removeAttribute("data-lifted");
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const target = event.target as Element | null;
      if (target?.closest(".proposal-block__answers, .proposal-block__face") != null) return;
      from = { x: event.clientX, y: event.clientY };
      void startDrag$(item.itemId, names.block, event);
      timer = Number(
        setTimeout(() => {
          if (from === null) return;
          armed = true;
          element.setAttribute("data-lifted", "true");
        }, LONG_PRESS_MS),
      );
    };
    const move = (event: PointerEvent) => {
      if (from === null || armed) return;
      if (movedDistance(from, { x: event.clientX, y: event.clientY }) > DRAG_MOVE_TOLERANCE_PX) reset();
    };
    const hold = (event: TouchEvent) => {
      if (armed) event.preventDefault();
    };
    const menu = (event: Event) => {
      if (from !== null || armed) event.preventDefault();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", reset);
    element.addEventListener("pointercancel", reset);
    element.addEventListener("touchmove", hold, { passive: false });
    element.addEventListener("contextmenu", menu);
    cleanup(() => {
      reset();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", reset);
      element.removeEventListener("pointercancel", reset);
      element.removeEventListener("touchmove", hold);
      element.removeEventListener("contextmenu", menu);
    });
  });

  return (
    <div
      ref={root}
      class="proposal-block"
      data-proposal-id={item.itemId}
      data-proposal-kind={item.kind}
      data-proposal-tone={tone}
      role="group"
      aria-label={names.block}
    >
      <button
        type="button"
        class="proposal-block__face"
        data-proposal-face={item.itemId}
        aria-label={movable ? `${names.face}. Drag it, or use the arrow keys, to move it.` : names.face}
        // A long press on the face is the drag's, never the image's menu.
        preventdefault:contextmenu
        onPointerDown$={(event: PointerEvent) => {
          if (!movable) return;
          void startDrag$(item.itemId, names.block, event);
        }}
        onKeyDown$={[
          // The page must not scroll under the move, and a `$`-handler's
          // preventDefault() runs after it already has.
          sync$((event: KeyboardEvent) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
          }),
          $((event: KeyboardEvent) => {
            if (!movable) return;
            if (event.key === "ArrowUp") void step$(item.itemId, -1);
            if (event.key === "ArrowDown") void step$(item.itemId, 1);
          }),
        ]}
      >
        {face.kind === "image" ? (
          <img
            class="proposal-block__portrait"
            src={face.src}
            alt=""
            width={24}
            height={24}
            draggable={false}
          />
        ) : (
          <Icon name={face.icon} size={14} />
        )}
      </button>
      <div class="proposal-block__answers">
        {destination !== null && (
          <span class="proposal-block__moves" data-proposal-moves aria-hidden="true">
            <Icon name="arrows-down-up" size={14} />
          </span>
        )}
        <button
          type="button"
          class="proposal-block__answer"
          data-proposal-accept={item.itemId}
          aria-label={names.accept}
          onClick$={() => answer$(item.itemId, "accepted")}
        >
          <Icon name="check" size={16} />
        </button>
        <button
          type="button"
          class="proposal-block__answer"
          data-proposal-reject={item.itemId}
          aria-label={names.reject}
          onClick$={() => answer$(item.itemId, "rejected")}
        >
          <Icon name="x" size={16} />
        </button>
        {groupSize > 1 && (
          <button
            type="button"
            class="proposal-block__answer"
            data-proposal-accept-all={item.groupId}
            aria-label={names.acceptAll}
            onClick$={() => acceptGroup$(item.groupId)}
          >
            <Icon name="checks" size={16} />
          </button>
        )}
      </div>
      {ownText ? (
        <ProposalText item={item} block={block} settle$={settle$} />
      ) : (
        <Slot />
      )}
    </div>
  );
});

/**
 * A rewrite's or a new block's proposed text, in the role's own element,
 * where the caret may go and the reader may type at once.
 *
 * No input reaches the element itself: each is cancelled as it begins —
 * synchronously, since a `$`-handler's preventDefault() runs after the
 * browser has changed the text — and applied here to the proposal's own copy
 * of its words, painted at once with the caret after it. A composition cannot
 * be cancelled, so the browser writes it and its end is read back.
 *
 * Nothing else happens while the reader types: the proposal keeps its colour,
 * its face and the caret. When the typing pauses, or the reader leaves the
 * text, the item is accepted and what was typed is handed to the established
 * block (`settle$`) — the editor reads it at the hand-over, so keystrokes
 * typed while the acceptance is under way are kept. A refused acceptance puts
 * the proposal's words back. Placing the caret or selecting accepts nothing.
 * BO_0233_006 BO_0233_012 BO_0233_014
 */
const ProposalText = component$<{
  item: ProposedChange;
  block: BlockView;
  settle$: QRL<
    (itemId: string, blockId: string, typed$: QRL<() => TypedProposal>) => Promise<boolean>
  >;
}>(({ item, block, settle$ }) => {
  const host = useSignal<HTMLElement>();
  const original = isText(block) ? block.runs : [];
  const local = useStore({
    runs: [...original] as Run[],
    start: 0,
    end: 0,
    /** idle; typed, waiting for the pause; settling; or settled, handed over. */
    phase: "idle" as "idle" | "typing" | "settling" | "settled",
    edited: false,
    focused: false,
    paint: 0,
    timer: 0,
  });

  // Painted rather than rendered, as the active block is: the words change
  // with every keystroke, and a render would replace the nodes the caret
  // sits in.
  useVisibleTask$(({ track }) => {
    track(() => local.paint);
    const element = host.value;
    if (element === undefined) return;
    paintRuns(element, local.runs);
    if (local.edited) selectRange(element, local.start, local.end);
  });

  /** What was typed, as it stands now: read by the editor at the hand-over. */
  const typed$ = $(
    (): TypedProposal => ({
      runs: [...local.runs],
      start: local.start,
      end: local.end,
      focused: local.focused,
    }),
  );

  /** Accepts the proposal and hands the typing over, once. The timer is not
   * cleared when the text goes: a proposal answered from its icons while its
   * typing waited still gets that typing. */
  const settleHere$ = $(async () => {
    if (local.phase !== "typing") return;
    clearTimeout(local.timer);
    local.timer = 0;
    local.phase = "settling";
    if (await settle$(item.itemId, item.blockId, typed$)) {
      local.phase = "settled";
      return;
    }
    local.phase = "idle";
    local.runs = [...original];
    local.edited = false;
    local.paint += 1;
  });

  /** Typing goes on, so the hand-over waits for the next pause. */
  const waitForPause$ = $(() => {
    local.edited = true;
    if (local.phase === "idle") local.phase = "typing";
    if (local.phase !== "typing") return;
    clearTimeout(local.timer);
    local.timer = Number(setTimeout(() => void settleHere$(), PROPOSAL_PAUSE_MS));
  });

  if (!isText(block)) return null;
  const Tag = ROLE_TAG[block.role];
  return (
    <Tag
      ref={host}
      class="block-text proposal-block__text"
      contentEditable="true"
      data-proposal-text={item.itemId}
      onFocus$={() => {
        local.focused = true;
      }}
      // Leaving the text is a pause too, and the reader has gone elsewhere:
      // the typing is handed over at once, without taking the caret back.
      onBlur$={async () => {
        local.focused = false;
        await settleHere$();
      }}
      onBeforeInput$={[
        sync$((event: InputEvent) => {
          event.preventDefault();
        }),
        $(async (event: InputEvent, element: HTMLElement) => {
          if (local.phase === "settled" || event.isComposing) return;
          local.focused = true;
          // Where the reader's caret is — moved since the last keystroke, or
          // where the last one left it — else where this last painted it.
          const at =
            liveOffsets(element) ?? (local.edited ? { start: local.start, end: local.end } : { start: 0, end: 0 });
          const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? null;
          const held = heldEdit(event.inputType, data, local.runs, at.start, at.end);
          if (!held.accept) return;
          if (held.replay !== null) {
            local.runs = held.replay.runs;
            local.start = held.replay.at;
            local.end = held.replay.at;
          } else {
            local.start = at.start;
            local.end = at.end;
          }
          local.paint += 1;
          await waitForPause$();
          // A new paragraph or a format is the block's to carry out, so the
          // proposal becomes the block now, and the reader repeats it there.
          if (held.replay === null) await settleHere$();
        }),
      ]}
      onCompositionEnd$={async (_: CompositionEvent, element: HTMLElement) => {
        if (local.phase === "settled") return;
        local.focused = true;
        local.runs = runsFrom(element);
        const at = liveOffsets(element);
        if (at !== null) {
          local.start = at.start;
          local.end = at.end;
        }
        await waitForPause$();
      }}
    />
  );
});
