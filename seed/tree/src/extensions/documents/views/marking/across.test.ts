import { afterEach, describe, expect, it, vi } from "vitest";

import type { ViewPointing } from "~/components/shell/view-bridge";
import { anchorAt } from "~/lib/passage";
import type { DocumentView } from "../../server/assemble";
import { addPassage, NO_MARKING, parseMarking, serializeMarking, toggleDocument, toggleReference } from "../../lib/references";
import { documentsApi, mountEditor, pointFrom, type SentCommand } from "../testing/editor-harness";

/**
 * Pointing follows the reader across tabs (BO_0304_008, BO_0304_009,
 * BO_0304_010): the shell holds the pointing session, a view the session does
 * not name is its guest — drawing the session's marks that point into its
 * document and marking for the session — and the prompt's view reads its
 * marks from the session when it mounts again. Pressed in Qwik's render
 * harness through the editor's own JSX, with the session preset as the shell
 * would hold it.
 */
const text = (blockId: string, order: string, words: string) => ({
  kind: "text" as const,
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph" as const,
  standing: "keep" as const,
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "The storm arrives before the lights go out."), text("blk-c", "c", "Closing.")],
};

/** The session as another document's prompt left it: its own block first,
 * then a block of this document, then a third document whole. */
const elsewhere = (): ViewPointing => {
  let marking = toggleReference(NO_MARKING, "blk-p", { revisionId: "rev-p", words: "Prompt's own." });
  marking = toggleReference(marking, "blk-a", { document: "doc-1", documentTitle: "Draft", revisionId: "rev-blk-a", words: "Opening." });
  marking = toggleDocument(marking, "doc-9", "Ninth");
  return { documentId: "doc-2", prompt: "blk-p", marks: serializeMarking(marking) ?? "", documents: [{ document: "doc-9", title: "Ninth", number: 3 }], seq: 1 };
};

const sessionMarks = (session: ViewPointing | undefined) => parseMarking(session === undefined || session.marks === "" ? null : session.marks);
const row = (root: HTMLElement, blockId: string) => (root.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null) ?? null;
const mode = (root: HTMLElement) => root.querySelector("[data-view-body]")?.getAttribute("data-editor-mode");

afterEach(() => {
  vi.unstubAllGlobals();
});

async function mount(options: Parameters<typeof mountEditor>[1] = {}) {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  return mountEditor(draft, options);
}

describe("a guest of another document's pointing", () => {
  it("Given a session naming another document, Then this view opens in command mode drawing the marks that point into it, and marks for the session", async () => {
    const view = await mount({ session: elsewhere() });
    expect(mode(view.root)).toBe("command");
    expect(row(view.root, "blk-a")?.getAttribute("data-reference")).toBe("2");
    expect(row(view.root, "blk-c")?.hasAttribute("data-reference")).toBe(false);
    expect(view.root.querySelector("[data-pointing-from]")).toBeFalsy();

    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.settle(() => row(view.root, "blk-c")?.getAttribute("data-reference") === "4");
    const marks = sessionMarks(view.record.session);
    expect(marks.references.map((held) => [held.number, held.kind, held.blockId ?? (held.kind === "document" ? held.document : null), held.kind === "document" ? undefined : held.document])).toEqual([
      [1, "block", "blk-p", undefined],
      [2, "block", "blk-a", "doc-1"],
      [3, "document", "doc-9", undefined],
      [4, "block", "blk-c", "doc-1"],
    ]);
    expect(marks.references[3]).toMatchObject({ documentTitle: "Draft", revisionId: "rev-blk-c", words: "Closing." });
    // The guest reports nothing: the marks are the other prompt's.
    expect(view.record.pointing).toBeNull();

    // A passage in the guest is the session's too, and pressing the row's
    // own number takes only that mark back.
    await view.userEvent('[data-block-id="blk-a"]', "click");
    await view.settle(() => sessionMarks(view.record.session).references.length === 3);
    expect(row(view.root, "blk-a")?.hasAttribute("data-reference")).toBe(false);
    await view.idle();
  });

  it("Given a guest, When the pointing ends elsewhere, Then the view reads again with no mark left", async () => {
    const view = await mount({ session: elsewhere() });
    expect(mode(view.root)).toBe("command");
    const session = view.record.session;
    if (session === undefined) throw new Error("no session store");
    // The prompt's view, or a guest, cleared the session (`point$(null)`).
    session.documentId = null;
    session.prompt = null;
    session.marks = "";
    session.documents = [];
    session.seq += 1;
    await view.settle(() => mode(view.root) === "reading");
    expect(view.root.querySelector("[data-reference]")).toBeFalsy();
    // Back to its own: the view reports its own marks again, of which it
    // has none.
    await view.settle(() => view.record.pointing !== null);
    expect(view.record.pointing?.references).toEqual([]);
    await view.idle();
  });

  it("Given a guest, When the shell's Mark document arrives, Then the session gains the document whole and the request is cleared", async () => {
    const view = await mount({ session: elsewhere() });
    const across = view.record.across;
    if (across === undefined) throw new Error("no across store");
    across.document = "doc-7";
    across.title = "Seventh";
    across.seq += 1;
    await view.settle(() => (view.record.session?.documents.length ?? 0) === 2);
    expect(view.record.session?.documents).toEqual([
      { document: "doc-9", title: "Ninth", number: 3 },
      { document: "doc-7", title: "Seventh", number: 4 },
    ]);
    expect(across.document).toBeNull();
    await view.idle();
  });
});

describe("the prompt's view mounting again while its pointing stands", () => {
  it("Given a session naming this document and prompt, Then the view points from that prompt with the session's marks, and reports them with their documents", async () => {
    let marking = toggleReference(NO_MARKING, "blk-c", { revisionId: "rev-blk-c", words: "Closing." });
    marking = toggleReference(marking, "blk-x", { document: "doc-2", documentTitle: "Second", revisionId: "rev-x", words: "Elsewhere." });
    marking = addPassage(marking, "blk-y", anchorAt("Rain at dawn.", 0, 4), { document: "doc-2", documentTitle: "Second", revisionId: "rev-y" });
    marking = toggleDocument(marking, "doc-9", "Ninth");
    const view = await mount({
      session: { documentId: "doc-1", prompt: "blk-b", marks: serializeMarking(marking) ?? "", documents: [{ document: "doc-9", title: "Ninth", number: 4 }], seq: 1 },
    });
    await view.settle(() => mode(view.root) === "command");
    expect(row(view.root, "blk-b")?.getAttribute("data-pointing-from")).toBe("true");
    // Edited again, as it was left: the command control stands on it and its
    // words take the caret (BO_0304_018).
    await view.settle(() => view.root.querySelector('[data-block-command="blk-b"]') !== null);
    expect(row(view.root, "blk-b")?.querySelector("[data-block-editor]")).toBeTruthy();
    expect(row(view.root, "blk-c")?.getAttribute("data-reference")).toBe("1");
    await view.settle(() => (view.record.pointing?.references.length ?? 0) === 4);
    expect(view.record.pointing?.references.map((held) => [held.number, held.kind, held.document, held.documentTitle, held.words, held.stale, held.rowless])).toEqual([
      [1, "block", undefined, undefined, "Closing.", false, undefined],
      [2, "block", "doc-2", "Second", "Elsewhere.", false, undefined],
      [3, "passage", "doc-2", "Second", "Rain", false, undefined],
      [4, "document", "doc-9", "Ninth", "Ninth", false, undefined],
    ]);
    // The chips say which document, and a press brings that document forward.
    expect(view.root.querySelector('[data-chip="2"] [data-chip-document="doc-2"]')?.textContent).toBe("Second");
    await view.userEvent('[data-chip="2"]', "click");
    await view.settle(() => (view.record.opened?.length ?? 0) === 1);
    expect(view.record.opened).toEqual([{ kind: "documents:document", itemId: "doc-2", title: "Second" }]);
    await view.userEvent('[data-chip="4"]', "click");
    await view.settle(() => (view.record.opened?.length ?? 0) === 2);
    expect(view.record.opened?.[1]).toEqual({ kind: "documents:document", itemId: "doc-9", title: "Ninth" });

    // A mark made here goes to the session too.
    await view.userEvent('[data-block-id="blk-a"]', "click");
    await view.settle(() => sessionMarks(view.record.session).references.length === 5);
    expect(sessionMarks(view.record.session).references[4]).toMatchObject({ kind: "block", blockId: "blk-a", number: 5 });
    await view.idle();
  });

  it("Given a reveal aimed at this document that no view consumed, Then the view acts on it as it mounts", async () => {
    const view = await mount({ reveal: { kind: "block", blockId: "blk-c", document: "doc-1" } });
    await view.settle(() => row(view.root, "blk-c")?.getAttribute("data-revealed") === "block");
    expect(row(view.root, "blk-a")?.hasAttribute("data-revealed")).toBe(false);
    await view.idle();
  });

  it("Given a view pointing from a block, Then the session names it, and pointing again from another block moves the session with it", async () => {
    const view = await mount();
    await pointFrom(view, "blk-b");
    expect(view.record.session).toMatchObject({ documentId: "doc-1", prompt: "blk-b" });
    await view.userEvent('[data-block-id="blk-c"]', "click");
    await view.settle(() => sessionMarks(view.record.session).references.length === 1);
    expect(sessionMarks(view.record.session).references[0]).toMatchObject({ kind: "block", blockId: "blk-c", number: 1 });
    await view.idle();
  });
});
