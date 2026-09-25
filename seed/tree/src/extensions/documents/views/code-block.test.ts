import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { DocumentProposals } from "../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Code in a document (`BO_0289_018`): the source drawn in a field the reader
 * types in, the language beside it, a settled edit sent as one revise of the
 * whole block with the block saying it is sending, and a proposed or read-only
 * code block drawn as text.
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

const code = (blockId: string, order: string, source: string, language?: string, markup?: string): BlockView => ({
  kind: "sourcecode",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  source,
  ...(language === undefined ? {} : { language }),
  ...(markup === undefined ? {} : { markup }),
});

/** What the read sets for a Python block, as the assembler would. */
const PYTHON = "def f(x):\n    return x  # one\n";
const PYTHON_MARKUP = '<span class="hljs-keyword">def</span> <span class="hljs-title function_">f</span>(<span class="hljs-params">x</span>):\n    <span class="hljs-keyword">return</span> x  <span class="hljs-comment"># one</span>\n';

/** A run's proposal inserting one block, for the chip row's read-only shape. */
const proposalOf = (block: BlockView): DocumentProposals => ({
  documentId: "doc-1",
  unanswered: 1,
  groups: [
    {
      groupId: "node:run-1",
      stagedBy: ["hermes"],
      proposer: { kind: "agent", agent: "hermes", executedBy: "hermes" },
      items: [{ itemId: `node:run-1|insert|node:${block.blockId}`, groupId: "node:run-1", kind: "insert", blockId: block.blockId, block }],
    },
  ],
});

async function mount(blocks: readonly BlockView[], proposals?: DocumentProposals) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notebook", blocks: [...blocks] };
  const sent: SentCommand[] = [];
  const fetched: string[] = [];
  const api = documentsApi(document, sent, proposals === undefined ? undefined : { proposals });
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    fetched.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return api(input, init);
  });
  return { view: await mountEditor(document), sent, fetched };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a code block in a document", () => {
  it("draws the source in a field with its language, editable while reading", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "x = 41\nprint(x + 1)", "python")]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    expect(block).toBeTruthy();
    expect(block.getAttribute("data-code-editable")).toBe("true");
    expect(block.getAttribute("data-code-language")).toBe("python");
    const field = block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement;
    expect(field).toBeTruthy();
    expect(field.value).toBe("x = 41\nprint(x + 1)");
    expect((block.querySelector("[data-code-language-input]") as HTMLInputElement).value).toBe("python");
  });

  it("sends a settled edit as one revise of the whole block on its base revision", async () => {
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "x = 1")]);
    const field = view.root.querySelector("textarea[data-code-source]") as HTMLTextAreaElement;
    expect(field).toBeTruthy();
    field.value = "x = 2";
    await view.userEvent(field, "input");
    await view.userEvent(field, "change");
    await view.settle();
    const revised = sent.filter((entry) => entry.body["command"] === "reviseCode").map((entry) => entry.body);
    expect(revised).toHaveLength(1);
    expect(revised[0]).toMatchObject({ blockId: "blk-b", baseRevisionId: "rev-blk-b", source: "x = 2" });
  });

  it("draws a read-only code block as text and no field", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "print(1)")]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    // The editor draws it editable while reading; the read-only shape is
    // what a proposal row uses, proven through the same component here by
    // its attribute contract.
    expect(block.querySelector("[data-code-failure]")).toBeFalsy();
    expect(block.textContent).toContain("");
  });
});

/** The event the send control dispatches, built the way this DOM builds one. */
function proposedFrom(element: Element, documentId: string) {
  const event = element.ownerDocument.createEvent("Event");
  event.initEvent("calliopa:document-proposed", true, true);
  Object.assign(event, { detail: { documentId } });
  element.dispatchEvent(event);
}

describe("a proposal staged by something that is not a run", () => {
  it("is read again when the window says the document was proposed to", async () => {
    // BO_0289_023: a person's execution stages the output through the
    // kernel, and the send control says so with one event bubbling from
    // its element to the page the editor listens on.
    const { view, fetched } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "print(1)")]);
    const before = fetched.filter((url) => url.includes("/proposals")).length;
    proposedFrom(view.root.querySelector("[data-code-block='blk-b']")!, "doc-1");
    await view.settle(() => fetched.filter((url) => url.includes("/proposals")).length > before);
    expect(fetched.filter((url) => url.includes("/proposals")).length).toBeGreaterThan(before);
    const other = fetched.filter((url) => url.includes("/proposals")).length;
    proposedFrom(view.root.querySelector("[data-code-block='blk-b']")!, "doc-other");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetched.filter((url) => url.includes("/proposals")).length).toBe(other);
  });
});

/**
 * Code in colour (`BO_0296_018`, `BO_0296_019`): the read's markup drawn
 * while reading and painted behind the field while writing, the paint the
 * field's text character for character, a repaint as the source changes, a
 * block with no language or an unknown one drawn plain, and the language
 * field offering the languages the highlighter knows.
 */
describe("a code block in colour", () => {
  it("paints the read's colours behind the field while it is written, character for character", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", PYTHON, "python", PYTHON_MARKUP)]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    expect(block.getAttribute("data-code-coloured")).toBe("true");
    const paint = block.querySelector("[data-code-paint]") as HTMLElement;
    const field = block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement;
    expect(paint.querySelector(".hljs-keyword")?.textContent).toBe("def");
    expect(paint.querySelector(".hljs-comment")?.textContent).toBe("# one");
    expect(paint.textContent).toBe(field.value);
    expect(paint.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws a proposed code block on its chip's row in the read's colours, read and not written", async () => {
    // A proposed block is drawn as it is — the read-only shape — and
    // coloured exactly as an accepted one, so accepting changes nothing
    // about how the code looks. BO_0296_019
    const proposed = code("blk-p", "c", PYTHON, "python", PYTHON_MARKUP);
    const { view } = await mount([text("blk-a", "a", "Opening.")], proposalOf(proposed));
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") != null);
    const block = view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") as HTMLElement;
    expect(block.querySelector("textarea")).toBeFalsy();
    expect(block.getAttribute("data-code-coloured")).toBe("true");
    const read = block.querySelector("pre.code-block__source--read") as HTMLElement;
    expect(read.querySelector(".hljs-keyword")?.textContent).toBe("def");
    expect(read.textContent).toBe(PYTHON);
  });

  it("repaints as the source changes, from the engine loaded only then", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "x = 1\n", "python", 'x = <span class="hljs-number">1</span>\n')]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    const field = block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement;
    field.value = "import os\nx = 1\n";
    await view.userEvent(field, "input");
    await view.settle(() => block.querySelector("[data-code-paint] .hljs-keyword")?.textContent === "import");
    const paint = block.querySelector("[data-code-paint]") as HTMLElement;
    expect(paint.textContent).toBe("import os\nx = 1\n");
  });

  it("draws a block with no language, and one with an unknown language, plain in both shapes", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "def f(): pass\n"), code("blk-c", "c", "def f(): pass\n", "klingon")], proposalOf(code("blk-p", "d", "def f(): pass\n", "klingon")));
    for (const id of ["blk-b", "blk-c"]) {
      const block = view.root.querySelector(`[data-code-block='${id}']`) as HTMLElement;
      expect(block.hasAttribute("data-code-coloured")).toBe(false);
      const paint = block.querySelector("[data-code-paint]") as HTMLElement;
      expect(paint.querySelector("[class^='hljs']")).toBeFalsy();
      expect(paint.textContent).toBe("def f(): pass\n");
    }
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") != null);
    const read = view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p'] pre.code-block__source--read") as HTMLElement;
    expect(read.querySelector("[class^='hljs']")).toBeFalsy();
    expect(read.textContent).toBe("def f(): pass\n");
  });

  it("keeps the source's own markup characters as characters, never as markup", async () => {
    const source = "if a < b && c > d:\n    print('<b>')\n";
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", source)]);
    const paint = view.root.querySelector("[data-code-block='blk-b'] [data-code-paint]") as HTMLElement;
    expect(paint.textContent).toBe(source);
    expect(paint.querySelector("b")).toBeFalsy();
  });

  it("offers the languages the highlighter knows in the language field, and still takes a word of its own", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "x = 1", "python")]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    const input = block.querySelector("[data-code-language-input]") as HTMLInputElement;
    const listId = input.getAttribute("list");
    expect(listId).toBeTruthy();
    const list = block.querySelector(`datalist[id='${listId}']`) as HTMLElement;
    const offered = Array.from(list.querySelectorAll("option")).map((option) => option.getAttribute("value"));
    expect(offered).toContain("python");
    expect(offered).toContain("typescript");
    expect(offered).toContain("go");
    expect(offered).not.toContain("klingon");
    // A word of its own is typed and kept, and the block draws plain.
    input.value = "klingon";
    await view.userEvent(input, "input");
    await view.settle(() => block.getAttribute("data-code-language") === "klingon");
    expect(block.hasAttribute("data-code-coloured")).toBe(false);
  });

  it("still says it is sending while a settled edit is on its way, so the send control waits", async () => {
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), code("blk-b", "b", "x = 1", "python")]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    const field = block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement;
    field.value = "x = 2";
    await view.userEvent(field, "input");
    await view.userEvent(field, "change");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "reviseCode"));
    await view.settle(() => !block.hasAttribute("data-code-sending"));
    expect(sent.filter((entry) => entry.body["command"] === "reviseCode")).toHaveLength(1);
  });
});

/**
 * The gutter of line numbers (`BO_0302_006`) and the continuation switch in
 * the head (`BO_0302_008`): drawn while the document numbers its code, from
 * where the read says the block starts, in both shapes; not text; and the
 * switch shown whether or not the numbers are.
 */
describe("a code block's line numbers", () => {
  const numbered = (blockId: string, order: string, source: string, firstLine: number, continues?: boolean): BlockView => ({
    ...(code(blockId, order, source, "python") as BlockView),
    ...({ firstLine } as object),
    ...(continues === undefined ? {} : ({ continues } as object)),
  });

  async function mountWith(document: DocumentView, proposals?: DocumentProposals) {
    const sent: SentCommand[] = [];
    const api = documentsApi(document, sent, proposals === undefined ? undefined : { proposals });
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => api(input, init));
    return { view: await mountEditor(document), sent };
  }

  const gutterOf = (root: ParentNode, blockId: string) => root.querySelector(`[data-code-block='${blockId}'] [data-code-gutter]`) as HTMLElement | null;

  it("draws one number per line beside the source, from one, while written and while read", async () => {
    const source = "x = 1\ny = 2\nz = 3\n";
    const proposed = numbered("blk-p", "c", source, 1);
    const { view } = await mount([text("blk-a", "a", "Opening."), numbered("blk-b", "b", source, 1)], proposalOf(proposed));
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    expect(block.getAttribute("data-code-numbered")).toBe("true");
    const gutter = gutterOf(view.root, "blk-b") as HTMLElement;
    expect(gutter.textContent).toBe("1\n2\n3");
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
    // The paint and the field still hold the source alone, character for character.
    expect((block.querySelector("[data-code-paint]") as HTMLElement).textContent).toBe(source);
    expect((block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement).value).toBe(source);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") != null);
    const row = view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") as HTMLElement;
    expect((row.querySelector("[data-code-gutter]") as HTMLElement).textContent).toBe("1\n2\n3");
    expect((row.querySelector("pre.code-block__source--read") as HTMLElement).textContent).toBe(source);
  });

  it("numbers a continuing block after the one above it, and re-numbers it under the caret as a line is typed above, before anything is sent", async () => {
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), numbered("blk-b", "b", "a = 1\nb = 2", 1), numbered("blk-c", "c", "c = 3", 3, true)]);
    const below = view.root.querySelector("[data-code-block='blk-c']") as HTMLElement;
    expect(below.getAttribute("data-code-continues")).toBe("true");
    expect(gutterOf(view.root, "blk-c")?.getAttribute("data-code-first-line")).toBe("3");
    expect(gutterOf(view.root, "blk-c")?.textContent).toBe("3");
    // A line typed into the block above: the one below counts on from it at
    // once, while the edit is still under the caret and nothing was sent.
    const field = view.root.querySelector("[data-code-block='blk-b'] textarea[data-code-source]") as HTMLTextAreaElement;
    field.value = "a = 1\nb = 2\nx = 0\n";
    await view.userEvent(field, "input");
    await view.settle(() => gutterOf(view.root, "blk-b")?.textContent === "1\n2\n3");
    await view.settle(() => gutterOf(view.root, "blk-c")?.textContent === "4");
    expect(gutterOf(view.root, "blk-c")?.getAttribute("data-code-first-line")).toBe("4");
    expect(sent.filter((entry) => entry.body["command"] === "reviseCode")).toHaveLength(0);
  });

  it("is not text: the column stands outside the source, unselectable and hidden, so a copy of the code is the code alone", async () => {
    const { view } = await mount([text("blk-a", "a", "Opening."), numbered("blk-b", "b", "x = 1\ny = 2", 1)]);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    const gutter = gutterOf(view.root, "blk-b") as HTMLElement;
    expect(gutter.closest("[data-code-field]")).toBeFalsy();
    expect(gutter.closest("[data-code-source]")).toBeFalsy();
    expect((block.querySelector("[data-code-paint]") as HTMLElement).textContent).toBe("x = 1\ny = 2");
    expect((block.querySelector("textarea[data-code-source]") as HTMLTextAreaElement).value).toBe("x = 1\ny = 2");
    const css = readFileSync(new URL("./block-editor.css", import.meta.url), "utf8");
    const rule = css.slice(css.indexOf(".code-block__gutter {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("user-select: none");
  });

  it("draws no column while the document's switch is off, and still offers the continuation (BO_0302_007, BO_0302_Q5)", async () => {
    const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notebook", lineNumbers: false, blocks: [text("blk-a", "a", "Opening."), numbered("blk-b", "b", "x = 1", 1, true)] };
    const { view } = await mountWith(document);
    const block = view.root.querySelector("[data-code-block='blk-b']") as HTMLElement;
    expect(block.hasAttribute("data-code-numbered")).toBe(false);
    expect(gutterOf(view.root, "blk-b")).toBeFalsy();
    expect(block.querySelector("[data-code-continue]")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("offers Continue numbering in the head while writable, sends the block's flag on a press, and says it in a word on a chip row", async () => {
    const proposed = numbered("blk-p", "c", "z = 3", 3, true);
    const { view, sent } = await mount([text("blk-a", "a", "Opening."), numbered("blk-b", "b", "x = 1\ny = 2", 1)], proposalOf(proposed));
    const control = view.root.querySelector("[data-code-block='blk-b'] [data-code-continue]") as HTMLButtonElement;
    expect(control.getAttribute("aria-pressed")).toBe("false");
    expect(control.getAttribute("aria-label")).toContain("off");
    await view.userEvent(control, "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setCodeContinues"));
    expect(sent.filter((entry) => entry.body["command"] === "setCodeContinues").map((entry) => entry.body)).toEqual([
      { command: "setCodeContinues", blockId: "blk-b", baseRevisionId: "rev-blk-b", continues: true },
    ]);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.settle(() => view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") != null);
    const row = view.root.querySelector("[data-proposal-kind] [data-code-block='blk-p']") as HTMLElement;
    expect(row.querySelector("[data-code-continue]")).toBeFalsy();
    expect(row.querySelector("[data-code-continue-shown]")?.textContent).toBe("continues");
    expect((row.querySelector("[data-code-gutter]") as HTMLElement).textContent).toBe("3");
  });
});
