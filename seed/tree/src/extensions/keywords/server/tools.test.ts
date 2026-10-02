import { describe, expect, it } from "vitest";

import { documentOfInput, TOOLS, ToolRefusal } from "./tools";

/** The tools' input (`BO_0301_018`, `BO_0310_026`): a record id, or a
 * refusal in words. */
describe("the tools' input", () => {
  it("takes the document's record id", () => {
    expect(documentOfInput({ document: " 9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f " })).toBe("9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f");
  });

  it("refuses a missing or malformed document", () => {
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "quantum" })).toThrow(/record id/u);
  });

  it("answers read_keywords and the run-start prompt_keywords by name", async () => {
    expect(Object.keys(TOOLS).sort()).toEqual(["prompt_keywords", "read_keywords"]);
    await expect(TOOLS.prompt_keywords({ input: { block: "blk" }, run: { id: "run", group: "group", pin: 3 } })).rejects.toThrow(ToolRefusal);
  });
});
