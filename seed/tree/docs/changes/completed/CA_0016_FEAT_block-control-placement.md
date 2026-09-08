# CA_0016_FEAT_block-control-placement

Status: completed

Requested: 2026-08-30

## Intent

`CA_0013_005` gathers a block's own operations into one bar above the active
block: the drag handle, move up, move down, insert paragraph, insert divider,
and retire, in a single row. That row reads as a menu attached to the block
rather than as controls sitting where they act, and it puts the two most
physical gestures — grabbing a block and nudging it up or down — at the top
edge, away from the block's body they move.

This change puts the two repositioning gestures on the block's own edges and
sends everything else up. The drag handle moves to the left of the block's
text, where the gesture starts. Move up and move down move to the right of the
text, where the block ends. Retire and the two insert controls join the button
bar at the top edge of the editor area, and the bar above the block disappears.

The result is one bar and two grips. The change is placement only: no operation
is added, none is removed, and every one keeps the accessible name and the
keyboard reach it has.

## Where A Control Goes

* The block's own edges carry only the gestures that move the block within the
  document. Every other control acting on the active block belongs to the bar at
  the top edge of the editor area.

- This replaces the rule that splits controls by whether they act on a block's
  content or on the block as an object. That rule made two bars necessary and
  could not survive a handle that sits on the block while retire sits above the
  document.
- The new rule is what decides where a later control goes, so neither position
  drifts into carrying the other's kind of operation. A control that changes
  where a block sits goes on its edge; anything else goes in the bar.
- Repositioning is the one operation whose meaning is spatial, which is why it
  is the one that earns a spatial position.

## The Drag Handle

* The drag handle sits to the left of the active block's text, vertically
  within the block it moves.
* Dragging still begins from the handle, and still compiles into the same
  atomic move mutation the keyboard move produces.

- The handle is the affordance for the gesture, so it belongs at the edge the
  gesture grabs. Above the block it named the block; beside the block it is the
  block's own grip.
- The handle appears only while its block is active, as it does today. An
  inactive block shows its content and nothing else, and this change does not
  weaken that.

## Move Up And Down

* Move up and move down sit to the right of the active block's text,
  vertically within the block they move.
* Both stay disabled at the ends of the sibling order, as they are today.

- Up and down are the keyboard-and-pointer equivalent of the drag, so they sit
  on the block's opposite edge rather than in a row that also carried insertion
  and removal.
- Their accessible names keep naming the block they act on, so a screen reader
  hears which block moves without depending on where the buttons render.

## What Moves Into The Top Bar

* Retire, insert paragraph, and insert divider move into the bar at the top edge
  of the editor area.
* Each still acts on the active block. The bar is present only while a block is
  active, so none of them ever names nothing.

- Retire is the one of the three that removes the block rather than adding to
  the document. Beside the text it would sit a pointer-slip away from the
  gestures that merely move the block; in the bar it is deliberate, reached the
  same way as undo and done editing.
- Retirement stays recoverable for the life of the document, so this is a
  placement change and not a change to how destructive the operation is.
- The insert controls are the same operation with a different block kind, so
  they stay together and move together.
- The bar does not wrap, so these three controls either fit its row or scroll
  sideways within it, as `CA_0012_001` already requires of every control in it.

## The Bar Above The Block Goes

* No bar renders above a block. The editor area has one bar, at its top edge.

- Nothing is left to put in a per-block bar once the handle and arrows are on
  the edges and the other three are in the top bar, so the bar itself goes
  rather than surviving as a container for nothing.
- The block row's scroll margin returns to one bar's height. `CA_0013_006`
  raised it to cover both bars; with one bar there is one height to clear, and
  it stays written from the single custom property that `CA_0012_002` requires.
- `.blocks` stops reserving room above the first block. That room exists only so
  the first block's own bar has somewhere to go, and there is no such bar.
- Removing the reservation removes space above the first block, which is a
  change to the resting reading surface and not to activation. Activation still
  moves nothing.

## Geometry

* Placing controls beside a block must not move the block's text. Activation
  changes colour and never geometry, and that rule holds unchanged.

- On a wide viewport the block row reserves a gutter on each side, whether or
  not the block is active, and the grips render into them.
- Below a width the grips render out of the row's flow, over the editor area's
  own padding, and the row reserves no gutters. The text column keeps its full
  width where width is scarce.
- The width the behaviour changes at is a technical choice, taken from the point
  where two touch-sized targets start costing the text column more than the
  grips are worth.
- Either behaviour satisfies the fixed rule above: a reserved gutter is there
  before activation, and an overlay is out of flow. The column changes width
  between viewport sizes, never between a block's resting and active states.
- The controls remain reachable by keyboard from the active block. Tab order
  follows the reading order of the block and its controls, so the handle is
  reached before the text and the arrows after it.

## Supersedes

- [Block Editor View](../../system/documents/block-editor.md) fixes the rule splitting
  controls by whether they act on a block's content or on the block as an
  object. This change replaces that fixed line with the rule above.
- Its truth lines describing the per-block bar, its anchoring and opacity, and
  the reordering that begins from it are replaced by the edge placement and the
  moves into the top bar. Reordering still begins from the handle, and both
  gestures still compile into one atomic move mutation.
- Its line giving a block row a scroll margin of both bars' heights returns to
  one bar's height.
- Its implementation lines for `--block-row-bar-height`, the room `.blocks`
  reserves above the first block, and the block bar's `bottom: 100%` anchoring
  go with the bar.
- `CA_0012_001` keeps the editor-area bar at the top edge and its no-wrap,
  scroll-sideways rule. It gains three controls that must live under it.
- `CA_0012_002` keeps its scroll margin and its single custom property, and
  loses the second bar's height that `CA_0013_006` added.
- The action surfaces list in [Block Editor View](../../system/documents/block-editor.md)
  is unchanged. Every operation it names still exists.

## Verification Impact

- `tests/browser/block-editor.spec.ts` reaches the per-block controls by their
  accessible names, so those assertions survive the move, but every scenario
  asserting where a control renders must assert the new position.
- Scenarios belonging with this change: the handle rendering to the left of the
  active block's text and starting a drag from there; the arrows rendering to
  the right and moving the block; retire and both inserts reached from the top
  bar and acting on the active block; no bar rendering above an active block;
  the block's text occupying the same rectangle with the controls present and
  absent; the grips rendering in gutters on desktop and over the margin on
  mobile without the text column moving on either; activating the topmost block
  clearing the one remaining bar; and keyboard reach arriving at handle, text,
  and arrows in reading order.
- The axe scans must stay clean on desktop and mobile with a block active.
- `pnpm run verify` gates the result.

## System Work

Done. `CA_0016_001`, `CA_0016_002` and `CA_0016_003` are folded into
[Block Editor View](../../system/documents/block-editor.md) as current truth. They also
closed `CA_0013_008`.

The fixed rule splitting controls by whether they act on a block's content or on
the block as an object is replaced in
[Block Editor View](../../system/documents/block-editor.md) by the rule in
`Where A Control Goes`. The user approved that replacement.

- `CA_0016_001` puts the drag handle to the left of the active block's text and
  move up and down to the right, in reserved gutters on a wide viewport and out
  of flow over the editor area's padding below a width.
- `CA_0016_002` moves retire, insert paragraph, and insert divider into the bar
  at the top edge of the editor area.
- `CA_0016_003` removes the emptied bar above the block, everything that existed
  only for it, and the second bar's height from the block row's scroll margin.
  It also closes `CA_0013_008`, which asks what reaching the block above an
  active one should be; with no bar covering that line the question has no
  subject.
