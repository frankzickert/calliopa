import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, EquationBlockView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * Referring to a numbered equation, and editing one that stands in a sentence
 * (`BO_0290_025`). Both are offered only where they mean something: a
 * reference needs a number to name, and the popover needs an equation to open
 * on.
 */
const SET = '<mjx-container class="MathJax" jax="SVG"><svg><path d="M1 1"></path></svg></mjx-container>';

const sentence = (
  blockId: string,
  order: string,
  runs: { text: string; math?: true; equationRef?: string }[],
  mathSvg?: Record<string, string>,
): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs,
  ...(mathSvg === undefined ? {} : { mathSvg }),
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

async function mount(blocks: readonly BlockView[], equationNumbers?: Record<string, number>) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [...blocks],
    ...(equationNumbers === undefined ? {} : { equationNumbers }),
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

const bar = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("referring to a numbered equation", () => {
  it("offers the document's numbered equations, by number, with a glimpse of each", async () => {
    const view = await mount(
      [
        sentence("blk-a", "a", [{ text: "Draft." }]),
        equation("blk-e", "b", { tex: "e^{i\\pi} + 1 = 0", svg: SET, numbered: true, number: 1 }),
      ],
      { "blk-e": 1 },
    );
    await activateBlock(view, "blk-a");
    await view.settle(() => bar(view.root, "block-reference-equation") != null);

    const control = bar(view.root, "block-reference-equation") as HTMLElement;
    expect(control).toBeTruthy();
    expect(control.textContent ?? "").toContain("(1)");
    expect(control.textContent ?? "").toContain("e^{i\\pi}");
    await view.idle();
  });

  it("is not offered when the document has no number to name", async () => {
    const view = await mount([
      sentence("blk-a", "a", [{ text: "Draft." }]),
      equation("blk-e", "b", { tex: "x", svg: SET }),
    ]);
    await activateBlock(view, "blk-a");
    expect(bar(view.root, "block-reference-equation") ?? null).toBeNull();
    await view.idle();
  });
});

describe("editing an equation that stands in a sentence", () => {
  it("opens the popover on the one pressed, with its own source", async () => {
    const view = await mount([
      sentence(
        "blk-a",
        "a",
        [
          { text: "first " },
          { text: "a^2", math: true },
          { text: " then " },
          { text: "b^2", math: true },
        ],
        { "a^2": SET, "b^2": SET },
      ),
    ]);
    await activateBlock(view, "blk-a");
    const atoms = view.root.querySelectorAll("[data-block-editor] [data-math]");
    expect(atoms.length).toBe(2);

    // The second one: the popover opens on what was pressed, not on the first.
    // The harness builds its event without a target — it walks the parents
    // itself — so the press says what it landed on, as a browser would.
    await view.userEvent("[data-block-editor]", "click", { target: atoms[1] });
    await view.settle(() => view.root.querySelector("[data-equation-popover]") != null);
    const source = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    expect(source.value).toBe("b^2");
    // Inline mathematics carries no caption and no number of its own.
    expect(view.root.querySelector("[data-equation-caption]") ?? null).toBeNull();
    expect(view.root.querySelector("[data-equation-numbered]") ?? null).toBeNull();
    await view.settle(() => (view.root.querySelector("[data-equation-preview]")?.innerHTML ?? "") !== "");
    await view.idle();
  });

  it("opens nothing when the press lands on the words instead", async () => {
    const view = await mount([
      sentence("blk-a", "a", [{ text: "first " }, { text: "a^2", math: true }], { "a^2": SET }),
    ]);
    await activateBlock(view, "blk-a");
    const editable = view.root.querySelector("[data-block-editor]") as HTMLElement;
    await view.userEvent("[data-block-editor]", "click", { target: editable });
    await view.settle(() => true);
    expect(view.root.querySelector("[data-equation-popover]") ?? null).toBeNull();
    await view.idle();
  });
});
