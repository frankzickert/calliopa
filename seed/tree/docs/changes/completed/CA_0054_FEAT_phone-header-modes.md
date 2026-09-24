# CA_0054_FEAT_phone-header-modes

Status: completed

Requested: 2026-09-18, by the user: "on mobile screens, i want to have two modes for the header.
these should be toggleable. 1. as is, except: the tab-header row should take the whole width. the
panel expand/collapse should only take the height of the row above so that the tab-headers can
take the space. 2. "minimum". here: all buttons, incl the new toggle go into one menu that sits at
the right of the top header. (the panel expand-collapse should also become so small that they fit
into the top row) then, the space between "Calliopa" and the one menu button should be taken by
one tab header that fits into that space. if text is longer, use "...". when there are other tab
headers, indicate them with the a fading out tab-header edge (like in a carousel, show the number
of tabs in that direction). the action to switch the active tab should be swipe left and right on
the top-header bar"

On a phone the header gets two modes and a control that switches between them. *Full* is today's
header with the tab strip given the whole width. *Minimum* is one line: the wordmark, one tab, and
one menu that holds every control.

## Where This Starts

- **The phone header is the line plus the tab strip** ([Layout](../system/workspace/layout.md#mobile-layout)).
  The line holds the wordmark, the save state, the process count, the two layout controls, the
  licence warning, the update hint, settings, the theme toggle and the person menu. The tab strip
  wraps below it, so the header is 73.1px at 360 CSS px (`CA_0041_008`).
- **The sheet handles are 2.75rem tall and centred on the line.** They are `position: fixed` at the
  two edges and hang down into the tab strip's row. That is why the header keeps a reserve on
  both sides, and the tab strip does not reach the edges (`.sheet-handle` in
  `src/components/shell/shell.css`, the phone media query).
- **The tabs already swipe.** Swiping across the tab strip scrolls it, and a tap selects a tab
  ([Tabs](../system/workspace/tabs.md)). A tab carries its title, the unsaved and process markers,
  and its ×.
- **The line's disclosures already exist.** `HeaderDisclosure` in `header-disclosure.tsx` is what
  the person menu and the licence warning open with. The menu this change adds is one more.

## The Two Modes

- A phone starts in *Minimum*. The mode is remembered by the device, in browser storage beside
  the theme, so each phone keeps its own.

### Full

- The line is today's line, plus the mode control: an icon button left of settings, Phosphor
  `arrows-in-line-vertical`, named *Minimum header*.
- The tab strip below takes the whole width, from edge to edge, with no reserve for the handles.
- The two sheet handles are as tall as the line and no taller, so they end where the tab strip
  starts.

### Minimum

- The header is one line, and nothing wraps below it.
- The line holds, from left to right: the library handle, the wordmark, one tab, one menu button,
  and the inspector handle. The handles shrink to fit the line.
- The menu holds every control the line had: *Full header* (the mode control, with
  `arrows-out-line-vertical`), the process console as *Process console (n)*, the save state, the two
  layout controls, the licence warning, the update hint, settings, the theme, and the person's
  name, role and *Sign out*.
- The one tab is the active tab. It takes all the space between the wordmark and the menu button.
  It keeps its × at its end, and a title too long for it ends in "…" before the ×.
- When other tabs lie to the left or to the right, that edge of the tab fades out like a carousel
  and shows how many tabs lie in that direction. A tap on a faded edge makes the neighbouring tab
  in that direction active.
- A swipe left or right anywhere on the line makes the neighbouring tab active. The handles and
  the menu button keep their taps. The swipe stops at the first and the last tab and does not wrap.
- When a status the menu holds changes, its icon takes the menu button's place for 3 seconds, and
  then the menu icon comes back with a dot. The statuses are the save state (saving, saved,
  unsaved), the process count, an update appearing, and the licence warning. Opening the menu
  clears the dot, and the next change brings it back.
- Decided by the user, 2026-09-18, in the idea's questions: all as recommended except the default
  mode (*Minimum*, not *Full*) and the save state and process count, which flash in the menu
  button's place rather than living on the tab.

## Technical Notes

- "On mobile" is the shell's existing phone media query (`max-width: 640px`). A desktop never
  shows the mode control, and it keeps its header unchanged.
- A flash that arrives while another is showing replaces it and restarts the 3 seconds; the button's
  accessible name stays *Menu* throughout, and the status is announced once through the existing
  status semantics (`SaveStatus` says its word once).
- In *Minimum* the one tab is the drop target of the tab it shows (`tab:<id>`), and the rest of the
  line is `tab:end`. A drag onto the tab strip keeps working with one tab showing.
- The swipe needs a horizontal threshold and a horizontal-over-vertical test, so a vertical scroll
  that starts on the line is not taken for a switch. It must also not start at the edge zones
  the OS back gesture uses. The handles sit there already (Mobile Layout, *System back gestures
  remain available*).
- The shell's docs to change when this is drafted: `workspace/layout.md` (Mobile Layout: the two
  modes, the handles, the menu), `workspace/tabs.md` (the one tab, its edges, the swipe), and
  `workspace/themes.md` for the storage idiom the mode shares with the theme.

## Transfer

Transferred 2026-09-18 into the shell's docs:
- `workspace/layout.md`, Header Modes: `CA_0054_001`–`_006` (the modes and their storage, *Full*, *Minimum* and its menu, the status flash, harness and measurement, the walk-through).
- `workspace/tabs.md`, The One Tab: `CA_0054_007`–`_009` (the one tab and its edges, the swipe, the harness).

The storage idiom needs nothing in `themes.md`; `_001` names it.

## Implementation

Implemented 2026-09-18. `CA_0054_001`–`_005` and `_007`–`_009` are truth in `workspace/layout.md`
(Header Modes) and `workspace/tabs.md` (The One Tab). The two fixed Mobile Layout lines now name
*Full* and *Minimum*. `_006`, the walk-through on a phone, was done by the user on the served build at pin 161 and is truth too. Completed 2026-09-18.
