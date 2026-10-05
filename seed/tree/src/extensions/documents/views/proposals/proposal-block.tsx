import {
  $,
  component$,
  Slot,
  sync$,
  useContext,
  useSignal,
  useStore,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import { POLES, quadrantOf } from "../../lib/working-mode";
import { Icon } from "~/components/shell/icons";
import { DRAG_MOVE_TOLERANCE_PX, LONG_PRESS_MS, movedDistance } from "~/lib/drag";
import {
  faceOf,
  heldEdit,
  INFERRED_RELATION_NAMES,
  PROPOSAL_PAUSE_MS,
  proposalNames,
  proposerName,
  toneOf,
  modeOf,
  driftLine,
  type Proposer,
  type TypedProposal,
} from "../../lib/proposals";
import { runsText, sameRuns, type Run } from "~/lib/runs";
import type { BlockView, CodeBlockView, MediaBlockView, OutputBlockView, TableBlockView, TextBlockView } from "../../server/assemble";
import { MediaBlock } from "../media-block";
import { TableBlock } from "../table-block";
import { CodeBlock } from "../code-block";
import { OutputBlock } from "../output-block";
import type { ProposedChange } from "../../server/documents";
import { CitedWorksContext } from "../cited-works";
import { Marked, ROLE_TAG } from "../block-text";
import { paintRuns, runsFrom, selectionIn, selectRange } from "../editor-dom";
import { openingWords } from "../../lib/pointing";
import type { Marked as MarkedTarget } from "../../lib/references";
import { clickMarks } from "../press";
import { MarkingContext } from "../marking/use-marking";
import { BlockBar } from "../block-bar";
import { SWIPEABLE_PROPOSALS } from "../block-swipe";
import type { CardPlace } from "../cards";
import { CardLabel } from "../standing/standing-mark";
import type { Standing } from "../../lib/disposition";
import { RowMarks, rowMarkingName, rowNumbers } from "../marking/row-marks";
import { RowGrip } from "../row-grip";
import { HOVER_DEPTH_MS, hoverPointer, HOVER_POINTER } from "../../lib/pointer";

/** How far the reader has turned to a proposal: whether the page is read
 * with a pointer that hovers, and whether the proposal holds the focus. On a
 * phone a first tap focuses it and shows its chip, and only then is its text
 * the reader's to type into. DO_0004_004 */
interface Reach {
  hover: boolean;
  engaged: boolean;
  /** On a pointer that hovers: the text takes typing once a click placed the
   * caret in it, or the keyboard reached it — never while the pointer merely
   * rests on it, since a drag starting in an editable text cannot leave it and
   * a selection could not run on into the blocks around. DO_0023_001 */
  armed: boolean;
}

const isText = (block: BlockView): block is TextBlockView => block.kind === "text";
/** A proposed picture draws itself, as a proposed paragraph draws its words:
 * without this it fell through to the slot and a proposed generation was an
 * empty line with a chip on it. BO_0273_039 */
const isMedia = (block: BlockView): block is MediaBlockView =>
  block.kind === "image" || block.kind === "video";
const isTable = (block: BlockView): block is TableBlockView => block.kind === "table";
/** A proposed code block and a proposed output draw themselves too. BO_0289_018 */
const isCode = (block: BlockView): block is CodeBlockView => block.kind === "sourcecode";
const isOutput = (block: BlockView): block is OutputBlockView => block.kind === "output";

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
 * colour, with one line on its bottom border — the proposer's face, what the
 * proposal does in words, and its answers — so a reader sees who proposed
 * what and what it does before reading a word, and the text keeps the
 * accepted blocks' width and typography. BO_0265_010
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
  /** What the proposal does, in the line on its bottom border: the agent's
   * note, or the words for its kind. BO_0265_011 */
  words: string;
  /** Where accepting would move the block, in words, when it would move one. */
  destination: string | null;
  answer$: QRL<(itemId: string, answer: "accepted" | "rejected") => void>;
  settle$: QRL<
    (itemId: string, blockId: string, typed$: QRL<() => TypedProposal>) => Promise<boolean>
  >;
  startDrag$: QRL<(itemId: string, preview: string, event: PointerEvent) => void>;
  step$: QRL<(itemId: string, direction: -1 | 1) => void>;
  /** Accepts a relation, or a proposed reason, with the reason the reader
   * typed on top. BO_0244_010 */
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
  /** The block a removal or a move frames, as the reader sees it: the
   * revision and the words a mark on the proposal keeps. BO_0263_005 */
  framed?: BlockView;
  /** Accepts this proposal and gives the block it becomes a standing, from
   * the block bar's *Fixate* a swipeable proposal carries while it is the
   * subject — the path that is not the gesture. DO_0014_003 BO_0315_013 */
  standing$?: QRL<(to: Standing) => void>;
  /** The idle grip's reach: where its arrows stop, and the step over the
   * drawn rows. BO_0263_013 */
  grip?: { readonly first: boolean; readonly last: boolean; readonly step$: QRL<(position: string, direction: -1 | 1) => void> };
  /** Tells the editor the reader has turned to this proposal, so the bar's
   * block groups act on it as they act on a block. DO_0006_004 */
  focus$?: QRL<() => void>;
  /** A rest of the pointer on this row, which focuses it unless something is
   * being edited — the editor holds that rule, as it does for a block row.
   * DO_0006_008 */
  hoverFocus$?: QRL<() => void>;
  /** Whether this proposal is the row the reader has turned to: the one the
   * bar's block groups act on. It is drawn as a focused block row is — the
   * ring, and its chip and grip kept — so the reader can tell which of
   * several proposals the bar is naming. User decision, 2026-09-21.
   * DO_0006_010 */
  focused?: boolean;
  /** Whether this proposal's text holds the caret, which makes it the bar's
   * subject as a block being edited is. DO_0014_003 */
  editing?: boolean;
  /** This proposal's text taking or losing the caret. DO_0006_008 */
  edit$?: QRL<(editing: boolean) => void>;
  /** The run that refined this proposal, when one did: the chip carries its
   * face and colour, and the names say both who proposed and who refined.
   * BO_0271_011 */
  refinedBy?: Proposer | null;
  /** The run that proposes this item's withdrawal, when one does: the chip
   * carries its face and colour, the row is drawn standing but marked, and
   * the names say both. BO_0286_011 */
  withdrawal?: Proposer | null;
  /** How many withdrawn items accepting this one rejects with it.
   * BO_0286_009 */
  withdrawing?: number;
  /** Shows the proposal that supersedes this withdrawn one: its change
   * shown beside this one, the successor scrolled into view and focused.
   * BO_0286_012 */
  successor$?: QRL<(itemId: string) => void>;
  /** A replace of a table that a file stands behind: accepting drops the
   * file, since the cells proposed are the whole table. BO_0287_016 */
  dropsFile?: boolean;
  /** Whether the document numbers the lines of its code, so a proposed code
   * block is numbered on its row exactly as an accepted one is. BO_0302_006 */
  numbersCode?: boolean;
  /** The card this row is part of: its group, where the row sits in it, and
   * whether it is folded, when a swipe answers the whole group. BO_0350_001 */
  card?: CardPlace | undefined;
  /** Kept for later by the reader, and drawn because *Show proposed changes*
   * is on: the card carries the deferred label. BO_0350_007 */
  deferred?: boolean;
  /** The run the card came from, named by its command and the block it was
   * given from. BO_0350_013 */
  origin?: string | null;
}>(({ item, proposer, words, destination, answer$, settle$, startDrag$, step$, settleReason$, standing$, framed, grip, focus$, hoverFocus$, edit$, focused, editing, refinedBy, withdrawal, withdrawing, successor$, dropsFile, numbersCode, card, deferred, origin }) => {
  const root = useSignal<HTMLElement>();
  // A proposal being edited is drawn anew under the caret (its row's key says
  // so, CA_0063_005), and stays armed across that. DO_0023_001
  const reach = useStore<Reach>({ hover: false, engaged: false, armed: editing === true });
  /** The rest a hover focuses after, as a block row measures it. DO_0006_008 */
  const hover = useStore({ timer: 0 });
  const { store: markingStore, toggleReference$ } = useContext(MarkingContext);
  // An inferred relation is the *Possible relation* card: the derived idiom,
  // its own lines, and the chip's answers under the card's words.
  // BO_0247_005 DO_0007_001
  const inferredCard = isInferredRelation(item);
  // A refined proposal is the refiner's work with its origin kept: the face
  // and the colour are the refining run's. BO_0271_011
  const refiner = refinedBy ?? null;
  // A withdrawn item wears the withdrawer's face and colour over the
  // refiner's, and the proposer's under both. BO_0286_011
  const withdrawer = withdrawal ?? null;
  const shown = withdrawer ?? refiner ?? proposer;
  const tone = inferredCard ? "derived" : toneOf(shown);
  const served = modeOf(shown);
  const strayed = driftLine(shown);
  const face = faceOf(shown);
  const names = inferredCard
    ? { ...proposalNames(item.kind, proposer, destination, refiner, withdrawer, withdrawing ?? 0), ...INFERRED_RELATION_NAMES }
    : proposalNames(item.kind, proposer, destination, refiner, withdrawer, withdrawing ?? 0);
  // A work item concerns a block that stands and has no place of its own.
  const work = item.kind === "relate" || item.kind === "reason" || item.kind === "state";
  // A gather is answered whole, as its group: its summary is not dragged
  // or edited on its own, and a row it moves is framed by it and shows the
  // block it moves. BO_0322_013
  const gather = item.kind === "gather";
  const movable = item.kind !== "remove" && !work && !gather;
  const block = item.block;
  const own = (item.kind === "replace" || item.kind === "insert" || (gather && framed === undefined)) && block !== null;
  const ownText = own && isText(block);
  const ownMedia = own && isMedia(block);
  // A proposed table is drawn as it is, its cells read and not edited, until
  // the person accepts it. BO_0287_016
  const ownTable = own && isTable(block);
  const ownCode = own && isCode(block);
  const ownOutput = own && isOutput(block);
  // A proposal of the four kinds is markable in command mode: the mark
  // points at the proposal, with the revision and the words the reader
  // sees, and who proposed it. A work item has no row of its own.
  // BO_0263_005
  const shownBlock = ownText || ownMedia || ownTable || ownCode || ownOutput ? block : (framed ?? null);
  const markable = !work && !inferredCard && shownBlock !== null;
  const marked: MarkedTarget = {
    target: "proposal",
    group: item.groupId,
    item: item.itemId,
    ...(shownBlock === null ? {} : { revisionId: shownBlock.revisionId }),
    ...(shownBlock !== null && isText(shownBlock) ? { words: openingWords(runsText(shownBlock.runs)) } : {}),
    proposer: proposerName(proposer),
  };
  const commanding = markable && markingStore.marking.mode === "command";
  const numbers = rowNumbers(markingStore.marking, item.blockId, marked);

  // A long press anywhere on the proposal starts its drag on touch, where the
  // face alone was too small a thing to find, and it held nothing a reader
  // pressing the block expected. The drag itself is the shell's own, which
  // arms after the same hold; what this adds is what only a native listener
  // can: once the hold has armed, the page stops scrolling under the finger
  // (a non-passive touchmove) and the long-press menu is kept away. A press
  // that moves first is a scroll, and a tap still places the caret. A mouse
  // keeps the face as its handle, since pressing and dragging in text is how
  // a mouse selects. BO_0233_012
  // Whether the pointer hovers is the page's, and follows a mouse plugged in
  // or taken away. DO_0004_004
  useVisibleTask$(({ cleanup }) => {
    reach.hover = hoverPointer();
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(HOVER_POINTER);
    const change = () => {
      reach.hover = query.matches;
    };
    query.addEventListener?.("change", change);
    cleanup(() => query.removeEventListener?.("change", change));
  });

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
      if (target?.closest(".proposal-block__mark") != null) return;
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
      data-proposal-withdrawn={withdrawer === null ? undefined : ""}
      data-proposal-kind={item.kind}
      data-proposal-tone={tone}
      data-card-group={card?.group}
      data-card-edge={card?.edge}
      data-card-folded={card === undefined ? undefined : card.folded ? "true" : "false"}
      data-card-segment={card?.segment}
      data-proposal-deferred={deferred === true ? "true" : undefined}
      role="group"
      aria-label={names.block}
      // A tap focuses the proposal, which shows its chip and its grip; a
      // second tap edits it. A work item with nothing focusable of its own
      // takes a tab stop, so the keyboard reaches its chip. DO_0004_004
      tabIndex={item.kind === "state" ? 0 : -1}
      data-engaged={reach.engaged ? "true" : undefined}
      data-focused={focused === true ? "true" : undefined}
      onFocusIn$={() => {
        reach.engaged = true;
        // A proposal is worked with as a block: turning to it makes it the
        // subject the bar's block groups act on. DO_0006_004
        if (focus$ !== undefined) void focus$();
      }}
      // A proposal is a row like any other under the pointer: resting on it
      // focuses it, and the focus holds when the pointer leaves. What the
      // rest may take is the editor's rule. DO_0006_008
      onPointerEnter$={(event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !hoverPointer() || hoverFocus$ === undefined) return;
        clearTimeout(hover.timer);
        hover.timer = Number(setTimeout(() => {
          hover.timer = 0;
          void hoverFocus$();
        }, HOVER_DEPTH_MS));
      }}
      onPointerLeave$={(event: PointerEvent) => {
        if (event.pointerType !== "mouse" || !hoverPointer()) return;
        clearTimeout(hover.timer);
        hover.timer = 0;
      }}
      onFocusOut$={(event: FocusEvent, element: HTMLElement) => {
        const next = event.relatedTarget as Node | null;
        if (next !== null && element.contains(next)) return;
        reach.engaged = false;
        reach.armed = false;
      }}
      // Written out rather than spread: a spread beside the element's own
      // name compiles to the name twice.
      data-mark-row={markable ? item.blockId : undefined}
      data-mark-target={markable ? "proposal" : undefined}
      data-mark-group={markable ? item.groupId : undefined}
      data-mark-item={markable ? item.itemId : undefined}
      data-mark-revision={markable ? marked.revisionId : undefined}
      data-mark-proposer={markable ? marked.proposer : undefined}
      data-reference={commanding && numbers.reference !== null ? numbers.reference : undefined}
      data-reference-proposal={commanding && numbers.whole !== null ? numbers.whole : undefined}
    >
      {markable && <RowMarks blockId={item.blockId} marked={marked} />}
      {deferred === true && <CardLabel mark="deferred" />}
      {/* The block bar, for a pointer that cannot swipe: *Remove* rejects the
          proposal, *Fixate* accepts it and fixates the block it becomes, and
          the arrows stage its place. A proposal is the bar's subject like any
          other row, so it carries the bar while reading, focused or holding
          the caret, and none in command mode. DO_0014_003 BO_0315_013 */}
      {markingStore.marking.mode === "reading" && (focused === true || editing === true) && standing$ !== undefined && SWIPEABLE_PROPOSALS.includes(item.kind) && (
        <BlockBar
          label={names.block.replace(/^Proposed/u, "proposed")}
          id={`proposal:${item.itemId}`}
          arrows="row"
          first={grip?.first ?? true}
          last={grip?.last ?? true}
          {...(movable && grip !== undefined ? { step$: grip.step$ } : {})}
          standing="keep"
          fixate$={$((_: string, to: Standing) => standing$(to))}
          remove$={$(() => answer$(item.itemId, "rejected"))}
        />
      )}
      {/* Its grip while reading: moving a proposal stages its place and
          answers nothing. A removal has none; its block carries its own.
          BO_0263_013 */}
      {movable && grip !== undefined && markingStore.marking.mode === "reading" && (
        <RowGrip
          label={names.block.replace(/^Proposed/u, "proposed")}
          drag$={$((event: PointerEvent) => startDrag$(item.itemId, names.block, event))}
        />
      )}
      {ownText ? (
        <ProposalText item={item} block={block} reach={reach} settle$={settle$} mark$={$(() => toggleReference$(item.blockId, marked))} {...(edit$ === undefined || gather ? {} : { edit$ })} />
      ) : ownMedia && block !== null && isMedia(block) ? (
        <MediaBlock block={block} number={block.number} />
      ) : ownTable && block !== null && isTable(block) ? (
        <TableBlock block={block} number={block.number} editable={false} />
      ) : ownCode && block !== null && isCode(block) ? (
        <CodeBlock block={block} editable={false} numbered={numbersCode === true} number={block.number} />
      ) : ownOutput && block !== null && isOutput(block) ? (
        <OutputBlock block={block} number={block.number} />
      ) : inferredCard ? (
        <PossibleRelation item={item} {...(settleReason$ === undefined ? {} : { settleReason$ })} />
      ) : work ? (
        <ProposalWork item={item} {...(settleReason$ === undefined ? {} : { settleReason$ })} />
      ) : (
        <Slot />
      )}
      {dropsFile === true && (
        <p class="proposal-block__meta" data-proposal-drops-file>
          Accepting drops the file behind this table: the cells proposed are the whole table.
        </p>
      )}
      {/* The chip on the bottom border: the proposer's face — the handle,
          and in command mode what marks a removal or a move — what the
          proposal does in words, and its answers, one border around controls
          of one size, as the command control is. Hidden at rest; shown while
          the proposal is hovered or holds the focus. *Accept all* is the run
          chip's. BO_0265_010 BO_0265_015 DO_0004_003 DO_0004_004 */}
      <div class="proposal-block__mark" data-proposal-mark={item.itemId}>
        <button
          type="button"
          class="proposal-block__face"
          data-proposal-face={item.itemId}
          aria-label={
            commanding
              ? rowMarkingName(names.block.replace(/^Proposed/u, "proposed"), numbers.reference, numbers.passages, numbers.whole)
              : movable
                ? `${names.face}. Drag it, or use the arrow keys, to move it.`
                : names.face
          }
          // In command mode the face is what marks the proposal, as the words
          // are a block's: a press marks it, a second takes the mark back.
          // BO_0263_005
          aria-pressed={commanding ? numbers.reference !== null : undefined}
          // A long press on the face is the drag's, never the image's menu.
          preventdefault:contextmenu
          onPointerDown$={(event: PointerEvent) => {
            if (!movable || markingStore.marking.mode === "command") return;
            void startDrag$(item.itemId, names.block, event);
          }}
          onClick$={() => {
            if (!markable || markingStore.marking.mode !== "command") return;
            void toggleReference$(item.blockId, marked);
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
              width={18}
              height={18}
              draggable={false}
            />
          ) : (
            <Icon name={face.icon} size={14} />
          )}
        </button>
        {/* The mode the run served, as the two poles' icons named for the
            quadrant, and where it strayed from it, in the chip's line. The
            judgement is the kernel's; the answers stand as ever. BO_0306_014 */}
        {served !== undefined && (
          <span class="proposal-block__mode" data-proposal-mode={`${served.field}+${served.work}`} role="img" aria-label={quadrantOf(served)} title={quadrantOf(served)}>
            <Icon name={POLES[served.field].icon} size={12} />
            <Icon name={POLES[served.work].icon} size={12} />
          </span>
        )}
        <span class="proposal-block__words" data-proposal-words>
          {withdrawing !== undefined && withdrawing > 0 ? `${words}, withdrawing ${withdrawing}` : words}
        </span>
        {origin !== undefined && origin !== null && (
          <span class="proposal-block__origin" data-proposal-origin>
            {origin}
          </span>
        )}
        {strayed !== null && (
          <span class="proposal-block__drift" data-proposal-drift>
            {strayed}
          </span>
        )}
        {/* Every candidate carries answer icons. The *Possible relation*
            card answers here like any other proposal, with the card's own
            words on the icons. DO_0007_001 */}
        <div class="proposal-block__answers">
          {destination !== null && (
            <span class="proposal-block__moves" data-proposal-moves aria-hidden="true">
              <Icon name="arrows-down-up" size={14} />
            </span>
          )}
          {/* A withdrawn proposal with a successor offers it: the press shows
              the successor's change beside this one and turns to it, so the
              reader can read what replaces these words before answering.
              User decision, 2026-09-23. BO_0286_012 */}
          {item.withdrawal?.successor !== undefined && successor$ !== undefined && (
            <button
              type="button"
              class="proposal-block__answer"
              data-proposal-successor={item.itemId}
              aria-label="Show the proposal that replaces this one"
              onClick$={() => successor$(item.itemId)}
            >
              <Icon name="link" size={14} />
            </button>
          )}
          <button
            type="button"
            class="proposal-block__answer"
            data-proposal-accept={item.itemId}
            aria-label={names.accept}
            onClick$={() => answer$(item.itemId, "accepted")}
          >
            <Icon name="check" size={14} />
          </button>
          <button
            type="button"
            class="proposal-block__answer"
            data-proposal-reject={item.itemId}
            aria-label={names.reject}
            onClick$={() => answer$(item.itemId, "rejected")}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});

/**
 * Runs drawn as the reading presentation draws them. A citation in a
 * proposed sentence is numbered where it would land (`BO_0291_025`): a work
 * the document already cites keeps its number, and a work it does not yet
 * cite takes the numbers after the last, in the order this proposal first
 * cites them — it has none in the read until the proposal is accepted.
 */
const Words = component$<{ runs: readonly Run[] }>(({ runs }) => {
  const cited = useContext(CitedWorksContext, null);
  const numbers: Record<string, number> = { ...(cited?.numbers ?? {}) };
  let next = Math.max(0, ...Object.values(numbers)) + 1;
  for (const run of runs) {
    if (run.cite !== undefined && numbers[run.cite.work] === undefined) numbers[run.cite.work] = next++;
  }
  return (
    <>
      {runs.map((run, index) => (
        <Marked
          key={index}
          text={run.text}
          marks={run.marks ?? []}
          link={run.link}
          cite={run.cite}
          citeNumber={run.cite === undefined ? undefined : numbers[run.cite.work]}
          citeMissing={false}
        />
      ))}
    </>
  );
});

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
 * as *Possible relation* — its block, what it does to which target, quoted
 * with its document, and its reason, which the reader may edit, and editing
 * accepts; a proposed reason the same way on a relation that stands. The
 * origin says *Inferred* or *Derived* where a run guessed or derived it.
 */
const ProposalWork = component$<{
  item: ProposedChange;
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
}>(({ item, settleReason$ }) => {
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
          <span class="proposal-block__field">This block:</span>{" "}
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
        <span class="proposal-block__field">This block:</span>{" "}
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
 * *Inferred* chip, the block it anchors on, what it does to which target
 * quoted with its document, the two lines saying where the relation and its
 * reason came from, and the reason, editable where it is read: a press puts
 * the caret in it, and the item is accepted with the edit on top once the
 * typing pauses or the reader leaves it. It is answered from the chip on its
 * bottom border, as every other proposal is (`DO_0007_001`). Confirmation
 * launders nothing: the provenance line the relation later carries says
 * system-inferred and system-drafted still.
 */
const PossibleRelation = component$<{
  item: ProposedChange;
  settleReason$?: QRL<(itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]) => Promise<boolean>>;
}>(({ item, settleReason$ }) => {
  const relation = item.relation;
  if (relation === undefined) return null;
  return (
    <div class="proposal-block__work proposal-block__card" data-proposal-work="relate" data-relation-card={relation.relationId} data-relation-id={relation.relationId}>
      <p class="proposal-block__label">
        Possible relation
        <span class="proposal-block__origin" data-proposal-origin={relation.origin}>
          Inferred
        </span>
      </p>
      <p class="proposal-block__line">
        <span class="proposal-block__field">This block:</span>{" "}
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
  /** Whether the reader has turned to the proposal: its text takes typing on
   * a pointer that hovers, and on a phone once a first tap has focused it.
   * The store itself, so its changes reach the text. DO_0004_004 */
  reach: Reach;
  settle$: QRL<
    (itemId: string, blockId: string, typed$: QRL<() => TypedProposal>) => Promise<boolean>
  >;
  /** Marks the proposal, pressed in command mode. BO_0263_005 */
  mark$: QRL<() => void>;
  /** Says when this text holds the caret, so the editor knows a proposal is
   * being edited. DO_0006_008 */
  edit$?: QRL<(editing: boolean) => void>;
}>(({ item, block, reach, settle$, mark$, edit$ }) => {
  const { store: markingStore } = useContext(MarkingContext);
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
    /** A pointer press on the text, until its click. DO_0023_001 */
    pressing: false,
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

  // Written on the element as well: an attribute of a tag held in a
  // variable is set when the element is made and never patched. DO_0004_004
  useVisibleTask$(({ track }) => {
    const editable = track(() => markingStore.marking.mode !== "command" && (reach.hover ? reach.armed : reach.engaged));
    const element = host.value;
    if (element === undefined) return;
    element.setAttribute("contenteditable", editable ? "true" : "false");
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
      // Command mode points and never edits: the words are for marking, and
      // typing into them would accept the proposal. BO_0263_005
      // On a phone the first tap focuses the proposal and shows its chip; the
      // text takes the caret on the second. DO_0004_004
      contentEditable={markingStore.marking.mode !== "command" && (reach.hover ? reach.armed : reach.engaged) ? "true" : "false"}
      // Reached by the keyboard whether or not it takes typing yet: on a
      // pointer that hovers the text is not editable at rest. DO_0023_001
      tabIndex={0}
      data-proposal-text={item.itemId}
      data-mark-text
      onPointerDown$={() => {
        local.pressing = true;
      }}
      onClick$={async (_: MouseEvent, element: HTMLElement) => {
        local.pressing = false;
        if (markingStore.marking.mode === "command") {
          if (clickMarks(element)) void mark$();
          return;
        }
        // A click arms the text where the caret landed, or over the words a
        // drag selected inside it; a drag that ran on into other blocks left
        // a selection this text does not hold, and arms nothing. DO_0023_001
        if (!reach.hover || reach.armed) return;
        const at = liveOffsets(element);
        if (at === null) return;
        reach.armed = true;
        element.setAttribute("contenteditable", "true");
        element.focus();
        selectRange(element, at.start, at.end);
        local.focused = true;
        if (edit$ !== undefined) await edit$(true);
        // The proposal drawn as the one being edited may have moved the words
        // the caret was in; it is put back where the click left it.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (element.isConnected && liveOffsets(element) === null) selectRange(element, at.start, at.end);
      }}
      onFocus$={(_: FocusEvent, element: HTMLElement) => {
        // A press gives the focus before its click decides what it meant, so
        // the text is armed by the click; the keyboard arms it at once.
        // DO_0023_001
        if (reach.hover && !reach.armed) {
          if (local.pressing || markingStore.marking.mode === "command") return;
          reach.armed = true;
          element.setAttribute("contenteditable", "true");
        }
        local.focused = true;
        if (edit$ !== undefined) void edit$(true);
      }}
      // Leaving the text is a pause too, and the reader has gone elsewhere:
      // the typing is handed over at once, without taking the caret back.
      onBlur$={async () => {
        local.pressing = false;
        local.focused = false;
        if (edit$ !== undefined) void edit$(false);
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
