import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Every drawn row has a place (BO_0263_002): a block dropped on a proposed
 * insert, a revealed retired or discarded row, or a block with a rewrite
 * attached lands directly before it, between the keys of the rows the reader
 * saw — pressed in Qwik's render harness through the editor's own JSX, with
 * the drop handed over as the shell's drag model hands one.
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
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "The storm."), text("blk-c", "c", "Set aside.", "discarded")],
};

const retired = [text("blk-r", "ab", "Gone.")];
const newBlock = "node:run-claude|insert|node:blk-new";
const rewrite = "node:run-claude|replace|node:blk-b";

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 2,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      items: [
        { itemId: rewrite, groupId: "node:run-claude", kind: "replace", blockId: "blk-b", block: { ...text("blk-b", "b", "The storm, early."), revisionId: "rev-b2" } },
        { itemId: newBlock, groupId: "node:run-claude", kind: "insert", blockId: "blk-new", block: { ...text("blk-new", "bb", "A new line."), containmentId: "" } },
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
  const drop = async (itemId: string, overId: string) => {
    view.record.drop = { itemId, overId };
    const before = sent.length;
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.slice(before).some((command) => command.body["command"] === "move" || command.body["command"] === "placeProposal"));
    return sent.slice(before).find((command) => command.body["command"] === "move" || command.body["command"] === "placeProposal")?.body;
  };
  return { ...view, sent, drop };
}

describe("every drawn row has a place", () => {
  it("Given the rows revealed, Then a proposed insert, a retired and a discarded row are drop targets and a rewrite is not one of its own", async () => {
    const view = await mount();
    const targets = Array.from(view.root.querySelectorAll("[data-drop-target]")).map((element) => element.getAttribute("data-drop-target"));
    expect(targets).toEqual([
      "block:blk-a",
      "block:blk-r",
      "block:blk-b",
      `block:proposal:${newBlock}`,
      "block:blk-c",
      "block:end",
    ]);
    // Each carries the mark that lights while a drag is over it.
    for (const id of ["blk-r", `proposal:${newBlock}`, "blk-c"]) {
      expect(view.root.querySelector(`[data-drop-mark="${id}"]`)).not.toBeNull();
    }
    await view.idle();
  });

  it("Given the rows revealed, Then each row that is a place is drawn inside its slot, with the drop mark above it", async () => {
    // The room a bordered row keeps is the slot's where there is a slot
    // (`DO_0009_001`): the mark standing between the two margins is what stops
    // them collapsing, so a slotted row asked to keep the room itself pays it
    // twice. The harness has no layout engine, so what is pressed here is the
    // shape the rule keys on, and the gap itself is measured and walked.
    const view = await mount();
    const slots = Array.from(view.root.querySelectorAll(".drop-slot"));
    const rowOf = (slot: Element) => slot.lastElementChild?.getAttribute("class") ?? "";
    expect(slots.map((slot) => slot.firstElementChild?.getAttribute("class"))).toEqual(slots.map(() => "drop-mark"));
    // A rewrite in its block's place, a proposed insert, a revealed retired row
    // and a revealed discarded row: every row the reader may drop a block on.
    expect(slots.filter((slot) => rowOf(slot).includes("proposal-block")).length).toBe(2);
    expect(slots.some((slot) => rowOf(slot).includes("retired-row"))).toBe(true);
    expect(slots.some((slot) => rowOf(slot).includes("discarded-row"))).toBe(true);
    // A block row is not slotted: it holds its own mark, so nothing stands
    // between its margin and its neighbour's.
    for (const row of Array.from(view.root.querySelectorAll(".block-row"))) {
      expect(row.parentElement?.getAttribute("class")).not.toContain("drop-slot");
      expect(row.firstElementChild?.getAttribute("class")).toBe("drop-mark");
    }
    await view.idle();
  });

  it("When a block is dropped on each kind of row, Then it lands directly before that row, between the keys drawn", async () => {
    const view = await mount();
    const moveOf = (body: Record<string, unknown> | undefined) => body?.["placement"];
    // Before the proposed insert, after the block and its rewrite.
    expect(moveOf(await view.drop("blk-a", `block:proposal:${newBlock}`))).toEqual({ between: ["b", "bb"] });
    // Before the retired row.
    expect(moveOf(await view.drop("blk-b", "block:blk-r"))).toEqual({ between: ["a", "ab"] });
    // Before the discarded row, after the proposed insert.
    expect(moveOf(await view.drop("blk-a", "block:blk-c"))).toEqual({ between: ["bb", "c"] });
    // Before a block with its rewrite: the pair is one place.
    expect(moveOf(await view.drop("blk-a", "block:blk-b"))).toEqual({ between: ["ab", "b"] });
    // At the end, after the last row drawn.
    expect(moveOf(await view.drop("blk-a", "block:end"))).toEqual({ between: ["c", null] });
    await view.idle();
  });

  it("When a proposal is dropped on a retired row, Then its place is staged there, unanswered", async () => {
    const view = await mount();
    const body = await view.drop(`proposal:${newBlock}`, "block:blk-r");
    expect(body).toEqual({ command: "placeProposal", itemId: newBlock, placement: { between: ["a", "ab"] } });
    expect(view.sent.filter((command) => command.body["command"] === "answerProposal")).toEqual([]);
    await view.idle();
  });
});
