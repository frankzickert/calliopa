import type { Tab } from "./tabs";

/**
 * Which process each tab's inspector shows. A process looked at on one tab
 * never takes another tab's inspector, because each tab keeps its own drawer
 * context (`docs/system/workspace/tabs.md`). The empty workspace holds its
 * own while no tab is open.
 *
 * Held in the page and never in the workspace record: process detail is
 * transient, so a reload starts with nothing selected. Not the tab's
 * `drawerContext` either, which the record saves. CA_0040_001
 */
export interface ProcessSelection {
  /** The selected process by tab id. */
  readonly byTab: Readonly<Record<string, string>>;
  /** The empty workspace's own. */
  readonly noTab: string | null;
}

export const NO_SELECTION: ProcessSelection = { byTab: {}, noTab: null };

/** The process the given tab's inspector shows, or `null` for its view's contribution. */
export function selectedProcess(
  selection: ProcessSelection,
  tabId: string | null,
): string | null {
  return tabId === null ? selection.noTab : (selection.byTab[tabId] ?? null);
}

/**
 * A press on a console row: it selects that process for the tab, and a
 * second press on the row already selected lets it go. CA_0040_003
 */
export function pressProcess(
  selection: ProcessSelection,
  tabId: string | null,
  processId: string,
): ProcessSelection {
  const next =
    selectedProcess(selection, tabId) === processId ? null : processId;
  return withSelected(selection, tabId, next);
}

/** The tab's selection let go, so its view's contribution shows. CA_0040_002 */
export function releaseProcess(
  selection: ProcessSelection,
  tabId: string | null,
): ProcessSelection {
  return withSelected(selection, tabId, null);
}

/**
 * The selection without the entries of tabs no longer open, so a tab opened
 * again on the same target starts with nothing selected. Answers the same
 * object when nothing is dropped, which lets a caller that stores the answer
 * skip a write that would change nothing.
 */
export function keepOpenTabs(
  selection: ProcessSelection,
  tabs: readonly Pick<Tab, "id">[],
): ProcessSelection {
  const open = new Set(tabs.map((tab) => tab.id));
  const kept = Object.entries(selection.byTab).filter(([tabId]) =>
    open.has(tabId),
  );
  if (kept.length === Object.keys(selection.byTab).length) return selection;
  return { byTab: Object.fromEntries(kept), noTab: selection.noTab };
}

function withSelected(
  selection: ProcessSelection,
  tabId: string | null,
  processId: string | null,
): ProcessSelection {
  if (tabId === null) return { byTab: selection.byTab, noTab: processId };
  const byTab = Object.fromEntries(
    Object.entries(selection.byTab).filter(([id]) => id !== tabId),
  );
  if (processId !== null) byTab[tabId] = processId;
  return { byTab, noTab: selection.noTab };
}
