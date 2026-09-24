import { describe, expect, it } from "vitest";

import { readWorkRecord, type WorkRecord } from "../lib/work";
import { formOf, lineOf, matches, recordOf } from "./record-form";

/** The form and the record, each way (`BO_0291_019`). */
const record: WorkRecord = {
  title: "Nanometre-scale thermometry in a living cell",
  kind: "article-journal",
  author: [{ family: "Kucsko", given: "G." }, { family: "Maurer", given: "P. C." }, { literal: "The Consortium" }],
  issued: { "date-parts": [[2013, 8]] },
  "container-title": "Nature",
  volume: "500",
  DOI: "10.1038/nature12373",
  tags: ["thermometry", "cells"],
  fetched: { by: "zotero-translation-server", at: "2026-09-23T10:00:00Z", from: "10.1038/nature12373" },
};

describe("the work form", () => {
  it("fills from a record and reads back to the same record, keeping what it does not edit", () => {
    const form = formOf(record);
    expect(form.authors).toBe("Kucsko, G.\nMaurer, P. C.\nThe Consortium");
    expect(form.year).toBe("2013");
    expect(form.tags).toBe("thermometry, cells");
    const back = recordOf(form, record);
    expect(readWorkRecord(back)).toEqual({
      record: { ...record, issued: { "date-parts": [[2013]] } },
    });
  });

  it("reads a lone family name, a raw year and empty fields as absent", () => {
    const back = recordOf({ ...formOf(record), authors: "Aristotle", year: "c. 350 BC", volume: " ", tags: "" });
    expect(back["author"]).toEqual([{ family: "Aristotle" }]);
    expect(back["issued"]).toEqual({ raw: "c. 350 BC" });
    expect(back["volume"]).toBeUndefined();
    expect(back["tags"]).toBeUndefined();
  });
});

describe("a row and a search", () => {
  it("says who, when and what", () => {
    expect(lineOf(record)).toEqual({ who: "Kucsko et al.", year: "2013", title: record.title });
    expect(lineOf({ title: "T", kind: "book", author: [{ family: "A" }, { family: "B" }] })).toEqual({ who: "A and B", year: "", title: "T" });
  });

  it("matches every word typed against title, names, year, container, tags and DOI", () => {
    expect(matches(record, "kucsko 2013")).toBe(true);
    expect(matches(record, "Nature thermometry")).toBe(true);
    expect(matches(record, "nature12373")).toBe(true);
    expect(matches(record, "einstein")).toBe(false);
    expect(matches(record, "  ")).toBe(true);
  });
});
