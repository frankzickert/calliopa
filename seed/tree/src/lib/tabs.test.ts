import { describe, expect, it } from "vitest";
import { EMPTY_TABS, activeTab, closeAllTabs, closeTab, moveTab, neighbourTab, openAlongRoute, openTab, openTabBeside, routeOf, selectTab, tabsBeside, type Tab, updateTab, withoutReplays } from "./tabs";

const tab = (
  id: string,
  itemId: string | null = null,
  viewType = "context",
): Tab => ({
  id,
  kind: "scene",
  title: id,
  itemId,
  viewType,
  selection: null,
  drawerContext: null,
  unsaved: false,
});
const three = openTab(
  openTab(openTab(EMPTY_TABS, tab("a")), tab("b")),
  tab("c"),
);

describe("tab operations", () => {
  it("opens a context or selects the matching open item", () => {
    expect(activeTab(openTab(EMPTY_TABS, tab("a")))?.id).toBe("a");
    const state = openTab(openTab(EMPTY_TABS, tab("a", "scene-1")), tab("b"));
    expect(openTab(state, tab("c", "scene-1"))).toMatchObject({
      activeTabId: "a",
      tabs: state.tabs,
    });
  });

  it("opens another tab for the same target in a different view", () => {
    const state = openTab(EMPTY_TABS, tab("a", "scene-1", "context"));
    const both = openTab(state, tab("c", "scene-1", "outline"));
    expect(both.tabs.map(({ id }) => id)).toEqual(["a", "c"]);
    expect(both.activeTabId).toBe("c");
    expect(openTab(both, tab("d", "scene-1", "outline")).activeTabId).toBe("c");
  });

  it("selects, closes, and chooses the nearest remaining context", () => {
    expect(selectTab(three, "a").activeTabId).toBe("a");
    expect(selectTab(three, "missing")).toBe(three);
    expect(closeTab(selectTab(three, "b"), "b").activeTabId).toBe("c");
    expect(closeTab(three, "c").activeTabId).toBe("b");
  });

  it("closes every tab at once, and leaves an empty strip as it is", () => {
    expect(closeAllTabs(three)).toEqual({ tabs: [], activeTabId: null });
    expect(closeAllTabs(openTab(EMPTY_TABS, tab("a")))).toEqual(EMPTY_TABS);
    expect(closeAllTabs(EMPTY_TABS)).toBe(EMPTY_TABS);
  });

  it("reorders before a target or to the end", () => {
    expect(moveTab(three, "c", "a").tabs.map(({ id }) => id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(moveTab(three, "a", null).tabs.map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("updates durable context fields without introducing scroll state", () => {
    const state = updateTab(three, "b", {
      selection: "beat-2",
      drawerContext: "notes",
      unsaved: true,
    });
    expect(state.tabs[1]).toMatchObject({
      selection: "beat-2",
      drawerContext: "notes",
      unsaved: true,
    });
    expect(state.tabs[1]).not.toHaveProperty("scroll");
  });
});

describe("a tab's route", () => {
  const tab = {
    id: "t1",
    kind: "documents:document" as const,
    title: "Caching",
    itemId: "doc-1",
    viewType: "block-editor",
    selection: "sel",
    drawerContext: null,
    unsaved: true,
  };

  it("reads as a route of one, the tab's own target, when the tab carries none", () => {
    expect(routeOf(tab)).toEqual([{ itemId: "doc-1", title: "Caching" }]);
    expect(routeOf(tab, "Renamed")).toEqual([{ itemId: "doc-1", title: "Renamed" }]);
    expect(routeOf({ ...tab, route: [{ itemId: "doc-0", title: "Roots" }, { itemId: "doc-1", title: "Caching" }] })).toHaveLength(2);
  });

  const other = { ...tab, id: "t9", itemId: "doc-9", title: "Elsewhere", selection: null, unsaved: false };
  const child = {
    itemId: "doc-2",
    title: "Focused",
    route: [{ itemId: "doc-1", title: "Caching", blockId: "blk-a" }, { itemId: "doc-2", title: "Focused" }],
  };

  it("opens focused work in a tab of its own right after the parent's, carrying the route, and leaves the parent's tab as it was", () => {
    const next = openAlongRoute({ tabs: [tab, other], activeTabId: "t1" }, child);
    expect(next.tabs.map((entry) => entry.itemId)).toEqual(["doc-1", "doc-2", "doc-9"]);
    expect(next.tabs[0]).toEqual(tab);
    expect(next.tabs[1]).toMatchObject({ id: "documents:document-doc-2", kind: "documents:document", viewType: "block-editor", title: "Focused", selection: null, unsaved: false });
    expect(next.tabs[1]?.route?.map((entry) => entry.itemId)).toEqual(["doc-1", "doc-2"]);
    expect(next.activeTabId).toBe("documents:document-doc-2");
  });

  it("makes a tab already showing the document active as it stands, its own route kept, instead of opening a second", () => {
    const open = { ...tab, id: "t2", itemId: "doc-2", title: "Focused", route: [{ itemId: "doc-2", title: "Focused" }] };
    const state = { tabs: [tab, open], activeTabId: "t1" };
    const next = openAlongRoute(state, child);
    expect(next.tabs).toEqual(state.tabs);
    expect(next.activeTabId).toBe("t2");
  });

  it("goes back to a parent open in a tab without changing either tab, and opens it beside the child when it is open in none", () => {
    const inChild = { ...tab, id: "t2", itemId: "doc-2", title: "Focused", route: child.route };
    const parent = { itemId: "doc-1", title: "Caching", route: [{ itemId: "doc-1", title: "Caching", blockId: "blk-a" }] };
    const both = { tabs: [tab, inChild], activeTabId: "t2" };
    const back = openAlongRoute(both, parent);
    expect(back.tabs).toEqual(both.tabs);
    expect(back.activeTabId).toBe("t1");
    const alone = openAlongRoute({ tabs: [inChild], activeTabId: "t2" }, parent);
    expect(alone.tabs.map((entry) => entry.itemId)).toEqual(["doc-2", "doc-1"]);
    expect(alone.tabs[0]).toEqual(inChild);
    expect(alone.activeTabId).toBe(alone.tabs[1]?.id);
  });

  it("gives another view of a document its own id, so two tabs never share one", () => {
    const table = { ...tab, id: "documents:document-doc-2", itemId: "doc-2", viewType: "table" };
    const next = openAlongRoute({ tabs: [tab, table], activeTabId: "t1" }, child);
    expect(new Set(next.tabs.map((entry) => entry.id)).size).toBe(3);
  });
});

describe("the one tab on the phone's Minimum header", () => {
  const make = (id: string) => ({
    id,
    kind: "documents:document" as const,
    title: id,
    itemId: id,
    viewType: "block-editor",
    selection: null,
    drawerContext: null,
    unsaved: false,
  });
  const three = (active: string | null) => ({ tabs: [make("a"), make("b"), make("c")], activeTabId: active });

  it("counts the tabs before and after the active one", () => {
    expect(tabsBeside(three("a"))).toEqual({ before: 0, after: 2 });
    expect(tabsBeside(three("b"))).toEqual({ before: 1, after: 1 });
    expect(tabsBeside(three("c"))).toEqual({ before: 2, after: 0 });
    expect(tabsBeside(three(null))).toEqual({ before: 0, after: 0 });
  });

  it("steps to a neighbour and stops at either end without wrapping", () => {
    expect(neighbourTab(three("b"), 1).activeTabId).toBe("c");
    expect(neighbourTab(three("b"), -1).activeTabId).toBe("a");
    expect(neighbourTab(three("c"), 1).activeTabId).toBe("c");
    expect(neighbourTab(three("a"), -1).activeTabId).toBe("a");
    expect(neighbourTab(three(null), 1).activeTabId).toBeNull();
  });
});

describe("a tab opened by a held drag", () => {
  it("opens a new tab directly after the active one, and reveals a tab already open where it stands", () => {
    const onFirst = selectTab(openTab(openTab(openTab(EMPTY_TABS, tab("a", "doc-a")), tab("b", "doc-b")), tab("c", "doc-c")), "a");
    const opened = openTabBeside(onFirst, tab("d", "doc-d"));
    expect(opened.tabs.map((each) => each.id)).toEqual(["a", "d", "b", "c"]);
    expect(opened.activeTabId).toBe("d");
    const revealed = openTabBeside(onFirst, tab("x", "doc-c"));
    expect(revealed.tabs.map((each) => each.id)).toEqual(["a", "b", "c"]);
    expect(revealed.activeTabId).toBe("c");
    expect(openTabBeside(EMPTY_TABS, tab("a", "doc-a")).activeTabId).toBe("a");
  });
});

describe("a replay's tab", () => {
  it("Given a document's own tab, Then its replay opens a tab of its own, and the workspace record keeps neither the replay tab nor it as active", () => {
    const own = tab("doc", "doc-1", "block-editor");
    const replay: Tab = { ...own, id: "replay-tab-r1", replay: "r1" };
    const opened = openTabBeside(openTab(EMPTY_TABS, own), replay);
    expect(opened.tabs.map((entry) => entry.id)).toEqual(["doc", "replay-tab-r1"]);
    expect(opened.activeTabId).toBe("replay-tab-r1");
    expect(withoutReplays(opened)).toEqual({ tabs: [own], activeTabId: "doc" });
    expect(withoutReplays(openTab(EMPTY_TABS, replay))).toEqual({ tabs: [], activeTabId: null });
    const later = openTab(opened, tab("later"));
    expect(withoutReplays(later).activeTabId).toBe("later");
    expect(withoutReplays(three)).toBe(three);
  });
});
