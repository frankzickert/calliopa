import { describe, expect, it } from "vitest";

import {
  applyLink,
  applyMark,
  couldBeOneEdit,
  linkAt,
  marksAt,
  normalizeRuns,
  replaceRange,
  runsLength,
  runsText,
  readRuns,
  replaceRangeWithAtom,
  sameRuns,
  sliceRuns,
  splitRuns,
  type Run,
} from "./runs";

const plain = (text: string): Run[] => [{ text }];

describe("normalizeRuns", () => {
  it("drops empty runs and joins neighbours carrying the same formatting", () => {
    expect(
      normalizeRuns([
        { text: "one" },
        { text: "" },
        { text: " two" },
        { text: " three", marks: ["bold"] },
      ]),
    ).toEqual([{ text: "one two" }, { text: " three", marks: ["bold"] }]);
  });

  it("orders marks so two spellings of one set compare equal", () => {
    expect(normalizeRuns([{ text: "a", marks: ["italic", "bold"] }])).toEqual([
      { text: "a", marks: ["bold", "italic"] },
    ]);
  });

  it("keeps runs apart when their links differ", () => {
    expect(
      normalizeRuns([
        { text: "a", link: "https://one.example" },
        { text: "b", link: "https://two.example" },
      ]),
    ).toHaveLength(2);
  });
});

describe("runsLength", () => {
  it("counts characters rather than code units", () => {
    expect(runsLength([{ text: "a🎬b" }])).toBe(3);
  });
});

describe("marksAt", () => {
  const runs: Run[] = [
    { text: "plain " },
    { text: "bold", marks: ["bold"] },
    { text: " tail" },
  ];

  it("reports only marks the whole range carries", () => {
    expect(marksAt(runs, 6, 10)).toEqual(["bold"]);
    expect(marksAt(runs, 0, 10)).toEqual([]);
  });

  it("reads the character before a collapsed caret, so a pending format has a state", () => {
    expect(marksAt(runs, 8, 8)).toEqual(["bold"]);
    expect(marksAt(runs, 0, 0)).toEqual([]);
  });

  it("tolerates a reversed or out-of-bounds range", () => {
    expect(marksAt(runs, 10, 6)).toEqual(["bold"]);
    expect(marksAt(runs, -5, 99)).toEqual([]);
  });
});

describe("applyMark", () => {
  it("marks exactly the range and leaves the rest alone", () => {
    expect(applyMark(plain("hello there"), 0, 5, "bold", true)).toEqual([
      { text: "hello", marks: ["bold"] },
      { text: " there" },
    ]);
  });

  it("removes a mark across a range that only partly carried it", () => {
    const mixed: Run[] = [{ text: "ab", marks: ["bold"] }, { text: "cd" }];
    expect(applyMark(mixed, 0, 4, "bold", false)).toEqual([{ text: "abcd" }]);
  });

  it("rejoins runs when a toggle makes neighbours identical", () => {
    const split: Run[] = [{ text: "ab", marks: ["bold"] }, { text: "cd" }];
    expect(applyMark(split, 2, 4, "bold", true)).toEqual([
      { text: "abcd", marks: ["bold"] },
    ]);
  });

  it("keeps every character whatever the range", () => {
    const runs = applyMark(plain("hello"), 1, 3, "italic", true);
    expect(runsText(runs)).toBe("hello");
  });
});

describe("applyLink", () => {
  it("sets and clears a link across a range", () => {
    const linked = applyLink(plain("read this"), 5, 9, "https://example.test");
    expect(linkAt(linked, 5, 9)).toBe("https://example.test");
    expect(linkAt(applyLink(linked, 5, 9, null), 5, 9)).toBeNull();
  });

  it("reports no link when the range spans different ones", () => {
    const one = applyLink(plain("ab"), 0, 1, "https://one.example");
    const two = applyLink(one, 1, 2, "https://two.example");
    expect(linkAt(two, 0, 2)).toBeNull();
  });
});

describe("replaceRange", () => {
  it("inserts at a caret, taking the formatting it is typed into", () => {
    const bold: Run[] = [{ text: "bold", marks: ["bold"] }];
    expect(replaceRange(bold, 2, 2, "XY")).toEqual([
      { text: "boXYld", marks: ["bold"] },
    ]);
  });

  it("replaces a selection", () => {
    expect(replaceRange(plain("hello there"), 0, 5, "goodbye")).toEqual([
      { text: "goodbye there" },
    ]);
  });

  it("arrives plain at a plain caret even next to formatted text", () => {
    const runs: Run[] = [{ text: "a" }, { text: "b", marks: ["bold"] }];
    expect(replaceRange(runs, 1, 1, "X")).toEqual([
      { text: "aX" },
      { text: "b", marks: ["bold"] },
    ]);
  });

  it("deletes when the replacement is empty", () => {
    expect(replaceRange(plain("hello"), 1, 3, "")).toEqual([{ text: "hlo" }]);
  });
});

describe("sliceRuns", () => {
  it("returns the covered runs with their formatting", () => {
    const runs: Run[] = [{ text: "ab" }, { text: "cd", marks: ["code"] }];
    expect(sliceRuns(runs, 1, 3)).toEqual([
      { text: "b" },
      { text: "c", marks: ["code"] },
    ]);
  });
});

describe("splitRuns", () => {
  it("keeps every character in one half", () => {
    const runs: Run[] = [
      { text: "hello " },
      { text: "world", marks: ["bold"] },
    ];
    const [head, tail] = splitRuns(runs, 8);
    expect(runsText(head) + runsText(tail)).toBe("hello world");
    expect(tail).toEqual([{ text: "rld", marks: ["bold"] }]);
  });

  it("splits astral text where a reader sees the boundary", () => {
    const [head, tail] = splitRuns([{ text: "a🎬b" }], 2);
    expect(runsText(head)).toBe("a🎬");
    expect(runsText(tail)).toBe("b");
  });

  it("puts everything in the head past the end", () => {
    const [head, tail] = splitRuns(plain("abc"), 99);
    expect(runsText(head)).toBe("abc");
    expect(tail).toEqual([]);
  });
});

describe("sameRuns", () => {
  it("sees through run boundaries and mark order", () => {
    expect(
      sameRuns([{ text: "he" }, { text: "llo" }], [{ text: "hello" }]),
    ).toBe(true);
    expect(
      sameRuns(
        [{ text: "a", marks: ["italic", "bold"] }],
        [{ text: "a", marks: ["bold", "italic"] }],
      ),
    ).toBe(true);
  });

  it("separates content that differs", () => {
    expect(sameRuns(plain("a"), plain("b"))).toBe(false);
    expect(sameRuns(plain("a"), [{ text: "a", marks: ["bold"] }])).toBe(false);
    expect(
      sameRuns(plain("a"), [{ text: "a", link: "https://example.test" }]),
    ).toBe(false);
  });
});

/**
 * Mathematics and a reference to it as run atoms (`BO_0290_009`). Each rule
 * here is one the rest of the model would otherwise break: normalization
 * merging two equations into one, a split cutting inside a formula, marks
 * spreading over one, and a read dropping the mathematics out of a stored
 * sentence.
 */
describe("atoms", () => {
  const equation: Run = { text: "E = mc^2", math: true };
  const other: Run = { text: "a^2", math: true };
  const reference: Run = { text: "", equationRef: "blk-e2" };

  it("never joins two adjacent equations", () => {
    expect(normalizeRuns([equation, other])).toEqual([equation, other]);
  });

  it("keeps a reference although it carries no text, and drops empty mathematics", () => {
    expect(normalizeRuns([{ text: "see " }, reference])).toEqual([
      { text: "see " },
      reference,
    ]);
    expect(normalizeRuns([{ text: "", math: true }])).toEqual([]);
  });

  it("never joins ordinary text onto an equation", () => {
    expect(normalizeRuns([{ text: "so " }, equation, { text: " holds" }])).toEqual([
      { text: "so " },
      equation,
      { text: " holds" },
    ]);
  });

  it("counts as one character, so the caret steps over it", () => {
    expect(runsLength([{ text: "ab" }, equation, { text: "c" }])).toBe(4);
    expect(runsLength([reference])).toBe(1);
  });

  it("goes whole to one side of a split", () => {
    const sentence = [{ text: "so " }, equation, { text: " holds" }];
    expect(splitRuns(sentence, 3)).toEqual([
      [{ text: "so " }],
      [equation, { text: " holds" }],
    ]);
    expect(splitRuns(sentence, 4)).toEqual([
      [{ text: "so " }, equation],
      [{ text: " holds" }],
    ]);
  });

  it("is left alone by a mark applied across it", () => {
    const sentence = [{ text: "so " }, equation, { text: " holds" }];
    expect(applyMark(sentence, 0, 10, "bold", true)).toEqual([
      { text: "so ", marks: ["bold"] },
      equation,
      { text: " holds", marks: ["bold"] },
    ]);
  });

  it("reports no marks and no link for a selection that is one", () => {
    expect(marksAt([equation], 0, 1)).toEqual([]);
    expect(linkAt([equation], 0, 1)).toBeNull();
  });

  it("is not made of characters a range edit can reach into", () => {
    const sentence = [{ text: "so " }, equation];
    // Typing after an equation is plain text, never more mathematics.
    expect(replaceRange(sentence, 4, 4, "!")).toEqual([
      { text: "so " },
      equation,
      { text: "!" },
    ]);
    // A range covering it removes the whole equation, never half of one.
    expect(replaceRange(sentence, 3, 4, "x")).toEqual([{ text: "so x" }]);
  });

  it("is part of what two run lists mean", () => {
    expect(sameRuns([equation], [{ text: "E = mc^2" }])).toBe(false);
    expect(sameRuns([reference], [{ text: "", equationRef: "blk-other" }])).toBe(
      false,
    );
    expect(sameRuns([equation], [equation])).toBe(true);
  });

  it("survives a read of stored content", () => {
    const read = readRuns([
      { text: "Einstein wrote " },
      { text: "E = mc^2", math: true },
      { text: "", equationRef: "blk-e2" },
    ]);
    expect(read).toEqual({
      runs: [{ text: "Einstein wrote " }, equation, reference],
    });
  });

  it("is refused by a read when it is not one of the two", () => {
    expect(readRuns([{ text: "x", math: "yes" }])).toEqual({
      failure: "Run 0 carries math that is not true.",
    });
    expect(readRuns([{ text: "", equationRef: "  " }])).toEqual({
      failure: "Run 0 refers to no equation.",
    });
    expect(readRuns([{ text: "x", math: true, equationRef: "blk-e2" }])).toEqual({
      failure: "Run 0 is mathematics or a reference to it, never both.",
    });
    expect(readRuns([{ text: "", math: true }])).toEqual({
      failure: "Run 0 is mathematics carrying no source.",
    });
  });
});

describe("citations", () => {
  const cite: Run = { text: "", cite: { work: "wrk-2", locator: "p. 54" } };
  const again: Run = { text: "", cite: { work: "wrk-2" } };

  it("is an atom: kept without text, never joined, one character wide", () => {
    expect(normalizeRuns([{ text: "see " }, cite, again])).toEqual([{ text: "see " }, cite, again]);
    expect(runsLength([{ text: "ab" }, cite, { text: "c" }])).toBe(4);
  });

  it("goes whole to one side of a split and is left alone by a mark", () => {
    const sentence = [{ text: "so " }, cite, { text: " holds" }];
    expect(splitRuns(sentence, 3)).toEqual([[{ text: "so " }], [cite, { text: " holds" }]]);
    expect(splitRuns(sentence, 4)).toEqual([[{ text: "so " }, cite], [{ text: " holds" }]]);
    expect(applyMark(sentence, 0, 10, "bold", true)).toEqual([
      { text: "so ", marks: ["bold"] },
      cite,
      { text: " holds", marks: ["bold"] },
    ]);
    expect(replaceRange(sentence, 3, 4, "x")).toEqual([{ text: "so x holds" }]);
  });

  it("is part of what two run lists mean, locator included", () => {
    expect(sameRuns([cite], [again])).toBe(false);
    expect(sameRuns([again], [{ text: "", cite: { work: "wrk-1" } }])).toBe(false);
    expect(sameRuns([cite], [{ text: "", cite: { work: "wrk-2", locator: "p. 54" } }])).toBe(true);
  });

  it("survives a read of stored content, and is refused when it is not one", () => {
    expect(readRuns([{ text: "As shown " }, { text: "", cite: { work: "wrk-2", locator: "p. 54" } }])).toEqual({
      runs: [{ text: "As shown " }, cite],
    });
    expect(readRuns([{ text: "", cite: "wrk-2" }])).toEqual({
      failure: "Run 0 carries a citation that names no work.",
    });
    expect(readRuns([{ text: "", cite: { locator: "p. 1" } }])).toEqual({
      failure: "Run 0 carries a citation that names no work.",
    });
    expect(readRuns([{ text: "", cite: { work: "wrk-2", locator: 12 } }])).toEqual({
      failure: "Run 0 carries a citation whose locator is not words.",
    });
    expect(readRuns([{ text: "", cite: { work: "wrk-2", page: "12" } }])).toEqual({
      failure: "Run 0 carries a citation with page, which a citation does not carry.",
    });
    expect(readRuns([{ text: "", cite: { work: "wrk-2" }, equationRef: "blk-e" }])).toEqual({
      failure: "Run 0 is a citation or mathematics, never both.",
    });
    expect(readRuns([{ text: "[1]", cite: { work: "wrk-2" } }])).toEqual({
      failure: "Run 0 is a citation carrying text of its own.",
    });
  });

  it("places an atom over a range, and the words chosen become its source", () => {
    const runs: Run[] = [{ text: "so " }, { text: "E = mc^2" }, { text: " holds" }];
    const placed = replaceRangeWithAtom(runs, 3, 11, { text: "E = mc^2", math: true });
    expect(placed).toEqual([
      { text: "so " },
      { text: "E = mc^2", math: true },
      { text: " holds" },
    ]);
    // One character wide, so what follows it starts one on.
    expect(runsLength(placed)).toBe(10);
  });

  it("places one at a collapsed caret without taking anything away", () => {
    const placed = replaceRangeWithAtom([{ text: "abc" }], 2, 2, { text: "x", math: true });
    expect(placed).toEqual([
      { text: "ab" },
      { text: "x", math: true },
      { text: "c" },
    ]);
  });

  it("keeps the marks of what surrounds it", () => {
    const runs: Run[] = [{ text: "bold ", marks: ["bold"] }, { text: "plain" }];
    const placed = replaceRangeWithAtom(runs, 5, 10, { text: "y", math: true });
    expect(placed).toEqual([
      { text: "bold ", marks: ["bold"] },
      { text: "y", math: true },
    ]);
  });
});

/**
 * Figure and table references as atoms (`BO_0295_007`): kept although they
 * carry no text, never joined, one character wide, read back as they were
 * stored, and refused when they are anything else at once.
 */
describe("figure and table references", () => {
  const figure: Run = { text: "", figureRef: "blk-i1" };
  const table: Run = { text: "", tableRef: "blk-t" };

  it("keeps both although they carry no text, and never joins them", () => {
    expect(normalizeRuns([{ text: "see " }, figure, table])).toEqual([
      { text: "see " },
      figure,
      table,
    ]);
  });

  it("counts each as one character, so a split never cuts inside one", () => {
    expect(runsLength([{ text: "ab" }, figure, { text: "c" }])).toBe(4);
    const [before, after] = splitRuns([{ text: "ab" }, figure, { text: "c" }], 3);
    expect(before).toEqual([{ text: "ab" }, figure]);
    expect(after).toEqual([{ text: "c" }]);
  });

  it("tells a figure reference from a table reference and from another figure", () => {
    expect(sameRuns([figure], [figure])).toBe(true);
    expect(sameRuns([figure], [{ text: "", figureRef: "blk-i2" }])).toBe(false);
    expect(sameRuns([figure], [{ text: "", tableRef: "blk-i1" }])).toBe(false);
  });

  it("reads them back as they were stored", () => {
    expect(readRuns([{ text: "see " }, figure, table])).toEqual({
      runs: [{ text: "see " }, figure, table],
    });
  });

  it("refuses a reference naming nothing, carrying text, or being two things", () => {
    expect(readRuns([{ text: "", figureRef: " " }])).toEqual({ failure: "Run 0 refers to no figure." });
    expect(readRuns([{ text: "3", tableRef: "blk-t" }])).toEqual({
      failure: "Run 0 is a table reference carrying text of its own.",
    });
    expect(readRuns([{ text: "", figureRef: "blk-i1", equationRef: "blk-e1" }])).toEqual({
      failure: "Run 0 is one reference, mathematics or a citation, never two at once.",
    });
    expect(readRuns([{ text: "", figureRef: "blk-i1", tableRef: "blk-t" }])).toEqual({
      failure: "Run 0 is one reference, mathematics or a citation, never two at once.",
    });
  });
});

describe("couldBeOneEdit", () => {
  const LONG =
    "That distinction does more work than the physics does, because it gives you the eligibility test.";

  it("takes every ordinary edit at a caret", () => {
    // A character typed at the end, at the start and in the middle.
    expect(couldBeOneEdit(LONG, `${LONG}x`, 0)).toBe(true);
    expect(couldBeOneEdit(LONG, `x${LONG}`, 0)).toBe(true);
    expect(couldBeOneEdit(LONG, `${LONG.slice(0, 20)}x${LONG.slice(20)}`, 0)).toBe(true);
    // A character, a word and a line deleted, none of them selected.
    expect(couldBeOneEdit(LONG, LONG.slice(0, -1), 0)).toBe(true);
    expect(couldBeOneEdit(LONG, LONG.slice(0, -5), 0)).toBe(true);
    expect(couldBeOneEdit(LONG, LONG.slice(40), 0)).toBe(true);
    // A spellchecker replacing a word in the middle keeps both ends.
    expect(couldBeOneEdit(LONG, LONG.replace("physics", "physicist"), 0)).toBe(true);
  });

  it("takes a block emptied and a block retyped over its own selection", () => {
    // Nothing is left to compare against, and the reader may always type into
    // a block that says nothing.
    expect(couldBeOneEdit(LONG, "", 0)).toBe(true);
    expect(couldBeOneEdit("", "shape t", 0)).toBe(true);
    // The whole block under the caret accounts for the whole block going.
    expect(couldBeOneEdit(LONG, "shape t", LONG.length)).toBe(true);
    expect(couldBeOneEdit(LONG, "shape t", LONG.length + 4)).toBe(true);
  });

  it("refuses a reading that shares neither end of a block nobody selected", () => {
    // What the loss in the document Qc looked like: 652 characters replaced by
    // the first word of the next prompt, with a collapsed caret. DO_0017_001
    expect(couldBeOneEdit(LONG, "shape t", 0)).toBe(false);
    // A selection accounts only for itself.
    expect(couldBeOneEdit(LONG, "shape t", 7)).toBe(false);
    // Another block's words in the element.
    expect(couldBeOneEdit(LONG, "Once you know the machine computes by cancellation", 0)).toBe(false);
  });
});
