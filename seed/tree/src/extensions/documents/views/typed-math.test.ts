import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * Words pasted with `$…$` in them arrive as mathematics (`BO_0290_024`).
 *
 * Only the paste is driven here. The conversion *as it is typed* depends on
 * where the caret stands, and this harness has no live selection —
 * `selectionIn` answers null — so no caret-dependent gesture can be pressed in
 * it. What decides that conversion is `lib/dollar-math.ts`, unit-tested rule
 * by rule, and the gesture itself is walked on a built origin (`BO_0290_019`).
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

async function mount() {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [text("blk-a", "a", "Draft.")],
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

const paste = async (view: Awaited<ReturnType<typeof mount>>, words: string) => {
  await view.userEvent("[data-block-editor]", "paste", {
    clipboardData: { getData: () => words },
  });
  await view.settle(() => true);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pasting words that carry mathematics", () => {
  it("brings every pair in as an equation, drawn typeset among the words", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    await paste(view, "where $a^2$ and $b^2$ meet");
    await view.settle(() => view.root.querySelectorAll("[data-math]").length === 2);

    const atoms = Array.from(view.root.querySelectorAll("[data-math]")).map((atom) =>
      atom.getAttribute("data-math"),
    );
    expect(atoms).toEqual(["a^2", "b^2"]);
    // The dollars are gone; the words around them are not.
    const editable = view.root.querySelector("[data-block-editor]") as HTMLElement;
    expect((editable.textContent ?? "").includes("$")).toBe(false);
    expect(editable.textContent ?? "").toContain("where ");
    expect(editable.textContent ?? "").toContain(" meet");
    await view.idle();
  });

  it("leaves a pasted sentence about money alone", async () => {
    const view = await mount();
    await activateBlock(view, "blk-a");
    await paste(view, "I paid $5 and $10");
    const editable = view.root.querySelector("[data-block-editor]") as HTMLElement;
    expect(editable.querySelector("[data-math]") ?? null).toBeNull();
    expect(editable.textContent ?? "").toContain("$5 and $10");
    await view.idle();
  });
});
