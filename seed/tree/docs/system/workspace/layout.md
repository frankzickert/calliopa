# Layout

## Desktop Layout

* Header: project identity, horizontally scrollable tabs, process status indicator, layout controls, settings, light/dark toggle.
* Left drawer: hierarchical navigation for projects, stories, acts, scenes, characters, media, and saved views.
* Center workspace: whatever the active tab represents — script editor, storyboard, timeline, scene board, or asset view.
* Right drawer: contextual inspector whose content follows the active item. It is not a second permanent navigation area.
* Bottom command dock: contextual commands, AI requests, uploads, and running-process reporting.
* Both drawers support `expanded`, `compact`, and `hidden` states on desktop.

- The chrome is quiet by default. Layout controls, the theme toggle, and the drawer close controls are transparent icon buttons that gain a surface and border on hover, not bordered form buttons.
- The workspace region renders no heading and no view-name tag. A tag naming the tool is chrome the tab strip already supplies, and the headline belongs to the view that owns the content and can edit it, so a title is rendered once by that view. The region names itself directly, keeping its landmark (`CA_0013_001`).
- The command dock has the same three positions on desktop as on mobile, with the dock handle available on both. The desktop dock arrives at composer height and shows the process console only in its console position.
- Dock position is one persisted value per workspace and applies on both form factors, so a position set on one follows the workspace to the other.
- The left drawer arrives `expanded` while the library holds nothing, so the region stays visible and its state cycle stays provable.
- The left drawer holds one top-level category, `Documents`, listing the parentless documents [Block Document Model](../documents/block-document-model.md) answers, each entry naming its document by title. It arrives `expanded`, so the library is visible without being opened.
- Activating an entry opens that document in a tab. A tab already showing the document is revealed rather than opened a second time, because a tab is found by its target rather than by its identity.
- The entry for the active tab's document reads as selected, carrying a marker and `aria-current` rather than colour alone.
- With no document in the graph the category shows an empty-state line under its heading, so the region reads as a place that holds things rather than as something that failed to load.
- The category header carries a small `+` that creates a document and opens it in its own tab, in the chrome idiom above and with its own accessible name. It is the only way to create a document; the header offers none.
- The category is collapsible, and its collapsed state is stored in the workspace record, so it follows the workspace across reloads and devices.
- Documents live in the graph rather than in a workspace, so every workspace lists every document. Scoping the library to a project or a workspace arrives with the change that introduces those.
- The rendered listing is rebuilt rather than reconciled: a read raises a counter the list is keyed by. Entries move and are renamed in the same read, and a keyed diff over that left stale names on reused rows. A tab is keyed by its identity and its title for the same reason, so a renamed target gives its tab a new label.
- A rename re-reads the listing rather than re-sorting it in the browser. Title order is the server's, so the drawer cannot disagree with what the next read would say.

## Mobile Layout

* Only one primary surface dominates at a time.
* Tabs form a swipeable, horizontally scrolling strip below the compact header.
* Left and right drawers become edge sheets.
* The command dock has three vertical positions: collapsed handle, composer, expanded process console. Swiping the dock up or down changes its position.
* Long-press initiates drag; ordinary touch movement scrolls.
* System back gestures remain available: drawer gestures begin from visible handles or sufficiently inset regions.

- The left drawer's edge handle opens the library as a sheet, so the drawer keeps its landmark, its accessible name, and its gesture coverage on a phone.
- The mobile sheet carries the `Documents` category as well, so the drawer holds the same library on a phone as on a desktop while keeping its close control and its gesture coverage.

## Inspector

* The right drawer renders the active view's contributed facts and actions when no process is selected. The shell renders them in its own idiom; the view says what they are.

- The contribution is typed facts and named actions, defined in [Workspace View Types](./view-types.md). The shell knows how to render a save state, a time, a count, a line of text, a button, and a toggle. It does not know what a document is or what deleting one means, so the view supplies the handlers.
- A selected process still takes the inspector. Process detail is transient and the reader chose it, so the view's contribution returns when the selection is cleared.
- A view that contributes nothing shows nothing, which is what a placeholder view does today.
- The inspector is reachable in each of its desktop drawer states and as the mobile edge sheet, so whatever a view contributes is reachable on both form factors. A `hidden` drawer hides it, which is what hiding a drawer means.

## Implementation

- The desktop shell grid presents identity and tabs in the header, the empty library drawer, placeholder working context, contextual inspector, and command dock. Each drawer independently cycles expanded, compact, and hidden; Given/When/Then browser coverage verifies the regions, state cycle, and accessibility (`CA_0002_014`).
- On phones, the compact header places the horizontally swipeable tab strip beneath identity controls, drawers open as edge sheets from visible inset handles, and the workspace remains dominant. The dock cycles or swipes among collapsed, composer, and process-console positions; unit and mobile browser coverage prove the bounded gestures (`CA_0002_015`).
- The left drawer renders nothing: no node kinds, no list, and no heading. It keeps its region, its `Library` name, its desktop state cycle, its mobile edge handle, and the sheet close control that is its only child. Desktop coverage asserts no visible content in the drawer; mobile asserts the close control is the only thing in the sheet (`CA_0010_001`).
- Layout controls, the theme toggle, the sheet close controls, and the tab close and open controls are transparent icon buttons that take the raised surface and a border on hover. Workspace and dock buttons keep their resting border (`CA_0010_004`).
- The inspector renders a view's contributed facts as a description list and its actions as buttons, in the shell's own idiom: a save state in words, a time as a `time` element carrying the machine-readable stamp, a count, a toggle as an `aria-pressed` button, and a destructive action marked as one. A contribution with neither facts nor actions falls back to the view's declared line. It is its own component for the reason the header's save state is: re-rendering the shell would rebuild the mounted view, and for an editing surface that means rebuilding the element the caret is in (`CA_0015_006`).
- A tab switch clears the contribution along with the save state. What the previous view contributed was for the previous tab, so an unreported tab falls back to its declared line rather than showing another document's facts under this tab's name (`CA_0015_006`).
- The `Mark unsaved` and `Move first` placeholder buttons are gone, along with the `.context-actions` group that held them. A real view reports its save state through the bridge and tabs reorder by drag, so both were demos of behaviour that has since arrived for real. Their scenarios went with them: per-tab unsaved isolation is deliberately left unproven, because a two-document scenario buys a slow browser test for the marker's projection and giving the placeholder views a save state would keep a reported state standing for nothing being saved (`CA_0015_006`).
