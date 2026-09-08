import { describe, expect, it } from "vitest";
import { sectionState } from "~/lib/layout";
import { migrateTabKind } from "~/lib/tabs";
import { DEFAULT_WORKSPACE_STATE } from "~/lib/workspace";
import { HttpError } from "./http-error";
import { parseWorkspaceState } from "./workspaces";

/** A document tab as the shell stores one; the default state opens none (BO_0203_005). */
const documentTab = {
  id: "t",
  kind: "ui.shell:document",
  title: "Untitled",
  itemId: "x",
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
};

describe("workspace input", () => {
  it("Given the default state, Then it validates, opens no tab, and adds no ephemeral scroll", () => {
    expect(parseWorkspaceState(DEFAULT_WORKSPACE_STATE)).toEqual(DEFAULT_WORKSPACE_STATE);
    expect(DEFAULT_WORKSPACE_STATE.tabs).toEqual([]);
    const state = parseWorkspaceState({ ...DEFAULT_WORKSPACE_STATE, tabs: [{ ...documentTab, scroll: 12 }], activeTabId: "t" });
    expect(state.tabs[0]).not.toHaveProperty("scroll");
  });

  it("Given a tab stored before view types, Then it opens in its kind's default", () => {
    const { viewType: _dropped, ...withoutView } = documentTab;
    const state = parseWorkspaceState({ ...DEFAULT_WORKSPACE_STATE, tabs: [withoutView], activeTabId: "t" });
    expect(state.tabs[0]?.viewType).toBe("block-editor");
  });

  it("Given an unknown view identifier, Then it is kept for the visible fallback", () => {
    const state = parseWorkspaceState({
      ...DEFAULT_WORKSPACE_STATE,
      tabs: [{ ...documentTab, viewType: "retired-view" }],
      activeTabId: "t",
    });
    expect(state.tabs[0]?.viewType).toBe("retired-view");
  });

  it("Given preferred views, Then string entries survive and others are rejected", () => {
    expect(
      parseWorkspaceState({
        ...DEFAULT_WORKSPACE_STATE,
        preferredViews: { "placeholder-scene": "outline" },
      }).preferredViews,
    ).toEqual({ "placeholder-scene": "outline" });
    expect(
      parseWorkspaceState({ ...DEFAULT_WORKSPACE_STATE, preferredViews: undefined })
        .preferredViews,
    ).toEqual({});
    expect(() =>
      parseWorkspaceState({
        ...DEFAULT_WORKSPACE_STATE,
        preferredViews: { "placeholder-scene": 7 },
      }),
    ).toThrow(HttpError);
  });

  it("Given invalid layout or active tab data, Then validation rejects it", () => {
    expect(() =>
      parseWorkspaceState({ ...DEFAULT_WORKSPACE_STATE, activeTabId: "missing" }),
    ).toThrow(HttpError);
    expect(() =>
      parseWorkspaceState({
        ...DEFAULT_WORKSPACE_STATE,
        layout: { ...DEFAULT_WORKSPACE_STATE.layout, dock: "floating" },
      }),
    ).toThrow(HttpError);
    expect(() =>
      parseWorkspaceState({
        ...DEFAULT_WORKSPACE_STATE,
        tabs: [{ ...DEFAULT_WORKSPACE_STATE.tabs[0]!, viewType: 7 }],
      }),
    ).toThrow(HttpError);
  });
});

describe("a workspace's section states", () => {
  const withLayout = (layout: Record<string, unknown>): unknown => ({
    ...DEFAULT_WORKSPACE_STATE,
    layout: { ...DEFAULT_WORKSPACE_STATE.layout, ...layout },
  });

  it("Given a layout stored before sections were keyed, Then its named fields become keys", () => {
    // The one migration BO_0202_003 names, applied on read: the five fields a
    // layout carried become the keys the registry names for those sections.
    const parsed = parseWorkspaceState(
      withLayout({
        sections: undefined,
        library: "collapsed",
        episodes: "expanded",
        standing: "collapsed",
        destinations: "expanded",
        extensions: "collapsed",
      }),
    );
    expect(parsed.layout.sections).toEqual({
      "ui.shell:documents": "collapsed",
      "calliopa-video:episodes": "expanded",
      "calliopa-video:standing": "collapsed",
      "calliopa-video:destinations": "expanded",
      "ui.shell:extensions": "collapsed",
    });
    expect(parsed.layout).not.toHaveProperty("library");
  });

  it("Given a key whose extension is absent, Then it is preserved untouched", () => {
    const parsed = parseWorkspaceState(
      withLayout({ sections: { "some-extension:things": "collapsed" } }),
    );
    expect(parsed.layout.sections["some-extension:things"]).toBe("collapsed");
  });

  it("Given the keys ui.shell held for one pin, Then they read as calliopa-video's", () => {
    const parsed = parseWorkspaceState(
      withLayout({ sections: { "ui.shell:episodes": "collapsed", "ui.shell:documents": "collapsed" } }),
    );
    expect(parsed.layout.sections).toEqual({
      "calliopa-video:episodes": "collapsed",
      "ui.shell:documents": "collapsed",
    });
  });

  it("Given a layout carrying no section state at all, Then a section reads expanded when asked", () => {
    const parsed = parseWorkspaceState(withLayout({ sections: {} }));
    expect(parsed.layout.sections).toEqual({});
    expect(sectionState(parsed.layout, "ui.shell:documents")).toBe("expanded");
  });

  it("Given a section state outside the vocabulary, Then it is refused rather than defaulted", () => {
    expect(() => parseWorkspaceState(withLayout({ sections: { "ui.shell:episodes": "torn-off" } }))).toThrow(
      HttpError,
    );
    expect(() => parseWorkspaceState(withLayout({ episodes: "torn-off" }))).toThrow(HttpError);
  });
});

describe("a tab's kind", () => {
  const withTab = (kind: string): unknown => ({
    ...DEFAULT_WORKSPACE_STATE,
    tabs: [{ ...documentTab, kind }],
    activeTabId: "t",
  });

  it("Given a kind stored before kinds were qualified, Then it is rewritten to its extension's", () => {
    expect(parseWorkspaceState(withTab("document")).tabs[0]?.kind).toBe("ui.shell:document");
    expect(parseWorkspaceState(withTab("settings")).tabs[0]?.kind).toBe("settings:settings");
  });

  it("Given a kind nothing contributes, Then the tab is dropped and the active tab moves on", () => {
    // Absence tolerates what it finds (BO_0203_006): the workspace keeps
    // working without the tab, and nothing else is touched.
    const stored = withTab("ui.shell:document") as { tabs: Record<string, unknown>[]; activeTabId: string };
    stored.tabs = [{ ...stored.tabs[0], id: "gone", kind: "some-extension:thing", itemId: "y" }, stored.tabs[0]!];
    stored.activeTabId = "gone";
    const state = parseWorkspaceState(stored);
    expect(state.tabs.map((tab) => tab.id)).toEqual(["t"]);
    expect(state.activeTabId).toBe("t");
  });

  it("Given the kinds ui.shell held for one pin, Then they are read as calliopa-video's before the build is asked", () => {
    // The rewrite is pure and holds whether or not the extension is present;
    // what the parser does with the result — keep the tab, or drop it for an
    // absent extension — is the tolerate rule's, tested above.
    expect(migrateTabKind("ui.shell:episode")).toBe("calliopa-video:episode");
    expect(migrateTabKind("front")).toBe("calliopa-video:front");
    expect(migrateTabKind("document")).toBe("ui.shell:document");
  });

  it("Given a tab with no view, Then it opens in its kind's default from the registry", () => {
    const stored = withTab("document") as { tabs: Record<string, unknown>[] };
    delete stored.tabs[0]?.["viewType"];
    expect(parseWorkspaceState(stored).tabs[0]?.viewType).toBe("block-editor");
  });
});
