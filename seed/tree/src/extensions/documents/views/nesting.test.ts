import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A block dragged into a block, and a block dragged in from another document
 * (CA_0072_007, CA_0072_008): pressed in Qwik's render harness through the
 * editor's own JSX, with the drop handed over as the shell's drag model hands
 * one — `nest:<block>` over a text row's middle half, `block:<row>` over its
 * edges, and the document the block left in the payload's `from`.
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
  blocks: [
    text("blk-a", "a", "Opening."),
    text("blk-b", "b", "The storm."),
    { kind: "divider", blockId: "blk-d", revisionId: "rev-blk-d", containmentId: "c-blk-d", order: "c", standing: "keep" } as BlockView,
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  const view = await mountEditor(draft);
  const drop = async (itemId: string, overId: string, from?: string) => {
    view.record.drop = from === undefined ? { itemId, overId } : { itemId, overId, from };
    const before = sent.length;
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.slice(before).some((command) => command.body["command"] === "moveIn" || command.body["command"] === "move"));
    return sent.slice(before);
  };
  return { ...view, sent, drop };
}

describe("a block dragged into a block", () => {
  it("Given the rows, Then each text row names its middle as a nesting target, And a divider names none", async () => {
    const view = await mount();
    const middle = (id: string) => view.root.querySelector(`[data-block-id="${id}"]`)?.getAttribute("data-drop-middle") ?? null;
    expect(middle("blk-a")).toBe("nest:blk-a");
    expect(middle("blk-b")).toBe("nest:blk-b");
    expect(middle("blk-d")).toBeNull();
  });

  it("Given a pointer over a row's middle, Then that row lights as a whole and no drop mark between rows does", async () => {
    const view = await mount();
    view.record.over = "nest:blk-b";
    await view.userEvent("[data-harness-over]", "click");
    await view.settle(() => view.root.querySelector('[data-nest-mark="blk-b"]')?.getAttribute("data-drop-active") === "true");
    expect(view.root.querySelector('[data-nest-mark="blk-a"]')?.getAttribute("data-drop-active")).toBe("false");
    expect(view.root.querySelector('[data-drop-mark][data-drop-active="true"]') ?? null).toBeNull();
  });

  it("When a block is dropped on another's middle, Then the shell finds the target's focused work without leaving, And the block moves to its end", async () => {
    const view = await mount();
    const commands = await drop(view, "blk-a", "nest:blk-b");
    expect(view.record.focusedChildren).toEqual([{ itemId: "doc-1", blockId: "blk-b" }]);
    expect(view.record.routed).toEqual([]);
    const moved = commands.find((command) => command.body["command"] === "moveIn");
    expect(moved?.url).toBe("/api/x/documents/d/child-blk-b/commands");
    expect(moved?.body).toEqual({ command: "moveIn", blockId: "blk-a", fromDocumentId: "doc-1", placement: { at: "end" } });
    expect(commands.some((command) => command.body["command"] === "move")).toBe(false);
    await view.settle(() => view.root.querySelector('[data-block-face="child-blk-b"]') !== null);
    expect(view.root.querySelector('[data-block-face="child-blk-b"]')?.textContent).toBe("Focused blk-b");
    await view.idle();
  });

  it("When a block is dropped on its own middle, Then nothing is asked and nothing moves", async () => {
    const view = await mount();
    view.record.drop = { itemId: "blk-b", overId: "nest:blk-b" };
    await view.userEvent("[data-harness-drop]", "click");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(view.record.focusedChildren).toEqual([]);
    expect(view.sent.some((command) => command.body["command"] === "moveIn")).toBe(false);
  });
});

describe("a block dropped in from another document", () => {
  it("When it is dropped before a row, Then it moves into this document at that place, And no move within the document is sent", async () => {
    const view = await mount();
    const commands = await drop(view, "blk-far", "block:blk-b", "doc-2");
    const moved = commands.find((command) => command.body["command"] === "moveIn");
    expect(moved?.url).toBe("/api/x/documents/d/doc-1/commands");
    expect(moved?.body).toEqual({ command: "moveIn", blockId: "blk-far", fromDocumentId: "doc-2", placement: { between: ["a", "b"] } });
    expect(commands.some((command) => command.body["command"] === "move")).toBe(false);
  });

  it("When it is dropped on a row's middle, Then it moves from its own document into that row's focused work", async () => {
    const view = await mount();
    const commands = await drop(view, "blk-far", "nest:blk-a", "doc-2");
    const moved = commands.find((command) => command.body["command"] === "moveIn");
    expect(moved?.url).toBe("/api/x/documents/d/child-blk-a/commands");
    expect(moved?.body).toEqual({ command: "moveIn", blockId: "blk-far", fromDocumentId: "doc-2", placement: { at: "end" } });
  });

  it("A block of this document dropped before a row is still the move it always was", async () => {
    const view = await mount();
    const commands = await drop(view, "blk-b", "block:blk-a", "doc-1");
    expect(commands.find((command) => command.body["command"] === "move")?.body["blockId"]).toBe("blk-b");
    expect(commands.some((command) => command.body["command"] === "moveIn")).toBe(false);
  });
});

function drop(view: Awaited<ReturnType<typeof mount>>, itemId: string, overId: string, from?: string) {
  return view.drop(itemId, overId, from);
}
