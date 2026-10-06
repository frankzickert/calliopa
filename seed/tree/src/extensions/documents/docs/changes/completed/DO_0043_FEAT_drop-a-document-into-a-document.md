# Drop A Document Into A Document

Status: completed

A block can become a document of its own (*Open as focused work*), but a document cannot go the other
way: a document written on its own and later found to belong inside another stays beside it in the
library. The user asked on 2026-10-06 to drag one document into another so that it becomes a block
there. This came while shaping tab reordering (`CA_0082`, dropped the same day because reordering by
drag already works); the answers below are the user's, given the same day.
Set to draft by the user the same day and transferred: the tasks are `DO_0043_001`–`DO_0043_002` in the
shell's `docs/system/workspace/focused-work.md` (A Dropped Document Becomes Focused Work), `DO_0043_003`
in [Block Document Model](../../system/documents/block-document-model.md) (A Document Becomes A Block) and
`DO_0043_004`–`DO_0043_006` in [Block Editor](../../system/documents/block-editor.md) (A Document Dropped
Into A Document).
Set to ready by the user the same day and implemented: `DO_0043_001`–`DO_0043_004` and `DO_0043_006`
are truth — the shell's adoption write and route, the draggable library row, `documents`' new block
and refusal, the editor's drop and marks, and the release-notes line. Walked on the served build and
reported working by the user the same day (`DO_0043_005`); completed.

## What Is Asked

* A document dragged into another document becomes a block there: a new block is made at the drop
  place, and the dragged document becomes that block's focused work, whole and unchanged — the reverse
  of *Open as focused work*. User decision, 2026-10-06.
* The document can be dragged from its row in the library and from its tab. User decision, 2026-10-06.
* The new block's words are the dragged document's title at the time of the drop, editable as any
  block's words; a later rename of the document does not rewrite them. Beneath them the block wears its
  focused work's face, as any block with focused work does. User decision, 2026-10-06.
* A document that is already the focused work of a block elsewhere moves: it becomes the new block's
  focused work, and the old block keeps its words and loses its focused work, as a block that was never
  opened. User decision, 2026-10-06.
* Dropped on the middle of a block, where a dragged block nests today, the document nests the same way:
  that block becomes focused work, or keeps the focused work it has, and the new block lands after its
  last block. Dropped above or below a block, or on a blank page, the new block lands there. User
  decision, 2026-10-06.

## What The System Already Holds

- A focused work is a `document` that `focuses` a `text` block, one child per block, the child
  parentless in the library's sense, so it stays listed there
  ([Block Document Model](../../system/documents/block-document-model.md)). The `focuses` edge, the
  one-child rule and the reads are the shell's ([Focused Work](../../../../../../docs/system/workspace/focused-work.md));
  the shell asks the target's own extension for the child.
- Dragging a block between documents and nesting it by a drop on a block's middle are
  `CA_0072`'s ([Block Editor](../../system/documents/block-editor.md), Dragging Into Blocks And Other
  Documents): the drop task reads the payload's `from` and sends `moveIn`, and `withinFocusedWorkOf`
  in `server/documents.ts` refuses a move that would put a block inside its own focused work.
- A tab is draggable: it starts a drag with `source: "tab-strip"`, its item and kind, and the block
  editor's operations `["move", "open-in-tab"]`; over the strip that drag reorders. Nothing in a
  document's content accepts a dragged tab today.
- A plain document's row in the library is not draggable. Only a structure's or an instruction's row
  is (`structures`' section, `source: "library"`, operation `link`, `BO_0349`), and such a drag springs
  over a tab and, on a phone, closes the library sheet once the pointer leaves it.

## Shape Of The Change

- One write makes the new block, sets its words to the title, and points the document's `focuses` at
  it, closing a `focuses` it had at another block in the same mutation, so nothing half-done is left
  behind. It is a human content write and asks nothing, as *Open as focused work* is.
- A drop that would put a document inside itself is refused in words and writes nothing: the target
  document itself, or any document lying below the dragged one along `focuses`. Over its own document
  the dragged document shows no target; the deeper case is known only to the write, which walks it as
  `withinFocusedWorkOf` walks a block.
- The documents section's rows become draggable, as the structures section's are, and spring over a
  tab so a document not shown is reached. A dragged tab does not spring, since over the strip it is
  the reorder gesture; it is dropped into the document the workspace shows.
- The block's row then wears the face at once, and an open tab of the dragged document stays open.
- Coverage: a document dropped between rows, on a blank page and on a block's middle; one that was
  focused work elsewhere moving and the old block left plain; a drop into itself and into its own
  focused work refused; from the library and from a tab, on desktop and on a phone.
