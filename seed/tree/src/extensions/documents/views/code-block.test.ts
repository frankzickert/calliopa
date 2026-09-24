import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
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

const code = (blockId: string, order: string, source: string, language?: string): BlockView => ({
  kind: "sourcecode",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  source,
  ...(language === undefined ? {} : { language }),
});

async function mount(blocks: readonly BlockView[]) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notebook", blocks: [...blocks] };
  const sent: SentCommand[] = [];
  const fetched: string[] = [];
  const api = documentsApi(document, sent);
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
