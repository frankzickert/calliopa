import { describe, expect, it } from "vitest";

import { parseDocumentCommand } from "./api";

/** The standing command as the documents API parses it. BO_0227_010 */
describe("a setDisposition command", () => {
  const base = {
    command: "setDisposition",
    blockId: "blk-a",
    baseRevisionId: "rev-a",
  };

  it("Given a standing on the scale, Then it is read as that standing, keep included", () => {
    for (const standing of ["fixate", "keep", "discarded"]) {
      expect(parseDocumentCommand({ ...base, standing })).toEqual({
        command: {
          command: "setDisposition",
          blockId: "blk-a",
          baseRevisionId: "rev-a",
          standing,
        },
      });
    }
  });

  it("Given no standing, Then it is refused rather than read as clearing one", () => {
    expect(parseDocumentCommand(base)).toEqual({
      failure: "A standing is one of discarded, keep, fixate, prompt.",
    });
  });

  it("Given a value off the scale, Then it is refused before the graph", () => {
    expect(
      "failure" in parseDocumentCommand({ ...base, standing: "banana" }),
    ).toBe(true);
  });

  it("Given no block or no base, Then it is refused", () => {
    expect(
      "failure" in
        parseDocumentCommand({ command: "setDisposition", standing: "fixate" }),
    ).toBe(true);
  });
});

/** A split whose tail the editor named. CA_0045_004 */
describe("a split command", () => {
  const base = { command: "split", blockId: "blk-a", baseRevisionId: "rev-a", at: 3 };
  const tail = "3f2b8c1e-9a4d-4e6b-8f0a-1c2d3e4f5a6b";

  it("Given no tail, Then it is read as the split it always was", () => {
    expect(parseDocumentCommand(base)).toEqual({
      command: { command: "split", blockId: "blk-a", baseRevisionId: "rev-a", at: 3 },
    });
  });

  it("Given a tail named by a block identity, Then the split carries it", () => {
    expect(parseDocumentCommand({ ...base, tailBlockId: tail })).toEqual({
      command: { command: "split", blockId: "blk-a", baseRevisionId: "rev-a", at: 3, tailBlockId: tail },
    });
  });

  it("Given the head's words and role, Then the split carries them, and a run outside the vocabulary is refused before the graph", () => {
    // The editor sends what it holds, so the head is written once. DO_0015_001
    expect(parseDocumentCommand({ ...base, tailBlockId: tail, runs: [{ text: "Typed " }, { text: "words", marks: ["bold"] }], role: "h2" })).toEqual({
      command: { command: "split", blockId: "blk-a", baseRevisionId: "rev-a", at: 3, tailBlockId: tail, runs: [{ text: "Typed " }, { text: "words", marks: ["bold"] }], role: "h2" },
    });
    expect("failure" in parseDocumentCommand({ ...base, runs: [{ text: "x", marks: ["glitter"] }] })).toBe(true);
    expect("failure" in parseDocumentCommand({ ...base, role: "banner" })).toBe(true);
  });

  it("Given a tail that is not a block identity, Then it is refused before the graph", () => {
    for (const tailBlockId of ["", "blk-b", 7, `${tail} `, tail.toUpperCase()]) {
      expect(parseDocumentCommand({ ...base, tailBlockId })).toEqual({
        failure: "A split's tail is named by a block identity.",
      });
    }
  });
});

/**
 * Mathematics through the commands route (`BO_0290_028`).
 *
 * This is the layer the walk found empty: the editor sent an equation and the
 * parser answered that a new block is text, a divider, a table or code — so
 * *Add equation* could never make one. The render harness could not catch it,
 * because it answers for the server itself; only the parser can say what the
 * parser takes.
 */
describe("an equation through the commands route", () => {
  it("Given an insert of an equation, Then it is read with its source", () => {
    expect(
      parseDocumentCommand({
        command: "insert",
        block: { kind: "equation", tex: "E = mc^2", numbered: true, caption: "Mass and energy" },
        placement: { at: "end" },
      }),
    ).toEqual({
      command: {
        command: "insert",
        block: { kind: "equation", tex: "E = mc^2", numbered: true, caption: "Mass and energy" },
        placement: { at: "end" },
      },
    });
  });

  it("Given an equation with no source, Then it is refused", () => {
    expect(
      parseDocumentCommand({ command: "insert", block: { kind: "equation", tex: "  " }, placement: { at: "end" } }),
    ).toEqual({ failure: "An equation carries the tex it is set from." });
  });

  it("Given a number written on one, Then it is refused: the number is the document's order", () => {
    expect(
      parseDocumentCommand({
        command: "insert",
        block: { kind: "equation", tex: "x", number: 1 },
        placement: { at: "end" },
      }),
    ).toEqual({ failure: "An equation number is the document order and is never written." });
  });

  it("Given a kind this build does not write, Then the refusal names what it does", () => {
    const answer = parseDocumentCommand({
      command: "insert",
      block: { kind: "diagram" },
      placement: { at: "end" },
    });
    expect("failure" in answer && answer.failure).toContain("an equation");
  });

  it("Given a revise whose runs carry mathematics, Then they survive the parse", () => {
    const runs = [
      { text: "Einstein wrote " },
      { text: "E = mc^2", math: true },
      { text: "", equationRef: "blk-e" },
    ];
    expect(
      parseDocumentCommand({ command: "revise", blockId: "blk-a", baseRevisionId: "rev-a", runs }),
    ).toEqual({
      command: { command: "revise", blockId: "blk-a", baseRevisionId: "rev-a", runs, role: undefined },
    });
  });
});

/** Every command mathematics sends, through the parser that decides what the
 * route takes. The walk found this layer empty twice over. BO_0290_028 */
describe("every command mathematics sends", () => {
  const cases: Record<string, Record<string, unknown>> = {
    "an equation revised whole": {
      command: "reviseEquation",
      blockId: "b",
      baseRevisionId: "r",
      tex: "x^2",
      caption: "C",
      numbered: true,
    },
    "a sentence carrying mathematics": {
      command: "revise",
      blockId: "b",
      baseRevisionId: "r",
      runs: [{ text: "x", math: true }],
    },
    "a sentence carrying a reference": {
      command: "revise",
      blockId: "b",
      baseRevisionId: "r",
      runs: [{ text: "", equationRef: "blk-e" }],
    },
    "an equation inserted": {
      command: "insert",
      block: { kind: "equation", tex: "x" },
      placement: { at: "end" },
    },
    "a paragraph placed between two drawn rows' keys (DO_0016_001)": {
      command: "insert",
      block: { kind: "text", runs: [] },
      placement: { between: ["ab", null] },
    },
    "a document begun with an equation": {
      command: "insert",
      block: { kind: "equation", tex: "x", numbered: true },
      placement: { at: "start" },
    },
  };

  for (const [what, body] of Object.entries(cases)) {
    it(`takes ${what}`, () => {
      const answer = parseDocumentCommand(body);
      expect("failure" in answer ? answer.failure : null).toBeNull();
    });
  }
});
