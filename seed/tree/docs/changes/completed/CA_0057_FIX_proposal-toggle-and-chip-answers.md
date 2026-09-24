# Proposal Toggle And Chip Answers

Status: completed

This change fixes two layout problems the user found on a phone on 2026-09-18. First, the run chip's *Reject all* and *Accept all* are too tall on a phone, so the minimum height they get on a touch screen is removed. Second, on every viewport, *Work in a proposal* leaves the line under the document's title and becomes a toggle icon in the document's view bar: pressing it enters your proposal, and pressing it again leaves it. The branch line under the title goes away, and each proposal session becomes its own proposal, answered through a chip of its own on the run chip line. The change belongs to `ui.shell`, which owns the run chip and the view bar. The branch line is `documents`' half.

## Where This Starts

- The run chip's answers are `.run-chip__answer` in `src/components/shell/shell.css`. On a touch screen, `@media (pointer: coarse)` gives them and the chip's own toggle (`.run-chip__toggle`) `min-height: 44px`, which makes the whole chip line at least 44px high ([Agent Activity](../system/workspace/agent-activity.md), `CA_0055`).
- The branch line stands under the document's title, on every document the person can edit ([Document Panel](../../src/extensions/documents/docs/system/documents/document-panel.md), Proposal Branches, `BO_0250_020`). In truth it reads *Work in a proposal*. In a branch it reads *Proposal · yours* with *Accept this proposal*, *Reject this proposal* and *Leave the proposal*. *Accept this proposal* opens the acceptance card, where drifted members are kept or dropped. *Reject this proposal* lists what the branch held as rows, and each row can be promoted on its own.
- Under separation of duties (`BO_0212_011`) the tab enters the branch at once. The line then reads *Someone else accepts it.* instead of *Accept this proposal* and has no *Leave the proposal*.
- The document view's bar (`CA_0053`) has the groups *View*, the block's groups, and the trailing *Document* group, which holds *Delete document*. A toggle in the bar is one icon with a label and an `on` state ([Layout](../system/workspace/layout.md#the-view-bar)).

## Asked

- On a phone, `.run-chip__answer` has too much minimum height. Remove the attribute altogether.
- On a phone and on a desktop, move *Work in a proposal* into the document's toolbar as an icon toggle: work in the proposal, or leave it. Remove the other two buttons.

## Implemented

- Implemented on 2026-09-18 and served at pin 303. The shell's half is truth in `agent-activity.md`, the editor's in `documents`' `document-panel.md` and `block-editor.md`.
- Walked at pin 303 the same day: the user said it works, and decided two changes (`CA_0057_014`, `CA_0057_015`). Those were served at pin 338 and walked the same day, and the user said they work.

## Completed

- Completed on 2026-09-18. One functional question stays open as follow-up work in `documents`' `document-panel.md`: what happens when a session edits a block an earlier open session of the person already changed.

## Decided In The Walk

* A session chip's press shows or hides its proposal as a run chip's does, so several of the person's proposals can be shown at once, as several runs' can. A pencil on the chip puts the tab to work in that proposal; edits go into one proposal at a time. This replaces the chip's press working in the session. User decision, 2026-09-18 (`CA_0057_014`).
* A chip whose change is shown takes a tinted background, agent or person, and the session the tab works in a stronger one. User decision, 2026-09-18 (`CA_0057_015`).

## Transferred

- Set to draft by the user on 2026-09-18 and transferred the same day:
  - `CA_0057_001`–`CA_0057_004`, the shell's half: `docs/system/workspace/agent-activity.md`, *Proposal Sessions As Chips*.
  - `CA_0057_005`–`CA_0057_009`, `CA_0057_011` and `CA_0057_012`, the editor's half: `documents`' `docs/system/documents/document-panel.md`, *The Proposal Toggle And Sessions*.
  - `CA_0057_010` and `CA_0057_013`, separation of duties: `documents`' `docs/system/documents/block-editor.md`, *Separation Of Duties*.

## Decided

* On a touch screen, the run chip gets no minimum height. The whole `@media (pointer: coarse)` rule for `.run-chip__answer` and `.run-chip__toggle` is removed, so the chip line is as high as its text. User decision, 2026-09-18.
* *Work in a proposal* is a toggle in the document view's bar, in the trailing *Document* group before *Delete document*. It uses Phosphor `git-branch`, is labelled *Work in a proposal*, and reads as pressed while the tab works in one of the person's proposals. It is drawn wherever the branch line is drawn today, and never on a change document. User decision, 2026-09-18.
* The line under the title is removed, along with *Proposal · yours*, *Accept this proposal*, *Reject this proposal* and *Leave the proposal*. The toggle's pressed state is what shows that the tab works in a proposal. User decision, 2026-09-18.
* Each proposal session is its own proposal. A session runs from pressing the toggle to pressing it again. Pressing the toggle again starts a new proposal, even while earlier ones are still open, rather than reopening the open one. User decision, 2026-09-18.
* Each of the person's open proposals on the document shows as a chip of its own on the run chip line. The chip reads *Proposal · yours* followed by the time its session started, for example *Proposal · yours · 14:32*, and carries *Reject all* and *Accept all*. *Accept all* opens the acceptance card when a member has drifted, so a drifted member can still be kept or dropped. *Reject all* lists what the proposal held as rejected rows, so a block can still be promoted on its own. User decision, 2026-09-18.
* Leaving a proposal only means that the person stops editing in it, and it is always possible, under separation of duties too. Only accepting may need someone else: under separation of duties, the person's own chip offers no *Accept all* and says that someone else accepts it. User decision, 2026-09-18.
* Under separation of duties, an edit made outside a proposal starts a new session by itself, as a refused save enters the branch today (`BO_0212_011`), and the tab no longer enters a proposal by itself when the document opens. User decision, 2026-09-18.
- On transfer, the branch stops being one group per document and person, `node:branch-<document>-<account>`, that is reopened while it is open. Naming, reading and listing several open groups per person is technical work for `documents` and the core's branch routes, which the transfer enumerates.
