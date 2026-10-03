import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { SHARED_EVENT, type SharedHere } from "./shared";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * Something shared into the app while a document is open (`BO_0319_050`):
 * its editor claims it and places it below the block the reader is in — a
 * text as its paragraphs, in order, and an address as a paragraph holding it
 * as a link where no bibliography answers.
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

/** A share as the receiver hands it, made with the harness's own document,
 * which has no event constructors. */
const share = (page: Document, detail: SharedHere): void => {
  const made = page.createEvent("Event");
  made.initEvent(SHARED_EVENT, true, true);
  Object.assign(made, { detail });
  page.dispatchEvent(made);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a share into the open document", () => {
  it("Given a block focused, When a text and an address are shared, Then each lands below it in order", async () => {
    const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notes", blocks: [text("blk-a", "a", "One"), text("blk-z", "z", "Last")] };
    const sent: SentCommand[] = [];
    vi.stubGlobal("fetch", documentsApi(document, sent));
    const view = await mountEditor(document);
    await view.userEvent('[data-block-id="blk-a"] [data-block-reading]', "focus");
    const detail: SharedHere = {
      documentId: "doc-1",
      items: [
        { kind: "text", text: "Hello\n\nWorld" },
        { kind: "address", address: "https://example.org/a" },
      ],
      taken: false,
    };
    share(view.root.ownerDocument, detail);
    expect(detail.taken).toBe(true);
    const inserts = () => sent.filter((command) => command.body["command"] === "insert");
    await view.settle(() => inserts().length === 3);
    const [hello, world, address] = inserts().map((command) => command.body);
    expect(hello?.["placement"]).toEqual({ after: "blk-a" });
    expect(hello?.["block"]).toEqual({ kind: "text", runs: [{ text: "Hello" }] });
    expect((world?.["block"] as { runs: unknown }).runs).toEqual([{ text: "World" }]);
    expect(world?.["placement"]).not.toEqual({ after: "blk-a" });
    expect((address?.["block"] as { runs: unknown }).runs).toEqual([{ text: "https://example.org/a", link: "https://example.org/a" }]);
    await view.idle();
  });

  it("Given a bibliography, When an address is shared, Then it is added as a source and cited in a new paragraph", async () => {
    const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notes", blocks: [text("blk-a", "a", "One")] };
    const sent: SentCommand[] = [];
    const documents = documentsApi(document, sent);
    const added: unknown[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("/api/x/bibliography/commands")) {
        added.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ outcome: "success", result: { workId: "src-1", revisionId: "rev-src", dataRevision: "9" } }));
      }
      return documents(input, init);
    });
    const view = await mountEditor(document);
    share(view.root.ownerDocument, { documentId: "doc-1", items: [{ kind: "address", address: "https://example.org/a" }], taken: false });
    const inserts = () => sent.filter((command) => command.body["command"] === "insert");
    await view.settle(() => inserts().length === 1);
    expect(added).toEqual([{ command: "addWork", record: { kind: "webpage", title: "https://example.org/a", URL: "https://example.org/a" } }]);
    expect((inserts()[0]?.body["block"] as { runs: unknown }).runs).toEqual([{ text: "https://example.org/a " }, { text: "", cite: { work: "src-1" } }]);
    await view.idle();
  });

  it("Given a share for another document, Then this editor leaves it", async () => {
    const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "Notes", blocks: [text("blk-a", "a", "One")] };
    vi.stubGlobal("fetch", documentsApi(document, []));
    const view = await mountEditor(document);
    const detail: SharedHere = { documentId: "doc-2", items: [{ kind: "text", text: "Hello" }], taken: false };
    share(view.root.ownerDocument, detail);
    expect(detail.taken).toBe(false);
    await view.idle();
  });
});
