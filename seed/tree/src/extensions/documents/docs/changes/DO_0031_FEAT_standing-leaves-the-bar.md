# DO_0031_FEAT_standing-leaves-the-bar

Status: idea

Requested 2026-10-01: **remove the standing control from the toolbar.** User statement.

The document view's bar carries, while a block is the subject, a *Standing* group: the standing
as a `choice` (keep · fixate, and *Prompt* while the block is one) and beside it the info control
saying what each standing and *Remove* mean and how each is set ([Block Editor View](../system/documents/block-editor.md#standing),
`BO_0272`, `DO_0010_005`). This change takes that group out of the bar.

## Scope

- The owner is `documents`, which contributes the bar's groups; the shell's bar vocabulary keeps
  `choice` and the info kind for any other view (`CA_0053_002`, `BO_0272`).
- The bar's block groups become *Format*, *Turn into*, *Block* and *History*; nothing else in the
  bar moves.
- Revises the fixed line *No gesture is the only path* (`BO_0231`, `DO_0014`, `BO_0315`), which
  names the bar's *Standing* control as one of the paths and places the info control beside it.
  The paths that stay: the chord (`Alt`+`Shift`+arrow on a focused reading row), the block bar's
  *Fixate* on the row the bar acts on while reading, and the swipe on touch. *Take back* in the
  *Document* group stays (`CA_0058_011`).
- The block being edited: the chord never acts on it (macOS word selection), so today the bar is
  its pointer path to fixate; Q1 decides what replaces it.
- A prompt is set back to keep or fixate through the bar's choice today ([Prompts](../system/documents/block-editor.md#prompts));
  Q2 decides where that goes.
- `views/bar.test.ts`' standing-scale case goes; the bar's case without a *Standing* group comes.

## Questions

- [ ] Q1 Does the block being edited keep a path to *Fixate* — the block bar while editing, the
      command chip, or none (end the edit, then fixate)?
- [ ] Q2 Where is a *Prompt* set back to keep: the block bar, *Take back*, or a control on the
      prompt row under *Show prompts*?
- [ ] Q3 Where does the explanation of the standings and *Remove* go — beside the block bar's
      *Fixate*, into the settings or help, or away?
- [ ] Q4 "The toolbar" is read as the document's bar at the top of the view. Is the block bar's
      *Fixate* on a reading row (`BO_0315_013`) meant too?
