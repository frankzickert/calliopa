# CA_0056_FEAT_panel-icon-columns

Status: completed

Requested: 2026-09-18, by the user: "create a change for the behaviour of the panels. 1. hide the
right by default. 2. each "section" in a panel needs an icon that is shown when the panel is
small-sized but not collapsed. like in vscode. so, the small mode should only show these icons.
that means: each panel has the icon column and the actual content. when clicking an icon,
show/hide the content. when clicking the panel icon in the header, toggle the entire panel.
similar to vscode"

Each panel works like VS Code's activity bar and side bar. It has an icon column and a content
area. In the library each icon stands for one extension's sections, and the content area shows
one of them at a time. The small mode is the icon column alone. The header's panel control shows
or hides the whole panel. The inspector starts hidden.

## Where This Starts

- **Both drawers cycle three states.** A drawer is `expanded`, `compact` or `hidden`, and the
  header's `sidebar-simple` control cycles through them (`cycleDrawer$`, `nextDrawerState` in
  `src/lib/layout.ts`). The state is stored per workspace in `Layout.left` and `Layout.right`
  ([Layout](../system/workspace/layout.md#desktop-layout)).
- **`compact` is a 4rem column that shows nothing useful.** The grid narrows the drawer to 4rem,
  and the inspector's text turns vertical (`.shell[data-left="compact"]` and
  `.shell[data-right="compact"]` in `shell.css`). No icon stands for anything in it.
- **The library is one scroll of bands.** Every contributed section is a band with a sticky header
  and a caret that collapses it. The collapsed state is stored in `Layout.sections`
  ([Layout](../system/workspace/layout.md#the-library-as-a-side-bar), `CA_0044`).
- **A section contributes no icon.** A section is a name, a title, an empty-body line, and
  optionally a kind, a create control and a component
  ([Contribution Contract](../system/workspace/contribution-contract.md)). Ten sections come from
  five extensions:
  - `documents`: Documents
  - `ui.shell`: Extensions
  - `publishing`: Channels, Shapes, Deliverables, Standing Items
  - `calliopa-video`: Episodes, Standing Assets, Destinations
  - `calliopa-show`: Show
- **The inspector is one section.** The right drawer holds the view's contribution or the selected
  process under one *Inspector* heading ([Layout](../system/workspace/layout.md#inspector)).
- **On a phone the stored state chooses nothing.** The drawers are edge sheets opened by the
  handles, and they show the whole drawer (Mobile Layout, `CA_0047_007`).

## The Panels

### The Icon Column

- Each panel has an icon column on its outer edge: at the left of the library, and at the right of
  the inspector.
- In the library there is one icon per extension that contributes sections, in contribution order.
  The icon stands for all of that extension's sections together. Today that gives five icons:
  - *Docs* (`documents`), Phosphor `files`
  - *Publish* (`publishing`), Phosphor `paper-plane-tilt`
  - *Extensions* (`ui.shell`), Phosphor `puzzle-piece`
  - `calliopa-video`, Phosphor `film-strip`
  - `calliopa-show`, Phosphor `presentation`
- An extension that is not active contributes nothing, so it has no icon.
- The inspector has one icon, Phosphor `info`, for its one section.
- An icon is a transparent icon button in the chrome idiom. It is named by its title and shows the
  title as its tooltip. The shown icon is marked with `aria-pressed` and a bar on the column's
  outer edge, not by colour alone.
- Clicking an icon shows its content and nothing else. Clicking the icon already shown hides the
  content, which leaves the icon column alone. This is the small mode.

### The Content

- The content area shows the chosen icon's sections under its title.
- An icon holding one section (Docs, Extensions, Show, the inspector) shows that section with its
  header: the title and the section's controls on its line (`CA_0044_006`), and no caret.
- An icon holding several sections (Publish, `calliopa-video`) shows them as today's bands. Each
  band has a sticky header, a caret and its own controls, and its collapsed state stays stored in
  `Layout.sections`.

### The Panel Control

- The header's `sidebar-simple` control toggles the whole panel between hidden and shown. It no
  longer cycles three states.
- Shown brings back what the panel last had: the icon column with the icon that was shown, or the
  icon column alone if it was small.
- The control carries `aria-pressed` for whether the panel is shown, and keeps its names *Library*
  and *Inspector*.

### What Is Stored

- A panel stores whether it is shown, and which icon it shows, or none. Both are stored in the
  workspace record, so they follow the workspace across reloads and devices, as the dock position
  does.
- The right panel starts hidden in a workspace that never chose. A workspace that already stored
  a state keeps it.
- The left panel starts shown, with its first icon.

### On A Phone

- A sheet carries the icon column too. Tapping an icon shows its content in the sheet, so the
  content is chosen on the phone as it is on the desktop.
- A tap on the icon already shown does nothing: the content stays, and the sheet closes by its ×.
  A sheet holding only the icon column would show nothing worth opening it for.
- The handles still open the sheets.

### The Contract

- An extension that contributes sections contributes one icon for them: a title and a Phosphor
  name from the shell's icon table. The icon is required. The build refuses, by name, an extension
  that contributes sections without one, as it refuses a collision, so the column never shows a
  blank button.

Decided by the user, 2026-09-18:
- One content at a time, as VS Code does.
- The header control shows and hides, remembering what was shown.
- The right panel starts hidden only in workspaces that never chose.
- The phone's sheets carry the icon column, and a tap on the shown icon does nothing.
- One icon per extension, not per section. Publishing's four types are one *Publish* icon, and
  `calliopa-video` and `calliopa-show` each have one of their own. Inside an icon holding several
  sections they keep their bands and carets. A single section has no caret.
- The icon is required in the contract.

## Technical Notes

- The drawer states change meaning. `expanded`, `compact` and `hidden` become shown with an icon,
  shown with none (small), and hidden. A stored `compact` reads as small, and a stored `expanded`
  reads as shown with the first icon. The layout is rewritten on the way in, as
  `LEGACY_SECTION_KEYS` rewrites old section keys.
- The shown icon is stored by extension id (`documents`, `publishing`, …). The inspector's is the
  shell's own (`ui.shell:inspector`), since it is not a contribution.
- Two fixed lines in `workspace/layout.md` change by the user's decision when this is transferred:
  - *Both drawers support `expanded`, `compact`, and `hidden` states on desktop* becomes the
    three states above.
  - *The drawer scrolls as one* (`CA_0044`, one scroll with sticky headers) holds within one icon's
    content, not across the whole library.
- The icon column is about 3rem wide, as VS Code's is 48px. The grid templates for the small mode
  replace today's 4rem `compact` ones.
- `files`, `paper-plane-tilt`, `puzzle-piece`, `film-strip`, `presentation` and `info` join the
  icon table in `icons.tsx`, from `@phosphor-icons/core@2.1.1` with the path data unaltered.
- The Minimum header menu's two layout controls (`CA_0054_003`) become the same show/hide toggles.
- The shell's docs to change when this is drafted:
  - `workspace/layout.md`: Desktop Layout, The Library As A Side Bar, Mobile Layout and Inspector.
  - `workspace/contribution-contract.md`: the extension's icon.
  - The docs of each extension whose contributions gain the icon: `documents`, `publishing`,
    `calliopa-video` and `calliopa-show`.

## Transfer

Transferred 2026-09-18 into the docs:
- `workspace/layout.md`, new *Panels As Activity Bars* before Mobile Layout: `CA_0056_001`–`_004` (the icon column, one content at a time, the panel control, what is stored), `_005` (the model, harness and measurement) and `_007` (the walk-through). `_006`, the sheets, is under Mobile Layout. `_001` and `_002` rewrite the two fixed lines named above on implementation.
- `workspace/contribution-contract.md`, Shape: `CA_0056_008`, the required icon.
- `CA_0056_009`–`_012` in the `system.md` of `documents` (*Docs*), `publishing` (*Publish*), `calliopa-video` (*Video*) and `calliopa-show` (*Show*).

## Implementation

Implemented 2026-09-18. `CA_0056_001`–`_006` and `_008`–`_012` are truth: the panels in
`workspace/layout.md` (Panels As Activity Bars, Mobile Layout), the required icon in
`workspace/contribution-contract.md`, and each extension's icon in its `system.md`. The two fixed
lines named above were rewritten as the user decided. `_007`, the walk-through on a desktop and a
phone, passed at pin 198 on 2026-09-18.

After the walk-through the user decided that on a phone a tap on the shown icon closes the sheet
rather than doing nothing (`CA_0056_013`, in `workspace/layout.md` Mobile Layout). `_014`, the
walk of that tap on a phone, passed at pin 210. Completed 2026-09-18.
