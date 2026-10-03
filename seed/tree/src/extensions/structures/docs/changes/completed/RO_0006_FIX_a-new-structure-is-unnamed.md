# A New Structure Is Unnamed

Status: completed

The user reported on 2026-10-03 that a new structure's title does not use the placeholder. It
holds real text that has to be deleted before the structure can be named.

## What Is Reported

* A new structure's title field is empty under a placeholder, as a new document's is. Requested
  by the user, 2026-10-03.

## Where This Starts

- Read at dataRevision 4272. `+` under *Structures* (`views/section.tsx`) posts the name
  *Untitled structure* (`UNNAMED_STRUCTURE`, `lib/structures.ts`), and `createStructure` stores it
  as the document's title.
- A document's header shows its title as a placeholder over an empty field only when
  `documents`' `isUnnamed` (`lib/naming.ts`, `DO_0012`) recognises the minted name: *Untitled
  document* or *Untitled instruction*. *Untitled structure* is not one of them, so the header
  shows it as text.

## Proposed Shape

- *Untitled structure* becomes a minted name in `documents`' `lib/naming.ts`, the way
  `instructions`' *Untitled instruction* is. `isUnnamed` recognises it, and its headline paints
  the title it carries as the placeholder. `structures` takes the constant from there rather than
  defining its own.
- So a new structure opens with an empty title field under *Untitled structure*. Its row in
  *Structures* and its tab are drawn muted as an unnamed document's are, and typing names it.
- A test in the render harness: a structure with the minted name shows an empty title under it as
  placeholder; typing a name and leaving renames it.

## Boundaries

- `structures` (`lib/structures.ts`, its system doc's Structures category line) and `documents`
  (`lib/naming.ts`, `title-placeholder.test.ts`). The stored name of a new structure is unchanged.
- Release notes: *Fixed* — a new structure's title is empty under a placeholder, ready to be typed.

## Done

Set to ready by the user on 2026-10-03 and carried out the same day: `RO_0006_001`, now truth in
[Structures](../../system/system.md) (the Structures category) and `documents`'
[Block Editor](../../../../documents/docs/system/documents/block-editor.md) (minted names).
Verified by `title-placeholder.test.ts` and `naming.test.ts`, with the `documents`, `structures`
and `instructions` unit suites passing (946).
