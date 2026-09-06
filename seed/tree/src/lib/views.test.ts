import { describe, expect, it } from "vitest";
import { TAB_KINDS } from "./tabs";
import {
  DEFAULT_VIEWS,
  defaultViewFor,
  findView,
  preferredView,
  rememberView,
  resolveView,
  VIEW_TYPES,
  viewsFor,
} from "./views";

describe("the built-in registry", () => {
  it("declares a default view for every target kind", () => {
    for (const kind of TAB_KINDS) {
      expect(defaultViewFor(kind).targetKinds).toContain(kind);
    }
  });

  it("gives every registered view a unique identifier", () => {
    const ids = VIEW_TYPES.map((view) => view.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists only the views compatible with a target kind", () => {
    expect(viewsFor("script").map((view) => view.id)).toEqual([
      "context",
      "outline",
    ]);
    expect(viewsFor("media").map((view) => view.id)).toEqual(["context"]);
  });

  it("does not know an unregistered identifier", () => {
    expect(findView("retired-view")).toBeUndefined();
  });

  it("falls back when a target kind's declared default cannot present it", () => {
    expect(DEFAULT_VIEWS.media).toBe("context");
    expect(defaultViewFor("media").id).toBe("context");
  });
});

describe("resolving a tab's view", () => {
  it("mounts a registered compatible view unchanged", () => {
    expect(resolveView("script", "outline")).toEqual({
      view: findView("outline"),
      requested: "outline",
      unsupported: false,
    });
  });

  it("falls back visibly when the identifier is unknown", () => {
    const resolution = resolveView("script", "retired-view");
    expect(resolution.unsupported).toBe(true);
    expect(resolution.requested).toBe("retired-view");
    expect(resolution.view.id).toBe("context");
  });

  it("falls back when a known view cannot present this target kind", () => {
    const resolution = resolveView("media", "outline");
    expect(resolution.unsupported).toBe(true);
    expect(resolution.view.id).toBe("context");
  });
});

describe("remembering a target's view", () => {
  it("reuses the remembered view when it still supports the target", () => {
    expect(preferredView({ scene: "outline" }, "scene", "scene").id).toBe(
      "outline",
    );
  });

  it("uses the kind default when nothing is remembered", () => {
    expect(preferredView({}, "scene", "scene").id).toBe("context");
  });

  it("uses the kind default when the remembered view is gone", () => {
    expect(preferredView({ scene: "retired-view" }, "scene", "scene").id).toBe(
      "context",
    );
  });

  it("uses the kind default when the remembered view cannot present it", () => {
    expect(preferredView({ clip: "outline" }, "clip", "media").id).toBe(
      "context",
    );
  });

  it("records the most recently chosen view for a target", () => {
    const first = rememberView({}, "scene", "outline");
    expect(first).toEqual({ scene: "outline" });
    expect(rememberView(first, "scene", "context")).toEqual({
      scene: "context",
    });
  });

  it("remembers nothing for a tab with no target identity", () => {
    expect(rememberView({}, null, "outline")).toEqual({});
  });
});
