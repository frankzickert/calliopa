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
} from "@builder.io/qwik";
import {
  dockAfterRelease,
  dockAfterTap,
  nextDrawerState,
  nextSectionState,
  type Layout,
} from "~/lib/layout";
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
  describeProcess,
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
import type {
  AssetSummary,
  DocumentSummary,
  EpisodeSummary,
  FrontSummary,
} from "~/lib/library";
import type { RunEvent } from "~/server/agent/run-events";
import type { ProposedDocument } from "~/server/agent/proposed";
import { describeRunEvent } from "~/lib/runs";
import type { WorkspaceRecord } from "~/lib/workspace";
import {
  defaultViewFor,
  preferredView,
  rememberView,
  resolveView,
  viewsFor,
} from "~/lib/views";
import { ViewHost } from "./view-host";

/**
 * Settings has no content to be the target of, so it carries one synthetic
 * instance-wide target. A tab is found by its target, and this is what keeps
 * that rule true for a tab that resolves to nothing in the graph.
 */
const SETTINGS_TARGET = "instance";
import {
  ViewBridgeContext,
  type ViewBridge,
  type ViewDrop,
  type InspectorFact,
  type ViewInspector,
  type ViewDock,
  type ViewSave,
  type SaveState,
  type Message,
  type ViewMessage,
} from "./view-bridge";
import "./shell.css";

/** The registry is re-attached by identity; polling is the first transport. */
export const PROCESS_POLL_INTERVAL_MS = 2000;

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
const shellTarget = (overId: string): boolean =>
  overId.startsWith("tab:") || overId === "composer";

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
  documents: readonly DocumentSummary[];
  episodes: readonly EpisodeSummary[];
  standing: readonly AssetSummary[];
  fronts: readonly FrontSummary[];
}>(({ workspace, processes, documents, episodes, standing, fronts }) => {
  const layout = useStore<Layout>({ ...workspace.layout });
  const registry = useStore<{
    items: ProcessRecord[];
    selectedId: string | null;
  }>({ items: [...processes], selectedId: null });
  const mobile = useStore({
    sheet: null as "left" | "right" | null,
    // Where the dock handle was pressed, or `null` when it saw no press. The
    // press is recorded rather than assumed, because a coordinate has no value
    // that means "no press".
    dockPressY: null as number | null,
  });
  const drag = useStore<DragState>({ ...idleDrag(), drop: null, drops: 0 });
  // The library is rendered from the listing the page was served with, and
  // re-read whenever this session changes what it holds.
  const library = useStore<{
    documents: DocumentSummary[];
    episodes: EpisodeSummary[];
    standing: AssetSummary[];
    fronts: FrontSummary[];
    reads: number;
  }>({
    documents: [...documents],
    episodes: [...episodes],
    standing: [...standing],
    fronts: [...fronts],
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
  }>({
    id: null,
    processId: null,
    events: [],
    notice: null,
    sending: false,
  });
  /**
   * What the selected process's run proposed, read when the selection changes.
   * A process that is not a run answers an empty list, which is why this is
   * asked of whatever is selected rather than only of runs.
   */
  const proposed = useStore<{
    processId: string | null;
    documents: ProposedDocument[];
  }>({ processId: null, documents: [] });
  const undo = useSignal<{ label: string; tabs: TabsState } | null>(null);
  const attachment = useSignal<{ processId: string; text: string } | null>(
    null,
  );
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
  const newContext$ = $(() => {
    const index = tabs.tabs.length + 1;
    const itemId = `item-${index}`;
    const tab: Tab = {
      id: `context-${index}`,
      kind: "scene",
      title: `Context ${index}`,
      itemId,
      viewType: preferredView(preferred.value, itemId, "scene").id,
      selection: null,
      drawerContext: "scene",
      unsaved: false,
    };
    applyTabs$(openTab(tabs, tab));
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
            resolveView(tab.kind, viewId).view.name
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
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (response.ok) {
        const started = (await response.json()) as {
          runId: string;
          processId: string;
        };
        run.id = started.runId;
        run.processId = started.processId;
        run.events = [];
        if (field) field.value = "";
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
    const selected = track(() => registry.selectedId);
    proposed.processId = selected;
    proposed.documents = [];
    if (selected === null) return;

    const response = await fetch(`/api/processes/${selected}/proposals`);
    if (response.ok && registry.selectedId === selected) {
      proposed.documents = (await response.json()) as ProposedDocument[];
    }
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
      undo.value = { label: `Moved ${moving.title}`, tabs: previous };
      await save$(next, layout);
      return;
    }

    if (operation === "attach-to-command") {
      attachment.value = {
        processId: payload.itemId,
        text: payload.preview ?? payload.itemId,
      };
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
  const undoMove$ = $(async () => {
    const previous = undo.value?.tabs;
    undo.value = null;
    if (!previous) return;
    tabs.tabs = previous.tabs;
    tabs.activeTabId = previous.activeTabId;
    await save$(previous, layout);
  });
  /** Re-reads the listing the category renders. */
  const refreshLibrary$ = $(async () => {
    const response = await fetch("/api/documents");
    const outcome = (await response.json()) as
      { outcome: "success"; result: DocumentSummary[] } | { outcome: string };
    if (outcome.outcome !== "success") return;
    library.documents = (outcome as { result: DocumentSummary[] }).result;
    library.reads += 1;
  });
  /** Re-reads the episodes the second category renders. */
  const refreshEpisodes$ = $(async () => {
    const response = await fetch("/api/episodes");
    const outcome = (await response.json()) as
      { outcome: "success"; result: EpisodeSummary[] } | { outcome: string };
    if (outcome.outcome !== "success") return;
    library.episodes = (outcome as { result: EpisodeSummary[] }).result;
    library.reads += 1;
  });
  /**
   * Opens an episode in a tab. As with a document, `openTab` reveals a tab
   * already showing this episode rather than opening a second one.
   */
  const openEpisode$ = $(async (episodeId: string, title: string) => {
    const tab: Tab = {
      id: `episode-${episodeId}`,
      kind: "episode",
      title,
      itemId: episodeId,
      viewType: preferredView(preferred.value, episodeId, "episode").id,
      selection: null,
      drawerContext: "episode",
      unsaved: false,
    };
    await applyTabs$(openTab(tabs, tab));
  });
  const newEpisode$ = $(async () => {
    const response = await fetch("/api/episodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled episode" }),
    });
    const outcome = (await response.json()) as
      | { outcome: "success"; result: { episodeId: string } }
      | { outcome: string };
    if (outcome.outcome !== "success") return;
    const episodeId = (outcome as { result: { episodeId: string } }).result
      .episodeId;
    await openEpisode$(episodeId, "Untitled episode");
    await refreshEpisodes$();
  });
  const toggleEpisodes$ = $(async () => {
    const next = { ...layout, episodes: nextSectionState(layout.episodes) };
    layout.episodes = next.episodes;
    await save$(tabs, next);
  });
  const toggleStanding$ = $(async () => {
    const next = { ...layout, standing: nextSectionState(layout.standing) };
    layout.standing = next.standing;
    await save$(tabs, next);
  });
  const toggleDestinations$ = $(async () => {
    const next = {
      ...layout,
      destinations: nextSectionState(layout.destinations),
    };
    layout.destinations = next.destinations;
    await save$(tabs, next);
  });
  /**
   * Opens a destination's front. Its identity is the channel, because a front
   * is the destination's own document and no record here stands behind it.
   */
  const openFront$ = $(async (channel: string) => {
    const tab: Tab = {
      id: `front-${channel}`,
      kind: "front",
      title: `${channel} front`,
      itemId: channel,
      viewType: preferredView(preferred.value, channel, "front").id,
      selection: null,
      drawerContext: "front",
      unsaved: false,
    };
    await applyTabs$(openTab(tabs, tab));
  });
  /**
   * Opens a document in a tab. `openTab` reveals a tab already showing this
   * document rather than opening a second one, so activating an entry twice
   * lands on the same tab.
   */
  const openDocument$ = $(async (documentId: string, title: string) => {
    const tab: Tab = {
      id: `document-${documentId}`,
      kind: "document",
      title,
      itemId: documentId,
      viewType: preferredView(preferred.value, documentId, "document").id,
      selection: null,
      drawerContext: "document",
      unsaved: false,
    };
    await applyTabs$(openTab(tabs, tab));
  });
  /**
   * A new document, opened in its own tab. The graph owns the document; the
   * tab only names it, so this is a create followed by an ordinary open.
   */
  const newDocument$ = $(async () => {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled document" }),
    });
    const outcome = (await response.json()) as
      | { outcome: "success"; result: { documentId: string } }
      | { outcome: string };
    if (outcome.outcome !== "success") return;
    const documentId = (outcome as { result: { documentId: string } }).result
      .documentId;
    const tab: Tab = {
      id: `document-${documentId}`,
      kind: "document",
      title: "Untitled document",
      itemId: documentId,
      viewType: preferredView(preferred.value, documentId, "document").id,
      selection: null,
      drawerContext: "document",
      unsaved: false,
    };
    await applyTabs$(openTab(tabs, tab));
    await refreshLibrary$();
  });
  /**
   * Settings is a tab like any other. Its target is synthetic and instance-wide,
   * so `openTab` reveals an open settings tab rather than opening a second one
   * and the reveal rule needs no case of its own for a tab that is not content.
   */
  const openSettings$ = $(async () => {
    await applyTabs$(
      openTab(tabs, {
        id: `settings-${SETTINGS_TARGET}`,
        kind: "settings",
        title: "Settings",
        itemId: SETTINGS_TARGET,
        viewType: defaultViewFor("settings").id,
        selection: null,
        drawerContext: null,
        unsaved: false,
      }),
    );
  });
  const toggleLibrary$ = $(async () => {
    const next = { ...layout, library: nextSectionState(layout.library) };
    layout.library = next.library;
    await save$(tabs, next);
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
    raiseMessage$: $((next: Message) => {
      message.current = next;
    }),
    targetGone$: $(async (itemId: string) => {
      let next = tabs;
      for (const tab of tabs.tabs.filter((open) => open.itemId === itemId)) {
        next = closeTab(next, tab.id);
      }
      tabs.tabs = next.tabs;
      tabs.activeTabId = next.activeTabId;
      await save$(next, layout);
      await refreshLibrary$();
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
      await refreshLibrary$();
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

  const detail = registry.items.find(({ id }) => id === registry.selectedId);
  const active = activeTab(tabs);
  const activeView = active
    ? resolveView(active.kind, active.viewType).view
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
                        operations: resolveView(tab.kind, tab.viewType).view
                          .drag,
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
            <button
              type="button"
              class="tab-action"
              aria-label="Open context"
              onClick$={newContext$}
            >
              +
            </button>
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
              {side === "left" ? "◧" : "◨"}
            </button>
          ))}
          <button
            type="button"
            class="settings-control"
            aria-label="Settings"
            onClick$={() => openSettings$()}
          >
            ⚙
          </button>
          <ThemeToggle />
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
          <section
            class="library-category"
            aria-labelledby="library-documents"
            data-library="documents"
            data-state={layout.library}
          >
            <div class="library-category__header">
              <h2 class="library-category__heading">
                <button
                  type="button"
                  class="library-category__toggle"
                  id="library-documents"
                  aria-expanded={layout.library === "expanded"}
                  aria-controls="library-documents-list"
                  onClick$={toggleLibrary$}
                >
                  Documents
                </button>
              </h2>
              <button
                type="button"
                class="library-action"
                aria-label="New document"
                data-new-document
                onClick$={newDocument$}
              >
                +
              </button>
            </div>
            <div
              id="library-documents-list"
              class="library-category__body"
              hidden={layout.library === "collapsed"}
            >
              {library.documents.length === 0 ? (
                <p class="library-empty" data-library-empty>
                  No documents yet
                </p>
              ) : (
                <ul class="library-list" key={library.reads}>
                  {library.documents.map((document) => {
                    const current = active?.itemId === document.documentId;
                    return (
                      <li key={document.documentId}>
                        <button
                          type="button"
                          class="library-entry"
                          data-document-id={document.documentId}
                          data-current={current ? "true" : undefined}
                          aria-current={current ? "true" : undefined}
                          onClick$={() =>
                            openDocument$(document.documentId, document.title)
                          }
                        >
                          <span class="library-entry__label">
                            {document.title}
                          </span>
                          {/* The marker is the sighted reader's non-colour
                            signal. `aria-current` above already says the same
                            thing, so naming the marker too would append it to
                            the entry's name. */}
                          {current && (
                            <span
                              class="library-entry__marker"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section
            class="library-category"
            aria-labelledby="library-episodes"
            data-library="episodes"
            data-state={layout.episodes}
          >
            <div class="library-category__header">
              <h2 class="library-category__heading">
                <button
                  type="button"
                  class="library-category__toggle"
                  id="library-episodes"
                  aria-expanded={layout.episodes === "expanded"}
                  aria-controls="library-episodes-list"
                  onClick$={toggleEpisodes$}
                >
                  Episodes
                </button>
              </h2>
              <button
                type="button"
                class="library-action"
                aria-label="New episode"
                data-new-episode
                onClick$={newEpisode$}
              >
                +
              </button>
            </div>
            <div
              id="library-episodes-list"
              class="library-category__body"
              hidden={layout.episodes === "collapsed"}
            >
              {library.episodes.length === 0 ? (
                <p class="library-empty" data-library-empty="episodes">
                  No episodes yet
                </p>
              ) : (
                <ul class="library-list" key={library.reads}>
                  {library.episodes.map((episode) => {
                    const current = active?.itemId === episode.episodeId;
                    return (
                      <li key={episode.episodeId}>
                        <button
                          type="button"
                          class="library-entry"
                          data-episode-id={episode.episodeId}
                          data-current={current ? "true" : undefined}
                          aria-current={current ? "true" : undefined}
                          onClick$={() =>
                            openEpisode$(episode.episodeId, episode.title)
                          }
                        >
                          <span class="library-entry__label">
                            {episode.title}
                          </span>
                          {current && (
                            <span
                              class="library-entry__marker"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section
            class="library-category"
            aria-labelledby="library-standing"
            data-library="standing"
            data-state={layout.standing}
          >
            <div class="library-category__header">
              <h2 class="library-category__heading">
                <button
                  type="button"
                  class="library-category__toggle"
                  id="library-standing"
                  aria-expanded={layout.standing === "expanded"}
                  aria-controls="library-standing-list"
                  onClick$={toggleStanding$}
                >
                  Standing Assets
                </button>
              </h2>
            </div>
            <div
              id="library-standing-list"
              class="library-category__body"
              hidden={layout.standing === "collapsed"}
            >
              {library.standing.length === 0 ? (
                <p class="library-empty" data-library-empty="standing">
                  No standing assets yet
                </p>
              ) : (
                <ul class="library-list" key={library.reads}>
                  {library.standing.map((asset) => (
                    // Named and not opened: no view presents an asset on its
                    // own yet, and a control that opened nothing would say
                    // there is somewhere to go.
                    <li key={asset.assetId}>
                      <span
                        class="library-entry library-entry--inert"
                        data-asset-id={asset.assetId}
                      >
                        <span class="library-entry__label">
                          {asset.label ?? asset.role}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section
            class="library-category"
            aria-labelledby="library-destinations"
            data-library="destinations"
            data-state={layout.destinations}
          >
            <div class="library-category__header">
              <h2 class="library-category__heading">
                <button
                  type="button"
                  class="library-category__toggle"
                  id="library-destinations"
                  aria-expanded={layout.destinations === "expanded"}
                  aria-controls="library-destinations-list"
                  onClick$={toggleDestinations$}
                >
                  Destinations
                </button>
              </h2>
            </div>
            <div
              id="library-destinations-list"
              class="library-category__body"
              hidden={layout.destinations === "collapsed"}
            >
              {library.fronts.length === 0 ? (
                <p class="library-empty" data-library-empty="destinations">
                  No destination shows a front
                </p>
              ) : (
                <ul class="library-list" key={library.reads}>
                  {library.fronts.map((front) => {
                    const current = active?.itemId === front.channel;
                    return (
                      <li key={front.channel}>
                        <button
                          type="button"
                          class="library-entry"
                          data-front-channel={front.channel}
                          data-front-state={front.state}
                          data-current={current ? "true" : undefined}
                          aria-current={current ? "true" : undefined}
                          onClick$={() => openFront$(front.channel)}
                        >
                          <span class="library-entry__label">
                            {front.channel}
                          </span>
                          {current && (
                            <span
                              class="library-entry__marker"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
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
            <p>Open a story context to begin.</p>
          )}
          {active && viewsFor(active.kind).length > 1 && (
            <div
              class="view-choice"
              role="group"
              aria-label={`Views for ${active.title}`}
            >
              {viewsFor(active.kind)
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
          {detail ? (
            <div class="process-detail" data-process-id={detail.id}>
              <p class="eyebrow">Process</p>
              <h3>{detail.title}</h3>
              <p data-process-state={detail.state}>{detail.state}</p>
              <p data-process-step>{detail.step ?? "no step reported"}</p>
              {detail.error !== null && (
                <p class="process-error" data-process-error>
                  {detail.error}
                </p>
              )}
              {proposed.processId === detail.id && (
                <div class="proposed" data-proposed>
                  <p class="eyebrow">Proposed</p>
                  {proposed.documents.length === 0 ? (
                    <p data-proposed-none>This run proposed nothing.</p>
                  ) : (
                    <ul class="proposed__list">
                      {proposed.documents.map((document) => (
                        <li key={document.documentId}>
                          <button
                            type="button"
                            data-proposed-document={document.documentId}
                            onClick$={() =>
                              openDocument$(document.documentId, document.title)
                            }
                          >
                            {document.title}
                          </button>
                          <span data-proposed-unanswered>
                            {document.unanswered} unanswered
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {detail.state === "failed" &&
                (detail.acknowledged ? (
                  <p data-process-acknowledged>Failure acknowledged</p>
                ) : (
                  <button
                    type="button"
                    onClick$={() => acknowledge$(detail.id)}
                  >
                    Acknowledge failure
                  </button>
                ))}
            </div>
          ) : (
            <InspectorContribution
              bridge={bridge}
              declared={activeView?.inspector ?? "Workspace context"}
              viewId={activeView?.id}
            />
          )}
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
          <DockActions dock={dock} />
          <div
            class="composer"
            data-drop-target="composer"
            data-accepts="attach-to-command process-input"
            data-drop-active={drag.overId === "composer" ? "true" : undefined}
          >
            <label for="command">Command</label>
            <textarea id="command" placeholder="Ask Calliopa or add context" />
            <button type="button" onClick$={sendGoal$} disabled={run.sending}>
              Run
            </button>
            {run.notice !== null && (
              <p class="composer__notice" role="status" data-run-notice>
                {run.notice}
              </p>
            )}
            {attachment.value && (
              <p
                class="attachment"
                data-attached-process={attachment.value.processId}
              >
                {attachment.value.text}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick$={() => (attachment.value = null)}
                >
                  ×
                </button>
              </p>
            )}
          </div>
          {undo.value && (
            <p class="undo" data-undo>
              {undo.value.label}
              <button type="button" onClick$={undoMove$}>
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
            {registry.items.length === 0 ? (
              <p>No running processes</p>
            ) : (
              <ul class="process-list" aria-label="Processes">
                {registry.items.map((process) => (
                  <li key={process.id}>
                    <button
                      type="button"
                      class={{
                        "process-entry": true,
                        "process-entry--selected":
                          process.id === registry.selectedId,
                      }}
                      data-process-id={process.id}
                      data-state={process.state}
                      onPointerDown$={(event) =>
                        startDrag$(
                          {
                            itemId: process.id,
                            kind: "process-result",
                            source: "dock",
                            operations: ["attach-to-command", "process-input"],
                            preview: process.title,
                          },
                          event,
                        )
                      }
                      onClick$={() => (registry.selectedId = process.id)}
                    >
                      {describeProcess(process)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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

/**
 * What the inspector says for the active view: the view's own live
 * contribution when it has one, and its declared contribution otherwise.
 *
 * Its own component so that a view updating its contribution re-renders the
 * inspector alone. Re-rendering the shell for it would re-render the view too,
 * which for an editing surface means rebuilding the element under the caret.
 */
const InspectorContribution = component$<{
  bridge: ViewBridge;
  declared: string;
  viewId: string | undefined;
}>(({ bridge, declared, viewId }) => {
  const { facts, actions, text } = bridge.inspector;
  if (facts.length === 0 && actions.length === 0) {
    return <p data-view-inspector={viewId}>{text ?? declared}</p>;
  }
  return (
    <div class="view-inspector" data-view-inspector={viewId}>
      {facts.length > 0 && (
        <dl class="inspector-facts">
          {facts.map((fact) => (
            <div key={fact.label} class="inspector-fact">
              <dt>{fact.label}</dt>
              <dd data-inspector-fact={fact.kind}>
                <InspectorFactValue fact={fact} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actions.length > 0 && (
        <div class="inspector-actions">
          {actions.map((action) =>
            action.kind === "toggle" ? (
              <button
                key={action.id}
                type="button"
                data-inspector-action={action.id}
                aria-pressed={action.on}
                onClick$={() => action.run$(!action.on)}
              >
                {action.label}
              </button>
            ) : (
              <button
                key={action.id}
                type="button"
                data-inspector-action={action.id}
                data-destructive={action.destructive === true ? "" : undefined}
                onClick$={() => action.run$()}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
});

/**
 * The one action the active view contributes to the command dock.
 *
 * Its own component for the reason the inspector's contribution is one: a view
 * updating what it offers re-renders this alone, and re-rendering the shell
 * would rebuild the mounted view, which for an editing surface means rebuilding
 * the element under the caret.
 *
 * A view that contributes nothing renders nothing, so the dock keeps the shape
 * it has for every view that offers no action of its own.
 */
const DockActions = component$<{ dock: ViewDock }>(({ dock }) => {
  const action = dock.action;
  if (action === null) return null;
  return (
    <div class="dock-actions" aria-label="View commands">
      {action.kind === "toggle" ? (
        <button
          type="button"
          data-dock-action={action.id}
          aria-pressed={action.on}
          onClick$={() => action.run$(!action.on)}
        >
          {action.label}
        </button>
      ) : (
        <button
          type="button"
          data-dock-action={action.id}
          data-destructive={action.destructive === true ? "" : undefined}
          onClick$={() => action.run$()}
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

/**
 * How the shell reads each fact a view contributes.
 *
 * A time renders as an absolute value in a `time` element carrying the
 * machine-readable stamp. A relative age in a drawer that sits open would have
 * to keep itself current, and one that stopped ticking would state something
 * false; a static absolute value cannot go stale.
 */
const InspectorFactValue = component$<{ fact: InspectorFact }>(({ fact }) => {
  if (fact.kind === "saveState") {
    return <span data-save-state={fact.value}>{SAVE_WORD[fact.value]}</span>;
  }
  if (fact.kind === "time") {
    return <time dateTime={fact.value}>{readableTime(fact.value)}</time>;
  }
  return <span>{String(fact.value)}</span>;
});

/** An absolute moment a reader can take in at a glance. An unparseable stamp
 * reads as itself rather than as `Invalid Date`. */
function readableTime(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SAVE_WORD: Readonly<Record<SaveState, string>> = {
  saving: "Saving",
  saved: "Saved",
  unsaved: "Unsaved",
};

/**
 * The active tab's save state, in the header.
 *
 * Its own component for the reason the inspector contribution is one: a save
 * state changing must not re-render the shell, because re-rendering the shell
 * rebuilds the mounted view, and for an editing surface that means rebuilding
 * the element the caret is in. A view that reports nothing renders nothing.
 */
const SaveStatus = component$<{ save: ViewSave }>(({ save }) =>
  save.state === null ? null : (
    <p
      class="save-status"
      role="status"
      aria-label="Save state"
      data-save-status={save.state}
    >
      {SAVE_WORD[save.state]}
    </p>
  ),
);
