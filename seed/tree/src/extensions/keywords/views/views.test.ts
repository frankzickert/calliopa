import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViewBridgeContext, type ViewBridge } from "~/components/shell/view-bridge";
import type { DocumentRoleView } from "~/extensions/doc-block-roles/lib/roles";
import type { BlockView, DocumentView } from "~/extensions/documents/server/assemble";
import { documentsApi, mountEditor } from "~/extensions/documents/views/testing/editor-harness";

import type { DocumentMentionsView, KeywordsListing, MentionedInView } from "../lib/keywords";
import { MentionedIn } from "./mentioned-in";
import { annotationsOf } from "./provider";
import { KeywordsSection } from "./section";

/**
 * The keywords extension's surfaces in Qwik's render harness (`BO_0301_018`):
 * the section's three choices and its list; a mention drawn over a block's
 * words in the editor with the definition on its wrapper, a press on it
 * opening the keyword and no editor; and the foot of a keyword document.
 * What the routes answer is stood in for by the browser's own `fetch`.
 */
const definition: DocumentRoleView["blockRoles"][number] = { id: "1a2b3c4d-1111-4aaa-8bbb-000000000001", name: "Definition", description: "", order: 1, retired: false };
const alias: DocumentRoleView["blockRoles"][number] = { id: "1a2b3c4d-1111-4aaa-8bbb-000000000002", name: "Alias", description: "", order: 2, retired: false };
const keywordRole: DocumentRoleView = { id: "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c", name: "Keyword", description: "", retired: false, blockRoles: [definition, alias] };
const story: DocumentRoleView = { id: "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b", name: "Story", description: "", retired: false, blockRoles: [] };

const computing = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const qubit = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";

const listing: KeywordsListing = {
  reachable: true,
  settings: { keywordRole: keywordRole.id, definitionRole: { kind: "block", id: definition.id }, aliasRole: null },
  roles: [story, keywordRole],
  keywords: [
    { id: computing, title: "Quantum computing" },
    { id: qubit, title: "Qubit" },
  ],
};

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

const chosenOf = (control: Element | null): string | null => control?.querySelector("option[selected]")?.getAttribute("value") ?? null;
const optionsOf = (control: Element | null): string[] => Array.from(control?.querySelectorAll("option") ?? []).map((option) => option.textContent?.trim() ?? "");

afterEach(() => {
  opened.length = 0;
  vi.unstubAllGlobals();
});

describe("the Keywords section", () => {
  it("offers the three choices from the catalogue with the settings chosen, and lists the keywords opening as documents", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (url === "/api/x/keywords/settings" && init?.method === "PUT") {
        return new Response(JSON.stringify({ ...listing.settings, aliasRole: alias.id }), { status: 200 });
      }
      return new Response(JSON.stringify({ ...listing, settings: { ...listing.settings, aliasRole: alias.id } }), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(KeywordsSection, { data: listing, activeItemId: qubit, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    expect(optionsOf(root.querySelector("[data-keyword-role]"))).toEqual(["None", "Keyword", "Story"]);
    expect(chosenOf(root.querySelector("[data-keyword-role]"))).toBe(keywordRole.id);
    expect(optionsOf(root.querySelector("[data-definition-role]"))).toEqual(["None", "Definition", "Alias", "Keyword", "Story"]);
    expect(chosenOf(root.querySelector("[data-definition-role]"))).toBe(`block:${definition.id}`);
    expect(optionsOf(root.querySelector("[data-alias-role]"))).toEqual(["None", "Definition", "Alias"]);
    expect(chosenOf(root.querySelector("[data-alias-role]"))).toBe("");

    const rows = Array.from(root.querySelectorAll("[data-keyword-row]"));
    expect(rows.map((row) => row.textContent?.trim())).toEqual(["Quantum computing", "Qubit"]);
    expect(root.querySelector(`[data-keyword-row="${qubit}"]`)?.getAttribute("aria-current")).toBe("true");

    await dom.userEvent(`[data-keyword-row="${computing}"]`, "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: computing, title: "Quantum computing" }]);

    const aliasControl = root.querySelector("[data-alias-role]") as HTMLSelectElement;
    aliasControl.value = alias.id;
    await dom.userEvent("[data-alias-role]", "change");
    await settle(() => asked.some((entry) => entry.body !== undefined));
    expect(asked.find((entry) => entry.body !== undefined)).toEqual({ url: "/api/x/keywords/settings", body: JSON.stringify({ aliasRole: alias.id }) });
    await settle(() => chosenOf(root.querySelector("[data-alias-role]")) === alias.id);
    expect(chosenOf(root.querySelector("[data-alias-role]"))).toBe(alias.id);
  });

  it("says a refusal in the route's words and keeps the choice", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response(JSON.stringify({ error: "forbidden", detail: "Only the owner sets the keyword roles." }), { status: 403 });
      return new Response(JSON.stringify(listing), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(KeywordsSection, { data: listing, activeItemId: null, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    (root.querySelector("[data-keyword-role]") as HTMLSelectElement).value = story.id;
    await dom.userEvent("[data-keyword-role]", "change");
    await settle(() => root.querySelector("[data-keywords-notice]") !== null && root.querySelector("[data-keywords-notice]") !== undefined);
    expect(root.querySelector("[data-keywords-notice]")?.textContent?.trim()).toBe("Only the owner sets the keyword roles.");
    expect(chosenOf(root.querySelector("[data-keyword-role]"))).toBe(keywordRole.id);
  });

  it("says that Calliopa is restarting on a bare 503, and keeps the choice", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response("Calliopa is restarting", { status: 503 });
      return new Response(JSON.stringify(listing), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(KeywordsSection, { data: listing, activeItemId: null, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    (root.querySelector("[data-keyword-role]") as HTMLSelectElement).value = story.id;
    await dom.userEvent("[data-keyword-role]", "change");
    await settle(() => root.querySelector("[data-keywords-notice]") !== null && root.querySelector("[data-keywords-notice]") !== undefined);
    expect(root.querySelector("[data-keywords-notice]")?.textContent?.trim()).toBe("Calliopa is restarting; choose again in a moment.");
    expect(chosenOf(root.querySelector("[data-keyword-role]"))).toBe(keywordRole.id);
  });

  it("says when no keyword role is chosen, when there are no keywords, and when nothing could be read", async () => {
    const unchosen = await mount(jsx(KeywordsSection, { data: { ...listing, settings: { keywordRole: null, definitionRole: null, aliasRole: null }, keywords: [] }, activeItemId: null, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    expect(unchosen.root.querySelector("[data-keywords-empty]")?.textContent?.trim()).toBe("Choose the document role that marks a keyword");
    expect(unchosen.root.querySelector("[data-definition-role]")?.hasAttribute("disabled")).toBe(true);
    const none = await mount(jsx(KeywordsSection, { data: { ...listing, keywords: [] }, activeItemId: null, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    expect(none.root.querySelector("[data-keywords-empty]")?.textContent?.trim()).toBe("No keywords yet");
    const unread = await mount(jsx(KeywordsSection, { data: { ...listing, reachable: false }, activeItemId: null, sectionKey: "keywords:keywords", filter: null, setFilter$: $(async () => {}) }));
    expect(unread.root.querySelector("[data-keywords-empty]")?.textContent?.trim()).toBe("The keywords could not be read");
    expect(unread.root.querySelector("[data-keywords-settings]")).toBeFalsy();
  });
});

const sentence = (blockId: string, order: string, runs: { text: string; marks?: readonly ("bold" | "italic")[] }[]): BlockView => ({
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

describe("Mentioned in", () => {
  const mentioned: MentionedInView = {
    keyword: { id: computing, title: "Quantum computing", aliases: [], definition: null, definitionSource: null },
    documents: [
      { documentId: "doc-2", title: "An essay", mentions: [{ blockId: "blk-x", words: "Quantum computing is loud." }] },
      { documentId: "doc-3", title: "Notes", mentions: [{ blockId: "blk-y", words: "On QCs." }, { blockId: "blk-z", words: "More quantum computers." }] },
    ],
  };

  it("lists the mentioning documents with their words, and a press opens one", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: mentioned }), { status: 200 }));
    const { root, settle, dom } = await mount(jsx(MentionedIn, { documentId: computing, dataRevision: 3 }));
    await settle(() => root.querySelector("[data-mentioned-in]") !== null && root.querySelector("[data-mentioned-in]") !== undefined);
    expect(Array.from(root.querySelectorAll("[data-mentioning-document]")).map((row) => row.querySelector("button")?.textContent?.trim())).toEqual(["An essay", "Notes"]);
    expect(Array.from(root.querySelectorAll("[data-mentioning-block]")).map((row) => row.textContent?.trim())).toEqual(["Quantum computing is loud.", "On QCs.", "More quantum computers."]);
    await dom.userEvent('[data-mentioning-document="doc-3"] button', "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: "doc-3", title: "Notes" }]);
  });

  it("draws nothing on a document that is no keyword, or is mentioned nowhere", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: { keyword: null, documents: [] } }), { status: 200 }));
    const none = await mount(jsx(MentionedIn, { documentId: "doc-9", dataRevision: 3 }));
    await none.settle(() => false);
    expect(none.root.querySelector("[data-mentioned-in]")).toBeFalsy();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ outcome: "success", result: { ...mentioned, documents: [] } }), { status: 200 }));
    const nowhere = await mount(jsx(MentionedIn, { documentId: computing, dataRevision: 3 }));
    await nowhere.settle(() => false);
    expect(nowhere.root.querySelector("[data-mentioned-in]")).toBeFalsy();
  });
});
