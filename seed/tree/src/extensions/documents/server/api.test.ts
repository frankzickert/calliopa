import { describe, expect, it } from "vitest";

import { parseDocumentCommand } from "./api";

/** The standing command as the documents API parses it. BO_0227_010 */
describe("a setDisposition command", () => {
  const base = {
    command: "setDisposition",
    blockId: "blk-a",
    baseRevisionId: "rev-a",
  };

  it("Given a standing on the scale, Then it is read as that standing, neutral included", () => {
    for (const standing of [
      "pin",
      "keep",
      "resolved",
      "discarded",
      "neutral",
    ]) {
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
      failure: "A standing is one of discarded, resolved, neutral, keep, pin.",
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
        parseDocumentCommand({ command: "setDisposition", standing: "pin" }),
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

  it("Given a tail that is not a block identity, Then it is refused before the graph", () => {
    for (const tailBlockId of ["", "blk-b", 7, `${tail} `, tail.toUpperCase()]) {
      expect(parseDocumentCommand({ ...base, tailBlockId })).toEqual({
        failure: "A split's tail is named by a block identity.",
      });
    }
  });
});
