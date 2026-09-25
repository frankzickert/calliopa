import { describe, expect, it } from "vitest";

import type { PointedReference } from "./command-target";
import {
  danglingNumbers,
  namedNumbers,
  pendingReference,
  referenceMatches,
  pendingBlockReference,
} from "./command-typeahead";

const references: PointedReference[] = [
  { kind: "block", number: 1, blockId: "a", words: "Opening.", stale: false },
  {
    kind: "passage",
    number: 2,
    blockId: "b",
    quote: "before the lights",
    words: "before the lights",
    stale: false,
  },
  { kind: "block", number: 12, blockId: "c", words: "Closing.", stale: false },
];

describe("naming a reference by typing #", () => {
  it("Given a # typed after a space, Then a reference is pending, with the digits typed so far", () => {
    expect(pendingReference("tighten #", 9)).toEqual({ start: 8, typed: "" });
    expect(pendingReference("tighten #1", 10)).toEqual({
      start: 8,
      typed: "1",
    });
    expect(pendingReference("#", 1)).toEqual({ start: 0, typed: "" });
  });

  it("Given a # inside a word, or letters after it, Then nothing is pending", () => {
    expect(pendingReference("C#", 2)).toBeNull();
    expect(pendingReference("issue#3", 7)).toBeNull();
    expect(pendingReference("see #a", 6)).toBeNull();
  });

  it("Given digits typed, Then the references narrow to the numbers they begin", () => {
    expect(
      referenceMatches(references, "").map((reference) => reference.number),
    ).toEqual([1, 2, 12]);
    expect(
      referenceMatches(references, "1").map((reference) => reference.number),
    ).toEqual([1, 12]);
    expect(referenceMatches(references, "3")).toEqual([]);
  });
});

describe("numbers the command's words name", () => {
  it("Given #n written where a reference is typed, Then each is read once, in order", () => {
    expect(namedNumbers("tighten #2 and keep (#1); #2 again")).toEqual([2, 1]);
    expect(namedNumbers("#12, then #3.")).toEqual([12, 3]);
  });

  it("Given # inside a word or running into one, Then it names nothing", () => {
    expect(namedNumbers("C#2 issue#3 #4th")).toEqual([]);
  });

  it("Given a number whose mark was taken back, Then it dangles, and a standing one does not", () => {
    expect(danglingNumbers("tighten #2 and #12", references)).toEqual([]);
    expect(danglingNumbers("tighten #2 and #5", references)).toEqual([5]);
  });
});

describe("naming a block by typing # and its words", () => {
  it("Given # and letters typed after a space, Then a block reference is pending with the letters, and a # inside a word is none", () => {
    expect(pendingBlockReference("see #meth", 9)).toEqual({ start: 4, typed: "meth" });
    expect(pendingBlockReference("(#", 2)).toEqual({ start: 1, typed: "" });
    expect(pendingBlockReference("see #2", 6)).toEqual({ start: 4, typed: "2" });
    expect(pendingBlockReference("issue#4", 7)).toBeNull();
    // Directly after an atom — a citation or another reference — a # is pending too.
    expect(pendingBlockReference("see \uFFFC#", 6)).toEqual({ start: 5, typed: "" });
    expect(pendingBlockReference("see \uFFFC#fig", 9)).toEqual({ start: 5, typed: "fig" });
    expect(pendingBlockReference("see # two", 9)).toBeNull();
  });
});
