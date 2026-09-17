import { describe, expect, it } from "vitest";

import {
  BLOCK_TYPES,
  BLOCK_VALIDATORS,
  MARKS,
  TEXT_ROLES,
  normalizeRuns,
  runsText,
  splitRuns,
} from "./vocabulary";

const validateNode = (semanticType: string, content: unknown): string | null => {
  const validate = BLOCK_VALIDATORS[semanticType];
  if (validate === undefined) {
    throw new Error(`No definition for ${semanticType}.`);
  }
  return validate(content);
};

describe("the committed block vocabulary", () => {
  it("Given the vocabulary, Then it reads a document, a text block and a divider", () => {
    expect(Object.keys(BLOCK_VALIDATORS).sort()).toEqual(["divider", "document", "text"]);
    expect([...BLOCK_TYPES].sort()).toEqual(["divider", "text"]);
  });
});

describe("validating a document", () => {
  it("Given a title, Then the document is acceptable", () => {
    expect(validateNode("document", { title: "A Story" })).toBeNull();
  });

  it("Given an untitled document, Then the empty title is acceptable", () => {
    expect(validateNode("document", { title: "" })).toBeNull();
  });

  it("Given no title, Then the document is refused", () => {
    expect(validateNode("document", {})).toMatch(/title/);
    expect(validateNode("document", { title: 7 })).toMatch(/title/);
  });
});

describe("validating a text block", () => {
  const block = (content: Record<string, unknown>) =>
    validateNode("text", { order: "i", runs: [], ...content });

  it("Given runs and an order key, Then the block is acceptable", () => {
    expect(block({ runs: [{ text: "hello" }] })).toBeNull();
  });

  it("Given every permitted role, Then each is acceptable", () => {
    for (const role of TEXT_ROLES) {
      expect(block({ role })).toBeNull();
    }
  });

  it("Given no role, Then the block is acceptable and means paragraph", () => {
    expect(block({})).toBeNull();
  });

  it("Given a role outside the permitted set, Then the block is refused", () => {
    expect(block({ role: "h4" })).toMatch(/role/);
  });

  it("Given every permitted mark, Then each is acceptable", () => {
    for (const mark of MARKS) {
      expect(block({ runs: [{ text: "x", marks: [mark] }] })).toBeNull();
    }
  });

  it("Given a mark outside the permitted set, Then the block is refused", () => {
    expect(block({ runs: [{ text: "x", marks: ["highlight"] }] })).toMatch(/mark/);
  });

  it("Given a link on a run, Then the block is acceptable", () => {
    expect(block({ runs: [{ text: "x", link: "https://example.test" }] })).toBeNull();
  });

  it("Given a run without text, Then the block is refused", () => {
    expect(block({ runs: [{ marks: ["bold"] }] })).toMatch(/text/);
  });

  it("Given runs that are not a list, Then the block is refused", () => {
    expect(block({ runs: "hello" })).toMatch(/runs/);
  });

  it("Given no order key, Then the block is refused", () => {
    expect(validateNode("text", { runs: [] })).toMatch(/order/);
    expect(validateNode("text", { runs: [], order: "!" })).toMatch(/order/);
  });
});

describe("validating a divider", () => {
  it("Given an order key, Then the divider is acceptable", () => {
    expect(validateNode("divider", { order: "i" })).toBeNull();
  });

  it("Given no order key, Then the divider is refused", () => {
    expect(validateNode("divider", {})).toMatch(/order/);
  });

  it("Given authored text, Then the divider is refused", () => {
    expect(validateNode("divider", { order: "i", runs: [{ text: "x" }] })).toMatch(
      /divider/,
    );
  });
});

describe("normalizing runs", () => {
  it("Given adjacent runs with the same marks, Then they join", () => {
    expect(normalizeRuns([{ text: "he" }, { text: "llo" }])).toEqual([
      { text: "hello" },
    ]);
  });

  it("Given adjacent runs with different marks, Then they stay apart", () => {
    expect(
      normalizeRuns([{ text: "he" }, { text: "llo", marks: ["bold"] }]),
    ).toEqual([{ text: "he" }, { text: "llo", marks: ["bold"] }]);
  });

  it("Given marks in a different order, Then the runs still join", () => {
    expect(
      normalizeRuns([
        { text: "he", marks: ["bold", "italic"] },
        { text: "llo", marks: ["italic", "bold"] },
      ]),
    ).toEqual([{ text: "hello", marks: ["bold", "italic"] }]);
  });

  it("Given adjacent runs with different links, Then they stay apart", () => {
    expect(
      normalizeRuns([
        { text: "he", link: "https://one.test" },
        { text: "llo", link: "https://two.test" },
      ]),
    ).toHaveLength(2);
  });

  it("Given empty runs, Then they are dropped", () => {
    expect(normalizeRuns([{ text: "" }, { text: "hi" }, { text: "" }])).toEqual([
      { text: "hi" },
    ]);
  });

  it("Given only empty runs, Then nothing survives", () => {
    expect(normalizeRuns([{ text: "" }])).toEqual([]);
  });

  it("Given duplicate marks on one run, Then each appears once and in a stable order", () => {
    expect(normalizeRuns([{ text: "x", marks: ["italic", "bold", "bold"] }])).toEqual(
      [{ text: "x", marks: ["bold", "italic"] }],
    );
  });
});

describe("reading and splitting run text", () => {
  it("Given runs, Then their text concatenates in order", () => {
    expect(runsText([{ text: "he" }, { text: "llo", marks: ["bold"] }])).toBe("hello");
  });

  it("Given a split inside a run, Then both halves keep the run's marks", () => {
    const [head, tail] = splitRuns([{ text: "hello", marks: ["bold"] }], 2);
    expect(head).toEqual([{ text: "he", marks: ["bold"] }]);
    expect(tail).toEqual([{ text: "llo", marks: ["bold"] }]);
  });

  it("Given a split on a run boundary, Then neither half is empty-padded", () => {
    const [head, tail] = splitRuns([{ text: "he" }, { text: "llo" }], 2);
    expect(head).toEqual([{ text: "he" }]);
    expect(tail).toEqual([{ text: "llo" }]);
  });

  it("Given a split at the start, Then the head is empty", () => {
    const [head, tail] = splitRuns([{ text: "hello" }], 0);
    expect(head).toEqual([]);
    expect(tail).toEqual([{ text: "hello" }]);
  });

  it("Given a split past the end, Then the tail is empty", () => {
    const [head, tail] = splitRuns([{ text: "hello" }], 99);
    expect(head).toEqual([{ text: "hello" }]);
    expect(tail).toEqual([]);
  });

  it("Given text outside the basic plane, Then the split counts characters not code units", () => {
    const [head, tail] = splitRuns([{ text: "a🙂b" }], 2);
    expect(head).toEqual([{ text: "a🙂" }]);
    expect(tail).toEqual([{ text: "b" }]);
  });

  it("Given any split point, Then no character is lost", () => {
    const runs = [
      { text: "one " },
      { text: "two", marks: ["bold" as const] },
      { text: " three", link: "https://example.test" },
    ];
    const whole = runsText(runs);
    for (let at = 0; at <= [...whole].length; at++) {
      const [head, tail] = splitRuns(runs, at);
      expect(runsText(head) + runsText(tail)).toBe(whole);
    }
  });
});
