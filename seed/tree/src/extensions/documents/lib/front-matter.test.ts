import { describe, expect, it } from "vitest";

import { readFrontMatter } from "./front-matter";

describe("a document's front matter", () => {
  it("reads authors with their affiliations, the keywords and the venue, trimmed", () => {
    expect(
      readFrontMatter({
        authors: [{ name: " Ada Lovelace ", affiliations: [0], email: "ada@example.org", corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
        affiliations: ["Analytical Engines Ltd", "Difference Works"],
        keywords: ["provenance", " ", "typesetting"],
        venue: "ieee",
      }),
    ).toEqual({
      frontMatter: {
        authors: [{ name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
        affiliations: ["Analytical Engines Ltd", "Difference Works"],
        keywords: ["provenance", "typesetting"],
        venue: "ieee",
      },
    });
  });

  it("leaves out what is absent and what is empty", () => {
    expect(readFrontMatter({ title: "x", keywords: [], authors: [] })).toEqual({ frontMatter: {} });
  });

  it("refuses what is not front matter, naming why", () => {
    expect(readFrontMatter({ keywords: "a, b" })).toEqual({ failure: "A document's keywords are words, one per entry." });
    expect(readFrontMatter({ authors: [{ name: "" }] })).toEqual({ failure: "Author 1 carries no name." });
    expect(readFrontMatter({ authors: [{ name: "A", affiliations: [2] }], affiliations: ["One"] })).toEqual({
      failure: "Author 1's affiliations name the document's affiliations by their place in its list.",
    });
    expect(readFrontMatter({ authors: [{ name: "A", orcid: "x" }] })).toEqual({ failure: "Author 1 carries orcid, which an author does not carry." });
    expect(readFrontMatter({ venue: "Nature Physics" })).toEqual({ failure: "A document's venue is a venue's name, a word." });
    expect(readFrontMatter({ authors: [{ name: "A", corresponding: false }] })).toHaveProperty("failure");
  });
});
