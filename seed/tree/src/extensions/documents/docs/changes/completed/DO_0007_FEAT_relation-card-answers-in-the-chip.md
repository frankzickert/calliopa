# DO_0007_FEAT_relation-card-answers-in-the-chip

Status: completed

Requested: 2026-09-21, by the user, from answering a proposed relation in the served editor.

A proposed relation answers where every other proposal answers. The *Possible relation* card's two
answers — *Confirm relation* and *Not related* — move onto the chip on its bottom border, as the ✓
and the ✗ an agent's proposal carries there, and *Edit reason* goes: the reason is editable where it
is read, so a press in it is already what puts the caret there.

## The Ask

1. **The answers move into the chip.** *Confirm relation* and *Not related* leave the card's body
   and become the chip's two answer icons, in the style an agent's proposal uses.
2. **Edit reason goes.** It only focused the reason, which a press in the reason does by itself.

## Where This Starts

Read from `documents`' docs and code at dataRevision 825:

- **The card today** (*Proposed Changes In Place*, `BO_0247_005`; `PossibleRelation` in
  `views/proposals/proposal-block.tsx`): an inferred relation under its source block in the derived
  idiom — an *Inferred* chip, the claim it anchors on, the kind, the target quoted with its
  document, *Origin: system-inferred*, *Reason: system-drafted*, the reason editable in place, and a
  row of three buttons of its own (`data-relation-answers`, with `data-relation-edit`,
  `data-relation-confirm`, `data-relation-dismiss`).
- **The chip is already drawn on the card** (`proposal-block__mark`, `BO_0265_010`, `DO_0004_003`,
  `DO_0004_004`): every proposal row carries it on its bottom border — the face, what the proposal
  does in words, and its answers in one border at one size — hidden at rest, shown while the
  proposal is hovered or holds the focus, and kept while it is the focused row (`DO_0006_010`). For
  a `relate` item its words read the run's own note when it gave one and *Possible relation*
  otherwise (`itemWords`, `DERIVED_WORDS`, `lib/agent-at-work.ts`), which is why the card keeps its
  heading line.
  What the card lacks is the answers: `ProposalBlock` suppresses `proposal-block__answers` for an
  inferred relation precisely because the card carried its own.
- **The reason needs no button** (`ProposalReason`): the paragraph is `contenteditable` whenever
  `settleReason$` is given, so a press in it puts the caret there; *Edit reason* did nothing but
  `focus()` that element. Leaving an edit, or a pause in the typing, accepts the item with the edit
  on top (`BO_0233`, `BO_0244_010`), and that stays as it is.
- **The words are the card's** (`kindNoun`, `lib/proposals.ts`): the generic answer names for a
  `relate` item read *Accept the system's relation* and *Reject the system's relation*. The card's
  own words say something the generic ones do not — confirming an inferred relation is not accepting
  a rewrite, and *Not related* says the relation is not there rather than that it is refused.
- **What restates the card** outside this extension: `calliopa-refine`'s `docs/system/system.md`
  names the card's three buttons, and its `views/decision/relation-card.test.ts` presses them in the
  render harness. Both follow the code in the same proposal group (`AGENTS.md`, The Docs In The
  Graph).
- **A neighbouring change agrees.** `BO_0258_014` (at `[ ]` in *A Derived Candidate Is Answered*)
  gives a derived candidate the answer controls a proposal block draws, for the same reason: one way
  of answering, drawn in one place.

## Decided

* The *Possible relation* card's answers are the chip's, drawn as an agent's proposal draws them —
  the ✓ and the ✗ in the chip on the bottom border, at the chip's size — and the card's own row of
  buttons goes. User decision, 2026-09-21.
* *Edit reason* goes. The reason is answered by editing it where it is read, and nothing else the
  button did is lost. User decision, 2026-09-21.

* The two icons keep the card's words as their accessible names — *Confirm relation* and *Not
  related*. User decision, 2026-09-21.
* The card keeps its heading line, *Possible relation* with the *Inferred* badge: the chip carries
  the run's own note when it gave one, so the heading is the only line that always says what the
  card is and that it was inferred. User decision, 2026-09-21.
* A phone reaches the answers as it reaches any proposal's: one tap brings the chip up, the second
  answers. Parity with an agent's proposal is worth the tap. User decision, 2026-09-21.

- The two icons keep the card's words as their accessible names — *Confirm relation* and *Not
  related* — rather than the generic *Accept the system's relation*. The card's language was chosen
  for what confirming an inferred relation means (`BO_0247_005`) and only its place changes.
- The card keeps everything else: the derived idiom, the *Inferred* chip, its lines, and the reason
  editable in place with an edit accepting on top.
- The answers now come up with the chip rather than standing in the card at rest — hovered, tapped
  once on a phone, or while the card is the focused row. That is what every proposal does, and it is
  what the ask asks for.

## Transferred

- Transferred on 2026-09-21 into [Proposed Changes](../system/documents/proposed-changes.md#the-relation-card-answers-in-its-chip),
  *The Relation Card Answers In Its Chip*, `DO_0007_001`–`DO_0007_006`. Nothing transfers to
  `ui.shell`: the card and its chip are this extension's own drawing. `calliopa-refine`'s harness
  (`DO_0007_003`) and its doc line (`DO_0007_004`) follow the code in the same proposal group.

## Implemented

- Implemented 2026-09-21 (`_001`–`_005`, folded into truth in [Proposed Changes](../system/documents/proposed-changes.md#the-relation-card-answers-in-its-chip)). The *Possible relation* card is answered from the chip on its bottom border, with the ✓ and the ✗ every proposal carries and the card's own words on them (`INFERRED_RELATION_NAMES`, `lib/proposals.ts`); the card's row of buttons, *Edit reason*, the host ref it needed and its CSS are gone, and the reason is unchanged — a press puts the caret in it and a pause or a leave accepts with the edit on top. `calliopa-refine`'s `system.md` and both render harnesses travel in the same proposal group. Verified on the tree at dataRevision 842: `tsc --noEmit` clean, 119 unit files and 1035 tests, both bundles built, and each new assertion shown to fail with its code taken out. The release-notes line (`_005`) is in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, under *Changed*. The walk is `_006`.

## From The Walk

- Walked on the served build at pin 846, 2026-09-21, and accepted by the user: the card is answered
  from its chip, the ✓ and the ✗ do what the card's buttons did, the reason still takes the caret
  from a press in it, and the phone's first tap brings the chip up — the row needed no tab stop of
  its own. `_006` is folded into truth and the change is complete.

## Open Questions

- None.
