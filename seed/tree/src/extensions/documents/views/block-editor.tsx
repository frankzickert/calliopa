import {
  $,
  component$,
  useContext,
  useContextProvider,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  type JSXOutput,
  type QRL,
} from "@builder.io/qwik";

import type { DragPayload } from "~/lib/drag";
import { draggedDocument, draggedOverItself } from "../lib/dragged-document";
import { patternImageSource, type PatternImage } from "~/lib/attachments";
import { EXTEND_A_STRUCTURE, INSTRUCTION_RECORD, SHAPE_AN_INSTRUCTION } from "../lib/instruction";
import { step, type Standing } from "../lib/disposition";
import { anchorAt } from "~/lib/passage";
import { passagesIn, passageState, proposalReferenceFor, referenceFor } from "../lib/references";
import { isUnnamed, shownTitle, unnamedTitle } from "../lib/naming";
import { proposedFor, revealFor, type AttachmentDescriptor } from "~/lib/command-target";
import type { SentCommand, ViewInstructedRun } from "~/components/shell/view-bridge";
import { CommandControl } from "./command/command-control";
import { attachFiles, uploadFile, type AttachmentHolder } from "~/lib/attachments";

/** A block's command files, or none yet. BO_0267_012 */
const filesOf = (byBlock: Record<string, AttachmentHolder>, blockId: string): AttachmentHolder =>
  byBlock[blockId] ?? { attachments: [], attachNotice: null };

/** A block's command choices: what this page holds for it, else read back
 * from what was sent and its standing. DO_0025_002 DO_0025_003 */
const choiceIn = (
  byBlock: Record<string, CommandChoice>,
  runs: readonly SentRun[],
  document: DocumentView | null,
  blockId: string,
  lastSent: WorkingMode | null,
): CommandChoice => {
  const held = byBlock[blockId];
  if (held !== undefined) return held;
  const block = document?.blocks.find((candidate) => candidate.blockId === blockId);
  return resolveChoice({}, runs, blockId, block !== undefined && "standing" in block ? String(block.standing) : undefined, lastSent);
};
import {
  applyLink,
  applyMark,
  couldBeOneEdit,
  linkAt,
  marksAt,
  MARKS,
  normalizeRuns,
  replaceRange,
  replaceRangeWithAtom,
  replaceRangeWithRuns,
  runsLength,
  runsText,
  sameRuns,
  sliceRuns,
  splitRuns,
  TEXT_ROLES,
  type Mark,
  type MarkRef,
  type Run,
  type TextRole,
  citationKey,
} from "~/lib/runs";
import {
  ViewBridgeContext,
  optionsOf,
  replayChipsKey,
  type ViewAction,
  type ViewBarGroup,
  type InspectorFact,
  type RunChip,
  type SaveState,
  type ViewDragState,
  type EmptiedWork,
} from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";
import { emptiedOf, leftBy, NOTHING_LEFT } from "../lib/emptied";
import type { ChangeSummary } from "../server/documents";
import { Icon, type IconName } from "~/components/shell/icons";
import { actsOnBody, BlockDecorations, dropOnDocument } from "./decorations";
import { EquationBlock } from "./equation-block";
import { EquationPopover } from "./equation-popover";
import { typesetInline, typesetMissing } from "./typeset-client";
import type { EquationDraft } from "./equation-popover";
import { MediaBlock } from "./media-block";
import { TableBlock, type ReviseTable } from "./table-block";
import type { SetFigure } from "./figure-caption";
import { emptyTable, type TableColumn } from "../lib/table";
import { carriesMath, mathAtCaret, mathInText } from "../lib/dollar-math";
import { CitePopover } from "./cite-popover";
import { LocatorPopover } from "./locator-popover";
import { CodeBlock, type ContinueCode, type ReportCodeLines, type ReviseCode } from "./code-block";
import { resolveFirstLines } from "../lib/code-lines";
import { OutputBlock } from "./output-block";
import { delimiterFor, looksLikeGrid, parsePastedGrid, parseTable, sniffDelimiter } from "../lib/table-parse";
import type { BlobReference } from "~/server/ccgw/blobs";
import { captureReach, pickHostFiles, takePhoto, type CaptureReach } from "~/lib/capture";
import { placeShared, SHARED_EVENT, shareables, type SharedHere } from "./shared";
import type { Captured } from "~/server/port/port";
import type {
  AdmonitionBlockView,
  BlockView,
  DocumentView,
  TextBlockView,
} from "../server/assemble";
import type {
  DocumentProposals,
  ProposedChange,
} from "../server/documents";
import {
  arrivalOffset,
  caretLine,
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
  answerGroup,
  answerProposal,
  placeProposal,
  describeOutcome,
  fetchChanges,
  fetchDocument,
  fetchReplay,
  fetchProposals,
  readArrangement,
  deferGroup,
  reopenProposal,
  fetchRetired,
  sendCommand,
  uploadDocumentFile,
  sendRename,
  fetchWorkingMode,
  sendWorkingMode,
  requiresProposal, refusedByFloor, afterFloor, WRITE_FLOOR_MS, alreadySettled } from "./documents-client";
import { declineNotice } from "../lib/declines";
import { installSwipe, swipeJustEnded, SWIPEABLE_PROPOSALS } from "./block-swipe";
import { installPinch } from "./block-pinch";
import { cardItems, cardOrigin, cardPlaces, refold } from "./cards";
import { drawnGroups, NO_ARRANGEMENT, type Arrangement } from "../lib/arrangement";
import { routeOf } from "~/lib/tabs";
import {
  chordDirection,
  clickMarks,
  inCommandControl,
  passageNumberAt,
} from "./press";
import { MarkingContext, useMarking } from "./marking/use-marking";
import { marksSeveral, useMarkedRows } from "./marked-rows";
import { RowMarks, rowMarkAttributes, rowMarkingName, rowNumbers } from "./marking/row-marks";
import { openingWords } from "../lib/pointing";
import type { Marked as MarkedTarget } from "../lib/references";
import { PassageAffordance } from "./passages/passage-affordance";
import { PASSAGE_DRAG_KIND, passageBlock, PassageNumbers } from "./passages/passage-numbers";
import { askReveal, revealedPassage, showArea } from "./reveal";
import { commandWords, unboundMarks } from "~/lib/command-typeahead";
import { blockTitles, drawnMark, markReveal, promptMarks, type DrawnMark } from "../lib/reference-title";
import { pressedMark } from "./editor-dom";
import { selectedWords } from "./passages/selection";
import { PassagesContext, usePassages } from "./passages/use-passages";
import { Marked, ROLE_TAG, type BlockTag, Annotated } from "./block-text";
import { ProposalBlock, isInferredRelation } from "./proposals/proposal-block";
import {
  destinationOf,
  faceOf,
  proposerName,
  stepPlacement,
  toneOf,
  withoutItems,
  type Proposer,
  type Placed,
  type ProposalPlacement,
  type TypedProposal,
} from "../lib/proposals";
import { orderBetween } from "~/lib/order";
import { HOVER_DEPTH_MS, hoverPointer } from "../lib/pointer";

export { HOVER_DEPTH_MS };
import { belowPlacement, dropPlacement, placeProposals, positionOf, readingOrder, restorePlacement, stepPlacement as stepRowPlacement, type RowTarget } from "./reading-order";
import { RowGrip } from "./row-grip";
import { markingName, readingName } from "./row-name";
import { StandingAnnouncement } from "./standing/standing-announcement";
import { CardLabel, StandingMark } from "./standing/standing-mark";
import { FIRST_MODE, PINCH_MODE, switched, type WorkingMode } from "../lib/working-mode";
import { commandChoiceKey, readStoredChoice, resolveChoice, storedChoice, type CommandChoice, type SentRun } from "../lib/command-choices";
import type { FocusedChild, FocusedWork } from "~/server/focused-work";
import type { NestedBlock } from "~/contract";
import { BlockFace } from "./block-controls";
import { BlockBar } from "./block-bar";
import { StandingContext, standingOf, useStanding, type RestorePlacement } from "./standing/use-standing";
import { EditorSurfaceContext } from "./editor-surface";
import { DecorationProvider, DocumentDecorations } from "./decorations";
import { CompactHeader } from "./document-header";
import { CitedWorksContext, type CitedWorks } from "./cited-works";
import { InlineAnnotationsContext, annotationsOn, type InlineAnnotations } from "./inline-annotations";
import { InlineTriggersContext, type InlineTriggers } from "./inline-triggers";
import { annotate } from "../lib/annotations";
import { citeLabel } from "../lib/citation-label";
import { BranchLine, type BranchAsk } from "./branch/branch-line";
import { referenceChoices, type ReferenceChoice } from "../lib/reference-choices";
import { sessionChipsOf, type ProposalSession } from "../lib/branch";
import { branchOf } from "../lib/branch-scope";
import { newBlockId } from "../lib/block-id";
import { landingOffset } from "../lib/lines";
import {
  groupShown,
  itemWords,
  GATHERED_WORDS,
  refinerOf,
  revealGroup,
  withdrawerOf,
  withdrawnCountOf,
  liveGroup,
  liveGroupsOf,
  replayShown,
  typedInto,
  shownAlone,
  toggledGroup,
  READ_MARK_MS,
  readMarks,
  runChipsOf,
  type ChipLine,
  type ReadMark,
  type RunActivity,
} from "../lib/agent-at-work";
import type { ProposalFace } from "../lib/proposals";
import "./block-editor.css";
import "./admonition.css";

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

/** What a document shows beside its blocks, as this device last left it:
 * the removed rows, proposed changes and prompts. Device-local and per
 * document, as its marks are. `removed` is what `retired` was kept as before
 * the toggle took its new name, and reads the same. BO_0267_022 BO_0315_015 */
interface DocumentShows {
  readonly removed: boolean;
  readonly proposals: boolean;
  readonly prompts: boolean;
}

const showsKey = (documentId: string): string => `calliopa.shows.${documentId}`;

/** The shows kept for a document, or none; a browser that keeps nothing, or
 * a record that cannot be read, shows nothing extra. */
export function readShows(raw: string | null): DocumentShows | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      removed: value["removed"] === true || value["retired"] === true,
      proposals: value["proposals"] === true,
      prompts: value["prompts"] === true,
    };
  } catch {
    return null;
  }
}

function storedShows(documentId: string): DocumentShows | null {
  try {
    return readShows(window.localStorage.getItem(showsKey(documentId)));
  } catch {
    return null;
  }
}

function keepShows(documentId: string, shows: DocumentShows): void {
  try {
    const any = shows.removed || shows.proposals || shows.prompts;
    if (any) window.localStorage.setItem(showsKey(documentId), JSON.stringify(shows));
    else window.localStorage.removeItem(showsKey(documentId));
  } catch {
    // A browser that keeps nothing shows nothing extra next time.
  }
}

/**
 * The revision a block drawn by an instant split carries until the split has
 * landed: a block the graph does not hold yet has no revision to name, so a
 * save of it waits for the answer that gives it one. CA_0045_005
 */
const PENDING_REVISION = "pending";

/**
 * The writes each tab has on their way that the graph must see in order: the
 * instant splits, and the save of each head before its split. A read of the
 * document or a save waits for them — a read taken while a split is under way
 * would not hold the block the reader is already typing in, and a save of that
 * block has no revision to name until its split lands. Per tab, for the page's
 * lifetime, like the scroll map. CA_0045_005
 */
const inFlight = new Map<string, Promise<void>>();

/** The save on its way per tab, so a second save waits for its answer rather
 * than sending the same block again on the same base. A pause's save and the
 * save a leave flushes can fall in one breath; the kernel's per-node floor
 * refuses the second as written too frequently, and the block is left
 * unsaved. Found live in the `BO_0248` walk-through. */
const saving = new Map<string, Promise<void>>();

/** Waits until no save of the tab is on its way. */
async function savesSettled(tabId: string): Promise<void> {
  for (;;) {
    const pending = saving.get(tabId);
    if (pending === undefined) return;
    await pending;
  }
}

/** Waits until nothing is on its way for the tab, including a split pressed
 * while it was waiting. */
async function writesSettled(tabId: string): Promise<void> {
  let waited: Promise<void> | undefined;
  for (;;) {
    const pending = inFlight.get(tabId);
    if (pending === undefined || pending === waited) return;
    await pending;
    waited = pending;
  }
}


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
  abstract: "Abstract",
};

const MARK_LABEL: Readonly<Record<Mark, string>> = {
  bold: "Bold",
  italic: "Italic",
  strikethrough: "Strikethrough",
  code: "Code",
};

/** The icon each mark's toggle shows on the bar. CA_0053_006 */
const MARK_ICON: Readonly<Record<Mark, IconName>> = {
  bold: "text-b",
  italic: "text-italic",
  strikethrough: "text-strikethrough",
  code: "code",
};

/** The symbol the bar's text-role dropdown wears for the role the subject is
 * in. The bar draws a choice with an icon as that icon alone, so this table
 * is what the control says. DO_0010_002 */
const ROLE_ICON: Readonly<Record<TextRole, IconName>> = {
  paragraph: "article-ny-times",
  h1: "text-h-one",
  h2: "text-h-two",
  h3: "text-h-three",
  quote: "quotes",
  abstract: "article",
};

/** Whether a key lands where it types: a field, a text area or editable
 * text, where Delete and Backspace are the text's own. BO_0315_011 */
const typesHere = (target: EventTarget | null): boolean => {
  const closest = (target as { closest?: (selector: string) => unknown } | null)?.closest;
  return typeof closest === "function" && closest.call(target, "input, textarea, select, [contenteditable]:not([contenteditable='false'])") != null;
};

/** A drop a row has already taken, said on the event itself, so the view's
 * root leaves it alone. BO_0287_013 */
type TakenDrop = DragEvent & { takenByRow?: boolean };

/** What a press in one of the bar's block groups asks of a block: named, so
 * it survives a proposal's acceptance as data. DO_0006_004 */
type BlockAct =
  | { readonly act: "insert"; readonly block: "text" | "divider" | "table" | "code" | "equation" | "admonition" | "image" }
  | { readonly act: "admonitionPattern"; readonly patternId: string }
  | { readonly act: "retire" }
  | { readonly act: "role"; readonly role: TextRole }
  | { readonly act: "toCode" }
  | { readonly act: "toImage" }
  | { readonly act: "standing"; readonly to: Standing };

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
        : block.kind === "table"
          ? "a table"
          : block.kind === "sourcecode"
            ? "a code block"
            : block.kind === "output"
              ? "an output"
              : "a divider",
    }))
    .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0));

/** The order key a placement would take among the placed blocks, drawn at
 * once while the staging that keeps it is on its way. */
const localOrder = (placement: ProposalPlacement, placed: readonly Placed[], self: string): string => {
  if ("between" in placement) return orderBetween(placement.between[0] ?? "", placement.between[1] ?? "");
  const others = placed.filter((block) => block.blockId !== self);
  if ("at" in placement) return orderBetween(others[others.length - 1]?.order ?? "", "");
  const at = others.findIndex((block) => block.blockId === placement.before);
  return orderBetween(others[at - 1]?.order ?? "", others[at]?.order ?? "");
};

/** The proposed changes the editor draws. BO_0263_002 moved it out of the
 * render, so a drop compiles against the rows the reader saw. */
const shownProposalsOf = (state: DocumentState, ownBranch: string | null): ProposedChange[] =>
  (
    // A started document's body is its run's proposal: shown whatever the
    // toggle holds, since there is nothing else to read. BO_0251_010
    state.document?.proposed !== undefined
      ? (state.proposals?.groups.flatMap((group) => group.items) ?? [])
      : // Each change is shown or hidden on its own: the toggle sets them all,
        // a run chip flips one, and the reader's run starts shown as it
        // stages. CA_0055_006 BO_0265_012
        // Of those, the arrangement's cards or the first seven, and a
        // deferred card only while *Show proposed changes* is on.
        // BO_0350_005 BO_0350_007
        ((groups) => {
          const drawn = drawnGroups(groups, (groupId) => groupShown(groupId, state), state.shownGroups, state.proposalsOpen, state.arrangement);
          return groups.flatMap((group) => (drawn.has(group.groupId) ? group.items : []));
        })(state.proposals?.groups ?? [])
  ).filter((item) => item.groupId !== ownBranch);

/** The blocks a standing gather moves into another block's focused work.
 * BO_0322_013 */
const gatheredBlocks = (proposals: DocumentProposals | null): ReadonlySet<string> =>
  new Set((proposals?.groups ?? []).flatMap((group) => group.items.flatMap((item) => (item.kind === "gather" ? (item.gathered ?? []) : []))));

/** The open changes each group holds, for the number a minimized chip draws
 * in place of its words. CA_0061_007 */
const openCounts = (state: DocumentState): ReadonlyMap<string, number> =>
  new Map((state.proposals?.groups ?? []).map((group) => [group.groupId, group.items.length]));

/** The chips the view reports for this document, in the order it reports
 * them: the runs newest first, then the reader's own proposal sessions.
 * BO_0265_014 CA_0057_003 */
const chipsOf = (state: DocumentState): RunChip[] => [
  ...runChipsOf(state.proposals, state.runActivities, state),
  ...sessionChipsOf(state.sessions, state.branchGroup, state.branchRequired, state, openCounts(state)),
];

/** The line a press lands on: every group with a chip, newest first, and the
 * groups of the runs still staging into the document. CA_0061_008 */
const chipLineOf = (state: DocumentState): ChipLine => ({
  groups: chipsOf(state).flatMap((chip) => chip.group ?? []),
  // What a press does not take away: the runs still staging, whose items
  // appear as they land, and the session the tab works in, which is the
  // document it reads. BO_0265_012 CA_0057_014
  live: [...liveGroupsOf(state.runActivities), ...(state.branchGroup === null ? [] : [state.branchGroup])],
});

/**
 * Keeps the line to one expanded chip as the changes arrive. A tab restored
 * with its proposals shown turns the toggle on before it has read them, so
 * the rule has no line to act on and every change would be drawn; the same
 * holds for a group that lands while several stand shown. The newest shown
 * change is the one kept, and a line already holding to one is left alone.
 * CA_0061_009
 */
const keepOneExpanded = (state: DocumentState): void => {
  const line = chipLineOf(state);
  if (line.groups.length < 2) return;
  const shown = line.groups.filter((group) => !line.live.includes(group) && groupShown(group, state));
  if (shown.length < 2) return;
  const next = shownAlone(shown[0] ?? null, state, line);
  state.shownGroups = [...next.shownGroups];
  state.hiddenGroups = [...next.hiddenGroups];
};

/** The rows the editor draws, in the order it draws them. */
const drawnRows = (state: DocumentState, doc: DocumentView, ownBranch: string | null) =>
  placeProposals(
    readingOrder(
      doc.blocks,
      state.retiredOpen ? state.retired : [],
      state.promptsOpen,
      state.retiredOpen ? (state.proposals?.rejected ?? []) : [],
    ),
    shownProposalsOf(state, ownBranch),
    // The block being edited keeps its row under the caret. CA_0055_005
    state.activeBlockId,
  );

/** Every order key the document knows, drawn or not: its blocks, prompts
 * among them, the retired ones read, and every open proposal's,
 * shown or hidden — the bound a new block is placed under, so a row the
 * reader cannot see still follows it. DO_0016_001 */
const knownKeys = (state: DocumentState): string[] =>
  [
    ...(state.document?.blocks ?? []).map((block) => block.order),
    ...state.retired.map((block) => block.order),
    ...(state.proposals?.groups ?? []).flatMap((group) => group.items.map((item) => item.block?.order ?? "")),
  ].filter((key) => key !== "");

export interface DocumentState {
  /** Every item the replayed run staged, as it staged them; the ones its
   * replay has reached so far stand in `proposals`. Absent outside a replay.
   * BO_0340_008 */
  replayItems?: ProposedChange[];
  /** Counts saves refused because documents came under separation of
   * duties; the branch line enters the proposal on each. BO_0212_011 */
  policyRefusals?: number;
  /** The save that refusal turned away, kept for the retry: a save made on
   * leaving the block lets the block go before the retry runs. BO_0212_011 */
  policyRefused?: { readonly blockId: string; readonly baseRevisionId: string; readonly runs: Run[]; readonly role: TextRole } | undefined;
  document: DocumentView | null;
  /** The line count of each code block as it is being written, keyed by
   * block, so the blocks below it re-number under the caret (`BO_0302_006`);
   * a block absent here counts as the read holds it. */
  codeLines: Record<string, number>;
  retired: BlockView[];
  retiredOpen: boolean;
  /** Whether the blocks sent as prompts are drawn where they sit, and blocks
   * kept as content after a send carry the prompt glyph. BO_0267_015 */
  promptsOpen: boolean;
  /** The blocks a run the person may see was sent from. BO_0267_015 */
  sources: string[];
  /** The proposed changes standing unanswered against this document. They are
   * read whether or not the toggle is on, because the panel says how many are
   * waiting and a toggle that hid that would leave a reader no way to learn
   * work was there. */
  proposals: DocumentProposals | null;
  proposalsOpen: boolean;
  /** The working mode last sent in the document by this person: a block's
   * command line starts from it, and the console and a gesture carry it.
   * BO_0306_010 DO_0025_003 */
  mode: WorkingMode;
  /** The document's runs the person may see, as its run list answers them:
   * a block's command choices read back from them. DO_0025_002 */
  runs: SentRun[];
  status: "loading" | "ready" | "failed";
  /** True when the document this tab names is not in the graph any more, which
   * is what a stored tab naming a deleted document arrives as. */
  missing: boolean;
  notice: string | null;
  /** The block a drop has just nested into another, while the `nested` place
   * stands under the target: an extension asks there what the nest means.
   * BO_0349_010 */
  nested: { readonly targetId: string; readonly blockId: string; readonly documentId: string } | null;
  /** How often this document has changed and when it last did, as the panel
   * reports them. Read separately from the document so a save can refresh the
   * count without paying to read every block again. */
  changes: ChangeSummary | null;
  /** The save state this view last reported, mirrored so the panel can state
   * it beside the document's other facts. The shell header reads the same
   * channel; this is not a second answer, it is the same one kept to hand. */
  saveState: SaveState | null;
  activeBlockId: string | null;
  /** The block whose depth is revealed: a fact within reading, like the
   * active block, cleared when the tab is left, by command mode and by
   * activation, never persisted. CA_0046_001 */
  focusedBlockId: string | null;
  /** What the target's blocks have opened as focused work. The shell answers
   * it; this view reads it as the document enters reading presentation and
   * draws the faces. CA_0065_010 DO_0029_001 */
  faces: FocusedWork | null;
  /** The proposal the reader has turned to, when it is a proposal rather
   * than a block: the bar's block groups act on it, accepting it first.
   * The two are exclusive and follow the same rules. DO_0006_004 */
  focusedItemId: string | null;
  /** The proposal whose text holds the caret. A proposal being edited is a
   * block being edited for every rule about what hovering may take: nothing
   * is taken from under the reader's hands. DO_0006_008 */
  editingItemId: string | null;
  /** Rises whenever the document is read again, so the painter knows the
   * element under it is new even when the active block has not changed. */
  loaded: number;
  /** The shell's count of ended runs as this view last acted on it, so a run
   * that ended before the view was opened is not acted on again when it is.
   * BO_0226_007 */
  proposedSeen: number;
  /** The last reveal request this view has looked at. CA_0039_005 */
  revealSeen: number;
  /** The reader's run in this document, as the shell last handed it over,
   * and the count it came with. BO_0265_012 */
  activitySeen: number;
  /** The reader's runs in this document, side by side. BO_0269_018 */
  runActivities: RunActivity[];
  /** The groups the reader's runs staged into here, shown without the
   * toggle. BO_0265_012 */
  liveGroups: string[];
  /** The blocks the agent is reading, each until its mark goes. BO_0265_013 */
  agentReads: Record<string, ReadMark>;
  /** The last *Reject all* or *Accept all* this view has answered. BO_0265_014 */
  answerAllSeen: number;
  /** The changes a run chip showed while *Show proposed changes* is off, or
   * hid while it is on, and the last chip press this view has answered. The
   * tab's, never kept across a reload. CA_0055_006 */
  shownGroups: string[];
  hiddenGroups: string[];
  /** The cards the reader unfolded with a pinch in, each row then answered on
   * its own; held per tab and never stored. BO_0350_003 */
  unfoldedCards: string[];
  /** What Hermes arranged on the document for the reader: the cards drawn,
   * the blocks collapsed and dimmed. Read with the proposals. BO_0350_005 */
  arrangement: Arrangement;
  toggleRunSeen: number;
  /** The person's proposal sessions as the branch component keeps them: the
   * one the tab works in, whether someone else accepts, the open ones, and
   * the last thing the bar's toggle or a session chip asked. CA_0057_005
   * CA_0057_008 */
  branchGroup: string | null;
  branchRequired: boolean;
  sessions: ProposalSession[];
  branchAsk: BranchAsk;
}

/** Where a gesture leaves the editor: the block, and where in it the caret
 * lands. `saved` and `failure` put a block back as a refused save leaves it,
 * which is how a split the graph refused is folded back. CA_0045_005 */
interface Focus {
  readonly blockId: string;
  readonly offset: number | "end";
  readonly until?: number;
  readonly saved?: Run[];
  readonly failure?: string;
}

/**
 * A split drawn on screen and not yet landed: the head's words as they stood
 * when Enter was pressed, what the graph holds of them and at which revision,
 * and the identity the tail was drawn under. CA_0045_005
 */
interface PendingSplit {
  readonly headId: string;
  readonly tailId: string;
  readonly at: number;
  readonly headRuns: Run[];
  readonly headSaved: Run[];
  readonly headBase: string;
  readonly role: TextRole;
}

/**
 * Who proposed a started document, beside its title: the proposer's face as
 * its proposals carry it, and *Proposed by «proposer»*. Gone once the
 * document is taken. BO_0251_010
 */
const StartedBy = component$<{ proposer: Proposer }>(({ proposer }) => {
  const face = faceOf(proposer);
  return (
    <span class="document-title__proposed" data-document-proposed data-proposal-tone={toneOf(proposer)}>
      <span class="document-title__face" aria-hidden="true">
        {face.kind === "image" ? (
          <img src={face.src} alt="" width={20} height={20} draggable={false} />
        ) : (
          <Icon name={face.icon} size={12} />
        )}
      </span>
      Proposed by {proposerName(proposer)}
    </span>
  );
});

/** The active block's transient editing state. */
export interface EditorState {
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
  /** The inline equation whose popover is open, by its place among the
   * blocks math runs; null when none is. BO_0290_025 */
  mathAt: number | null;
  /** The citation whose locator popover is open, by its place among the
   * block's citations; null when none is. BO_0291_034 */
  citeAt: number | null;
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
    mathAt: null,
  citeAt: null,
  saving: false,
  failure: null,
  timer: 0,
  stepped: 0,
  past: [],
  future: [],
  paint: 0,
  leaving: false,
});

/** Whether a document still holds a block, as a top-level block or a
 * callout's child. CA_0084_002 */
function holdsBlock(document: DocumentView, blockId: string): boolean {
  return document.blocks.some(
    (block) => block.blockId === blockId || (block.kind === "admonition" && block.children.some((child) => child.blockId === blockId)),
  );
}

export const BlockEditorView = component$<ViewProps>(({ tab }) => {
  const bridge = useContext(ViewBridgeContext);
  /** Whether this tab plays a finished run back (`BO_0340_008`): the
   * document as it stood, read-only, its command typed and its run unfolding
   * from the shell's replay rather than from a live run. Decided as the view
   * mounts, since a replay's tab is opened for it and closed with it. */
  const replaying = bridge.replay.tabId === tab.id && bridge.replay.runId !== null;
  const replayRun = replaying ? bridge.replay.runId : null;
  /** The crumbs whose block has moved away, by the document they name.
   * CA_0084_002 */
  const crumbs = useStore<{ gone: string[] }>({ gone: [] });
  const state = useStore<DocumentState>({
    document: null,
    codeLines: {},
    retired: [],
    retiredOpen: false,
    promptsOpen: false,
    sources: [],
    runs: [],
    proposals: null,
    proposalsOpen: false,
    mode: FIRST_MODE,
    status: "loading",
    missing: false,
    notice: null,
    nested: null,
    changes: null,
    saveState: null,
    activeBlockId: null,
    focusedBlockId: null,
    faces: null,
    focusedItemId: null,
    editingItemId: null,
    loaded: 0,
    proposedSeen: bridge.proposed.seq,
    // A reveal aimed at this document that no view has consumed — a chip
    // pressed for a reference into it from another document's prompt, which
    // brought this document forward — is acted on as this view mounts.
    // BO_0304_009
    revealSeen: bridge.reveal.itemId === tab.itemId && bridge.reveal.target !== null ? bridge.reveal.seq - 1 : bridge.reveal.seq,
    activitySeen: replaying ? -1 : bridge.activity.seq,
    runActivities: [],
    liveGroups: [],
    agentReads: {},
    answerAllSeen: bridge.answerAll.seq,
    shownGroups: [],
    hiddenGroups: [],
    unfoldedCards: [],
    arrangement: NO_ARRANGEMENT,
    toggleRunSeen: bridge.toggleRun.seq,
    branchGroup: null,
    branchRequired: false,
    sessions: [],
    branchAsk: { kind: null, group: null, seq: 0 },
  });
  /** The proposals an edit is accepting and handing over, and the pending
   * staging of an arrow-moved proposal's place. BO_0233_007 BO_0233_014 */
  /** The run chips this view last reported, so it reports again only when
   * they say something else. BO_0265_014 */
  const reportedChips = useSignal("");
  const admonitionPatterns = useStore<{ items: { id: string; name: string }[] }>({ items: [] });
  /** Asks the branch component for a session: the bar's toggle, and a session
   * chip's press and answers. Declared before every $ that calls it.
   * CA_0057_005 CA_0057_008 */
  const ask$ = $((kind: NonNullable<BranchAsk["kind"]>, group: string | null) => {
    state.branchAsk = { kind, group, seq: state.branchAsk.seq + 1 };
  });
  const proposalEdit = useStore({
    settling: [] as string[],
    timer: 0,
    /** A proposals read under way, and whether another is due after it: a
     * call while one runs waits for the one that follows rather than
     * starting its own, so a burst of calls costs at most two reads.
     * DO_0024_002 */
    reading: false,
    due: false,
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
    /** A proposal's arrow step drawn but not yet staged, while the presses
     * pause: an answer stages it first, so the proposal is accepted where the
     * reader sees it. DO_0004_008 */
    pending: null as { itemId: string; placement: ProposalPlacement } | null,
  });
  /** The blocks whose possible relations beyond the first two the reader
   * opened. BO_0247_005 */
  const relationsOpen = useStore({ blocks: [] as string[] });
  /** A pointer press under way on a reading row, so the focus the press takes
   * is left to the click to decide. CA_0046_001 */
  const pressing = useStore({ now: false });
  const editor = useStore<EditorState>(idleEditor());
  /** The splits drawn on screen and on their way to the graph, in the order
   * they were pressed, and whether they are being sent. CA_0045_005 */
  const splitting = useStore({
    pending: [] as PendingSplit[],
    draining: false,
    /** When the last split answered: the next is sent no sooner than the
     * kernel's floor after it, since it writes the tail and the document node
     * the last one just wrote. DO_0015_002 */
    answered: 0,
  });
  /** The view's own element. The load task reaches the page through it rather
   * than through the global `document`, which a render harness does not
   * install — so the editor can be pressed in one. BO_0227_006 */
  const root = useSignal<HTMLElement>();
  /** The saved admonition patterns the block-type picker lists, read again
   * when a pattern is saved. The page is reached through `root`, as the load
   * task reaches it, not through the global `window`: a render harness
   * installs none, and a task that throws there leaves the harness's
   * scheduler holding every later task. CA_0079_004 */
  useVisibleTask$(async ({ cleanup }) => {
    const refresh = async () => {
      const response = await fetch("/api/x/documents/patterns");
      if (!response.ok) return;
      const answer = await response.json() as { outcome: string; result?: { id: string; name: string }[] };
      admonitionPatterns.items = answer.result ?? [];
    };
    await refresh();
    const win = root.value?.ownerDocument.defaultView;
    if (win === null || win === undefined) return;
    const changed = () => { void refresh(); };
    win.addEventListener("admonition-patterns-updated", changed);
    cleanup(() => win.removeEventListener("admonition-patterns-updated", changed));
  });
  const tableFile = useSignal<HTMLInputElement>();
  /** The row *Import table* places below, or none for the end. DO_0016_003 */
  const importAfter = useSignal<RowTarget | null>(null);
  /** What *Capture* reaches where the shell runs, read in the browser; the
   * browser's picker *Files* opens off a device; the block captured files
   * land below, or none for the end. BO_0319_050 */
  const reach = useSignal<CaptureReach | null>(null);
  const captureFile = useSignal<HTMLInputElement>();
  const captureAfter = useSignal<string | null>(null);
  // eslint-disable-next-line qwik/no-use-visible-task -- where the shell runs is the browser's to ask
  useVisibleTask$(async () => {
    reach.value = await captureReach();
  });
  /** The title field, whose text one writer owns. DO_0012_002 */
  const titleField = useSignal<HTMLElement>();
  const documentHeader = useSignal<HTMLElement>();
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

  /**
   * The citation numbers after a save that carries one (`BO_0291_025`,
   * found by the user on 2026-09-24: a citation only ever read `[…]`): a
   * save writes the block and reads nothing back, so a work cited for the
   * first time had no number until the next full read. This reads the
   * document and takes its numbering, its missing works and its data
   * revision, leaving the blocks in hand alone.
   */
  const refreshCitations$ = $(async () => {
    if (documentId === null || state.document === null) return;
    const outcome = await fetchDocument(documentId);
    if (outcome.outcome !== "success" || state.document === null) return;
    const { citationNumbers: _numbers, missingWorks: _missing, citationLabels: _labels, ...kept } = state.document;
    const fresh = outcome.result;
    state.document = {
      ...kept,
      ...(fresh.citationLabels === undefined ? {} : { citationLabels: fresh.citationLabels }),
      ...(fresh.citationNumbers === undefined ? {} : { citationNumbers: fresh.citationNumbers }),
      ...(fresh.missingWorks === undefined ? {} : { missingWorks: fresh.missingWorks }),
      ...(fresh.dataRevision === undefined ? {} : { dataRevision: fresh.dataRevision }),
    };
  });

  const reloadChanges$ = $(async () => {
    if (documentId === null) return;
    const outcome = await fetchChanges(documentId);
    state.changes = outcome.outcome === "success" ? outcome.result : null;
  });

  /**
   * Takes `next` as the document in hand and, in the same step, puts the
   * editor where the gesture that produced it leaves the reader.
   *
   * One step with nothing awaited inside it, because the render after it is
   * what removes one editor and mounts the next. Idling the editor before a
   * read left a render with no editor at all while the read was on its way:
   * the focus fell to the page, and a phone's keyboard closed and opened again
   * on every Enter. The editor that was active stays mounted until the render
   * that mounts its successor, so the focus passes from one to the other.
   * CA_0045_003
   *
   * `"keep"` leaves the editor where it is unless its block is gone; `null`
   * ends editing. `counted` says the document was read from the graph, which
   * is what the panel's counts follow.
   */
  const adopt$ = $(
    (next: DocumentView, focus: Focus | "keep" | null, counted: boolean) => {
      state.document = next;
      state.status = "ready";
      state.missing = false;
      if (counted) state.loaded += 1;
      if (focus === "keep") {
        if (
          state.activeBlockId !== null &&
          !next.blocks.some((block) => block.blockId === state.activeBlockId)
        ) {
          state.activeBlockId = null;
        }
        return;
      }
      // A save the outgoing block's typing scheduled is not this block's to
      // make: after a refused split folds back, it would write the folded
      // words over the refusal. CA_0045_005
      if (editor.timer !== 0) {
        clearTimeout(editor.timer);
        editor.timer = 0;
      }
      const block =
        focus === null
          ? undefined
          : next.blocks.find((candidate) => candidate.blockId === focus.blockId);
      if (focus === null || block === undefined || !isText(block)) {
        Object.assign(editor, idleEditor());
        state.activeBlockId = null;
        bridge.inspector.text = null;
        return;
      }
      // A block a standing gather moves is not edited while the gather
      // stands: it is focused, and the gather is answered from its frame.
      // BO_0322_013
      if (gatheredBlocks(state.proposals).has(block.blockId)) {
        Object.assign(editor, idleEditor());
        state.activeBlockId = null;
        state.focusedBlockId = block.blockId;
        return;
      }
      Object.assign(editor, idleEditor());
      editor.blockId = block.blockId;
      editor.position =
        next.blocks.findIndex((candidate) => candidate.blockId === block.blockId) + 1;
      editor.runs = [...block.runs];
      editor.savedRuns = [...(focus.saved ?? block.runs)];
      editor.baseRevisionId = block.revisionId;
      editor.role = block.role;
      editor.failure = focus.failure ?? null;
      // The offsets may have been read from the reading element, which showed
      // the revision the document had in hand. A fresher block may be shorter,
      // so they are clamped rather than trusted.
      const length = runsLength(block.runs);
      const at =
        focus.offset === "end"
          ? length
          : Math.min(Math.max(0, focus.offset), length);
      const to =
        focus.until === undefined
          ? at
          : Math.min(Math.max(0, focus.until), length);
      editor.start = at;
      editor.end = to;
      editor.marks = marksAt(block.runs, at, to);
      editor.paint += 1;
      state.activeBlockId = block.blockId;
      state.focusedBlockId = null;
      state.focusedItemId = null;
      state.editingItemId = null;
      // The bar overlays the top of the surface, so a block under it would be
      // activated out of sight. `nearest` with the row's scroll margin scrolls
      // only far enough to clear the bar, and not at all when the block is
      // already clear of it. Activation changes no geometry, so the row is
      // already where it will be.
      // Through the view's own element, as the load task reaches the page
      // (`BO_0227_006`), so the render harness can activate a block too.
      root.value
        ?.querySelector(`[data-block-id="${block.blockId}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
      bridge.inspector.text = `${ROLE_LABEL[block.role]} block`;
    },
  );

  const reload$ = $(async () => {
    if (documentId === null) {
      state.status = "failed";
      state.notice = "This tab names no document.";
      return;
    }
    // A replay reads the document as it stood when its run started, and the
    // run's items as they were staged, once; it never reads the document as
    // it stands, nor tells the shell a mode. BO_0340_008
    if (replayRun !== null) {
      if (state.document !== null) return;
      const read = await fetchReplay(documentId, replayRun);
      if (read.outcome !== "success") {
        state.status = "failed";
        state.notice = describeOutcome(read);
        return;
      }
      state.replayItems = read.result.proposals.groups.flatMap((group) => [...group.items]);
      state.proposals = { ...read.result.proposals, unanswered: 0, groups: read.result.proposals.groups.map((group) => ({ ...group, items: [] })) };
      await adopt$(read.result.document, null, true);
      return;
    }
    // A read waits for the splits on their way: taken while one is under way,
    // it would not hold the block the reader is typing in. CA_0045_005
    await writesSettled(tab.id);
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
    await adopt$(outcome.result, "keep", true);
    // The person's working mode, read once with the document and told to the
    // shell, which hands it to every run the document starts. A read that
    // fails leaves the first mode in force, which is what the toggles show.
    // BO_0306_011 BO_0306_012
    const mode = await fetchWorkingMode(documentId);
    if (mode.outcome === "success") state.mode = mode.result;
    await bridge.setMode$(documentId, state.mode);
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
    // A replay's items are the run's as staged, and stand once the replay has
    // reached their staging: nothing is read again. BO_0340_008
    if (replayRun !== null) {
      if (state.proposals !== null && state.replayItems !== undefined) state.proposals = replayShown(state.proposals, state.replayItems, state.runActivities);
      return;
    }
    // A read already under way is not doubled: this call marks one more read
    // due and waits for it, and that read serves every call made meanwhile.
    // DO_0024_002
    if (proposalEdit.reading) {
      proposalEdit.due = true;
      while (proposalEdit.reading) await new Promise((resolve) => setTimeout(resolve, 20));
      return;
    }
    proposalEdit.reading = true;
    try {
      do {
        proposalEdit.due = false;
        // A read a local change overtook is read again, a few times at most; a
        // QRL cannot call itself, so the retry is a loop.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const read = ++proposalEdit.reads;
          const changes = proposalEdit.changes;
          // *Show removed* asks for the rejected proposals in the same read.
          // BO_0315_015
          const outcome = await fetchProposals(documentId, state.retiredOpen);
          if (outcome.outcome !== "success" || read !== proposalEdit.reads) break;
          if (changes === proposalEdit.changes && proposalEdit.settling.length === 0) {
            state.proposals = withoutItems(outcome.result, proposalEdit.answered);
            // What Hermes arranged is read beside what it arranges. BO_0350_005
            const arranged = await readArrangement(documentId);
            if (arranged.outcome === "success") state.arrangement = arranged.result;
            break;
          }
        }
      } while (proposalEdit.due);
    } finally {
      proposalEdit.reading = false;
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
  /** The save itself, once it is this save's turn. */
  const write$ = $(async (keepalive: boolean): Promise<boolean> => {
    // A block drawn by a split still on its way has no revision to name until
    // the split lands. A refusal meanwhile folds it back and moves the editor,
    // and what the fold left is the refused save's to report, not this one's.
    // CA_0045_005
    const saving = editor.blockId;
    await writesSettled(tab.id);
    if (editor.blockId !== saving) return editor.failure === null;
    if (editor.baseRevisionId === PENDING_REVISION) return false;
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
      // Documents came under separation of duties while the tab was open:
      // the branch line takes the tab into the proposal and saves again.
      // BO_0212_011
      if (requiresProposal(outcome)) {
        state.policyRefused = { blockId, baseRevisionId: editor.baseRevisionId, runs: [...editor.runs], role: editor.role };
        state.policyRefusals = (state.policyRefusals ?? 0) + 1;
      }
      await report$("unsaved");
      return false;
    }
    editor.failure = null;
    editor.savedRuns = [...editor.runs];
    editor.baseRevisionId = outcome.result.revisionId;
    await report$("saved");
    if (editor.runs.some((run) => run.cite !== undefined) || state.document?.citationNumbers !== undefined) void refreshCitations$();
    return true;
  });

  const save$ = $(async (keepalive = false): Promise<boolean> => {
    if (editor.timer !== 0) {
      clearTimeout(editor.timer);
      editor.timer = 0;
    }
    // One save at a time: a save that arrives while one is on its way waits
    // for the answer, then compares against what that one saved, so a pause
    // and a leave in the same breath write the block once. Registered before
    // the first await, so two waiters do not both wake into a send.
    await savesSettled(tab.id);
    let done = () => {};
    const mine = new Promise<void>((resolve) => { done = resolve; });
    saving.set(tab.id, mine);
    try {
      return await write$(keepalive);
    } finally {
      if (saving.get(tab.id) === mine) saving.delete(tab.id);
      done();
    }
  });

  /**
   * The save separation of duties refused, made again once the tab is in the
   * branch. A block still active saves as it would; a block let go on leaving
   * sends what it held, since the leave already dropped it. BO_0212_011
   */
  const retryRefused$ = $(async (): Promise<boolean> => {
    const refused = state.policyRefused;
    state.policyRefused = undefined;
    if (refused === undefined || documentId === null) return true;
    if (editor.blockId === refused.blockId) return save$();
    const outcome = await sendCommand(documentId, { command: "revise", ...refused });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      await report$("unsaved");
      return false;
    }
    await reload$();
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

  /** The document as the graph holds it now, for a structural command to
   * reach for: the command that just ran changed the revision this one must be
   * based on. It leaves the document in hand alone, so a gesture replaces that
   * once, when it hands the editor on. CA_0045_003 */
  const freshDocument$ = $(async (): Promise<DocumentView | undefined> => {
    if (documentId === null) return undefined;
    await writesSettled(tab.id);
    const outcome = await fetchDocument(documentId);
    return outcome.outcome === "success" ? outcome.result : undefined;
  });

  const activate$ = $(
    async (blockId: string, offset: number | "end", until?: number) => {
      if (editor.blockId !== null && editor.blockId !== blockId) {
        if (!(await save$())) return;
      }
      // Read the block as the graph now holds it. The document in hand may
      // predate this session's own saves, and activating from a stale revision
      // would show text that is no longer there and conflict on the next write.
      const next = (await freshDocument$()) ?? state.document;
      const block = next?.blocks.find((candidate) => candidate.blockId === blockId);
      if (next == null || block === undefined || !isText(block)) return;
      await adopt$(
        next,
        until === undefined ? { blockId, offset } : { blockId, offset, until },
        false,
      );
      await bridge.setSelection$(blockId);
    },
  );

  /**
   * Reads the document after a write and hands the editor on in the same
   * step, or ends editing when the gesture leaves no block to hold. One read:
   * the handover takes the block from it rather than reading it again.
   * CA_0045_003
   */
  const readBack$ = $(async (focus: Focus | null) => {
    if (documentId === null) return;
    const read = await fetchDocument(documentId);
    if (read.outcome !== "success") {
      Object.assign(editor, idleEditor());
      state.activeBlockId = null;
      await reload$();
      return;
    }
    await adopt$(read.result, focus, true);
    if (focus !== null && editor.blockId === focus.blockId) {
      await bridge.setSelection$(focus.blockId);
    }
  });

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
  });
  useContextProvider(MarkingContext, marking);
  // The rows the reader's text selection marks, and the press the page is
  // in: while several rows are marked none is the bar's subject, and while
  // a press is under way no row takes the focus. DO_0023_002
  const selectionMarks = useMarkedRows({ root, marking: marking.store });
  /** A focus asked for during a press, given when the press ends — unless the
   * press marked several rows, which leaves every row unfocused. Redrawing a
   * row mid-press moves its words, and a selection started in them would lose
   * its start. DO_0023_001 */
  const deferredFocus = useStore({ blockId: null as string | null, itemId: null as string | null });

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
    // Taking a removal back restores the block where it was drawn.
    // BO_0315_012
    restore$: $(async (blockId: string, placement: RestorePlacement): Promise<boolean> => {
      if (documentId === null || !(await save$())) return false;
      const outcome = await sendCommand(documentId, { command: "restore", blockId, placement });
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return false;
      }
      state.notice = null;
      await reload$();
      if (state.retiredOpen) await reloadRetired$();
      return true;
    }),
    // *Take back* of an emptied focused work: the shell brings the child back
    // on its block, and the blocks that left it go back in — restored where
    // they were removed, moved back from where they were dragged. CA_0083_006
    bringBack$: $(async (work: EmptiedWork): Promise<boolean> => {
      if (documentId === null || !(await save$())) return false;
      const back = await bridge.bringBack$(work);
      if ("refusal" in back) {
        state.notice = back.refusal;
        return false;
      }
      state.notice = null;
      for (const blockId of work.left.blockIds) {
        const outcome = await sendCommand(
          back.itemId,
          work.left.wentTo === null
            ? { command: "restore", blockId, placement: { at: "end" } }
            : { command: "moveIn", blockId, fromDocumentId: work.left.wentTo, placement: { at: "end" } },
        );
        if (outcome.outcome !== "success") {
          state.notice = describeOutcome(outcome);
          break;
        }
      }
      await reload$();
      state.faces = await bridge.faces$(documentId);
      return true;
    }),
  });
  useContextProvider(StandingContext, standing);

  // A removal held for this document's *Take back* — its focused work went
  // in another view, or this tab turned to it — is offered here as the last
  // change. CA_0083_006
  useTask$(async ({ track }) => {
    const held = track(() => (documentId === null ? undefined : bridge.emptied.byParent[documentId]));
    if (held === undefined || documentId === null) return;
    const taken = await bridge.takeEmptied$(documentId);
    if (taken !== null) await standing.emptied$(taken);
  });

  // What each citation's hover card shows, read from the bibliography when
  // the document cites anything and again when it changes. BO_0291_026
  const citedWorks = useStore<CitedWorks>({ byWork: {}, numbers: {}, missing: [], labels: {} });
  useContextProvider(CitedWorksContext, citedWorks);
  // What an extension has to say over a block's words while it is read — a
  // keyword's mention — written by its provider and drawn by the reading
  // rows; a press on one is the extension's. BO_0301_015
  const inlineAnnotations = useStore<InlineAnnotations>({ sources: {}, version: 0, pressed: null });
  useContextProvider(InlineAnnotationsContext, inlineAnnotations);
  // A character an extension registers — keywords' `@` — which opens a list
  // while a text block is edited, as `#` does. BO_0310_011
  const inlineTriggers = useStore<InlineTriggers>({ triggers: {}, version: 0 });
  useContextProvider(InlineTriggersContext, inlineTriggers);
  // The document's numbering, handed to the editing surface and to the
  // proposals drawn beside it. BO_0291_025
  useTask$(({ track }) => {
    citedWorks.numbers = { ...(track(() => state.document?.citationNumbers) ?? {}) };
    citedWorks.missing = [...(track(() => state.document?.missingWorks) ?? [])];
    citedWorks.labels = { ...(track(() => state.document?.citationLabels) ?? {}) };
  });
  useVisibleTask$(async ({ track }) => {
    track(() => state.document?.dataRevision);
    const numbers = track(() => state.document?.citationNumbers);
    const documentId = state.document?.documentId;
    if (documentId === undefined || numbers === undefined || Object.keys(numbers).length === 0) return;
    try {
      const response = await fetch(`/api/x/bibliography/references?document=${encodeURIComponent(documentId)}`);
      if (!response.ok) return;
      const answer = (await response.json()) as { outcome?: string; result?: { references?: readonly CitedWorks["byWork"][string][] } };
      if (answer.outcome !== "success") return;
      const byWork: CitedWorks["byWork"] = {};
      for (const reference of answer.result?.references ?? []) byWork[reference.workId] = reference;
      citedWorks.byWork = byWork;
    } catch {
      // No card is drawn; the numbers still stand.
    }
  });


  /** Each block's command choices as this page holds them: *Keep as content*
   * and the working mode. DO_0025_002 DO_0025_003 */
  const commandChoices = useStore<{ byBlock: Record<string, CommandChoice> }>({ byBlock: {} });
  /** Holds a block's choices for the page and keeps them on the device. */
  const keepChoice$ = $((blockId: string, choice: CommandChoice) => {
    commandChoices.byBlock = { ...commandChoices.byBlock, [blockId]: choice };
    if (documentId === null) return;
    try {
      window.localStorage.setItem(commandChoiceKey(documentId, blockId), storedChoice(choice));
    } catch {
      // A device that keeps nothing still holds the choice for the page.
    }
  });
  /** *Keep as content* switched on one block. DO_0025_001 */
  const setKeep$ = $(async (blockId: string, keep: boolean) => {
    const choice = choiceIn(commandChoices.byBlock, state.runs, state.document, blockId, state.mode);
    await keepChoice$(blockId, { ...choice, keep, stored: true });
  });
  /** One axis of one block's mode switched; no other block changes and
   * nothing is written to the kernel until it is sent. DO_0025_003 */
  const switchCommandMode$ = $(async (blockId: string, axis: "field" | "work") => {
    const choice = choiceIn(commandChoices.byBlock, state.runs, state.document, blockId, state.mode);
    await keepChoice$(blockId, { ...choice, mode: switched(choice.mode, axis), stored: true });
  });

  /**
   * A pinch on a block (`BO_0322`): a run with no words, zooming in to
   * deepen the block or out to gather its neighbours into its focused work,
   * in the pinch's own mode, on the agent and speed the command line shows.
   * Nothing is written to the block's standing or its remembered choices. A
   * refusal is said where the document says what went wrong. BO_0322_010
   * BO_0322_012
   */
  const pinch$ = $(async (pinch: "in" | "out", blockId: string): Promise<SentCommand> => {
    if (documentId === null) return { ok: false, error: "The document is not open." };
    const sent = await bridge.sendPinch$({ itemId: documentId, blockId, pinch, mode: PINCH_MODE[pinch] });
    if (!sent.ok) state.notice = sent.error;
    // A pinch Hermes prepared for is answered by a run that has staged
    // already: its card is read at once rather than when the run reports.
    // BO_0350_008
    else void reloadProposals$();
    return sent;
  });

  /** A pinch in on a card of one proposal: the proposal deepened, as the
   * reader saw it. BO_0350_014 */
  const pinchProposal$ = $(async (item: ProposedChange): Promise<SentCommand> => {
    if (documentId === null) return { ok: false, error: "The document is not open." };
    const revisionId = item.block?.revisionId ?? "";
    const sent = await bridge.sendPinch$({
      itemId: documentId,
      blockId: item.blockId,
      pinch: "in",
      mode: PINCH_MODE.in,
      proposal: { group: item.groupId, item: item.itemId, revisionId },
    });
    if (!sent.ok) state.notice = sent.error;
    else void reloadProposals$();
    return sent;
  });

  /**
   * Sends a block as a command. The block being edited is saved first and
   * stays edited, so the revision sent is the one the graph holds; a block
   * not being edited — the prompt pointed from — is sent as the document
   * read it. On success a plain *Send* makes the block a prompt, which leaves
   * the flow, and *keep as content* writes nothing; a refusal writes nothing.
   * BO_0267_012
   */
  const sendBlock$ = $(async (blockId: string, asPrompt: boolean, attachments: readonly AttachmentDescriptor[]): Promise<SentCommand & { readonly note?: string }> => {
    if (documentId === null) return { ok: false, error: "The document is not open." };
    // The command's own mode, chosen on its line. DO_0025_003
    const choice = choiceIn(commandChoices.byBlock, state.runs, state.document, blockId, state.mode);
    let revisionId: string;
    let runs: readonly Run[];
    if (editor.blockId === blockId) {
      if (!(await save$())) return { ok: false, error: editor.failure ?? "The block could not be saved, so it was not sent." };
      revisionId = editor.baseRevisionId;
      runs = editor.runs;
    } else {
      const held = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
      if (held === undefined || held.kind !== "text") return { ok: false, error: "Only a block of text can be sent as a command." };
      revisionId = held.revisionId;
      runs = held.runs;
    }
    // A prompt's references go as `#n`, the number of the mark standing on
    // each now; one no mark stands on is refused here, as a dangling `#n` is
    // by the shell (`BO_0352_007`). A prompt whose marks the page has not
    // read takes them from its words (`BO_0352_013`).
    const marks = promptMarks(marking.store, blockId) ?? runs.flatMap((entry) => (entry.markRef === undefined ? [] : [entry.markRef]));
    const unbound = unboundMarks(runs, marks);
    if (unbound.length > 0) {
      return { ok: false, error: `${unbound.map((number) => `#${number}`).join(", ")} ${unbound.length === 1 ? "names" : "name"} nothing marked. Mark it again, or take it out of the command.` };
    }
    const words = commandWords(runs, marks);
    if (words.trim() === "") return { ok: false, error: "Write the command in the block before sending it." };
    // What the block's command places set on it — the profile its chip
    // chose. BO_0311_030
    const options = optionsOf(bridge.commandOptions, documentId, blockId);
    const sent = await bridge.sendCommand$({
      itemId: documentId,
      source: { block: blockId, revisionId },
      words,
      attachments,
      mode: choice.mode,
      ...(Object.keys(options).length === 0 ? {} : { options }),
    });
    if (!sent.ok) return sent;
    if (!state.sources.includes(blockId)) state.sources = [...state.sources, blockId];
    if (marking.store.marking.mode === "command") await marking.point$(null);
    if (asPrompt) await standing.setStanding$(blockId, "prompt");
    // The block remembers how it was sent, and its mode is now the one the
    // document last sent: the start of a block never sent, and what the
    // console and a gesture carry. DO_0025_002 DO_0025_003 DO_0025_009
    await keepChoice$(blockId, { keep: !asPrompt, mode: choice.mode, stored: true });
    state.mode = choice.mode;
    await bridge.setMode$(documentId, choice.mode);
    const written = await sendWorkingMode(documentId, choice.mode);
    if (written.outcome !== "success") {
      return { ...sent, note: `Sent. The mode it carried could not be kept as the document's last: ${describeOutcome(written)}` };
    }
    return sent;
  });

  /** The files each block's command carries, kept for the page. BO_0267_012 */
  const commandFiles = useStore<{ byBlock: Record<string, AttachmentHolder> }>({ byBlock: {} });
  useTask$(({ track }) => {
    const active = track(() => state.activeBlockId);
    if (active !== null && commandFiles.byBlock[active] === undefined) {
      commandFiles.byBlock = { ...commandFiles.byBlock, [active]: { attachments: [], attachNotice: null } };
    }
  });

  // A block's command choices, from the device, once it is edited or pointed
  // from: what the person chose there wins over what was sent. DO_0025_002
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const active = track(() => state.activeBlockId);
    const prompt = track(() => (marking.store.marking.mode === "command" ? marking.store.prompt : null));
    if (documentId === null) return;
    for (const blockId of [active, prompt]) {
      if (blockId === null || commandChoices.byBlock[blockId] !== undefined) continue;
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(commandChoiceKey(documentId, blockId));
      } catch {
        raw = null;
      }
      const stored = readStoredChoice(raw);
      if (stored.keep === undefined && stored.mode === undefined) continue;
      const block = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
      commandChoices.byBlock = {
        ...commandChoices.byBlock,
        [blockId]: resolveChoice(stored, state.runs, blockId, block !== undefined && "standing" in block ? String(block.standing) : undefined, state.mode),
      };
    }
  });

  // The block being edited is the prompt the marks belong to. BO_0267_013
  useTask$(async ({ track }) => {
    const active = track(() => state.activeBlockId);
    if (active !== null) await marking.selectPrompt$(active);
  });

  // The blocks runs were sent from, for *Show prompts*: read with the
  // document and whenever a run aimed at it ends. BO_0267_015
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const status = track(() => state.status);
    track(() => bridge.proposed.seq);
    if (documentId === null || status !== "ready") return;
    try {
      const response = await fetch(`/api/runs?artifact=${encodeURIComponent(documentId)}`);
      if (!response.ok) return;
      const body = (await response.json()) as { runs?: SentRun[] };
      state.runs = [...(body.runs ?? [])];
      state.sources = [...new Set(state.runs.flatMap((run) => (run.source === null ? [] : [run.source])))];
    } catch {
      // The glyph is a convenience: a read that fails leaves the ones known.
    }
  });

  // Entering command mode clears the focus as it clears the active block:
  // focus is a reading-mode fact. CA_0046_001
  useTask$(({ track }) => {
    const mode = track(() => marking.store.marking.mode);
    if (mode === "command") {
      state.focusedBlockId = null;
      state.focusedItemId = null;
      state.editingItemId = null;
    }
  });

  /**
   * Focuses a block. What a decoration reads when a block is focused is its
   * own to read: it watches this through the editor's surface, so focusing
   * stays the gesture it is. CA_0046_001 BO_0256_011
   */
  const focus$ = $(async (blockId: string) => {
    if (selectionMarks.pressed) {
      deferredFocus.blockId = blockId;
      deferredFocus.itemId = null;
      return;
    }
    state.focusedItemId = null;
    if (state.focusedBlockId === blockId) return;
    state.focusedBlockId = blockId;
  });

  // Read all focused-work faces once the document is available. This visible
  // task starts after the reading surface has rendered, so a slow answer
  // cannot hold the page or block activation (`DO_0001`). DO_0029_001
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const status = track(() => state.status);
    const faces = track(() => state.faces);
    if (documentId === null || status !== "ready" || faces !== null) return;
    try {
      state.faces = await bridge.faces$(documentId);
    } catch {
      // A missing face is only a convenience; the control can still open it.
    }
  });

  /**
   * Presses one of the shell's own block controls — *Open as focused work* is
   * the one there is. The shell opens or finds the child and opens it in a tab
   * of its own; a refusal is shown as the editor's notice. CA_0065_009
   * CA_0073_003
   */
  const pressBlockControl$ = $(async (control: string, blockId: string) => {
    if (documentId === null || state.document === null) return;
    const refusal = await bridge.pressBlockControl$(control, {
      itemId: documentId,
      blockId,
      title: state.document.title,
      route: routeOf(tab, state.document.title),
    });
    state.notice = refusal;
  });

  /** Focuses a proposal instead of a block: the bar's block groups act on
   * a proposal the reader has turned to as they act on a block, and the two
   * focuses are one, so focusing either lets the other go. DO_0006_004 */
  const focusItem$ = $((itemId: string) => {
    if (selectionMarks.pressed) {
      deferredFocus.itemId = itemId;
      deferredFocus.blockId = null;
      return;
    }
    if (state.focusedItemId === itemId) return;
    state.focusedItemId = itemId;
    state.focusedBlockId = null;
  });

  /** A withdrawn proposal's successor, shown: its group joins what is shown
   * without taking anything away, the successor is focused, and its row is
   * scrolled into view once drawn. A successor already answered is said in a
   * notice. User decision, 2026-09-23. BO_0286_012 */
  const revealSuccessor$ = $(async (itemId: string) => {
    const items = state.proposals?.groups.flatMap((group) => group.items) ?? [];
    const withdrawn = items.find((candidate) => candidate.itemId === itemId);
    const successorId = withdrawn?.withdrawal?.successor;
    if (successorId === undefined) return;
    const successor = items.find((candidate) => candidate.itemId === successorId);
    if (successor === undefined) {
      state.notice = "The proposal that replaced this one has been answered already.";
      return;
    }
    if (!groupShown(successor.groupId, state)) {
      const next = revealGroup(successor.groupId, state);
      state.shownGroups = [...next.shownGroups];
      state.hiddenGroups = [...next.hiddenGroups];
    }
    state.focusedItemId = successorId;
    state.focusedBlockId = null;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = root.value?.querySelector(`[data-proposal-id="${successorId}"]`);
    if (row !== null && row !== undefined) {
      if (typeof (row as HTMLElement).scrollIntoView === "function") (row as HTMLElement).scrollIntoView({ block: "center" });
      (row as HTMLElement).focus?.();
    }
  });

  /** A rest of the pointer on a row, which focuses it unless something is
   * being edited. The rows measure the rest; the rule is here, so a block
   * row and a proposal row keep one rule between them. DO_0006_008 */
  const hoverFocus$ = $((blockId: string | null, itemId: string | null) => {
    // Nothing is taken while a block or a proposal is being edited, and
    // nothing outside reading. A plain helper would be a function captured
    // by this QRL, which cannot cross the boundary.
    if (editor.blockId !== null || state.editingItemId !== null) return;
    if (marking.store.marking.mode !== "reading") return;
    // Nothing is taken during a press or while a selection marks several
    // rows: the row the selection started in would be drawn again under it.
    // DO_0023_001 DO_0023_002
    if (selectionMarks.pressed || marksSeveral(selectionMarks.rows)) return;
    if (itemId !== null) {
      if (state.focusedItemId === itemId) return;
      state.focusedItemId = itemId;
      state.focusedBlockId = null;
      return;
    }
    if (blockId === null || state.focusedBlockId === blockId) return;
    state.focusedItemId = null;
    state.focusedBlockId = blockId;
  });

  /** The focus a press asked for, given once it ends — unless it marked
   * several rows. DO_0023_001 */
  useTask$(({ track }) => {
    const pressed = track(() => selectionMarks.pressed);
    if (pressed) return;
    const { blockId, itemId } = deferredFocus;
    deferredFocus.blockId = null;
    deferredFocus.itemId = null;
    if (marksSeveral(selectionMarks.rows)) return;
    if (itemId !== null) void focusItem$(itemId);
    else if (blockId !== null) void focus$(blockId);
  });

  /** A proposal's text taking or losing the caret. While it holds one the
   * proposal is what the bar acts on, and hovering takes nothing.
   * DO_0006_008 */
  const editItem$ = $((itemId: string, editing: boolean) => {
    if (editing) {
      state.editingItemId = itemId;
      state.focusedItemId = itemId;
      state.focusedBlockId = null;
      return;
    }
    if (state.editingItemId === itemId) state.editingItemId = null;
  });


  /**
   * Goes back along the route to the crumb at `index`: that document's tab
   * becomes active, or it opens in a tab of its own with the route popped to
   * it, and the block that was opened from there is focused once it shows.
   * This tab stays as it is. CA_0047_004 CA_0073_003
   */
  const back$ = $(async (index: number) => {
    const route = routeOf(tab, state.document?.title);
    const target = route[index];
    if (target === undefined || index >= route.length - 1) return;
    const landing = target.blockId !== undefined && !crumbs.gone.includes(target.itemId);
    await bridge.openAlongRoute$({
      itemId: target.itemId,
      title: target.title,
      route: route.slice(0, index + 1),
      ...(landing ? { focus: target.blockId } : {}),
    });
  });

  /**
   * The crumbs whose block no longer stands in the document they name — a
   * block moved into another document takes its focused work along, and a
   * route stored before the move still runs through the old parent. Each
   * crumb that carries a block reads its document once the route is known;
   * one whose read fails is left as it is, since nothing says its block went.
   * Read after the render, so the route line never waits on it. CA_0084_002
   */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const route = track(() => routeOf(tab));
    const gone: string[] = [];
    for (const entry of route.slice(0, -1)) {
      if (entry.blockId === undefined) continue;
      const read = await fetchDocument(entry.itemId);
      if (read.outcome === "success" && !holdsBlock(read.result, entry.blockId)) gone.push(entry.itemId);
    }
    crumbs.gone = gone;
  });

  /**
   * The prompt the pointing session names, edited again once the document
   * is read: coming back to the prompt's tab after marking in another
   * document finds the prompt being edited and pointing, as it was left —
   * while pointing, the prompt stays edited (`BO_0267_023`), and the view
   * that mounts into a standing pointing keeps that true (`BO_0304_018`,
   * the second walk's finding, 2026-09-25). Not on every change of the marks:
   * only the session's document and prompt are tracked.
   */
  useTask$(async ({ track }) => {
    track(() => state.loaded);
    const named = track(() => bridge.pointing.documentId);
    const prompt = track(() => bridge.pointing.prompt);
    if (state.document === null || documentId === null || named !== documentId || prompt === null) return;
    if (state.activeBlockId === prompt || !state.document.blocks.some((block) => block.blockId === prompt)) return;
    await activate$(prompt, "end");
  });

  /** The block the shell asked this view to land on, focused once the
   * document is read — a return along the route. CA_0047_004 */
  useTask$(({ track }) => {
    track(() => state.loaded);
    track(() => bridge.focus.seq);
    if (state.document === null || documentId === null) return;
    if (bridge.focus.itemId !== documentId || bridge.focus.blockId === null) return;
    const blockId = bridge.focus.blockId;
    bridge.focus.blockId = null;
    void focus$(blockId).then(() => {
      const row = root.value?.querySelector(`[data-block-id="${blockId}"]`);
      if (row !== null && row !== undefined && typeof (row as HTMLElement).scrollIntoView === "function") {
        (row as HTMLElement).scrollIntoView({ block: "center" });
      }
    });
  });









  // Passages on the page: the selection in command mode and where each
  // passage's number is drawn. BO_0227_009
  const passages = usePassages({ root, surface: state, marking: marking.store });
  useContextProvider(PassagesContext, passages);

  /**
   * A write that took the last block out of a focused work answers what went
   * (`emptied`); the shell turns its tabs and holds *Take back* for the
   * parent, and `left` says how to put the block back. CA_0083_005
   */
  const reportEmptied$ = $(
    async (outcome: { readonly outcome: string; readonly result?: unknown }, left: EmptiedWork["left"]) => {
      const emptied = emptiedOf(outcome);
      if (emptied === null) return;
      await bridge.focusedWorkEmptied$({ ...emptied, left });
    },
  );

  /**
   * Runs one structural command, then reads the document back and hands the
   * editor on in the same step. A refused command leaves the document exactly
   * as it was, so the read is what shows whether anything happened.
   */
  const structural$ = $(
    async (command: Record<string, unknown>, focus: Focus | null): Promise<boolean> => {
      if (documentId === null) return false;
      if (!(await save$())) return false;
      const outcome = await sendCommand(documentId, command);
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return false;
      }
      state.notice = null;
      await readBack$(focus);
      if (state.retiredOpen) await reloadRetired$();
      await reportEmptied$(outcome, leftBy(command, documentId));
      return true;
    },
  );

  /** A new block directly below a drawn row — a block of any kind, standing
   * or state, a revealed removed row, or a proposal, which
   * stays open (DO_0016_003). The placement is worked out after the save, so
   * it reads the rows the save left. */
  const insert$ = $(async (kind: "text" | "divider" | "table" | "code" | "equation" | "admonition" | "image", below: RowTarget) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const doc = state.document;
    const placement =
      doc === null
        ? typeof below === "object" && "blockId" in below
          ? { after: below.blockId }
          : { at: "end" as const }
        : belowPlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), below, knownKeys(state));
    let admonitionBlock: { kind: "admonition"; patternId: string; children: { kind: "text"; runs: { text: string }[] }[] } | null = null;
    if (kind === "admonition") {
      const response = await fetch("/api/x/documents/patterns");
      const answer = response.ok ? await response.json() as { outcome: string; result?: { id: string }[] } : null;
      const first = answer?.result?.[0];
      if (!first) { state.notice = "Create an admonition pattern in the left panel first."; return; }
      admonitionBlock = { kind: "admonition", patternId: first.id, children: [{ kind: "text", runs: [{ text: "Write your callout…" }] }] };
    }
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block:
        kind === "divider"
          ? { kind: "divider" }
          : kind === "table"
            ? { kind: "table", ...emptyTable() }
            : kind === "code"
              ? { kind: "sourcecode", source: "" }
              : kind === "equation"
                ? { kind: "equation", tex: "x" }
                : kind === "image"
                  ? { kind: "image" }
                : kind === "admonition"
                ? admonitionBlock!
                : { kind: "text", runs: [] },
      placement,
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    const created = outcome.result.blockId;
    await readBack$(kind === "text" ? { blockId: created, offset: 0 } : null);
  });

  /**
   * A table revised whole (`BO_0287_011`): one `reviseTable` on the block's
   * base revision, the document read back so the row shows the revision it
   * now stands at. Answers the refusal in words, which the table names on
   * itself, or nothing.
   */
  /**
   * Marks a block as source code (`BO_0289_021`): the block's words become a
   * code block in its place and the text block is retired, one write. The
   * edit is settled first, so the words that turn are the ones typed.
   */
  const turnIntoCode$ = $(async (on: string) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    await writesSettled(tab.id);
    const held = state.document?.blocks.find((candidate) => candidate.blockId === on);
    if (held === undefined || !isText(held)) return;
    const outcome = await sendCommand(documentId, { command: "turnIntoCode", blockId: on, baseRevisionId: held.revisionId });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$(null);
  });

  const turnIntoImage$ = $(async (on: string) => {
    if (documentId === null) return;
    if (editor.blockId === on && !(await save$())) return;
    await writesSettled(tab.id);
    const held = state.document?.blocks.find((candidate) => candidate.blockId === on);
    if (held === undefined || !isText(held)) return;
    const outcome = await sendCommand(documentId, { command: "turnIntoImage", blockId: on, baseRevisionId: held.revisionId });
    if (outcome.outcome !== "success") { state.notice = describeOutcome(outcome); return; }
    state.notice = null;
    await readBack$(null);
  });

  const turnIntoAdmonition$ = $(async (on: string, patternId: string) => {
    if (documentId === null) return;
    if (editor.blockId === on && !(await save$())) return;
    await writesSettled(tab.id);
    const held = state.document?.blocks.find((candidate) => candidate.blockId === on);
    if (held === undefined || !isText(held)) return;
    const outcome = await sendCommand(documentId, { command: "turnIntoAdmonition", blockId: on, baseRevisionId: held.revisionId, patternId });
    if (outcome.outcome !== "success") { state.notice = describeOutcome(outcome); return; }
    state.notice = null;
    await readBack$(null);
  });

  const setAdmonitionPattern$ = $(async (on: string, patternId: string) => {
    if (documentId === null) return;
    await writesSettled(tab.id);
    const held = state.document?.blocks.find((candidate) => candidate.blockId === on);
    if (held === undefined || held.kind !== "admonition") return;
    const outcome = await sendCommand(documentId, { command: "setAdmonitionPattern", blockId: on, baseRevisionId: held.revisionId, patternId });
    if (outcome.outcome !== "success") { state.notice = describeOutcome(outcome); return; }
    state.notice = null;
    await readBack$(null);
  });

  /** A code block revised whole: its source and language. BO_0289_018 */
  const reviseCode$: ReviseCode = $(
    async (blockId: string, baseRevisionId: string, source: string, language: string | undefined): Promise<string | null> => {
      if (documentId === null) return "No document.";
      await writesSettled(tab.id);
      const outcome = await sendCommand(documentId, {
        command: "reviseCode",
        blockId,
        baseRevisionId,
        source,
        ...(language === undefined ? {} : { language }),
      });
      if (outcome.outcome !== "success") return describeOutcome(outcome);
      state.notice = null;
      await readBack$(null);
      return null;
    },
  );

  const reviseTable$ = $(
    async (
      blockId: string,
      baseRevisionId: string,
      columns: readonly TableColumn[],
      rows: readonly (readonly string[])[],
      caption: string | undefined,
    ): Promise<string | null> => {
      if (documentId === null) return "No document.";
      await writesSettled(tab.id);
      const outcome = await sendCommand(documentId, {
        command: "reviseTable",
        blockId,
        baseRevisionId,
        columns,
        rows,
        ...(caption === undefined ? {} : { caption }),
      });
      if (outcome.outcome !== "success") return describeOutcome(outcome);
      state.notice = null;
      await readBack$(null);
      return null;
    },
  );

  /**
   * An equation revised whole from its popover (`BO_0290_016`): the source,
   * the caption and the ask for a number, on the block base the row drew. A
   * source that cannot be set is saved all the same — the block draws it as
   * itself — because refusing to save would lose what the person wrote.
   */
  const reviseEquation$ = $(
    async (blockId: string, draft: { tex: string; caption?: string | undefined; numbered?: boolean | undefined }): Promise<void> => {
      if (documentId === null) return;
      const held = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
      if (held === undefined) return;
      await writesSettled(tab.id);
      const outcome = await sendCommand(documentId, {
        command: "reviseEquation",
        blockId,
        baseRevisionId: held.revisionId,
        tex: draft.tex,
        ...(draft.caption === undefined ? {} : { caption: draft.caption }),
        ...(draft.numbered === undefined ? {} : { numbered: draft.numbered }),
      });
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      state.notice = null;
      await readBack$(null);
    },
  );

  /**
   * The document's own citation style chosen in the bar (`BO_0291_037`): the
   * style's id, or `default` to follow the instance's default again, written
   * on the document's base with `setCitationStyle`, the document read back so
   * every citation and the reference list take the style.
   */
  const chooseCitationStyle$ = $(async (chosen: string) => {
    if (documentId === null || state.document === null) return;
    const style = chosen === "default" ? null : chosen;
    if (style === (state.document.citationStyle ?? null)) return;
    await writesSettled(tab.id);
    const outcome = await sendCommand(documentId, { command: "setCitationStyle", baseRevisionId: state.document.revisionId, style });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$(null);
  });

  /**
   * The document's formatting switch, *Format code* in the bar
   * (`BO_0296_021`): written on the document's base with `setFormatCode`
   * and the document read back. It governs what happens next — a settle, an
   * acceptance — and reformats nothing that already stands.
   */
  const setFormatCode$ = $(async (on: boolean) => {
    if (documentId === null || state.document === null) return;
    await writesSettled(tab.id);
    const outcome = await sendCommand(documentId, { command: "setFormatCode", baseRevisionId: state.document.revisionId, on });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$(null);
  });

  /**
   * The document's line-number switch, *Line numbers* in the bar
   * (`BO_0302_007`): written on the document's base with `setLineNumbers`
   * and the document read back, so every code block redraws with or
   * without its gutter. Drawing only: nothing is revised.
   */
  const setLineNumbers$ = $(async (on: boolean) => {
    if (documentId === null || state.document === null) return;
    await writesSettled(tab.id);
    const outcome = await sendCommand(documentId, { command: "setLineNumbers", baseRevisionId: state.document.revisionId, on });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$(null);
  });

  /** A code block set to continue its numbering from the code block above
   * it, or not (`BO_0302_008`): a write of its own on the block's base, then
   * the document read back so the numbers below re-resolve. */
  const setCodeContinues$: ContinueCode = $(async (blockId: string, baseRevisionId: string, continues: boolean): Promise<string | null> => {
    if (documentId === null) return "No document.";
    await writesSettled(tab.id);
    // Registered as this tab's write on its way, so a second press and every
    // other write wait for it rather than land beside it: two writes on one
    // base in flight together left a block with two established revisions
    // on the dogfood instance (walk finding, 2026-09-25).
    let done = () => {};
    const sending = new Promise<void>((resolve) => { done = resolve; });
    inFlight.set(tab.id, sending);
    try {
      const outcome = await sendCommand(documentId, { command: "setCodeContinues", blockId, baseRevisionId, continues });
      if (outcome.outcome !== "success") return describeOutcome(outcome);
      state.notice = null;
      await readBack$(null);
      return null;
    } finally {
      if (inFlight.get(tab.id) === sending) inFlight.delete(tab.id);
      done();
    }
  });

  /** A code block's line count as typed, so the numbering below it follows
   * the caret rather than the settle. BO_0302_006 */
  const reportCodeLines$: ReportCodeLines = $((blockId: string, count: number) => {
    if (state.codeLines[blockId] !== count) state.codeLines[blockId] = count;
  });

  /**
   * A figure's or a table's caption and number ask (`BO_0295_010`,
   * `BO_0295_011`): one `setFigure` on the block's base, the document read
   * back so every number below follows. A refusal is said on the notice line.
   */
  const setFigure$: SetFigure = $(
    async (blockId: string, change: { readonly caption?: string | undefined; readonly captionRuns?: readonly Run[] | undefined; readonly numbered?: boolean | undefined }): Promise<string | null> => {
      if (documentId === null) return "No document.";
      const held = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
      if (held === undefined) return "No such block.";
      await writesSettled(tab.id);
      const outcome = await sendCommand(documentId, {
        command: "setFigure",
        blockId,
        baseRevisionId: held.revisionId,
        ...(change.caption === undefined ? {} : { caption: change.caption }),
        ...(change.captionRuns === undefined ? {} : { captionRuns: change.captionRuns }),
        ...(change.numbered === undefined ? {} : { numbered: change.numbered }),
      });
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return state.notice;
      }
      state.notice = null;
      await readBack$(null);
      return null;
    },
  );

  /**
   * A `.csv` or `.tsv` becomes a table (`BO_0287_013`): parsed here into its
   * preview, its bytes uploaded first when the file is past the bound — so
   * the block references what stands — and inserted after the block named,
   * directly below the drawn row the bar's *Import table* was pressed on
   * (DO_0016_003), or at the end. Anything else is refused in words.
   */
  const importTable$ = $(async (file: File, afterBlockId: string | null, below?: RowTarget) => {
    if (documentId === null) return;
    const delimiter = delimiterFor(file.name);
    if (delimiter === null) {
      state.notice = `${file.name} is not a .csv or .tsv file; a spreadsheet arrives by paste or by export.`;
      return;
    }
    const text = await file.text();
    // The header line says what separates the cells: a semicolon file named
    // .csv is read as the semicolons say, not as one column.
    const parsed = parseTable(text, sniffDelimiter(text, delimiter));
    if ("failure" in parsed) {
      state.notice = `${file.name}: ${parsed.failure}`;
      return;
    }
    if (!(await save$())) return;
    let reference: BlobReference | undefined;
    if (parsed.cut) {
      const uploaded = await uploadDocumentFile(file);
      if (uploaded.outcome !== "success") {
        state.notice = describeOutcome(uploaded);
        return;
      }
      reference = uploaded.result.reference;
    }
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block: {
        kind: "table",
        columns: parsed.columns,
        rows: parsed.rows,
        ...(reference === undefined ? {} : { reference, rowCount: parsed.rowCount }),
        source: { extension: "documents", file: file.name, importedAt: new Date().toISOString() },
      },
      placement:
        below !== undefined && state.document !== null
          ? belowPlacement(drawnRows(state, state.document, branchOf(documentId, tab.id)), below, knownKeys(state))
          : afterBlockId === null
            ? { at: "end" }
            : { after: afterBlockId },
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$(null);
  });

  /** Fills the pending image block the person chose an image for. The file is
   * decoded before upload so invalid files do not leave staged blob bytes. */
  const uploadImage$ = $(async (blockId: string, file: File) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const pending = state.document?.blocks.find((block) => block.blockId === blockId);
    if (pending === undefined || pending.kind !== "image" || pending.objectId !== undefined) {
      state.notice = "This image block is no longer waiting for an upload.";
      return;
    }
    if (file.type !== "" && !file.type.startsWith("image/")) {
      state.notice = `${file.name} is not an image file.`;
      return;
    }
    let width: number;
    let height: number;
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } catch {
      state.notice = `${file.name} could not be read as an image.`;
      return;
    }
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      state.notice = `${file.name} has no readable image dimensions.`;
      return;
    }
    let filled = false;
    try {
      const uploaded = await uploadDocumentFile(file);
      if (uploaded.outcome !== "success") {
        state.notice = describeOutcome(uploaded);
        return;
      }
      const outcome = await sendCommand(documentId, {
        command: "fillMediaBlock",
        blockId,
        baseRevisionId: pending.revisionId,
        reference: uploaded.result.reference,
        width,
        height,
      });
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
        return;
      }
      filled = true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      state.notice = `${file.name} could not be uploaded: ${detail}`;
    }
    if (!filled) return;
    state.notice = null;
    await readBack$(null);
  });

  /**
   * What *Capture* hands in (BO_0319_050): each image an image block below
   * the block the reader is in, or at the end, in the order captured
   * (`./shared.ts`, which a share into the app goes through too).
   */
  const capture$ = $(async (files: readonly File[], after: string | null) => {
    if (documentId === null || files.length === 0) return;
    if (!(await save$())) return;
    state.notice = null;
    const placed = await placeShared(documentId, files.map((file) => ({ kind: "file" as const, file })), after);
    state.notice = placed.notice;
    await readBack$(null);
  });

  /** A capture through the host, its refusal in words. BO_0319_050 */
  const captureThrough$ = $(async (how: "photo" | "files", after: string | null) => {
    try {
      const files = how === "photo" ? [await takePhoto()].filter((file): file is File => file !== null) : await pickHostFiles();
      await capture$(files, after);
    } catch (error) {
      state.notice = `Nothing was captured: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  /**
   * Appends a paragraph and activates it: at the end of the document, or
   * where the placement asks — below the lowest drawn row (DO_0016_002).
   *
   * `at: "end"` rather than `after: <block>` by default, so this is also the
   * way into a document that has no block to name.
   */
  const appendBlock$ = $(async (placement: Record<string, unknown> = { at: "end" }) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block: { kind: "text", runs: [] },
      placement,
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    const created = outcome.result.blockId;
    await readBack$({ blockId: created, offset: 0 });
  });

  /**
   * Words asked for this document's next command — a challenge to a derived
   * framing — become a new block after the block being edited, or at the
   * end with none, edited with the caret after them; nothing is sent until
   * the reader sends it. A document's commands are written in its blocks.
   * BO_0267_016
   */
  const composeInBlock$ = $(async (text: string) => {
    if (documentId === null) return;
    if (marking.store.marking.mode === "command") await marking.point$(null);
    const after = state.activeBlockId;
    if (!(await save$())) return;
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block: { kind: "text", runs: [{ text }] },
      placement: after === null ? { at: "end" } : { after },
    });
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await readBack$({ blockId: outcome.result.blockId, offset: [...text].length });
  });
  const composeSeen = useSignal(bridge.composeBlock.seq);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const seq = track(() => bridge.composeBlock.seq);
    if (seq === composeSeen.value) return;
    composeSeen.value = seq;
    if (bridge.composeBlock.itemId !== documentId || state.status !== "ready") return;
    await composeInBlock$(bridge.composeBlock.text);
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
    // Below the lowest row drawn, whatever it is — a proposal the reader can
    // see included — and never above it. The trailing empty paragraph is
    // reused only when it is that row. DO_0016_002
    const doc = state.document;
    if (doc === null) {
      await appendBlock$();
      return;
    }
    const rows = drawnRows(state, doc, branchOf(documentId, tab.id));
    const lowest = rows[rows.length - 1];
    if (
      lowest?.kind === "block" &&
      !lowest.retired &&
      lowest.prompt !== true &&
      isText(lowest.block) &&
      runsLength(lowest.block.runs) === 0
    ) {
      await activate$(lowest.block.blockId, 0);
      return;
    }
    await appendBlock$(belowPlacement(rows, "end", knownKeys(state)));
  });

  /**
   * Turns a block into another text role. The block being edited is revised
   * from the editor's own base and words, so what is under the caret is what
   * is written; any other block — one the reader has only turned to — is
   * revised from the revision and the words the document read holds, and the
   * caret goes nowhere. DO_0006_002
   */
  const setStructure$ = $(async (role: TextRole, on?: string) => {
    // A block an instant split has not landed yet has no revision to name.
    await writesSettled(tab.id);
    const editing = on === undefined || on === editor.blockId;
    const blockId = editing ? editor.blockId : on;
    if (documentId === null || blockId === null || blockId === undefined) return;
    const held = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
    if (held?.kind === "image") {
      const outcome = await sendCommand(documentId, { command: "turnImageIntoText", blockId, baseRevisionId: held.revisionId, role });
      if (outcome.outcome !== "success") { state.notice = describeOutcome(outcome); return; }
      state.notice = null;
      await readBack$(null);
      return;
    }
    if (held === undefined || !isText(held)) return;
    const at = editor.start;
    const outcome = await sendCommand(documentId, {
      command: "revise",
      blockId,
      baseRevisionId: editing ? editor.baseRevisionId : (held as TextBlockView).revisionId,
      runs: editing ? editor.runs : [...(held as TextBlockView).runs],
      role,
    });
    if (outcome.outcome !== "success") {
      // A refusal on the block being edited is named on it; on a block the
      // reader has only turned to there is no editor to name it, so it is
      // the view's notice, where a refused save that outlived its block is.
      if (editing) editor.failure = describeOutcome(outcome);
      else state.notice = describeOutcome(outcome);
      return;
    }
    if (editing) {
      editor.failure = null;
      await readBack$({ blockId, offset: at });
      return;
    }
    state.notice = null;
    await reload$();
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

  /**
   * The selection becomes mathematics (`BO_0290_017`): the words the reader
   * chose are the TeX it starts from, and a collapsed caret puts a new one
   * where it stands. It is drawn typeset at once, in the line, so the source
   * is edited in the popover rather than here — the sentence never shows it.
   */
  const makeInlineEquation$ = $(async () => {
    if (editor.blockId === null) return;
    await remember$();
    const chosen = runsText(sliceRuns(editor.runs, editor.start, editor.end));
    const tex = chosen.trim() === "" ? "x" : chosen;
    const next = replaceRangeWithAtom(editor.runs, editor.start, editor.end, { text: tex, math: true });
    // An atom is one character wide, so the caret lands just after it.
    const at = runsLength(sliceRuns(editor.runs, 0, Math.min(editor.start, editor.end))) + 1;
    await apply$(next, at, at);
    await scheduleSave$();
  });

  /**
   * The inline equation the reader pressed takes the source written in its
   * popover (`BO_0290_025`). The run keeps its place among the words, so the
   * sentence is unchanged but for what the equation is set from.
   */
  /**
   * The equation is named by the caller, not read from the editor state: the
   * panel saves and then closes, and closing clears which equation was open.
   * Reading it here meant the save found none and did nothing. BO_0290_030
   */
  const reviseInline$ = $(async (at: number, tex: string) => {
    if (editor.blockId === null) return;
    await remember$();
    let seen = -1;
    const next = editor.runs.map((run) => {
      if (run.math !== true) return run;
      seen += 1;
      return seen === at ? { ...run, text: tex } : run;
    });
    await apply$(next, editor.start, editor.end);
    await scheduleSave$();
  });

  /**
   * A citation's locator revised from its popover (`BO_0291_034`), the
   * citation named by its place among the block's citations as the caller
   * captured it when the panel opened: an empty locator takes it away, and
   * the atom keeps its place and its work.
   */
  const reviseLocator$ = $(async (at: number, locator: string) => {
    if (editor.blockId === null) return;
    await remember$();
    let seen = -1;
    const next = editor.runs.map((run) => {
      if (run.cite === undefined) return run;
      seen += 1;
      if (seen !== at) return run;
      return { ...run, cite: { work: run.cite.work, ...(locator === "" ? {} : { locator }) } };
    });
    await apply$(next, editor.start, editor.end);
    await scheduleSave$();
  });

  /**
   * A citation written at the caret (`BO_0291_024`): one atom naming the
   * chosen work, after the selection when there is one, drawn at once as its
   * number — a placeholder until the save's read numbers it. The locator is
   * the hover's to add (`BO_0291_026`).
   */
  const makeCitation$ = $(async (workId: string) => {
    if (editor.blockId === null || workId === "") return;
    await remember$();
    const end = Math.max(editor.start, editor.end);
    const next = replaceRangeWithAtom(editor.runs, end, end, { text: "", cite: { work: workId } });
    const at = runsLength(sliceRuns(editor.runs, 0, end)) + 1;
    await apply$(next, at, at);
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
    const read = runsFrom(element);
    // A reading that could not be this block after one edit is not the
    // reader's: the element holds something else, or it was never painted.
    // It is dropped and the element painted again from the model, so at most
    // the keystroke that could not be trusted is lost — where saving it would
    // write the block's words away against the right base revision, which
    // nothing downstream has any reason to refuse. DO_0017_001
    if (!couldBeOneEdit(runsText(editor.runs), runsText(read), Math.abs(editor.end - editor.start))) {
      editor.paint += 1;
      return;
    }
    editor.runs = read;
    if (range !== null) {
      editor.start = range.start;
      editor.end = range.end;
      editor.marks = marksAt(editor.runs, range.start, range.end);
      // $…$ becomes mathematics as the closing $ lands. The state is
      // remembered first, with the literal characters still in it, so one
      // undo gives them back. BO_0290_024
      const converted = range.start === range.end ? mathAtCaret(editor.runs, range.end) : null;
      if (converted !== null) {
        await remember$();
        await apply$(converted.runs, converted.caret, converted.caret);
        await scheduleSave$();
        return;
      }
    }
    await scheduleSave$();
  });

  /**
   * Puts a split the graph refused back together: every block drawn by the
   * splits still on their way joins the block it was split from, last first,
   * so what was typed after each Enter comes back in order. The editor stays
   * in the head with the caret at the join, and the refusal is named on it
   * as a refused save is. Nothing is written after it: the head holds the
   * words unsaved against the base that was refused, which is how a refused
   * save leaves a block, and the editor never overwrites or resolves a
   * conflict itself. CA_0045_005
   */
  const foldBack$ = $(async (failure: string, base: string, held: Run[]) => {
    const document = state.document;
    const pending = splitting.pending;
    splitting.pending = [];
    const first = pending[0];
    if (document === null || first === undefined) return;
    const runsOf = new Map<string, readonly Run[]>();
    for (const block of document.blocks) {
      if (isText(block)) runsOf.set(block.blockId, block.runs);
    }
    if (editor.blockId !== null) runsOf.set(editor.blockId, editor.runs);
    const join = runsLength(runsOf.get(first.headId) ?? []);
    const gone = new Set<string>();
    for (const split of [...pending].reverse()) {
      runsOf.set(
        split.headId,
        normalizeRuns([...(runsOf.get(split.headId) ?? []), ...(runsOf.get(split.tailId) ?? [])]),
      );
      gone.add(split.tailId);
    }
    const folded = runsOf.get(first.headId) ?? [];
    const blocks = document.blocks
      .filter((block) => !gone.has(block.blockId))
      .map((block) =>
        block.blockId === first.headId && isText(block)
          ? { ...block, runs: folded, revisionId: base }
          : block,
      );
    await adopt$(
      { ...document, blocks },
      { blockId: first.headId, offset: join, saved: held, failure },
      false,
    );
    await report$("unsaved");
    await bridge.setSelection$(first.headId);
  });

  /**
   * Sends one split drawn on screen: one command, the split at the caret under
   * the identity the tail was drawn with, carrying the head's words and role
   * as the editor holds them, so the head is written once — a save before it
   * fell inside the kernel's per-node floor and the split was refused
   * (`DO_0015_001`). A split the floor refuses anyway is sent once more after
   * the floor (`DO_0015_002`); every other refusal folds every split still on
   * its way back. CA_0045_005
   */
  const landSplit$ = $(async (split: PendingSplit): Promise<boolean> => {
    if (documentId === null) return false;
    // A head that was itself drawn by a split has the revision that split
    // landed at, written into the document in hand when it landed.
    const base =
      split.headBase !== PENDING_REVISION
        ? split.headBase
        : (state.document?.blocks.find((block) => block.blockId === split.headId)
            ?.revisionId ?? "");
    const command = {
      command: "split",
      blockId: split.headId,
      baseRevisionId: base,
      at: split.at,
      tailBlockId: split.tailId,
      runs: split.headRuns,
      role: split.role,
    };
    let outcome = await sendCommand(documentId, command);
    if (refusedByFloor(outcome)) {
      await afterFloor();
      outcome = await sendCommand(documentId, command);
    }
    if (outcome.outcome !== "success") {
      await foldBack$(describeOutcome(outcome), base, split.headSaved);
      return false;
    }
    splitting.answered = Date.now();
    const tailRevision = outcome.result.tailRevisionId ?? "";
    const document = state.document;
    if (document !== null) {
      state.document = {
        ...document,
        blocks: document.blocks.map((block) =>
          block.blockId === split.headId
            ? { ...block, revisionId: outcome.result.revisionId }
            : block.blockId === split.tailId
              ? { ...block, revisionId: tailRevision }
              : block,
        ),
      };
    }
    if (editor.blockId === split.tailId && editor.baseRevisionId === PENDING_REVISION) {
      editor.baseRevisionId = tailRevision;
    }
    return true;
  });

  /** Sends the splits drawn on screen, one at a time and in the order they
   * were pressed, holding every read and save of this tab until they are
   * through. A split pressed while they are being sent joins the queue.
   * CA_0045_005 */
  const drainSplits$ = $(async () => {
    if (splitting.draining) return;
    splitting.draining = true;
    let done = () => {};
    const sending = new Promise<void>((resolve) => { done = resolve; });
    inFlight.set(tab.id, sending);
    try {
      await report$("saving");
      for (;;) {
        const next = splitting.pending[0];
        if (next === undefined) break;
        // The floor between two splits, waited out rather than run into: the
        // second writes the tail and the document node the first just wrote.
        // DO_0015_002
        const wait = WRITE_FLOOR_MS - (Date.now() - splitting.answered);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        if (!(await landSplit$(next))) return;
        splitting.pending = splitting.pending.slice(1);
      }
      await report$(sameRuns(editor.runs, editor.savedRuns) ? "saved" : "unsaved");
    } finally {
      splitting.draining = false;
      if (inFlight.get(tab.id) === sending) inFlight.delete(tab.id);
      done();
    }
  });

  /**
   * Splits the active block at the caret, on screen at once: the head keeps
   * the words before the caret, the tail below takes the rest, and the caret
   * is at the tail's start before anything is sent, so typing goes on without
   * waiting for the graph. The tail is drawn under an identity chosen here,
   * which the split names when it is sent, so the block the reader types into
   * is the block the graph creates. CA_0045_005
   */
  const split$ = $(async (at: number) => {
    const blockId = editor.blockId;
    const document = state.document;
    if (documentId === null || blockId === null || document === null) return;
    const index = document.blocks.findIndex((block) => block.blockId === blockId);
    const head = document.blocks[index];
    if (head === undefined || !isText(head)) return;
    const [headRuns, tailRuns] = splitRuns(editor.runs, at);
    const tailId = newBlockId();
    let order = "";
    try {
      order = orderBetween(head.order, document.blocks[index + 1]?.order ?? "");
    } catch {
      // A key that cannot be minted locally still draws the tail, last among
      // the unplaced; the graph's own key arrives with the next read.
    }
    // The head's words travel with the split, so the pause that would have
    // saved them is not waited for.
    if (editor.timer !== 0) {
      clearTimeout(editor.timer);
      editor.timer = 0;
    }
    splitting.pending = [
      ...splitting.pending,
      {
        headId: blockId,
        tailId,
        at,
        headRuns: [...editor.runs],
        headSaved: [...editor.savedRuns],
        headBase: editor.baseRevisionId,
        role: editor.role,
      },
    ];
    const tail: TextBlockView = {
      ...head,
      blockId: tailId,
      revisionId: PENDING_REVISION,
      containmentId: "",
      order,
      role: editor.role,
      runs: tailRuns,
    };
    const blocks = [
      ...document.blocks.slice(0, index),
      { ...head, role: editor.role, runs: headRuns },
      tail,
      ...document.blocks.slice(index + 1),
    ];
    await adopt$({ ...document, blocks }, { blockId: tailId, offset: 0 }, false);
    void drainSplits$();
    await bridge.setSelection$(tailId);
  });

  /**
   * Merges across a block boundary. The caret lands where the join happened,
   * which is the end of what the surviving block held before it absorbed the
   * other one.
   *
   * An empty block joins nothing, so it is removed rather than merged and the
   * block that would have absorbed it is not written at all. DO_0017_002
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
    const read = await freshDocument$();
    const freshly = (id: string): TextBlockView | undefined => {
      const block = read?.blocks.find((candidate) => candidate.blockId === id);
      return block !== undefined && isText(block) ? block : undefined;
    };
    const survivor = freshly(into.blockId) ?? into;
    // What the block being edited holds is the editor's, which the save above
    // has just made the graph's too; the other block's is the read's.
    const leaving =
      from.blockId === editor.blockId ? editor.runs : (freshly(from.blockId) ?? from).runs;
    const focus = { blockId: into.blockId, offset: runsLength(survivor.runs) };
    if (runsLength(leaving) === 0) {
      await structural$({ command: "retire", blockId: from.blockId }, focus);
      return;
    }
    await structural$(
      {
        command: "merge",
        intoBlockId: into.blockId,
        intoBaseRevisionId: survivor.revisionId,
        blockId: from.blockId,
      },
      focus,
    );
  });

  /** Moves the caret across a block boundary to the nearest text block the
   * document draws for editing, in the order it draws them: a prompt only
   * under *Show prompts*, and never a row that takes no caret — a removed
   * row, a proposal row or a divider. Up and
   * Down arrive at the same place across the page on the nearest line, or as
   * many characters in where nothing is measured; Left and Right at the
   * block's end or start. DO_0003_002 */
  const step$ = $(async (direction: -1 | 1, from?: { readonly column: number; readonly x: number | null }) => {
    const doc = state.document;
    if (doc === null) return;
    const rows = drawnRows(state, doc, branchOf(documentId, tab.id)).flatMap((row) =>
      row.kind === "block" && !row.retired && isText(row.block) ? [row.block] : [],
    );
    const at = rows.findIndex((block) => block.blockId === editor.blockId);
    if (at === -1) return;
    const candidate = rows[at + direction];
    if (candidate === undefined) return;
    if (from === undefined) {
      await activate$(candidate.blockId, direction === -1 ? "end" : 0);
      return;
    }
    const reading =
      (root.value?.querySelector<HTMLElement>(`[data-block-id="${candidate.blockId}"] [data-block-reading]`) as
        HTMLElement | null | undefined) ?? null;
    const measured = from.x === null || reading === null ? null : arrivalOffset(reading, from.x, direction);
    await activate$(
      candidate.blockId,
      measured ?? landingOffset(runsText(candidate.runs), from.column, direction),
    );
  });

  const retire$ = $(async (blockId: string) => {
    await structural$({ command: "retire", blockId }, null);
  });

  /**
   * *Remove* on one block — the left swipe, the bar's button, Delete while
   * reading: the block is retired, a fixated one included, and the take-back
   * control offers to restore it where it was drawn, which is read before the
   * block leaves the rows. BO_0315_010 BO_0315_011 BO_0315_012
   */
  const removeBlock$ = $(async (blockId: string) => {
    const doc = state.document;
    const block = doc?.blocks.find((candidate) => candidate.blockId === blockId);
    if (doc === null || block === undefined) return;
    const placement: RestorePlacement = restorePlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), blockId);
    if (!(await structural$({ command: "retire", blockId }, null))) return;
    if (state.focusedBlockId === blockId) state.focusedBlockId = null;
    await standing.removed$(block, placement);
  });

  /**
   * A grid pasted into an empty paragraph becomes a table in its place
   * (`BO_0287_012`): the table is inserted after the paragraph and the
   * paragraph, which held nothing, is retired. A paste into a block holding
   * words stays text, which the text editor decides before asking this.
   */
  const pasteGrid$ = $(async (text: string) => {
    if (documentId === null || editor.blockId === null) return;
    const parsed = parsePastedGrid(text);
    if ("failure" in parsed) {
      editor.failure = parsed.failure;
      return;
    }
    const emptyId = editor.blockId;
    if (!(await save$())) return;
    const outcome = await sendCommand(documentId, {
      command: "insert",
      block: { kind: "table", columns: parsed.columns, rows: parsed.rows },
      placement: { after: emptyId },
    });
    if (outcome.outcome !== "success") {
      editor.failure = describeOutcome(outcome);
      return;
    }
    await retire$(emptyId);
  });

  /** Restores a retired block where its row is drawn, so a reader who moved
   * it restores it there. BO_0263_012 */
  const restore$ = $(async (blockId: string) => {
    const doc = state.document;
    const placement = doc === null ? { at: "end" as const } : restorePlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), blockId);
    await structural$({ command: "restore", blockId, placement }, null);
    await reloadRetired$();
  });


  /** *Show removed*: the retired blocks and the rejected proposals, each
   * where it stood. BO_0315_015 */
  const toggleRetired$ = $(async (on: boolean) => {
    state.retiredOpen = on;
    if (state.retiredOpen) await Promise.all([reloadRetired$(), reloadProposals$()]);
  });

  /** *Restore* on a rejected proposal: staged again as a new open proposal
   * of the reader's, and the proposals read again. BO_0315_015 */
  const reopen$ = $(async (itemId: string) => {
    if (documentId === null) return;
    const outcome = await reopenProposal(documentId, itemId);
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    state.notice = null;
    await reloadProposals$();
  });

  const togglePrompts$ = $((on: boolean) => {
    state.promptsOpen = on;
  });

  /** Keeps what the document shows once what it showed has come back, so
   * the state it opens in never writes over the kept one. BO_0267_022 */
  const shows = useStore({ restored: false });
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const restored = track(() => shows.restored);
    const kept: DocumentShows = {
      removed: track(() => state.retiredOpen),
      proposals: track(() => state.proposalsOpen),
      prompts: track(() => state.promptsOpen),
    };
    if (!restored || documentId === null) return;
    keepShows(documentId, kept);
  });

  const toggleProposals$ = $(async (on: boolean) => {
    state.proposalsOpen = on;
    // The toggle sets every change and resets what the chips set. CA_0055_006
    state.shownGroups = [];
    state.hiddenGroups = [];
    // On a line of several it expands the newest chip and shows that change
    // alone, since one change is read at a time. CA_0061_009
    const line = chipLineOf(state);
    if (on && line.groups.length > 1) {
      const next = shownAlone(line.groups[0] ?? null, state, line);
      state.shownGroups = [...next.shownGroups];
      state.hiddenGroups = [...next.hiddenGroups];
    }
    if (state.proposalsOpen) await reloadProposals$();
  });

  /** Takes an answered proposal out of the list at once, before the reread
   * that confirms it. Defined before every QRL that calls it: the optimizer
   * captures only what is declared above a `$`, and one declared below is a
   * free name there, undefined when the answer runs. BO_0233_012 BO_0233_014 */
  /** Stages a proposal's step still waiting for the presses to pause, before
   * the proposal is answered. Declared before every QRL that calls it.
   * DO_0004_008 */
  const flushProposalStep$ = $(async (itemId: string) => {
    const pending = proposalEdit.pending;
    if (documentId === null || pending === null || pending.itemId !== itemId) return;
    if (proposalEdit.timer !== 0) clearTimeout(proposalEdit.timer);
    proposalEdit.timer = 0;
    proposalEdit.pending = null;
    const outcome = await placeProposal(documentId, pending.itemId, pending.placement);
    if (outcome.outcome !== "success") state.notice = describeOutcome(outcome);
  });

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
    async (itemId: string, answer: "accepted" | "rejected", edited = false) => {
      if (documentId === null) return;
      // An edit is accepting this one, or has: typing into a proposal and
      // then pressing an answer is one decision, and the edit made it.
      if (proposalEdit.settling.includes(itemId) || proposalEdit.accepted.includes(itemId)) {
        if (answer === "rejected") state.notice = "Your edit to this proposal has already accepted it.";
        return;
      }
      await flushProposalStep$(itemId);
      const outcome = await answerProposal(documentId, itemId, answer, edited);
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
      } else {
        if (answer === "accepted") proposalEdit.accepted = [...proposalEdit.accepted, itemId];
        // A withdrawn item this acceptance could not reject stays with its
        // mark, and the reader is told. BO_0286_009
        if (outcome.result?.notice !== undefined) state.notice = outcome.result.notice;
        await dropProposal$(itemId);
      }
      await reload$();
      await reportEmptied$(outcome, NOTHING_LEFT);
      // Every open group is read again to list the proposals, which is the
      // slow read; the answered one has already left the list, so the reader
      // is not kept waiting on the rest. BO_0233_012
      void reloadProposals$();
      if (state.retiredOpen) void reloadRetired$();
      void reloadChanges$();
    },
  );















  /**
   * Delete or Backspace on a selection marking several rows (`DO_0023_004`, `BO_0315_011`):
   * every marked block of the document retires in one write — fixated ones
   * too, since fixation guards words and not the block — and every marked
   * proposal is declined, which is how a block not yet in the document leaves
   * its reading order. The proposals are answered after the write, through the
   * path that answers one, since an answer is the kernel's decision on a group
   * and cannot travel in the document's script; a refused write declines
   * nothing. Then the selection clears and nothing is focused. User decision,
   * 2026-09-29.
   *
   * The marked proposals are declined together, not one after another: each
   * leaves the list at once, every answer is sent without waiting on the
   * others, and the document and its proposals are read again once, when all
   * the answers are in. One already settled by an earlier answer is gone; any
   * other refusal puts its proposal back and is named in one notice. User
   * decision, 2026-09-30. DO_0024_001
   */
  const retireMarked$ = $(async () => {
    const doc = state.document;
    if (documentId === null || doc === null) return;
    const { blocks: blockIds, items: marked } = selectionMarks.rows;
    const blocks = blockIds.flatMap((blockId) => {
      const block = doc.blocks.find((candidate) => candidate.blockId === blockId);
      return block === undefined ? [] : [{ blockId, baseRevisionId: block.revisionId }];
    });
    if (blocks.length > 0 && !(await structural$({ command: "retireBlocks", blocks }, null))) return;
    // An edit that is accepting a proposal, or has, made the decision.
    const items = marked.filter((itemId) => !proposalEdit.settling.includes(itemId) && !proposalEdit.accepted.includes(itemId));
    if (items.length > 0) {
      const listed = new Map(
        (state.proposals?.groups ?? []).flatMap((group) => group.items).map((item) => [item.itemId, item] as const),
      );
      for (const itemId of items) await flushProposalStep$(itemId);
      for (const itemId of items) await dropProposal$(itemId);
      const answers = await Promise.all(
        items.map(async (itemId) => ({ itemId, outcome: await answerProposal(documentId, itemId, "rejected", false) })),
      );
      for (const answer of answers) await reportEmptied$(answer.outcome, NOTHING_LEFT);
      const stayed = answers.filter((answer) => answer.outcome.outcome !== "success" && !alreadySettled(answer.outcome));
      if (stayed.length > 0) {
        const back = stayed.map((answer) => answer.itemId);
        proposalEdit.answered = proposalEdit.answered.filter((itemId) => !back.includes(itemId));
        proposalEdit.changes += 1;
        state.notice = declineNotice(
          stayed.map((answer) => ({ item: listed.get(answer.itemId), outcome: answer.outcome })),
          describeOutcome,
        );
      }
      // Reading the document again reads the changes and the proposals once
      // after it (the task on `state.loaded`), so nothing reads them here.
      await reload$();
      if (state.retiredOpen) void reloadRetired$();
    }
    root.value?.ownerDocument.getSelection?.()?.removeAllRanges();
    state.focusedBlockId = null;
    state.focusedItemId = null;
  });

  /** What a press in one of the bar's block groups does, named rather than
   * handed over as a function: a proposal's press carries it across its
   * acceptance, and nothing but data crosses. DO_0006_004 */
  const actOnBlock$ = $(async (blockId: string, act: BlockAct) => {
    if (act.act === "insert") await insert$(act.block, { blockId });
    else if (act.act === "admonitionPattern") {
      const held = state.document?.blocks.find((candidate) => candidate.blockId === blockId);
      if (held?.kind === "admonition") await setAdmonitionPattern$(blockId, act.patternId);
      else if (held !== undefined && isText(held)) await turnIntoAdmonition$(blockId, act.patternId);
    }
    else if (act.act === "retire") await retire$(blockId);
    else if (act.act === "role") await setStructure$(act.role, blockId);
    else if (act.act === "toCode") await turnIntoCode$(blockId);
    else if (act.act === "toImage") await turnIntoImage$(blockId);
    else await standing.setStanding$(blockId, act.to);
  });

  /**
   * A press in one of the bar's block groups on a proposal the reader has
   * turned to: the proposal is accepted first, and the act then lands on the
   * block the acceptance established — a proposed block is worked with as an
   * ordinary block, which is the grain typing into one already has. A refused
   * acceptance acts on nothing and says so where the proposal is read.
   * User decision, 2026-09-21. DO_0006_004
   */
  const acceptThenAct$ = $(async (itemId: string, act: BlockAct) => {
    if (documentId === null) return;
    const item = state.proposals?.groups
      .flatMap((group) => group.items)
      .find((candidate) => candidate.itemId === itemId);
    // An item that proposes no block of its own — a removal, a work item,
    // the card — has nothing to act on. A derived candidate is a row the
    // swipe may move like any other since answer-by-use went (`BO_0258_015`).
    if (item === undefined) return;
    if (!SWIPEABLE_PROPOSALS.includes(item.kind)) return;
    if (proposalEdit.answered.includes(itemId) || proposalEdit.accepted.includes(itemId)) return;
    await flushProposalStep$(itemId);
    const outcome = await answerProposal(documentId, itemId, "accepted");
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    proposalEdit.answered = [...proposalEdit.answered, itemId];
    proposalEdit.accepted = [...proposalEdit.accepted, itemId];
    await dropProposal$(itemId);
    await reportEmptied$(outcome, NOTHING_LEFT);
    // The document is read again first: the act writes against the block the
    // acceptance established — the item's own, which a rewrite and a move
    // keep and an insert creates — not the one the read before it held.
    await reload$();
    void reloadProposals$();
    state.focusedItemId = null;
    state.focusedBlockId = item.blockId;
    await actOnBlock$(item.blockId, act);
    void reloadChanges$();
  });

  /** *Fixate* on a proposal: the acceptance, then the standing — the same
   * path a press in the bar's block groups takes, since both are the reader
   * working with a proposal as a block. DO_0006_004 */
  const standProposal$ = $(async (itemId: string, to: Standing) => {
    await acceptThenAct$(itemId, { act: "standing", to });
  });

  /** A run chip's *Accept all* or *Reject all*: every unanswered item of
   * the group, one at a time over the same operation, in the group's own
   * order — a shortcut, never an answer of its own. BO_0265_014 */
  /** *Accept all* and *Reject all*: the group's items answered in one request,
   * then the document read once. An item under an edit is the edit's to
   * settle, so a group holding one is answered item by item as before.
   * BO_0343_012 */
  const answerGroup$ = $(async (groupId: string, answer: "accepted" | "rejected", itemIds?: readonly string[]) => {
    if (documentId === null) return;
    const group = state.proposals?.groups.find(
      (candidate) => candidate.groupId === groupId,
    );
    // One card's items when named, or the whole group. BO_0351_024
    const items = (group?.items ?? []).filter((item) => itemIds === undefined || itemIds.includes(item.itemId));
    if (items.length === 0) return;
    if (items.some((item) => proposalEdit.settling.includes(item.itemId) || proposalEdit.accepted.includes(item.itemId) || proposalEdit.pending?.itemId === item.itemId)) {
      for (const item of items) await answerProposal$(item.itemId, answer);
      return;
    }
    const outcome = await answerGroup(documentId, groupId, answer, itemIds);
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
    } else {
      if (answer === "accepted") proposalEdit.accepted = [...proposalEdit.accepted, ...outcome.result.answered];
      for (const itemId of outcome.result.answered) await dropProposal$(itemId);
      if (outcome.result.notice !== undefined) state.notice = outcome.result.notice;
      // What the run made elsewhere is listed in the library's sections — a
      // structure under *Structures* — which the shell reads again. DO_0034_009
      if ((group?.elsewhere ?? []).length > 0) void bridge.targetChanged$();
      await reportEmptied$(outcome, NOTHING_LEFT);
    }
    // Reading the document again reads the changes and the proposals once
    // after it (the task on `state.loaded`).
    await reload$();
    if (state.retiredOpen) void reloadRetired$();
  });

  /** Writes what was typed into an accepted proposal onto its block, read
   * fresh, since the acceptance just established the revision this write is
   * based on. BO_0233_014 */
  const reviseAccepted$ = $(async (blockId: string, runs: Run[]) => {
    if (documentId === null) return;
    const fresh = await freshDocument$();
    if (fresh !== undefined) state.document = fresh;
    const block = fresh?.blocks.find((candidate) => candidate.blockId === blockId);
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
          await flushProposalStep$(itemId);
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

  /**
   * Accepts a relation, or a proposed reason, with the reason the reader
   * typed on top: the item is accepted as an edit's acceptance, then the
   * relation's reason is revised to the typed words from the revision the
   * acceptance established — a candidate becomes truth in place, so its
   * revision is the base. Editing the reason is as easy as accepting it.
   * BO_0244_010
   */
  const settleReason$ = $(
    async (itemId: string, relationId: string, baseRevisionId: string, reason: readonly Run[]): Promise<boolean> => {
      if (documentId === null) return false;
      if (proposalEdit.answered.includes(itemId) && !proposalEdit.accepted.includes(itemId)) return false;
      proposalEdit.settling = [...proposalEdit.settling, itemId];
      try {
        if (!proposalEdit.accepted.includes(itemId)) {
          const outcome = await answerProposal(documentId, itemId, "accepted", true);
          if (outcome.outcome !== "success") {
            state.notice = `The proposal was not accepted, so the reason was not changed: ${describeOutcome(outcome)}`;
            return false;
          }
          proposalEdit.accepted = [...proposalEdit.accepted, itemId];
        }
        await dropProposal$(itemId);
        const revised = await sendCommand(documentId, { command: "reviseReason", relationId, baseRevisionId, reason });
        if (revised.outcome !== "success") {
          state.notice = `The relation was accepted, but its reason was not changed: ${describeOutcome(revised)}`;
          return false;
        }
      } finally {
        proposalEdit.settling = proposalEdit.settling.filter((id) => id !== itemId);
      }
      void reloadProposals$();
      void reloadChanges$();
      return true;
    },
  );

  /** Keeps the card an item belongs to for later: the person's mark on its
   * whole group, after which the card leaves the flow. BO_0350_006 */
  const defer$ = $(async (itemId: string) => {
    if (documentId === null) return;
    const group = state.proposals?.groups.find((candidate) => candidate.items.some((item) => item.itemId === itemId));
    if (group === undefined) return;
    const outcome = await deferGroup(documentId, group.groupId, true);
    if (outcome.outcome !== "success") {
      state.notice = describeOutcome(outcome);
      return;
    }
    await reloadProposals$();
  });

  /** Drags a proposal by its face, as a block is dragged by its grip. BO_0233_007 */
  const startProposalDrag$ = $(
    (itemId: string, preview: string, event: PointerEvent) =>
      bridge.startDrag$(
        {
          itemId: `proposal:${itemId}`,
          kind: "documents:document",
          source: "workspace",
          // A card is moved among the rows or kept for later on the edge
          // pile. BO_0350_006
          operations: ["move", "defer"],
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
    proposalEdit.pending = { itemId, placement };
    proposalEdit.timer = Number(
      setTimeout(() => {
        proposalEdit.timer = 0;
        proposalEdit.pending = null;
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
      // Said where the press is seen too: the notice stands above the title,
      // out of sight at the foot of a long document. DO_0040_002
      void bridge.raiseMessage$({
        headline: `\u201c${doc.title}\u201d was not deleted`,
        body: state.notice,
        answers: [{ id: "ok", label: "OK" }],
      });
      return;
    }
    // Every tab in this workspace showing it closes, so the reader is not left
    // editing something that no longer exists.
    await bridge.targetGone$(documentId);
  });

  const startBlockDrag$ = $(
    (blockId: string, preview: string, event: PointerEvent) => {
      // What is typed in the block being dragged is saved as the drag starts,
      // so no drop meets words still waiting for the pause. Found in the walk
      // of BO_0349 at pin 4622, where a block typed into and dragged reached
      // its focused work empty. BO_0349_027
      if (editor.blockId === blockId) void save$();
      const payload: DragPayload = {
        itemId: blockId,
        kind: "documents:document",
        source: "workspace",
        operations: ["move"],
        preview,
        // The document it leaves, so a view it is dropped into tells it from
        // one of its own blocks. CA_0072_002
        from: documentId ?? undefined,
      };
      return bridge.startDrag$(payload, event);
    },
  );

  /**
   * A drop lands the dragged block where the drop task's placement says:
   * directly before the row it was dropped on, or at the end. It compiles into
   * the same move the keyboard and the action menu issue, so the two paths
   * cannot drift apart.
   */
  const dropOn$ = $(async (blockId: string, placement: ProposalPlacement) => {
    // Read before the move is sent: the move re-reads the document and hands
    // the block back from that read, so the caret is carried across.
    const caret = editor.blockId === blockId ? editor.start : null;
    if (!(await save$())) return;
    const moving = (await freshDocument$())?.blocks.find(
      (block) => block.blockId === blockId,
    );
    if (moving === undefined) return;
    await structural$(
      {
        command: "move",
        blockId,
        baseRevisionId: moving.revisionId,
        placement,
      },
      caret === null ? null : { blockId, offset: caret },
    );
  });

  /** Moves a retired block without restoring it: its place is written on it
   * and it stays retired. BO_0263_012 */
  const moveRetired$ = $(async (blockId: string, placement: ProposalPlacement) => {
    const retired = state.retired.find((block) => block.blockId === blockId);
    if (retired === undefined) return;
    await structural$({ command: "moveRetired", blockId, baseRevisionId: retired.revisionId, placement }, null);
  });

  /**
   * One arrow press on a row's grip: the row lands directly before the row
   * drawn above it, or after the one below, as its kind moves — a block by its
   * move, a retired block without
   * restoring it, a proposal staged into its group unanswered. BO_0263_013
   */
  const stepRow$ = $(async (position: string, direction: -1 | 1) => {
    const doc = state.document;
    if (doc === null) return;
    const placement = stepRowPlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), position, direction);
    if (position.startsWith("proposal:")) {
      const itemId = position.slice("proposal:".length);
      if (placement === null) {
        // A rewrite or a move stays with its block and has no row of its
        // own to step over; it steps as its face does.
        await stepProposal$(itemId, direction);
        return;
      }
      const item = state.proposals?.groups.flatMap((group) => group.items).find((candidate) => candidate.itemId === itemId);
      if (item === undefined) return;
      void drawProposalAt$(itemId, localOrder(placement, placedOf(doc.blocks), item.blockId));
      if (proposalEdit.timer !== 0) clearTimeout(proposalEdit.timer);
      proposalEdit.pending = { itemId, placement };
      proposalEdit.timer = Number(
        setTimeout(() => {
          proposalEdit.timer = 0;
          proposalEdit.pending = null;
          void placeProposal$(itemId, placement);
        }, PROPOSAL_STEP_PAUSE_MS),
      );
      return;
    }
    if (placement === null) return;
    if (state.retired.some((block) => block.blockId === position) && !doc.blocks.some((block) => block.blockId === position)) {
      await moveRetired$(position, placement);
      return;
    }
    await dropOn$(position, placement);
  });

  /** Starts the shell's drag for a row that is not a block of the
   * document: a retired block, by `retired:<block>`. BO_0263_013 */
  const startRowDrag$ = $((itemId: string, preview: string, event: PointerEvent) =>
    bridge.startDrag$(
      { itemId, kind: "documents:document", source: "workspace", operations: ["move"], preview },
      event,
    ),
  );

  /** The active block's arrows step over the drawn rows as every grip's do,
   * so a block steps past a proposed insert or a retired row rather than
   * over it. BO_0263_013 */
  const move$ = $(async (blockId: string, by: -1 | 1) => {
    await stepRow$(blockId, by);
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
  // A visible task, not `useTask$`: Qwik holds every render the page asks for
  // until a `useTask$` settles, so awaiting these reads there froze the tabs,
  // the library and the blocks for as long as the proposals read took. A
  // visible task runs after the render and holds none. DO_0001_001
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
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
   * The document's own facts, contributed to the inspector. What acts on the
   * document as a whole is on the bar (`CA_0053_005`).
   *
   * Typed facts and named actions, never rendered content: the shell renders
   * them in its own idiom, so every view's panel reads as the same drawer.
   * Writing them from a task is what keeps the document's own render out of
   * it; the shell re-renders the drawer alone.
   */
  useTask$(({ track }) => {
    track(() => state.document?.title);
    track(() => state.saveState);
    track(() => state.changes?.changeCount);
    track(() => state.changes?.lastWrittenAt);
    track(() => state.proposals?.unanswered);
    track(() => state.status);

    if (state.status !== "ready" || state.document === null) {
      bridge.inspector.facts = [];
      bridge.inspector.actions = [];
      return;
    }

    const facts: InspectorFact[] = [];
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


    bridge.inspector.facts = facts;
    bridge.inspector.actions = [];
  });

  /**
   * The document's bar, contributed to the shell: what the reader sees, the
   * subject's controls — the block being edited, else the block or proposal
   * the reader has turned to (`DO_0006_001`) — and what acts on the
   * document, trailing. Written from a task for the reason the inspector's
   * contribution is: the document's own render stays out of it, and the shell
   * re-renders the bar alone. A document the view could not read contributes
   * no group, so the shell draws no bar. CA_0053_006
   */
  useTask$(({ track }) => {
    track(() => state.status);
    track(() => state.document);
    track(() => state.retiredOpen);
    track(() => state.promptsOpen);
    track(() => state.proposalsOpen);
    track(() => state.branchGroup);
    track(() => state.focusedBlockId);
    track(() => state.focusedItemId);
    track(() => state.proposals);
    track(() => editor.blockId);
    track(() => editor.position);
    track(() => editor.role);
    track(() => editor.marks);
    track(() => editor.link);
    track(() => editor.linking);
    track(() => editor.linkDraft);
    track(() => editor.past.length);
    track(() => editor.future.length);
    track(() => standing.store.overlay);
    track(() => standing.store.takeBack);
    track(() => selectionMarks.rows);
    track(() => reach.value);

    if (state.status !== "ready" || state.document === null) {
      bridge.bar.groups = [];
      return;
    }

    // The act that decides what the document is rather than what one of its
    // blocks says, at the bar's leading edge: *Work in a proposal*. A
    // decoration can only join a group the view already contributes. Never on
    // a change document, whose members are read-only (`CA_0057_005`).
    // DO_0010_001
    const groups: ViewBarGroup[] = [];
    if ((state.document as { change?: string }).change === undefined) {
      groups.push({
        id: "work",
        label: "Work",
        actions: [
          // The working mode is chosen on a block's command line, not here.
          // DO_0025_009
          {
            kind: "toggle",
            id: "work-in-proposal",
            label: "Work in a proposal",
            icon: "git-branch",
            on: state.branchGroup !== null,
            run$: $(() => ask$("toggle", null)),
          },
        ],
      });
    }
    groups.push(
      {
        id: "view",
        label: "View",
        actions: [
          {
            kind: "toggle",
            id: "removed",
            label: "Show removed",
            icon: "archive",
            on: state.retiredOpen,
            run$: toggleRetired$,
          },
          {
            kind: "toggle",
            id: "prompts",
            label: "Show prompts",
            icon: "terminal-window",
            on: state.promptsOpen,
            run$: togglePrompts$,
          },
          {
            kind: "toggle",
            id: "proposed-changes",
            label: "Show proposed changes",
            icon: "git-pull-request",
            on: state.proposalsOpen,
            run$: toggleProposals$,
          },
        ],
      },
    );

    // The subject: the block being edited when there is one, else the block
    // or the proposal the reader has turned to. The groups that act on the
    // whole block act on it; *Format* and *History* wait for the caret.
    // DO_0006_001 DO_0006_004
    const editing = editor.blockId !== null;
    // Several rows marked by the selection: no row is the subject and the
    // single-block controls stand disabled; Delete removes them all.
    // DO_0023_003 BO_0315_011
    const several = !editing && marksSeveral(selectionMarks.rows);
    const item =
      several || state.focusedItemId === null
        ? undefined
        : (state.proposals?.groups.flatMap((group) => group.items) ?? []).find(
            (candidate) => candidate.itemId === state.focusedItemId,
          );
    const blockId = editor.blockId ?? (several ? null : item === undefined ? state.focusedBlockId : item.blockId);
    // A proposal acts through its acceptance, so every press on it goes
    // through one wrapper; a block of the document acts directly. What the
    // press does travels as data, never as a function handed across.
    const itemId = item?.itemId ?? null;
    const press$ = (act: BlockAct): QRL<() => void> =>
      $(() => {
        // *Add …* on a proposal leaves it open and places below where it is
        // drawn; every other act on one accepts it first. DO_0016_003
        if (itemId !== null && act.act === "insert") {
          void insert$(act.block, { itemId });
          return;
        }
        if (itemId !== null) {
          void acceptThenAct$(itemId, act);
          return;
        }
        if (blockId !== null) void actOnBlock$(blockId, act);
      });
    if (editing) {
      const format: ViewAction[] = MARKS.map((mark) => ({
        kind: "toggle",
        id: `mark-${mark}`,
        label: MARK_LABEL[mark],
        icon: MARK_ICON[mark],
        on: editor.marks.includes(mark),
        keepsSelection: true,
        run$: $(() => toggleMark$(mark)),
      }));
      // A reference is written from `#` in the sentence, never from the bar
      // (`BO_0300_006`, user decision 2026-09-25): the three choices that
      // stood here are gone.
      format.push({
        kind: "button",
        id: "block-inline-equation",
        label: "Inline equation",
        icon: "equals",
        keepsSelection: true,
        run$: makeInlineEquation$,
      });
      format.push({
        kind: "toggle",
        id: "block-link",
        label: "Link",
        icon: "link",
        on: editor.link !== null,
        keepsSelection: true,
        run$: $(() => {
          editor.linkDraft = editor.link ?? "";
          editor.linking = !editor.linking;
        }),
      });
      if (editor.linking) {
        format.push({
          kind: "field",
          id: "block-link-address",
          label: "Link address",
          type: "url",
          value: editor.linkDraft,
          submitLabel: "Apply link",
          input$: $((value: string) => {
            editor.linkDraft = value;
          }),
          submit$: commitLink$,
        });
      }
      // Cite (`BO_0291_024`): the source chooser hangs off this control as
      // the shell's popover, its body this view's, which writes the citation
      // at the caret and closes the panel.
      format.push({
        kind: "popover",
        id: "block-cite",
        label: "Cite",
        icon: "quotes",
        body: { component: CitePopover, props: { cite$: makeCitation$ } },
      });
      groups.push({ id: "format", label: "Format", actions: format });
    }

    // The subject's own block, when it is one of the document's: a proposal
    // has none until it is accepted, and takes the proposed block's role and
    // the resting standing until then. DO_0006_001 DO_0006_004
    const subject =
      blockId === null
        ? undefined
        : state.document.blocks.find((candidate) => candidate.blockId === blockId);
    if (several) {
      const idle = (id: string, label: string, icon: IconName): ViewAction => ({ kind: "button", id, label, icon, disabled: true, run$: $(() => undefined) });
      groups.push(
        { id: "turn-into", label: "Turn into", actions: [idle("block-role", "Block type", ROLE_ICON.paragraph)] },
        {
          id: "block",
          label: "Block",
          actions: [
            idle("block-add-paragraph", "Add paragraph", "plus"),
            idle("block-add-image", "Add image", "image"),
            idle("block-add-table", "Add table", "table"),
            idle("block-add-equation", "Add equation", "equals"),
            idle("block-add-code", "Add code", "code"),
            idle("block-import-table", "Import table", "upload-simple"),
          ],
        },
      );
    } else if (blockId !== null) {
      // The subject's place in the document's order, which names the block
      // its controls act on. `editor.position` holds it only for the block
      // being edited. DO_0006_001
      const position = editing
        ? editor.position
        : state.document.blocks.findIndex((candidate) => candidate.blockId === blockId) + 1;
      const proposed = item?.block ?? null;
      const typeTarget = proposed ?? subject;
      const role = editing
        ? editor.role
        : subject !== undefined && isText(subject)
          ? subject.role
          : proposed !== null && isText(proposed)
            ? proposed.role
            : undefined;
      // A revealed retired row is out of the document's flow: a new block
      // can go below it, and that is all the bar offers on it. DO_0016_005
      const retiredSubject =
        !editing && item === undefined && subject === undefined && state.retired.some((candidate) => candidate.blockId === blockId);
      const named = item !== undefined ? "the proposed block" : retiredSubject ? "the retired block" : `block ${position}`;
      const canChooseAdmonition = typeTarget !== undefined && (isText(typeTarget) || typeTarget.kind === "admonition");
      const currentPatternId = typeTarget?.kind === "admonition" ? typeTarget.patternId : null;
      const patternOptions = canChooseAdmonition
        ? admonitionPatterns.items.map((pattern) => ({ value: `admonition:${pattern.id}`, label: pattern.name, icon: "info" as const }))
        : [];
      const typeOptions = typeTarget?.kind === "admonition"
        ? patternOptions
        : [
            ...TEXT_ROLES.map((option) => ({ value: option, label: ROLE_LABEL[option], icon: ROLE_ICON[option] })),
            ...patternOptions,
            ...(subject?.kind === "image" || item?.block?.kind === "image" ? [] : [{ value: "code", label: "Code", icon: "code" as const }]),
            ...(subject?.kind === "image" || item?.block?.kind === "image" || proposed?.kind === "image" ? [] : [{ value: "image", label: "Image", icon: "image" as const }]),
          ];
      // The block controls in one settled order, all of them icons: the role
      // the subject is in, then adding a paragraph, then retiring it. The
      // bar draws a choice whose current option names an icon as that icon
      // alone, so *Turn into* is its symbol and nothing else. Nothing in the
      // bar inserts a divider any more; a divider stays a block kind, and
      // `insert$` keeps the arm the other paths reach. DO_0010_002 DO_0010_003
      const turnInto: ViewBarGroup = {
          id: "turn-into",
          label: "Turn into",
          actions: [
            {
              kind: "choice",
              id: "block-role",
              label: "Block type",
              value: currentPatternId !== null ? `admonition:${currentPatternId}` : subject?.kind === "image" ? "image" : role ?? "paragraph",
              options: typeOptions,
              run$: $((chosen: string) => {
                const act: BlockAct = chosen.startsWith("admonition:")
                  ? { act: "admonitionPattern", patternId: chosen.slice("admonition:".length) }
                  : chosen === "code" ? { act: "toCode" } : chosen === "image" ? { act: "toImage" } : { act: "role", role: chosen as TextRole };
                if (itemId !== null) {
                  void acceptThenAct$(itemId, act);
                  return;
                }
                if (blockId !== null) void actOnBlock$(blockId, act);
              }),
            },
          ],
        };
      const blockGroup: ViewBarGroup = {
          id: "block",
          label: "Block",
          actions: ([
            {
              kind: "button",
              id: "block-add-paragraph",
              label: "Add paragraph",
              icon: "plus",
              name: `Insert paragraph after ${named}`,
              run$: press$({ act: "insert", block: "text" }),
            },
            {
              kind: "button",
              id: "block-add-image",
              label: "Add image",
              icon: "image",
              name: `Insert image upload field after ${named}`,
              run$: press$({ act: "insert", block: "image" }),
            },
            {
              kind: "button",
              id: "block-add-table",
              label: "Add table",
              icon: "table",
              name: `Insert table after ${named}`,
              run$: press$({ act: "insert", block: "table" }),
            },
            {
              kind: "button",
              id: "block-add-equation",
              label: "Add equation",
              icon: "equals",
              name: `Insert equation after ${named}`,
              run$: press$({ act: "insert", block: "equation" }),
            },
            {
              kind: "button",
              id: "block-add-code",
              label: "Add code",
              icon: "code",
              name: `Insert code after ${named}`,
              run$: press$({ act: "insert", block: "code" }),
            },
            {
              kind: "button",
              id: "block-import-table",
              label: "Import table",
              icon: "upload-simple",
              name: `Import a .csv or .tsv table after ${named}`,
              run$: $(() => {
                importAfter.value = itemId !== null ? { itemId } : blockId === null ? null : { blockId };
                tableFile.value?.click();
              }),
            },
          ] satisfies ViewAction[]),
        };
      groups.push(...(retiredSubject ? [blockGroup] : [turnInto, blockGroup]));
      // A picture, a table or an accepted output asks for a number here: a
      // toggle on the block the bar is about, the caption kept as it stands.
      // A proposal is answered first, so none is offered on one. BO_0295_011
      // A code block asks for a listing number the same way (BO_0303_012).
      const numberable = subject;
      if (item === undefined && numberable !== undefined && (numberable.kind === "image" || numberable.kind === "table" || numberable.kind === "output" || numberable.kind === "sourcecode")) {
        const on = numberable.numbered === true;
        const kind = numberable.kind === "table" ? "table" : numberable.kind === "sourcecode" ? "listing" : "figure";
        groups.push({
          id: "number",
          label: "Number",
          actions: [
            {
              kind: "toggle",
              id: "block-number",
              label: on ? `Stop numbering this ${kind}` : `Number this ${kind}`,
              icon: "hash",
              on,
              run$: $(() => {
                void setFigure$(numberable.blockId, {
                  numbered: !on,
                  ...(numberable.kind === "table" ? {} : { caption: numberable.caption ?? "" }),
                });
              }),
            },
          ],
        });
      }
    }
    if (editing) {
      groups.push({
        id: "history",
        label: "History",
        actions: [
          {
            kind: "button",
            id: "block-undo",
            label: "Undo",
            disabled: editor.past.length === 0,
            run$: undo$,
          },
          {
            kind: "button",
            id: "block-redo",
            label: "Redo",
            disabled: editor.future.length === 0,
            run$: redo$,
          },
          {
            kind: "button",
            id: "block-done",
            label: "Done editing",
            run$: deactivate$,
          },
        ],
      });
    }

    // The document's citation style, offered while it cites anything and the
    // bibliography answers its styles: the instance's default first, named,
    // then each shipped style. BO_0291_037
    const citationStyles = state.document?.citationStyles;
    const citationStyle: ViewAction[] =
      citationStyles === undefined || (state.document as { change?: string } | null)?.change !== undefined
        ? []
        : [
            {
              kind: "choice",
              id: "citation-style",
              label: "Citation style",
              value: state.document?.citationStyle ?? "default",
              options: [
                {
                  value: "default",
                  label: `Instance default (${citationStyles.offered.find((style) => style.id === citationStyles.instanceDefault)?.name ?? citationStyles.instanceDefault})`,
                  icon: "books" as const,
                },
                ...citationStyles.offered.map((style) => ({ value: style.id, label: style.name, icon: "books" as const })),
              ],
              run$: chooseCitationStyle$,
            },
          ];
    // Whether a settled or an accepted code block is pretty-printed: on
    // unless the document switched it off, readable at a glance as the
    // toggle's pressed state. BO_0296_021
    const formatCode: ViewAction[] =
      state.document === null || (state.document as { change?: string }).change !== undefined
        ? []
        : [
            {
              kind: "toggle",
              id: "format-code",
              label: "Format code",
              icon: "code",
              name: state.document.formatCode === false ? "Format code: off, an edit is saved exactly as typed" : "Format code: on, an edit is tidied up when it settles",
              on: state.document.formatCode !== false,
              run$: setFormatCode$,
            },
            // Whether each line of a code block is numbered: shown unless
            // the document switched it off, readable at a glance as the
            // toggle's pressed state. BO_0302_007
            {
              kind: "toggle",
              id: "line-numbers",
              label: "Line numbers",
              icon: "list",
              name: state.document.lineNumbers === false ? "Line numbers: off, code blocks carry no numbers" : "Line numbers: on, each line of a code block is numbered",
              on: state.document.lineNumbers !== false,
              run$: setLineNumbers$,
            },
          ];
    // Capture (BO_0319_050): the camera on a device, and files — the host's
    // picker there, the browser's on an instance — below the block the reader
    // is in, or at the end; a proposal's block is not yet the document's.
    const captureBelow = item === undefined ? blockId : null;
    groups.push({
      id: "capture",
      label: "Capture",
      actions: [
        ...(reach.value?.camera === true
          ? [
              {
                kind: "button",
                id: "capture-camera",
                label: "Camera",
                icon: "camera",
                name: "Take a photo into this document",
                run$: $(() => captureThrough$("photo", captureBelow)),
              } satisfies ViewAction,
            ]
          : []),
        {
          kind: "button",
          id: "capture-files",
          label: "Files",
          icon: "files",
          name: "Pick images into this document",
          run$: $(() => {
            if (reach.value?.hostFiles === true) {
              void captureThrough$("files", captureBelow);
              return;
            }
            captureAfter.value = captureBelow;
            captureFile.value?.click();
          }),
        },
      ],
    });
    groups.push({
      id: "document",
      label: "Document",
      trailing: true,
      actions: [
      ...formatCode,
      ...citationStyle,
      // Taking a saved change of standing back is its own named action, never
      // the undo keystroke: it writes the previous value. It stands in the
      // trailing group, which is drawn whenever the bar is, because a
      // standing is most often set on a block that is not active — by the
      // swipe or the chord — and the block groups stand only while one is.
      // User decision, 2026-09-20. CA_0058_011
      {
        kind: "button",
        id: "take-back-standing",
        label: "Take back",
        icon: "arrow-counter-clockwise",
        name:
          standing.store.takeBack === null
            ? "Take back the last change of standing"
            : standing.store.takeBack.kind === "removal"
              ? `Take back ${standing.store.takeBack.did}`
              : `Take back: ${standing.store.takeBack.did}`,
        disabled: standing.store.takeBack === null,
        run$: standing.takeBack$,
      },
      // A document a guard keeps offers no Delete. RO_0005_020
      ...(state.document?.fixed?.undeletable !== undefined ? [] : [
      {
        kind: "button",
        id: "delete-document",
        label: "Delete",
        icon: "trash",
        destructive: true,
        run$: $(() => {
          const current = state.document;
          if (current === null) return;
          // The title is read as the control is pressed rather than as the
          // contribution is built, so the question names what the document is
          // called now.
          // A document a run started is a proposal, and deleting it rejects
          // what the run proposed of it. DO_0040_002
          void bridge.raiseMessage$({
            headline: `Delete \u201c${current.title}\u201d?`,
            body:
              current.proposed === undefined
                ? "This removes the document from the product and cannot be undone."
                : "This document is a proposal. Deleting it rejects it, and the rest of what was proposed with it stays open.",
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
      ] satisfies ViewAction[]),
      ],
    });

    bridge.bar.groups = groups;
  });

  /** The last drop this view has seen, taken at mount, so a drop older than
   * the view is never answered by it. CA_0072_002 */
  const dropsSeen = useStore({ seq: bridge.drag.drop?.seq ?? 0 });

  /**
   * A block dropped onto a text block's middle (CA_0072_007): the shell opens
   * the target's focused work, or finds the one it has, without leaving this
   * document, and the block moves to its end — from this document or from
   * the one it was dragged out of. The reader stays; the target wears its
   * face at once. A refusal from either is said on the document.
   */
  const nest$ = $(async (payload: DragPayload, targetId: string) => {
    if (documentId === null) return;
    const blockId = payload.itemId;
    if (blockId === targetId || blockId.includes(":")) return;
    if (!(await save$())) return;
    const child = await bridge.focusedChild$(documentId, targetId);
    if ("refusal" in child) {
      state.notice = child.refusal;
      return;
    }
    const outcome = await sendCommand(child.itemId, {
      command: "moveIn",
      blockId,
      fromDocumentId: payload.from ?? documentId,
      placement: { at: "end" },
    });
    state.notice = outcome.outcome === "success" ? null : describeOutcome(outcome);
    // The nest stands; what it means beyond that is asked under the target,
    // by whichever extension has something to ask. BO_0349_010
    state.nested = outcome.outcome === "success" ? { targetId, blockId, documentId: child.itemId } : null;
    await readBack$(null);
    state.faces = await bridge.faces$(documentId);
    await reportEmptied$(outcome, { blockIds: [blockId], wentTo: child.itemId });
  });

  /**
   * A document dragged in from its tab or its library row (`DO_0043_004`):
   * it becomes the focused work of a new block here — between the rows it was
   * dropped between, or, on a block's middle, at the end of that block's
   * focused work, as a nested block lands. The shell makes the block and
   * moves the document under it; a refusal is said on the document. A
   * document dropped on itself lands nowhere.
   */
  const adoptDocument$ = $(async (childId: string, overId: string) => {
    const doc = state.document;
    if (documentId === null || doc === null || childId === documentId) return;
    let at: { placement: unknown } | { into: string };
    if (overId.startsWith("nest:")) {
      at = { into: overId.slice("nest:".length) };
    } else if (overId.startsWith("block:")) {
      const placement = dropPlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), overId.slice("block:".length));
      if (placement === null) return;
      at = { placement };
    } else {
      return;
    }
    if (!(await save$())) return;
    const adopted = await bridge.adoptChild$(documentId, childId, at);
    state.notice = "refusal" in adopted ? adopted.refusal : null;
    if ("refusal" in adopted) return;
    await readBack$(null);
    state.faces = await bridge.faces$(documentId);
  });

  const nestDone$ = $(() => {
    state.nested = null;
  });

  /**
   * A block dropped on this instruction's header (`BO_0349_014`): a run under
   * *Shape an instruction* proposes the revision of this instruction that
   * would have produced it, answered here as every proposal is. The block is
   * the run's reference and is not moved. A block of the instruction itself
   * is no example of it, and a proposal or a retired row is no block.
   */
  const shape$ = $(async (payload: DragPayload) => {
    const doc = state.document;
    if (documentId === null || doc === null) return;
    const instruction = doc.record === INSTRUCTION_RECORD;
    // A structure's header takes a block as an example of what the
    // structure should hold: a run under *Extend a structure* proposes the
    // fields it lacks. BO_0349_036
    const structure = doc.named === "structure";
    if (!instruction && !structure) return;
    const from = payload.from ?? documentId;
    // A marked passage is the example as its words; a block as itself.
    // BO_0349_013
    const passageIn = payload.kind === PASSAGE_DRAG_KIND ? passageBlock(payload.itemId) : null;
    const blockId = passageIn ?? payload.itemId;
    if ((passageIn === null && blockId.includes(":")) || from === documentId) return;
    const example =
      passageIn !== null && payload.preview !== null && payload.preview !== ""
        ? ({ number: 1, kind: "passage", blockId: passageIn, quote: payload.preview, document: from } as const)
        : ({ number: 1, blockId, document: from } as const);
    const sent = await bridge.sendInstructed$({
      itemId: documentId,
      goal: instruction
        ? "Revise this instruction so that, followed, it would produce material like #1, the block dropped on it."
        : "Propose the fields this structure lacks, read off #1, the block dropped on it.",
      instruction: instruction ? SHAPE_AN_INSTRUCTION : EXTEND_A_STRUCTURE,
      references: [example],
    });
    state.notice = sent.ok ? null : sent.error;
  });

  // A visible task for the counts task's reason: a drop awaits its write.
  // DO_0001_002
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => bridge.drag.drop?.seq);
    const drop = bridge.drag.drop;
    if (drop == null) return;
    // A drop is answered once, by the view it landed in. The shell keeps the
    // last drop after its gesture, so a view mounted after it — a tab a held
    // drag opened, a tab switched to later — would otherwise take it as its
    // own on its first run. CA_0072_002
    if (drop.seq <= dropsSeen.seq) return;
    dropsSeen.seq = drop.seq;
    // A card dropped on the edge pile is kept for later: its whole group,
    // which leaves the flow. BO_0350_006
    if (drop.operation === "defer" && drop.overId === "later" && drop.payload.itemId.startsWith("proposal:")) {
      await defer$(drop.payload.itemId.slice("proposal:".length));
      return;
    }
    // A structure or an instruction out of the library, on a block's middle
    // or the header: the extension that knows its kind says what it means
    // there. BO_0349_011
    if (drop.operation === "link") {
      if (documentId === null) return;
      // A marked passage dropped on an instruction's or a structure's header
      // is the example a run shapes it by. BO_0349_013
      if (drop.payload.kind === PASSAGE_DRAG_KIND) {
        if (drop.overId.startsWith("header:")) await shape$(drop.payload);
        return;
      }
      // A library item on a marked passage acts on those words alone. BO_0349_038
      const onPassage = drop.overId.startsWith("passage:") ? passageAt(marking.store.marking, drop.overId) : null;
      if (onPassage !== null) {
        const startPassageRun = async (run: { goal: string; instruction: string; references: ViewInstructedRun["references"] }) => {
          const sent = await bridge.sendInstructed$({ itemId: documentId, ...run });
          return sent.ok ? null : sent.error;
        };
        state.notice = await dropOnDocument(drop.payload, documentId, null, startPassageRun, false, onPassage);
        return;
      }
      const body = drop.overId.startsWith("block:");
      const on = drop.overId.startsWith("nest:") ? drop.overId.slice("nest:".length) : drop.overId.startsWith("header:") || body ? null : undefined;
      if (on === undefined) return;
      // What the drop starts runs on the bridge, in this document. BO_0349_012
      const startRun = async (run: { goal: string; instruction: string; references: ViewInstructedRun["references"] }) => {
        const sent = await bridge.sendInstructed$({ itemId: documentId, ...run });
        return sent.ok ? null : sent.error;
      };
      const refusal = await dropOnDocument(drop.payload, documentId, on, startRun, body);
      state.notice = refusal;
      // The document is read again, as after any write, so every decoration
      // that reads with it — the structures' pills and lines, a standing
      // instruction's pill — draws what the drop did at once. Found in the
      // walk at pin 4805: the use stood, and showed only after a reload.
      // BO_0349_025
      // A drop on a block leaves the block edited, so the chip under it
      // stands and opens on what the drop put there. BO_0349_037
      if (refusal === null) await readBack$(on === null ? null : { blockId: on, offset: "end" });
      return;
    }
    if (drop.operation !== "move") return;
    // A whole document, dragged from its tab or its library row, becomes a
    // block here whose focused work it is. DO_0043_004
    const dragged = draggedDocument(drop.payload);
    if (dragged !== null) {
      await adoptDocument$(dragged, drop.overId);
      return;
    }
    // Onto an instruction's header: the block is an example the instruction
    // is shaped by; onto a structure's, an example the structure is extended
    // by. It stays where it is. BO_0349_014 BO_0349_036
    if (drop.overId.startsWith("header:")) {
      await shape$(drop.payload);
      return;
    }
    // Onto a block's middle: the block is taken into it, as its focused
    // work. CA_0072_007
    if (drop.overId.startsWith("nest:")) {
      await nest$(drop.payload, drop.overId.slice("nest:".length));
      return;
    }
    if (!drop.overId.startsWith("block:")) return;
    const target = drop.overId.slice("block:".length);
    const doc = state.document;
    if (doc === null || target === drop.payload.itemId || `retired:${target}` === drop.payload.itemId) return;
    // Directly before the row it was dropped on, whatever that row is — a
    // proposed insert, a removed row as well as a block of
    // the document — between the keys of the rows the reader saw. BO_0263_002
    const placement = dropPlacement(drawnRows(state, doc, branchOf(documentId, tab.id)), target);
    if (placement === null) return;
    // A retired block dropped moves and stays retired. BO_0263_012
    if (drop.payload.itemId.startsWith("retired:")) {
      await moveRetired$(drop.payload.itemId.slice("retired:".length), placement);
      return;
    }
    // A proposal dropped is placed, not accepted. BO_0233_007
    if (drop.payload.itemId.startsWith("proposal:")) {
      const itemId = drop.payload.itemId.slice("proposal:".length);
      const item = state.proposals?.groups
        .flatMap((group) => group.items)
        .find((candidate) => candidate.itemId === itemId);
      if (item === undefined) return;
      await drawProposalAt$(itemId, localOrder(placement, placedOf(doc.blocks), item.blockId));
      await placeProposal$(itemId, placement);
      return;
    }
    // A block of another document moves into this one, where it was
    // dropped. CA_0072_008
    const from = drop.payload.from;
    if (from !== undefined && from !== documentId) {
      await structural$({ command: "moveIn", blockId: drop.payload.itemId, fromDocumentId: from, placement }, null);
      return;
    }
    await dropOn$(drop.payload.itemId, placement);
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
    // What the document showed on this device comes back with it. BO_0267_022
    if (documentId !== null && state.document !== null) {
      const kept = storedShows(documentId);
      if (kept !== null) {
        state.promptsOpen = kept.prompts;
        if (kept.removed) await toggleRetired$(true);
        if (kept.proposals) await toggleProposals$(true);
      }
      shows.restored = true;
    }
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
    const leaving = () => {
      void save$(true);
    };
    frame.addEventListener("beforeunload", leaving);
    // The surface owns the mode, so the surface hears the key: one listener
    // decides, and no block arbitrates the same event for itself. It listens on
    // the document because the shortcut opens the mode from wherever the reader
    // is on the page, including a dock collapsed to its handle.
    const view = root.value ?? null;
    /** The card the row turned to is part of, by its group: a rewrite, an
     * insert, a move or a gather of an open group. BO_0350_004 */
    const focusedCard = (): string | null => {
      const itemId = state.focusedItemId;
      if (itemId === null) return null;
      const group = (state.proposals?.groups ?? []).find((candidate) => candidate.items.some((item) => item.itemId === itemId));
      const item = group?.items.find((candidate) => candidate.itemId === itemId);
      return group !== undefined && item !== undefined && SWIPEABLE_PROPOSALS.includes(item.kind) ? group.groupId : null;
    };
    const keys = (event: KeyboardEvent) => {
      // A surface holding the floor has made this frame inert, and nothing
      // inert may act on a key. That is what keeps `Escape` the message's
      // first, and the ordering the shell's.
      if (view === null || view.closest("[inert]") !== null) return;
      // `Ctrl`/`Cmd`+`Enter` sends the block being edited, or the prompt
      // pointed from, the way its *Keep as content* says. BO_0267_012
      // DO_0025_001
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        const prompt =
          editor.blockId ?? (marking.store.marking.mode === "command" ? marking.store.prompt : null);
        if (prompt === null) return;
        event.preventDefault();
        // The way *Keep as content* says. DO_0025_001
        const keep = choiceIn(commandChoices.byBlock, state.runs, state.document, prompt, state.mode).keep;
        void sendBlock$(prompt, !keep, []);
        return;
      }
      // `+` unfolds the card turned to and `-` folds it, while reading, as a
      // pinch in and out do. BO_0350_004
      if (
        (event.key === "+" || event.key === "-") &&
        !event.ctrlKey && !event.metaKey && !event.altKey &&
        marking.store.marking.mode === "reading" &&
        editor.blockId === null &&
        state.editingItemId === null &&
        !typesHere(event.target)
      ) {
        const card = focusedCard();
        if (card !== null) {
          event.preventDefault();
          state.unfoldedCards = [...refold(state.unfoldedCards, card, event.key === "+" ? "in" : "out")];
          return;
        }
      }
      // Delete or Backspace while reading removes: every row a selection
      // marks, else the row turned to — a fixated block at once, a proposal
      // by rejecting it. A key pressed in an editor, a field or the title
      // keeps its meaning there. BO_0315_011
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !event.ctrlKey && !event.metaKey && !event.altKey &&
        marking.store.marking.mode === "reading" &&
        editor.blockId === null &&
        state.editingItemId === null &&
        !typesHere(event.target)
      ) {
        if (marksSeveral(selectionMarks.rows)) {
          event.preventDefault();
          void retireMarked$();
          return;
        }
        const open = state.focusedItemId !== null && (state.proposals?.groups ?? []).some((group) => group.items.some((item) => item.itemId === state.focusedItemId));
        if (open && state.focusedItemId !== null) {
          event.preventDefault();
          // On a folded card the key rejects the whole card. BO_0350_002
          const card = focusedCard();
          // The card turned to, one place of its group. BO_0351_024
          if (card !== null && !state.unfoldedCards.includes(card) && state.document !== null) {
            const places = cardPlaces(drawnRows(state, state.document, branchOf(documentId, tab.id)), state.unfoldedCards);
            void answerGroup$(card, "rejected", cardItems(places, state.focusedItemId));
          } else void answerProposal$(state.focusedItemId, "rejected");
          return;
        }
        if (state.focusedBlockId !== null && state.document?.blocks.some((block) => block.blockId === state.focusedBlockId) === true) {
          event.preventDefault();
          void removeBlock$(state.focusedBlockId);
          return;
        }
      }
      // Reading has more local surfaces that answer `Escape` first — an active
      // block leaves editing — and in command mode there is none, because no
      // block is active in it.
      if (event.key === "Escape" && marking.store.marking.mode === "command") {
        event.preventDefault();
        void marking.point$(null);
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
      // The bar is not outside: its controls act on the active block or on
      // the document it is in. Neither is the block's own row, grips included
      // — they are its edges. CA_0053_006
      return (
        element.closest("[data-view-bar]") !== null ||
        element.closest(`[data-block-id="${active}"]`) !== null
      );
    };
    // Where the gesture began. A selection dragged out past the block's edge
    // fires its click on an ancestor that is outside, and a reorder drag begins
    // on the block's own handle and is released anywhere; neither is leaving.
    let began = false;
    let touched = false;
    const pressed = (event: PointerEvent) => {
      began = owns(event.target);
      touched = event.pointerType === "touch";
    };
    // A touch on another block's words while one is being edited keeps the
    // focus where it is. The reading row is focusable, and taking the focus
    // there closed a phone's keyboard before the tapped block could open it
    // again. The editor that has the focus keeps it until the tapped block's
    // editor takes it over. Cancelled here, at the press, because a Qwik
    // handler's `preventDefault` runs after the default has already happened;
    // a touch only, so a desktop drag inside a reading block still selects
    // what it crosses. CA_0045_003
    const keepFocus = (event: MouseEvent) => {
      if (!touched || state.activeBlockId === null) return;
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("[data-block-reading][role='button']") == null) return;
      event.preventDefault();
    };
    // A click, not a pointer press. A touch scroll begins with a pointer down
    // on the reading surface and produces no click, so the browser already
    // separates the tap that means leave from the scroll that does not, and
    // ending on release leaves the browser's own focus placement intact.
    const away = (event: MouseEvent) => {
      if (view === null || view.closest("[inert]") !== null) return;
      // A press outside every row and its depth lets the focus go. CA_0046_001
      // Not the click a drag across rows ends in, which lands on their common
      // ancestor: letting the focus go would draw the row the selection began
      // in again and take its start away. DO_0023_002
      if ((state.focusedBlockId !== null || state.focusedItemId !== null) && !marksSeveral(selectionMarks.rows)) {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-block-id], [data-retired-id], [data-rejected-id], [data-proposal-id], [data-view-bar]") == null) {
          state.focusedBlockId = null;
          state.focusedItemId = null;
        }
      }
      if (state.activeBlockId === null) return;
      // Pointing from the block being edited: a press elsewhere marks, and
      // never leaves the prompt. BO_0267_023
      if (marking.store.marking.mode === "command") return;
      if (owns(event.target) || began) return;
      const element = event.target instanceof Element ? event.target : null;
      // Another block's reading row activates itself, and activating commits
      // the outgoing block on the way. One press, one decision: this does not
      // also leave, or the two would run against each other.
      if (element?.closest("[data-block-reading][role='button']") != null)
        return;
      // The blank page, the area below the last block and the rest of the
      // surface under them answer their own press, because each is a button
      // whose handler already runs (DO_0028_001). Leaving is
      // what that handler does while a block is active; deciding it here too
      // would be two answers to one gesture.
      if (
        element?.closest("[data-document-append], [data-document-empty], [data-document-rest]") !=
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
    page.addEventListener("mousedown", keepFocus);
    page.addEventListener("click", away);
    // The swipe, on touch: left removes, right keeps. On a block it commits
    // through the paths the bar's buttons take; on a proposal it answers it,
    // and an accepted proposal takes no standing. BO_0227_011 BO_0315_010
    const uninstallSwipe = installSwipe(page, (swiped, action) => {
      if (swiped.kind === "block") {
        if (action === "remove") void removeBlock$(swiped.blockId);
        else void standing.setStanding$(swiped.blockId, action === "fixate" ? "fixate" : "keep");
        return;
      }
      // A folded card is one decision: the swipe answers its whole group.
      // BO_0350_002
      if (swiped.kind === "card") {
        // The card it moved, one place of the group. BO_0351_024
        void answerGroup$(swiped.groupId, action === "remove" ? "rejected" : "accepted", swiped.itemIds);
        return;
      }
      void answerProposal$(swiped.itemId, action === "remove" ? "rejected" : "accepted");
    });
    // The pinch, on touch: zooming in on a row deepens the block, zooming
    // out gathers its neighbours into its focused work. BO_0322_010
    const uninstallPinch = installPinch(
      page,
      (pinch, blockId) => {
        void pinch$(pinch, blockId);
      },
      // On a card the pinch unfolds or folds it; zooming in on a card of one
      // proposal, with nothing to unfold, deepens the proposal. BO_0350_003
      // BO_0350_014
      (pinch, groupId) => {
        const items = state.proposals?.groups.find((group) => group.groupId === groupId)?.items ?? [];
        if (pinch === "in" && items.length === 1 && items[0] !== undefined) {
          void pinchProposal$(items[0]);
          return;
        }
        state.unfoldedCards = [...refold(state.unfoldedCards, groupId, pinch)];
      },
    );
    cleanup(() => {
      uninstallSwipe();
      uninstallPinch();
      remember();
      surface?.removeEventListener("scroll", remember);
      frame.removeEventListener("beforeunload", leaving);
      page.removeEventListener("keydown", keys);
      page.removeEventListener("pointerdown", pressed);
      page.removeEventListener("mousedown", keepFocus);
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
  /**
   * The reader's runs in this document, as the shell hands them over while
   * they go, side by side: the blocks each reads are marked for a moment, and
   * each staging reads the proposals again so its items stand at their
   * targets as they are staged, one read at a time. BO_0265_012 BO_0265_013 BO_0269_018
   */
  useVisibleTask$(async ({ track }) => {
    // A replay's tab takes its run from the replay alone, and no other tab
    // takes it. BO_0340_008
    const seq = track(() => (replaying ? bridge.replay.seq : bridge.activity.seq));
    if (seq === state.activitySeen) return;
    state.activitySeen = seq;
    if (documentId === null) return;
    // Every run of the reader's aimed at this document, side by side: each
    // one's new events are read against what this view held of it.
    // BO_0269_018
    const held = state.runActivities;
    const next = replaying
      ? bridge.replay.run === null ? [] : [bridge.replay.run]
      : bridge.activity.runs.filter((run) => run.itemId === documentId);
    if (next.length === 0 && held.length === 0) return;
    state.runActivities = next.map((run) => ({ runId: run.runId, agent: run.agent, running: run.running, events: [...run.events] }));
    let staged = false;
    for (const run of next) {
      const seen = held.find((before) => before.runId === run.runId)?.events.length ?? 0;
      const fresh = run.events.slice(seen);
      const group = liveGroup(run.events);
      if (group !== null && !state.liveGroups.includes(group)) {
        state.liveGroups = [...state.liveGroups, group];
        // The reader's run starts shown, once; hiding it from its chip then
        // holds while it stages more. CA_0055_006
        if (!state.proposalsOpen && !state.shownGroups.includes(group)) state.shownGroups = [...state.shownGroups, group];
      }
      if (fresh.some((event) => event.action === "read" && event.scope === "blocks")) {
        state.agentReads = readMarks(state.agentReads, fresh, Date.now(), run.agent);
        // A mark goes three seconds after the last read of its block. A
        // timer may wake a little before the time it was set for, so the
        // drop keeps waking until every mark has gone.
        const drop = () => {
          state.agentReads = readMarks(state.agentReads, [], Date.now());
          const until = Object.values(state.agentReads).map((mark) => mark.until);
          if (until.length > 0) setTimeout(drop, Math.max(20, Math.min(...until) - Date.now() + 20));
        };
        setTimeout(drop, READ_MARK_MS + 20);
      }
      if (fresh.some((event) => event.action !== "read")) staged = true;
      // A run the view followed ends: its chip is the expanded one, since the
      // items it has just staged stand on the page, and whatever was expanded
      // collapses. CA_0061_010
      const before = held.find((candidate) => candidate.runId === run.runId);
      if (before?.running === true && !run.running && group !== null) {
        const line = chipLineOf(state);
        if (line.groups.length > 1) {
          const alone = shownAlone(group, state, line);
          state.shownGroups = [...alone.shownGroups];
          state.hiddenGroups = [...alone.hiddenGroups];
        }
      }
    }
    if (staged && state.status === "ready") await reloadProposals$();
  });

  /**
   * A replay's surface takes no press, key or focus: inert, which every key
   * handler here already honours, so no edit, answer or command is reachable
   * and the replay cannot be mistaken for the document. BO_0340_008
   */
  useVisibleTask$(({ track }) => {
    track(() => state.status);
    if (replaying && root.value !== undefined) root.value.inert = true;
  });

  /**
   * A replay types its command into the block it was sent from, a character
   * at a time as the shell's schedule hands the words over; before the typing
   * starts the block reads as it stood. Only the drawn words change: nothing
   * is saved. BO_0340_008
   */
  useVisibleTask$(({ track }) => {
    if (!replaying) return;
    const words = track(() => bridge.replay.words);
    track(() => state.loaded);
    const block = bridge.replay.block;
    if (words === null || block === null || state.document === null) return;
    state.document = {
      ...state.document,
      // A row is keyed by its revision, so the typed words are a revision of
      // their own for the drawing alone; it names nothing in the graph.
      blocks: typedInto(state.document.blocks, block, words, (held, typed) =>
        isText(held) ? { ...held, revisionId: `${held.revisionId.split("#")[0]}#typed-${typed.length}`, runs: typed === "" ? [] : [{ text: typed }] } : held,
      ),
    };
  });

  /**
   * A proposal staged on this document by something that is not a run — a
   * person's code execution, staged by the kernel — says so with one event
   * bubbling up from where it was staged, `calliopa:document-proposed`
   * naming the document, and the proposals are read again. The editor knows
   * nothing of what staged it; the extension that did dispatches the event
   * on its own element, and the editor listens on its page, as it listens
   * for keys. BO_0289_023
   */
  // eslint-disable-next-line qwik/no-use-visible-task -- a page event is the browser's
  useVisibleTask$(({ cleanup }) => {
    const page = root.value?.ownerDocument;
    if (!page) return;
    const proposed = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: string }>).detail;
      if (detail?.documentId === documentId && state.status === "ready") void reloadProposals$();
    };
    page.addEventListener("calliopa:document-proposed", proposed);
    cleanup(() => page.removeEventListener("calliopa:document-proposed", proposed));
  });

  /**
   * Something shared into the app while this document is open
   * (`documents:shared`, from this extension's share receiver,
   * `../share.ts`): claimed, and placed below the block the reader is in, or
   * at the end. BO_0319_050
   */
  const takeShared$ = $(async (items: readonly Captured[]) => {
    if (documentId === null) return;
    if (!(await save$())) return;
    const after = editor.blockId ?? state.focusedBlockId;
    state.notice = null;
    const placed = await placeShared(documentId, shareables(items), after);
    state.notice = placed.notice;
    await readBack$(null);
  });
  // eslint-disable-next-line qwik/no-use-visible-task -- a page event is the browser's
  useVisibleTask$(({ cleanup }) => {
    const page = root.value?.ownerDocument;
    if (!page) return;
    const shared = (event: Event) => {
      const detail = (event as CustomEvent<SharedHere>).detail;
      if (detail?.documentId !== documentId || state.status !== "ready") return;
      detail.taken = true;
      void takeShared$(detail.items);
    };
    page.addEventListener(SHARED_EVENT, shared);
    cleanup(() => page.removeEventListener(SHARED_EVENT, shared));
  });

  /** The document's open run groups, reported for the composer's chips
   * whenever what they say changes. BO_0265_014 */
  useVisibleTask$(({ track }) => {
    track(() => state.proposals);
    track(() => state.runActivities);
    track(() => state.proposalsOpen);
    track(() => state.shownGroups);
    track(() => state.hiddenGroups);
    track(() => state.sessions);
    track(() => state.branchGroup);
    track(() => state.branchRequired);
    if (documentId === null || state.proposals === null) return;
    // One change at a time holds as the changes arrive, not only when a press
    // or a run's end sets it. CA_0061_009
    keepOneExpanded(state);
    // Each chip says the number its proposal is marked whole under, while a
    // mark stands. BO_0321_008
    const marks = track(() => marking.store.marking);
    const chips = chipsOf(state).map((chip) => {
      const number = chip.group === null ? null : proposalReferenceFor(marks, chip.group);
      return number === null ? chip : { ...chip, reference: number };
    });
    const said = JSON.stringify(chips);
    if (said === reportedChips.value) return;
    reportedChips.value = said;
    void bridge.setRunChips$(replaying ? replayChipsKey(tab.id) : documentId, chips);
  });

  /** A run chip's *Reject all* or *Accept all*, pressed for this document.
   * BO_0265_014 */
  useVisibleTask$(async ({ track }) => {
    const seq = track(() => bridge.answerAll.seq);
    if (seq === state.answerAllSeen) return;
    state.answerAllSeen = seq;
    const { itemId, group, answer } = bridge.answerAll;
    // A replay answers nothing: what it shows was answered, or not, long ago.
    // BO_0340_008
    if (replaying) return;
    if (itemId !== documentId || group === null || answer === null) return;
    // A session's answers go through its card and its rejected rows.
    // CA_0057_008
    if (state.sessions.some((session) => session.branch === group)) {
      await ask$(answer === "accepted" ? "accept" : "reject", group);
      return;
    }
    await answerGroup$(group, answer);
  });

  /** A press on a run chip itself: its change is shown or hidden.
   * CA_0055_006 */
  useVisibleTask$(async ({ track }) => {
    const seq = track(() => bridge.toggleRun.seq);
    if (seq === state.toggleRunSeen) return;
    state.toggleRunSeen = seq;
    const { itemId, key, work, mark } = bridge.toggleRun;
    if (itemId !== documentId || key === null) return;
    // While pointing, a chip's press marks its whole proposal, a run's or
    // the reader's own session, instead of showing or hiding it. BO_0321_008
    if (mark === true) {
      const group = state.proposals?.groups.find((candidate) => candidate.groupId === key);
      const session = state.sessions.some((candidate) => candidate.branch === key);
      if (group === undefined && !session) return;
      await marking.toggleProposal$(key, group === undefined ? undefined : proposerName(group.proposer));
      return;
    }
    // A session chip's pencil works in its session; its press shows or hides
    // it as a run chip's does, but the session the tab works in is the
    // document it reads. CA_0057_014
    if (state.sessions.some((session) => session.branch === key)) {
      if (work === true) {
        await ask$("work", key);
        return;
      }
      if (key === state.branchGroup) return;
      const next = toggledGroup(key, state, chipLineOf(state));
      state.shownGroups = [...next.shownGroups];
      state.hiddenGroups = [...next.hiddenGroups];
      return;
    }
    if (!(state.proposals?.groups ?? []).some((group) => group.groupId === key)) return;
    const next = toggledGroup(key, state, chipLineOf(state));
    state.shownGroups = [...next.shownGroups];
    state.hiddenGroups = [...next.hiddenGroups];
  });

  useVisibleTask$(async ({ track }) => {
    track(() => bridge.proposed.seq);
    const looked = proposedFor(bridge.proposed, state.proposedSeen, documentId);
    state.proposedSeen = looked.seen;
    if (!looked.act || state.status !== "ready") return;
    await reloadProposals$();
    // A run this view followed already shows its change; opening every
    // change on its end would undo what the chips set. CA_0055_006
    const followed = state.runActivities.some((run) => !run.running);
    if (!followed && (state.proposals?.unanswered ?? 0) > 0) {
      state.proposalsOpen = true;
      // Shown on a line of several is one change at a time: the newest.
      // CA_0061_009
      const line = chipLineOf(state);
      if (line.groups.length > 1) {
        const alone = shownAlone(line.groups[0] ?? null, state, line);
        state.shownGroups = [...alone.shownGroups];
        state.hiddenGroups = [...alone.hiddenGroups];
      }
    }
  });

  /**
   * Shows what a chip in the composer points at, when the reader presses it:
   * the block scrolled into view and emphasized, or the passage's words, in
   * either mode. Nothing here changes the document or the mode, and a second
   * press ends the first emphasis before starting its own. CA_0039_005
   */
  useVisibleTask$(({ track, cleanup }) => {
    track(() => bridge.reveal.seq);
    // A reveal pending as the view mounts — a chip pressed from another
    // document's prompt, which brought this one forward — waits for the
    // document: it is neither acted on nor consumed until there are rows to
    // show it in. BO_0304_009
    track(() => state.loaded);
    const looked = revealFor(bridge.reveal, state.revealSeen, documentId);
    if (looked.target !== null && looked.target.kind !== "takeBack" && state.document === null) return;
    state.revealSeen = looked.seen;
    // Consumed: a view mounting later for this document does not act on it
    // again. BO_0304_009
    if (looked.target !== null) bridge.reveal.target = null;
    const element = root.value;
    // A rowless reference's chip × takes it back: the view alone holds the
    // marks. BO_0263_007
    if (looked.target?.kind === "takeBack") {
      void marking.removeReference$(looked.target.number);
      return;
    }
    if (looked.target === null || element === undefined || state.document === null) return;
    // A proposal marked whole: its change is shown first, as a successor's
    // is, so there is a row to ring. BO_0321_010
    if (looked.target.kind === "proposal" && !groupShown(looked.target.group, state)) {
      const next = revealGroup(looked.target.group, state);
      state.shownGroups = [...next.shownGroups];
      state.hiddenGroups = [...next.hiddenGroups];
      const target = looked.target;
      const passageless = setTimeout(() => cleanup(showArea(element, target, null)), 0);
      cleanup(() => clearTimeout(passageless));
      return;
    }
    const passage = revealedPassage(
      looked.target,
      marking.store.marking,
      state.document.blocks,
    );
    cleanup(showArea(element, looked.target, passage));
  });

  /**
   * What the title field shows is the DOM's, never the render's: the reader
   * types into this very element, and a render owning its text node would
   * insert a second one beside what was typed, or go on writing a node the
   * browser had replaced. One writer, on every change of what the document is
   * called — the stored title, or nothing at all while it carries the minted
   * name, which is when the placeholder stands. DO_0012_002
   */
  useVisibleTask$(({ track }) => {
    const title = track(() => state.document?.title);
    const element = titleField.value;
    if (element === undefined) return;
    const shown = title === undefined ? "" : shownTitle({ title });
    if (element.textContent !== shown) element.textContent = shown;
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
    // Retitling a started document took it: it is the ordinary document now,
    // read again, and its blocks are still the run's proposals. BO_0251_010
    if (document.proposed !== undefined) {
      await reload$();
      await bridge.setTitle$(title);
      void reloadProposals$();
      return true;
    }
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

  /** The title on its way to the store, so the blur that follows a press
   * that already saved it sends nothing more. DO_0032_001 */
  const savingTitle = useSignal<string | null>(null);

  /**
   * Saves what the title's field holds. A rename that took is shown by the
   * task that owns the field. One that did not — blank, unchanged or refused —
   * puts back what the document is called, which is nothing at all while it
   * carries the minted name: clearing the field and leaving ends under the
   * placeholder rather than with words to delete again. DO_0012_002
   */
  const saveTitle$ = $(async (element: HTMLElement) => {
    const typed = element.textContent ?? "";
    if (savingTitle.value === typed) return;
    savingTitle.value = typed;
    try {
      const renamed = await rename$(typed);
      if (!renamed) element.textContent = shownTitle(state.document);
    } finally {
      savingTitle.value = null;
    }
  });

  /*
   * A press anywhere outside the title's field saves the title first, as
   * leaving it does. A control that keeps the caret where it is — the
   * header's structures chip — never blurs the field, and what it does draws
   * the header again from the stored document, so the words typed were gone.
   * Captured at the press, before the pressed control's own act, which comes
   * with the click. DO_0032_001
   */
  // eslint-disable-next-line qwik/no-use-visible-task -- the press is the page's, in the browser
  useVisibleTask$(({ cleanup }) => {
    const page = root.value?.ownerDocument;
    if (page === undefined) return;
    const pressed = (event: Event) => {
      const element = titleField.value;
      if (element === undefined || state.document === null) return;
      const target = event.target as Node | null;
      if (target !== null && element.contains(target)) return;
      if ((element.textContent ?? "") === shownTitle(state.document)) return;
      void saveTitle$(element);
    };
    page.addEventListener("pointerdown", pressed, true);
    cleanup(() => page.removeEventListener("pointerdown", pressed, true));
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
  /** What this view offers an extension drawing on its blocks: what the
   * editor knows and a decoration cannot read for itself. BO_0256_007 */
  const reveal$ = $(async (blockId: string) => {
    await focus$(blockId);
    const row = root.value?.querySelector(`[data-block-id="${blockId}"]`);
    if (row !== null && row !== undefined && typeof (row as HTMLElement).scrollIntoView === "function") {
      (row as HTMLElement).scrollIntoView({ block: "center" });
    }
  });
  const isReference$ = $((blockId: string) => referenceFor(marking.store.marking, blockId) !== null);
  useContextProvider(EditorSurfaceContext, {
    get documentId() { return documentId; },
    get document() { return state.document; },
    get proposals() { return state.proposals; },
    get activeBlockId() { return state.activeBlockId; },
    get focusedBlockId() { return state.focusedBlockId; },
    get focusedItemId() { return state.focusedItemId; },
    get loaded() { return state.loaded; },
    get notice() { return state.notice; },
    set notice(value: string | null) { state.notice = value; },
    tab,
    focus$,
    reload$,
    reloadProposals$,
    deactivate$,
    answerProposal$,
    reveal$,
    setStanding$: standing.setStanding$,
    toggleReference$: marking.toggleReference$,
    isReference$,
  } as never);

  // The tab's own branch is the document it reads, never proposals drawn
  // over it. BO_0250_020
  const ownBranch = branchOf(documentId, tab.id);
  const shownProposals = shownProposalsOf(state, ownBranch);
  // The agent's face on the blocks it reads is the agent of the run that
  // read it. BO_0265_013 BO_0269_018
  const agentReadOf = (blockId: string): AgentRead | null => {
    const read = state.agentReads[blockId];
    return read === undefined ? null : { ...read, face: faceOf({ kind: "agent", agent: read.agent, executedBy: "" }) };
  };
  // Every run's stagings, for the notes their items carry while they go.
  const runEvents = state.runActivities.flatMap((run) => run.events);
  const framed = new Map<string, ProposedChange[]>();
  for (const item of shownProposals) {
    // Each block a gather moves is framed by the gather, answered whole
    // from any of them. BO_0322_013
    if (item.kind === "gather") {
      for (const blockId of item.gathered ?? []) framed.set(blockId, [...(framed.get(blockId) ?? []), item]);
      continue;
    }
    if (item.kind !== "remove" && item.kind !== "move") continue;
    if (!(doc?.blocks.some((block) => block.blockId === item.blockId) ?? false)) continue;
    framed.set(item.blockId, [...(framed.get(item.blockId) ?? []), item]);
  }
  const groupOf = (groupId: string) =>
    state.proposals?.groups.find((group) => group.groupId === groupId);
  const placed = placedOf(doc?.blocks ?? []);
  // The rows drawn, and the first and last that have a place: where the
  // grips' arrows stop. BO_0263_013
  // Where each code block's numbering starts, over the document as read
  // and the line counts being typed, so a block below a growing one
  // re-numbers under the caret. BO_0302_006
  const codeFirstLines = doc === null ? {} : resolveFirstLines(doc.blocks, state.codeLines);
  const drawn = doc === null ? [] : drawnRows(state, doc, ownBranch);
  const cards = cardPlaces(drawn, state.unfoldedCards);
  const places = drawn.flatMap((row) => {
    const position = positionOf(row);
    return position === null ? [] : [position];
  });
  const edge = (position: string) => ({ first: places[0] === position, last: places[places.length - 1] === position });
  // A drawn row that is not a block row, made a place to drop a block: the
  // target the shell's drag model finds under the pointer, and the mark that
  // lights while it is there. BO_0263_002
  const dropSlot = (id: string, row: JSXOutput, key = `slot:${id}`) => (
    <div class="drop-slot" key={key} data-drop-target={`block:${id}`} data-accepts="move link">
      <DropMark id={id} drag={bridge.drag} self={documentId} />
      {row}
    </div>
  );
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
      data-replay={replaying ? "" : undefined}
      ref={root}
      // A .csv or .tsv dropped anywhere in the tab becomes a table: after the
      // row it fell on (the row's own handler), or at the end of the document
      // when it fell on none (this one), so the margins, the title and the
      // space below the last block take a drop too. The listener is what
      // makes the preventdefault attributes count: Qwik honours them only for
      // events it listens for, and without one the browser refused the drag
      // over a text row and the drop fired on native drop targets alone (a
      // table's inputs, the edited block's contenteditable). BO_0287_013
      preventdefault:dragover
      preventdefault:drop
      onDragOver$={() => undefined}
      onDrop$={async (event: DragEvent) => {
        // A row the file fell on took it, and said so on the event: the
        // handlers run in bubbling order, and the event's target is not read
        // because a handler runs after the event is over.
        if ((event as TakenDrop).takenByRow === true) return;
        const dropped = Array.from(event.dataTransfer?.files ?? []);
        if (dropped.length === 0) return;
        if (marking.store.marking.mode !== "reading") return;
        const table = dropped.find((candidate) => delimiterFor(candidate.name) !== null);
        if (table === undefined) {
          state.notice = `${dropped[0]?.name ?? "The file"} is not a .csv or .tsv file; a spreadsheet arrives by paste or by export.`;
          return;
        }
        await importTable$(table, null);
      }}
    >
      {/* Entering the mode is announced. The region is out of the flow, so
          what it says moves no document content, and it says nothing while
          reading rather than announcing a resting state nobody chose. */}
      <p class="visually-hidden" role="status">
        {marking.store.marking.mode === "command" ? "Command mode" : ""}
      </p>
      <StandingAnnouncement />
      {/* The picker *Import table* opens: a .csv or .tsv becomes a table after
          the block the bar named. BO_0287_013 */}
      <input
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        class="visually-hidden"
        data-table-file
        tabIndex={-1}
        aria-hidden="true"
        ref={tableFile}
        onChange$={async (_: Event, element: HTMLInputElement) => {
          const file = element.files?.[0];
          element.value = "";
          if (file === undefined) return;
          const below = importAfter.value;
          await importTable$(file, null, below ?? undefined);
        }}
      />
      <input
        type="file"
        multiple
        accept="image/*"
        class="visually-hidden"
        data-capture-file
        tabIndex={-1}
        aria-hidden="true"
        ref={captureFile}
        onChange$={async (_: Event, element: HTMLInputElement) => {
          const files = Array.from(element.files ?? []);
          element.value = "";
          await capture$(files, captureAfter.value);
        }}
      />
      <PassageAffordance surface={state} />
      {doc === null ? (
        <p data-block-loading>Reading the document…</p>
      ) : (
        <>
          {state.notice !== null && (
            <p class="block-notice" role="alert" data-block-error>
              {state.notice}
            </p>
          )}
          <div class="block-surface" data-block-surface>
            {/* The one line that stays under the bar once the header has
                scrolled away: the title and the role pills; a press is back
                to the top. DO_0030_003 */}
            <CompactHeader
              header={documentHeader}
              title={isUnnamed(doc.title) ? unnamedTitle(doc) : doc.title}
              documentId={documentId ?? ""}
              dataRevision={state.document?.dataRevision}
            />
            {/* The document in one block flow, so the header's spacing and
                the rows' still collapse into one another as they always
                have; the surface is a column only so that what follows it
                can take the height the document leaves. DO_0028_001 */}
            {/* Between its rows the body takes a structure dropped from the
                library, applied to the whole document by a run, and lights red
                while that is what a release would do. BO_0349_012 */}
            <div
              class="document-flow"
              data-applying={
                bridge.drag.operation === "link" && (bridge.drag.overId ?? "").startsWith("block:") && actsOnBody(bridge.drag.payload?.kind ?? "")
                  ? "true"
                  : undefined
              }
            >
              {/* The document's header: the route, the title, and the lines
                  the extensions draw under it — the roles, their values, a
                  keyword's mentions — one unit with one spacing, its left edge
                  on the blocks' text. DO_0030_002 */}
              <header
                ref={documentHeader}
                class="document-header"
                data-document-header
                data-drop-target={`header:${documentId ?? ""}`}
                data-accepts={doc.record === INSTRUCTION_RECORD || doc.named === "structure" ? "move link" : "link"}
              >
                {/* The header takes a structure or an instruction dragged out
                    of the library, used on the document (BO_0349_011); an
                    instruction's header also takes a block dropped on it as an
                    example to shape the instruction by, red while that is what
                    a release would do, since it starts a run (BO_0349_014). */}
                <HeaderMark id={documentId ?? ""} drag={bridge.drag} examples={doc.record === INSTRUCTION_RECORD || doc.named === "structure"} />
                {routeOf(tab).length > 1 && (
                  <nav class="document-route" data-document-route aria-label="Route">
                    <button
                      type="button"
                      class="document-route__back"
                      data-route-back
                      onClick$={() => back$(routeOf(tab).length - 2)}
                    >
                      ← Back
                    </button>
                    {routeOf(tab).map((entry, index, route) => (
                      <span key={`${index}:${entry.itemId}`} class="document-route__crumb">
                        {index > 0 && <span aria-hidden="true"> › </span>}
                        {index < route.length - 1 ? (
                          <button
                            type="button"
                            data-route-crumb={entry.itemId}
                            data-route-gone={crumbs.gone.includes(entry.itemId) ? "" : undefined}
                            class={crumbs.gone.includes(entry.itemId) ? "document-route__gone" : undefined}
                            onClick$={() => back$(index)}
                          >
                            {entry.title}
                          </button>
                        ) : (
                          <span data-route-current={entry.itemId}>{entry.title}</span>
                        )}
                      </span>
                    ))}
                  </nav>
                )}
                <span id="document-title-label" class="visually-hidden">
                  Document title
                </span>
                <h2 class="document-title">
                  {/* A document nobody has named holds no title text: the minted
                      name is painted over the empty field as its placeholder, so
                      naming it does not start with deleting a word the system
                      wrote. The heading takes its accessible name from the same
                      words, standing beside the empty field rather than in it, so
                      an unnamed document is still a named heading. DO_0012_002 */}
                  {isUnnamed(doc.title) && <span class="visually-hidden">{unnamedTitle(doc)}</span>}
                  <span
                    class="document-title__text"
                    ref={titleField}
                    data-document-title
                    data-unnamed={isUnnamed(doc.title) ? "true" : "false"}
                    data-placeholder={unnamedTitle(doc)}
                    aria-placeholder={unnamedTitle(doc)}
                    role="textbox"
                    aria-labelledby="document-title-label"
                    // A title a guard keeps is drawn fixed, its reason its
                    // title. RO_0005_020
                    contentEditable={doc.fixed?.title === undefined ? "true" : "false"}
                    {...(doc.fixed?.title === undefined ? {} : { "data-title-fixed": "true", title: doc.fixed.title })}
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
                        element.textContent = shownTitle(state.document);
                        element.blur();
                      }
                    }}
                    onBlur$={(_, element) => saveTitle$(element)}
                  ></span>
                  {doc.proposed !== undefined && <StartedBy proposer={doc.proposed.proposer} />}
                </h2>
                {/* The header's lines under the title: each extension's
                    contribution a row of its own, in extension order, carrying
                    nothing of a command's own. Their presses are their own.
                    calliopa-bootstrap's BO_0309_031, DO_0030_001 */}
                <div class="document-title-place" data-document-title-place stoppropagation:click>
                  <div class="document-title-place__chip">
                    <DocumentDecorations at="title" form="full" documentId={documentId ?? ""} dataRevision={state.document?.dataRevision} />
                  </div>
                </div>
              </header>
              {/* The person's branch on this document: entering and leaving
                  it, accepting it by its standing, and what a rejected one
                  held. BO_0250_020 */}
              <BranchLine
                editor={state}
                documentId={documentId}
                tab={tab}
                deactivate$={deactivate$}
                reload$={reload$}
                reloadProposals$={reloadProposals$}
                answerProposal$={answerProposal$}
                retrySave$={retryRefused$}
              />
              {/* Whatever an extension has to say about this document wraps the
                  blocks it says it about: it reads the document once and shares
                  what it read, and renders the root's own chrome above them.
                  A tree with no such extension wraps nothing. BO_0256_007 */}
              <DecorationProvider documentId={documentId ?? ""}>
                {emptyDocument(doc) &&
                doc.proposed === undefined &&
                state.activeBlockId === null &&
                // A document whose reading order says nothing is a blank page —
                // unless the reader has asked to see what was retired out of it,
                // which is content to show and so not a blank page at all. So is
                // a proposal shown: the proposals are drawn among the blocks, and
                // a blank page in their place left the toggle showing nothing.
                // DO_0002
                !(state.retiredOpen && state.retired.length > 0) &&
                shownProposals.length === 0 ? (
                  // A blank page, not a row saying the block is empty. The hint
                  // sits where the first line will be, so the caret arrives where
                  // the reader was already looking.
                  <button
                    type="button"
                    class="document-empty"
                    data-document-empty
                    // A blank page is where a dragged block lands first, as the
                    // area below the last block is on a page that has some.
                    // Found in the CA_0072 walk.
                    data-drop-target="block:end"
                    data-accepts="move link"
                    onClick$={() => startWriting$()}
                  >
                    <DropMark id="end" drag={bridge.drag} self={documentId} />
                    <span class="document-empty__hint">Write something</span>
                  </button>
                ) : (
                  <div class="blocks" data-block-count={doc.blocks.length}>
                    {drawn.map((entry, index, rows) => {
                      if (entry.kind === "proposal") {
                        // A removal and a move frame the block they concern,
                        // which stays the editor's; they are drawn with it.
                        if (framed.has(entry.item.blockId) && framed.get(entry.item.blockId)?.includes(entry.item)) return null;
                        // Possible relations in quantity: the first two under a
                        // block draw in full, the rest collapse to one line
                        // that opens them. BO_0247_005
                        if (isInferredRelation(entry.item) && !relationsOpen.blocks.includes(entry.item.blockId)) {
                          const siblings = rows.filter((row) => row.kind === "proposal" && row.item.blockId === entry.item.blockId && isInferredRelation(row.item));
                          const at = siblings.findIndex((row) => row.kind === "proposal" && row.item.itemId === entry.item.itemId);
                          if (at >= 2) {
                            if (at > 2) return null;
                            return (
                              <p class="proposal-relations-more" key={`more:${entry.item.blockId}`}>
                                <button
                                  type="button"
                                  data-relations-more={entry.item.blockId}
                                  onClick$={() => {
                                    relationsOpen.blocks = [...relationsOpen.blocks, entry.item.blockId];
                                  }}
                                >
                                  and {siblings.length - 2} more possible {siblings.length - 2 === 1 ? "relation" : "relations"}
                                </button>
                              </p>
                            );
                          }
                        }
                        const proposal = (
                          <ProposalBlock
                            // Keyed by the block's revision as a block row is
                            // (CA_0045_003): the row's item is a member of a
                            // plain row object, which the optimizer hands the
                            // component once, at mount — so a proposed block
                            // revised after it was drawn, a picture filled when
                            // its generation lands, is a new row, not a stale
                            // one. The item being edited keeps its row under the
                            // caret. CA_0063_005
                            key={`proposal:${entry.item.itemId}:${
                              state.editingItemId === entry.item.itemId ? "editing" : (entry.item.block?.revisionId ?? "")
                            }`}
                            item={entry.item}
                            // A rewrite of a table that a file stands behind
                            // drops the file with the acceptance, and the row
                            // says so. BO_0287_016
                            dropsFile={
                              entry.item.kind === "replace" &&
                              entry.item.block?.kind === "table" &&
                              entry.item.block.file === undefined &&
                              doc.blocks.some((held) => held.blockId === entry.item.blockId && held.kind === "table" && held.file !== undefined)
                            }
                            numbersCode={doc.lineNumbers !== false}
                            proposer={groupOf(entry.item.groupId)?.proposer ?? UNKNOWN_PROPOSER}
                            words={itemWords(entry.item, runEvents, groupOf(entry.item.groupId)?.proposer)}
                            refinedBy={refinerOf(entry.item, state.runActivities)}
                            withdrawal={withdrawerOf(entry.item, state.runActivities)}
                            withdrawing={withdrawnCountOf(entry.item.itemId, state.proposals)}
                            successor$={revealSuccessor$}
                            card={cards.get(entry.item.itemId)}
                            deferred={state.proposalsOpen && groupOf(entry.item.groupId)?.deferred === true}
                            origin={cards.get(entry.item.itemId)?.edge === "first" || cards.get(entry.item.itemId)?.edge === "only" ? cardOrigin(entry.item.groupId, state.runs, doc.blocks) : null}
                            destination={destinationFor(entry.item)}
                            answer$={answerProposal$}
                            settle$={settleProposal$}
                            settleReason$={settleReason$}
                            focus$={$(() => focusItem$(entry.item.itemId))}
                            focused={state.focusedItemId === entry.item.itemId}
                            editing={state.editingItemId === entry.item.itemId}
                            hoverFocus$={$(() => hoverFocus$(null, entry.item.itemId))}
                            edit$={$((editing: boolean) => editItem$(entry.item.itemId, editing))}
                            grip={{ ...edge(positionOf(entry) ?? `proposal:${entry.item.itemId}`), step$: stepRow$ }}
                            startDrag$={startProposalDrag$}
                            step$={stepProposal$}
                            standing$={$((to: Standing) => standProposal$(entry.item.itemId, to))}
                          />
                        );
                        // A proposed insert is a place to drop a block: it has a
                        // key before it is accepted. BO_0263_002 A rewrite in its
                        // block's place is that block's place. CA_0055_005
                        const position = positionOf(entry);
                        if (position !== null) return dropSlot(position, proposal);
                        return proposal;
                      }
                      // A revealed removed row is a place to drop a block,
                      // where it sits. BO_0263_002
                      if (entry.rejected !== undefined) {
                        return (
                          <RetiredRow
                            key={`rejected:${entry.rejected.itemId}`}
                            block={entry.block}
                            rejected={entry.rejected.itemId}
                            restore$={reopen$}
                            first
                            last
                            startDrag$={startRowDrag$}
                            stepRow$={stepRow$}
                            focus$={$(() => focusItem$(entry.rejected?.itemId ?? ""))}
                            focused={state.focusedItemId === entry.rejected.itemId}
                          />
                        );
                      }
                      if (entry.retired) {
                        return dropSlot(
                          entry.block.blockId,
                          <RetiredRow block={entry.block} restore$={restore$} {...edge(entry.block.blockId)} startDrag$={startRowDrag$} stepRow$={stepRow$} focus$={focus$} focused={entry.block.blockId === state.focusedBlockId} />,
                          `retired:${entry.block.blockId}`,
                        );
                      }
                      const row = (
                        <BlockRow
                          // Keyed by revision, not just identity: a row renders one
                          // revision of a block, so a revised block is a new row. The
                          // block's own identity is unchanged, and the graph is what
                          // says so. The row being edited is the exception: it
                          // renders the editor, not a revision, and a revision its
                          // own save wrote must not remount the element the caret
                          // is in. Leaving puts the revision back into its key.
                          // CA_0045_003
                          key={`${entry.block.blockId}:${
                            entry.block.blockId === state.activeBlockId
                              ? "editing"
                              : entry.block.revisionId
                          }`}
                          block={entry.block}
                          arranged={state.arrangement.collapsed.includes(entry.block.blockId) ? "collapsed" : state.arrangement.dimmed.includes(entry.block.blockId) ? "dimmed" : undefined}
                          equationNumbers={state.document?.equationNumbers}
                          codeFirstLines={codeFirstLines}
                          lines$={reportCodeLines$}
                          figureNumbers={state.document?.figureNumbers}
                          tableNumbers={state.document?.tableNumbers}
                          listingNumbers={state.document?.listingNumbers}
                          referenceLabels={state.document?.referenceLabels}
                          references={referenceChoices(state.document ?? { blocks: [] }, state.activeBlockId)}
                          setFigure$={setFigure$}
                          citationNumbers={state.document?.citationNumbers}
                          missingWorks={state.document?.missingWorks}
                          index={index}
                          first={edge(entry.block.blockId).first}
                          last={edge(entry.block.blockId).last}
                          stepRow$={stepRow$}
                          active={entry.block.blockId === state.activeBlockId}
                          focused={entry.block.blockId === state.focusedBlockId}
                          focus$={focus$}
                          hoverFocus$={hoverFocus$}
                          blocks={doc.blocks}
                          documentId={documentId ?? ""}
                          face={state.faces?.[entry.block.blockId] ?? null}
                          nested={state.nested?.targetId === entry.block.blockId ? { blockId: state.nested.blockId, documentId: state.nested.documentId } : null}
                          nestDone$={nestDone$}
                          pressControl$={pressBlockControl$}
                          pressing={pressing}
                          editor={editor}
                          drag={bridge.drag}
                          activate$={activate$}
                          deactivate$={deactivate$}
                          move$={move$}
                          remove$={removeBlock$}
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

                          agentRead={agentReadOf(entry.block.blockId)}
                          send$={sendBlock$}
                          commandChoice={choiceIn(commandChoices.byBlock, state.runs, state.document, entry.block.blockId, state.mode)}
                          setKeep$={setKeep$}
              pinch$={pinch$}
                          switchCommandMode$={switchCommandMode$}
                          prompted={state.sources.includes(entry.block.blockId)}
                          promptsOpen={state.promptsOpen}
                          commandFiles={commandFiles.byBlock}
                          reviseTable$={reviseTable$}
                          reviseEquation$={reviseEquation$}
                          reviseInline$={reviseInline$}
                          reviseLocator$={reviseLocator$}
                          reviseCode$={reviseCode$}
                          continueCode$={setCodeContinues$}
                          numbersCode={state.document?.lineNumbers !== false}
                          importTable$={importTable$}
                          uploadImage$={uploadImage$}
                          pasteGrid$={pasteGrid$}
                          createParagraphAfter$={$(() => insert$("text", { blockId: entry.block.blockId }))}
                        />
                      );
                      // Framed by each removal or move that concerns it, the
                      // first outermost. BO_0233_004
                      const framedRow = (framed.get(entry.block.blockId) ?? []).reduceRight(
                        (inner, item) => (
                          <ProposalBlock
                            // Keyed by revision as the row above. CA_0063_005
                            key={`proposal:${item.itemId}:${
                              state.editingItemId === item.itemId ? "editing" : (item.block?.revisionId ?? "")
                            }`}
                            item={item}
                            numbersCode={doc.lineNumbers !== false}
                            proposer={groupOf(item.groupId)?.proposer ?? UNKNOWN_PROPOSER}
                            words={item.kind === "gather" ? GATHERED_WORDS : itemWords(item, runEvents, groupOf(item.groupId)?.proposer)}
                            refinedBy={refinerOf(item, state.runActivities)}
                            withdrawal={withdrawerOf(item, state.runActivities)}
                            withdrawing={withdrawnCountOf(item.itemId, state.proposals)}
                            successor$={revealSuccessor$}
                            destination={destinationFor(item)}
                            answer$={answerProposal$}
                            settle$={settleProposal$}
                            settleReason$={settleReason$}
                            focus$={$(() => focusItem$(item.itemId))}
                            focused={state.focusedItemId === item.itemId}
                            editing={state.editingItemId === item.itemId}
                            hoverFocus$={$(() => hoverFocus$(null, item.itemId))}
                            edit$={$((editing: boolean) => editItem$(item.itemId, editing))}
                            startDrag$={startProposalDrag$}
                            step$={stepProposal$}
                            standing$={$((to: Standing) => standProposal$(item.itemId, to))}
                            framed={entry.block}
                          >
                            {inner}
                          </ProposalBlock>
                        ),
                        row,
                      );
                      return framedRow;
                    })}
                    <DropMark id="end" drag={bridge.drag} self={documentId} />
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
                      data-accepts="move link"
                      aria-label="Write below the last block"
                      onClick$={() => startWriting$()}
                    />
                    {/* What is said of the document as a whole, after its last
                        block, by whichever extension has something to say
                        there: the bibliography's reference list. BO_0291_031 */}
                    <DocumentDecorations at="end" documentId={documentId ?? ""} dataRevision={state.document?.dataRevision} />
                  </div>
                )}
              </DecorationProvider>
            </div>
            {/* The rest of the surface below the document, down to its
                bottom edge, means what the blank page and the area below the
                last block mean: a press starts writing there, a drag lands
                there last. Those two stay the keyboard's way in; this only
                carries the same answer to wherever a pointer lands under
                them. DO_0028_001 */}
            <button
              type="button"
              class="document-rest"
              data-document-rest
              data-drop-target="block:end"
              data-accepts="move link"
              tabIndex={-1}
              aria-hidden="true"
              onClick$={() => startWriting$()}
            />
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
/**
 * Where a dragged block would land.
 *
 * Its own component because the target under the pointer changes on every
 * pointer move: reading that in the document's render would rebuild the block
 * list dozens of times a second.
 */
const DropMark = component$<{ id: string; drag: ViewDragState; self: string | null }>(
  ({ id, drag, self }) => (
    <span
      class="drop-mark"
      data-drop-mark={id}
      // A document held over itself lands nowhere in it. DO_0043_004
      data-drop-active={drag.overId === `block:${id}` && drag.operation !== "link" && !draggedOverItself(drag.payload, self) ? "true" : undefined}
    />
  ),
);

/**
 * An instruction's header lit red while a block dropped there would start a
 * run shaping the instruction by it (`calliopa-bootstrap`'s `BO_0349_014`,
 * `BO_0349_Q8`): out of the flow, as the nest mark is.
 */
const HeaderMark = component$<{ id: string; drag: ViewDragState; examples: boolean }>(({ id, drag, examples }) => {
  const over = drag.overId === `header:${id}` && drag.operation != null;
  // A passage is taken as an example only where the header takes examples;
  // anywhere else it lands on nothing. BO_0349_013
  const passage = drag.payload?.kind === PASSAGE_DRAG_KIND;
  const active = !over || (passage && !examples) ? "false" : drag.operation === "move" || passage ? "acts" : "true";
  return <span class="shape-mark" data-shape-mark={id} data-drop-active={active} aria-hidden="true" />;
});

/** The marked passage a drop target names (`passage:<block>:<number>`): its
 * block and its words, or null when it is not marked any more. BO_0349_038 */
function passageAt(marking: Parameters<typeof passagesIn>[0], target: string): { blockId: string; quote: string } | null {
  const [, blockId, number] = target.split(":");
  if (blockId === undefined || number === undefined) return null;
  const passage = passagesIn(marking, blockId).find((each) => each.number === Number(number));
  return passage === undefined ? null : { blockId, quote: passage.anchor.quote };
}

/**
 * The whole row lit while a dropped block would be taken into it as focused
 * work (CA_0072_007): a component of its own, as the drop mark is, so the
 * pointer crossing rows redraws the mark and never the row whose words the
 * caret may sit in.
 */
const NestMark = component$<{ id: string; drag: ViewDragState; self: string | null }>(({ id, drag, self }) => (
  <span
    class="nest-mark"
    data-nest-mark={id}
    data-drop-active={drag.overId === `nest:${id}` && !draggedOverItself(drag.payload, self) ? "true" : "false"}
    aria-hidden="true"
  />
));

/** The agent reading a block: its face and the mark's words, until the mark
 * goes. BO_0265_013 */
interface AgentRead extends ReadMark {
  readonly face: ProposalFace;
}

/**
 * The agent's mark on a block it is reading: its face and one line on the
 * block's bottom border, gone three seconds after the last read. It is
 * decoration beside the block's own name and announced to no one, since a
 * stream of reads would drown the reader. BO_0265_013
 */
const AgentReadMark = component$<{ blockId: string; read: AgentRead }>(({ blockId, read }) => (
  <span class="agent-read-mark" data-agent-read={blockId} aria-hidden="true">
    <span class="agent-read-mark__face">
      {read.face.kind === "image" ? (
        <img class="agent-read-mark__portrait" src={read.face.src} alt="" width={20} height={20} draggable={false} />
      ) : (
        <Icon name={read.face.icon} size={12} />
      )}
    </span>
    <span class="agent-read-mark__words">{read.words}</span>
  </span>
));

/** One block, in reading presentation or as the active editor. */
const BlockRow = component$<{
  block: BlockView;
  index: number;
  first: boolean;
  last: boolean;
  active: boolean;
  /** The block whose depth is revealed. CA_0046_001 */
  focused: boolean;
  focus$: QRL<(blockId: string) => void>;
  /** A rest of the pointer on this row. Whether it takes the focus is the
   * editor's rule: nothing is taken while a block or a proposal is being
   * edited. DO_0006_008 */
  hoverFocus$: QRL<(blockId: string | null, itemId: string | null) => void>;
  blocks: readonly BlockView[];
  /** The number each numbered equation of this document carries, so a
   * reference run in a sentence is drawn as its equation number. Derived on
   * every read and stored nowhere. BO_0290_015 */
  equationNumbers?: Readonly<Record<string, number>> | undefined;
  /** Where each code block's numbering starts, resolved by the editor over
   * the document and what is being typed (`BO_0302_006`); handed apart from
   * the block, whose row a changed number does not remount. */
  codeFirstLines?: Readonly<Record<string, number>> | undefined;
  /** A code block's line count as typed. BO_0302_006 */
  lines$: ReportCodeLines;
  /** The number each numbered figure and table carries, so a reference run is
   * drawn as its figure's or table's number. BO_0295_012 */
  figureNumbers?: Readonly<Record<string, number>> | undefined;
  tableNumbers?: Readonly<Record<string, number>> | undefined;
  /** The number each numbered code block carries as a listing. BO_0303_011 */
  listingNumbers?: Readonly<Record<string, number>> | undefined;
  /** What a reference to any block is drawn as, by the block's identity, and
   * the blocks the `#` list offers the sentence being edited. BO_0300_005
   * BO_0300_007 */
  referenceLabels?: Readonly<Record<string, string>> | undefined;
  references?: readonly ReferenceChoice[] | undefined;
  /** Sets a picture's or an output's caption and its number's ask. BO_0295_010 */
  setFigure$: SetFigure;
  /** The number each cited work carries in this document, and the works
   * cited that are not at the pin, so a citation run is drawn as its number
   * or as gone. Derived on every read and stored nowhere. BO_0291_025 */
  citationNumbers?: Readonly<Record<string, number>> | undefined;
  missingWorks?: readonly string[] | undefined;
  /** The document the row belongs to, for the decorations it renders. */
  documentId: string;
  /** The focused work this block has, when it has one: the shell's answer,
   * drawn as this view's face. CA_0065_010 */
  face: FocusedChild | null;
  /** The block a drop has just nested into this one, while the `nested`
   * place asks what the nest means. BO_0349_010 */
  nested: NestedBlock | null;
  nestDone$: QRL<() => void>;
  /** Presses one of the shell's own block controls. CA_0065_009 */
  pressControl$: QRL<(control: string, blockId: string) => void>;
  /** A pointer press under way, so the focus it takes is left to the click. */
  pressing: { now: boolean };
  editor: EditorState;
  drag: ViewDragState;
  activate$: QRL<
    (blockId: string, offset: number | "end", until?: number) => void
  >;
  deactivate$: QRL<() => void>;
  move$: QRL<(blockId: string, by: -1 | 1) => void>;
  /** Removes the block: it is retired, and the take-back can restore it
   * where it was drawn. BO_0315_011 */
  remove$: QRL<(blockId: string) => void>;
  /** One arrow press on the idle grip. BO_0263_013 */
  stepRow$: QRL<(position: string, direction: -1 | 1) => void>;
  startBlockDrag$: QRL<
    (blockId: string, preview: string, event: PointerEvent) => void
  >;
  editRuns$: QRL<(runs: Run[], start: number, end: number) => void>;
  input$: QRL<(element: HTMLElement) => void>;
  select$: QRL<(element: HTMLElement) => void>;
  split$: QRL<(at: number) => void>;
  merge$: QRL<(direction: "back" | "forward") => void>;
  step$: QRL<(direction: -1 | 1, from?: { readonly column: number; readonly x: number | null }) => void>;
  undo$: QRL<() => void>;
  redo$: QRL<() => void>;
  toggleMark$: QRL<(mark: Mark) => void>;

  /** The agent reading this block, while its mark stands. BO_0265_013 */
  agentRead?: AgentRead | null;
  /** Sends the block as a command. BO_0267_012 */
  send$: QRL<(blockId: string, asPrompt: boolean, attachments: readonly AttachmentDescriptor[]) => Promise<SentCommand & { readonly note?: string }>>;
  /** The block's command choices: *Keep as content* and the mode. DO_0025 */
  commandChoice: CommandChoice;
  setKeep$: QRL<(blockId: string, keep: boolean) => void>;
  /** The pinch without a gesture, for the command line. BO_0322_012 */
  pinch$: QRL<(pinch: "in" | "out", blockId: string) => Promise<SentCommand>>;
  switchCommandMode$: QRL<(blockId: string, axis: "field" | "work") => void>;
  /** Whether a run the person may see was sent from this block, which *Show
   * prompts* marks on a block kept as content. BO_0267_015 */
  prompted: boolean;
  /** Whether *Show prompts* is on. BO_0267_015 */
  promptsOpen: boolean;
  /** The files each block's command carries, by block. BO_0267_012 */
  commandFiles: Record<string, AttachmentHolder>;
  /** A table revised whole. BO_0287_011 */
  reviseTable$: ReviseTable;
  /** An equation revised whole from its popover. BO_0290_016 */
  reviseEquation$: QRL<(blockId: string, draft: EquationDraft) => void>;
  /** The inline equation the reader pressed, given its new source. BO_0290_025 */
  reviseInline$: QRL<(at: number, tex: string) => void>;
  /** The citation the reader pressed, given its new locator. BO_0291_034 */
  reviseLocator$: QRL<(at: number, locator: string) => void>;
  /** A code block revised whole. BO_0289_018 */
  reviseCode$: ReviseCode;
  /** A code block set to continue its numbering, or not. BO_0302_008 */
  continueCode$: ContinueCode;
  /** Whether the document numbers the lines of its code. BO_0302_007 */
  numbersCode: boolean;
  /** A .csv or .tsv dropped on the row while reading. BO_0287_013 */
  importTable$: QRL<(file: File, afterBlockId: string | null) => Promise<void>>;
  /** Fills an empty image block from a selected file. DO_0018_001 */
  uploadImage$: QRL<(blockId: string, file: File) => Promise<void>>;
  /** A grid pasted into the empty block being edited. BO_0287_012 */
  pasteGrid$: QRL<(text: string) => Promise<void>>;
  /** Creates a top-level paragraph immediately after this row. */
  createParagraphAfter$: QRL<() => Promise<void>>;
  /** How Hermes's arrangement draws the row: collapsed to its first line or
   * dimmed, undone while the block is focused. BO_0350_005 */
  arranged?: "collapsed" | "dimmed" | undefined;
}>(
  ({
    arranged,
    block,
    index,
    first,
    last,
    active,
    focused,
    focus$,
    hoverFocus$,
    equationNumbers,
    codeFirstLines,
    lines$,
    figureNumbers,
    tableNumbers,
    listingNumbers,
    referenceLabels,
    references,
    setFigure$,
    citationNumbers,
    missingWorks,
    documentId,
    pressing,
    editor,
    drag,
    activate$,
    deactivate$,
    move$,
    remove$,
    stepRow$,
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
    agentRead,
    send$,
    commandChoice,
    setKeep$,
    pinch$,
    switchCommandMode$,
    prompted,
    promptsOpen,
    commandFiles,
    face,
    pressControl$,
    reviseTable$,
    reviseEquation$,
    reviseInline$,
    reviseLocator$,
    reviseCode$,
    continueCode$,
    numbersCode,
    importTable$,
    uploadImage$,
    pasteGrid$,
    createParagraphAfter$,
    nested,
    nestDone$,
  }) => {
    const position = index + 1;
    /** The pause before a hovered row reveals its depth, so a pointer
     * crossing the page reveals nothing on the way. DO_0004_002 */
    const hover = useStore({ timer: 0 });
    // What command mode says about this row: the mode, and this block's
    // reference number or `null` for a block nobody has marked.
    const {
      store: markingStore,
      toggleReference$,
      addPassage$,
      removeReference$,
    } = useContext(MarkingContext);
    // A prompt's references in its words (`BO_0352_011`): drawn against the
    // prompt's marks, titled as the `#` list names the blocks, and pressed to
    // show what they name (`BO_0352_012`).
    const markBridge = useContext(ViewBridgeContext);
    const markTitles = blockTitles(references ?? []);
    const promptMarksHere = promptMarks(markingStore, block.blockId);
    const revealMark$ = $(async (reference: MarkRef, drawn: DrawnMark) => {
      const target = markReveal(reference, drawn);
      if (target !== null) await askReveal(markBridge, documentId, target);
    });
    const mode = markingStore.marking.mode;
    // The prompt pointed from: pointing leaves it unmarkable, with its command
    // control on it, and a press on it goes back to editing it. BO_0267_013
    const pointingFrom = mode === "command" && markingStore.prompt === block.blockId;
    const reference = referenceFor(markingStore.marking, block.blockId);
    // And what the scale says: the block's standing, and the passages marked
    // in it with whether each still matches its words.
    const { store: standingStore, setStanding$ } = useContext(StandingContext);
    const inlineAnnotations = useContext(InlineAnnotationsContext, null);
    // Read here so the row draws again when a provider writes. BO_0301_015
    const annotations = isText(block) && inlineAnnotations !== null && inlineAnnotations.version >= 0 ? annotationsOn(inlineAnnotations, block.blockId) : [];
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
    // In command mode a text block's words are its marking control, so its
    // attributes are patched as the block is marked (`BO_0231_001`, the
    // `_jsxC` reason, which outlives the standing toolbar this once stood
    // beside); a block with no words to carry it — a divider, an
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
    // A row with no words to read — a table, code, an equation, a picture, a
    // divider, an output — is reached as a text row's words are: in tab
    // order, and a tap or a click on it focuses it, never edits it. Hover
    // alone reached none of it on a phone or from the keyboard. DO_0016_004
    const reachable = !marking && !isText(block) ? { tabIndex: 0 } : {};

    return (
      <div
        class="block-row"
        data-block-id={block.blockId}
        data-block-kind={block.kind}
        data-focused={focused && !active && !marking ? "true" : undefined}
        data-reference={marking && reference !== null ? reference : undefined}
        data-standing={standing}
        data-arranged={arranged !== undefined && !focused && !active ? arranged : undefined}
        data-pointing-from={pointingFrom ? "true" : undefined}
        data-prompted={promptsOpen && prompted && standing !== "prompt" ? "true" : undefined}
        data-drop-target={`block:${block.blockId}`}
        // Over its middle half a text row takes the dropped block into it,
        // as its focused work; its edges still place before and after it.
        // CA_0072_007
        data-drop-middle={isText(block) ? `nest:${block.blockId}` : undefined}
        data-accepts="move link"
        // Its middle also takes a structure or an instruction dragged out of
        // the library, which the extension knowing it uses there. BO_0349_011
        data-middle-accepts={isText(block) ? "move link" : undefined}
        {...markable}
        {...reachable}
        onFocusIn$={() => {
          if (isText(block) || markingStore.marking.mode !== "reading" || editor.blockId !== null) return;
          void focus$(block.blockId);
        }}
        // On a pointer that hovers, hovering a reading row focuses it, which
        // reveals its depth and brings the bar's block groups up; with a
        // block or a proposal being edited, hovering reveals nothing and
        // takes nothing. DO_0004_002 DO_0006_003 DO_0006_008
        onPointerEnter$={(event: PointerEvent) => {
          if (event.pointerType !== "mouse" || !hoverPointer()) return;
          if (markingStore.marking.mode !== "reading") return;
          clearTimeout(hover.timer);
          hover.timer = Number(setTimeout(() => {
            hover.timer = 0;
            void hoverFocus$(block.blockId, null);
          }, HOVER_DEPTH_MS));
        }}
        // The focus holds once given: the pointer leaving only cancels a
        // rest that has not focused yet. A bar whose groups emptied behind
        // the pointer would name no block, and the block it names is the one
        // that is visibly focused. DO_0006_003
        onPointerLeave$={(event: PointerEvent) => {
          if (event.pointerType !== "mouse" || !hoverPointer()) return;
          clearTimeout(hover.timer);
          hover.timer = 0;
        }}
        // A file dropped on the block being edited is attached to its
        // command (BO_0267_012); a .csv or .tsv dropped on a row while
        // reading becomes a table after it (BO_0287_013). The row marks the
        // event as taken, so the view's root — which takes a drop anywhere
        // else in the tab — leaves it alone; the root's preventdefault
        // attributes reach this row as its ancestor.
        onDrop$={async (event: DragEvent) => {
          (event as TakenDrop).takenByRow = true;
          const dropped = Array.from(event.dataTransfer?.files ?? []);
          if (dropped.length === 0) return;
          if (active) {
            await attachFiles(filesOf(commandFiles, block.blockId), dropped, uploadFile);
            return;
          }
          if (markingStore.marking.mode !== "reading") return;
          const table = dropped.find((candidate) => delimiterFor(candidate.name) !== null);
          if (table === undefined) return;
          await importTable$(table, block.blockId);
        }}
        // The mode is read from the store at the press, never from this
        // render's copy of it: a row whose handlers outlived the mode they
        // were drawn in would otherwise mark while reading, or open an editor
        // while pointing — the rule `BO_0226_005` set for the composer.
        onClick$={(event: MouseEvent, element: HTMLElement) => {
          if (markingStore.marking.mode !== "command") return;
          // The command control answers its own press, and the prompt pointed
          // from is not marked from itself: `◎` ends pointing. BO_0267_013
          if (inCommandControl(event.target) || markingStore.prompt === block.blockId) return;
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
          // The prompt pointed from is being written in: its keys are the
          // editor's, never a mark. BO_0267_023
          if (markingStore.prompt === block.blockId) return;
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
        <DropMark id={block.blockId} drag={drag} self={documentId} />
        {isText(block) && <NestMark id={block.blockId} drag={drag} self={documentId} />}
        {agentRead != null && <AgentReadMark key={agentRead.until} blockId={block.blockId} read={agentRead} />}

        {/* The number, in the gutter the grips use and out of the row's flow,
         * so a mark changes colour and never geometry. The row's own name
         * already says which reference this is, so the badge is decoration to a
         * screen reader rather than a second reading of the same fact. */}
        {marking && reference !== null && (
          <span class="block-reference" aria-hidden="true">
            #{reference}
          </span>
        )}
        {isText(block) && !active && <StandingMark block={block} prompted={promptsOpen && prompted} />}
        {/* What a block is marked with on its headline is whatever an
            extension has to say about it — that it changed since the reader
            last looked, that a premise upstream moved. The editor renders the
            place and knows neither. BO_0256_007 */}
        <BlockDecorations
          at="headline"
          documentId={documentId}
          blockId={block.blockId}
          revisionId={block.revisionId}
          active={active}
        />
        {/* The block bar stands on the bar's subject while reading: the block
         * being edited when there is one, else the row turned to. It is drawn
         * rather than hidden, so a button that should not be there takes no
         * focus and needs no rule to say so, and command mode draws none at
         * all. What the frame offers on a block is drawn in it and filled by
         * the shell. DO_0014_001 DO_0014_002 CA_0065_009 BO_0315_013 */}
        {mode === "reading" && (active || focused) && (
          <BlockBar
            measured
            {...(isText(block) || block.kind === "image"
              ? {
                  controlsFor: {
                    documentId,
                    blockId: block.blockId,
                    hasFocusedWork: face !== null,
                    press$: pressControl$,
                  },
                }
              : {})}
            label={`block ${position}`}
            id={block.blockId}
            arrows={active ? "block" : "row"}
            first={first}
            last={last}
            step$={active ? move$ : stepRow$}
            standing={isText(block) ? standing : null}
            fixate$={setStanding$}
            remove$={remove$}
          />
        )}
        <PassageNumbers block={block} documentId={documentId} />

        {/* Every row's handle while reading: drawn on hover on a desktop and on
         * the focused row on a phone, dragging without editing. Its arrows are
         * the block bar's. BO_0263_013 BO_0315_014 */}
        {!active && mode === "reading" && (
          <RowGrip
            label={`block ${position}`}
            drag$={$((event: PointerEvent) => startBlockDrag$(block.blockId, preview, event))}
          />
        )}

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
        {block.kind === "admonition" && <AdmonitionCallout block={block} documentId={documentId ?? ""} createOutside$={createParagraphAfter$} /> }

        {/* A numbered block's number is handed to its view from the read's
            map, never read off the block: the row is keyed by revision and its
            block is set when the row mounts (`_wrapProp` of a plain row entry),
            while a number is the document's order, stored nowhere, so a block
            numbered above this one changes its number and no revision. The
            map is the editor's state, which every read replaces. BO_0295_014 */}
        {/* A picture or a moving picture. It carries no authored text and takes
            no text editor, as a divider does not. BO_0273_011 */}
        {(block.kind === "image" || block.kind === "video") && (
          <MediaBlock block={block} number={figureNumbers?.[block.blockId]} caption$={block.kind === "image" && mode === "reading" ? setFigure$ : undefined} uploadImage$={mode === "reading" ? uploadImage$ : undefined} />
        )}

        {/* A table: its cells edited in place while reading, each edit one
            whole-block revise; in command mode it is read. BO_0287_011 */}
        {block.kind === "table" && (
          <TableBlock block={block} number={tableNumbers?.[block.blockId]} editable={mode === "reading"} revise$={reviseTable$} />
        )}

        {/* A display equation. It arrives already typeset from the server,
            carries no authored text and takes no text editor, as a divider
            does not; editing it is the popover. BO_0290_014 */}
        {block.kind === "equation" && (
          <EquationBlock block={block} number={equationNumbers?.[block.blockId]} revise$={mode === "reading" ? reviseEquation$ : undefined} />
        )}

        {/* Code: typed in place while reading, each settled edit one
            whole-block revise; the send below the source is the `code`
            extension's, drawn in the `run` place, and an output the kernel
            staged is read. BO_0289_018 */}
        {block.kind === "sourcecode" && (
          <>
            <CodeBlock
              block={block}
              editable={mode === "reading"}
              numbered={numbersCode}
              firstLine={codeFirstLines?.[block.blockId]}
              number={listingNumbers?.[block.blockId]}
              caption$={mode === "reading" ? setFigure$ : undefined}
              lines$={lines$}
              revise$={reviseCode$}
              continue$={continueCode$}
            />
            {mode === "reading" && (
              <BlockDecorations at="run" documentId={documentId} blockId={block.blockId} revisionId={block.revisionId} active={active} />
            )}
          </>
        )}
        {block.kind === "output" && <OutputBlock block={block} number={figureNumbers?.[block.blockId]} caption$={mode === "reading" ? setFigure$ : undefined} />}

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
          <Tag class="block-text" data-block-reading data-role={block.role}>
            {/* Keyed on the piece's words: a piece is a plain object cut at
                render, which Qwik draws once and never patches, so a piece
                whose words or annotation changed is drawn anew. BO_0301_015 */}
            {annotate(block.runs, annotations).map(({ run: entry, annotation }, at) => (
              <Annotated key={`${at}:${annotation === null ? "" : annotation.id}:${entry.text}`} annotation={annotation} store={inlineAnnotations}>
              <Marked
                text={entry.text}
                marks={entry.marks ?? []}
                link={entry.link}
                math={entry.math}
                svg={block.mathSvg?.[entry.text]}
                equationRef={entry.equationRef}
                number={entry.equationRef === undefined ? undefined : equationNumbers?.[entry.equationRef]}
                figureRef={entry.figureRef}
                tableRef={entry.tableRef}
                refNumber={
                  entry.figureRef !== undefined
                    ? figureNumbers?.[entry.figureRef]
                    : entry.tableRef !== undefined
                      ? tableNumbers?.[entry.tableRef]
                      : undefined
                }
                blockRef={entry.blockRef}
                refLabel={entry.blockRef === undefined ? undefined : referenceLabels?.[entry.blockRef]}
                markRef={entry.markRef}
                markDrawn={entry.markRef === undefined ? undefined : drawnMark(entry.markRef, promptMarksHere, markTitles)}
                onMark$={revealMark$}
                cite={entry.cite}
                citeNumber={entry.cite === undefined ? undefined : citationNumbers?.[entry.cite.work]}
                citeMissing={entry.cite === undefined ? undefined : missingWorks?.includes(entry.cite.work) === true}
              />
              </Annotated>
            ))}
          </Tag>
          </div>
        )}

        {isText(block) && !active && mode === "reading" && (
          <Tag
            class="block-text"
            data-role={block.role}
            data-block-reading
            // The reading block is the activation affordance now that no
            // control sits beside it: reachable in tab order, named, and
            // activated by Enter or Space like the button it replaced.
            tabIndex={0}
            role="button"
            aria-label={readingName(facts)}
            // A pointer press takes the browser's focus before its click
            // arrives; the click decides what the press meant, so the focus
            // event is left alone while a press is under way. CA_0046_001
            onPointerDown$={() => {
              pressing.now = true;
            }}
            onFocus$={() => {
              if (pressing.now || markingStore.marking.mode !== "reading") return;
              void focus$(block.blockId);
            }}
            onClick$={(event: MouseEvent, element: HTMLElement) => {
              pressing.now = false;
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
              if (range !== null && range.start !== range.end) {
                void activate$(block.blockId, range.start, range.end);
                return;
              }
              // A first press focuses the block and reveals its depth; a
              // second edits it, so reading a document's depth costs no
              // accidental edits. User decision, 2026-09-13. While another
              // block is being edited the press hands the editor over at
              // once, as `CA_0045_003` fixes, so a phone's keyboard stays
              // open. CA_0046_001
              // On a pointer that hovers, one click edits: hovering has shown
              // the block's controls and depth already. User decision,
              // 2026-09-18. DO_0004_001
              if (!focused && editor.blockId === null && !hoverPointer()) {
                void focus$(block.blockId);
                return;
              }
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
              if (markingStore.marking.mode !== "reading") return;
              // Enter, Space or a key that would type edits a focused block;
              // on a block not yet focused, Enter and Space focus it first.
              // CA_0046_001
              const types = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
              if (event.key !== "Enter" && event.key !== " " && !types) return;
              event.preventDefault();
              if (!focused && !types && editor.blockId === null) {
                void focus$(block.blockId);
                return;
              }
              void activate$(block.blockId, "end");
            }}
          >
            {/* Keyed on the piece's words: a piece is a plain object cut at
                render, which Qwik draws once and never patches, so a piece
                whose words or annotation changed is drawn anew. BO_0301_015 */}
            {annotate(block.runs, annotations).map(({ run: entry, annotation }, at) => (
              <Annotated key={`${at}:${annotation === null ? "" : annotation.id}:${entry.text}`} annotation={annotation} store={inlineAnnotations}>
              <Marked
                text={entry.text}
                marks={entry.marks ?? []}
                link={entry.link}
                math={entry.math}
                svg={block.mathSvg?.[entry.text]}
                equationRef={entry.equationRef}
                number={entry.equationRef === undefined ? undefined : equationNumbers?.[entry.equationRef]}
                figureRef={entry.figureRef}
                tableRef={entry.tableRef}
                refNumber={
                  entry.figureRef !== undefined
                    ? figureNumbers?.[entry.figureRef]
                    : entry.tableRef !== undefined
                      ? tableNumbers?.[entry.tableRef]
                      : undefined
                }
                blockRef={entry.blockRef}
                refLabel={entry.blockRef === undefined ? undefined : referenceLabels?.[entry.blockRef]}
                markRef={entry.markRef}
                markDrawn={entry.markRef === undefined ? undefined : drawnMark(entry.markRef, promptMarksHere, markTitles)}
                onMark$={revealMark$}
                cite={entry.cite}
                citeNumber={entry.cite === undefined ? undefined : citationNumbers?.[entry.cite.work]}
                citeMissing={entry.cite === undefined ? undefined : missingWorks?.includes(entry.cite.work) === true}
              />
              </Annotated>
            ))}
          </Tag>
        )}

        {/* The face of the focused work the block holds: the child's own
            words when it holds any, else its title. The shell answers what it
            says; this view draws the line. CA_0065_010 */}
        {isText(block) && !active && mode === "reading" && face !== null && (
          <BlockFace
            itemId={face.itemId}
            title={face.title}
            face={face.face}
            lines={face.lines}
            open$={$(() => pressControl$("focused-work", block.blockId))}
          />
        )}

        {/* Under a block another was just nested into: what the nest means,
            asked by whichever extension has something to ask. BO_0349_010 */}
        {nested !== null && (
          <div class="block-nested-place" data-nested-place={block.blockId}>
            <BlockDecorations
              at="nested"
              documentId={documentId}
              blockId={block.blockId}
              revisionId={block.revisionId}
              active={active}
              nested={nested}
              done$={nestDone$}
            />
          </div>
        )}

        {/* What else is said below a block, by whichever extension has
            something to say there. BO_0256_007 */}
        {isText(block) && !active && mode === "reading" && (
          <BlockDecorations
            at="below"
            documentId={documentId}
            blockId={block.blockId}
            revisionId={block.revisionId}
            active={active}
          />
        )}

        {isText(block) && active && (
          <ActiveBlockText
            tag={Tag}
            label={`Block ${position}`}
            editor={editor}
            citationNumbers={citationNumbers}
            equationNumbers={equationNumbers}
            figureNumbers={figureNumbers}
            tableNumbers={tableNumbers}
            referenceLabels={referenceLabels}
            references={references}
            documentId={documentId}
            mathSvg={isText(block) ? block.mathSvg : undefined}
            missingWorks={missingWorks}
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
            pasteGrid$={pasteGrid$}
            reviseInline$={reviseInline$}
            reviseLocator$={reviseLocator$}
          />
        )}

        <BlockFailure blockId={block.blockId} editor={editor} />
        {/* The command control: on the block being edited, and on the prompt
            pointed from. BO_0267_012 */}
        {isText(block) && (active || pointingFrom) && (
          <CommandControl
            documentId={documentId}
            blockId={block.blockId}
            editor={editor}
            pointing={pointingFrom}
            send$={send$}
            choice={commandChoice}
            setKeep$={setKeep$}
            pinch$={pinch$}
            switchMode$={switchCommandMode$}
            editRuns$={editRuns$}
            resume$={$(() => activate$(block.blockId, "end"))}
            files={filesOf(commandFiles, block.blockId)}
            references={references ?? []}
          />
        )}
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
  /** What a citation in the block is drawn as while it is edited. BO_0291_025 */
  citationNumbers?: Readonly<Record<string, number>> | undefined;
  missingWorks?: readonly string[] | undefined;
  /** The equation numbers of the document and the sources its read set, so
   * mathematics in the block being edited is drawn as it is drawn when read.
   * BO_0290_027 */
  equationNumbers?: Readonly<Record<string, number>> | undefined;
  /** The figure and table numbers a reference in the block is drawn as.
   * BO_0295_012 */
  figureNumbers?: Readonly<Record<string, number>> | undefined;
  tableNumbers?: Readonly<Record<string, number>> | undefined;
  mathSvg?: Readonly<Record<string, string>> | undefined;
  input$: QRL<(element: HTMLElement) => void>;
  select$: QRL<(element: HTMLElement) => void>;
  editRuns$: QRL<(runs: Run[], start: number, end: number) => void>;
  deactivate$: QRL<() => void>;
  split$: QRL<(at: number) => void>;
  merge$: QRL<(direction: "back" | "forward") => void>;
  step$: QRL<(direction: -1 | 1, from?: { readonly column: number; readonly x: number | null }) => void>;
  undo$: QRL<() => void>;
  redo$: QRL<() => void>;
  toggleMark$: QRL<(mark: Mark) => void>;
  /** A grid pasted into this block while it is empty. BO_0287_012 */
  pasteGrid$: QRL<(text: string) => Promise<void>>;
  /** The inline equation the reader pressed, given the source its popover
   * was closed with. BO_0290_025 */
  reviseInline$: QRL<(at: number, tex: string) => void>;
  /** The citation the reader pressed, given the locator its popover was
   * closed with. BO_0291_034 */
  reviseLocator$: QRL<(at: number, locator: string) => void>;
  /** What a reference to any block is drawn as on the surface. BO_0300_007 */
  referenceLabels?: Readonly<Record<string, string>> | undefined;
  /** The document's blocks as the `#` list names them, and the document,
   * for a prompt's references drawn and pressed on the surface. BO_0352_011 */
  references?: readonly ReferenceChoice[] | undefined;
  documentId: string;
}>((props) => {
  const {
    tag,
    label,
    editor,
    citationNumbers,
    missingWorks,
    equationNumbers,
    figureNumbers,
    tableNumbers,
    referenceLabels,
    mathSvg,
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
    pasteGrid$,
    reviseInline$,
    reviseLocator$,
  } = props;
  const host = useSignal<HTMLElement>();
  const Tag = tag;
  // A citation's label is an attribute, so new numbers are written onto the
  // atoms in place: no repaint, and the caret stays where it is. BO_0291_025
  const cited = useContext(CitedWorksContext, null);
  useVisibleTask$(({ track }) => {
    const numbers = track(() => cited?.numbers);
    const missing = track(() => cited?.missing);
    const labels = track(() => cited?.labels);
    const element = host.value;
    if (element === undefined) return;
    for (const atom of Array.from(element.querySelectorAll<HTMLElement>("[data-cite-work]"))) {
      const work = atom.getAttribute("data-cite-work") ?? "";
      const locator = atom.getAttribute("data-cite-locator");
      const gone = missing?.includes(work) === true;
      const cite = { work, ...(locator === null ? {} : { locator }) };
      const styled = gone ? undefined : labels?.[citationKey(cite)];
      atom.setAttribute("data-cite-label", styled ?? citeLabel(cite, numbers?.[work], gone));
      atom.className = gone ? "run-cite run-cite--missing" : "run-cite";
    }
  });
  // Whether the surface points from this block, read at the key. BO_0267_023
  const pointingFrom = useContext(MarkingContext).store;
  const surfaceBridge = useContext(ViewBridgeContext);
  const surfaceReferences = props.references;
  const surfaceDocument = props.documentId;

  // A prompt's chips warn as soon as a mark under them is taken back, and
  // stand again when it is marked again (`BO_0352_011`): the surface is
  // painted once more, keeping the caret, only when the block holds a chip and
  // what its marks name has changed — the report is a new object on every
  // read, and a repaint on each would take the caret from under the reader.
  const paintedMarks = useStore({ key: "" });
  useVisibleTask$(({ track }) => {
    const key = track(() =>
      editor.runs.some((entry) => entry.markRef !== undefined)
        ? JSON.stringify((promptMarks(pointingFrom, editor.blockId ?? "") ?? []).map((mark) => [mark.number, mark.kind, mark.document, mark.blockId, mark.quote, mark.target, mark.group, mark.item]))
        : "",
    );
    const element = host.value;
    if (key === paintedMarks.key) return;
    const first = paintedMarks.key === "";
    paintedMarks.key = key;
    if (first || key === "" || element === undefined) return;
    const caret = selectionIn(element) ?? { start: editor.start, end: editor.end };
    paintRuns(element, editor.runs, {
      referenceLabelOf: (blockId) => referenceLabels?.[blockId],
      markOf: (reference) => drawnMark(reference, promptMarks(pointingFrom, editor.blockId ?? ""), blockTitles(surfaceReferences ?? [])),
      svgOf: (tex) => mathSvg?.[tex] ?? typesetInline(tex),
      numberOf: (blockId) => equationNumbers?.[blockId],
      figureNumberOf: (blockId) => figureNumbers?.[blockId],
      tableNumberOf: (blockId) => tableNumbers?.[blockId],
      citationOf: (work, locator) => ({
        ...(citationNumbers?.[work] === undefined ? {} : { number: citationNumbers[work] }),
        ...(missingWorks?.includes(work) === true ? { missing: true } : {}),
        ...(cited?.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })] === undefined ? {} : { label: cited.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })]! }),
      }),
    });
    if (element.ownerDocument.activeElement === element) selectRange(element, caret.start, caret.end);
  });

  // A prompt's reference on the surface shows what it names, as it does when
  // read (`BO_0352_012`). The chips are painted, not rendered, so the press is
  // heard where they are: on the surface, from the element pressed — often
  // the one character inside the chip the caret counts.
  useVisibleTask$(({ cleanup }) => {
    const element = host.value;
    if (element === undefined) return;
    const pressed = (event: Event) => {
      const reference = pressedMark(event.target as Node | null, element);
      if (reference === null) return;
      const drawn = drawnMark(reference, promptMarks(pointingFrom, editor.blockId ?? ""), blockTitles(surfaceReferences ?? []));
      const target = markReveal(reference, drawn);
      if (target !== null) void askReveal(surfaceBridge, surfaceDocument, target);
    };
    element.addEventListener("click", pressed);
    cleanup(() => element.removeEventListener("click", pressed));
  });

  // A selection made by touch — a long press, then the handles — fires no
  // keyup and no mouseup; the browser says it only through `selectionchange`.
  // A range is read from there so the Format controls act on the words the
  // reader chose. A collapsed caret is left to keyup and mouseup, which a tap
  // fires: read here it could land between an input and the read of that
  // input, which judges the edit against the width of the range it replaced.
  // DO_0039_001
  useVisibleTask$(({ cleanup }) => {
    const element = host.value;
    if (element === undefined) return;
    const page = element.ownerDocument;
    const changed = () => {
      const selection = page.getSelection();
      if (selection === null || selection.isCollapsed) return;
      if (!element.contains(selection.anchorNode) || !element.contains(selection.focusNode)) return;
      void select$(element);
    };
    page.addEventListener("selectionchange", changed);
    cleanup(() => page.removeEventListener("selectionchange", changed));
  });

  useVisibleTask$(({ track }) => {
    track(() => editor.paint);
    const element = host.value;
    if (element === undefined) return;
    paintRuns(element, editor.runs, {
      svgOf: (tex) => mathSvg?.[tex] ?? typesetInline(tex),
      numberOf: (blockId) => equationNumbers?.[blockId],
      figureNumberOf: (blockId) => figureNumbers?.[blockId],
      tableNumberOf: (blockId) => tableNumbers?.[blockId],
      referenceLabelOf: (blockId) => referenceLabels?.[blockId],
      markOf: (reference) => drawnMark(reference, promptMarks(pointingFrom, editor.blockId ?? ""), blockTitles(props.references ?? [])),
      citationOf: (work, locator) => ({
        ...(citationNumbers?.[work] === undefined ? {} : { number: citationNumbers[work] }),
        ...(missingWorks?.includes(work) === true ? { missing: true } : {}),
        ...(cited?.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })] === undefined ? {} : { label: cited.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })]! }),
      }),
    });
    element.focus();
    selectRange(element, editor.start, editor.end);
    // An equation typed a moment ago, or one just changed in its popover, has
    // markup from nowhere. The surface sets it itself — it is the one place
    // already paying for the engine — and paints once more when it is ready,
    // so mathematics is never left showing its source while it is edited.
    // BO_0290_027
    void typesetMissing(editor.runs, mathSvg ?? {}).then((ready) => {
      if (!ready || host.value !== element) return;
      const caret = selectionIn(element) ?? { start: editor.start, end: editor.end };
      paintRuns(element, editor.runs, {
        svgOf: (tex) => mathSvg?.[tex] ?? typesetInline(tex),
        numberOf: (blockId) => equationNumbers?.[blockId],
        figureNumberOf: (blockId) => figureNumbers?.[blockId],
        tableNumberOf: (blockId) => tableNumbers?.[blockId],
        referenceLabelOf: (blockId) => referenceLabels?.[blockId],
        markOf: (reference) => drawnMark(reference, promptMarks(pointingFrom, editor.blockId ?? ""), blockTitles(props.references ?? [])),
        citationOf: (work, locator) => ({
          ...(citationNumbers?.[work] === undefined ? {} : { number: citationNumbers[work] }),
          ...(missingWorks?.includes(work) === true ? { missing: true } : {}),
          ...(cited?.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })] === undefined ? {} : { label: cited.labels[citationKey({ work, ...(locator === undefined ? {} : { locator }) })]! }),
        }),
      });
      selectRange(element, caret.start, caret.end);
    });
  });

  return (
    <>
    <Tag
      ref={host}
      class="block-text block-text--active"
      data-role={editor.role}
      contentEditable="true"
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-block-editor
      onInput$={(_: Event, element: HTMLElement) => input$(element)}
      onKeyUp$={(_: KeyboardEvent, element: HTMLElement) => select$(element)}
      onMouseUp$={(_: MouseEvent, element: HTMLElement) => select$(element)}
      onClick$={(event: MouseEvent, element: HTMLElement) => {
        // An equation in the line is edited in its popover, never in the
        // flow: the press finds which one it was by its place among the
        // atoms drawn, which is the order the runs hold them in.
        // BO_0290_025
        const atoms = Array.from(element.querySelectorAll("[data-math]"));
        const hit = atoms.findIndex((atom) => atom.contains(event.target as Node));
        editor.mathAt = hit < 0 ? null : hit;
        // A citation's locator is edited the same way, in its own popover.
        // BO_0291_034
        const cited = Array.from(element.querySelectorAll("[data-cite-work]"));
        const citedHit = cited.findIndex((atom) => atom.contains(event.target as Node));
        editor.citeAt = citedHit < 0 ? null : citedHit;
      }}
      onPaste$={(event: ClipboardEvent) => {
        event.preventDefault();
        // Newlines stay, so a pasted text of several lines is one block
        // showing its lines; a Windows clipboard's `\r\n` is one break.
        // DO_0003_003
        const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
        if (text === "") return;
        // A grid pasted into an empty paragraph is a table in its place; into
        // words it stays text, so a cell copied into a sentence is still a
        // sentence. BO_0287_012
        if (looksLikeGrid(text) && runsText(editor.runs).trim() === "") {
          void pasteGrid$(text);
          return;
        }
        // Words carrying $…$ arrive as mathematics among them: nothing here
        // was typed a key at a time, so every pair converts. BO_0290_024
        if (carriesMath(text)) {
          const inserted = mathInText(text);
          const runs = replaceRangeWithRuns(editor.runs, editor.start, editor.end, inserted);
          const at = Math.min(editor.start, editor.end) + runsLength(inserted);
          void editRuns$(runs, at, at);
          return;
        }
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
        // Ctrl/Cmd+Alt+C opens the bar's Cite popover, by pressing its
        // control: the panel is the shell's and hangs off that control, so
        // the shortcut goes through it rather than around it. BO_0291_024
        if (meta && event.altKey && key === "c") {
          event.preventDefault();
          element.ownerDocument.querySelector<HTMLElement>('[data-bar-action="block-cite"]')?.click();
          return;
        }
        if (event.key === "Escape") {
          // Pointing from this block, `Escape` ends the pointing, which the
          // surface decides, and the edit stays. BO_0267_023
          if (pointingFrom.marking.mode === "command") return;
          event.preventDefault();
          void deactivate$();
          return;
        }
        // Enter splits, but `Ctrl`/`Cmd`+`Enter` is the surface's, and two
        // handlers may never arbitrate one event: this one leaves it alone
        // rather than splitting the block on the mode's way in.
        if (event.key === "Enter" && !meta) {
          event.preventDefault();
          // Shift+Enter is a line inside the block, a character of its text.
          // DO_0003_003
          if (event.shiftKey) {
            const at = Math.min(editor.start, editor.end) + 1;
            void editRuns$(replaceRange(editor.runs, editor.start, editor.end, "\n"), at, at);
            return;
          }
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
        // Up and Down leave the block from anywhere on its first or last
        // drawn line; within it the browser moves between lines. The caret is
        // read live, since the browser moved it on the last key before this
        // one's keyup told the editor. DO_0003_002
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey && !event.altKey && !meta) {
          const live = selectionIn(element) ?? { start: editor.start, end: editor.end };
          if (live.start !== live.end) return;
          const direction = event.key === "ArrowUp" ? -1 : 1;
          const line = caretLine(element, live.start);
          if (direction === -1 ? !line.first : !line.last) return;
          event.preventDefault();
          void step$(direction, { column: line.column, x: line.x });
          return;
        }
        if (event.key === "ArrowLeft" && collapsed && editor.start === 0) {
          event.preventDefault();
          void step$(-1);
          return;
        }
        if (event.key === "ArrowRight" && collapsed && editor.start === length) {
          event.preventDefault();
          void step$(1);
        }
      }}
    />
      {editor.mathAt !== null && ((openOn: number) => (
        <EquationPopover
          key={editor.mathAt}
          draft={{ tex: editor.runs.filter((run) => run.math === true)[editor.mathAt]?.text ?? "" }}
          block={false}
          save$={$((draft: EquationDraft) => {
            // The index is captured where the panel was opened, so the close
            // cannot take it away before the save has read it.
            void reviseInline$(openOn, draft.tex);
          })}
          close$={$(() => {
            editor.mathAt = null;
          })}
        />
      ))(editor.mathAt)}
      {editor.citeAt !== null && ((openOn: number) => (
        <LocatorPopover
          key={editor.citeAt}
          locator={editor.runs.filter((run) => run.cite !== undefined)[editor.citeAt]?.cite?.locator ?? ""}
          save$={$((locator: string) => {
            // Captured where the panel opened, as the equation's index is.
            void reviseLocator$(openOn, locator);
          })}
          close$={$(() => {
            editor.citeAt = null;
          })}
        />
      ))(editor.citeAt)}
    </>
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
  /** The rejected proposal this row draws, when it is one: *Restore* reopens
   * it, and it neither moves nor marks. BO_0315_015 */
  rejected?: string;
  /** Restores the block, or reopens the rejected proposal, by what it names. */
  restore$: QRL<(id: string) => void>;
  first: boolean;
  last: boolean;
  startDrag$: QRL<(itemId: string, preview: string, event: PointerEvent) => void>;
  stepRow$: QRL<(position: string, direction: -1 | 1) => void>;
  /** Tells the editor the reader has turned to this row, so the bar's *Add …*
   * controls place below it. DO_0016_005 */
  focus$: QRL<(blockId: string) => void>;
  /** Whether this is the row the reader has turned to. DO_0016_005 */
  focused: boolean;
}>(({ block, rejected, restore$, first, last, startDrag$, stepRow$, focus$, focused }) => {
  const { store, toggleReference$ } = useContext(MarkingContext);
  const name = isText(block)
    ? runsText(block.runs) || "empty block"
    : `${block.kind} block`;
  // In command mode its words mark it, and take passages: the mark points at
  // the block as retired, with the revision the reader sees. BO_0263_005
  const marked: MarkedTarget = { target: "retired", revisionId: block.revisionId, words: openingWords(name) };
  const commanding = store.marking.mode === "command";
  const proposal = rejected !== undefined;
  const numbers = rowNumbers(store.marking, block.blockId, marked);
  return (
    <div
      class="retired-row"
      data-retired-id={proposal ? undefined : block.blockId}
      data-rejected-id={rejected}
      data-focused={focused ? "true" : undefined}
      role="group"
      aria-label={proposal ? `Removed proposal: ${name}` : `Removed: ${name}`}
      {...(proposal ? {} : rowMarkAttributes(block.blockId, marked))}
      data-reference={commanding && numbers.reference !== null ? numbers.reference : undefined}
    >
      {!proposal && <RowMarks blockId={block.blockId} marked={marked} />}
      {/* Moved without being restored. BO_0263_012 */}
      {!commanding && !proposal && (
        <RowGrip
          inline
          label="removed block"
          drag$={$((event: PointerEvent) => startDrag$(`retired:${block.blockId}`, name, event))}
        />
      )}
      {/* Turned to while reading, it carries the block bar with its arrows and
          *Restore*. BO_0315_014 */}
      {!commanding && focused && (
        <BlockBar
          label="removed block"
          id={rejected ?? block.blockId}
          arrows="row"
          first={first}
          last={last}
          {...(proposal ? {} : { step$: stepRow$ })}
          standing={null}
          restore$={restore$}
        />
      )}
      <CardLabel mark="removed" />
      <div
        class="retired-row__text"
        data-mark-text
        // A tap or the keyboard focuses the row, which shows its grip on a
        // phone and makes it the subject of the bar's *Add …*. DO_0016_005
        tabIndex={0}
        onFocusIn$={() => {
          if (store.marking.mode === "reading") void focus$(block.blockId);
        }}
        {...(commanding && !proposal
          ? {
              role: "button",
              "aria-pressed": numbers.reference !== null,
              "aria-label": rowMarkingName(`removed block: “${openingWords(name)}”`, numbers.reference, numbers.passages),
            }
          : {})}
        onClick$={(_: MouseEvent, element: HTMLElement) => {
          if (proposal || store.marking.mode !== "command" || !clickMarks(element)) return;
          void toggleReference$(block.blockId, marked);
        }}
        onKeyDown$={(event: KeyboardEvent) => {
          if (proposal || store.marking.mode !== "command" || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          void toggleReference$(block.blockId, marked);
        }}
      >
        {name}
      </div>
    </div>
  );
});

const AdmonitionCallout = component$<{ block: Extract<BlockView, { kind: "admonition" }>; documentId: string; createOutside$: QRL<() => Promise<void>> }>(({ block, documentId, createOutside$ }) => {
  const host = useSignal<HTMLElement>();
  const state = useStore<{ pattern: { name: string; color: string; image?: PatternImage; footline?: string } | null; patterns: { id: string; name: string; color: string; image?: PatternImage; footline?: string }[]; revisionId: string; childRevisions: Record<string, string>; children: TextBlockView[]; pendingFocus: { blockId: string; offset: number } | null }>({ pattern: null, patterns: [], revisionId: block.revisionId, childRevisions: {}, children: [...block.children], pendingFocus: null });
  useVisibleTask$(async ({ cleanup }) => {
    const win = host.value?.ownerDocument.defaultView;
    if (win === null || win === undefined) return;
    const refresh = async () => {
      const response = await fetch("/api/x/documents/patterns");
      if (!response.ok) return;
      const answer = await response.json() as { outcome: string; result?: ({ id: string; name: string; color: string; image?: PatternImage; footline?: string })[] };
      state.patterns = answer.result ?? [];
      state.pattern = answer.result?.find((pattern) => pattern.id === block.patternId) ?? null;
    };
    await refresh();
    const changed = () => { void refresh(); };
    win.addEventListener("admonition-patterns-updated", changed);
    cleanup(() => win.removeEventListener("admonition-patterns-updated", changed));
  });
  useVisibleTask$(({ track }) => {
    const pending = track(() => state.pendingFocus);
    if (pending === null) return;
    state.pendingFocus = null;
    const doc = host.value?.ownerDocument;
    const win = doc?.defaultView;
    const target = host.value?.querySelector<HTMLElement>(`[data-block-id="${pending.blockId}"]`);
    if (doc === undefined || win === null || win === undefined) return;
    if (target === null || target === undefined) return;
    target.focus();
    const range = doc.createRange();
    const walker = doc.createTreeWalker(target, 4);
    let remaining = pending.offset;
    let node = walker.nextNode();
    while (node !== null) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = win.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      remaining -= length;
      node = walker.nextNode();
    }
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = win.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  const pattern = state.pattern;
  const imageSource = patternImageSource(pattern?.image);
  const refreshChildren$ = $(async () => {
    const response = await fetch(`/api/x/documents/d/${documentId}`);
    if (!response.ok) return;
    const answer = await response.json() as { result?: DocumentView };
    const updated = answer.result?.blocks.find(
      (entry): entry is AdmonitionBlockView => entry.blockId === block.blockId && entry.kind === "admonition",
    );
    state.children = updated === undefined ? state.children : [...updated.children];
  });
  const addChild$ = $(async (afterBlockId?: string, runs: readonly Run[] = []) => {
    const response = await fetch(`/api/x/documents/d/${documentId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "insertAdmonitionChild", parentBlockId: block.blockId, ...(afterBlockId ? { afterBlockId } : {}), runs }) });
    const answer = await response.json() as { outcome: string; result?: { blockId: string } };
    if (answer.outcome === "success") { await refreshChildren$(); return answer.result?.blockId; }
    return undefined;
  });
  const saveChild$ = $(async (child: TextBlockView, target: HTMLElement) => {
    const response = await fetch(`/api/x/documents/d/${documentId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "revise", blockId: child.blockId, baseRevisionId: state.childRevisions[child.blockId] ?? child.revisionId, runs: [{ text: target.innerText ?? target.textContent ?? "" }] }) });
    const answer = await response.json() as { outcome: string; result?: { revisionId: string } };
    if (answer.outcome === "success" && answer.result) state.childRevisions[child.blockId] = answer.result.revisionId;
  });
  const splitChild$ = $(async (child: TextBlockView, event: KeyboardEvent, element: HTMLElement) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const doc = host.value?.ownerDocument;
    const win = doc?.defaultView;
    if (doc === undefined || win === null || win === undefined) return;
    const selection = win.getSelection();
    const full = element.innerText ?? element.textContent ?? "";
    if (state.children.at(-1)?.blockId === child.blockId && full.trim() === "") {
      await createOutside$();
      return;
    }
    let offset = full.length;
    if (selection?.rangeCount) { const range = selection.getRangeAt(0).cloneRange(); range.selectNodeContents(element); range.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset); offset = range.toString().length; }
    const head = full.slice(0, offset); const tail = full.slice(offset);
    const revised = await fetch(`/api/x/documents/d/${documentId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "revise", blockId: child.blockId, baseRevisionId: state.childRevisions[child.blockId] ?? child.revisionId, runs: [{ text: head }] }) });
    const reviseAnswer = await revised.json() as { outcome: string; result?: { revisionId: string } };
    if (reviseAnswer.outcome !== "success") return;
    state.childRevisions[child.blockId] = reviseAnswer.result?.revisionId ?? child.revisionId;
    const created = await addChild$(child.blockId, [{ text: tail }]);
    if (created) state.pendingFocus = { blockId: created, offset: 0 };
  });
  const moveChildCaret$ = $(async (child: TextBlockView, direction: -1 | 1, element: HTMLElement) => {
    const doc = host.value?.ownerDocument;
    const win = doc?.defaultView;
    if (doc === undefined || win === null || win === undefined) return;
    const index = state.children.findIndex((candidate) => candidate.blockId === child.blockId);
    const targetChild = state.children[index + direction];
    if (targetChild === undefined) return;
    const selection = win.getSelection();
    if (selection === null || selection.rangeCount === 0 || !selection.getRangeAt(0).collapsed) return;
    const current = selection.getRangeAt(0);
    const prefix = doc.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(current.startContainer, current.startOffset);
    const offset = prefix.toString().length;
    const caret = current.cloneRange();
    caret.collapse(true);
    const measuredCaret = caret.getBoundingClientRect?.();
    const x = measuredCaret?.left ?? 0;
    await saveChild$(child, element);
    const target = host.value?.querySelector<HTMLElement>(`[data-block-id="${targetChild.blockId}"]`);
    if (target === null) return;
    if (target === undefined) return;
    const walker = doc.createTreeWalker(target, 4);
    const positions: { node: Node; offset: number; line: number; x: number; global: number }[] = [];
    let textNode = walker.nextNode();
    let global = 0;
    while (textNode !== null) {
      const length = textNode.textContent?.length ?? 0;
      for (let point = 0; point <= length; point++) {
        const range = doc.createRange();
        range.setStart(textNode, point);
        range.collapse(true);
        const rect = range.getBoundingClientRect?.();
        positions.push({ node: textNode, offset: point, line: rect?.top ?? 0, x: rect?.left ?? 0, global: global + point });
      }
      global += length;
      textNode = walker.nextNode();
    }
    let targetOffset = Math.min(offset, (target.innerText ?? target.textContent ?? "").length);
    if (positions.some((point) => point.line !== 0 || point.x !== 0)) {
      const line = direction < 0 ? Math.max(...positions.map((point) => point.line)) : Math.min(...positions.map((point) => point.line));
      targetOffset = positions
        .filter((point) => point.line === line)
        .reduce((best, point) => Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best).global;
    } else if (positions.length > 0) {
      targetOffset = direction < 0 ? (target.innerText ?? target.textContent ?? "").length : 0;
    }
    target.focus();
    const range = doc.createRange();
    const targetWalker = doc.createTreeWalker(target, 4);
    let remaining = targetOffset;
    let targetNode = targetWalker.nextNode();
    while (targetNode !== null) {
      const length = targetNode.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(targetNode, remaining);
        range.collapse(true);
        const nextSelection = win.getSelection();
        nextSelection?.removeAllRanges();
        nextSelection?.addRange(range);
        return;
      }
      remaining -= length;
      targetNode = targetWalker.nextNode();
    }
    range.selectNodeContents(target);
    range.collapse(false);
    const nextSelection = win.getSelection();
    nextSelection?.removeAllRanges();
    nextSelection?.addRange(range);
  });
  const mergeChild$ = $(async (child: TextBlockView, adjacent: TextBlockView, direction: "back" | "forward", element: HTMLElement) => {
    const into = direction === "back" ? adjacent : child;
    const from = direction === "back" ? child : adjacent;
    const adjacentElement = host.value?.querySelector<HTMLElement>(`[data-block-id="${adjacent.blockId}"]`);
    if (adjacentElement === null || adjacentElement === undefined) return;
    await saveChild$(child, element);
    await saveChild$(adjacent, adjacentElement);
    const response = await fetch(`/api/x/documents/d/${documentId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        command: "mergeAdmonitionChild",
        parentBlockId: block.blockId,
        intoBlockId: into.blockId,
        intoBaseRevisionId: state.childRevisions[into.blockId] ?? into.revisionId,
        blockId: from.blockId,
        baseRevisionId: state.childRevisions[from.blockId] ?? from.revisionId,
      }),
    });
    const answer = await response.json() as { outcome: string };
    if (answer.outcome !== "success") return;
    const caretOffset = direction === "back" ? (adjacentElement.innerText ?? adjacentElement.textContent ?? "").length : (element.innerText ?? element.textContent ?? "").length;
    await refreshChildren$();
    state.pendingFocus = { blockId: into.blockId, offset: caretOffset };
  });
  const childKeyDown$ = $(async (child: TextBlockView, event: KeyboardEvent, element: HTMLElement) => {
    const doc = host.value?.ownerDocument;
    const win = doc?.defaultView;
    if (doc === undefined || win === null || win === undefined) return;
    if (event.key === "Enter") {
      await splitChild$(child, event, element);
      return;
    }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const selection = win.getSelection();
      if (selection === null || selection.rangeCount === 0 || !selection.getRangeAt(0).collapsed) return;
      const caret = selection.getRangeAt(0).cloneRange();
      caret.collapse(true);
      const measuredCaret = caret.getBoundingClientRect?.();
      const rectTop = measuredCaret?.top ?? 0;
      const rectBottom = measuredCaret?.bottom ?? 0;
      const rectHeight = measuredCaret?.height ?? 0;
      const prefix = doc.createRange();
      prefix.selectNodeContents(element);
      prefix.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
      const offset = prefix.toString().length;
      const textLength = (element.innerText ?? element.textContent ?? "").length;
      const textLineRects: DOMRect[] = [];
      const textWalker = doc.createTreeWalker(element, 4);
      let textNode = textWalker.nextNode();
      while (textNode !== null) {
        if ((textNode.textContent?.length ?? 0) > 0) {
          const lineRange = doc.createRange();
          lineRange.selectNodeContents(textNode);
          for (const rect of Array.from(lineRange.getClientRects())) {
            if (rect.height > 0) textLineRects.push(rect);
          }
        }
        textNode = textWalker.nextNode();
      }
      const hasTextLineGeometry = rectHeight > 0 && textLineRects.length > 0;
      const atVisualEdge = hasTextLineGeometry
        ? event.key === "ArrowUp"
          ? rectTop <= Math.min(...textLineRects.map((rect) => rect.top)) + 2
          : rectBottom >= Math.max(...textLineRects.map((rect) => rect.bottom)) - 2
        : event.key === "ArrowUp" ? offset === 0 : offset === textLength;
      if (!atVisualEdge) return;
      event.preventDefault();
      await moveChildCaret$(child, event.key === "ArrowUp" ? -1 : 1, element);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      const selection = win.getSelection();
      if (selection === null || selection.rangeCount === 0 || !selection.getRangeAt(0).collapsed) return;
      const prefix = doc.createRange();
      prefix.selectNodeContents(element);
      prefix.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
      const offset = prefix.toString().length;
      const atBoundary = event.key === "Backspace" ? offset === 0 : offset === (element.innerText ?? element.textContent ?? "").length;
      if (!atBoundary) return;
      const index = state.children.findIndex((candidate) => candidate.blockId === child.blockId);
      const adjacent = state.children[index + (event.key === "Backspace" ? -1 : 1)];
      if (adjacent === undefined) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      await mergeChild$(child, adjacent, event.key === "Backspace" ? "back" : "forward", element);
    }
  });
  return <aside ref={host} class="admonition" style={{ "--admonition-color": pattern?.color ?? "var(--text-muted)", ...(imageSource ? { "--admonition-image": `url(${JSON.stringify(imageSource)})` } : {}) }} data-pattern-id={block.patternId}>
    {imageSource && <img class="admonition__image" src={imageSource} alt="" />}
    <div class="admonition__content">
      <strong>{pattern?.name ?? "Admonition"}</strong>
      <div class="admonition__children">{state.children.map((child) => <div key={child.blockId} class="admonition__text" contentEditable="true" data-block-id={child.blockId} onBlur$={(event) => saveChild$(child, event.currentTarget as HTMLElement)} onKeyDown$={(event, element) => childKeyDown$(child, event, element)}>{child.runs.map((run) => run.text).join("")}</div>)}</div>
      {pattern?.footline && <footer>{pattern.footline}</footer>}
    </div>
  </aside>;
});
