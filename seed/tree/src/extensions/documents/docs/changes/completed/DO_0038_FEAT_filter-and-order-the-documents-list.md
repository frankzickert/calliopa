# DO_0038_FEAT_filter-and-order-the-documents-list

Status: completed

Requested: 2026-10-05, by the user: "add filters to the doc overview in the left panel". Asked what to
filter by, the user chose all four offered — title text, document kind, started by an agent, unnamed
— "also support different ordering mechanisms", and chose to store the choice with the workspace.
The functional questions were answered the same day: all four orders, title-only search, and an
empty result said in words with a control that clears the filter. Set to draft by the user,
2026-10-05, and to ready the same day; implemented, walked by the user at pin 4611 ("worked")
and completed the same day.

## What Is Asked

- The library's *Documents* section (the Docs icon in the left panel) gains a filter row, in the
  idiom of the Extensions category's status filter (`ui.shell`'s `workspace/layout.md`,
  `BO_0222_006`): a funnel control in the section's header, *Filter documents*, `aria-pressed` for
  whether the row shows, reveals a row under the header, ruled off from the list below.
- The row narrows the list by:
  - **Title text**: a search field; the list keeps the documents whose title contains the typed
    words, ignoring case. It matches the title alone, never a document's body, and filters in the
    page over the list already read, so typing never waits on the graph.
  - **Document kind**: one toggle per kind of document the list holds — a plain document and each
    `record` another extension declares for it (a source, …), named by the record's word.
  - **Started by an agent**: show or hide the documents a run started that nobody has taken yet
    (the rows drawn as proposals, `BO_0251_011`).
  - **Unnamed**: show or hide the documents still carrying the name they were minted with
    (`DO_0012`).
- The row also chooses the list's **order**, one of four: *Title A–Z* (today's, `byTitle`),
  *Title Z–A*, *Last changed first* (by each document's latest established revision) and *Newest
  first* (by when each document was created). A started document nobody has taken has no
  established revision; it orders by its candidate's time.
- The chosen kinds, the two show/hide choices and the order are stored in the workspace layout
  beside the section's collapsed state, so they follow the workspace across reloads and devices
  (the shell's section `filter`, `SectionProps.filter` / `setFilter$`). The typed title text is not
  stored, and neither is whether the row is open. The funnel reads as active — a mark, not colour
  alone — whenever the stored choice differs from the default.
- A workspace that never chose lists what it lists today, in today's order: every kind, started and
  unnamed documents shown, ordered by title.
- When the filter hides every document, the list says *No documents match* with a control,
  *Clear filter*, that sets the stored choice back to the default and empties the search field;
  an empty library still says *No documents yet*.
- An open tab of a document the filter hides stays open: the filter is the list's, not the
  workspace's.

## Functional Questions

- None open.

## System Tasks

- `DO_0038_001` in `ui.shell`'s `workspace/contribution-contract.md`, *A Filter On An Item
  Section*: the contract's filter, its stored vocabulary and the registry's refusals.
- `DO_0038_002` in `ui.shell`'s `workspace/layout.md`, *A Filter On An Item Section*: the funnel,
  the filter row, the active mark and *Clear filter*, on a desktop and in the sheet.
- `DO_0038_003`–`DO_0038_005` in `documents`' `documents/documents-section.md`, *Filter And
  Order*: the listing's record and times, the section's filter, and the walk.

## Verification

- On the implementation tree (head 4600): `tsc --noEmit` clean; `pnpm build` passes, and
  `kernel toolchain absence` builds every variant without the bundled extensions; the unit
  project passes (1890 and the new tests; `shell-captures.test.ts` included); the new
  `src/lib/library-filter.test.ts`, `src/components/shell/library-filter.test.ts`, the
  registry's refusals and `lib/library-item.test.ts` pass, and two mutations of the filter rules
  (the key order's direction, the hidden-value check) each fail them.
- The behaviour project over the kernel harness: the new listing-times test passes; six tests in
  `bibliography`, `instructions`, `manuscripts` and `documents` (admonition merge, picture, the
  structural operations) fail, and fail the same on the untouched head 4600, so they are not this
  change's.

## Notes

- The shell draws the filter, and the Documents section stays an item section. The stored filter
  reached only a component section, but the Documents rows are the shell's uniform rows, which
  open, mark a document whole for a pointing, take a held block and carry a proposer's face;
  turning the section into a component would mean drawing all of that again in `documents`. So
  the contract gains a filter an item section declares and the shell draws it, over the existing
  `Layout.filters` store. Settled at transfer, 2026-10-05: it adds to `ui.shell`'s contract, so
  two of the tasks are in the shell's docs.
- The listing answers a document's title, its glyph (its kind), whether a run started it and
  whether it is unnamed (`documentItem`); a kind filter needs the kind as a value, not only as a
  glyph, and the two orders by time need each document's latest revision time and creation time,
  which the listing does not read today — read as metadata, in one query for the whole list, never
  a read per document.
- `documents` ships in every release (`bundled`), so the change writes its line in
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` under *Added*. No installer-facing
  behaviour changes, so the website's docs are untouched.
