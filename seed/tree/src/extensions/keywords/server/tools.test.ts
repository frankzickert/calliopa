import { describe, expect, it } from "vitest";

import { documentOfInput, ToolRefusal } from "./tools";

/** The tool's input (`BO_0301_018`): a record id, or a refusal in words. */
describe("read_keywords' input", () => {
  it("takes the document's record id", () => {
    expect(documentOfInput({ document: " 9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f " })).toBe("9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f");
  });

  it("refuses a missing or malformed document", () => {
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "quantum" })).toThrow(/record id/u);
  });
});
