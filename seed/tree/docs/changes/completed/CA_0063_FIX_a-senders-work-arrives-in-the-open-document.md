# A Sender's Work Arrives In The Open Document

Status: completed

A picture made by sending a block to a model lands in the graph and the open document is never
told: the reader sits in front of the document the proposal was made into and sees nothing until
they reload. Found by the user on 2026-09-22, sending a second generation into a document they
already had open — the first had appeared only because a promotion made them reload.

## What Is Asked

* A generation sent from a block appears in the document that was open when it was sent, without
  a reload, as an agent run's proposals already do.

## What The System Already Holds

- An agent run is followed. `startRun$` hands the run to `followRun`, the registry's poll is the
  clock, and the task that reads `/api/runs/<id>/events` brings what the run proposed into the
  open document as it happens (`CA_0058_006`, `BO_0265`).
- A sender answers a **process and no run** (`calliopa-bootstrap`'s `BO_0273_035`): a model is
  chosen in the agent menu as an agent is, and what it does is its own business, so it opens a
  process to watch rather than a run.
- The process is already watched. `startRun$` keeps `run.processId`, the registry polls every
  process, and the chip follows its state to `completed` — which is how the reader knows the
  picture was made at all.
- The sender's process names the document. `make.ts` opens it with `itemId` set to the document
  and `itemKind: "documents:document"`, and moves it to `completed` once `fillMediaBlock` has put
  the bytes in the pending block, or to `failed` in the generator's words — so the registry's
  record already says which document a finished process was for.
- The document already has one way of being told. `proposed` on the view bridge carries an item
  id and a rising `seq`; the block editor answers it by reading its **proposals** again
  (`reloadProposals$`) and opening them if any stand unanswered — never by re-reading the
  document under the caret (`BO_0226_007`). A run the reader followed raises it once when its
  events say it ended; a system run raises it from the registry's poll, when a system process
  that has ended for a document appears that was not already known when the page loaded
  (`BO_0245_009`, in `docs/system/agent/run-lifecycle.md`).
- The sender stages before it spends. `POST /api/x/media/make` proposes the pending picture block
  first, so that a failed generation leaves something to look at and to reject
  (`BO_0273_017b`) — which means the proposal the document would show exists from the moment the
  process is answered, not only when the bytes land.

## What The System Does Not Hold

- Nothing tells the document when a process that is not a run completes. `startRun$` returns
  early for a runless answer, the followed-runs path never sees it, and the registry's rule that
  raises `proposed` from the poll is written for system runs alone: it keeps `trigger === "system"`
  and skips every other process. A sender's process ends with the right item on its record and
  nobody reads it.
- Nothing tells the document when the process is opened either. The pending block the sender
  proposed is not read until something raises `proposed` or the reader reopens the tab, so the
  sender's proposal is invisible at both ends: when it is staged and when it is filled.
- The two halves were right separately. Following `undefined` left a chip reading *Starting* for
  ever, and that was fixed by not following (`BO_0273_039`); what was never added is the other way
  a document learns that something landed in it.

## Decisions

The three questions were answered as the code recommended, on 2026-09-23: arrival is the
proposals read, raised when the process is answered and when it ends; a closed document does
nothing; the rule is every process's. The truth stands in `processes.md`.

## Work

Transferred on 2026-09-23 with the three answers taken as recommended, and implemented the same
day: `CA_0063_001` (`endedForDocuments`, `src/lib/ended-processes.ts`, tested first), `_002` (the
poll tells every process's end) and `_003` (a runless answer tells the start) in `shell.tsx`,
their truth in `docs/system/workspace/processes.md`, `docs/system/agent/run-lifecycle.md` and
`docs/system/workspace/commands-and-runs.md`; `_004` one line in `media`'s `docs/system/system.md`;
`_006` the release-notes line in `calliopa-bootstrap`. The first walk found a second half in
`documents`: the proposal row kept the block it mounted with, so the picture that landed stayed a
box; the row is keyed by revision now (`agent-at-work.md`, `CA_0063_005`). The walk at pin 1887
folded `_005` into `processes.md`: the picture fills the box within a poll of the entry reading
completed.

## Not Here

- **The chip's own behaviour.** It follows the process correctly and says what happened; only the
  document is unaware.
- **Reloading as the answer.** It works, and it is what the user did, but it is not what the rest
  of the shell asks of a reader.
- **Live marks while the picture is made.** A run's activity marks come from its events; a
  sender's process has none, and the pending block's chip is the mark.

## Closure

- Completed 2026-09-23: the graph export closes the change and the release-notes *Fixed* line
  ships it.
