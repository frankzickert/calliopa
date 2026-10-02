import { afterEach, describe, expect, it, vi } from "vitest";

import type { Standing } from "../../lib/disposition";
import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A marked block is a card (`DO_0008_005`): a fixated block, a revealed
 * removed row — a retired block or a rejected proposal — and a revealed
 * prompt each carry
 * their label on the row itself — the mark's glyph and its word — and nothing
 * stands to the left of a block any more. A kept block carries no label at
 * all, and a proposal keeps its own chip on its bottom border, so the
 * reader's own mark and something proposed to them stay two looks.
 *
 * Pressed in Qwik's render harness through the editor's own JSX. The card's
 * weight — the border's style per mark, the label centred on the top border —
 * is CSS and is judged in the walk (`DO_0008_008`).
 */
const text = (blockId: string, order: string, words: string, standing: Standing = "keep"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing,
  runs: [{ text: words }],
});

// Drawn: the kept A (a), the retired R (ab), the proposed N (b), the fixated
// F (c), the prompt P (cb) and the rejected insert X (d).
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    text("blk-a", "a", "Opening."),
    text("blk-f", "c", "The storm arrives first.", "fixate"),
    text("blk-p", "cb", "Write an intro.", "prompt"),
  ],
};
const retired = [text("blk-r", "ab", "Gone.")];
const newBlock = "node:run-claude|insert|node:blk-new";
const turnedDown = "node:run-old|insert|node:blk-x";
const rejected = [
  { itemId: turnedDown, groupId: "node:run-old", kind: "insert", blockId: "blk-x", block: { ...text("blk-x", "d", "Turned down."), containmentId: "" } },
];

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      items: [
        { itemId: newBlock, groupId: "node:run-claude", kind: "insert", blockId: "blk-new", block: { ...text("blk-new", "b", "A new line."), containmentId: "" } },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, retired, rejected }));
  const view = await mountEditor(draft);
  for (const toggle of ["proposed-changes", "removed", "prompts"]) {
    await view.userEvent(`[data-bar-action="${toggle}"]`, "click");
  }
  await view.settle(() => view.root.querySelector('[data-retired-id="blk-r"]') !== null);
  await view.settle(() => view.root.querySelector('[data-block-id="blk-p"]') !== null);
  await view.settle(() => view.root.querySelector(`[data-rejected-id="${turnedDown}"]`) !== null);
  /** The label a row carries, and the word on it. */
  const label = (row: string) => view.root.querySelector(`${row} [data-card-label]`);
  const word = (row: string) => label(row)?.querySelector(".block-card-label__word")?.textContent ?? null;
  return { ...view, sent, label, word };
}

/** Waits for what a read after an answer draws, past the harness's settle. */
async function until(view: { settle: () => Promise<unknown> }, done: () => boolean): Promise<void> {
  for (let tick = 0; tick < 100 && !done(); tick++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await view.settle();
  }
  expect(done()).toBe(true);
}

describe("a marked block is a card", () => {
  it("Given the marked rows drawn, Then each carries its own label with the mark's word, and a kept block none", async () => {
    const view = await mount();
    expect(view.label('[data-block-id="blk-f"]')?.getAttribute("data-card-label")).toBe("fixate");
    expect(view.word('[data-block-id="blk-f"]')).toBe("fixated");
    // A retired block and a rejected proposal are one removed state.
    // BO_0315_015
    expect(view.label('[data-retired-id="blk-r"]')?.getAttribute("data-card-label")).toBe("removed");
    expect(view.word('[data-retired-id="blk-r"]')).toBe("removed");
    expect(view.label(`[data-rejected-id="${turnedDown}"]`)?.getAttribute("data-card-label")).toBe("removed");
    expect(view.word(`[data-rejected-id="${turnedDown}"]`)).toBe("removed");
    expect(view.label('[data-block-id="blk-p"]')?.getAttribute("data-card-label")).toBe("prompt");
    expect(view.word('[data-block-id="blk-p"]')).toBe("prompt");
    // A mark means someone acted, so where nobody did there is nothing.
    expect(view.label('[data-block-id="blk-a"]')).toBeFalsy();
    await view.idle();
  });

  it("Given the marked rows drawn, Then nothing marks a block to its left: no gutter mark and no inline word", async () => {
    const view = await mount();
    expect(view.root.querySelector(".block-standing")).toBeFalsy();
    expect(view.root.querySelector(".block-standing__word")).toBeFalsy();
    expect(view.root.querySelector(".retired-row__mark")).toBeFalsy();
    // Nothing of the discarded standing is drawn. BO_0315_009
    expect(view.root.querySelector(".discarded-row, [data-discarded-id]")).toBeFalsy();
    expect(view.root.querySelector('[data-bar-action="discarded-blocks"]')).toBeFalsy();
    await view.idle();
  });

  it("Given a removed row turned to, Then its bar holds Restore and no standing; a retired block's moves, a rejected proposal's reopens it", async () => {
    const view = await mount();
    const barOn = (row: string) => (view.root.querySelector(`${row} [data-block-bar]`) as HTMLElement | null) ?? null;
    expect(barOn('[data-retired-id="blk-r"]')).toBeNull();
    await view.userEvent('[data-retired-id="blk-r"] .retired-row__text', "focusin");
    await view.settle(() => barOn('[data-retired-id="blk-r"]') !== null);
    expect(Array.from(barOn('[data-retired-id="blk-r"]')?.querySelectorAll("button") ?? []).map((button) => button.textContent?.trim())).toEqual(["↑", "↓", "Restore"]);
    expect(barOn('[data-retired-id="blk-r"]')?.querySelector("[data-standing-option]")).toBeFalsy();

    const row = `[data-rejected-id="${turnedDown}"]`;
    await view.userEvent(`${row} .retired-row__text`, "focusin");
    await view.settle(() => barOn(row) !== null);
    // A rejected proposal is reopened, never moved. BO_0315_015
    expect(Array.from(barOn(row)?.querySelectorAll("button") ?? []).map((button) => button.textContent?.trim())).toEqual(["Restore"]);
    await view.userEvent(`${row} [data-block-restore]`, "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "reopen"));
    expect(view.sent.find((command) => command.body["command"] === "reopen")?.body).toMatchObject({ itemId: turnedDown });
    // It stands again as an open proposal, and no longer among the removed.
    // This DOM answers undefined, not null, when nothing matches (BO_0224).
    await until(view, () => view.root.querySelector(row) == null);
    expect(view.root.querySelector('[data-proposal-id="node:chg-reopened|insert|node:blk-x"]')).toBeTruthy();
    await view.idle();
  });

  it("Given a proposal beside them, Then it carries no card label and keeps its chip on its bottom border", async () => {
    const view = await mount();
    const proposal = view.root.querySelector(`[data-proposal-id="${newBlock}"]`);
    expect(proposal).toBeTruthy();
    expect(proposal?.querySelector("[data-card-label]")).toBeFalsy();
    expect(proposal?.querySelector(".proposal-block__mark")).toBeTruthy();
    await view.idle();
  });
});
