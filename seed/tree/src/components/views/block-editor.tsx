import {
  $,
  component$,
  useContext,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";

import type { DragPayload } from "~/lib/drag";
import {
  keepPresent,
  markingKey,
  NO_MARKING,
  parseMarking,
  referenceFor,
  serializeMarking,
  toggleReference,
  type EditorMode,
  type Marking,
} from "~/lib/references";
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
import type { GraphOutcome } from "~/server/outcome";
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
 * Reading and editing use the same element, so the role decides the tag once.
 *
 * Levels start at `h3` because the page's `h1` is the application and this
 * view's own title is the `h2` beneath it: a document's headings are real
 * headings, sitting below the title that names them rather than competing with
 * it, and the outline skips no level on the way down.
 */
type BlockTag = "p" | "h3" | "h4" | "h5" | "blockquote";

const ROLE_TAG: Readonly<Record<TextRole, BlockTag>> = {
  paragraph: "p",
  h1: "h3",
  h2: "h4",
  h3: "h5",
  quote: "blockquote",
};

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

/** What a failed outcome means to the person who was typing. */
function describeOutcome(outcome: GraphOutcome<unknown>): string {
  switch (outcome.outcome) {
    case "success":
      return "";
    case "conflict":
      return "This block changed somewhere else. Reload the document to see its current text before editing it again.";
    case "validationFailure":
      return outcome.failures[0].detail;
    case "noResult":
      return outcome.detail;
    case "storageError":
      return outcome.detail;
    case "authenticationFailure":
      return "This workspace is no longer signed in.";
    case "refused":
      return outcome.detail;
  }
}

async function readOutcome<T>(response: Response): Promise<GraphOutcome<T>> {
  try {
    return (await response.json()) as GraphOutcome<T>;
  } catch {
    return { outcome: "storageError", detail: "The server sent no answer." };
  }
}

const fetchDocument = async (id: string): Promise<GraphOutcome<DocumentView>> =>
  readOutcome<DocumentView>(await fetch(`/api/x/ui.shell/documents/${id}`));

const fetchRetired = async (
  id: string,
): Promise<GraphOutcome<readonly BlockView[]>> =>
  readOutcome<readonly BlockView[]>(
    await fetch(`/api/x/ui.shell/documents/${id}/retired`),
  );

interface WriteResult {
  readonly blockId: string;
  readonly revisionId: string;
  readonly tailBlockId?: string;
}

const sendCommand = async (
  id: string,
  command: Record<string, unknown>,
  keepalive = false,
): Promise<GraphOutcome<WriteResult>> =>
  readOutcome<WriteResult>(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
      keepalive,
    }),
  );

const sendRename = async (
  id: string,
  baseRevisionId: string,
  title: string,
): Promise<GraphOutcome<{ revisionId: string }>> =>
  readOutcome<{ revisionId: string }>(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "rename", baseRevisionId, title }),
    }),
  );

const fetchChanges = async (id: string): Promise<GraphOutcome<ChangeSummary>> =>
  readOutcome<ChangeSummary>(await fetch(`/api/x/ui.shell/documents/${id}/changes`));

const fetchProposals = async (
  id: string,
): Promise<GraphOutcome<DocumentProposals>> =>
  readOutcome<DocumentProposals>(await fetch(`/api/x/ui.shell/documents/${id}/proposals`));

const answerProposal = async (
  id: string,
  itemId: string,
  answer: "accepted" | "rejected",
): Promise<GraphOutcome<unknown>> =>
  readOutcome(
    await fetch(`/api/x/ui.shell/documents/${id}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "answerProposal", itemId, answer }),
    }),
  );

interface DocumentState {
  document: DocumentView | null;
  /** The mode the surface is in and what is marked in it, as one fact: they
   * are kept together and they come back together. */
  marking: Marking;
  retired: BlockView[];
  retiredOpen: boolean;
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
    marking: NO_MARKING,
    retired: [],
    retiredOpen: false,
    proposals: null,
    proposalsOpen: false,
    status: "loading",
    missing: false,
    notice: null,
    changes: null,
    saveState: null,
    activeBlockId: null,
    loaded: 0,
  });
  const editor = useStore<EditorState>(idleEditor());
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
    // A mark on nothing cannot be drawn, and the document is the only list
    // there is, so a reference whose block has left the document is dropped
    // rather than kept somewhere it could not appear.
    state.marking = keepPresent(
      state.marking,
      outcome.result.blocks.map((block) => block.blockId),
    );
  });

  const reloadRetired$ = $(async () => {
    if (documentId === null) return;
    const outcome = await fetchRetired(documentId);
    if (outcome.outcome === "success") state.retired = [...outcome.result];
  });

  const reloadProposals$ = $(async () => {
    if (documentId === null) return;
    const outcome = await fetchProposals(documentId);
    if (outcome.outcome === "success") state.proposals = outcome.result;
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
    editor.timer = window.setTimeout(() => void save$(), SAVE_PAUSE_MS);
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
      document
        .querySelector(`[data-block-id="${blockId}"]`)
        ?.scrollIntoView({ block: "nearest" });
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

  /**
   * Enters or leaves command mode.
   *
   * One place decides what the mode is, and the blocks read it. The surface
   * that owns the mode decides what a gesture means; a block never arbitrates
   * that for itself.
   *
   * Entering owns the commit rather than inheriting it from a click that
   * happened to land elsewhere: the flush that already runs when a block is
   * left is what keeps what was typed, and it leaves no block active, so the
   * bar goes with it.
   */
  const setMode$ = $(async (on: boolean) => {
    const next: EditorMode = on ? "command" : "reading";
    if (state.marking.mode === next) return;
    if (next === "command") await deactivate$();
    // Leaving preserves what was marked, so closing the mode by accident costs
    // nothing: only the mode changes here.
    state.marking = { ...state.marking, mode: next };
  });

  /**
   * Marks a block as a reference, or takes the mark back.
   *
   * Marking is not activation: it opens no editor, writes no revision, and
   * leaves the document exactly as it was. Numbers are assigned in the order
   * the reader marked, which is what lets the document be read back as the
   * list — `#2`, `#1`, `#3` down the page says both which blocks were marked
   * and in what order.
   */
  const toggleReference$ = $((blockId: string) => {
    state.marking = toggleReference(state.marking, blockId);
  });

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
    if (state.marking.mode === "command") return;
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

  const toggleProposals$ = $(async (on: boolean) => {
    state.proposalsOpen = on;
    if (state.proposalsOpen) await reloadProposals$();
  });

  /**
   * Answers one proposed change. An accepted item is truth from that moment,
   * so the document is read again: what the reader sees after answering is
   * what the graph holds, not what this surface guessed it would hold.
   */
  const answerProposal$ = $(
    async (itemId: string, answer: "accepted" | "rejected") => {
      if (documentId === null) return;
      const outcome = await answerProposal(documentId, itemId, answer);
      if (outcome.outcome !== "success") {
        state.notice = describeOutcome(outcome);
      }
      await reload$();
      await reloadProposals$();
      if (state.retiredOpen) await reloadRetired$();
      await reloadChanges$();
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
  useTask$(({ track }) => {
    track(() => state.document?.title);
    track(() => state.saveState);
    track(() => state.changes?.changeCount);
    track(() => state.changes?.lastWrittenAt);
    track(() => state.retiredOpen);
    track(() => state.proposalsOpen);
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

    const actions: ViewAction[] = [
      {
        kind: "toggle",
        id: "retired-blocks",
        label: "Show retired blocks",
        on: state.retiredOpen,
        run$: toggleRetired$,
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

  /**
   * The way into command mode, contributed to the command dock.
   *
   * A toggle, so the control says which mode the surface is in rather than
   * only offering a way in. The dock is chosen over the reading surface, which
   * stays content-only, and over the inspector, which on a phone is a sheet
   * that would have to be opened, toggled, and closed before a single block
   * could be pointed at.
   *
   * Written from a task for the reason the panel's contribution is: the
   * document's own render stays out of it, and the shell re-renders the dock
   * action alone.
   */
  useTask$(({ track }) => {
    track(() => state.status);
    track(() => state.marking.mode);
    if (state.status !== "ready") {
      bridge.dock.action = null;
      return;
    }
    bridge.dock.action = {
      kind: "toggle",
      id: "command-mode",
      label: "Command mode",
      on: state.marking.mode === "command",
      run$: setMode$,
    };
  });

  useTask$(async ({ track }) => {
    track(() => bridge.drag.drop?.seq);
    const drop = bridge.drag.drop;
    if (drop == null) return;
    if (drop.operation !== "move" || !drop.overId.startsWith("block:")) return;
    await dropOn$(drop.payload.itemId, drop.overId.slice("block:".length));
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
    if (documentId !== null) {
      try {
        state.marking = parseMarking(
          window.localStorage.getItem(markingKey(documentId)),
        );
      } catch {
        // A browser that keeps nothing is a browser this document was never
        // marked in: there is nothing to recover and nothing to report.
      }
    }
    await reload$();
    // A document as read is a document the graph holds. Reporting it is what
    // gives the tab a save state before anything is typed.
    if (state.document !== null) await report$("saved");
    if (remembered !== null) {
      if (returning && state.marking.mode === "reading") {
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
    const surface = document.querySelector<HTMLElement>("[data-block-surface]");
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
    window.addEventListener("beforeunload", leaving);
    // The surface owns the mode, so the surface hears the key: one listener
    // decides, and no block arbitrates the same event for itself. It listens on
    // the document because the shortcut opens the mode from wherever the reader
    // is on the page, including a dock collapsed to its handle.
    const view = document.querySelector<HTMLElement>(
      '[data-view-body="block-editor"]',
    );
    const keys = (event: KeyboardEvent) => {
      // A surface holding the floor has made this frame inert, and nothing
      // inert may act on a key. That is what keeps `Escape` the message's
      // first, and the ordering the shell's.
      if (view === null || view.closest("[inert]") !== null) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void setMode$(state.marking.mode !== "command");
        return;
      }
      // Reading has more local surfaces that answer `Escape` first — an active
      // block leaves editing — and in command mode there is none, because no
      // block is active in it.
      if (event.key === "Escape" && state.marking.mode === "command") {
        event.preventDefault();
        void setMode$(false);
      }
    };
    document.addEventListener("keydown", keys);

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
    document.addEventListener("pointerdown", pressed);
    document.addEventListener("click", away);
    cleanup(() => {
      remember();
      surface?.removeEventListener("scroll", remember);
      window.removeEventListener("beforeunload", leaving);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("pointerdown", pressed);
      document.removeEventListener("click", away);
      // A tab switch unmounts this view. Nothing typed may be lost to that.
      void save$(true);
    });
  });

  /**
   * Keeps the mode and its marks, device-locally and per document.
   *
   * Never graph truth: nothing here writes a revision, so a document that was
   * only marked has the same change count it had before. Not the workspace
   * record either, which follows the reader to another device; this is one
   * browser's view of one document.
   */
  useVisibleTask$(({ track }) => {
    track(() => state.marking);
    if (documentId === null) return;
    // Not before the document has been read. The mode and its marks are
    // restored on the way in, and a write from the state this view starts in
    // would clear what it was about to recover.
    if (state.status !== "ready") return;
    try {
      const kept = serializeMarking(state.marking);
      if (kept === null) window.localStorage.removeItem(markingKey(documentId));
      else window.localStorage.setItem(markingKey(documentId), kept);
    } catch {
      // A browser that keeps nothing loses the marks at the page's end. The
      // document is untouched either way, so there is nothing to recover.
    }
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
      <div class="view view--block-editor" data-view-body="block-editor">
        <p class="block-notice" role="alert" data-block-error>
          {state.notice ?? "This document could not be read."}
        </p>
      </div>
    );
  }

  const doc = state.document;

  return (
    <div
      class="view view--block-editor"
      data-view-body="block-editor"
      data-editor-mode={state.marking.mode}
    >
      {/* Entering the mode is announced. The region is out of the flow, so
          what it says moves no document content, and it says nothing while
          reading rather than announcing a resting state nobody chose. */}
      <p class="visually-hidden" role="status">
        {state.marking.mode === "command" ? "Command mode" : ""}
      </p>
      {doc === null ? (
        <p data-block-loading>Reading the document…</p>
      ) : (
        <>
          <BlockToolbar
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
                  ),
                  state.proposalsOpen
                    ? (state.proposals?.groups.flatMap(
                        (group) => group.items,
                      ) ?? [])
                    : [],
                ).map((entry, index) =>
                  entry.kind === "proposal" ? (
                    <ProposalRowView
                      key={`proposal:${entry.item.itemId}`}
                      item={entry.item}
                      answer$={answerProposal$}
                      acceptGroup$={acceptGroup$}
                      groupSize={
                        state.proposals?.groups.find(
                          (group) => group.groupId === entry.item.groupId,
                        )?.items.length ?? 1
                      }
                      stagedBy={
                        state.proposals?.groups
                          .find((group) => group.groupId === entry.item.groupId)
                          ?.stagedBy.join(", ") ?? ""
                      }
                    />
                  ) : entry.retired ? (
                    <RetiredRow
                      key={`retired:${entry.block.blockId}`}
                      block={entry.block}
                      restore$={restore$}
                    />
                  ) : (
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
                      mode={state.marking.mode}
                      reference={referenceFor(
                        state.marking,
                        entry.block.blockId,
                      )}
                      toggleReference$={toggleReference$}
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
                  ),
                )}
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
  mode: EditorMode;
  /** This block's reference number, or `null` for a block nobody has marked. */
  reference: number | null;
  toggleReference$: QRL<(blockId: string) => void>;
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
    mode,
    reference,
    toggleReference$,
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
    const Tag: BlockTag = isText(block) ? ROLE_TAG[block.role] : "p";
    const preview = isText(block) ? runsText(block.runs) : block.kind;
    // In command mode the whole block is what a click marks, whatever it holds:
    // a reference points at a block, and the reader pointing at one should not
    // have to hit its text.
    const marking = mode === "command";
    // Spread rather than a set of `undefined`s: an attribute that does not
    // apply is absent, so a reading row is a plain row again.
    const markable = marking
      ? {
          role: "button",
          tabIndex: 0,
          "aria-pressed": reference !== null,
          "aria-label":
            reference === null
              ? `Mark block ${position}`
              : `Block ${position}, reference ${reference}`,
        }
      : {};

    return (
      <div
        class="block-row"
        data-block-id={block.blockId}
        data-block-kind={block.kind}
        data-reference={marking && reference !== null ? reference : undefined}
        data-drop-target={`block:${block.blockId}`}
        data-accepts="move"
        {...markable}
        onClick$={() => {
          if (!marking) return;
          void toggleReference$(block.blockId);
        }}
        onKeyDown$={(event: KeyboardEvent) => {
          if (!marking) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
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
        {isText(block) && !active && mode === "command" && (
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
            aria-label={`Edit block ${position}`}
            onClick$={(event: MouseEvent, element: HTMLElement) => {
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
              if (event.key !== "Enter" && event.key !== " ") return;
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
 * A run's marks as real elements, peeled one at a time.
 *
 * Nesting rather than one span with classes: `strong` and `em` mean something
 * to a screen reader that a styled span does not, and the reading presentation
 * is the one a reader actually reads.
 */
const Marked = component$<{
  text: string;
  marks: readonly Mark[];
  link?: string | undefined;
}>(({ text, marks, link }) => {
  if (link !== undefined) {
    return (
      <a href={link} class="run-link">
        <Marked text={text} marks={marks} />
      </a>
    );
  }
  const [first, ...rest] = marks;
  if (first === undefined) return <span class="run">{text}</span>;
  if (first === "bold") {
    return (
      <strong>
        <Marked text={text} marks={rest} />
      </strong>
    );
  }
  if (first === "italic") {
    return (
      <em>
        <Marked text={text} marks={rest} />
      </em>
    );
  }
  if (first === "strikethrough") {
    return (
      <s>
        <Marked text={text} marks={rest} />
      </s>
    );
  }
  return (
    <code>
      <Marked text={text} marks={rest} />
    </code>
  );
});

/**
 * The document's retired blocks, and the way one comes back.
 *
 * Retirement is recoverable for the life of the document, so this list is the
 * recovery path rather than an undo that would have to survive a reload.
 */
/**
 * The blocks to draw, in reading order, with retired blocks interleaved where
 * they sat when they were retired.
 *
 * Position comes from the order key the block held at that moment. The key
 * lives on the block and its last revision still carries it, so a retired
 * block sorts among current siblings by the same string comparison they sort
 * by. A key that no longer falls between two current siblings still sorts
 * somewhere, and that is where it appears: the position is where the block
 * was, not a promise about where restoring would put it.
 *
 * A block carrying no usable key sorts after the placed ones by identity, the
 * same rule the document read already applies.
 */
export function readingOrder(
  blocks: readonly BlockView[],
  retired: readonly BlockView[],
): readonly { block: BlockView; retired: boolean }[] {
  const entries = [
    ...blocks.map((block) => ({ block, retired: false })),
    ...retired.map((block) => ({ block, retired: true })),
  ];
  const placed = entries.filter((entry) => entry.block.order !== "");
  const unplaced = entries
    .filter((entry) => entry.block.order === "")
    .sort((left, right) => (left.block.blockId < right.block.blockId ? -1 : 1));
  placed.sort((left, right) => {
    if (left.block.order !== right.block.order) {
      return left.block.order < right.block.order ? -1 : 1;
    }
    return left.block.blockId < right.block.blockId ? -1 : 1;
  });
  return [...placed, ...unplaced];
}

/**
 * The proposed changes to draw, placed where each concerns the document.
 *
 * An item that would insert a block carries an order key, so it sorts among
 * the blocks by the comparison siblings already sort by. An item that names a
 * block the reader can see is drawn immediately after that block, because
 * judging a rewrite means seeing it against what it would replace.
 *
 * An item whose block is not in the reading order — one naming a block that
 * has gone since — is drawn at the end rather than dropped, so a group the
 * reader has to answer never hides an item they cannot find.
 */
export function placeProposals(
  entries: readonly { block: BlockView; retired: boolean }[],
  items: readonly ProposedChange[],
): readonly ProposalRow[] {
  const inserts = items.filter(
    (item) => item.kind === "insert" && (item.block?.order ?? "") !== "",
  );
  const attached = new Map<string, ProposedChange[]>();
  for (const item of items) {
    if (inserts.includes(item)) continue;
    attached.set(item.blockId, [...(attached.get(item.blockId) ?? []), item]);
  }

  const rows: ProposalRow[] = [];
  const placed = [
    ...entries.map((entry) => ({
      order: entry.block.order,
      id: entry.block.blockId,
      row: { kind: "block" as const, ...entry },
    })),
    ...inserts.map((item) => ({
      order: item.block?.order ?? "",
      id: item.itemId,
      row: { kind: "proposal" as const, item },
    })),
  ];
  placed.sort((left, right) => {
    if (left.order === "" || right.order === "") {
      return left.order === right.order ? 0 : left.order === "" ? 1 : -1;
    }
    if (left.order !== right.order) return left.order < right.order ? -1 : 1;
    return left.id < right.id ? -1 : 1;
  });

  const drawn = new Set<string>();
  for (const entry of placed) {
    rows.push(entry.row);
    if (entry.row.kind !== "block") continue;
    for (const item of attached.get(entry.row.block.blockId) ?? []) {
      rows.push({ kind: "proposal", item });
      drawn.add(item.itemId);
    }
  }
  for (const item of items) {
    if (inserts.includes(item) || drawn.has(item.itemId)) continue;
    rows.push({ kind: "proposal", item });
  }
  return rows;
}

export type ProposalRow =
  | { kind: "block"; block: BlockView; retired: boolean }
  | { kind: "proposal"; item: ProposedChange };

/** What each kind of item proposes, in the reader's words. */
const PROPOSED: Record<string, string> = {
  replace: "Proposed rewrite",
  insert: "Proposed new block",
  remove: "Proposed removal",
  move: "Proposed move",
};

/**
 * A proposed change, shown against the block it concerns.
 *
 * It is visibly not truth, not the active block and not a retired block: a
 * reader with both toggles on must be able to tell at a glance which of the
 * three each row is, which is why the treatment carries a standing label and a
 * name of its own rather than a tint. It is answered here, where it is read,
 * because judging a rewrite away from the document it belongs to is the thing
 * this whole treatment exists to avoid.
 */
const ProposalRowView = component$<{
  item: ProposedChange;
  answer$: QRL<(itemId: string, answer: "accepted" | "rejected") => void>;
  acceptGroup$: QRL<(groupId: string) => void>;
  groupSize: number;
  /** Who staged the group, as the core stamped it. BO_0209_006 */
  stagedBy: string;
}>(({ item, answer$, acceptGroup$, groupSize, stagedBy }) => {
  const block = item.block;
  const text =
    block !== null && isText(block)
      ? runsText(block.runs) || "empty block"
      : "";
  const label = PROPOSED[item.kind] ?? "Proposed change";
  return (
    <div
      class="proposal-row"
      data-proposal-id={item.itemId}
      data-proposal-kind={item.kind}
      role="group"
      aria-label={`${label} for block ${item.blockId}`}
    >
      <p class="proposal-row__mark" aria-hidden="true">
        {label}
        {stagedBy !== "" && (
          <span class="proposal-row__by" data-proposal-staged-by={stagedBy}>
            {" · staged by "}
            {stagedBy}
          </span>
        )}
      </p>
      {text === "" ? null : <div class="proposal-row__text">{text}</div>}
      <div class="proposal-row__answers">
        <button
          type="button"
          data-proposal-accept={item.itemId}
          onClick$={() => answer$(item.itemId, "accepted")}
        >
          Accept
        </button>
        <button
          type="button"
          data-proposal-reject={item.itemId}
          onClick$={() => answer$(item.itemId, "rejected")}
        >
          Reject
        </button>
        {groupSize > 1 ? (
          <button
            type="button"
            data-proposal-accept-all={item.groupId}
            onClick$={() => acceptGroup$(item.groupId)}
          >
            Accept all
          </button>
        ) : null}
      </div>
    </div>
  );
});

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
