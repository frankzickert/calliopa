import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * An equation the read never set — one typed a moment ago — is set by the
 * editing surface itself (`BO_0290_027`). This goes through the editor rather
 * than through the module, because the defect the walk found was the surface
 * never asking.
 */
const sentence = (blockId: string, order: string, runs: { text: string; math?: true }[]): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs,
});

async function mount(blocks: readonly BlockView[]) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [...blocks],
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mathematics the read never set", () => {
  it("is set by the surface and drawn typeset, not left as its source", async () => {
    const view = await mount([sentence("blk-a", "a", [{ text: "so " }, { text: "x^2", math: true }])]);
    await activateBlock(view, "blk-a");

    // Painted first with no markup — nothing has set it — and then again once
    // the surface has, which is the second paint the task asks for.
    await view.settle(
      () => (view.root.querySelector("[data-block-editor] [data-math]")?.innerHTML ?? "").includes("<svg"),
    );
    const atom = view.root.querySelector("[data-block-editor] [data-math]") as HTMLElement;
    expect(atom.getAttribute("data-math-unset") ?? null).toBeNull();
    expect(atom.innerHTML).toContain("<svg");
    await view.idle();
  });
});
