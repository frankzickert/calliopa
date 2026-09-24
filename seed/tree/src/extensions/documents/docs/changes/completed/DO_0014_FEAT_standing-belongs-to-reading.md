# Standing Belongs To Reading

Status: completed

A block's own standing toolbar — Discard ✕, Keep ○, Fixate ◆ on its top border, not the view bar
at the top of the document — is drawn in command mode alone, on every block the pointer crosses
(`BO_0231_004`). That is the wrong mode and the wrong condition. Command mode is for pointing: a
reader sweeping the document to choose what a command names has three buttons appear and vanish
under the pointer on blocks they are not judging. Judging a block is what reading is for. This
change takes the toolbar out of command mode entirely and gives it to reading, on the block the
reader has selected. Requested by the user on 2026-09-23, who decided every point below, set it
to draft and then ready the same day; it was transferred and implemented that day as
`DO_0014_001`–`DO_0014_009` in this extension's `docs/system/documents/block-editor.md`,
*Standing Belongs To Reading*, with the proposal half in `proposed-changes.md`. Everything is
implemented, verified, and walked by the user at pin 1773 on 2026-09-23, who accepted it.

## Scope

- The owner is `documents`: the standing toolbar, the marking and the focused row are all its
  (`views/standing/standing-toolbar.tsx`, `views/proposals/proposal-block.tsx`,
  `views/block-editor.css`, `docs/system/documents/block-editor.md`, *Standing*, and
  `proposed-changes.md`). Nothing in the fixed layer and nothing in `ui.shell` changes, so this
  change document is this extension's member alone and the prefix is `DO`.
- It changes where and when the toolbar is drawn, not what it does: the three buttons, the pressed
  state, the write through `setStanding$`, the take-back and the announcement all stay.
- The other three paths are untouched: the swipe on a reading row, the view bar's **Standing**
  control with its *i*, and `Alt`+`Shift`+`ArrowLeft`/`ArrowRight`.
- Out of scope: what a standing means, what the scale holds, and the `prompt` standing off it.

## The Ask

1. In command mode no row carries the standing toolbar, whatever the pointer is doing and whether
   or not a block is being edited to point from.
2. In reading mode the selected row carries it.

## The Shape

* **The toolbar stands on the view bar's subject, in reading mode.** `DO_0006_001` already names
  one subject for the whole surface: the block being edited when there is one, else the block or
  the proposal the reader has turned to. The toolbar takes that same subject, so the row the bar
  names, the row that is ringed or holds the caret, and the row carrying the three buttons are
  always the same row. Nothing focused and nothing being edited means no toolbar anywhere, which
  is a document at rest. User decisions, 2026-09-23.
* **It goes when the focus goes.** Another row taking the focus, command mode, or a press outside
  the rows, the depth, a proposal and the bar lets it go and takes the toolbar with it. The ring
  and the buttons are one state. User decision, 2026-09-23. (The view bar at the top of the
  document is a different thing and stays, as it always does.) *Escape* was named here when the
  change was shaped and is not one of the paths: the focus rule (`CA_0046_001`, `DO_0006_003`)
  never had it, and nothing was added to give it one.
* **The block being edited carries it too.** Activation clears the focus and draws no ring, but
  the edited block is the subject, so it carries the buttons on its top border while the caret is
  in it — beside the bar's *Standing* group rather than instead of it. Its top border is free
  today: the card's label is not drawn on the block being edited, the depth's categories are drawn
  only on a focused row that is not active, and the command control stands below the **bottom**
  border (`BO_0267_012`), so nothing there is displaced. User decision, 2026-09-23.
* **A phone gets it, and the walk judges.** The first tap focuses a reading row and the second
  edits it (`CA_0046_001`), so the toolbar comes up on the first tap beside the swipe that was
  touch's path all along. At phone width it meets the depth's categories at the same leading end
  (`DO_0008_004`), and whether both can hold there is the walk's to say, not this document's. User
  decision, 2026-09-23.
- **The condition in the markup.** A focused row already carries `data-focused="true"`, set while
  `focused && !active && !marking`, and a proposal and a revealed discarded row carry it too
  (`DO_0006_010`, `DO_0006_012`). The edited row carries no attribute of its own — it is expressed
  by the children it renders — so the subject was never one selector. `DO_0014_002` settled it by
  drawing rather than hiding: the row renders the toolbar when `active || focused`, and
  `.standing-toolbar` is plain `display: flex`, so a button that should not be there is absent
  instead of hidden and nothing has to keep it out of the focus order. It is the idiom the depth's
  categories at the other end of the same border already use (`BO_0258_021`). The two rules under
  `@media (hover: hover)` and `:focus-within` that drew it in command mode are gone.
- **A proposal gets its buttons for the first time.** `BO_0272_010` gave a swipeable proposal the
  same `StandingButtons` inside `.proposal-block`, but the only rules that lift
  `.standing-toolbar` out of `display: none` name `.block-row`, and a proposal row is a sibling of
  the block rows, never inside one — so that control has never been visible in a browser. Its
  suite asserts the markup and presses through the DOM, so it passes with the control unseen. A
  proposal is a subject like any other row, so it carries the toolbar when it is focused or holds
  the caret, and `proposal-block.tsx` draws the buttons while reading rather than while
  commanding. User decision, 2026-09-23: fixed here, in the change that moves the control.
- **Pressing ✕ on the block being edited ends the edit.** `setStanding$` already ends the edit of a
  block it discards or makes a prompt, since both leave the flow. That is not new, but the edited
  block has never carried these buttons before, so the walk should expect it.
- **The marking control stays a `div`.** `BO_0231_001` made a text block's marking control a
  literal `div` around its words so the toolbar could stand beside it rather than inside a button.
  It stays when the toolbar leaves: its other reason is independent — a tag held in a variable
  compiles through `_jsxC`, which treats every attribute as immutable, so a block marked after it
  was drawn went on reporting that it was not. The row keeps its click and key handlers either
  way, so marking behaves exactly as it does now. Technical decision, 2026-09-23.

## Lines This Reverses

These are `*` lines, changed on the user's decision of 2026-09-23 and listed here so the transfer
does not have to rediscover them.

- `block-editor.md`, *Standing*: *in command mode a block's own standing toolbar sets it where the
  block is (`BO_0231`)* becomes *in reading mode the selected row carries its own standing
  toolbar*.
- `block-editor.md`, *Standing*: `BO_0231`'s *Command mode only: the reading surface stays
  content-only (decided 2026-09-10)* is reversed — the reading surface carries this one control,
  on its subject alone, drawn nowhere else.
- `proposed-changes.md`: *A proposal's standing is set in reading mode by the swipe and in command
  mode by the standing toolbar it now carries* — both paths are now reading's.
- `block-editor.md`, *A Marked Block Is A Card* (`DO_0008_004`): the border's leading end is
  shared in reading rather than in command mode, and at phone width the toolbar and the depth's
  categories meet there. The walk decides what gives.

## What This Is Not

- Not a change to what a standing is, how it is written, or how it is taken back.
- Not a change to command mode's marking, its numbers, or its passages.
- Not a change to the view bar, which keeps its **Standing** control and its *i* throughout.
