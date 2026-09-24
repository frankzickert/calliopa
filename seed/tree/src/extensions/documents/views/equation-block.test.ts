import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, EquationBlockView } from "../server/assemble";
import { documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * A display equation in a document (`BO_0290_014`). It arrives already
 * typeset from the server, so the row draws markup rather than running a
 * renderer — that is what keeps it from moving the text around it — and the
 * block owns what a reader sees when the TeX could not be read.
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

const equation = (
  blockId: string,
  order: string,
  rest: Omit<EquationBlockView, "blockId" | "revisionId" | "containmentId" | "order" | "kind" | "standing">,
): BlockView => ({
  kind: "equation",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  standing: "keep",
  ...rest,
});

const SET = '<mjx-container class="MathJax" jax="SVG"><svg><path d="M1 1"></path></svg></mjx-container>';

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

describe("an equation in a document", () => {
  it("draws the equation the server set, and never its source", async () => {
    const view = await mount([
      text("blk-a", "a", "Einstein wrote:"),
      equation("blk-b", "b", { tex: "E = mc^2", svg: SET }),
    ]);
    const drawn = view.root.querySelector("[data-equation]") as HTMLElement;
    expect(drawn).toBeTruthy();
    // The markup came with the block: nothing here ran a renderer, so there is
    // no moment at which the block is a placeholder.
    expect(drawn.querySelector("svg")).toBeTruthy();
    expect(drawn.textContent ?? "").not.toContain("E = mc^2");
    // The source is the equation's accessible name, so it is readable by
    // something that cannot see the glyphs.
    const body = drawn.querySelector('[role="math"]') as HTMLElement;
    expect(body.getAttribute("aria-label")).toBe("E = mc^2");
  });

  it("keeps its place among the prose", async () => {
    const view = await mount([
      text("blk-a", "a", "Before."),
      equation("blk-b", "b", { tex: "x", svg: SET }),
      text("blk-c", "c", "After."),
    ]);
    const rows = [...view.root.querySelectorAll("[data-block-id]")].map((row) =>
      row.getAttribute("data-block-id"),
    );
    expect(rows).toEqual(["blk-a", "blk-b", "blk-c"]);
  });

  it("draws its number outside the box the equation scrolls in", async () => {
    const view = await mount([equation("blk-b", "b", { tex: "x", svg: SET, numbered: true, number: 3 })]);
    const drawn = view.root.querySelector("[data-equation]") as HTMLElement;
    const number = drawn.querySelector("[data-equation-number]") as HTMLElement;
    expect(number.getAttribute("data-equation-number")).toBe("3");
    expect(number.textContent).toBe("(3)");
    // Outside the scrolling body, so a long equation never scrolls its own
    // number out of sight.
    expect(drawn.querySelector('[role="math"]')?.contains(number)).toBe(false);
  });

  it("draws no number for an equation that asked for none", async () => {
    const view = await mount([equation("blk-b", "b", { tex: "x", svg: SET })]);
    expect(view.root.querySelector("[data-equation-number]") ?? null).toBeNull();
  });

  it("draws its caption", async () => {
    const view = await mount([
      equation("blk-b", "b", { tex: "x", svg: SET, caption: "Euler's identity" }),
    ]);
    expect(view.root.textContent ?? "").toContain("Euler's identity");
  });

  it("shows the source and one sentence when the TeX could not be read", async () => {
    const view = await mount([
      equation("blk-b", "b", {
        tex: "\\frac{1}{",
        failure: "This equation could not be set: the TeX could not be read.",
      }),
    ]);
    const drawn = view.root.querySelector("[data-equation-unset]") as HTMLElement;
    expect(drawn).toBeTruthy();
    // The source as it was written, never repaired and never guessed at.
    expect(drawn.textContent ?? "").toContain("\\frac{1}{");
    expect(drawn.textContent ?? "").toContain("could not be read");
    // And no equation is drawn beside it.
    expect(view.root.querySelector("[data-equation]") ?? null).toBeNull();
  });

  it("says so plainly when there is neither markup nor a reason", async () => {
    const view = await mount([equation("blk-b", "b", { tex: "x" })]);
    const drawn = view.root.querySelector("[data-equation-unset]") as HTMLElement;
    expect(drawn.textContent ?? "").toContain("could not be set");
  });

  it("takes no text editor, as a divider does not", async () => {
    const view = await mount([equation("blk-b", "b", { tex: "x", svg: SET })]);
    const row = view.root.querySelector('[data-block-id="blk-b"]') as HTMLElement;
    expect(row.querySelector("[contenteditable]") ?? null).toBeNull();
  });
});
