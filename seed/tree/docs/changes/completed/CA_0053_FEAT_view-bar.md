# CA_0053_FEAT_view-bar

Status: completed

Requested: 2026-09-18, by the user: "in the tab of an opened doc. always show the top-menu bar. it
should support "groups" (divided by a vertical line). the first group contains the doc-view
controls: toggle for retired, discarded, proposed. each with a corresponding icon toggle. second
group: block formatting (only visible when a block is active). last group: document actions: right
now only delete. the last group is always right aligned". Shaped with the user the same day, who
decided the bar is a shell contract rather than the document view's own; first staged as
`documents`' `DO_0003`, re-filed here because the contract is the shell's
(`calliopa-bootstrap` `docs/process/change-process.md`: a change touching several extensions
belongs to the one whose contract it is).

The shell draws a bar at the top of a tab's region, made of the groups the tab's view contributes,
divided by a vertical line, a trailing group always at the right edge. The document view is its
first contributor: a tab holding a document always shows the bar, with what the reader sees first,
the active block's controls in the middle, and what acts on the document at the end.

## Where This Starts

- **A view reaches the shell through typed contributions** ([Workspace View Types](../../system/workspace/view-types.md#view-contract)):
  `ViewInspector` (facts and actions) and `ViewDock` (one action) in
  `src/components/shell/view-bridge.ts`. `ViewAction` is `button`, `toggle` or `choice`; the shell
  draws them in its own idiom and the view supplies the handlers. The vocabulary grows by change
  when a view needs a shape it lacks.
- **The document view's toggles and delete are inspector actions** (`documents`,
  [Document Panel](../../../src/extensions/documents/docs/system/documents/document-panel.md)):
  *Show retired blocks*, *Show discarded blocks*, *Show proposed changes* and *Delete*. A reader
  opens the inspector to see what the document hides or to delete it.
- **The document view draws its own block bar** (`documents`,
  [Block Editor View](../../../src/extensions/documents/docs/system/documents/block-editor.md#presentation)):
  `BlockToolbar` in `views/block-editor.tsx`, docked to the top of the tab region, there only while
  a block is active. It already holds groups — *Format* (marks, *Link* with its address field),
  *Turn into* (role select), *Block* (insert paragraph, insert divider, retire), *Standing* and
  *History* — without a divider between them.
- **The space is already reserved.** The document surface's top padding is the bar's height plus a
  block row's clearance whether or not a block is active (`CA_0031_001`), so a bar that always
  stands moves no document content.

## Decisions

User decisions, 2026-09-18:

- **The bar is a shell contract.** The shell draws it; a view contributes groups through the view
  bridge, as it contributes to the inspector and the dock, and never draws the bar itself.
- **A tab whose view contributes no group shows no bar.** Settings, extension views and every other
  view look as they do now.
- **Only the document view moves to the bar in this change.** Other views keep their inspector
  actions until a change of their own moves them.
- **The toggles and *Delete* leave the inspector.** One control per action; the document's
  inspector keeps its facts — save state, last changed, revisions, the unanswered
  proposed-changes count.
- **The active block's controls keep their own groups**, each divided by the line: *Format*,
  *Turn into*, *Block*, *Standing*, *History*.
- **Icons**, from the shell's Phosphor set: retired `archive`, discarded `eye-slash`, proposed
  `git-pull-request`, delete `trash`.

## Shape

- **Groups.** The bar is an ordered sequence of groups, each with an accessible name. A separator —
  a vertical line — stands between two drawn groups, never at an edge and never doubled when a
  group is absent. A group marked as trailing is drawn at the bar's trailing edge whatever the
  other groups hold.
- **The document view's bar**, always, in reading and command mode:
  1. *View* — three icon toggles: retired blocks, discarded blocks, proposed changes. Each carries
     `aria-pressed` and a name saying what it reveals, reads as pressed by more than colour, and
     keeps today's behavior: per tab, off by default, the same reads behind it.
  2. *Format* · *Turn into* · *Block* · *Standing* · *History* — only while a block is active; with
     none, these groups and their separators are absent and nothing else moves.
  3. *Document* (trailing) — *Delete*, which asks first exactly as it does today.
- A view that could not read its document contributes no group and so shows no bar.
- **Narrow viewports.** The bar stays one row high and does not wrap; what does not fit scrolls
  sideways as it does now, and the trailing group stays at the trailing edge rather than scrolling
  out of reach.
- **Placement.** The bar keeps what the docked block bar settled: over the region's top edge,
  opaque, one border on the edge facing the content, and the headline's reserved space beneath it
  (`CA_0027_002`, `CA_0031_001`).

## Tasks

Transferred 2026-09-18:

- `CA_0053_001`, `CA_0053_002` in [Workspace View Types](../../system/workspace/view-types.md#view-contract): the bar contribution on the bridge, and the vocabulary it needs.
- `CA_0053_003`, `CA_0053_004` in [Layout](../../system/workspace/layout.md#the-view-bar): the shell draws the bar.
- `CA_0053_005` in `documents`' [Document Panel](../../../src/extensions/documents/docs/system/documents/document-panel.md#the-document-metadata-panel): the toggles and *Delete* leave the inspector.
- `CA_0053_006`, `CA_0053_007` in `documents`' [Block Editor View](../../../src/extensions/documents/docs/system/documents/block-editor.md#presentation): the document view's bar, and its proof and walk.
- Closing adds a line to `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`: `ui.shell` and `documents` are bundled.

## Where It Stands

Completed 2026-09-18. Implemented from head 97 and staged with its docs in one proposal, accepted
and served from pin 101; walked by the user on a desktop and a phone the same day. `CA_0053_001`–`_007`
are truth in the shell's [View Types](../../system/workspace/view-types.md#view-contract) and
[Layout](../../system/workspace/layout.md#the-view-bar) and in `documents`'
[Document Panel](../../../src/extensions/documents/docs/system/documents/document-panel.md) and
[Block Editor View](../../../src/extensions/documents/docs/system/documents/block-editor.md#presentation).
The unit and behavior suites passed (99 files, 848 tests), the tree typechecked and built, and the
bar was measured in Chromium at 1280 and 360 CSS px in both themes and scanned clean by axe.
