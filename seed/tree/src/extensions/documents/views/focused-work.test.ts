import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import type { FocusedWork } from "~/server/focused-work";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Focused work in the block editor (`CA_0047_004`, `_005`, `_007`;
 * `CA_0065_009`, `CA_0065_010`), pressed in Qwik's render harness.
 *
 * The capability is the shell's since `CA_0065`: the control in the block's
 * own row is the frame's, contributed and pressed through the bridge, and the
 * face is this view's line over what the shell answered. What this suite
 * proves is that this view draws both and that a press reaches the shell —
 * the route line above the headline, the control opening the child in a tab
 * of its own after the parent's with the parent on its route (`CA_0073`),
 * *Back* and a crumb reaching the parent's tab with its block to focus while
 * this tab stays, and the block the shell asks the view to land on focused on
 * mount. It moved here with the drawing.
 */

const words = (text: string) => [{ text }];

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Caching",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: words("Independent checks preserve boundaries.") },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: words("Request-local caching could reduce repeated checks.") },
    { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "keep", runs: words("Revision changes complicate this approach.") },
  ],
};

const focused: FocusedWork = {
  "blk-b": { itemId: "doc-b", title: "Request-local caching could reduce repeated checks.", face: words("Cache per request, keyed by revision.") },
  "blk-c": { itemId: "doc-c", title: "Revision changes complicate this approach.", face: null },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (options: {
  route?: { itemId: string; title: string; blockId?: string }[];
  focusOn?: string;
  focused?: FocusedWork;
  focusedHeld?: Promise<void>;
  awaitReads?: boolean;
} = {}) => {
  const sent: SentCommand[] = [];
  const depthReads: string[] = [];
  const focusedReads: string[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, {
    depthReads,
    focusedReads,
    ...(options.focused === undefined ? {} : { focused: options.focused }),
    ...(options.focusedHeld === undefined ? {} : { focusedHeld: options.focusedHeld }),
  }));
  const view = await mountEditor(draft, {
    ...(options.route === undefined ? {} : { route: options.route }),
    ...(options.focusOn === undefined ? {} : { focusOn: options.focusOn }),
    ...(options.awaitReads === undefined ? {} : { awaitReads: options.awaitReads }),
  });
  const row = (id: string) => view.root.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
  const press = async (id: string) => {
    await view.userEvent(`[data-block-id="${id}"] [data-block-reading]`, "click");
    await view.settle();
  };
  return { ...view, sent, depthReads, focusedReads, row, press };
};

describe("focused work in the block editor", () => {
  it("Given a tab with a route of one, Then no route line renders; given a longer route, Then Back and the crumbs render with the current root last and not a button", async () => {
    const alone = await mount();
    expect(alone.root.querySelector("[data-document-route]")).toBeFalsy();

    const deep = await mount({
      route: [
        { itemId: "doc-0", title: "Architecture", blockId: "blk-0" },
        { itemId: "doc-1", title: "Caching" },
      ],
    });
    const route = deep.root.querySelector("[data-document-route]");
    expect(route).toBeTruthy();
    expect(route?.querySelector("[data-route-back]")).toBeTruthy();
    expect(route?.querySelector('[data-route-crumb="doc-0"]')?.textContent).toBe("Architecture");
    expect(route?.querySelector('[data-route-crumb="doc-1"]')).toBeFalsy();
    expect(route?.querySelector('[data-route-current="doc-1"]')?.textContent).toBe("Caching");
  });

  it("Given a focused block, When Open as focused work is pressed, Then the child opens in a tab of its own after the parent's, the parent on its route with the block it was opened from, and the parent's tab stays", async () => {
    const view = await mount();
    await view.press("blk-a");
    const open = view.row("blk-a")?.querySelector('[data-block-controls] [data-block-action="focused-work"]');
    expect(open?.getAttribute("aria-label")).toBe("Open as focused work");
    await view.userEvent(open as Element, "click");
    await view.settle(() => view.record.routed.length > 0);
    // The press reaches the shell, never an extension's command.
    expect(view.record.blockControls).toEqual([{ control: "focused-work", blockId: "blk-a" }]);
    expect(view.record.routed).toEqual([
      {
        itemId: "child-blk-a",
        title: "Focused blk-a",
        route: [
          { itemId: "doc-1", title: "Caching", blockId: "blk-a" },
          { itemId: "child-blk-a", title: "Focused blk-a" },
        ],
      },
    ]);
    // The parent's tab is left as it was, and the child's is active after it.
    expect(view.record.tabs?.tabs.map((tab) => tab.itemId)).toEqual(["doc-1", "child-blk-a"]);
    expect(view.record.tabs?.tabs[0]?.route).toBeUndefined();
    expect(view.record.tabs?.activeTabId).toBe(view.record.tabs?.tabs[1]?.id);
  });

  it("Given a block that already has focused work, Then the shell's control is labelled Focused work and opens the child; and the parent's face shows the child's face, or its title when it has none", async () => {
    const view = await mount({ focused });
    expect(view.focusedReads.some((url) => url.includes("/api/focused-work/doc-1"))).toBe(true);
    // The faces arrive on the initial document read, before any block is focused.
    expect(view.row("blk-b")?.querySelector('[data-block-face="doc-b"]')?.textContent).toBe("Cache per request, keyed by revision.");
    expect(view.row("blk-c")?.querySelector('[data-block-face="doc-c"]')?.textContent).toBe("Revision changes complicate this approach.");
    expect(view.row("blk-a")?.querySelector("[data-block-face]")).toBeFalsy();

    await view.press("blk-b");
    const open = view.row("blk-b")?.querySelector('[data-block-controls] [data-block-action="focused-work"]');
    // The control is an icon, so its words are its label, and the shell's
    // words say the block already has a child.
    expect(open?.getAttribute("aria-label")).toBe("Focused work");
    expect(open?.getAttribute("title")).toBe("Focused work");
    await view.userEvent(open as Element, "click");
    await view.settle(() => view.record.routed.length > 0);
    expect(view.record.routed[0]?.itemId).toBe("doc-b");
    expect(view.record.routed[0]?.route.map((entry) => entry.itemId)).toEqual(["doc-1", "doc-b"]);
  });

  it("Given focused work whose blocks say something, Then the face lists their first words under the block, one line each, and opens the child (BO_0349_019)", async () => {
    const view = await mount({
      focused: {
        "blk-b": {
          itemId: "doc-b",
          title: "Request-local caching could reduce repeated checks.",
          face: null,
          lines: ["The hook lands here.", "And the second one."],
        },
      },
    });
    const face = view.row("blk-b")?.querySelector('[data-block-face="doc-b"]');
    expect([...(face?.querySelectorAll("[data-block-face-line]") ?? [])].map((line) => line.textContent)).toEqual([
      "The hook lands here.",
      "And the second one.",
    ]);
    expect(face?.getAttribute("aria-label")).toBe("Open Request-local caching could reduce repeated checks.");
  });

  it("A slow initial faces read does not hold block activation, and the face appears when the read answers", async () => {
    let release = () => {};
    const focusedHeld = new Promise<void>((resolve) => {
      release = resolve;
    });
    const view = await mount({ focused, focusedHeld, awaitReads: false });
    await view.press("blk-b");
    const control = view.row("blk-b")?.querySelector('[data-block-action="focused-work"]');
    expect(control?.getAttribute("title")).toBe("Open as focused work");
    expect(view.row("blk-b")?.querySelector("[data-block-face]") == null).toBe(true);

    release();
    await view.settle(() =>
      view.row("blk-b")?.querySelector('[data-block-face="doc-b"]') !== null &&
      view.row("blk-b")?.querySelector('[data-block-action="focused-work"]')?.getAttribute("title") === "Focused work",
    );
    expect(view.row("blk-b")?.querySelector('[data-block-face="doc-b"]')?.textContent).toBe("Cache per request, keyed by revision.");
    await view.idle();
  });

  it("Given the block bar on any row, Then it places itself out of the flow, so a proposal row does not push the document down", () => {
    // Every row draws the one bar (`block-bar.tsx`), a proposal and a removed
    // row included, and the bar itself is what is placed: a control left in
    // the document's flow showed as a white bar pushing the content down —
    // found in the `CA_0065` walk. CA_0065_009 BO_0315_013
    const css = readFileSync(new URL("./block-editor.css", import.meta.url), "utf8");
    expect(css).toMatch(/\n\.block-toolbars\s*\{[^}]*position:\s*absolute/u);
    // Nothing inside it places itself, so nothing falls out of it.
    expect(css).not.toMatch(/\n\.standing-toolbar\s*\{[^}]*position:\s*absolute/u);
  });

  it("Given a route, When Back or a crumb is pressed, Then that document's tab opens beside with the route popped and its block to focus, and this tab stays", async () => {
    const view = await mount({
      route: [
        { itemId: "doc-r", title: "Roots", blockId: "blk-r" },
        { itemId: "doc-0", title: "Architecture", blockId: "blk-0" },
        { itemId: "doc-1", title: "Caching" },
      ],
    });
    await view.userEvent("[data-route-back]", "click");
    await view.settle(() => view.record.routed.length > 0);
    expect(view.record.routed[0]).toEqual({
      itemId: "doc-0",
      title: "Architecture",
      route: [
        { itemId: "doc-r", title: "Roots", blockId: "blk-r" },
        { itemId: "doc-0", title: "Architecture", blockId: "blk-0" },
      ],
      focus: "blk-0",
    });
    await view.userEvent('[data-route-crumb="doc-r"]', "click");
    await view.settle(() => view.record.routed.length > 1);
    expect(view.record.routed[1]?.itemId).toBe("doc-r");
    expect(view.record.routed[1]?.route.map((entry) => entry.itemId)).toEqual(["doc-r"]);
    expect(view.record.routed[1]?.focus).toBe("blk-r");
    // The child's tab keeps its target and its route of three.
    expect(view.record.tabs?.tabs[0]?.itemId).toBe("doc-1");
    expect(view.record.tabs?.tabs[0]?.route).toHaveLength(3);
    expect(view.record.tabs?.tabs.map((tab) => tab.itemId)).toEqual(["doc-1", "doc-0", "doc-r"]);
  });

  it("Given the shell asks the view to land on a block, Then that block is focused once the document shows", async () => {
    const view = await mount({ focusOn: "blk-c" });
    await view.settle(() => view.row("blk-c")?.getAttribute("data-focused") === "true");
    expect(view.row("blk-c")?.getAttribute("data-focused")).toBe("true");
    expect(view.root.querySelector("[data-block-editor]")).toBeFalsy();
  });
});
