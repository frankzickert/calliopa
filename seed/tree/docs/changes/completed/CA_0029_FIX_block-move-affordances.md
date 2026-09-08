# CA_0029_FIX_block-move-affordances

Status: completed

## Summary

The three gestures that move a block are each incomplete: on a narrow viewport the drag
handle sits over the text it belongs to rather than beside it, no drop target exists below
the last block so a drag cannot land at the end, and a completed move drops the document
back to reading rather than leaving the moved block active.

## Current Truth

### The handle over the text on mobile

- `--block-grip-gutter` in `src/components/views/block-editor.css` is one number: the room
  `.block-row` reserves as `padding-inline` and the box the grips are positioned in. It is
  `1.75rem`, and under `640px` the `.view--block-editor` rule sets it to `0rem`.
- With the gutter at zero the grips still render at `inset-inline-start: 0` and
  `inset-inline-end: 0` of the row, so they overlay the block's own edges. They carry an
  opaque `--panel-raised` background and a border under that breakpoint so the text
  running underneath them stays legible.
- [Block Editor View](../../system/documents/block-editor.md), Presentation, states this as a
  decision: where width is scarce the row holds no gutter open and the grips overlay the
  block's edges, because a column narrowed by two gutters costs more there than the
  overlap does. The overlap is the part that is wrong; the reasoning about column width
  is not.

### No drop target below the last block

- `dropOn$` in `src/components/views/block-editor.tsx` already compiles a drop whose
  target is `end` into `placement: { at: "end" }`, the same atomic move the keyboard
  issues.
- `<DropMark id="end" />` already renders after the last row, and lights when
  `drag.overId` is `block:end`.
- Nothing ever sets `drag.overId` to `block:end`. `data-drop-target` appears exactly once
  in the view, on `.block-row`, and the shell resolves a target by
  `closest("[data-drop-target]")`. The area below the last block declares none, so a
  block dragged there lands nowhere and the reserved mark never lights.

### The move returning the document to reading

- `structural$` clears the editor and sets `state.activeBlockId = null`, then reloads, then
  activates whatever block its `focus` argument names. Split, insert, append, and set-role
  all name a block, so writing continues where it was.
- Both move paths pass `focus` as `null`: `dropOn$` for the pointer drag, and `move$` for
  the move up and move down arrows. The document comes back reading, and the block the
  reader was editing and deliberately repositioned is no longer active.
- [Block Editor View](../../system/documents/block-editor.md) fixes that both paths compile into
  the same atomic move mutation and that `tests/browser/block-editor.spec.ts` proves them
  landing identically. Whatever this change does to one it must do to the other.

## Intended Outcome

- On a narrow viewport the drag handle sits immediately to the leading side of the block's
  text rather than over it. The row reserves the gutter on its leading side there and none
  on its trailing side, so the handle is beside the text and the move arrows keep
  overlaying the trailing edge, opaque, as they do today. The reading column gives up one
  gutter's width on mobile instead of two.
- The reserved room is present whether or not the block is active, on every viewport, so a
  grip appearing still changes colour and never geometry.
- A drag can land below the last block. The area below the last row declares itself a drop
  target that accepts `move`, the mark already reserved there lights while the pointer is
  over it, and the drop compiles into the move that places the block at the end.
- A completed move leaves the moved block active with its caret where it was, for the
  pointer drag and for the move up and move down arrows alike. Repositioning a block is
  part of writing it, not a reason to stop.
- Nothing else about the gestures changes: both paths still compile into the same atomic
  move mutation, a refused move still leaves the order unchanged, and the resting state of
  a document nobody is editing is still reading with no block active.

## How The Gestures Work

These are technical decisions, recorded here so the implementation does not re-open them.

- The end target is `.document-append`, the full-width `6rem` area already rendered below
  the last block. The shell resolves a target with
  `document.elementFromPoint(...).closest("[data-drop-target]")`
  (`src/components/shell/shell.tsx:116`), so a target must be a real element under the
  pointer; the reserved `DropMark` is two pixels tall and could never be hit. The append
  button already occupies exactly the area the reader aims at, so it declares
  `data-drop-target="block:end"` and `data-accepts="move"` rather than a new element being
  introduced beside it.
- A drop on that area moves the block and does not also append a paragraph. It is one
  element carrying two gestures, and a release that ends a drag is not the click that
  starts writing.
- The caret offset is captured before the move is sent. `structural$` idles the editor and
  clears the active block before it reloads, so the offset has to be read first and handed
  back as that call's `focus` argument — the same argument split, insert, append, and
  set-role already use to continue where the reader was.
- The mobile rule keeps one number. Rather than a second gutter width, the
  `--block-grip-gutter: 0rem` override under `640px` goes and the row's trailing padding
  alone is zeroed there. The reserved room and the grip box stay governed by one value, and
  only the trailing side gives its room up.
- The opaque background and border the grips carry under that breakpoint stay on the
  trailing grip, which still overlays text, and are no longer needed on the leading one.

## Coordination

- `CA_0028_FEAT_click-away-leaves-editing` decides which gesture ends an edit, and the two
  changes meet there. Its recorded decision is a `click` whose `pointerdown` origin is
  remembered, ending the edit only when both ends were outside the active block. A pointer
  drag begins on the block's own handle, which that change fixes as not outside, so a drag
  released over another row moves the block without ending the edit. This change depends on
  that rule holding; a press rule keyed on `pointerdown` alone would deactivate the block
  this change means to keep active.
- The unowned line in [Block Editor View](../../system/documents/block-editor.md) recording that
  the cross-block drag scenario races its own gesture is the most likely cause of a failed
  completion gate here, because this change adds drag scenarios and finishes on
  `pnpm run verify`.

## Docs This Will Touch

- [Block Editor View](../../system/documents/block-editor.md), Presentation: the account of the
  grips states that where width is scarce the row holds no gutter open and the grips
  overlay the block's edges. Half of that stops being true and the line has to say which
  half.
- The same document's account of reordering, which gains the block staying active after a
  move and the drop that lands at the end.
- The comment on `.block-reference` in `src/components/views/block-editor.css` gives the
  badge's opacity a reason that expires with this change: it is opaque "because where the
  gutter is zero the block's text runs underneath it", and on the leading side the gutter
  stops being zero. The reasoning is rewritten rather than left standing as stale.

## Verification Impact

- `tests/browser/block-editor.spec.ts` proves a desktop pointer drop landing where the
  keyboard move puts it, and proves the handle rendering to the left of the active block's
  text on both form factors by comparing boxes.
- Scenarios worth having: on mobile, the handle's box clearing the text box rather than
  overlapping it; a block dragged below the last row landing at the end; the reserved end
  mark lighting only while the pointer is over that area; and a block still active with its
  caret after a pointer drag and after each arrow.

## System Work

The specification lives in `docs/system/`. This section is the coordination record only.

- `CA_0029_001` in [Block Editor View](../../system/documents/block-editor.md), Presentation: the
  row keeps its leading gutter on a narrow viewport so the handle sits beside the text.
- `CA_0029_002` in the same section: the area below the last block becomes a drop target
  that lands a block at the end.
- `CA_0029_003` in the same section: a completed move leaves the block active with its
  caret, for the pointer drag and both arrows. Depends on `CA_0028_001` fixing that a
  gesture beginning on the block's own grip is not a press away.

## Out Of Scope

- The desktop gutter, its width, and the trailing arrows' position. Only the narrow
  viewport's leading side changes.
- Dragging a block between documents. The drop target added here accepts the same `move`
  from the same document that every block row already accepts.
