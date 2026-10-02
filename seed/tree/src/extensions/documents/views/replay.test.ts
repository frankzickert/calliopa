import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentActivity } from "~/server/agent/run-events";
import type { DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A finished run played back in the editor, pressed in Qwik's render harness
 * (`BO_0340_008`): the document as it stood, read-only, its command typed into
 * the block it was sent from, and the run's reads and staged items arriving
 * at their steps, the chip moving to how the run ended — with nothing the
 * reader could write, answer or send.
 */
const block = (blockId: string, order: string, text: string) => ({
  kind: "text" as const,
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph" as const,
  standing: "keep" as const,
  runs: [{ text }],
});

/** The document as it stands now: the run's rewrite accepted long since. */
const now: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [block("blk-a", "a", "Opening."), block("blk-b", "b", "The storm arrives early."), block("blk-p", "c", "tighten the storm")],
};

/** The document as it stood when the run started. */
const then: DocumentView = {
  ...now,
  blocks: [block("blk-a", "a", "Opening."), block("blk-b", "b", "The storm arrives."), block("blk-p", "c", "tighten the storm")],
};

const rewrite = "node:run-old|replace|node:blk-b";
const insert = "node:run-old|insert|node:blk-n";
const staged: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-old",
      stagedBy: ["agent:claude-code"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" },
      run: { runId: "arun-old", stagedAt: 10 },
      items: [
        { itemId: rewrite, groupId: "node:run-old", kind: "replace", blockId: "blk-b", block: { ...block("blk-b", "b", "The storm arrives early."), revisionId: "rev-b2" } },
        { itemId: insert, groupId: "node:run-old", kind: "insert", blockId: "blk-n", block: { ...block("blk-n", "bb", "The sky goes dark."), containmentId: "" } },
      ],
    },
  ],
};

const reading: DocumentActivity = { document: "doc-1", scope: "blocks", action: "read", blocks: ["blk-b"] };
const staging: DocumentActivity = { document: "doc-1", scope: "blocks", action: "replace", blocks: ["blk-b"], group: "node:run-old", member: "node:blk-b" };
const inserting: DocumentActivity = { document: "doc-1", scope: "blocks", action: "insert", blocks: ["blk-n"], group: "node:run-old", member: "node:blk-n" };

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(now, sent, { replay: { document: then, proposals: staged }, proposals: { documentId: "doc-1", unanswered: 0, groups: [] } }));
  const view = await mountEditor(now, { replay: { runId: "arun-old", block: "blk-p" } });
  const step = async (next: NonNullable<typeof view.record.replayStep>) => {
    view.record.replayStep = next;
    await view.userEvent("[data-harness-replay]", "click");
    await view.settle();
    await view.idle();
  };
  const words = (blockId: string) => view.root.querySelector(`[data-block-id="${blockId}"]`)?.textContent ?? "";
  const proposal = (itemId: string) => view.root.querySelector(`[data-proposal-id="${itemId}"]`) ?? null;
  return { ...view, sent, step, words, proposal };
};

describe("a replayed run in the editor", () => {
  it("Given a replay, Then the document is drawn as it stood and nothing in it takes a press", async () => {
    const view = await mount();
    expect(view.words("blk-b")).toContain("The storm arrives.");
    expect(view.words("blk-b")).not.toContain("early");
    const surface = view.root.querySelector("[data-view-body='block-editor']") as HTMLElement;
    expect(surface.hasAttribute("data-replay")).toBe(true);
    expect(surface.inert).toBe(true);
    // Nothing but the replay's own read reached the documents API.
    expect(view.sent).toEqual([]);
    await view.idle();
  });

  it("Given the words typed and the run's steps, Then the block reads what is typed, the read mark and the staged rewrite arrive at their steps, and nothing is written", { timeout: 15000 }, async () => {
    const view = await mount();
    await view.step({ words: "" });
    expect(view.words("blk-p")).not.toContain("tighten");
    await view.step({ words: "tig" });
    expect(view.words("blk-p")).toContain("tig");
    expect(view.words("blk-p")).not.toContain("tighten");
    await view.step({ words: "tighten the storm", run: { running: true, events: [reading] } });
    expect(view.root.querySelector(`.agent-read-mark[data-agent-read="blk-b"]`)).not.toBeNull();
    expect(view.proposal(rewrite)).toBeNull();
    await view.step({ run: { running: true, events: [reading, staging] } });
    expect(view.proposal(rewrite)).not.toBeNull();
    // The insert is staged a step later, and stands only then.
    expect(view.proposal(insert)).toBeNull();
    await view.step({ run: { running: true, events: [reading, staging, inserting] } });
    expect(view.proposal(insert)).not.toBeNull();
    await view.step({ run: { running: false, events: [reading, staging, inserting] } });
    expect(view.proposal(rewrite)).not.toBeNull();
    // The chip says how the run ended, with what it left to answer.
    expect(JSON.stringify(view.record.chips ?? [])).toContain("rewrite");
    expect(view.sent).toEqual([]);
    await view.idle();
  });

  it("Given a whole-run answer pressed on its chip, Then the replay answers nothing", async () => {
    const view = await mount();
    await view.step({ words: "tighten the storm", run: { running: false, events: [reading, staging] } });
    view.record.answerAll = { group: "node:run-old", answer: "accepted" };
    await view.userEvent("[data-harness-answer-all]", "click");
    await view.settle();
    await view.idle();
    expect(view.sent).toEqual([]);
  });
});
