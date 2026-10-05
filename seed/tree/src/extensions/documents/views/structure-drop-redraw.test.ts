import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A structure dropped from the sheet shows at once, without a reload
 * (`calliopa-bootstrap`'s `BO_0349_025`, found in the walk at pin 4805): the
 * document's structures the use answers are drawn by the pills on the page.
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

const draft: DocumentView = { documentId: "doc-r", revisionId: "rev-doc", title: "Story", blocks: [text("blk-a", "a", "It opens on a storm.")] };
const STORY = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const HOOK = { key: "hook", name: "Hook", type: "text", required: true };
const story = { id: STORY, name: "Story", description: "", retired: false, builtin: false, order: 1, fields: [HOOK], offers: [], offeredBy: [], blocks: true, text: "" };
const view = (taken: boolean) => ({
  documentId: "doc-r",
  dataRevision: taken ? 8 : 7,
  inherited: [],
  structures: [],
  takeable: [STORY],
  blocks: [
    {
      blockId: "blk-a",
      kind: "text",
      parentId: null,
      structures: taken ? [{ id: STORY, name: "Story", description: "", retired: false, builtin: false, offered: true, fields: [HOOK], values: {}, missing: ["hook"], blocks: true }] : [],
      takeable: [STORY],
    },
  ],
});

let last: { idle: () => Promise<void> } | null = null;
afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

describe("a structure dropped from the sheet", () => {
  it("When it is used on a block, Then the block's pill shows without a reload", async () => {
    const sent: SentCommand[] = [];
    const api = documentsApi(draft, sent);
    let taken = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/library/structures/structures") return new Response(JSON.stringify({ reachable: true, structures: [story] }), { status: 200 });
      if (url.startsWith("/api/x/structures/documents/doc-r")) {
        if (init?.method === "POST") taken = true;
        return new Response(JSON.stringify({ outcome: "success", result: view(taken) }), { status: 200 });
      }
      return api(url, init);
    });
    const editor = await mountEditor(draft);
    last = editor;
    await editor.idle();
    expect(editor.root.querySelector('[data-block-id="blk-a"] [data-block-structure]')).toBeFalsy();
    editor.record.drop = { itemId: STORY, overId: "nest:blk-a", kind: "structures:structure" };
    await editor.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 200 && editor.root.querySelector('[data-block-id="blk-a"] [data-block-structure]') == null; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await editor.userEvent(editor.root, "harnessSettle");
    }
    expect(editor.root.querySelector('[data-block-id="blk-a"] [data-block-structure]')).toBeTruthy();
  });

  it("When it is used on a block, Then the block is left edited and its structure opens on its fields (BO_0349_037)", async () => {
    const sent: SentCommand[] = [];
    const api = documentsApi(draft, sent);
    let taken = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/library/structures/structures") return new Response(JSON.stringify({ reachable: true, structures: [story] }), { status: 200 });
      if (url.startsWith("/api/x/structures/documents/doc-r")) {
        if (init?.method === "POST") taken = true;
        return new Response(JSON.stringify({ outcome: "success", result: view(taken) }), { status: 200 });
      }
      return api(url, init);
    });
    const editor = await mountEditor(draft);
    last = editor;
    await editor.idle();
    editor.record.drop = { itemId: STORY, overId: "nest:blk-a", kind: "structures:structure" };
    await editor.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 200 && editor.root.querySelector(`[data-structure-fields="${STORY}"]`) == null; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await editor.userEvent(editor.root, "harnessSettle");
    }
    expect(editor.root.querySelector('[data-block-id="blk-a"] [data-block-editor]')).toBeTruthy();
    expect(editor.root.querySelector(`[data-structure-fields="${STORY}"]`)).toBeTruthy();
  });
});

