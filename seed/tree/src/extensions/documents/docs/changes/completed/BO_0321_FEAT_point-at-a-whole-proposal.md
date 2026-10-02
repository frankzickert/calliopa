# Point At A Whole Proposal

Status: completed

Requested: 2026-09-30, by the user: *"in the command mode, allow also to target proposals (not the individual block but the entire proposal by pointing the chip)"*. Shaped in the graph as `documents`' `DO_0026`, whose six questions the user answered on 2026-09-30. It became this `BO` change on 2026-09-30 by the user's decision, because the kernel has to accept a reference to a whole proposal. The graph copy is `documents`' `docs/changes/BO_0321_FEAT_point-at-a-whole-proposal.md`, and `DO_0026` leaves the graph. This document shapes the change. It does not authorize implementation.

## Behavior

- In command mode a reader can mark a whole proposal, meaning every item one run or one person staged in the document, as one reference. Today a reference names a single proposed item: its face, or the words of an insert or a rewrite (`documents`' Command Mode, *Marking Every Drawn Row*, `BO_0263`).
- Marking a whole proposal sends nothing, the same as all marking (`BO_0226`, `BO_0267`). The run is told when *Send* is pressed: that the reference is a proposal, who proposed it, and each of its items as they stood when marked, in the group's order.
- The rules for a reference apply unchanged. *A reference is what was marked* (`BO_0263`): items that are answered, refined or withdrawn later are told as marked, with what happened to them since. A reference whose target changed never refuses *Send*.
- The whole proposal is marked from its chip on the chip line above the command field. While pointing, a press on that chip marks the whole proposal, or unmarks it, instead of showing or hiding its changes (`CA_0061`). A proposed item's own chip keeps marking that one item through its face. User decision, 2026-09-30 (Q1).
- A whole-proposal reference takes the next number in mark order. The number stands on the chip-line chip and on the reference's chip on the command line. Each of the proposal's items that is shown carries a quieter outline with the same number, so the document is still the list of what was marked. User decision, 2026-09-30 (Q2).
- A whole-proposal reference and references to single items of the same proposal can stand together, as a block marked whole and a passage inside it do. *Rework #3 but keep #1* is pointing the command can use. User decision, 2026-09-30 (Q3).
- Once every item of the proposal has been answered, the reference has no row in the document. It stays as a chip on the command line with its ×, as a rejected item's reference does, and the run is told what happened to each item. It does not move onto the accepted blocks. User decision, 2026-09-30 (Q4).
- The proposal of a run that is still staging can be marked, and the reference grows: items the run stages after the press join it until *Send*, which carries the items standing at that moment, as a send carries a copy of the marks that stand at the press (`BO_0267`). The run is told that the proposing run was still going. User decision, 2026-09-30 (Q5).
- A person's own branch, with its session chip on the line (`sessionChipsOf`), is marked whole the same way as an agent run's proposal. User decision, 2026-09-30 (Q6).

## Notes

- **Kernel half.** The kernel checks each reference as one item today. `agentbridge/bridge.go` refuses a proposal reference that names no `Item` or names one outside its `Group`, and refuses two references that share a number. `marked.go` tells the run about one item. A whole proposal needs a new reference kind, as `BO_0304` added one for a document marked whole. The bridge has to accept it, and `marked.go` has to tell the run the proposal and each of its items as they stood, with what happened to each since. A whole-proposal reference and an item reference of the same group are different pointing (Q3), so neither is refused as marked twice.
- **Paths are in the graph.** The `documents` paths below are under `src/extensions/documents/` in a checkout, and the `ui.shell` paths are root-mapped.
- **Where the code is.** The reference model is `lib/references.ts` (`Reference.target: "proposal"`, `group`, `item`, `rowKey`, `followDocument`). The report is `lib/pointing.ts` (`pointingOf`). The row controls are `views/marking/row-marks.tsx`. The chip line's press is `toggledGroup` in `lib/agent-at-work.ts`, and the shell draws the line in `ui.shell`'s Agent Activity. The chip on the command line is the shell's `reference-chips.tsx` (`commands-and-runs.md`).
- **Owners.** The kernel half is this repository's. In the graph, `documents` holds the copy, since its subject is what command mode marks, and `ui.shell` has a smaller half: the chip line answering a press while the view is pointing, and the command line's chip for a group reference. `documents` is `bundled`, so a line in `docs/release-notes/unreleased.md` is due at completion.
- **Fixed lines.** No fixed line is replaced. *Marking a proposal points at the proposal* (`BO_0263`) is extended from an item to a group, and Q4's answer adds to its *accepted / rejected* rule without revising it: a whole proposal stays rowless once answered instead of moving to a block.

## Transfer

Transferred on 2026-09-30, after the user set the change to draft, as `BO_0321_001`–`BO_0321_014`:
- `_001`–`_006`, the kernel half, are in `docs/system/ui-kernel.md`, *References To A Whole Proposal*. The decisions that bind the intake are fixed lines there.
- `_007`–`_010`, `_013` and `_014` are in `documents`' `command-mode.md`, *A Whole Proposal Marked*, with Q1–Q6 as fixed lines.
- `_011` is in `ui.shell`'s `agent-activity.md`, *A Chip Marks Its Whole Proposal*, and `_012` in its `commands-and-runs.md`, *References To A Whole Proposal*.

One technical decision was made at the transfer: a whole-proposal reference that carries no item yet is accepted, and the run is told that nothing is staged yet.

Order: `_001`–`_004` and `_012` first, then `_007`, `_008` and `_011`, then `_009` and `_010`. `_013` comes before promotion, and `_005` before the walk. `_006` and `_014` come last.

## Implementation

Implemented 2026-10-01 at `Status: wip`.
- **Kernel half** (`_001`–`_004`), in this repository and uncommitted: the `proposal` reference kind with its items (`agentbridge/bridge.go`, `http.go`); the read, item by item through the group's overlay (`marked.go`, `markedWhole`); and what the run is told (`wholeLine`). These are truth in `ui-kernel.md`, verified by `agentbridge/whole_test.go`.
- **Graph half** (`_007`–`_013`), in the proposal that carries this document at wip:
  - `documents`: the reference model, the report, the drawing and the reveal.
  - `ui.shell`: the chip line's press, which writes `toggleRun` with `mark`, and the body and chip of a whole proposal.
  - These are truth in `documents`' `command-mode.md`, *A Whole Proposal Marked*, and `ui.shell`'s `agent-activity.md` and `commands-and-runs.md`.
- **Kernel image:** rebuilt by the user on 2026-10-01 (`_005`).
- **Release note:** the line under *Added* in `docs/release-notes/unreleased.md` (`_006`).
- **Wording that changed at implementation.** Each item carries its block as well as its id and revision, because a removal's item id does not name its block. The press rides the existing `toggleRun` channel with a `mark` flag rather than a channel of its own.
- **Walk:** done by the user on the served build at pin 3412 on 2026-10-01 ("works", `_014`).

Completed 2026-10-01.
