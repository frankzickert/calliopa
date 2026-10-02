# Replay An Agent Run

Status: completed

A person can replay a finished agent run through a hidden function. The replay plays the run back
as if it were happening now: first the command is typed into the block it was sent from, then it
is sent, and the run unfolds the way it did and ends with the same result.

## What Is Asked

* An agent run can be replayed. Requested by the user, 2026-10-02.
* The replay is a hidden function: it is not offered in the shell's visible controls. Requested
  by the user, 2026-10-02.
* A replay first shows the command being typed, then shows it being executed, and produces the
  same result as the original run. Requested by the user, 2026-10-02.
* A replay is playback of the recorded trace, not a second execution: no model is called, no tool
  runs, nothing is written to the graph, and no proposal group is opened. User decision,
  2026-10-02 (`BO_0340_Q1`).
* It is reached by a keyboard shortcut while a finished run is selected in the process inspector,
  and named in no menu, button or hint. Anyone who can see the run may replay it; a replay shows
  nothing the person could not already see. User decision, 2026-10-02 (`BO_0340_Q2`).
* It plays compressed: the events come in their original order and at their original spacing,
  with long waits (the model thinking, a slow tool) capped to a few seconds; the goal is typed at
  a natural human pace. User decision, 2026-10-02 (`BO_0340_Q3`).
* It plays in the live workspace and looks exactly like a real run there, in a new process entry
  of its own; the entry is gone once the replay is dismissed, and nothing about the replay is
  stored. User decision, 2026-10-02 (`BO_0340_Q4`).
* It plays in a tab showing the document as it stood when the run started, read-only: the
  command's words are typed into its block, the run's activity plays at the blocks, and it ends
  with the proposed blocks pending as they were staged. The run shows in the right panel too, and
  closing the tab ends the replay; the real document is never touched. User decision, 2026-10-02
  (`BO_0340_Q4`), asked at the transfer once the checkout showed that a command is a block of a
  document (`CA_0058`).
* The change stays `BO_0340` in this repository although the fixed layer has no half; its graph
  copy is carried into `ui.shell`'s `docs/changes/` no later than its completion. User decision,
  2026-10-02.
* It ends as the original run ended (its outcome, its reason, and the proposal it named in the
  state it was in then), whatever has happened to that proposal since. User decision, 2026-10-02
  (`BO_0340_Q5`).
* A run whose trace is gone, past retention, cannot be replayed: the shortcut says so in words and
  plays nothing. Retention is unchanged. User decision, 2026-10-02 (`BO_0340_Q5`).
* Nothing is hidden or altered for the replay: run id, times and controls show as they did in the
  original run. User decision, 2026-10-02 (`BO_0340_Q6`).

## Where This Starts

- A command is written in a block of a document and sent from that block, and its result is
  proposed blocks in that document (`ui.shell`'s `commands-and-runs.md`, `CA_0058`). There is no
  goal field.
- The agent bridge's run record (`internal/kernel/agentbridge/bridge.go`, `Run`) is persisted on the
  kernel's data volume with nothing pruning it, and carries what a replay plays: the words the
  kernel read, `artifact` and `source` (the document and block sent from), `pin`, `group`,
  `status`, and `events`, each with its time in milliseconds (`Event.At`), document activity
  included. CCGW reads at a pinned `dataRevision`. So the fixed layer has no half.

## Transfer

- Transferred 2026-10-02 from a checkout at dataRevision 4068 into the graph's docs: the frame's
  half `BO_0340_001`–`BO_0340_005` and the walk `BO_0340_010` in `ui.shell`'s
  `docs/system/workspace/processes.md`, *Replaying A Run*; the editor's half
  `BO_0340_007`–`BO_0340_009` in `documents`' `agent-at-work.md`, *A Replayed Run*. This
  repository's `docs/system/ui-shell.md`, *Replaying A Run*, points there. Staged as proposal
  `node:chg-777bc89eba40331c` at head 4070 and accepted by the user the same day.
- Technical choices made at the transfer: the shortcut is `Ctrl+Alt+R` (`Cmd+Alt+R` on a Mac), a
  wait is capped at 3 seconds, and the command is typed at 60 ms a character.

## Implementation

- Staged 2026-10-02 as proposal `node:chg-e1ac26079665ad94` (31 files) from a checkout at
  dataRevision 4074, applied onto head 4090 after checking that none of its files had moved,
  accepted and promoted by the user to pin 4092: `BO_0340_001`–`BO_0340_005` and
  `BO_0340_007`–`BO_0340_009` folded into truth in the graph's docs.
- Walked by the user on the served build at pin 4092 the same day (`BO_0340_010`), who said it
  works; folded into truth in `processes.md`. This document stands completed here and as
  `ui.shell`'s member under `docs/changes/completed/`.
