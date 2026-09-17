# CA_0042_FIX_editing-a-stale-proposal

Status: completed

Requested: 2026-09-11. **Editing an agent's proposal is refused:** *The proposal was not accepted, so the edit was not made: This proposed change was made against an older version of the block, and its words, its kind or its place have changed since. Reject it, or ask for it again.* User statement.

## Where This Starts

- **The block's words changed after the proposal was staged.** The run *make this one coherent piece* (`claude-code`, pin 317) staged `node:run-e0ab969ebf4dd7ea` at dataRevision 318. It holds a rewrite of block `dc519e3e` (#7, pinned) that merges #6 and #8 into it, plus the removal of those two. At 320, the reader revised `dc519e3e` directly and deleted its trailing *as*. A rewrite is drawn beside its block, which stays editable, so nothing stopped that edit (*A `replace` shows its proposed text beside the block's current text*, `docs/system/documents/proposed-changes.md`).

- **Typing into the rewrite has to accept it first, and the acceptance is refused.** `settleProposal$` answers through `answerProposal`. CCGW judges drift by revision and answers a conflict. `standingOnlyDrift` then finds that the words at the group's base (*…alone.as*) are not the words truth holds now (*…alone.*), so `answerDocumentProposal` refuses with `proposalStale` (`BO_0233_011`). The editor drops the typing and shows the notice. The ✓ gives the same refusal, so the only ways out are to reject the rewrite or to ask for it again, though the rewrite already drops the *as* itself. Served at pin 312.

- **Until this lands:** reject the rewrite and ask the agent again. It reads the block as it stands now.

## Intent

* Typing into a proposed rewrite accepts it even when the block's words, role or place changed after it was staged, and makes what the reader typed on top. The reader is looking at the proposal and choosing its final words, so editing it is the decision.

* The reader's edit to the block since the proposal was staged is replaced by the proposal's text and the typing on top of it.

* Accepting such a proposal from its ✓, or by *Accept all*, still refuses with the same words, and so does a move, which takes no typing.

## The Shape

- **The editor's settle path accepts over the drift.** The acceptance `settleProposal$` makes is an edit's, and it says so to `answerProposal`, which accepts the rewrite over CCGW's drift judgement (`override`) instead of refusing it. The icons' path is unchanged.

- **The reader's standing stays theirs.** The rewrite's candidate carries the standing the block had when it was staged. When the reader set another standing since, it is written back after the acceptance, as `BO_0233_011` already does, since a standing says nothing about the words.

- **The docs follow.** The `BO_0233_011` line in `docs/system/documents/proposed-changes.md` is narrowed to the icons' path, and the edit-accepts line gains the stale case.

## Decided

- **A stale rewrite that is edited:** editing wins. It is accepted over the change made since, and a plain ✓ still refuses. Decided by the user on 2026-09-11, over merging the two edits and over only showing why it was refused.

## Verification

First, the refusal reproduced over CCGW in `tests/behavior/documents.test.ts`: stage a rewrite, revise the block's words, and show that the accept is refused with `proposalStale`. After the fix, in the same place: the edit's acceptance establishes the rewrite, with the reader's standing kept, and the icons' acceptance is still refused. The settle path is covered in the block editor's render harness. Then on the served build: type into `node:run-e0ab969ebf4dd7ea`'s rewrite of #7, and check that the typing lands and that #6 and #8 can still be accepted or rejected.
