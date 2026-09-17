import { describe, expect, it } from "vitest";

import {
  commandTarget,
  deliveryFor,
  documentOf,
  DOCUMENT_KIND,
  NO_CHOICE,
  NO_UNAIMED,
  proposedFor,
  startedDocument,
  readCommandTarget,
  revealFor,
  revealTarget,
  type DocumentTarget,
  type PointedReference,
  type Pointing,
} from "./command-target";

/**
 * What a command is aimed at, built by the composer and read back by the
 * route. BO_0226_004 BO_0226_005
 */
const documentTab = (itemId: string) => ({ kind: DOCUMENT_KIND, itemId });
const block = (blockId: string, number: number): PointedReference => ({
  kind: "block",
  blockId,
  number,
  words: `words of ${blockId}`,
  stale: false,
});
const pointing: Record<string, Pointing> = {
  "doc-1": {
    references: [block("blk-b", 1), block("blk-a", 2)],
    pinned: [{ blockId: "blk-c", words: "pinned words" }],
  },
};

describe("aiming a command", () => {
  it("Given a document tab, Then the command is aimed at it, proposes by default, and carries its marks in mark order", () => {
    expect(commandTarget(documentTab("doc-1"), NO_CHOICE, pointing, "answer")).toEqual({
      artifact: "doc-1",
      delivery: "propose",
      references: [
        { kind: "block", blockId: "blk-b", number: 1 },
        { kind: "block", blockId: "blk-a", number: 2 },
      ],
    });
  });

  it("Given a passage marked, Then it travels with its words, and neither the shown words, the staleness nor the pinned blocks do", () => {
    const withPassage: Record<string, Pointing> = {
      "doc-1": {
        references: [
          block("blk-a", 1),
          {
            kind: "passage",
            blockId: "blk-a",
            number: 2,
            quote: "a clause",
            words: "a clause",
            stale: false,
          },
        ],
        pinned: [{ blockId: "blk-c", words: "pinned words" }],
      },
    };
    expect(
      (commandTarget(documentTab("doc-1"), NO_CHOICE, withPassage, "answer") as DocumentTarget | null)?.references,
    ).toEqual([
      { kind: "block", blockId: "blk-a", number: 1 },
      { kind: "passage", blockId: "blk-a", number: 2, quote: "a clause" },
    ]);
  });

  it("Given a tab that is not a document, Then the command is aimed at nothing", () => {
    expect(
      commandTarget(
        { kind: "ui.shell:extension", itemId: "calliopa-video" },
        NO_CHOICE,
        pointing,
        "answer",
      ),
    ).toBeNull();
    expect(
      commandTarget(
        { kind: "settings:settings", itemId: null },
        NO_CHOICE,
        pointing,
        "answer",
      ),
    ).toBeNull();
    expect(commandTarget(undefined, NO_CHOICE, pointing, "answer")).toBeNull();
    expect(documentOf({ kind: DOCUMENT_KIND, itemId: "" })).toBeNull();
  });

  it("Given nothing open, Then the command starts a document by default, sends no artifact and no references, and after × is aimed at nothing", () => {
    expect(NO_UNAIMED).toBe("start");
    for (const tab of [undefined, { kind: "settings:settings", itemId: "instance" }]) {
      expect(commandTarget(tab, NO_CHOICE, pointing, NO_UNAIMED)).toEqual({ delivery: "start" });
      expect(commandTarget(tab, NO_CHOICE, pointing, "answer")).toBeNull();
    }
    // A document tab is aimed at its document whatever the unaimed choice.
    expect(commandTarget(documentTab("doc-1"), NO_CHOICE, pointing, "start")?.delivery).toBe("propose");
  });

  it("Given Answer chosen in one document, Then it governs that document and never the next", () => {
    const choice = { itemId: "doc-1", delivery: "answer" as const };
    expect(deliveryFor("doc-1", choice)).toBe("answer");
    expect(deliveryFor("doc-2", choice)).toBe("propose");
    expect(
      commandTarget(documentTab("doc-2"), choice, pointing, "answer")?.delivery,
    ).toBe("propose");
  });

  it("Given a document with nothing marked, Then it carries no references rather than another document's", () => {
    expect(
      (commandTarget(documentTab("doc-2"), NO_CHOICE, pointing, "answer") as DocumentTarget | null)?.references,
    ).toEqual([]);
  });

  it("Given the marks change after the press, Then what was sent does not", () => {
    const references = [block("blk-a", 1)];
    const live: Record<string, Pointing> = {
      "doc-1": { references, pinned: [] },
    };
    const sent = commandTarget(documentTab("doc-1"), NO_CHOICE, live, "answer");
    references.push(block("blk-c", 2));
    expect((sent as DocumentTarget | null)?.references).toEqual([
      { kind: "block", blockId: "blk-a", number: 1 },
    ]);
  });
});

describe("reading a target back", () => {
  it("Given a body aimed at nothing, Then the command is aimed at nothing", () => {
    expect(readCommandTarget({})).toEqual({ ok: true, target: null });
  });

  it("Given start with nothing open, Then it reads as a command that starts a document", () => {
    expect(readCommandTarget({ delivery: "start" })).toEqual({ ok: true, target: { delivery: "start" } });
  });

  it("Given start with a document or with references, Then it is refused by name", () => {
    const withDocument = readCommandTarget({ artifact: "doc-1", delivery: "start" });
    expect(withDocument).toEqual({ ok: false, error: "A started document is not delivered into an open one." });
    const withReferences = readCommandTarget({ delivery: "start", references: [{ number: 1, blockId: "blk-a" }] });
    expect(withReferences).toEqual({ ok: false, error: "A started document carries no references: they need the document they point into." });
  });

  it("Given a coherent body, Then it reads as the target it describes", () => {
    expect(
      readCommandTarget({
        artifact: " doc-1 ",
        delivery: "answer",
        references: [{ number: 3, blockId: " blk-a " }],
      }),
    ).toEqual({
      ok: true,
      target: {
        artifact: "doc-1",
        delivery: "answer",
        references: [{ kind: "block", blockId: "blk-a", number: 3 }],
      },
    });
  });

  it("Given a passage in the body, Then it reads back with its words exactly as sent", () => {
    expect(
      readCommandTarget({
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { number: 1, blockId: "blk-a", kind: "block" },
          {
            number: 2,
            blockId: "blk-a",
            kind: "passage",
            quote: "  spaced words ",
          },
        ],
      }),
    ).toEqual({
      ok: true,
      target: {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { kind: "block", blockId: "blk-a", number: 1 },
          {
            kind: "passage",
            blockId: "blk-a",
            number: 2,
            quote: "  spaced words ",
          },
        ],
      },
    });
  });

  it("Given a shape the composer never sends, Then it is refused by name rather than forwarded or guessed at", () => {
    for (const body of [
      { delivery: "propose" },
      { references: [] },
      { artifact: 7 },
      { artifact: "doc-1" },
      { artifact: "doc-1", delivery: "apply" },
      { artifact: "doc-1", delivery: "propose", references: "blk-a" },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 0, blockId: "blk-a" }],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 1.5, blockId: "blk-a" }],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 1, blockId: " " }],
      },
      { artifact: "doc-1", delivery: "propose", references: [null] },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 1, blockId: "blk-a", kind: "passage" }],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { number: 1, blockId: "blk-a", kind: "passage", quote: "" },
        ],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          {
            number: 1,
            blockId: "blk-a",
            kind: "passage",
            quote: "é".repeat(2001),
          },
        ],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 1, blockId: "blk-a", quote: "words" }],
      },
      {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ number: 1, blockId: "blk-a", kind: "range" }],
      },
    ]) {
      const read = readCommandTarget(body);
      expect(read.ok, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("the document a started run created", () => {
  it("Given a run whose end names a document, Then that document is what opens, whatever the end", () => {
    for (const kind of ["runCompleted", "runFailed", "runCancelled"] as const) {
      const end =
        kind === "runCompleted"
          ? { kind, runId: "r", at: 2, output: "done", document: "doc-new" }
          : kind === "runFailed"
            ? { kind, runId: "r", at: 2, error: "x", document: "doc-new" }
            : { kind, runId: "r", at: 2, document: "doc-new" };
      expect(startedDocument([{ kind: "runStarted", runId: "r", at: 1 }, end])).toBe("doc-new");
    }
  });

  it("Given a run still going, or one that ended naming nothing, Then nothing opens", () => {
    expect(startedDocument([{ kind: "runStarted", runId: "r", at: 1 }])).toBeNull();
    expect(startedDocument([{ kind: "runCompleted", runId: "r", at: 2, output: "done" }])).toBeNull();
    expect(startedDocument([{ kind: "runCompleted", runId: "r", at: 2, output: "done", document: "" }])).toBeNull();
  });
});

describe("a view looking at the last run that ended", () => {
  it("Given a run aimed at this document ends, Then the view acts, once", () => {
    const looked = proposedFor({ itemId: "doc-1", seq: 1 }, 0, "doc-1");
    expect(looked).toEqual({ seen: 1, act: true });
    expect(
      proposedFor({ itemId: "doc-1", seq: 1 }, looked.seen, "doc-1"),
    ).toEqual({
      seen: 1,
      act: false,
    });
  });

  it("Given a run aimed at another document ends, Then it is seen and passed over", () => {
    expect(proposedFor({ itemId: "doc-2", seq: 3 }, 2, "doc-1")).toEqual({
      seen: 3,
      act: false,
    });
  });

  it("Given a run that ended before the view opened, Then opening the document does not act on it again", () => {
    // The view starts having seen the count that stood when it opened.
    expect(proposedFor({ itemId: "doc-1", seq: 4 }, 4, "doc-1")).toEqual({
      seen: 4,
      act: false,
    });
  });

  it("Given a second run against the same document ends, Then the view acts again", () => {
    expect(proposedFor({ itemId: "doc-1", seq: 5 }, 4, "doc-1").act).toBe(true);
  });

  it("Given a view with no document, Then nothing is acted on", () => {
    expect(proposedFor({ itemId: "doc-1", seq: 1 }, 0, null).act).toBe(false);
  });
});

describe("a chip asking the view to show its area", () => {
  const passage: PointedReference = {
    kind: "passage",
    number: 3,
    blockId: "blk-p",
    quote: "the lights",
    words: "the lights",
    stale: false,
  };

  it("Given a block reference or a pinned block, Then the view is asked for the block", () => {
    expect(revealTarget(block("blk-a", 1))).toEqual({ kind: "block", blockId: "blk-a" });
    expect(revealTarget({ blockId: "blk-c", words: "pinned words" })).toEqual({
      kind: "block",
      blockId: "blk-c",
    });
  });

  it("Given a passage, Then the view is asked for it by its number in its block", () => {
    expect(revealTarget(passage)).toEqual({ kind: "passage", blockId: "blk-p", number: 3 });
  });

  it("Given a press on a chip for this document, Then the view acts, and a second press acts again", () => {
    const target = revealTarget(passage);
    const first = revealFor({ itemId: "doc-1", target, seq: 1 }, 0, "doc-1");
    expect(first).toEqual({ seen: 1, target });
    expect(revealFor({ itemId: "doc-1", target, seq: 1 }, first.seen, "doc-1").target).toBeNull();
    expect(revealFor({ itemId: "doc-1", target, seq: 2 }, first.seen, "doc-1").target).toEqual(target);
  });

  it("Given a press for another document, or one made before the view opened, Then nothing is shown", () => {
    const target = revealTarget(passage);
    expect(revealFor({ itemId: "doc-2", target, seq: 3 }, 2, "doc-1")).toEqual({ seen: 3, target: null });
    expect(revealFor({ itemId: "doc-1", target, seq: 4 }, 4, "doc-1").target).toBeNull();
  });
});
