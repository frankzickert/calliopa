import { describe, expect, it } from "vitest";

import { frontOf } from "./front";

// The front matter from *Paper*'s values (`calliopa-bootstrap`'s `BO_0312_Q3`).
describe("frontOf", () => {
  it("Given authors one per line with an address, Then each is a name and its email", () => {
    expect(frontOf({ authors: "Ada Lovelace <ada@example.org>\n\n  Charles Babbage  " }).authors).toEqual([
      { name: "Ada Lovelace", email: "ada@example.org" },
      { name: "Charles Babbage" },
    ]);
  });

  it("Given one affiliation, Then it is every author's", () => {
    expect(frontOf({ authors: "A\nB", affiliations: "Engines Ltd" }).authors.map((author) => author.affiliation)).toEqual(["Engines Ltd", "Engines Ltd"]);
  });

  it("Given as many affiliations as authors, Then they pair in order", () => {
    expect(frontOf({ authors: "A\nB", affiliations: "One\nTwo" }).authors.map((author) => author.affiliation)).toEqual(["One", "Two"]);
  });

  it("Given affiliations that do not pair, Then every author carries them all, so nothing written is dropped", () => {
    expect(frontOf({ authors: "A\nB\nC", affiliations: "One\nTwo" }).authors.map((author) => author.affiliation)).toEqual(["One; Two", "One; Two", "One; Two"]);
  });

  it("Given keywords, Then they split at commas and semicolons", () => {
    expect(frontOf({ keywords: "provenance, typesetting; records ," }).keywords).toEqual(["provenance", "typesetting", "records"]);
  });

  it("Given nothing, Then no authors and no keywords", () => {
    expect(frontOf({})).toEqual({ authors: [], keywords: [] });
  });
});
