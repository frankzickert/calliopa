import { describe, expect, it } from "vitest";

import { BUILTIN_OFFERS, fieldOf, FORMAT_STRUCTURE, isBuiltinField, mintFieldKey, INSTRUCTION_STRUCTURE, releaseFieldsOf, VARIATION_STRUCTURE } from "./structures";

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

  it("Given a key the structure already holds, Then the next number", () => {
    expect(mintFieldKey("Date", ["date"])).toBe("date2");
    expect(mintFieldKey("Date", ["date", "date2"])).toBe("date3");
  });
});

describe("isBuiltinField", () => {
  it("Given Format, Then type, a required choice of the six kinds, schema, and what a generation is made with", () => {
    expect(releaseFieldsOf(FORMAT_STRUCTURE).map((field) => [field.key, field.type, field.required])).toEqual([
      ["type", "choice", true],
      ["schema", "longText", false],
      ["provider", "text", false],
      ["model", "text", false],
      ["ratio", "text", false],
      ["quality", "text", false],
    ]);
    expect(isBuiltinField(FORMAT_STRUCTURE, "type")).toBe(true);
    expect(isBuiltinField(FORMAT_STRUCTURE, "mine")).toBe(false);
    expect(isBuiltinField("builtin:keyword", "type")).toBe(false);
    // Source's CSL fields are a release's too (BO_0313).
    expect(isBuiltinField("builtin:source", releaseFieldsOf("builtin:source")[0]?.key ?? "")).toBe(true);
  });
});

// What a format makes a picture or a video with (`calliopa-bootstrap`'s
// `BO_0336`): open fields suggesting from media's sources, the profile's
// format a reference carrying Format, and Variation offered by Format.
describe("the generation fields", () => {
  it("Given Format and Variation, Then the four suggest from media's sources and limit nothing", () => {
    for (const structureId of [FORMAT_STRUCTURE, VARIATION_STRUCTURE]) {
      const generation = releaseFieldsOf(structureId).filter((field) => field.suggest !== undefined);
      expect(generation.map((field) => [field.key, field.type, field.suggest])).toEqual([
        ["provider", "text", "media:provider"],
        ["model", "text", "media:model"],
        ["ratio", "text", "media:ratio"],
        ["quality", "text", "media:quality"],
      ]);
    }
  });

  it("Given Profile, Then an optional format, a reference carrying Format", () => {
    expect(releaseFieldsOf(INSTRUCTION_STRUCTURE)).toEqual([{ key: "format", name: "Format", type: "reference", required: false, carrying: FORMAT_STRUCTURE }]);
  });

  it("Given the release's offers, Then Format offers Variation", () => {
    expect(BUILTIN_OFFERS).toContainEqual([FORMAT_STRUCTURE, VARIATION_STRUCTURE]);
  });
});

describe("fieldOf", () => {
  it("Given a text field's source and words, Then both, cleaned; and a reference's structure", () => {
    expect(fieldOf({ key: "service", name: "Service", type: "text", suggest: "media:provider", suggestions: [" a ", "", "a", "b"] })).toEqual({
      key: "service",
      name: "Service",
      type: "text",
      required: false,
      suggest: "media:provider",
      suggestions: ["a", "b"],
    });
    expect(fieldOf({ key: "f", name: "F", type: "reference", carrying: "builtin:format" })?.carrying).toBe("builtin:format");
  });

  it("Given a source not named extension:name, a structure that is no id, or a shape on the wrong type, Then none of it", () => {
    expect(fieldOf({ key: "s", name: "S", type: "text", suggest: "provider" })?.suggest).toBeUndefined();
    expect(fieldOf({ key: "f", name: "F", type: "reference", carrying: "Format" })?.carrying).toBeUndefined();
    expect(fieldOf({ key: "n", name: "N", type: "number", suggest: "media:provider", carrying: "builtin:format" })).toEqual({ key: "n", name: "N", type: "number", required: false });
  });
});
