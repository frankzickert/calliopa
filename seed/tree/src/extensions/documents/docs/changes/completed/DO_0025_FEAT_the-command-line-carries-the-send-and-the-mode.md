# The Command Line Carries The Send And The Mode

Status: completed

Requested: 2026-09-30, by the user. The command control on the block being edited is where a person sends. It should also be where they choose how the block is sent and how the agent works. This document shapes the change. It does not authorize implementation.

## Behavior

- The pin on the command line becomes a single toggle, *Keep as content*. It always stands just left of *Send as prompt* (▶). User decision, 2026-09-30 (Q1).
  - When it is on, sending keeps the block as content: nothing is written to the block's standing, as *Send, keep as content* does today.
  - When it is off, sending sends the block as a prompt: the block takes the `prompt` standing and leaves the flow, as a plain *Send* does today.
- The command line no longer shows one pin chip for each fixated block. Fixated blocks still reach every run, because the kernel reads them from the graph at the run's start. User decision, 2026-09-30 (Q1).
- The toggle is remembered per block. A block that has never been sent starts with the toggle off. User decision, 2026-09-30 (Q2).
- `Ctrl`/`⌘`+`Enter` sends the way the toggle says. *Send*'s title names the current way: *Send as prompt* or *Send, keep as content*. User decision, 2026-09-30 (Q3).
- The caret after *Send* (*More ways to send*) and its menu are removed. The line ends with *Send*.
- The two working-mode toggles, explore or consolidate and understand or create, move onto the command line. They leave the document bar's *Work* group. User decision, 2026-09-30 (Q5).
- The working mode belongs to the command, not the document. Each block remembers its own mode. A block's command line starts from the mode last sent in the document, and at explore + create when nothing has been sent there yet. Switching the mode on one block leaves every other block as it was. User decision, 2026-09-30 (Q4).
- The line runs: agent, speed, explore/consolidate, understand/create, point, attach, the chips of what the command carries, *Keep as content*, *Send*. On a phone the line wraps rather than scrolls. User decision, 2026-09-30 (Q6).

## Replaces

- Three fixed lines are replaced. The user's decisions above are the input this needs.
  - `documents` `command-mode.md`: *"… and Send with a caret. A plain Send sends the block as a prompt; the caret offers Send, keep as content."* (user decision, 2026-09-18).
  - `documents` `block-editor.md`, *Working Modes*: *"Two toggles lead the bar's Work group, before Work in a proposal …"* (`BO_0306_Q1`, user decision, 2026-09-29).
  - `documents` `block-editor.md`, *Working Modes*: *"The mode is held per person and document and remembered; a person's first mode in a document is explore + create."* (`BO_0306_Q2`, `BO_0306_Q3`). With this change, explore + create is the start of a document where nothing has been sent, and a block's own mode is what it remembers.
- `ui.shell` `commands-and-runs.md` describes the pin chip for each fixated block (`CA_0039_003`, `BO_0272_015`) and the shell's half of *Working Modes*. Both follow.

## Transfer

Transferred on 2026-09-30, after the user set the change to draft, as `DO_0025_001`–`DO_0025_010`:
- `_001`–`_007` and `_010` in `documents`' `command-mode.md`, *The Send And The Mode On The Command Line*. Its fixed lines on the command control and the shortcut are revised there.
- `_009` in `documents`' `block-editor.md`, *Working Modes*. Its fixed lines on the toggles and the mode per document are revised there.
- `_008` in `ui.shell`'s `commands-and-runs.md`, under a section of the same name.

At the transfer, the kernel's run record was found to already carry `mode` (`BO_0306_001`). So a block's mode reads back from its latest run, and the change needs no kernel half. The per-person record keeps its meaning as the document's last sent mode, and `ui-kernel.md`'s fixed lines stay true.

Order: `_008` first, then `_001`–`_004` and `_009`, then `_005` and `_006`. `_007` comes before completion, and `_010` after promotion.

## Notes

- A block's choices may need no new storage, since both can be read back from what was sent. That is to be confirmed at the transfer.
  - A block's mode is the mode its latest run carries (`agent.run`'s mode field, `BO_0306`). This is how a prompt's marks are already restored from its latest run.
  - A block's toggle reads from its standing: a sent block standing as `prompt` was sent with the toggle off, and a sent block without that standing was kept as content.
  - The document's *last sent* mode is the record that exists today, `/__kernel/state/people/<account>/mode/<document>`. It is written when a command is sent instead of when the bar's toggle is pressed.
  - If a block has to remember a choice it was never sent with, that needs a new kernel record, which is fixed-layer work and would make this a `BO` change.
- The code is `views/command/command-control.tsx` (the line, `send(asPrompt)`, the *More ways to send* menu). The chips are the shell's `src/components/shell/reference-chips.tsx` (`pointing.fixated`, Phosphor `push-pin`), and dropping them may retire `Pointing.fixated` from the contract. The toggles are pushed by the bar task in `views/block-editor.tsx` (`working-mode-field`, `working-mode-work`), and their poles are in `lib/working-mode.ts`. `sendBlock$` already takes `asPrompt`.
- Today the mode reaches a run through the view bridge's `setMode$`, as the document's mode held in the shell's aim. As a per-command value it would travel with the send instead (`sendCommand$`), and `setMode$` would retire. Gestures and the console, which do not send from a block, would take the document's last sent mode.
- The change touches `documents` (the owner, since its subject is the command control) and `ui.shell` (`ReferenceChips`, the view bridge). `documents` is `bundled`, so a line in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` is due at completion.

## Implementation

Implemented 2026-09-30 at `Status: wip`, in the proposal that carries this document. `_001`–`_007` are truth in `command-mode.md`, *The Send And The Mode On The Command Line*; `_009` in `block-editor.md`, *Working Modes*; `_008` in `ui.shell`'s `commands-and-runs.md`. Nothing new is stored beyond the device's per-block record (`calliopa.command.<document>.<block>`): with nothing on the device, a block's choices are read back from its runs and its standing, as the Notes proposed, so the change has no kernel half.

Completed 2026-09-30, after the user walked the promoted build at pin 3259 on a desktop and a phone (`DO_0025_010`).
