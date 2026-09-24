# CA_0060_FIX_the-bar-scrolls-as-one

Status: completed

Requested: 2026-09-22, by the user: "on mobile, when there is not much room for the toolbar, the
left and the right (fixed parts) consume the entire space. whenever the total required space exceeds
the available, make the entire content of the toolbar scrollable"

The view bar has parts that stand whatever the reader is doing: the groups at its leading end and
the trailing group, which is pinned to the trailing edge. On a phone those two ends are about as
wide as the bar, so the groups that come and go with the block have almost no window left to scroll
through. Whenever the bar's groups need more room than the bar has, nothing is pinned and the whole
row scrolls as one.

## Where This Starts

- **The bar is one row, and what does not fit scrolls sideways.** `.view-bar` in
  `src/components/shell/shell.css` is `flex-wrap: nowrap`, `overflow-x: auto` and exactly
  `--view-bar-height` (2.5rem) on every viewport
  ([Layout](../system/workspace/layout.md#the-view-bar), `CA_0053_003`).
- **The trailing group is pinned to the trailing edge.** `.view-bar__trailing` is `position: sticky`
  at `inset-inline-end: 0`, with `margin-inline-start: auto` and its own opaque ground, so the other
  groups scroll *under* it. The window the rest scrolls through is therefore the bar's width less
  the trailing group's, at every width. `ViewBarPanel` (`src/components/shell/view-bar.tsx`) draws
  the trailing groups as that separate element; the contract's `trailing` flag is what puts a group
  in it (`src/components/shell/view-bridge.ts`).
- **Some groups stand whatever the reader is doing.** In the document view, *View* (four icon
  toggles) and *Standing* (the info popover) stand at the leading end and *Document* stands trailing
  — *Take back*, *Work in a proposal*, *Delete*, and from `calliopa-refine`'s decoration
  *Establish…*, which is words rather than an icon
  ([Block Editor View](../../src/extensions/documents/docs/system/documents/block-editor.md), the
  bar's groups; `BO_0274_004`). Only *Format*, *Turn into*, *Block*, *Standing* and *History* come
  and go with the subject.
- **On a phone those two ends are the whole width.** By the bar's own numbers — a 2rem minimum
  button with 0.45rem of inline padding, 0.25rem between controls, 0.5rem of inset on each side of a
  group — the leading pair is around 200px and the trailing group around 200px once *Establish…*
  stands in words, against a 360px viewport. The groups that come and go hold around 1200px, which
  the bar was measured scrolling at 360px when it was built (`CA_0053_004`), and they now scroll
  through what little is left between the two ends.

## The Bar Scrolls As One

- Whenever the bar's groups need more room than the bar has, the whole content of the bar scrolls:
  no group is held at an edge, and the reader reaches every control by scrolling the one row.
- While the groups fit, the trailing group keeps the bar's trailing edge as it does today, and the
  leading groups keep the leading edge.
- An end with groups beyond it fades outwards, so the bar says it holds more than the reader can
  see, in the idiom the phone's one tab already uses (`CA_0054_007`). An end with nothing beyond it
  draws no fade, and a bar whose groups fit draws neither. The fade says there is more; it is not a
  control, and it carries no count: the number of groups either way means nothing to a reader, and
  the scroll is the gesture.
- Nothing else about the bar changes: one row at `--view-bar-height`, the groups in the order the
  view contributed them, a line between two drawn groups, the trailing group drawn last, and a view
  contributing no group given no bar.

Decided by the user, 2026-09-22:
- It is the shell's view bar, not the header's line and not a block's own toolbars.
- With room to spare the trailing group still stands at the trailing edge. Only the pinning goes,
  and only once the content overflows.
- It holds at every width, not on a phone alone. The condition is that the groups need more room
  than the bar has, which a desktop workspace with both panels open and a block active meets too;
  nothing in the rule is about the form factor, so no media query carries it.
- The bar fades an end that has more beyond it, as the one tab does, and carries the fade in this
  change rather than a later one.

## Technical Notes

- Dropping `position: sticky` and `inset-inline-end: 0` from `.view-bar__trailing` is the whole
  behaviour. An auto margin absorbs only positive free space, so `margin-inline-start: auto` holds
  the trailing edge while the groups fit and resolves to zero once they overflow, which leaves the
  group standing after the last leading group and scrolling with it. The scroll itself needs nothing
  measured in script and no class toggled on overflow; only the fade reads the bar.
- The group's opaque `background` is there to cover what scrolls under the pin. With nothing pinned
  it covers nothing, and the rule in `.view-bar__group` about the trailing group covering the bar's
  own inset has nothing left to say either.
- `ViewBarPanel` and the contract do not change: `trailing` still means the group is drawn last, and
  at the trailing edge when there is room for it. A view says nothing about the fade: it is the
  bar's own, decided from what the bar holds against the room it has.
- The fade has to know the scroll position, which CSS alone cannot read in every browser the shell
  supports. The shape that fits the bar: it reads its own `scrollLeft`, `scrollWidth` and
  `clientWidth` on `scroll` and on a resize of the region, and carries what it found as two data
  attributes; the fade itself is a `mask-image` on the scrolling content, or a `pointer-events:
  none` piece held at each edge the way the trailing group was held. The bar re-renders alone, so
  the read costs the view nothing (`CA_0053_004`). Which of the two is the implementation's to
  choose; the behaviour above is the same either way.
- The render harness cannot see overflow, so `view-bar.test.ts` keeps what it pins and the rule is
  measured in Chromium on the editor's real markup with the built stylesheet, by `CA_0053_004`'s
  recipe: at 360px with a block active every group reachable by scrolling and none held at an edge,
  the fade standing at an end with groups beyond it and at neither end once the groups fit, and with
  the block groups absent the trailing group at the bar's trailing edge. What the fade covers is
  scanned for contrast as the bar's axe scan is.
- The docs to change when this is drafted:
  - `docs/system/workspace/layout.md`, The View Bar. The fade is new truth there, and four lines say
    the pin always holds, the first of them fixed, so the user's decision of 2026-09-22 is what
    revises it:
    - the fixed line's *the trailing group stands at the bar's trailing edge whatever the others
      hold*, which becomes the edge while the groups fit;
    - *what does not fit scrolls sideways while the trailing group stays at the trailing edge*;
    - the implementation line's `position: sticky` and the inset that made the trailing group cover
      the bar's edge so nothing scrolled under it showed beside it;
    - the measurement record's *the trailing group ending at the bar's edge at 360 px while the bar
      scrolls 1202 px of groups under it*, which this change measures again.
  - `documents`' `block-editor.md`, whose record of the `CA_0053_007` walk reads *the trailing group
    at the phone's edge while the rest scrolls*. That was true of the bar it walked; on
    implementation it says what the walk of this change found instead.

## Transfer

Transferred 2026-09-22 into the docs:
- `docs/system/workspace/layout.md`, The View Bar: `CA_0060_001` (the bar scrolls as one, at every
  width) and `CA_0060_002` (the fade) as fixed tasks, `CA_0060_003` (the build), `CA_0060_004` (the
  measurement) and `CA_0060_005` (the walk-through). `_001` rewrites the section's fixed line and
  the three mutable lines that say the pin always holds, as the user decided.
- `documents`' `block-editor.md`: `CA_0060_006`, what the bar does at a width too small for its
  groups, and the `CA_0053_007` walk record that ends with the trailing group at the phone's edge.

## Implementation

Implemented 2026-09-22. `CA_0060_001`–`_004` and `_006` are truth: the scroll and the fade in
`docs/system/workspace/layout.md`, The View Bar, and what the bar does at a width too small for its
groups in `documents`' `block-editor.md`. The section's fixed line and the three mutable ones that
said the pin always holds were rewritten as the user decided. `_005`, the walk on the served build,
is claimed and waits for it.

- `.view-bar__trailing` keeps `margin-inline-start: auto` alone; its `position: sticky`,
  `inset-inline-end` and opaque ground are gone. The fade is `.view-bar::before`/`::after`, sticky
  at each end of the scrollport, out of the flow by a negative margin, shown by `data-more-start`
  and `data-more-end`, which `ViewBarPanel` sets from `moreBeyond` over its own `scrollLeft`,
  `scrollWidth` and `clientWidth`, on a scroll and on a resize (`view-bar.tsx`, `shell.css`).
- `view-bar.test.ts` gains `moreBeyond`'s five cases and a bar that has measured nothing drawing
  neither fade; the 16 tests pass and `tsc --noEmit` is clean.
- Measured in Chromium at 360 and 1280 CSS px in both themes, on the bar's own markup with the built
  stylesheet: at 360 with a block active the bar holds 1459px, and scrolled to the end the *Document*
  group stands at 137..360 with the *View* group at -1099..-941 — nothing held, everything reachable.
  The four fade states draw as they should and the axe scan is clean in all eight cases. The
  reading-state markup the measurement used is byte-identical to the editor's own dump, which is what
  makes the active-state transcription trustworthy.
- Two failures at head are older than this change and were left alone: `theme-tokens` refuses a
  literal shadow in `documents`' `block-editor.css` (the frame's `verification.md` carries it, found
  under `CA_0059`), and the `documents` and `calliopa-refine` view suites still do not load in the
  unit project (`DO_0009_007`, which this change's finding narrows: the editor mounts under a stub
  but activating a block wants qwik-city's location context).

Walked at pin 1227 on 2026-09-22 and reported working: the bar scrolled from end to end with a block
active and every control was reached, each end faded while it had groups beyond it, and the
*Document* group stood at the trailing edge with no block active. `CA_0060_005` is truth, the
release-notes line stands under *Fixed*, and the change is completed.
