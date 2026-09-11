# Document Panel

## The Document Metadata Panel

* A document's own facts, and the operations that act on it as a whole, live in the inspector, contributed through the view contract: its save state, when it last changed, how many times it has changed, how many proposed changes stand unanswered against it, deleting it, and revealing its retired blocks and its proposed changes.
* A change document's panel says which extension it is a change of and carries its status as a dropdown — the six statuses of the change protocol — before the document's other facts. Choosing writes the status onto the document as the signed-in person, with the base compared first; every transition is allowed from here, because the protocol's rule that only a person promotes to `draft` and `ready` is honoured by who holds the control, not by refusing moves. An agent never sets a status: it proposes one through its tools, and acceptance moves it. `BO_0222_007`

- The save state is the one this view already reports on the bridge, in words: `saving`, `saved`, or `unsaved`. There is no connectivity signal and no local draft, because offline editing is out of scope, and `unsaved` covers a failed save as well as an untried one.
- The header renders the same channel. The panel adds no second notion of whether work is safe; it states the one channel beside the document's other facts, where a reader asking "is this saved" is already looking. Which block a failure happened to stays on that block, because a document-level state cannot name one.
- The last-changed time is an absolute timestamp in a `time` element carrying the machine-readable value. A relative age in a drawer that sits open either keeps itself current or states something false, and a static absolute value cannot go stale.
- The count and the time are the ones [Block Document Model](./block-document-model.md) defines. They cover the whole document — its title, its blocks' content, their order, and retirement and restore — rather than the `document` node alone.
- This is a count and a timestamp, not a revision browser. A list of revisions the reader can open or read back stays deferred.
- The panel follows the active tab, like everything else in the inspector. A tab holding no document shows what that tab's view contributes.

## Deleting A Document

* The panel carries a `Delete` control that removes the document from the product. It asks first, and the confirmation names the document by title.

- Deleting is irreversible from where the reader stands. [Block Document Model](./block-document-model.md) archives rather than removes, so the history survives, but nothing in the interface brings a deleted document back. It is the one destructive operation no undo covers, which is why it asks.
- Deleting closes every tab in this workspace showing that document, so the reader is not left editing something that no longer exists.
- A document holding unsaved input deletes anyway, with no warning beyond the confirmation. Deleting what was never saved reaches the same outcome as deleting what was, so a second warning would mark a distinction with no consequence.
- The view drops that pending input rather than flushing it. The unmount flush exists so a tab switch loses nothing typed; flushing into a document being archived in the same breath would write a revision whose only purpose is to be buried.
- Cancelling changes nothing.
- The confirmation is a message on the shell's message surface, raised through the view bridge rather than rendered here. This view supplies the words and what each answer does, which is what the fixed line in [Shell Integration](./block-editor.md#shell-integration) already requires of it: it never takes ownership of a shell surface. [Workspace Shell](../workspace/messages.md) owns the surface, and a raised message holds the floor until it is answered.

## Retired Blocks In Place

* The retired-blocks toggle lives in the panel. Turning it on shows the retired blocks in the document, at the positions they held when they were retired.
* A retired block shown in place is read-only. It cannot be activated and cannot be edited; the only thing it offers is `Restore`.

- There is no separate retired list. The document itself is the list, which is what makes the position mean anything.
- Position comes from the order key the block held when it was retired. The key lives on the block and its last revision still carries it, so a retired block interleaves with the reading order by the same string comparison siblings already sort by. A key that no longer falls between two current siblings still sorts somewhere by that comparison, and that is where it appears.
- The position is where the block was, not a promise about where restoring would put it. [Block Document Model](./block-document-model.md) mints a fresh key on restore, so a restored block lands where restore chooses, and it moves for that reason rather than because the toggle was lying.
- A merge retires the block it absorbed, so turning the toggle on after a merge shows the absorbed block beside the text that now contains it. That is a truthful account of what happened and reads as duplication, so the retired presentation has to be unmistakable.
- A retired block is visibly distinct from a block in the reading order by more than colour, and carries an accessible name saying it is retired. A reader scanning the document with the toggle on must never mistake one for content.
- The toggle is off by default and its state is the tab's, so turning it on in one document does not turn it on in another.
- This does not contradict the content-only reading surface. That rule governs the reading order, which retired blocks are not part of: they are visible only while the reader has asked for them, which is an inspection the reader turned on rather than chrome that arrived uninvited.
- The document read and the retired read stay separate requests. Turning the toggle on reads the retired blocks then, so what is interleaved is current rather than left over from an earlier state of the document.

## Implementation

- The view contributes the document's panel through the widened contribution: its save state in words, its last-changed time, and its revision count. `report$` is the one place a save state is reported, so the header and the panel state the same value rather than each deciding for itself (`CA_0015_008`).
- The count and the time refresh in a task of their own, tracking the document read and the reported save state. Neither the read nor the save fetches them: both are on the path leaving a block takes, and a panel-only request there delays the write that records which block the tab was left on (`CA_0015_008`).
- `Delete` in the panel raises a message on the shell's surface, naming the document by title. The title is read as the control is pressed rather than as the contribution is built, so the question names what the document is called now (`CA_0018_001`). Confirming deletes through [Block Document Model](./block-document-model.md) and then tells the shell the target is gone, which closes every tab in this workspace showing it. Cancelling changes nothing (`CA_0015_009`).
- Pending input is dropped rather than flushed: the editor is reset before the delete is sent. The unmount flush exists so a tab switch loses nothing typed; flushing into a document being archived in the same breath would write a revision whose only purpose is to be buried (`CA_0015_009`).
- `readingOrder` merges the reading order with the retired blocks the toggle reveals, sorting both by the order key each block carries and putting a block with no usable key after them by identity. It is pure, so where a retired block lands is settled without a document (`CA_0015_010`).
- A retired block renders as its own row, not a block row: dashed rule, inset edge, struck text, a standing `Retired` label, and a group name saying it is retired. It carries no reading affordance and no editable element, so it cannot be activated or edited, and the only control it offers is `Restore` (`CA_0015_010`).
- A document whose reading order says nothing still shows what the toggle revealed. The blank-page placeholder stands for a document with nothing to read, and a document showing retired blocks the reader asked for is not that (`CA_0015_010`).
- The toggle lives in the panel, is off by default, and its state is the view's, so it does not follow the reader into another document. Turning it on reads the retired blocks then, so what is interleaved is current rather than left over (`CA_0015_010`).
- The status is a `choice` action, the third kind of the view's action vocabulary: id, label, the current value, the options with their labels and the icon that stands for each, and `run$(value)`; the shell renders it as a labelled native select in the inspector and the dock alike. The editor contributes it, with a *Change of* text fact, for a document carrying `change`, and choosing sends the `setStatus` command with the document's revision; a stale base is answered as a conflict and the document read again rather than overwritten, a landed write updates the held revision and asks the shell to re-read the sections listing the document (`bridge.targetChanged$`) (`BO_0222_007`).

## Discarded Blocks In Place

* The panel's *Show discarded blocks* draws each block the reader discarded where it sits, dimmed and named as discarded, offering *Reopen*, which returns it to neutral. With the toggle off a discarded block is not drawn at all (`BO_0227`).

- In place rather than in a count at the end of the flow, for the reason [Retired Blocks In Place](#retired-blocks-in-place) gives: the position is what makes it mean anything (decided 2026-09-10). A discarded block differs from a retired one in keeping its place in the document's order, which is why it comes back where it always was, with one press or one swipe; retire takes a block out of the order and brings it back through *Restore*.
- A discarded block is not markable, and is drawn visibly neither as the flow nor as a retired block's dashed, struck-through row. `readingOrder` in `src/components/views/reading-order.ts` decides which blocks are drawn over the reading order and the two toggles (`BO_0227_014`).
