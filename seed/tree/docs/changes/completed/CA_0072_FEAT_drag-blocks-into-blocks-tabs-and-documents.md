# CA_0072_FEAT_drag-blocks-into-blocks-tabs-and-documents

Status: completed

Completed 2026-09-30: `CA_0072_001`–`CA_0072_009` are truth in the docs the Tasks section names, the walk among them.

Requested: 2026-09-29, by the user: drag a block into another block, which then becomes focused work with the dragged block as its child; and carry a dragged block into another document by holding it over that document's tab or over the document in the library, which opens it so the block can be dropped anywhere in it.

## Behavior

### Onto A Block

- A block dragged onto another block — not between two rows — nests there. The block it lands on becomes focused work, as *Open as focused work* would make it, and the dragged block moves into that focused work as its child. A block that already has focused work takes the dragged block into the focused work it has.
- The middle part of a block's height nests; its upper and lower edges place before and after it, as a drop does today. While nesting is what a release would do, the block lights as a whole instead of the drop mark between rows. User decision, 2026-09-29.
- The dragged block lands after the focused work's last block, so successive drops keep their order. User decision, 2026-09-29.
- The reader stays in the document they dragged in. The target block shows its focused work's face at once, so dropping several blocks in a row is cheap, and opening the focused work stays one press away. User decision, 2026-09-29.
- A block can be nested into when it can be opened as focused work — today a text block, as `documents` decides; a block that cannot shows no nesting target. A dragged block that has focused work of its own keeps it: the work travels with the block, one level deeper. User decision, 2026-09-29.

### Into Another Document

- A block held over a tab of another document opens that tab, and the drag goes on: the block can be dropped anywhere in that document, before, between or after its rows, or onto one of its blocks as above.
- A block held over a document in the left panel's library opens that document — in the tab it is already open in, or, when it is open in none, in a new tab after the active one, so the source document stays one tab away — and the drag goes on the same way. User decision, 2026-09-29.
- The hold is 600 ms for a tab and a library entry alike, and the target is marked while the hold runs, so the reader sees it coming. A pass that does not hold opens nothing, so a drag can cross the header and the panel on its way elsewhere. User decision, 2026-09-29.
- A block dropped into another document is moved, not copied: it leaves the source document, as a drop within one document does, with the optimistic feedback and undo the drag model promises for a move. User decision, 2026-09-29.
- On a phone the same hold works where the header and the library are narrower: held over a tab edge in *Minimum*, the neighbouring tab becomes active; held over the library icon, the drawer opens, and held over an entry in it, that document opens. User decision, 2026-09-29.

## Where It Lands

- `ui.shell` owns the change: the shared drag model ([Drag And Drop](../../system/workspace/drag-and-drop.md)), the tabs ([Tabs](../../system/workspace/tabs.md)), the library and focused work ([Focused Work](../../system/workspace/focused-work.md)) are the frame's. The shell learns a spring-loaded target — one that opens after a hold during a drag — for tabs, tab edges, the library icon and library entries, and keeps the drag alive across the tab switch it causes.
- Nesting goes through the shell's focused-work capability: the shell opens (or finds) the child through the target kind's contribution, as it does for the control, so the shell still writes none of `documents`' vocabulary.
- `documents` draws the nesting target on a block and moves a block between documents, which today's atomic `move` does not do: it moves within one document. A block carrying focused work moves with its `focuses` edge intact. Its tasks are enumerated in its own [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md) when the change is drafted.
- The model does not change: focused work is still a document that `focuses` its block, a block is focused by at most one document, and the route stays navigation only.

## Tasks

- `CA_0072_001`, `CA_0072_002` — `ui.shell`, [Drag And Drop](../../system/workspace/drag-and-drop.md): the spring-loaded target and a drag that outlives its view.
- `CA_0072_003` — `ui.shell`, [Tabs](../../system/workspace/tabs.md): a held tab and a held tab edge.
- `CA_0072_004` — `ui.shell`, [Layout](../../system/workspace/layout.md): the held library icon and a held document entry.
- `CA_0072_005` — `ui.shell`, [Focused Work](../../system/workspace/focused-work.md): the child answered without leaving the document.
- `CA_0072_006` — `documents`, [Block Document Model](../../../src/extensions/documents/docs/system/documents/block-document-model.md): the move between documents.
- `CA_0072_007`, `CA_0072_008`, `CA_0072_009` — `documents`, [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md): the nesting target, a drop from another document, and the walk.
