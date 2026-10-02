import { describe, expect, it } from "vitest";

import { formerRecord, rewrittenRuns, sourcesStatement } from "./migrations";

/** Every work becomes a source document and every citation names it (BO_0313_023). */
describe("the sources-are-documents migration", () => {
  const minted = (() => {
    let next = 0;
    return () => {
      next += 1;
      return { documentId: `doc-${next}`, blockId: `blk-${next}`, fieldsId: `fld-${next}` };
    };
  })();

  it("reads a work under the names it was stored by, and keeps one that no longer reads", () => {
    expect(formerRecord({ _type: "work", id: "w", title: "T", kind: "book", containerTitle: "Series", publisherPlace: "Oslo" })).toEqual({
      title: "T",
      kind: "book",
      "container-title": "Series",
      "publisher-place": "Oslo",
    });
    expect(formerRecord({ title: "Odd", kind: "book", author: "not a list" })).toEqual({ title: "Odd", kind: "book" });
    expect(formerRecord({})).toEqual({ title: "Untitled source", kind: "document" });
  });

  it("rewrites the citations of a migrated work and leaves every other run as it was", () => {
    const runs = [{ text: "As shown " }, { text: "", cite: { work: "w1", locator: "p. 3" } }, { text: "", cite: { work: "other" } }];
    expect(rewrittenRuns(runs, new Map([["w1", "doc-1"]]))).toEqual([
      { text: "As shown " },
      { text: "", cite: { work: "doc-1", locator: "p. 3" } },
      { text: "", cite: { work: "other" } },
    ]);
    expect(rewrittenRuns(runs, new Map([["w9", "doc-9"]]))).toBeNull();
  });

  it("answers one script: each work a source document, its citations renamed, the work retired", () => {
    const file = { _kind: "blob", hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", mediaType: "application/pdf", size: 9, filename: "a.pdf" };
    const { statement, parameters } = sourcesStatement(
      [
        { id: "w1", record: { title: "Attention", kind: "paper-conference", DOI: "10.1/x", file } },
        { id: "w2", record: { title: "A talk", kind: "speech" } },
      ],
      [
        { id: "b1", runs: [{ text: "", cite: { work: "w2" } }, { text: "", cite: { work: "w1" } }] },
        { id: "b2", runs: [{ text: "plain" }] },
      ],
      minted,
    );
    const parts = statement.split("; ");
    expect(parts.filter((part) => part.startsWith("CREATE (w0d:document"))).toHaveLength(1);
    expect(parts.filter((part) => part.startsWith("CREATE (w1d:document"))).toHaveLength(1);
    expect(parts).toContain("RETIRE x0");
    expect(parts).toContain("RETIRE x1");
    expect(parts).toContain("SET c0.runs = $c0_runs");
    expect(parts.some((part) => part.startsWith("SET c1"))).toBe(false);
    expect(parameters["x0NodeId"]).toBe("node:w1");
    expect(parameters["w0d_record"]).toBe("source");
    expect(parameters["w0f_values"]).toMatchObject({ kind: "paper-conference", doi: "10.1/x", file: { hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", filename: "a.pdf" } });
    expect(parameters["w0f_files"]).toEqual([file]);
    const w1Document = String(parameters["w0d_id"]);
    const w2Document = String(parameters["w1d_id"]);
    expect(parameters["c0_runs"]).toEqual([{ text: "", cite: { work: w2Document } }, { text: "", cite: { work: w1Document } }]);
    expect(parts.every((part) => !part.startsWith("CREATE") || part.endsWith(', status: "established"})'))).toBe(true);
  });

  it("answers nothing on an instance without works", () => {
    expect(sourcesStatement([], [], minted)).toEqual({ statement: "", parameters: {} });
  });
});
