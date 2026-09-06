import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_STATE } from "~/lib/workspace";
import { HttpError } from "./http-error";
import { parseWorkspaceState } from "./workspaces";

describe("workspace input", () => {
  it("Given the default state, Then it validates without adding ephemeral scroll", () => {
    expect(parseWorkspaceState(DEFAULT_WORKSPACE_STATE)).toEqual(DEFAULT_WORKSPACE_STATE);
    expect(parseWorkspaceState(DEFAULT_WORKSPACE_STATE).tabs[0]).not.toHaveProperty("scroll");
  });

  it("Given a tab stored before view types, Then it opens in its kind's default", () => {
    const [stored] = DEFAULT_WORKSPACE_STATE.tabs;
    const { viewType: _dropped, ...withoutView } = stored!;
    const state = parseWorkspaceState({
      ...DEFAULT_WORKSPACE_STATE,
      tabs: [withoutView],
      activeTabId: withoutView.id,
    });
    expect(state.tabs[0]?.viewType).toBe("context");
  });

  it("Given an unknown view identifier, Then it is kept for the visible fallback", () => {
    const [stored] = DEFAULT_WORKSPACE_STATE.tabs;
    const state = parseWorkspaceState({
      ...DEFAULT_WORKSPACE_STATE,
      tabs: [{ ...stored!, viewType: "retired-view" }],
      activeTabId: stored!.id,
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

describe("a workspace stored before a library category existed", () => {
  /** The real default layout with some section states dropped, so the fixture
   * cannot drift from the drawer and dock vocabulary it is not testing. */
  const storedWithout = (...dropped: readonly string[]): unknown => {
    const layout: Record<string, unknown> = { ...DEFAULT_WORKSPACE_STATE.layout };
    for (const name of dropped) delete layout[name];
    return { ...DEFAULT_WORKSPACE_STATE, layout };
  };

  it("Given a layout carrying no episodes state, Then the category arrives expanded", () => {
    const stored = storedWithout("episodes") as {
      layout: Record<string, unknown>;
    };
    stored.layout["library"] = "collapsed";

    const parsed = parseWorkspaceState(stored);
    expect(parsed.layout.episodes).toBe("expanded");
    // The state it did carry is kept rather than reset alongside the default.
    expect(parsed.layout.library).toBe("collapsed");
  });

  it("Given a layout carrying no section state at all, Then both categories arrive expanded", () => {
    const parsed = parseWorkspaceState(storedWithout("library", "episodes"));
    expect(parsed.layout.library).toBe("expanded");
    expect(parsed.layout.episodes).toBe("expanded");
  });

  it("Given a section state outside the vocabulary, Then it is refused rather than defaulted", () => {
    const stored = storedWithout() as { layout: Record<string, unknown> };
    stored.layout["episodes"] = "torn-off";
    expect(() => parseWorkspaceState(stored)).toThrow(HttpError);
  });
});
