import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Figures and tables numbered in a document (`BO_0295_010`–`BO_0295_013`): a
 * picture's caption beneath it, *Figure 3.* before a numbered one's caption,
 * *Table 2.* in a numbered table's, a figure an output showed once a person
 * numbers it, *Number this* in the bar, and a reference drawn as the number
 * it resolves to — or as gone — in the reading row and the editing surface.
 */
const sentence = (blockId: string, order: string, runs: readonly Record<string, unknown>[]): BlockView =>
  ({ kind: "text", blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order, role: "paragraph", standing: "keep", runs }) as unknown as BlockView;

const picture = (blockId: string, order: string, rest: Record<string, unknown> = {}): BlockView =>
  ({ kind: "image", blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order, objectId: `obj-${blockId}`, ...rest }) as BlockView;

const table = (blockId: string, order: string, rest: Record<string, unknown> = {}): BlockView =>
  ({
    kind: "table",
    blockId,
    revisionId: `rev-${blockId}`,
    containmentId: `c-${blockId}`,
    order,
    columns: [{ name: "x", type: "number" }],
    rows: [["1"]],
    ...rest,
  }) as BlockView;

const output = (blockId: string, order: string, rest: Record<string, unknown> = {}): BlockView =>
  ({
    kind: "output",
    blockId,
    revisionId: `rev-${blockId}`,
    containmentId: `c-${blockId}`,
    order,
    of: "code-1",
    outcome: "ok",
    items: [{ kind: "display", picture: 0 }],
    pictures: [{ objectId: "fig-o", filename: "figure-1.png", mediaType: "image/png", size: 10 }],
    files: [],
    ...rest,
  }) as BlockView;

async function mount(blocks: readonly BlockView[], numbers: Partial<Pick<DocumentView, "figureNumbers" | "tableNumbers" | "listingNumbers">> = {}) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Figures", blocks: [...blocks], ...numbers };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  return { view, sent, document };
}

/** A page read with a pointer that hovers, as the proposals suite stubs it:
 * before the mount, since the row asks at the press. */
const hovering = () =>
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });

/** Rests a hovering mouse on a row, which is how a picture's or a table's row
 * becomes the bar's subject on a desktop (DO_0004_002). */
async function hover(view: Awaited<ReturnType<typeof mount>>["view"], blockId: string) {
  await view.userEvent(`[data-block-id="${blockId}"]`, "pointerenter", { pointerType: "mouse" });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await view.settle();
}

const bar = (root: HTMLElement, id: string) => root.querySelector(`[data-bar-action="${id}"]`) as HTMLElement | null;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a figure's caption and number", () => {
  it("draws Figure 1. before a numbered picture's caption, and a caption field while reading", async () => {
    const { view } = await mount([picture("blk-i", "a", { caption: "The apparatus", numbered: true, number: 1 })], { figureNumbers: { "blk-i": 1 } });
    const caption = view.root.querySelector('[data-figure-caption="blk-i"]') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.querySelector("[data-figure-number]")?.textContent).toBe("Figure 1.");
    expect((caption.querySelector("[data-figure-caption-input]") as HTMLInputElement).value).toBe("The apparatus");
    await view.idle();
  });

  it("draws a numbered picture without a caption with its label all the same", async () => {
    const { view } = await mount([picture("blk-i", "a", { numbered: true, number: 3 })], { figureNumbers: { "blk-i": 3 } });
    expect(view.root.querySelector('[data-figure-caption="blk-i"] [data-figure-number]')?.textContent).toBe("Figure 3.");
    await view.idle();
  });

  it("writes a caption typed beneath a picture as one setFigure on its base, keeping its ask", async () => {
    const { view, sent } = await mount([picture("blk-i", "a", { numbered: true, number: 1 })], { figureNumbers: { "blk-i": 1 } });
    const field = view.root.querySelector("[data-figure-caption-input]") as HTMLInputElement;
    field.value = "The control";
    await view.userEvent(field, "change");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure"));
    expect(sent.find((entry) => entry.body["command"] === "setFigure")?.body).toMatchObject({
      blockId: "blk-i",
      baseRevisionId: "rev-blk-i",
      caption: "The control",
      numbered: true,
    });
    await view.idle();
  });

  it("counts an output's picture as a figure once numbered, with its caption", async () => {
    const { view } = await mount([output("blk-o", "a", { numbered: true, number: 2, caption: "What the fit gave" })], { figureNumbers: { "blk-o": 2 } });
    const caption = view.root.querySelector('[data-figure-caption="blk-o"]') as HTMLElement;
    expect(caption.querySelector("[data-figure-number]")?.textContent).toBe("Figure 2.");
    expect((caption.querySelector("[data-figure-caption-input]") as HTMLInputElement).value).toBe("What the fit gave");
    await view.idle();
  });

  it("draws Table 1. in a numbered table's caption", async () => {
    const { view } = await mount([table("blk-t", "a", { caption: "Readings", numbered: true, number: 1 })], { tableNumbers: { "blk-t": 1 } });
    expect(view.root.querySelector("[data-table-number]")?.textContent).toBe("Table 1.");
    await view.idle();
  });
});

const code = (blockId: string, order: string, rest: Record<string, unknown> = {}): BlockView =>
  ({ kind: "sourcecode", blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order, source: "x = 1", language: "python", ...rest }) as BlockView;

describe("a listing's caption and number (BO_0303_011)", () => {
  it("draws Listing 1. beneath a numbered code block with its caption in a field while reading", async () => {
    const { view } = await mount([code("blk-c", "a", { caption: "The setup", numbered: true, number: 1 })], { listingNumbers: { "blk-c": 1 } });
    const caption = view.root.querySelector('[data-code-block="blk-c"] [data-figure-caption="blk-c"]') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.querySelector("[data-figure-number]")?.textContent).toBe("Listing 1.");
    expect((caption.querySelector("[data-figure-caption-input]") as HTMLInputElement).value).toBe("The setup");
    await view.idle();
  });

  it("draws a numbered code block without a caption with its label alone, from the read's map", async () => {
    const { view } = await mount([code("blk-c", "a", { numbered: true, number: 1 })], { listingNumbers: { "blk-c": 2 } });
    expect(view.root.querySelector('[data-figure-caption="blk-c"] [data-figure-number]')?.textContent).toBe("Listing 2.");
    await view.idle();
  });

  it("writes a caption typed beneath a code block as one setFigure on its base, keeping its ask", async () => {
    const { view, sent } = await mount([code("blk-c", "a", { numbered: true, number: 1 })], { listingNumbers: { "blk-c": 1 } });
    const field = view.root.querySelector('[data-figure-caption="blk-c"] [data-figure-caption-input]') as HTMLInputElement;
    field.value = "The setup";
    await view.userEvent(field, "change");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure"));
    expect(sent.find((entry) => entry.body["command"] === "setFigure")?.body).toMatchObject({
      blockId: "blk-c",
      baseRevisionId: "rev-blk-c",
      caption: "The setup",
      numbered: true,
    });
    await view.idle();
  });

  it("offers Number this listing on a hovered code block and sends the ask with the caption kept (BO_0303_012)", async () => {
    hovering();
    const { view, sent } = await mount([code("blk-c", "a", { caption: "The setup" })]);
    await hover(view, "blk-c");
    await view.settle(() => bar(view.root, "block-number") != null);
    const toggle = bar(view.root, "block-number") as HTMLElement;
    expect(toggle.getAttribute("aria-label") ?? toggle.textContent ?? "").toContain("Number this listing");
    await view.userEvent('[data-bar-action="block-number"]', "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure"));
    expect(sent.find((entry) => entry.body["command"] === "setFigure")?.body).toMatchObject({ blockId: "blk-c", numbered: true, caption: "The setup" });
    await view.idle();
  });
});

describe("numbering from the bar", () => {
  it("offers Number this figure on a focused picture and sends the ask with the caption kept", async () => {
    hovering();
    const { view, sent } = await mount([picture("blk-i", "a", { caption: "The apparatus" })]);
    await hover(view, "blk-i");
    await view.settle(() => bar(view.root, "block-number") != null);
    const toggle = bar(view.root, "block-number") as HTMLElement;
    expect(toggle.getAttribute("aria-label") ?? toggle.textContent ?? "").toContain("Number this figure");
    await view.userEvent('[data-bar-action="block-number"]', "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure"));
    expect(sent.find((entry) => entry.body["command"] === "setFigure")?.body).toMatchObject({
      blockId: "blk-i",
      numbered: true,
      caption: "The apparatus",
    });
    await view.idle();
  });

  it("offers Number this table on a focused table and sends the ask alone", async () => {
    hovering();
    const { view, sent } = await mount([table("blk-t", "a")]);
    await hover(view, "blk-t");
    await view.settle(() => bar(view.root, "block-number") != null);
    await view.userEvent('[data-bar-action="block-number"]', "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure"));
    const body = sent.find((entry) => entry.body["command"] === "setFigure")?.body ?? {};
    expect(body).toMatchObject({ blockId: "blk-t", numbered: true });
    expect(body).not.toHaveProperty("caption");
    await view.idle();
  });
});

describe("a reference to a figure or a table", () => {
  it("draws a reference in the reading row as its current number, and a gone one in words", async () => {
    const { view } = await mount(
      [
        sentence("blk-p", "a", [{ text: "See " }, { text: "", figureRef: "blk-i" }, { text: ", " }, { text: "", tableRef: "blk-t" }, { text: ", " }, { text: "", figureRef: "blk-gone" }]),
        picture("blk-i", "b", { numbered: true, number: 2 }),
        table("blk-t", "c", { numbered: true, number: 1 }),
      ],
      { figureNumbers: { "blk-i": 2 }, tableNumbers: { "blk-t": 1 } },
    );
    const row = view.root.querySelector('[data-block-id="blk-p"] [data-block-reading]') as HTMLElement;
    expect(row.querySelector('[data-figure-ref="blk-i"]')?.textContent).toBe("Figure 2");
    expect(row.querySelector('[data-table-ref="blk-t"]')?.textContent).toBe("Table 1");
    const gone = row.querySelector('[data-figure-ref="blk-gone"]') as HTMLElement;
    expect(gone.textContent).toBe("(figure gone)");
    expect(gone.classList.contains("run-block-ref--missing")).toBe(true);
    await view.idle();
  });

  // The bar's reference choices are gone (`BO_0300_006`): a reference is written from `#` in the sentence,
  // proven in `references.test.ts`.

  it("paints a reference on the editing surface with its label as an attribute, and reads it back as the run it was", async () => {
    const { view } = await mount(
      [sentence("blk-p", "a", [{ text: "See " }, { text: "", figureRef: "blk-i" }]), picture("blk-i", "b", { numbered: true, number: 4 })],
      { figureNumbers: { "blk-i": 4 } },
    );
    await activateBlock(view, "blk-p");
    const atom = view.root.querySelector('[data-block-editor] [data-figure-ref="blk-i"]') as HTMLElement;
    expect(atom).toBeTruthy();
    expect(atom.getAttribute("data-block-ref-label")).toBe("Figure 4");
    // The words are the attribute's, so the atom holds only the one character
    // the caret counts.
    expect(atom.textContent?.length).toBe(1);
    await view.idle();
  });
});

/**
 * A number is the document's order, answered by every read: when a block is
 * numbered above one already numbered, the read back after the ask renumbers
 * the one below, and its own label follows — not only the references to it.
 * The row is keyed by revision and a derived number changes no revision, so
 * the label must be drawn from the read's map, never from the block the row
 * was mounted with. Found by the walk (`BO_0295_014`, 2026-09-25).
 */
describe("a number follows the read", () => {
  it("relabels the table below when a table above it is numbered", async () => {
    hovering();
    const above = table("blk-above", "a");
    const below = table("blk-below", "b", { numbered: true, number: 1 });
    const { view, sent, document } = await mount([above, below], { tableNumbers: { "blk-below": 1 } });
    expect(view.root.querySelector('[data-block-id="blk-below"] [data-table-number]')?.textContent).toBe("Table 1.");
    // The read after the ask answers the new order: the table above is 1 in
    // the revision the ask wrote, the one below is 2 with its revision
    // unchanged, since a number is stored nowhere.
    const renumbered = document as unknown as { blocks: BlockView[]; tableNumbers?: Record<string, number>; figureNumbers?: Record<string, number> };
    renumbered.blocks = [
      { ...above, revisionId: "rev-blk-above-2", numbered: true, number: 1 } as BlockView,
      { ...below, number: 2 } as BlockView,
    ];
    renumbered.tableNumbers = { "blk-above": 1, "blk-below": 2 };
    await hover(view, "blk-above");
    await view.settle(() => bar(view.root, "block-number") != null);
    await view.userEvent('[data-bar-action="block-number"]', "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFigure" && entry.body["blockId"] === "blk-above"));
    await view.settle(() => view.root.querySelector('[data-block-id="blk-above"] [data-table-number]') != null);
    await view.idle();
    expect(view.root.querySelector('[data-block-id="blk-above"] [data-table-number]')?.textContent).toBe("Table 1.");
    expect(view.root.querySelector('[data-block-id="blk-below"] [data-table-number]')?.textContent).toBe("Table 2.");
  });

  it("relabels the figure below when a picture above it is numbered", async () => {
    hovering();
    const above = picture("blk-p", "a");
    const below = picture("blk-q", "b", { caption: "Below", numbered: true, number: 1 });
    const { view, document } = await mount([above, below], { figureNumbers: { "blk-q": 1 } });
    expect(view.root.querySelector('[data-figure-caption="blk-q"] [data-figure-number]')?.textContent).toBe("Figure 1.");
    const renumbered = document as unknown as { blocks: BlockView[]; tableNumbers?: Record<string, number>; figureNumbers?: Record<string, number> };
    renumbered.blocks = [
      { ...above, revisionId: "rev-blk-p-2", numbered: true, number: 1 } as BlockView,
      { ...below, number: 2 } as BlockView,
    ];
    renumbered.figureNumbers = { "blk-p": 1, "blk-q": 2 };
    await hover(view, "blk-p");
    await view.settle(() => bar(view.root, "block-number") != null);
    await view.userEvent('[data-bar-action="block-number"]', "click");
    await view.settle(() => view.root.querySelector('[data-figure-caption="blk-p"] [data-figure-number]') != null);
    await view.idle();
    expect(view.root.querySelector('[data-figure-caption="blk-p"] [data-figure-number]')?.textContent).toBe("Figure 1.");
    expect(view.root.querySelector('[data-figure-caption="blk-q"] [data-figure-number]')?.textContent).toBe("Figure 2.");
  });
});
