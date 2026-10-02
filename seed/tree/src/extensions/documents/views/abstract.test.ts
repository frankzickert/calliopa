import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A paper's abstract in the editor (`BO_0293_014`): a paragraph of its own
 * role while read and edited. The front matter is the person's *Paper* role
 * now (`calliopa-bootstrap`'s `BO_0312_030`), so the head draws no authors and
 * no fields of its own.
 */
const text = (blockId: string, order: string, words: string, role: "paragraph" | "abstract" = "paragraph"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role,
  standing: "keep",
  runs: [{ text: words }],
});

async function mount(blocks: readonly BlockView[]) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "A Manuscript", blocks: [...blocks] };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  return { view, sent };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an abstract", () => {
  it("is drawn with its role while read and while edited, so the stylesheet sets it apart", async () => {
    const { view } = await mount([text("blk-ab", "a", "We show that a record can emit a paper.", "abstract"), text("blk-b", "b", "Introduction.")]);
    const reading = view.root.querySelector('[data-block-id="blk-ab"] [data-block-reading]') as HTMLElement;
    expect(reading.getAttribute("data-role")).toBe("abstract");
    expect(reading.tagName).toBe("P");
    await activateBlock(view, "blk-ab");
    expect(view.root.querySelector('[data-block-id="blk-ab"] .block-text--active')?.getAttribute("data-role")).toBe("abstract");
    await view.idle();
  });
});

describe("the document's head", () => {
  it("draws no authors and no front matter fields: Paper carries them", async () => {
    const { view } = await mount([text("blk-a", "a", "Introduction.")]);
    expect(view.root.querySelector("[data-document-authors]")).toBeFalsy();
    expect(view.root.querySelector("[data-front-field]")).toBeFalsy();
    await view.idle();
  });
});
