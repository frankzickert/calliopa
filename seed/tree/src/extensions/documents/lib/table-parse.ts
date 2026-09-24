import { checkCell, PREVIEW_ROWS, type ColumnType, type TableColumn, type TableRow } from "./table";

/**
 * A table from text (`BO_0287_010`): a `.csv` or `.tsv` file, or a grid pasted
 * from a spreadsheet. Pure, so it is proven over fixtures and runs the same in
 * the browser, where the file is parsed into its preview before the write.
 *
 * The first line is the header. Each column's type is inferred from its
 * values — every non-empty cell a number makes a number column, an ISO 8601
 * date a date column, `true`/`false` a boolean column, else text — and every
 * cell is written in its canonical spelling. A file past the bound is cut to
 * its first hundred rows with the total as `rowCount`. Import takes `.csv`
 * and `.tsv` only; a spreadsheet arrives by paste or by export. User
 * decisions, 2026-09-23.
 */

export interface ParsedTable {
  readonly columns: TableColumn[];
  /** The rows the block holds: every row, or the first hundred of more. */
  readonly rows: TableRow[];
  /** Every row the text held, the header excluded. */
  readonly rowCount: number;
  /** Whether the text held more rows than the block holds. */
  readonly cut: boolean;
}

/** What separates the cells: a comma, a semicolon — which a German spreadsheet
 * writes a `.csv` with — or a tab. */
export type Delimiter = "," | ";" | "\t";

/** The delimiter a file's name says, or null for a file import does not take. */
export function delimiterFor(filename: string): Delimiter | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return ",";
  if (lower.endsWith(".tsv") || lower.endsWith(".tab")) return "\t";
  return null;
}

/**
 * The delimiter the header line holds most, outside quotes, or the one the
 * file's name says when the header holds none of them more often. A `.csv`
 * from a German spreadsheet is separated by semicolons and named `.csv` all
 * the same, and a file that says one thing by its name and another by its
 * first line is read as its first line says (found in the BO_0287 walk: a
 * semicolon file landed in one column).
 */
export function sniffDelimiter(text: string, preferred: Delimiter): Delimiter {
  const header = text.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0] ?? "";
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of header) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "," || char === ";" || char === "\t")) counts[char]++;
  }
  let best = preferred;
  for (const candidate of [",", ";", "\t"] as const) {
    if (counts[candidate] > counts[best]) best = candidate;
  }
  return best;
}

/** Whether pasted text is a grid: at least one tab and one line break, which
 * is what a spreadsheet's clipboard carries. A single cell copied into a
 * sentence has neither. */
export const looksLikeGrid = (text: string): boolean => text.includes("\t") && /\r?\n/u.test(text.trim());

/**
 * Splits delimited text into records, RFC 4180 style for a comma: a quoted
 * field may hold the delimiter, a line break and a doubled quote. A tab file
 * is split the same way, so a quoted tab field is read as one.
 */
export function splitRecords(text: string, delimiter: Delimiter): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let quotedField = false;
  const source = text.replace(/^﻿/u, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "" && !quotedField) {
      quoted = true;
      quotedField = true;
      continue;
    }
    if (char === delimiter) {
      record.push(field);
      field = "";
      quotedField = false;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      quotedField = false;
      continue;
    }
    field += char;
  }
  if (field !== "" || quotedField || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // A trailing empty line is not a record.
  return records.filter((row, index) => !(index === records.length - 1 && row.length === 1 && row[0] === ""));
}

const NUMBER_LIKE = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/u;

/** A cell's number in canonical form, or null when it is not a number as
 * a spreadsheet writes one: `1,5` and `+3` and `007` are read; `1.5 million`
 * is not. */
export function canonicalNumber(cell: string): string | null {
  const trimmed = cell.trim();
  if (!NUMBER_LIKE.test(trimmed)) return null;
  const normalized = trimmed.replace(",", ".").replace(/^\+/u, "");
  const negative = normalized.startsWith("-");
  const digits = negative ? normalized.slice(1) : normalized;
  const [wholeRaw = "", fractionRaw] = digits.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "") || "0";
  const fraction = fractionRaw === undefined ? "" : fractionRaw.replace(/0+$/u, "");
  const value = fraction === "" ? whole : `${whole}.${fraction}`;
  return negative && value !== "0" ? `-${value}` : value;
}

/** A cell's date in ISO 8601, or null: the ISO forms are read as they are,
 * and `23.09.2026` and `09/23/2026` are not guessed at, since either could be
 * the other. */
export function canonicalDate(cell: string): string | null {
  const trimmed = cell.trim();
  return checkCell(trimmed, "date") === null ? trimmed : null;
}

/** A cell's boolean in canonical form, or null. */
export function canonicalBoolean(cell: string): string | null {
  const lower = cell.trim().toLowerCase();
  if (lower === "true" || lower === "yes") return "true";
  if (lower === "false" || lower === "no") return "false";
  return null;
}

/**
 * The type a column's values infer, and the values in that type's canonical
 * spelling. A column whose non-empty cells all read as numbers is a number
 * column, then dates, then booleans; anything else is text, kept as it was.
 * A column of nothing but empty cells is text.
 */
export function inferColumn(cells: readonly string[]): { readonly type: ColumnType; readonly cells: string[] } {
  const present = cells.filter((cell) => cell.trim() !== "");
  const readers: readonly { readonly type: ColumnType; readonly read: (cell: string) => string | null }[] = [
    { type: "number", read: canonicalNumber },
    { type: "date", read: canonicalDate },
    { type: "boolean", read: canonicalBoolean },
  ];
  if (present.length > 0) {
    for (const reader of readers) {
      if (present.every((cell) => reader.read(cell) !== null)) {
        return { type: reader.type, cells: cells.map((cell) => (cell.trim() === "" ? "" : reader.read(cell)!)) };
      }
    }
  }
  return { type: "text", cells: cells.map((cell) => cell.trim()) };
}

/**
 * The table the text holds. The header names the columns — an empty name is
 * given one from its place — and rows shorter than the header are padded,
 * longer ones cut, so every row is the header's width.
 */
export function parseTable(text: string, delimiter: Delimiter): ParsedTable | { readonly failure: string } {
  const records = splitRecords(text, delimiter);
  const header = records[0];
  if (header === undefined || header.every((cell) => cell.trim() === "")) {
    return { failure: "The first line names the columns, and there is none." };
  }
  const width = header.length;
  const body = records.slice(1).map((record) => {
    const row = record.slice(0, width);
    while (row.length < width) row.push("");
    return row;
  });
  const columns: TableColumn[] = [];
  const typed: string[][] = body.map(() => []);
  for (let column = 0; column < width; column++) {
    const inferred = inferColumn(body.map((row) => row[column]!));
    const name = header[column]!.trim();
    columns.push({ name: name === "" ? `Column ${column + 1}` : name, type: inferred.type });
    inferred.cells.forEach((cell, row) => {
      typed[row]!.push(cell);
    });
  }
  const cut = typed.length > PREVIEW_ROWS;
  return {
    columns,
    rows: cut ? typed.slice(0, PREVIEW_ROWS) : typed,
    rowCount: typed.length,
    cut,
  };
}

/** A pasted grid: tab-separated lines, as a spreadsheet's clipboard carries them. */
export const parsePastedGrid = (text: string): ParsedTable | { readonly failure: string } =>
  parseTable(text.replace(/\r\n?/gu, "\n").replace(/\n+$/u, ""), "\t");
