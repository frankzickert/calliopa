# BO_0263_FEAT_every-drawn-row-has-a-place

Status: completed

Requested: 2026-09-18, by the user: "in the doc editor, let proposed blocks also have a position.
right now, i cannot drag accepted content before/after proposed changes. also: when in command
mode, i also want to select proposed blocks. the same should apply to retired and discarded
blocks". The user made the decisions below the same day, and settled the open points in a second round.

Every row the block editor draws is a place in the document. A reader can drop a block before or
after a proposed block, a revealed retired block or a revealed discarded block. In command mode
they can mark any of them, and a run is told what each reference is.

## Scope

- The owning extension is `documents`: the block editor, the reading order and command mode's
  marking.
- It is a `BO` change because the kernel's run intake refuses these references today (Where This
  Starts). When the change is carried into the graph, this same document becomes a `documents`
  member.
- Not in scope:
  - Moving a proposal by its face. It already stages its own place (`BO_0233_007`).
  - A divider's missing grips (`block-editor.md`, the open divider line).
  - The view bar (`CA_0053`).

## Where This Starts

- **Only an established block's row is a drop target.** `BlockRow` carries
  `data-drop-target="block:<id>"` and a `DropMark` (`views/block-editor.tsx`). `ProposalBlock`,
  `RetiredRow` and `DiscardedRow` carry neither. The drop compiles into a `move` whose placement
  is `{before: <established block>}` or `{at: "end"}`. So a block cannot land directly before or
  after a proposed insert, or next to a retired or discarded row.
- **Proposed inserts already have a place.** An insert carries an order key minted when it was
  staged, and `placeProposals` (`views/reading-order.ts`) sorts it among the blocks. A rewrite
  sits right after its block. A removal or a move frames its block.
- **Retired and discarded blocks already have a place.** A retired block keeps the order key it
  held when it was retired (`document-panel.md`). A discarded block never left the order.
- **None of the three is markable.** These three lines say so, and each is a mutable `-` line:
  - `proposed-changes.md`: *A proposed item is not markable.*
  - `command-mode.md`: *A retired block is not markable.*
  - `document-panel.md`: *A discarded block is not markable.*

  In addition, `block-editor.md` says discarding a marked block takes its references with it, and
  `command-mode.md` drops a reference whose block has been discarded.
- **The kernel refuses them at intake.** `checkPointing` in `internal/kernel/agentbridge/bridge.go`
  refuses a reference to a block the document does not hold in its reading order. That covers a
  retired block and a proposed insert, which is still a candidate. A reference to a rewritten
  block passes, but the run is not told that the reader pointed at the proposed words. The run's
  note lists each reference as `#n → block <id>`. `Reference` carries a number, a block id, a kind
  (`block` or `passage`) and a quote.

## Decided

The user made these decisions on 2026-09-18.

- **A proposed block has a position.** A proposed insert is a drop target like any block. A block
  dropped on it lands directly before it, and a block dropped on the next row lands directly after
  it. The dragged block's new key falls between the two drawn rows, so it stays where the drop mark
  showed it even while the insert is still a proposal.
- **A rewrite, a removal or a move stays with its block.** The block and the proposals attached to
  it are one position. A block dropped on that pair lands before the pair. A dropped block never
  lands between a block and its rewrite.
- **Marking a proposal points at the proposal.** The run is told the reference is a proposal,
  who proposed it, and its proposed words.
- **A reference is what was marked.** It keeps what its target was at the moment of marking, and
  the run gets it that way even if the target was answered, restored or reopened since. The run is
  also told what has happened to it since: *since accepted*, *since rejected*, *since restored*,
  *since reopened*. This applies to proposals, retired blocks and discarded blocks alike.
  - If the proposal is accepted, the number moves to the block it became.
  - If it is rejected, the reference stays as a chip in the composer. It has no number in the
    document, because the row is gone, and it is taken back from the chip.
  - A reference to something answered in the meantime is not a reason to refuse *Run*.
- **Retired and discarded blocks get both.** A revealed retired row and a revealed discarded row
  are drop targets and are markable. The run is told the reference is retired or discarded.
  Discarding a marked block keeps its references.
- **Passages too.** Words inside a proposed, retired or discarded block can be referenced as a
  passage. The passage follows the same rules as a whole-row reference: it keeps its words as
  marked and follows an accepted proposal to its block.
- **A framed block and its frame are marked apart.** A removal or a move proposal frames its block.
  A click on the block's text marks the block. The proposal is marked through its own face or
  edge, so each has its own target.

## Shape

- **Drop targets:** every drawn row carries a drop target. The placement can name the position
  between two drawn rows, not only an established block. The server mints the key between those
  rows' keys: an established block, a proposed insert, a retired block or a discarded block all
  carry one. The move stays the same atomic move. Only its placement widens.
- **Marking:**
  - A proposal row, a retired row and a discarded row each take the marking control, its number
    and its treatment.
  - The treatments must still tell marked, proposed, retired and discarded apart by more than
    colour (`proposed-changes.md`, `document-panel.md`).
  - Marking stays device-local and sends nothing.
- **The reference record:** a reference gains what it points at: a block, a proposal (group and
  item), or a retired block. It also carries what was marked: the words, and for a proposal, its
  proposer. The record in `localStorage` reads older entries as block references, as `BO_0227` did
  for passages. When the document is read again, the reference's number moves to the block an
  accepted proposal became. A rejected proposal's reference stays in the record with no row to draw
  it on.
- **The kernel:** `Reference` gains the new kinds and carries the marked words and the proposer.
  - `checkPointing` accepts a retired block the document retired. It accepts a proposal reference
    whatever its group has done since, because the reference is what was marked.
  - The run's note says what each reference is and what has happened to it since: *proposed by …:
    "<words>" (since rejected)*, *retired block (since restored)*, *discarded block*.
  - For a passage in a proposal, the kernel checks the quote against the marked words rather than
    against the block in truth.
- **Chips:** the composer's chip for such a reference says the same thing, and it is how a
  reference with no row is taken back (`commands-and-runs.md` in `ui.shell`).

## Transferred

Set to draft by the user on 2026-09-18 and transferred the same day. The system work is enumerated
here:

- `documents` in the graph, `block-editor.md` *Every Drawn Row Has A Place*: `BO_0263_001` (the
  placement between two drawn rows), `BO_0263_002` (every drawn row a drop target),
  `BO_0263_003` (the walk).
- `documents` in the graph, `command-mode.md` *Marking Every Drawn Row*: `BO_0263_004` (the
  reference record), `BO_0263_005` (the rows take the marking control and passages),
  `BO_0263_006` (the report), `BO_0263_010` (the walk).
- `ui.shell` in the graph, `commands-and-runs.md` *References To What Was Marked*: `BO_0263_007` (the
  chips and the body).
- This repository, `docs/system/ui-kernel.md` *References To What Was Marked*: `BO_0263_008`
  (intake and check), `BO_0263_009` (instructions), `BO_0263_011` (verification).

Decided at transfer, technical: a reference names the revision that was marked, and the kernel
reads the words and the proposer from it rather than from the client (`ui-kernel.md`, *Each fact
travels from where it is true*).

Derived at transfer, confirmed when the user set the change ready: *a reference is what was marked* is
applied to every reference. A document's block that is retired or discarded after it was marked
keeps its reference as a chip saying *since retired* or *since discarded*, where today it is
dropped (`command-mode.md`).

## Implemented

Claimed and implemented 2026-09-18; the change is `wip` until the two walks on the served build.

- The kernel half is in this repository, uncommitted: `internal/kernel/agentbridge/marked.go` and
  `agenttools/marked.go`, with the intake in `bridge.go` and `http.go`. `BO_0263_008`, `_009` and
  `_011` are folded into truth in `docs/system/ui-kernel.md`. The instance runs it once the kernel
  image is rebuilt (`scripts/stack-up.sh`).
- The graph half (`documents` and `ui.shell`) is staged as one proposal carrying the code, the
  graph docs and this document. `BO_0263_001`, `_002` and `_004`–`_007` are folded into truth
  there. `BO_0263_003` and `BO_0263_010`, the walks on the served build, stay claimed.
- The derived rule that every reference is kept as it was marked was confirmed when the user set
  the change `ready`.

## A Grip On Every Row

Asked by the user after the walk, 2026-09-18: "i also want to be able to drag/reorder proposed,
discarded, retired blocks. reordering is not acceptance". The user decided the rest the same day,
in view of `BO_0265`, which moves the proposer's face to the bottom border:

- On a desktop in reading mode, every visible row shows its drag handle while the pointer is over
  it.
- On a phone, a single tap focuses a row and shows its ⠿ handle and ↑↓ arrows; a second tap edits.
- Reordering a proposal, a retired or a discarded block does not accept, restore or reopen it.
- *Restore* puts a retired block back where its row is drawn.

Enumerated as `BO_0263_012`–`BO_0263_016` in `documents`' `block-editor.md` (*A Grip On Every
Row*) and implemented the same day: `012`–`015` are folded into truth, and `016`, the walk on
the served build on a desktop and a phone, stays claimed. The walks `BO_0263_003` and
`BO_0263_010` passed at pin 112 and are folded into truth.

## Scrolling While Dragging

Asked by the user after walking the grips at pin 131, 2026-09-18, which worked: "on desktop and
mobile: when i drag and reach the top or bottom, then scroll that way so that i can reach all
places". It is the shell's shared drag model, so it lands in `ui.shell`'s `drag-and-drop.md` as
`BO_0263_017`, implemented the same day and folded into truth. `BO_0263_016`, the walk of the
grips, passed at pin 131, and `BO_0263_018`, the walk of scrolling while dragging, passed at pin
140. Every task is folded into truth, and the change completed 2026-09-18.
