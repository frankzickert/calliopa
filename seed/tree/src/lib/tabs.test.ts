import { describe, expect, it } from "vitest";
import { EMPTY_TABS, activeTab, closeTab, moveTab, openTab, retargetTab, routeOf, selectTab, type Tab, updateTab } from "./tabs";

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

  it("retargets a tab in place, keeping its identity and view and dropping the old target's selection and unsaved state", () => {
    const state = { tabs: [tab], activeTabId: "t1" };
    const next = retargetTab(state as never, "t1", {
      itemId: "doc-2",
      title: "Focused",
      route: [{ itemId: "doc-1", title: "Caching", blockId: "blk-a" }, { itemId: "doc-2", title: "Focused" }],
    });
    expect(next.tabs[0]).toMatchObject({ id: "t1", itemId: "doc-2", title: "Focused", viewType: "block-editor", selection: null, unsaved: false });
    expect(next.tabs[0]?.route?.map((entry) => entry.itemId)).toEqual(["doc-1", "doc-2"]);
  });
});
