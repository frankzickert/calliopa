# CA_0062_FEAT_the-chip-line-scrolls

Status: completed

Requested: 2026-09-22, by the user: "next, i want the chips to take a single row only. if the space
is not enough, make it scrollable horizontally"

The chip line stands between the view bar and the document, and it pushes the document down by
whatever it takes. Wrapping, it takes more the more runs there are: a second row on a desktop with
four chips, three rows on a phone with two, and the document moves under the reader every time a
run ends. This change makes the line one row that scrolls, as the view bar became one row that
scrolls this morning (`CA_0060`), so what the line costs the document is one height whatever it
carries.

## Where This Starts

- **The line wraps.** `.run-chips` (`shell.css`) is an absolutely placed flex row under the bar,
  `flex-wrap: wrap`, `gap: 0.4rem`, `padding: 0.35rem 0.6rem`, on the panel's raised ground with a
  bottom edge.
- **What it takes, the document gives.** `RunChips` measures its own line with a `ResizeObserver`
  and publishes the height as `--view-chips-height` on the region; the block editor's
  `--block-bar-height` is the bar's height plus it, and its padding and scroll margins keep that
  clear ([Agent Activity](../system/workspace/agent-activity.md), `CA_0055_001`). So every row the
  line wraps into is a row the document moves down.
- **The chips are small now, but not all of them.** From the second chip on, a chip that is not the
  expanded one is a face, a number and two signs (`CA_0061`); the expanded one carries its words
  and its labelled answers, and a session chip its pencil. One expanded chip and several collapsed
  ones is the ordinary line.
- **The view bar already solved this.** `.view-bar` is `flex-wrap: nowrap` with `overflow-x: auto`
  and `overflow-y: hidden`, nothing held at an edge, and an end with groups beyond it fades
  outwards: two sticky `::before`/`::after` items pulled out of the flow by negative margins, shown
  from `data-more-start` and `data-more-end`, which `ViewBarPanel` writes on a scroll and on a
  resize from `moreBeyond(scrollLeft, scrollWidth, clientWidth)` — no stylesheet can see a scroll
  position (`CA_0060_001`, `CA_0060_002`).
- **A chip already gives way when it must.** `.run-chip` is `max-width: 100%` and
  `.run-chip__text` truncates with an ellipsis, which is what keeps one long summary from taking
  more than the line.
- **The chips are ordered newest first**, the running runs before the ended groups, and the
  reader's own proposal sessions after them.

## What Should Change

### One Row That Scrolls

- The line is one row whatever it carries: `flex-wrap: nowrap`, scrolling sideways when the chips
  need more room than it has, with nothing held at either edge.
- Its height stops depending on the number of chips, so the document is pushed down by one height
  and stays there while runs come and go. `--view-chips-height` is still measured and published —
  the line is still the line's own height — but it no longer grows.
- On a phone this is what makes the line usable at all: three chips there wrap into three rows
  today, which is most of what a phone screen has above the document.

### The Ends Fade

- An end with chips beyond it fades outwards, the way the view bar's does, so the line says it
  holds more than the reader can see. It is the line's own ground thinning out: it answers no
  press, carries no count and takes no room from the chips.
- Which end has more is read off the line on a scroll and on a resize, as the bar reads it. The two
  lines are the same idiom and share the same measure, rather than each keeping its own.

### The Expanded Chip Is Brought Into View

- When a chip becomes the expanded one without the reader pressing it — a run ending takes the
  expansion, the bar's toggle expands the newest, a document opens with its proposals shown
  (`CA_0061`) — the line scrolls it into view, so the reader can see whose changes are on the page.
- A press the reader made needs nothing: the chip they pressed is where their hand is.
- Nothing else moves the line. It does not scroll back to the start when a chip goes, and it does
  not follow the newest chip as runs arrive.

### A Wide Chip Gives Way

- The expanded chip takes at most the line's width, and its words truncate with the ellipsis they
  already use, so the collapsed chips beside it stay a short scroll away rather than a long one.
- Its answers and its pencil are never what truncates: the controls keep their size and the words
  give way, as they do on a bar's control.

Decided by the user, 2026-09-22: the ends fade as the view bar's do; a chip that becomes expanded
without a press is scrolled into view; and an expanded chip's words truncate rather than taking the
room they want.

## Technical Notes

- `moreBeyond` is exported from `view-bar.tsx` and unit-tested there; two callers make it a
  `src/lib/` function, which is where the shell keeps what more than one component measures. The
  scroll listener and the `ResizeObserver` follow the bar's shape — `RunChips` already keeps a
  `ResizeObserver` on the line for its height, and it can read both from one pass.
- The fade's own rules are the bar's: sticky flex items at each end, pulled back by a negative
  margin so they take no room, painted over the chips, `opacity` switched by `data-more-start` and
  `data-more-end`. On the chip line they stand on `--panel-raised`, the line's ground, not the
  bar's.
- Scrolling a chip into view is `scrollIntoView({ inline: "nearest", block: "nearest" })` on the
  chip that carries `shown` when it gains it, with `behavior` following reduced motion. It must not
  scroll the page: `block: "nearest"` on a line already in view moves nothing vertically.
- The render harness parses no custom property and measures no scroll, so the fade and the
  scroll-into-view are the walk's to see, as `CA_0055_001`'s line measurement is. What the harness
  can prove is `moreBeyond`, the attributes the line carries for a given scroll state, and that the
  chips are one row in `shell.css`.
- The shell's docs to change when this is drafted: `workspace/agent-activity.md`, *Run Chips Under
  The View Bar*, whose `CA_0055_001` describes the line and its height. No extension's half: what
  the view reports is unchanged.
- It ships in a release: the line for `docs/release-notes/unreleased.md` belongs under *Changed*,
  beside `CA_0061`'s.
