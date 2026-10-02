import { describe, expect, it } from "vitest";

import { recordOfInput, ToolRefusal } from "./tools";
import { sourceStatements } from "./works";

/** What a run hands `propose_work`, and how the work is written (`BO_0291_021`). */
describe("propose_work's record", () => {
  it("reads a CSL-JSON item as fetch_record answered it, naming what fetched it", () => {
    const record = recordOfInput({
      record: { id: "K1", type: "article-journal", title: "Thermometry", "container-title": "Nature", DOI: "10.1038/nature12373" },
      from: "10.1038/nature12373",
    });
    expect(record).toMatchObject({ kind: "article-journal", title: "Thermometry", "container-title": "Nature", DOI: "10.1038/nature12373", fetched: { by: "fetch_record", from: "10.1038/nature12373" } });
  });

  it("keeps a record's own CSL type, an interview or a conversation alike (BO_0313)", () => {
    expect(recordOfInput({ record: { type: "interview", title: "On method" }, from: "https://example.org/i" })).toMatchObject({ kind: "interview" });
    expect(recordOfInput({ record: { type: "post-weblog", title: "A post" } })).toMatchObject({ kind: "post-weblog" });
    expect(recordOfInput({ record: { type: "nonsense", title: "X" } })).toMatchObject({ kind: "document" });
  });

  it("reads a source's own record, and refuses what is neither", () => {
    expect(recordOfInput({ record: { title: "Deep learning", kind: "book" } })).toMatchObject({ kind: "book" });
    expect(() => recordOfInput({})).toThrow(ToolRefusal);
    expect(() => recordOfInput({ record: { type: "book" } })).toThrow("A source carries a title.");
  });
});

describe("a source document's write (BO_0313_020)", () => {
  it("writes the document with record source, a paragraph, Source taken and its fields, every alias a plain identifier", () => {
    const parameters: Record<string, unknown> = {};
    const statements = sourceStatements(
      { title: "Field notes", kind: "interview", author: [{ family: "Lee", given: "Ana" }], issued: { "date-parts": [[2024, 3]] }, URL: "https://example.org/i" },
      { documentId: "d1", blockId: "b1", fieldsId: "f1" },
      parameters,
      false,
    );
    expect(statements).toHaveLength(7);
    expect(statements.some((statement) => statement.includes("status"))).toBe(false);
    expect(statements[0]).toMatch(/^CREATE \(sd:document \{id: \$sd_id, title: \$sd_title, record: \$sd_record\}\)$/u);
    expect(parameters["sd_record"]).toBe("source");
    expect(parameters["sf_role"]).toBe("builtin:source");
    expect(parameters["sf_values"]).toEqual({ kind: "interview", authors: "Lee, Ana", issued: "2024-03", url: "https://example.org/i" });
    expect(parameters["sdref"]).toBe("node:d1");
    expect(statements).toContain("RELATE sdref -[sh:hasBlockRole]-> srref");
  });

  it("establishes outside a branch", () => {
    const statements = sourceStatements({ title: "T", kind: "book" }, { documentId: "d", blockId: "b", fieldsId: "f" }, {}, true, "w0");
    expect(statements.filter((statement) => statement.startsWith("CREATE")).every((statement) => statement.endsWith(', status: "established"})'))).toBe(true);
    expect(statements[0]).toContain("CREATE (w0d:document");
  });
});
