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
