import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * A document a run started from a command, before anybody takes it
 * (`BO_0251_010`): its body is the run's proposal whatever the toggle holds,
 * the headline says who proposed it, and it becomes the ordinary document
 * once an item or its title is taken — or the unknown document once every
 * item is rejected.
 */
const started: DocumentView = {
  documentId: "doc-started",
  revisionId: "rev-started",
  title: "Onboarding checklist",
  blocks: [],
  proposed: { group: "node:run-start", proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" } },
};

const first = "node:run-start|insert|node:blk-1";
const second = "node:run-start|insert|node:blk-2";
const proposals: DocumentProposals = {
  documentId: "doc-started",
  unanswered: 2,
  groups: [
    {
      groupId: "node:run-start",
      stagedBy: ["claude"],
      proposer: started.proposed?.proposer ?? { kind: "person", name: "" },
      items: [
        { itemId: first, groupId: "node:run-start", kind: "insert", blockId: "blk-1", block: { kind: "text", blockId: "blk-1", revisionId: "rev-1", containmentId: "", order: "i", role: "h2", standing: "keep", runs: [{ text: "First day" }] } },
        { itemId: second, groupId: "node:run-start", kind: "insert", blockId: "blk-2", block: { kind: "text", blockId: "blk-2", revisionId: "rev-2", containmentId: "", order: "u", role: "paragraph", standing: "keep", runs: [{ text: "Get a laptop" }] } },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async () => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(started, sent, { proposals }));
  const view = await mountEditor(started);
  // No toggle is pressed: a started document shows its proposals regardless.
  await view.settle(() => view.root.querySelector(`[data-proposal-id="${second}"]`) != null);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  return { ...view, sent, waitFor };
};

describe("a started document in the block editor", () => {
  it("Given a started document, Then every block is the run's proposal, the headline names the proposer, and no blank page is offered", async () => {
    const view = await mount();
    expect(view.root.querySelector(`[data-proposal-id="${first}"]`)).not.toBeNull();
    expect(view.root.querySelector(`[data-proposal-id="${second}"]`)).not.toBeNull();
    expect(view.root.querySelector("[data-document-empty]") ?? null).toBeNull();
    const headline = view.root.querySelector("[data-document-proposed]") as HTMLElement | null;
    expect(headline?.textContent).toContain("Proposed by Claude Code (claude-sonnet-5)");
    expect(headline?.getAttribute("data-proposal-tone")).toBe("claude");
    expect(headline?.querySelector("img")).not.toBeNull();
    // The title still takes the caret.
    expect(view.root.querySelector("[data-document-title]")?.getAttribute("contentEditable")).toBe("true");
  });

  it("Given an item accepted, Then the document is taken: the headline is the ordinary one and the block is the document's", async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-accept="${first}"]`, "click");
    await view.waitFor(() => view.root.querySelector("[data-document-proposed]") == null);
    expect(view.root.querySelector('[data-block-id="blk-1"]')).not.toBeNull();
    expect(view.sent.filter((command) => command.body["command"] === "answerProposal")).toHaveLength(1);
  });

  it("Given the title retitled, Then the rename is sent on the started revision and the document is taken", async () => {
    const view = await mount();
    const title = view.root.querySelector("[data-document-title]") as HTMLElement;
    title.textContent = "New staff checklist";
    await view.userEvent(title, "blur");
    await view.waitFor(() => view.root.querySelector("[data-document-proposed]") == null);
    const rename = view.sent.find((command) => command.body["command"] === "rename");
    expect(rename?.body).toMatchObject({ baseRevisionId: "rev-started", title: "New staff checklist" });
    // Its blocks are still proposals, now into the document.
    expect(view.root.querySelector(`[data-proposal-id="${second}"]`)).not.toBeNull();
  });

  it("Given every item rejected, Then the tab shows the unknown document, as a document deleted elsewhere", async () => {
    const view = await mount();
    await view.userEvent(`[data-proposal-reject="${first}"]`, "click");
    await view.waitFor(() => view.root.querySelector(`[data-proposal-id="${first}"]`) == null);
    expect(view.root.querySelector("[data-document-proposed]")).not.toBeNull();
    await view.userEvent(`[data-proposal-reject="${second}"]`, "click");
    await view.waitFor(() => view.root.querySelector("[data-block-error]") != null);
    expect(view.root.querySelector("[data-block-error]")?.textContent).toContain("deleted");
  });
});
