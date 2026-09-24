# DO_0006_FEAT_block-controls-before-editing

Status: completed

Requested: 2026-09-21, by the user, from using the document's bar in the served editor.

The bar's block groups do not wait for the caret. A block the reader has turned to — focused, not
yet being edited — already puts the controls that act on the whole block in the bar: its standing,
*+ Paragraph*, *+ Divider*, *Retire*, its text role. Only the inline formatting, which acts on a
text selection, waits for editing to start.

## The Ask

1. **Block groups on a focused block.** While a block is focused and not being edited, the bar
   draws the groups that act on the block as a whole and they act on that block: *Standing*, and
   *Block* (*+ Paragraph*, *+ Divider*, *Retire*).
2. **Inline formatting only while editing.** *Format* — bold, italic and the rest, the link toggle
   and its address field — appears when the block becomes editable, because it acts on the
   selection inside it.

## Where This Starts

Read from `documents`' docs and code at dataRevision 714:

- **The line today** (`block-editor.md`, *Presentation*, fixed, user decision 2026-09-18 under
  `ui.shell`'s `CA_0053`): the groups are *View*; then, *only while a block is active*, *Format*,
  *Turn into*, *Block*, *Standing* and *History*, each its own group; and, trailing, *Document*.
  *With no block active the block groups and their separators are absent and nothing else moves.*
  The ask changes the condition on that middle run of groups, so the fixed line is rewritten rather
  than added to.
- **What contributes them** (`views/block-editor.tsx`, the bar's `useTask$`, `CA_0053_006`). The
  task tracks `editor.blockId` — the block being edited — and pushes the five groups only when it
  is not `null`. `editor.position` names the block controls (*Insert paragraph after block 3*), and
  *Standing* is pushed only for a text block. Nothing tracks `state.focusedBlockId` today.
- **Focus is already a state the view holds** (`state.focusedBlockId`). A phone's first tap focuses
  a row and a second edits it (`CA_0046_001`); the keyboard focuses a row; and on a desktop a row
  focuses itself once the pointer has rested on it for 200 ms and lets go when the pointer leaves,
  unless the keyboard holds it (`DO_0004_002`), while one click edits at once (`DO_0004_001`).
- **The bar is the shell's and needs no change** (`ui.shell`'s `layout.md`, *The View Bar*): the
  shell draws the groups it is given, in order, with a line between two drawn groups and none at an
  edge, and the bar re-renders alone, so tracking one more field costs the document no render.
- **The grain is already there** (`CA_0058_011`): *Take back* stands in the trailing *Document*
  group, drawn whenever the bar is, precisely because *a standing is most often set on a block that
  is not active — by the swipe or the chord — and the block groups stand only while one is*. This
  change removes the reason that sentence had to be written.
- **Other paths to a standing stay** (`block-editor.md`, *Standing*): the swipe on touch, and
  `Alt`+`Shift`+arrow on a focused reading row. The bar becomes a third path to the focused block's
  standing rather than the only one for the block being edited.
- **What a press would do.** *+ Paragraph* inserts after the named block and activates the new one
  (`insert$`), so pressing it from a focused block starts editing the paragraph it creates.
  *Retire* and a standing write without activating anything.
- **Rows that are not blocks of the document can hold focus too** (`BO_0263_014`): a proposal row, a
  revealed retired row and a revealed discarded row focus on a tap and carry their own controls
  (*Restore*, *Reopen*, a proposal's answers). A proposal's text is edited, which accepts it, while
  its drag and its arrow steps stage a place into its group without answering it (`BO_0233_007`).

- **Two other changes are rewriting this bar.** `calliopa-bootstrap`'s `BO_0272` (at `idea`, every
  question answered 2026-09-21) narrows the standing scale to `discard · keep · fixate`, adds a
  popover to the shell's bar vocabulary and gives a proposal its own standing toolbar; its swipe on
  a proposal accepts rewrites, inserts and moves, which is this change's rule for a bar press on a
  proposal, so the two agree. `ui.shell`'s `CA_0058` is rewriting the bar's trailing group. Whoever
  transfers second reads the other's lines first rather than transferring blind.

## Decided

* While a block is focused and not being edited, the bar draws the groups that act on the whole
  block — *Standing*, *Block* (*+ Paragraph*, *+ Divider*, *Retire*) and *Turn into* — and they act
  on that block. *Format* and *History* stand only while the block is being edited: *Format* acts
  on a selection, *Undo* and *Redo* are the block's transient text history, and *Done editing* has
  nothing to leave. This replaces *only while a block is active* in `block-editor.md`,
  *Presentation* (`CA_0053`). User decision, 2026-09-21.
* On a desktop, hovering brings the groups up and they stay: a row focuses once the pointer has
  rested on it, and it keeps its focus and its ring until another row takes focus, until a block is
  edited, or until a press lands outside the document. The pointer leaving a row no longer lets its
  focus go, so the bar never empties behind the pointer and the block its controls name is always
  visibly focused. This replaces `DO_0004_002`'s *`unfocus$` lets it go when the pointer leaves*.
  User decision, 2026-09-21.
* The block being edited is always the block the bar acts on. While a block is being edited,
  hovering another row focuses nothing and does not end the edit; a press outside the block ends it.
  User decision, 2026-09-21.
* A proposed block is worked with as an ordinary block: focusing it brings the same groups up, and
  a press in one of them accepts the proposal first and then acts, as typing into a proposed block
  already does. Rejecting stays the way a proposal goes away. User decision, 2026-09-21.
* A revealed discarded row brings the groups up as a block of the document does — *Standing* is a
  second way off discarded, beside the row's own *Reopen*. A revealed retired row brings none up:
  it is out of the document's flow and keeps *Restore* on its row alone. User decision, 2026-09-21.

- A phone is unchanged in how a block is focused: the first tap focuses and the second edits
  (`CA_0046_001`). What changes there is what the bar holds after that first tap.
- *Take back* stays in the trailing *Document* group. A standing is still set on rows the bar never
  names — by the swipe and by `Alt`+`Shift`+arrow — so the action that takes one back has to stand
  whenever the bar does.

## Implemented

- Implemented 2026-09-21 (`_001`–`_006`, folded into truth in [Block Editor View](../system/documents/block-editor.md#the-bar-before-editing) and [Proposed Changes](../system/documents/proposed-changes.md#the-bar-acts-on-a-proposal)). The bar names one subject — the block being edited, else the block or proposal the reader turned to — and *Turn into*, *Block* and *Standing* follow it while *Format* and *History* wait for the caret. Hover focus holds and draws its ring; `unfocus$` is gone. *Turn into* revises an unedited block from the document's own revision. A proposal's press accepts it first and acts on the block it became, with what the press does travelling as data rather than as a function across the acceptance; `BO_0272`'s swipe, which landed the same day, now takes that one path too. A revealed discarded row is a subject; a revealed retired row is not. Rebased onto `BO_0272`'s three-state scale, which landed mid-implementation, and verified there: typecheck clean, 117 unit files and 1017 tests, both bundles built, every new assertion shown to bite. The walk is `_007`, the one task still open.

## From The Walk

- Walked on pin 766, 2026-09-21. The holding focus works. One thing came back: while a proposal was being edited, a hovered block still took the bar — the rule said *a block being edited*, and a proposal being edited is not one. The user's decision closes the gap both ways: a proposal being edited counts as something being edited, and a proposal is a row under the hover rule like any block, so resting on one focuses it and holds it (`DO_0006_008`). The second walk is `DO_0006_009`.
- Walked again on pin 774, 2026-09-21. Both halves work. One thing came back: a proposal the bar acts on could not be told from the proposals beside it, since a proposal carried no focused treatment of its own. It is now drawn as a focused block is — the ring, and its chip kept when the pointer moves away (`DO_0006_010`). The third walk is `DO_0006_011`.
- Walked again on pin 783, 2026-09-21. The ring was there and still did not tell the proposal apart: `--selection`, the tint it was drawn in, is 10% to 22% alpha, which a proposal's own coloured ground swallows. The ring is now one weight for every kind of row — `--block-focus-width`, solid `--accent`, heavier than the 1px edge a proposal carries and the hairlines a discarded row does — and a revealed discarded row carries it too (`DO_0006_012`). The fourth walk is `DO_0006_013`.
- Walked on pin 811, 2026-09-21, and accepted. The change is complete: the bar's block groups come up on a focused block, a proposal or a revealed discarded row, hovering is one rule that takes nothing while anything is being edited, and one ring says which row the bar acts on.

## Transferred

- Transferred on 2026-09-21 into `documents`' docs: [Block Editor View](../system/documents/block-editor.md#the-bar-before-editing), *The Bar Before Editing*, `DO_0006_001`, `_002`, `_003`, `_005`, `_006` and the walk `_007`; [Proposed Changes](../system/documents/proposed-changes.md#the-bar-acts-on-a-proposal), *The Bar Acts On A Proposal*, `_004`. Nothing transfers to `ui.shell`: the shell draws the groups it is given, so only what this view contributes changes. `BO_0258` puts a focused block's two refinement gestures in a bar group beside these (`BO_0258_017`), so the subject rule `_001` names is the one that group reads too.

## Open Questions

- None. The answers are folded above (2026-09-21).
