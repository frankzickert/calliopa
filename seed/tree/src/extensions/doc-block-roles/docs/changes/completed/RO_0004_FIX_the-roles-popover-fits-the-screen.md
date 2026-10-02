# RO_0004_FIX_the-roles-popover-fits-the-screen

Status: completed

Requested 2026-10-01: **make sure the role selection dialogue fits on the screen without
extending it.** User statement.

The roles popover (`data-roles-popover`) opens below its chip — the block's roles chip under the
command chip (`RO_0002`) and the title's chip — and holds the roles taken, each unfolding to its
fields, the suggestions and the typeahead (`BO_0309_021`). On a block near the bottom of the document, on a phone, or with a role's
fields unfolded, it reaches past the visible area and the page extends to hold it. Read in
`roles.css` at head 3551, not yet measured: the popover is absolute below its chip with
`max-height: 60vh`, a bound blind to where the chip stands — a chip low in the view still gets
60vh below it, so the scrolling surface grows to take it; `vh` does not shrink with an on-screen
keyboard; and it starts at the chip's left edge, so a chip at the right of its row sends it past
the view's right edge.

## Scope

- The owner is `doc-block-roles` (`views/control.tsx`, `roles.css`); `documents` only if the
  place's box has to change to let the popover leave it.
- The popover stands wholly inside the visible area of the view on every viewport, desktop and
  phone, for the block's chip and the title's, and never lengthens the document, widens it, or
  scrolls the page to show itself.
- Above the shell's phone width (640 CSS px) it stays a popover at its chip. It opens below the
  chip; where the room below is smaller than the room above, it opens above instead. Its height is
  capped to the room on the side it opens to, and it is shifted along the line so it does not
  cross the view's edge — a chip aligned to the right of its row (`RO_0002` walk) opens a popover
  that ends at the view's right edge rather than past it (Q1, answered 2026-10-01).
- At the shell's phone width and below, it is a sheet from the bottom edge of the frame, full
  width, its height capped to the frame (Q2, answered 2026-10-01). It stands over the dimmed page
  `RO_0002` drew, whose tap closes it and does nothing else: the user decided so on 2026-10-01,
  after `RO_0002`'s walk, replacing this change's sheet with no backdrop.
- What does not fit inside it scrolls inside it, with the typeahead and the roles taken
  reachable without scrolling the page.
- One role's fields are unfolded at a time; unfolding one folds the one open before. This is
  what the popover does now and stays so (Q3, answered 2026-10-01).
- Above the phone width, a press outside the popover and its chip closes it and still acts; on a
  phone the dimmed page takes the press (user decision, 2026-10-01, after `RO_0002`'s walk). Keeps the popover's keys its own
  and the caret where it was.
- An on-screen keyboard shrinks the frame (`interactive-widget=resizes-content`); the popover
  and the sheet fit the frame that remains while the typeahead is focused, the sheet standing
  directly above the keyboard.
- Verified by measurement in a browser at 360 and 390 CSS px and on a desktop: the popover's box
  (or the sheet's) inside the view's, and the document's scroll height and width unchanged by
  opening it; on the desktop for a chip near the top, one near the bottom, and one aligned right.

## Transfer

Transferred 2026-10-01; the answers above are fixed lines there:

- `doc-block-roles`' system document, *The Popover Fits The Screen*: `RO_0004_001` (placing the
  popover above the phone width), `RO_0004_002` (the sheet at the phone width, and `documents`'
  place only if it keeps the sheet from the frame), `RO_0004_003` (its proof), `RO_0004_004` (the
  release line), `RO_0004_005` (the walk).
  `RO_0004_006` (the outside press above the phone width) was added there afterwards; its wording
  follows the dimmed page on the phone.

## Implementation

Implemented 2026-10-01 from head 3677: `RO_0004_001`–`_004` and `_006` are truth in the document
named under Transfer. The desktop popover is fixed and placed by measurement; the sheet is
`RO_0002`'s; a press outside closes the desktop popover and still acts. `RO_0004_005`, the user's
walk on the served build, is open.

## Walk

- Walked by the user at pin 3735, 2026-10-01: "works", but on the phone the toolbar and the agents'
  chips were not dimmed. The dimmed page and the popover now stand in the browser's top layer,
  above every bar of the shell; `RO_0004_005` walks it again.
- Walked again by the user at pin 3747, 2026-10-01: "works". Completed the same day.
