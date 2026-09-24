# The Agent At Work In The Document

Status: completed

While an agent works on a document, the person sees what it does, at the blocks it does it to. A command's proposals appear as the agent stages them, not when the run ends. Every block the agent reads or proposes against carries the agent's icon on its bottom border with a one-line note of what the agent does there. A read fades after three seconds. A proposal keeps the icon, and its decision controls sit beside the icon. This replaces the proposer's face on the left border and the icons on the top edge. *Accept all* leaves the blocks. Each open run group gets a small agent chip above the command field instead. The chip says what the run is doing and, once the run ends, what it did, followed by *Reject all* and *Accept all*. Requested by the user, 2026-09-18.

## Scope

- The subject is how the default editor, `documents`, shows the agent's work. The composer item is drawn by `ui.shell`. When this change is carried into the graph, this document belongs there as a `documents` member.
- It is a `BO` change because the kernel has to report the reads and stagings. The kernel's tool server is the only party that sees each tool call, whichever runtime makes it (Hermes, Codex or Claude Code). Today it does not attribute reads to a run (*Run Lifecycle*: "Reads are not bound").
- Live activity (read marks and the chip's running line) is for command runs started from an open document. Every proposed item takes the new mark, a system run's derived candidates included (Decided).
- Extension docs were read from a live checkout at head 99 (`/tmp/tree-agentpresence` in the kernel container).

## Where This Starts

- **A run stages as it goes, but the editor shows the result only at the end.** A run opens one group per document and stages into it incrementally (`run-lifecycle.md`). The group, `node:run-<id>`, can be read in CCGW from the first staging onward. The editor reads proposals when it reads the document, and it opens the run's proposals when the run ends (`BO_0226`, `proposed-changes.md`).
- **The run's events are known while it runs.** The normalized contract has *tool started* and *tool completed* (`src/server/agent/run-events.ts`). The console polls them from `GET /api/runs/:id/events` (`commands-and-runs.md`). The editor does not follow them.
- **Reads are whole-document reads.** The agent reads with `read_document`, which answers every block (`ui-kernel.md`, the document tools). No tool reads single blocks, so the kernel cannot report which blocks the agent looked at. It can only report which document.
- **A proposed item says who proposed it with a face on its left border**, and it is answered with icons on its top edge: accept, reject, and *Accept all* on a group of more than one (`proposed-changes.md`, `BO_0233`). On a phone the face stands in the gutter.
- **There is no *Reject all*.** `BO_0262` lists this as a gap and an open question. This change answers it: yes, as part of the run chip.
- **Proposals are hidden at rest.** *Show proposed changes* is off by default. `BO_0262` decided that the latest run's proposals show at rest, but that is not implemented yet.

## Direction

### Proposals appear as they are staged

- While a command run from the open document is running, each item it stages appears at its target when it is staged, without the toggle. A replace stands over its block, an insert at its place, and a removal or move frames its block.
- The items are the same proposed items that show after the run: answerable, markable and editable. The person can answer an item while the run is still going.
- This is the running half of `BO_0262`'s decision *The latest run's proposals show at rest*. The two changes share one rule: the latest run's items show without the toggle, both while it runs and after it ends.

### The agent's mark on a block

- Whenever the agent reads or proposes against a block, the agent's icon appears on that block's bottom border. It is left-aligned, inset from the edge, and followed by a one-line note of what the agent does with the block.
- **Read:** the icon and the note, for example *Reading*, fade out on their own three seconds after the last read of that block. A read again within that time restarts the three seconds.
- **Proposal:** the icon stays, and the note names the proposal, for example *Proposes a rewrite* or *Proposes removal*. The decision controls stand in the same line after the note: accept, reject, and the others a proposal has today.
- The note's words are derived from the operation: *Reading*, *Proposes a rewrite*, *Proposes removal*, *Proposes a move*, *Proposes a new block*. When the agent gives its own short note for a read or an item, that note is shown instead (Decided).
- The mark replaces the proposer's face on the left border and the top-edge icons for every proposed item (Decided). A proposed item keeps its own ground and edge (`BO_0233`), so it still reads as not yet true when the mark is scrolled away.
- The icon is the proposer's: the runtime's mark for an agent (Claude Code, Codex, Hermes), and the person's face for a branch (`BO_0250`).
- Nothing moves the reader. The editor does not scroll to follow the agent.
- At rest the editor still shows only the document (`block-editor.md`). A read mark is gone three seconds after the run stops reading. A proposal's mark stays only as long as the proposal stands unanswered.

### The document line: one run chip per open run group

- The document-level line is the run chip. It stands above the command field and shows the agent's icon and one line of text (Decided).
- While the run is going, the chip's text says what the agent is doing on the document as a whole, for example *Reading the document* or *Proposing changes*. The block marks say what it does to each block.
- When the run ends, the chip stays as the run's summary, for example *3 rewrites, 1 insert*, followed by *Reject all* and *Accept all*.
- A whole-document read (`read_document`) shows only on the chip, never as a mark on every block. Block marks come from reads that name their blocks (below).
- There is one chip for each open run group reaching the document in the active tab, newest first (Decided). A chip leaves when every item of its group is answered. A branch is not a run, so it gets no chip; its items are still answered one by one at their marks.
- *Accept all* and *Reject all* answer every unanswered item of that chip's group in this document. Items already answered stay as they were answered. *Accept all* leaves the proposed blocks.

### What the kernel reports

- The kernel gets a block-scoped read beside `read_document`, for example `read_blocks` with a list of block ids. The base skill steers the agent to read what it works on through it, so the block marks show what the agent actually looked at (Decided).
- The kernel's tool server binds a read to the caller's active run when there is one. A read with no active run is still answered, never refused, so the reason reads were left unbound still holds. The *Run Lifecycle* line "Reads are not bound" changes with this.
- Reads and items may carry an optional short note from the agent. It is what the block mark shows instead of the derived words.
- The run's event stream carries the agent's activity in the document: a whole-document read, the blocks it read, and the items it staged against which blocks, each with its note when there is one. Apart from the agent's notes, the stream carries ids and kinds only, never block content.
- The editor follows the run's events for its document through the polling the console already uses (`GET /api/runs/:id/events`). It needs no second transport.

## Completed

- Implemented and walked on 2026-09-18. The kernel half, which covers `read_blocks`, the agent's notes and the `document.activity` events, is in this repository. The shell and editor half, together with the `ui.shell.documents` skill, was accepted in the graph as `node:chg-642a64fa1a8592a7` and served from pin 148. The user walked it on the rebuilt stack and said it works.
- The walk showed that a rewrite is drawn as a block of its own. `CA_0055` takes that up, together with moving the run chips below the view bar and toggling a run's proposals from its chip.

## Transferred

- Set to draft by the user on 2026-09-18 and transferred the same day:
  - `BO_0265_001`–`BO_0265_005`, the kernel's half: `docs/system/ui-kernel.md`, *The Agent At Work In The Document*.
  - `BO_0265_006`–`BO_0265_009`, the shell's half: `ui.shell`'s `docs/system/workspace/agent-activity.md` in the graph.
  - `BO_0265_010`–`BO_0265_016`, the editor's half: `documents`' `docs/system/documents/agent-at-work.md` in the graph.
- The graph's tasks are in new topics of their own, so they do not collide with `BO_0263`'s work in `block-editor.md`, `command-mode.md` and `commands-and-runs.md`. The lines they replace are named in the tasks.
- This document is carried into the graph as a `documents` member at draft, in the proposal that carries the tasks.

## Decided

* A run's whole-document activity is shown on one line for the run, and that line stays as the run's summary when the run ends. The line is the run chip above the command field: it shows what the agent is doing on the document while the run is going, and afterwards what the run did, with *Reject all* and *Accept all*. The block marks show what the agent does to each block. A whole-document read does not mark every block, so block reads name their blocks through a block-scoped read. User decision, 2026-09-18.
* The one-liner is derived from the operation, and the agent's own short note replaces it when there is one. User decision, 2026-09-18.
* *Reject all* and *Accept all* are offered only after the run has ended. While the run is going, items are answered one by one. User decision, 2026-09-18.
* There is one chip for each open run group on the active document, not only one for the latest run. User decision, 2026-09-18.
* Every proposed item takes the bottom-border mark: every agent run's items, whether older or new, a person's branch, and Refine's derived candidates. Read marks are shown for command runs only. User decision, 2026-09-18.
* The chips stand on a line of their own above the strip that shows the document's title and ×. They are hidden while the dock is collapsed to its handle, and the handle then shows a small count of the open runs. User decision, 2026-09-18.

## Depends On And Touches

- `BO_0262` (idea): shares the decision that the latest run's proposals show at rest, and answers its *Reject all* question. Whichever of the two changes lands first carries the shared rule.
- `BO_0263` (draft, graph half accepted): a removal or a move is marked through its face or edge (`command-mode.md`, *Marking Every Drawn Row*, `BO_0263_005`). With the face moved to the bottom border, the mark control goes to the icon or the edge. Whichever change lands second has to adjust to the other.
- `CA_0053` (ready): moves the reading toggles into the view bar. The toggle *Show proposed changes* stays, and this change only takes the latest run's items out from behind it.
- `CA_0048` (idea): places the composer. The run chip goes wherever the command field is.
- `BO_0256_012`: per-item answering and group atomicity. *Reject all* answers per item, the same way *Accept all* does today.
