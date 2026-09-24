import { describe, expect, it } from "vitest";

import { entryText } from "../lib/segment";
import { citationKey, locatorOf, render, segmentsOf } from "./render";

/** Citations and reference lists rendered by citeproc-js in the shipped styles (`BO_0291_020`). */
const works = [
  {
    workId: "w2",
    record: {
      title: "Nanometre-scale thermometry in a living cell",
      kind: "article-journal" as const,
      author: [{ family: "Kucsko", given: "G." }, { family: "Maurer", given: "P. C." }],
      "container-title": "Nature",
      volume: "500",
      issue: "7460",
      page: "54-58",
      issued: { "date-parts": [[2013, 8]] },
      DOI: "10.1038/nature12373",
    },
  },
  { workId: "w1", record: { title: "Deep learning", kind: "book" as const, author: [{ family: "Goodfellow", given: "Ian" }], publisher: "MIT Press", "publisher-place": "Cambridge, MA", issued: { "date-parts": [[2016]] } } },
];
const cited = [{ work: "w2", locator: "p. 54" }, { work: "w1" }, { work: "w2" }];

describe("render", () => {
  it("numbers IEEE citations in the document's order, with the locator, and lists the works in that order with their labels", () => {
    const out = render("ieee", works, cited);
    expect(out.labels[citationKey({ work: "w2", locator: "p. 54" })]).toBe("[1, p. 54]");
    expect(out.labels[citationKey({ work: "w1" })]).toBe("[2]");
    expect(out.labels[citationKey({ work: "w2" })]).toBe("[1]");
    expect(out.entries.map((entry) => [entry.workId, entry.label])).toEqual([["w2", "[1]"], ["w1", "[2]"]]);
    expect(entryText(out.entries[0]!.entry)).toContain("G. Kucsko and P. C. Maurer, “Nanometre-scale thermometry in a living cell,” Nature, vol. 500, no. 7460, pp. 54–58");
    expect(out.entries[0]!.entry.find((segment) => segment.italic === true)?.text).toBe("Nature");
  });

  it("sets APA and Chicago author-date in the text, and lists by author without labels", () => {
    const apa = render("apa", works, cited);
    expect(apa.labels[citationKey({ work: "w2", locator: "p. 54" })]).toBe("(Kucsko & Maurer, 2013, p. 54)");
    expect(apa.entries.map((entry) => entry.workId)).toEqual(["w1", "w2"]);
    expect(apa.entries[0]!.label).toBeUndefined();
    expect(entryText(apa.entries[0]!.entry)).toBe("Goodfellow, I. (2016). Deep learning. MIT Press.");
    const chicago = render("chicago-author-date", works, cited);
    expect(chicago.labels[citationKey({ work: "w1" })]).toBe("(Goodfellow 2016)");
  });
});

describe("locators and markup", () => {
  it("reads a locator as a person writes it", () => {
    expect(locatorOf("p. 54")).toEqual({ label: "page", locator: "54" });
    expect(locatorOf("pp. 12–14")).toEqual({ label: "page", locator: "12–14" });
    expect(locatorOf("§3")).toEqual({ label: "section", locator: "3" });
    expect(locatorOf("fig. 2")).toEqual({ label: "figure", locator: "2" });
    expect(locatorOf("12")).toEqual({ label: "page", locator: "12" });
    expect(locatorOf("the introduction")).toEqual({ suffix: ", the introduction" });
    expect(locatorOf(undefined)).toEqual({});
  });

  it("keeps italics and decodes entities out of citeproc's markup", () => {
    expect(segmentsOf("A &#38; B, <i>Nature</i>, 2013.")).toEqual([{ text: "A & B, " }, { text: "Nature", italic: true }, { text: ", 2013." }]);
  });
});
