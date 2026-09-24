# A Record Value Is Declared

Status: idea

A document's `record` property says what kind of record the document is — `investigation`, since
`RF_0003` — and today nothing declares such a value: this extension defines `BlockKind` and
`RootPhase` as declaration types another extension instantiates, and no type for record values, so
`calliopa-refine` writes `record: investigation` as a bare string that nothing backs. This change
adds the third declaration type, `RecordValue`, shaped like `RootPhase`, so `calliopa-refine` can
declare `investigation` as an instance attached to its manifest by `partOf` — knowledge a surface
can read, never a fence, as every declaration by instance is (`calliopa-bootstrap`'s
`extension-model.md`, Declaration By Instance). It closes `calliopa-refine`'s open line
`RF_0003_013`. Requested by the user on 2026-09-23. This is an idea: nothing is implemented, and
no system task is enumerated until the user sets it to draft.

## Scope

- The owner is `documents`: the `record` property is its `document` type's, and the declaration
  types are its (`BO_0256_006`). So this change document is its member and the prefix is `DO`.
- The other half is `calliopa-refine`'s: one instance, `investigation`, created and attached by
  `partOf` to its manifest through the members sidecar, which carries a declaration by structure
  since `BO_0278_001`. That half is enumerated in `calliopa-refine`'s docs with a task line
  pointing here, the way `RF_0004`'s `documents` half is enumerated there.
- Out of scope: enumerating permitted record values, listing documents by declared value in the
  library (the Investigations section already reads the bare value), and any migration of the
  value already written.

## The Ask

1. A declaration type of this extension for record values, so a value another extension writes
   into `document.record` has something to be an instance of.
2. `calliopa-refine` declares `investigation` as one, so the value travels with a release as
   declared knowledge rather than as a string a route happens to write.

## The Shape

- **The type.** `RecordValue`, an ordinary graph type of this extension in its `ext.blocktype`
  set beside `BlockKind` and `RootPhase`, with the same shape: the value as its `marks`, words
  saying what a document carrying it is, and whatever `RootPhase` carries beside them. Not an
  `ext.*` kind, for the reasons `extension-model.md` gives.
- **The instance.** `calliopa-refine` creates one `RecordValue` with `marks: investigation`,
  attached to its manifest by `partOf`, through `kernel commit --members`; the sidecar carries it
  by structure and the release export finds it through `declarationTypes`.
- **What reads it.** Nothing new: the library's Investigations section keeps reading the bare
  value, and `document.record` stays an unconstrained optional property (`BO_0199_002`). What
  changes is that an owner reading the manifest, and a release carrying the extension, see the
  value declared.

## Open Questions

- [ ] Does a `RecordValue` carry, beside its marks and words, which extension's section lists
  documents carrying it — so the library could one day offer a category per declared value — or
  is that a later change's to add?

## What This Is Not

- Not a constraint: a document may carry a value no declaration backs, as the slot's posture says.
- Not a migration: the one value already written stays as it is and is declared after the fact.
