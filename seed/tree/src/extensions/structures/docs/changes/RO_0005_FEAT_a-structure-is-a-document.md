# RO_0005_FEAT_a-structure-is-a-document

Status: ready

Requested: 2026-10-02, by the user: the page that creates and edits a structure must improve its
interface by reusing the document's. It shapes the work and authorizes no implementation. It uses
`calliopa-bootstrap`'s `BO_0338` names — structure, *uses*, *allows* — and is built on that
rename.

## What The User Asked

* A structure is edited as a document. The structure's name is the document's title; its
  description is the document's ordinary blocks. Requested by the user, 2026-10-02.
* *Blocks may use this structure* becomes a value set in the document's header, as a structure's
  values are set in the header of any document. Requested by the user, 2026-10-02.
* What a structure *allows* becomes a value set in the header too, picked from the structures, not
  typed. Requested by the user, 2026-10-02.
* A field becomes a block of the structure's document, and that block uses a built-in structure.
  Requested by the user, 2026-10-02.
* In sum: structure is itself a built-in structure, so a structure is defined with the same pattern
  and the same interface as any structured document. Requested by the user, 2026-10-02.

## What Stands Today

- The structure page is a form of its own (`views/role-page.tsx`): a name input, a description
  text, the switch *Blocks may take this role*, a list of fields with their own controls (name,
  type, required, options, default, move, remove) and a list of offers with a × and a choice.
  Each act posts one command to `POST …/roles/[id]`.
- A structure is a `blockRole` node, not a document: its name and description are properties, its
  fields an ordered list `fields` on the node, its offers `offers` relations. A field's `key` is
  minted once and never changes, so a rename keeps every value.
- A document's header already draws the structures it uses and their values (`documents`'
  `DO_0030`): the structures line, with its pills and `+`, and the values line under it, values
  edited in the popover a pill opens.
- The built-ins *Keyword*, *Instruction*, *Format* and *Source* are created by a migration, never
  renamed, retired or deleted, and carry release fields drawn fixed.

## Decisions

* A structure is stored as a document: every structure is a `document` node using *Structure*,
  its fields *Field* blocks, and a migration moves each `blockRole` to one, keeping every
  assignment, value and field key. The catalogue, *uses*, *allows*, the tools and every reader move
  onto documents. User decision, 2026-10-02 (`RO_0005_Q1`).
* A structure's document stands in *Structures* and among the documents, listed and found like any
  document using a structure. User decision, 2026-10-02 (`RO_0005_Q2`).
* *Allows* is one value holding several structures, picked from the structures in the value's
  typeahead: a new field type, a reference holding a list, open to any structure. User decision,
  2026-10-02 (`RO_0005_Q3`).
* *Field*'s *Default* takes the type the block's *Type* names and is drawn as that type. User
  decision, 2026-10-02 (`RO_0005_Q4`).
* A structure is written as any document: a person's writes are truth at once, a run's are
  proposals the person accepts, so a run may propose structures and their fields. This replaces
  `BO_0299_Q2`'s *no proposal* for structures. User decision, 2026-10-02 (`RO_0005_Q5`).
* A person cannot extend *Structure* or *Field* with fields of their own: they define the structure
  model; a person extends the structures they make. User decision, 2026-10-02 (`RO_0005_Q6`).
* Retiring and restoring a structure stay acts beside the header, never a value. User decision,
  2026-10-02 (`RO_0005_Q7`).
* Where a structure's description is read today, its document's blocks stand in: the first
  block's text in a pill's title, the typeahead and the suggestions, the whole text to an agent.
  User decision, 2026-10-02 (`RO_0005_Q8`).
* A structure is created by *Structures*' `+` alone: *Structure* is never offered by a document's
  `+` and its pill carries no ×, so no document becomes or stops being a structure by taking or
  clearing it. User decision, 2026-10-02 (`RO_0005_Q9`).
* A person adds a field by giving a block *Field* from its structures chip, *Field* suggested first
  on a block of a structure's document. User decision, 2026-10-02 (`RO_0005_Q10`).

## Transfer

- Transferred 2026-10-02, the day the user set it to draft. `structures`:
  [A Structure Is A Document](../system/system.md#a-structure-is-a-document), the decisions as
  fixed lines, the ids and the storage as technical decisions, and `RO_0005_001`–`RO_0005_008`.
  `documents`: `RO_0005_020`–`RO_0005_022` (the listing and the guards on a structure's document).
  `keywords` `RO_0005_030`, `instructions` `RO_0005_040`, `bibliography` `RO_0005_050`, `media`
  `RO_0005_060` and `manuscripts` `RO_0005_070` follow the new ids.
- Measured: no fixed-layer work. No declaration changes — `hasBlockRole` fences neither end,
  `record` has no permitted set, and the new keys live in `values` — so the kernel harness's
  vocabulary copy stays, and the kernel reads no structure by id. It stays an `RO` change.
- A field's key is kept as a value on its *Field* block, not the block's id, so the keys readers
  hold today, minted or UUID, survive.
- Order: after `BO_0338` completes, since it rewrites what that change renames; `RO_0005_001` and
  `RO_0005_002` first, then the acts, the page and `documents`' guards, then the readers, which
  move with the ids in the same proposal as the migration.
