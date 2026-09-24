import { describe, expect, it } from "vitest";

import { recordOfInput, ToolRefusal } from "./tools";
import { pairsOf } from "./works";

/** What a run hands `propose_work`, and how the work is written (`BO_0291_021`). */
describe("propose_work's record", () => {
  it("reads a CSL-JSON item as fetch_record answered it, naming what fetched it", () => {
    const record = recordOfInput({
      record: { id: "K1", type: "article-journal", title: "Thermometry", "container-title": "Nature", DOI: "10.1038/nature12373" },
      from: "10.1038/nature12373",
    });
    expect(record).toMatchObject({ kind: "article-journal", title: "Thermometry", "container-title": "Nature", DOI: "10.1038/nature12373", fetched: { by: "fetch_record", from: "10.1038/nature12373" } });
  });

  it("reads a work's own record, and refuses what is neither", () => {
    expect(recordOfInput({ record: { title: "Deep learning", kind: "book" } })).toMatchObject({ kind: "book" });
    expect(() => recordOfInput({})).toThrow(ToolRefusal);
    expect(() => recordOfInput({ record: { type: "book" } })).toThrow("A work carries a title.");
  });
});

describe("a work's write", () => {
  it("names every property with a plain identifier, the hyphenated CSL keys in camel case", () => {
    const parameters: Record<string, unknown> = {};
    const pairs = pairsOf({ title: "T", kind: "book", "container-title": "Nature", "publisher-place": "Cambridge", publisher: "MIT" }, "w", parameters);
    expect(pairs).toEqual(["title: $w_title", "kind: $w_kind", "containerTitle: $w_containerTitle", "publisher: $w_publisher", "publisherPlace: $w_publisherPlace"]);
    expect(pairs.every((pair) => /^[A-Za-z][A-Za-z0-9]*: \$[A-Za-z_][A-Za-z0-9_]*$/u.test(pair))).toBe(true);
    expect(parameters["w_containerTitle"]).toBe("Nature");
  });
});
