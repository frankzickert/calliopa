# DO_0004_FEAT_proposal-chip-and-block-controls

Status: completed

Requested: 2026-09-18, by the user, from using proposals in the served editor.

A proposed block carries its proposer, its words and its answers in one chip, the way a command
does. It is placed with less room around it, and accepting it leaves it where it stands. Its
controls stay out of sight until the reader turns to the block. On a phone, a first tap focuses the
block and shows its controls, and a second tap edits it. On a desktop, hovering shows the controls
and one click edits. That desktop rule applies to ordinary blocks too.

## The Ask

1. **One chip.** A proposed block's proposer, its summary and its two answers, accept and reject,
   stand in one chip, the way the command control does: a single border around them, and every
   control the same size.
2. **Accepting keeps the place.** A proposal the reader accepts stays where it stands. Today it
   lands somewhere else, perhaps because the reader dragged it first.
3. **Less spacing.** The space between proposed blocks is smaller, so the proposals take less of
   the page.
4. **Controls hidden until focused (phone).** A proposed block shows no controls at rest. A tap
   focuses it, as it would an ordinary block, and shows the drag handle and the proposal's answers.
   Only a second tap edits it.
5. **Hover and one click (desktop).** A proposal's controls show on hover, and one click edits it.
   The same holds for ordinary blocks.

## Where This Starts

Read from `documents`' docs at dataRevision 336:

- **The line today** (`proposed-changes.md`, `agent-at-work.md` `BO_0265_010`).
  - `.proposal-block__mark` holds three things: the face, the words and the answers. They are not
    one chip. The face is 24px and is the drag handle. The answers are Phosphor `check` and `x`,
    32px, or 44px on a coarse pointer.
  - The line sits half over the bottom border and is always shown.
  - Two fixed lines require it: *says who proposed it and what it does at a glance*, and
    *answered where it is read*.
- **The command chip** (`command-mode.md`, `BO_0267_027`/`_028`). It is a single border around icon
  buttons of one size, 24px, and each button is named by its label. Item 1 asks for that shape.
- **Spacing.** `.proposal-block` has `margin: 0.6rem 0 1.5rem` and `padding-block: 0.35rem 0.95rem`
  (`block-editor.css`). The bottom 0.95rem and 1.5rem make room for the line on the border.
- **Place and acceptance.** There are two ways the drawn place can differ from the place an
  acceptance writes. Both are unconfirmed:
  - A shown rewrite is drawn *in its block's place* (`CA_0055_005`, `placeProposals` in
    `views/reading-order.ts`). Dragging it stages `SET order` into its group (`BO_0233_007`). The row
    may keep standing at the block's old place while the staged key points somewhere else, and
    accepting then lands the block at that key.
  - Arrow presses on the face stage the new place only after a 600 ms pause. An answer pressed
    inside that pause answers the place staged before.
  - The first step is a reproduction. It takes a drag, an arrow move, and a rewrite, an insert and a
    move each accepted. It compares the drawn position with the order key the answer writes.
- **Press and focus** (`block-editor.md`, fixed `CA_0046_001`).
  - *A first press focuses; a second edits*, on every viewport. The first press reveals the block's
    depth affordance.
  - The grips already show on a desktop row on hover or keyboard focus, and on a phone on the
    focused row (`BO_0267_027`).
  - Item 5 changes this fixed line for a desktop, where one click edits.

## Decided

* On a desktop, one click on an ordinary block or a proposed block edits it. Its controls show on
  hover. On a phone, a first tap focuses the block and shows its controls, and a second tap edits.
  This replaces `CA_0046_001`'s *a first press focuses; a second edits* on a desktop and keeps it on
  a phone. User decision, 2026-09-18.
* Accepting a proposal leaves the block where the reader sees it. User decision, 2026-09-18.
* A proposed block's proposer, words and answers form one chip of equal-size controls, as the
  command control does. User decision, 2026-09-18.

* "Desktop" means a pointer that can hover (`(hover: hover) and (pointer: fine)`), not a screen
  width. A tablet with a mouse behaves as a desktop, and so does a narrow desktop window. User
  decision, 2026-09-18.
* At rest, a proposed block shows only its proposer's ground and edge. The whole chip is hidden:
  face, words and answers. It shows on hover on a desktop, and after the first tap on a phone.
  This replaces the fixed line *says who proposed it and what it does at a glance*
  (`proposed-changes.md`, `BO_0233`/`BO_0265`) for the resting state. The block's accessible name
  still says who proposed it and what it does. User decision, 2026-09-18.
* On a desktop, hover and keyboard focus reveal a block's depth affordance, since one click now
  edits. User decision, 2026-09-18.
* The chip's controls are 24px on every device, the command chip's size, with no touch minimum.
  User decision, 2026-09-18.
* A proposed block is spaced like an ordinary block. The chip stands over the border when shown,
  takes no room in the flow, and moves nothing when it appears. This replaces the reserved 0.95rem
  and 1.5rem. User decision, 2026-09-18.

## Implemented

- Implemented 2026-09-18 (`_001`–`_006`, `_008` folded into truth in the three topics). The accept that moved a block was a rewrite dragged or stepped: its new key was staged but it stayed drawn in its old place. It now stands where its key puts it, and an answer stages a pending arrow step first. Walked at pin 367: everything worked but acceptance, where blocks still jumped. The run's inserts shared order keys, so blocks with one key read by identity; the editor now draws ties as acceptance orders them, and the shell's propose mints distinct keys. The kernel's agent tools mint the same duplicate keys and need a fixed-layer change. At pin 373, dragging and accepting kept proposals where they were dropped, in a fresh document. The `Test` document keeps its ties by the user's decision. Completed 2026-09-19.

## Transferred

- Transferred on 2026-09-18 into `documents`' docs: [Block Editor View](../system/documents/block-editor.md#one-click-on-a-desktop), `DO_0004_001` and `_002`; [The Agent At Work](../system/documents/agent-at-work.md#the-proposal-chip), `_003` to `_007`; [Proposed Changes](../system/documents/proposed-changes.md#accepting-keeps-the-place), `_008`. The walk is `_007`.

## Open Questions

- None. The answers are folded above (2026-09-18).
