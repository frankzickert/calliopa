import { describe, expect, it } from "vitest";

import type { FieldDeclaration, TakenRole } from "./roles";
import { valuesLine, valueWords } from "./values";

// The values line in a document's header (`DO_0030_005`): what a person
// reads of each filled value, by its field's type.
const field = (key: string, type: FieldDeclaration["type"], name = key): FieldDeclaration => ({ key, name, type, required: false });

const role = (id: string, name: string, fields: FieldDeclaration[], values: TakenRole["values"], extra: Partial<TakenRole> = {}): TakenRole => ({
  id,
  name,
  description: "",
  retired: false,
  builtin: false,
  offered: true,
  fields,
  values,
  missing: [],
  blocks: true,
  ...extra,
});

describe("valueWords", () => {
  it("Given each field type, Then the value as a person reads it", () => {
    expect(valueWords(field("t", "text"), " Hello ", {})).toBe("Hello");
    expect(valueWords(field("c", "choice"), "PDF", {})).toBe("PDF");
    expect(valueWords(field("n", "number"), 42, {})).toBe("42");
    expect(valueWords(field("d", "date"), "2026-10-12", {}, "en-GB")).toBe("12 Oct 2026");
    expect(valueWords(field("b", "boolean", "Peer reviewed"), true, {})).toBe("Peer reviewed");
    expect(valueWords(field("f", "file"), { hash: "h", filename: "cover.png", mediaType: "image/png", size: 3 }, {})).toBe("cover.png");
    expect(valueWords(field("r", "reference"), "doc-7", { "doc-7": "The essay" })).toBe("The essay");
  });

  it("Given a long text, Then its first line, cut", () => {
    expect(valueWords(field("l", "longText"), "\nFirst line\nsecond", {})).toBe("First line");
    const long = valueWords(field("l", "longText"), "x".repeat(200), {});
    expect(long?.length).toBe(80);
    expect(long?.endsWith("…")).toBe(true);
  });

  it("Given nothing filled, false, or a reference naming nothing that reads, Then nothing or the id", () => {
    expect(valueWords(field("t", "text"), "", {})).toBeNull();
    expect(valueWords(field("t", "text"), "   ", {})).toBeNull();
    expect(valueWords(field("t", "text"), null, {})).toBeNull();
    expect(valueWords(field("t", "text"), undefined, {})).toBeNull();
    expect(valueWords(field("b", "boolean"), false, {})).toBeNull();
    expect(valueWords(field("r", "reference"), "gone", {})).toBe("gone");
  });
});

describe("valuesLine", () => {
  it("Given roles with filled and empty values, Then one entry per role with any filled, values in field order", () => {
    const blog = role("r-blog", "Blog post", [field("date", "date"), field("tag", "text"), field("slug", "text")], { date: "2026-10-12", slug: "header" });
    const format = role("builtin:format", "Format", [field("type", "choice"), field("schema", "longText")], { type: "PDF" });
    const empty = role("r-story", "Story", [field("hook", "text")], {});
    expect(valuesLine([blog, empty, format], {}, "en-GB")).toEqual([
      { role: "r-blog", name: "Blog post", values: ["12 Oct 2026", "header"] },
      { role: "builtin:format", name: "Format", values: ["PDF"] },
    ]);
  });

  it("Given a role a run only proposes, Then nothing of it", () => {
    const proposed = role("r-p", "Proposed", [field("t", "text")], { t: "x" }, { proposed: "role" });
    expect(valuesLine([proposed])).toEqual([]);
  });
});
