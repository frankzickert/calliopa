# DO_0008_FEAT_a-marked-block-is-a-card

Status: completed

Requested: 2026-09-21, by the user, from reading a fixated block in the served editor: the
*fixated* label beside the block does not belong there.

Requested again the same day, from the same reading: a block with a border — a proposed claim, a
*Possible relation* card — overlaps what follows it, and the room a bordered row keeps must grow with
the border.

A block that carries a mark — fixated, discarded, retired, or a prompt the reader has shown — stops
wearing its label beside itself and becomes a card whose label sits on its top border, horizontally
centred. Nothing is drawn to the left of a block any more but the things the gutter is for: the
grip, command mode's reference number, the depth. The card stays visibly not a proposal and not a
suggestion.

## The Ask

1. **Every label to the left of a block goes.** The fixated and discarded words in the leading
   gutter, the discarded row's inline *Discarded* and the retired row's inline *Retired*.
2. **A marked block is a card.** A border around the block, with its label on the top border,
   horizontally centred.
3. **It still reads as neither a proposal nor a suggestion.**
4. **A bordered row keeps room to the block below it.** Enough that the chip standing over the bottom
   border clears the next block, and enough that two bordered rows do not abut.

## Where This Starts

Read from `documents`' docs and code at dataRevision 868:

- **The gutter mark** (*Standing*, `BO_0227_012`, `BO_0231_002`, `BO_0272_006`;
  `views/standing/standing-mark.tsx`, `.block-standing` in `views/block-editor.css`): a fixated or
  discarded block carries its glyph in the leading gutter and, from 44em up, its word in the margin
  to the left of that (`.block-standing__word`, absolutely placed past the gutter's inline start).
  A prompt carries the terminal glyph alone, because the word overran the gutter on a phone and was
  taken out for that reason (`BO_0267_024`). Keep carries nothing.
- **The two revealed rows carry their label inline, first in the row**: `.retired-row__mark`
  (*Retired*) in `RetiredRow` (`views/block-editor.tsx`) and `.discarded-row__mark` (*Discarded*)
  in `DiscardedRow` (`views/standing/discarded-row.tsx`), each a small uppercase word at the
  row's leading edge, before the words and before *Restore* / *Reopen*.
- **The words are the library's** (`lib/disposition.ts`): `MARK` gives the participle a block
  carries (*fixated*, *discarded*, *prompt*) and `GLYPH` the shape it is recognised by (◆, ✕), one
  table for every surface, so a state cannot be called two things in two places. *Retired* is not
  on the scale: it is a block out of the document's flow, and its word is written into the row.
- **The top border is already used, at both ends**: the standing toolbar sits at the leading end in
  command mode (`.standing-toolbar`, `BO_0231_004`), and the depth's three category buttons at the
  trailing end on the block the reader has turned to (`.block-depth-toolbar`, `BO_0258_021`). Both
  are `translateY(-55%)` over the border on `--panel-raised`. A centred label stands between them.
- **What a proposal looks like** (*Proposed Changes In Place*, `BO_0265_010`, `DO_0004_004`;
  `.proposal-block`): the proposer's ground and edge, the accepted block's geometry, and a chip on
  the **bottom** border at the leading end — the face, what the proposal does in words, and its
  answers — shown while the reader turns to it. A suggestion — the *Possible relation* card and the
  derived candidates — is a proposal drawn in the derived idiom, with its heading *inside* the card
  and the same proposer ground (`BO_0247_005`, `DO_0007`).
- **The row already says its standing**: `.block-row` carries `data-standing`, so the card and its
  label are drawn off a fact the row publishes rather than a second reading of the block.
- **A dead selector to sweep up with the rewrite**: `.block-standing[data-standing-mark="pin"]`
  still paints the accent, and `pin` stopped being a value when `BO_0272` narrowed the scale, so no
  fixated mark has carried the accent since. `.block-row[data-standing="resolved"]` is dead the
  same way.

## Decided

* Every label to the left of a block goes: the gutter's word, the discarded row's inline
  *Discarded* and the retired row's inline *Retired*. User decision, 2026-09-21.
* All four marked rows become cards labelled on the top border, horizontally centred — a fixated
  block, a revealed discarded block, a revealed retired block and a revealed prompt. User decision,
  2026-09-21.
* The glyph goes into the label, not the gutter: the label reads ◆ FIXATED, ✕ DISCARDED, and the
  prompt's terminal glyph beside PROMPT. The leading gutter is left to the grip, the reference
  number and the depth. User decision, 2026-09-21.
* A card takes no proposer colour: the page's own ground, a muted border whose style says which
  mark it is, and the label on the top border — a place no proposal puts anything, since a
  proposal's chip is on the bottom border and a suggestion's heading inside the card. User
  decision, 2026-09-21.
* A bordered row reserves the room that what stands over its borders takes: below, the half of the
  chip that hangs past the bottom border, so a shown chip never covers the block that follows;
  above, the half of the label that hangs past the top one. The room is held at rest, so showing a
  chip or a toolbar still moves nothing — what goes is only the rule that a proposal is spaced like
  an ordinary block (`DO_0004_005`). It applies to every bordered row, the four cards and the
  proposals and suggestions that were bordered before them. User decision, 2026-09-21.

- The label keeps saying what the block *is* rather than what a press would do, as the gutter mark
  did: participles, from `MARK` in `lib/disposition.ts`, so the word stays the library's. *Retired*
  joins them as the fourth word, since the fourth card needs one and a second table would let the
  row and the scale drift apart.
- The state rests on more than colour still: the glyph in the label, the word in the label, and the
  border's style — one per mark — so a monochrome rendering tells the four apart.
- A card changes the row's geometry where the gutter mark changed only its colour. That is the
  point: a marked block is meant to read as set apart from the flow, and the four marks are all
  states someone acted into.

## Transferred

- Transferred on 2026-09-21 into [Block Editor View](../system/documents/block-editor.md#a-marked-block-is-a-card),
  *A Marked Block Is A Card*, `DO_0008_001`–`DO_0008_009`. The room a bordered row keeps is
  `DO_0008_009`, transferred the same day with the fixed line it replaces in
  [The Agent At Work](../system/documents/agent-at-work.md#the-proposal-chip); `DO_0008_007` and
  `DO_0008_008` carry it into the release note and the walk. Nothing transfers to `ui.shell`: the
  rows, their marks and their CSS are this extension's own drawing, and the bar's *Standing*
  control is unchanged. `document-panel.md`'s account of the retired, discarded and prompt rows is
  revised by `DO_0008_006` in the same proposal group.

## Implemented

- Implemented 2026-09-21 (`_001`–`_007`, folded into truth in [Block Editor View](../system/documents/block-editor.md#a-marked-block-is-a-card)). Nothing marks a block to its left any more: `CardLabel` (`views/standing/standing-mark.tsx`) draws the mark's face and its word on the row's top border, and a fixated block, a revealed discarded block, a revealed retired block and a revealed prompt are each drawn as a card — the page's own ground, a muted border styled per mark, the label centred over it. `MARK` in `lib/disposition.ts` gained *retired* so the four words stay one table, `GLYPH` says which marks are recognised by an icon instead, and `.block-standing`, the two inline row marks, the retired row's inset edge, the prompt's own border rule and the rules that hid its glyph behind the grip are all gone, along with the two selectors `BO_0272` left naming values the scale no longer has. Verified on the tree at dataRevision 908: `tsc --noEmit` clean, the unit project 120 files and 1038 tests, both bundles built with no warning of ours, and `views/standing/marked-cards.test.ts` added to the render harness. The release-notes line (`_007`) is in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, under *Changed*. `_009` is open and untouched by this: the room a bordered row keeps is the next thing to land, and the card's margins here are what it revises. The walk is `_008`.

## From The Walk

- Walked on the served build at pin 917, 2026-09-21, and accepted by the user: the four marked rows
  are cards labelled on the top border, nothing marks a block to its left, a kept block is drawn as
  it always was, and a card is neither a proposal nor a suggestion at a glance. `_008` is folded
  into truth.
- `_009` implemented the same day, folded into truth beside the rest: `--row-chip-overhang`,
  `--row-label-overhang` and their sum `--row-overhang` are named on the view, and a card, a
  proposal and a derived suggestion each keep that as their block margin. The sum, not each side's
  own, because adjacent margins collapse to the larger of the two. `tsc --noEmit` clean, the unit
  project 120 files and 1041 tests, both bundles built. The gap cannot be measured here — the
  render harness has no layout engine and Playwright is not installed — so `_010` walks it.
- The change stays at `wip` until that walk, and the graph export runs then.

## Open Questions

- None.
