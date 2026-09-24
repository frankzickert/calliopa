import { describe, expect, it } from "vitest";

import { duplicateOf, identifiersOf, readWorkRecord, recordFromCsl } from "./work";

/** A work's record, read and judged one way everywhere (`BO_0291_016`). */
describe("readWorkRecord", () => {
  const fetched = { by: "zotero-translation-server", at: "2026-09-23T10:00:00Z", from: "10.1038/nature12373" };

  it("keeps a CSL-JSON record with kind in place of type", () => {
    expect(
      readWorkRecord({
        title: "Nanometre-scale thermometry in a living cell",
        kind: "article-journal",
        author: [{ family: "Kucsko", given: "G." }, { literal: "The Consortium" }],
        issued: { "date-parts": [[2013, 8]] },
        "container-title": "Nature",
        DOI: "10.1038/nature12373",
        tags: ["thermometry"],
        fetched,
      }),
    ).toEqual({
      record: {
        title: "Nanometre-scale thermometry in a living cell",
        kind: "article-journal",
        author: [{ family: "Kucsko", given: "G." }, { literal: "The Consortium" }],
        issued: { "date-parts": [[2013, 8]] },
        "container-title": "Nature",
        DOI: "10.1038/nature12373",
        tags: ["thermometry"],
        fetched,
      },
    });
  });

  it("refuses a record without a title, with a kind outside the set, or with a field the declaration does not permit", () => {
    expect(readWorkRecord({ kind: "book" })).toEqual({ failure: "A work carries a title." });
    expect(readWorkRecord({ title: "x", kind: "movie" })).toMatchObject({ failure: expect.stringContaining("A work's kind is one of") });
    expect(readWorkRecord({ title: "x", kind: "book", pages: "3" })).toEqual({ failure: "A work carries no pages." });
    expect(readWorkRecord({ title: "x", kind: "book", author: [{ given: "G." }] })).toEqual({
      failure: "A name in a work's author carries a family name or a literal.",
    });
    expect(readWorkRecord({ title: "x", kind: "book", issued: { year: 2013 } })).toEqual({
      failure: "A work's issued is a date: date-parts or raw.",
    });
    expect(readWorkRecord({ title: "x", kind: "book", fetched: { by: "z" } })).toEqual({
      failure: "A work's fetched says by whom, when and from which identifier.",
    });
  });
});

describe("the identifier is the identity", () => {
  it("normalizes a DOI, an ISBN and a URL", () => {
    expect(identifiersOf({ DOI: "https://doi.org/10.1038/Nature12373" })).toEqual([{ kind: "DOI", value: "10.1038/nature12373" }]);
    expect(identifiersOf({ ISBN: "978-0-262-03561-3 9780262035613" })).toEqual([{ kind: "ISBN", value: "9780262035613" }]);
    expect(identifiersOf({ URL: "https://Example.org/paper/#abstract" })).toEqual([{ kind: "URL", value: "https://example.org/paper" }]);
  });

  it("finds the work sharing an identifier, and none for a record carrying none", () => {
    const held = [
      { workId: "wrk-1", record: { title: "Deep learning", kind: "book" as const, ISBN: "9780262035613" } },
      { workId: "wrk-2", record: { title: "Thermometry", kind: "article-journal" as const, DOI: "10.1038/nature12373" } },
    ];
    expect(duplicateOf({ DOI: "doi:10.1038/NATURE12373" }, held)?.workId).toBe("wrk-2");
    expect(duplicateOf({ ISBN: "978-0262035613" }, held)?.workId).toBe("wrk-1");
    expect(duplicateOf({ URL: "https://example.org/x" }, held)).toBeUndefined();
    expect(duplicateOf({}, held)).toBeUndefined();
  });
});

describe("recordFromCsl", () => {
  const fetched = { by: "zotero-translation-server", at: "2026-09-23T10:00:00Z", from: "arXiv:1706.03762" };

  it("reads what the engine exports, dropping its key and mapping its type", () => {
    const read = recordFromCsl(
      { id: "CNRRWF7D", type: "article-journal", title: "T", author: [{ family: "A", given: "B" }], issued: { "date-parts": [["2013", 8]] }, "container-title": "Nature", ISSN: "0028-0836", DOI: "10.1/x" },
      fetched,
    );
    expect(read).toEqual({
      record: { kind: "article-journal", fetched, author: [{ family: "A", given: "B" }], issued: { "date-parts": [["2013", 8]] }, "container-title": "Nature", DOI: "10.1/x", title: "T" },
    });
    expect(recordFromCsl({ type: "post-weblog", title: "A post" }, fetched)).toMatchObject({ record: { kind: "post" } });
    expect(recordFromCsl({ type: "broadcast", title: "A show" }, fetched)).toMatchObject({ record: { kind: "document" } });
    expect(recordFromCsl({ type: "book" }, fetched)).toEqual({ failure: "A work carries a title." });
  });
});
