import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, EquationBlockView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * Editing mathematics in the popover (`BO_0290_016`). The panel stands beside
 * the equation and the source never enters the flow, which is why the line
 * does not reflow when someone edits it; closing saves, and TeX that cannot
 * be set is saved all the same.
 */
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

const equationBlock = equation;

const sentenceBlock = (
  blockId: string,
  order: string,
  runs: { text: string; math?: true }[],
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

const mountWithSent = mount;

async function mountEditorWith(blocks: readonly BlockView[]) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [...blocks],
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

async function mount(blocks: readonly BlockView[]) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [...blocks],
  };
  const sent: { command: string; body: Record<string, unknown> }[] = [];
  const api = documentsApi(document, []);
  vi.stubGlobal("fetch", (input: unknown, init?: RequestInit) => {
    if (typeof input === "string" && input.includes("/commands") && init?.body !== undefined) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push({ command: String(body["command"]), body });
    }
    return api(input as never, init as never);
  });
  const view = await mountEditor(document);
  return { view, sent };
}

/**
 * The preview is drawn by a task that lazily imports the engine — the one
 * place in the browser that loads MathJax. A test that ends before it
 * resolves leaves a render pending, which the harness reports against the
 * *next* test as "Must be same function".
 */
const settlePreview = async (view: { settle: (until: () => boolean) => Promise<void>; root: HTMLElement }) =>
  view.settle(
    () => (view.root.querySelector("[data-equation-preview]")?.innerHTML ?? "") !== "",
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editing an equation in its popover", () => {
  it("opens beside the equation on a press, with the exact source", async () => {
    const { view } = await mount([
      equation("blk-b", "b", { tex: "E = mc^2", svg: SET, caption: "Mass and energy", numbered: true }),
    ]);
    expect(view.root.querySelector("[data-equation-popover]") ?? null).toBeNull();

    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-popover]") != null);
    await settlePreview(view);

    const popover = view.root.querySelector("[data-equation-popover]") as HTMLElement;
    expect(popover).toBeTruthy();
    const source = popover.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    expect(source.value).toBe("E = mc^2");
    const caption = popover.querySelector("[data-equation-caption]") as HTMLInputElement;
    expect(caption.value).toBe("Mass and energy");
    const numbered = popover.querySelector("[data-equation-numbered]") as HTMLInputElement;
    expect(numbered.checked).toBe(true);
    await view.idle();
  });

  it("leaves the equation drawn while it is edited, so nothing moves", async () => {
    const { view } = await mount([equation("blk-b", "b", { tex: "E = mc^2", svg: SET })]);
    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-popover]") != null);
    await settlePreview(view);
    // The equation is still there, still set, with the panel beside it. The
    // source has not taken its place.
    const body = view.root.querySelector('[role="math"]') as HTMLElement;
    expect(body.innerHTML).toContain("<svg");
    await view.idle();
  });

  it("saves what was typed when it is closed", async () => {
    const { view, sent } = await mount([equation("blk-b", "b", { tex: "E = mc^2", svg: SET })]);
    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-source]") != null);
    await settlePreview(view);

    const source = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    source.value = "e^{i\\pi} + 1 = 0";
    await view.userEvent(source, "input");
    await view.userEvent(view.root.querySelector("[data-equation-done]") as HTMLElement, "click");
    await view.settle(() => sent.some((entry) => entry.command === "reviseEquation"));
    await view.idle();

    const revise = sent.find((entry) => entry.command === "reviseEquation");
    expect(revise).toBeTruthy();
    expect(revise?.body["tex"]).toBe("e^{i\\pi} + 1 = 0");
    expect(revise?.body["baseRevisionId"]).toBe("rev-blk-b");
    // And the panel is gone once it has saved.
    expect(view.root.querySelector("[data-equation-popover]") ?? null).toBeNull();
  });

  it("saves the ask for a number and the caption beside the source", async () => {
    const { view, sent } = await mount([equation("blk-b", "b", { tex: "x", svg: SET })]);
    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-numbered]") != null);
    await settlePreview(view);

    const numbered = view.root.querySelector("[data-equation-numbered]") as HTMLInputElement;
    numbered.checked = true;
    await view.userEvent(numbered, "change");
    const caption = view.root.querySelector("[data-equation-caption]") as HTMLInputElement;
    caption.value = "Euler";
    await view.userEvent(caption, "input");
    await view.userEvent(view.root.querySelector("[data-equation-done]") as HTMLElement, "click");
    await view.settle(() => sent.some((entry) => entry.command === "reviseEquation"));
    await view.idle();

    const revise = sent.find((entry) => entry.command === "reviseEquation");
    expect(revise?.body["numbered"]).toBe(true);
    expect(revise?.body["caption"]).toBe("Euler");
  });

  it("opens on an equation that could not be set, and saves what is written there", async () => {
    const { view, sent } = await mount([
      equation("blk-b", "b", { tex: "\\frac{1}{", failure: "This equation could not be set: the TeX could not be read." }),
    ]);
    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-source]") != null);
    await settlePreview(view);
    const source = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    expect(source.value).toBe("\\frac{1}{");
    // Still unreadable, and still saved: refusing would lose what was written.
    await view.userEvent(view.root.querySelector("[data-equation-done]") as HTMLElement, "click");
    await view.settle(() => sent.some((entry) => entry.command === "reviseEquation"));
    await view.idle();
    expect(sent.find((entry) => entry.command === "reviseEquation")?.body["tex"]).toBe("\\frac{1}{");
  });
});

describe("the walk's report, made into tests (BO_0290_027)", () => {
  // What this pins is the save path: every character typed reaches the
  // command. It does **not** reproduce the walk's "will not take input" — that
  // is the browser putting the caret back when Qwik patches a `value` bound to
  // the signal the field itself updates, and this DOM does not move a caret.
  // The fix for that is a source rule, checked below.
  it("sends every character that was typed", async () => {
    const { view, sent } = await mountWithSent([
      equationBlock("blk-b", "b", { tex: "x", svg: SET }),
    ]);
    await view.userEvent(view.root.querySelector("[data-equation-press]") as HTMLElement, "click");
    await view.settle(() => view.root.querySelector("[data-equation-source]") != null);

    // Typed one character at a time, as a person does.
    const source = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    for (const ch of "a^2") {
      source.value += ch;
      await view.userEvent(source, "input");
      await view.settle(() => true);
    }
    const live = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    expect(live.value).toBe("xa^2");

    await view.userEvent(view.root.querySelector("[data-equation-done]") as HTMLElement, "click");
    await view.settle(() => sent.some((entry) => entry.command === "reviseEquation"));
    await view.idle();
    expect(sent.find((entry) => entry.command === "reviseEquation")?.body["tex"]).toBe("xa^2");
  });

  it("draws mathematics in the block being edited as the reading row draws it", async () => {
    const view = await mountEditorWith([
      sentenceBlock(
        "blk-a",
        "a",
        [{ text: "so " }, { text: "E = mc^2", math: true }],
        { "E = mc^2": SET },
      ),
    ]);
    await activateBlock(view, "blk-a");
    // The surface is painted from the runs, and what the read set must reach
    // it: without that the equation is drawn as its own source while the
    // block is edited, which is what the walk found.
    const atom = view.root.querySelector("[data-block-editor] [data-math]") as HTMLElement;
    expect(atom).toBeTruthy();
    expect(atom.getAttribute("data-math-unset") ?? null).toBeNull();
    expect(atom.innerHTML).toContain("<svg");
    await view.idle();
  });

  it("never binds the field's value back to the signal the field updates", () => {
    // The rule the walk taught: a controlled field here re-renders on every
    // keystroke and the browser puts the caret back, which reads as a field
    // that will not take input. The source says it plainly so no one rebinds
    // it by habit.
    const popover = readFileSync(
      join(import.meta.dirname, "equation-popover.tsx"),
      "utf8",
    );
    expect(popover).toContain("value={draft.tex}");
    expect(popover).not.toContain("value={tex.value}");
    expect(popover).not.toContain("value={caption.value}");
    expect(popover).not.toContain("checked={numbered.value}");
  });
});

describe("the walk's third report (BO_0290_030)", () => {
  it("changing an inline equation reaches the document", async () => {
    const { view, sent } = await mountWithSent([
      sentenceBlock("blk-a", "a", [{ text: "so " }, { text: "a^2", math: true }], { "a^2": SET }),
    ]);
    await activateBlock(view, "blk-a");
    const atom = view.root.querySelector("[data-block-editor] [data-math]") as HTMLElement;
    await view.userEvent("[data-block-editor]", "click", { target: atom });
    await view.settle(() => view.root.querySelector("[data-equation-source]") != null);

    const source = view.root.querySelector("[data-equation-source]") as HTMLTextAreaElement;
    source.value = "b^2";
    await view.userEvent(source, "input");
    await view.userEvent(view.root.querySelector("[data-equation-done]") as HTMLElement, "click");

    // The panel saves and then closes, and closing clears which equation was
    // open. Reading it in the save meant the change went nowhere.
    for (let tick = 0; tick < 200 && !sent.some((entry) => entry.command === "revise"); tick++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await view.settle(() => true);
    }
    const revise = sent.find((entry) => entry.command === "revise");
    const runs = (revise?.body["runs"] ?? []) as { text: string; math?: boolean }[];
    expect(runs.find((run) => run.math === true)?.text).toBe("b^2");
    await view.idle();
  }, 30000);
});
