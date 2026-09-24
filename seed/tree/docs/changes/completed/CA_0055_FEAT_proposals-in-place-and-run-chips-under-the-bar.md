# Proposals In Place And Run Chips Under The Bar

Status: completed

When proposals are shown, a proposed rewrite takes the place of the block it rewrites instead of standing beside it. The run chips leave the command bar and stand directly below the view bar, pushing the document down. Clicking a chip itself, not its buttons, shows or hides that run's proposals in the view. Requested by the user on 2026-09-18, after walking `BO_0265`.

## Where This Starts

- A rewrite is drawn right after the block it rewrites, so the block and its proposed version stand one under the other ([Proposed Changes](../../src/extensions/documents/docs/system/documents/proposed-changes.md), `BO_0233_004`). The walk of `BO_0265` showed it as a separate block.
- `BO_0265` puts one chip per open run group above the command field, on a line of its own above the strip ([Agent Activity](../system/workspace/agent-activity.md)). The chip shows *Reject all* and *Accept all* once its run has ended. When the dock is collapsed, the handle counts the chips instead.
- *Show proposed changes* is one toggle in the view bar (`CA_0053`). It shows every open group's items, and the reader's live run's items show without it (`BO_0265_012`).

## Completed

- Implemented and walked on 2026-09-18. The change was accepted as `node:chg-0fafc648b91a7d70` and served from pin 202. The user walked it and said it works. The shell's half is truth in `agent-activity.md`, and the editor's half in `documents`' `agent-at-work.md`.

## Transferred

- Set to draft by the user on 2026-09-18 and transferred the same day:
  - `CA_0055_001`–`CA_0055_004`, the shell's half: `docs/system/workspace/agent-activity.md`, *Run Chips Under The View Bar*.
  - `CA_0055_005`–`CA_0055_008`, the editor's half: `documents`' `docs/system/documents/agent-at-work.md`, *Proposals In Place*.

## Decided

* With proposals shown, a proposed rewrite replaces the block it rewrites. Only the proposed version is drawn, and the original is hidden. Hiding the change's proposals through its chip brings the originals back, which is how the two are compared. User decision, 2026-09-18.
* The run chips stand directly below the view bar and push the content down to make room for themselves. They leave the command bar. User decision, 2026-09-18.
* Clicking a chip, outside its *Reject all* and *Accept all*, shows or hides that change's proposals in the view. The chip reads as pressed while they are shown. User decision, 2026-09-18.
* *Show proposed changes* in the view bar shows or hides every change and resets the chips to match. A chip then shows or hides its own change. User decision, 2026-09-18.
* The collapsed dock handle no longer counts runs, since the chips no longer depend on the dock. User decision, 2026-09-18.

## Direction

- **Owning side.** The chip line becomes part of the view bar contract: the shell draws it under the bar, and the view contributes its chips, as `CA_0053` has views contribute their bar groups. So this is a `ui.shell` change, with its editor half in `documents`. The kernel is not touched.
- **Other kinds.** A removal and a move already frame the block that stands, and an insert has no block to replace, so only a rewrite changes place. A rewrite's mark line, editing into it and its drag stay as `BO_0265_010` has them.
- **Live runs.** The reader's live run's items still show without the toggle (`BO_0265_012`). Its chip reads as pressed from the start, so clicking it hides them like any other change.
- **What is kept.** A chip's shown or hidden state is the tab's, as the toggle's is, and is not kept across a reload.
- **Release notes.** The *Added* line `BO_0265` wrote puts the chips above the command field. This change rewrites that line.
