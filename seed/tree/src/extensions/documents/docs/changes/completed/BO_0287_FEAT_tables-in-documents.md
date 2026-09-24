# Tables In Documents

Status: completed

A document can hold a table: a block of rows and columns that a person edits cell by cell, that an
agent reads as cells and proposes as one unit, and that a large or imported data file can stand
behind as bytes. The block type and its presentation are `documents`'; importing, charting and any
analysis are a later extension's, so a table stays a table when whatever made it is switched off.
Requested by the user on 2026-09-23, asked as *how would I best integrate tabular data into
Calliopa*. This document shapes the work; it authorizes no implementation and transfers no system
tasks.

## What Is Asked

- Tabular data in a document, at rest and under editing, in the shape the rest of the document
  already has: a block among blocks, with its grip, its place, its standing and its proposals.
- The agent's side of it: a run reads a table's cells and proposes a table, or a change to one, as
  the one unit it is.
- Data that is too large to author by hand, or that arrives as a file, kept without pulling every
  byte into every read.

## What The System Already Holds

Nothing here is new work. These are the parts this change rests on.

- A block type is an extension's declared vocabulary, an `ext.blocktype` member enforced by CCGW's
  Validation, and adding one migrates nothing: a build that predates it draws the block as
  unsupported content and never drops it
  ([Schema Evolution](../../graph/tree/src/extensions/documents/docs/system/documents/schema-evolution.md)).
  That document already names a table block among the types that need their own content shape and
  enter in the smallest slice the editor needs.
- The precedent is the picture (`BO_0273`, [Block Document Model](../../graph/tree/src/extensions/documents/docs/system/documents/block-document-model.md#pictures-and-moving-pictures)):
  `image` and `video` are `documents`' types, staged through `kernel commit --members`, each
  requiring `id` and `order`, and `document` permits them as children beside `text` and `divider`
  as a widening. `NewMediaBlock` joins `NewBlock` for the write, `BlockRow` draws them where a
  divider is with no text editor, and `source` is one object the model stores and never interprets,
  keyed by the extension that wrote it.
* The block types belong to `documents`, not to the extension that makes their content. A block
  type owned by a maker becomes unsupported content in every document the moment its owner
  switches the maker off. User decision, 2026-09-21, under `BO_0273`.
- Bytes are solved. A blob is content-addressed behind CCGW, referenced from revision content by a
  `_kind: "blob"` object at a top-level property, permanent once referenced, uploaded from the app
  origin immediately before the write, capped by `BLOB_MAX_BYTES`; the enrichment worker never
  embeds blob bytes, so search sees the referencing node's content and nothing else
  ([Binary Block Content](../system/binary-content.md)).
- The agent already treats a table as one unit: the `structure` convention of `ui.shell.documents`
  says a fenced code block and a table each stay one block (`BO_0270`, user decision 2026-09-20).
- An extension can draw on another extension's blocks through the `below` place, which is how
  `media` draws its make control on a pending picture. `decorations` for the `document` kind are
  `calliopa-refine`'s, and at most one extension may provide them for a kind, so a later data
  extension uses places.
- The document tools of the kernel toolset name the graph's block types as an enumeration read at
  the run's pin (`internal/kernel/agenttools/documents.go`), so a declared type reaches the tool
  schema without a kernel release.

## What Is Wrong Today

- **A table is a paragraph with pipes.** The only way a table exists in a document is as a `text`
  block whose runs hold pipe characters. No one can edit a cell, add a column or sort a row, and
  the editor's every text gesture, split and merge included, cuts across it.
- **The agent's tools carry only runs.** `read_document` answers a block's `runs` and nothing else
  of its content, and an `insert` of any kind writes `runs`, empty when none are given
  (`documents.go`). A declared `table` type would reach the enumeration and still be unreadable and
  unauthorable by a run: the tool needs the content shape, and that is the kernel's half.
- **The kernel harness carries its own copy of the vocabulary.** Adding a block type to the graph
  without `internal/kernel/serve/testdata/documents-vocabulary.json` makes every behaviour test
  writing one fail validation, which `BO_0273` found. That copy is the second reason this is a
  `BO` change rather than a `DO` one.

## Decided

User decisions of 2026-09-23, taken on the questions this document first carried.

* Columns are typed from the first slice: `text`, `number`, `date` and `boolean`. A number is a
  decimal in canonical form, a date is ISO 8601, so a run and the validator agree on one spelling.
* The first slice is the whole of it: a table authored in the editor, a grid pasted from a
  spreadsheet, and a `.csv` or `.tsv` file dropped or picked, uploaded as a blob with a parsed
  preview inline.
* A column's type is inferred per column on paste and import — every cell a number makes a number
  column, else text, and so for dates and booleans — and the person may change it in the header
  afterwards; a cell that does not fit the new type is refused with the cell named.
* The inline preview behind a file is the first 100 rows, all columns. A file under the bound is
  held whole and needs no reference.
* Import takes `.csv` and `.tsv` only, parsed by `documents`' own code with no dependency. A
  spreadsheet arrives by paste or by export.
* A run's replace of a table that a file stands behind drops the reference: the cells it proposes
  are the whole table it read, and the chip says the file link goes with the acceptance.

## Scope

- A `table` block type, declared by `documents` as `image` and `video` are: requiring `id` and
  `order`, permitting `columns`, `rows`, `reference`, `caption` and `source`; `document` permits it
  as a child, a widening.
- The cells live inline: `columns` is a list of `{name, type}` and `rows` a list of rows, each a
  list of cells, one per column, every cell a string in its type's canonical spelling or empty.
  Validation of a cell against its column's type is `documents`' content validator before the
  write and the kernel tool's before the stage, since CCGW's Validation checks properties, not
  their insides. Whole-block revisions keep the block's identity across every cell edit, and a
  proposal to change a table is a replace of the one block, which is how the run tools already
  work and what the `structure` convention already says.
- Rows are not blocks. No container block type exists (`CA_0007_010` open), every cell edit would
  become a node revision, and a proposal group would carry one item per row.
- The editor draws a grid where `BlockRow` draws a divider: the header row from `columns` with
  each column's type changeable there, a cell editor per cell that refuses a value outside the
  column's type with the cell named, a way to add and remove a row and a column, and the block's
  caption. No text editor, no runs; the grip, the drag, the standing and the chip come with the row.
- Data past the bound stands behind the block as a blob: `reference` is the core's blob reference
  to the file's bytes, and the inline `columns` and `rows` are its first 100 rows, so a document
  read stays bounded and search sees the preview. The block says *first 100 of N rows* from a
  `rowCount` written at import. Absent `reference`, the inline cells are the whole table.
- Paste and import: a pasted grid from a spreadsheet becomes a table block with the inline cells;
  a dropped or picked `.csv` or `.tsv` file is uploaded as a blob and parsed into the preview,
  through the same picker, paste and drop the media family already has. The parser infers each
  column's type from its values and is `documents`' as the picture's upload is, because a file
  must become a table with nothing else installed.
- `source` records where the data came from, keyed by the writer: an import records the file name
  and time; nothing in `documents` reads it.
- The kernel's document tools gain the content shape: `read_document` answers a table's `columns`
  with their types, `rows`, `caption` and whether a file stands behind it with its row count; an
  `insert` or `replace` of kind `table` takes `columns` and `rows` and refuses, by name, a row
  whose width differs from the columns or a cell outside its column's type; a replace lands with
  no `reference`, and the chip says so.
- `ui.shell.documents`' `structure` convention names the table block as the unit a table arrives as,
  where it says a table stays whole.
- The kernel harness's vocabulary copy gains the type, in the same change as the graph member.

## What Is Not In This Change

- Formulas, sorting, filtering and cell formatting. A fifth column type, a link among them, is a
  later widening.
- `.xlsx` and every other spreadsheet file, and a sheet choice. A spreadsheet arrives by paste or
  by export to `.csv`.
- Charts, aggregation and any query a run can make over a table. A tool an agent calls to query or
  aggregate is a kernel tool like `evaluate` and `search_web`, which is fixed layer, and it waits for
  a real need.
- Reading the bytes behind `reference` from a run. A run sees the preview.
- Merged cells, nested tables and tables inside other blocks.
- A data extension of its own. It arrives when there is something to make, the way `media` did.

## Functional Questions

None open. The five this document carried were answered by the user on 2026-09-23 and stand under
Decided.

## Where The Halves Land

- The kernel's: the content shape in `read_document`, `insert` and `replace`
  (`internal/kernel/agenttools/documents.go`) and the harness vocabulary copy. Enumerated in
  `docs/system/ui-kernel.md` when this change reaches draft.
- `documents`' in the graph: the `table` member and the `document` widening, `NewTableBlock` and
  the write, the assembler, the grid in the editor, paste and import, and the `structure`
  convention's line. Enumerated in [Block Document Model](../../graph/tree/src/extensions/documents/docs/system/documents/block-document-model.md)
  and [Block Editor View](../../graph/tree/src/extensions/documents/docs/system/documents/block-editor.md).
- The change document is carried into the graph as a member of `documents`, at the status it holds
  here, no later than completion.

## Verification

- In the kernel, over a real CCGW on the memory store through the widened harness fixture: a
  `table` inserted with typed columns and rows and read back as cells with their types, a replace
  changing one cell and keeping the block's identity, a row of the wrong width and a cell outside
  its column's type each refused by name, a replace of a table with a reference landing without
  it, and a document with no table rendering exactly as today.
- In `documents`, in the render harness and the parser's unit tests: the grid drawn from a block's
  cells, a cell edit landing as a whole-block revise with the same id, a cell refused outside its
  type with the cell named, a column's type changed in the header and the misfit refused, a row and
  a column added and removed, a `.csv` and a `.tsv` parsed with each column's type inferred and a
  file past 100 rows cut to its preview with its count, a block with a reference drawn from its
  preview and asking the blob route for nothing, a pasted grid becoming a table, and a stored type
  the build does not know still drawn as unsupported content.
- On the instance: a table authored in the editor, a `.csv` past 100 rows dropped onto a document
  and saying *first 100 of N rows*, a run asked to add a column to the table proposing one replace
  and the person accepting it from the chip.

## Graph And Release Notes

- The block type and the editor half are members of `documents`, so the change closes with
  `scripts/export-graph.sh` and leaves `graph/` in the working tree.
- `documents` is `bundled` and the kernel is the fixed layer: the change writes a line under
  *Added* in `docs/release-notes/unreleased.md` before it completes.
