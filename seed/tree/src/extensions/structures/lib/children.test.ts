import { describe, expect, it } from "vitest";

import { childrenFrom, startsRun, valuesWithChildren } from "./children";
import type { FieldDeclaration } from "./structures";

const field = (key: string, type: FieldDeclaration["type"], extra: Partial<FieldDeclaration> = {}): FieldDeclaration => ({
  key,
  name: key,
  type,
  required: false,
  ...extra,
});

// A block nested into a field is the field's child (`calliopa-bootstrap`'s
// `BO_0349_020`): stored as block ids per field key, beside the values.
describe("childrenFrom", () => {
  it("Given stored children, Then the lists of block ids per key, in order", () => {
    expect(childrenFrom({ hook: ["b1", "b2"], body: ["b3"] })).toEqual({ hook: ["b1", "b2"], body: ["b3"] });
  });

  it("Given anything else stored, Then nothing it cannot read", () => {
    expect(childrenFrom(undefined)).toEqual({});
    expect(childrenFrom(["b1"])).toEqual({});
    expect(childrenFrom({ hook: "b1", body: [1, "b2"], empty: [] })).toEqual({ body: ["b2"] });
  });
});

// A field whose kind is not text has its value proposed by a run read off the
// child (`BO_0349_Q10`); a text field and a reference read the children.
describe("startsRun", () => {
  it("Given a text, a long text or a reference, Then the child alone fills it", () => {
    expect(startsRun(field("a", "text"))).toBe(false);
    expect(startsRun(field("a", "longText"))).toBe(false);
    expect(startsRun(field("a", "reference"))).toBe(false);
  });

  it("Given any other kind, Then a run proposes the value", () => {
    for (const type of ["number", "date", "boolean", "choice", "file"] as const) expect(startsRun(field("a", type))).toBe(true);
  });
});

// Editing the child is editing the field's value: nothing is copied (`BO_0349_Q9`).
describe("valuesWithChildren", () => {
  const words = new Map([["b1", "First words."], ["b2", "Second words."]]);

  it("Given a text field with children, Then their words in order, over a value typed before", () => {
    const values = valuesWithChildren([field("hook", "text")], { hook: "typed" }, { hook: ["b1", "b2"] }, words);
    expect(values["hook"]).toBe("First words. Second words.");
  });

  it("Given a long text field with children, Then their words as paragraphs", () => {
    const values = valuesWithChildren([field("body", "longText")], {}, { body: ["b1", "b2"] }, words);
    expect(values["body"]).toBe("First words.\n\nSecond words.");
  });

  it("Given a reference field with children, Then it holds them as its list", () => {
    const values = valuesWithChildren([field("see", "reference", { many: true })], {}, { see: ["b1", "b2"] }, words);
    expect(values["see"]).toEqual(["b1", "b2"]);
  });

  it("Given a field of another kind, Then its own value stands beside its children", () => {
    const values = valuesWithChildren([field("when", "date")], { when: "2026-10-05" }, { when: ["b1"] }, words);
    expect(values["when"]).toBe("2026-10-05");
  });

  it("Given a child whose words did not read, Then it is left out, and a field left with none keeps its typed value", () => {
    const values = valuesWithChildren([field("hook", "text")], { hook: "typed" }, { hook: ["gone"] }, words);
    expect(values["hook"]).toBe("typed");
  });
});
