# Drag And Drop

## Drag And Drop

* One shared drag model spans tabs, drawers, workspace, and command dock.
* Every draggable carries stable item identity, item kind, source context, supported operations, and an optional preview representation.
* Drop targets declare accepted operations: move, copy, link/reference, open in tab, attach to command, or use as process input.
* Potentially destructive moves use optimistic feedback with undo.
* On mobile, long-press begins the drag and targets enlarge while dragging.

- A coarse pointer must hold still before drag begins; ordinary touch movement remains scrolling.
- The shell's placeholder interactions prove tab reorder and failed-process attachment to the composer on desktop and mobile.
- Later tools must remain able to drag a scene into the tab bar, media onto a storyboard frame, a character onto a scene, a failed process into the command area, and an open tab into the story tree.

## Implementation

- `src/lib/drag.ts` holds the shared drag model: a payload of item identity, item kind, source context, offered operations, and preview; a target that declares what it accepts; and the resolution that takes the first offered operation a target accepts. `pointerIntent` decides between dragging, scrolling, and waiting, so a mouse drags on movement while a coarse pointer must hold still for the long press. The shell coordinates pointers without capturing them, reading the target under the pointer, showing a preview that follows it, marking the hovered target, and enlarging every target on coarse pointers. A move applies optimistically before the workspace save and leaves an undo entry in the dock; dragging a process onto the composer attaches it. Desktop and mobile scenarios prove tab reorder with undo and failed-process attachment (`CA_0002_020`).
