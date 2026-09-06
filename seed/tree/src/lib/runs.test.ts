import { describe, expect, it } from "vitest";

import {
  applyLink,
  applyMark,
  linkAt,
  marksAt,
  normalizeRuns,
  replaceRange,
  runsLength,
  runsText,
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
