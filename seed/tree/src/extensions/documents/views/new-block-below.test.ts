import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

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
async function mount(documentId: string, blocks: readonly BlockView[], withProposal = true, drawn?: string) {
  const document: DocumentView = { documentId, revisionId: "rev-doc", title: "Below", blocks: [...blocks] };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent, withProposal ? { proposals: proposals(documentId) } : {}));
  const view = await mountEditor(document, drawn === undefined ? {} : { drawn });
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

/**
 * The whole rest of the surface (`DO_0028_001`): below the blank page and
 * below the area under the last block, down to the surface's bottom edge, a
 * press means what those two mean. The two stay the keyboard's way in.
 */
describe("a click in the rest of the surface", () => {
  const clickRest = async (view: Mounted, done: () => boolean) => {
    await view.userEvent("[data-document-rest]", "click");
    await view.settle(done);
  };

  it("Given a document with a last drawn row, Then the rest below it is a drop target out of tab order, And a click there opens a paragraph directly below that row", async () => {
    const view = await mount("doc-rest-1", [text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")], false);
    const rest = view.root.querySelector("[data-document-rest]");
    expect(rest?.getAttribute("data-drop-target")).toBe("block:end");
    expect(rest?.getAttribute("tabindex")).toBe("-1");
    expect(rest?.getAttribute("aria-hidden")).toBe("true");
    await clickRest(view, () => inserted(view) !== undefined);
    expect(inserted(view)).toMatchObject({ block: { kind: "text" }, placement: { between: ["b", null] } });
  });

  it("Given a new document holding its one empty block, When the rest below the blank page is clicked, Then the empty block is what opens", async () => {
    const view = await mount("doc-rest-2", [text("blk-a", "a", "")], false, "[data-document-empty]");
    await clickRest(view, () => view.root.querySelector('[data-block-id="blk-a"] [data-block-editor]') != null);
    expect(view.root.querySelector('[data-block-id="blk-a"] .block-text--active') ?? null).not.toBeNull();
    expect(inserted(view)).toBeUndefined();
  });

  it("Given a block being edited, When the rest of the surface is pressed, Then the edit ends and nothing is inserted", async () => {
    const view = await mount("doc-rest-3", [text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")], false);
    await activateBlock(view, "blk-a");
    await clickRest(view, () => view.root.querySelector(".block-text--active") == null);
    expect(inserted(view)).toBeUndefined();
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

  it("Given a focused row, When Add image is pressed, Then an empty image block is inserted directly below it", async () => {
    const view = await mount("doc-below-image", [text("blk-a", "a", "Opening."), table("blk-t", "b"), text("blk-c", "d", "Closing.")], false);
    await view.userEvent('[data-block-id="blk-t"]', "focusin");
    await view.settle();
    await view.userEvent('[data-bar-action="block-add-image"]', "click");
    await view.settle(() => view.sent.some((command) => command.body["command"] === "insert"));

    expect(inserted(view)).toMatchObject({ block: { kind: "image" }, placement: { between: ["b", "d"] } });
    expect(view.sent.some((command) => command.body["command"] === "answerProposal")).toBe(false);
  });

  it("Given a text block, Then its row is not a second stop in tab order: its words are", async () => {
    const view = await mount("doc-below-6", [text("blk-a", "a", "Opening.")], false);
    expect(view.root.querySelector('[data-block-id="blk-a"]')?.getAttribute("tabindex") ?? null).toBeNull();
  });
});
