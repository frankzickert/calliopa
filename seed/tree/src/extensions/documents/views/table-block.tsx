import { $, component$, useStore, useTask$, type QRL } from "@builder.io/qwik";

import { checkTable, COLUMN_TYPES, type CellPlace, type ColumnType, type TableColumn } from "../lib/table";
import type { TableBlockView } from "../server/assemble";
import { numberLabel } from "../lib/figure-label";

/**
 * A table in a document (`BO_0287_011`): the header row from the block's
 * columns, each header a name and a type the reader can change, a cell per
 * cell edited in place, a control to add and remove a row and a column, and
 * the caption below. It carries no text editor and no runs; the grip, the
 * drag and the chip come with the row as they do for a picture.
 *
 * An edit lands as one `reviseTable` on the block's base revision — the whole
 * table, since a table is one block revised whole — and a cell that does not
 * fit its column is refused here with the cell named and ringed, before
 * anything is sent. A table with a file behind it says *first N of M rows*
 * under its rows and asks the blob route for nothing: the preview is the
 * block's own.
 */

/** What a revise answers: nothing, or the refusal in words. */
export type ReviseTable = QRL<
  (
    blockId: string,
    baseRevisionId: string,
    columns: readonly TableColumn[],
    rows: readonly (readonly string[])[],
    caption: string | undefined,
  ) => Promise<string | null>
>;

interface Draft {
  columns: TableColumn[];
  rows: string[][];
  caption: string;
  /** The revision the draft was taken from, so a read-back resets it. */
  revisionId: string;
  failure: string | null;
  at: CellPlace | null;
  sending: boolean;
}

const draftOf = (block: TableBlockView): Draft => ({
  columns: block.columns.map((column) => ({ ...column })),
  rows: block.rows.map((row) => [...row]),
  caption: block.caption ?? "",
  revisionId: block.revisionId,
  failure: null,
  at: null,
  sending: false,
});

const TYPE_LABEL: Readonly<Record<ColumnType, string>> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/no",
};

export const TableBlock = component$<{
  block: TableBlockView;
  /** Its number when the document numbers it, from the read's map rather
   * than the block, so a table numbered above it relabels this one. BO_0295_014 */
  number?: number | undefined;
  /** Whether the reader may edit it: a proposed table is drawn as it is. */
  editable: boolean;
  revise$?: ReviseTable;
}>(({ block, number, editable, revise$ }) => {
  const draft = useStore<Draft>(draftOf(block));

  // A new revision read back is the table now; a draft of an older one is
  // not kept over it.
  useTask$(({ track }) => {
    const revisionId = track(() => block.revisionId);
    if (revisionId !== draft.revisionId) Object.assign(draft, draftOf(block));
  });

  /** Sends the draft as the whole table, or names what does not fit. */
  const commit$ = $(async () => {
    const misfit = checkTable(draft.columns, draft.rows);
    if (misfit !== null) {
      draft.failure = misfit.failure;
      draft.at = misfit.at ?? null;
      return;
    }
    draft.failure = null;
    draft.at = null;
    if (revise$ === undefined) return;
    draft.sending = true;
    const refused = await revise$(
      block.blockId,
      block.revisionId,
      draft.columns.map((column) => ({ ...column })),
      draft.rows.map((row) => [...row]),
      draft.caption.trim() === "" ? undefined : draft.caption.trim(),
    );
    draft.sending = false;
    draft.failure = refused;
  });

  const setCell$ = $(async (row: number, column: number, value: string) => {
    const held = draft.rows[row];
    if (held === undefined || held[column] === value) return;
    held[column] = value;
    await commit$();
  });

  const setColumn$ = $(async (index: number, patch: Partial<TableColumn>) => {
    const held = draft.columns[index];
    if (held === undefined) return;
    if (patch.name !== undefined && patch.name === held.name) return;
    if (patch.type !== undefined && patch.type === held.type) return;
    draft.columns[index] = { ...held, ...patch };
    await commit$();
  });

  const addRow$ = $(async () => {
    draft.rows.push(draft.columns.map(() => ""));
    await commit$();
  });

  const removeRow$ = $(async (row: number) => {
    draft.rows.splice(row, 1);
    await commit$();
  });

  const addColumn$ = $(async () => {
    draft.columns.push({ name: `Column ${draft.columns.length + 1}`, type: "text" });
    for (const row of draft.rows) row.push("");
    await commit$();
  });

  const removeColumn$ = $(async (column: number) => {
    if (draft.columns.length === 1) return;
    draft.columns.splice(column, 1);
    for (const row of draft.rows) row.splice(column, 1);
    await commit$();
  });

  const setCaption$ = $(async (value: string) => {
    if (value === draft.caption) return;
    draft.caption = value;
    await commit$();
  });

  const ringed = (row: number, column: number): boolean =>
    draft.at !== null && draft.at.row === row && draft.at.column === column;

  return (
    <figure
      class="table-block"
      data-table-block={block.blockId}
      data-table-editable={editable && revise$ !== undefined ? "true" : undefined}
      data-table-sending={draft.sending ? "true" : undefined}
    >
      <div class="table-block__scroll">
        <table class="table-block__table">
          <thead>
            <tr>
              {draft.columns.map((column, index) => (
                <th key={index} scope="col" class="table-block__header" data-table-column={index} data-table-column-type={column.type}>
                  {editable && revise$ !== undefined ? (
                    <span class="table-block__header-controls">
                      <input
                        class="table-block__name"
                        data-table-name={index}
                        aria-label={`Name of column ${index + 1}`}
                        value={column.name}
                        onChange$={(_: Event, element: HTMLInputElement) => setColumn$(index, { name: element.value })}
                      />
                      <select
                        class="table-block__type"
                        data-table-type={index}
                        aria-label={`Type of column ${column.name}`}
                        value={column.type}
                        onChange$={(_: Event, element: HTMLSelectElement) => setColumn$(index, { type: element.value as ColumnType })}
                      >
                        {COLUMN_TYPES.map((type) => (
                          <option key={type} value={type} selected={type === column.type}>
                            {TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        class="table-block__remove"
                        data-table-remove-column={index}
                        aria-label={`Remove column ${column.name}`}
                        disabled={draft.columns.length === 1}
                        onClick$={() => removeColumn$(index)}
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span class="table-block__name" data-table-name={index}>
                      {column.name}
                      <span class="table-block__type-word"> · {TYPE_LABEL[column.type]}</span>
                    </span>
                  )}
                </th>
              ))}
              {editable && revise$ !== undefined && (
                <th scope="col" class="table-block__header table-block__header--add">
                  <button type="button" class="table-block__add" data-table-add-column aria-label="Add a column" onClick$={addColumn$}>
                    +
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, rowIndex) => (
              <tr key={rowIndex} data-table-row={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td
                    key={columnIndex}
                    class="table-block__cell"
                    data-table-cell={`${rowIndex}:${columnIndex}`}
                    data-table-cell-type={draft.columns[columnIndex]?.type}
                    data-table-misfit={ringed(rowIndex, columnIndex) ? "true" : undefined}
                  >
                    {editable && revise$ !== undefined ? (
                      <input
                        class="table-block__input"
                        data-table-input={`${rowIndex}:${columnIndex}`}
                        aria-label={`Row ${rowIndex + 1}, ${draft.columns[columnIndex]?.name ?? ""}`}
                        aria-invalid={ringed(rowIndex, columnIndex) ? "true" : undefined}
                        value={cell}
                        onChange$={(_: Event, element: HTMLInputElement) => setCell$(rowIndex, columnIndex, element.value)}
                      />
                    ) : (
                      cell
                    )}
                  </td>
                ))}
                {editable && revise$ !== undefined && (
                  <td class="table-block__cell table-block__cell--remove">
                    <button
                      type="button"
                      class="table-block__remove"
                      data-table-remove-row={rowIndex}
                      aria-label={`Remove row ${rowIndex + 1}`}
                      onClick$={() => removeRow$(rowIndex)}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && revise$ !== undefined && (
        <div class="table-block__controls">
          <button type="button" class="table-block__add" data-table-add-row onClick$={addRow$}>
            Add row
          </button>
        </div>
      )}
      {block.file !== undefined && (
        <p class="table-block__count" data-table-count>
          first {draft.rows.length} of {block.file.rowCount} rows
        </p>
      )}
      {draft.failure !== null && (
        <p class="table-block__failure" data-table-failure role="alert">
          {draft.failure}
        </p>
      )}
      {editable && revise$ !== undefined ? (
        <figcaption class="table-block__caption">
          {number !== undefined && (
            <span class="figure-caption__label" data-table-number={number}>
              {numberLabel("table", number)}
            </span>
          )}
          <input
            class="table-block__caption-input"
            data-table-caption
            aria-label="Caption"
            placeholder="Caption"
            value={draft.caption}
            onChange$={(_: Event, element: HTMLInputElement) => setCaption$(element.value)}
          />
        </figcaption>
      ) : (
        (draft.caption !== "" || number !== undefined) && (
          <figcaption class="table-block__caption" data-table-caption>
            {number !== undefined && (
              <span class="figure-caption__label" data-table-number={number}>
                {numberLabel("table", number)}
              </span>
            )}
            {draft.caption}
          </figcaption>
        )
      )}
    </figure>
  );
});
