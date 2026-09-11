import {
  $,
  component$,
  noSerialize,
  type NoSerialize,
  useContextProvider,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  type QRL,
} from "@builder.io/qwik";
import {
  dockAfterRelease,
  dockAfterTap,
  nextDrawerState,
  nextSectionState,
  sectionState,
  type Layout,
} from "~/lib/layout";
import { danglingNumbers } from "~/lib/command-typeahead";
import { Composer, type ComposerAim } from "./composer";
import { fitField } from "./command-field";
import { LicenceWarning, PersonMenu } from "./header-disclosure";
import { Icon } from "./icons";
import { SaveStatus } from "./save-status";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import {
  activeTab,
  closeTab,
  moveTab,
  openTab,
  selectTab,
  updateTab,
  type Tab,
  type TabsState,
} from "~/lib/tabs";
import {
  activeProcessCount,
  tabProcessState,
  type ProcessRecord,
} from "~/lib/process";
import {
  DRAG_MOVE_TOLERANCE_PX,
  LONG_PRESS_MS,
  movedDistance,
  pointerIntent,
  resolveOperation,
  type DragOperation,
  type DragPayload,
  type DropTarget,
} from "~/lib/drag";
import type { LibraryItem, OpenTarget } from "~/contract";
import { qualify } from "~/registry";
import { REGISTRY } from "~/registry.gen";
import type { RunEvent } from "~/server/agent/run-events";
import type { ProposedDocument } from "~/server/agent/proposed";
import { describeRunEvent } from "~/lib/runs";
import type { SelectableRuntime } from "~/lib/connections";
import { CHOICE_NOT_REMEMBERED, openingAgent, rememberAgent } from "~/lib/agent-menu";
import {
  commandTarget,
  NO_CHOICE,
  NO_POINTING,
  staleIn,
  type Pointing,
} from "~/lib/command-target";
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
import {
  InspectorPanel,
  ProcessList,
  type ProcessRegistry,
  type ProposedRead,
} from "./inspector";
import { keepOpenTabs, NO_SELECTION, selectedProcess } from "~/lib/process-selection";

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
const sectionElementId = (key: string): string =>
  `library-${key.replace(/[^a-zA-Z0-9]+/gu, "-")}`;
import {
  ViewBridgeContext,
  type ViewBridge,
  type ViewDrop,
  type ViewInspector,
  type ViewDock,
  type ViewSave,
  type SaveState,
  type Message,
  type ViewMessage,
  type ViewProposed,
  type ViewReveal,
  type UndoOffer,
} from "./view-bridge";
import "./shell.css";

/** The registry is re-attached by identity; polling is the first transport. */
export const PROCESS_POLL_INTERVAL_MS = 2000;

/** The events that end a run. BO_0226_007 */
const RUN_ENDS: readonly RunEvent["kind"][] = ["runCompleted", "runFailed", "runCancelled"];

interface DragState {
  candidate: DragPayload | null;
  payload: DragPayload | null;
  startedAt: number;
  origin: { x: number; y: number };
  position: { x: number; y: number };
  overId: string | null;
  operation: DragOperation | null;
  /** A drop the shell did not consume itself, left for the view that declared
   * the target. Kept across the idle reset, because it outlives the gesture. */
  drop: ViewDrop | null;
  drops: number;
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
});

/** Targets the shell owns. Everything else belongs to the mounted view. */
const shellTarget = (overId: string): boolean => overId.startsWith("tab:");

/**
 * The pointer is not captured, so the element under it decides the target.
 * A target declares what it accepts; the payload decides what it offers.
 */
function targetUnder(x: number, y: number): DropTarget | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest("[data-drop-target]");
  const id = element?.getAttribute("data-drop-target");
  if (!element || id === null || id === undefined) return null;
  return {
    id,
    accepts: (element.getAttribute("data-accepts") ?? "")
      .split(" ")
      .filter(Boolean) as DragOperation[],
  };
}

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
  const registry = useStore<ProcessRegistry>({
    items: [...processes],
    selection: NO_SELECTION,
  });
  const mobile = useStore({
    sheet: null as "left" | "right" | null,
    // Where the dock handle was pressed, or `null` when it saw no press. The
    // press is recorded rather than assumed, because a coordinate has no value
    // that means "no press".
    dockPressY: null as number | null,
  });
  const drag = useStore<DragState>({ ...idleDrag(), drop: null, drops: 0 });
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
   * The agent run this session started, the events it has reported, and
   * whatever the dock has to say about the last goal. The notice lives here
   * rather than on the message surface: a refusal belongs beside the control
   * that was pressed, and a message would take the whole frame to say the
   * agent is busy.
   */
  const run = useStore<{
    id: string | null;
    processId: string | null;
    events: RunEvent[];
    notice: string | null;
    sending: boolean;
    /**
     * The agent the next command goes to, and what there is to choose from.
     * The dropdown opens on the instance's last choice (`openingAgent`), so
     * `agent` is null only until the list has been read — and a command sent
     * before then names none, which the server takes as what the gateway is
     * running. BO_0225_004 BO_0228_011
     */
    agent: string | null;
    runtimes: SelectableRuntime[];
    /**
     * The document the run was aimed at, and the run whose end has already
     * been told to the view showing it — once per run, however many polls
     * read the end. BO_0226_007
     */
    artifact: string | null;
    announced: string | null;
  }>({
    id: null,
    processId: null,
    events: [],
    notice: null,
    sending: false,
    agent: null,
    runtimes: [],
    artifact: null,
    announced: null,
  });
  /**
   * What the reader has marked in each document, as its view last reported,
   * and where they asked the next command's work to go. Keyed by document
   * rather than tab, as the marks themselves are (`markingKey`).
   * BO_0226_005 BO_0226_006
   */
  const aim = useStore<ComposerAim>({ pointing: {}, choice: NO_CHOICE });
  /** The last run aimed at a document that ended, for the view showing it. */
  const runProposed = useStore<ViewProposed>({ itemId: null, seq: 0 });
  /** The last chip the reader pressed, for the view showing its document. CA_0039_004 */
  const reveal = useStore<ViewReveal>({ itemId: null, target: null, seq: 0 });
  useVisibleTask$(async () => {
    const response = await fetch("/api/agent/runtimes");
    if (!response.ok) return;
    const answered = (await response.json()) as {
      runtimes: SelectableRuntime[];
      chosen: string | null;
      active: string | null;
    };
    run.runtimes = answered.runtimes;
    // The instance's last choice when it can run; otherwise what the gateway
    // runs, and a notice saying the choice was not honoured and why.
    // BO_0228_011
    const opening = openingAgent(answered.runtimes, answered.chosen, answered.active);
    run.agent = opening.agent;
    if (opening.notice !== null) run.notice = opening.notice;
  });
  /**
   * What the selected process's run proposed, read when the selection changes.
   * A process that is not a run answers an empty list, which is why this is
   * asked of whatever is selected rather than only of runs.
   */
  const proposed = useStore<ProposedRead>({ processId: null, documents: [] });
  /**
   * The one thing the dock can take back: a tab move, which carries the tabs
   * to restore, or what a view just did, which carries its own inverse
   * (`offerUndo$`). One line for both, so a thing is taken back the same way
   * wherever it was done. BO_0227_013
   */
  const undo = useSignal<
    | { readonly kind: "tabs"; readonly label: string; readonly tabs: TabsState }
    | { readonly kind: "view"; readonly label: string; readonly undo$: QRL<() => void> }
    | null
  >(null);
  const tabs = useStore<TabsState>({
    tabs: workspace.tabs,
    activeTabId: workspace.activeTabId,
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
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...nextTabs,
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
  const setDock$ = $(async (dock: Layout["dock"]) => {
    layout.dock = dock;
    await save$(tabs, { ...layout, dock });
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
    const poll = async () => {
      const response = await fetch(`/api/workspaces/${workspace.id}/processes`);
      if (!stopped && response.ok) {
        registry.items = (await response.json()) as ProcessRecord[];
      }
      // The run's events ride the registry's clock rather than opening a
      // second transport. A run the reader started in an earlier session is
      // not followed here, because the console reports it as a process either
      // way and its events are read back when it is selected.
      if (!stopped && run.id !== null) {
        const events = await fetch(`/api/runs/${run.id}/events`);
        if (!stopped && events.ok) {
          run.events = (await events.json()) as RunEvent[];
          // A run aimed at a document has ended — completed, failed or
          // cancelled, since a run that failed may already have staged — so
          // the view showing that document reads what it proposed. Once per
          // run: the poll keeps reading the same end. BO_0226_007
          if (
            run.artifact !== null &&
            run.announced !== run.id &&
            run.events.some((event) => RUN_ENDS.includes(event.kind))
          ) {
            run.announced = run.id;
            runProposed.itemId = run.artifact;
            runProposed.seq += 1;
          }
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), PROCESS_POLL_INTERVAL_MS);
    cleanup(() => {
      stopped = true;
      clearInterval(timer);
    });
  });
  /**
   * Sends the composer's text to the agent.
   *
   * A refusal is shown where it was asked for, in the agent's own words when
   * they are what came back: the reader pressed a button in the dock, and the
   * dock is where they should learn why nothing happened.
   */
  const sendGoal$ = $(async () => {
    const field = document.querySelector<HTMLTextAreaElement>("#command");
    const goal = field?.value.trim() ?? "";
    if (goal === "" || run.sending) return;

    run.sending = true;
    run.notice = null;
    // What the command is aimed at, read from the stores at the press: the
    // active tab, the delivery chosen for its document, and its marks. Not the
    // tab's selection, which leaving the editor for the composer has already
    // cleared. BO_0226_005
    const target = commandTarget(activeTab(tabs), aim.choice, aim.pointing);
    // A passage whose words are gone stops the command where the reader can
    // see why: its number may already be in the words, and sending it would
    // name a reference with nothing behind it. BO_0227_015
    const stale =
      target === null ? [] : staleIn(aim.pointing[target.artifact] ?? NO_POINTING);
    if (stale.length > 0) {
      run.sending = false;
      run.notice = `${stale.map((number) => `#${number}`).join(", ")} no longer ${stale.length === 1 ? "matches its" : "match their"} words. Re-point or take back before running.`;
      return;
    }
    // A number written into the command whose mark has since been taken back
    // names a reference with nothing behind it, for the same reason.
    const dangling =
      target === null
        ? []
        : danglingNumbers(goal, (aim.pointing[target.artifact] ?? NO_POINTING).references);
    if (dangling.length > 0) {
      run.sending = false;
      run.notice = `${dangling.map((number) => `#${number}`).join(", ")} ${dangling.length === 1 ? "names" : "name"} nothing marked. Mark it again, or take it out of the command.`;
      return;
    }
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal,
          ...(run.agent === null ? {} : { agent: run.agent }),
          ...(target === null ? {} : target),
        }),
      });
      if (response.ok) {
        const started = (await response.json()) as {
          runId: string;
          processId: string;
        };
        run.id = started.runId;
        run.processId = started.processId;
        run.events = [];
        run.artifact = target?.artifact ?? null;
        run.announced = null;
        if (field) {
          field.value = "";
          fitField(field);
        }
        // The run has already recorded its start; reading it now means the
        // console shows the run rather than nothing until the next poll.
        const events = await fetch(`/api/runs/${started.runId}/events`);
        if (events.ok) {
          run.events = (await events.json()) as RunEvent[];
        }
        return;
      }
      const refused = (await response.json()) as { error?: string };
      run.notice = refused.error ?? "The agent did not take the goal.";
    } catch {
      run.notice = "The agent could not be reached.";
    } finally {
      run.sending = false;
    }
  });

  const chooseAgent$ = $(async (agent: string) => {
    run.agent = agent;
    // Said when it could not be remembered, since the next reload would open
    // elsewhere.
    if (!(await rememberAgent(agent))) run.notice = CHOICE_NOT_REMEMBERED;
  });

  const cancelRun$ = $(async () => {
    if (run.id === null) return;
    await fetch(`/api/runs/${run.id}/cancel`, {
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
    if (selected === null) return;

    const response = await fetch(`/api/processes/${selected}/proposals`);
    if (response.ok && selectedProcess(registry.selection, tabs.activeTabId) === selected) {
      proposed.documents = (await response.json()) as ProposedDocument[];
    }
  });
  // A closed tab takes its selection with it, so a tab opened again on the
  // same target starts with nothing selected. CA_0040_001
  useTask$(({ track }) => {
    const open = track(() => tabs.tabs);
    const kept = keepOpenTabs(registry.selection, open);
    if (kept !== registry.selection) registry.selection = kept;
  });

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
  const trackDrag$ = $((event: PointerEvent) => {
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
    const target = targetUnder(event.clientX, event.clientY);
    drag.overId = target?.id ?? null;
    drag.operation =
      target === null ? null : resolveOperation(drag.payload, target);
  });
  const dropDrag$ = $(async () => {
    const { payload, operation, overId } = drag;
    Object.assign(drag, idleDrag());
    if (payload === null || operation === null || overId === null) return;

    if (operation === "move" && overId.startsWith("tab:")) {
      const moving = tabs.tabs.find(
        (tab) => (tab.itemId ?? tab.id) === payload.itemId,
      );
      if (!moving) return;
      const before = overId.slice("tab:".length);
      const previous: TabsState = {
        tabs: [...tabs.tabs],
        activeTabId: tabs.activeTabId,
      };
      const next = moveTab(tabs, moving.id, before === "end" ? null : before);
      tabs.tabs = next.tabs;
      tabs.activeTabId = next.activeTabId;
      undo.value = { kind: "tabs", label: `Moved ${moving.title}`, tabs: previous };
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
  const takeBack$ = $(async () => {
    const entry = undo.value;
    undo.value = null;
    if (entry === null) return;
    if (entry.kind === "view") {
      await entry.undo$();
      return;
    }
    tabs.tabs = entry.tabs.tabs;
    tabs.activeTabId = entry.tabs.activeTabId;
    await save$(entry.tabs, layout);
  });
  /**
   * Opens a target in a tab, in the view remembered for it. `openTab` reveals
   * a tab already showing this target rather than opening a second one, so
   * activating an entry twice lands on the same tab. The kind is qualified as
   * the registry names it. BO_0202_004
   */
  const openTarget$ = $(async (target: OpenTarget) => {
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
    await applyTabs$(openTab(tabs, tab));
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
  const dock = useStore<ViewDock>({ action: null });
  const save = useStore<ViewSave>({ state: null });
  const message = useStore<ViewMessage>({ current: null });
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
    // The dock's action is the old view's too, and it acts on that view's own
    // content. Offering it over a different tab would put a control in the dock
    // for a surface the reader has left.
    dock.action = null;
    // So is what it offered to take back, for the same reason. A tab move's
    // undo is the shell's own and stays.
    if (undo.value?.kind === "view") undo.value = null;
    // A message belongs to the view that raised it. Leaving it up over a
    // different tab would ask about a document the reader is no longer looking
    // at, and answering it would act on that one.
    message.current = null;
  });
  const bridge: ViewBridge = {
    drag,
    inspector,
    dock,
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
    proposed: runProposed,
    reveal,
    offerUndo$: $((offer: UndoOffer) => {
      undo.value = { kind: "view", label: offer.label, undo$: offer.undo$ };
    }),
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

  const cycleDrawer$ = $((side: "left" | "right") => {
    const next = { ...layout, [side]: nextDrawerState(layout[side]) };
    layout[side] = next[side];
    save$(tabs, next);
  });

  const active = activeTab(tabs);
  const activeView = active
    ? resolveView(REGISTRY, active.kind, active.viewType).view
    : undefined;

  return (
    <>
      <main
        class="shell"
        data-left={layout.left}
        data-right={layout.right}
        data-dock={layout.dock}
        data-sheet={mobile.sheet ?? undefined}
        data-workspace-id={workspace.id}
        data-dragging={
          drag.payload === null ? undefined : (drag.operation ?? "none")
        }
        onPointerMove$={trackDrag$}
        onPointerUp$={dropDrag$}
        onPointerCancel$={cancelDrag$}
      >
        <header class="shell-header">
          <h1 class="visually-hidden">Calliopa</h1>
          <Wordmark />
          <nav
            class="tab-strip"
            aria-label="Open tabs"
            data-drop-target="tab:end"
            data-accepts="move open-in-tab"
          >
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
                  <span class="tab__label">{tab.title}</span>
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
          </nav>
          <SaveStatus save={save} />
          <button
            type="button"
            class="process-indicator"
            data-running={activeProcessCount(registry.items)}
            aria-pressed={layout.dock === "console"}
            aria-label={`${activeProcessCount(registry.items)} active processes. Process console`}
            onClick$={() =>
              setDock$(layout.dock === "console" ? "composer" : "console")
            }
          >
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
              aria-label={`${side} drawer: ${layout[side]}. Change`}
              onClick$={() => cycleDrawer$(side)}
            >
              <Icon name="sidebar-simple" />
            </button>
          ))}
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
          {REGISTRY.kinds[SETTINGS_KIND] !== undefined && (
            <button
              type="button"
              class="settings-control"
              aria-label="Settings"
              onClick$={() => openSettings$()}
            >
              <Icon name="gear" />
            </button>
          )}
          <ThemeToggle />
          {person !== null && <PersonMenu person={person} />}
        </header>

        <button
          type="button"
          class="sheet-handle sheet-handle--left"
          aria-label="Open library"
          onClick$={() => (mobile.sheet = "left")}
        >
          ›
        </button>
        <button
          type="button"
          class="sheet-handle sheet-handle--right"
          aria-label="Open inspector"
          onClick$={() => (mobile.sheet = "right")}
        >
          ‹
        </button>

        <aside class="drawer drawer--left" aria-label="Library" tabIndex={0}>
          <button
            type="button"
            class="sheet-close"
            aria-label="Close library"
            onClick$={() => (mobile.sheet = null)}
          >
            ×
          </button>
          {REGISTRY.sections.map((section) => {
            // The closures below capture strings, never the section itself:
            // a contribution carries a component and a QRL, and the shell
            // reaches both through the registry module rather than by
            // serializing them into a listener.
            const key = section.key;
            const name = section.name;
            const state = sectionState(layout, key);
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
                <div class="library-category__header">
                  <h2 class="library-category__heading">
                    <button
                      type="button"
                      class="library-category__toggle"
                      id={elementId}
                      aria-expanded={state === "expanded"}
                      aria-controls={`${elementId}-list`}
                      onClick$={() => toggleSection$(key)}
                    >
                      <span class="library-category__caret">
                        <Icon name="caret-right" />
                      </span>
                      {section.title}
                    </button>
                  </h2>
                  {section.createLabel !== undefined && (
                    <button
                      type="button"
                      class="library-action library-action--icon"
                      aria-label={section.createLabel}
                      data-new={name}
                      onClick$={() => createIn$(key)}
                    >
                      <Icon name="plus" />
                    </button>
                  )}
                </div>
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
                        const open = item.open;
                        const current = open !== undefined && active?.itemId === open.itemId;
                        return (
                          <li key={item.id}>
                            {open === undefined ? (
                              // Named and not opened: no view presents it on
                              // its own, and a control that opened nothing
                              // would say there is somewhere to go.
                              <span
                                class="library-entry library-entry--inert"
                                data-item-id={item.id}
                              >
                                <span class="library-entry__label">{item.label}</span>
                                {item.badge !== undefined && (
                                  <span class="library-entry__badge">{item.badge}</span>
                                )}
                              </span>
                            ) : (
                              <button
                                type="button"
                                class="library-entry"
                                data-item-id={item.id}
                                data-item-kind={open.kind}
                                data-badge={item.badge}
                                data-current={current ? "true" : undefined}
                                aria-current={current ? "true" : undefined}
                                onClick$={() => openTarget$(open)}
                              >
                                <span class="library-entry__label">{item.label}</span>
                                {item.badge !== undefined && (
                                  <span class="library-entry__badge">{item.badge}</span>
                                )}
                                {/* The marker is the sighted reader's non-colour
                                  signal. `aria-current` above already says the
                                  same thing, so naming the marker too would
                                  append it to the entry's name. */}
                                {current && (
                                  <span class="library-entry__marker" aria-hidden="true" />
                                )}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </aside>

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
          {active ? (
            // Keyed by tab: switching tabs must unmount the view, not hand it a
            // different target. A surface holding unsaved input has to be told it
            // is leaving, and per-tab view-local state must not leak sideways.
            <ViewHost key={active.id} tab={active} />
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

        <aside class="drawer drawer--right" aria-label="Inspector" tabIndex={0}>
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
            registry={registry}
            tabs={tabs}
            proposed={proposed}
            inspector={inspector}
            declared={activeView?.inspector ?? "Workspace context"}
            viewId={activeView?.id}
            openTarget$={openTarget$}
            acknowledge$={acknowledge$}
          />
        </aside>

        <section class="dock" aria-label="Command dock">
          <button
            type="button"
            class="dock__handle"
            aria-label={`Command dock: ${layout.dock}`}
            // A pointer gesture is decided on release, where the tap and
            // the swipe are one decision applying one transition. The click a
            // pointer leaves behind is left alone: acting on it as well would
            // apply a second transition to the same interaction, and which one
            // landed would be decided by whichever handler resolved first.
            // Keyboard and assistive activation arrive as a click with no
            // pointer behind it, which `detail` of `0` is what says.
            onClick$={(event) => {
              if (event.detail === 0) setDock$(dockAfterTap(layout.dock));
            }}
            onPointerDown$={(event) => (mobile.dockPressY = event.clientY)}
            onPointerUp$={(event) => {
              const next = dockAfterRelease(
                layout.dock,
                mobile.dockPressY,
                event.clientY,
              );
              mobile.dockPressY = null;
              setDock$(next);
            }}
          >
            <span />
          </button>
          <Composer
            dock={dock}
            tabs={tabs}
            aim={aim}
            run={run}
            reveal={reveal}
            onRun$={sendGoal$}
            onChooseAgent$={chooseAgent$}
          />
          {undo.value && (
            <p class="undo" data-undo>
              {undo.value.label}
              <button type="button" onClick$={takeBack$}>
                Undo
              </button>
            </p>
          )}
          <div class="console" aria-label="Process console">
            {run.events.length > 0 && (
              <div class="run-activity" aria-label="Agent activity">
                <ol class="run-activity__list">
                  {run.events.map((event, index) => (
                    <li
                      key={`${event.kind}-${index}`}
                      data-run-event={event.kind}
                    >
                      {describeRunEvent(event)}
                    </li>
                  ))}
                </ol>
                {registry.items.some(
                  (process) =>
                    process.id === run.processId &&
                    (process.state === "queued" || process.state === "running"),
                ) && (
                  <button
                    type="button"
                    class="run-activity__cancel"
                    onClick$={cancelRun$}
                    data-cancel-run
                  >
                    Cancel run
                  </button>
                )}
              </div>
            )}
            <ProcessList registry={registry} tabs={tabs} startDrag$={startDrag$} />
          </div>
        </section>

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
