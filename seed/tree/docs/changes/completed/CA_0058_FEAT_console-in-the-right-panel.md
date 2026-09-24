# No Command Bar, And The Console In The Right Panel

Status: completed

The command dock at the bottom of the screen goes away, and a run's console context — what it is doing, what it did, and the control over it — is read in the right panel instead. A command is given from a block of a document alone. Requested by the user on 2026-09-20 and answered the same day.

## Where This Starts

- The dock is the shell's own bottom surface ([Commands And Runs](../system/workspace/commands-and-runs.md)). In one column it holds the strip, the composer bar — the agent dropdown, the paperclip, the command field and *Run* — the notice line, the undo line and the console, over a handle with three positions: composer, console and collapsed.
- Since `BO_0267` a command to a document is written in one of its blocks and sent from that block's command control, which carries its own agent dropdown, its reference chips, its attaching and its `#` offers. The dock's field is drawn only where a command is aimed at nothing — a tab that is not a document, or an empty workspace — and there it offers to start a document (`BO_0251_006`).
- The console lists the reader's processes with their state, title and step, shows the running run's normalized events above the list, and offers *Cancel* while a run is queued or running ([Processes](../system/workspace/processes.md)). Pressing a row selects the process, and its detail already opens in the right panel, for the tab it was selected on: step, error, acknowledgment, the run's attachments, and the documents its run proposed into with what stands unanswered (`CA_0040`, `BO_0229_011`).
- The right panel is the inspector ([Layout](../system/workspace/layout.md#inspector)): the active view's contributed facts and actions, a selected process's detail in their place, and, on a document tab, the *Execution* section listing that document's runs, each pressable to show or answer its proposals (`BO_0267_010`). The drawer is hidden, shown as its icon column alone, or shown with one icon's content (`CA_0056`).
- The run chips already left the dock: they stand under the view bar since `CA_0055`, and the collapsed handle stopped counting them.
- The header's process count pill is today a toggle that moves the dock to its console position and back (`CA_0010_006`).
- The undo line holds one thing — a tab move's undo or the view's own offer (`offerUndo$`, `BO_0227_013`) — and the editor's every change of standing is taken back from it (`documents`' [Block Editor View](../../src/extensions/documents/docs/system/documents/block-editor.md)). The undo and redo in the document's bar are not that line: they are the transient in-block history over text and marks, which by fixed rule never reverses a saved structural operation.
- A document is created from the `+` on the library's `Documents` header, which opens it in its own tab and is already the only way to create one ([Layout](../system/workspace/layout.md)).

## Decided

* The command bar at the bottom of the screen is removed, and with it the dock, its handle, its three positions and its persisted position. User decision, 2026-09-20.
* A run's console context is read in the right panel. User decision, 2026-09-20.
* A command is given from a block of a document alone. The composer goes whole — its field, its agent dropdown, its paperclip, its strip and its notice line — and a command given with nothing open retires with it, so `BO_0251`'s started document is no longer offered. A document is created from the library's `+` and commanded from its blocks. User decision, 2026-09-20.
* The console is not a second list beside *Execution*: *Execution* is the one list in the right panel. On a document tab it keeps its groups — *From this block* and *Touching this block* — and carries the reader's other processes in a group of their own; on every other tab it lists those alone. No process is listed twice. User decision, 2026-09-20.
* A run's events stand in its detail, where its step, its error, its attachments and the documents it proposed into already stand. The list says state, title and step, and nothing more. User decision, 2026-09-20.
* Taking back a saved change of standing is a control of its own in the document's bar, in the *History* group beside the in-block undo and redo, naming what it takes back. The fixed rule stands: reversing a saved structural operation is a separately named action and never the undo keystroke. User decision, 2026-09-20.
* A tab move loses its undo with the dock's line. A moved tab is moved back by hand. User decision, 2026-09-20.
* The header's process count pill shows the right panel on the console and hides it again, at zero as well, so the console stays one press from the header. User decision, 2026-09-20.
* The kernel keeps its `start` delivery. The shell stops sending it, and a `BO` change retires the intake, the instructions and the one-document-per-run rule later, so this change stays the shell's own. User decision, 2026-09-20.

- On a phone the right panel is the edge sheet, so the console is read there and the header's pill opens the sheet on it, as it opened the dock. The run chip under the view bar keeps saying what a run is doing while the sheet is closed, so nothing about a running command depends on opening it.
- A refusal is still shown beside the control that was pressed (`CA_0022_018`); with no composer, the only command control left is a block's, which already names its refusals there.

## Direction

- **Owning side.** The dock, the composer, the console, the process registry and the inspector are the shell's own, so this is a `ui.shell` change. `documents` carries two pieces: the named take-back control in the bar's *History* group, and the room the editor keeps at the bottom of the region for a dock that is no longer there.
- **What goes with the dock.** The handle's reading of a release (`dockAfterRelease`, `dockAfterTap`, `DOCK_SWIPE_THRESHOLD`), the three positions and the position persisted per workspace, the dock's own layer and the layering test that holds every view under it (`BO_0230_003`), the composer and its host, the strip and its unaimed `start`/`answer` choice in `commandTarget`, and the composer's attachments. The shell's grid gives the row back to the workspace.
- **What the panel already knows.** A process's detail is in the inspector today, so this change moves the list and the events to where the detail already is rather than building a second process surface. *Execution* gains the reader's other processes and loses nothing it does.
- **Left for a `BO` change.** The kernel's `start` delivery, its instructions and its one-document rule stay until a change of the fixed layer retires them; the transfer shapes that as an open task rather than doing it here.
- **Release notes.** A `Breaking` line, since something that worked stops working: the command bar is gone, a command is given from a block of a document, and a run is followed in the right panel. That makes the release a minor one before 1.0.

## Transferred

- Set to draft by the user on 2026-09-20 and transferred the same day, fourteen tasks:
  - `CA_0058_001`, `CA_0058_002`, `CA_0058_012`–`CA_0058_014`: `docs/system/workspace/commands-and-runs.md`, *The Dock Goes* — the topic's rename and rewrite, the composer's command path, the verification, the walk and the release note.
  - `CA_0058_003`: `docs/system/workspace/frame.md`, *The Frame Without A Dock*.
  - `CA_0058_004`: `docs/system/workspace/tabs.md`, *The Workspace Record Without A Dock Position*.
  - `CA_0058_005`–`CA_0058_007`: `docs/system/workspace/processes.md`, *The Run List In The Panel*.
  - `CA_0058_008`: `docs/system/workspace/agent-activity.md`, *Execution Is The One List*.
  - `CA_0058_009`, `CA_0058_010`: `docs/system/workspace/layout.md`, *No Dock On Either Form Factor*.
  - `CA_0058_011`: `documents`' `docs/system/documents/block-editor.md`, *Taking Back A Change Of Standing*.
- The kernel's `start` delivery is left standing by decision, as an open line in `calliopa-bootstrap`'s `docs/system/ui-kernel.md` for a `BO` change to claim.

## Implemented

- Implemented on 2026-09-20 from `.local/tree-ca0058` at dataRevision 659. The shell lost the dock, the composer and the undo line; the run list and a run's events moved into the right panel's *Execution* section, which is now drawn on every tab; the header's pill shows and hides the panel on it; `documents` gained *Take back* in the document bar's trailing group. The topic `command-dock.md` is `commands-and-runs.md`, and every link follows.
- Decided while implementing, both the user's: an *Execution* entry keeps `BO_0267`'s press for showing and hiding its proposals and gains a caret that opens the run's detail; *Take back* stands in the trailing *Document* group rather than in *History*, which is drawn only while a block is active, because a standing is most often set on a block that is not.
- Verified: `tsc --noEmit` clean, the unit project green (116 files, 998 tests), the behaviour project green through the repository's kernel harness (23 files), both production bundles built. The new render-harness cases were each shown to fail with what they guard removed.
- The release note is the `Breaking` line in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, which makes the next release `0.4.0`.
- `CA_0058_013`, the walk, is claimed and waits for the served build.

## Completed

- Walked by the user on 2026-09-21 at pin 698: it works. The walk is truth in [Commands And Runs](../system/workspace/commands-and-runs.md), *The Dock Went*, and every task this change opened is folded.
- Served pin 695 carried a defect of this change's own making: stripping the dock's rules from `shell.css` split the selector list of `:is(.dock, .block-command) .chip` and left `.block-command) .chip`, which no browser parses, so a block command's chips were unstyled. Repaired at pin 698, with a guard in `tests/behavior/theme-tokens.test.ts` that refuses a selector whose brackets do not balance.
