import { describe, expect, it } from "vitest";

import { FORMAT_ROLE, isBuiltinField, mintFieldKey, releaseFieldsOf } from "./roles";

// A field's key is minted once from the name it is first given (`BO_0309_010`,
// `calliopa-bootstrap`'s `BO_0312`): what a reader such as `manuscripts` looks
// a value up by.
describe("mintFieldKey", () => {
  it("Given a name, Then its words in camel case", () => {
    expect(mintFieldKey("Citation style", [])).toBe("citationStyle");
    expect(mintFieldKey("Template", [])).toBe("template");
    expect(mintFieldKey("  e-mail   address ", [])).toBe("eMailAddress");
    expect(mintFieldKey("Affiliations (one per line)", [])).toBe("affiliationsOnePerLine");
  });

  it("Given a name with no letters, or one starting with a digit, Then a key that is still a word", () => {
    expect(mintFieldKey("—", [])).toBe("field");
    expect(mintFieldKey("2nd author", [])).toBe("field2ndAuthor");
  });

  it("Given a key the role already holds, Then the next number", () => {
    expect(mintFieldKey("Date", ["date"])).toBe("date2");
    expect(mintFieldKey("Date", ["date", "date2"])).toBe("date3");
  });
});

describe("isBuiltinField", () => {
  it("Given Format, Then type, a required choice of the six kinds, and schema", () => {
    expect(releaseFieldsOf(FORMAT_ROLE).map((field) => [field.key, field.type, field.required])).toEqual([
      ["type", "choice", true],
      ["schema", "longText", false],
    ]);
    expect(isBuiltinField(FORMAT_ROLE, "type")).toBe(true);
    expect(isBuiltinField(FORMAT_ROLE, "mine")).toBe(false);
    expect(isBuiltinField("builtin:keyword", "type")).toBe(false);
    // Source's CSL fields are a release's too (BO_0313).
    expect(isBuiltinField("builtin:source", releaseFieldsOf("builtin:source")[0]?.key ?? "")).toBe(true);
  });
});
