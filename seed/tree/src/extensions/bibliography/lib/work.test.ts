import { describe, expect, it } from "vitest";

import { FRONT_KINDS, WORK_KINDS, dateOf, dateText, duplicateOf, fieldsOfRecord, identifiersOf, kindWords, readWorkRecord, recordFromCsl, recordOfSource } from "./work";

/** A source's record, read and judged one way everywhere (`BO_0291_016`). */
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
    expect(readWorkRecord({ kind: "book" })).toEqual({ failure: "A source carries a title." });
    expect(readWorkRecord({ title: "x", kind: "movie" })).toMatchObject({ failure: expect.stringContaining("A source's kind is one of") });
    expect(readWorkRecord({ title: "x", kind: "book", pages: "3" })).toEqual({ failure: "A source carries no pages." });
    expect(readWorkRecord({ title: "x", kind: "book", author: [{ given: "G." }] })).toEqual({
      failure: "A name in a source's author carries a family name or a literal.",
    });
    expect(readWorkRecord({ title: "x", kind: "book", issued: { year: 2013 } })).toEqual({
      failure: "A source's issued is a date: date-parts or raw.",
    });
    expect(readWorkRecord({ title: "x", kind: "book", fetched: { by: "z" } })).toEqual({
      failure: "A source's fetched says by whom, when and from which identifier.",
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
    // Every CSL type is a source's kind: the record keeps its own. BO_0313
    expect(recordFromCsl({ type: "post-weblog", title: "A post" }, fetched)).toMatchObject({ record: { kind: "post-weblog" } });
    expect(recordFromCsl({ type: "broadcast", title: "A show" }, fetched)).toMatchObject({ record: { kind: "broadcast" } });
    expect(recordFromCsl({ type: "hologram", title: "?" }, fetched)).toMatchObject({ record: { kind: "document" } });
    expect(recordFromCsl({ type: "book" }, fetched)).toEqual({ failure: "A source carries a title." });
  });
});

/** A source's record is its document's title and Source's fields (BO_0313_010). */
describe("a source's record and Source's fields", () => {
  const file = { _kind: "blob", hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", mediaType: "application/pdf", size: 12, filename: "paper.pdf" };
  const record = {
    title: "Nanometre-scale thermometry in a living cell",
    kind: "article-journal" as const,
    author: [{ family: "Kucsko", given: "G." }, { literal: "The Consortium" }],
    editor: [{ family: "Smith" }],
    issued: { "date-parts": [[2013, 8, 1]] },
    "container-title": "Nature",
    volume: "500",
    issue: "7460",
    page: "54-58",
    publisher: "Nature Publishing Group",
    "publisher-place": "London",
    DOI: "10.1038/nature12373",
    ISBN: "9780262035613",
    URL: "https://example.org/paper",
    accessed: { raw: "last spring" },
    abstract: "Heat.",
    tags: ["thermometry", "biology"],
    fetched: { by: "zotero-translation-server", at: "2026-09-23T10:00:00Z", from: "10.1038/nature12373" },
    file,
  };

  it("writes every field under Source's keys, the title left to the document", () => {
    expect(fieldsOfRecord(record)).toEqual({
      kind: "article-journal",
      authors: "Kucsko, G.\nThe Consortium",
      editors: "Smith",
      issued: "2013-08-01",
      container: "Nature",
      volume: "500",
      issue: "7460",
      pages: "54-58",
      publisher: "Nature Publishing Group",
      place: "London",
      doi: "10.1038/nature12373",
      isbn: "9780262035613",
      url: "https://example.org/paper",
      accessed: "last spring",
      abstract: "Heat.",
      tags: "thermometry, biology",
      fetched: "10.1038/nature12373 · zotero-translation-server · 2026-09-23T10:00:00Z",
      file: { hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", filename: "paper.pdf", mediaType: "application/pdf", size: 12 },
    });
  });

  it("reads them back as the same record", () => {
    expect(recordOfSource(record.title, fieldsOfRecord(record))).toEqual({ record });
  });

  it("reads a source typed in by hand: a year alone, an institution, no identifier", () => {
    expect(recordOfSource("Interview with the curator", { kind: "interview", authors: "Museum of Things\nOkafor, Chi", issued: "2025" })).toEqual({
      record: {
        title: "Interview with the curator",
        kind: "interview",
        author: [{ literal: "Museum of Things" }, { family: "Okafor", given: "Chi" }],
        issued: { "date-parts": [[2025]] },
      },
    });
  });

  it("reads a kind no value names as a document", () => {
    expect(recordOfSource("T", {})).toEqual({ record: { title: "T", kind: "document" } });
  });

  it("writes a date as text and reads it back", () => {
    expect(dateText({ "date-parts": [[2024]] })).toBe("2024");
    expect(dateText({ "date-parts": [[2024, 3]] })).toBe("2024-03");
    expect(dateOf("2024-03-05")).toEqual({ "date-parts": [[2024, 3, 5]] });
    expect(dateOf("Spring 2024")).toEqual({ raw: "Spring 2024" });
    expect(dateOf(" ")).toBeUndefined();
  });
});

/** The add form's types (BO_0313_Q2): eight up front, every other CSL type behind More. */
describe("the kinds a source is", () => {
  it("offers paper, book, web page, interview, conversation, dataset, software and report up front", () => {
    expect(FRONT_KINDS.map(kindWords)).toEqual(["Paper", "Book", "Web page", "Interview", "Conversation", "Dataset", "Software", "Report"]);
  });

  it("holds every CSL type, each readable", () => {
    expect(WORK_KINDS).toHaveLength(45);
    for (const kind of FRONT_KINDS) expect(WORK_KINDS).toContain(kind);
    expect(kindWords("legal_case")).toBe("Legal case");
    expect(kindWords("entry-encyclopedia")).toBe("Entry encyclopedia");
  });
});
