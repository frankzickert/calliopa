import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor } from "../testing/editor-harness";

/**
 * A proposed picture draws itself (`BO_0273_039`).
 *
 * A proposal drew its own content only when the block was text, so a proposed
 * generation — an `image` block with no reference yet — fell through to the
 * slot and arrived as an empty line with a chip on it. Found live on
 * 2026-09-22, the first time a model was sent a block.
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

const document: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "A laurel on a dark ground.")],
};

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:media-1",
      stagedBy: ["frankzickert"],
      proposer: { kind: "person", name: "frankzickert" },
      items: [
        {
          itemId: "item-1",
          groupId: "node:media-1",
          kind: "insert",
          blockId: "blk-new",
          block: {
            kind: "image",
            blockId: "blk-new",
            revisionId: "rev-new",
            containmentId: "",
            order: "b",
            alt: "A laurel on a dark ground.",
          },
        },
      ],
    },
  ],
};

/** The same proposal once the generation landed: the block filled, on a new
 * revision, as `fillMediaBlock` writes it. */
const filled: DocumentProposals = {
  ...proposals,
  groups: proposals.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      block: { ...(item.block as BlockView), revisionId: "rev-new-filled", objectId: "obj-laurel", mediaType: "image/png" } as BlockView,
    })),
  })),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a proposed picture", () => {
  it("draws its own pending box, not an empty row", async () => {
    vi.stubGlobal("fetch", documentsApi(document, [], { proposals }));
    const view = await mountEditor(document);
    // Shown as a reader shows them.
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-id]") !== null);
    const drawn = view.root.querySelector("[data-media-pending]");
    expect(drawn).toBeTruthy();
    // The words it will be made from, so the row says what it is.
    expect((drawn as HTMLElement).textContent ?? "").toContain("A laurel");
  });

  it("Given its box is shown, When the picture lands and the shell says the process ended, Then the picture draws where the box stood (CA_0063_005)", async () => {
    let landed = false;
    vi.stubGlobal("fetch", documentsApi(document, [], { proposals, proposalsRead: () => (landed ? filled : undefined) }));
    const view = await mountEditor(document);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-media-pending]") !== null);
    // The sender's process ends: the poll tells the view, which reads again.
    landed = true;
    await view.userEvent("[data-harness-proposed]", "click");
    await view.settle(() => view.root.querySelector("[data-media-image]") !== null);
    expect(view.root.querySelector("[data-media-pending]")).toBeFalsy();
    expect(view.root.querySelector("[data-media-image]")?.getAttribute("src")).toBe("/api/blobs/obj-laurel");
  });
});
