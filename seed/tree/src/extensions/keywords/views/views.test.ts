import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViewBridgeContext, type ViewBridge } from "~/components/shell/view-bridge";
import type { BlockView, DocumentView } from "~/extensions/documents/server/assemble";
import { activateBlock, documentsApi, mountEditor } from "~/extensions/documents/views/testing/editor-harness";

import type { DocumentMentionsView, MentionedInView } from "../lib/keywords";
import { MentionsLine } from "./mentions-line";
import { annotationsOf } from "./provider";

/**
 * The keywords extension's surfaces in Qwik's render harness (`BO_0301_018`,
 * `BO_0310_026`): the `@` list, narrowed by what is typed, naming a keyword
 * and creating one; a mention drawn over a block's
 * words in the editor with the definition on its wrapper, a press on it
 * opening the keyword and no editor; and the mentions line in a keyword document's header.
 * What the routes answer is stood in for by the browser's own `fetch`.
 */
const computing = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const computer = "3d3d3d3d-3d3d-4d3d-8d3d-3d3d3d3d3d3d";
const qubit = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";

const opened: { kind: string; itemId: string; title: string }[] = [];
const hosted = (child: JSXOutput) =>
  component$(() => {
    const bridge = {
      openTarget$: $((target: { kind: string; itemId: string; title: string }) => {
        opened.push({ kind: target.kind, itemId: target.itemId, title: target.title });
      }),
      raiseMessage$: $(() => {}),
      decorationBar: useStore({ groups: [] }),
    } as unknown as ViewBridge;
    useContextProvider(ViewBridgeContext, bridge);
    return jsx("div", { children: child });
  });

async function mount(child: JSXOutput) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 50; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { dom, root, settle };
}

afterEach(() => {
  opened.length = 0;
  vi.unstubAllGlobals();
});

const sentence = (blockId: string, order: string, runs: { text: string; marks?: readonly ("bold" | "italic")[]; keyword?: string }[]): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs,
});

const mentions: DocumentMentionsView = {
  documentId: "doc-1",
  dataRevision: 9,
  blocks: [
    {
      blockId: "blk-a",
      mentions: [
        { start: 6, end: 23, keyword: computing, rule: "inflection" },
        { start: 29, end: 35, keyword: qubit, rule: "inflection" },
      ],
    },
  ],
  keywords: {
    [computing]: { id: computing, title: "Quantum computing", aliases: ["QC"], definition: [{ text: "Computing with " }, { text: "qubits", marks: ["italic"] }, { text: "." }], definitionSource: "block" },
    [qubit]: { id: qubit, title: "Qubit", aliases: [], definition: null, definitionSource: null },
  },
};

describe("a mention in the editor", () => {
  it("turns a read into annotations with the keyword's title and definition", () => {
    const byBlock = annotationsOf(mentions);
    expect(byBlock["blk-a"]).toEqual([
      { start: 6, end: 23, kind: "keyword", id: computing, title: "Quantum computing", detail: "Computing with qubits." },
      { start: 29, end: 35, kind: "keyword", id: qubit, title: "Qubit" },
    ]);
  });

  it("is drawn over the words with its definition on the wrapper, and a press opens the keyword and no editor", async () => {
    const document: DocumentView = {
      documentId: "doc-1",
      revisionId: "rev-doc",
      title: "Reading",
      blocks: [sentence("blk-a", "a", [{ text: "about " }, { text: "quantum computing", marks: ["bold"] }, { text: " uses qubits." }])],
      dataRevision: 9,
    };
    const documents = documentsApi(document, []);
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/x/keywords/documents/doc-1") return new Response(JSON.stringify({ outcome: "success", result: mentions }), { status: 200, headers: { "content-type": "application/json" } });
      return documents(url, init);
    });
    const view = await mountEditor(document);
    await view.settle(() => view.root.querySelectorAll('[data-annotation="keyword"]').length === 2);
    const drawn = Array.from(view.root.querySelectorAll('[data-annotation="keyword"]'));
    expect(drawn.map((span) => span.textContent)).toEqual(["quantum computing", "qubits"]);
    expect(drawn[0]?.getAttribute("data-annotation-id")).toBe(computing);
    expect(drawn[0]?.getAttribute("data-annotation-title")).toBe("Quantum computing");
    expect(drawn[0]?.getAttribute("data-annotation-detail")).toBe("Computing with qubits.");
    expect(drawn[1]?.hasAttribute("data-annotation-detail")).toBe(false);
    // The bold mark still stands on the words under the wrapper.
    expect(drawn[0]?.querySelector("strong")?.textContent).toBe("quantum computing");
    // The words read back as they were.
    expect(view.root.querySelector("[data-block-reading]")?.textContent).toBe("about quantum computing uses qubits.");

    await view.userEvent(`[data-annotation-id="${computing}"]`, "click");
    await view.settle(() => (view.record.opened?.length ?? 0) > 0);
    expect(view.record.opened).toEqual([{ kind: "documents:document", itemId: computing, title: "Quantum computing" }]);
    expect(view.root.querySelector("[data-block-editing]")).toBeFalsy();
    await view.idle();
  });
});

describe("The mentions line", () => {
  const mentioned: MentionedInView = {
    keyword: { id: computing, title: "Quantum computing", aliases: [], definition: null, definitionSource: null },
    documents: [
      { documentId: "doc-2", title: "An essay", mentions: [{ blockId: "blk-x", words: "Quantum computing is loud." }] },
      { documentId: "doc-3", title: "Notes", mentions: [{ blockId: "blk-y", words: "On QCs." }, { blockId: "blk-z", words: "More quantum computers." }] },
    ],
  };
  const line = (root: HTMLElement) => root.querySelector("[data-keyword-mentions]");

  it("counts the mentioning blocks, unfolds them on a press, folds them again, and a press opens a document", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: mentioned }), { status: 200 }));
    const { root, settle, dom } = await mount(jsx(MentionsLine, { documentId: computing, dataRevision: 3, form: "full" }));
    await settle(() => (line(root) ?? null) !== null);
    expect(root.querySelector("[data-mentions-toggle]")?.textContent?.trim()).toBe("Mentioned in 3 blocks");
    expect(root.querySelector("[data-mentions-list]")).toBeFalsy();
    await dom.userEvent("[data-mentions-toggle]", "click");
    await settle(() => (root.querySelector("[data-mentions-list]") ?? null) !== null);
    expect(root.querySelector("[data-mentions-toggle]")?.getAttribute("aria-expanded")).toBe("true");
    expect(Array.from(root.querySelectorAll("[data-mentioning-document]")).map((row) => row.querySelector("button")?.textContent?.trim())).toEqual(["An essay", "Notes"]);
    expect(Array.from(root.querySelectorAll("[data-mentioning-block]")).map((row) => row.textContent?.trim())).toEqual(["Quantum computing is loud.", "On QCs.", "More quantum computers."]);
    await dom.userEvent('[data-mentioning-document="doc-3"] button', "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: "doc-3", title: "Notes" }]);
    await dom.userEvent("[data-mentions-toggle]", "click");
    await settle(() => (root.querySelector("[data-mentions-list]") ?? null) === null);
    expect(root.querySelector("[data-mentions-list]")).toBeFalsy();
  });

  it("says one block in the singular", async () => {
    const one: MentionedInView = { ...mentioned, documents: [mentioned.documents[0]!] };
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: one }), { status: 200 }));
    const { root, settle } = await mount(jsx(MentionsLine, { documentId: computing, dataRevision: 3 }));
    await settle(() => (line(root) ?? null) !== null);
    expect(root.querySelector("[data-mentions-toggle]")?.textContent?.trim()).toBe("Mentioned in 1 block");
  });

  it("draws nothing on a document that is no keyword, is mentioned nowhere, or in the compact header, and nothing at the foot", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: { keyword: null, documents: [] } }), { status: 200 }));
    const none = await mount(jsx(MentionsLine, { documentId: "doc-9", dataRevision: 3 }));
    await none.settle(() => false);
    expect(line(none.root)).toBeFalsy();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: { ...mentioned, documents: [] } }), { status: 200 }));
    const nowhere = await mount(jsx(MentionsLine, { documentId: computing, dataRevision: 3 }));
    await nowhere.settle(() => false);
    expect(line(nowhere.root)).toBeFalsy();
    const fetched = vi.fn(async () => new Response(JSON.stringify({ outcome: "success", result: mentioned }), { status: 200 }));
    vi.stubGlobal("fetch", fetched);
    const compact = await mount(jsx(MentionsLine, { documentId: computing, dataRevision: 3, form: "compact" }));
    await compact.settle(() => false);
    expect(line(compact.root)).toBeFalsy();
    expect(fetched).not.toHaveBeenCalled();
    const { contributions } = await import("../contributions");
    expect(Object.keys(contributions.decorations?.["document"]?.documentPlaces ?? {})).toEqual(["title"]);
  });
});

// The `@` list (`calliopa-bootstrap`'s `BO_0310_024`), through `documents`'
// inline triggers: the keywords by title and alias narrowed by every word
// typed, *Create keyword "…"* last; choosing writes a `keyword` run of the
// keyword's title, and creating makes the keyword first.
describe("the @ list", () => {
  const listed = [
    { id: computer, title: "Quantum computer", aliases: ["QC"] },
    { id: computing, title: "Quantum computing", aliases: [] },
    { id: qubit, title: "Qubit", aliases: [] },
  ];

  const mountTyping = async (typed: string, created?: { id: string; title: string }) => {
    const document: DocumentView = {
      documentId: "doc-1",
      revisionId: "rev-doc",
      title: "Reading",
      blocks: [sentence("blk-a", "a", [{ text: typed }])],
      dataRevision: 9,
    };
    const documents = documentsApi(document, []);
    const posted: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/x/keywords/keywords" && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ outcome: "success", result: { ...created, aliases: [] } }), { status: 200 });
      }
      if (url === "/api/x/keywords/keywords")
        return new Response(JSON.stringify({ outcome: "success", result: created === undefined || posted.length === 0 ? listed : [...listed, { ...created, aliases: [] }] }), { status: 200 });
      if (url === "/api/x/keywords/documents/doc-1") return new Response(JSON.stringify({ outcome: "success", result: { ...mentions, blocks: [], keywords: {} } }), { status: 200 });
      return documents(url, init);
    });
    const view = await mountEditor(document);
    await activateBlock(view, "blk-a");
    await view.settle(() => view.root.querySelector("[data-inline-trigger-list]") !== null);
    return { view, posted };
  };

  const offered = (root: HTMLElement) => [...root.querySelectorAll("[data-inline-trigger-option]")].map((option) => option.getAttribute("data-inline-trigger-option"));

  it("offers the keywords holding every word typed, Create last, and writes the chosen one's title as a keyword run", async () => {
    const { view } = await mountTyping("See @quan");
    expect(offered(view.root)).toEqual([computer, computing]);
    expect(view.root.querySelector("[data-inline-trigger-create]")?.textContent?.trim()).toBe("Create keyword “quan”");
    await view.userEvent(`[data-inline-trigger-option="${computing}"]`, "click");
    await view.settle(() => view.root.querySelector(`[data-block-id="blk-a"] [data-block-editor] [data-keyword="${computing}"]`) !== null);
    const named = view.root.querySelector(`[data-block-id="blk-a"] [data-block-editor] [data-keyword="${computing}"]`) as HTMLElement;
    expect(named.textContent).toBe("Quantum computing");
    expect(view.root.querySelector('[data-block-id="blk-a"] [data-block-editor]')?.textContent).toBe("See Quantum computing ");
    expect(view.root.querySelector("[data-inline-trigger-list]")).toBeFalsy();
    await view.idle();
  });

  it("finds a keyword by its alias and offers no Create for a name it holds", async () => {
    const { view } = await mountTyping("@qc");
    expect(offered(view.root)).toEqual([computer]);
    expect(view.root.querySelector("[data-inline-trigger-create]")).toBeFalsy();
    await view.idle();
  });

  it("creates a keyword titled with what was typed and names it in the text", async () => {
    const entanglement = { id: "4f4f4f4f-4f4f-4f4f-8f4f-4f4f4f4f4f4f", title: "entanglement" };
    const { view, posted } = await mountTyping("On @entanglement", entanglement);
    expect(offered(view.root)).toEqual([]);
    await view.userEvent("[data-inline-trigger-create]", "click");
    await view.settle(() => view.root.querySelector(`[data-keyword="${entanglement.id}"]`) !== null);
    expect(posted).toEqual([{ title: "entanglement" }]);
    expect(view.root.querySelector(`[data-keyword="${entanglement.id}"]`)?.textContent).toBe("entanglement");
    await view.idle();
  });
});

describe("a named keyword that is no keyword any more", () => {
  it("is drawn as not a keyword under its title, and as gone when its document is", () => {
    const byBlock = annotationsOf({
      documentId: "doc-1",
      dataRevision: 9,
      blocks: [
        {
          blockId: "blk-a",
          mentions: [
            { start: 0, end: 6, keyword: "doc-was", rule: "named" },
            { start: 7, end: 12, keyword: "doc-gone", rule: "named" },
          ],
        },
      ],
      keywords: {},
      notKeywords: { "doc-was": "Qubits", "doc-gone": "" },
    });
    expect(byBlock["blk-a"]).toEqual([
      { start: 0, end: 6, kind: "keyword", id: "doc-was", title: "Qubits", detail: "Not a keyword: the document no longer carries Keyword." },
      { start: 7, end: 12, kind: "keyword-gone", id: "doc-gone", title: "Not a keyword", detail: "The keyword's document is gone." },
    ]);
  });
});
