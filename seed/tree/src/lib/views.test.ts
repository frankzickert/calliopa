import { describe, expect, it } from "vitest";
import type { Component } from "@builder.io/qwik";
import { buildRegistry } from "~/registry";
import {
  defaultViewFor,
  findView,
  preferredView,
  rememberView,
  resolveView,
  viewsFor,
} from "./views";

/**
 * View resolution over a fixture registry shaped like the build's: the host's
 * placeholders for the story-development kinds, and one extension
 * contributing a kind with a view of its own. The rules are the registry's
 * to enforce and these functions' to apply. BO_0202_004
 */
const component = {} as Component<never>;
const view = (id: string, name: string, targetKinds: readonly string[] = []) => ({
  id,
  name,
  targetKinds,
  inspector: `${name} summary`,
  drag: [] as const,
  component,
});
const context = view("context", "Context");
const outline = view("outline", "Outline", ["script", "scene"]);
const editor = view("block-editor", "Editor");
const registry = buildRegistry(
  { kinds: { script: context, scene: context, media: context }, views: [outline] },
  [{ id: "ui.shell", contributions: { kinds: { document: editor } } }],
);

describe("the resolved registry", () => {
  it("declares a default view for every target kind", () => {
    for (const kind of Object.keys(registry.kinds)) {
      expect(defaultViewFor(registry, kind).targetKinds).toContain(kind);
    }
  });

  it("qualifies an extension's kind and leaves the host's bare", () => {
    expect(Object.keys(registry.kinds).sort()).toEqual(["media", "scene", "script", "ui.shell:document"]);
    expect(defaultViewFor(registry, "ui.shell:document").id).toBe("block-editor");
  });

  it("lists only the views compatible with a target kind", () => {
    expect(viewsFor(registry, "script").map((candidate) => candidate.id)).toEqual(["context", "outline"]);
    expect(viewsFor(registry, "media").map((candidate) => candidate.id)).toEqual(["context"]);
  });

  it("does not know an unregistered identifier", () => {
    expect(findView(registry, "retired-view")).toBeUndefined();
  });

  it("presents a kind nothing contributes with the placeholder", () => {
    // A tab stored for an extension that left the tree keeps its target and
    // opens in the host's context view rather than stranding the workspace.
    expect(defaultViewFor(registry, "calliopa-video:episode").id).toBe("context");
  });
});

describe("resolving a tab's view", () => {
  it("mounts a registered compatible view unchanged", () => {
    expect(resolveView(registry, "script", "outline")).toEqual({
      view: findView(registry, "outline"),
      requested: "outline",
      unsupported: false,
    });
  });

  it("falls back visibly when the identifier is unknown", () => {
    const resolution = resolveView(registry, "script", "retired-view");
    expect(resolution.unsupported).toBe(true);
    expect(resolution.requested).toBe("retired-view");
    expect(resolution.view.id).toBe("context");
  });

  it("falls back when a known view cannot present this target kind", () => {
    const resolution = resolveView(registry, "media", "outline");
    expect(resolution.unsupported).toBe(true);
    expect(resolution.view.id).toBe("context");
  });
});

describe("remembering a target's view", () => {
  it("reuses the remembered view when it still supports the target", () => {
    expect(preferredView(registry, { scene: "outline" }, "scene", "scene").id).toBe("outline");
  });

  it("uses the kind default when nothing is remembered", () => {
    expect(preferredView(registry, {}, "scene", "scene").id).toBe("context");
  });

  it("uses the kind default when the remembered view is gone", () => {
    expect(preferredView(registry, { scene: "retired-view" }, "scene", "scene").id).toBe("context");
  });

  it("uses the kind default when the remembered view cannot present it", () => {
    expect(preferredView(registry, { clip: "outline" }, "clip", "media").id).toBe("context");
  });

  it("records the most recently chosen view for a target", () => {
    const first = rememberView({}, "scene", "outline");
    expect(first).toEqual({ scene: "outline" });
    expect(rememberView(first, "scene", "context")).toEqual({ scene: "context" });
  });

  it("remembers nothing for a tab with no target identity", () => {
    expect(rememberView({}, null, "outline")).toEqual({});
  });
});
