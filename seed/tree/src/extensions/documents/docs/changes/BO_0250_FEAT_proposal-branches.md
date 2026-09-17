# BO_0250_FEAT_proposal-branches

Status: completed

Requested: 2026-09-13 as the last part of `BO_0243` (decision and refinement). Rescoped
2026-09-16, when the user retired `BO_0243` for Calliopa's purpose as a general workplace: this
change keeps what any workplace needs — a person works on a document in a proposal of their own,
and nothing they do there changes what others rely on until it is accepted. The decision-specific
half — semantic reconciliation judged by a run, synthesis of disagreement, and branches offered
only on accepted roots — belongs to `calliopa-refine` and is not part of this change.

## Where This Starts

Implemented 2026-09-15 under the original scope, before the rescope:

- **The core half fits the new scope as built** (`ccgw.md`, `BO_0250_001`–`BO_0250_004`): a
  person stages proposal-scoped as a human; the settled mark (`SETTLE` / `UNSETTLE PROPOSAL …
  MEMBER …`); the standing read per member against head (`GET /v1/proposals/<id>/standing`); a
  rejected group readable through the overlay.
- **The kernel half is mostly general** (`ui-kernel.md`, Proposal Branches): a person's run
  proposes into their branch (`_005`); the settle verbs on the review bridge; the tools read
  through a branch (`_007`). The reconcile run (`_006`) is `calliopa-refine`'s: a system run under
  the `refine` intention recording a `reconcile` judgement.
- **The shell half lives in `documents` but is gated on the decision model**
  (`documents/document-panel.md`, `BO_0250_010`–`_018`): *Work in a proposal* is offered only on
  an accepted root, a phase `documents` does not define and a general install never sets; and
  *Accept this proposal* opens the reconciliation card, which asks for the reconcile run whenever
  a member drifted. On an install without `calliopa-refine` the control never appears and a
  drifted branch could never be accepted through the card.
- **Open under the original scope:** `BO_0250_008` (claimed; the live walk with two accounts and
  a reconcile run), `BO_0250_009` (functional question: does an accepted root refuse direct
  edits), `BO_0250_019` (Playwright on the served build, including the card's reconcile readings).
- **The change document is not in the graph**, although its shell half landed there.

## Intent

* **A person may work on any document in a proposal of their own.** Everything they write there —
  saves, splits, moves, standings — stages into their branch instead of establishing, and the
  surface says they are in a proposal.
* **A branch is per document and person**, and its membership is the proposal group's members,
  never a visual subtree.
* **A run started from a tab in a branch proposes into that branch.**
* **Others see truth**, and with the proposals toggle the branch's items in the person's colour.
* **Before a branch is accepted the person sees each member's standing against head** — unchanged,
  moved beneath it and corrected on acceptance, or moved under it — and accepts, rewrites or drops
  a drifted member. Acceptance never needs an extension-specific judgement.
* **A rejected branch loses nothing and leaks nothing:** it stays readable in history, and a block
  of it can be promoted on its own into a new proposal.

## Transfer

Transferred 2026-09-16 from the rescope, graph half from head 1160:

- **Core:** nothing; `BO_0250_001`–`_004` stand.
- **Kernel** (`ui-kernel.md`, Proposal Branches): the fixed lines restated for the general scope;
  `BO_0250_006` retires the reconcile run and the cross-group derive source; `_008` is the live
  walk with two accounts and no run; `_009` removed.
- **`documents`** (graph): `document-panel.md` `BO_0250_020` (the branch control and routes move
  here, offered on any editable document), `_021` (accept by the standing: *Keep mine*, *Drop*,
  rewrite; the reconcile request removed), `_022` (rejected rows with promotion), `_025`
  (verification on the tree, with the absence check), `_019` (Playwright, rescoped);
  `proposed-changes.md` `_023` (the settled mark leaves the shell).
- **`calliopa-refine`** (graph): `system.md` `BO_0250_024` retires `refine.reconcile`, the
  `settled` convention, `about: reconcile`, the synthesis and the branch surfaces it draws.
- **The change document** is carried into the graph with the transfer, as a member of
  `documents`.
- **Release notes:** the unreleased line on branches names the settled mark; it is rewritten
  when the change completes.

## Implemented

Completed 2026-09-16:

- **Kernel** (repo): the reconcile run, its judgement about and the cross-group derive source
  removed (`BO_0250_006`); a run may propose into a person's branch before its first staging
  mints it (`namesBranchOf`); a group's own run record is decided without the confirmation page
  (`runRecordMember`, user decision 2026-09-16). `BO_0250_008` verified live.
- **Shell** (graph): `documents` draws the branch line, the acceptance card by standing with
  *Keep mine* / *Drop*, and the rejected rows with promotion; the `branch` and `standing` routes
  are `documents`' own; the settled mark, the reconcile card and refine's branch surfaces are
  gone; `refine.reconcile` and the `settled` convention retired, `about: reconcile` kept as
  historical (user decision). Walk fixes: the line takes the editor's store as props (a restored
  tab drew none), an unstaged branch's card, the phone gutter, and a run's record answered with
  the branch. `BO_0250_019` verified on the served build.

## Decided

- **Who a person is while in a branch.** The person stays human class and the shell stages
  proposal-scoped, which CCGW admits for any class (`BO_0084_009`), so accepting a branch is the
  ordinary human acceptance `BO_0212` may gate. User decision, 2026-09-13.
- **A branch is per document and person.** One shared branch per document was the alternative.
  User decision, 2026-09-13.
- **Where a branch is offered.** *Work in a proposal* is offered on any document the person can
  edit. User decision, 2026-09-16.
- **Direct edits stay allowed.** A document never refuses a direct truth edit in favour of a
  branch; `BO_0250_009` is dropped, not moved to `calliopa-refine`. User decision, 2026-09-16.
- **Reconciliation by a run is retired.** Acceptance reads the core's standing only; the reconcile
  run, its judgement, the card's run readings, the `refine.reconcile` skill and the synthesis of
  disagreement are removed rather than kept in `calliopa-refine`. User decision, 2026-09-16.
- **No surface marks a member settled.** The core's `SETTLE`/`UNSETTLE` mark and the kernel's
  verbs stay; the shell's control, its at-rest mark and its commands go. User decision,
  2026-09-16.
- **Promotion lives in `documents`.** After *Reject this proposal* the blocks the branch held
  differently are listed under the branch line as *Rejected proposal · yours* rows, each with
  *Promote this block on its own*. User decision, 2026-09-16.
- **The branch surfaces move from `calliopa-refine` into `documents`**, since a general install has
  no depth, no phase line and no reconcile card. Technical consequence of the decisions above,
  2026-09-16.

## Depends On

- `BO_0233` (proposals by their agent), `BO_0255` (`documents`). It reuses `BO_0212` when that
  lands.
