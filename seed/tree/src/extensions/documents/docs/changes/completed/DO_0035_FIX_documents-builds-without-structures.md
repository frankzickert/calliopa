# DO_0035_FIX_documents-builds-without-structures

Status: completed

Found 2026-10-03 cutting release `0.5.1` at accepted pin 4440: `scripts/release-distribution.sh`
refused the release, since the tree does not build with an owner's optional extensions switched
off. Without `bibliography`, `instructions`, `keywords`, `manuscripts`, `media` and `structures`
the typecheck fails in `documents`:

```
src/extensions/documents/server/proposed-works.test.ts(5,34): error TS2307:
Cannot find module '~/extensions/structures/lib/structures'
```

`RO_0005` (*a structure is a document*) added `import { SOURCE_STRUCTURE } from
"~/extensions/structures/lib/structures"` to `documents`' `server/proposed-works.test.ts`, for the
`role` of one `roleFields` fixture. `documents` ships when `structures` is switched off, so no
file of it, a test included, may import from `structures`. `server/proposed-works.ts` itself does
not: `proposedWorksCited` never reads the fixture's `role`. Every other combination of switched-off
extensions builds. No release can be cut until this is fixed and the pin moves past it.

## Scope

- `documents`' `server/proposed-works.test.ts` imports nothing from `structures`: the fixture's
  `role` is a value of the test's own, since the function under test does not read it.
- `bibliography`'s `server/tools.test.ts` keeps its import: `bibliography` depends on
  `structures` and its `server/works.ts` imports the same constant.
- Nothing a person installs, runs or sees changes, so the change writes no release-notes line.
- Verified by the release's absence check passing at a pin carrying the fix, a `--no-push` run of
  `scripts/release-distribution.sh`, and by `proposed-works.test.ts` still passing.

## Transfer

Transferred 2026-10-03 into `documents`' *Block Document Model*, *Sources And Citations*:
`DO_0035_001` (the test's own `role`) and `DO_0035_002` (the proof).

## Done

Completed 2026-10-03: `DO_0035_001` and `DO_0035_002` folded into truth in *Sources And
Citations*. No release-notes line: nothing a person installs, runs or sees changes.
