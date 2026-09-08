# CA_0010_STYLE_shell-chrome-and-empty-library

Status: completed

Requested: 2026-08-29

## Intent

The workspace shell is functionally complete but its chrome reads as a row of
plain form buttons rather than a workspace. Tabs in particular look like
unstyled buttons instead of tabs. The left drawer also still shows the seven
placeholder node-kind labels, which look like content that is not there.

This change gives the shell chrome the visual idiom `studio` already uses,
adapted to Calliopa's semantic tokens, and empties the left drawer until real
story records exist. It changes no data, no API, and no state model.

## Empty Library

- The left drawer ships with nothing at all: no node-kind list and no heading.
- The drawer stays a declared region with its accessible name, so it remains a
  navigable landmark and keeps its `expanded`, `compact`, and `hidden` states.
- On desktop the drawer arrives `expanded` and blank. The default layout is
  unchanged, so the region stays visible and the layout cycle stays provable.
- On mobile the edge handle stays and opens a sheet that carries only its close
  control, so the drawer keeps its landmark, its accessible name, and its
  existing gesture coverage while it holds nothing.
- Story records and the node kinds they carry arrive with the change that
  introduces the content model.

## Tabs Read As Tabs

- A tab is a tab shape seated on the header's bottom edge: rounded top corners,
  no bottom border, panel background, and a strip that aligns its tabs to that
  edge.
- The active tab is raised to the raised-panel surface and carries an inset
  accent bar along its top edge, so the active context is legible without
  colour alone.
- A tab title truncates with an ellipsis at a bounded width instead of
  stretching the strip.
- Unsaved state and process state become small round markers inside the tab,
  each with its own accessible name, instead of the `•`, `◌`, and `!` glyphs
  appended to the title.
- The close control is a transparent icon button that gains its surface on
  hover, not a bordered button.

## Header Chrome

- Layout controls, the theme toggle, and the drawer close controls are
  transparent icon buttons that gain a surface and border on hover.
- The process indicator is a count pill that stays quiet at zero and takes the
  running colour when work is active.
- The process indicator toggles the dock console: pressing it moves the dock to
  its console position, and pressing it again returns the dock to composer.
- The indicator stays pressable at zero and then opens an empty console, so the
  console is always reachable from the header without hunting for the dock
  handle.

## Dock Positions On Desktop

- The dock's three positions — collapsed, composer, console — apply on desktop
  as well as on mobile, with the dock handle available on both.
- This restores the desktop dock to composer height by default; the process
  console appears when the dock is in its console position or when the process
  indicator opens it.
- This supersedes the current behaviour where the desktop console is
  permanently visible below the composer.

## Constraints

- Components keep using semantic theme tokens only; no literal colours enter
  component styles.
- No change to the tab contract, the workspace record, the process registry,
  the drag model, or any API.
- Accessibility coverage must keep passing: every marker and control keeps an
  accessible name, and the axe scans stay clean on desktop and mobile.

## Verification Impact

- `tests/browser/layout.spec.ts` no longer asserts library-tree contents and
  must assert the empty drawer instead.
- `tests/browser/tabs.spec.ts` asserts the unsaved marker by its accessible
  name rather than by a glyph in the tab title.
- `tests/browser/registry.spec.ts` opens the dock console on desktop the same
  way it already does on mobile, and asserts that the process indicator opens
  and closes the console at zero and while work is running.
- `pnpm run verify` gates the result.

## System Work

The specification is transferred into [Workspace Shell](../../system/workspace/frame.md):
the empty-library rules into its desktop and mobile layout sections, the tab
rules into its tabs section, the header-chrome and dock-position rules into its
desktop layout section, and the process-indicator rules into its process
registry section. The out-of-scope line that said the left tree ships with
node-kind labels now says the drawer ships with nothing.

The work was enumerated there as `CA_0010_001` through `CA_0010_007` and is folded into that document's current truth.
