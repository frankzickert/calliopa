# CA_0083_FEAT_empty-focused-work-goes-away

Status: completed

Requested: 2026-10-06, by the user: "when a focused work has no blocks, remove that focused work, but
leave the parent block".

## The Problem

- A focused work keeps standing after its last block has left it. Dragging the only block out, or
  removing it, leaves a child document with nothing in it, and the parent block still wears its face
  and still reads *Focused work*, pointing at nothing.

## The Change

- A focused work with no standing block is removed: the child document and its `focuses` edge go,
  and the parent block stays where it is, unchanged in its own words. It no longer wears a face, and
  its control reads *Open as focused work* again, so opening it later starts a fresh child.
- Only standing blocks count. A focused work whose blocks have all been removed has no blocks in this
  sense, and the removed blocks go with it. User decision, 2026-10-06. A removed block never has
  focused work of its own (retiring a focused block is refused), so nothing nested is lost.
- It happens when the last standing block leaves — dragged out to another document or another
  focused work, or removed — and once, for the focused work that is already empty on an instance
  when the change lands. User decision, 2026-10-06.
- A focused work that a pending proposal would add a block to stays while that proposal stands; it
  is removed once no pending proposal would give it a block (the proposal is rejected, or it is
  accepted and the block it brought leaves later). User decision, 2026-10-06.
- A fresh focused work is not empty: *Open as focused work* makes it with one empty block, and a
  nest moves the dragged block in as it is made, so neither is removed under the reader.

## Open

- When the focused work's own tab is open as it is removed, the tab turns to the parent document and
  lands on the parent block, as *Back* would; when the parent is already open in another tab, that
  tab becomes active and this one closes. No notice is shown: the landing says what happened. User
  decision, 2026-10-06.
- The reader takes it back from the parent: *Take back* in the parent's bar names it and brings the
  focused work back as it was — the same child on the same parent block, with its title and the
  removed blocks it held, and the block that left standing in it again. User decision, 2026-10-06,
  over a *Restore* under *Show removed*: no undo keystroke reverses a saved structural action, and an
  emptied child's removed list could not be reached. The removal therefore keeps what bringing it
  back needs, rather than deleting the child outright.
- Owner: `ui.shell`, since the `focuses` edge, the faces and the control are the frame's
  ([Focused Work](../../system/workspace/focused-work.md)). What counts as a standing block in a child
  is the target's vocabulary, so `documents` answers it through its focused-work contribution and the
  shell removes the child and the edge; the moves and removals that empty a child are `documents`'
  ([Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md)).
- Release notes: a *Changed* line, since `ui.shell` and `documents` are bundled; added on 2026-10-06.
- Transferred on 2026-10-06 as `CA_0083_001`–`CA_0083_003` in
  [Focused Work](../../system/workspace/focused-work.md#an-empty-focused-work-goes-away), An Empty
  Focused Work Goes Away, and `CA_0083_004`–`CA_0083_007` in `documents`'
  [Block Document Model](../../../src/extensions/documents/docs/system/documents/block-document-model.md#an-emptied-focused-work)
  and [Block Editor](../../../src/extensions/documents/docs/system/documents/block-editor.md#taking-back-an-emptied-focused-work).
- Implemented on 2026-10-06 (`CA_0083_001`–`CA_0083_006`), the shell's and `documents`' halves and
  `documents`' migration `migration-ca-0083-remove-empty-focused-work` in one proposal. *Take back*
  brings the child back as a new document under its title, holding its removed blocks, since a
  retired document cannot be un-retired; everything the reader sees is as it was.
- Completed on 2026-10-06: walked by the user on the served build (`CA_0083_007`), and the
  *Changed* line added to `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`.
