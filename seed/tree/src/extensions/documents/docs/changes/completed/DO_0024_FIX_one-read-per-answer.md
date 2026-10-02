# One Read Per Answer

Status: completed

Requested: 2026-09-30, by the user: the proposals of a run appear one at a time with a pause between them, and retiring a list of them removes them one at a time the same way. The kernel stages a run's proposals in one write, in about 0.25 s in production. Most of the time goes into the editor reading the document's proposals again, once for every answer and once for every batch of run events, where each read costs about 1.5–2.5 s in production. This document shapes the change and authorizes no implementation. The cost of one read is `BO_0314` (a read asks the core about every open group in the instance); this change is about how often the editor reads.

## Behavior

- Retiring a selection that marks several proposals declines them together: they leave the reading order at once, and the document and its proposals are read again once, when all the answers are in.
- When one of those declines is refused, the others still go through, and a notice names the proposals that stayed. A proposal that was already settled counts as gone, not as a refusal. User decision, 2026-09-30.
- A run that stages several proposals at once shows them all at once, when the next read of the proposals returns, not one after another.
- While a read of the proposals is running, a request to read them again does not start a second read: one more read follows the one running, and it serves every request made in the meantime.
- Answering one proposal keeps today's behavior: it leaves the list at once, and the proposals are read again in the background.

## Notes

- Retiring several (`retireMarked$`, `views/block-editor.tsx`, `DO_0023_004`) declines the marked proposals one at a time: `for (const itemId of items) await answerProposal$(itemId, "rejected")`. Each answer waits for its decline and for `reload$()`, then starts a `reloadProposals$()` of its own. On 2026-09-30 the core logged seven full proposal reads in six seconds (882 group reads) for one retire. The kernel log shows four of those declines refused with "is not an undecided member", so the loop also declines members that an earlier answer had already settled.
- The kernel's reject (`/__kernel/review`, `internal/kernel/serve/review.go`) takes one member per call. Whether several items are declined concurrently or in one kernel call that names several members is a technical choice. A kernel call naming several members is fixed-layer work and belongs to `BO_0314`.
- A run's events arrive in batches through `bridge.activity`, and each change of `seq` that holds a staging starts `reloadProposals$()` (the task above `calliopa:document-proposed`, `BO_0265_012`, `BO_0269_018`). `proposalEdit.reads` keeps only the newest answer, but every read that has started still runs to the end against the core. Why the items appear one at a time instead of all at once is to be established in the implementation, by a harness that counts proposal reads while staging arrives.
- Related: `BO_0233_012` (an answered proposal leaves the list before the reread).

## Implementation

Implemented 2026-09-30 at `Status: wip`, in the proposal that carries this document: the batch decline (`DO_0024_001`), the coalesced read (`DO_0024_002`), why a run's items stepped in (`DO_0024_003`), and the proofs (`DO_0024_004`) are truth in `block-editor.md`, *One Read Per Answer*, and the release note stands in `calliopa-bootstrap` (`DO_0024_006`). `BO_0314_012` makes each of the fewer reads one core read.

Completed 2026-09-30, after the user walked the promoted build at pin 3259 (`DO_0024_005`).
