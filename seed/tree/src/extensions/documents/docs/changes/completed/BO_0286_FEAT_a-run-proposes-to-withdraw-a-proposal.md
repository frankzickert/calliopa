# A Run Proposes To Withdraw A Proposal

Status: completed

A run working in a document may propose that a standing proposal be withdrawn: it marks the proposal as superseded — by its own refinement of another, or by nothing — and the person rejects it with one press, or accepts it anyway. Nothing a run does answers a proposal; what changes is that the surplus of a reconciliation is named on the proposals themselves rather than in a run's final words. Requested by the user on 2026-09-23, after `BO_0271`'s first use in anger: told to *reconcile the proposals into one coherent argument*, a run wrote the reconciled argument as ten new blocks beside the twenty proposed blocks it was reconciling, because it could refine any of them and take none away. It authorizes no implementation and transfers no system tasks.

## What Is Wrong Today

- **A run can sharpen a standing proposal, not retire it.** `BO_0271` gave a run `read_document`'s view of every standing proposal and a `replace` that carries `refines: {group, item}` and lands on that proposal's candidate. A reconciliation of many proposals into fewer is not a rewrite of each: some of them have to go, and only the person can reject a proposal (`ccgw.md`, `REJECT PROPOSAL p MEMBER m`, human class only). The run that was asked to reconcile took the one path open to it and proposed beside.
- **The final words are not where a person answers.** `ui.shell.documents`' `openProposals` convention has the run say what it left standing; nothing tells it to name what should go, and even if it did, the person would read a list in the console and hunt for each item in the document. The place a person answers a proposal is its chip.
- **Hermes follows the rule when the ask fits it.** Checked on 2026-09-23 with a probe run: a refine-shaped command on Hermes refined Claude Code's standing rewrite in place. The gap is the vocabulary, not the delivery of the instructions.

## Scope

* A run may propose the withdrawal of a standing proposal it may refine: the same items `BO_0271` makes refinable, by the same rules — an ended agent run's unanswered item, never a run still going, another person's branch, the system's derived candidates, a fixated framing or an answered member. User decision, 2026-09-23.
* A withdrawal is a proposal, never an answer: the item stays open, the person rejects it with one press or accepts it as they could before, and nothing about the item's words changes. User decision, 2026-09-23.
* A withdrawal may name what supersedes the item — the refinement or the proposal the run made in its place — so the person can see where the words went before rejecting. User decision, 2026-09-23.
* The chip of a withdrawn proposal says who proposes to withdraw it and why, in the refiner's idiom of `BO_0271`: the run's face and words beside whose proposal it is, with the reject press the one act it asks for. The item is drawn as standing but marked for withdrawal, never hidden. User decision, 2026-09-23.
- The withdrawal is recorded on the candidate it concerns, as `refinedBy` is (`BO_0271_003`, decided against the code): `withdrawnBy: run:<id>` beside the successor item when there is one, so the mark stays with the item whatever becomes of the withdrawing run's own group, and one candidate still stands on the block.
- The run's guide (`ui.shell.documents`) gains the rule for a reconciliation: refine the proposals that stay, withdraw the ones the reconciled words make surplus, and stage nothing beside them; the final words say how many were refined and how many withdrawn.
- A withdrawn item stays counted among the document's unanswered proposals, since the person has not answered it; a withdrawal is not an item of the withdrawing run's own group but a mark on another's, so its chip counts the successors it staged, and *Reject all* there rejects those and leaves every withdrawn item standing with its mark.
- Accepting a withdrawn item establishes it as it stands; the mark is a candidate's and does not travel into truth.
* A withdrawal may carry a reason, one short line the person reads on the chip, shown when given as a note is; a withdrawal without one is explained by its successor, when it names one. User decision, 2026-09-23.
* Any refinable item may be withdrawn — a proposed new block, a rewrite, a removal or a move. Withdrawing a removal or a move means the block stays as it stands, and the chip says so in those words. User decision, 2026-09-23.
* A withdrawn proposal shows what replaces it: its chip carries a control that brings the successor's change into view beside it and turns to the successor, and the successor's chip says in its visible words how many proposals accepting it withdraws. Asked for in the walk, when the successor stood in a change the chip line was not showing and the count lived only in the accept's accessible name. User decision, 2026-09-23.
* Accepting a successor rejects, in the same press, every withdrawn item that names it as its successor: the person who accepts the reconciled words has answered the surplus with them. A withdrawn item that names no successor, or whose successor was rejected, keeps standing with its mark until the person answers it on its own chip. User decision, 2026-09-23.
- The one press is two operations of the core, since a decision is per member and the withdrawn items may sit in other groups: the editor accepts the successor member first and then rejects each withdrawn item naming it, and says on the successor's chip how many it withdraws before the press, so the press does what it says. If a rejection fails after the acceptance, the successor stands accepted and the withdrawn item stands with its mark — nothing is undone, and the item's own chip still answers it.
- *Accept all* on the withdrawing run's chip accepts its successors and so rejects what they withdraw, by the same rule, one member at a time as it does today.

## Where The Halves Land

- The kernel's: a `withdraw` item of `propose_document_changes` carrying `proposal: {group, item}` and optionally `supersededBy: {group, item}` and a reason, refused by name as `refines` is; `read_document` answering each standing proposal's `withdrawnBy`; the instructions' standing line saying a proposal may be withdrawn. Enumerated in `docs/system/ui-kernel.md` when this change reaches draft.
- `documents`' in the graph: `readDocumentProposals` reading the mark, the chip drawing it, the reject press, the counts; `ui.shell.documents`' guide gaining the reconciliation rule. Enumerated in [Proposed Changes](../../graph/tree/src/extensions/documents/docs/system/documents/proposed-changes.md) and [The Agent At Work](../../graph/tree/src/extensions/documents/docs/system/documents/agent-at-work.md).
- The change document is carried into the graph as a member of `documents`, at the status it holds here, no later than completion.

## Transfer

- Transferred on 2026-09-23, the day the user promoted it to draft. The fixed layer is `docs/system/ui-kernel.md`, *A Run Proposes To Withdraw A Proposal*: the `withdraw` item (`BO_0286_001`), the reads' `withdrawnBy` (`_002`), the instructions (`_003`), the kernel verification (`_004`), the release-notes line (`_005`) and the rebuild (`_006`).
- The graph half is `documents`' own docs, staged with this document at draft as proposal `node:chg-739c97bff372e1c3`: [Proposed Changes](../../graph/tree/src/extensions/documents/docs/system/documents/proposed-changes.md), *A Run Proposes To Withdraw A Proposal* — the guide's reconciliation rule (`BO_0286_007`), the withdrawn item read with its mark (`_008`), the successor's press (`_009`) and the walk (`_010`) — and [The Agent At Work](../../graph/tree/src/extensions/documents/docs/system/documents/agent-at-work.md), *A Withdrawn Proposal*, for the chip (`_011`).
- The technical point `BO_0286_001` left open is settled: a withdrawn removal's mark sits on the group's carry-forward anchor of the retired block, and the core keeps that anchor an anchor by dropping the three marks beside the membership stamp when it judges a candidate unchanged, judging against the base the group builds on rather than its own superseded candidate.
- Implemented 2026-09-23 (`wip`). The kernel half landed and is verified in the repository (`BO_0286_001`–`BO_0286_005` folded to truth in `ui-kernel.md`); the guide, the editor and the docs are staged as one proposal in the graph. What remains is the acceptance, the kernel rebuild (`BO_0286_006`) and the walk (`BO_0286_010`).
- Walked and closed 2026-09-23. The reconcile command that found this change was answered by refinements and withdrawals with nothing staged beside them, and the user's presses — the link to a successor, the successor's accept taking two withdrawn blocks with it, a rejection from a withdrawn block's chip — held (`documents`' Proposed Changes, `BO_0286_010`). Two findings of the walk were fixed on the way: the rest-time mark and the successor control (`BO_0286_012`).

## Verification

- In the kernel, over a real CCGW on the memory store: a withdrawal landing on the other group's candidate as a mark, the item still open and still one candidate on the block; every refusal by name; the instructions' line; a document with no withdrawal rendering exactly as today.
- In the render harness: the withdrawn item's chip, face, words, reason and names; the reject press on its chip; the successor's chip saying how many it withdraws, and its accept rejecting them in the one press; a withdrawn item whose successor was rejected still standing; an accepted withdrawn item carrying no mark.
- On the instance: the command that found this — *reconcile the proposals into one coherent argument* on a document with many standing proposed blocks — answered by refinements and withdrawals, with nothing staged beside them, and the person clearing the surplus from the chips.

## Graph And Release Notes

- The guide and the editor half are members of `documents`, so the change closes with `scripts/export-graph.sh` and leaves `graph/` in the working tree.
- `documents` is `bundled` and the kernel is the fixed layer: the change writes a line under *Added* in `docs/release-notes/unreleased.md` before it completes.
