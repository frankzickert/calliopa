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

import { Icon, type IconName } from "~/components/shell/icons";
import { DERIVED_SECTIONS, derivedSection } from "~/extensions/documents/lib/depth";
import { DRAG_MOVE_TOLERANCE_PX, LONG_PRESS_MS, movedDistance } from "~/lib/drag";
import {
  derivedNames,
  faceOf,
  heldEdit,
  PROPOSAL_PAUSE_MS,
  proposalNames,
  toneOf,
  type Proposer,
  type TypedProposal,
} from "../../lib/proposals";
import { sameRuns, type Run } from "~/lib/runs";
import type { BlockView, TextBlockView } from "../../server/assemble";
import type { ProposedChange } from "../../server/documents";
import { Marked, ROLE_TAG } from "../block-text";
import { paintRuns, runsFrom, selectionIn, selectRange } from "../editor-dom";

const isText = (block: BlockView): block is TextBlockView => block.kind === "text";

/** The glyph a derived candidate's section carries; a synthesis, which stays
 * in the body, takes the flag. BO_0246_006 */
const derivedIcon = (block: BlockView | null): IconName => {
  const section = block === null ? null : derivedSection(block);
  return DERIVED_SECTIONS.find((candidate) => candidate.kind === section)?.icon ?? "flag";
};

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
  /** Accepts a relation, or a proposed reason, with the reason the reader
   * typed on top. BO_0244_010 */
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
  /** A system run's derived candidate: drawn in the derived idiom with no
   * answer icons, accepted by use. BO_0246_006 */
  derived?: boolean;
  /** Whether the block a derived rewrite concerns is pinned, which the
   * rewrite's name says it challenges. */
  pinned?: boolean;
  /** Uses a derived candidate — pins it, which accepts it, or discards it,
   * which rejects it — through the standing every path writes. */
  use$?: QRL<(blockId: string, use: "pin" | "discard") => void>;
}>(({ item, proposer, groupSize, destination, answer$, acceptGroup$, settle$, startDrag$, step$, settleReason$, derived, pinned, use$ }) => {
  const root = useSignal<HTMLElement>();
  // An inferred relation is the *Possible relation* card: the derived idiom,
  // no answer icons, three buttons of its own. BO_0247_005
  const inferredCard = isInferredRelation(item);
  const tone = derived === true || inferredCard ? "derived" : toneOf(proposer);
  const face = faceOf(proposer);
  const names =
    derived === true
      ? { ...proposalNames(item.kind, proposer, destination), ...derivedNames(item.kind, item.block?.kind === "text" ? (item.block.blockKind ?? "") : "", pinned === true) }
      : proposalNames(item.kind, proposer, destination);
  // A work item concerns a block that stands and has no place of its own.
  const work = item.kind === "relate" || item.kind === "reason" || item.kind === "state" || item.kind === "claim" || item.kind === "kind";
  const movable = item.kind !== "remove" && !work;
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
      class={{ "proposal-block": true, "proposal-block--derived": derived === true }}
      data-proposal-id={item.itemId}
      data-proposal-kind={item.kind}
      data-proposal-tone={tone}
      data-proposal-derived-idiom={derived === true ? "true" : undefined}
      role="group"
      aria-label={names.block}
    >
      {derived === true && (
        <span class="block-derived-mark proposal-block__derived-mark" aria-hidden="true">
          <Icon name={derivedIcon(block)} size={14} />
        </span>
      )}
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
      {/* A derived candidate carries no answer icons: it is accepted by
          pinning, editing into or referencing it, and rejected by discarding
          it. BO_0246_006 An inferred relation answers by its own three
          buttons. BO_0247_005 */}
      {derived !== true && !inferredCard && (
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
      )}
      {ownText ? (
        <ProposalText item={item} block={block} settle$={settle$} />
      ) : inferredCard ? (
        <PossibleRelation item={item} answer$={answer$} {...(settleReason$ === undefined ? {} : { settleReason$ })} />
      ) : work ? (
        <ProposalWork item={item} {...(settleReason$ === undefined ? {} : { settleReason$ })} />
      ) : (
        <Slot />
      )}
      {/* A derived candidate is used, not answered: pinning it keeps the
          framing as the reader's, discarding it lets it go; editing into it
          or referencing it in a command does the same on the way. BO_0246_006 */}
      {derived === true && use$ !== undefined && (
        <p class="proposal-block__meta proposal-block__use" data-derived-use>
          <button type="button" data-derived-pin onClick$={() => use$(item.blockId, "pin")}>
            Pin this framing
          </button>
          <button type="button" data-derived-discard onClick$={() => use$(item.blockId, "discard")}>
            Discard
          </button>
        </p>
      )}
      {item.derivedFrom !== undefined && item.derivedFrom.length > 0 && (
        <p class="proposal-block__meta" data-proposal-derived>
          Derived from {item.derivedFrom.length === 1 ? "one block" : `${item.derivedFrom.length} blocks`}
        </p>
      )}
    </div>
  );
});

/** Runs drawn as the reading presentation draws them. */
const Words = component$<{ runs: readonly Run[] }>(({ runs }) => (
  <>
    {runs.map((run, index) => (
      <Marked key={index} text={run.text} marks={run.marks ?? []} link={run.link} />
    ))}
  </>
));

const KIND_WORDS: Readonly<Record<string, string>> = {
  dependsOn: "depends on",
  supports: "supports",
  contradicts: "contradicts",
  qualifies: "qualifies",
  constrains: "constrains",
  implements: "implements",
  supersedes: "supersedes",
  evidences: "provides evidence for",
  opensQuestionIn: "opens a question in",
  affectedBy: "is affected by",
};

/**
 * A work item drawn under the block it concerns (`BO_0244_010`): a relation
 * as *Possible relation* — its claim, what it does to which target, quoted
 * with its document, and its reason, which the reader may edit, and editing
 * accepts; a proposed reason the same way on a relation that stands; a claim
 * as its words; a kind as a line naming it. The origin says *Inferred* or
 * *Derived* where a run guessed or derived it.
 */
const ProposalWork = component$<{
  item: ProposedChange;
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
}>(({ item, settleReason$ }) => {
  if (item.kind === "claim" && item.claim !== undefined) {
    return (
      <div class="proposal-block__work" data-proposal-work="claim">
        <p class="proposal-block__label">Proposed claim</p>
        <p class="block-text proposal-block__quote">
          <Words runs={item.claim.text} />
        </p>
      </div>
    );
  }
  if (item.kind === "kind" && item.block !== null && isText(item.block)) {
    return (
      <div class="proposal-block__work" data-proposal-work="kind">
        <p class="proposal-block__label">
          {item.block.blockKind === undefined ? "Proposed: no kind" : `Proposed kind: ${item.block.blockKind}`}
        </p>
      </div>
    );
  }
  const relation = item.relation;
  if (relation === undefined) return null;
  const origin = relation.origin === "inferred" ? "Inferred" : relation.origin === "derived" ? "Derived" : "Declared";
  // A relation's proposed state, after a pressure judgement: *Set to
  // exercised*, with the relation and its reason for the reader to judge
  // it by. BO_0248_013
  if (item.kind === "state") {
    return (
      <div class="proposal-block__work" data-proposal-work="state" data-relation-id={relation.relationId} data-proposed-state={relation.state}>
        <p class="proposal-block__label">
          Proposed state: set to {relation.state}
          {item.previousState !== undefined && <span class="proposal-block__meta"> (now {item.previousState})</span>}
        </p>
        <p class="proposal-block__line">
          <span class="proposal-block__field">This claim:</span>{" "}
          <q class="proposal-block__quote">
            <Words runs={relation.source.text} />
          </q>
        </p>
        <p class="proposal-block__line">
          <span class="proposal-block__field">{KIND_WORDS[relation.kind] ?? relation.kind}</span>{" "}
          <q class="proposal-block__quote">
            <Words runs={relation.target.text} />
          </q>
          {relation.target.documentTitle !== "" && (
            <span class="proposal-block__meta"> (from: {relation.target.documentTitle})</span>
          )}
        </p>
        {relation.reason.length > 0 && (
          <p class="proposal-block__line">
            <span class="proposal-block__field">Reason:</span> <Words runs={relation.reason} />
          </p>
        )}
      </div>
    );
  }
  const heading = item.kind === "reason" ? "Proposed reason" : "Possible relation";
  return (
    <div class="proposal-block__work" data-proposal-work={item.kind} data-relation-id={relation.relationId}>
      <p class="proposal-block__label">
        {heading}
        <span class="proposal-block__origin" data-proposal-origin={relation.origin}>
          {origin}
        </span>
      </p>
      <p class="proposal-block__line">
        <span class="proposal-block__field">This claim:</span>{" "}
        <q class="proposal-block__quote">
          <Words runs={relation.source.text} />
        </q>
      </p>
      <p class="proposal-block__line">
        <span class="proposal-block__field">{KIND_WORDS[relation.kind] ?? relation.kind}</span>{" "}
        <q class="proposal-block__quote">
          <Words runs={relation.target.text} />
        </q>
        {relation.target.documentTitle !== "" && (
          <span class="proposal-block__meta"> (from: {relation.target.documentTitle})</span>
        )}
      </p>
      <p class="proposal-block__field">Reason</p>
      <ProposalReason
        item={item}
        relationId={relation.relationId}
        baseRevisionId={relation.revisionId}
        reason={relation.reason}
        {...(settleReason$ === undefined ? {} : { settleReason$ })}
      />
    </div>
  );
});

/** Whether a proposed change is a relation a run inferred. BO_0247_005 */
export const isInferredRelation = (item: ProposedChange): boolean =>
  item.kind === "relate" && item.relation !== undefined && item.relation.origin === "inferred";

/**
 * The *Possible relation* card (`BO_0247_005`, the material's screen 4): an
 * inferred relation under its source block in the derived idiom — an
 * *Inferred* chip, the claim it anchors on, what it does to which target
 * quoted with its document, the two lines saying where the relation and its
 * reason came from, and three answers: *Edit reason* puts the caret in the
 * reason, which accepts with the edit on top once the typing pauses or the
 * reader leaves it; *Confirm relation* accepts the member; *Not related*
 * rejects it. Confirmation launders nothing: the provenance line the
 * relation later carries says system-inferred and system-drafted still.
 */
const PossibleRelation = component$<{
  item: ProposedChange;
  answer$: QRL<(itemId: string, answer: "accepted" | "rejected") => void>;
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
}>(({ item, answer$, settleReason$ }) => {
  const host = useSignal<HTMLElement>();
  const relation = item.relation;
  if (relation === undefined) return null;
  return (
    <div ref={host} class="proposal-block__work proposal-block__card" data-proposal-work="relate" data-relation-card={relation.relationId} data-relation-id={relation.relationId}>
      <p class="proposal-block__label">
        Possible relation
        <span class="proposal-block__origin" data-proposal-origin={relation.origin}>
          Inferred
        </span>
      </p>
      <p class="proposal-block__line">
        <span class="proposal-block__field">This claim:</span>{" "}
        <q class="proposal-block__quote">
          <Words runs={relation.source.text} />
        </q>
      </p>
      <p class="proposal-block__line">
        <span class="proposal-block__field">{KIND_WORDS[relation.kind] ?? relation.kind}</span>{" "}
        <q class="proposal-block__quote">
          <Words runs={relation.target.text} />
        </q>
        {relation.target.documentTitle !== "" && (
          <span class="proposal-block__meta"> (from: {relation.target.documentTitle})</span>
        )}
      </p>
      <p class="proposal-block__meta" data-relation-origin-line>
        Origin: system-inferred
      </p>
      <p class="proposal-block__meta" data-relation-reason-line>
        Reason: system-drafted
      </p>
      <ProposalReason
        item={item}
        relationId={relation.relationId}
        baseRevisionId={relation.revisionId}
        reason={relation.reason}
        {...(settleReason$ === undefined ? {} : { settleReason$ })}
      />
      <p class="proposal-block__meta proposal-block__use" data-relation-answers>
        <button
          type="button"
          data-relation-edit={item.itemId}
          disabled={settleReason$ === undefined}
          onClick$={() => {
            const reason = host.value?.querySelector<HTMLElement>("[data-proposal-reason]");
            reason?.focus();
          }}
        >
          Edit reason
        </button>
        <button type="button" data-relation-confirm={item.itemId} onClick$={() => answer$(item.itemId, "accepted")}>
          Confirm relation
        </button>
        <button type="button" data-relation-dismiss={item.itemId} onClick$={() => answer$(item.itemId, "rejected")}>
          Not related
        </button>
      </p>
    </div>
  );
});

/**
 * A relation's reason, editable where it is read: the browser edits the
 * paragraph itself, and once the typing pauses or the reader leaves it the
 * item is accepted with the reason as typed on top. Editing the reason is as
 * easy as accepting it (`BO_0244`, the second intent line). A refused
 * acceptance puts the proposal's words back.
 */
const ProposalReason = component$<{
  item: ProposedChange;
  relationId: string;
  baseRevisionId: string;
  reason: readonly Run[];
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
}>(({ item, relationId, baseRevisionId, reason, settleReason$ }) => {
  const host = useSignal<HTMLElement>();
  const local = useStore({ phase: "idle" as "idle" | "typing" | "settling" | "settled", timer: 0, paint: 0 });

  useVisibleTask$(({ track }) => {
    track(() => local.paint);
    const element = host.value;
    if (element === undefined) return;
    paintRuns(element, [...reason]);
  });

  const settleHere$ = $(async () => {
    const element = host.value;
    if (local.phase !== "typing" || element === undefined || settleReason$ === undefined) return;
    clearTimeout(local.timer);
    local.timer = 0;
    const typed = runsFrom(element);
    if (sameRuns(typed, reason)) {
      local.phase = "idle";
      return;
    }
    local.phase = "settling";
    if (await settleReason$(item.itemId, relationId, baseRevisionId, typed)) {
      local.phase = "settled";
      return;
    }
    local.phase = "idle";
    local.paint += 1;
  });

  return (
    <p
      ref={host}
      class="block-text proposal-block__text proposal-block__reason"
      contentEditable={settleReason$ === undefined ? "false" : "true"}
      data-proposal-reason={item.itemId}
      onInput$={() => {
        if (local.phase === "settled" || local.phase === "settling") return;
        local.phase = "typing";
        clearTimeout(local.timer);
        local.timer = Number(setTimeout(() => void settleHere$(), PROPOSAL_PAUSE_MS));
      }}
      onBlur$={async () => {
        await settleHere$();
      }}
    />
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
