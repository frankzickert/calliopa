# CA_0043_FIX_proposal-face-clears-the-handle

Status: completed

Requested: 2026-09-11. *When there is an agent icon because a block is a proposal from an agent, this image overlaps the drag handle. Therefore, position the agent image at the vertical center of the block's left border but with a minimum top spacing so that we can see the drag handle also if the block is only one line.* User statement.

## Where This Starts

- **A removal or a move frames the block that stands, and that block keeps its own leading gutter.** An active block shows its ⠿ handle there (`.block-grip--start`, `top: 0.4rem`). An inactive text block shows its standing glyph in the same place (`.block-standing`, `top: 0.45rem`). Both sit at the row's leading edge, which is the proposal's left border, because a framing proposal drops its own gutters.

- **The face is pinned to the proposal's top on that same edge.** `.proposal-block__face` is 28px, `top: 0.3rem`, centred on the left border by `translateX(-50%)`. So on every framed block it covers the handle and the standing glyph, whatever the block's height. Served at pin 312.

## Intent

* The proposer's face sits at the vertical centre of the proposal's left border.

* The face never sits higher than just below the place the leading gutter's handle takes, so the handle stays in sight on a block of one line. There the face hangs past the lower border into the space below the block.

* The rule is the same for every proposal: a rewrite and a new block place their face the way a removal and a move do.

## The Shape

- **One rule on the face.** `.proposal-block__face` takes `top: max(<clearance>, calc(50% - 14px))`. The clearance is the lower edge of the handle and of the standing glyph in a framed proposal, plus a small gap. By the stylesheet that is about 2.25rem. The number is measured in a browser, not taken from the arithmetic.

- **A touch keeps its handle.** The face's enlarged touch target (`::before`, `inset: -8px`) reaches up toward the handle. The grip comes later in the document at the same `z-index`, so it paints above the target and keeps its presses. This is checked, not assumed.

- **The docs follow.** In `docs/system/documents/proposed-changes.md`, the line *The face, 24px, is centred on the left border and is the handle* gains where on the border the face sits and why.

- **Task.** `CA_0043_001`, in `documents/proposed-changes.md`: the face sits at the proposal's vertical middle on its left border, never above the clearance below the leading gutter's handle. The proof is a layout measurement in Playwright, using the CA_0041 fixture-host recipe. It covers a framed and an own-text proposal, each of one line and of several lines, on desktop and phone widths. In every case the face's box and the handle's box do not intersect, and the face stays clear of the next block's gutter. The walk-through is on the instance.

## Overlap

- `CA_0042_FIX_editing-a-stale-proposal` also revises `documents/proposed-changes.md`. Files in the graph are whole-file members, so whichever change is accepted second is staged again on the new head.
