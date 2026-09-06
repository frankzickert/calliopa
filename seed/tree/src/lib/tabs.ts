export const TAB_KINDS = [
  "document",
  "episode",
  // A destination's front. Its identity is the channel, because a front is the
  // destination's own document and no record here stands behind it.
  "front",
  // Instance chrome rather than content: a settings tab resolves to nothing in
  // the graph, and its target is synthetic so a tab is still found by one.
  "settings",
  "script",
  "scene",
  "storyboard",
  "media",
  "timeline",
  "process-result",
] as const;
export type TabKind = (typeof TAB_KINDS)[number];

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
