import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A new block lands below (`DO_0016_006`): a click below the lowest drawn row
 * opens a paragraph directly below that row, whatever it is — a proposal the
 * reader can see included — and a row that has no words to read takes the
 * focus from a tap, so the bar's *Add …* can place below it. What the reader
 * sees is what counts: a hidden proposal is not a row to go below, and still
 * follows the new block once it is shown.
 */

const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: words === "" ? [] : [{ text: words }],
});

const table = (blockId: string, order: string): BlockView => ({
  kind: "table",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  columns: [
    { name: "City", type: "text" },
    { name: "Population", type: "number" },
  ],
  rows: [["Berlin", "3755000"]],
});

const insertItem = "node:run-claude|insert|node:blk-p";

/** One proposed paragraph at key `c`, below every block of the fixtures. */
const proposals = (documentId: string): DocumentProposals => ({
  documentId,
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-claude",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" },
      items: [
        {
          itemId: insertItem,
          groupId: "node:run-claude",
          kind: "insert",
          blockId: "blk-p",
          block: { ...text("blk-p", "c", "A proposed ending."), revisionId: "rev-p" },
        },
      ],
    },
  ],
});

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

// Each test its own document: the editor keeps its in-flight writes by tab.
async function mount(documentId: string, blocks: readonly BlockView[], withProposal = true) {
  const document: DocumentView = { documentId, revisionId: "rev-doc", title: "Below", blocks: [...blocks] };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent, withProposal ? { proposals: proposals(documentId) } : {}));
  const view = await mountEditor(document);
  last = view;
  return { ...view, sent };
}

type Mounted = Awaited<ReturnType<typeof mount>>;

const showProposals = async (view: Mounted) => {
  await view.userEvent('[data-bar-action="proposed-changes"]', "click");
  await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
};

const clickBelow = async (view: Mounted) => {
  await view.userEvent("[data-document-append]", "click");
  await view.settle(() => view.sent.some((command) => command.body["command"] === "insert") || view.root.querySelector("[data-block-editor]") !== null);
};

const inserted = (view: Mounted) => view.sent.find((command) => command.body["command"] === "insert")?.body;

describe("a click below the lowest row", () => {
  it("Given a proposed paragraph drawn last, When the area below is clicked, Then a paragraph opens directly below the proposal", async () => {
    const view = await mount("doc-below-1", [text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")]);
    await showProposals(view);
    await clickBelow(view);
    expect(inserted(view)).toMatchObject({ block: { kind: "text" }, placement: { between: ["c", null] } });
    // Nothing is answered on the way. DO_0016_003
    expect(view.sent.some((command) => command.body["command"] === "answerProposal")).toBe(false);
  });

  it("Given an empty paragraph with a proposal drawn below it, When the area below is clicked, Then the paragraph opens below the proposal rather than reusing the empty one", async () => {
    const view = await mount("doc-below-2", [text("blk-a", "a", "Opening."), text("blk-b", "b", "")]);
    await showProposals(view);
    await clickBelow(view);
    expect(inserted(view)).toMatchObject({ placement: { between: ["c", null] } });
  });

  it("Given an empty paragraph last and the proposal below it hidden, When the area below is clicked, Then the empty paragraph is what opens", async () => {
    const view = await mount("doc-below-3", [text("blk-a", "a", "Opening."), text("blk-b", "b", "")]);
    await clickBelow(view);
    // The lowest row the reader sees is the empty paragraph: it is reused,
    // and nothing is inserted. DO_0016_002
    expect(inserted(view)).toBeUndefined();
    expect(view.root.querySelector('[data-block-id="blk-b"] [data-block-editor]')).not.toBeNull();
  });

  it("Given the proposal below hidden, When the area below is clicked, Then the paragraph goes below the last visible row and the hidden proposal still follows it", async () => {
    const view = await mount("doc-below-4", [text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")]);
    await clickBelow(view);
    expect(inserted(view)).toMatchObject({ placement: { between: ["b", "c"] } });
  });
});

describe("a row with no words to read", () => {
  it("Given a table, Then it is in tab order and a tap focuses it, bringing the Add controls up, and a paragraph goes directly below it", async () => {
    const view = await mount("doc-below-5", [text("blk-a", "a", "Opening."), table("blk-t", "b"), text("blk-c", "d", "Closing.")], false);
    const row = view.root.querySelector('[data-block-id="blk-t"]') as HTMLElement;
    expect(row.getAttribute("tabindex")).toBe("0");
    await view.userEvent('[data-block-id="blk-t"]', "focusin");
    await view.settle();
    expect(row.getAttribute("data-focused")).toBe("true");
    await view.userEvent('[data-bar-action="block-add-paragraph"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));
    expect(inserted(view)).toMatchObject({ placement: { between: ["b", "d"] } });
  });

  it("Given a text block, Then its row is not a second stop in tab order: its words are", async () => {
    const view = await mount("doc-below-6", [text("blk-a", "a", "Opening.")], false);
    expect(view.root.querySelector('[data-block-id="blk-a"]')?.getAttribute("tabindex") ?? null).toBeNull();
  });
});
