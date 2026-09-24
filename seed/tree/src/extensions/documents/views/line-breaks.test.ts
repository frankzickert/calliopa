import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Enter on every origin, Shift+Enter as a line inside the block, and the
 * arrow keys through the blocks the document draws, pressed through the
 * editor's own JSX. DO_0003_001 DO_0003_002 DO_0003_003
 *
 * The render harness measures nothing, so the lines here are the ones line
 * breaks make; a wrapped line and a caret's place across the page are the
 * browser's, and `DO_0003_004` walks them.
 */
const text = (blockId: string, order: string, words: string, standing: "keep" | "discarded" | "prompt" = "keep"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing,
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    text("blk-a", "a", "Open"),
    text("blk-d", "b", "Set aside.", "discarded"),
    text("blk-p", "c", "Write it.", "prompt"),
    text("blk-b", "d", "Line one\nLine two"),
    text("blk-c", "e", "Closing."),
  ],
};

/** The editor last mounted, settled and idled before the next test mounts its
 * own: a render or a read left under way would write into the next test's
 * container, which Qwik reports as *Must be same function* (`DO_0001_003`). */
let last: { settle: () => Promise<void>; idle: () => Promise<void> } | null = null;

afterEach(async () => {
  // A handover's save reports its state after the gesture, and the report
  // starts the reads of the changes and the proposals: rounds of waiting and
  // idling until a round starts nothing new.
  for (let round = 0; round < 3; round++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await last?.settle();
    await last?.idle();
  }
  last = null;
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  const view = await mountEditor(draft);
  last = { settle: () => view.settle(), idle: () => view.idle() };
  const find = (selector: string) => (view.root.querySelector(selector) as HTMLElement | null) ?? null;
  const editor = () => find("[data-block-editor]");
  const editing = () => editor()?.closest("[data-block-id]")?.getAttribute("data-block-id") ?? null;
  // A key is pressed once the editor is idle, as a reader's next key comes
  // after the reads the last gesture started: in the render harness a render
  // a read draws while a key's handover writes is Qwik's *Must be same
  // function*, which a browser's platform never raises.
  const press = async (key: string, shiftKey = false) => {
    await view.idle();
    await view.userEvent("[data-block-editor]", "keydown", { key, shiftKey, altKey: false, ctrlKey: false, metaKey: false });
    await view.settle();
  };
  const writes = (command: string) => sent.filter((entry) => entry.body["command"] === command).map((entry) => entry.body);
  /** Waits on rounds of 10ms, as `handover.test.ts` does: an arrow's handover
   * reads the document, which takes longer than `settle`'s quick rounds allow
   * when the whole suite runs at once. */
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 300; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, find, editor, editing, press, writes, waitFor };
}

describe("Enter on a page served over plain HTTP (DO_0003_001)", () => {
  it("Given no crypto.randomUUID, When Enter is pressed, Then the block splits on screen and the split names the tail drawn", async () => {
    const held = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const view = await mount();
      await activateBlock(view, "blk-c");
      await view.press("Enter");
      await view.waitFor(() => view.editing() !== "blk-c" && view.editing() !== null);
      const tail = view.editing();
      expect(tail).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      await view.waitFor(() => view.writes("split").length === 1);
      expect(view.writes("split")[0]).toMatchObject({ blockId: "blk-c", at: "Closing.".length, tailBlockId: tail });
      await view.idle();
    } finally {
      if (held === undefined) delete (crypto as { randomUUID?: unknown }).randomUUID;
      else Object.defineProperty(crypto, "randomUUID", held);
    }
  });
});

describe("Shift+Enter is a line inside the block (DO_0003_003)", () => {
  it("When Shift+Enter is pressed, Then the block holds a line break at the caret, stays one block, and saves it as a character of its text", async () => {
    const view = await mount();
    await activateBlock(view, "blk-c");
    await view.press("Enter", true);
    expect(view.editing()).toBe("blk-c");
    expect(view.editor()?.textContent).toBe("Closing.\n");
    // A break at the very end holds its line with a `<br>`, which is never
    // read back as content.
    expect(view.editor()?.lastChild?.nodeName).toBe("BR");
    expect(view.writes("split")).toEqual([]);
    // The caret stands after the break: Enter now splits there.
    await view.press("Enter");
    await view.waitFor(() => view.writes("split").length === 1);
    // The split carries the break with the head's words, in one write of the
    // head. DO_0015_001
    expect(view.writes("revise")).toEqual([]);
    expect(view.writes("split")[0]).toMatchObject({ blockId: "blk-c", at: "Closing.\n".length, runs: [{ text: "Closing.\n" }] });
    await view.idle();
  }, SAVE_PAUSE_MS + 5000);

  it("Given a block with a line break, Then its row in reading holds it as text, and the editor is multi-line", async () => {
    const view = await mount();
    expect(view.find('[data-block-id="blk-b"] [data-block-reading]')?.textContent).toBe("Line one\nLine two");
    await activateBlock(view, "blk-b");
    expect(view.editor()?.getAttribute("aria-multiline")).toBe("true");
    await view.idle();
  });
});

describe("the arrow keys through the blocks the document draws (DO_0003_002)", () => {
  it("Given discarded and prompt blocks hidden, When Down leaves a block, Then the caret passes over them into the next drawn block, as many characters in", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    await view.press("ArrowDown");
    await view.waitFor(() => view.editing() === "blk-b");
    // Landed on the first line, four characters in: a break typed there shows it.
    await view.press("Enter", true);
    expect(view.editor()?.textContent).toBe("Line\n one\nLine two");
    await view.idle();
  });

  it("Given the caret on the first of two lines, Then Down stays in the block and Up leaves it for the block above, landing on its last line", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    await view.press("ArrowDown");
    await view.waitFor(() => view.editing() === "blk-b");
    await view.press("ArrowDown");
    expect(view.editing()).toBe("blk-b");
    await view.press("ArrowUp");
    await view.waitFor(() => view.editing() === "blk-a");
    await view.press("Enter", true);
    expect(view.editor()?.textContent).toBe("Open\n");
    await view.idle();
  });

  it("Given the caret on the last of two lines, Then Up stays in the block and Down leaves it", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b");
    await view.press("ArrowUp");
    expect(view.editing()).toBe("blk-b");
    await view.press("ArrowDown");
    await view.waitFor(() => view.editing() === "blk-c");
    await view.idle();
  });

  it("Given Show discarded blocks, Then Down still passes over the discarded row, which takes no caret; given Show prompts, Then Up steps into the prompt", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="discarded-blocks"]', "click");
    await view.waitFor(() => view.find('[data-discarded-id="blk-d"]') !== null);
    await activateBlock(view, "blk-a");
    await view.press("ArrowDown");
    await view.waitFor(() => view.editing() === "blk-b");
    await view.userEvent('[data-bar-action="prompts"]', "click");
    await view.waitFor(() => view.find('[data-block-id="blk-p"]') !== null);
    await view.press("ArrowUp");
    await view.waitFor(() => view.editing() === "blk-p");
    await view.idle();
  });
});
