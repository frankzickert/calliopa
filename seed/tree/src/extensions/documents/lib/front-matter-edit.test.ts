import { describe, expect, it } from "vitest";

import { addWord, authorsOf, isBlank, removeAffiliation, removeKeyword, rowsOf, withPart } from "./front-matter-edit";

describe("the chips", () => {
  it("enters a trimmed word once, and nothing for an empty or a listed one", () => {
    expect(addWord(["a"], "  b ")).toEqual(["a", "b"]);
    expect(addWord(undefined, "a")).toEqual(["a"]);
    expect(addWord(["a"], "a")).toBeNull();
    expect(addWord(["a"], "   ")).toBeNull();
  });

  it("removes a keyword, clearing the part when it was the last", () => {
    expect(removeKeyword({ keywords: ["a", "b"], venue: "ieee" }, 0)).toEqual({ keywords: ["b"], venue: "ieee" });
    expect(removeKeyword({ keywords: ["a"] }, 0)).toEqual({});
  });

  it("removes an affiliation and renumbers every author's affiliations", () => {
    const front = {
      affiliations: ["X", "Y", "Z"],
      authors: [{ name: "A", affiliations: [0, 1] }, { name: "B", affiliations: [1] }, { name: "C", affiliations: [2], corresponding: true as const }],
    };
    expect(removeAffiliation(front, 1)).toEqual({
      affiliations: ["X", "Z"],
      authors: [{ name: "A", affiliations: [0] }, { name: "B" }, { name: "C", affiliations: [1], corresponding: true }],
    });
  });
});

describe("the author rows", () => {
  it("draws every field and reads the rows back as authors, sorted affiliations and all", () => {
    const rows = rowsOf([{ name: "Ada", affiliations: [1, 0], email: "ada@example.org", corresponding: true }, { name: "Charles" }]);
    expect(rows).toEqual([
      { name: "Ada", email: "ada@example.org", affiliations: [1, 0], corresponding: true },
      { name: "Charles", email: "", affiliations: [], corresponding: false },
    ]);
    expect(authorsOf(rows)).toEqual({ authors: [{ name: "Ada", affiliations: [0, 1], email: "ada@example.org", corresponding: true }, { name: "Charles" }] });
  });

  it("leaves a blank row out and refuses a row with something but no name", () => {
    const blank = { name: "", email: "", affiliations: [], corresponding: false };
    expect(isBlank(blank)).toBe(true);
    expect(authorsOf([{ name: "Ada", email: "", affiliations: [], corresponding: false }, blank])).toEqual({ authors: [{ name: "Ada" }] });
    expect(authorsOf([blank, { name: " ", email: "x@example.org", affiliations: [], corresponding: false }])).toEqual({ failure: "Author 2 has no name yet." });
  });

  it("replaces one part and leaves the rest, clearing what is emptied", () => {
    expect(withPart({ keywords: ["a"], venue: "ieee" }, { keywords: [] })).toEqual({ venue: "ieee" });
    expect(withPart({ venue: "ieee" }, { venue: "generic" })).toEqual({ venue: "generic" });
  });
});
