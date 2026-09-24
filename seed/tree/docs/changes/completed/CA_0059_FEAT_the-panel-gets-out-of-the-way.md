# CA_0059_FEAT_the-panel-gets-out-of-the-way

Status: completed

Requested: 2026-09-22, by the user: "when creating a new document, this should be directly opened.
and if on mobile (collapsible panel), then directly close the panel. also, when opening an existing
document, or extension (or anything other that opens in a tab), then close the panel. also close
the panel when the user taps outside of it"

A panel is a place to reach for something, not a place to stay. On a phone it lies over the
workspace, so whatever it opens lands behind it: the reader presses a document and is left looking
at the list they pressed it in. This change makes the phone's sheet get out of the way — when it
has opened something, and when the reader has gone back to the workspace by pressing outside it.

## Where This Starts

- **Creating a document already opens it.** The Documents section's create control asks the
  contribution to make the item and say what to open; the shell opens that target in a tab and
  re-reads the section (`createIn$` and `openTarget$` in `shell.tsx`, `create$` in
  `src/extensions/documents/contributions.ts`). `openTab` makes the new tab the active one
  ([Tabs](../system/workspace/tabs.md)). So the first half of the ask is already true on a
  desktop; on a phone the new tab is behind the sheet that made it.
- **A row opens or reveals its tab the same way.** Every library row with a target calls
  `openTarget$` (`library-row.tsx`), and so do two places in the inspector (`inspector.tsx`). The
  Extensions section opens an extension's owner document and a staged import in tabs of their own
  ([Tabs](../system/workspace/tabs.md)).
- **A drop that opens a tab does not exist yet.** `open-in-tab` is declared by the document, episode
  and extension kinds and accepted by the tab strip and every tab, but no library row starts a drag
  and `dropDrag$` acts on `move` alone, so the operation resolves and nothing follows. The rule
  covers such a drop when one exists; today nothing exercises it.
- **On a phone a panel is a sheet over the workspace.** `.drawer` is `position: fixed`, `z-index:
  20`, `min(82vw, 20rem)` wide, with no scrim behind it (`shell.css`, the phone media query).
  Which sheet is open is `mobile.sheet` in `shell.tsx` — browser-local, never stored, unlike the
  panel's shown state and its icon, which are the workspace record's
  ([Layout](../system/workspace/layout.md), Panels As Activity Bars).
- **Nothing closes a sheet but two presses inside it.** Its ×, and a tap on the icon whose content
  it shows (`pressClosesSheet`, `CA_0056_013`). A tap anywhere else goes straight through to
  whatever is under it — a block in the document, a tab, the header — and the sheet stays open.
- **The handles only open.** `Open library` and `Open inspector` set `mobile.sheet` to their side,
  so pressing the handle of the sheet already open does nothing. The phone's process pill is the
  one control that toggles the inspector's sheet (`CA_0058_007`).
- **On a desktop a panel covers nothing.** The library and the inspector are grid columns beside
  the workspace (`--left-column`, `--right-column`), so what a panel opens is visible the moment
  it opens.

## What Should Change

### Landing On A Tab Closes The Sheet

- Whatever a panel puts the reader on closes the phone's sheet: a library row, a section's create
  control, the Extensions section's *New extension* and *Import extension*, the inspector's own
  rows — every path that reaches `openTarget$`, and the import tab beside it.
- A row that only reveals a tab already open closes the sheet too. The reader cannot tell whether
  a tab was open before they pressed, so one row behaving differently from the next would read as a
  fault.
- A row dragged onto the tab strip or onto a tab closes it as well: the drop lands the reader on a
  tab, which is the rule. The long press begins inside the sheet, so no press-outside listener is
  involved — the drop closes it.
- A new document is made, opened in its own tab, and the sheet is gone with the same press, so the
  reader lands in the empty document rather than on the list they made it from.
- Nothing about the panel itself changes: it keeps whether it is shown and which icon it shows, so
  the next press on the handle brings back the list where it was. Only the sheet closes.

### A Press Outside Closes The Sheet

- While a sheet is open, a press outside it closes it, as the person's menu, the agent menu and a
  view's popover already close ([Layout](../system/workspace/layout.md)).
- That press closes the sheet and does nothing else. The sheet covers what is beneath it, so a
  press aimed under it is a press whose target the reader cannot see; the next press reaches the
  block, the tab or the control.
- The header is outside. A press on the tabs, the wordmark, the menu button, the gear or the theme
  closes the sheet, and the control the reader pressed still does its own work — the header is not
  covered by the sheet, so what they pressed is what they saw.
- The handle of the open sheet closes it rather than opening what is already open. It sits in the
  header, so the press-outside rule reaches it anyway; without this the handle would close the
  sheet and open it again in one press.
- The workspace is not dimmed while a sheet is open. The sheet has no scrim today, and adding one
  would change what a phone looks like whenever a panel is open.

### The Desktop Is Unchanged

- None of this applies on a desktop. There a panel is a column beside the workspace, so what it
  opens is visible the moment it opens; closing the library on every open would take the list away
  from a reader working through it, and a press outside would close it whenever they touched their
  document.

Decided by the user, 2026-09-22: the phone's sheet only; the closing press does nothing but close;
the header counts as outside; a reveal closes the sheet as an open does; a drop onto a tab closes
it; the open sheet's handle closes it; and no scrim.

## Technical Notes

- `mobile.sheet = null` is one line at each place that lands the reader on a tab; the honest shape
  is one closing step in `openTarget$` rather than one per caller, plus the extension-import path
  and the `open-in-tab` drop.
- The press outside is the `useOnDocument("pointerdown")` idiom the shell already uses for the
  header disclosure, the agent menu and the popover control; the render harness dispatches no
  `document:` listener, so that press is the walk-through's, as those three are.
- Swallowing the press turned out not to be a listener's job at all. A `pointerdown` handler does
  not stop the `click` that follows, and a document-level listener cannot come first either, because
  qwikloader's own capture listener on the document has already dispatched the element's handler by
  then. The press is absorbed instead, by a transparent shield over the workspace's grid area under
  the sheet. The header is never covered, which is how a control there both closes the sheet and
  does its own work.
- The shell's docs to change when this is drafted: `workspace/layout.md`, Mobile Layout, with the
  landing rule beside Panels As Activity Bars.

## Implementation

Implemented 2026-09-22 from a checkout at dataRevision 1200. `CA_0059_001`, `_002`, `_003` and
`_005` are truth: the two rules and how they were built stand in `workspace/layout.md`, *The Sheet
Gets Out Of The Way*, and the release note is a *Changed* line in `calliopa-bootstrap`'s
`docs/release-notes/unreleased.md`. `_004`, the phone walk, is open — the press outside is the one
thing no harness here can dispatch.

What landed: `openTarget$` closes the sheet, which is every path a panel opens a tab by; `.sheet-
shield` absorbs a press outside; `pressHeader$` closes the sheet from the header while the control
acts; `pressHandle` in `src/lib/layout.ts` makes a handle close its own sheet; `panel-host.tsx` and
`panel.test.ts` press all of it, each case shown to fail when its behaviour is taken out.

Two findings that are not this change's and were left as open work: `tests/behavior/theme-tokens.
test.ts` fails at head on `documents`' `block-editor.css` (a literal shadow colour), now a `[ ]` in
`foundation/verification.md`; and the 30 unit and 7 behaviour files that cannot load for
`@qwik-city-sw-register` are already `DO_0009_007` there. Neither touches the files this change
changed.

Walked on the served build at pin 1222 on a phone and a desktop, and the user said it works
(2026-09-22). `CA_0059_004` is truth in `workspace/layout.md`; the change leaves one `[ ]` behind
it, for the drop that opens a tab once a library row can be dragged. Completed 2026-09-22.
