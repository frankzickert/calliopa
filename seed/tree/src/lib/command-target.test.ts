import { describe, expect, it } from "vitest";

import {
  blockCommand,
  documentOf,
  DOCUMENT_KIND,
  proposedFor,
  startedDocument,
  readCommandTarget,
  revealFor,
  revealTarget,
  type PointedReference,
  readRunShape,
  readGestureTarget,
  type Pointing,
  sent,
} from "./command-target";

/**
 * What a command is aimed at, built by a block's command control and read
 * back by the route. BO_0226_004 BO_0226_005 CA_0058_002
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
    fixated: [{ blockId: "blk-c", words: "fixated words" }],
  },
};

const source = { block: "blk-p", revisionId: "rev-p" };

describe("aiming a command", () => {
  it("Given a block sent as a command, Then it proposes into its document, names the block and the revision sent, and carries its marks in mark order", () => {
    expect(blockCommand("doc-1", source, pointing["doc-1"]?.references ?? [])).toEqual({
      artifact: "doc-1",
      delivery: "propose",
      references: [
        { kind: "block", blockId: "blk-b", number: 1 },
        { kind: "block", blockId: "blk-a", number: 2 },
      ],
      source,
    });
  });

  it("Given a passage marked, Then it travels with its words, and neither the shown words, the staleness nor the fixated blocks do", () => {
    const references: PointedReference[] = [
      block("blk-a", 1),
      { kind: "passage", blockId: "blk-a", number: 2, quote: "a clause", words: "a clause", stale: false },
    ];
    expect(blockCommand("doc-1", source, references).references).toEqual([
      { kind: "block", blockId: "blk-a", number: 1 },
      { kind: "passage", blockId: "blk-a", number: 2, quote: "a clause" },
    ]);
  });

  it("Given a tab that is not a document, or one with no target, Then it shows no document to command", () => {
    expect(documentOf({ kind: "ui.shell:extension", itemId: "calliopa-video" })).toBeNull();
    expect(documentOf({ kind: "settings:settings", itemId: null })).toBeNull();
    expect(documentOf(undefined)).toBeNull();
    expect(documentOf({ kind: DOCUMENT_KIND, itemId: "" })).toBeNull();
    expect(documentOf(documentTab("doc-1"))).toBe("doc-1");
  });

  it("Given the marks change after the press, Then what was sent does not", () => {
    const references = [block("blk-a", 1)];
    const sent = blockCommand("doc-1", source, references);
    references.push(block("blk-c", 2));
    expect(sent.references).toEqual([{ kind: "block", blockId: "blk-a", number: 1 }]);
  });
});

describe("reading a block command back", () => {
  it("Given a source, Then it is read back trimmed beside the references", () => {
    expect(readCommandTarget({ artifact: "doc-1", delivery: "propose", references: [], source: { block: " blk-p ", revisionId: " rev-p " } })).toEqual({
      ok: true,
      target: { artifact: "doc-1", delivery: "propose", references: [], source },
    });
  });

  it("Given a source that cannot mean anything, or the retired answer, Then it is refused by name", () => {
    for (const [body, error] of [
      [{ source }, "A command is written in a block of a document: it names the document its block is in."],
      [{ artifact: "doc-1", delivery: "propose", source: "blk-p" }, "A command's source is the block it was sent from and the revision sent."],
      [{ artifact: "doc-1", delivery: "propose", source: { revisionId: "rev-p" } }, "A command's source names no block."],
      [{ artifact: "doc-1", delivery: "propose", source: { block: "blk-p", revisionId: "" } }, "A command's source block blk-p names no revision."],
      [{ artifact: "doc-1", delivery: "answer" }, "The answer delivery is retired: a command aimed at a document proposes into it, a question's answer included."],
    ] as const) {
      expect(readCommandTarget(body)).toEqual({ ok: false, error });
    }
  });
});

describe("reading a target back", () => {
  it("Given a body naming no document, Then it is refused: a command is written in a block of one", () => {
    expect(readCommandTarget({})).toEqual({
      ok: false,
      error: "A command is written in a block of a document: it names the document its block is in.",
    });
  });

  it("Given a body with no source, Then it is refused: a command names the block it was sent from", () => {
    expect(readCommandTarget({ artifact: "doc-1", delivery: "propose" })).toEqual({
      ok: false,
      error: "A command names the block it was sent from and the revision sent.",
    });
  });

  it("Given the retired start delivery, Then it is refused by name rather than forwarded to the kernel", () => {
    expect(readCommandTarget({ artifact: "doc-1", delivery: "start", source })).toEqual({
      ok: false,
      error: "Starting a document from a command is retired: a command is written in a block of the document it works in.",
    });
    expect(readCommandTarget({ delivery: "start" }).ok).toBe(false);
  });

  it("Given a coherent body, Then it reads as the target it describes", () => {
    expect(
      readCommandTarget({
        artifact: " doc-1 ",
        delivery: "propose",
        references: [{ number: 3, blockId: " blk-a " }],
        source,
      }),
    ).toEqual({
      ok: true,
      target: {
        artifact: "doc-1",
        delivery: "propose",
        references: [{ kind: "block", blockId: "blk-a", number: 3 }],
        source,
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
        source,
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
        source,
      },
    });
  });

  it("Given a shape the shell never sends, Then it is refused by name rather than forwarded or guessed at", () => {
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

  it("Given a block reference or a fixated block, Then the view is asked for the block", () => {
    expect(revealTarget(block("blk-a", 1))).toEqual({ kind: "block", blockId: "blk-a" });
    expect(revealTarget({ blockId: "blk-c", words: "fixated words" })).toEqual({
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

/**
 * What was marked travels with a reference: a proposal's group and item, a
 * retired block, and the revision the reader saw — read back by name, and
 * a shape the shell never sends refused by name. BO_0263_007
 */
describe("a reference to what was marked", () => {
  const proposal = { number: 1, blockId: "blk-n", target: "proposal", group: "node:g", item: "node:g|insert|node:blk-n", revisionId: "rev-n" };

  it("Given a proposal, a retired block and a passage in a proposal, Then they read back with what was marked", () => {
    expect(
      readCommandTarget({
        artifact: "doc-1",
        delivery: "propose",
        references: [
          proposal,
          { number: 2, blockId: "blk-r", target: "retired", revisionId: "rev-r" },
          { ...proposal, number: 3, kind: "passage", quote: "new" },
          { number: 4, blockId: "blk-a", revisionId: "rev-a" },
        ],
        source,
      }),
    ).toEqual({
      ok: true,
      target: {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { kind: "block", number: 1, blockId: "blk-n", target: "proposal", group: "node:g", item: "node:g|insert|node:blk-n", revisionId: "rev-n" },
          { kind: "block", number: 2, blockId: "blk-r", target: "retired", revisionId: "rev-r" },
          { kind: "passage", number: 3, blockId: "blk-n", quote: "new", target: "proposal", group: "node:g", item: "node:g|insert|node:blk-n", revisionId: "rev-n" },
          { kind: "block", number: 4, blockId: "blk-a", revisionId: "rev-a" },
        ],
        source,
      },
    });
  });

  it("Given a shape the shell never sends, Then it is refused by name", () => {
    for (const [reference, error] of [
      [{ number: 1, blockId: "blk-a", target: "claim", revisionId: "rev" }, "Reference #1 points at neither a block, a proposal nor a retired block."],
      [{ number: 1, blockId: "blk-a", target: "proposal", item: "node:g|insert|node:blk-a", revisionId: "rev" }, "Proposal reference #1 names no group or no item."],
      [{ number: 1, blockId: "blk-a", group: "node:g" }, "Reference #1 names a proposal but points at none."],
      [{ number: 1, blockId: "blk-a", target: "retired" }, "Reference #1 names no revision of what was marked."],
      [{ number: 1, blockId: "blk-a", revisionId: "" }, "Reference #1 carries a revisionId that names nothing."],
    ] as const) {
      expect(readCommandTarget({ artifact: "doc-1", delivery: "propose", references: [reference], source })).toEqual({ ok: false, error });
    }
  });

  it("Given a reported reference, Then what is sent keeps what was marked and drops what is only shown", () => {
    const target = blockCommand("doc-1", source, [
      { kind: "block", number: 1, blockId: "blk-n", target: "proposal", group: "node:g", item: "node:g|insert|node:blk-n", revisionId: "rev-n", words: "A new line.", stale: false, what: "proposal", proposer: "Claude Code", since: "rejected", rowless: true },
    ]);
    expect(target.references).toEqual([
      { kind: "block", number: 1, blockId: "blk-n", target: "proposal", group: "node:g", item: "node:g|insert|node:blk-n", revisionId: "rev-n" },
    ]);
  });
});

describe("a gesture and a command are told apart (BO_0258_006)", () => {
  it("takes a command: a block's words, no goal beside them", () => {
    expect(readRunShape({})).toEqual({ ok: true, gesture: false });
    expect(readRunShape({ goal: "   " })).toEqual({ ok: true, gesture: false });
  });

  it("takes a gesture: a named intention and the question it asks", () => {
    expect(readRunShape({ goal: "Has anything under this moved?", intention: "calliopa-refine.intention" })).toEqual({
      ok: true,
      gesture: true,
      intention: "calliopa-refine.intention",
    });
  });

  it("refuses a command that carries a goal, which would be a second source of the same words", () => {
    expect(readRunShape({ goal: "do the thing" })).toEqual({
      ok: false,
      error: "A command sent from a block carries no goal: its words are the block's.",
    });
  });

  it("refuses a gesture with no question to ask", () => {
    expect(readRunShape({ intention: "calliopa-refine.intention" })).toEqual({
      ok: false,
      error: "A gesture carries the question it asks as its goal.",
    });
  });
});

describe("a gesture's target is the document it was made in (BO_0258_006)", () => {
  it("takes the document and proposes into it, naming no block and no references", () => {
    expect(readGestureTarget({ artifact: "doc-1" })).toEqual({
      ok: true,
      target: { artifact: "doc-1", delivery: "propose", references: [] },
    });
  });

  it("needs no source block, which a command's target demands and a gesture never has", () => {
    // The same body through a command's reading is refused for exactly that.
    const asCommand = readCommandTarget({ artifact: "doc-1", delivery: "propose" });
    expect(asCommand.ok).toBe(false);
    expect(readGestureTarget({ artifact: "doc-1" }).ok).toBe(true);
  });

  it("refuses a gesture that names no document", () => {
    expect(readGestureTarget({})).toEqual({ ok: false, error: "A gesture names the document it was made in." });
    expect(readGestureTarget({ artifact: "  " }).ok).toBe(false);
    expect(readGestureTarget({ artifact: 7 })).toEqual({ ok: false, error: "The artifact must be a document's identity." });
  });
});

describe("references across documents (BO_0304_013)", () => {
  const source = { block: "blk-p", revisionId: "rev-p" };

  it("Given references into another document and a document marked whole, Then they are read back with their document, and what is only shown is dropped", () => {
    expect(
      readCommandTarget({
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { number: 1, blockId: "blk-a" },
          { number: 2, blockId: "blk-x", document: " doc-2 ", revisionId: "rev-x" },
          { number: 3, blockId: "blk-y", kind: "passage", quote: "Rain", document: "doc-2" },
          { number: 4, kind: "document", document: "doc-3" },
        ],
        source,
      }),
    ).toEqual({
      ok: true,
      target: {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { kind: "block", blockId: "blk-a", number: 1 },
          { kind: "block", blockId: "blk-x", number: 2, revisionId: "rev-x", document: "doc-2" },
          { kind: "passage", blockId: "blk-y", number: 3, quote: "Rain", document: "doc-2" },
          { kind: "document", number: 4, document: "doc-3" },
        ],
        source,
      },
    });
    const pointed: PointedReference = { kind: "block", number: 2, blockId: "blk-x", words: "Elsewhere.", stale: false, document: "doc-2", documentTitle: "Second" };
    expect(sent(pointed)).toEqual({ kind: "block", number: 2, blockId: "blk-x", document: "doc-2" });
    expect(sent({ kind: "document", number: 4, document: "doc-3", words: "Third", stale: false, documentTitle: "Third" })).toEqual({ kind: "document", number: 4, document: "doc-3" });
    expect(blockCommand("doc-1", source, [pointed]).references).toEqual([{ kind: "block", number: 2, blockId: "blk-x", document: "doc-2" }]);
  });

  it("Given a document reference naming a block or a quote, or naming no document, Then it is refused by name", () => {
    const refused = (reference: Record<string, unknown>) => {
      const read = readCommandTarget({ artifact: "doc-1", delivery: "propose", references: [reference], source });
      return read.ok ? "accepted" : read.error;
    };
    expect(refused({ number: 1, kind: "document", document: "doc-3", blockId: "blk-a" })).toBe("Document reference #1 names a block; a document marked whole names none.");
    expect(refused({ number: 1, kind: "document", document: "doc-3", quote: "words" })).toBe("Document reference #1 carries a quote; only a passage does.");
    expect(refused({ number: 1, kind: "document" })).toBe("Document reference #1 names no document.");
    expect(refused({ number: 1, kind: "document", document: "  " })).toBe("Document reference #1 names no document.");
    expect(refused({ number: 1, blockId: "blk-a", document: "  " })).toBe("Reference #1 carries a document that names nothing.");
  });

  it("Given a reveal for a reference into another document, Then the target says which document and its title", () => {
    expect(revealTarget({ kind: "block", number: 2, blockId: "blk-x", words: "", stale: false, document: "doc-2", documentTitle: "Second" })).toEqual({ kind: "block", blockId: "blk-x", document: "doc-2", documentTitle: "Second" });
    expect(revealTarget({ kind: "passage", number: 3, blockId: "blk-y", quote: "Rain", words: "Rain", stale: false, document: "doc-2" })).toEqual({ kind: "passage", blockId: "blk-y", number: 3, document: "doc-2" });
    expect(revealTarget({ kind: "document", number: 4, document: "doc-3", words: "Third", stale: false, documentTitle: "Third" })).toEqual({ kind: "document", document: "doc-3", documentTitle: "Third" });
    expect(revealTarget({ kind: "block", number: 1, blockId: "blk-a", words: "", stale: false })).toEqual({ kind: "block", blockId: "blk-a" });
  });
});
