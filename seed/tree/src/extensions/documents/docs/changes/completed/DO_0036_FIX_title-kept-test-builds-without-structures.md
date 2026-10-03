# DO_0036_FIX_title-kept-test-builds-without-structures

Status: completed

Found 2026-10-03 cutting release `0.5.1` at accepted pin 4534: `scripts/release-distribution.sh`
refused the release, since the tree does not build with an owner's optional extensions switched
off. Without `bibliography`, `instructions`, `keywords`, `manuscripts`, `media` and `structures`
the typecheck fails in `documents`:

```
src/extensions/documents/views/title-kept.test.ts(7,8): error TS2307:
Cannot find module '~/extensions/structures/lib/structures'
```

`DO_0032` (*a title is kept before the header acts*) added `views/title-kept.test.ts`, which
imports the types `DocumentStructuresView`, `StructuresListing` and `StructureView` from
`structures` to type the responses its fetch stub serves for the structures chip. `documents`
ships when `structures` is switched off, so no file of it, a test included, may import from
`structures` — the rule `DO_0035` restored for `server/proposed-works.test.ts` a release earlier.
Every other combination of switched-off extensions builds. No release can be cut until this is
fixed and the pin moves past it.

## Scope

- `documents`' `views/title-kept.test.ts` imports nothing from `structures`: the shapes it serves
  are typed by the test itself, as far as the editor reads them, and the test still proves what
  `DO_0032` asks — a title typed, a structure taken from the header's chip, the title saved first.
- Nothing a person installs, runs or sees changes, so the change writes no release-notes line.
- Verified by `title-kept.test.ts` passing, and by `kernel toolchain absence` building every
  combination of switched-off extensions on a head checkout carrying the fix.
- That the leak reached a release twice, both times in a `documents` test, is `BO_0347`'s subject
  in `calliopa-bootstrap`: the check runs only when a release is cut.

## Transfer

Transferred 2026-10-03 into `documents`' *Block Editor*, *A Title Is Kept Before Another Control
Acts*: `DO_0036_001` (the test's own types) and `DO_0036_002` (the proof).

## Done

Completed 2026-10-03: `DO_0036_001` and `DO_0036_002` folded into truth in *A Title Is Kept
Before Another Control Acts*. No release-notes line: nothing a person installs, runs or sees
changes.
