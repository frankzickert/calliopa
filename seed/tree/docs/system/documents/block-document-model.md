# Block Document Model

## Purpose

- This document is the authoritative description of Calliopa's first application-owned domain model over the graph: documents composed from ordered, independently addressable blocks, their vocabulary, their structural operations, and their evolution rules.
- `CA_0007_FEAT_graph-block-document-model` is the originating change.
- [Revisioned Graph](../content-store/revisioned-graph.md) owns the durable primitives this model is expressed in. Nothing here adds a primitive.
- CCGW owns reads, validation and atomic mutation, and the kernel bridge owns what the shell may establish (`ccgw.md`, `ui-kernel.md`); this document owns what those operations mean for documents and blocks, not how the core executes them. Since `BO_0207_012` no document read or write passes through the shell's own [Graph Gateway](../content-store/graph-gateway.md). Every operation here goes through that boundary.
- The editor that renders this model is `CA_0008_FEAT_block-editor-view`. No rendering behavior is defined here.

## Documents And Blocks

* The first and only product-level document kind is a generic document: a graph node with a title and ordered blocks, carrying no story-specific meaning.
* Story, scene, and every other story-development concept arrives through its own later change, either as an additional document kind or as a concept that relates to a document.
* Each block is a graph node with stable identity and type-specific content. Block identity survives content edits, role changes, splits, merges, moves, retirement, and restore.
* A block has exactly one active containment parent. Document structure is a tree, not a graph.
* The graph is authoritative. No editor-specific serialized document tree is stored as a second source of truth.

- Surfacing one block from several documents would need a distinct non-structural reference relation. No change has introduced one, and containment must not be widened to serve that purpose.
- The model adds no tables. Documents and blocks are semantic node types, content, and relations over the primitives the graph migration already creates.

## Vocabulary

- The semantic node types are `document`, `text`, and `divider`. The semantic relation types are the core's `CONTAINS` and the shell's `retired`, both directed from the document to the block.
- The vocabulary is declared in the graph as `ui.shell`'s own members, established under `BO_0207_011`: `ext.blocktype` Blocks `document`, `text` and `divider`, and the `ext.relationtype` Block `retired`, each attached to the manifest by `partOf`. CCGW's Validation enforces them on every write that names the type: the required properties, the `role` permitted set, the run shape of `runs`, and one open candidate per node. Containment is the core's code-registered `CONTAINS` relation, so no containment type is declared; the `order` key lives on the block, as the core's block model keeps it.
- What the core does not enforce for these types stays the shell's: exactly one active containment parent, no containment cycle, and which block types a document may contain are checked by the shell before it writes, because Validation reads `permittedChildTypes` only to judge a breaking redefinition and the single-parent and cycle rules are the production cell's page endpoints' alone.
- The marking a reader gives a block or a document is its optional `intention` property, carrying the `marks` value of an established `ext.intention` declaration, resolved own marking first, else the nearest marked ancestor, else the document's. The declaration leaves it unconstrained on purpose: intention extensions are declared per instance, a permitted set here would refuse a marking the instance legitimately declares until this declaration widened, and the agent bridge already refuses an unknown intention at run start. The document's `record` slot is carried over from the previous document type the same way, with no permitted set.
- A document carrying `change` — the id of the extension it is a change of — is a change document: listed under that extension in the shell's Extensions category and never in the Documents category, created there by the row's `+` or by an agent's `create_document`, and carrying `changeStatus`, optional with the permitted set `idea`, `draft`, `ready`, `wip`, `completed`, `rejected`. The status property is `changeStatus` rather than `status` because CCGW reads a `status` key of a CREATE or a SET as the revision's lifecycle, never as content. A property rather than a relation, because the bridge's `write` verb refuses an `ext.*` endpoint and the id is what the section, the owner document and the kernel already key on; Validation refuses a seventh status at the write, not the shell. Since `BO_0222`, an extension's changes have this one form in the graph: `kernel import-changes` converted the `docs/changes/` members once. `BO_0222_004`
- The graph declarations are the only definition of these types a document write is checked against (`BO_0207_012`). `src/server/documents/vocabulary.ts` keeps the run primitives, the content validators the command parser uses before a request reaches the graph, and the gateway's schema fragment for the production module, which still validates its own store until `BO_0207_019`.
- A `document` node requires a title.
- A `text` node requires normalized runs and permits a role.
- A `divider` node carries no authored text and takes no editor.
- A `CONTAINS` relation's origin is a document or a container block; its target is a block. Only `document` is a permitted origin today, because no container block type exists.
- A `retired` relation records that a block left a document's reading order without being deleted.

* A `text` role is one of `paragraph`, `h1`, `h2`, `h3`, or `quote`. An absent role means `paragraph`, so an ordinary block stores no role property.
* A `text` block's standing is its optional `disposition`: `keep`, `pin`, `resolved` or `discarded`. An absent disposition means neutral, as an absent role means paragraph (`BO_0227`).
* A run may carry the marks `bold`, `italic`, `strikethrough`, and `code`, and may carry a link.

- Widening a permitted role or mark set is an ordinary change. Narrowing one is breaking, because content established under the wider set may hold a value the narrower set forbids, so the sets start small and grow with the editor. The role set is the `permittedValues` of the `text` declaration, so widening it is a revision of that Block; the mark set is a property of runs rather than of the block and is not expressible as a permitted set on the declaration, so it stays enforced by the run primitives in `src/lib/runs.ts` and by the editor.
- Runs are an ordered list, each carrying its own marks and no character offsets. Offsets name different characters in different runtimes, so they are never stored.
- The run primitives — the permitted roles and marks, normalization, splitting, and every edit a selection makes — live in `src/lib/runs.ts`, and this vocabulary imports them. The editor builds runs in the browser and this boundary stores them, and equal content only compares equal while both normalize the same way.

## Ordering

- Containment carries an order key so insertions and moves do not renumber the whole document.
- The key lives on the child block, because a relation carries no properties.
- The key is a base-36 string compared as an ordinary string, so a key can always be minted strictly between two siblings and a single block is written rather than the whole set.
- Sibling order is the ascending string order of the keys. Reads are deterministic for a given stored state.

## Containment Validity

- Containment validity is established open-ended over the child's revisions, so revising a block's content, role, or order key does not drop the block out of its document. The graph anchors a relation to the endpoint revisions it was created against and leaves the closing side open, which is exactly this behaviour.
- Retiring a block closes its containment validity. The relation is never rewritten or deleted, and the block's revisions stay readable.
- A block whose containment validity is closed is not part of the ordered document read.
- Closing containment is not enough on its own. A rooted read follows relations that still apply, so a block with only a closed containment is unreachable from its document. Retirement therefore creates a `retired` relation in the same mutation, and the retired list is an ordinary rooted read.
- Exactly one active containment parent is enforced where placements are decided, in `src/server/documents/documents.ts`: a restore onto a block that is already contained is refused, and a move revises the order key rather than creating a second containment.

## Structural Operations

- Create a document and its initial block.
- Insert a block before or after another block.
- Revise a block's content or role without changing its identity.
- Split and merge compatible text blocks while preserving normalized runs.
- Move and reorder a block. Ordering lives on the block, so a reorder is one revision and containment is untouched.
- Retire a block, closing its active containment without deleting graph history.
- Every write answers with the revision it established, so a caller may write the same block again without reading the document back in between.
- List a document's retired blocks and restore one, re-establishing containment at a valid position.
- Read the ordered document, one subtree, or a bounded range. A subtree is one block today, because no block type holds children.
- List the documents no document contains, each with its title. A `document` is never the target of `CONTAINS` today, so the filter keeps every document; it is written as the parentless rule so nesting documents later narrows the listing rather than rewriting it.
- Delete a document, archiving its established revision.
- Answer when a document last changed and how many times.

* An operation whose partial success would leave the document malformed commits as one atomic graph mutation or not at all.
* A refused operation reports why. The model never silently drops, reorders, or omits content.
* Unknown block types remain visible as unsupported content and are never silently omitted from a read.

## Retirement And Restore

* Restore stays available for as long as the document exists. There is no expiry.
- No retention, cleanup, or purge process exists for retired blocks. They accumulate with the rest of graph history.
- Restore re-establishes containment at a valid position under a permitted parent, minting a fresh order key rather than assuming the old position is still free.
- A block leaves a document only by becoming retired. A merge retires the block it absorbed, so what a structural gesture removed from the reading order stays recoverable rather than becoming unreachable.

## Deleting A Document

* Deleting a document archives its established revision. The graph keeps every revision, every relation, and every closed validity, because dropping them would rewrite history rather than reclaim space.

- A deleted document leaves the parentless listing and a read of it answers with nothing, because a node whose every revision is archived resolves to nothing.
- Its blocks are left as they stand. A block is reachable only through its document, so archiving each one would multiply the write for no readable difference.
- Recovery is real in the store and absent from the model. Nothing brings a deleted document back until a change adds an operation for it.
- Deleting is the one operation over a document that no undo covers. What that costs the reader, and the confirmation that guards it, belong to [Block Editor View](./document-panel.md).

## What A Document's Change Count Counts

* A change to a document is one graph data revision that touched it, counted once however many records that revision wrote.

- The document is touched by a revision of its own node, a revision of a block in its reading order, a revision of one of its retired blocks, or the creation or closure of a `CONTAINS` or `retired` relation between them.
- That single definition answers both facts: the count is how many such revisions there are, and the last change is the time of the highest one.
- A split writes two blocks in one mutation and counts once. A retirement writes no node revision at all and still counts, which is why the count is over data revisions rather than over revisions of nodes.
- Counting only the `document` node's own revisions would answer "never" for a document written all afternoon whose title never changed, which is worse than showing nothing.
- Retired blocks are part of the document's history and their revisions count. They stay recoverable for the life of the document, so they never stopped being the document's.
- This is a count and a time, not a revision browser. Nothing here lets a caller open or read back a past revision.
- Staged content is not the document's until it is accepted, so an open proposal moves neither the count nor the time. [Proposed Changes To A Document](./proposed-changes.md#proposed-changes-to-a-document) records why.

## Out Of Scope

- The workspace view host and the rendered editor.
- Story, scene, and other document kinds.
- Referencing one block from several documents.
- Retention, expiry, or cleanup of retired blocks.
- Comments, annotations, AI commands, and multiplayer editing.
- Binary bytes in the graph's rows. Media blocks reference blobs through CCGW's blob routes when a later change introduces them.

## Implementation

- The four declarations are `ui.shell` members staged through `kernel commit --members` from a clean checkout at dataRevision 31 (`BO_0207_011`): `document` requiring `id` and `title`, with `intention` and `record` optional and `text` and `divider` as permitted children; `text` as a block requiring `id`, `order` and `runs`, with `role` optional and permitted `paragraph`, `h1`, `h2`, `h3`, `quote`, `runs` its run property; `divider` as a block requiring `id` and `order`; and the `retired` relation type. Every node type keeps at most one open candidate. Their names are exact and do not shadow the core's `Document` type, because the shadow rule compares names exactly.
- `src/lib/order.ts` mints fractional order keys. `orderBetween` returns a base-36 key strictly between two bounds, where an empty bound means no bound on that side, so one call opens a document, appends after the last sibling, inserts ahead of the first, or splits an adjacent pair by lengthening the key. It refuses bounds that are equal, reversed, outside the alphabet, or leave no room beneath them, rather than returning a key that would not sort where the caller asked. `byOrder` returns siblings in ascending string order without mutating the input and keeps the given order among equal keys (`CA_0007_001`).
- `src/server/documents/vocabulary.ts` carries the run primitives — the permitted role and mark sets, run normalization, and the split that keeps every character — and the content validators the command parser applies before a request reaches the graph. The graph's own declarations (`BO_0207_011`) are what a write is validated against; the TypeScript fragment it still registers into `calliopaGraphSchema` serves the production module alone until `BO_0207_019`. Normalization drops empty runs, orders marks, and joins adjacent runs carrying the same marks and link, so two edits meaning the same thing compare equal (`CA_0007_002`).
- `src/server/documents/assemble.ts` turns a CCGW read into an ordered document. It is pure, so ordering, role defaulting, and the treatment of a stored type this build does not know are settled without a graph. Identity crosses there once: CCGW names a node `node:<id>` and the API hands out the bare id the shell minted, so every document and block id a caller holds is unchanged by `BO_0207` (`BO_0207_012`). Only an active relation places a block; a closed containment the read still carries is history. A block whose type or content this build cannot read comes back as unsupported content, and one carrying no usable order key sorts after the placed blocks by identity rather than vanishing (`CA_0007_004`).
- `src/server/documents/documents.ts` holds the operations the editor works through: create, read the ordered document or a range or one block, insert, revise runs and role, split, merge, move, retire, list retired, and restore. Each structural gesture compiles into one mutation script carried by the kernel bridge's `write` verb — `CREATE` with `status: "established"` for a new block, a content `SET` for a revision, `RELATE` for containment and retirement, `CLOSE` for the containment a merge, retire or restore detaches, `RETIRE` for a deleted document — so a refusal leaves the document exactly as it was and the core decides what the shell may establish (`CA_0007_003`, `CA_0007_005`–`CA_0007_008`, `BO_0207_012`). A close always travels with the document as an endpoint of the same script, which is what lets the kernel's gate verify it against content it can see. The bridge answers only the data revision it landed at, so the revision the next write must name is read back at that pin. A stale base is the shell's check before it writes: CCGW's direct truth write replaces whatever stands, so the operation compares the base the caller names with the revision the read found and answers a conflict without writing; the window between that read and the write is the one this module always had (`CA_0007_011`).
- `listDocuments` in `src/server/documents/documents.ts` answers the library's listing. It matches every `document` node in one unbounded read, reads those identities for their titles without assembling any document's blocks, drops any document an active `contains` points at, and sorts by title. Titles compare case-insensitively by code unit rather than by locale, because locale collation answers differently on different runtimes and this order is read back by tests and by two form factors that must agree. The sort is stable over creation-ordered roots, so documents sharing a title keep the order they were created in (`CA_0011_002`).
- `GET /api/x/ui.shell/documents` is the listing's transport, alongside the create already on that route. It answers identity and title per document and nothing else, so the drawer never pays for block content it does not render (`CA_0011_003`).
- `src/server/documents/content.ts` is the single crossing between stored JSON and the shapes this model works in.
- `src/server/ccgw/client.ts` is the shell's side of the one graph: `query` posts a rooted, bounded, pinned statement to CCGW at `CALLIOPA_CCGW_URL` and answers the assembled graph; `write`, `stage`, and `decide` post to the kernel bridge at `CALLIOPA_KERNEL_URL` — `/__kernel/review/write`, `stage`, `accept` and `reject` — and translate its answers into the outcome vocabulary of `src/server/outcome.ts`: a refusal into a validation failure naming the kernel's code, a parked confirmation into `refused` carrying its address, a member drift conflict into `conflict` naming the member. Both addresses are handed to the tree by the kernel (`ui-kernel.md`, `BO_0207_001`), and the shell's server side passes the bridge's same-origin rule as the non-browser caller it is (`BO_0207_012`).
- Reads are bounded by relation type and one hop, so a document read never walks into the rest of the graph.
- `tests/behavior/documents.test.ts` proves the operations over the one graph against a real CCGW and a real kernel, skipping without `CALLIOPA_CCGW_URL` and `CALLIOPA_KERNEL_URL`: creation counted as one change, a revise landing and answering the next base with the stale base conflicting, an undeclared role refused by Validation with nothing written, inserts, a split, a move, a merge, a retire and a restore holding identity and order with a second restore refused, a proposal staging nothing into truth and answered per member, and a rename and a delete the listing follows. The repository's kernel harness (`internal/kernel/serve/shell_documents_verification_test.go`) runs it over a scratch graph seeded with the shell's vocabulary, so verification never writes into the dogfood graph (`BO_0207_012`). The previous `tests/integration/block-documents.test.ts` proved creation, deterministic ordering, ranges, identity preservation across every operation, atomic split and merge with no run, mark, or link lost, single-parent refusal, retire, restore, stale-base conflicts that write nothing, and reload from real Postgres.
- Splitting a text block keeps the role on both halves. Naming the continuation something else is an editing decision, so the editor makes it as a separate role change.
- [ ] CA_0007_010 Extend `moveBlock` to a move between containers once a container block type exists: close the old containment and create the new one in the same mutation, and widen the `contains` origin set to that type. Today every parent is a document, so the operation is a reorder and a cross-container move is unreachable.
- [ ] CA_0007_011 Close the window where two concurrent restores of the same block could each create a containment. The single-parent check reads before the mutation rather than inside it, so the invariant holds against one writer and not against two racing ones. Decide between a database constraint and a check inside the mutation, and prove the refusal with two overlapping writers.
- `deleteDocument` in `src/server/documents/documents.ts` retires the document node in one `RETIRE` through the bridge and touches nothing else: its established revision is archived and the node leaves current reads. The listing stops answering it, a read of it answers no result, and its blocks, their revisions, its closed containments and its `retired` relations all stay in the graph. It names the revision it is based on, so a rename that landed first is a conflict rather than a silent delete, and a document that is unknown or already deleted is refused rather than answered as success (`CA_0015_003`).
- Deleting was the gateway's `archiveNode` (`CA_0015_003`); over CCGW it is the core's `RETIRE`, which the kernel's `write` verb admits for content (`BO_0207_012`).
- `readDocumentChanges` in `src/server/documents/documents.ts` answers the count and the last-changed time from CCGW's own history: two metadata-only reads with `INCLUDE HISTORY`, rooted at the document over its containments and its retirements, and every data-revision stamp on a revision, a relation or a closed validity counted once. It gathers the document, its blocks in the reading order, its retired blocks, and the relations holding them, and asks the gateway's change summary for the data revisions that wrote any of them. A closed relation is not reachable from a current read and does not need to be: every mutation that closes one also writes a record that is (`CA_0015_002`).
- `GET /api/x/ui.shell/documents/[id]/changes` carries it. It is its own read rather than a field on the document, so the panel refreshes a count after a save without paying to read every block again (`CA_0015_002`).
- `tests/behavior/documents.test.ts` proves both over the one graph (`BO_0207_012`); before it `tests/integration/block-documents.test.ts` proved them against real Postgres: deleting leaving the listing and the read while its history stays, a stale base conflicting, an unknown or already deleted document refused, one document's deletion leaving another untouched, and the count rising by one for a typed save, by one for a split that writes two blocks, and by one for a retirement that writes no node revision, with a retired block's own revisions still counted (`CA_0015_002`, `CA_0015_003`).
- The `document` declaration gained `change` and `changeStatus` as optional properties with the six permitted values (`BO_0222_004`), staged as the revised member through `kernel commit --members`; `createDocument` takes the two and writes them in its `CREATE`, `listDocuments` drops a document carrying `change`, `listChangeDocuments` answers every change document with its extension and status by title, and `setChangeStatus` revises the document node alone with the base compared first, refusing a document that is not a change before the graph (`documents.ts`); the command API gained `setStatus`, and a create names `change` and `status`.
- The `text` declaration permits the optional `disposition` with its four values, revised through `kernel commit --members` as `BO_0222_004` revised `document`, so Validation refuses a fifth at the write — where the retired artifact editor's graph stored `disposition: "banana"` (`BO_0138`). `setBlockDisposition` in `documents.ts` writes `SET b.disposition = $disposition` with the caller's base compared first, a null clearing it; the command API's `setDisposition` names the standing, neutral included, so a body that forgot it is refused rather than read as clearing one. A split copies the disposition to its tail as it copies the role, a revise writes runs and role by property and leaves it standing, and a merge keeps the surviving block's own. A disposition written is one change to the document, as any revision is. `assemble.ts` reads it onto `TextBlockView` as `standing`, anything not on the scale reading as neutral. Proven over the one graph in `tests/behavior/documents.test.ts` (`BO_0227_010`).
