import { describe, expect, it } from "vitest";
import {
  keepPresent,
  markingKey,
  NO_MARKING,
  parseMarking,
  referenceFor,
  serializeMarking,
  toggleReference,
  type Marking,
} from "./references";

const marks = (marking: Marking, ...blockIds: string[]): Marking =>
  blockIds.reduce(toggleReference, marking);

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

  it("Given a block that has left the document, Then its reference is dropped and the rest stand", () => {
    const marking = keepPresent(marks(NO_MARKING, "a", "b", "c"), ["a", "c"]);

    expect(referenceFor(marking, "b")).toBeNull();
    expect(referenceFor(marking, "a")).toBe(1);
    expect(referenceFor(marking, "c")).toBe(3);
  });

  it("Given every marked block has gone, Then numbering starts again", () => {
    const marking = keepPresent(marks(NO_MARKING, "a", "b"), []);

    expect(marking.references).toEqual([]);
    expect(marking.next).toBe(1);
  });

  it("Given a document whose blocks are all still there, Then the marking is unchanged", () => {
    const marking = marks(NO_MARKING, "a", "b");

    expect(keepPresent(marking, ["a", "b", "c"])).toBe(marking);
  });
});

describe("keeping a marking session", () => {
  it("Given a session in command mode, When it is written and read back, Then it comes back as it was", () => {
    const marking: Marking = {
      ...marks(NO_MARKING, "b", "a"),
      mode: "command",
    };

    expect(parseMarking(serializeMarking(marking))).toEqual(marking);
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
      { blockId: "a", number: 1 },
      { blockId: "c", number: 3 },
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

  it("Given a document, Then its marking is kept under its own key", () => {
    expect(markingKey("doc-1")).toBe("calliopa.marking.doc-1");
    expect(markingKey("doc-1")).not.toBe(markingKey("doc-2"));
  });
});
