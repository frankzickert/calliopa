# DO_0042_FEAT_structures-in-the-documents-filter

Status: completed

Requested: 2026-10-06, by the user: "in the documents filter, i want filters for structures. this
should be off by default". Asked what the filter narrows by, the user chose the documents that
define a structure, not the structures a document uses; asked what *off by default* means, the user
chose hidden by default. Set to draft by the user, 2026-10-06, and to ready the same day; implemented the same day and closed
by the user without the walk (`DO_0042_005`).

## What Is Asked

- The Documents section's filter row (`DO_0038`, [The Documents Section](../../system/documents/documents-section.md#filter-and-order))
  gains a show/hide toggle for **structures**: the documents that define a structure — every
  document using *Structure* (`structures`' *A Structure Is A Document*, `RO_0005`), a person's
  (*Story*, *Blog post*, …) and the built-ins (*Structure*, *Field*, *Keyword*, *Instruction*, …).
  Today they list as plain documents.
- It is off by default: a workspace that never chose does not list structure documents, and
  neither does one that stored a choice before this change (user decision at transfer,
  2026-10-06). Turning the toggle on lists them among the rest; the choice is stored with the
  workspace like the section's other choices.
- A document that only *uses* a structure (a story using *Story*) is not a
  structure document and is never hidden by this toggle.
- Structures stay listed in the *Structures* category, where they are defined; hiding them here
  removes nothing there.
- The default is the default: a workspace that never chose shows no active mark on the funnel, and
  *Clear filter* returns to structures hidden.
- An open tab of a structure document stays open, as for every value the filter hides.

## Functional Questions

- None open.

## System Tasks

- `DO_0042_001` in `ui.shell`'s `workspace/contribution-contract.md`, *A Filter On An Item
  Section*: a value hidden by default and shown is stored as `shown:<group>:<value>`, so a choice
  stored before the default existed reads it hidden.
- `DO_0042_002`, `DO_0042_003` and `DO_0042_005` in `documents`' `documents/documents-section.md`,
  *Structures In The Filter*: the listing's whole-list namer, the section's *Structures* group,
  and the walk.
- `DO_0042_004` in `structures`' `system.md`, *Structures In The Documents Filter*: the lister
  naming every document using *Structure*.

## Verification

- On the implementation tree (head 4959): `tsc --noEmit` clean; `pnpm build` passes; `kernel
  toolchain imports` finds every import reaching only a declared dependency; the unit project
  passes (1997 tests), the new cases in `src/lib/library-filter.test.ts` and
  `lib/library-item.test.ts` among them, each failing before the code it proves.
- The behaviour project over the kernel harness (`TestShellDocumentsOverCCGW`): the two new tests
  pass (`DO_0042_002` in `documents`, `DO_0042_004` in `structures`); six tests fail, the same six
  that fail on the untouched head 4959 (`bibliography`'s sources, `instructions`' migration,
  `manuscripts`' projection, and `documents`' picture, admonition merge and structural
  operations), so they are not this change's. A first run on head 4951 also failed `structures`'
  `BO_0349_023` (a field's type read as `text`), which passed on the rerun and on head.

## Notes

- How the listing learns a document is a structure (settled at transfer, 2026-10-06): `documents`
  declares no dependency on `structures`, so it cannot import its names. It already lets an
  extension name a document by a word (`nameDocuments`, `DO_0034`), one document at a time;
  `structures` answers `structure` for a document using *Structure*. The listing gains the
  whole-list counterpart, a lister each extension may register, so `structures` answers every
  structure document in one read, and a tree without `structures` lists as before — the
  *Structures* group then carries no value and is not drawn.
- The stored filter records only hidden values, so a choice stored before this change could not
  tell *never chose* from *chose to show* and would have listed structures. The user chose to hide
  them there too, which needs the stored vocabulary to record a shown default — the change to
  `ui.shell`'s contract (`DO_0042_001`).
- `documents` ships in every release (`bundled`), so the change writes its line in
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, under *Changed*, since the default list
  changes for every workspace. No installer-facing
  behaviour changes, so the website's docs are untouched.
