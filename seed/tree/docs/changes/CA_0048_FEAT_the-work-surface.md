# CA_0048_FEAT_the-work-surface

Status: idea

Requested: 2026-09-13, the tenth part of `BO_0243` (decision and refinement, a change of this repository): *this should be the default way of working with calliopa*. The material's sections 11, 12, 41, 42, 45 and rules 20 and 21, and the frame every screen shares: the laurel, a route, a search, the person; the work; one composer — *Tell Calliopa what to do next…*. A `ui.shell` change.

## Where This Starts

At head 391, served pin 387.

- **The frame is a workspace.** A one-line header with the wordmark, a horizontally scrolling tab strip, the save state, the process count, layout controls, settings, the theme toggle and the person's menu; a left drawer with the library — Documents, Extensions, the video extension's sections — as a VS Code side bar (`CA_0044`); a right drawer, the inspector, with the view's facts and actions and a selected process's detail (`CA_0040`); a bottom dock with the composer, the console and a collapsed handle, swiped between three positions ([Layout], [Command Dock], [Tabs]).

- **Every category the material says the default interface lacks is there**: a permanent library, a permanent metadata rail, a tab strip, a console the dock grows into. The screens show a route where the tabs are, a search where the library is, nothing where the inspector is, and a composer that is always there.

- **What the inspector carries** and would need a home: a document's save state, last change and count; *Delete*; the three toggles — retired, discarded, proposed; a change document's *Change of* and its status select; a selected process's detail with *Close process*; an extension import's summary; a placeholder's line. The dock's strip carries the view's action — *Command mode* — and the aim of a command; the composer's bar carries the agent menu, the field, the chips, *Run*.

- **Tabs are the workspace record.** Open tabs, the active tab, drawer states, dock position, section states and preferred views persist per workspace in the kernel's state record and follow the person across devices ([Tabs], Workspace Record). `CA_0047` adds a route per tab.

- **Phones.** Tabs are a strip under the header, the drawers are edge sheets from handles centred on the header's line, the dock swipes; a swipe on a row sets its standing; the OS back gesture is respected at the screen's edges ([Layout], Mobile Layout, [Standing]).

## Intent

* **The default surface is the work.** Above it the header's line — the laurel, a search, the process indicator and the person — and the tab strip, because a reader keeps several roots open at once and works in each (user decision, 2026-09-13); the active root's route stands over its intent. Below it one composer, always present: *Tell Calliopa what to do next…*, with the agent's face, the attach control (`BO_0229`) and *Run*. Nothing else is permanent (material §41).

* **There is no inspector.** A block carries its own depth (`CA_0046`), a document carries its facts in its intent's depth, and a process is opened from the header's indicator. No permanent side rail of sources, relations, history and metadata (material §12).

* **The route is navigation only.** It is the path by which the reader arrived — `CA_0047`'s route for the active work — and it is the way back; it has no governance, ownership or containment meaning (rule 20).

* **Search is retrieval and navigation, never a second conversational surface.** It finds documents, blocks, extensions and settings by words and opens what it finds; it runs nothing (material §45).

* **One work input.** The composer acts on the current scope — the focused block, the marked blocks, the open root, or nothing open — and its scope is always visible in the strip above it (material §45).

* **The interaction grammar is the whole physical vocabulary**: scroll; tap or click a block to focus it; select text to narrow the scope; focus or expand to reveal depth; open or pinch in to make a block the root; back or pinch out to return; hold and drag to move; type (material §42).

* **Every part of the shell that exists today stays reachable.** Settings, the extensions and their change documents, the update tab, the library's other sections, the process console, the person's menu, the theme, sign-out — each has a place in the new surface or in the search; nothing is dropped because the screens do not show it.

## The Shape

- **Header.** The wordmark; the tab strip as today, on both form factors, with the save state beside it; at the right, the library control, the search control, the process indicator, and the person's menu. The layout controls go: the drawers are no longer permanent regions with states to cycle. The settings gear goes: settings is reached from the person's menu and the search. The theme toggle moves into the person's menu. The update hint stays as it is (`BO_0223_013`). The active work's route renders as the first line of the work, over its intent, where `CA_0047` places it: breadcrumb buttons, each opening that document in the same tab and popping the route to it; on a phone it truncates from the left, keeping the last crumb.

- **Tabs stay.** A reader keeps several roots open at once and works in each, so the strip, the workspace record, the markers, the reveal rule and the phone's swipe across the strip are unchanged. The route is what a tab gains, inside it, and a tab is never replaced by its route. User decision, 2026-09-13, over a route in the strip's place with the open tabs behind a disclosure.

- **The library is a sheet.** `CA_0044`'s side bar opens over the work from the header's library control on a desktop and from its edge handle on a phone, and closes by its × or `Escape`; it is never a permanent region, and its create controls — a new document, a new change for an extension, a new extension, import — stay in it. User decision, 2026-09-13, over replacing it with the search.

- **Search.** `Cmd`/`Ctrl`+`K` and the header control open a search field over the work: documents by title and block words (a bounded CCGW read over `document` and `text` with a text filter, answered by `GET /api/x/ui.shell/search`), extensions and their change documents, the settings tab, the update tab, the library's contributed sections' entries through the contribution contract's listing. A result opens as the library's entries open: the document in its tab, revealed if open. The search is the fast way to what is not open; the library sheet is the browsable one.

- **The composer** is the dock's composer at its composer position, always: the collapsed handle and the console position go. The strip above it keeps the view's action, the aim and the ×; the bar keeps the agent menu, the field, *Run* and the chips; `BO_0229`'s attach control is the `+`. The console — a run's events and the process list — opens from the header's process indicator as a sheet over the work, on both form factors, and closes by its own control or `Escape`; a selected process's detail is that sheet's, so `CA_0040`'s per-tab selection stays what it is. The undo line stays under the strip.

- **Where the inspector's contents go.** The document's facts — last change, count, unanswered items — and *Delete*, the three toggles and a change document's *Change of* and status select render in the intent's depth: focusing the title (a press that does not start editing it, as `CA_0046` focuses a block) reveals them beneath it as a layer, the facts as a line, the toggles and the status select as controls, *Delete* last and marked destructive. The view contract's contribution vocabulary is unchanged: the view contributes facts and actions as today and the shell renders them in the intent's depth instead of a drawer; a view whose target has no intent — settings, the update tab, an extension import — renders its contribution at the top of its own surface. `InspectorContribution`'s reason for being its own component holds.

- **Phones.** The inspector's edge handle goes with the inspector; the library keeps its edge handle and opens as the sheet it is. The header's line with the tab strip under it, the route line inside the work, the search, the process sheet and the composer are the phone's frame; pinch in and out are `CA_0047`'s; the standing swipe is unchanged; the OS back gesture keeps its edges. The composer sits on the on-screen keyboard as the dock does (`CA_0014_001`).

- **Keyboard reach.** Tabs, library, search, process indicator and person in the header's tab order, then the route's crumbs in the work; `Cmd`/`Ctrl`+`K` for search; `Escape` closes the search, then the process sheet, then the library sheet, then leaves the most local surface as today.

- **Verification.** The render harness for the header, the library sheet, the search results and the intent's depth; Playwright for the route, the search opening a document, the process sheet, the intent's depth carrying every former inspector item, and the axe scan on both form factors; the workspace record's persistence tests and the tab scenarios unchanged; a walk on the served build on a desktop and a phone.

## Decided

* **The library stays, as a sheet.** `CA_0044`'s side bar opens on demand from a header control and the phone's edge handle and is never a permanent region; every entry and control it holds stays in it, the video extension's sections included. Replacing it with the search was the alternative. User decision, 2026-09-13.

* **The tabs stay.** A reader keeps several roots open concurrently and works in each; the strip is unchanged on both form factors and the route is a line inside the tab's work. A route in the strip's place, with open tabs behind a disclosure, was the alternative. User decision, 2026-09-13: *I want to keep the tabs; the user should keep the ability to open tabs concurrently and work there.*

* **The extensions' own views stay tabs**, with no route: settings, the update tab and an extension import render their contributions at the top of their own surface and are found by the search. This follows from the tabs staying; a one-crumb route each was the alternative.

## Depends On

- `CA_0046` and `CA_0047`. It can land before the `BO` parts that fill the depth; the surface is the frame, not the content.
