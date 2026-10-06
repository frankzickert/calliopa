import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A document dropped on a blank page (`DO_0043_004`) is adopted there as its
 * first block. Its own file, as `blank-drop.test.ts` is: a document with no
 * blocks mounted after other editors in one file never finished its read.
 */
const blank: DocumentView = { documentId: "doc-blank", revisionId: "rev-doc", title: "Blank", blocks: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a document dropped on a blank page", () => {
  it("Given a document with no blocks, When a document's library row is dropped on the page, Then the shell is asked to adopt it as the first block", async () => {
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(blank, sent));
    const view = await mountEditor(blank, { drawn: "[data-document-empty]" });
    view.record.drop = { itemId: "doc-2", overId: "block:end", source: "library" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.settle(() => sent.some((command) => command.url.endsWith("/adopt")));
    const adopted = sent.find((command) => command.url.endsWith("/adopt"));
    expect(adopted?.url).toBe("/api/focused-work/doc-blank/adopt");
    expect(adopted?.body).toEqual({ kind: "documents:document", childId: "doc-2", placement: { between: [null, null] } });
    await view.idle();
  });
});
