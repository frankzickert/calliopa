import { describe, expect, it } from "vitest";

import { blockContentFor } from "./documents";
import { validateTable } from "./vocabulary";
import { toBlock } from "./assemble";

/**
 * A table written into a document and read back (`BO_0287_008`): what the
 * block stores, what the validator refuses before a write, and what the
 * assembler answers — the cells, the caption, and the file behind the block
 * with its row count.
 */
const columns = [
  { name: "City", type: "text" as const },
  { name: "Population", type: "number" as const },
];
const reference = { _kind: "blob", hash: "sha256:" + "a".repeat(64), mediaType: "text/csv", size: 40 } as const;

describe("what a table block stores", () => {
  it("writes its columns and rows, and leaves an empty caption out", () => {
    expect(blockContentFor({ kind: "table", columns, rows: [["Berlin", "3755000"]], caption: " " }, "a0")).toEqual({
      order: "a0",
      columns,
      rows: [["Berlin", "3755000"]],
    });
  });

  it("writes the file behind it with its count, and the count only with the file", () => {
    const source = { extension: "documents", file: "cities.csv" };
    expect(blockContentFor({ kind: "table", columns, rows: [], caption: "Cities", reference, rowCount: 12400, source }, "b0")).toEqual({
      order: "b0",
      columns,
      rows: [],
      caption: "Cities",
      reference,
      rowCount: 12400,
      source,
    });
    expect(blockContentFor({ kind: "table", columns, rows: [], rowCount: 12400 }, "b0")).toEqual({ order: "b0", columns, rows: [] });
  });
});

describe("validating a table", () => {
  const table = (content: Record<string, unknown>) => validateTable({ order: "i", columns, rows: [], ...content });

  it("takes columns, rows in their spelling, a caption and a file with its count", () => {
    expect(table({ rows: [["Berlin", "3755000"], ["Hamburg", ""]], caption: "Cities", reference, rowCount: 2 })).toBeNull();
  });

  it("refuses a cell outside its column, naming the cell and the column", () => {
    expect(table({ rows: [["Berlin", "many"]] })).toBe('Row 1, column "Population": "many" is not a number in canonical form (a decimal such as 12 or -3.5).');
    expect(table({ rows: [["Berlin"]] })).toBe("Row 1 has 1 cells where the table has 2 columns.");
  });

  it("refuses a table without columns, a fifth type, runs, a count without a file, and a reference that is not one", () => {
    expect(table({ columns: [] })).toMatch(/names its columns/u);
    expect(table({ columns: [{ name: "X", type: "money" }] })).toMatch(/not "money"/u);
    expect(table({ runs: [] })).toBe("A table carries columns and rows, not runs.");
    expect(table({ rowCount: 3 })).toBe("A table's rowCount goes with the reference of the file behind it.");
    expect(table({ reference: { hash: "x" } })).toBe("A table's reference is the core's blob reference.");
    expect(table({ order: "" })).toMatch(/order key/u);
  });
});

describe("reading a table", () => {
  const node = (content: Record<string, unknown>) => ({
    id: "node:blk-t",
    revision: { id: "rev-1", status: "established", content: { _type: "table", id: "blk-t", order: "a0", ...content } },
  });

  it("answers the cells, the caption, and the file behind the block with its count", () => {
    const block = toBlock(node({ columns, rows: [["Berlin", "3755000"]], caption: "Cities", reference, rowCount: 12400, source: { extension: "documents" } }) as never, "c-1");
    expect(block).toMatchObject({
      kind: "table",
      blockId: "blk-t",
      columns,
      rows: [["Berlin", "3755000"]],
      caption: "Cities",
      file: { objectId: "a".repeat(64), rowCount: 12400 },
      source: { extension: "documents" },
    });
  });

  it("answers a table held whole with no file, and a reference that is not one as no file", () => {
    expect(toBlock(node({ columns, rows: [] }) as never, "c-1")).not.toHaveProperty("file");
    expect(toBlock(node({ columns, rows: [], reference: { hash: "nope" } }) as never, "c-1")).not.toHaveProperty("file");
  });

  it("reports a stored table this build cannot read as unsupported rather than dropping it", () => {
    const block = toBlock(node({ columns: "nope" }) as never, "c-1");
    expect(block.kind).toBe("unsupported");
  });
});
