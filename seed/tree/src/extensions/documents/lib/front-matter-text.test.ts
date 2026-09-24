import { describe, expect, it } from "vitest";

import { authorsText, listOf, readAuthors, withPart } from "./front-matter-text";

describe("the authors line the panel writes", () => {
  it("reads names with their affiliations, an address and the corresponding mark", () => {
    expect(readAuthors("Ada Lovelace (1) <ada@example.org> *; Charles Babbage (1, 2)", 2)).toEqual({
      authors: [
        { name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true },
        { name: "Charles Babbage", affiliations: [0, 1] },
      ],
    });
  });

  it("writes back what it reads, so saving the panel again changes nothing", () => {
    const line = "Ada Lovelace (1) <ada@example.org> *; Charles Babbage (1, 2); Grace Hopper";
    const read = readAuthors(line, 2);
    expect("authors" in read && authorsText(read.authors)).toBe(line);
  });

  it("refuses an affiliation the document does not list, and a line with no name", () => {
    expect(readAuthors("Ada Lovelace (3)", 2)).toEqual({ failure: "Ada Lovelace names affiliation 3, and the document lists 1 to 2." });
    expect(readAuthors("Ada Lovelace (1)", 0)).toEqual({ failure: "Ada Lovelace names affiliation 1, and the document lists none." });
    expect(readAuthors("(1) *", 1)).toHaveProperty("failure");
  });
});

describe("the other lines", () => {
  it("splits and trims a list, dropping what is empty", () => {
    expect(listOf(" provenance, , typesetting ", ",")).toEqual(["provenance", "typesetting"]);
    expect(listOf("Analytical Engines Ltd; Difference Works", ";")).toEqual(["Analytical Engines Ltd", "Difference Works"]);
  });

  it("replaces one part and leaves the rest, clearing what is emptied", () => {
    expect(withPart({ keywords: ["a"], venue: "ieee" }, { keywords: [] })).toEqual({ venue: "ieee" });
    expect(withPart({ venue: "ieee" }, { venue: "generic" })).toEqual({ venue: "generic" });
  });
});
