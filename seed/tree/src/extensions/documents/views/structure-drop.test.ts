import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";
import { APPLY_A_STRUCTURE } from "../lib/instruction";
import { addPassage, NO_MARKING, parseMarking, serializeMarking, toggleReference } from "../lib/references";
import { anchorAt } from "~/lib/passage";

/**
 * A structure dragged out of the *Structures* sheet and dropped on a block's
 * middle or a document's header (`calliopa-bootstrap`'s `BO_0349_011`): the
 * editor hands it to the extension that knows its kind — `structures`, which
 * uses it there through its own route — and shows what that answers. A
 * structure dropped between rows means nothing, and nothing moves.
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

const draft: DocumentView = {
  documentId: "doc-s",
  revisionId: "rev-doc",
  title: "Story",
  blocks: [text("blk-a", "a", "What is the story telling the reader"), text("blk-b", "b", "It opens on a storm.")],
};

const STRUCTURE = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";

let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

async function mount() {
  const sent: SentCommand[] = [];
  const posted: { url: string; body: unknown }[] = [];
  const api = documentsApi(draft, sent);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if ((url.startsWith("/api/x/structures/") || url.startsWith("/api/x/instructions/")) && init?.method === "POST") {
      posted.push({ url, body: JSON.parse(String(init.body)) as unknown });
      return new Response(
        JSON.stringify({ outcome: "validationFailure", failures: [{ operation: null, rule: "notOffered", detail: "Hook is offered by Story, and nothing above this block carries it." }] }),
        { status: 422 },
      );
    }
    return api(url, init);
  });
  const view = await mountEditor(draft);
  last = view;
  const drop = async (overId: string) => {
    view.record.drop = { itemId: STRUCTURE, overId, kind: "structures:structure" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && posted.length === 0; tick++) await view.settle();
    await view.idle();
  };
  return { ...view, sent, posted, drop };
}

describe("a structure dropped from the library", () => {
  it("Given a text row, Then its middle and its edges take a block or a library item", async () => {
    const view = await mount();
    const row = view.root.querySelector('[data-block-id="blk-a"]');
    expect(row?.getAttribute("data-accepts")).toBe("move link");
    expect(row?.getAttribute("data-middle-accepts")).toBe("move link");
  });

  it("When it is dropped on a block's middle, Then structures uses it on that block, And its refusal is said on the document", async () => {
    const view = await mount();
    await view.drop("nest:blk-a");
    expect(view.posted).toEqual([
      { url: `/api/x/structures/documents/doc-s/blocks/blk-a/structures`, body: { structure: STRUCTURE, taken: true } },
    ]);
    await view.settle(() => (view.root.querySelector("[data-block-error]")?.textContent ?? "").includes("Hook is offered by Story"));
    expect(view.sent.some((command) => ["move", "moveIn"].includes(String(command.body["command"])))).toBe(false);
  });

  it("When it is dropped on the header, Then structures uses it on the document", async () => {
    const view = await mount();
    await view.drop("header:doc-s");
    expect(view.posted.map((entry) => entry.url)).toEqual([`/api/x/structures/documents/doc-s/structures`]);
  });

  it("When an instruction is dropped on a block's middle or the header, Then instructions stands it there (BO_0349_011)", async () => {
    const view = await mount();
    view.record.drop = { itemId: STRUCTURE, overId: "nest:blk-b", kind: "instructions:instruction" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && view.posted.length === 0; tick++) await view.settle();
    view.record.drop = { itemId: STRUCTURE, overId: "header:doc-s", kind: "instructions:instruction" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && view.posted.length < 2; tick++) await view.settle();
    await view.idle();
    expect(view.posted).toEqual([
      { url: "/api/x/instructions/documents/doc-s/blocks/blk-b/standing", body: { instruction: STRUCTURE } },
      { url: "/api/x/instructions/documents/doc-s/standing", body: { instruction: STRUCTURE } },
    ]);
  });

  it("When it is dropped between rows, Then it is applied to the whole document by a run under Apply a structure, nothing is used at once and nothing moves (BO_0349_012)", async () => {
    const view = await mount();
    view.record.drop = { itemId: STRUCTURE, overId: "block:blk-b", kind: "structures:structure" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && (view.record.instructed?.length ?? 0) === 0; tick++) await view.settle();
    await view.idle();
    expect(view.record.instructed).toEqual([
      {
        itemId: "doc-s",
        goal: "Apply the structure #1 to this document: propose it with the values the document's words hold.",
        instruction: APPLY_A_STRUCTURE,
        references: [{ number: 1, kind: "document", document: STRUCTURE }],
      },
    ]);
    expect(view.posted).toEqual([]);
    expect(view.sent.some((command) => ["move", "moveIn"].includes(String(command.body["command"])))).toBe(false);
  });

  it("When an instruction is dropped between rows, Then nothing stands and nothing starts", async () => {
    const view = await mount();
    view.record.drop = { itemId: STRUCTURE, overId: "block:blk-b", kind: "instructions:instruction" };
    await view.userEvent("[data-harness-drop]", "click");
    await view.idle();
    expect(view.posted).toEqual([]);
    expect(view.record.instructed ?? []).toEqual([]);
  });

  it("Given a structure held between rows, Then the body lights red and no mark between rows does", async () => {
    const view = await mount();
    view.record.over = "block:blk-b";
    view.record.overOperation = "link";
    view.record.overKind = "structures:structure";
    await view.userEvent("[data-harness-over]", "click");
    expect(view.root.querySelector(".document-flow")?.getAttribute("data-applying")).toBe("true");
    expect(view.root.querySelector('[data-drop-mark="blk-b"]')?.getAttribute("data-drop-active") ?? null).toBeNull();
    view.record.overOperation = "move";
    await view.userEvent("[data-harness-over]", "click");
    expect(view.root.querySelector(".document-flow")?.getAttribute("data-applying") ?? null).toBeNull();
  });

  it("When a structure is dropped on a marked passage, Then a run applies it to those words alone (BO_0349_038)", async () => {
    let marking = toggleReference(NO_MARKING, "blk-a", { revisionId: "rev-blk-a", words: "What is the story telling the reader" });
    marking = addPassage(marking, "blk-b", anchorAt("It opens on a storm.", 12, 19));
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(draft, sent));
    const view = await mountEditor(draft, {
      session: { documentId: "doc-s", prompt: "blk-a", marks: serializeMarking(marking) ?? "", documents: [], seq: 1 },
    });
    last = view;
    const number = parseMarking(serializeMarking(marking)).references.find((reference) => reference.kind === "passage")?.number ?? 0;
    view.record.drop = { itemId: STRUCTURE, overId: `passage:blk-b:${number}`, kind: "structures:structure" };
    await view.userEvent("[data-harness-drop]", "click");
    for (let tick = 0; tick < 40 && (view.record.instructed?.length ?? 0) === 0; tick++) await view.settle();
    await view.idle();
    expect(view.record.instructed).toEqual([
      {
        itemId: "doc-s",
        goal: "Apply the structure #1 to the passage #2 alone: propose it on the block holding #2, with the values #2's words hold.",
        instruction: APPLY_A_STRUCTURE,
        references: [
          { number: 1, kind: "document", document: STRUCTURE },
          { number: 2, kind: "passage", blockId: "blk-b", quote: "a storm" },
        ],
      },
    ]);
  });
});

