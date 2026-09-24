/**
 * A table block's shape (`BO_0287`): typed columns and rows of cells, one
 * block revised whole.
 *
 * These are the primitives the editor, the parser and the server share, so a
 * cell is judged the same way in the browser before it is sent and at the
 * boundary before it is written — as `lib/runs.ts` is for a text block. The
 * kernel's document tools carry the same rules for a run's proposal
 * (`calliopa-bootstrap`'s `internal/kernel/agenttools/tables.go`).
 */

/** The four types a column may declare. User decision, 2026-09-23. */
export const COLUMN_TYPES = ["text", "number", "date", "boolean"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const isColumnType = (value: unknown): value is ColumnType =>
  typeof value === "string" && (COLUMN_TYPES as readonly string[]).includes(value);

export interface TableColumn {
  readonly name: string;
  readonly type: ColumnType;
}

/** A row is one cell per column; a cell is a string in its column's
 * canonical spelling or empty. */
export type TableRow = readonly string[];

/** The rows a block holds inline behind a file: its first hundred. User
 * decision, 2026-09-23. */
export const PREVIEW_ROWS = 100;

/** A number in canonical form: an optional sign, no leading zero, an
 * optional fraction. */
const CANONICAL_NUMBER = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/u;
/** An ISO 8601 calendar date, or a date-time in RFC 3339 form. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/u;

const isCalendarDate = (cell: string): boolean => {
  const date = new Date(`${cell.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === cell.slice(0, 10);
};

/**
 * Whether a cell fits its column: empty always does; otherwise the spelling
 * is the type's canonical one. The failure names what a cell of the type
 * looks like, so the person or the run can correct it.
 */
export function checkCell(cell: string, type: ColumnType): string | null {
  if (cell === "") return null;
  switch (type) {
    case "text":
      return null;
    case "number":
      return CANONICAL_NUMBER.test(cell) ? null : `${JSON.stringify(cell)} is not a number in canonical form (a decimal such as 12 or -3.5)`;
    case "date":
      return (ISO_DATE.test(cell) || ISO_DATE_TIME.test(cell)) && isCalendarDate(cell)
        ? null
        : `${JSON.stringify(cell)} is not an ISO 8601 date (2026-09-23 or 2026-09-23T10:00:00Z)`;
    case "boolean":
      return cell === "true" || cell === "false" ? null : `${JSON.stringify(cell)} is not a boolean (true or false)`;
  }
}

/** A cell's place, named in a refusal. */
export interface CellPlace {
  readonly row: number;
  readonly column: number;
}

/**
 * Whether columns and rows make a table: every column named and typed, every
 * row the columns' width, every cell in its column's spelling. The failure
 * names the cell and its column, and `at` says where it is, so an editor can
 * ring it.
 */
export function checkTable(
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
): { readonly failure: string; readonly at?: CellPlace } | null {
  if (columns.length === 0) return { failure: "A table names its columns, each a name and a type." };
  for (const [index, column] of columns.entries()) {
    if (column.name.trim() === "") return { failure: `Column ${index + 1} names itself.` };
    if (!isColumnType(column.type)) {
      return { failure: `Column ${JSON.stringify(column.name)} takes a type of ${COLUMN_TYPES.join(", ")}, not ${JSON.stringify(String(column.type))}.` };
    }
  }
  for (const [rowIndex, row] of rows.entries()) {
    if (row.length !== columns.length) {
      return { failure: `Row ${rowIndex + 1} has ${row.length} cells where the table has ${columns.length} columns.`, at: { row: rowIndex, column: 0 } };
    }
    for (const [columnIndex, cell] of row.entries()) {
      const column = columns[columnIndex]!;
      const misfit = checkCell(cell, column.type);
      if (misfit !== null) {
        return { failure: `Row ${rowIndex + 1}, column ${JSON.stringify(column.name)}: ${misfit}.`, at: { row: rowIndex, column: columnIndex } };
      }
    }
  }
  return null;
}

/** Reads columns as a request or a stored revision carries them, or says
 * what is wrong. A column outside the four is kept as it is, for `checkTable`
 * to name. */
export function readColumns(value: unknown): { readonly columns: TableColumn[] } | { readonly failure: string } {
  if (!Array.isArray(value)) return { failure: "A table's columns are a list, each a name and a type." };
  const columns: TableColumn[] = [];
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { failure: `Column ${index + 1} is an object naming itself and its type.` };
    }
    const column = raw as Record<string, unknown>;
    const name = column["name"];
    const type = column["type"];
    if (typeof name !== "string") return { failure: `Column ${index + 1} names itself.` };
    columns.push({ name, type: (typeof type === "string" ? type : "") as ColumnType });
  }
  return { columns };
}

/** Reads rows as a request or a stored revision carries them, or says what
 * is wrong. Width and spelling are `checkTable`'s. */
export function readRows(value: unknown): { readonly rows: TableRow[] } | { readonly failure: string } {
  if (value === undefined) return { rows: [] };
  if (!Array.isArray(value)) return { failure: "A table's rows are a list of rows, each one cell per column." };
  const rows: TableRow[] = [];
  for (const [index, raw] of value.entries()) {
    if (!Array.isArray(raw) || !raw.every((cell) => typeof cell === "string")) {
      return { failure: `Row ${index + 1} is a list of cells, each a string.` };
    }
    rows.push(raw as string[]);
  }
  return { rows };
}

/** A fresh table as the editor adds one: two text columns and one empty row. */
export const emptyTable = (): { readonly columns: TableColumn[]; readonly rows: TableRow[] } => ({
  columns: [
    { name: "Column 1", type: "text" },
    { name: "Column 2", type: "text" },
  ],
  rows: [["", ""]],
});
