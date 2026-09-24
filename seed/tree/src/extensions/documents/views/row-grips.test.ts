import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A grip on every row (BO_0263_013, BO_0263_015): every drawn row while
 * reading carries the ⠿ handle and the ↑↓ arrows, and moving a proposal, a
 * retired or a discarded block answers, restores and reopens nothing —
 * pressed in Qwik's render harness through the editor's own JSX.
 */
const text = (blockId: string, order: string, words: string, standing: "keep" | "discarded" = "keep"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing,
  runs: [{ text: words }],
});

// Drawn: A (a), the retired R (ab), the proposed N (b), C (c), the discarded D (d).
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Opening."), text("blk-c", "c", "Closing."), text("blk-d", "d", "Set aside.", "discarded")],
};
const retired = [text("blk-r", "ab", "Gone.")];
const newBlock = "node:run-claude|insert|node:blk-new";
const removal = "node:run-claude|remove|node:blk-c|c-c";

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 2,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      items: [
        { itemId: newBlock, groupId: "node:run-claude", kind: "insert", blockId: "blk-new", block: { ...text("blk-new", "b", "A new line."), containmentId: "" } },
        { itemId: removal, groupId: "node:run-claude", kind: "remove", blockId: "blk-c", block: null },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, retired }));
  const view = await mountEditor(draft);
  for (const toggle of ["proposed-changes", "retired-blocks", "discarded-blocks"]) {
    await view.userEvent(`[data-bar-action="${toggle}"]`, "click");
  }
  await view.settle(() => view.root.querySelector(`[data-retired-id="blk-r"]`) !== null);
  const named = (name: string) => sent.filter((command) => command.body["command"] === name).map((command) => command.body);
  const grip = (row: string) => view.root.querySelector(`${row} [data-row-grip]`);
  /** Waits past the pause a proposal's step is staged after. */
  const until = async (done: () => boolean) => {
    for (let tick = 0; tick < 100 && !done(); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await view.settle();
    }
    expect(done()).toBe(true);
  };
  return { ...view, sent, named, grip, until };
}

describe("a grip on every row", () => {
  it("Given the rows revealed, Then each block, the proposed insert, the retired and the discarded row carry a grip, and the removal none of its own", async () => {
    const view = await mount();
    for (const row of ['[data-block-id="blk-a"]', `[data-proposal-id="${newBlock}"]`, '[data-retired-id="blk-r"]', '[data-discarded-id="blk-d"]', '[data-block-id="blk-c"]']) {
      expect(view.grip(row), row).not.toBeNull();
    }
    // The removal frames C; the grip in it is C's own.
    const frame = view.root.querySelector(`[data-proposal-id="${removal}"]`);
    expect(Array.from(frame?.querySelectorAll("[data-row-grip]") ?? []).map((element) => element.closest("[data-block-id]")?.getAttribute("data-block-id"))).toEqual(["blk-c"]);
    // The arrows stop at the ends of the drawn rows, and take no tab stop.
    expect(view.root.querySelector('[data-block-id="blk-a"] [data-row-up]')?.hasAttribute("disabled")).toBe(true);
    expect(view.root.querySelector('[data-discarded-id="blk-d"] [data-row-down]')?.hasAttribute("disabled")).toBe(true);
    expect(view.root.querySelector('[data-block-id="blk-a"] [data-row-handle]')?.getAttribute("tabindex")).toBe("-1");
    await view.idle();
  });

  it("When the retired row is dragged and dropped, Then it moves and stays retired", async () => {
    const view = await mount();
    await view.userEvent('[data-retired-id="blk-r"] [data-row-handle]', "pointerdown");
    expect(view.record.drags).toEqual(["retired:blk-r"]);
    view.record.drop = { itemId: "retired:blk-r", overId: "block:blk-c" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => view.named("moveRetired").length > 0);
    expect(view.named("moveRetired")).toEqual([
      { command: "moveRetired", blockId: "blk-r", baseRevisionId: "rev-blk-r", placement: { between: ["b", "c"] } },
    ]);
    expect(view.named("restore")).toEqual([]);
    await view.idle();
  });

  it("When the arrows are pressed, Then a block steps past the proposed insert, a discarded block moves and stays discarded, and a proposal's place is staged unanswered", async () => {
    const view = await mount();
    await view.userEvent('[data-block-id="blk-c"] [data-row-up]', "click");
    await view.settle(() => view.named("move").length > 0);
    expect(view.named("move")[0]).toMatchObject({ blockId: "blk-c", placement: { between: ["ab", "b"] } });

    await view.userEvent('[data-discarded-id="blk-d"] [data-row-up]', "click");
    await view.until(() => view.named("move").length > 1);
    expect(view.named("move")[1]).toMatchObject({ blockId: "blk-d" });
    expect(view.named("setStanding")).toEqual([]);

    await view.userEvent(`[data-proposal-id="${newBlock}"] [data-row-up]`, "click");
    await view.until(() => view.named("placeProposal").length > 0);
    expect(view.named("placeProposal")[0]).toMatchObject({ itemId: newBlock });
    expect(view.named("answerProposal")).toEqual([]);
    await view.idle();
  });

  it("When the retired row is restored, Then it comes back where it is drawn", async () => {
    const view = await mount();
    await view.userEvent('[data-retired-restore="blk-r"]', "click");
    await view.settle(() => view.named("restore").length > 0);
    expect(view.named("restore")).toEqual([{ command: "restore", blockId: "blk-r", placement: { between: ["a", "b"] } }]);
    await view.idle();
  });
});
