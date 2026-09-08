# CA_0013_FEAT_document-editor-presentation

Status: completed

Requested: 2026-08-30

## Intent

The document editor reads as a tool wrapped around a document rather than as a
document. Above the text sit a view-name tag and a heading repeating the title;
the title itself is read-only; every block carries a gutter of controls that
appear on hover; and a click anywhere in a block drops the caret at the end of
that block rather than where the reader aimed.

This change makes the tab read as the document. The view-name tag goes. The
document's own title becomes the headline, edited where it is read. Blocks show
their content and nothing else until one is activated, activation moves no
pixel, the caret lands where the pointer landed, and the block's own bar appears
above the block it belongs to without ever pushing the document.

## The Editor Area

* The document editor area shows the document headline, then the document's
  blocks, and nothing else of its own.
* No view-name tag renders above the document.

- The workspace region's view-name eyebrow is removed for every view, not only
  for the block editor. A tag naming the tool is chrome, and the tab strip
  already says which view a tab holds.
- The workspace region's heading, which today repeats the active tab's title, is
  removed with it. The headline belongs to the view that owns the content, so
  the title is rendered once, by the surface that can edit it.
- The workspace region keeps an accessible name, supplied directly rather than
  by a visible heading it no longer renders.
- The context and outline placeholder views render no headline of their own.
  They keep their bodies and lose the shell heading, which is what "the headline
  belongs to the view" means for a view that has no title to show.

## The Document Headline

* The document's title is the headline of the editor area.
* Clicking the headline makes it editable in place.
* The headline holds text only: no marks, no links, and no line breaks.

- The headline is presented at first-level heading scale. It is the largest text
  in the tab and reads as the document's name, not as a field above the
  document.
- Reading and editing the headline use the same element and the same type, so
  the title does not move when it is clicked. This is the same constraint the
  blocks carry below.
- Enter commits the title and leaves it. Escape leaves it without keeping the
  edit. Blur commits, like leaving a block does.
- A pasted value is reduced to its text. Marks, links, and newlines in the
  clipboard do not survive into a title.
- The title saves through the same pause-then-save rule blocks use and reports
  its outcome the same way. Nothing new is invented for it.
- [`CA_0011_004`](../../system/documents/block-editor.md) is the task that gives the
  title its editing affordance, and it is still the task that delivers it. This
  change says what that affordance looks like and where it sits; it does not add
  a second title editor.

## Blocks While Reading

* An inactive block shows its content and nothing else.

- No hover border, no gutter, no controls, and no per-block chrome of any kind
  renders around a block that is not active. The reading surface is the
  document.
- This is what the surface's existing quiet-reading rule was always aiming at.
  Today the rule is contradicted by controls that appear under the pointer and,
  on touch, sit permanently above every block.
- A block reserves the box its active state will use, transparently, so
  activation changes colour and never geometry.
- "Content only" is the current delivery, not a permanent ceiling. A later
  change may give a block a resting affordance; it may not give it one that
  moves the text.

## Activation

* Activating a block must not move its text by a single pixel.
* The caret lands at the position the pointer clicked.

- Reading and editing render the same tag with the same type, line height,
  padding, margins, and border box. The active state may change colour; it may
  not change geometry.
- A click on reading text resolves to a character offset in that block before
  the block is repainted as an editor, and the caret is placed at that offset.
  The offset is a model offset in the run model, so a click inside marked or
  astral text lands where the reader sees it.
- A click past the end of a line lands at that line's end. A click below the
  last line lands at the end of the block.
- Keyboard activation lands the caret at the end of the block. There is no
  pointer position to honour, and the end is where typing continues.
- With per-block controls gone from the resting surface, the reading block
  itself carries the activation affordance: it is reachable in tab order, it has
  an accessible name, and Enter or Space activates it. The separate `Edit`
  control is removed, so keyboard reach no longer depends on chrome that is no
  longer there.
- A pointer drag that selects text inside one reading block activates that block
  with the dragged range still selected, so selecting a phrase and formatting it
  is one gesture rather than two. The range crosses into the editor as character
  offsets, the same way a click's caret position does.
- A drag that crosses block boundaries activates nothing. At most one block is
  active, so activating would collapse a selection the reader made in order to
  copy it. The native selection stands instead, and selection across blocks as an
  editing gesture stays a later slice.

## The Block's Own Bar

* A bar's placement follows what it acts on. Controls acting on what is inside a
  block belong to the formatting bar at the top edge of the editor area;
  controls acting on the block as an object belong to this bar, above the block.
* The bar carrying a block's own operations is visible only while that block is
  active.
* The bar sits above the block it belongs to.
* Showing or hiding the bar must move no document content.

- The rule above is why an active block carries two bars, and why that is the
  intended surface rather than something to reconcile later. Marks, links, role,
  undo, and done editing act on the caret and the selection, so they stay in one
  place where muscle memory finds them. The drag handle, move, insert, and retire
  act on the block, so they sit on it and leave no doubt which block they would
  change.
- The rule also decides where a later control goes, so neither bar drifts into
  carrying the other's kind of operation.
- The bar is the per-block group the view already has: the drag handle, move up,
  move down, insert paragraph, insert divider, and retire. This change moves it,
  conditions it, and drops the `Edit` control that activation no longer needs.
  It adds no operation.
- The bar renders out of the document's flow, over the surface, anchored to the
  top edge of its block. It may overlay the blocks above it, and it is opaque,
  so text passing under it does not read through the controls.
- The bar aligns with its block's text column, so it reads as belonging to that
  block rather than to the area.
- The bar behaves the same way on touch. It does not become a static row above
  the block, which is what pushes the document today.
- The bar's controls are reachable by keyboard from the active block, and each
  keeps its accessible name naming the block it acts on.
- Reordering by pointer drag now begins from a block that has been activated,
  because the drag handle is part of this bar. Keyboard move stays available
  through the same bar, and the action still compiles into the same atomic move
  mutation, so no operation becomes pointer-only and none is lost.
- The bar is above its block in every case, with no second position. Where a
  block sits too near the top of the surface for the bar to fit, the surface
  scrolls far enough to reveal it: the scroll margin `CA_0012_002` gives the
  active block grows by this bar's height on top of the formatting bar's. A bar
  that flipped below its block instead would take its position from the scroll,
  so it could move while the reader types near the top.
- Activating a block already clear of both bars scrolls nothing, as
  `CA_0012_002` already requires. The correction stays a response to being
  covered, not a routine of activation.

## An Empty Document

* A document with no content shows a placeholder across the block area.

- A document is empty for this purpose when it holds no blocks, or holds exactly
  one text block with no text. A newly created document is the second case, and
  it must read as a blank page rather than as a row saying `Empty block`.
- The placeholder covers the block area rather than sitting in a block-sized
  row, so the empty document reads as a page waiting for writing.
- Clicking anywhere in that area starts writing: the empty block is activated
  with the caret in it, and where there is no block at all one paragraph is
  created and activated.
- The placeholder is not content. It is never stored, never saved, and
  disappears the moment a character is typed.
- The existing italic `Empty block` marker inside a block row is removed. An
  empty block inside a document that has other content shows an empty line,
  which is what it is.
- Clicking below the last block of a document that has content appends a
  paragraph and activates it, so the click means the same thing whether or not
  the document holds anything.
- Where the last block is already an empty paragraph, that click activates it
  rather than appending another, so repeated clicks cannot stack empty blocks.

## Supersedes

- [Block Editor View](../../system/documents/block-editor.md) gains the headline's
  presentation and editing, the content-only reading rule, the pixel-identity
  and caret-at-click rules for activation, the per-block bar's placement and
  activation-conditioned presence, and the empty-document placeholder. Its
  presentation section currently says only that the view renders a document
  title and ordered blocks.
- Its line placing activation on an affordance with an accessible name stays
  true, but the affordance moves from the removed `Edit` control onto the
  reading block itself.
- Its implementation lines describing the hover-revealed control gutter, the
  static touch fallback, and the block hover border change with this work.
- [Workspace Shell](../../system/workspace/frame.md) loses the workspace region's
  view-name eyebrow and its title heading, and gains the region's own accessible
  name in their place.
- [Workspace View Types](../../system/workspace/view-types.md) owns the workspace
  region and the `Open in <view>` group that stays there. Nothing in this change
  alters the view contract.
- `CA_0011_004` keeps its ownership of the title-editing affordance; this change
  specifies it rather than replacing it.
- `CA_0012_001` keeps the formatting bar at the top edge of the editor area,
  unchanged. This change touches the per-block bar only, and adds the placement
  rule that says why the two bars are separate.
- `CA_0012_002` keeps its scroll margin and gains this bar's height, so an
  activated block clears both bars rather than only the formatting one.

## Verification Impact

- `tests/browser/block-editor.spec.ts` reaches the `Edit` control, the hover
  gutter, and the read-only title today, and must reach the new surface instead.
- Scenarios belonging with this change: no view-name tag and one headline;
  renaming a document from its headline; an inactive block rendering content
  only; the block's text occupying the same rectangle before and after
  activation; a click mid-word leaving the caret at that word; a phrase dragged
  in reading text arriving selected in the editor; a drag across two blocks
  activating neither; the bar appearing above the active block without moving the
  document; activating the topmost block scrolling far enough to reveal both
  bars; the empty document's placeholder turning into a first block on a click;
  and a click below the last block appending one paragraph rather than stacking
  empties.
- `tests/browser/layout.spec.ts` asserts the workspace region's heading and must
  assert the region's new accessible name instead.
- The axe scans must stay clean on desktop and mobile, with the headline in
  reading and editing state, with a block active and with none.
- `pnpm run verify` gates the result.

## System Work

Transferred and completed. `CA_0013_001` is truth in
[Workspace Shell](../../system/workspace/frame.md); `CA_0013_002` through
`CA_0013_007` are truth in
[Block Editor View](../../system/documents/block-editor.md), which also carries the
fixed placement rule this change established: a control's placement follows what
it acts on.

- [ ] `CA_0013_008` remains open in
      [Block Editor View](../../system/documents/block-editor.md). The browser
      scenarios showed that an active block's bar, being opaque and above its
      block, covers the line directly above it, so on a narrow viewport the
      preceding block cannot be clicked while its neighbour is being edited.
      That follows from the overlay rule rather than contradicting it, and the
      reader sees the bar rather than the hidden text, but nothing has decided
      whether losing that one gesture is the intended cost.
