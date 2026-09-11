# Drag And Drop

## Drag And Drop

* One shared drag model spans tabs, drawers, workspace, and command dock.
* Every draggable carries stable item identity, item kind, source context, supported operations, and an optional preview representation.
* Drop targets declare accepted operations: move, copy, link/reference, open in tab, attach to command, or use as process input.
* Potentially destructive moves use optimistic feedback with undo.
* On mobile, long-press begins the drag and targets enlarge while dragging.

- A coarse pointer must hold still before drag begins; ordinary touch movement remains scrolling.
- The shell's placeholder interactions prove tab reorder on desktop and mobile.
- The composer is no drop target, by the user's decision of 2026-09-10 in `CA_0039`: a process dragged onto it showed as a chip the run was never sent, promising context the run did not receive. Files as context are `BO_0229`'s, and process results are not attached. The drag model keeps `attach-to-command` in its vocabulary, as the fixed line above lists it; no shell target accepts it (`CA_0039_006`).
- Later tools must remain able to drag a scene into the tab bar, media onto a storyboard frame, a character onto a scene, and an open tab into the story tree.

## Implementation

- `src/lib/drag.ts` holds the shared drag model: a payload of item identity, item kind, source context, offered operations, and preview; a target that declares what it accepts; and the resolution that takes the first offered operation a target accepts. `pointerIntent` decides between dragging, scrolling, and waiting, so a mouse drags on movement while a coarse pointer must hold still for the long press. The shell coordinates pointers without capturing them, reading the target under the pointer, showing a preview that follows it, marking the hovered target, and enlarging every target on coarse pointers. A move applies optimistically before the workspace save and leaves an undo entry in the dock. Desktop and mobile scenarios prove tab reorder with undo (`CA_0002_020`).
- `pointerIntent` answers `swipe` too, for a target that offers one by passing the travel's axes: a coarse pointer that has moved 12px (`SWIPE_LOCK_PX`) with horizontal travel at least 1.4 times its vertical (`SWIPE_DOMINANCE`) before the long press. A caller that offers no swipe — the tab strip, the library — reads early touch movement as a scroll exactly as before, and a mouse never swipes. One arbiter, so the shell's drag and a view's swipe cannot disagree about one press (`BO_0227_007`).
