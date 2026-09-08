/**
 * A tab kind is a string qualified by the extension that contributes it —
 * `ui.shell:document`, `settings:settings` — so a collision is impossible
 * rather than caught (`BO_0202_004`). The frame's one kind of its own stays
 * bare: `process-result`, which the process registry owns. The story-development
 * placeholders that stood beside it were dropped with `BO_0203_005`. What kinds
 * exist is the registry's answer, `src/registry.gen.ts`; this module only
 * names the host's.
 */
export type TabKind = string;

export const HOST_KINDS = ["process-result"] as const;

/**
 * The kinds stored before they were qualified, and what each became, plus the
 * kinds `ui.shell` held for one pin before they became `calliopa-video`'s
 * (`BO_0203_006`). A tab or a process item read back with one of these is
 * rewritten on the way in, so a workspace saved before opens unchanged; the
 * next save stores the current kind.
 */
export const LEGACY_TAB_KINDS: Readonly<Record<string, string>> = {
  document: "ui.shell:document",
  episode: "calliopa-video:episode",
  front: "calliopa-video:front",
  extension: "ui.shell:extension",
  settings: "settings:settings",
  "ui.shell:episode": "calliopa-video:episode",
  "ui.shell:front": "calliopa-video:front",
};

export function migrateTabKind(kind: string): string {
  return LEGACY_TAB_KINDS[kind] ?? kind;
}

/**
 * A tab's target is its item identity and item kind. The view type presenting
 * that target is a third, independent field: a tab never changes its view in
 * place, because choosing another view opens another tab.
 */
export interface Tab {
  readonly id: string;
  readonly kind: TabKind;
  readonly title: string;
  readonly itemId: string | null;
  readonly viewType: string;
  readonly selection: string | null;
  readonly drawerContext: string | null;
  readonly unsaved: boolean;
}

export interface TabsState {
  tabs: readonly Tab[];
  activeTabId: string | null;
}

export const EMPTY_TABS: TabsState = { tabs: [], activeTabId: null };

export function activeTab(state: TabsState): Tab | undefined {
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

export function openTab(state: TabsState, tab: Tab): TabsState {
  const existing = state.tabs.find(
    (candidate) =>
      tab.itemId !== null &&
      candidate.itemId === tab.itemId &&
      candidate.kind === tab.kind &&
      candidate.viewType === tab.viewType,
  );
  return existing
    ? { ...state, activeTabId: existing.id }
    : { tabs: [...state.tabs, tab], activeTabId: tab.id };
}

export function selectTab(state: TabsState, id: string): TabsState {
  return state.tabs.some((tab) => tab.id === id)
    ? { ...state, activeTabId: id }
    : state;
}

export function closeTab(state: TabsState, id: string): TabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== id);
  if (state.activeTabId !== id) return { tabs, activeTabId: state.activeTabId };
  return { tabs, activeTabId: (tabs[index] ?? tabs[index - 1])?.id ?? null };
}

export function moveTab(
  state: TabsState,
  id: string,
  beforeId: string | null,
): TabsState {
  const moving = state.tabs.find((tab) => tab.id === id);
  if (!moving || id === beforeId) return state;
  const rest = state.tabs.filter((tab) => tab.id !== id);
  const index =
    beforeId === null
      ? rest.length
      : rest.findIndex((tab) => tab.id === beforeId);
  if (index < 0) return state;
  return {
    ...state,
    tabs: [...rest.slice(0, index), moving, ...rest.slice(index)],
  };
}

export function updateTab(
  state: TabsState,
  id: string,
  patch: Partial<Omit<Tab, "id" | "kind" | "itemId" | "viewType">>,
): TabsState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
  };
}
