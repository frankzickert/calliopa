import { describe, expect, it } from "vitest";

import type { ReadNode, ReadResult } from "~/server/ccgw/client";
import { nodeRef } from "~/server/ccgw/nodes";
import { parseDocumentCommand } from "./api";
import { assembleDocument } from "./assemble";
import { validateImage, validateOutput, validateTable } from "./vocabulary";

/**
 * Figures and tables numbered on request (`BO_0295_006`–`BO_0295_008`): a
 * picture's caption, the ask of a picture, a table and an accepted output,
 * the numbers the document's own order gives them — figures and tables
 * counted apart, stored nowhere — and the reference runs that follow them.
 */
const DOCUMENT = "00000000-0000-4000-8000-000000000001";
let counter = 0;
const identity = (): string => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

const node = (id: string, semanticType: string, content: Record<string, unknown>): ReadNode => ({
  id: nodeRef(id),
  revision: {
    id: `rev:${identity()}`,
    content: { _type: semanticType, id, ...content },
    status: "established",
    dataRevision: 1,
    createdAt: 1,
    createdBy: "frank",
  },
});

const graphOf = (blocks: readonly { id: string; type: string; content: Record<string, unknown> }[]): ReadResult => ({
  roots: [nodeRef(DOCUMENT)],
  nodes: [node(DOCUMENT, "document", { title: "Figures" }), ...blocks.map((block) => node(block.id, block.type, block.content))],
  relations: blocks.map((block) => ({
    id: `rel:${identity()}`,
    type: "CONTAINS",
    fromNodeId: nodeRef(DOCUMENT),
    to: { kind: "node" as const, nodeId: nodeRef(block.id) },
    dataRevision: 1,
    createdAt: 1,
    validity: { status: "active" },
  })),
  resolvedDataRevision: 1,
});

const image = (id: string, order: string, content: Record<string, unknown> = {}) => ({ id, type: "image", content: { order, ...content } });
const table = (id: string, order: string, content: Record<string, unknown> = {}) => ({
  id,
  type: "table",
  content: { order, columns: [{ name: "x", type: "number" }], rows: [["1"]], ...content },
});
const output = (id: string, order: string, content: Record<string, unknown> = {}) => ({
  id,
  type: "output",
  content: { order, items: [], outcome: "ok", execution: "ex", of: "code-1", ...content },
});
const sentence = (id: string, order: string, runs: readonly Record<string, unknown>[]) => ({ id, type: "text", content: { order, runs } });

describe("the numbers a document gives its figures and tables", () => {
  const read = assembleDocument(
    graphOf([
      sentence("p", "a0", [{ text: "See " }, { text: "", figureRef: "i3" }, { text: " and " }, { text: "", tableRef: "t1" }, { text: "", figureRef: "gone" }]),
      image("i1", "b0", { numbered: true, caption: "The apparatus" }),
      image("i2", "c0"),
      output("o1", "d0", { numbered: true, caption: "What the fit gave" }),
      image("i3", "e0", { numbered: true }),
      table("t1", "f0", { numbered: true, caption: "Readings" }),
      table("t2", "g0"),
    ]),
    DOCUMENT,
  );

  it("numbers the numbered pictures and outputs as one sequence of figures in reading order", () => {
    const numbers = Object.fromEntries((read?.blocks ?? []).map((block) => [block.blockId, "number" in block ? block.number : undefined]));
    expect(numbers).toMatchObject({ i1: 1, i2: undefined, o1: 2, i3: 3 });
    expect(read?.figureNumbers).toEqual({ i1: 1, o1: 2, i3: 3 });
  });

  it("counts tables apart from figures, and numbers only the ones that asked", () => {
    expect(read?.tableNumbers).toEqual({ t1: 1 });
  });

  it("reads a picture's and an output's caption, and numbers an uncaptioned figure all the same", () => {
    const byId = new Map((read?.blocks ?? []).map((block) => [block.blockId, block]));
    expect(byId.get("i1")).toMatchObject({ kind: "image", caption: "The apparatus", numbered: true, number: 1 });
    expect(byId.get("o1")).toMatchObject({ kind: "output", caption: "What the fit gave", number: 2 });
    expect(byId.get("i3")).not.toHaveProperty("caption");
    expect(byId.get("i3")).toMatchObject({ number: 3 });
  });

  it("keeps the references in the sentence, their numbers answered by the document's maps", () => {
    const runs = read?.blocks[0]?.kind === "text" ? read.blocks[0].runs : [];
    expect(runs.filter((run) => run.figureRef !== undefined || run.tableRef !== undefined)).toEqual([
      { text: "", figureRef: "i3" },
      { text: "", tableRef: "t1" },
      { text: "", figureRef: "gone" },
    ]);
    expect(read?.figureNumbers?.["gone"]).toBeUndefined();
  });

  it("renumbers the figures below one inserted above them, with nothing written to them", () => {
    const again = assembleDocument(
      graphOf([image("new", "a5", { numbered: true }), image("i1", "b0", { numbered: true }), image("i3", "e0", { numbered: true })]),
      DOCUMENT,
    );
    expect(again?.figureNumbers).toEqual({ new: 1, i1: 2, i3: 3 });
  });
});

describe("what a picture, a table and an output may carry", () => {
  it("takes a caption and an ask on a picture, and refuses a stored number or a malformed ask", () => {
    expect(validateImage({ order: "a0", caption: "C", numbered: true })).toBeNull();
    expect(validateImage({ order: "a0", numbered: "yes" })).toBe("A picture's numbered is true or false.");
    expect(validateImage({ order: "a0", caption: 3 })).toBe("A picture's caption is words.");
    expect(validateImage({ order: "a0", number: 2 })).toBe("A picture's number is the document's order and is never stored.");
    expect(validateImage({ order: "a0", runs: [] })).toBe("A picture carries a caption, not runs.");
  });

  it("takes an ask on a table and on an output, and refuses a stored number on either", () => {
    expect(validateTable({ order: "a0", columns: [{ name: "x", type: "text" }], rows: [], numbered: true })).toBeNull();
    expect(validateTable({ order: "a0", columns: [{ name: "x", type: "text" }], rows: [], number: 1 })).toBe(
      "A table's number is the document's order and is never stored.",
    );
    expect(validateOutput({ order: "a0", items: [], outcome: "ok", of: "c", caption: "Fit", numbered: true })).toBeNull();
    expect(validateOutput({ order: "a0", items: [], outcome: "ok", of: "c", number: 1 })).toBe(
      "An output's number is the document's order and is never stored.",
    );
  });
});

describe("the command that numbers a figure or a table", () => {
  it("takes a caption and an ask, and either alone", () => {
    expect(parseDocumentCommand({ command: "setFigure", blockId: "b", baseRevisionId: "r", caption: "C", numbered: true })).toEqual({
      command: { command: "setFigure", blockId: "b", baseRevisionId: "r", caption: "C", numbered: true },
    });
    expect(parseDocumentCommand({ command: "setFigure", blockId: "b", baseRevisionId: "r", numbered: false })).toEqual({
      command: { command: "setFigure", blockId: "b", baseRevisionId: "r", numbered: false },
    });
  });

  it("refuses a command naming no block, a malformed ask and a number written back", () => {
    expect(parseDocumentCommand({ command: "setFigure", numbered: true })).toHaveProperty("failure");
    expect(parseDocumentCommand({ command: "setFigure", blockId: "b", baseRevisionId: "r", numbered: 1 })).toEqual({
      failure: "A figure's or a table's numbered is true or false.",
    });
    expect(parseDocumentCommand({ command: "setFigure", blockId: "b", baseRevisionId: "r", number: 2 })).toEqual({
      failure: "A number is the document's order and is never written.",
    });
  });
});
