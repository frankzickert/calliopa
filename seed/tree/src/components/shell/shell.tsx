import {
  $,
  component$,
  noSerialize,
  type NoSerialize,
  useContextProvider,
  useOnDocument,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import {
  contentIcon,
  INSPECTOR_ICON,
  iconDropBefore,
  movedIconOrder,
  orderedIcons,
  shownIcon,
  nextSectionState,
  panelDraw,
  pressClosesSheet,
  pressHandle,
  type Sheet,
  pressIcon,
  sectionState,
  togglePanel,
  type Layout,
  type PanelWidths,
} from "~/lib/layout";
import { danglingNumbers } from "~/lib/command-typeahead";
import { LibraryRow, type RowPointing } from "./library-row";
import { LicenceWarning, PersonMenu } from "./header-disclosure";
import { CloseAllTabs, HeaderMenu, HeaderModeToggle, TabEdge } from "./header-menu";
import type { FocusedWork } from "~/server/focused-work";
import { Icon } from "./icons";
import { PanelIcons, PanelResizeHandle, SectionHeader, type PanelIconEntry } from "./panel";
import { SaveStatus } from "./save-status";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import {
  activeTab,
  closeAllTabs,
  closeTab,
  kindOf,
  moveTab,
  neighbourTab,
  openTab,
  openAlongRoute,
  openTabBeside,
  selectTab,
  updateTab,
  withoutReplays,
  type RouteEntry,
  type Tab,
  type TabsState,
} from "~/lib/tabs";
import {
  activeProcessCount,
  isActive,
  tabProcessState,
  type ProcessRecord,
} from "~/lib/process";
import {
  isReplayId,
  isReplayShortcut,
  playedOf,
  replayActivity,
  replayExecutionRun,
  replayProcess,
  replaySchedule,
  replayTabId,
  type ReplayRun,
} from "~/lib/replay";
import { playSteps, stopSteps } from "~/lib/replay-player";
import { endedForDocuments } from "~/lib/ended-processes";
import { tabUnnamed } from "~/lib/library";
import {
  DRAG_MOVE_TOLERANCE_PX,
  holdMark,
  holdOver,
  inMiddle,
  LONG_PRESS_MS,
  movedDistance,
  pointerIntent,
  edgeScroll,
  PANEL_ICON_TARGET,
  resolveDrop,
  SPRING_HOLD_MS,
  springAction,
  springDue,
  springRepeats,
  springs,
  tabSwipeStep,
  type DragOperation,
  type DragPayload,
  type DropTarget,
  type SpringHold,
} from "~/lib/drag";
import type { LibraryItem, OpenTarget } from "~/contract";
import type { Captured } from "~/server/port/port";
import { qualify } from "~/registry";
import { REGISTRY } from "~/registry.gen";
import type { RunEvent } from "~/server/agent/run-events";
import type { ProposedItem } from "~/server/agent/proposed";
import type { SelectableRuntime } from "~/lib/connections";
import { chooseAgent, loadAgents, refreshAgents, type Speed } from "~/lib/agent-menu";
import {
  blockCommand,
  type CommandAim,
  NO_POINTING,
  staleIn,
  type Pointing,
  type WorkingMode,
} from "~/lib/command-target";
import type { BridgeAttachment, RunContextEntry } from "~/server/agent/bridge";
import type { WorkspaceRecord } from "~/lib/workspace";
import type { Person } from "~/server/session";
import { candidates, fetchReleases, parseReleases } from "~/lib/releases";
import {
  preferredView,
  rememberView,
  resolveView,
  viewsFor,
} from "~/lib/views";
import { ViewHost } from "./view-host";
import { ViewBarPanel } from "./view-bar";
import { EXECUTION_SECTION, ExecutionSection, type ExecutionRead } from "./execution";
import { executionProcess, isRunning, type ExecutionRun } from "~/lib/execution";
import {
  InspectorPanel,
  type ProcessRegistry,
  type ProposedRead,
} from "./inspector";
import { keepOpenTabs, NO_SELECTION, pressProcess, selectedProcess } from "~/lib/process-selection";

/**
 * Settings has no content to be the target of, so it carries one synthetic
 * instance-wide target. A tab is found by its target, and this is what keeps
 * that rule true for a tab that resolves to nothing in the graph. The kind is
 * the settings extension's contribution; the header's control appears only
 * while the build holds it. BO_0202_004
 */
const SETTINGS_KIND = "settings:settings";
const SETTINGS_TARGET = "instance";
/**
 * The Update tab is the settings extension's second kind, on the same
 * synthetic target; the header's hint appears only while the build holds it,
 * the session is the owner's and a newer release exists. BO_0223_013
 */
const UPDATE_KIND = "settings:update";


/** The element id a section's header and body are paired by. */
/** The library's icon column, one icon per extension with sections, and the
 * inspector's one icon. CA_0056_001 */
const LIBRARY_ICONS: readonly PanelIconEntry[] = REGISTRY.libraryIcons.map(({ id, title, name }) => ({
  id,
  title,
  name,
}));
/** The library's icons in the reader's order. CA_0068_001 */
const libraryIcons = (layout: Layout): PanelIconEntry[] => orderedIcons(LIBRARY_ICONS, layout.libraryOrder);
const libraryIconIds = (layout: Layout): string[] => libraryIcons(layout).map((icon) => icon.id);
const INSPECTOR_ICONS: readonly PanelIconEntry[] = [
  { id: INSPECTOR_ICON, title: "Inspector", name: "info" },
];
const INSPECTOR_ICON_IDS: readonly string[] = INSPECTOR_ICONS.map((icon) => icon.id);

const sectionElementId = (key: string): string =>
  `library-${key.replace(/[^a-zA-Z0-9]+/gu, "-")}`;
import {
  ViewBridgeContext,
  type ViewBridge,
  type ViewDrop,
  type ViewInspector,
  type ViewComposeBlock,
  type ViewCommand,
  type SentCommand,
  type ViewGesture,
  type ViewPinch,
  type ViewBar,
  type ViewSave,
  type SaveState,
  type Message,
  type ViewMessage,
  type ViewProposed,
  type ViewActivity,
  type ViewReplay,
  NO_REPLAY,
  type ViewAnswerAll,
  type ViewToggleRun,
  type RunChip,
  type RunChipElsewhere,
  type ViewFocus,
  type ViewReveal,
  type ViewPointing,
  type ViewAcross,
  type ViewCommandOptions,
  afterSend,
  commandKey,
  withOption,
} from "./view-bridge";
import { chipsFor } from "~/lib/run-chips";
import {
  activitiesOf,
  followRun,
  marked,
  runEnded,
  sameActivities,
  unfinished,
  withEvents,
  type FollowedRun,
} from "~/lib/followed-runs";
import { DOCUMENT_KIND, documentOf } from "~/lib/command-target";
import { RunChips } from "./run-chips";
import "./shell.css";

/** The registry is re-attached by identity; polling is the first transport. */
export const PROCESS_POLL_INTERVAL_MS = 2000;

/** How often the reader's run is read while it is aimed at a document and
 * still going, so what it does shows at the blocks within a second of the
 * agent doing it. BO_0265_007 */
export const ACTIVE_RUN_POLL_INTERVAL_MS = 750;

/** A started document's tab until its view has read the title. BO_0251_007 */

interface DragState {
  candidate: DragPayload | null;
  payload: DragPayload | null;
  startedAt: number;
  origin: { x: number; y: number };
  position: { x: number; y: number };
  overId: string | null;
  operation: DragOperation | null;
  /** The place a dragged item is held over, which opens after the hold.
   * CA_0072_001 */
  hold: SpringHold | null;
  /** A drop the shell did not consume itself, left for the view that declared
   * the target. Kept across the idle reset, because it outlives the gesture. */
  drop: ViewDrop | null;
  drops: number;
  /** When a drag that moved something last ended, so the click a pointer's
   * lift may still send to a dragged icon does not also press it. CA_0068_002 */
  settledAt: number;
}

/** The gesture's own fields, reset between drags. `drop` and `drops` are not
 * here: a view reads the drop after the gesture that produced it has ended. */
const idleDrag = () => ({
  candidate: null,
  payload: null,
  startedAt: 0,
  origin: { x: 0, y: 0 },
  position: { x: 0, y: 0 },
  overId: null,
  operation: null,
  hold: null,
});

/** Targets the shell owns. Everything else belongs to the mounted view. */
const shellTarget = (overId: string): boolean =>
  overId.startsWith("tab:") || overId.startsWith(PANEL_ICON_TARGET);

/**
 * The pointer is not captured, so the element under it decides the target.
 * A target declares what it accepts; the payload decides what it offers.
 */
function targetUnder(x: number, y: number, iconIds: readonly string[] = []): DropTarget | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest("[data-drop-target]");
  let id = element?.getAttribute("data-drop-target");
  if (!element || id === null || id === undefined) return null;
  // Over a library icon the drop lands before it from its upper half and
  // before the next from its lower, so the target names the icon the drop
  // lands before, or the end. CA_0068_002
  if (id.startsWith(PANEL_ICON_TARGET) && id !== `${PANEL_ICON_TARGET}end`) {
    const box = element.getBoundingClientRect();
    const before = iconDropBefore(iconIds, id.slice(PANEL_ICON_TARGET.length), y > box.top + box.height / 2);
    id = `${PANEL_ICON_TARGET}${before ?? "end"}`;
  }
  // A target naming a second target for its middle means that one there: a
  // block row takes a block into it over its middle half. CA_0072_007
  const middle = element.getAttribute("data-drop-middle");
  if (middle !== null) {
    const box = element.getBoundingClientRect();
    if (inMiddle(y, box.top, box.height)) id = middle;
  }
  return {
    id,
    accepts: (element.getAttribute("data-accepts") ?? "")
      .split(" ")
      .filter(Boolean) as DragOperation[],
  };
}

/** The place under the pointer that a held drag opens, by its `data-spring`.
 * CA_0072_001 */
function springUnder(x: number, y: number): string | null {
  return document.elementFromPoint(x, y)?.closest("[data-spring]")?.getAttribute("data-spring") ?? null;
}

/**
 * The area a drag scrolls: the nearest ancestor of the point that scrolls
 * vertically, or the page. Read where the drag began, so a pointer leaving
 * the area for the header or the dock keeps scrolling it. BO_0263_017
 */
function scrollerAt(x: number, y: number): HTMLElement {
  let element = document.elementFromPoint(x, y) as HTMLElement | null;
  while (element !== null) {
    const overflow = getComputedStyle(element).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && element.scrollHeight > element.clientHeight) {
      return element;
    }
    element = element.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** What a row or a tab shows of the pointing that stands: whether one does,
 * and the number this document carries when marked whole. BO_0304_014 */
const rowPointing = (pointing: ViewPointing, document: string | null): RowPointing => ({
  active: pointing.documentId !== null,
  number: document === null ? null : (pointing.documents.find((marked) => marked.document === document)?.number ?? null),
});

export const Shell = component$<{
  workspace: WorkspaceRecord;
  processes: readonly ProcessRecord[];
  /** Every library section's data by section key, as the loaders read it. BO_0202_005 */
  library: Readonly<Record<string, unknown>>;
  /** Whose authority this page acts under, as the kernel resolved the session. BO_0209_003 */
  person: Person | null;
  /** The licence's expiry warning while one is live; never dismissible. BO_0209_005 */
  licenceWarning: string | null;
}>(({ workspace, processes, library: served, person, licenceWarning }) => {
  const layout = useStore<Layout>({ ...workspace.layout });
  /** The two panels' content widths, the browser's rather than the
   * workspace's: `null` is the default, and only the handle reads them, so a
   * drag re-renders nothing here. CA_0066_002 CA_0066_004 */
  const widths = useStore<PanelWidths>({ left: null, right: null });
  const registry = useStore<ProcessRegistry>({
    items: [...processes],
    selection: NO_SELECTION,
  });
  const mobile = useStore({ sheet: null as Sheet });
  const drag = useStore<DragState>({ ...idleDrag(), drop: null, drops: 0, settledAt: 0 });
  // The library is rendered from what the page was served with, section by
  // section as the registry names them, and a section is re-read whenever
  // this session changes what it holds. BO_0202_003
  const library = useStore<{
    data: Record<string, unknown>;
    reads: number;
  }>({
    data: { ...served },
    /** Rises on every listing read, so the rendered list is rebuilt rather
     * than reconciled. Entries move and are renamed at the same time, and a
     * keyed diff over that leaves stale names on reused rows. */
    reads: 0,
  });
  /**
   * The agent run this session started last, and the agents a command can go
   * to. Every run the session started is followed side by side in `followed`
   * (BO_0269_014), and what each has done is read back in the panel, where a
   * run's events stand in its detail (`CA_0058_006`).
   */
  const run = useStore<{
    id: string | null;
    processId: string | null;
    sending: boolean;
    /** What the agent dropdown has to say about the choice — a choice the
     * instance would not remember, or the agent the page opened away from —
     * shown beside the control a command is sent from. CA_0052_002 */
    notice: string | null;
    /**
     * The agent the next command goes to, and what there is to choose from.
     * The dropdown opens on the instance's last choice (`openingAgent`), so
     * `agent` is null only until the list has been read — and a command sent
     * before then names none, which the server takes as what the gateway is
     * running. BO_0225_004 BO_0228_011
     */
    agent: string | null;
    /** The next command's speed, opened on the person's last. BO_0269_015 */
    speed: Speed;
    runtimes: SelectableRuntime[];
    /** The remembered agent the page opened away from, and the notice that
     * said so, until a later read finds it able to run or the reader
     * chooses (`rereadAgent`). CA_0052_002 */
    awaiting: string | null;
    openingNotice: string | null;
    /**
     * Every run this session started, each with the document it was aimed at
     * and whether its end has been told to the view showing it — once per
     * run, however many polls read the end. BO_0226_007 BO_0269_014
     */
    followed: FollowedRun[];
    /** The processes whose end this shell has told the open views about,
     * so each raises the proposed signal once. BO_0245_009 CA_0063_002 */
    announced: string[];
  }>({
    id: null,
    processId: null,
    sending: false,
    notice: null,
    agent: null,
    speed: "fast" as Speed,
    runtimes: [],
    awaiting: null,
    openingNotice: null,
    followed: [] as FollowedRun[],
    announced: [] as string[],
  });
  /**
   * What the reader has marked in each document, as its view last reported,
   * and the branch each document's tab works in. Keyed by document rather
   * than tab, as the marks themselves are (`markingKey`). BO_0226_005
   */
  const aim = useStore<CommandAim>({ pointing: {} });
  /** The last run aimed at a document that ended, for the view showing it. */
  const runProposed = useStore<ViewProposed>({ itemId: null, seq: 0 });
  /** The last chip the reader pressed, for the view showing its document. CA_0039_004 */
  const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
  /** The pointing that stands across the workspace, and the last *Mark
   * document* pressed while it stands. BO_0304_014 */
  const pointing = useStore<ViewPointing>({ documentId: null, prompt: null, marks: "", documents: [], seq: 0 });
  const across = useStore<ViewAcross>({ document: null, title: "", seq: 0 });
  /** The reader's runs aimed at documents, as they go. BO_0265_007
   * BO_0269_014 */
  const activity = useStore<ViewActivity>({ runs: [], seq: 0 });
  /**
   * A finished run played back in a tab of its own (`BO_0340_004`): what the
   * replay's view reads, and beside it the run, how many of its steps have
   * played, the original process's title, when the replay started, and the
   * last refusal the shortcut met, said in the detail it was pressed in.
   */
  const replay = useStore<ViewReplay>({ ...NO_REPLAY });
  const player = useStore<{
    run: ReplayRun | null;
    played: number;
    title: string;
    startedAt: number;
    refusal: { processId: string; words: string } | null;
  }>({ run: null, played: 0, title: "", startedAt: 0, refusal: null });
  /** The open run groups each document's view reported, for the chips above
   * the command field, and the last answer pressed on one. BO_0265_008 */
  const runChips = useStore<{ byItem: Record<string, readonly RunChip[]> }>({ byItem: {} });
  const answerAll = useStore<ViewAnswerAll>({ itemId: null, group: null, answer: null, seq: 0 });
  const toggleRun = useStore<ViewToggleRun>({ itemId: null, key: null, seq: 0 });
  /** Words asked for a document tab's next command, which its view writes
   * into a new block. BO_0267_016 */
  const composeBlock = useStore<ViewComposeBlock>({ itemId: null, text: "", seq: 0 });
  const focus = useStore<ViewFocus>({ itemId: null, blockId: null, seq: 0 });
  /** The focused work a view has read, by target: what `blockControls$` reads
   * to say whether a block already has a child, without a read per block.
   * CA_0065_004 */
  const faces = useStore<{ byItem: Record<string, FocusedWork> }>({ byItem: {} });
  // The instance's last choice when it can run; otherwise what the gateway
  // runs, and a notice saying the choice was not honoured and why.
  // BO_0228_011
  useVisibleTask$(() => loadAgents(run));
  /** Every later read of the agents: the dropdown opening, and a view saying
   * they changed (`agentsChanged$`). CA_0052_001 CA_0052_002 */
  const refreshAgents$ = $(() => refreshAgents(run));
  /**
   * What the selected process's run proposed, read when the selection changes.
   * A process that is not a run answers an empty list, which is why this is
   * asked of whatever is selected rather than only of runs.
   */
  /**
   * The open tabs and which one is active. Declared before the tasks that
   * track it: Qwik lifts a task into its own chunk, and a store declared
   * below one it uses is not captured — the built chunk then carries a free
   * name and the task throws `tabs is not defined` in the browser, taking
   * the shell's state with it. Found on the served build 2026-09-22.
   */
  const tabs = useStore<TabsState>({
    tabs: workspace.tabs,
    activeTabId: workspace.activeTabId,
  });
  const proposed = useStore<ProposedRead>({ processId: null, documents: [], attachments: [], instruction: null, context: [], events: [] });
  /**
   * The runs of the document in the active tab, for the inspector's
   * *Execution* section: read when the tab changes, when a run this shell
   * started opens or ends, and on the poll while one of them is running.
   * BO_0267_010
   */
  const execution = useStore<ExecutionRead>({ itemId: null, runs: [], error: null });
  useVisibleTask$(({ track, cleanup }) => {
    const itemId = track(() => documentOf(activeTab(tabs)));
    track(() => run.id);
    track(() => runProposed.seq);
    if (itemId === null) {
      execution.itemId = null;
      execution.runs = [];
      execution.error = null;
      return;
    }
    let stopped = false;
    const read = async () => {
      try {
        const response = await fetch(`/api/runs?artifact=${encodeURIComponent(itemId)}`);
        if (stopped) return;
        if (!response.ok) {
          const refused = (await response.json().catch(() => ({}))) as { error?: string };
          execution.itemId = itemId;
          execution.error = refused.error ?? "The runs of this document could not be read.";
          return;
        }
        const body = (await response.json()) as { runs: ExecutionRun[] };
        if (stopped) return;
        execution.itemId = itemId;
        execution.runs = body.runs;
        execution.error = null;
      } catch {
        if (!stopped) execution.error = "The runs of this document could not be read.";
      }
    };
    void read();
    const timer = setInterval(() => {
      if (execution.itemId === itemId && execution.runs.some(isRunning)) void read();
    }, ACTIVE_RUN_POLL_INTERVAL_MS);
    cleanup(() => {
      stopped = true;
      clearInterval(timer);
    });
  });
  const preferred = useSignal<Record<string, string>>({
    ...workspace.preferredViews,
  });
  const save$ = $(
    async (
      nextTabs: TabsState,
      nextLayout: Layout,
      nextPreferred?: Record<string, string>,
    ) => {
      // The captured signal is read in the body, not in a default parameter:
      // the optimizer only lifts identifiers it finds inside the closure.
      const preferredViews = nextPreferred ?? preferred.value;
      // A replay's tab is never stored: a reload leaves none. BO_0340_004
      const stored = withoutReplays(nextTabs);
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...stored,
          layout: nextLayout,
          preferredViews,
        }),
      });
      if (!response.ok) throw new Error("workspace save failed");
    },
  );
  const applyTabs$ = $(async (next: TabsState) => {
    tabs.tabs = next.tabs;
    tabs.activeTabId = next.activeTabId;
    await save$(next, layout);
  });
  // One press, one save: the strip empties and the workspace draws its empty
  // line; the panels keep their state, which is theirs. CA_0067_002
  const closeAll$ = $(() => applyTabs$(closeAllTabs(tabs)));
  /**
   * A swipe across the phone's *Minimum* header makes the neighbouring tab
   * active. Only where *Minimum* is in force, and never from the menu, which
   * keeps its taps; the reading of the travel is `tabSwipeStep`'s. A touch
   * pointer is captured by its target, so the lift reaches the header
   * wherever the finger went. CA_0054_008
   */
  const lineSwipe = useStore({ pointerId: -1, x: 0, y: 0 });
  const startLineSwipe$ = $((event: PointerEvent) => {
    lineSwipe.pointerId = -1;
    const minimum =
      document.documentElement.getAttribute("data-header-mode") === "minimum" &&
      window.matchMedia("(max-width: 640px)").matches;
    if (!minimum || event.pointerType === "mouse") return;
    if (
      (event.target as Element).closest(
        ".header-menu__button, .header-menu__panel",
      )
    )
      return;
    lineSwipe.pointerId = event.pointerId;
    lineSwipe.x = event.clientX;
    lineSwipe.y = event.clientY;
  });
  const endLineSwipe$ = $(async (event: PointerEvent) => {
    if (event.pointerId !== lineSwipe.pointerId) return;
    lineSwipe.pointerId = -1;
    const step = tabSwipeStep({
      pointerType: event.pointerType,
      from: { x: lineSwipe.x, y: lineSwipe.y },
      to: { x: event.clientX, y: event.clientY },
      width: window.innerWidth,
    });
    if (step !== 0) await applyTabs$(neighbourTab(tabs, step));
  });
  /**
   * The header is outside the sheet, so a press there closes it — and unlike a
   * press in the workspace it still does its own work, because the shield that
   * swallows a press never covers the header: what the reader pressed is what
   * they saw. The line's swipe follows the same press. CA_0059_002
   */
  const pressHeader$ = $(async (event: PointerEvent) => {
    mobile.sheet = null;
    await startLineSwipe$(event);
  });
  const stepTab$ = $(async (step: -1 | 1) => {
    await applyTabs$(neighbourTab(tabs, step));
  });
  /**
   * Choosing another view never rewrites this tab: it opens the target again
   * in the chosen view and remembers that choice for the target's next tab.
   */
  const openView$ = $(async (viewId: string) => {
    // The active tab is read from the store, never captured: a closure created
    // on an earlier render would still name the tab that was active then.
    const tab = activeTab(tabs);
    if (!tab) return;
    const id = `${tab.itemId ?? tab.id}:${viewId}`;
    const open = tabs.tabs.find((candidate) => candidate.id === id);
    const nextPreferred = rememberView(preferred.value, tab.itemId, viewId);
    preferred.value = nextPreferred;
    const next = open
      ? selectTab(tabs, open.id)
      : openTab(tabs, {
          ...tab,
          id,
          title: `${tab.title.split(" · ")[0] ?? tab.title} · ${
            resolveView(REGISTRY, tab.kind, viewId).view.name
          }`,
          viewType: viewId,
          selection: null,
          unsaved: false,
        });
    tabs.tabs = next.tabs;
    tabs.activeTabId = next.activeTabId;
    await save$(next, layout, nextPreferred);
  });
  useVisibleTask$(({ cleanup }) => {
    let stopped = false;
    let primed = false;
    const poll = async () => {
      const response = await fetch(`/api/workspaces/${workspace.id}/processes`);
      if (!stopped && response.ok) {
        registry.items = (await response.json()) as ProcessRecord[];
        // A process aimed at a document has ended — a sender's, a system
        // run's, a run started in another session — and no run this session
        // follows is telling it: the view showing that document reads what
        // it proposed. The first poll only remembers what had already ended,
        // so a reload does not re-announce every past process. BO_0245_009
        // CA_0063_002
        const ended = endedForDocuments(registry.items, run.announced, run.followed);
        run.announced = [...ended.announced];
        if (primed) {
          for (const itemId of ended.itemIds) {
            runProposed.itemId = itemId;
            runProposed.seq += 1;
          }
        }
        primed = true;
      }
      // A run still going aimed at a document is read on its own, faster
      // clock (`followRun`); every other run's events ride the registry's.
      if (!running()) await followRuns();
    };
    // Whether one of the reader's runs is aimed at a document and has not
    // been seen to end: what it does there is drawn as it does it.
    // BO_0265_007 BO_0269_014
    const running = () => unfinished(run.followed).some((followed) => followed.artifact !== null);
    let following = false;
    // The runs' events ride the registry's clock rather than opening a
    // second transport. A run the reader started in an earlier session is
    // not followed here, because the console reports it as a process either
    // way and its events are read back when it is selected.
    const followRuns = async () => {
      if (following) return;
      following = true;
      try {
        await readRuns();
      } finally {
        following = false;
      }
    };
    const readRuns = async () => {
      // Every run this session started and has not seen end, side by side.
      // BO_0269_014
      for (const followed of unfinished(run.followed)) {
        if (stopped) return;
        const events = await fetch(`/api/runs/${followed.id}/events`);
        if (stopped || !events.ok) continue;
        const read = (await events.json()) as RunEvent[];
        run.followed = withEvents(run.followed, followed.id, read);
      }
      // What each run has done in the document it is aimed at, for the view
      // showing that document to draw at its blocks. BO_0265_007
      const next = activitiesOf(run.followed);
      if (!sameActivities(activity.runs, next)) {
        activity.runs = next;
        activity.seq += 1;
      }
      for (const followed of run.followed) {
        if (stopped || !runEnded(followed.events)) continue;
        // A run aimed at a document has ended — completed, failed or
        // cancelled, since a run that failed may already have staged — so
        // the view showing that document reads what it proposed. Once per
        // run, and one run per read: the signal carries one document, and
        // the next read tells the next. BO_0226_007
        if (followed.artifact !== null && !followed.announced) {
          run.followed = marked(run.followed, followed.id, "announced");
          runProposed.itemId = followed.artifact;
          runProposed.seq += 1;
          return;
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), PROCESS_POLL_INTERVAL_MS);
    const fast = setInterval(() => {
      if (running()) void followRuns();
    }, ACTIVE_RUN_POLL_INTERVAL_MS);
    cleanup(() => {
      stopped = true;
      clearInterval(timer);
      clearInterval(fast);
    });
  });
  /**
   * Starts a run for a command body and follows it as the dock follows every
   * run it started: the console, the activity the view hears, the end told
   * once. Answers the run's id, or the refusal in words. Shared by the
   * composer's field and a command sent from a block. BO_0267_008
   */
  const startRun$ = $(async (body: Record<string, unknown>, artifact: string | null): Promise<{ ok: true; runId: string } | { ok: false; error: string }> => {
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const refused = (await response.json()) as { error?: string };
        return { ok: false, error: refused.error ?? "The agent did not take the goal." };
      }
      const started = (await response.json()) as {
        runId?: string;
        processId: string;
      };
      run.processId = started.processId;
      // A sender answered a process and no run: there is nothing to follow,
      // and following `undefined` left a chip saying *Starting* for ever.
      // The process is on the Execution list like any other. BO_0273_039
      // What the sender staged before answering — the pending block — is
      // read by the view showing the document at once; the process's end is
      // the poll's (CA_0063_002). CA_0063_003
      if (typeof started.runId !== "string" || started.runId === "") {
        if (artifact !== null) {
          runProposed.itemId = artifact;
          runProposed.seq += 1;
        }
        return { ok: true, runId: "" };
      }
      run.id = started.runId;
      // Followed beside every run already going. BO_0269_014
      run.followed = followRun(run.followed, started.runId, artifact, typeof body.agent === "string" ? body.agent : run.agent);
      return { ok: true, runId: started.runId };
    } catch {
      return { ok: false, error: "The agent could not be reached." };
    }
  });

  /** What `command` places set on each command, sent with it. BO_0311_030
   * Declared before `sendCommand$`, which clears it, so the closure captures
   * it in the production build. CA_0078_001 */
  const commandOptions = useStore<ViewCommandOptions>({ byCommand: {} });
  const setCommandOption$ = $((itemId: string, blockId: string, name: string, value: string | null, once?: boolean) => {
    const key = commandKey(itemId, blockId);
    commandOptions.byCommand = { ...commandOptions.byCommand, [key]: withOption(commandOptions.byCommand[key] ?? {}, name, value) };
    // An option for one send is cleared once the command is sent. BO_0336_051
    const held = (commandOptions.onceByCommand?.[key] ?? []).filter((candidate) => candidate !== name);
    commandOptions.onceByCommand = {
      ...commandOptions.onceByCommand,
      [key]: once === true && value !== null && value !== "" ? [...held, name] : held,
    };
  });

  /**
   * Sends a command written in a block of a document. The marks it carries
   * are the ones the view last reported for the document, copied at the
   * press, and a passage whose words are gone or a `#n` no mark stands under
   * stops it where the reader can see why — its number may already be in the
   * words, and sending it would name a reference with nothing behind it.
   * BO_0227_015 BO_0267_008
   */
  const sendCommand$ = $(async (command: ViewCommand): Promise<SentCommand> => {
    if (run.sending) return { ok: false, error: "A command is already being sent." };
    const pointing = aim.pointing[command.itemId] ?? NO_POINTING;
    const stale = staleIn(pointing);
    if (stale.length > 0) {
      return {
        ok: false,
        error: `${stale.map((number) => `#${number}`).join(", ")} no longer ${stale.length === 1 ? "matches its" : "match their"} words. Re-point or take back before sending.`,
      };
    }
    const dangling = danglingNumbers(command.words, pointing.references);
    if (dangling.length > 0) {
      return {
        ok: false,
        error: `${dangling.map((number) => `#${number}`).join(", ")} ${dangling.length === 1 ? "names" : "name"} nothing marked. Mark it again, or take it out of the command.`,
      };
    }
    run.sending = true;
    const branch = aim.branch?.[command.itemId];
    // The command's own mode, chosen on its block; the document's mode in the
    // aim when a view sends none. DO_0025_008
    const mode = command.mode ?? aim.mode?.[command.itemId];
    const started = await startRun$(
      {
        ...(run.agent === null ? {} : { agent: run.agent }),
        speed: run.speed,
        ...blockCommand(command.itemId, command.source, pointing.references),
        // A command issued in a branch proposes into it: the run's group
        // is the person's branch, not one of its own. BO_0250_010
        ...(branch === undefined ? {} : { branch }),
        // The working mode the command carries. BO_0306_017 DO_0025_008
        ...(mode === undefined ? {} : { mode }),
        ...(command.attachments.length === 0 ? {} : { attachments: command.attachments }),
        // What the command's places set on it — the instruction its chip chose.
        // An option no one set is not sent. BO_0311_030
        ...(command.options === undefined || Object.keys(command.options).length === 0 ? {} : { commandOptions: command.options }),
      },
      command.itemId,
    );
    run.sending = false;
    // What was set for one send goes with it. BO_0336_051
    if (started.ok) {
      const sent = afterSend(commandOptions, command.itemId, command.source.block);
      commandOptions.byCommand = sent.byCommand;
      commandOptions.onceByCommand = sent.onceByCommand ?? {};
    }
    return started;
  });

  /**
   * Asks a gesture's question (`BO_0258_006`): a run for the goal under the
   * named intention, on the chosen agent, proposing into the target and
   * followed like every other, so its chip and its proposals arrive where the
   * reader already looks for them. A gesture carries no marks and no
   * attachments: it asks about the subject it was made on, not about what the
   * reader pointed at.
   */
  const sendGesture$ = $(async (gesture: ViewGesture): Promise<SentCommand> => {
    if (run.sending) return { ok: false, error: "A command is already being sent." };
    run.sending = true;
    const branch = aim.branch?.[gesture.itemId];
    const mode = aim.mode?.[gesture.itemId];
    const started = await startRun$(
      {
        ...(run.agent === null ? {} : { agent: run.agent }),
        speed: run.speed,
        goal: gesture.goal,
        intention: gesture.intention,
        ...(gesture.context === undefined || gesture.context === "" ? {} : { context: gesture.context }),
        artifact: gesture.itemId,
        ...(branch === undefined ? {} : { branch }),
        ...(mode === undefined ? {} : { mode }),
      },
      gesture.itemId,
    );
    run.sending = false;
    return started;
  });

  /**
   * Sends a pinch on a block (`BO_0322`): a run with no words on the chosen
   * agent and speed, the block its one reference, in the mode the view says
   * the pinch works in, followed like every other. BO_0322_016
   */
  const sendPinch$ = $(async (pinch: ViewPinch): Promise<SentCommand> => {
    if (run.sending) return { ok: false, error: "A command is already being sent." };
    run.sending = true;
    const branch = aim.branch?.[pinch.itemId];
    const started = await startRun$(
      {
        ...(run.agent === null ? {} : { agent: run.agent }),
        speed: run.speed,
        pinch: pinch.pinch,
        artifact: pinch.itemId,
        block: pinch.blockId,
        ...(branch === undefined ? {} : { branch }),
        mode: pinch.mode,
      },
      pinch.itemId,
    );
    run.sending = false;
    return started;
  });

  const chooseAgent$ = $((agent: string) => chooseAgent(run, agent));
  /** The next command's speed; the kernel remembers it for the person when a
   * run starts with it. BO_0269_015 */
  const chooseSpeed$ = $((speed: Speed) => {
    run.speed = speed;
  });

  /** Cancels a run from its *Execution* entry. BO_0267_010 */
  const cancelExecutionRun$ = $(async (runId: string) => {
    await fetch(`/api/runs/${runId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  });

  /**
   * Reads what the selected process's run proposed.
   *
   * It follows the selection rather than the poll: what a finished run proposed
   * does not change while a reader looks at it, and re-reading it every two
   * seconds would buy nothing.
   */
  useVisibleTask$(async ({ track }) => {
    // The active tab's selection, so a tab switch reads what the process that
    // tab selected proposed. CA_0040_001
    const selected = track(() => selectedProcess(registry.selection, tabs.activeTabId));
    proposed.processId = selected;
    proposed.documents = [];
    proposed.attachments = [];
    proposed.instruction = null;
    proposed.context = [];
    proposed.events = [];
    if (selected === null) return;
    // A replay's entry reads nothing: its events are the replay's, as far as
    // it has played. BO_0340_004
    if (isReplayId(selected)) {
      if (player.run !== null) proposed.events = [...playedOf(replaySchedule(player.run), player.played).events];
      return;
    }

    const [response, attached, guided, told] = await Promise.all([
      fetch(`/api/processes/${selected}/proposals`),
      // What the run was sent with, from its own record. BO_0229_011
      fetch(`/api/processes/${selected}/attachments`),
      // The instruction that guided it, from the same record. BO_0298_031 BO_0338_051
      fetch(`/api/processes/${selected}/instruction`),
      // What each extension told it at its start, from the same record. BO_0310_040
      fetch(`/api/processes/${selected}/context`),
    ]);
    if (response.ok && selectedProcess(registry.selection, tabs.activeTabId) === selected) {
      proposed.documents = (await response.json()) as ProposedItem[];
    }
    if (attached.ok && selectedProcess(registry.selection, tabs.activeTabId) === selected) {
      proposed.attachments = (await attached.json()) as BridgeAttachment[];
    }
    if (guided.ok && selectedProcess(registry.selection, tabs.activeTabId) === selected) {
      proposed.instruction = (await guided.json()) as { id: string; title: string } | null;
    }
    if (told.ok && selectedProcess(registry.selection, tabs.activeTabId) === selected) {
      proposed.context = (await told.json()) as RunContextEntry[];
    }
  });
  /**
   * What the selected run has done, for its detail. The registry's poll is
   * the clock: a run still going is read again with every poll, and one that
   * has ended is read once, since what it did does not change while a reader
   * looks at it. A process that is not a run has no events to read.
   * CA_0058_006
   */
  useVisibleTask$(async ({ track }) => {
    const selected = track(() => selectedProcess(registry.selection, tabs.activeTabId));
    const items = track(() => registry.items);
    const record = items.find((process) => process.id === selected);
    if (selected === null || record?.runId === undefined || isReplayId(selected)) return;
    const read = proposed.processId === selected && proposed.events.length > 0;
    const going = record.state === "queued" || record.state === "running";
    if (read && !going) return;
    const response = await fetch(`/api/runs/${record.runId}/events`);
    if (!response.ok) return;
    if (selectedProcess(registry.selection, tabs.activeTabId) !== selected) return;
    proposed.events = (await response.json()) as RunEvent[];
  });
  // A closed tab takes its selection with it, so a tab opened again on the
  // same target starts with nothing selected. CA_0040_001
  useTask$(({ track }) => {
    const open = track(() => tabs.tabs);
    const kept = keepOpenTabs(registry.selection, open);
    if (kept !== registry.selection) registry.selection = kept;
  });

  /** A replay's entry, selected, shows its events as they arrive. BO_0340_004 */
  useTask$(({ track }) => {
    const played = track(() => player.played);
    const selected = track(() => selectedProcess(registry.selection, tabs.activeTabId));
    if (player.run === null || !isReplayId(selected)) return;
    proposed.processId = selected;
    proposed.events = [...playedOf(replaySchedule(player.run), played).events];
  });
  /** Closing a replay's tab ends the replay, its entry with it. BO_0340_004 */
  useTask$(({ track }) => {
    const open = track(() => tabs.tabs);
    const tabId = replay.tabId;
    if (tabId === null || open.some((tab) => tab.id === tabId)) return;
    stopSteps(tabId);
    Object.assign(replay, { ...NO_REPLAY, seq: replay.seq + 1 });
    player.run = null;
    player.played = 0;
  });
  /**
   * Plays a finished run back (`BO_0340_004`): reads what its record holds,
   * opens a tab beside the active one on its document — closing a replay
   * already playing — and plays the schedule into the replay's view and its
   * transient entry. A refusal is said in the detail the key was pressed in.
   */
  const startReplay$ = $(async (record: ProcessRecord) => {
    player.refusal = null;
    const runId = record.runId ?? "";
    let response: Response;
    try {
      response = await fetch(`/api/runs/${encodeURIComponent(runId)}/replay`);
    } catch {
      player.refusal = { processId: record.id, words: "The run could not be read: the server could not be reached." };
      return;
    }
    const body = (await response.json().catch(() => ({}))) as ReplayRun & { error?: string };
    if (!response.ok) {
      player.refusal = { processId: record.id, words: body.error ?? "This run could not be replayed." };
      return;
    }
    const run: ReplayRun = body;
    const tabId = replayTabId(run.runId);
    let next: TabsState = tabs;
    if (replay.tabId !== null) {
      stopSteps(replay.tabId);
      next = closeTab(next, replay.tabId);
    }
    // The document's own tab gives the replay's its kind, view and title.
    const own = next.tabs.find((tab) => tab.itemId === run.document && tab.replay === undefined);
    const kind = own?.kind ?? DOCUMENT_KIND;
    next = openTabBeside(next, {
      id: tabId,
      kind,
      title: own?.title ?? record.itemLabel ?? record.title,
      itemId: run.document,
      viewType: own?.viewType ?? preferredView(REGISTRY, preferred.value, run.document, kind).id,
      selection: null,
      drawerContext: kind,
      unsaved: false,
      replay: run.runId,
    });
    Object.assign(replay, { tabId, itemId: run.document, runId: run.runId, block: run.block, words: null, run: null, seq: replay.seq + 1 });
    player.run = run;
    player.played = 0;
    player.title = record.title;
    player.startedAt = Date.now();
    tabs.tabs = next.tabs;
    tabs.activeTabId = next.activeTabId;
    const steps = replaySchedule(run);
    playSteps(tabId, steps, (count) => {
      if (replay.tabId !== tabId) return;
      const played = playedOf(steps, count);
      player.played = count;
      replay.words = played.words;
      replay.run = replayActivity(run, played);
      replay.seq += 1;
    });
  });
  /**
   * The replay's shortcut, named nowhere: `Ctrl+Alt+R` (`Cmd+Alt+R` on a
   * Mac) while an ended run's detail is open in the *Execution* section. A
   * run still going is left alone. BO_0340_003
   */
  useOnDocument(
    "keydown",
    $((event: KeyboardEvent) => {
      if (!isReplayShortcut(event)) return;
      const selected = selectedProcess(registry.selection, tabs.activeTabId);
      const record = registry.items.find((process) => process.id === selected);
      if (record?.runId === undefined || isActive(record.state)) return;
      event.preventDefault();
      void startReplay$(record);
    }),
  );

  const acknowledge$ = $(async (id: string) => {
    const response = await fetch(`/api/processes/${id}/acknowledge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("acknowledging the failure failed");
    const updated = (await response.json()) as ProcessRecord;
    registry.items = registry.items.map((process) =>
      process.id === updated.id ? updated : process,
    );
  });
  const startDrag$ = $((payload: DragPayload, event: PointerEvent) => {
    Object.assign(drag, idleDrag());
    drag.candidate = payload;
    drag.startedAt = Date.now();
    drag.origin = { x: event.clientX, y: event.clientY };
    drag.position = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse") return;
    setTimeout(() => {
      const held =
        drag.candidate !== null &&
        drag.payload === null &&
        movedDistance(drag.origin, drag.position) <= DRAG_MOVE_TOLERANCE_PX;
      if (held) drag.payload = drag.candidate;
    }, LONG_PRESS_MS);
  });
  /**
   * Opens a target in a tab, in the view remembered for it. `openTab` reveals
   * a tab already showing this target rather than opening a second one, so
   * activating an entry twice lands on the same tab. The kind is qualified as
   * the registry names it. BO_0202_004
   */
  const openTarget$ = $(async (target: OpenTarget, beside = false) => {
    const tab: Tab = {
      id: `${target.kind}-${target.itemId}`,
      kind: target.kind,
      title: target.title,
      itemId: target.itemId,
      viewType: preferredView(REGISTRY, preferred.value, target.itemId, target.kind).id,
      selection: null,
      drawerContext: target.kind,
      unsaved: false,
    };
    // A panel is a place to reach for something, not a place to stay. On a
    // phone the sheet lies over the workspace it has just opened, so it has
    // done its job the moment it lands the reader on a tab — whether the tab
    // was made here, opened, or only revealed. Every path a panel opens a tab
    // by comes through here, the library's rows and create controls and the
    // Extensions section and the inspector alike, so this is the one place it
    // is said. The panel itself is untouched: what it shows and whether it is
    // shown are the workspace record's, so the next press on the handle brings
    // back the list where it was. CA_0059_001
    mobile.sheet = null;
    await applyTabs$(beside ? openTabBeside(tabs, tab) : openTab(tabs, tab));
  });
  /**
   * Opens the place a hold was on once the hold has lasted, if the pointer is
   * still there and the drag still under way (CA_0072_001): a tab becomes
   * active, a tab edge steps and keeps stepping while it is held, the library
   * shows an icon's content (on a phone its sheet opens), and a library entry
   * opens its document beside the active tab. The drag goes on in what it
   * opened; its store is the shell's, so a tab switch leaves it whole.
   */
  const openSpring$ = $(async (id: string) => {
    const action = springAction(id);
    if (action === null) return;
    if (action.open === "tab") {
      await applyTabs$(selectTab(tabs, action.tabId));
    } else if (action.open === "step") {
      await stepTab$(action.step);
    } else if (action.open === "sheet") {
      mobile.sheet = "left";
    } else if (action.open === "icon") {
      const left = { shown: true, icon: action.icon };
      layout.left = left;
      await save$(tabs, { ...layout, left });
    } else {
      const item = Object.values(library.data)
        .flatMap((data) => (Array.isArray(data) ? (data as readonly LibraryItem[]) : []))
        .find((candidate) => candidate.id === action.itemId);
      if (item?.open !== undefined) await openTarget$(item.open, true);
    }
  });
  const armSpring$ = $((hold: SpringHold) => {
    const wait = (armed: SpringHold) =>
      setTimeout(async () => {
        const current = drag.hold;
        if (drag.payload === null || current === null || current.id !== armed.id || current.since !== armed.since) return;
        if (!springDue(current, Date.now())) return;
        const again = springRepeats(current.id);
        const next = { id: current.id, since: again ? Date.now() : null };
        drag.hold = next;
        await openSpring$(current.id);
        if (again) wait(next);
      }, SPRING_HOLD_MS);
    wait(hold);
  });
  const trackDrag$ = $(async (event: PointerEvent) => {
    if (drag.candidate === null) return;
    drag.position = { x: event.clientX, y: event.clientY };
    if (drag.payload === null) {
      const intent = pointerIntent({
        pointerType: event.pointerType,
        heldMs: Date.now() - drag.startedAt,
        movedPx: movedDistance(drag.origin, drag.position),
      });
      if (intent === "scroll") {
        Object.assign(drag, idleDrag());
        return;
      }
      if (intent !== "drag") return;
      drag.payload = drag.candidate;
    }
    const target = targetUnder(event.clientX, event.clientY, libraryIconIds(layout));
    drag.overId = target?.id ?? null;
    drag.operation =
      target === null ? null : resolveDrop(drag.payload, target);
    // A dragged block held over a place opens it. CA_0072_001
    if (springs(drag.payload)) {
      const hold = holdOver(drag.hold, springUnder(event.clientX, event.clientY), Date.now());
      if (hold !== drag.hold) {
        drag.hold = hold;
        if (hold !== null) await armSpring$(hold);
      }
    }
  });
  // While a drag is under way, a pointer held near the top or the bottom of
  // the area the drag began in scrolls it, and the target under the pointer
  // is read again as the content moves beneath it. BO_0263_017
  useVisibleTask$(({ track, cleanup }) => {
    const payload = track(() => drag.payload);
    if (payload === null) return;
    const scroller = scrollerAt(drag.origin.x, drag.origin.y);
    const page = scroller === document.scrollingElement || scroller === document.documentElement;
    let frame = 0;
    const tick = () => {
      const box = page ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const top = Math.max(box.top, 0);
      const bottom = Math.min(box.bottom, window.innerHeight);
      const dy = edgeScroll(drag.position.y, top, bottom);
      if (dy !== 0) {
        const before = scroller.scrollTop;
        scroller.scrollTop = before + dy;
        if (scroller.scrollTop !== before && drag.payload !== null) {
          const target = targetUnder(drag.position.x, drag.position.y, libraryIconIds(layout));
          drag.overId = target?.id ?? null;
          drag.operation = target === null ? null : resolveDrop(drag.payload, target);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    cleanup(() => cancelAnimationFrame(frame));
  });
  const dropDrag$ = $(async () => {
    const { payload, operation, overId } = drag;
    Object.assign(drag, idleDrag());
    if (payload !== null) drag.settledAt = Date.now();
    if (payload === null || operation === null || overId === null) return;

    // A library icon dropped in its column: the column takes the new order,
    // which the workspace stores. CA_0068_002 CA_0068_003
    if (operation === "move" && overId.startsWith(PANEL_ICON_TARGET)) {
      const before = overId.slice(PANEL_ICON_TARGET.length);
      const libraryOrder = movedIconOrder(
        libraryIconIds(layout),
        payload.itemId,
        before === "end" ? null : before,
      );
      layout.libraryOrder = libraryOrder;
      await save$(tabs, { ...layout, libraryOrder });
      return;
    }

    if (operation === "move" && overId.startsWith("tab:")) {
      const moving = tabs.tabs.find(
        (tab) => (tab.itemId ?? tab.id) === payload.itemId,
      );
      if (!moving) return;
      const before = overId.slice("tab:".length);
      const next = moveTab(tabs, moving.id, before === "end" ? null : before);
      tabs.tabs = next.tabs;
      tabs.activeTabId = next.activeTabId;
      await save$(next, layout);
      return;
    }

    // Anything landing on a target the shell does not own belongs to the view
    // that declared it. The shell resolved the gesture; the view decides what
    // the drop means for its own content.
    if (!shellTarget(overId)) {
      drag.drops += 1;
      drag.drop = { payload, operation, overId, seq: drag.drops };
    }
  });
  const cancelDrag$ = $(() => Object.assign(drag, idleDrag()));
  /**
   * *Mark document*, pressed on a library row or a tab while a pointing stands
   * (`BO_0304_014`): the shell hands the press to the mounted document view,
   * which applies it to the session's marks and clears it.
   */
  const markDocument$ = $((document: string, title: string) => {
    across.document = document;
    across.title = title;
    across.seq += 1;
  });
  /** Re-reads one section through the host's library route. BO_0202_005 */
  const refreshSection$ = $(async (key: string) => {
    const section = REGISTRY.sections.find((candidate) => candidate.key === key);
    if (section === undefined) return;
    // A component section receives the fresh answer as its data and follows
    // it; the item shape is rendered from it directly. BO_0222_005
    const response = await fetch(`/api/library/${section.extension}/${section.name}`);
    if (!response.ok) return;
    library.data[key] = (await response.json()) as unknown;
    library.reads += 1;
  });
  /** Re-reads every section whose rows open the given kind. */
  const refreshKind$ = $(async (kind: string) => {
    for (const section of REGISTRY.sections) {
      if (section.opens === kind) await refreshSection$(section.key);
    }
  });
  /** A system run that ended may have changed a document's derived state:
   * the library's rows read their glyphs again. BO_0248_012 */
  useTask$(({ track }) => {
    const seq = track(() => runProposed.seq);
    if (seq === 0) return;
    void refreshKind$("document");
  });
  /**
   * A section's create control: the contribution makes the item and says what
   * to open; the shell opens it and re-reads the section. BO_0202_003
   */
  const createIn$ = $(async (key: string) => {
    const section = REGISTRY.sections.find((candidate) => candidate.key === key);
    if (section?.create$ === undefined) return;
    const made = await section.create$();
    if (made === null) return;
    await openTarget$({ ...made, kind: qualify(section.extension, made.kind) });
    await refreshSection$(key);
  });
  const toggleSection$ = $(async (key: string) => {
    const sections = { ...layout.sections, [key]: nextSectionState(sectionState(layout, key)) };
    layout.sections = sections;
    await save$(tabs, { ...layout, sections });
  });
  /** Stores a section's filter set beside its collapsed state. BO_0222_006 */
  const setSectionFilter$ = $(async (key: string, values: readonly string[]) => {
    const filters = { ...layout.filters, [key]: [...values] };
    layout.filters = filters;
    await save$(tabs, { ...layout, filters });
  });
  /**
   * Settings is a tab like any other. Its target is synthetic and instance-wide,
   * so `openTab` reveals an open settings tab rather than opening a second one
   * and the reveal rule needs no case of its own for a tab that is not content.
   */
  /**
   * The release check, once per session and only for the owner: the browser
   * asks GitHub which releases exist — nothing in the stack does — and the
   * highest candidate above the installed release becomes the header's hint.
   * Off, unreachable, or nothing newer all mean no hint and no error. BO_0223_013
   */
  const updateAvailable = useSignal<string | null>(null);
  useVisibleTask$(async () => {
    if (person === null || !person.owner || REGISTRY.kinds[UPDATE_KIND] === undefined) return;
    try {
      const response = await fetch("/api/x/settings/update");
      if (!response.ok) return;
      const info = (await response.json()) as { release?: unknown; updateCheck?: unknown };
      if (info.updateCheck !== true || typeof info.release !== "string") return;
      const raw = await fetchReleases();
      if (raw === null) return;
      updateAvailable.value = candidates(info.release, parseReleases(raw))[0]?.release.version ?? null;
    } catch {
      updateAvailable.value = null;
    }
  });
  const openUpdate$ = $(async () => {
    await openTarget$({ kind: UPDATE_KIND, itemId: SETTINGS_TARGET, title: "Update" });
  });
  const openSettings$ = $(async () => {
    await openTarget$({ kind: SETTINGS_KIND, itemId: SETTINGS_TARGET, title: "Settings" });
  });

  const inspector = useStore<ViewInspector>({
    text: null,
    facts: [],
    actions: [],
  });
  const bar = useStore<ViewBar>({ groups: [] });
  // What a decorating extension adds to that bar, kept apart from the view's
  // own groups so neither writer drops the other's. BO_0274_004
  const decorationBar = useStore<ViewBar>({ groups: [] });
  const save = useStore<ViewSave>({ state: null });
  const message = useStore<ViewMessage>({ current: null });
  /**
   * What is shared into the app on a device (`calliopa-bootstrap`'s
   * BO_0319_050): taken from the host at the shell's start and whenever the
   * device says something arrived, and handed to the extensions that take
   * shares, in extension order, with the target the reader has open; the one
   * that takes them may name a target to open. An instance answers no share,
   * and nothing is asked again there.
   */
  // eslint-disable-next-line qwik/no-use-visible-task -- what was shared is the device's, asked in the browser
  useVisibleTask$(({ cleanup }) => {
    let asking = false;
    let none = false;
    const take = async () => {
      if (asking || none) return;
      asking = true;
      try {
        const response = await fetch("/api/x/ui.shell/capture/shared", { method: "POST" }).catch(() => null);
        if (response === null || response.status === 404) {
          none = true;
          return;
        }
        if (!response.ok) return;
        const { items } = (await response.json()) as { items?: readonly Captured[] };
        if (items === undefined || items.length === 0) return;
        const tab = activeTab(tabs);
        const at = { kind: tab?.kind ?? null, itemId: tab?.itemId ?? null };
        for (const receiver of REGISTRY.shareReceivers) {
          const answer = await receiver.receive$(items, at);
          if (!answer.taken) continue;
          if (answer.open !== undefined) await openTarget$(answer.open);
          return;
        }
        message.current = {
          headline: "Nothing here takes what was shared",
          body: "No active extension places shared text, addresses or files.",
          answers: [{ id: "ok", label: "OK" }],
        };
      } finally {
        asking = false;
      }
    };
    void take();
    window.addEventListener("calliopa:shared", take);
    cleanup(() => window.removeEventListener("calliopa:shared", take));
  });
  // A tab switch mounts a different view, and the state the old one reported
  // is not this tab's. Clearing it means an unreported tab shows nothing
  // rather than the previous tab's answer.
  useTask$(({ track }) => {
    track(() => tabs.activeTabId);
    save.state = null;
    // The contribution is the old view's, for the old tab. Clearing it means an
    // unreported tab falls back to its declared line rather than showing the
    // previous document's facts under a different tab's name.
    inspector.text = null;
    inspector.facts = [];
    inspector.actions = [];
    // And so is its bar: its controls act on the view the reader left.
    // CA_0053_001
    bar.groups = [];
    decorationBar.groups = [];
    // A message belongs to the view that raised it. Leaving it up over a
    // different tab would ask about a document the reader is no longer looking
    // at, and answering it would act on that one.
    message.current = null;
  });
  /** What a target's blocks have opened as focused work, read and kept by
   * target so a control's words can say whether a block has a child.
   * CA_0065_005 */
  const readFaces$ = $(async (itemId: string): Promise<FocusedWork> => {
    const kind = kindOf(tabs, itemId);
    if (kind === null) return {};
    const answer = await fetch(`/api/focused-work/${itemId}?kind=${encodeURIComponent(kind)}`);
    const outcome = (await answer.json()) as { outcome: string; result?: FocusedWork };
    const work = outcome.outcome === "success" && outcome.result !== undefined ? outcome.result : {};
    faces.byItem = { ...faces.byItem, [itemId]: work };
    return work;
  });
  /** Opens a block of a target as focused work, or finds the child it has,
   * through the target kind's contribution: the child, or the refusal in
   * words. CA_0065_003 CA_0072_005 */
  const openChild$ = $(async (itemId: string, blockId: string): Promise<{ itemId: string; title: string } | string> => {
    const kind = kindOf(tabs, itemId);
    if (kind === null) return "This tab opens no focused work.";
    const answer = await fetch(`/api/focused-work/${itemId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, blockId }),
    });
    const outcome = (await answer.json()) as
      | { outcome: "success"; result: { itemId: string; title: string } }
      | { outcome: string; failures?: readonly { detail?: string }[]; error?: string };
    if (outcome.outcome !== "success") {
      const failures = (outcome as { failures?: readonly { detail?: string }[] }).failures ?? [];
      return failures[0]?.detail ?? (outcome as { error?: string }).error ?? "That block does not open as focused work.";
    }
    return (outcome as { result: { itemId: string; title: string } }).result;
  });
  /** Opens a document reached along a route — a block's focused work, or a
   * crumb going back — in a tab of its own beside the active one, or makes
   * the tab already showing it active; `focus` lands a block once it shows.
   * The tab pressed in keeps its target and route. CA_0073_001 CA_0073_002 */
  const openAlongRoute$ = $(async (target: { itemId: string; title: string; route: readonly RouteEntry[]; focus?: string }) => {
    const from = activeTab(tabs);
    if (from === undefined) return;
    const view = preferredView(REGISTRY, preferred.value, target.itemId, from.kind).id;
    const next = openAlongRoute(tabs, target, view);
    focus.itemId = target.itemId;
    focus.blockId = target.focus ?? null;
    focus.seq += 1;
    await applyTabs$(next);
  });
  const bridge: ViewBridge = {
    workspaceId: workspace.id,
    drag,
    inspector,
    bar,
    decorationBar,
    save,
    startDrag$,
    setSelection$: $(async (selection: string | null) => {
      const id = tabs.activeTabId;
      if (id === null) return;
      const next = updateTab(tabs, id, { selection });
      tabs.tabs = next.tabs;
      await save$(next, layout);
    }),
    setPointing$: $((itemId: string, pointing: Pointing) => {
      aim.pointing = { ...aim.pointing, [itemId]: pointing };
    }),
    setBranch$: $((itemId: string, branch: string | null) => {
      const next = { ...(aim.branch ?? {}) };
      if (branch === null) delete next[itemId];
      else next[itemId] = branch;
      aim.branch = next;
    }),
    setMode$: $((itemId: string, mode: WorkingMode | null) => {
      const next = { ...(aim.mode ?? {}) };
      if (mode === null) delete next[itemId];
      else next[itemId] = mode;
      aim.mode = next;
    }),
    proposed: runProposed,
    reveal,
    pointing,
    across,
    activity,
    replay,
    answerAll,
    toggleRun,
    setRunChips$: $((itemId: string, chips: readonly RunChip[]) => {
      runChips.byItem = { ...runChips.byItem, [itemId]: chips };
    }),
    // The words become a new block of the document, which its view writes;
    // a tab that is no document has nothing to write them into. BO_0267_008
    composeCommand$: $((text: string) => {
      const itemId = documentOf(activeTab(tabs));
      if (itemId === null) return;
      composeBlock.itemId = itemId;
      composeBlock.text = text;
      composeBlock.seq += 1;
    }),
    composeBlock,
    agents: run,
    chooseAgent$,
    commandOptions,
    setCommandOption$,
    chooseSpeed$,
    refreshAgents$,
    sendCommand$,
    sendGesture$,
    sendPinch$,
    // Focused work: the shell's own capability, offered to every view.
    // The kind comes from the tab the target is open in, so a view never
    // names a vocabulary, and the faces a view read are kept so a control's
    // words can say whether the block already has a child. CA_0065_003
    // CA_0065_004 CA_0065_005
    faces$: readFaces$,
    blockControls$: $(async (itemId: string, blockId: string) => {
      if (kindOf(tabs, itemId) === null) return [];
      const held = faces.byItem[itemId]?.[blockId] !== undefined;
      return [
        {
          id: "focused-work",
          label: held ? "Focused work" : "Open as focused work",
          icon: "crosshair-simple",
        },
      ] as const;
    }),
    focusedChild$: $(async (itemId: string, blockId: string) => {
      const child = await openChild$(itemId, blockId);
      if (typeof child === "string") return { refusal: child };
      await readFaces$(itemId);
      return { itemId: child.itemId };
    }),
    pressBlockControl$: $(async (control, target) => {
      if (control !== "focused-work") return `The shell has no control ${control}.`;
      const child = await openChild$(target.itemId, target.blockId);
      if (typeof child === "string") return child;
      // The child opens in a tab of its own after the parent's, and the
      // parent's tab stays as it was. Its route is the parent's with the block
      // it was opened from, so Back returns there and lands on it.
      // CA_0047_003 CA_0073_001
      const route = [...target.route];
      const parent = route[route.length - 1];
      if (parent !== undefined) route[route.length - 1] = { ...parent, blockId: target.blockId };
      route.push({ itemId: child.itemId, title: child.title });
      await openAlongRoute$({ itemId: child.itemId, title: child.title, route });
      return null;
    }),
    openAlongRoute$,
    focus,
    raiseMessage$: $((next: Message) => {
      message.current = next;
    }),
    targetGone$: $(async (itemId: string) => {
      let next = tabs;
      for (const tab of tabs.tabs.filter((open) => open.itemId === itemId)) {
        next = closeTab(next, tab.id);
      }
      const gone = tabs.tabs.find((open) => open.itemId === itemId);
      tabs.tabs = next.tabs;
      tabs.activeTabId = next.activeTabId;
      await save$(next, layout);
      if (gone !== undefined) await refreshKind$(gone.kind);
    }),
    openTarget$,
    agentsChanged$: $(async () => {
      await refreshAgents$();
    }),
    targetChanged$: $(async () => {
      const id = tabs.activeTabId;
      if (id === null) return;
      const current = tabs.tabs.find((tab) => tab.id === id);
      if (current === undefined) return;
      await refreshKind$(current.kind);
    }),
    setTitle$: $(async (title: string) => {
      const id = tabs.activeTabId;
      if (id === null) return;
      const current = tabs.tabs.find((tab) => tab.id === id);
      if (current === undefined || current.title === title) return;
      const next = updateTab(tabs, id, { title });
      tabs.tabs = next.tabs;
      // The listing is read again rather than re-sorted here: title order is
      // the server's, and keeping one sort keeps the drawer from disagreeing
      // with what the next read would say.
      await refreshKind$(current.kind);
      await save$(next, layout);
    }),
    setSaveState$: $(async (tabId: string, state: SaveState) => {
      const current = tabs.tabs.find((tab) => tab.id === tabId);
      if (current === undefined) return;
      // The header shows the tab in front of the reader. A view flushing its
      // last save on the way out is reporting about the tab it is leaving.
      if (tabs.activeTabId === tabId) save.state = state;
      // The tab's round marker is this state projected, not a second reading of
      // it: anything but `saved` means the graph does not hold what was typed.
      const unsaved = state !== "saved";
      if (current.unsaved === unsaved) return;
      const next = updateTab(tabs, tabId, { unsaved });
      tabs.tabs = next.tabs;
      await save$(next, layout);
    }),
  };
  useContextProvider(ViewBridgeContext, bridge);

  /** The header's panel control hides or shows the whole panel, keeping what
   * it showed. CA_0056_003 */
  /**
   * The header's count pill: the right panel shown on the run list, or hidden
   * again. At zero too, so the list is always one press from the header, and
   * on a phone it opens the inspector's sheet on it. CA_0058_007
   */
  const showExecution$ = $(async (shown: boolean) => {
    const right = shown ? { ...layout.right, shown: false } : { shown: true, icon: INSPECTOR_ICON };
    layout.right = right;
    mobile.sheet = shown ? null : "right";
    await save$(tabs, { ...layout, right });
  });
  /** A press on an entry of the run list: it opens that process's detail for
   * the tab, and a second press on the one already open lets it go.
   * CA_0040_003 CA_0058_005 */
  const selectProcess$ = $((processId: string) => {
    registry.selection = pressProcess(registry.selection, tabs.activeTabId, processId);
  });
  const togglePanel$ = $((side: "left" | "right") => {
    const next = { ...layout, [side]: togglePanel(layout[side]) };
    layout[side] = next[side];
    save$(tabs, next);
  });
  /** A press on a panel's icon: its content alone, or on a desktop the icon
   * column alone when it was already shown; on a phone a press on the shown
   * icon closes the sheet. CA_0056_002 CA_0056_006 CA_0056_013 */
  const pressPanelIcon$ = $((side: "left" | "right", id: string) => {
    // The lift that ends a drag is not a press. CA_0068_002
    if (Date.now() - drag.settledAt < LONG_PRESS_MS) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    const ids = side === "left" ? libraryIconIds(layout) : [INSPECTOR_ICON];
    if (pressClosesSheet(layout[side], ids, id, phone)) {
      mobile.sheet = null;
      return;
    }
    const next = { ...layout, [side]: pressIcon(layout[side], ids, id, phone) };
    layout[side] = next[side];
    save$(tabs, next);
  });

  const active = activeTab(tabs);
  // The library's content is the shown icon's sections, or in the small mode
  // the first icon's, which only a phone's sheet draws. CA_0056_002
  const libraryIconId = contentIcon(layout.left, libraryIconIds(layout));
  const libraryIcon = REGISTRY.libraryIcons.find((icon) => icon.id === libraryIconId);
  const libraryContent = {
    id: libraryIcon?.id ?? null,
    title: libraryIcon?.title ?? "",
    sections: REGISTRY.sections.filter((section) => libraryIcon?.sections.includes(section.key)),
  };
  const activeView = active
    ? resolveView(REGISTRY, active.kind, active.viewType).view
    : undefined;
  // A replay's entry, while one plays: its tab's run of the document and its
  // transient process, beside the registry's and never in it. BO_0340_004
  const replayPlayed = player.run === null ? null : playedOf(replaySchedule(player.run), player.played);
  const replayRecord =
    player.run === null || replayPlayed === null
      ? null
      : replayProcess(player.run, replayPlayed, {
          title: player.title,
          workspaceId: workspace.id,
          itemKind: active?.kind ?? DOCUMENT_KIND,
          startedAt: new Date(player.startedAt).toISOString(),
        });
  const onReplay = active !== undefined && active.replay !== undefined && active.id === replay.tabId && replayRecord !== null;
  const shownRegistry: ProcessRegistry = replayRecord === null ? registry : { items: [...registry.items, replayRecord], selection: registry.selection };

  return (
    <>
      <main
        class="shell"
        data-left={panelDraw(layout.left)}
        data-right={panelDraw(layout.right)}
        data-sheet={mobile.sheet ?? undefined}
        data-workspace-id={workspace.id}
        data-dragging={
          drag.payload === null ? undefined : (drag.operation ?? "none")
        }
        onPointerMove$={trackDrag$}
        onPointerUp$={dropDrag$}
        onPointerCancel$={cancelDrag$}
      >
        <header
          class="shell-header"
          onPointerDown$={pressHeader$}
          onPointerUp$={endLineSwipe$}
          onPointerCancel$={() => (lineSwipe.pointerId = -1)}
        >
          <h1 class="visually-hidden">Calliopa</h1>
          <Wordmark />
          <nav
            class="tab-strip"
            aria-label="Open tabs"
            data-drop-target="tab:end"
            data-accepts="move open-in-tab"
          >
            <TabEdge
              side="before"
              tabs={tabs}
              onStep$={stepTab$}
              drag={drag}
            />
            {tabs.tabs.map((tab) => (
              <span
                class="tab-wrap"
                // Keyed by identity and title, for the reason the library rows
                // are: a renamed target gives its tab a new label.
                key={`${tab.id}:${tab.title}`}
                data-tab-id={tab.id}
                data-process={tabProcessState(registry.items, tab) ?? undefined}
                data-drop-target={`tab:${tab.id}`}
                data-accepts="move open-in-tab"
                // A value on every tab, never an attribute present on one.
                // An attribute written as `undefined` is left behind on a
                // reused element, so the tab that stopped being active kept
                // saying it was — to a reader's assistive technology as much
                // as to a scenario.
                data-active={tab.id === tabs.activeTabId ? "true" : "false"}
                data-drop-active={
                  drag.overId === `tab:${tab.id}` ? "true" : undefined
                }
                // Held over with a dragged block, the tab becomes active.
                // CA_0072_003
                data-spring={`tab:${tab.id}`}
                data-spring-hold={holdMark(drag.hold, `tab:${tab.id}`)}
              >
                <button
                  class="tab"
                  type="button"
                  aria-current={tab.id === tabs.activeTabId ? "page" : "false"}
                  onPointerDown$={(event) =>
                    startDrag$(
                      {
                        itemId: tab.itemId ?? tab.id,
                        kind: tab.kind,
                        source: "tab-strip",
                        operations: resolveView(REGISTRY, tab.kind, tab.viewType)
                          .view.drag,
                        preview: tab.title,
                      },
                      event,
                    )
                  }
                  onClick$={() => applyTabs$(selectTab(tabs, tab.id))}
                >
                  {/* A tab holding a document nobody has named draws the
                      minted name muted, the way its row in the drawer does.
                      The listing is what says so. DO_0012_008 */}
                  <span
                    class="tab__label"
                    data-unnamed={
                      tabUnnamed(REGISTRY.sections, library.data, tab) ? "true" : "false"
                    }
                  >
                    {tab.title}
                  </span>
                  {tab.unsaved && (
                    <span
                      class="tab__unsaved"
                      role="img"
                      aria-label="Unsaved"
                    />
                  )}
                  {tabProcessState(registry.items, tab) === "running" && (
                    <span
                      class="tab__marker tab__marker--running"
                      role="img"
                      aria-label="Process running"
                    />
                  )}
                  {tabProcessState(registry.items, tab) === "failed" && (
                    <span
                      class="tab__marker tab__marker--failed"
                      role="img"
                      aria-label="Process failed"
                    />
                  )}
                </button>
                {/* While a pointing stands, a document's tab carries *Mark
                    document* beside its close, and its number while marked
                    whole (`BO_0304_Q1`, `BO_0304_014`). */}
                {pointing.documentId !== null && documentOf(tab) !== null && (
                  <button
                    type="button"
                    class="tab-action tab__mark"
                    data-mark-document={tab.itemId ?? undefined}
                    data-reference={rowPointing(pointing, tab.itemId).number ?? undefined}
                    aria-pressed={rowPointing(pointing, tab.itemId).number !== null}
                    aria-label={
                      rowPointing(pointing, tab.itemId).number === null
                        ? `Mark ${tab.title} for the command`
                        : `${tab.title}, reference ${rowPointing(pointing, tab.itemId).number}`
                    }
                    title={rowPointing(pointing, tab.itemId).number === null ? "Mark document" : `Reference ${rowPointing(pointing, tab.itemId).number}`}
                    onClick$={() => markDocument$(tab.itemId ?? "", tab.title)}
                  >
                    {rowPointing(pointing, tab.itemId).number === null ? <Icon name="crosshair-simple" size={12} /> : `#${rowPointing(pointing, tab.itemId).number}`}
                  </button>
                )}
                <button
                  type="button"
                  class="tab-action tab__close"
                  aria-label={`Close ${tab.title}`}
                  onClick$={() => applyTabs$(closeTab(tabs, tab.id))}
                >
                  ×
                </button>
              </span>
            ))}
            <CloseAllTabs place="strip" tabs={tabs} onClose$={closeAll$} />
            <TabEdge
              side="after"
              tabs={tabs}
              onStep$={stepTab$}
              drag={drag}
            />
          </nav>
          <HeaderMenu
            save={save}
            processes={activeProcessCount(registry.items)}
            update={updateAvailable.value}
            licence={licenceWarning}
          >
            <SaveStatus save={save} />
            <button
              type="button"
              class="process-indicator"
              data-running={activeProcessCount(registry.items)}
              // The list lives in the right panel, so the pill says whether
              // the panel is showing it and a press shows or hides it, at
              // zero as well. CA_0058_007
              aria-pressed={layout.right.shown && shownIcon(layout.right, INSPECTOR_ICON_IDS) === INSPECTOR_ICON}
              aria-label={`${activeProcessCount(registry.items)} active processes. Execution`}
              onClick$={() =>
                showExecution$(layout.right.shown && shownIcon(layout.right, INSPECTOR_ICON_IDS) === INSPECTOR_ICON)
              }
            >
              <span class="menu-label">Execution</span>
              <span class="process-indicator__count">
                {activeProcessCount(registry.items)}
              </span>
            </button>
            {(["left", "right"] as const).map((side) => (
              <button
                key={side}
                type="button"
                class="layout-control"
                data-side={side}
                aria-label={side === "left" ? "Library" : "Inspector"}
                aria-pressed={layout[side].shown}
                onClick$={() => togglePanel$(side)}
              >
                <Icon name="sidebar-simple" />
                <span class="menu-label">
                  {side === "left" ? "Library" : "Inspector"}
                </span>
              </button>
            ))}
            <CloseAllTabs place="menu" tabs={tabs} onClose$={closeAll$} />
            {licenceWarning !== null && <LicenceWarning text={licenceWarning} />}
            {updateAvailable.value !== null && (
              // The owner's hint that a newer release exists, in the chrome
              // idiom; it opens the Update tab. A phone shows the icon, the
              // desktop the words. BO_0223_013 CA_0041_005
              <button
                type="button"
                class="update-hint"
                data-update-available={updateAvailable.value}
                aria-label={`Update available: ${updateAvailable.value}. Open the Update tab`}
                onClick$={() => openUpdate$()}
              >
                <Icon name="arrow-circle-up" />
                <span class="update-hint__words">
                  Update available: {updateAvailable.value}
                </span>
              </button>
            )}
            <HeaderModeToggle />
            {REGISTRY.kinds[SETTINGS_KIND] !== undefined && (
              <button
                type="button"
                class="settings-control"
                aria-label="Settings"
                onClick$={() => openSettings$()}
              >
                <Icon name="gear" />
                <span class="menu-label">Settings</span>
              </button>
            )}
            <ThemeToggle />
            {person !== null && <PersonMenu person={person} />}
          </HeaderMenu>
        </header>

        <button
          type="button"
          class="sheet-handle sheet-handle--left"
          aria-label="Open library"
          // Held over with a dragged block, the sheet opens. CA_0072_004
          data-spring="library-handle"
          data-spring-hold={holdMark(drag.hold, "library-handle")}
          // The gesture that opened the sheet closes it: a handle that only
          // ever opened would reopen what the reader meant to put away.
          // CA_0059_002
          onClick$={() => (mobile.sheet = pressHandle(mobile.sheet, "left"))}
        >
          ›
        </button>
        <button
          type="button"
          class="sheet-handle sheet-handle--right"
          aria-label="Open inspector"
          onClick$={() => (mobile.sheet = pressHandle(mobile.sheet, "right"))}
        >
          ‹
        </button>

        {/* A press outside an open sheet closes it and does nothing else. The
            shield is a transparent surface over the workspace alone, so the
            press lands on nothing the reader can see and the block beneath is
            left for the next press. The header is never covered, which is why
            a control there both closes the sheet and acts. CA_0059_002 */}
        {mobile.sheet !== null && (
          <div
            class="sheet-shield"
            aria-hidden="true"
            onClick$={() => (mobile.sheet = null)}
          />
        )}

        <aside class="drawer drawer--left" aria-label="Library">
          <PanelIcons
            side="left"
            label="Library sections"
            layout={layout}
            icons={libraryIcons(layout)}
            startDrag$={startDrag$}
            drag={drag}
            onPress$={(id) => pressPanelIcon$("left", id)}
          />
          {/* The content scrolls, so the tab stop is its. CA_0056_001 */}
          <div class="panel-content" tabIndex={0} data-panel-content={libraryContent.id ?? ""}>
            <button
              type="button"
              class="sheet-close"
              aria-label="Close library"
              onClick$={() => (mobile.sheet = null)}
            >
              ×
            </button>
            {libraryContent.sections.length > 1 && (
              <h2 class="panel-title">{libraryContent.title}</h2>
            )}
            {libraryContent.sections.map((section) => {
              // The closures below capture strings, never the section itself:
              // a contribution carries a component and a QRL, and the shell
              // reaches both through the registry module rather than by
              // serializing them into a listener.
              const key = section.key;
              const name = section.name;
              // One section under its icon has no caret and is never collapsed;
              // several are bands, each with its own. CA_0056_002
              const collapsible = libraryContent.sections.length > 1;
              const state = collapsible ? sectionState(layout, key) : "expanded";
              const elementId = sectionElementId(key);
              const Body = section.component;
              const items = Body === undefined
                ? ((library.data[key] as readonly LibraryItem[] | undefined) ?? [])
                : [];
              return (
                <section
                  class="library-category"
                  aria-labelledby={elementId}
                  data-library={name}
                  data-section={key}
                  data-state={state}
                  key={key}
                >
                  <SectionHeader
                    layout={layout}
                    sectionKey={key}
                    name={name}
                    elementId={elementId}
                    title={section.title}
                    collapsible={collapsible}
                    createLabel={section.createLabel}
                    onToggle$={() => toggleSection$(key)}
                    onCreate$={() => createIn$(key)}
                  />
                  <div
                    id={`${elementId}-list`}
                    class="library-category__body"
                    hidden={state === "collapsed"}
                  >
                    {Body !== undefined ? (
                      <Body
                        data={library.data[key] ?? null}
                        activeItemId={active?.itemId ?? null}
                        sectionKey={key}
                        filter={layout.filters[key] ?? null}
                        setFilter$={$((values: readonly string[]) => setSectionFilter$(key, values))}
                      />
                    ) : items.length === 0 ? (
                      <p class="library-empty" data-library-empty={name}>
                        {section.empty}
                      </p>
                    ) : (
                      <ul class="library-list" key={library.reads}>
                        {items.map((item) => {
                          const current = item.open !== undefined && active?.itemId === item.open.itemId;
                          return (
                            <li key={item.id}>
                              <LibraryRow
                                item={item}
                                current={current}
                                onOpen$={openTarget$}
                                held={holdMark(drag.hold, `library:${item.id}`) !== undefined}
                                pointing={rowPointing(pointing, item.open?.itemId ?? null)}
                                onMark$={markDocument$}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>
        {/* The library's inner border, dragged to resize it. CA_0066_002 */}
        <PanelResizeHandle side="left" layout={layout} widths={widths} />

        <section
          class="workspace"
          // Named directly rather than by a visible heading. The headline
          // belongs to the view that owns the content and can edit it, so the
          // region says what it is without rendering a second title above it.
          aria-label="Workspace"
          // The region scrolls and the page does not, so it has to be reachable
          // from the keyboard: without a tab stop a keyboard-only reader cannot
          // move a document that no longer moves with the page. Both drawers
          // already carry one.
          tabIndex={0}
          data-view={activeView?.id}
        >
          {/* The active view's bar, drawn by the shell from what the view
              contributes, and absent while it contributes nothing. CA_0053_003 */}
          {active && <ViewBarPanel bar={bar} decorations={decorationBar} />}
          {/* The open runs on the active tab's target, on a line right below
              the bar, pushing the content down. CA_0055_001 */}
          {active && documentOf(active) !== null && chipsFor(runChips.byItem, active).length > 0 && (
            <RunChips
              itemId={documentOf(active) as string}
              chips={chipsFor(runChips.byItem, active)}
              answerAll={answerAll}
              toggleRun={toggleRun}
              open$={$((target: RunChipElsewhere["open"]) => openTarget$(target))}
              // While a pointing stands anywhere, a chip's press marks its
              // whole proposal for the prompt. BO_0321_011
              pointing={pointing.documentId !== null}
            />
          )}
          {active ? (
            // Keyed by tab: switching tabs must unmount the view, not hand it a
            // different target. A surface holding unsaved input has to be told it
            // is leaving, and per-tab view-local state must not leak sideways.
            // Keyed by the target too: a retargeted tab remounts its view on
            // the new document rather than handing the old one a target it
            // did not read. CA_0047_004
            <ViewHost key={`${active.id}:${active.itemId ?? ""}`} tab={active} />
          ) : (
            // With no tab open the workspace names the library: a document is
            // opened or created there, and nothing opens on its own. BO_0203_005
            <p data-workspace-empty>Open a document from the library to begin.</p>
          )}
          {active && viewsFor(REGISTRY, active.kind).length > 1 && (
            <div
              class="view-choice"
              role="group"
              aria-label={`Views for ${active.title}`}
            >
              {viewsFor(REGISTRY, active.kind)
                .filter((view) => view.id !== activeView?.id)
                .map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    data-open-view={view.id}
                    onClick$={() => openView$(view.id)}
                  >
                    Open in {view.name}
                  </button>
                ))}
            </div>
          )}
        </section>

        <aside class="drawer drawer--right" aria-label="Inspector">
          <div class="panel-content" tabIndex={0} data-panel-content={INSPECTOR_ICON}>
            <button
              type="button"
              class="sheet-close"
              aria-label="Close inspector"
              onClick$={() => (mobile.sheet = null)}
            >
              ×
            </button>
            <h2>Inspector</h2>
            <InspectorPanel
              registry={shownRegistry}
              refusal={player.refusal}
              tabs={tabs}
              proposed={proposed}
              inspector={inspector}
              declared={activeView?.inspector ?? "Workspace context"}
              viewId={activeView?.id}
              openTarget$={openTarget$}
              acknowledge$={acknowledge$}
            />
            {/* The one list of what is running and what has run, under the
                view's facts on every tab. A selected process's detail takes
                the contribution's place above it rather than the list's, so
                the reader can move from one entry to the next.
                BO_0267_010 CA_0058_005 CA_0058_010 */}
            <ExecutionSection
              itemId={documentOf(active)}
              selection={active?.selection ?? null}
              read={
                onReplay && player.run !== null && replayPlayed !== null
                  ? { itemId: player.run.document, runs: [replayExecutionRun(player.run, replayPlayed, player.startedAt)], error: null }
                  : execution
              }
              processes={(onReplay ? shownRegistry : registry).items.map(executionProcess)}
              selected={selectedProcess(registry.selection, tabs.activeTabId)}
              chips={chipsFor(runChips.byItem, active)}
              answerAll={answerAll}
              toggleRun={toggleRun}
              layout={layout}
              onToggle$={() => toggleSection$(EXECUTION_SECTION)}
              onCancel$={cancelExecutionRun$}
              onSelect$={selectProcess$}
              startDrag$={startDrag$}
            />
          </div>
          <PanelIcons
            side="right"
            label="Inspector sections"
            layout={layout}
            icons={INSPECTOR_ICONS}
            onPress$={(id) => pressPanelIcon$("right", id)}
          />
        </aside>
        {/* The inspector's inner border, dragged to resize it. CA_0066_002 */}
        <PanelResizeHandle side="right" layout={layout} widths={widths} />

        {drag.payload && (
          <div
            class="drag-preview"
            data-drag-preview
            style={{
              transform: `translate(${drag.position.x + 12}px, ${drag.position.y + 12}px)`,
            }}
          >
            {drag.payload.preview}
          </div>
        )}
      </main>
      {/* Outside the frame it makes inert: a message inside `main` would be
          disabled along with everything else while it asks. The shell renders
          it unconditionally and the component reads the store, so raising one
          re-renders the message alone rather than the shell and the view under
          it. */}
      <MessageSurface message={message} />
    </>
  );
});

/**
 * The shell's one message surface.
 *
 * Its own component so that raising or lowering a message re-renders this
 * alone. Re-rendering the shell for it would re-render the mounted view too,
 * which for an editing surface means rebuilding the element under the caret.
 * It is also why the frame is made inert imperatively rather than by the shell
 * rendering an `inert` it would have to read the message to decide.
 *
 * The view said the words; the shell decides how they read, that a question
 * holds the floor, and that answering lowers it. Lowering happens before the
 * answer runs, because the question has been answered either way: an answer
 * that fails reports on its own surface rather than leaving the question up.
 */
const MessageSurface = component$<{ message: ViewMessage }>(({ message }) => {
  // The control that raised the message, so focus can go back to it once the
  // question is answered. `noSerialize` because it names a live element: it is
  // browser-local for the page's lifetime, and not something a record carries.
  // A module-level variable would not do — Qwik extracts each QRL into its own
  // chunk, where module state it assigns to has become an import.
  const returnTo = useSignal<NoSerialize<HTMLElement>>();

  // `document-ready` rather than the default: the component renders nothing at
  // all while no message is up, and a task waiting for an element to intersect
  // would never run to see the first one arrive.
  useVisibleTask$(
    ({ track, cleanup }) => {
      const current = track(() => message.current);
      const frame = document.querySelector<HTMLElement>("main.shell");

      if (current === null) {
        // Un-inert before restoring focus: the control that raised the message
        // is inside the frame, and an inert element cannot take focus.
        if (frame !== null) frame.inert = false;
        const back = returnTo.value;
        returnTo.value = undefined;
        back?.focus();
        return;
      }

      // Read before the frame goes inert, which blurs whatever is focused.
      returnTo.value =
        document.activeElement instanceof HTMLElement
          ? noSerialize(document.activeElement)
          : undefined;
      if (frame !== null) frame.inert = true;
      // Focus lands on the message itself rather than on an answer, so the
      // question is heard before the choices. `inert` behind it is what keeps
      // focus here: there is nothing else left to tab to.
      document.querySelector<HTMLElement>("[data-message]")?.focus();

      // Escape cancels wherever focus sits, not only inside the message.
      // Lowering without running an answer is what cancelling is: the answer
      // that changes nothing, reached by reflex.
      const cancel = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        message.current = null;
      };
      document.addEventListener("keydown", cancel);
      cleanup(() => document.removeEventListener("keydown", cancel));
    },
    { strategy: "document-ready" },
  );

  const current = message.current;
  if (current === null) return null;

  return (
    <div class="message-layer" data-message-layer>
      <div
        class="message"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="message-headline"
        aria-describedby="message-body"
        tabIndex={-1}
        data-message
        onKeyDown$={(event: KeyboardEvent, element: HTMLElement) => {
          if (event.key !== "Tab") return;

          // `inert` keeps focus off the frame, but the document itself still
          // takes a turn in the tab cycle, and a question that holds the floor
          // must not have a way out of it. Wrapping the ends closes that turn.
          const answers = [
            ...element.querySelectorAll<HTMLElement>("[data-message-answer]"),
          ];
          const first = answers[0];
          const last = answers[answers.length - 1];
          if (first === undefined || last === undefined) return;

          const focused = document.activeElement;
          if (event.shiftKey && (focused === first || focused === element)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && focused === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="message-headline" class="message__headline">
          {current.headline}
        </h2>
        <p id="message-body" class="message__body">
          {current.body}
        </p>
        <div class="message__answers">
          {current.answers.map((answer) => (
            <button
              key={answer.id}
              type="button"
              class="message__answer"
              data-message-answer={answer.id}
              data-destructive={answer.destructive ? "" : undefined}
              onClick$={async () => {
                const run$ = answer.run$;
                message.current = null;
                // An answer that changes nothing carries no handler, which is
                // what `Cancel` is.
                if (run$ !== undefined) await run$();
              }}
            >
              {answer.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
