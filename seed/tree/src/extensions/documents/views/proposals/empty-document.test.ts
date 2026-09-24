import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A document that says nothing yet — one text block with no text, the state
 * a document is created in — with a run's proposal standing against it: the
 * blank page stands only while nothing proposed is shown, so the toggle
 * draws the proposal rather than leaving the reader a blank page (`DO_0002`).
 */
const empty: DocumentView = {
  documentId: "doc-empty",
  revisionId: "rev-doc",
  title: "Chat interface",
  blocks: [{ kind: "text", blockId: "blk-empty", revisionId: "rev-empty", containmentId: "c-empty", order: "i", role: "paragraph", standing: "keep", runs: [] }],
};

const rewrite = "node:run-ask|replace|node:blk-empty";
const insert = "node:run-ask|insert|node:blk-new";
const proposals: DocumentProposals = {
  documentId: "doc-empty",
  unanswered: 2,
  groups: [
    {
      groupId: "node:run-ask",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" },
      items: [
        { itemId: rewrite, groupId: "node:run-ask", kind: "replace", blockId: "blk-empty", block: { kind: "text", blockId: "blk-empty", revisionId: "rev-empty-2", containmentId: "c-empty", order: "i", role: "paragraph", standing: "keep", runs: [{ text: "Chat is the wrong interface." }] } },
        { itemId: insert, groupId: "node:run-ask", kind: "insert", blockId: "blk-new", block: { kind: "text", blockId: "blk-new", revisionId: "rev-new", containmentId: "", order: "r", role: "h2", standing: "keep", runs: [{ text: "Linear where the work isn't" }] } },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(empty, sent, { proposals }));
  return mountEditor(empty);
};

describe("an empty document with a proposal standing", () => {
  it("Given the toggle off, Then the document reads as the blank page it is", async () => {
    const view = await mount();
    expect(view.root.querySelector("[data-document-empty]")).not.toBeNull();
    expect(view.root.querySelector("[data-proposal-id]") ?? null).toBeNull();
  });

  it("Given the toggle pressed, Then the proposal is drawn in place of the blank page", async () => {
    const view = await mount();
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector(`[data-proposal-id="${insert}"]`) != null);
    expect(view.root.querySelector(`[data-proposal-id="${rewrite}"]`)).not.toBeNull();
    expect(view.root.querySelector(`[data-proposal-id="${insert}"]`)).not.toBeNull();
    expect(view.root.querySelector("[data-document-empty]") ?? null).toBeNull();
  });
});
