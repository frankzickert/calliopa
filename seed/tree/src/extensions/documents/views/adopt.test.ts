import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A document dragged into a document (`DO_0043_004`): pressed in Qwik's render
 * harness through the editor's own JSX, with the drop handed over as the
 * shell's drag model hands one — a document's tab or its library row, the
 * kind `documents:document` from the strip or the library offering a move,
 * over `block:<row>` between rows or `nest:<block>` on a row's middle. The
 * view asks the shell to adopt it; the write itself is proven over the one
 * graph (`tests/behavior/adopt.test.ts`).
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
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "The storm.")],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount(options: { refuseAdoption?: string } = {}) {
  const sent: SentCommand[] = [];
  const focusedReads: string[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { ...options, focusedReads }));
  const view = await mountEditor(draft);
  const drop = async (itemId: string, overId: string, source: "tab-strip" | "library") => {
    view.record.drop = { itemId, overId, source };
    const before = sent.length;
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.slice(before).some((command) => command.url.endsWith("/adopt")));
    return sent.slice(before);
  };
  return { ...view, sent, focusedReads, drop };
}

describe("a document dropped into a document", () => {
  it("Given a document's tab dropped before a row, Then the shell is asked to adopt it there, And nothing moves as a block", async () => {
    const view = await mount();
    const commands = await drop(view, "doc-2", "block:blk-b", "tab-strip");
    expect(view.record.adoptions).toEqual([{ itemId: "doc-1", childId: "doc-2", at: { placement: { between: ["a", "b"] } } }]);
    const adopted = commands.find((command) => command.url.endsWith("/adopt"));
    expect(adopted?.url).toBe("/api/focused-work/doc-1/adopt");
    expect(adopted?.body).toEqual({ kind: "documents:document", childId: "doc-2", placement: { between: ["a", "b"] } });
    expect(commands.some((command) => command.body["command"] === "moveIn" || command.body["command"] === "move")).toBe(false);
    await view.idle();
  });

  it("Given a document's library row dropped at the end, Then it is adopted after the last row, And the faces are read again", async () => {
    const view = await mount();
    const reads = view.focusedReads.length;
    await drop(view, "doc-3", "block:end", "library");
    expect(view.record.adoptions).toEqual([{ itemId: "doc-1", childId: "doc-3", at: { placement: { between: ["b", null] } } }]);
    await view.settle(() => view.focusedReads.length > reads);
    await view.idle();
  });

  it("Given a document dropped on a row's middle, Then it is adopted into that row's focused work, And no child is asked for separately", async () => {
    const view = await mount();
    await drop(view, "doc-2", "nest:blk-a", "tab-strip");
    expect(view.record.adoptions).toEqual([{ itemId: "doc-1", childId: "doc-2", at: { into: "blk-a" } }]);
    expect(view.record.focusedChildren).toEqual([]);
    expect(view.record.routed).toEqual([]);
    await view.idle();
  });

  it("Given the shell refuses the drop, Then the refusal is said on the document", async () => {
    const view = await mount({ refuseAdoption: "A document cannot become a block of its own focused work." });
    await drop(view, "doc-0", "block:blk-a", "library");
    await view.settle(() => (view.root.querySelector("[data-block-error]")?.textContent ?? "").includes("its own focused work"));
    await view.idle();
  });

  it("Given the document dropped on itself, Then nothing is asked and nothing moves", async () => {
    const view = await mount();
    view.record.drop = { itemId: "doc-1", overId: "block:blk-b", source: "tab-strip" };
    await view.userEvent("[data-harness-drop]", "click");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(view.record.adoptions).toEqual([]);
    expect(view.sent.some((command) => command.url.endsWith("/adopt") || command.body["command"] === "move")).toBe(false);
  });

  it("Given the document held over itself, Then no place lights, And another document held there lights it", async () => {
    const view = await mount();
    view.record.over = "nest:blk-b";
    view.record.overSource = { source: "tab-strip", itemId: "doc-1" };
    await view.userEvent("[data-harness-over]", "click");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.root.querySelector('[data-nest-mark="blk-b"]')?.getAttribute("data-drop-active")).toBe("false");
    view.record.over = "block:blk-b";
    await view.userEvent("[data-harness-over]", "click");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.root.querySelector('[data-drop-mark][data-drop-active="true"]') ?? null).toBeNull();
    view.record.overSource = { source: "library", itemId: "doc-2" };
    await view.userEvent("[data-harness-over]", "click");
    await view.settle(() => view.root.querySelector('[data-drop-mark="blk-b"]')?.getAttribute("data-drop-active") === "true");
  });
});

function drop(view: Awaited<ReturnType<typeof mount>>, itemId: string, overId: string, source: "tab-strip" | "library") {
  return view.drop(itemId, overId, source);
}
