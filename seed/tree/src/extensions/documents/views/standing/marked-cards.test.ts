import { afterEach, describe, expect, it, vi } from "vitest";

import type { Standing } from "../../lib/disposition";
import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A marked block is a card (`DO_0008_005`): a fixated block, a revealed
 * discarded block, a revealed retired block and a revealed prompt each carry
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
// F (c), the prompt P (cb) and the discarded D (d).
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    text("blk-a", "a", "Opening."),
    text("blk-f", "c", "The storm arrives first.", "fixate"),
    text("blk-p", "cb", "Write an intro.", "prompt"),
    text("blk-d", "d", "Set aside.", "discarded"),
  ],
};
const retired = [text("blk-r", "ab", "Gone.")];
const newBlock = "node:run-claude|insert|node:blk-new";

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
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals, retired }));
  const view = await mountEditor(draft);
  for (const toggle of ["proposed-changes", "retired-blocks", "discarded-blocks", "prompts"]) {
    await view.userEvent(`[data-bar-action="${toggle}"]`, "click");
  }
  await view.settle(() => view.root.querySelector('[data-retired-id="blk-r"]') !== null);
  await view.settle(() => view.root.querySelector('[data-block-id="blk-p"]') !== null);
  /** The label a row carries, and the word on it. */
  const label = (row: string) => view.root.querySelector(`${row} [data-card-label]`);
  const word = (row: string) => label(row)?.querySelector(".block-card-label__word")?.textContent ?? null;
  return { ...view, label, word };
}

describe("a marked block is a card", () => {
  it("Given the marked rows drawn, Then each carries its own label with the mark's word, and a kept block none", async () => {
    const view = await mount();
    expect(view.label('[data-block-id="blk-f"]')?.getAttribute("data-card-label")).toBe("fixate");
    expect(view.word('[data-block-id="blk-f"]')).toBe("fixated");
    expect(view.label('[data-discarded-id="blk-d"]')?.getAttribute("data-card-label")).toBe("discarded");
    expect(view.word('[data-discarded-id="blk-d"]')).toBe("discarded");
    expect(view.label('[data-retired-id="blk-r"]')?.getAttribute("data-card-label")).toBe("retired");
    expect(view.word('[data-retired-id="blk-r"]')).toBe("retired");
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
    expect(view.root.querySelector(".discarded-row__mark")).toBeFalsy();
    // The two revealed rows keep the one control each offers.
    expect(view.root.querySelector('[data-discarded-reopen="blk-d"]')).toBeTruthy();
    expect(view.root.querySelector('[data-retired-id="blk-r"] button')).toBeTruthy();
    await view.idle();
  });

  it("Given a revealed discarded row turned to, Then it carries the standing toolbar with discarded pressed, and a retired row carries none", async () => {
    const view = await mount();
    const toolbarOn = (row: string) =>
      (view.root.querySelector(`${row} [data-standing-toolbar]`) as HTMLElement | null) ?? null;
    expect(toolbarOn('[data-discarded-id="blk-d"]')).toBeNull();
    await view.userEvent('[data-discarded-id="blk-d"] .discarded-row__text', "focusin");
    await view.settle();
    const buttons = Array.from(
      toolbarOn('[data-discarded-id="blk-d"]')?.querySelectorAll("button") ?? [],
    );
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Discard",
      "Keep",
      "Fixate",
    ]);
    expect(
      buttons.find((button) => button.getAttribute("data-standing-option") === "discarded")
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    // A retired row is out of the document's flow and is no subject.
    expect(toolbarOn('[data-retired-id="blk-r"]')).toBeNull();
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
