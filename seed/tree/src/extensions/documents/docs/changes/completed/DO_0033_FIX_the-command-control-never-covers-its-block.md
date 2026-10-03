# The Command Control Never Covers Its Block

Status: completed

The user reported three problems with the command control on a phone on 2026-10-03.

## What Is Reported

* When the row is too narrow, the command control takes two lines and covers the block being
  edited. Reported by the user, 2026-10-03.
* The control is sometimes taller than one line although its command line is one line. Reported by
  the user, 2026-10-03.
* The command control never covers the block being edited. Requested by the user, 2026-10-03.
* On a phone, the list a `#` opens is hardly visible: it is only a few pixels high. Reported by the
  user, 2026-10-03.

## Where This Starts

- Read in `views/block-editor.css` and `views/command/command-control.tsx` at dataRevision 4272.
  It was measured in Chromium on a static page with the editor's own rules, at 360 and 1280 CSS px.
- `.block-command` is a zero-height flex column, `top: calc(100% + 0.9375rem)`, with
  `justify-content: center`. Its content overflows the column equally above and below. One row
  (28px) has its top at the block's lower edge. Every further row adds half its height above, so
  a control of two rows reaches 16px into the block being edited (measured: the block ends at 156,
  the control's row spans 140–200).
- The structures chip (`RO_0002`) wraps to a row of its own when it does not fit beside the
  command line. The command line is then one line, but the control is two rows high and covers the
  block as above. That is the "taller than one line" case.
- The `#` list (`.block-command__references`, and the inline-trigger list drawn the same way) is
  the first child of the same zero-height column. As a flex item with `overflow-y: auto` its
  automatic minimum height is 0, so it shrinks to its padding and border. It measured 10px high at
  both widths, with eight entries.

## Proposed Shape

- The control hangs from the block's lower edge: `top: 100%`, its content starting there
  (`justify-content: flex-start`). One row stands where it stands today (its top on the edge,
  its middle 14px below). Further rows grow downward, over the next block, which still does not
  move (`RO_0002_Q5`).
- The `#` list and the inline-trigger list never shrink (`flex: none`) and keep their cap
  (`max-height: min(14rem, 40vh)`, scrolling beyond it).
- The lists open below the control's row rather than above it, so they cover neither the block
  being edited nor the words being typed. User decision, 2026-10-03 (`DO_0033_Q1`).
- A test in the render harness asserts the rules that place the control and the lists. A
  measurement in Chromium at 360 and 390 CSS px checks two rows hanging below the edge, the list at
  its full height, and nothing of the control above the edge.

## Boundaries

- `documents` (`views/block-editor.css`, `views/command/command-control.tsx`, and the line on the
  control's placement in [Command Mode](../system/documents/command-mode.md)). The structures
  chip's content is unchanged.
- Release notes: *Fixed* — the command control no longer covers the block being edited when it
  wraps on a phone, and the `#` list shows its entries.

## Done

Set to ready by the user on 2026-10-03 and carried out the same day: `DO_0033_001`–`003`, now
truth in [Command Mode](../../system/documents/command-mode.md#the-control-hangs-below-its-block).
