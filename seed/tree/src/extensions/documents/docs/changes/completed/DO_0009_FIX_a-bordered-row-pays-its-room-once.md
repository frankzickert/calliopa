# DO_0009_FIX_a-bordered-row-pays-its-room-once

Status: completed

Requested: 2026-09-21, by the user, from reading the served editor after `DO_0008`: the room a
framed row keeps is right for a *Possible relation* card and right for an ordinary block, but the
gap between one agent proposal and the next is too big.

`DO_0008_009` gave every bordered row `--row-overhang` as its block margin, on the ground that two
neighbours' margins collapse to the larger of the two, so the room is paid once. That is true of the
rows the editor draws directly. It is not true of the rows it wraps in a drop slot: the slot holds a
2px drop mark above the row, and a box between two margins is exactly what stops them collapsing, so
those rows pay the room twice. An agent proposal — an insert or a rewrite, the kinds that have a
place — is always in a slot, and a *Possible relation* never is, which is why one reads right and
the other does not.

## The Ask

1. **A bordered row keeps its room once, wherever the editor draws it.** The gap between two agent
   proposals reads like the gap between two *Possible relation* cards.
2. **Nothing else moves.** Ordinary blocks, cards, relation cards and a proposal meeting a card keep
   the spacing the user has already accepted.

## Where This Starts

Read from `documents`' docs and code at dataRevision 1056:

- **The room** (*A Marked Block Is A Card*, `DO_0008_009`; `views/block-editor.css`):
  `--row-chip-overhang` (0.875rem, half the 28px chip), `--row-label-overhang` (0.5rem, half a
  card's label line) and their sum `--row-overhang` (1.375rem), which `.proposal-block` and the four
  card rows carry as `margin-block`.
- **What the editor puts a row in** (`views/block-editor.tsx`): `dropSlot` wraps a row in
  `.drop-slot` with a `DropMark` above it, and it is used for a proposal that has a place
  (`positionOf(entry) !== null`), for a revealed discarded row and for a revealed retired row. A
  block row holds its own drop mark *inside* its box, so nothing stands between its margin and its
  neighbour's. A work item — a *Possible relation*, a proposed claim, a kind, a state, a reason —
  has no place, so it is drawn bare, with no slot.
- **The drop mark is a box, not a line** (`.drop-mark`): `height: 2px` and `margin: 0.1rem 0` at
  rest, transparent until a drag is over it, "reserved rather than inserted, so the document does
  not jump". Reserved is what makes it separate the two margins.
- **`.drop-slot` has no rule of its own** in `views/block-editor.css`.
- **What `DO_0008_009` measured**: the fixture it was measured on put `.proposal-block` elements
  next to each other as siblings, with no slot and no drop mark, and so measured the collapse the
  editor does not do. Its 22px between two proposals is the number a relation card gets, not the
  number an agent proposal gets.

## Measured

Chromium 1.62.1, a fixture carrying `global.css`, `block-editor.css` and `shell.css` in the shell's
order and the editor's own DOM — `.blocks`, block rows holding their drop mark, slotted proposals
and bare work items. 1000px and 390px give the same numbers.

| gap | now | `DO_0008_009` claimed |
| --- | --- | --- |
| ordinary block → ordinary block | 10px | 10px |
| **agent proposal → agent proposal** | **46px** | 22px |
| *Possible relation* → *Possible relation* | 22px | 22px |
| revealed discarded row → revealed retired row | 46px | — |
| agent proposal → ordinary block | 28px | — |
| agent proposal → card | 22px | 22px |
| ordinary block → card | 22px | — |

A shown chip clears the proposal below it by 33px where 15px is the room it needs, which is the 46px
read as too much air.

## Shaped

- The room belongs to the row the document's flow holds, which is the slot where there is one: the
  slot carries `--row-overhang` and the row inside it carries none. Two slotted rows then stand
  25.6px apart — the 22px the margins collapse to, plus the 2px drop mark and its lower margin, now
  inside the gap rather than added to it — where a relation card's pair stands at 22px. Measured on
  the same fixture: nothing else in the table above changes, and a shown chip clears the proposal
  below it by 12.6px.
- It is the whole defect, not the proposal's half: a revealed discarded row and a revealed retired
  row are slotted the same way and come back to 25.6px with it.
- `DO_0008_009`'s account in [Block Editor View](../system/documents/block-editor.md#a-marked-block-is-a-card)
  and [The Agent At Work](../system/documents/agent-at-work.md#the-proposal-chip) carries numbers
  the editor does not have, and is revised with the fix rather than left standing.
- The fixed line `DO_0008` wrote — a bordered row keeps room to the blocks around it, nothing it
  draws covers a neighbour, two bordered rows never abut — is what the fix makes true. Nothing
  weakens it.

## Transferred

- Transferred on 2026-09-21 into [Block Editor View](../system/documents/block-editor.md#a-marked-block-is-a-card),
  *A Marked Block Is A Card*, `DO_0009_001`–`DO_0009_006`. The two lines `DO_0008_009` left there
  carrying numbers the editor does not have are corrected in the same edit: the collapse the sum
  rests on is named as something only an unslotted row gets, and the fixture's 22px between two
  proposals is said to be the collapse it measured rather than the gap the editor draws.
  [The Agent At Work](../system/documents/agent-at-work.md#the-proposal-chip)'s account of the room
  the chip takes says which element carries it and stops repeating the gaps, which are measured in
  one place. Nothing transfers to `ui.shell`: the slot, the drop mark and the room are this
  extension's own drawing.

## Implemented

- Implemented 2026-09-21 (`_001`–`_005`, folded into truth in
  [Block Editor View](../system/documents/block-editor.md#a-marked-block-is-a-card)). `.drop-slot`
  carries `--row-overhang` and `.proposal-block`, `.discarded-row` and `.retired-row` carry none
  inside one, so the drop mark falls inside the room rather than adding to it; a row drawn without
  a slot keeps its own margin as before. Verified on the tree at dataRevision 1091: `tsc --noEmit`
  clean, both bundles built with no warning of ours, and the two new harness cases pressed and
  shown to bite. Measured in Chromium at 1000px and at 390px: two agent proposals at 25.6px where
  they stood at 46px, the two revealed rows the same, and nothing else in the table moved.
- The `documents` view suites cannot be loaded by the unit harness at head — `Cannot find package
  '@qwik-city-sw-register'`, the failure the scratchpad noted at dataRevision 1053 — so the runs
  above were made with that virtual module and `@qwik-city-plan` stubbed by a local config that is
  not committed. With it, 11 of the 44 `documents` files fail and 63 of 395 tests, the same count
  before this change as after: the breakage is head's, not this change's, and `DO_0009_007`, in the shell's
  [Verification](../../../../../../docs/system/foundation/verification.md), is the task for it.
- The change stays at `wip` until the walk (`_006`), and the graph export runs then.

## From The Walk

- Walked on the served build at pin 1177, 2026-09-22: the *Possible relation* card's spacing is
  exactly right, and two agent proposals still stood further apart than it. The editor's own DOM,
  taken out of the render harness and measured in Chromium, agreed — 25.6px against the card's
  22px — so what the first fixture had called a small residue was the whole of what the walk saw.
  `_008` takes it out: the slot's margin is `--row-overhang` less `--drop-mark-height` and the mark
  inside a slot carries none of its own, so the mark stands inside the room rather than beside it
  and every bordered pair comes to 22px, slotted or not. Measured at both widths, `tsc --noEmit`
  clean and both bundles built. `_006` walks it again.
- Walked on the served build at pin 1195, 2026-09-22, and accepted by the user: a run of agent
  proposals stands exactly as far apart as two *Possible relation* cards, and nothing else moved.
  `_006` is folded into truth. `DO_0009_007` stays open in the shell's
  [Verification](../../../../../../docs/system/foundation/verification.md) and is not this change's:
  the unit project cannot load the `documents` view suites at head, which predates it.

## Open Questions

- None.
