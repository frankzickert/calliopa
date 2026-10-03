# DO_0031_FEAT_standing-leaves-the-bar

Status: completed

Requested 2026-10-01: **remove the standing control from the toolbar.** User statement.

The document view's bar carries, while a block is the subject, a *Standing* group: the standing
as a `choice` (keep · fixate, and *Prompt* while the block is one) and beside it the info control
saying what each standing and *Remove* mean and how each is set ([Block Editor View](../system/documents/block-editor.md#standing),
`BO_0272`, `DO_0010_005`). This change takes that group out of the bar.

## Scope

- The owner is `documents`, which contributes the bar's groups; the shell's bar vocabulary keeps
  `choice` and the info kind for any other view (`CA_0053_002`, `BO_0272`).
- "The toolbar" is the document's bar at the top of the view. The block bar on a row's top border
  keeps *Remove* and *Fixate* on the row turned to and on the row being edited (`BO_0315_013`).
  User decision, 2026-10-03.
- The bar's block groups become *Format*, *Turn into*, *Block* and *History*; nothing else in the
  bar moves.
- Revises the fixed line *No gesture is the only path* (`BO_0231`, `DO_0014`, `BO_0315`), which
  names the bar's *Standing* control as one of the paths and places the info control beside it.
  The paths that stay: the chord (`Alt`+`Shift`+arrow on a focused reading row), the block bar's
  *Fixate* on the row turned to and on the row being edited, and the swipe on touch. *Take back*
  in the *Document* group stays (`CA_0058_011`).
- The block being edited keeps its path to *Fixate* in the block bar it already carries
  (`BO_0315_013`); the chord still never acts on it (macOS word selection). Nothing is added for
  it. User decision, 2026-10-03.
- A prompt is set back to keep from its own block bar: a prompt row revealed by *Show prompts*
  and turned to carries *Keep as content*, which returns it to keep, and *Fixate*, both through
  `setStanding$`, so *Take back* takes either back. *Send* stays the only way a block becomes a
  prompt; the swipe and the chord still never reach one ([Prompts](../system/documents/block-editor.md#prompts)).
  User decision, 2026-10-03.
- The info control goes with the group and nothing replaces it: the shell has no help surface to
  carry what each standing and *Remove* mean. The transfer adds an open `[ ]` line to
  [Standing](../system/documents/block-editor.md#standing) for the explanation to return when a
  help surface exists. User decision, 2026-10-03.
- `views/bar.test.ts`' standing-scale case goes; the bar's case without a *Standing* group comes,
  and the block bar's case on a revealed prompt with *Keep as content* and *Fixate* comes.

## System Tasks

- Transferred on 2026-10-03 to `docs/system/documents/block-editor.md`, *Standing Leaves The Bar*:
  `DO_0031_001`–`DO_0031_007`, and the open line for the explanation's return.

## Boundaries

- `documents` (`views/block-editor.tsx`, `views/block-bar.tsx`). The shell's bar vocabulary is
  unchanged.
- Release notes: *Changed* — the standing control and its explanation left the document's toolbar;
  a prompt is kept as content or fixated from its own buttons.
