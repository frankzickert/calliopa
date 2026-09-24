# Drag And Drop

## Drag And Drop

* One shared drag model spans tabs, drawers, the workspace and the panels.
* Every draggable carries stable item identity, item kind, source context, supported operations, and an optional preview representation.
* Drop targets declare accepted operations: move, copy, link/reference, open in tab, attach to command, or use as process input.
* Potentially destructive moves use optimistic feedback with undo.
* On mobile, long-press begins the drag and targets enlarge while dragging.

* A drag held near the top or the bottom of the area it began in scrolls that area toward the edge, on a desktop and a phone alike, so every place is in reach. User decision, 2026-09-18 (`calliopa-bootstrap`'s `BO_0263`).
- A coarse pointer must hold still before drag begins; ordinary touch movement remains scrolling.
- The shell's placeholder interactions prove tab reorder on desktop and mobile.
- No surface takes a process as context, by the user's decision of 2026-09-10 in `CA_0039`: a process dragged onto the command surface showed as a chip the run was never sent, promising context the run did not receive. Files as context are `BO_0229`'s, and process results are not attached. The drag model keeps `attach-to-command` in its vocabulary, as the fixed line above lists it; no shell target accepts it (`CA_0039_006`).
- Later tools must remain able to drag a scene into the tab bar, media onto a storyboard frame, a character onto a scene, and an open tab into the story tree.
- A library icon is a draggable of kind `panel-icon` offering `move`, its source the panel; the icon column is its one target and takes that kind alone. `resolveDrop` in `src/lib/drag.ts` is `resolveOperation` once payload and target agree — an icon over anything but a `panel-icon:` target, or any other kind over one, resolves nothing — and the shell resolves every drop through it, so a tab never lands on the icon column and an icon never on a tab, a document or the inspector (`CA_0068_008`).

## Implementation

- `src/lib/drag.ts` holds the shared drag model: a payload of item identity, item kind, source context, offered operations, and preview; a target that declares what it accepts; and the resolution that takes the first offered operation a target accepts. `pointerIntent` decides between dragging, scrolling, and waiting, so a mouse drags on movement while a coarse pointer must hold still for the long press. The shell coordinates pointers without capturing them, reading the target under the pointer, showing a preview that follows it, marking the hovered target, and enlarging every target on coarse pointers. A move applies optimistically before the workspace save. Desktop and mobile scenarios prove tab reorder (`CA_0002_020`).
- `pointerIntent` answers `swipe` too, for a target that offers one by passing the travel's axes: a coarse pointer that has moved 12px (`SWIPE_LOCK_PX`) with horizontal travel at least 1.4 times its vertical (`SWIPE_DOMINANCE`) before the long press. A caller that offers no swipe — the tab strip, the library — reads early touch movement as a scroll exactly as before, and a mouse never swipes. One arbiter, so the shell's drag and a view's swipe cannot disagree about one press (`BO_0227_007`).
- Scrolling while dragging (`BO_0263_017`): `edgeScroll` in `src/lib/drag.ts` answers how far a frame scrolls for the pointer's height over the visible part of an area — nothing in the middle, toward an edge within `EDGE_SCROLL_ZONE_PX` (56px, at most a quarter of the area) at up to `EDGE_SCROLL_MAX_PX` (16px) a frame, faster the nearer the edge, and at full speed past it. While `drag.payload` is set, a frame loop in `shell.tsx` scrolls the area the drag began in — the nearest vertically scrolling ancestor of the point it started at, or the page (`scrollerAt`) — by that much, and reads the target under the pointer again when the content moved, so the drop mark follows. It runs off the last pointer position, so a pointer held still near an edge keeps scrolling, and stops with the drag. `src/lib/drag.test.ts` proves the speeds and the zone; the loop itself is the walk's.
- Walked by the user on the served build at pin 140 on 2026-09-18, on a desktop and a phone: a block, a proposal and a retired row dragged from the top of a long document to its end and back, the area scrolling at the edge and the drop landing there (`BO_0263_018`).

