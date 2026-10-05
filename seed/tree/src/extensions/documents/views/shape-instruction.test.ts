import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { EXTEND_A_STRUCTURE, SHAPE_AN_INSTRUCTION } from "../lib/instruction";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A block dropped on an instruction's header shapes the instruction by it
 * (`calliopa-bootstrap`'s `BO_0349_014`): the header is a drop target only on
 * an instruction, and a block from another document dropped there starts a run
 * under *Shape an instruction*, the block its reference and not moved.
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

const instruction: DocumentView = {
  documentId: "ins-1",
  revisionId: "rev-ins",
  title: "Blog post",
  record: "instruction",
  blocks: [text("blk-i", "a", "Write in short paragraphs.")],
};

const plain: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notes", blocks: [text("blk-n", "a", "A note.")] };

const structure: DocumentView = { documentId: "str-1", revisionId: "rev-str", title: "Article", named: "structure", blocks: [text("blk-s", "a", "A story's article.")] };

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

async function mount(document: DocumentView) {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  last = view;
  const drop = async (itemId: string, from: string) => {
    view.record.drop = { itemId, overId: `header:${document.documentId}`, from };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => (view.record.instructed?.length ?? 0) > 0 || true);
    await view.idle();
  };
  return { ...view, sent, drop };
}

describe("a block dropped on an instruction's header", () => {
  it("Given an instruction, Then its header takes a block and a library item; given any other document, Then a library item alone (BO_0349_011)", async () => {
    const shaped = await mount(instruction);
    const header = shaped.root.querySelector("[data-document-header]");
    expect(header?.getAttribute("data-drop-target")).toBe("header:ins-1");
    expect(header?.getAttribute("data-accepts")).toBe("move link");
    expect(shaped.root.querySelector('[data-shape-mark="ins-1"]')?.getAttribute("data-drop-active")).toBe("false");
    await shaped.idle();
    vi.unstubAllGlobals();
    const other = await mount(plain);
    expect(other.root.querySelector("[data-document-header]")?.getAttribute("data-accepts")).toBe("link");
  });

  it("When a block from another document is dropped there, Then a run under Shape an instruction starts with the block as #1, and nothing moves", async () => {
    const view = await mount(instruction);
    await view.drop("blk-x", "doc-2");
    expect(view.record.instructed).toEqual([
      {
        itemId: "ins-1",
        goal: "Revise this instruction so that, followed, it would produce material like #1, the block dropped on it.",
        instruction: SHAPE_AN_INSTRUCTION,
        references: [{ number: 1, blockId: "blk-x", document: "doc-2" }],
      },
    ]);
    expect(view.sent.some((command) => ["move", "moveIn"].includes(String(command.body["command"])))).toBe(false);
  });

  it("When a block of the instruction itself is dropped there, Then nothing starts", async () => {
    const view = await mount(instruction);
    await view.drop("blk-i", "ins-1");
    expect(view.record.instructed ?? []).toEqual([]);
  });

  it("Given a structure's header, When a block from another document is dropped there, Then a run under Extend a structure starts with the block as #1 (BO_0349_036)", async () => {
    const view = await mount(structure);
    expect(view.root.querySelector("[data-document-header]")?.getAttribute("data-accepts")).toBe("move link");
    await view.drop("blk-x", "doc-2");
    expect(view.record.instructed).toEqual([
      {
        itemId: "str-1",
        goal: "Propose the fields this structure lacks, read off #1, the block dropped on it.",
        instruction: EXTEND_A_STRUCTURE,
        references: [{ number: 1, blockId: "blk-x", document: "doc-2" }],
      },
    ]);
  });

  it("Given a block held over a header, Then the mark lights red only where the drop would start a run, and not at all where it would not land", async () => {
    const shaped = await mount(instruction);
    shaped.record.over = "header:ins-1";
    await shaped.userEvent("[data-harness-over]", "click");
    expect(shaped.root.querySelector('[data-shape-mark="ins-1"]')?.getAttribute("data-drop-active")).toBe("acts");
    shaped.record.over = "header:ins-1";
    shaped.record.overOperation = "link";
    await shaped.userEvent("[data-harness-over]", "click");
    expect(shaped.root.querySelector('[data-shape-mark="ins-1"]')?.getAttribute("data-drop-active")).toBe("true");
    shaped.record.overOperation = null;
    shaped.record.over = "header:ins-1";
    await shaped.idle();
    vi.unstubAllGlobals();
    const other = await mount(plain);
    other.record.over = "header:doc-1";
    other.record.overOperation = null;
    await other.userEvent("[data-harness-over]", "click");
    // A block over a plain document's header resolves nothing: no mark.
    expect(other.root.querySelector('[data-shape-mark="doc-1"]')?.getAttribute("data-drop-active")).toBe("false");
  });

  it("When a marked passage of another document is dropped on an instruction's header, Then the run takes those words as its example (BO_0349_013)", async () => {
    const view = await mount(instruction);
    view.record.drop = { itemId: "passage:blk-x:2", overId: "header:ins-1", from: "doc-2", kind: "documents:passage", preview: "short, plain sentences" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && (view.record.instructed?.length ?? 0) === 0; tick++) await view.settle();
    expect(view.record.instructed).toEqual([
      {
        itemId: "ins-1",
        goal: "Revise this instruction so that, followed, it would produce material like #1, the block dropped on it.",
        instruction: SHAPE_AN_INSTRUCTION,
        references: [{ number: 1, kind: "passage", blockId: "blk-x", quote: "short, plain sentences", document: "doc-2" }],
      },
    ]);
  });

  it("When a marked passage is dropped on a plain document's header, Then nothing starts, and its mark does not light", async () => {
    const view = await mount(plain);
    view.record.drop = { itemId: "passage:blk-x:2", overId: "header:doc-1", from: "doc-2", kind: "documents:passage", preview: "words" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.idle();
    expect(view.record.instructed ?? []).toEqual([]);
  });
});

