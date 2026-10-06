import { afterEach, describe, expect, it, vi } from "vitest";

import type { EmptiedWork } from "~/components/shell/view-bridge";
import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A focused work that goes when its last block leaves, and *Take back* in its
 * parent (`CA_0083_005`, `CA_0083_006`): pressed in Qwik's render harness
 * through the editor's own JSX. The server's removal is proven over the one
 * graph (`tests/behavior/focus.test.ts`) and the tabs it turns in
 * `src/lib/tabs.test.ts`; what is proven here is that the view reports what
 * went with the block that left, and offers and carries out *Take back*.
 */
const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Caching helps."), text("blk-b", "b", "The storm.")],
};

/** What the server answers beside a write that emptied `child-1`, the focused
 * work of `blk-a`. */
const went = {
  itemId: "child-1",
  blockId: "blk-a",
  parent: { itemId: "doc-1", title: "Draft" },
  kept: { title: "Caching helps.", retired: ["blk-old"] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const takeBack = '[data-bar-action="take-back-standing"]';

describe("a write that empties a focused work", () => {
  it("When the last block of a focused work is dropped in here, Then the view tells the shell what went, with the block and where it went, And this document offers to take it back", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal(
      "fetch",
      documentsApi(draft, sent, { emptied: (_url, body) => (body["command"] === "moveIn" ? { ...went, dataRevision: "9" } : undefined) }),
    );
    const view = await mountEditor(draft);
    view.record.drop = { itemId: "blk-far", overId: "block:blk-b", from: "child-1" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => view.record.emptied.length > 0);
    expect(view.record.emptied).toEqual([{ ...went, left: { blockIds: ["blk-far"], wentTo: "doc-1" } }]);
    await view.settle(() => view.root.querySelector(takeBack)?.getAttribute("aria-label") === "Take back: emptied the focused work");
    expect(view.root.querySelector(takeBack)?.hasAttribute("disabled")).toBe(false);
    await view.idle();
  });

  it("When a write empties nothing, Then nothing is reported", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent));
    const view = await mountEditor(draft);
    view.record.drop = { itemId: "blk-far", overId: "block:blk-b", from: "doc-2" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.some((command) => command.body["command"] === "moveIn"));
    await view.idle();
    expect(view.record.emptied).toEqual([]);
  });
});

describe("taking an emptied focused work back", () => {
  const mountHolding = async (left: EmptiedWork["left"]) => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent));
    const view = await mountEditor(draft, { held: { ...went, left } });
    await view.settle(() => view.root.querySelector(takeBack)?.getAttribute("aria-label") === "Take back: emptied the focused work");
    return { ...view, sent };
  };

  it("Given the shell holds a removal for this document as it mounts, When Take back is pressed, Then the focused work comes back on its block, And the removed block is restored in it, And the block wears its face again", async () => {
    const view = await mountHolding({ blockIds: ["blk-x"], wentTo: null });
    await view.userEvent(takeBack, "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "restore"));
    expect(view.record.broughtBack.map((work) => work.kept)).toEqual([went.kept]);
    const restored = view.sent.find((command) => command.body["command"] === "restore");
    expect(restored?.url).toBe("/api/x/documents/d/back-blk-a/commands");
    expect(restored?.body).toEqual({ command: "restore", blockId: "blk-x", placement: { at: "end" } });
    await view.settle(() => view.root.querySelector('[data-block-face="back-blk-a"]') !== null);
    expect(view.root.querySelector(takeBack)?.hasAttribute("disabled")).toBe(true);
    await view.idle();
  });

  it("Given the block was dragged out into another document, When Take back is pressed, Then it moves back from there into the focused work", async () => {
    const view = await mountHolding({ blockIds: ["blk-x"], wentTo: "doc-9" });
    await view.userEvent(takeBack, "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "moveIn"));
    const moved = view.sent.find((command) => command.body["command"] === "moveIn");
    expect(moved?.url).toBe("/api/x/documents/d/back-blk-a/commands");
    expect(moved?.body).toEqual({ command: "moveIn", blockId: "blk-x", fromDocumentId: "doc-9", placement: { at: "end" } });
    await view.idle();
  });
});
