# Swipe Removes Or Keeps

Status: completed

Requested: 2026-09-30, by the user. Swiping left removes. There is no longer any difference between
a discarded block, a retired block and a rejected proposal. Swiping right keeps. The *Retire*
button leaves the bar at the top. Later the same day, the user added that an active block's
standing buttons, its focused-work control and its move up and move down buttons should stand
together in one bar on the block's top border. The questions were answered the same day. This
document shapes the change and authorizes no implementation.

This is a `BO` change for two reasons. First, the standing scale is named in the fixed layer as
well as in `documents`: `internal/kernel/agenttools/standing.go` holds `DispositionDiscarded` and
`DispositionMeaning`, the wording every run is given and `read_document`'s description repeats
(`docs/system/ui-kernel.md`, *The Standing Is Three States*). Second, a rejected proposal has to
be read back so it can be shown and reopened. Most of the work lands in `documents` in the graph,
so this document is carried into `documents`' `docs/changes/` no later than its completion.

Transferred 2026-09-30. The core's tasks are `BO_0315_001`–`_002` in `docs/system/ccgw.md`, and the
kernel's are `_003`–`_007` in `docs/system/ui-kernel.md`, *Swipe Removes Or Keeps*. `documents`'
tasks are `_008`–`_019` in its graph docs (`block-editor.md`, `block-document-model.md`,
`document-panel.md`, `proposed-changes.md`), staged as `node:chg-8e5e28e34101a312`. `BO_0315_001`
builds on `BO_0314_001`, and `_011` on `DO_0024`'s batch decline.

## Behavior

### Removing

- **One removed state.** A retired block and a rejected proposal become the same thing to the
  reader: removed. The discarded standing goes away. User decision, 2026-09-30.
- **Swipe left removes.** On a block of the document, the left swipe retires it. On a proposed
  rewrite, insert or move, the left swipe rejects it. The reveal names one action, *Remove*, in
  both cases. User decision, 2026-09-30.
- **A fixated block is unfixated first.** A left swipe on a fixated block returns it to keep, and a
  second left swipe removes it. User decision, 2026-09-30.
- **The bar at the top loses *Retire*.** Its *Block* group no longer carries *Retire* (`archive`).
  That covers both the single-block *Retire* and the one `DO_0023` enables while a selection marks
  several blocks. User decision, 2026-09-30.
- **Remove on a desktop.** A mouse never swipes. On a desktop a block is removed by the *Remove*
  button in its block bar (below), which replaces *Discard*, or by Delete or Backspace on the active
  block while reading. While a block is being edited, those keys stay the editor's (`DO_0017`).
  User decision, 2026-09-30.
- **Delete or Backspace removes a fixated block at once.** On a fixated active block, one press
  removes it. Unlike the left swipe, the keys do not unfixate first. User decision, 2026-09-30.
- **Delete or Backspace removes what is marked.** While reading, with a text selection that marks
  several blocks (`DO_0023`), Delete or Backspace retires every marked block and rejects every
  marked proposal in one press. Fixated blocks are included. The selection then clears and no block
  is focused, as *Retire* does today. User decision, 2026-09-30.
- **Take back restores a removed block.** *Take back* in the bar's *Document* group reverses the
  last removal of a block, putting it back where it was. A rejected proposal is brought back by
  reopening it, below. User decision, 2026-09-30.
- **Removed blocks and proposals are shown together.** The bar's *Show discarded blocks* toggle,
  the discarded row with its *Reopen*, and the discarded card go away. The retired-blocks toggle
  becomes *Show removed*. It reveals retired blocks and rejected proposals together, each drawn
  where it stood, and both kinds carry the card label *removed*, matching the swipe's *Remove*. *Restore* on a
  retired block puts it back into the document. On a rejected proposal it reopens the proposal, as
  an open proposal to accept or remove again. User decisions, 2026-09-30.
- **Existing discarded blocks are retired.** A block stored as `discarded` (or `resolved`) is
  retired by an `ext.migration`, keeping its place, and can be restored from the retired list. User
  decision, 2026-09-30.

### Keeping

- **Swipe right keeps.** On a block of the document, the right swipe fixates it, as today. On a
  proposed rewrite, insert or move, the right swipe accepts it only: the block it becomes stays
  kept with no mark. Today the right swipe also fixates that block. User decision, 2026-09-30.
- **The scale is keep · fixate.** Keep is the absence of a stored value. `prompt` stays off the
  scale, as it is today.

### The Block Bar

- **The active block's controls stand in one bar on its top border, right-aligned, in one row.** The
  bar sits directly above the block, mirrored against where the standing toolbar sits today, and
  never overlaps the block's text. In order, it holds:
  - the depth's categories (*Why this matters now*, *Provenance* …), moved in from the border's
    trailing end;
  - the shell's *Open as focused work* control;
  - ↑ and ↓;
  - *Remove*;
  - *Fixate*, which reads *Unfixate* on a fixated block.

  There is no *Keep* button. User decisions, 2026-09-30.
- **A block is active when it is turned to or being edited.** The block turned to while reading
  and the block being edited get the bar, as the standing toolbar does today (`DO_0014`), and so
  does a proposal turned to. User decision, 2026-09-30.
- **Other rows show only their handle on hover.** A row that is not active shows its ⠿ handle and
  no arrows; the arrows stand only in the active block's bar. This replaces the fixed line in
  `block-editor.md` that shows every row's arrows on hover (`BO_0263`, user decision 2026-09-18).
  User decision, 2026-09-30.
- **A phone gets the same bar.** It stands at the same place, right-aligned on the top border.
  Where the row is too narrow for it, it wraps or scrolls within the row's width. User decision,
  2026-09-30.

### Runs

- **The kernel tells a run about two standings.** `DispositionMeaning` drops the discarded clause,
  and `read_document` no longer reports `discarded`.

## Notes

- What changes in the graph (`documents`):
  - `block-editor.md`: *Standing*, *The Standing Is Three States*, the bar's groups line, *Retiring
    Marked Blocks* (`DO_0023`), the *Retire* line under the bar, the fixed hover lines of
    `BO_0263`, the grips (`CA_0045_002`, `CA_0029_001`), and the top-border sharing
    (`CA_0065_009`, `DO_0008_004`).
  - `proposed-changes.md`: *A Proposal Takes A Standing*.
  - `document-panel.md`: *Discarded Blocks In Place* and *Retired Blocks In Place*.
  - `block-document-model.md`: the `disposition` declaration and the migration.
- What changes in the code (`documents`):
  - `lib/disposition.ts`: `SCALE`, `LABEL`, `MARK`, `CONTROL_GLYPH`, `RETIRED`.
  - `lib/swipe.ts` and `views/block-swipe.ts`: what each direction commits, and the fixated case.
  - `views/standing/`: `discarded-row.tsx` and the toolbar.
  - `views/block-controls.tsx`, `views/row-grip.tsx`, `.block-toolbars` and `--block-grip-gutter`:
    the block bar. The card label keeps the top border and yields to the bar, as it yields to
    controls today (`DO_0008_004`). The shell's control is still rendered through `ActionControl`
    at `surface="block"`; only where `documents` draws it changes.
  - The bar's info popover, which explains three states today.
- Rejected proposals, read back and reopened. Today a document's proposal read covers open groups
  only. Drawing a rejected item needs a read of the items rejected against the document's blocks,
  and reopening it most likely stages the same item again as a new proposal rather than reversing
  the rejection. Both are to be settled against CCGW's proposal model at draft. The read must not
  add to the per-group fan-out `BO_0314` removes.
- What changes in `ui.shell`: nothing is expected. The popover kind stays, and its words are
  `documents`'.
- A prompt "leaves the drawn flow as a discarded block does" (`block-editor.md`, *Prompts*). That
  wording is rewritten without the comparison; the prompt standing itself is untouched.
- Rejecting several marked proposals in one press goes through `DO_0024`'s batch decline (*One Read
  Per Answer*).
- Discarding a marked block keeps its references today, and the chip says *since discarded*. A
  removed block's references take the retired idiom instead.
- The release notes need a line under *Breaking* for the migration, since a narrower permitted set
  for `disposition` is a breaking class. The swipe, the block bar, the removed state and the
  removal of the bar's *Retire* and *Show discarded blocks* go under *Changed*
  (`docs/system/distribution.md`, Release Notes).

## Implementation

- 2026-09-30. The core reads rejected proposals back (`BO_0315_001`–`_002`, `ccgw.md`): the reaching read's
  `rejected` flag and the overlay's `proposalOverlayRejected`, over both stores. The kernel names two standings and
  tells a run so (`BO_0315_003`–`_005`, `_007`, `ui-kernel.md`), and its documents fixture stages the narrowing with
  its migration member over blocks set aside.
- In the graph (`documents`, and `ui.shell`'s reference chip and CCGW client): the scale of two, the swipe's one action
  each way, Delete and Backspace while reading, *Take back* restoring a removal, the block bar on the top border with
  the handle alone on other rows, *Show removed* reading rejected proposals back and *Restore* reopening them, the
  popover's words, and the executable migration `retire-discarded` that the kernel's runner (`BO_0312_003`) posts to
  (`BO_0315_008`–`_017`, `_019`). The staged group carries the narrowed `text` member and the `ext.migration` member
  `migration-bo-0315` through `kernel commit --members`.
- Verified on the tree: the unit project's suites that this touches, green but for the failures the base already had;
  under the kernel harness the behavior suite over CCGW, with `removed.test.ts` and `migration.test.ts` new and green,
  and the failures the base already had. Each new assertion was shown to bite.
- Accepted and promoted 2026-09-30 at pin 3259, after the kernel image was rebuilt with the migration runner. The
  kernel ran `migration-bo-0315` at revision 3261, and the served binary carries no discarded standing
  (`BO_0315_006`). Four blocks were stored as discarded and none as resolved before, none of either after: three
  among their documents' retired blocks, and one run's block that no document drew already, with its value cleared
  (`BO_0315_020`).
- Completed 2026-09-30, after the user's walk on the served build on a desktop and a phone (`BO_0315_018`).
