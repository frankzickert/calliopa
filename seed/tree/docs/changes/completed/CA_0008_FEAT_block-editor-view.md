# CA_0008_FEAT_block-editor-view

Status: completed

Requested: 2026-08-29

## Intent

Add the first real workspace view type: a block-based reading and editing
surface modeled on the graph artifact experience in
`/home/calliopa/projects/_calliopa-old/calliopa-bootstrap`, especially
`distribution/seed/tree/src/extensions/artifact/components/reading.tsx` and its
artifact libraries.

The interaction model should feel like one continuous document even though
each block is a durable graph node. The implementation is native Calliopa code
registered through `CA_0006`; it does not port or preserve the old artifact
extension boundary.

## Target Experience

- A document opens as a calm reading surface in the workspace's main area with
  no block active.
- Activating a block transitions that block into in-place editing without
  replacing the rest of the document with a form. Every block stays activatable,
  and at most one block is active per tab.
- Arrow keys move across block boundaries, Enter splits at the caret, Backspace
  or Delete merges compatible boundary blocks, and an empty block can be
  removed through an explicit recoverable interaction.
- Users insert blocks in place, change compatible text roles, reorder blocks,
  and move blocks among supported containers.
- Rich text, links, paste, undo, and redo preserve semantic graph content rather
  than editor-specific serialized state.
- Pointer, keyboard, and touch expose the same operations with appropriate
  gestures and accessible names.
- Typing saves itself after a short pause, and any pending save flushes when the
  block or editing mode is left. No explicit save gesture is required.
- Save state and failure remain attached to the affected block. Navigation or a
  tab switch must not silently discard unsaved input.
- Reload reconstructs the document entirely from the graph.

## First Delivery Slice

- Render a document title and the ordered blocks `CA_0007` defines: rich text in
  its supported roles, and dividers. Any other stored type shows a visible
  unsupported-type fallback rather than being omitted.
- Open with no block active, and activate exactly one block editor at a time
  while other blocks remain in reading presentation.
- Edit and save normalized rich-text runs through the graph gateway.
- Insert, split, merge, reorder, change text role, retire, and restore blocks
  using atomic graph operations from `CA_0007`. Restore is reached from the
  document's retired-block list and stays available for the life of the
  document.
- Provide these action surfaces, each with a keyboard-accessible equivalent:
  inline formatting marks and links on the current selection, text role
  conversion among the supported rich-text roles, insert a block after the
  current one as either a paragraph or a divider, and retire the current block.
- Reorder blocks by pointer drag through the shared shell drag contract, with an
  equivalent keyboard and action-menu move that produces the same graph
  mutation.
- Integrate the current block and selection into the right inspector and shared
  drag contract without duplicating shell state.
- Preserve per-tab selection, focus target, and browser-local scroll through
  ordinary tab switching.
- Verify behavior with real Postgres and production desktop/mobile browser
  scenarios; no fixtures may bypass graph writes.

## Later Editor Slices

The following behavior from the old artifact editor should be separate follow-up
changes after the first slice proves the foundation:

- nested lists, callouts, and tables with container-aware keyboard behavior;
- code, math, diagram, media, file, and embed blocks;
- comments, passage anchors, references, disposition, and block opening/drill;
- duplicate, rich structural paste, cross-container copy/move, and advanced
  conversion;
- AI commands and proposal review grounded in selected blocks.

Each slice adds its model and validation through the same change process before
adding UI behavior. None introduces an extension API.

## Persistence And Editing Rules

- The graph document model is authoritative; editor state is transient.
- A save creates a graph revision of the affected block and returns the new
  baseline revision.
- Editing a block schedules a save after a short typing pause. Leaving the block
  or leaving editing mode flushes any pending save immediately rather than
  waiting for the pause to elapse.
- Equal normalized content is not written again.
- Structural gestures compile into one atomic graph mutation whenever partial
  success would leave the document malformed.
- Concurrent or stale edits follow the conflict behavior settled for
  `CA_0005`; the editor must surface the outcome and must not silently overwrite.
- Undo inside a block is transient editor history over text and marks. It never
  reverses an already saved structural operation.
- Reversing a saved structural operation is a deliberate, separately named
  action, never a side effect of the undo keystroke. A retired block is
  recovered through restore.

## Out Of Scope

- Recreating the old extension manager, graph-hosted source tree, materializer,
  kernel bridge, release pins, extension review policy, or artifact manifest.
- Shipping all old artifact block types and commands in the first slice.
- Collaborative cursors, multiplayer conflict resolution, comments, AI
  proposal review, or offline editing unless separately approved.

## Dependencies

- `CA_0006_FEAT_workspace-view-types` supplies the view host and built-in
  registry.
- `CA_0007_FEAT_graph-block-document-model` supplies durable content and atomic
  structural operations.
- Workspace shell persistence and tab context from `CA_0002` must be available.

## Functional Questions

- Save timing, activation model, the first-slice action surface, and block
  reordering are settled above.
- Block removal follows the restore answer recorded in `CA_0007`: retire is
  recoverable from a document-level retired-block list, offered indefinitely.
- The first slice renders and inserts both block types `CA_0007` ships, so no
  stored type is refused by its only view.
- Undo is editor-local; graph-level reversal is an explicit action, recorded
  above.
