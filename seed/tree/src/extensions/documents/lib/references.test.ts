import { describe, expect, it } from "vitest";
import { anchorAt } from "~/lib/passage";
import {
  addPassage,
  followDocument,
  legacyMarkingKey,
  markingFromSent,
  markingKey,
  NO_MARKING,
  parseMarking,
  passagesIn,
  passageState,
  referenceFor,
  removeReference,
  repointPassage,
  serializeMarking,
  toggleReference,
  type Marking,
} from "./references";

const marks = (marking: Marking, ...blockIds: string[]): Marking =>
  blockIds.reduce((held, blockId) => toggleReference(held, blockId), marking);

/** The document as `followDocument` reads it: these blocks, each at
 * revision `rev-<id>`, and these proposal items open. */
const now = (blockIds: string[], items: string[] | null = []) => ({
  blocks: blockIds.map((blockId) => ({ blockId, revisionId: `rev-${blockId}` })),
  openItems: items === null ? null : new Set(items),
});

describe("marking blocks as references", () => {
  it("Given blocks marked out of document order, Then numbers follow the order they were marked in", () => {
    const marking = marks(NO_MARKING, "b", "a", "c");

    expect(referenceFor(marking, "b")).toBe(1);
    expect(referenceFor(marking, "a")).toBe(2);
    expect(referenceFor(marking, "c")).toBe(3);
  });

  it("Given a marked block, When it is clicked again, Then the mark is taken back", () => {
    const marking = marks(NO_MARKING, "a", "b");

    expect(referenceFor(toggleReference(marking, "a"), "a")).toBeNull();
  });

  it("Given three marks, When one is removed, Then the others keep the numbers they had", () => {
    const marking = toggleReference(marks(NO_MARKING, "a", "b", "c"), "b");

    expect(referenceFor(marking, "a")).toBe(1);
    expect(referenceFor(marking, "c")).toBe(3);
  });

  it("Given a mark removed while others stand, When another is marked, Then it takes a fresh number rather than the freed one", () => {
    const after = toggleReference(
      toggleReference(marks(NO_MARKING, "a", "b", "c"), "c"),
      "d",
    );

    expect(referenceFor(after, "d")).toBe(4);
  });

  it("Given every mark removed, When a block is marked again, Then numbering starts at one", () => {
    const emptied = marks(NO_MARKING, "a", "b", "a", "b");

    expect(emptied.references).toEqual([]);
    expect(referenceFor(toggleReference(emptied, "c"), "c")).toBe(1);
  });

  it("Given a reference from before BO_0263, naming no revision, When its block has left the document, Then it is dropped and the rest stand", () => {
    const marking = followDocument(marks(NO_MARKING, "a", "b", "c"), now(["a", "c"]));

    expect(referenceFor(marking, "b")).toBeNull();
    expect(referenceFor(marking, "a")).toBe(1);
    expect(referenceFor(marking, "c")).toBe(3);
  });

  it("Given every such block has gone, Then numbering starts again", () => {
    const marking = followDocument(marks(NO_MARKING, "a", "b"), now([]));

    expect(marking.references).toEqual([]);
    expect(marking.next).toBe(1);
  });

  it("Given a document whose blocks are all still there, Then the marking is unchanged", () => {
    const marking = marks(NO_MARKING, "a", "b");

    expect(followDocument(marking, now(["a", "b", "c"]))).toBe(marking);
  });
});

describe("a reference is what was marked", () => {
  const proposal = { target: "proposal" as const, group: "node:g", item: "node:g|insert|node:n", revisionId: "rev-n", words: "A new line.", proposer: "Claude Code" };
  const words = (quote: string) => anchorAt("A new line.", "A new line.".indexOf(quote), "A new line.".indexOf(quote) + quote.length);

  it("Given a block marked with its revision, When it leaves the document, Then its reference stands under its number", () => {
    const marking = followDocument(toggleReference(NO_MARKING, "a", { revisionId: "rev-a" }), now([]));
    expect(marking.references).toEqual([{ kind: "block", blockId: "a", number: 1, revisionId: "rev-a" }]);
  });

  it("Given a proposal, a retired block and the block itself, Then each is its own row and its own number", () => {
    const marking = toggleReference(
      toggleReference(toggleReference(NO_MARKING, "n", proposal), "n", { target: "retired", revisionId: "rev-r" }),
      "n",
      { revisionId: "rev-n" },
    );
    expect(referenceFor(marking, "n", { target: "proposal", item: proposal.item })).toBe(1);
    expect(referenceFor(marking, "n", { target: "retired" })).toBe(2);
    expect(referenceFor(marking, "n")).toBe(3);
    // Pressing the proposal again takes back only the proposal.
    const unmarked = toggleReference(marking, "n", proposal);
    expect(referenceFor(unmarked, "n", { target: "proposal", item: proposal.item })).toBeNull();
    expect(referenceFor(unmarked, "n")).toBe(3);
  });

  it("Given a marked proposal accepted, Then its number moves to the block it became, with the revision marked", () => {
    const marking = followDocument(toggleReference(NO_MARKING, "n", proposal), now(["n"], []));
    expect(marking.references).toEqual([{ kind: "block", blockId: "n", number: 1, revisionId: "rev-n", words: "A new line." }]);
  });

  it("Given a marked proposal rejected, Then it stands as a proposal, with no row to carry it", () => {
    const marked = toggleReference(NO_MARKING, "n", proposal);
    expect(followDocument(marked, now([], []))).toBe(marked);
  });

  it("Given the proposals not yet read, Then nothing is taken as answered", () => {
    const marked = toggleReference(NO_MARKING, "n", proposal);
    expect(followDocument(marked, now(["n"], null))).toBe(marked);
  });

  it("Given a passage in a proposal, Then it stands on the proposal's row and follows it to its block", () => {
    const marked = addPassage(NO_MARKING, "n", words("new"), proposal);
    expect(passagesIn(marked, "n", { target: "proposal", item: proposal.item }).map((held) => held.number)).toEqual([1]);
    expect(passagesIn(marked, "n")).toEqual([]);
    const followed = followDocument(marked, now(["n"], []));
    expect(passagesIn(followed, "n").map((held) => held.number)).toEqual([1]);
  });

  it("Given what was marked, When the session is written and read back, Then it comes back as it was, out of the mode", () => {
    const marking: Marking = {
      ...toggleReference(toggleReference(NO_MARKING, "n", proposal), "a", { revisionId: "rev-a", discarded: true }),
      mode: "command",
    };
    expect(parseMarking(serializeMarking(marking))).toEqual({ ...marking, mode: "reading" });
  });

  it("Given a stored proposal naming no item, or an unknown target, Then it is not read back", () => {
    const marking = parseMarking(
      JSON.stringify({
        mode: "command",
        references: [
          { kind: "block", blockId: "a", number: 1, target: "proposal", group: "node:g" },
          { kind: "block", blockId: "a", number: 2, target: "claim" },
          { kind: "block", blockId: "a", number: 3, target: "retired", revisionId: "rev-a" },
        ],
        next: 4,
      }),
    );
    expect(marking.references.map((held) => held.number)).toEqual([3]);
  });
});

describe("keeping a marking session", () => {
  it("Given a session in command mode, When it is written and read back, Then its marks come back and the mode does not: pointing ends with the page", () => {
    const marking: Marking = {
      ...marks(NO_MARKING, "b", "a"),
      mode: "command",
    };

    expect(parseMarking(serializeMarking(marking))).toEqual({ ...marking, mode: "reading" });
  });

  it("Given a latest run's references, Then they come back as the prompt's marks, a passage by its words", () => {
    const marking = markingFromSent([
      { number: 2, blockId: "b", kind: "block" },
      { number: 1, blockId: "a", kind: "passage", quote: "the storm" },
      { number: 3, blockId: "n", kind: "block", target: "proposal", group: "node:g", item: "node:g|insert|node:n", revisionId: "rev-n" },
    ]);
    expect(marking.references.map((held) => [held.number, held.blockId, held.kind, held.target])).toEqual([
      [2, "b", "block", undefined],
      [1, "a", "passage", undefined],
      [3, "n", "block", "proposal"],
    ]);
    expect(marking.next).toBe(4);
    expect(marking.mode).toBe("reading");
  });

  it("Given nothing marked and reading, Then there is nothing to keep", () => {
    expect(serializeMarking(NO_MARKING)).toBeNull();
    expect(parseMarking(null)).toEqual(NO_MARKING);
  });

  it("Given marks left behind while reading, Then they are kept, because leaving the mode preserves them", () => {
    const marking = marks(NO_MARKING, "a");

    expect(serializeMarking(marking)).not.toBeNull();
    expect(parseMarking(serializeMarking(marking))).toEqual(marking);
  });

  it("Given a stored value that is not a session, Then nothing is marked", () => {
    expect(parseMarking("not json")).toEqual(NO_MARKING);
    expect(parseMarking("[]")).toEqual(NO_MARKING);
    expect(parseMarking('"command"')).toEqual(NO_MARKING);
  });

  it("Given stored entries that name no block or no number, Then only the usable ones come back", () => {
    const marking = parseMarking(
      JSON.stringify({
        mode: "command",
        references: [
          { blockId: "a", number: 1 },
          { blockId: "", number: 2 },
          { blockId: "b" },
          { blockId: "b", number: 2.5 },
          { blockId: "c", number: 3 },
          { blockId: "c", number: 9 },
        ],
        next: 4,
      }),
    );

    expect(marking.references).toEqual([
      { kind: "block", blockId: "a", number: 1 },
      { kind: "block", blockId: "c", number: 3 },
    ]);
  });

  it("Given a stored counter at or below a standing number, Then the next mark still takes a number no block holds", () => {
    const marking = parseMarking(
      JSON.stringify({
        mode: "command",
        references: [{ blockId: "a", number: 4 }],
        next: 2,
      }),
    );

    expect(marking.next).toBe(5);
    expect(referenceFor(toggleReference(marking, "b"), "b")).toBe(5);
  });

  it("Given a prompt block, Then its marking is kept under its document's and its own key, apart from the record a document kept before", () => {
    expect(markingKey("doc-1", "blk-p")).toBe("calliopa.marking.doc-1.blk-p");
    expect(markingKey("doc-1", "blk-p")).not.toBe(markingKey("doc-1", "blk-q"));
    expect(markingKey("doc-1", "blk-p")).not.toBe(markingKey("doc-2", "blk-p"));
    expect(legacyMarkingKey("doc-1")).toBe("calliopa.marking.doc-1");
  });
});

describe("marking passages", () => {
  const text = "The storm arrives before the lights go out.";
  const words = (quote: string, source = text) => {
    const start = [...source].join("").indexOf(quote);
    return anchorAt(source, start, start + [...quote].length);
  };

  it("Given a block marked and then a passage, Then they share one sequence in mark order", () => {
    const marking = addPassage(
      toggleReference(NO_MARKING, "a"),
      "b",
      words("before the lights"),
    );
    expect(referenceFor(marking, "a")).toBe(1);
    expect(passagesIn(marking, "b").map((held) => held.number)).toEqual([2]);
  });

  it("Given a block marked whole and a passage inside it, Then both stand, and unmarking the block leaves the passage", () => {
    const both = addPassage(
      toggleReference(NO_MARKING, "a"),
      "a",
      words("storm"),
    );
    expect(both.references.map((held) => held.kind)).toEqual([
      "block",
      "passage",
    ]);
    const unmarked = toggleReference(both, "a");
    expect(referenceFor(unmarked, "a")).toBeNull();
    expect(passagesIn(unmarked, "a").map((held) => held.number)).toEqual([2]);
    expect(unmarked.next).toBe(3);
  });

  it("Given the same words marked twice, Then the second changes nothing", () => {
    const once = addPassage(NO_MARKING, "a", words("storm"));
    expect(addPassage(once, "a", words("storm"))).toBe(once);
  });

  it("Given words that cannot be a passage, Then nothing is marked", () => {
    expect(
      addPassage(NO_MARKING, "a", {
        quote: "",
        prefix: "",
        suffix: "",
        hint: 0,
      }),
    ).toBe(NO_MARKING);
  });

  it("Given a passage whose words were edited away, Then it is stale, and re-pointing keeps its number and place", () => {
    const marked = addPassage(
      addPassage(NO_MARKING, "a", words("storm")),
      "a",
      words("lights"),
    );
    const edited = "The storm arrives after the candles go out.";
    const lights = passagesIn(marked, "a")[1]!;
    expect(passageState(lights, edited)).toEqual({ stale: true });
    const repaired = repointPassage(
      marked,
      lights.number,
      words("candles", edited),
    );
    expect(repaired.references.map((held) => held.number)).toEqual([1, 2]);
    expect(passageState(passagesIn(repaired, "a")[1]!, edited).stale).toBe(
      false,
    );
  });

  it("Given a passage taken back by its number, Then the others keep theirs, and with none left numbering restarts", () => {
    const marked = addPassage(
      toggleReference(NO_MARKING, "a"),
      "a",
      words("storm"),
    );
    const removed = removeReference(marked, 2);
    expect(referenceFor(removed, "a")).toBe(1);
    expect(removeReference(removed, 1).next).toBe(1);
    expect(removeReference(removed, 9)).toBe(removed);
  });

  it("Given a block gone, Then passages marked before BO_0263 go with it, but a stale passage in a present block stands", () => {
    const marked = addPassage(
      addPassage(NO_MARKING, "a", words("storm")),
      "b",
      words("lights"),
    );
    expect(
      followDocument(marked, now(["b"])).references.map((held) => held.blockId),
    ).toEqual(["b"]);
  });

  it("Given a session holding passages, When written and read back, Then it comes back as it was", () => {
    const marking: Marking = addPassage(toggleReference(NO_MARKING, "a"), "a", words("storm"));
    expect(parseMarking(serializeMarking(marking))).toEqual(marking);
  });

  it("Given a record CA_0020 wrote, Then its entries read as block references", () => {
    const marking = parseMarking(
      JSON.stringify({
        mode: "command",
        references: [{ blockId: "a", number: 1 }],
        next: 2,
      }),
    );
    expect(marking.references).toEqual([
      { kind: "block", blockId: "a", number: 1 },
    ]);
  });

  it("Given stored passages that are unusable or repeated, Then only the usable, distinct ones come back", () => {
    const anchor = words("storm");
    const marking = parseMarking(
      JSON.stringify({
        mode: "command",
        references: [
          { kind: "passage", blockId: "a", number: 1, anchor },
          { kind: "passage", blockId: "a", number: 2, anchor },
          {
            kind: "passage",
            blockId: "a",
            number: 3,
            anchor: { ...anchor, quote: "" },
          },
          { kind: "passage", blockId: "a", number: 4 },
          { kind: "range", blockId: "a", number: 5 },
          { kind: "block", blockId: "a", number: 6 },
        ],
        next: 7,
      }),
    );
    expect(
      marking.references.map((held) => `${held.kind}#${held.number}`),
    ).toEqual(["passage#1", "block#6"]);
  });
});
