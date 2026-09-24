# Panels Resize At Their Inner Border

Status: completed

Each panel has one width on a desktop: the 3rem icon column and 16rem of content for the library,
18rem for the inspector, written as `--left-column` and `--right-column` on `.shell`
(`CA_0056_005`). A reader who wants a wider library for a deep tree, or a narrower inspector to
give the document room, has no way to change either. The user asked on 2026-09-23 that the panels
be resizable at their vertical inner border — the edge each shares with the workspace.

## What Is Asked

* Each panel is resizable at its vertical inner border. Dragging the border between the panel's
  content and the workspace changes that panel's width, and the width holds. User request,
  2026-09-23.
* A width is the browser's, not the workspace's: it is kept per browser and per side, and never
  sent to the kernel. A workspace opened on a laptop and on a wide monitor keeps a width on each,
  and a new browser starts at the default. User decision, 2026-09-23.
* A drag below the minimum stops at the minimum. The handle resizes and does nothing else; the
  small mode keeps its one way in, the press on the shown icon. User decision, 2026-09-23.
* A double press on the border restores the panel's default width, with a keyboard equivalent on
  the separator. User decision, 2026-09-23.

## What The System Already Holds

- The desktop grid is `"left workspace right"` with the two columns as custom properties on
  `.shell`; a panel's draw sets `--left-column` and `--right-column` to the column and its content
  shown, the column alone small, and 0 hidden, so the phone's one-column template is never
  outranked ([Layout](../system/workspace/layout.md), Panels As Activity Bars, `CA_0047_007`,
  `CA_0056_005`). The content width is the one number this change adds a hand to.
- A panel stores whether it is shown and which icon it shows in the workspace record, so both
  follow the workspace across reloads, devices and form factors (`CA_0056_004`): `PanelState` is
  `{shown, icon?}` in `src/lib/layout.ts`, read by `readPanel` in `src/server/workspaces.ts`,
  which refuses a malformed panel and reads a record stored before a field without it
  ([Tabs](../system/workspace/tabs.md), Workspace Record).
- On a phone a panel is a sheet across the one column, and a drawer's stored state chooses nothing
  about the grid (Mobile Layout). A sheet has no inner border to drag.
- The chrome is quiet: layout controls are transparent icon buttons that gain a surface on hover,
  and nothing bordered stands where no one is looking (Desktop Layout).
- The shared drag model in `src/lib/drag.ts` is for items with identity, kind and operations, and
  `pointerIntent` decides between dragging, scrolling and waiting on a coarse pointer
  ([Drag And Drop](../system/workspace/drag-and-drop.md)). A resize is not an item drag and
  offers no drop target; it is a pointer capture on one handle.
- Each region scrolls its own content, and `.panel-content` carries the drawer's tab stop
  ([Frame](../system/workspace/frame.md), `CA_0014_002`, `CA_0056_005`).
- At 1280 CSS px the library measures 304px shown and the inspector 336px (`CA_0056_005`); the
  measurement is the baseline a resized panel departs from.

## Shape

- The handle is the border. A narrow hit area straddles the inner border of a shown panel's
  content — a few px on each side, so the border itself is the target — with `cursor: col-resize`
  and nothing drawn at rest; while hovered or dragged it paints the accent along the border, the
  way the shown icon's bar does. There is no handle in the small mode or hidden, since the
  column alone has nothing to resize, and none on a phone.
- It is a separator, operable from the keyboard: `role="separator"`, `aria-orientation`
  `vertical`, named for its panel (*Resize library*, *Resize inspector*), with `aria-valuenow`,
  `aria-valuemin` and `aria-valuemax` in px, and the arrow keys stepping the width. A pointer
  drag captures the pointer on the handle, so leaving the border mid-drag keeps resizing, and
  the workspace under it takes no press while the drag lasts.
- The width is the content's; the icon column stays `--panel-icons`. It is clamped between a
  minimum wide enough for a row's text and a category's controls and a maximum that leaves the
  workspace room beside the other panel, both written once in `src/lib/layout.ts` as the rule
  `pressIcon` and `togglePanel` are, so the render and the keyboard agree. A drag past the
  maximum stops at it.
- Each panel is its own: the library and the inspector keep separate widths, and the default
  for each stays what it is today (16rem, 18rem) when nothing was stored.
- The width is a per-viewer convenience in `localStorage`, keyed by side, read on the way in
  inside a try/catch so a browser that refuses storage still draws the default; `PanelState` and
  `readPanel` are untouched, and no drag saves the workspace.
- A double press on the handle, and a key on the focused separator, put the width back to the
  default and clear the stored value.
- A drag re-renders only what it must: the column property on `.shell` changes, and the view in
  the workspace is not rebuilt for it — the reason the view bar and the inspector's contribution
  re-render alone (`CA_0053_004`). The view bar's `moreBeyond` already listens to a resize of the
  region, so a narrower workspace fades the bar's ends as a narrower window does (`CA_0053`).
- Verification, as the panels were verified: `layout.test.ts` for the clamp and the keyboard step,
  `panel.test.ts` in the render harness for the handle's presence per draw and its name, a
  Chromium measurement at 1280 CSS px with the handle dragged and the property read back, a
  360 CSS px check that no handle is drawn, and a walk on the served build on a desktop.
- The docs land in `docs/system/workspace/layout.md` under Panels As Activity Bars, in the
  proposal that carries the code; a release-notes line goes to `calliopa-bootstrap`'s
  `docs/release-notes/unreleased.md` under *Added*, since `ui.shell` ships with every release.
