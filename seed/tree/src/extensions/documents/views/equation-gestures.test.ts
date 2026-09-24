import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import {
  activateBlock,
  documentsApi,
  mountEditor,
  type SentCommand,
} from "./testing/editor-harness";
import { SAVE_PAUSE_MS } from "./block-editor";

/**
 * What the bar's mathematics controls actually send (`BO_0290_029`).
 *
 * The walk found *Add equation* making a paragraph. The control was there and
 * the route took an equation; what was missing was the branch between them —
 * lost in a rebase, where the hunk that carried it anchored on a line another
 * change had meanwhile reworded, so the replacement quietly did nothing.
 *
 * A test that a control *exists* cannot see that. This one presses the control
 * and reads the command that leaves, which is the only thing that can.
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

async function mount() {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [text("blk-a", "a", "Draft.")],
  };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  return { view, sent };
}

const press = async (view: Awaited<ReturnType<typeof mount>>["view"], id: string) => {
  await view.userEvent(`[data-bar-action="${id}"]`, "click");
  await view.settle(() => true);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the bar's mathematics controls", () => {
  it("Add equation sends an insert of an equation, with a source to type over", async () => {
    const { view, sent } = await mount();
    await activateBlock(view, "blk-a");
    await press(view, "block-add-equation");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "insert"));

    const insert = sent.find((entry) => entry.body["command"] === "insert");
    expect(insert).toBeTruthy();
    const block = insert?.body["block"] as Record<string, unknown>;
    // The kind the route takes, and a source, since an equation carrying none
    // is refused at the write.
    expect(block["kind"]).toBe("equation");
    expect(typeof block["tex"]).toBe("string");
    expect(String(block["tex"]).trim()).not.toBe("");
    await view.idle();
  });

  it("Inline equation sends a revise whose runs carry mathematics", async () => {
    const { view, sent } = await mount();
    await activateBlock(view, "blk-a");
    await press(view, "block-inline-equation");
    // The save is paused, as every edit's is, so this waits it out.
    for (let tick = 0; tick < 200 && !sent.some((entry) => entry.body["command"] === "revise"); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await view.settle(() => true);
    }

    const revise = sent.find((entry) => entry.body["command"] === "revise");
    const runs = (revise?.body["runs"] ?? []) as { text: string; math?: boolean }[];
    expect(runs.some((run) => run.math === true)).toBe(true);
    await view.idle();
  }, SAVE_PAUSE_MS + 20000);
});
