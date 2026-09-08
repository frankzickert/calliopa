# CA_0015_FEAT_document-metadata-panel

Status: completed

Requested: 2026-08-30

## Intent

A document tab today says almost nothing about the document itself. The
inspector answers with one line of declared text, `Block editor context`, which
is a label for the tool rather than a fact about the content. Meanwhile the
workspace region under the document carries three controls that belong to
nothing the reader is doing: `Open in Context`, `Mark unsaved`, and
`Move first`. The two placeholder buttons are shell demos from `CA_0002` that
proved the tab contract before there was a real view; the third offers a
placeholder view of a document that has a real one.

This change gives the right drawer the document's own facts — how its work
stands, when it last changed, how many times it has changed — and the two
operations that act on the document as a whole: deleting it, and revealing what
has been retired out of it. The workspace region loses the three controls that
were standing in for those facts.

The retired list stops being a disclosure section under the document. Its toggle
moves to the panel, and what it reveals is not a list somewhere else but the
retired blocks themselves, back in the positions they held.

## What The Panel Shows

* When the active tab holds a document, the inspector shows that document's
  metadata: its current save state, when it was last updated, and how many
  revisions it has.
* The panel is where the document's own operations live: deleting it, and
  toggling the retired blocks.

- The panel follows the active tab, like everything else in the inspector. A tab
  holding no document shows what it shows today.
- A selected process still takes the inspector, unchanged. Process detail is
  transient and the reader chose it; the document's metadata returns when the
  selection is cleared.
- The placeholder views keep their declared contribution text. This change gives
  a real view something real to contribute; it does not remove the fallback for
  views that have nothing.
- The inspector is reachable in each of its drawer states and as the mobile edge
  sheet, so the panel and its two operations are reachable on both form factors.
  A `hidden` drawer hides them, which is what hiding a drawer means.

## Save State In Words

* The panel reports the active document's save state in words: `saving`,
  `saved`, or `unsaved`.

- This is the state `CA_0012_003` put on the bridge and nothing more. There is no
  connectivity signal and no local draft: `online` and `saved locally` describe
  capabilities this system does not have, and offline editing stays out of scope
  in [Block Editor View](../../system/documents/block-editor.md).
- `unsaved` covers a failed save as well as an untried one, as the bridge already
  defines it. Which block a failure happened to stays on that block, because a
  document-level state cannot name one.
- `CA_0012_004` renders the same state in the header. Two surfaces read one
  channel; this change adds no second notion of whether work is safe. The panel
  states it beside the document's other facts, where a reader asking "is this
  saved" is already looking.

## Last Updated And Revisions

* The panel reports when the document last changed and how many times it has
  changed.
* Both facts cover the whole document — its title, its blocks' content, their
  order, and retirement and restore — not the document node alone.

- A document whose text changed but whose title did not has changed. Counting
  only the `document` node's own revisions would answer "never" for a document
  written all afternoon, which is worse than showing nothing.
- A change to a document is one graph data revision that touched it. That single
  definition answers both facts: the last update is the time of the highest such
  revision, and the count is how many there are. It also counts a split, which
  writes two blocks in one mutation, as the one change it was.
- Retiring a block writes no node revision at all: it closes a containment
  validity and creates a `retired` relation. Counting node revisions alone would
  miss it, which is why the count is over data revisions rather than over
  revisions of nodes.
- Retired blocks are part of the document's history and their revisions count.
  They are recoverable for the life of the document, so they never stopped being
  the document's.
- The graph stamps every record it writes with a creation time and exposes none
  of it. A time the reader can see has to cross the gateway, and this change is
  where that widening is decided.
- This is a count and a timestamp, not a revision browser. [Revisioned Graph](../../system/content-store/revisioned-graph.md)
  defers a user-visible history surface to a later change, and a list of
  revisions the reader can open or read back stays deferred.
- The time is presented as an absolute timestamp, in a `time` element carrying
  the machine-readable value. A relative age would have to keep itself current in
  a drawer that sits open, and an age that has stopped ticking states something
  false; a static absolute value cannot go stale. A relative reading is not ruled
  out, but it is a later change rather than part of this one.

## Deleting A Document

* The panel carries a `Delete` control that removes the document from the
  product.
* Deleting archives. The graph keeps every revision, every relation, and every
  closed validity, because dropping them would rewrite history rather than
  reclaim space.

- A deleted document leaves the library listing and cannot be opened again.
  Its established revision is archived, so a rooted read answers with nothing.
- Nothing in the interface brings it back. Recovery is real in the store and
  absent from the product until a change adds a surface for it, and this change
  does not add one.
- Because it is irreversible from where the reader stands, deleting asks first,
  and the confirmation names the document by title. This is the one destructive
  operation in the product that no undo covers.
- Deleting closes every tab in this workspace showing that document, so the
  reader is not left editing something that no longer exists.
- A stored tab in another workspace naming the deleted document opens with a
  visible notice that its target is gone, and offers nothing to edit. The tab
  stays, following the view-fallback rule in [Workspace View Types](../../system/workspace/view-types.md):
  the shell keeps one account of a target it cannot present, and a tab the reader
  left open never disappears without saying why.
- A document holding unsaved input deletes anyway, with no warning beyond the
  confirmation. The confirmation already names the document and says the removal
  is irreversible, and deleting what was never saved reaches the same outcome as
  deleting what was, so a second warning would mark a distinction with no
  consequence.
- The view drops that pending input rather than flushing it. The unmount flush
  exists so a tab switch loses nothing typed; flushing into a document being
  archived in the same breath would write a revision whose only purpose is to be
  buried.

## Retired Blocks In Place

* The retired-blocks toggle lives in the panel, and turning it on shows the
  retired blocks in the document, at the positions they held when they were
  retired.
* A retired block shown in place is read-only. It cannot be activated and cannot
  be edited; the only thing it offers is `Restore`.

- The disclosure section under the document goes away with the toggle. There is
  no separate list any more: the document itself is the list, which is what makes
  the position meaningful.
- Position comes from the order key the block held when it was retired. The key
  lives on the block and its last revision still carries it, so a retired block
  interleaves with the reading order by the same string comparison siblings
  already sort by.
- A block whose key no longer falls between two current siblings still sorts
  somewhere by that comparison, and that is where it appears. The position is
  where the block was, not a promise about where restoring would put it:
  [Block Document Model](../../system/documents/block-document-model.md) mints a fresh key on
  restore rather than assuming the old one is free.
- A merge retires the block it absorbed, so turning the toggle on after a merge
  shows the absorbed block beside the text that now contains it. That is a
  truthful account of what happened and reads as duplication, so the retired
  presentation has to be unmistakable.
- A retired block is visibly distinct from a block in the reading order, by more
  than colour, and carries an accessible name saying it is retired. A reader
  scanning the document with the toggle on must never mistake one for content.
- The toggle is off by default and its state is the tab's, so turning it on in
  one document does not turn it on in another.
- This does not contradict `CA_0013_003`. That rule governs the reading surface:
  a block in the reading order shows its content and nothing else. Retired blocks
  are not in the reading order and are visible only while the reader has asked
  for them, which is an inspection the reader turned on rather than chrome that
  arrived uninvited.
- The document read and the retired read are separate requests. Turning the
  toggle on reads the retired blocks then, so what is interleaved is current
  rather than left over from an earlier state of the document.
- Restoring a block from its old position removes it from the retired set and
  puts it in the reading order at the position restore chooses. Where those
  differ, the block moves, and it moves because restore mints a new key rather
  than because the toggle was lying.

## What Leaves The Workspace Region

* `Mark unsaved` and `Move first` are removed.
* The document tab no longer offers `Open in Context`.

- `Mark unsaved` and `Move first` are `CA_0002` placeholders that proved the tab
  contract before a real view existed. A real view now reports save state through
  the bridge and tabs reorder by drag, so both are demos of behaviour that has
  since arrived for real.
- Removing them removes coverage. The unsaved marker and per-tab unsaved
  isolation are proven through `Mark unsaved` in `tests/browser/tabs.spec.ts` and
  `tests/browser/views.spec.ts`, on placeholder tabs that report no save state of
  their own, and those scenarios go with the button rather than moving to
  documents. Neither replacement earns its cost: a two-document scenario buys a
  slow browser test for the marker's projection, and giving the placeholders a
  save state would keep a reported state standing for nothing being saved. The
  marker's per-tab isolation is deliberately left unproven.
- `Open in Context` appears because the `context` placeholder presents every
  target kind, so a document offers two views and the region renders the choice.
  The narrow removal is to stop `context` presenting `document`: the document
  then has one view, the group renders nothing for it, and the affordance stays
  for the target kinds that genuinely offer several. This keeps the fixed line
  requiring a tab to expose its compatible views true rather than contradicting
  it.
- Removing the `Open in <view>` group from the workspace region entirely would
  contradict that fixed line and is not proposed here. If that is what is wanted,
  it needs the fixed line changed first.

## The Inspector Contribution Widens

* A view still never owns a shell surface. The shell renders the inspector; the
  view says what goes in it.

- Today a view contributes one nullable string, and the shell renders it as a
  paragraph. A save state, a timestamp, a count, a delete button, and a toggle
  are not a string, so the contribution has to widen to carry structure and
  controls.
- Widening it is what keeps the boundary intact. The alternative — letting the
  block editor render into the drawer directly — would make a view the owner of a
  shell surface, which the view contract forbids in a fixed line.
- The contribution stays a store rather than a value, for the reason it already
  is one: the shell renders it and the view writes it, so a plain field would
  change with nothing re-rendering.
- The panel's controls act on the document, so the view supplies them; the shell
  neither knows what a document is nor what deleting one means.
- The contribution carries typed facts and named actions, and the shell renders
  them in its own idiom. A view declares a save state, a timestamp, a count, and
  actions with their handlers; it never hands over rendered content. This keeps
  the drawer's presentation the shell's, so every view's panel reads as the same
  drawer rather than as a per-view accident, and it bounds what a view may put
  there.
- The vocabulary of facts and controls grows by change when a view needs a shape
  it lacks. That is the cost of the shell owning the presentation, and it is also
  the point: a shape no vocabulary covers becomes a decision rather than
  something a view renders on its own.

## Supersedes

- [Workspace Shell](../../system/workspace/frame.md) gains what the inspector shows
  for a document. Its layout line saying the right drawer is a contextual
  inspector whose content follows the active item stays true and is what this
  change fills in.
- Its `Mark unsaved` and `Move first` placeholder controls go, along with the
  implementation line describing the region's placeholder interactions.
- `CA_0012_004` keeps the header's save state unchanged. The panel reads the same
  channel; it does not replace the header or introduce a second state.
- The open functional question about the active tab's round unsaved marker is
  unaffected. This change adds a third surface reading the one channel and
  decides nothing about the marker.
- [Workspace View Types](../../system/workspace/view-types.md) widens the inspector
  contribution in its view contract, keeping the fixed line that a view never
  takes ownership of a shell surface. Its registry line describing `context` as
  presenting every target kind narrows by one kind.
- [Block Editor View](../../system/documents/block-editor.md) gains the metadata the view
  contributes, the delete operation, and the retired-in-place presentation. Its
  action-surface line offering restore from the retired-block list is replaced by
  restore from the block's old position.
- Its `CA_0013_003` content-only rule is unchanged and governs the reading order,
  which retired blocks are not part of.
- [Block Document Model](../../system/documents/block-document-model.md) gains deleting a
  document as an operation, and the rule that deleting archives rather than
  removes. Its retirement and restore rules are unchanged: what changes is where
  the retired blocks are shown, not what retirement means.
- [Graph Gateway](../../system/content-store/graph-gateway.md) gains whatever answers "when did
  this last change and how many times". Its fixed line that responses expose
  logical identifiers and never storage details is the line a creation time has
  to be reconciled with: a time content was written is a fact about the content,
  and the gateway exposing none of it today is what makes this a decision rather
  than a read.
- [Revisioned Graph](../../system/content-store/revisioned-graph.md) keeps its retention and
  backup rules intact, which is why deleting archives. Its line deferring a
  user-visible history surface narrows: a count and a last-changed time become
  visible, and a revision browser stays deferred.
- `CA_0014` bounds the frame and gives each region its own scroll. The panel
  grows in a drawer that will scroll by then, and the retired blocks interleave
  into a workspace that will scroll on its own. Neither depends on the other, and
  the order they land in does not matter.

## Verification Impact

- `tests/browser/tabs.spec.ts` and `tests/browser/views.spec.ts` drive
  `Mark unsaved`, and those assertions are removed with the button rather than
  replaced.
- `tests/browser/views.spec.ts` asserts the inspector contribution as a text
  string and must assert the widened contribution instead.
- `tests/browser/block-editor.spec.ts` drives the retired disclosure and its
  list, and must drive the panel toggle and the in-place presentation instead.
- Scenarios belonging with this change: a document tab showing its state, its
  last update, and its revision count in the panel; the count rising by one after
  a typed save and after a retirement; the state following a tab switch; deleting
  a document removing it from the library, closing its tab, and leaving its
  history in the graph; the confirmation naming the document and cancelling
  changing nothing; a stored tab in another workspace naming the deleted document
  opening with a visible notice and nothing to edit; the toggle revealing a
  retired block between the blocks it used to sit between; a retired block
  refusing activation and offering only restore; restoring from that position
  putting the block in the reading order; and the toggle staying per tab across a
  switch.
- `tests/integration/block-documents.test.ts` proves the operations against real
  Postgres and is where deleting a document, and the read answering the last
  change and the count, belong.
- The axe scans must stay clean on desktop and mobile, with the panel showing a
  document, with a process selected instead, and with the retired blocks both
  revealed and hidden.
- `pnpm run verify` gates the result.

## System Work

Transferred and implemented. The specification is in `docs/system/` and every
task it enumerated has become truth there.

- `CA_0015_001` in [Graph Gateway](../../system/content-store/graph-gateway.md) — the change
  summary answering how often a named set of identities has been written and
  when last, as a count and a time carrying no revision identity.
- `CA_0015_002` and `CA_0015_003` in
  [Block Document Model](../../system/documents/block-document-model.md) — a document's
  change count and last-changed time, and deleting a document by archiving its
  established revision. Deleting needed an operation the gateway did not have,
  so `archiveNode` entered the gateway with it.
- `CA_0015_004` and `CA_0015_005` in
  [Workspace View Types](../../system/workspace/view-types.md) — the inspector
  contribution widened to typed facts and named actions, and `context` no
  longer presenting `document`.
- `CA_0015_006` and `CA_0015_007` in
  [Workspace Shell](../../system/workspace/frame.md) — the shell rendering the
  contribution in its own idiom on both form factors, `Mark unsaved` and
  `Move first` removed, and a tab whose target is gone saying so.
- `CA_0015_008`, `CA_0015_009` and `CA_0015_010` in
  [Block Editor View](../../system/documents/block-editor.md) — the metadata panel,
  `Delete` with its confirmation, and retired blocks shown in place.

All five functional questions were answered before the transfer: the time is an
absolute timestamp, a stored tab naming a deleted document opens with a visible
notice, deleting with unsaved input deletes anyway, `context` stops presenting
documents, and the contribution carries typed facts and named actions. The
`Mark unsaved` coverage was dropped rather than moved, leaving per-tab unsaved
isolation deliberately unproven.

Two things this change did not close are open work rather than part of it.
[Block Editor View](../../system/documents/block-editor.md) carries an unowned task
recording the typed-save scenarios racing the transient they assert; that flake
reproduces on an unchanged tree and is not this change's doing. `CA_0013_008` is
unchanged.
