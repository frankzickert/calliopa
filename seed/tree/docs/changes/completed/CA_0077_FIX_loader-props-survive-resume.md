# CA_0077_FIX_loader-props-survive-resume

Status: completed

Requested: 2026-10-02, by the user: shape the fix for the shell's production-build defect found in
`calliopa-bootstrap`'s shared app track (`BO_0335`), which keeps the device work from being
verified and the apps from a first UAT build. It shapes the work and authorizes no implementation.

## Transfer

Set to draft by the user on 2026-10-02 and transferred the same day into
[Device](../../system/foundation/device.md): the defect as current truth, and `CA_0077_001` (the
measurement, of the defect and of the fix before it is applied), `CA_0077_002` (the fix: Qwik's
`qSerialize` on in production, the loader's signal handed down instead should it not hold) and
`CA_0077_003` (a check in `check`, and the browser on an instance and in the desktop harness). The
fix was chosen as the measurement decides it, since either leaves an instance's behaviour as it is.

## Progress

- 2026-10-02: measured in the desktop harness, fixed with `qSerialize` on in production, and
  guarded by a check in `check` ([Device](../../system/foundation/device.md)); pinned at 4004 and
  read on the instance by the user: no page error, a document opened from the library. Its
  release-notes line is under *Fixed* in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`.

## The Defect

- A page resumed from a production build reads every prop a component was handed from a loader
  as null until something renders that component with fresh props. The root route hands the
  shell `workspace={view.value.workspace}` and its siblings, which the optimizer compiles to
  derived signals; Qwik's production server serializes a derived signal's function as
  `(p0,)=>(null)`, since its optimizer leaves `globalThis.qSerialize` false outside development.
  Once resumed, every such prop evaluates to null.
- What it breaks: the shell's process poll fails on `workspace.id` at once, and pressing a
  library section's button re-renders the shell and fails on `workspace.layout`, so a document
  in the library cannot be opened. Both are page errors in the console.
- Found 2026-10-02 against a device cell and reproduced with the instance build (`build`) of the
  unchanged tree at head 3882 over the same cell: the production build fails, the Vite
  development server (`dev`) lists and opens the document. Whether an instance shows it in its
  own console is to be read on one; nothing about the device build causes it, since the device
  build renders what `build` renders ([Device](../../system/foundation/device.md), the open line on
  it).

## Proposed

- Measure first, on an instance and in the desktop harness: the console after load, and a
  library section pressed and a document opened.
- Two ways to fix it, to be chosen at draft:
  - Serialize derived props in production: `define: { "globalThis.qSerialize": true }` in the
    tree's Vite configuration, which the optimizer reads (`qSerialize = define ?? isDevelopment`).
    One line, every route at once; the cost is the inlined functions in each page's HTML.
  - Hand components the loader's signal rather than its values, so no prop is a derived
    signal: the shell reads `view.value.workspace` itself. Narrower, but every route and every
    component handed loader values changes, and a new one can bring the defect back.
- A test that fails on the defect and passes on the fix: a production build of the tree,
  rendered and resumed in a browser, with the library pressed and a document opened. The
  behaviour suites run no browser today, so where that test lives is decided at draft.

## Depends On

- Nothing. It blocks verifying `CA_0076_003` and the device's shell work (`BO_0319_043`,
  `_047`–`_052`) in the desktop harness, and the walk (`calliopa-bootstrap`'s `BO_0331_003`).

## Release Notes

- If an instance shows the defect, a `Fixed` line: documents open from the library again.
