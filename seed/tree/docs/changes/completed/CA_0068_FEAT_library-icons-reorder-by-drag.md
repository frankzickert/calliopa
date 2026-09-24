# Library Icons Reorder By Drag

Status: completed

The library's icon column lists one icon per extension in contribution order, which the registry
fixes and the reader cannot change. A reader who works mostly in Publish or Video still finds Docs
on top and the icon they want further down. The user asked on 2026-09-24 to reorder the left
panel's category icons by drag and drop.
The four open questions were answered by the user the same day and folded into the shape below;
none remain open.
Set to draft by the user the same day and transferred: the tasks are `CA_0068_001`–`CA_0068_007` in the
shell's `docs/system/workspace/layout.md` (Panels As Activity Bars, and Mobile Layout for `_004`) and
`CA_0068_008` in `docs/system/workspace/drag-and-drop.md`.
Set to ready by the user the same day and implemented: `CA_0068_001`–`CA_0068_006` and `CA_0068_008` are
truth. Walked on the served build at pin 2459 on a desktop and a phone and reported working by the
user on 2026-09-24 (`CA_0068_007`); completed the same day.

## What Is Asked

* The icons in the library's icon column can be reordered by drag and drop. User request, 2026-09-24.

## What The System Already Holds

- The fixed line in the shell's `docs/system/workspace/layout.md`, Panels As Activity Bars, says the
  library has one icon per extension that contributes sections, *in contribution order*
  (`CA_0056_001`). This change revises that line by the user's request.
- The column is `PanelIcons` in `src/components/shell/panel.tsx`, fed `LIBRARY_ICONS`, which
  `shell.tsx` maps from `REGISTRY.libraryIcons` once at module load.
- `PanelState` in `src/lib/layout.ts` stores per panel whether it is shown and which icon it shows,
  in the workspace record; an icon id nothing answers to any more reads as the first icon. A new
  workspace arrives with the library on its first icon (`CA_0056_004`).
- The shared drag model in `src/lib/drag.ts` ([Drag And Drop](../system/workspace/drag-and-drop.md))
  already reorders tabs on a desktop and a phone: a mouse drags on movement, a coarse pointer after
  the long press, and targets enlarge while dragging.
- The inspector's column has one icon, so it has nothing to reorder.

## Proposed Shape

- Each library icon is a draggable of kind `panel-icon` offering `move`, and the column is its one
  target, accepting only that kind from the same column. Dropping over an icon's upper half places
  the dragged icon before it, over the lower half after it; a line in the accent marks the place
  while dragging. A press without travel stays a press, so clicking an icon behaves as today.
- The order is stored per workspace, beside `PanelState` in the workspace record, as a list of
  extension ids, so each workspace keeps its own order. User decision, 2026-09-24. The column draws the stored
  order first, then every contributing extension it does not name, in contribution order — so a
  newly activated extension appears at the end of the reader's order and a deactivated one simply
  drops out. User decision, 2026-09-24.
- "The first icon" — the icon a new or small-mode sheet shows, and the fallback for an unknown id —
  becomes the first icon in the reader's order.
- The same drag works in the phone sheet's icon column through the long press.
- The reorder is by drag only; no keyboard move comes with this change. User decision, 2026-09-24.
- No reset control; dragging back is the reset. User decision, 2026-09-24.

## Transfer Targets

- `docs/system/workspace/layout.md`, Panels As Activity Bars: the fixed icon-order line revised, the
  stored order and the first-icon rule, the phone sheet under Mobile Layout.
- `docs/system/workspace/drag-and-drop.md`: the `panel-icon` kind and its target.
- The release-notes line goes under *Changed*, since a `bundled` extension changes.
