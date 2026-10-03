import { describe, expect, it } from "vitest";

import { KEYWORD_STRUCTURE, SOURCE_STRUCTURE, BUILTIN_OFFERS, fieldOf, FORMAT_STRUCTURE, isBuiltinField, mintFieldKey, INSTRUCTION_STRUCTURE, releaseFieldsOf, VARIATION_STRUCTURE, INPUT_STRUCTURE, INPUT_KINDS, blocksAllowed } from "./structures";

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
    expect(isBuiltinField(KEYWORD_STRUCTURE, "type")).toBe(false);
    // Source's CSL fields are a release's too (BO_0313).
    expect(isBuiltinField(SOURCE_STRUCTURE, releaseFieldsOf(SOURCE_STRUCTURE)[0]?.key ?? "")).toBe(true);
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

  it("Given the release's offers, Then Format offers Variation and Input", () => {
    expect(BUILTIN_OFFERS).toContainEqual([FORMAT_STRUCTURE, VARIATION_STRUCTURE]);
    expect(BUILTIN_OFFERS).toContainEqual([FORMAT_STRUCTURE, INPUT_STRUCTURE]);
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
    expect(fieldOf({ key: "f", name: "F", type: "reference", carrying: FORMAT_STRUCTURE })?.carrying).toBe(FORMAT_STRUCTURE);
  });

  it("Given a source not named extension:name, a structure that is no id, or a shape on the wrong type, Then none of it", () => {
    expect(fieldOf({ key: "s", name: "S", type: "text", suggest: "provider" })?.suggest).toBeUndefined();
    expect(fieldOf({ key: "f", name: "F", type: "reference", carrying: "Format" })?.carrying).toBeUndefined();
    expect(fieldOf({ key: "n", name: "N", type: "number", suggest: "media:provider", carrying: FORMAT_STRUCTURE })).toEqual({ key: "n", name: "N", type: "number", required: false });
  });
});

// ME_0002_001: a format's input is a block using Input — its kind one of
// five, its name suggested from media's source, whether it is required.
describe("Input", () => {
  it("Given Input's release fields, Then Kind offers the five kinds, Name suggests from media and Required is true/false", () => {
    const fields = releaseFieldsOf(INPUT_STRUCTURE).map((field) => fieldOf(field));
    expect(fields.map((field) => [field?.key, field?.type, field?.required])).toEqual([["kind", "choice", true], ["name", "text", true], ["required", "boolean", false]]);
    expect(fields[0]?.options).toEqual(["Start frame", "End frame", "Reference image", "Reference video", "Reference audio"]);
    expect(INPUT_KINDS.map((kind) => kind.role)).toEqual(["start", "end", "image", "video", "audio"]);
    expect(fields[1]?.suggest).toBe("media:inputName");
  });

  it("Given Input, Then blocks may use it", () => {
    expect(blocksAllowed(INPUT_STRUCTURE, undefined)).toBe(true);
  });
});
