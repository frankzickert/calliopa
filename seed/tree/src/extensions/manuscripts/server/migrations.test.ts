import { describe, expect, it } from "vitest";

import type { ReadNode } from "~/server/ccgw/client";

import { formatsStatement, heldFront, PAPER_FIELDS } from "./migrations";

// The formats migration's statement, pure (`calliopa-bootstrap`'s `BO_0312_023`).

const documentNode = (id: string, content: Record<string, unknown>): ReadNode =>
  ({ id: `node:${id}`, revision: { id: `rev-${id}`, status: "established", content: { _type: "document", id, title: id, ...content } } }) as unknown as ReadNode;

describe("heldFront", () => {
  it("Given a document's front matter, Then Paper's words: an author per line with the mark and address, affiliations per line, keywords by commas", () => {
    const front = heldFront(
      documentNode("d1", {
        authors: [{ name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }, { name: "" }],
        affiliations: ["Analytical Engines Ltd", "Difference Works"],
        keywords: ["provenance", "typesetting"],
        venue: "ieee",
      }),
    );
    expect(front).toEqual({
      documentId: "d1",
      values: { authors: "Ada Lovelace* <ada@example.org>\nCharles Babbage", affiliations: "Analytical Engines Ltd\nDifference Works", keywords: "provenance, typesetting" },
      held: ["authors", "affiliations", "keywords", "venue"],
    });
  });

  it("Given a document with a venue alone, Then it is cleared too", () => {
    expect(heldFront(documentNode("d2", { venue: "generic" }))?.held).toEqual(["venue"]);
  });

  it("Given a document with no front matter, Then nothing", () => {
    expect(heldFront(documentNode("d3", {}))).toBeNull();
  });
});

describe("formatsStatement", () => {
  const ids = ["paper-id", "values-1", "values-2"];
  const mint = () => ids.shift() as string;

  it("Given kept manuscripts and two documents with front matter, Then the manuscripts retired, Paper made once, each document cleared before it takes Paper with its values", () => {
    const fronts = [
      { documentId: "d1", values: { authors: "Ada", affiliations: "", keywords: "x" }, held: ["authors", "keywords"] },
      { documentId: "d2", values: { authors: "", affiliations: "", keywords: "" }, held: ["venue"] },
    ];
    const { statement, parameters } = formatsStatement(["m1", "m2"], fronts, 7, mint);
    const statements = statement.split("; ");
    expect(statements.slice(0, 2)).toEqual(["RETIRE m0", "RETIRE m1"]);
    expect(parameters["m0NodeId"]).toBe("node:m1");
    expect(statements.filter((line) => line.startsWith("CREATE (p:blockRole"))).toHaveLength(1);
    expect(parameters).toMatchObject({ p_id: "paper-id", p_name: "Paper", p_order: 7, p_fields: PAPER_FIELDS });
    expect(statements).toContain("SET d0.authors = null, d0.keywords = null");
    expect(statements).toContain("SET d1.venue = null");
    // Every SET comes before every RELATE, so the relation anchors at the
    // cleared revision (BO_0118_001).
    const lastSet = Math.max(...statements.map((line, at) => (line.startsWith("SET") ? at : -1)));
    const firstRelate = statements.findIndex((line) => line.startsWith("RELATE"));
    expect(lastSet).toBeLessThan(firstRelate);
    expect(statements).toContain("RELATE d0ref -[h0:hasBlockRole]-> pref");
    expect(statements).toContain("RELATE v1ref -[o1:fieldsOf]-> d1ref");
    expect(parameters).toMatchObject({ v0_id: "values-1", v0_role: "paper-id", v0_values: { authors: "Ada", affiliations: "", keywords: "x" }, d1ref: "node:d2" });
    expect(PAPER_FIELDS.map((field) => [field.key, field.type])).toEqual([
      ["authors", "longText"],
      ["affiliations", "longText"],
      ["keywords", "text"],
    ]);
  });

  it("Given kept manuscripts and no front matter, Then they are retired and no Paper is made", () => {
    expect(formatsStatement(["m1"], [], 3, mint).statement).toBe("RETIRE m0");
  });

  it("Given nothing to move, Then an empty statement", () => {
    expect(formatsStatement([], [], 3, mint)).toEqual({ statement: "", parameters: {} });
  });
});
