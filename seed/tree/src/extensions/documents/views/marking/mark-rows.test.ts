import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, pointFrom, stopPointing, type SentCommand } from "../testing/editor-harness";

/**
 * Command mode marks every row the editor draws (BO_0263_005): a proposed
 * change by its face or its words, a revealed retired or discarded block by
 * its words, and a block a removal frames by its own words, apart from the
 * frame — pressed in Qwik's render harness through the editor's own JSX. A
 * reference is what was marked, and stays when its row goes. BO_0263_004
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
  // Pointing from the opening block, as the reader does from its command
  // control. BO_0267_013
  await pointFrom(view, "blk-a");
  const reported = () => view.record.pointing?.references ?? [];
  return { ...view, sent, reported };
}

describe("marking every drawn row", () => {
  it("Given command mode, When each kind of row is pressed, Then each is its own reference, carrying what was marked", async () => {
    const view = await mount();
    // A proposal's words are for pointing, never typing, in command mode.
    expect(view.root.querySelector(`[data-proposal-text="${newBlock}"]`)?.getAttribute("contenteditable")).toBe("false");

    await view.userEvent(`[data-proposal-face="${newBlock}"]`, "click");
    await view.userEvent(`[data-proposal-face="${removal}"]`, "click");
    // The block the removal frames is marked by its own words, apart.
    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.userEvent('[data-retired-id="blk-r"] [data-mark-text]', "click");
    await view.userEvent('[data-discarded-id="blk-d"] [data-mark-text]', "click");
    await view.settle(() => view.reported().length === 5);

    expect(view.reported().map((reference) => [reference.number, reference.blockId, reference.target, reference.item, reference.revisionId, reference.what])).toEqual([
      [1, "blk-new", "proposal", newBlock, "rev-blk-new", "proposal"],
      [2, "blk-c", "proposal", removal, "rev-blk-c", "proposal"],
      [3, "blk-c", undefined, undefined, "rev-blk-c", undefined],
      [4, "blk-r", "retired", undefined, "rev-blk-r", "retired"],
      [5, "blk-d", undefined, undefined, "rev-blk-d", "discarded"],
    ]);
    // Each row carries its number and says it, by more than colour.
    expect(view.root.querySelector(`[data-proposal-id="${newBlock}"]`)?.getAttribute("data-reference")).toBe("1");
    expect(view.root.querySelector(`[data-proposal-id="${removal}"]`)?.getAttribute("data-reference")).toBe("2");
    expect(view.root.querySelector('[data-block-id="blk-c"]')?.getAttribute("data-reference")).toBe("3");
    expect(view.root.querySelector('[data-retired-id="blk-r"]')?.getAttribute("data-reference")).toBe("4");
    expect(view.root.querySelector('[data-discarded-id="blk-d"]')?.getAttribute("data-reference")).toBe("5");
    expect(view.root.querySelector(`[data-proposal-face="${newBlock}"]`)?.getAttribute("aria-label")).toBe("Proposed new block by Claude Code, reference 1");
    expect(view.root.querySelector(`[data-proposal-face="${newBlock}"]`)?.getAttribute("aria-pressed")).toBe("true");
    expect(view.root.querySelector('[data-retired-id="blk-r"] [data-mark-text]')?.getAttribute("aria-label")).toBe("Retired block: “Gone.”, reference 4");
    expect(view.root.querySelector('[data-discarded-id="blk-d"] [data-mark-text]')?.getAttribute("aria-label")).toBe("Discarded block: “Set aside.”, reference 5");

    // Pressing a proposal's face again takes back only the proposal.
    await view.userEvent(`[data-proposal-face="${removal}"]`, "click");
    await view.settle(() => view.reported().length === 4);
    expect(view.reported().map((reference) => reference.number)).toEqual([1, 3, 4, 5]);
    await view.idle();
  });

  it("Given a marked proposal, When it is rejected, Then its reference stays, rowless and since rejected, and the chip's × takes it back", async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-face="${newBlock}"]`, "click");
    await view.settle(() => view.reported().length === 1);
    await stopPointing(view);
    await view.userEvent(`[data-proposal-reject="${newBlock}"]`, "click");
    await view.settle(() => view.reported()[0]?.since === "rejected");
    expect(view.reported()[0]).toMatchObject({ number: 1, target: "proposal", rowless: true, words: "A new line." });

    view.record.reveal = { kind: "takeBack", number: 1 };
    await view.userEvent("[data-harness-reveal]", "click");
    await view.settle(() => view.reported().length === 0);
    await view.idle();
  });

  it("Given a marked proposal, When it is accepted, Then the number moves to the block it became", async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-face="${newBlock}"]`, "click");
    await view.settle(() => view.reported().length === 1);
    await stopPointing(view);
    await view.userEvent(`[data-proposal-accept="${newBlock}"]`, "click");
    await view.settle(() => view.reported()[0]?.target === undefined);
    expect(view.reported()[0]).toMatchObject({ number: 1, blockId: "blk-new", revisionId: "rev-blk-new" });
    await pointFrom(view, "blk-a");
    await view.settle(() => view.root.querySelector('[data-block-id="blk-new"]')?.getAttribute("data-reference") === "1");
    await view.idle();
  });
});
