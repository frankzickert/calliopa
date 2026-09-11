import {
  $,
  component$,
  useContext,
  useContextProvider,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import type { DragPayload } from "~/lib/drag";
import { step } from "~/lib/disposition";
import { anchorAt } from "~/lib/passage";
import { passagesIn, passageState, referenceFor } from "~/lib/references";
import { proposedFor, revealFor } from "~/lib/command-target";
import {
  applyLink,
  applyMark,
  linkAt,
  marksAt,
  MARKS,
  replaceRange,
  runsLength,
  runsText,
  sameRuns,
  TEXT_ROLES,
  type Mark,
  type Run,
  type TextRole,
} from "~/lib/runs";
import {
  ViewBridgeContext,
  type ViewAction,
  type InspectorFact,
  type SaveState,
  type ViewDragState,
} from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import type { ChangeSummary } from "~/server/documents/documents";
import { CHANGE_STATUSES, isChangeStatus } from "~/lib/library";
import { STATUS_ICONS } from "~/components/shell/icons";
import type {
  BlockView,
  DocumentView,
  TextBlockView,
} from "~/server/documents/assemble";
import type {
  DocumentProposals,
  ProposedChange,
} from "~/server/documents/documents";
import {
  offsetFromPoint,
  paintRuns,
  placeTitleCaret,
  runsFrom,
  selectionEscapes,
  selectionIn,
  selectRange,
  textLength,
  titleCaret,
} from "./editor-dom";
import {
  answerProposal,
  placeProposal,
  describeOutcome,
  fetchChanges,
  fetchDocument,
  fetchProposals,
  fetchRetired,
  sendCommand,
  sendRename,
  sendStatus,
} from "./documents-client";
import { installSwipe, swipeJustEnded } from "./block-swipe";
import {
  chordDirection,
  clickMarks,
  inStandingToolbar,
  passageNumberAt,
} from "./press";
import { MarkingContext, useMarking } from "./marking/use-marking";
import { PassageAffordance } from "./passages/passage-affordance";
import { PassageNumbers } from "./passages/passage-numbers";
import { revealedPassage, showArea } from "./reveal";
import { selectedWords } from "./passages/selection";
import { PassagesContext, usePassages } from "./passages/use-passages";
import { Marked, ROLE_TAG, type BlockTag } from "./block-text";
import { ProposalBlock } from "./proposals/proposal-block";
import {
  destinationOf,
  stepPlacement,
  withoutItems,
  type Proposer,
  type Placed,
  type ProposalPlacement,
  type TypedProposal,
} from "~/lib/proposals";
import { orderBetween } from "~/lib/order";
import { placeProposals, readingOrder } from "./reading-order";
import { markingName, readingName } from "./row-name";
import { DiscardedRow } from "./standing/discarded-row";
import { StandingAnnouncement } from "./standing/standing-announcement";
import { StandingControl } from "./standing/standing-control";
import { StandingMark } from "./standing/standing-mark";
import { StandingToolbar } from "./standing/standing-toolbar";
import { StandingContext, standingOf, useStanding } from "./standing/use-standing";
import "./block-editor.css";

/**
 * The block editor: one graph document as a reading surface, with one block at
 * a time editable in place.
 *
 * The graph is authoritative and everything here is transient. A block is
 * painted from its stored runs, edited as runs, and saved as runs, through the
 * element the reader was already looking at, so activation moves no text and
 * saving refetches nothing.
 *
 * **What may be read while the document renders is the whole design.** The
 * active block is a `contenteditable` this component paints imperatively; if a
 * keystroke changed anything the document's render reads, Qwik would re-render
 * that element and wipe the text the caret is in. So the editing state below is
 * read only inside event handlers and inside small child components that
 * re-render alone.
 */

/** How long typing may pause before the edit saves. Long enough that a
 * sentence is one revision rather than ten, short enough that a tab left open
 * mid-thought loses a word rather than a paragraph. */
export const SAVE_PAUSE_MS = 1200;

/** How long typing continues before it becomes a second undo step. Undo that
 * gave back one character at a time would be a keystroke log, not a history. */
const HISTORY_STEP_MS = 600;

/** How long arrow presses on a proposal's face pause before the place they
 * reached is staged. Longer than the kernel's restaging floor (250 ms), so
 * a reader stepping a proposal along stages the place they stop at, once.
 * BO_0233_007 */
const PROPOSAL_STEP_PAUSE_MS = 600;

/**
 * Scroll position per tab, for this page load only.
 *
 * Scroll is browser-local by the view contract: not view-local state in the
 * tab, and certainly not graph content. The shell mounts only the active tab,
 * so without this a tab switch would return the reader to the top of a document
 * they were halfway down.
 */
const scrollByTab = new Map<string, number>();

/**
 * The tabs this page has already mounted.
 *
 * A tab switch unmounts and remounts this view, so the mount cannot otherwise
 * tell a returning tab from a freshly loaded page. This is that difference, and
 * it lives for the page's lifetime because that is exactly the span it
 * describes: a reload starts it empty, which is what makes a reloaded document
 * come back reading.
 */
const mountedTabs = new Set<string>();


/**
 * Whether the document says nothing yet.
 *
 * A document is created holding one empty paragraph, so "no blocks" alone would
 * never be true for a document a reader had just made — which is exactly the
 * one that needs to read as a blank page.
 */
function emptyDocument(doc: {
  readonly blocks: readonly BlockView[];
}): boolean {
  if (doc.blocks.length === 0) return true;
  const only = doc.blocks[0];
  return (
    doc.blocks.length === 1 &&
    only !== undefined &&
    isText(only) &&
    runsLength(only.runs) === 0
  );
}

const ROLE_LABEL: Readonly<Record<TextRole, string>> = {
  paragraph: "Paragraph",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  quote: "Quote",
};

const MARK_LABEL: Readonly<Record<Mark, string>> = {
  bold: "Bold",
  italic: "Italic",
  strikethrough: "Strikethrough",
  code: "Code",
};

const MARK_GLYPH: Readonly<Record<Mark, string>> = {
  bold: "B",
  italic: "I",
  strikethrough: "S",
  code: "</>",
};

const isText = (block: BlockView): block is TextBlockView =>
  block.kind === "text";

/** A group whose proposer the read did not carry: said as an agent, never guessed. */
const UNKNOWN_PROPOSER: Proposer = { kind: "agent", agent: null, executedBy: "" };

/** The established blocks as a placement reads them, with their opening words. BO_0233_003 */
const placedOf = (blocks: readonly BlockView[]): Placed[] =>
  blocks
    .filter((block) => block.order !== "")
    .map((block) => ({
      blockId: block.blockId,
      order: block.order,
      words: isText(block)
        ? runsText(block.runs).split(/\s+/).filter(Boolean).slice(0, 6).join(" ") || "an empty block"
        : "a divider",
    }))
    .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0));

/** The order key a placement would take among the placed blocks, drawn at
 * once while the staging that keeps it is on its way. */
const localOrder = (placement: ProposalPlacement, placed: readonly Placed[], self: string): string => {
  const others = placed.filter((block) => block.blockId !== self);
  if ("at" in placement) return orderBetween(others[others.length - 1]?.order ?? "", "");
  const at = others.findIndex((block) => block.blockId === placement.before);
  return orderBetween(others[at - 1]?.order ?? "", others[at]?.order ?? "");
};

interface DocumentState {
  document: DocumentView | null;
  retired: BlockView[];
  retiredOpen: boolean;
  /** Whether the blocks the reader set aside as discarded are drawn where
   * they sit. They are otherwise not drawn at all. BO_0227_014 */
  discardedOpen: boolean;
  /** The proposed changes standing unanswered against this document. They are
   * read whether or not the toggle is on, because the panel says how many are
   * waiting and a toggle that hid that would leave a reader no way to learn
   * work was there. */
  proposals: DocumentProposals | null;
  proposalsOpen: boolean;
  status: "loading" | "ready" | "failed";
  /** True when the document this tab names is not in the graph any more, which
   * is what a stored tab naming a deleted document arrives as. */
  missing: boolean;
  notice: string | null;
  /** How often this document has changed and when it last did, as the panel
   * reports them. Read separately from the document so a save can refresh the
   * count without paying to read every block again. */
  changes: ChangeSummary | null;
  /** The save state this view last reported, mirrored so the panel can state
   * it beside the document's other facts. The shell header reads the same
   * channel; this is not a second answer, it is the same one kept to hand. */
  saveState: SaveState | null;
  activeBlockId: string | null;
  /** Rises whenever the document is read again, so the painter knows the
   * element under it is new even when the active block has not changed. */
  loaded: number;
  /** The shell's count of ended runs as this view last acted on it, so a run
   * that ended before the view was opened is not acted on again when it is.
   * BO_0226_007 */
  proposedSeen: number;
  /** The last reveal request this view has looked at. CA_0039_005 */
  revealSeen: number;
}

/** The active block's transient editing state. */
interface EditorState {
  blockId: string | null;
  /** The active block's 1-based position, so the bar can name the block its
   * controls act on. The bar re-renders alone and never reads the document's
   * render, which is where the row's own index lives. */
  position: number;
  runs: Run[];
  /** The runs as last established in the graph, and the revision they are. */
  savedRuns: Run[];
  baseRevisionId: string;
  role: TextRole;
  start: number;
  end: number;
  marks: Mark[];
  link: string | null;
  linking: boolean;
  linkDraft: string;
  saving: boolean;
  failure: string | null;
  timer: number;
  /** When the last history step was taken, so a burst of typing is one step. */
  stepped: number;
  /** Editor-local history over text and marks. It never reverses a saved
   * structural operation; that is a separate, named action. */
  past: { runs: Run[]; start: number; end: number }[];
  future: { runs: Run[]; start: number; end: number }[];
  /** Rises when the element must be painted from `runs` again. */
  paint: number;
  /** Whether leaving is already under way. Two surfaces answering one gesture
   * would otherwise each save from the same base, and the second would be
   * refused as a conflict the reader never caused. */
  leaving: boolean;
}

const idleEditor = (): EditorState => ({
  blockId: null,
  position: 0,
  runs: [],
  savedRuns: [],
  baseRevisionId: "",
  role: "paragraph",
  start: 0,
  end: 0,
  marks: [],
  link: null,
  linking: false,
  linkDraft: "",
  saving: false,
  failure: null,
  timer: 0,
  stepped: 0,
  past: [],
  future: [],
  paint: 0,
  leaving: false,
});

export const BlockEditorView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<DocumentState>({
    document: null,
    retired: [],
    retiredOpen: false,
    discardedOpen: false,
    proposals: null,
    proposalsOpen: false,
    status: "loading",
    missing: false,
    notice: null,
    changes: null,
    saveState: null,
    activeBlockId: null,
    loaded: 0,
    proposedSeen: bridge.proposed.seq,
    revealSeen: bridge.reveal.seq,
  });
  /** The proposals an edit is accepting and handing over, and the pending
   * staging of an arrow-moved proposal's place. BO_0233_007 BO_0233_014 */
  const proposalEdit = useStore({
    settling: [] as string[],
    timer: 0,
    /** Which proposals read is the newest, and how many local changes to
     * the list this editor has made: a read that is overtaken by either is
     * older than what the reader sees, and is dropped. BO_0233_013 */
    reads: 0,
    changes: 0,
    /** What this editor has answered, and of that what it accepted: a read
     * that began before an answer never draws it again, and an accepted
     * proposal is never accepted twice. BO_0233_013 */
    answered: [] as string[],
    accepted: [] as string[],
  });
  const editor = useStore<EditorState>(idleEditor());
  /** The view's own element. The load task reaches the page through it rather
   * than through the global `document`, which a render harness does not
   * install — so the editor can be pressed in one. BO_0227_006 */
  const root = useSignal<HTMLElement>();
  const documentId = tab.itemId;
  const remembered = tab.selection;

  /**
   * Reports the save state for this tab and keeps the panel's copy of it.
   *
   * One channel, still: the header renders what the shell was told and the
   * panel states the same value beside the document's other facts. Two
   * surfaces read one report rather than each deciding for itself.
   */
  const report$ = $(async (next: SaveState) => {
    state.saveState = next;
    await bridge.setSaveState$(tab.id, next);
  });

  const reloadChanges$ = $(async () => {
    if (documentId === null) return;
    const outcome = await fetchChanges(documentId);
    state.changes = outcome.outcome === "success" ? outcome.result : null;
  });

  const reload$ = $(async () => {
    if (documentId === null) {
      state.status = "failed";
      state.notice = "This tab names no document.";
      return;
    }
    const outcome = await fetchDocument(documentId);
    if (outcome.outcome !== "success") {
      state.status = "failed";
      // A stored tab is restored on load, and the document it names may have
      // been deleted since. The tab keeps its place and says so, rather than
      // closing itself or refusing to open: a tab the reader left open never
      // disappears without saying why.
      state.missing = outcome.outcome === "noResult";
      state.notice = state.missing
        ? "This document has been deleted. There is nothing here to edit."
        : describeOutcome(outcome);
      return;
    }
    state.document = outcome.result;
    state.status = "ready";
    state.missing = false;
    state.loaded += 1;
    if (
      state.activeBlockId !== null &&
      !outcome.result.blocks.some(
        (block) => block.blockId === state.activeBlockId,
      )
    ) {
      state.activeBlockId = null;
    }
  });

  const reloadRetired$ = $(async () => {
    if (documentId === null) return;
    const outcome = await fetchRetired(documentId);
    if (outcome.outcome === "success") state.retired = [...outcome.result];
  });

  /**
   * Reads the proposals again. The read is slow — every open group — and
   * several can be under way at once, so one that an answer, a move or a
   * newer read has overtaken is dropped rather than drawn: a read begun
   * before an answer lists the answered proposal, and drawing it again drew a
   * copy that took the reader's next keystroke and asked for a second
   * acceptance CCGW refused. BO_0233_013
   *
   * A read that lands while an edit hands a proposal over is dropped too: it
   * no longer lists the accepted proposal, and taking it away then would take
   * the text the reader is typing in before the block is there to take the
   * caret. BO_0233_014
   */
  const reloadProposals$ = $(async () => {
    if (documentId === null) return;
    // A read a local change overtook is read again, a few times at most; a
    // QRL cannot call itself, so the retry is a loop.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const read = ++proposalEdit.reads;
      const changes = proposalEdit.changes;
      const outcome = await fetchProposals(documentId);
      if (outcome.outcome !== "success" || read !== proposalEdit.reads) return;
      if (changes === proposalEdit.changes && proposalEdit.settling.length === 0) {
        state.proposals = withoutItems(outcome.result, proposalEdit.answered);
        return;
      }
    }
  });

  /**
   * Writes the active block when what it holds differs from what the graph
   * holds. Equal normalized content is not written again, so a pause that
   * changed nothing produces no revision.
   *
   * The write answers with the revision it established, which becomes the base
   * for the next one. Nothing is read back, so a save never re-renders the
   * document under the caret.
   */
  const save$ = $(async (keepalive = false): Promise<boolean> => {
    if (editor.timer !== 0) {
      clearTimeout(editor.timer);
      editor.timer = 0;
    }
    const blockId = editor.blockId;
    if (documentId === null || blockId === null) return true;
    if (sameRuns(editor.runs, editor.savedRuns)) {
      editor.failure = null;
      await report$("saved");
      return true;
    }
    editor.saving = true;
    await report$("saving");
    const outcome = await sendCommand(
      documentId,
      {
        command: "revise",
        blockId,
        baseRevisionId: editor.baseRevisionId,
        runs: editor.runs,
        role: editor.role,
      },
      keepalive,
    );
    editor.saving = false;
    if (outcome.outcome !== "success") {
      // A refused save leaves the graph without what was typed, so the tab is
      // unsaved. Which block it happened to is the block's to say, below.
      editor.failure = describeOutcome(outcome);
      await report$("unsaved");
      return false;
    }
    editor.failure = null;
    editor.savedRuns = [...editor.runs];
    editor.baseRevisionId = outcome.result.revisionId;
    await report$("saved");
    return true;
  });

  const scheduleSave$ = $(async () => {
    if (editor.timer !== 0) clearTimeout(editor.timer);
    // A number wherever it runs: a store holds it, and a timer object is not
    // one a store can keep.
    editor.timer = Number(setTimeout(() => void save$(), SAVE_PAUSE_MS));
    await report$("unsaved");
  });

  /** Reads the live selection into the editor state, so the toolbar shows what
   * the caret is actually in. */
  const syncSelection$ = $((element: HTMLElement) => {
    const range = selectionIn(element);
    if (range === null) return;
    editor.start = range.start;
    editor.end = range.end;
    editor.marks = marksAt(editor.runs, range.start, range.end);
    editor.link = linkAt(editor.runs, range.start, range.end);
  });

  const remember$ = $(() => {
    editor.past = [
      ...editor.past.slice(-49),
      { runs: [...editor.runs], start: editor.start, end: editor.end },
    ];
    editor.future = [];
    editor.stepped = Date.now();
  });

  /** Replaces the model and repaints, keeping the caret where the caller asks. */
  const apply$ = $((runs: Run[], start: number, end: number) => {
    editor.runs = runs;
    editor.start = start;
    editor.end = end;
    editor.marks = marksAt(runs, start, end);
    editor.link = linkAt(runs, start, end);
    editor.paint += 1;
  });

  /** The block a structural command should reach for, read fresh, because the
   * command that just ran changed the revision this one must be based on. */
  const freshBlock$ = $(
    async (blockId: string): Promise<BlockView | undefined> => {
      if (documentId === null) return undefined;
      const outcome = await fetchDocument(documentId);
      if (outcome.outcome !== "success") return undefined;
      state.document = outcome.result;
      return outcome.result.blocks.find((block) => block.blockId === blockId);
    },
  );

  const activate$ = $(
    async (blockId: string, offset: number | "end", until?: number) => {
      if (editor.blockId !== null && editor.blockId !== blockId) {
        if (!(await save$())) return;
      }
      // Read the block as the graph now holds it. The document in hand may
      // predate this session's own saves, and activating from a stale revision
      // would show text that is no longer there and conflict on the next write.
      const block =
        (await freshBlock$(blockId)) ??
        state.document?.blocks.find(
          (candidate) => candidate.blockId === blockId,
        );
      if (block === undefined || !isText(block)) return;
      Object.assign(editor, idleEditor());
      editor.blockId = blockId;
      editor.position =
        (state.document?.blocks.findIndex(
          (candidate) => candidate.blockId === blockId,
        ) ?? -1) + 1;
      editor.runs = [...block.runs];
      editor.savedRuns = [...block.runs];
      editor.baseRevisionId = block.revisionId;
      editor.role = block.role;
      // The offsets were read from the reading element, which showed the
      // revision the document had in hand. A fresher block may be shorter, so
      // they are clamped rather than trusted.
      const length = runsLength(block.runs);
      const at =
        offset === "end" ? length : Math.min(Math.max(0, offset), length);
      const to =
        until === undefined ? at : Math.min(Math.max(0, until), length);
      editor.start = at;
      editor.end = to;
      editor.marks = marksAt(block.runs, at, to);
      editor.paint += 1;
      state.activeBlockId = blockId;
      // The bar overlays the top of the surface, so a block under it would be
      // activated out of sight. `nearest` with the row's scroll margin scrolls
      // only far enough to clear the bar, and not at all when the block is
      // already clear of it. Activation changes no geometry, so the row is
      // already where it will be.
      // Through the view's own element, as the load task reaches the page
      // (`BO_0227_006`), so the render harness can activate a block too.
      root.value
        ?.querySelector(`[data-block-id="${blockId}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
      bridge.inspector.text = `${ROLE_LABEL[block.role]} block`;
      await bridge.setSelection$(blockId);
    },
  );

  const deactivate$ = $(async () => {
    if (editor.blockId === null || editor.leaving) return;
    // Set before the first await, so a second call in the same gesture sees it.
    editor.leaving = true;
    const blockId = editor.blockId;
    const saved = await save$();
    // The reason a refusal gave was named on the block, and the block is about
    // to go. It moves to the view's notice, which is readable with no block
    // active, so the tab's unsaved state says why and where rather than only
    // that the graph is behind. Leaving is never blocked: a reader who cannot
    // leave a conflicted block has no way out at all.
    if (!saved && editor.failure !== null) state.notice = editor.failure;
    // The document in hand predates this block's own saves, and it is about to
    // become the reading presentation: read it back before showing it, or the
    // text just typed disappears until the next reload.
    //
    // Only when it is actually behind, though. A save writes without reading
    // back, so what the document holds is stale exactly when this session wrote
    // something — which the revision says: the editor's base has moved past the
    // one the document was read at. A block nobody changed leaves them equal,
    // the presentation already matches the graph, and the round trip and its
    // repaint would buy nothing. A refusal re-reads too, because the graph then
    // holds someone else's text and the reader is about to be shown the block.
    const held = state.document?.blocks.find(
      (block) => block.blockId === blockId,
    );
    if (
      !saved ||
      held === undefined ||
      held.revisionId !== editor.baseRevisionId
    )
      await reload$();
    Object.assign(editor, idleEditor());
    state.activeBlockId = null;
    bridge.inspector.text = null;
    await bridge.setSelection$(null);
    editor.leaving = false;
  });

  // Command mode's marking session: the mode, the marks, their record and
  // the dock's toggle. The rows read it from the context. BO_0227_006
  const marking = useMarking({
    documentId,
    surface: state,
    leaveEditing$: deactivate$,
  });
  useContextProvider(MarkingContext, marking);

  // A block's standing: every path that changes one — the swipe, the bar,
  // the chord, Reopen — writes through here. BO_0227_011
  const standing = useStanding({
    documentId,
    surface: state,
    editor,
    marking,
    save$,
    deactivate$,
    reload$,
  });
  useContextProvider(StandingContext, standing);

  // Passages on the page: the selection in command mode and where each
  // passage's number is drawn. BO_0227_009
  const passages = usePassages({ root, surface: state, marking: marking.store });
  useContextProvider(PassagesContext, passages);

  /**
   * Runs one structural command, then reads the document back. A refused
   * command leaves the document exactly as it was, so the read is what shows
   * whether anything happened.
   */
  const structural$ = $(
    async (
      command: Record<string, unknown>,
      focus: { blockId: string; offset: number | "end" } | null,
    ): Promise<boolean> => {
      if (documentId === null) return false;
      if (!(await save$())) return false;
      const outcome = await sendCommand(documentId, command);
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return false;
      }
      state.notice = null;
      Object.assign(editor, idleEditor());
      state.activeBlockId = null;
      await reload$();
      if (focus !== null) await activate$(focus.blockId, focus.offset);
      if (state.retiredOpen) await reloadRetired$();
      return true;
    },
  );

  const insert$ = $(async (kind: "text" | "divider", afterBlockId: string) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block:
        kind === "divider" ? { kind: "divider" } : { kind: "text", runs: [] },
      placement: { after: afterBlockId },
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    const created = outcome.result.blockId;
    Object.assign(editor, idleEditor());
    state.activeBlockId = null;
    await reload$();
    if (kind === "text") await activate$(created, 0);
  });

  /**
   * Appends a paragraph at the end of the document and activates it.
   *
   * `at: "end"` rather than `after: <block>`, so this is also the way into a
   * document that has no block to name.
   */
  const appendBlock$ = $(async () => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block: { kind: "text", runs: [] },
      placement: { at: "end" },
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    const created = outcome.result.blockId;
    Object.assign(editor, idleEditor());
    state.activeBlockId = null;
    await reload$();
    await activate$(created, 0);
  });

  /**
   * The gesture that turns a blank page into writing.
   *
   * A trailing empty paragraph is activated rather than followed by another, so
   * clicking the empty area repeatedly cannot stack blocks that say nothing.
   */
  const startWriting$ = $(async () => {
    // The blank page and the area below the last block are ways into writing,
    // and command mode is not for writing. The surface is for pointing there,
    // so a click on either does nothing rather than appending a block the
    // reader cannot then mark.
    if (marking.store.marking.mode === "command") return;
    // They are ways in from reading. With a block active the press means leave,
    // like every other press outside the block, and writing here takes a second
    // press. This surface owns that gesture rather than sharing it with the
    // listener, so one press gets one answer.
    if (state.activeBlockId !== null) {
      await deactivate$();
      return;
    }
    const blocks = state.document?.blocks ?? [];
    const last = blocks[blocks.length - 1];
    if (last !== undefined && isText(last) && runsLength(last.runs) === 0) {
      await activate$(last.blockId, 0);
      return;
    }
    await appendBlock$();
  });

  const setRole$ = $(async (role: TextRole) => {
    const blockId = editor.blockId;
    if (documentId === null || blockId === null) return;
    const at = editor.start;
    const outcome = await sendCommand(documentId, {
      command: "revise",
      blockId,
      baseRevisionId: editor.baseRevisionId,
      runs: editor.runs,
      role,
    });
    if (outcome.outcome !== "success") {
      editor.failure = describeOutcome(outcome);
      return;
    }
    editor.failure = null;
    Object.assign(editor, idleEditor());
    state.activeBlockId = null;
    await reload$();
    await activate$(blockId, at);
  });

  const toggleMark$ = $(async (mark: Mark) => {
    if (editor.blockId === null) return;
    await remember$();
    const on = !editor.marks.includes(mark);
    await apply$(
      applyMark(editor.runs, editor.start, editor.end, mark, on),
      editor.start,
      editor.end,
    );
    await scheduleSave$();
  });

  const commitLink$ = $(async () => {
    if (editor.blockId === null) return;
    const href = editor.linkDraft.trim();
    await remember$();
    await apply$(
      applyLink(
        editor.runs,
        editor.start,
        editor.end,
        href === "" ? null : href,
      ),
      editor.start,
      editor.end,
    );
    editor.linking = false;
    editor.linkDraft = "";
    await scheduleSave$();
  });

  const undo$ = $(async () => {
    const previous = editor.past[editor.past.length - 1];
    if (previous === undefined) return;
    editor.past = editor.past.slice(0, -1);
    editor.future = [
      ...editor.future,
      { runs: [...editor.runs], start: editor.start, end: editor.end },
    ];
    await apply$([...previous.runs], previous.start, previous.end);
    await scheduleSave$();
  });

  const redo$ = $(async () => {
    const next = editor.future[editor.future.length - 1];
    if (next === undefined) return;
    editor.future = editor.future.slice(0, -1);
    editor.past = [
      ...editor.past,
      { runs: [...editor.runs], start: editor.start, end: editor.end },
    ];
    await apply$([...next.runs], next.start, next.end);
    await scheduleSave$();
  });

  const editRuns$ = $(async (runs: Run[], start: number, end: number) => {
    await remember$();
    await apply$(runs, start, end);
    await scheduleSave$();
  });

  /** What the browser left in the element after a keystroke, read back into
   * runs. The model, not the DOM, is what gets saved. */
  const input$ = $(async (element: HTMLElement) => {
    // Typing enters the history a word at a time rather than a keystroke at a
    // time, so one undo gives back something a person recognises.
    if (Date.now() - editor.stepped > HISTORY_STEP_MS) await remember$();
    const range = selectionIn(element);
    editor.runs = runsFrom(element);
    if (range !== null) {
      editor.start = range.start;
      editor.end = range.end;
      editor.marks = marksAt(editor.runs, range.start, range.end);
    }
    await scheduleSave$();
  });

  const split$ = $(async (at: number) => {
    const blockId = editor.blockId;
    if (documentId === null || blockId === null) return;
    if (!(await save$())) return;
    const current = await freshBlock$(blockId);
    const outcome = await sendCommand(documentId, {
      command: "split",
      blockId,
      baseRevisionId: current?.revisionId ?? editor.baseRevisionId,
      at,
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    const tail = outcome.result.tailBlockId;
    Object.assign(editor, idleEditor());
    state.activeBlockId = null;
    await reload$();
    if (tail !== undefined) await activate$(tail, 0);
  });

  /**
   * Merges across a block boundary. The caret lands where the join happened,
   * which is the end of what the surviving block held before it absorbed the
   * other one.
   */
  const merge$ = $(async (direction: "back" | "forward") => {
    const blockId = editor.blockId;
    const blocks = state.document?.blocks ?? [];
    const at = blocks.findIndex((block) => block.blockId === blockId);
    const self = blocks[at];
    const other = blocks[direction === "back" ? at - 1 : at + 1];
    if (self === undefined || other === undefined) return;
    if (!isText(self) || !isText(other)) return;
    const into = direction === "back" ? other : self;
    const from = direction === "back" ? self : other;
    if (!(await save$())) return;
    const fresh = await freshBlock$(into.blockId);
    const survivor = fresh !== undefined && isText(fresh) ? fresh : into;
    await structural$(
      {
        command: "merge",
        intoBlockId: into.blockId,
        intoBaseRevisionId: survivor.revisionId,
        blockId: from.blockId,
      },
      { blockId: into.blockId, offset: runsLength(survivor.runs) },
    );
  });

  /** Moves the caret across a block boundary, skipping blocks that take no
   * caret so an arrow key never strands the reader on a divider. */
  const step$ = $(async (direction: -1 | 1) => {
    const blocks = state.document?.blocks ?? [];
    const at = blocks.findIndex((block) => block.blockId === editor.blockId);
    for (
      let next = at + direction;
      next >= 0 && next < blocks.length;
      next += direction
    ) {
      const candidate = blocks[next];
      if (candidate !== undefined && isText(candidate)) {
        await activate$(candidate.blockId, direction === -1 ? "end" : 0);
        return;
      }
    }
  });

  const move$ = $(async (blockId: string, by: -1 | 1) => {
    // As with the drag: the caret is read before the move, because the move
    // clears the block and re-reads the document before it can be given back.
    const caret = editor.blockId === blockId ? editor.start : null;
    if (!(await save$())) return;
    // The revision is read fresh. This session's own save of this block may be
    // newer than the document in hand, and a move naming a stale base is
    // refused as a conflict — silently leaving the order unchanged.
    const self = await freshBlock$(blockId);
    const blocks = state.document?.blocks ?? [];
    const index = blocks.findIndex((block) => block.blockId === blockId);
    const neighbour = blocks[index + by];
    if (self === undefined || neighbour === undefined) return;
    await structural$(
      {
        command: "move",
        blockId,
        baseRevisionId: self.revisionId,
        placement:
          by === -1
            ? { before: neighbour.blockId }
            : { after: neighbour.blockId },
      },
      caret === null ? null : { blockId, offset: caret },
    );
  });

  const retire$ = $(async (blockId: string) => {
    await structural$({ command: "retire", blockId }, null);
  });

  const restore$ = $(async (blockId: string) => {
    await structural$(
      { command: "restore", blockId, placement: { at: "end" } },
      null,
    );
    await reloadRetired$();
  });

  const toggleRetired$ = $(async (on: boolean) => {
    state.retiredOpen = on;
    if (state.retiredOpen) await reloadRetired$();
  });

  const toggleDiscarded$ = $((on: boolean) => {
    state.discardedOpen = on;
  });

  const toggleProposals$ = $(async (on: boolean) => {
    state.proposalsOpen = on;
    if (state.proposalsOpen) await reloadProposals$();
  });

  /** Takes an answered proposal out of the list at once, before the reread
   * that confirms it. Defined before every QRL that calls it: the optimizer
   * captures only what is declared above a `$`, and one declared below is a
   * free name there, undefined when the answer runs. BO_0233_012 BO_0233_014 */
  const dropProposal$ = $((itemId: string) => {
    proposalEdit.changes += 1;
    if (!proposalEdit.answered.includes(itemId)) {
      proposalEdit.answered = [...proposalEdit.answered, itemId];
    }
    const proposals = state.proposals;
    if (proposals === null) return;
    state.proposals = withoutItems(proposals, [itemId]);
  });

  /**
   * Answers one proposed change. An accepted item is truth from that moment,
   * so the document is read again: what the reader sees after answering is
   * what the graph holds, not what this surface guessed it would hold.
   */
  const answerProposal$ = $(
    async (itemId: string, answer: "accepted" | "rejected") => {
      if (documentId === null) return;
      // An edit is accepting this one, or has: typing into a proposal and
      // then pressing an answer is one decision, and the edit made it.
      if (proposalEdit.settling.includes(itemId) || proposalEdit.accepted.includes(itemId)) {
        if (answer === "rejected") state.notice = "Your edit to this proposal has already accepted it.";
        return;
      }
      const outcome = await answerProposal(documentId, itemId, answer);
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
      } else {
        if (answer === "accepted") proposalEdit.accepted = [...proposalEdit.accepted, itemId];
        await dropProposal$(itemId);
      }
      await reload$();
      // Every open group is read again to list the proposals, which is the
      // slow read; the answered one has already left the list, so the reader
      // is not kept waiting on the rest. BO_0233_012
      void reloadProposals$();
      if (state.retiredOpen) void reloadRetired$();
      void reloadChanges$();
    },
  );

  const acceptGroup$ = $(async (groupId: string) => {
    const group = state.proposals?.groups.find(
      (candidate) => candidate.groupId === groupId,
    );
    // One item at a time over the same operation, in the group's own order.
    // `Accept all` is the shortcut, never an acceptance of its own.
    for (const item of group?.items ?? []) {
      await answerProposal$(item.itemId, "accepted");
    }
  });

  /** Writes what was typed into an accepted proposal onto its block, read
   * fresh, since the acceptance just established the revision this write is
   * based on. BO_0233_014 */
  const reviseAccepted$ = $(async (blockId: string, runs: Run[]) => {
    if (documentId === null) return;
    const block = await freshBlock$(blockId);
    if (block === undefined || !isText(block) || sameRuns(block.runs, runs)) return;
    const outcome = await sendCommand(documentId, {
      command: "revise",
      blockId,
      baseRevisionId: block.revisionId,
      runs,
      role: block.role,
    });
    if (outcome.outcome !== "success") {
      state.notice = `The proposal was accepted, but what you typed into it was not saved: ${describeOutcome(outcome)}`;
      return;
    }
    await reload$();
  });

  /**
   * Accepts a proposal the reader typed into and makes what they typed the
   * block's own, once the typing has paused or the reader has left the text —
   * never under a typing hand, since the proposal then turns into the block,
   * with the block's look. Answers whether it was accepted; a refusal says why.
   *
   * What was typed is read at the hand-over (`typed$`), so keystrokes typed
   * while the acceptance is under way are kept. A reader still in the text is
   * given the block, activated where their caret is, before the proposal goes,
   * so the caret passes from one to the other and every keystroke has a place
   * to land; the edit is then made there and saved as any edit is. A reader
   * who has left has what they typed written to the block, and keeps the caret
   * where they took it. BO_0233_006 BO_0233_012 BO_0233_014
   */
  const settleProposal$ = $(
    async (itemId: string, blockId: string, typed$: QRL<() => TypedProposal>): Promise<boolean> => {
      if (documentId === null) return false;
      // Rejected from its icons while the typing waited: the typing went with
      // it, and there is nothing to accept.
      if (proposalEdit.answered.includes(itemId) && !proposalEdit.accepted.includes(itemId)) return false;
      proposalEdit.settling = [...proposalEdit.settling, itemId];
      try {
        // Accepted already, from its icons or by this edit: CCGW is not asked
        // again for a decision it has made.
        if (!proposalEdit.accepted.includes(itemId)) {
          // An edit's acceptance, which takes a rewrite over what its block
          // did since. CA_0042_003
          const outcome = await answerProposal(documentId, itemId, "accepted", true);
          if (outcome.outcome !== "success") {
            state.notice = `The proposal was not accepted, so the edit was not made: ${describeOutcome(outcome)}`;
            return false;
          }
          proposalEdit.accepted = [...proposalEdit.accepted, itemId];
        }
        const at = await typed$();
        // A reader who went on into the block itself is there already.
        if (at.focused || editor.blockId === blockId) {
          await activate$(blockId, at.start, at.end);
          const typed = await typed$();
          await dropProposal$(itemId);
          if (editor.blockId === blockId && !sameRuns(editor.runs, typed.runs)) {
            await editRuns$(typed.runs, typed.start, typed.end);
          }
        } else {
          await dropProposal$(itemId);
          await reviseAccepted$(blockId, at.runs);
        }
      } finally {
        proposalEdit.settling = proposalEdit.settling.filter((id) => id !== itemId);
      }
      void reloadProposals$();
      void reloadChanges$();
      return true;
    },
  );

  /** Drags a proposal by its face, as a block is dragged by its grip. BO_0233_007 */
  const startProposalDrag$ = $(
    (itemId: string, preview: string, event: PointerEvent) =>
      bridge.startDrag$(
        {
          itemId: `proposal:${itemId}`,
          kind: "ui.shell:document",
          source: "workspace",
          operations: ["move"],
          preview,
        },
        event,
      ),
  );

  /** Draws a proposal at an order key at once, before the staging lands. */
  const drawProposalAt$ = $((itemId: string, order: string) => {
    proposalEdit.changes += 1;
    const proposals = state.proposals;
    if (proposals === null) return;
    state.proposals = {
      ...proposals,
      groups: proposals.groups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.itemId === itemId && item.block !== null
            ? { ...item, block: { ...item.block, order } }
            : item,
        ),
      })),
    };
  });

  /**
   * Moves a proposal to a place without answering it: drawn there at once,
   * and staged into its own group, so the place survives a reload and every
   * device. BO_0233_007
   */
  const placeProposal$ = $(async (itemId: string, placement: ProposalPlacement) => {
    if (documentId === null) return;
    const outcome = await placeProposal(documentId, itemId, placement);
    if (outcome.outcome !== "success") state.notice = describeOutcome(outcome);
    await reloadProposals$();
  });

  /**
   * One arrow press on a proposal's face. It is drawn in its new place at
   * once and staged once the presses pause: the kernel refuses a block
   * restaged within its floor, and a reader stepping a proposal down a page
   * means the place they stop at. BO_0233_007
   */
  const stepProposal$ = $((itemId: string, direction: -1 | 1) => {
    const doc = state.document;
    const item = state.proposals?.groups
      .flatMap((group) => group.items)
      .find((candidate) => candidate.itemId === itemId);
    if (doc === null || item === undefined || item.block === null) return;
    const placed = placedOf(doc.blocks);
    const placement = stepPlacement(item.block.order, placed, item.blockId, direction);
    if (placement === null) return;
    void drawProposalAt$(itemId, localOrder(placement, placed, item.blockId));
    if (proposalEdit.timer !== 0) clearTimeout(proposalEdit.timer);
    proposalEdit.timer = Number(
      setTimeout(() => {
        proposalEdit.timer = 0;
        void placeProposal$(itemId, placement);
      }, PROPOSAL_STEP_PAUSE_MS),
    );
  });

  /**
   * Deletes the document.
   *
   * Pending input is dropped rather than flushed. The unmount flush exists so
   * a tab switch loses nothing typed; flushing into a document being archived
   * in the same breath would write a revision whose only purpose is to be
   * buried. Deleting what was never saved reaches the same outcome as deleting
   * what was, which is why nothing warns about it.
   */
  const deleteDocument$ = $(async () => {
    const doc = state.document;
    if (documentId === null || doc === null) return;
    if (editor.timer !== 0) {
      clearTimeout(editor.timer);
      editor.timer = 0;
    }
    Object.assign(editor, idleEditor());
    const outcome = await sendCommand(documentId, {
      command: "delete",
      baseRevisionId: doc.revisionId,
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    // Every tab in this workspace showing it closes, so the reader is not left
    // editing something that no longer exists.
    await bridge.targetGone$(documentId);
  });

  const startBlockDrag$ = $(
    (blockId: string, preview: string, event: PointerEvent) => {
      const payload: DragPayload = {
        itemId: blockId,
        kind: "ui.shell:document",
        source: "workspace",
        operations: ["move"],
        preview,
      };
      return bridge.startDrag$(payload, event);
    },
  );

  /**
   * A drop lands the dragged block before the block it was dropped on, or at
   * the end. It compiles into the same move the keyboard and the action menu
   * issue, so the two paths cannot drift apart.
   */
  const dropOn$ = $(async (blockId: string, target: string) => {
    if (target === blockId) return;
    // Read before the move is sent: the editor is idled and the block cleared
    // before the document is re-read, so the caret has to be carried across.
    const caret = editor.blockId === blockId ? editor.start : null;
    if (!(await save$())) return;
    const moving = await freshBlock$(blockId);
    if (moving === undefined) return;
    await structural$(
      {
        command: "move",
        blockId,
        baseRevisionId: moving.revisionId,
        placement: target === "end" ? { at: "end" } : { before: target },
      },
      caret === null ? null : { blockId, offset: caret },
    );
  });

  /**
   * Keeps the panel's counts and last-changed time current.
   *
   * Its own task rather than a step inside the read or the save: both of those
   * are on the path deactivation takes, and a panel-only fetch there delays the
   * write that records which block the tab was left on. Nothing the reader does
   * waits on this.
   *
   * The proposals are read here too, and not only when the toggle is turned
   * on, because the panel states how many stand unanswered whether or not the
   * reader has asked to see them.
   */
  useTask$(async ({ track }) => {
    track(() => state.loaded);
    track(() => state.saveState);
    if (state.status !== "ready") return;
    // Mid-save there is nothing new to count yet, and the save that follows
    // will bring this task back.
    if (state.saveState === "saving") return;
    await reloadChanges$();
    await reloadProposals$();
  });

  /**
   * The document's own facts and the two operations that act on it as a whole,
   * contributed to the inspector.
   *
   * Typed facts and named actions, never rendered content: the shell renders
   * them in its own idiom, so every view's panel reads as the same drawer.
   * Writing them from a task is what keeps the document's own render out of
   * it; the shell re-renders the drawer alone.
   */
  /**
   * A change document's status, chosen in the inspector: one write onto the
   * document node with the base compared first, so a stale editor is
   * answered as a conflict and reads the document again rather than
   * overwriting; the section listing the change reads again. BO_0222_007
   */
  const setStatus$ = $(async (value: string) => {
    const document = state.document;
    if (documentId === null || document === null || document.change === undefined) return;
    if (!isChangeStatus(value) || value === document.changeStatus) return;
    const outcome = await sendStatus(documentId, document.revisionId, value);
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      if (outcome.outcome === "conflict") await reload$();
      return;
    }
    state.notice = null;
    state.document = {
      ...document,
      changeStatus: value,
      revisionId: outcome.result.revisionId,
    };
    await bridge.targetChanged$();
  });

  useTask$(({ track }) => {
    track(() => state.document?.title);
    track(() => state.document?.changeStatus);
    track(() => state.saveState);
    track(() => state.changes?.changeCount);
    track(() => state.changes?.lastWrittenAt);
    track(() => state.retiredOpen);
    track(() => state.discardedOpen);
    track(() => state.proposalsOpen);
    track(() => state.proposals?.unanswered);
    track(() => state.status);

    if (state.status !== "ready" || state.document === null) {
      bridge.inspector.facts = [];
      bridge.inspector.actions = [];
      return;
    }

    const facts: InspectorFact[] = [];
    // A change document says which extension it is a change of, before its
    // own facts, and carries its status as the first action. BO_0222_007
    if (state.document.change !== undefined) {
      facts.push({
        kind: "text",
        label: "Change of",
        value: state.document.change,
      });
    }
    if (state.saveState !== null) {
      facts.push({
        kind: "saveState",
        label: "State",
        value: state.saveState,
      });
    }
    if (state.changes !== null) {
      if (state.changes.lastWrittenAt !== null) {
        facts.push({
          kind: "time",
          label: "Last updated",
          value: state.changes.lastWrittenAt,
        });
      }
      facts.push({
        kind: "count",
        label: "Revisions",
        value: state.changes.changeCount,
      });
    }
    // Stated whether or not the toggle is on. The toggle hides the items; it
    // must not hide that there are some.
    if ((state.proposals?.unanswered ?? 0) > 0) {
      facts.push({
        kind: "count",
        label: "Proposed changes",
        value: state.proposals?.unanswered ?? 0,
      });
    }

    const actions: ViewAction[] = [
      ...(state.document.change !== undefined
        ? [
            {
              kind: "choice" as const,
              id: "change-status",
              label: "Status",
              value: state.document.changeStatus ?? "idea",
              options: CHANGE_STATUSES.map((status) => ({
                value: status,
                label: status,
                icon: STATUS_ICONS[status],
              })),
              run$: setStatus$,
            },
          ]
        : []),
      {
        kind: "toggle",
        id: "retired-blocks",
        label: "Show retired blocks",
        on: state.retiredOpen,
        run$: toggleRetired$,
      },
      {
        kind: "toggle",
        id: "discarded-blocks",
        label: "Show discarded blocks",
        on: state.discardedOpen,
        run$: toggleDiscarded$,
      },
      {
        kind: "toggle",
        id: "proposed-changes",
        label: "Show proposed changes",
        on: state.proposalsOpen,
        run$: toggleProposals$,
      },
      {
        kind: "button",
        id: "delete-document",
        label: "Delete",
        destructive: true,
        run$: $(() => {
          const current = state.document;
          if (current === null) return;
          // The title is read as the control is pressed rather than as the
          // contribution is built, so the question names what the document is
          // called now.
          void bridge.raiseMessage$({
            headline: `Delete \u201c${current.title}\u201d?`,
            body: "This removes the document from the product and cannot be undone.",
            answers: [
              { id: "cancel", label: "Cancel" },
              {
                id: "delete",
                label: "Delete",
                destructive: true,
                run$: deleteDocument$,
              },
            ],
          });
        }),
      },
    ];

    bridge.inspector.facts = facts;
    bridge.inspector.actions = actions;
  });

  useTask$(async ({ track }) => {
    track(() => bridge.drag.drop?.seq);
    const drop = bridge.drag.drop;
    if (drop == null) return;
    if (drop.operation !== "move" || !drop.overId.startsWith("block:")) return;
    const target = drop.overId.slice("block:".length);
    // A proposal dropped is placed, not accepted. BO_0233_007
    if (drop.payload.itemId.startsWith("proposal:")) {
      const itemId = drop.payload.itemId.slice("proposal:".length);
      const doc = state.document;
      const item = state.proposals?.groups
        .flatMap((group) => group.items)
        .find((candidate) => candidate.itemId === itemId);
      if (doc === null || item === undefined) return;
      const placement: ProposalPlacement = target === "end" ? { at: "end" } : { before: target };
      await drawProposalAt$(itemId, localOrder(placement, placedOf(doc.blocks), item.blockId));
      await placeProposal$(itemId, placement);
      return;
    }
    await dropOn$(drop.payload.itemId, target);
  });

  // The first read, the block a returning tab was left on, and the scroll
  // position it was left at.
  useVisibleTask$(async ({ cleanup }) => {
    // Read before anything is awaited: this is the fact that a later mount of
    // the same tab in the same page is a tab switch and not a page load.
    const returning = mountedTabs.has(tab.id);
    mountedTabs.add(tab.id);
    // The mode and its marks come back before the document does, so the read
    // that follows is what drops the references whose blocks have gone.
    await marking.recover$();
    await reload$();
    // A document as read is a document the graph holds. Reporting it is what
    // gives the tab a save state before anything is typed.
    if (state.document !== null) await report$("saved");
    if (remembered !== null) {
      if (returning && marking.store.marking.mode === "reading") {
        // A returning tab comes back to the block it was left in — unless it
        // was left in command mode, where no block is active.
        await activate$(remembered, "end");
      } else {
        // A reloaded page opens no editor. Which block is active is a live
        // fact about the tab, like its scroll position, so a page that opens no
        // editor says the tab has nothing selected rather than leaving a record
        // the next tab switch would act on. Which mode the surface is in is not
        // that kind of fact, and it has already been restored above.
        await bridge.setSelection$(null);
      }
    }
    const page = root.value?.ownerDocument;
    const frame = page?.defaultView;
    if (page === undefined || frame == null) return;
    const surface = page.querySelector<HTMLElement>("[data-block-surface]");
    const previous = scrollByTab.get(tab.id);
    if (surface !== null && previous !== undefined)
      surface.scrollTop = previous;
    const remember = () => {
      if (surface !== null) scrollByTab.set(tab.id, surface.scrollTop);
    };
    surface?.addEventListener("scroll", remember, { passive: true });
    // Leaving the page is the one exit a cleanup cannot cover, so the save is
    // asked for with `keepalive` while the document is still here.
    const leaving = () => void save$(true);
    frame.addEventListener("beforeunload", leaving);
    // The surface owns the mode, so the surface hears the key: one listener
    // decides, and no block arbitrates the same event for itself. It listens on
    // the document because the shortcut opens the mode from wherever the reader
    // is on the page, including a dock collapsed to its handle.
    const view = root.value ?? null;
    const keys = (event: KeyboardEvent) => {
      // A surface holding the floor has made this frame inert, and nothing
      // inert may act on a key. That is what keeps `Escape` the message's
      // first, and the ordering the shell's.
      if (view === null || view.closest("[inert]") !== null) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void marking.setMode$(marking.store.marking.mode !== "command");
        return;
      }
      // Reading has more local surfaces that answer `Escape` first — an active
      // block leaves editing — and in command mode there is none, because no
      // block is active in it.
      if (event.key === "Escape" && marking.store.marking.mode === "command") {
        event.preventDefault();
        void marking.setMode$(false);
      }
    };
    page.addEventListener("keydown", keys);

    /* A press that lands outside the active block ends the edit, and the same
     * surface hears it for the same reason it hears the key: one place decides,
     * and no block arbitrates its own press. The scope is the whole shell, so
     * reaching for the library, the tab strip, the inspector, or the dock
     * commits the block and closes it first. */
    const owns = (node: EventTarget | null): boolean => {
      const element = node instanceof Element ? node : null;
      const active = state.activeBlockId;
      if (element === null || active === null) return false;
      // The bar is not outside: every control in it acts on the active block.
      // Neither is the block's own row, grips included — they are its edges.
      return (
        element.closest("[data-block-toolbar]") !== null ||
        element.closest(`[data-block-id="${active}"]`) !== null
      );
    };
    // Where the gesture began. A selection dragged out past the block's edge
    // fires its click on an ancestor that is outside, and a reorder drag begins
    // on the block's own handle and is released anywhere; neither is leaving.
    let began = false;
    const pressed = (event: PointerEvent) => {
      began = owns(event.target);
    };
    // A click, not a pointer press. A touch scroll begins with a pointer down
    // on the reading surface and produces no click, so the browser already
    // separates the tap that means leave from the scroll that does not, and
    // ending on release leaves the browser's own focus placement intact.
    const away = (event: MouseEvent) => {
      if (view === null || view.closest("[inert]") !== null) return;
      if (state.activeBlockId === null) return;
      if (owns(event.target) || began) return;
      const element = event.target instanceof Element ? event.target : null;
      // Another block's reading row activates itself, and activating commits
      // the outgoing block on the way. One press, one decision: this does not
      // also leave, or the two would run against each other.
      if (element?.closest("[data-block-reading][role='button']") != null)
        return;
      // The blank page and the area below the last block answer their own
      // press, because each is a button whose handler already runs. Leaving is
      // what that handler does while a block is active; deciding it here too
      // would be two answers to one gesture.
      if (
        element?.closest("[data-document-append], [data-document-empty]") !=
        null
      )
        return;
      // Navigating away from the tab is not leaving the block. A tab retains
      // its selection, so a reader who goes to another tab and comes back finds
      // the block they were in — a finger kept in the page. The unmount flush
      // is what commits what was typed on the way out, so nothing is lost by
      // not deactivating here. Every other shell surface is outside.
      if (element?.closest(".tab-strip, .drawer--left") != null) return;
      // The title takes the caret the press was placing. Where it goes is read
      // now, before anything is re-read, because the repaint that follows
      // replaces the very text node the offset counts into.
      const title = element?.closest("[data-document-title]") ?? null;
      const at = title === null ? null : titleCaret(title);
      void deactivate$().then(() => {
        if (title === null || at === null) return;
        // After the repaint rather than before it: the offset was resolved
        // against the text the reader aimed at, and this is only where it is
        // put back.
        requestAnimationFrame(() => placeTitleCaret(at));
      });
    };
    page.addEventListener("pointerdown", pressed);
    page.addEventListener("click", away);
    // The disposition swipe, on touch. It commits through the one write the
    // bar and the chord use. BO_0227_011
    const uninstallSwipe = installSwipe(page, (blockId, to) => {
      void standing.setStanding$(blockId, to);
    });
    cleanup(() => {
      uninstallSwipe();
      remember();
      surface?.removeEventListener("scroll", remember);
      frame.removeEventListener("beforeunload", leaving);
      page.removeEventListener("keydown", keys);
      page.removeEventListener("pointerdown", pressed);
      page.removeEventListener("click", away);
      // A tab switch unmounts this view. Nothing typed may be lost to that.
      void save$(true);
    });
  });

  /**
   * Shows what a run aimed at this document proposed, when the run ends.
   *
   * The proposals are otherwise read after a load or a save, and a run staging
   * into the document already open changes neither — so the reader who asked
   * for a proposal was left looking at a document that did not show it. The
   * panel is opened too when anything stands unanswered: the reader asked for
   * the change, and a count moving in the inspector is not seeing it where it
   * would land. BO_0226_007
   */
  useVisibleTask$(async ({ track }) => {
    track(() => bridge.proposed.seq);
    const looked = proposedFor(bridge.proposed, state.proposedSeen, documentId);
    state.proposedSeen = looked.seen;
    if (!looked.act || state.status !== "ready") return;
    await reloadProposals$();
    if ((state.proposals?.unanswered ?? 0) > 0) state.proposalsOpen = true;
  });

  /**
   * Shows what a chip in the composer points at, when the reader presses it:
   * the block scrolled into view and emphasized, or the passage's words, in
   * either mode. Nothing here changes the document or the mode, and a second
   * press ends the first emphasis before starting its own. CA_0039_005
   */
  useVisibleTask$(({ track, cleanup }) => {
    track(() => bridge.reveal.seq);
    const looked = revealFor(bridge.reveal, state.revealSeen, documentId);
    state.revealSeen = looked.seen;
    const element = root.value;
    if (looked.target === null || element === undefined || state.document === null) return;
    const passage = revealedPassage(
      looked.target,
      marking.store.marking,
      state.document.blocks,
    );
    cleanup(showArea(element, looked.target, passage));
  });

  /**
   * Retitles the document. It answers whether the shown title is now the
   * stored one, so the caller can put back what the reader was looking at
   * when it is not.
   *
   * A blank title is not a rename: a document requires a title, and an entry
   * the library cannot name is worse than the one it had. Clearing the field
   * and leaving restores the current title rather than refusing at the
   * boundary.
   */
  const rename$ = $(async (value: string): Promise<boolean> => {
    const document = state.document;
    if (documentId === null || document === null) return false;
    const title = value.trim();
    if (title === "" || title === document.title) return false;

    const outcome = await sendRename(documentId, document.revisionId, title);
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return false;
    }
    state.notice = null;
    state.document = {
      ...document,
      title,
      revisionId: outcome.result.revisionId,
    };
    // The tab and the library entry name the same document, so the shell
    // carries the new name to both.
    await bridge.setTitle$(title);
    return true;
  });

  if (state.status === "failed") {
    return (
      <div
        class="view view--block-editor"
        data-view-body="block-editor"
        ref={root}
      >
        <p class="block-notice" role="alert" data-block-error>
          {state.notice ?? "This document could not be read."}
        </p>
      </div>
    );
  }

  const doc = state.document;
  // What the panel shows of the proposals, and which of them frame the block
  // they concern — a removal and a move, which are drawn with that block
  // rather than beside it. BO_0233_004
  const shownProposals = state.proposalsOpen
    ? (state.proposals?.groups.flatMap((group) => group.items) ?? [])
    : [];
  const framed = new Map<string, ProposedChange[]>();
  for (const item of shownProposals) {
    if (item.kind !== "remove" && item.kind !== "move") continue;
    if (!(doc?.blocks.some((block) => block.blockId === item.blockId) ?? false)) continue;
    framed.set(item.blockId, [...(framed.get(item.blockId) ?? []), item]);
  }
  const groupOf = (groupId: string) =>
    state.proposals?.groups.find((group) => group.groupId === groupId);
  const placed = placedOf(doc?.blocks ?? []);
  // A proposal that would move a block that stands is drawn where the block
  // stands (decided 2026-09-10), so where it would go is said in words.
  const destinationFor = (item: ProposedChange): string | null => {
    if (item.kind === "insert" || item.kind === "remove" || item.block === null) return null;
    const standing = doc?.blocks.find((block) => block.blockId === item.blockId);
    if (standing === undefined || standing.order === item.block.order) return null;
    return destinationOf(item.block.order, placed, item.blockId);
  };

  return (
    <div
      class="view view--block-editor"
      data-view-body="block-editor"
      data-editor-mode={marking.store.marking.mode}
      ref={root}
    >
      {/* Entering the mode is announced. The region is out of the flow, so
          what it says moves no document content, and it says nothing while
          reading rather than announcing a resting state nobody chose. */}
      <p class="visually-hidden" role="status">
        {marking.store.marking.mode === "command" ? "Command mode" : ""}
      </p>
      <StandingAnnouncement />
      <PassageAffordance surface={state} />
      {doc === null ? (
        <p data-block-loading>Reading the document…</p>
      ) : (
        <>
          <BlockToolbar
            surface={state}
            editor={editor}
            toggleMark$={toggleMark$}
            setRole$={setRole$}
            commitLink$={commitLink$}
            undo$={undo$}
            redo$={redo$}
            deactivate$={deactivate$}
            insert$={insert$}
            retire$={retire$}
          />
          {state.notice !== null && (
            <p class="block-notice" role="alert" data-block-error>
              {state.notice}
            </p>
          )}
          <div class="block-surface" data-block-surface>
            <span id="document-title-label" class="visually-hidden">
              Document title
            </span>
            <h2 class="document-title">
              <span
                class="document-title__text"
                data-document-title
                role="textbox"
                aria-labelledby="document-title-label"
                contentEditable="true"
                spellcheck={false}
                onPaste$={(event: ClipboardEvent, element: HTMLElement) => {
                  // A title is text. Letting the clipboard's markup land and
                  // relying on `textContent` to flatten it later would show
                  // formatting the document cannot keep, and a pasted newline
                  // would split the heading into lines it has no way to store.
                  event.preventDefault();
                  const pasted =
                    event.clipboardData?.getData("text/plain") ?? "";
                  const flat = pasted.replace(/\s+/gu, " ").trim();
                  if (flat === "") return;
                  const selection = document.getSelection();
                  const range =
                    selection !== null && selection.rangeCount > 0
                      ? selection.getRangeAt(0)
                      : null;
                  if (
                    range === null ||
                    !element.contains(range.startContainer)
                  ) {
                    element.textContent = `${element.textContent ?? ""}${flat}`;
                    return;
                  }
                  range.deleteContents();
                  const node = document.createTextNode(flat);
                  range.insertNode(node);
                  range.setStartAfter(node);
                  range.collapse(true);
                  selection?.removeAllRanges();
                  selection?.addRange(range);
                }}
                onKeyDown$={(event, element) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    element.blur();
                  }
                  if (event.key === "Escape") {
                    element.textContent = state.document?.title ?? "";
                    element.blur();
                  }
                }}
                onBlur$={async (_, element) => {
                  const renamed = await rename$(element.textContent ?? "");
                  if (!renamed) {
                    element.textContent = state.document?.title ?? "";
                  }
                }}
              >
                {doc.title}
              </span>
            </h2>
            {emptyDocument(doc) &&
            state.activeBlockId === null &&
            // A document whose reading order says nothing is a blank page —
            // unless the reader has asked to see what was retired out of it,
            // which is content to show and so not a blank page at all.
            !(state.retiredOpen && state.retired.length > 0) ? (
              // A blank page, not a row saying the block is empty. The hint
              // sits where the first line will be, so the caret arrives where
              // the reader was already looking.
              <button
                type="button"
                class="document-empty"
                data-document-empty
                onClick$={() => startWriting$()}
              >
                <span class="document-empty__hint">Write something</span>
              </button>
            ) : (
              <div class="blocks" data-block-count={doc.blocks.length}>
                {placeProposals(
                  readingOrder(
                    doc.blocks,
                    state.retiredOpen ? state.retired : [],
                    state.discardedOpen,
                  ),
                  shownProposals,
                ).map((entry, index) => {
                  if (entry.kind === "proposal") {
                    // A removal and a move frame the block they concern,
                    // which stays the editor's; they are drawn with it.
                    if (framed.has(entry.item.blockId) && framed.get(entry.item.blockId)?.includes(entry.item)) return null;
                    return (
                      <ProposalBlock
                        key={`proposal:${entry.item.itemId}`}
                        item={entry.item}
                        proposer={groupOf(entry.item.groupId)?.proposer ?? UNKNOWN_PROPOSER}
                        groupSize={groupOf(entry.item.groupId)?.items.length ?? 1}
                        destination={destinationFor(entry.item)}
                        answer$={answerProposal$}
                        acceptGroup$={acceptGroup$}
                        settle$={settleProposal$}
                        startDrag$={startProposalDrag$}
                        step$={stepProposal$}
                      />
                    );
                  }
                  if (entry.discarded) {
                    return (
                      <DiscardedRow
                        key={`discarded:${entry.block.blockId}:${entry.block.revisionId}`}
                        block={entry.block}
                      />
                    );
                  }
                  if (entry.retired) {
                    return (
                      <RetiredRow
                        key={`retired:${entry.block.blockId}`}
                        block={entry.block}
                        restore$={restore$}
                      />
                    );
                  }
                  const row = (
                    <BlockRow
                      // Keyed by revision, not just identity: a row renders one
                      // revision of a block, so a revised block is a new row. The
                      // block's own identity is unchanged, and the graph is what
                      // says so.
                      key={`${entry.block.blockId}:${entry.block.revisionId}`}
                      block={entry.block}
                      index={index}
                      first={entry.block.blockId === doc.blocks[0]?.blockId}
                      last={
                        entry.block.blockId ===
                        doc.blocks[doc.blocks.length - 1]?.blockId
                      }
                      active={entry.block.blockId === state.activeBlockId}
                      editor={editor}
                      drag={bridge.drag}
                      activate$={activate$}
                      deactivate$={deactivate$}
                      move$={move$}
                      startBlockDrag$={startBlockDrag$}
                      editRuns$={editRuns$}
                      input$={input$}
                      select$={syncSelection$}
                      split$={split$}
                      merge$={merge$}
                      step$={step$}
                      undo$={undo$}
                      redo$={redo$}
                      toggleMark$={toggleMark$}
                    />
                  );
                  // Framed by each removal or move that concerns it, the
                  // first outermost. BO_0233_004
                  return (framed.get(entry.block.blockId) ?? []).reduceRight(
                    (inner, item) => (
                      <ProposalBlock
                        key={`proposal:${item.itemId}`}
                        item={item}
                        proposer={groupOf(item.groupId)?.proposer ?? UNKNOWN_PROPOSER}
                        groupSize={groupOf(item.groupId)?.items.length ?? 1}
                        destination={destinationFor(item)}
                        answer$={answerProposal$}
                        acceptGroup$={acceptGroup$}
                        settle$={settleProposal$}
                        startDrag$={startProposalDrag$}
                        step$={stepProposal$}
                      >
                        {inner}
                      </ProposalBlock>
                    ),
                    row,
                  );
                })}
                <DropMark id="end" drag={bridge.drag} />
                {/* The area below the last block carries both gestures. It is
                    the way into writing below the document, and it is where a
                    drag aims to land a block last: the mark above it is already
                    reserved for that, and the end placement the drop compiles
                    into was already built and until now unreachable. A release
                    ending a drag is not the click that starts writing, so the
                    two never answer the same gesture. */}
                <button
                  type="button"
                  class="document-append"
                  data-document-append
                  data-drop-target="block:end"
                  data-accepts="move"
                  aria-label="Write below the last block"
                  onClick$={() => startWriting$()}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

/**
 * The action surface for the active block.
 *
 * Its own component because it reads the editing state on every selection
 * change: re-rendering the document for that would rewrite the very element the
 * caret sits in.
 */
const BlockToolbar = component$<{
  surface: DocumentState;
  editor: EditorState;
  toggleMark$: QRL<(mark: Mark) => void>;
  setRole$: QRL<(role: TextRole) => void>;
  commitLink$: QRL<() => void>;
  undo$: QRL<() => void>;
  redo$: QRL<() => void>;
  deactivate$: QRL<() => void>;
  insert$: QRL<(kind: "text" | "divider", afterBlockId: string) => void>;
  retire$: QRL<(blockId: string) => void>;
}>(
  ({
    surface,
    editor,
    toggleMark$,
    setRole$,
    commitLink$,
    undo$,
    redo$,
    deactivate$,
    insert$,
    retire$,
  }) => {
    // Read here, not in the document's render: this component re-renders alone,
    // so activation may not rebuild the element the caret is in.
    if (editor.blockId === null) return null;
    const blockId = editor.blockId;
    const position = editor.position;
    return (
      <div
        class="block-toolbar"
        role="toolbar"
        aria-label="Block actions"
        data-block-toolbar="active"
      >
        <div class="toolbar-group" role="group" aria-label="Format">
          {MARKS.map((mark) => (
            <button
              key={mark}
              type="button"
              aria-pressed={editor.marks.includes(mark)}
              aria-label={MARK_LABEL[mark]}
              data-mark={mark}
              // Keeping focus in the text is what keeps the selection alive: a
              // button that took focus would collapse the range it acts on.
              preventdefault:mousedown
              onClick$={() => toggleMark$(mark)}
            >
              {MARK_GLYPH[mark]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={editor.link !== null}
            aria-label="Link"
            data-block-link
            preventdefault:mousedown
            onClick$={() => {
              editor.linkDraft = editor.link ?? "";
              editor.linking = !editor.linking;
            }}
          >
            Link
          </button>
        </div>

        {editor.linking && (
          <div class="toolbar-group" role="group" aria-label="Link address">
            <label for="block-link-address">Link address</label>
            <input
              id="block-link-address"
              type="url"
              value={editor.linkDraft}
              onInput$={(_, field) => (editor.linkDraft = field.value)}
            />
            <button type="button" data-block-link-apply onClick$={commitLink$}>
              Apply link
            </button>
          </div>
        )}

        <div class="toolbar-group" role="group" aria-label="Turn into">
          <label for="block-role">Text role</label>
          <select
            id="block-role"
            value={editor.role}
            onChange$={(_, field) => setRole$(field.value as TextRole)}
          >
            {TEXT_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>

        <div class="toolbar-group" role="group" aria-label="Block">
          <button
            type="button"
            aria-label={`Insert paragraph after block ${position}`}
            data-block-add-paragraph
            onClick$={() => insert$("text", blockId)}
          >
            + Paragraph
          </button>
          <button
            type="button"
            aria-label={`Insert divider after block ${position}`}
            data-block-add-divider
            onClick$={() => insert$("divider", blockId)}
          >
            + Divider
          </button>
          <button
            type="button"
            aria-label={`Retire block ${position}`}
            data-block-retire
            onClick$={() => retire$(blockId)}
          >
            Retire
          </button>
        </div>

        <div class="toolbar-group" role="group" aria-label="Standing">
          <StandingControl surface={surface} editor={editor} />
        </div>

        <div class="toolbar-group" role="group" aria-label="History">
          <button
            type="button"
            disabled={editor.past.length === 0}
            onClick$={undo$}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={editor.future.length === 0}
            onClick$={redo$}
          >
            Redo
          </button>
          <button type="button" data-block-done onClick$={deactivate$}>
            Done editing
          </button>
        </div>
      </div>
    );
  },
);

/**
 * Where a dragged block would land.
 *
 * Its own component because the target under the pointer changes on every
 * pointer move: reading that in the document's render would rebuild the block
 * list dozens of times a second.
 */
const DropMark = component$<{ id: string; drag: ViewDragState }>(
  ({ id, drag }) => (
    <span
      class="drop-mark"
      data-drop-mark={id}
      data-drop-active={drag.overId === `block:${id}` ? "true" : undefined}
    />
  ),
);

/** One block, in reading presentation or as the active editor. */
const BlockRow = component$<{
  block: BlockView;
  index: number;
  first: boolean;
  last: boolean;
  active: boolean;
  editor: EditorState;
  drag: ViewDragState;
  activate$: QRL<
    (blockId: string, offset: number | "end", until?: number) => void
  >;
  deactivate$: QRL<() => void>;
  move$: QRL<(blockId: string, by: -1 | 1) => void>;
  startBlockDrag$: QRL<
    (blockId: string, preview: string, event: PointerEvent) => void
  >;
  editRuns$: QRL<(runs: Run[], start: number, end: number) => void>;
  input$: QRL<(element: HTMLElement) => void>;
  select$: QRL<(element: HTMLElement) => void>;
  split$: QRL<(at: number) => void>;
  merge$: QRL<(direction: "back" | "forward") => void>;
  step$: QRL<(direction: -1 | 1) => void>;
  undo$: QRL<() => void>;
  redo$: QRL<() => void>;
  toggleMark$: QRL<(mark: Mark) => void>;
}>(
  ({
    block,
    index,
    first,
    last,
    active,
    editor,
    drag,
    activate$,
    deactivate$,
    move$,
    startBlockDrag$,
    editRuns$,
    input$,
    select$,
    split$,
    merge$,
    step$,
    undo$,
    redo$,
    toggleMark$,
  }) => {
    const position = index + 1;
    // What command mode says about this row: the mode, and this block's
    // reference number or `null` for a block nobody has marked.
    const {
      store: markingStore,
      toggleReference$,
      addPassage$,
      removeReference$,
    } = useContext(MarkingContext);
    const mode = markingStore.marking.mode;
    const reference = referenceFor(markingStore.marking, block.blockId);
    // And what the scale says: the block's standing, and the passages marked
    // in it with whether each still matches its words.
    const { store: standingStore, setStanding$ } = useContext(StandingContext);
    const standing = standingOf(block, standingStore);
    const text = isText(block) ? runsText(block.runs) : "";
    const facts = {
      position,
      mode,
      reference,
      passages: passagesIn(markingStore.marking, block.blockId).map((passage) => ({
        number: passage.number,
        stale: passageState(passage, text).stale,
      })),
      standing,
    };
    const Tag: BlockTag = isText(block) ? ROLE_TAG[block.role] : "p";
    const preview = isText(block) ? runsText(block.runs) : block.kind;
    // In command mode the whole block is what a click marks, whatever it holds:
    // a reference points at a block, and the reader pointing at one should not
    // have to hit its text.
    const marking = mode === "command";
    // In command mode a text block's words are its marking control, so the
    // standing toolbar can stand beside them rather than inside a button
    // (`BO_0231_001`); a block with no words to carry it — a divider, an
    // unsupported block — keeps the row as its control. The row keeps the
    // handlers either way, so a press anywhere on the block still marks it.
    // Spread rather than a set of `undefined`s: an attribute that does not
    // apply is absent, so a reading row is a plain row again.
    const markingControl = {
      role: "button",
      tabIndex: 0,
      "aria-pressed": reference !== null,
      "aria-label": markingName(facts),
    };
    const markable = marking && !isText(block) ? markingControl : {};

    return (
      <div
        class="block-row"
        data-block-id={block.blockId}
        data-block-kind={block.kind}
        data-reference={marking && reference !== null ? reference : undefined}
        data-standing={standing}
        data-drop-target={`block:${block.blockId}`}
        data-accepts="move"
        {...markable}
        // The mode is read from the store at the press, never from this
        // render's copy of it: a row whose handlers outlived the mode they
        // were drawn in would otherwise mark while reading, or open an editor
        // while pointing — the rule `BO_0226_005` set for the composer.
        onClick$={(event: MouseEvent, element: HTMLElement) => {
          if (markingStore.marking.mode !== "command") return;
          // The standing toolbar's buttons answer their own press.
          if (inStandingToolbar(event.target)) return;
          // A passage's number takes that passage back, and only that.
          const passage = passageNumberAt(event.target);
          if (passage !== null) {
            void removeReference$(passage);
            return;
          }
          if (!clickMarks(element)) return;
          void toggleReference$(block.blockId);
        }}
        onKeyDown$={(event: KeyboardEvent, element: HTMLElement) => {
          if (markingStore.marking.mode !== "command") return;
          if (inStandingToolbar(event.target)) return;
          const direction = chordDirection(event);
          if (direction !== null) {
            void setStanding$(block.blockId, step(standing, direction));
            return;
          }
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          // Enter on a row holding selected words references the words rather
          // than the block, decided here with the press so one handler answers
          // the key.
          const words = event.key === "Enter" ? selectedWords(element.ownerDocument) : null;
          if (words !== null && words.blockId === block.blockId) {
            void addPassage$(block.blockId, anchorAt(text, words.start, words.end));
            return;
          }
          void toggleReference$(block.blockId);
        }}
      >
        <DropMark id={block.blockId} drag={drag} />

        {/* The number, in the gutter the grips use and out of the row's flow,
         * so a mark changes colour and never geometry. The row's own name
         * already says which reference this is, so the badge is decoration to a
         * screen reader rather than a second reading of the same fact. */}
        {marking && reference !== null && (
          <span class="block-reference" aria-hidden="true">
            #{reference}
          </span>
        )}
        {isText(block) && !active && <StandingMark block={block} />}
        {marking && isText(block) && !active && (
          <StandingToolbar block={block} />
        )}
        <PassageNumbers block={block} />

        {/* The grip the drag starts from, on the edge the gesture grabs.
         * Before the text in the DOM, so keyboard reach runs handle, text,
         * arrows — the order the reader sees them in. */}
        {active && (
          <div
            class="block-grip block-grip--start"
            role="group"
            aria-label={`Move block ${position}`}
          >
            <button
              type="button"
              class="block-handle"
              aria-label={`Drag block ${position}`}
              onPointerDown$={(event) =>
                startBlockDrag$(block.blockId, preview, event)
              }
            >
              ⠿
            </button>
          </div>
        )}

        {block.kind === "divider" && <hr data-block-divider />}

        {block.kind === "unsupported" && (
          <p
            class="block-unsupported"
            data-block-unsupported={block.semanticType}
          >
            This build cannot show a {block.semanticType} block. Its content is
            kept.
          </p>
        )}

        {/* In command mode the block is read, not activated: marking is not
            activation, so the block carries no activation affordance and a
            click on it does not open an editor. */}
        {/* The words' marking control is a literal element around them, not
            the words' own tag: `Tag` is a tag held in a variable, and Qwik
            treats every attribute of such an element as immutable — set when
            it is created, never patched — so a block marked after it was
            drawn went on saying it was not. A literal tag's attributes are
            patched. BO_0231_001 */}
        {isText(block) && !active && mode === "command" && (
          <div class="block-marking" data-block-marking {...markingControl}>
          <Tag class="block-text" data-block-reading>
            {block.runs.map((entry, at) => (
              <Marked
                key={at}
                text={entry.text}
                marks={entry.marks ?? []}
                link={entry.link}
              />
            ))}
          </Tag>
          </div>
        )}

        {isText(block) && !active && mode === "reading" && (
          <Tag
            class="block-text"
            data-block-reading
            // The reading block is the activation affordance now that no
            // control sits beside it: reachable in tab order, named, and
            // activated by Enter or Space like the button it replaced.
            tabIndex={0}
            role="button"
            aria-label={readingName(facts)}
            onClick$={(event: MouseEvent, element: HTMLElement) => {
              // Command mode points and never opens an editor, read at the
              // press rather than trusted to this render.
              if (markingStore.marking.mode !== "reading") return;
              // A swipe's release leaves a click behind; it is the swipe's,
              // and opening an editor under it is what `BO_0153` fixed.
              if (swipeJustEnded()) return;
              // A drag that left this block selected text this block does not
              // own. Activating would collapse it, and the reader was copying.
              if (selectionEscapes(element)) return;
              // The click already placed a selection in the reading text, so
              // the offsets are read from it: collapsed for a click, a range
              // for a drag that stayed inside this block.
              const range = selectionIn(element);
              if (range !== null) {
                void activate$(block.blockId, range.start, range.end);
                return;
              }
              const at = offsetFromPoint(element, event.clientX, event.clientY);
              void activate$(block.blockId, at ?? "end");
            }}
            onKeyDown$={(event: KeyboardEvent) => {
              const direction = chordDirection(event);
              if (direction !== null) {
                void setStanding$(block.blockId, step(standing, direction));
                return;
              }
              if (event.key !== "Enter" && event.key !== " ") return;
              if (markingStore.marking.mode !== "reading") return;
              event.preventDefault();
              void activate$(block.blockId, "end");
            }}
          >
            {block.runs.map((entry, at) => (
              <Marked
                key={at}
                text={entry.text}
                marks={entry.marks ?? []}
                link={entry.link}
              />
            ))}
          </Tag>
        )}

        {isText(block) && active && (
          <ActiveBlockText
            tag={Tag}
            label={`Block ${position}`}
            editor={editor}
            input$={input$}
            select$={select$}
            editRuns$={editRuns$}
            deactivate$={deactivate$}
            split$={split$}
            merge$={merge$}
            step$={step$}
            undo$={undo$}
            redo$={redo$}
            toggleMark$={toggleMark$}
          />
        )}

        {active && (
          <div
            class="block-grip block-grip--end"
            role="group"
            aria-label={`Reorder block ${position}`}
          >
            <button
              type="button"
              aria-label={`Move block ${position} up`}
              data-block-up
              disabled={first}
              onClick$={() => move$(block.blockId, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move block ${position} down`}
              data-block-down
              disabled={last}
              onClick$={() => move$(block.blockId, 1)}
            >
              ↓
            </button>
          </div>
        )}

        <BlockFailure blockId={block.blockId} editor={editor} />
      </div>
    );
  },
);

/**
 * A refused save, on the block it was refused for.
 *
 * The tab's save state says the graph does not hold what was typed; only this
 * can say which block. Its own component for the reason every other reader of
 * the editing state is one: a failure arriving must re-render this alone, not
 * the document under the caret.
 */
const BlockFailure = component$<{ blockId: string; editor: EditorState }>(
  ({ blockId, editor }) =>
    editor.failure === null || editor.blockId !== blockId ? null : (
      <p class="block-failure" role="alert" data-block-failure={blockId}>
        {editor.failure}
      </p>
    ),
);

/**
 * The active block's `contenteditable`, and the only place the model is painted
 * into the DOM.
 *
 * It owns the element through a ref and paints from its own visible task, so
 * the paint cannot run before the element exists — which is exactly what a
 * paint living in the parent raced against. Mounting is one such paint, so
 * activation and a reload need no special case.
 */
const ActiveBlockText = component$<{
  tag: BlockTag;
  label: string;
  editor: EditorState;
  input$: QRL<(element: HTMLElement) => void>;
  select$: QRL<(element: HTMLElement) => void>;
  editRuns$: QRL<(runs: Run[], start: number, end: number) => void>;
  deactivate$: QRL<() => void>;
  split$: QRL<(at: number) => void>;
  merge$: QRL<(direction: "back" | "forward") => void>;
  step$: QRL<(direction: -1 | 1) => void>;
  undo$: QRL<() => void>;
  redo$: QRL<() => void>;
  toggleMark$: QRL<(mark: Mark) => void>;
}>((props) => {
  const {
    tag,
    label,
    editor,
    input$,
    select$,
    editRuns$,
    deactivate$,
    split$,
    merge$,
    step$,
    undo$,
    redo$,
    toggleMark$,
  } = props;
  const host = useSignal<HTMLElement>();
  const Tag = tag;

  useVisibleTask$(({ track }) => {
    track(() => editor.paint);
    const element = host.value;
    if (element === undefined) return;
    paintRuns(element, editor.runs);
    element.focus();
    selectRange(element, editor.start, editor.end);
  });

  return (
    <Tag
      ref={host}
      class="block-text block-text--active"
      contentEditable="true"
      role="textbox"
      aria-multiline="false"
      aria-label={label}
      data-block-editor
      onInput$={(_: Event, element: HTMLElement) => input$(element)}
      onKeyUp$={(_: KeyboardEvent, element: HTMLElement) => select$(element)}
      onMouseUp$={(_: MouseEvent, element: HTMLElement) => select$(element)}
      onPaste$={(event: ClipboardEvent) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text === "") return;
        const runs = replaceRange(editor.runs, editor.start, editor.end, text);
        const at = Math.min(editor.start, editor.end) + [...text].length;
        void editRuns$(runs, at, at);
      }}
      onKeyDown$={(event: KeyboardEvent, element: HTMLElement) => {
        const meta = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (meta && key === "z") {
          event.preventDefault();
          void (event.shiftKey ? redo$() : undo$());
          return;
        }
        if (meta && key === "y") {
          event.preventDefault();
          void redo$();
          return;
        }
        if (meta && (key === "b" || key === "i")) {
          event.preventDefault();
          void toggleMark$(key === "b" ? "bold" : "italic");
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          void deactivate$();
          return;
        }
        // Enter splits, but `Ctrl`/`Cmd`+`Enter` is the surface's, and two
        // handlers may never arbitrate one event: this one leaves it alone
        // rather than splitting the block on the mode's way in.
        if (event.key === "Enter" && !meta) {
          event.preventDefault();
          void split$(Math.min(editor.start, editor.end));
          return;
        }
        const collapsed = editor.start === editor.end;
        const length = textLength(element);
        if (event.key === "Backspace" && collapsed && editor.start === 0) {
          event.preventDefault();
          void merge$("back");
          return;
        }
        if (event.key === "Delete" && collapsed && editor.start === length) {
          event.preventDefault();
          void merge$("forward");
          return;
        }
        if (
          (event.key === "ArrowUp" || event.key === "ArrowLeft") &&
          collapsed &&
          editor.start === 0
        ) {
          event.preventDefault();
          void step$(-1);
          return;
        }
        if (
          (event.key === "ArrowDown" || event.key === "ArrowRight") &&
          collapsed &&
          editor.start === length
        ) {
          event.preventDefault();
          void step$(1);
        }
      }}
    />
  );
});


/**
 * The document's retired blocks, and the way one comes back.
 *
 * Retirement is recoverable for the life of the document, so this list is the
 * recovery path rather than an undo that would have to survive a reload.
 */

/**
 * A retired block shown where it used to sit.
 *
 * It is read-only: it cannot be activated and cannot be edited, and the only
 * thing it offers is restore. A merge retires the block it absorbed, so with
 * the toggle on a merged block appears beside the text that now contains it —
 * a truthful account that reads as duplication, which is why this has to be
 * unmistakable rather than merely tinted. The row carries its own accessible
 * name saying it is retired, so a reader scanning the document never takes one
 * for content.
 */
const RetiredRow = component$<{
  block: BlockView;
  restore$: QRL<(blockId: string) => void>;
}>(({ block, restore$ }) => {
  const name = isText(block)
    ? runsText(block.runs) || "empty block"
    : `${block.kind} block`;
  return (
    <div
      class="retired-row"
      data-retired-id={block.blockId}
      role="group"
      aria-label={`Retired: ${name}`}
    >
      <p class="retired-row__mark" aria-hidden="true">
        Retired
      </p>
      <div class="retired-row__text">{name}</div>
      <button
        type="button"
        data-retired-restore={block.blockId}
        onClick$={() => restore$(block.blockId)}
      >
        Restore
      </button>
    </div>
  );
});
