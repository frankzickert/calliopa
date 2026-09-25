import { describe, expect, it } from "vitest";

import { documentOfInput, ToolRefusal } from "./tools";

/** What `read_document_roles` refuses before it reads (`BO_0299_018`). */
describe("read_document_roles", () => {
  it("needs the document as a record id", () => {
    expect(() => documentOfInput({})).toThrow(ToolRefusal);
    expect(() => documentOfInput({ document: "story" })).toThrow(ToolRefusal);
    expect(
      documentOfInput({ document: " 2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c " }),
    ).toBe("2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c");
  });
});
