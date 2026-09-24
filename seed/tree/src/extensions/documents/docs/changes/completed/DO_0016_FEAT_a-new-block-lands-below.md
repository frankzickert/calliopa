# A New Block Lands Below

Status: completed

Completed 2026-09-24: every task is folded into truth in [Block Editor View](../../system/documents/block-editor.md#a-new-block-lands-below), the user's walk at pin 2429 (`DO_0016_007`) included, and the *Add …* exception stands in [Proposed Changes](../../system/documents/proposed-changes.md#the-bar-acts-on-a-proposal).

A new block does not always open where the reader asks for it. The user reported it on
2026-09-24: "when i click below the lowest block (even if that is a proposed block), i want to
open a new block below that position. and when i have a block selected or active and click add
new block, then i want that block to be added directly below that. no matter what the state or
type or kind of that block is".

## What The User Decided

- Clicking the area below the lowest row opens a new paragraph directly below that row, whatever
  the row is: an established block, or a proposal drawn there. That includes a proposed insert
  that is not accepted yet. The new block goes below the row the reader sees last, never above it.
- *Add paragraph* (and the bar's other *Add …* controls) places the new block directly below the
  subject, which is the block being edited or the row the reader has turned to. This holds
  whatever the subject's standing, state, type or kind is: text in any role, a table, code, an
  equation, a divider, media, a prompt, a retired or discarded row shown, or a proposal.
- **Adding below a proposal leaves it open.** The proposal stays unanswered, and the new block is
  placed directly below where the proposal is drawn. User decision, 2026-09-24. This narrows the
  fixed line in `proposed-changes.md` (*a press in one of them accepts the proposal first and then
  acts on the block the acceptance established*, user decision 2026-09-21) for the *Add …*
  controls only. *Turn into*, *Retire* and *Standing* still accept first.
- **With a block active, clicking below the lowest row still takes two presses.** The first press
  ends the edit, and the second opens the new block (`CA_0028_002`, `block-editor.md`). User
  decision, 2026-09-24.
- **What the reader sees is what counts.** Every placement is decided from the rows drawn under
  the reader's current filters: the proposals toggle and the groups shown, *Show retired blocks*,
  *Show discarded blocks* and *Show prompts*. A proposal that is drawn (the toggle is on, or its
  group is shown) is a row the new block goes after. A hidden proposal is not, so the new block
  goes below the last visible row, and the proposal is drawn after it once shown. A retired,
  discarded or prompt row counts exactly when it is shown. User decision, 2026-09-24.
- **Every drawn row can be the bar's subject.** A table, code, equation, image, video or divider
  row takes the focus from a tap or click (focusing without editing) and from the keyboard (Tab to
  the row, Enter or Space focuses it), as a text row does, not from a hovering mouse alone. A
  shown retired row takes the focus too, and *Add …* places below it; *Restore* stays its own
  control. User decision, 2026-09-24.

## What Happens Today

- `startWriting$` (`views/block-editor.tsx`) decides the click below the last block from
  `state.document.blocks`. That list holds only the document's established blocks, so a
  proposal drawn at the bottom is invisible to it:
  - When the last established block is an empty paragraph, the click activates that paragraph,
    which sits above the proposal, instead of opening a block below the proposal.
  - Otherwise `appendBlock$` inserts at `{ at: "end" }`, and the server's `orderFor` resolves
    that against established blocks only. A proposed insert whose order key comes after the new
    key is then still drawn below the new block.
- The bar's *Add …* controls on a focused proposal go through `acceptThenAct$`. It accepts the
  proposal, then inserts after the block the acceptance established. When the item's kind is not
  in `SWIPEABLE_PROPOSALS` (`replace`, `insert`, `move`), the press does nothing at all.
- `insert$` sends `{ after: <blockId> }`. The server refuses that for a block it does not hold,
  such as a proposed insert's own block (*Nothing to place that after*).

## Scope

- The owner is `documents`, which holds the editor, its bar groups and its `insert` command. So
  this change document is its member and the prefix is `DO`.
- The placement is decided from the rows as drawn (`drawnRows`, `reading-order.ts`), the way
  `restorePlacement` already decides a restore (`BO_0263_012`). It is not decided from the
  established blocks alone. When the row below which the block goes is a proposal, the new
  block's order key falls between that proposal's key and the next drawn row's key, so it reads
  directly below it both before and after the proposal is answered.
- The trailing-empty-paragraph rule (*clicking the empty area repeatedly cannot stack blocks that
  say nothing*) holds only when that empty paragraph is the lowest drawn row.
- Command mode keeps its rule that a click below the last block does nothing
  (`command-mode.md`).
- Found on 2026-09-24: a block row takes the focus from a press or a key only in its text
  reading element (`BlockRow`, `views/block-editor.tsx`). Every other kind takes it from
  `onPointerEnter$`'s hover alone, which a touch screen and the keyboard never reach. A retired
  row (`RetiredRow`) has no focus path at all, and a discarded row (`DiscardedRow`) and a proposal
  (`ProposalBlock`) already have one.
