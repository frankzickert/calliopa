# CA_0073_FEAT_focused-work-opens-its-own-tab

Status: completed

Completed 2026-09-30: `CA_0073_001`–`CA_0073_004` are truth in the docs the Tasks section names, the walk among them (pin 3284). Focused work and the crumbs open tabs through the shell's `openAlongRoute$`. `calliopa-refine`'s two `retarget$` callers are left as a functional question in its `system.md`.

Requested: 2026-09-30, by the user: let the reader open a document and the focused work of its blocks in tabs of their own, independently. Today the shell connects them in one tab, so the reader cannot easily switch back and forth between a document and its focused work.

## What Happens Today

- Opening a block as focused work — the shell's *Open as focused work* control, the parent's face, or `documents`' outward pinch — retargets the reader's tab to the child and pushes the parent onto that tab's route ([Tabs](../../system/workspace/tabs.md), `retargetTab`; [Focused Work](../../system/workspace/focused-work.md), Why It Is The Shell's).
- The parent is then reachable only through *Back*, a crumb of the route line, or an inward pinch, each of which retargets the same tab back and remounts its view. Parent and child are never open side by side, and every switch between them costs a remount and a document read.
- Nesting a dragged block (`CA_0072`) already opens the child without retargeting, and a document opened from the library already takes a tab of its own. Opening focused work is the one way into a document that takes the reader's tab away from what they were reading.

## Behavior

- Opening a block as focused work always opens the child in a tab of its own — by the control, by a press on the parent's face, and by the pinch on touch alike. The parent's tab stays on the parent, with its scroll, its focused block and its unsaved state as they were, and the reader moves between the two by selecting a tab, as between any two documents. User decision, 2026-09-30.
- The child's tab opens right after the parent's tab and becomes active, since the reader asked to go there; the parent stays one tab to the left. When the child is already open in a tab, that tab becomes active instead of a second one opening, as a library entry does (`CA_0072`). User decision, 2026-09-30.
- *Back*, a crumb and the inward pinch make the parent's tab active and land on the block that was opened. When the parent is open in no tab, it opens in a tab of its own beside the child's. The child's tab stays open. User decision, 2026-09-30.
- The child's tab keeps the route line above the document, unchanged: it says how the reader arrived and is the one visible way up on a desktop, where no pinch exists. User decision, 2026-09-30.
- Tabs already stored with a route longer than one — a parent and its child in one tab — are not migrated. They keep their route, and a crumb in them behaves as above, so they untangle as the reader uses them. User decision, 2026-09-30.
- There is no second control that replaces the current tab with the child. The reader closes the tabs they are done with, and *Close all tabs* (`CA_0067`) exists. User decision, 2026-09-30 (YAGNI).
- The model does not change: focused work is still a document that `focuses` its block, a block is focused by at most one document, and the route stays navigation only, with no governance, ownership or containment meaning.

## Fixed Lines This Revises

- [Focused Work](../../system/workspace/focused-work.md), What Belongs Where: *the retarget, the route and the landing are the frame's* — the retarget becomes opening or selecting the child's tab. The line's meaning — the frame owns the effect — stays; the user agreed to the new words with this change, 2026-09-30.
- [Focused Work](../../system/workspace/focused-work.md), What Focused Work Is: *back, or a pinch inward, returns to the containing work* stays true, since returning means selecting the parent's tab. No other fixed line changes meaning.
- Mutable lines revised at transfer: [Tabs](../../system/workspace/tabs.md), the route line (`CA_0047_003`), which says opening focused work retargets the tab and *Back* pops the route; `documents`' [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md), *Focused Work*, the route line and the pinch.

## Where It Lands

- `ui.shell` owns the change: the tabs, the route and focused work are the frame's. `openChild$` stops calling `retargetTab` and opens or selects a tab through `openTabBeside` (`src/lib/tabs.ts`, which `CA_0072` added for the library); a crumb and *Back* select or open the parent's tab the same way instead of retargeting.
- `documents` draws the route line and the pinch. If the bridge call a crumb makes stays `retarget$` with a new meaning, `documents` changes only its docs; if the shell offers a new call, the route line calls it.
- No `BO` half: the workspace record already stores tabs with a route, and nothing in the fixed layer changes.

## Tasks

- `CA_0073_001`, `CA_0073_004` — `ui.shell`, [Focused Work](../../system/workspace/focused-work.md), Focused Work In Its Own Tab: the child opens in its own tab, and the walk.
- `CA_0073_002` — `ui.shell`, [Tabs](../../system/workspace/tabs.md): going back along the route selects or opens a tab.
- `CA_0073_003` — `documents`, [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md), *Focused Work*: the route line and the pinch.
