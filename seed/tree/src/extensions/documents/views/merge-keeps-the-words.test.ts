import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { SAVE_PAUSE_MS } from "./block-editor";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The words a block holds survive the gesture that used to take them: an empty
 * block is removed rather than merged, and a reading that could not be the
 * block after one edit is dropped rather than saved. DO_0017_001 DO_0017_002
 */
const LONG =
  "That distinction does more work than the physics does, because it gives you the eligibility test.";

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Qc",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "fixate", runs: [{ text: LONG }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [] },
    { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "keep", runs: [{ text: "Closing." }] },
    { kind: "text", blockId: "blk-d", revisionId: "rev-d", containmentId: "c-d", order: "d", role: "paragraph", standing: "keep", runs: [{ text: "And after it." }] },
  ],
};

const ROUND_TRIP_MS = 20;
let last: { settle: () => Promise<void>; idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 4 * ROUND_TRIP_MS));
  await last?.settle();
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async (document: DocumentView = draft) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal(
    "fetch",
    documentsApi(document, sent, { follow: true, writeDelayMs: ROUND_TRIP_MS, readDelayMs: ROUND_TRIP_MS }),
  );
  const view = await mountEditor(document);
  last = { settle: () => view.settle(), idle: () => view.idle() };
  const row = (blockId: string) =>
    (view.root.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null | undefined) ?? null;
  const editors = () => [...view.root.querySelectorAll("[data-block-editor]")] as HTMLElement[];
  const editing = () => editors()[0]?.closest("[data-block-id]")?.getAttribute("data-block-id") ?? null;
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 300; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  /** Opens a block from reading by its keyboard path, the caret at its end. */
  const open = async (blockId: string) => {
    await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "focus");
    await view.userEvent(`[data-block-id="${blockId}"] [data-block-reading]`, "keydown", { key: "Enter" });
    await waitFor(() => editing() === blockId);
  };
  const press = (key: string) => view.userEvent("[data-block-editor]", "keydown", { key });
  await waitFor(() => row("blk-d") !== null);
  return { ...view, sent, row, editors, editing, commands, waitFor, open, press };
};

describe("an empty block is removed, never merged", () => {
  it("Given Backspace at the start of an empty block, Then it is retired and the block above keeps its words and its revision", async () => {
    const view = await mount();
    await view.open("blk-b");
    await view.press("Backspace");
    await view.waitFor(() => view.commands("retire").length === 1);
    expect(view.commands("merge")).toEqual([]);
    expect(view.commands("retire")[0]?.body["blockId"]).toBe("blk-b");
    // The block that would have absorbed it is not written at all.
    expect(view.commands("revise")).toEqual([]);
    await view.waitFor(() => view.editing() === "blk-a" && view.row("blk-b") === null);
    expect(view.editors()[0]?.textContent).toBe(LONG);
  });

  it("Given Delete at the end of a block whose next block is empty, Then the empty block is retired and nothing is merged", async () => {
    const view = await mount();
    await view.open("blk-a");
    await view.press("Delete");
    await view.waitFor(() => view.commands("retire").length === 1);
    expect(view.commands("retire")[0]?.body["blockId"]).toBe("blk-b");
    expect(view.commands("merge")).toEqual([]);
    await view.waitFor(() => view.row("blk-b") === null);
    expect(view.editing()).toBe("blk-a");
    expect(view.editors()[0]?.textContent).toBe(LONG);
  });

  it("Given Backspace at the start of a block that holds words, Then it still merges", async () => {
    const view = await mount();
    // The caret reaches the next block's start by the arrow, as a reader's does;
    // opening a block puts it at the end.
    await view.open("blk-c");
    await view.press("ArrowRight");
    await view.waitFor(() => view.editing() === "blk-d");
    await view.press("Backspace");
    await view.waitFor(() => view.commands("merge").length === 1);
    expect(view.commands("retire")).toEqual([]);
    expect(view.commands("merge")[0]?.body["intoBlockId"]).toBe("blk-c");
    await view.waitFor(() => view.editing() === "blk-c" && view.row("blk-d") === null);
    expect(view.editors()[0]?.textContent).toBe("Closing.And after it.");
  });
});

describe("a reading that could not be the block is dropped", () => {
  it(
    "Given an element holding words that share neither end of the block, When it reaches the editor, Then nothing is saved and the block is painted again",
    async () => {
      const view = await mount();
      await view.open("blk-a");
      const element = view.editors()[0];
      expect(element?.textContent).toBe(LONG);
      // What the loss looked like: the element holds the first characters of
      // the next prompt and nothing of the block, with the caret collapsed.
      element!.textContent = "shape t";
      await view.userEvent(element!, "input");
      await new Promise((resolve) => setTimeout(resolve, SAVE_PAUSE_MS + 150));
      await view.userEvent(view.root, "harnessSettle");
      expect(view.commands("revise")).toEqual([]);
      expect(view.editors()[0]?.textContent).toBe(LONG);
    },
    SAVE_PAUSE_MS + 8000,
  );

  it(
    "Given words typed at the caret, Then they are saved as they always were",
    async () => {
      const view = await mount();
      await view.open("blk-a");
      const element = view.editors()[0];
      element!.textContent = `${LONG} Typed.`;
      await view.userEvent(element!, "input");
      await view.waitFor(() => view.commands("revise").length === 1);
      const body = view.commands("revise")[0]?.body as { runs?: { text: string }[] };
      expect((body.runs ?? []).map((run) => run.text).join("")).toBe(`${LONG} Typed.`);
    },
    SAVE_PAUSE_MS + 8000,
  );
});
