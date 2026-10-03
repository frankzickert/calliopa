# A Title Is Kept Before The Header Acts

Status: completed

A document's title is saved when its field loses focus. The header's roles chip keeps the caret
where it is, so a person who types a title and then takes a role from the chip — *Profile* — never
leaves the field: the role is written, the header is drawn again from the stored document, and the
title typed is gone. Found in `calliopa-bootstrap`'s `BO_0336` video walk on 2026-10-02 (the
document *VideoProfile*, which took *Profile* at its minted name and was named again after).

## What Is Asked

* A title typed is kept when the person acts on the header's lines before leaving the title.
  Requested by the user, 2026-10-02.
* Any press outside the title's field saves a pending title first, as a blur does — a block's
  command or chip as well as the header's lines. User decision, 2026-10-03 (`DO_0032_Q1`).

## Proposed Shape

- A pending title edit is saved before any other press acts: the title's field commits on a press
  outside it the way it commits on blur, before the pressed control's own act. The caret may then
  stay where the control keeps it.
- A test in the editor's render harness: a title typed, the roles chip pressed, a role taken, the
  title saved and shown.

## System Tasks

- Transferred on 2026-10-03 to `docs/system/documents/block-editor.md`, *A Title Is Kept Before
  Another Control Acts*: `DO_0032_001`–`DO_0032_005`.

## Boundaries

- `documents` (`views/block-editor.tsx`, the header). `doc-block-roles`' chip is unchanged.
- Release notes: *Fixed* — a document's new title is no longer lost when a role is taken from the
  header, or another control pressed, before leaving the title.
