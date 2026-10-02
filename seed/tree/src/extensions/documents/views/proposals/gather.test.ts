import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { GATHERED_WORDS } from "../../lib/agent-at-work";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A gather is drawn and answered whole (BO_0322_013): its block shows the
 * summary in its place, saying how many blocks it gathers into new focused
 * work, and each row it moves is framed by it, saying so; the chip line
 * counts it once; answering it from its summary or from a framed row
 * answers the one item; and a framed row is not edited while it stands.
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

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "The storm arrives."), text("blk-c", "c", "The lights go out."), text("blk-d", "d", "Candles are found."), text("blk-e", "e", "Closing.")],
};

const gather = "node:run-pinch|gather|node:blk-c";
const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-pinch",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      items: [
        {
          itemId: gather,
          groupId: "node:run-pinch",
          kind: "gather",
          blockId: "blk-c",
          block: { ...text("blk-c", "c", "The night of the storm."), revisionId: "rev-c2" },
          gathered: ["blk-b", "blk-d"],
          createsChild: true,
        },
      ],
    },
  ],
};

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals }));
  const view = await mountEditor(draft);
  await view.userEvent('[data-bar-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
  const answers = () => sent.filter((command) => command.body["command"] === "answerProposal").map((command) => [command.body["itemId"], command.body["answer"]]);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, answers, waitFor };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a gather", () => {
  it("Given a gather, Then its block shows the summary in its place and each row it moves is framed by it", async () => {
    const view = await mount();
    const rows = Array.from(view.root.querySelectorAll(`[data-proposal-id="${gather}"]`));
    // The summary, and a frame around each of the two rows it moves.
    expect(rows).toHaveLength(3);
    const summary = rows.find((row) => !row.querySelector('[data-block-id="blk-b"], [data-block-id="blk-d"]')) as HTMLElement;
    expect(summary.textContent).toContain("The night of the storm.");
    expect(summary.textContent).toContain("Proposes a summary, gathering 2 blocks into new focused work");
    expect(view.root.querySelector('[data-block-id="blk-c"]')).toBeFalsy();
    for (const blockId of ["blk-b", "blk-d"]) {
      const frame = view.root.querySelector(`[data-proposal-id="${gather}"] [data-block-id="${blockId}"]`)?.closest(`[data-proposal-id="${gather}"]`);
      expect(frame?.textContent).toContain(GATHERED_WORDS);
    }
    await view.idle();
  });

  it("Given a row the gather moves, When it is turned to and Remove pressed, Then the gather is answered whole and the row is not edited", async () => {
    const view = await mount();
    await activateBlock(view, "blk-b").catch(() => undefined);
    expect(view.root.querySelector('[data-block-command="blk-b"]')).toBeFalsy();
    const frame = view.root.querySelector(`[data-proposal-id="${gather}"] [data-block-id="blk-b"]`)?.closest(`[data-proposal-id="${gather}"]`) as HTMLElement;
    await view.userEvent(frame, "focusin");
    await view.settle();
    const remove = frame.querySelector("[data-block-remove]") as HTMLElement | null;
    expect(remove).toBeTruthy();
    await view.userEvent(remove as HTMLElement, "click");
    await view.waitFor(() => view.answers().length > 0);
    expect(view.answers()).toEqual([[gather, "rejected"]]);
    await view.idle();
  });
});
