import { describe, expect, it } from "vitest";

import { checkCell, checkTable, PREVIEW_ROWS, readColumns, readRows } from "./table";
import {
  canonicalNumber,
  delimiterFor,
  inferColumn,
  looksLikeGrid,
  parsePastedGrid,
  parseTable,
  sniffDelimiter,
  splitRecords,
} from "./table-parse";

/**
 * The table's shape and the parser (`BO_0287_010`): a cell judged against its
 * column's type, the quoting a `.csv` carries, a column's type inferred from
 * its values, a mixed column falling back to text, a header-only file, and a
 * file past the bound cut to its preview with its count.
 */
describe("a cell against its column's type", () => {
  it("takes an empty cell in any column", () => {
    expect(checkCell("", "number")).toBeNull();
    expect(checkCell("", "date")).toBeNull();
    expect(checkCell("", "boolean")).toBeNull();
  });

  it("takes a number only in canonical form", () => {
    expect(checkCell("12", "number")).toBeNull();
    expect(checkCell("-3.5", "number")).toBeNull();
    expect(checkCell("0", "number")).toBeNull();
    expect(checkCell("007", "number")).toMatch(/not a number/u);
    expect(checkCell("1.5 million", "number")).toMatch(/not a number/u);
    expect(checkCell("1,5", "number")).toMatch(/not a number/u);
  });

  it("takes a date as ISO 8601 and nothing else", () => {
    expect(checkCell("2026-09-23", "date")).toBeNull();
    expect(checkCell("2026-09-23T10:00:00Z", "date")).toBeNull();
    expect(checkCell("2026-02-30", "date")).toMatch(/not an ISO 8601 date/u);
    expect(checkCell("23.09.2026", "date")).toMatch(/not an ISO 8601 date/u);
    expect(checkCell("12th century", "date")).toMatch(/not an ISO 8601 date/u);
  });

  it("takes a boolean as true or false", () => {
    expect(checkCell("true", "boolean")).toBeNull();
    expect(checkCell("false", "boolean")).toBeNull();
    expect(checkCell("yes", "boolean")).toMatch(/not a boolean/u);
  });

  it("names the cell and its column when a table does not fit", () => {
    const columns = [
      { name: "City", type: "text" as const },
      { name: "Population", type: "number" as const },
    ];
    expect(checkTable(columns, [["Berlin", "3755000"]])).toBeNull();
    expect(checkTable(columns, [["Berlin"]])).toEqual({
      failure: "Row 1 has 1 cells where the table has 2 columns.",
      at: { row: 0, column: 0 },
    });
    const misfit = checkTable(columns, [["Berlin", "3755000"], ["Hamburg", "many"]]);
    expect(misfit?.failure).toBe('Row 2, column "Population": "many" is not a number in canonical form (a decimal such as 12 or -3.5).');
    expect(misfit?.at).toEqual({ row: 1, column: 1 });
    expect(checkTable([], [])?.failure).toMatch(/names its columns/u);
    expect(checkTable([{ name: "X", type: "money" as never }], [])?.failure).toMatch(/takes a type of text, number, date, boolean, not "money"/u);
    expect(checkTable([{ name: " ", type: "text" }], [])?.failure).toBe("Column 1 names itself.");
  });

  it("reads columns and rows as a request carries them", () => {
    expect(readColumns([{ name: "A", type: "text" }])).toEqual({ columns: [{ name: "A", type: "text" }] });
    expect(readColumns("no")).toEqual({ failure: "A table's columns are a list, each a name and a type." });
    expect(readColumns([{ type: "text" }])).toEqual({ failure: "Column 1 names itself." });
    expect(readRows(undefined)).toEqual({ rows: [] });
    expect(readRows([["a", "b"]])).toEqual({ rows: [["a", "b"]] });
    expect(readRows([["a", 1]])).toEqual({ failure: "Row 1 is a list of cells, each a string." });
  });
});

describe("splitting delimited text", () => {
  it("reads a quoted comma, a quoted line break and a doubled quote", () => {
    const text = 'name,note\n"Berlin, DE","She said ""hi""\nand left"\nHamburg,plain\n';
    expect(splitRecords(text, ",")).toEqual([
      ["name", "note"],
      ["Berlin, DE", 'She said "hi"\nand left'],
      ["Hamburg", "plain"],
    ]);
  });

  it("reads a Windows line ending as one break and drops a byte-order mark", () => {
    expect(splitRecords("﻿a\tb\r\n1\t2\r\n", "\t")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps an empty trailing field", () => {
    expect(splitRecords("a,b\n1,\n", ",")).toEqual([["a", "b"], ["1", ""]]);
  });
});

describe("inferring a column's type", () => {
  it("makes a number column of numbers in any spelling a spreadsheet writes, and canonicalizes them", () => {
    expect(inferColumn(["3755000", "1,5", "+3", "007", "", "-0.50"])).toEqual({
      type: "number",
      cells: ["3755000", "1.5", "3", "7", "", "-0.5"],
    });
    expect(canonicalNumber("-0")).toBe("0");
  });

  it("makes a date column of ISO dates and a boolean column of yes and no", () => {
    expect(inferColumn(["2026-09-23", "", "1999-01-01"])).toEqual({ type: "date", cells: ["2026-09-23", "", "1999-01-01"] });
    expect(inferColumn(["yes", "no", "TRUE"])).toEqual({ type: "boolean", cells: ["true", "false", "true"] });
  });

  it("falls back to text for a mixed column and for an empty one", () => {
    expect(inferColumn(["12", "twelve"])).toEqual({ type: "text", cells: ["12", "twelve"] });
    expect(inferColumn(["", ""])).toEqual({ type: "text", cells: ["", ""] });
    // A date in a national spelling is not guessed at.
    expect(inferColumn(["23.09.2026"])).toEqual({ type: "text", cells: ["23.09.2026"] });
  });
});

describe("parsing a file", () => {
  it("names the columns from the header, infers each type and pads a short row", () => {
    const parsed = parseTable("City,Population,Founded,Capital\nBerlin,3755000,1237-10-28,yes\nHamburg,1892000\n", ",");
    expect(parsed).toEqual({
      columns: [
        { name: "City", type: "text" },
        { name: "Population", type: "number" },
        { name: "Founded", type: "date" },
        { name: "Capital", type: "boolean" },
      ],
      rows: [
        ["Berlin", "3755000", "1237-10-28", "true"],
        ["Hamburg", "1892000", "", ""],
      ],
      rowCount: 2,
      cut: false,
    });
  });

  it("gives an unnamed column a name from its place", () => {
    const parsed = parseTable("a,,c\n1,2,3\n", ",");
    expect("columns" in parsed && parsed.columns.map((column) => column.name)).toEqual(["a", "Column 2", "c"]);
  });

  it("refuses a file with no header", () => {
    expect(parseTable("", ",")).toEqual({ failure: "The first line names the columns, and there is none." });
    expect(parseTable(",\n", ",")).toEqual({ failure: "The first line names the columns, and there is none." });
  });

  it("holds a header-only file as a table with no rows", () => {
    expect(parseTable("a\tb\n", "\t")).toEqual({
      columns: [{ name: "a", type: "text" }, { name: "b", type: "text" }],
      rows: [],
      rowCount: 0,
      cut: false,
    });
  });

  it("cuts a file past the bound to its first hundred rows with the total", () => {
    const lines = ["n"];
    for (let index = 1; index <= PREVIEW_ROWS + 25; index++) lines.push(String(index));
    const parsed = parseTable(lines.join("\n"), ",");
    expect("rows" in parsed && parsed.rows.length).toBe(PREVIEW_ROWS);
    expect("rowCount" in parsed && parsed.rowCount).toBe(PREVIEW_ROWS + 25);
    expect("cut" in parsed && parsed.cut).toBe(true);
    expect("rows" in parsed && parsed.rows[PREVIEW_ROWS - 1]).toEqual([String(PREVIEW_ROWS)]);
  });

  it("reads the delimiter from the header line, so a semicolon file named .csv is not one column", () => {
    expect(sniffDelimiter("City;Population;Founded\nBerlin;3755000;1237-10-28\n", ",")).toBe(";");
    expect(sniffDelimiter("City,Population\nBerlin,3755000\n", ",")).toBe(",");
    expect(sniffDelimiter("City\tPopulation\nBerlin\t3755000\n", ",")).toBe("\t");
    // A comma inside quotes is a cell's, not a separator; the file's name decides a tie.
    expect(sniffDelimiter('"Berlin, DE";3755000\n', ",")).toBe(";");
    expect(sniffDelimiter("City\nBerlin\n", ",")).toBe(",");
    expect(sniffDelimiter("City\nBerlin\n", "\t")).toBe("\t");
    const parsed = parseTable("City;Population\nBerlin;3755000\nHamburg;1892000\n", ";");
    expect("columns" in parsed && parsed.columns).toEqual([{ name: "City", type: "text" }, { name: "Population", type: "number" }]);
    expect("rows" in parsed && parsed.rows).toEqual([["Berlin", "3755000"], ["Hamburg", "1892000"]]);
  });

  it("takes .csv and .tsv by name and nothing else", () => {
    expect(delimiterFor("cities.CSV")).toBe(",");
    expect(delimiterFor("cities.tsv")).toBe("\t");
    expect(delimiterFor("cities.xlsx")).toBeNull();
    expect(delimiterFor("cities")).toBeNull();
  });
});

describe("a pasted grid", () => {
  it("is tab-separated lines, and a single word is not one", () => {
    expect(looksLikeGrid("City\tPopulation\nBerlin\t3755000")).toBe(true);
    expect(looksLikeGrid("Berlin")).toBe(false);
    expect(looksLikeGrid("Berlin\t3755000")).toBe(false);
    expect(looksLikeGrid("one\ntwo")).toBe(false);
  });

  it("becomes a table with its types inferred", () => {
    const parsed = parsePastedGrid("City\tPopulation\r\nBerlin\t3755000\r\nHamburg\t1892000\r\n");
    expect(parsed).toEqual({
      columns: [{ name: "City", type: "text" }, { name: "Population", type: "number" }],
      rows: [["Berlin", "3755000"], ["Hamburg", "1892000"]],
      rowCount: 2,
      cut: false,
    });
  });
});
