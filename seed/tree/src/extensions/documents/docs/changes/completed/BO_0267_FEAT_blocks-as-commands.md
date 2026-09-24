# Blocks As Commands

Status: completed

Any block in a document can be used as a command. While the person edits a block, a combined control on it chooses the agent, points at references, and sends the block. A sent block becomes a prompt: by default it leaves the reading order and shows under *Show prompts*, like a discarded block under *Show discarded blocks*. On a document tab the dock's command field goes away. The right panel gains an *Execution* section listing every run of the document. With a block selected, the section shows the runs sent from that block, then the runs that touched it.

## Scope

- The subject is how the default editor, `documents`, turns blocks into commands and shows their runs. `ui.shell` gives up the command field on document tabs and records where a run came from. When this change is carried into the graph, this document belongs there as a `documents` member.
- It is a `BO` change because it spans both extensions and may reach the fixed layer: the prompt standing is part of the text member's vocabulary, and the run's origin is part of the run record (confirmed at the transfer: the `prompt` value on the `text` member's `disposition`, and `source` on the kernel's run record).
- Extension docs were read from the export at `graph/tree` while shaping, and from a checkout at dataRevision 209 for the transfer.

## Where This Starts

- **A command is written in the dock, not the document.** The composer is a field in the command dock. The strip above it names the document the command is aimed at and carries the view's command-mode toggle and a × that switches the run to *Answer in the console* (`commands-and-runs.md`, `CA_0039`, `BO_0226`).
- **Command mode belongs to the tab.** A click in command mode marks a block or passage as a reference. The marks are the tab's, and *Run* sends a copy of those that stand at the press (`command-mode.md`). Nothing ties marks to what the command says, other than the `#n` typed in the field.
- **A run does not know where its words came from.** The run route takes the goal, the document (`artifact`), the delivery and the references (`commandTarget`, `readCommandTarget`). Its words are a copy of the field. No block is their source.
- **Runs are listed in the console, and runs with open proposals as chips.** The process console lists recent runs. There is one run chip per open run group (`BO_0265`), and `CA_0055` moves the chips under the view bar. No place lists every run of one document.
- **Standings exist.** A text block carries a disposition (`keep`, `pin`, …), and a discarded block leaves the reading order and returns under *Show discarded blocks* (`BO_0227`). A prompt is a new standing of the same kind.

## Direction

### The block's command control

- While a block is being edited, a combined control stands on its bottom border, the same line where proposals put their mark (`BO_0265`): `[face ▾] [◎] [▶ Send ▾]`.
- **Agent:** the agent menu the dock bar has today (`AgentMenu`, with the sign-in refresh of `CA_0052`). It moves onto the block.
- **Point (`◎`):** starts command mode for this block. While it is on, a click on another block, passage, proposal, retired or discarded block marks it as a reference of this block, under the rules of `BO_0263`. Pressing `◎` again ends pointing. The dock's command-mode toggle goes away.
- **Send (`▶`):** sends the block's words with its references to the chosen agent. A plain press sends the block as a prompt. The caret offers *Send, keep as content*.
- Marking still sends nothing. Only `▶` starts a run.
- One run at a time holds: while a run is going, *Send* is refused with its reason beside the control, as the composer's refusals are shown today.

### Prompts

- **Send as prompt:** the block takes the `prompt` standing and leaves the reading order. It shows under *Show prompts* on the document bar, drawn where it sits with its own treatment, which must be distinct from the proposed, retired and discarded treatments.
- **Send, keep as content:** the block stays in the reading order and carries a small prompt mark. The mark shows under *Show prompts* as well.
- **References belong to the prompt block.** The block keeps its marks, so sending it again reuses them. Each run gets a copy of the marks as they stood at its send.
- **Sending again:** editing a sent prompt makes a new revision. `▶` starts a new run from that revision on the same block, and each run records the revision it was sent from.

### Every run proposes

- *Answer in the console* is dropped. Every run proposes into the document, and the answer to a question arrives as a proposed block after the prompt, which the person accepts or rejects. The direction is that everything is a block.
- The delivery field on the run route and the strip's × go with it.

### The dock on a document tab

- On a document tab the dock's command field goes away. The dock keeps its handle and the console.
- On a tab that is not a document, or with nothing open, the field stays as it is, including *start a document from a command* (`BO_0251`).

### The Execution section

- The right panel gains an *Execution* section listing every run of the document, newest first: the agent's face, the first line of its prompt, its state (running, ended, failed), what it did, *Reject all* and *Accept all* once it has ended, and *Cancel* while it runs.
- A run records its source: the prompt block and the revision sent. The section lists the runs whose target is this document.
- With a block selected, the section shows two groups: *From this block*, the runs sent from it, then *Touching this block*, the runs that proposed changes to it or referenced it. With nothing selected it shows every run.
- The section is designed inside `CA_0056`'s panel layout (one icon column per extension).

## Decided

- The person chooses on each send whether the block becomes a prompt or stays content. A plain `▶` sends as a prompt; the caret offers *Send, keep as content*. User decision, 2026-09-18.
- A prompt leaves the reading order and returns under *Show prompts*, as a discarded block does. User decision, 2026-09-18.
- On a document tab the dock's command field goes away; commands are written only in blocks. User decision, 2026-09-18.
- Command mode starts from `◎` on the active block's control and points for that block. User decision, 2026-09-18.
- References belong to the prompt block. User decision, 2026-09-18.
- Editing a sent prompt and sending it again starts a new run on the same block, from the new revision. User decision, 2026-09-18.
- *Answer in the console* is dropped now: every run proposes into the document, and a question's answer is a proposed block. User decision, 2026-09-18.
- With a block selected, Execution shows *From this block*, then *Touching this block*. User decision, 2026-09-18.
- The run chips of `CA_0055` go ahead as planned; they and the Execution section both show runs. User decision, 2026-09-18.
- This change lands after `CA_0056`, and the Execution section is designed inside its panel layout. User decision, 2026-09-18.
- A document's archived runs are listed in *Execution*. User decision, 2026-09-18.
- Typing `#` in the block being edited offers its references, as the command field did. User decision, 2026-09-18.
- Pressing a run's entry in *Execution* shows or hides its proposals, as its chip's press does. User decision, 2026-09-18.
- Files are attached to the prompt block, from its control or by a drop on the active block. User decision, 2026-09-18.
- The dock's action slot is removed with the command-mode toggle, its one user. User decision, 2026-09-18.
- `Ctrl`/`Cmd`+`Enter` in the block being edited sends it as a prompt. User decision, 2026-09-18.

## Transferred

- Transferred on 2026-09-18. The kernel: `calliopa-bootstrap`'s `ui-kernel.md`, Blocks As Commands, `BO_0267_001`–`BO_0267_006` (the run's source, with its words read from the revision; the `answer` delivery retired; the run told about its prompt; `prompt` reaching the run; the runs of one document with `touched`). `ui-shell.md` points at the graph's halves.
- `ui.shell` in the graph: `commands-and-runs.md`, Blocks As Commands, `BO_0267_007`–`BO_0267_009` and `BO_0267_011`; `agent-activity.md`, Execution, `BO_0267_010`.
- `documents` in the graph: `command-mode.md`, Blocks As Commands, `BO_0267_012`–`BO_0267_013`; `block-editor.md`, Prompts, `BO_0267_014` and `BO_0267_016`–`BO_0267_019`; `document-panel.md`, Prompts In Place, `BO_0267_015`.
- Settled at the transfer: the prompt standing is a `disposition` value, set only by *Send* and set back through the bar's *Standing* choice; a run's source and the blocks it touched are on the kernel's run record; the Execution section is the shell's, drawn in the inspector; a prompt's marks come back from its latest run when the device holds none.
- It lands after `CA_0056`, whose panel layout the Execution section is drawn in.

## Progress

- Kernel half (`BO_0267_001`–`BO_0267_006`) implemented and verified in the repository; the served kernel needs its image rebuilt (`BO_0267_020`).
- Shell and editor half (`BO_0267_007`–`BO_0267_018`) implemented, accepted and served at pin 232; walked by the user (`BO_0267_019`).
- The walk's findings, fixed 2026-09-18 by the user's decisions: the prompt's gutter carries the terminal glyph alone and the command control sits on the block's edge, compact, moving nothing (`BO_0267_024`); each document remembers what it shows (`BO_0267_022`); pointing keeps the prompt edited (`BO_0267_023`); a command written in a proposal branch is read through the branch (`BO_0267_021`, kernel). The kernel was rebuilt (`BO_0267_025`). Two more layout findings followed and were fixed: the prompt's glyph gives the gutter to the grip, and the command control is one chip of equal buttons with *Send* at its end (`BO_0267_027`, `BO_0267_028`).
- Walked by the user at pin 282, 2026-09-18 (`BO_0267_026`): the prompt glyph, what a document shows coming back, the command control on the block's edge, pointing with the prompt still edited, and a command sent from a block edited in a proposal branch all work. Completed 2026-09-18.
