# Close All Tabs

Status: completed

A tab closes one at a time, from the × it carries. A reader who has opened a dozen documents,
an episode and settings over a session, and wants the workspace clear, presses × twelve times
and watches the strip re-seat after each. The user asked on 2026-09-23 for a *close all*
control for the opened tabs.
Set to draft by the user the same day and transferred: the tasks are `CA_0067_001`–`CA_0067_005`
in the shell's `docs/system/workspace/tabs.md`, Closing All Tabs, with the three functional questions
beside them. Set to ready by the user the same day, with the questions unanswered, and implemented
under the default the first task stated: every tab closes, settings included, without asking about
unsaved work, as a single × does. `CA_0067_001`–`CA_0067_003` and `CA_0067_005` are truth; the walk
on the served build (`CA_0067_004`) and the three questions remain. The first walk, at pin 1952, found no
control: the strip scrolls and six open tabs had carried it past the visible end. It now sticks at the
strip's visible end.
Walked at pin 1987 and reported working by the user on 2026-09-23; completed the same day. The
three functional questions stay open in `tabs.md` under Closing All Tabs, with the default in force.

## What Is Asked

* One control closes every open tab of the workspace. User request, 2026-09-23.

## What The System Already Holds

- The strip is `nav.tab-strip`, named *Open tabs*, in `src/components/shell/shell.tsx`: the
  tabs between the two `TabEdge`s, each a `.tab-wrap` holding the tab button, its markers and a
  `.tab-action.tab__close` named *Close <title>* ([Tabs](../system/workspace/tabs.md)). The close
  control is a transparent icon button that gains its surface on hover.
- Closing is pure and one tab at a time: `closeTab` in `src/lib/tabs.ts` removes the tab and,
  when it was active, activates its right neighbour or else its left; `applyTabs$` writes the
  store and saves the workspace record on every change (Workspace Record, `CA_0002_016`,
  `CA_0002_017`). A close asks nothing, unsaved marker or not: the graph holds what the editor
  wrote, and the marker means only that the last keystrokes are still on their way
  (`DO_0015`).
- The shell already closes several tabs in one step: `targetGone$` folds `closeTab` over every
  tab showing a target that no longer exists, saves once, and re-reads the library
  (`CA_0015_007`). That fold is the operation this change names.
- A workspace with no tabs shows *Open a document from the library to begin.*
  (`data-workspace-empty`), so the state after closing everything already draws.
- Settings and Update are tabs like any other: they persist, restore, close and reorder as the
  content tabs do (`CA_0021_005`, `BO_0223`), and reopen revealed rather than duplicated.
- On a phone in the header's *Minimum* mode the line holds the active tab alone, its × and its
  markers, with the neighbours as fading edges; in *Full* the strip runs below the line from
  edge to edge ([Layout](../system/workspace/layout.md), Header Modes; The One Tab). The menu in
  *Minimum* holds every control the line has (`CA_0054_003`).
- The chrome is quiet: header controls are transparent icon buttons, and nothing stands where
  no one is looking.

## Shape

- One operation in `src/lib/tabs.ts`, `closeAllTabs`, answering the empty state — no tabs and
  no active tab — so the control and any later *close others* share a definition with
  `closeTab`, and `tabs.test.ts` holds it over an empty strip, one tab and several.
- The control sits at the end of the strip, after the last tab and before the trailing edge:
  a transparent icon button in the tab-action idiom the × already uses, named *Close all tabs*,
  drawn only while the strip holds a tab and hidden when the workspace is empty, since a control
  that closes nothing would say there is something to close. It is not a tab, so a drag over the
  strip's `tab:end` target and the keyed tab wraps are untouched, and `TabEdge` counts tabs, not
  it.
- One press: the strip empties, the active tab is none, the workspace shows its empty line, the
  header's save state shows nothing (a view reports for a tab it is mounted on, and none is),
  and the record saves once. The inspector and the library keep their state, because they are
  the panels' and not the tabs'.
- A phone in *Minimum* has no strip end: there the control is a row of the header menu, in the
  same place the layout controls take, with a `.menu-label` reading *Close all tabs*, and a
  press closes the menu as a press on a control does. In *Full* the strip's end is on the
  strip.
- Verification as the strip is verified: `tabs.test.ts` for the operation; the render harness
  (`header-menu.test.ts`) for the control on the desktop's strip and in the *Minimum* menu,
  present with tabs and absent without; `tests/browser/tabs.spec.ts` proving on both form
  factors that one press leaves the strip empty, the empty line showing, and a reload finding
  no tabs; an axe scan.
- The docs land in `docs/system/workspace/tabs.md`, in the proposal that carries the code; a
  release-notes line goes to `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` under
  *Added*, since `ui.shell` ships with every release.

## Functional Questions

- [ ] Does *close all* close a tab with unsaved work, as a single × does today without asking,
  or does it skip such tabs and leave them in the strip, or ask once before closing them all?
- [ ] Does *close all* close the settings and update tabs too, since they are tabs like any
  other, or only the content tabs?
- [ ] Is *close all* the whole request, or should the tab carry the neighbouring gestures as
  well — *close others* and *close to the right* — in a menu on the tab, the way an IDE's tab
  strip does?
