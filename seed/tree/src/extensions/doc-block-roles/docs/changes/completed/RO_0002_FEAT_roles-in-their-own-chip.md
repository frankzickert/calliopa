# RO_0002 — The block's roles in their own chip

Status: completed

## Summary

The roles of the block being edited move out of its command chip into a chip of their own: a
separate line directly below the command chip, with a small gap between the two, standing with it.
The command chip keeps the command's own controls — agent, speed, mode, pointing, attachments, what
the command carries, *Keep as content*, *Deepen*, *Gather*, *Send* — and the profile once `BO_0311` lands there (`RO_0002_Q8`); the roles
chip carries the block's roles and nothing of a command's own. User request, 2026-10-01.

## Why

- The role control today is one `command` block decoration among the command's controls
  (`BO_0309_021`, in the place `BO_0273_009` opened). Roles are a fact about the block, not part of
  what is sent; a line of their own says so, and gives the block's roles room the command line,
  which already wraps on a phone, does not have.
- The document's own roles already work this way: the `title` place is a line of its own under the
  title, carrying only the role control (`BO_0309_030`/`_031`). A block gets the same shape.

## What It Revises

- doc-block-roles `system.md`, the fixed line *A role is assigned from the block*: "its command chip
  carries a role control beside the profile and the agent" becomes a chip of its own below the
  command chip. Revised at the user's request; the new wording is settled at draft.
- documents `block-document-model.md`, the fixed line *taken, cleared and given values from the
  chip of the block being edited*, and the truth line *the chip's control a `command` block place*.
- documents `command-mode.md`, *A Contributed Control In The Chip*: the fixed line "The chip does not
  grow a second row" (user decision, 2026-09-21) stays true — the roles chip is a second chip with
  its own border, not a second row of the command chip (`RO_0002_Q7`).
- `ui.shell`'s contribution contract: a new `BlockPlace` beside `command`, drawn by `documents` in
  the new line, so the command chip stays ignorant of what it draws (`BO_0273_007`). Whether the
  roles extension stays the place's only contributor or the place is general is technical, decided
  at draft.

## Scope

- The roles chip of a block: where it stands, when it is drawn, what it holds.
- The `documents` view drawing a second line under the command chip, and the place in the contract.
- The role control leaving the `command` place.
- Not in scope: the `title` place and the document's roles; the pills while reading; the *Roles*
  category; how a role is suggested, picked or offered (`BO_0318`'s rules stand as they are).

## Acceptance Scenarios (Draft)

- Given a block being edited, when its command chip is drawn, then a roles chip stands directly below
  it, aligned with it and separated by a small gap, and the command chip holds no role control.
- Given a block carrying two roles, when it is being edited, then the roles chip shows them as two
  pills and a `+`, a press on a pill opens that role's fields below the chip, and the block's
  headline pills still stand.
- Given a block with no roles, when it is being edited, then the roles chip holds only the `+`, and
  its press opens the typeahead and the suggestions below the chip.
- Given the command chip wraps onto several lines on a phone, when the block is edited, then the
  roles chip still stands below the whole command chip with the same gap and covers none of it.
- Given the person moves the edit to another block, then both chips follow together.

## Decisions

User decisions, 2026-10-01:

* The roles chip shows the block's roles as pills, each opening its fields when pressed, followed by
  a `+` that opens the typeahead and the suggestions (`RO_0002_Q1`).
* The roles chip is drawn whenever the command chip is, including on a block with no roles, where it
  holds only the `+` (`RO_0002_Q2`).
* The reading pills at the block's headline stay while the block is being edited; the roles chip
  shows the same roles below (`RO_0002_Q3`).
* The roles chip starts at the command chip's left edge (`RO_0002_Q4`).
* Both chips float over the next block, as the command chip does today; the next block does not
  move to make room (`RO_0002_Q5`).
* A pill's or the `+`'s popover opens below the roles chip, leaving the command chip in view
  (`RO_0002_Q6`).
* The roles chip is a second chip with its own border, not a second row of the command chip, so
  "The chip does not grow a second row" (2026-09-21) stands unchanged (`RO_0002_Q7`).
* The profile (`BO_0311`) stays in the command chip; it chooses how the command runs
  (`RO_0002_Q8`).

## Transfer

Transferred 2026-10-01; the decisions above are fixed lines there:

- `ui.shell`'s contribution contract, *A Chip Under The Command Chip*: `RO_0002_001`, the
  `underCommand` block place.
- `documents`' command mode, *A Chip Under The Command Chip*: `RO_0002_002` (drawing the chip),
  `RO_0002_003` (its proof); `RO_0002_Q4`, `Q5`, `Q7` as fixed lines. Block document model: the
  fixed line on where roles are taken now names the roles chip.
- `doc-block-roles`' system document: the fixed lines on assigning roles (`Q1`, `Q2`, `Q6`, `Q8`) and
  on the pills (`Q3`) revised; *The Roles Chip*: `RO_0002_004` (the control in the new place),
  `RO_0002_005` (its proof), `RO_0002_006` (the release line), `RO_0002_007` (the walk).

## Implementation

Implemented 2026-10-01 from head 3465, merged onto the head it was staged on: `RO_0002_001`–`_006` are truth in the documents named under
Transfer; `RO_0002_007`, the user's walk, followed (Walk, below).

## Walk

- Walked by the user at pin 3535, 2026-10-01: the roles chip stood below the command chip as
  built. The user's decision: when the row has room, the roles chip stands in the command chip's
  row, aligned right, and goes to the next row only when it has not — replacing `RO_0002_Q4`'s
  left edge below. On the next row it stays at the right. The popover opens under the chip,
  anchored at its right edge. Built from head 3580; `RO_0002_007` walks it again.
- Walked again at pin 3611, 2026-10-01: the chip stood in the row as decided. On an iPhone the user
  expected the popover to open from the bottom, apart from the chip. Decided the same day: on a
  phone only, the role popover — the block's chip and the title's tag alike — is a sheet from the
  bottom of the screen over the dimmed page, closed by a tap on the page or a swipe down, riding
  above the keyboard. The command chip's centring lost its transform so the sheet can be fixed to
  the screen.
- Walked a third time at pin 3635, 2026-10-01, on a desktop and an iPhone: "works". Asked the
  same day, the user kept the sheet's dimmed page over `RO_0004`'s sheet with no backdrop, and
  `RO_0004`'s lines in the system document say so.

## Completed

Completed 2026-10-01: every task is truth in the system documents, and nothing of the change is
claimed.
