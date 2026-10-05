import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Words typed into a block and not yet saved survive the block being dragged
 * onto another block's middle: the nest saves them before it moves the block.
 * Found in `calliopa-bootstrap`'s `BO_0349` walk, 2026-10-05: a new block,
 * typed into and dragged at once, arrived in the focused work empty.
 */
const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: words === "" ? [] : [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-nest-words",
  revisionId: "rev-doc",
  title: "Big Message",
  blocks: [text("blk-a", "a", "What is the story telling the reader"), text("blk-b", "b", "")],
};

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

describe("a block nested before its words were saved", () => {
  it("Given words typed into a block, When it is dropped on another block's middle at once, Then the words are saved before the block moves", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent));
    const view = await mountEditor(draft);
    last = view;
    await activateBlock(view, "blk-b");
    const editor = view.root.querySelector('[data-block-id="blk-b"] [data-block-editor]') as HTMLElement | null;
    if (editor === null) throw new Error("no editor");
    editor.textContent = "The hook lands here.";
    await view.userEvent(editor, "input");
    view.record.drop = { itemId: "blk-b", overId: "nest:blk-a", from: draft.documentId };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.some((command) => command.body["command"] === "moveIn"));
    const names = sent.map((command) => command.body["command"]);
    const revise = sent.find((command) => command.body["command"] === "revise" && command.body["blockId"] === "blk-b");
    expect(revise?.body["runs"]).toEqual([{ text: "The hook lands here." }]);
    expect(names.indexOf("revise")).toBeLessThan(names.indexOf("moveIn"));
    await view.idle();
  });

  it("Given words typed into the block being edited, When its handle starts a drag, Then the words are saved at once (BO_0349_027)", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent));
    const view = await mountEditor(draft);
    last = view;
    await activateBlock(view, "blk-b");
    const editor = view.root.querySelector('[data-block-id="blk-b"] [data-block-editor]') as HTMLElement | null;
    if (editor === null) throw new Error("no editor");
    editor.textContent = "Dragged before the pause.";
    await view.userEvent(editor, "input");
    await view.userEvent('[data-block-id="blk-b"] .block-handle', "pointerdown");
    await view.settle(() => sent.some((command) => command.body["command"] === "revise"));
    expect(sent.find((command) => command.body["command"] === "revise")?.body["runs"]).toEqual([{ text: "Dragged before the pause." }]);
    expect(view.record.drags).toEqual(["blk-b"]);
    await view.idle();
  });
});

