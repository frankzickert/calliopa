# One Card Per Place

Status: completed

Requested: 2026-10-05, by the user, moved out of `BO_0350` (an inbox of decisions), where it was
`BO_0350_055`, so that change could complete without it.

`BO_0350` made a run's work a card: an open proposal group drawn as one decision, answered whole by a
swipe. Its user decision `BO_0350_Q11` says a card stands in one place, so a run stages one group for
each place it works on. What landed draws a card in each place a group's rows stand together, but a
run still stages one group: a run that works in two places is two cards on screen that a swipe on
either answers together.

## The Request

- A run opens one proposal group for each place it works on — a deepen's rewrite with the blocks it
  adds below one place, a gather its block — and each group is its own card, answered on its own.
- The run's report lists every group it staged.

## Decisions

* A place is the rows that stand together: a block the run rewrites or removes, and the blocks it
  adds directly beside it, with no untouched block between them. It is what `documents` already
  draws as one card, and the kernel derives it from what the run staged; the run decides nothing
  about places. User decision, 2026-10-05 (`BO_0351_Q1`).
* A run's chip answers the whole run: *Accept all* and *Reject all* answer every card it made, as
  they do today, and a swipe answers one card. User decision, 2026-10-05 (`BO_0351_Q2`).
- A card is a place of its run's one group, answered by deciding that place's members in one batch;
  the kernel and the core are unchanged. Splitting a run's group by place, as first transferred,
  would have needed new revisions of every member, leaving the relations anchored at them behind.
  Technical decision, 2026-10-05, recorded in `ui-kernel.md`, *One Card Per Place*.

## Questions

- No functional question stands open.

## Where It Lands

- In the graph: `documents`' Agent At Work, *One Card Per Place* — a card answered on its own, the
  server's group answer naming a card's items (`BO_0351_024`), and the release line (`BO_0351_022`).
- In this repository: `docs/system/ui-kernel.md`, *One Card Per Place*, which records that the kernel
  and the core are unchanged, and the release line in `docs/release-notes/unreleased.md`.
- The change document stands in the graph as a member of `documents`, at the status it holds here.
