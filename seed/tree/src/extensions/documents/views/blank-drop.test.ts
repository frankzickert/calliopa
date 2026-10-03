import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A blank page is a drop target (found in the CA_0072 walk): a document with
 * no blocks draws its blank page, and a block dragged into it from another
 * document lands there as its first. Its own file, since a document with no
 * blocks mounted after other editors in one file never finished its read.
 */
const blankDocument: DocumentView = { documentId: "doc-blank", revisionId: "rev-doc", title: "Blank", blocks: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a block dropped on a blank page (found in the CA_0072 walk)", () => {
  it("Given a document with no blocks, Then the blank page is a drop target, And a block from another document dropped there moves in as its first block", async () => {
    const sent: SentCommand[] = [];
    const blank = blankDocument;
    vi.stubGlobal("fetch", documentsApi(blank, sent));
    const view = await mountEditor(blank, { drawn: "[data-document-empty]" });
    const page = view.root.querySelector("[data-document-empty]");
    expect(page?.getAttribute("data-drop-target")).toBe("block:end");
    view.record.drop = { itemId: "blk-far", overId: "block:end", from: "doc-2" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.some((command) => command.body["command"] === "moveIn"));
    const moved = sent.find((command) => command.body["command"] === "moveIn");
    expect(moved?.url).toBe("/api/x/documents/d/doc-blank/commands");
    expect(moved?.body).toEqual({ command: "moveIn", blockId: "blk-far", fromDocumentId: "doc-2", placement: { between: [null, null] } });
    // The move reads the proposals again; a read that outlives the test
    // reaches the unstubbed `fetch`, and its rejection is what exhausted the
    // runner's memory. CA_0079_001
    await view.idle();
  });
});
