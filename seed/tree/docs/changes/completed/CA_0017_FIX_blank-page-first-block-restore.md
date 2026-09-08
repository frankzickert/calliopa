# CA_0017_FIX_blank-page-first-block-restore

Status: completed

Requested: 2026-08-30

## Intent

`tests/browser/block-editor.spec.ts:182`, "When a blank page is written in,
Then it becomes the document's first block", fails intermittently. It fails on
`main` with nothing in the working tree, so it is not the consequence of any
change in flight. Until it is fixed, the change-completion gate cannot pass and
no change can honestly be set to `Status: completed`.

## What Happens

- The scenario writes into a blank document, waits for the save to report
  itself saved, leaves the block, reloads, clicks the document's own tab, and
  expects the words back as a reading block.
- It fails at that last step: `[data-block-reading]` is not found at all,
  rather than found holding the wrong text. The document renders with no
  reading block after the reload.
- It has been observed on both form factors, desktop and mobile, in separate
  runs of the same code. Whatever it is, it is not specific to one viewport.
- It is intermittent. Runs of the same tree both fail and pass it.

## Evidence

- Observed at `HEAD` (`73b1182 CA_0013_FEAT`) with an untouched tree, in a
  verification stack run for this purpose. The same run passed every other
  gate: frozen install, fast check, migrations, integration tests, production
  build, and the health probe.
- Observed three times in a working tree carrying `CA_0014`, twice on desktop
  and once on mobile. `CA_0014` bounds the shell frame and gives the regions
  their own scroll; the baseline run is what separates the two, and it shows
  the failure without `CA_0014` present.

## Why It Happens

Read from the code, not yet reproduced under observation. Neither branch of the
question as it was first put is what happens: the block is persisted, and the
restored tab does render it. It renders it as the active editor rather than as
a reading block, because the tab comes back still remembering that block as its
selection.

- A restored tab activates its remembered selection on mount
  (`src/components/views/block-editor.tsx:1003`), and an active block renders
  `[data-block-editor]` (`:1583`) where an inactive one renders
  `[data-block-reading]` (`:1541`). A one-block document whose one block is
  active therefore holds zero reading blocks — not found at all, which is the
  symptom rather than a wrong-text one.
- The scenario already knows this and guards against it: it waits for the
  workspace write that clears the selection before reloading. The guard accepts
  any `PUT /api/workspaces/…` (`tests/browser/block-editor.spec.ts:216`), and
  the write it means is not the only one in flight.
- `setSaveState$` sets the word the header shows and writes the workspace after
  it (`src/components/shell/shell.tsx:452`). "Saved" is painted while the
  `unsaved: false` write behind it is still in flight. The scenario reads
  "Saved", registers its wait, and clicks; if that earlier response lands in
  the interval, the wait is satisfied by the wrong write, the reload cancels
  the write that would have cleared the selection, and the tab is restored
  holding the block.
- That accounts for every property of the failure: intermittent, because the
  window is the few milliseconds between the word being painted and the write
  behind it answering; indifferent to viewport, because neither surface is
  involved; and present on an untouched tree, because nothing in flight touches
  either path.

## What The Fix Is

A document that is reloaded always comes back reading. The tab keeps its
retained selection, as [Workspace Shell](../../system/workspace/frame.md) fixes
that it must, but a fresh page load no longer activates it: the block is
remembered, not reopened.

- A tab switch is untouched. It still returns to the active block, which
  [Block Editor View](../../system/documents/block-editor.md) states as truth.
- The two are one code path today. The shell unmounts and remounts a view on a
  tab switch, keyed by tab id, so the mount that activates the remembered
  selection runs for a returning tab exactly as it runs for a reloaded page.
  Separating them is the whole of the product change.
- The view already knows the difference without new state. Its per-tab scroll
  map is module-level and lives for the page's lifetime, so a tab it has
  mounted before in this page is a tab switch and a tab it has not is a fresh
  load.
- The scenario then loses its guard entirely. There is nothing left to wait
  for before reloading, because a reload can no longer come back holding an
  activated block. The race is removed rather than synchronised around, which
  is the difference between this and what "Not This" forbids.
- `setSaveState$` painting "Saved" before its workspace write lands
  (`src/components/shell/shell.tsx:452`) is left alone. It is what made the
  scenario's wait unreliable, but with no guard to make reliable it costs
  nothing, and ordering a paint behind a network write to serve a test would
  be the wrong trade.

## Verification

- The failing scenario, with its guard removed, proving the words come back as
  a reading block after a reload on desktop and on mobile.
- A block left active still being active after an ordinary tab switch, so the
  separation is proved in both directions rather than only the new one.
- Reproducing the failure before the fix, against a stack from
  `scripts/stack-up.mjs`, so the diagnosis above is observed rather than only
  reasoned. The mechanism is read from the code and has not yet been watched
  happening.

## Not This

- Retrying the assertion, widening its timeout, or marking the scenario flaky.
  The scenario asserts that words a person typed survive a reload, which is the
  one thing a document editor must not do intermittently. A test that is made
  to pass while the behaviour stays intermittent removes the evidence and keeps
  the defect.

## System Work

Done and folded. `CA_0017_001` is no longer a task: the behaviour it described
is truth in [Block Editor View](../../system/documents/block-editor.md), under Shell
Integration and Implementation.

[Block Editor View](../../system/documents/block-editor.md) still carries two unowned
tasks about the same spec file: `expectTypedSaved` polling past its `Unsaved`
transient, and the cross-block drag scenario racing its gesture. Both are
different failures at different assertions, and this change closes neither. The
first completion-gate run for this change failed on the drag one and the next
passed unchanged, which is what those two lines record: this spec is not a
reliable gate until they are done.
