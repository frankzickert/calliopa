# DO_0030_FEAT_a-cohesive-document-header

Status: wip

Requested 2026-10-01: **create a cohesive header for a doc, including roles.** User statement.

Today what stands above a document's first block is put together from three places that grew
apart: the route of a focused work (breadcrumbs and *Back*, drawn by this extension above the
headline), the title (the headline at first-level scale, edited in place), and the `title`
document place under it, where `doc-block-roles` draws the document's own role pills, the roles
*from above* when the document is a block's focused work, and — while the title is edited, the
focus is in the line or its popover is open — the role control (`BO_0309_021`, `RO_0001`,
`RO_0002`). Each has its own spacing, its own rule for when it shows and its own idiom; the
header this change asks for is one block of chrome that reads as the document's head.

## Scope

- The owner is `documents`, which draws the headline, the route and the `title` place. What the
  header holds of other extensions stays theirs, drawn into it through the place: the role pills,
  the role control and the role values are `doc-block-roles`', the mentions line is `keywords'`.
  `ui.shell`'s contract changes only if the header needs a place the `DocumentPlace` type does
  not offer.
- Keeps: the title holds text only and is edited in place; the bar lands on the headline's own
  reserved space and covers no part of the header (`CA_0031`); the header carries the clearance
  a block row carries; the route's *Back* and crumbs keep opening along the route in the shell's
  tabs (`CA_0073_003`).
- Revises `doc-block-roles`' fixed line on where a document's roles are assigned ("from a chip
  under its title while the title is being edited", `BO_0318_Q6`): the control is always drawn
  (Q2).

## Decisions

User decisions, 2026-10-01.

* The header is one unit above the first block, stacked: the route on its own small line (only
  when the route holds more than one document, as today), then the title, then the roles line,
  then the values line, then the mentions line. The same order on a desktop and a phone, with
  one spacing and the blocks' text alignment. (Q3)
* The roles line holds the document's own roles as pills, the roles from above when the document
  is a block's focused work as their own pills, muted, marked *from above* and never removable
  there, and the control to take a role, always drawn, as the block's roles chip is since
  `RO_0002`. (Q2, Q4)
* The values line shows, while reading, the field values the document's roles hold that are
  filled in, compactly, per role — *Blog post: 12 Oct 2026 · Format: PDF*. Empty fields are left
  out; a missing required value stays the pill's `!`. Values are edited in the role control, not
  in the line. (Q1, Q6)
* On a document carrying *Keyword*, the mentions line says how many blocks mention it —
  *Mentioned in 7 blocks* — and a press lists the mentioning blocks, each opening its document,
  as `keywords` already reads them. On any other document the line is absent. (Q1)
* The save state and the last change are not in the header; the save state stays in the shell's
  header. (Q1)
* The header scrolls with the document. Once it has scrolled past, a compact one-line header —
  the title and the role pills — stays under the bar until the document is scrolled back to the
  top. (Q5)
* A press on the compact line scrolls the document back to the full header. On a phone the
  compact line carries the title first and the pills after it as far as the width allows, the
  rest counted as *+N*. (Q7)

## Transfer

Transferred 2026-10-01 at draft: `ui.shell`'s `contribution-contract.md`, *A Place Under The
Title*, `DO_0030_001`; `documents`' `block-editor.md`, *The Document Header*, the decisions and
`DO_0030_002`, `_003`, `_007`–`_010`, and the fixed roles line in `block-document-model.md`;
`doc-block-roles`' `system.md`, the fixed line on assigning a document's roles and *The Document
Header*, `DO_0030_004`, `_005`, `_011`; `keywords`' `system.md`, *The Mentions In The Header*,
`DO_0030_006` and the functional question `DO_0030_Q8` (does the foot's *Mentioned in* stay).
Order: `_001` first; `_002` before `_003`; `_004`–`_006` after `_001`; `_007` and `_011` with them;
`_008` before `_009`; `_010` last.

## Implemented

Implemented 2026-10-01 from head 3729: `_001`–`_008` and `_011` are truth in the docs they were
transferred to. The header is one `<header>` holding the route, the title and the extensions' rows;
the roles line draws the pills form with an always-drawn `+`; the values line reads `rolesOf`, which
answers `referenceTitles`; the keywords' mentions line replaces the foot's list; the compact line
hangs from a sticky anchor of no height under the bar. Measured in Chromium at 360, 390 and 1280 CSS
px. Open: `_009`, the walk on the served build, and `_010`, the close.
