import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The editor never holds the page while a read is under way. Qwik holds every
 * render until a `useTask$` settles, so a task awaiting the proposals read
 * froze the tabs, the library and the blocks for as long as the read took.
 * DO_0001_001 DO_0001_003
 */
const draft: DocumentView = {
  documentId: "doc-wait",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "neutral", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "neutral", runs: [{ text: "Closing." }] },
  ],
};

const HELD_MS = 2000;

let last: { settle: () => Promise<void> } | null = null;

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, HELD_MS + 200));
  await last?.settle().catch(() => undefined);
  last = null;
  vi.unstubAllGlobals();
});

describe("Given the proposals read takes seconds", () => {
  it("When a block is opened, Then it opens before the read answers", async () => {
    const sent: SentCommand[] = [];
    let heldUntil = 0;
    vi.stubGlobal(
      "fetch",
      documentsApi(draft, sent, {
        proposalsDelayMs: () => {
          heldUntil = Date.now() + HELD_MS;
          return HELD_MS;
        },
      }),
    );
    const view = await mountEditor(draft, { awaitReads: false });
    last = { settle: () => view.settle() };
    const editing = () =>
      (view.root.querySelector("[data-block-editor]") as HTMLElement | null | undefined)
        ?.closest("[data-block-id]")
        ?.getAttribute("data-block-id") ?? null;

    await view.userEvent('[data-block-id="blk-b"] [data-block-reading]', "focus");
    await view.userEvent('[data-block-id="blk-b"] [data-block-reading]', "keydown", { key: "Enter" });
    for (let tick = 0; tick < 150 && editing() !== "blk-b"; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await view.userEvent(view.root, "harnessSettle");
    }

    expect(heldUntil).toBeGreaterThan(0);
    expect(editing()).toBe("blk-b");
    expect(Date.now()).toBeLessThan(heldUntil);
  });
});
