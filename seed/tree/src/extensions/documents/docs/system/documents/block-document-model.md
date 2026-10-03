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

- An admonition is a container block carrying a saved `patternId` and ordered child text blocks, each a graph node attached through `CONTAINS`. The graph stores named patterns with a name, six-digit hex color, optional Garage image blob reference and optional footline. A pattern may be referenced from any document; a pattern edit changes every callout that reads it. The color supplies the accent and pale body tint.

- The semantic node types are `document`, `text`, and `divider`. The semantic relation types are the core's `CONTAINS` and the shell's `retired`, both directed from the document to the block.
- The vocabulary is declared in the graph as `ui.shell`'s own members, established under `BO_0207_011`: `ext.blocktype` Blocks `document`, `text` and `divider`, and the `ext.relationtype` Block `retired`, each attached to the manifest by `partOf`. CCGW's Validation enforces them on every write that names the type: the required properties, the `role` permitted set, the run shape of `runs`, and one open candidate per node. Containment is the core's code-registered `CONTAINS` relation, so no containment type is declared; the `order` key lives on the block, as the core's block model keeps it.
- What the core does not enforce for these types stays the shell's: exactly one active containment parent, no containment cycle, and which block types a document may contain are checked by the shell before it writes, because Validation reads `permittedChildTypes` only to judge a breaking redefinition and the single-parent and cycle rules are the production cell's page endpoints' alone.
- The marking a reader gives a block or a document is its optional `intention` property, carrying the `marks` value of an established `ext.intention` declaration, resolved own marking first, else the nearest marked ancestor, else the document's. The declaration leaves it unconstrained on purpose: intention extensions are declared per instance, a permitted set here would refuse a marking the instance legitimately declares until this declaration widened, and the agent bridge already refuses an unknown intention at run start. The document's `record` slot is carried over from the previous document type the same way, with no permitted set.
- A document is a document: it carries no `change` and no `changeStatus`, and an extension's changes are its own `docs/changes/` members rather than nodes in the graph (`BO_0254_008`). What the declaration carries beyond `id` and `title` is `intention`, `record`, and the root's `phase` and `supersededBy`.
- Under `BO_0254`, promoted to draft by the user on 2026-09-16 and transferred here the same day, an extension's change documents stop being `document` nodes and become its own `ext.source` members under `docs/changes/`, rendered read-only by the Extensions category. It is the first part of `BO_0253` in `calliopa-bootstrap`, which separates the document and decision surfaces from `ui.shell`, and it comes first so that `ui.shell` never has to declare a dependency on the extension the document surface becomes. The repository's half — the protocol, the skills and the migration — is `extension-model.md` `BO_0254_001`–`BO_0254_003`, the kernel's `ui-kernel.md` `BO_0254_004`–`BO_0254_005`. Decided 2026-09-16: the body is read-only in the browser; a status is established by accepting the proposal that changes its `Status:` line; the row's `+` goes, and a change document is written by an agent working from a checkout, in the proposal that carries the code.
- The `document` declaration dropped `change` and `changeStatus` and the server dropped the machinery behind them (`BO_0254_008`): `createDocument` takes a title and a first block, `listDocuments` has nothing to filter out, and `listChangeDocuments`, `setChangeStatus` and the `setStatus` command are gone with the editor's status control. Dropping two declared optional properties while established content carried them is not a breaking class and needed no `ext.migration` — the compatibility check measures narrowing over the *new* declaration's permitted sets, so a property it does not mention contributes nothing (`calliopa-bootstrap` `validation.md` `BO_0254_007`).
- The graph declarations are the only definition of these types a document write is checked against (`BO_0207_012`). `src/server/documents/vocabulary.ts` keeps the run primitives, the content validators the command parser uses before a request reaches the graph, and the gateway's schema fragment for the production module, which still validates its own store until `BO_0207_019`.
- A `document` node requires a title.
- A `text` node requires normalized runs and permits a role.
- A `divider` node carries no authored text and takes no editor.
- A `CONTAINS` relation's origin is a document or a container block; its target is a block. Only `document` is a permitted origin today, because no container block type exists.
- A `retired` relation records that a block left a document's reading order without being deleted.

* A `text` role is one of `paragraph`, `h1`, `h2`, `h3`, or `quote`. An absent role means `paragraph`, so an ordinary block stores no role property.
* A `text` block's standing is its optional `disposition`: `keep`, `pin`, `resolved` or `discarded`. An absent disposition means neutral, as an absent role means paragraph (`BO_0227`).
* A relation anchors a block, and a relation between two blocks is a node that says why. The unit is the block because any block says something; the relation and the surfaces that read it are `relations`' (Relations Are Their Own Extension, below). User decisions, 2026-09-13 and 2026-09-23 (`BO_0244`, `BO_0288`).
- A focused work is a document that `focuses` a block: an `ext.relationtype` `focuses` declared by `ui.shell` through `kernel commit --members` as the work vocabulary was (`BO_0244_006`, `CA_0047_001`; the kernel harness's fixture `serve/testdata/ui-shell-vocabulary.json` mirrors it), an edge from the child `document` to the `text` block it elaborates. A block is focused by at most one document — the shell's rule, checked by a read before the write as single containment is — and the block keeps its place in its parent; the child is parentless in the library's sense and lists there under its title. Branch scope is not a visual subtree: opening a block as focused work changes nothing about what is accepted (`CA_0047`).
- A `relation` is a non-block type `relations` declares, requiring `id`, `kind`, `reason` (runs) and `origin` and permitting `state`: `kind` in `dependsOn`, `supports`, `contradicts`, `qualifies`, `constrains`, `implements`, `supersedes`, `evidences`, `opensQuestionIn`, `affectedBy`; `origin` in `declared`, `derived`, `inferred`; `state` in `declared`, `exercised`, `needsReview`, `orphaned`, `retired`, absent meaning `declared` — *proposed* is the node being a candidate, never a state. It keeps one open candidate, and its `source` and `target` edges leave the relation node for a block each, so staging one revises neither block. A relation may cross documents and never anchors on a retired block. The sets are `server/work.ts`'s constants beside the declarations.
* A run may carry the marks `bold`, `italic`, `strikethrough`, and `code`, and may carry a link.
* A run's text may hold `\n`, a line break within its block; a block of several lines stays one block. Every reader of the text receives the character: the editor draws it as a line break ([Block Editor](./block-editor.md)), publishing hands it to the site, which draws it as one, and an agent's reads and a proposal's change view keep it as it is. The run primitives and CCGW's run shape take it as any character. User decision, 2026-09-18 (`DO_0003_003`).

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
- A split's caller may name the tail: `splitTextBlock` and the `split` command take an optional `tailBlockId`, a block identity in `randomUUID()`'s form, used in place of the one the operation mints. The name is read first, because a `CREATE` over a node that exists would write a revision of it rather than a new block: one already taken is a conflict that writes nothing. A split that names none mints one, as before. The answer carries `tailRevisionId`, the revision the tail was established at, so an editor that drew the tail before the split landed saves it without reading it back ([Block Editor View](./block-editor.md)). `tests/behavior/documents.test.ts` proves the chosen identity kept and its revision answered, a taken one refused with the document and its count unchanged, and an unnamed split unchanged (`CA_0045_004`).
- Move and reorder a block. Ordering lives on the block, so a reorder is one revision and containment is untouched.
- Retire a block, closing its active containment without deleting graph history.
- Every write answers with the revision it established, so a caller may write the same block again without reading the document back in between.
- List a document's retired blocks and restore one, re-establishing containment at a valid position.
- Read the ordered document, one subtree, or a bounded range. A subtree is one block today, because no block type holds children.
- List the documents no document contains, each with its title. A `document` is never the target of `CONTAINS` today, so the filter keeps every document; it is written as the parentless rule so nesting documents later narrows the listing rather than rewriting it.
- Delete a document, archiving its established revision.
- Answer when a document last changed and how many times.
- A relation's operations here are `server/work-ops.ts`, one named command each on the command route (`reviseReason`, `setRelationState`), each an atomic script through the bridge's `write` verb naming its base (`BO_0244_007`): edit a relation's reason; set its state, `retired` included, which is how a relation ends — never `RETIRE`, which would hide its record from every read, and which the kernel's write verb refuses for a relation node (`ui-kernel.md`, `BO_0244_003`). A person declares a relation through `relations`' commands route.
- The model is unchanged by `CA_0065` (2026-09-23) and the code that writes it is split: a focused work is still a `document` that `focuses` a block, one child per block, the child parentless in the library's sense, retiring a focused block refused and deleting the child closing the edge — while the `focuses` edge, the one-child rule and the reads are the shell's ([Focused Work](../workspace/focused-work.md)) and this extension contributes only how a `document` child is made and what it says for itself (`CA_0065_008`). The two lines below describe what is written; which half writes it is there.
- Open a block as focused work, and read what it has (`CA_0047_002`): `openFocusedWork` in `src/server/documents/focus.ts`, the `openFocusedWork` command on the commands route, one atomic script through the bridge's `write` verb creating the child document — titled with the one claim the block asserts when it asserts exactly one, else the block's words truncated at the first sentence, editable at once (user decision, 2026-09-13) — with its first block and the `focuses` edge; a block already focused by a document answers that document instead of creating one; the operation is a human content write and needs no confirmation. Two reads beside it: the child of a block (`childrenOf`, a rooted reverse read over `focuses` at the block; `focusOf` reads the edge forward from the child for the delete), and, for the parent's face, `GET /api/x/ui.shell/documents/[id]/focused` (`focusedWorkOf`), every focused child of the document's blocks with its title and its `synthesis` block's runs when it has one. Retiring a block that has focused work is refused (`focusedWork`) with the child named until the child is deleted or the edge closed — nothing cascades, as the deletion rule never does (user decision, 2026-09-13) — while moving it stays free; deleting the child document closes its `focuses` edge in the same `RETIRE` script, so a block never points at a document that answers nothing. Reframing is renaming the child's title, which the title already allows: no new operation. `tests/behavior/focus.test.ts` proves the write and the title rule, the one-child rule, the read-back from the block and the face with and without a synthesis, the retire refusal and the delete closing the edge.

* An operation whose partial success would leave the document malformed commits as one atomic graph mutation or not at all.
* A refused operation reports why. The model never silently drops, reorders, or omits content.
* Unknown block types remain visible as unsupported content and are never silently omitted from a read.

## Retirement And Restore

* Restore stays available for as long as the document exists. There is no expiry.
- No retention, cleanup, or purge process exists for retired blocks. They accumulate with the rest of graph history.
- Restore re-establishes containment at a valid position under a permitted parent, minting a fresh order key rather than assuming the old position is still free.
- A block leaves a document by becoming retired or by moving into another document (`moveIn`, Moving A Block Between Documents, below). A merge retires the block it absorbed, so what a structural gesture removed from the reading order stays recoverable rather than becoming unreachable.

## Deleting A Document

* Deleting a document archives its established revision. The graph keeps every revision, every relation, and every closed validity, because dropping them would rewrite history rather than reclaim space.

- A deleted document leaves the parentless listing and a read of it answers with nothing, because a node whose every revision is archived resolves to nothing.
- Its blocks are left as they stand. A block is reachable only through its document, so archiving each one would multiply the write for no readable difference.
- Recovery is real in the store and absent from the model. Nothing brings a deleted document back until a change adds an operation for it.
- Deleting is the one operation over a document that no undo covers. What that costs the reader, and the confirmation that guards it, belong to [Block Editor View](./document-panel.md).

## Clearing The Content

Under `DO_0037` (`docs/changes/DO_0037_FEAT_clear-the-content.md`), set to draft by the user on
2026-10-03: the owner empties the library in one act, on an instance that opted in, and the built-in
structures stand afterwards in the release's shape. The section is this extension's, contributed to
Settings as `instructions` contributes *Instruction tools*. What stays among the structures is
`structures`' ([Clearing The Content](../../../../structures/docs/system/system.md#clearing-the-content));
the workspace sweep is the shell's ([Workspace Record](../../../../../../docs/system/workspace/tabs.md#workspace-record)).

* Clearing the content deletes every document but those an extension keeps — the built-in
  structures — including instruction and source documents, focused work and the person's structures.
  A deleted document is a deletion as above: archived, its history kept, nothing bringing it back.
  User decisions, 2026-10-03 (`DO_0037_Q1`).
* The owner alone clears, and only on an instance that opted in; the switch is the owner's in the
  same section, off until set, kept in the kernel's state record for `settings`-scoped working state
  (`/__kernel/state/settings/<id>`), never in the graph. User decisions, 2026-10-03 (`DO_0037_Q2`,
  `DO_0037_Q3`).
* One confirmation guards it: how many documents and structures go and that nothing brings them
  back, *Cancel* and the clearing. User decision, 2026-10-03 (`DO_0037_Q4`).
* Open proposals that stage documents or blocks are rejected with the clearing; a proposal of an
  extension's code is not touched. User decision, 2026-10-03 (`DO_0037_Q6`).
* Tabs on a removed document close in every workspace, and the owner's own remembered instruction
  choices naming a removed document are set to none; another person's remembered choices are left,
  since a run refuses an instruction that is no document. User decisions, 2026-10-03 (`DO_0037_Q8`).

- [ ] DO_0037_001 The switch (`server/clearing.ts`, a record in the `settings` state collection beside
  `settings`' lock): read by anyone signed in, written by the owner alone, which the kernel enforces;
  absent reads as off.
- [ ] DO_0037_002 What would go (`GET /api/x/documents/clearing`): the switch, and while it is on the
  counts — documents, structures among them, open proposals to reject — read at head with the kept
  set every registered keeper names (`keepOnClearing(name, keeper)`, registered like
  `guardDocuments`). Refused `forbidden` unless `readSession()` answers the owner.
- [ ] DO_0037_003 The clearing (`POST /api/x/documents/clearing`, owner alone, refused
  `clearing_off` while the switch is off): every open group reaching a removed document or its
  blocks (`reachingGroups`), and every run group whose started document the listing shows, is
  rejected (`decideGroup("reject")`), a group that touches an extension's manifest or members
  skipped; then one write retires every document node not kept and closes its `focuses` edge,
  aliased as `retireBlocks` aliases, with each registered keeper's statements (`structures`'
  `DO_0037_021`, `DO_0037_022`) in the same script, past the guards, which only this path skips.
  It answers the counts it removed. A refused write leaves everything as it stood; groups already
  rejected stay rejected, and the answer says so.
- [ ] DO_0037_004 The section (`documents`' contributed `settingsSections` entry, `owner: true`):
  the switch, and while it is on the counts and *Clear the content*, which raises one message through
  `raiseMessage$` — the counts, *Nothing brings them back*, *Cancel* and a destructive *Clear* — and
  after the clearing says what went, closes the reader's tabs on removed documents (`targetGone$`)
  and sets the owner's remembered instruction choices naming one to none.
- [ ] DO_0037_005 Verified under the kernel harness (`tests/behavior/clearing.test.ts`): a second
  person refused `forbidden` on both routes; the clearing refused `clearing_off` with nothing
  changed; with the switch on, every document gone from the listing but the ten built-ins, a run's
  proposal into a removed document and a branch rejected, an extension's open group still open, a
  tab on a removed document gone from another workspace, and the counts matching what went.
- [ ] DO_0037_006 The release note: under *Added* in the repository's
  `docs/release-notes/unreleased.md`, the owner's *Clear the content* in Settings on an instance that
  opts in, and that nothing brings the content back.
- [ ] DO_0037_007 Walked by the user on the dev instance: the switch, the counts, the confirmation,
  the library empty but the built-ins, and *Structures* listing the ten in the release's shape.

## What A Document's Change Count Counts

* A change to a document is one graph data revision that touched it, counted once however many records that revision wrote.

- The document is touched by a revision of its own node, a revision of a block in its reading order, a revision of one of its retired blocks, or the creation or closure of a `CONTAINS` or `retired` relation between them.
- That single definition answers both facts: the count is how many such revisions there are, and the last change is the time of the highest one.
- A split writes two blocks in one mutation and counts once. A retirement writes no node revision at all and still counts, which is why the count is over data revisions rather than over revisions of nodes.
- Counting only the `document` node's own revisions would answer "never" for a document written all afternoon whose title never changed, which is worse than showing nothing.
- Retired blocks are part of the document's history and their revisions count. They stay recoverable for the life of the document, so they never stopped being the document's.
- This is a count and a time, not a revision browser. Nothing here lets a caller open or read back a past revision.
- Staged content is not the document's until it is accepted, so an open proposal moves neither the count nor the time. [Proposed Changes To A Document](./proposed-changes.md#proposed-changes-to-a-document) records why.

## Proposal Branches

The shell half of `BO_0250` in the document model: how every write of a tab in a branch stages, and the core operations the shell wraps (`ccgw.md` `BO_0250_001`–`BO_0250_003`; `document-panel.md`, Proposal Branches, for the controls).

* The person stays human class and stages proposal-scoped, which CCGW admits for any class (`BO_0084_009`); a branch is per document and person (`BO_0250`, Decided).

- Every editor write in a branch stages (`BO_0250_011`): the commands route reads `branch` from every command's body and runs the command inside `withBranch` (`src/server/ccgw/branch-scope.ts`, carried in the port's request scope like the request context), and `commit` in `documents.ts` — the one switch every command passes through: revise, split, merge, insert, remove, move, kind, standing, claims, relations, reasons, states, the phase — sends the statement through `stage` with the branch as its proposal instead of `write`, answering `staged: true` and the candidate's revision; the branch group `node:branch-<document>-<account>` is minted by CCGW at the first staging. Every document read route takes `?branch=` and runs inside the same scope, and `query` overlays the branch on every read that names no overlay of its own, falling back to truth while the group does not exist yet (CCGW answers `unknown_proposal`), so the tab reads the branch as the editor shows it; `promoteBlock` reads outside the scope. A run started from a tab in a branch names it as `branch` and the run route passes it to the bridge as `group` (`ui-kernel.md` `BO_0250_005`). `readDocumentProposals` names a branch group's proposer from its name — `{kind: "person", name: <account>}` — so others see *Proposal · <person>* in their colour with its items answered as any group's; `placeProposals` draws them as any proposal's. A read under a branch that has no group yet, or whose group has been accepted, reads truth (`query` retries outside the branch on `unknown_proposal` and `proposal_not_open`): the tab that just accepted its branch re-read under it and was refused before (found live 2026-09-15; `branch.test.ts`). A branch staging's rationale is prefixed `branch of <document> by <account>:`, so the group names its document and person to the kernel whatever the first command was (found live 2026-09-15).
- The core read the shell wraps (`BO_0250_012`; `server/branch.ts`): `readStanding` reads `GET /v1/proposals/<id>/standing` (`ccgw.md` `BO_0250_002`), served as `GET d/[id]/standing?branch=` → `{proposal, status, base, head, members: [{ref, kind, standing}]}`, a branch nothing has been staged into — a group the core answers 404 for, `standing` in `client.ts` reading it as `noResult` — as `status: none` with no members; `branchOf` answers `GET d/[id]/branch` for the signed-in person → `{branch, status: open | accepted | rejected | none, previous?}`, the group looked up by its name. Both routes are `documents`' own (`contributions.server.ts`). The document read with a rejected group as its overlay (`BO_0250_003`) serves what a rejected branch held, since CCGW admits a closed group on reads and refuses it on writes. The shell asks the kernel for no run over a branch.

## Relations Are Their Own Extension

Under `calliopa-bootstrap`'s `BO_0288`, promoted to ready by the user on 2026-09-23 and transferred here the same day: the predictable half of refinement — a reason-bearing relation between two blocks, declared by a person and read as a plain query — becomes `relations`, a `bundled` extension active on a fresh install. What is predictable ships and what is a model's opinion does not, and the line the split follows is refinement's own, written for staleness: *a plain query at the pin — no run, no inference, no cost*. The fixed layer's half is `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, *Relations Anchor A Block* (landed 2026-09-23) and `distribution.md` (`BO_0288_009`, `BO_0288_010`); what arrives in `calliopa-refine` is its own `system.md`.

* A relation anchors a block, not a claim. User decision, 2026-09-23.
* No claim is held: refinement and its claims are removed with what they stored (`calliopa-bootstrap`'s `BO_0324`). User decision, 2026-10-01 (`BO_0324_Q1`).
* The predictable half becomes an extension of its own rather than staying here: `documents` is the editor, and saying why one block matters to another is a capability beside it. User decision, 2026-09-23.
* `relations` is `bundled` and active on a fresh install, so relations behave the same on every install. It costs an install that never uses them nothing. User decision, 2026-09-23.
* A relation's ends are declared by a person as truth; a run only proposes one, answered where every proposal is answered. User decision, 2026-09-13, restated 2026-09-23 — and the reason this change exists, since no surface has ever offered the declaration and every relation an instance holds was proposed by a run.

- The `relations` extension exists (`BO_0288_014`, 2026-09-23): a manifest naming `documents` and `ui.shell` as dependencies, and `docs/system/system.md` naming `RL` as its change prefix. It was created by adding its manifest through `kernel commit` rather than from the Extensions section, which is a human-class write an agent cannot make; the shape is `test`'s, proven to stand without an entrypoint — `relations` renders nothing until `BO_0288_019` and `BO_0288_020` give it something to draw. The tasks that are its own moved into its docs with it and are no longer listed here: the declarations, the migration, the work operations, the depth surface, a person's path to declare, and the mark a block carries. What stays below is what this extension keeps or loses.
- Follow-on work from `BO_0288`, which completed 2026-09-23 having moved the vocabulary and given `relations` its write path. What is open below is what it did not do.
- This extension goes on drawing a run's proposed relation (`BO_0288_022`): `proposal-block.tsx` draws `relate`, `reason` and `state` items, including of vocabularies it does not own. Nothing was invented for ownership's sake, which is what this task decided.

## Sources And Citations

- Under `calliopa-bootstrap`'s `BO_0291`, promoted to draft by the user on 2026-09-23 and
  transferred here the same day, a person keeps the sources they read — papers, books, pages,
  reports — in one bibliography and cites them from a sentence. The bibliography is an extension
  of its own, `bibliography`, whose own docs hold what it does ([Bibliography](../../../../bibliography/docs/system/system.md));
  the fetch of a record is the fixed layer's ([Bibliography Service](../../../../../../docs/system/bibliography-service.md)
  in `calliopa-bootstrap`); the kernel's half is its `ui-kernel.md`, *Sources And Citations*; how a
  citation is written, drawn and read is [Block Editor View](./block-editor.md#sources-and-citations).
  The citation run is this extension's, as every run attribute is; what a source is, is the
  bibliography's.
* The extension is `bibliography`, its change prefix `BI`. A source is a document carrying the
  built-in *Source*, of any CSL type, listed under *Roles → Source* and among the documents
  (`calliopa-bootstrap`'s `BO_0308_Q11`, `BO_0313_Q1`, `BO_0313_Q3`). User decisions, 2026-09-23
  and 2026-09-30.
* It is `bundled` and active on a fresh install; it needs no credential and bills nothing. User
  decision, 2026-09-23.
* One bibliography per instance, shared by its people, so a shared document's citations resolve the
  same for everyone. User decision, 2026-09-23.
* The record is fetched by the Zotero translation server, a fixed-layer service, from a DOI, an
  ISBN, a PMID, an arXiv id or a URL. User decision, 2026-09-23.
* A source may carry its own file, in *Source*'s *File* field. User decisions, 2026-09-23 and
  2026-09-30.
* Importing a Zotero, BibTeX or RIS library is the next change, not this one. User decision,
  2026-09-23.
- What a source is — a document carrying `record: source` and *Source*, its record in CSL-JSON
  shape in the role's fields, the identifier as the identity for duplicates, who writes one — is
  the bibliography's own truth, in its `system.md`.
- A citation is a run carrying `cite` — the identity of the source document it names, under the
  key `work`, and an optional
  `locator` — whose `text` is empty, the shape `equationRef` takes and for the same reason: the
  drawn label is derived and stored nowhere. Its number is resolved in the document read, numbering
  cited sources from one in the order of their first citation over the reading order, a source
  cited twice keeping its number, retired and discarded blocks counting for nothing, a citation in an
  open proposal numbered where it would land.
- A citation names a document its document does not contain, the first such reference in this model
  (Documents And Blocks says no change had introduced one). It is a run attribute and not a
  relation, because it sits at a place in a sentence, as a link does; *cited by* is the reverse
  read, answered from the citations of every document. It is a query over runs, not a maintained
  edge (`BO_0291_023`, 2026-09-24): `server/cited-by.ts` reads every document with the text blocks
  it contains in one unbounded query and keeps the blocks in a document's reading order —
  contained, not discarded — with a run citing the source, so no `cites` relation is written and
  none can drift from the words. The bibliography's `works/[id]/cited-by` route answers it.
  Proven in `server/cited-by.test.ts` and a case of `tests/behavior/documents.test.ts` over the
  one graph: a cited sentence answered with its document and block, and none once it is retired.
- A citation stays a citation with the extension switched off: this extension draws its number
  and nothing else, as a picture stays a picture without `media`; the label in the chosen style,
  the hover and the reference list are the bibliography's and go with it.
- The citation run is part of the run primitives (`BO_0291_012`, landed 2026-09-23; `lib/runs.ts`,
  the root-mapped `ui.shell` member this extension's vocabulary imports): `cite` on the `Run` shape
  as `{work, locator?}` — an atom like mathematics and an equation reference: one character
  wide, kept by normalization although its text is empty, never joined, whole on either side of a
  split, left alone by a mark or a link applied across it, removed whole by a range edit, and part
  of what two run lists mean, locator included. `readRuns` — and so `validateText` — refuses a
  citation that is not an object or names no work, a locator that is not words, a foreign key on
  the citation, a citation that is also mathematics or a reference, and one carrying text of its
  own. Proven in `lib/runs.test.ts`, *citations*, and `server/citation-number.test.ts`.
- Numbering is resolved in the document read (`BO_0291_013`, landed 2026-09-23; `assemble.ts`,
  `numberCitations`): the sources the reading order cites are numbered from one in the order of
  their first citation, a source cited twice keeping its number, a discarded block's citation taking
  none and consuming none, a retired block never reaching the view, and every view answering
  `DocumentView.citationNumbers` — by the source's identity, as `equationNumbers` is by the
  equation's — rather than deriving its own. A citation names a document the citing document does
  not contain, so `loadDocument` (`documents.ts`, `citedWorksAt`) reads the cited identities at
  the pin in one rooted, label-free match, made only when something is cited, and keeps those that
  are a `document` carrying `record: source` (`vocabulary.ts`, `SOURCE_RECORD`); a cited identity
  not found there — deleted, never there, or no source — stands in `DocumentView.missingWorks`,
  takes no number and consumes none, so a view draws it as missing rather than with a stale
  number. Proven in `server/citation-number.test.ts`.
- Accepting a proposed sentence accepts the sources it cites that its own group proposes, first
  (`BO_0291_036`, 2026-09-24, user decision; `server/proposed-works.ts` `proposedWorksCited`, in
  `answerDocumentProposal`): a run that cites a source it found proposes the source document into
  the same group as the sentence, and it is not a block of the citing document, so it never stood
  among that document's proposals to answer — found on the instance when an accepted sentence
  cited a work still a proposal and drew *[source gone]*. Each source is accepted whole, member by
  member: the document, then the paragraph it `CONTAINS` and the `roleFields` whose `fieldsOf`
  reaches it, read from the group's staged relations, their relations travelling with them. A
  source another group proposes is that group's to answer, and rejecting a sentence leaves its
  sources proposed. Proven in `server/proposed-works.test.ts`.
- `server/proposed-works.test.ts` imports nothing from `structures` (`DO_0035_001`, landed
  2026-10-03): the `roleFields` fixture's `role` is a value of the test's own, since
  `proposedWorksCited` never reads it. `documents` ships while an owner switches `structures` off,
  so none of its files, a test included, imports from it; the release's absence check refused
  `0.5.1` at pin 4440 on that import (`TS2307`). Verified (`DO_0035_002`): the test passes, and
  `kernel toolchain absence` on a head checkout carrying the fix builds every combination of
  switched-off extensions.
- A document may name its own citation style (`BO_0291_037`, landed 2026-09-24): `document`
  permits `citationStyle`, one of the bibliography's shipped styles' ids, absent meaning the
  instance's default — a widening staged as a member revision through `kernel commit --members`,
  whose permitted set is the one list of ids `documents` holds, so the declaration refuses an id
  no release ships. `setCitationStyle` (`documents.ts`, the commands route) writes the id, or null
  to follow the default again, against the document's base, a stale base answering `conflict`.
  The read answers the choice as `citationStyle`, asks the citation resolver in it, and carries
  the resolver's `CitationStyles` as `citationStyles` when the document cites anything. Proven in
  `server/document-head.test.ts` and a case of `tests/behavior/documents.test.ts` over the one
  graph: set, read back, a stale base and an unshipped id refused, cleared.
- The `bibliography` extension holds sources (`BO_0291_014`, `BO_0313`): its tasks and truth are
  its own `system.md`. What this extension keeps is the citation run, its numbering and the
  editor's half ([Block Editor View](./block-editor.md#sources-and-citations),
  `BO_0291_024`–`BO_0291_028`).
- A citation names a source document (`calliopa-bootstrap`'s `BO_0313_030`, landed 2026-10-01):
  the `cite` run keeps `{work, locator?}`, `work` naming a document carrying `record: source`, so
  no stored run and no run schema changes; `documentsCiting` and the read's numbering are
  unchanged. The cite card's *Open source* opens it as `documents:document`. The Documents
  listing keeps source documents, since they are listed there too (`BO_0313_Q3`); only profiles
  stay left out, as `listDocuments` already did.

## Out Of Scope

- The workspace view host and the rendered editor.
- Story, scene, and other document kinds.
- Referencing one block from several documents.
- Retention, expiry, or cleanup of retired blocks.
- Comments, annotations, AI commands, and multiplayer editing.
- Binary bytes in the graph's rows. Media blocks reference blobs through CCGW's blob routes when a later change introduces them.

## Implementation

- Admonition patterns are graph-backed named records with a color, an optional top-level blob reference in `image`, and an optional footline. The documents blob route uploads image bytes through CCGW to Garage immediately before the pattern write, so the reference keeps the bytes for pinned graph history. An admonition block references a pattern and owns ordered text child blocks. Pattern identities can be referenced from any document, and editing a pattern updates every callout that refers to it. Previously stored external image URLs remain readable until replaced or removed (`CA_0070_006`).
- An admonition child merge writes the surviving child's combined runs, closes the absorbed child's `contains` relation and retires that child from the document in one graph write. The surviving child's identity and sibling order remain; assertions on the absorbed child move to the survivor as they do in a top-level text merge.
- The graph declaration names the reusable pattern type `admonition_pattern`, while each pattern record keeps its user-facing label in `name`. The `admonition` container declaration permits ordered `text` children; both declarations travel as documents members (`CA_0070_001`, `BO_0302_001`).
- `turnIntoAdmonition` replaces a text block with a callout at the same sibling order, preserving its runs and role as the first ordered text child; it validates the chosen saved pattern before writing. `setAdmonitionPattern` changes the reference on an existing callout (`CA_0071_002`).

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
- The changes read finds the document by id and type only, never by its revision's status: a metadata-only read with history answers a document that gained carry-forward revisions from accepted groups with an archived revision as its current one, and the strict established check turned every such document's changes into a 404 (found in the `BO_0245` walk-through, 2026-09-14).
- `GET /api/x/ui.shell/documents/[id]/changes` carries it. It is its own read rather than a field on the document, so the panel refreshes a count after a save without paying to read every block again (`CA_0015_002`).
- `tests/behavior/documents.test.ts` proves both over the one graph (`BO_0207_012`); before it `tests/integration/block-documents.test.ts` proved them against real Postgres: deleting leaving the listing and the read while its history stays, a stale base conflicting, an unknown or already deleted document refused, one document's deletion leaving another untouched, and the count rising by one for a typed save, by one for a split that writes two blocks, and by one for a retirement that writes no node revision, with a retired block's own revisions still counted (`CA_0015_002`, `CA_0015_003`).
- The `text` declaration permits the optional `disposition` with its four values, revised through `kernel commit --members` as `BO_0222_004` revised `document`, so Validation refuses a fifth at the write — where the retired artifact editor's graph stored `disposition: "banana"` (`BO_0138`). `setBlockDisposition` in `documents.ts` writes `SET b.disposition = $disposition` with the caller's base compared first, a null clearing it; the command API's `setDisposition` names the standing, neutral included, so a body that forgot it is refused rather than read as clearing one. A split copies the disposition to its tail as it copies the role, a revise writes runs and role by property and leaves it standing, and a merge keeps the surviving block's own. A disposition written is one change to the document, as any revision is. `assemble.ts` reads it onto `TextBlockView` as `standing`, anything not on the scale reading as neutral. Proven over the one graph in `tests/behavior/documents.test.ts` (`BO_0227_010`).

## Starting A Document From A Command

- Under `BO_0251`, transferred 2026-09-16, a run can start a document: its node, first block and containment are candidates in the run's own group (`ui-kernel.md` `BO_0251_003`), and the reader opens and answers it before any of it is truth. The composer's and the tab's half is `ui.shell`'s `commands-and-runs.md` `BO_0251_006`, `BO_0251_007`, `BO_0251_013`.
* A started document is the run's proposal until a person takes it, and it stays findable until then. User decision, 2026-09-16.
- A started document reads as its run's proposal (`BO_0251_008`, landed 2026-09-16). When the truth read finds no document, `readDocument` asks `readStarted` in `src/extensions/documents/server/documents.ts`: one rooted read of the document node with `INCLUDE CANDIDATES, HISTORY`, outside any branch, answering the node when its current revision is a candidate and its history holds no revision but that one (`startedNode`) — a run's `CREATE`. It answers `{documentId, revisionId, title, blocks: [], proposed: {group, proposer}}`, the group from the candidate's `_proposal`, the proposer from the group's members as the proposals read names one (`groupProposer`, `proposerFrom`: the run's `agent.run` node, else the stamps, a branch's person). The blocks stay empty: each is an insert of that group, which the proposals read answers — `readDocumentProposals` takes the started view in place of the truth read, so every staged containment from the document node is an `insert` — and drawing them from the document too would draw them twice. A document id that is neither truth nor started answers `noResult`, and so does a rejected group's document, whose candidate is no longer one. **Started means created by the candidate**: a deleted document can still carry an open group's candidate — the carry-forward anchor a proposal against it hung on — which has the document's history behind it; found when the behaviour suite's delete read back as started, and why `startedNode` asks for the history. `StartedBy` (`src/extensions/documents/server/assemble.ts`) types `proposed`.
- The listing answers the documents runs started and nobody has taken (`BO_0251_011`): `listDocuments` reads, beside the established documents and the contained ones, every `document` with candidates in one unbounded read; the candidates not among the established, not contained, are checked in one rooted, metadata-only `INCLUDE CANDIDATES, HISTORY` read over those few alone (`startedNode`), and their proposers come from one unbounded read of `agent.run` nodes with candidates, matched by `_proposal` — never a read per open group, and no extra read when nothing is started. Each started entry carries `proposed: {group, proposer}` and sorts among the rest by title (`ListedDocument`, `ListedDocumentEntry` in `lib/library-item.ts`); `GET /api/x/ui.shell/documents` carries it. The Documents section's reader maps each entry through `documentItem` (`lib/library-item.ts`, `contributions.server.ts`), which gives a started one `proposedBy: {agent, name}` — the runtime for the face, null for a person, and `proposerName`'s words — for the frame's row (`ui.shell` `layout.md` `BO_0251_012`). Proven in `tests/behavior/documents.test.ts` over the kernel harness (a started document listed with its group and proposer, an established one with nothing proposed, a taken one no longer proposed, a rejected one gone) and `lib/library-item.test.ts` (an ordinary item unchanged, an agent's and a person's proposer).

- The `text` declaration's `disposition` permits `fixate`, `discarded` and `prompt` (`BO_0272_011`, 2026-09-21), revised through `kernel commit --members` as `BO_0227_010` set the five; the kernel's fixture `serve/testdata/documents-vocabulary.json` mirrors it. The group carries an `ext.migration` Block naming `text` in `migrates` with its rationale, since narrowing a permitted set is a breaking class (`calliopa-bootstrap`'s `validation.md`, `extension-model.md`). No content operation travelled with it: this instance carried no block with any disposition when the declaration was revised — 90 text blocks, checked over CCGW on 2026-09-21 — and an instance that does carry one reads it as what it became (`RETIRED` in `lib/disposition.ts`, `StandingOf` in the kernel) until the next write stores the new value. `setBlockDisposition` and the command API's `setDisposition` take the three and keep, which clears the property.


## Pictures And Moving Pictures

- Under `calliopa-bootstrap`'s `BO_0273`, promoted to ready by the user on 2026-09-21 and
  transferred here the same day, a document can hold a picture and a moving picture. Generation is
  the `media` extension's and the service behind it is the fixed layer's
  (`calliopa-bootstrap`'s `docs/system/media-service.md`); the block, its vocabulary and its
  presentation are this extension's, so a picture stays a picture when the generator is switched
  off.
* The block types belong to `documents`, not to the extension that makes their content. An
  uploaded, pasted, dropped or generated picture is the same block, and a block type owned by a
  generator would become unsupported content in every document the moment its owner switched the
  generator off.
  User decision, 2026-09-21.
- The two types are declared (`BO_0273_008`). `image` and `video` are `ext.blocktype` members of
  this extension, staged through `kernel commit --members` as the work vocabulary was
  (`BO_0244_006`): each requires `id` and `order` and permits `reference`, `alt`, `width`, `height`
  and `source`; `image` additionally permits a string `caption`, link-capable `captionRuns` and
  `numbered`. `document` permits both types as children beside `text` and `divider` — a widening,
  which is an ordinary change. Two types rather than one, because an image and a video differ in
  how they are drawn and separate names keep these types apart from the `media` extension that
  makes their content.
- `reference` is the core's blob reference, an object bearing `_kind: "blob"` at a top-level
  content property, which is what makes it a live reference (`calliopa-bootstrap`'s
  `docs/system/binary-content.md`). It is the sole identity and integrity carrier; `mediaType`,
  `size`, `alt`, `width` and `height` are advisory. Its absence means the block is pending: an
  image may be awaiting a person's upload or a generator, and a video may be awaiting a generator.
- Image blocks optionally carry `captionRuns` (`DO_0019_001`): text runs that may keep links but have
  no formatting marks. Turning a text block into Image writes those runs at the image's existing
  order and retires the text block; turning the image into a text role restores the runs and retires
  the image. Older string captions also become plain text runs when turned into text. The image
  declaration, image validator, document read and `setFigure` write carry this field.

## Code And Its Output

- Under `calliopa-bootstrap`'s `BO_0289`, promoted to ready by the user on 2026-09-23 and
  transferred here the same day, a document holds code and what running it produced. The
  running is the `code` extension's (its `docs/system/system.md`) and the runtimes and sessions
  behind it are the fixed layer's (`calliopa-bootstrap`'s `docs/system/code-service.md`); the two
  block types, their vocabulary and their presentation are this extension's, as `image`, `video`
  and `table` are and for the same reason: a code block and its output stay readable when the
  extension that runs code is switched off. User decision, 2026-09-23, keeping the rule of
  2026-09-21.
* A code block's `source` is the code itself, as text, and its `language` a word; both are the
  block's own content, revised whole like a table's. User decision, 2026-09-23.
* An `output` block is what one execution produced and only an execution writes one: the kernel
  stages it, as whoever sent the code, directly after the code block, and this extension reads
  it and never writes it. Every output is a proposal. User decision, 2026-09-23.
- The two types are declared (`BO_0289_018`): `sourcecode` and `output` are `ext.blocktype`
  members of this extension, staged through `kernel commit --members` as the table was. The kind
  is `sourcecode` rather than `code` because a declaration and a manifest share the `node:<id>`
  namespace and `code` names the extension that runs it: the first landing wrote the manifest
  over the type and left the manifest a stray `partOf` edge, closed with the rename (user
  decision, 2026-09-23). `sourcecode` requires
  `id`, `order` and `source` and permits `language`; `output` requires `id`, `order`, `items`,
  `outcome`, `execution` and `of` and permits `pictures`, `files`, `executionCount` and `elapsed`;
  `document` permits both as children and gained `runtime`, the id of the runtime the document is
  connected to, written by the kernel as the person's own edit. `outcome` rather than `status`,
  because CCGW reads a `status` key as the revision's lifecycle.
- What an output stores: `items` in order — `{kind: stream, name, text}`, `{kind: error, name,
  value, traceback}`, `{kind: display | result, data, executionCount}` where `data` is the MIME
  bundle and a picture entry is `{picture: <index>}`, `{kind: cut, reason}`, `{kind: clear}` —
  `pictures` and `files`, each the core's blob reference with its filename, hoisted to top-level
  arrays so the core recognizes them as live references (`binary-content.md`, positional
  recognition), `outcome` (`ok`, `error`, `interrupted`, `timed out`, `output cap`), `elapsed`,
  `executionCount`, the service's `execution` id and `of`, the code block's id. HTML in a bundle
  is kept as text.
- On a device (`calliopa-bootstrap`'s `BO_0319_046`), `sourcecode` also permits `permissions`, the
  block's grant — `{attachments, hosts}`, whether it reads the document's material and the hosts it
  may fetch from, written by the kernel as the person's own edit (`code`'s system topic) — and
  `output` permits `network` (`none`, or `hosts`), `reproducible` and `fetches` (each `{url,
  status, sha256, bytes}`), what the network gave the execution, written by the kernel only when
  the code service said so; a runtime's execution carries none. The assembler reads them as
  `network`, `reproducible` and `fetched`, the addresses, and an output that is not reproducible
  draws *Not reproducible: it read <addresses>* beside how it ended (`views/output-block.tsx`).
  Verified 2026-10-03 by `views/output-block.test.ts` (the mark with what was read; none on a
  runtime's output or a reproducible one).
- A code block is written like any other (`server/documents.ts`): `NewCodeBlock` joins
  `NewBlock`, `blockContentFor` writes `source` and, when it is not empty, `language`, and
  `reviseCode` sets both on the block's base revision, an empty language clearing it; `validateCode`
  and `validateOutput` (`server/vocabulary.ts`) say in the shell's words what each carries, and the
  API refuses an `output` on an insert — *send the code instead of writing its output* — as the
  kernel's document tools refuse a run's. The assembler (`server/assemble.ts`) answers
  `CodeBlockView` and `OutputBlockView`: the items with their text, each picture and file as the
  object the blob route takes with its name, type and size, never a reference; an output without
  items is reported as unsupported rather than dropped. Proven in `server/code-content.test.ts`.
- A text block turns into code in its place (`turnIntoCode`, `BO_0289_021`): a code block whose
  source is the block's words takes the text block's order key and the text block is retired, in
  one statement, because a block type is a node's label and cannot change; the new block's id is
  answered and the retired block can be restored. Only a text block turns; another kind is
  refused by name.
- How they are drawn is [Block Editor View](./block-editor.md#code-and-its-output).

Under `calliopa-bootstrap`'s `BO_0296` (code blocks formatted and highlighted), promoted to draft
by the user on 2026-09-23 and transferred here the same day, a code block is coloured by the read
and pretty-printed when an edit of it settles. The service that formats is the fixed layer's
(`calliopa-bootstrap`'s `docs/system/code-service.md`, *Formatting*), reached through one kernel
route; everything a person sees is this extension's.

* A settled edit is formatted, and what cannot be formatted — a fragment that does not parse, a
  language no formatter knows — is written exactly as typed, silently. User decision, 2026-09-23.
* An accepted proposal's code is formatted too, so a document holds no unformatted code that
  arrived from a run. User decision, 2026-09-23.
* Formatting is switched off per document, never per block. User decision, 2026-09-23.
* A code block created without a language has one guessed, once, as a suggestion a person can
  change; it is never guessed again. User decision, 2026-09-23.

- **Acceptance formats in a revision of its own.** What was proposed stays what was proposed: the
  acceptance records the staged revision unchanged and the formatted text lands as the next
  revision, authored by whoever accepted, so *accepted* keeps meaning *this text, agreed*. The rule
  is stated in `calliopa-bootstrap`'s `ui-kernel.md`, *Code Is Formatted And Highlighted*, and
  carried out here, since `answerDocumentProposal` is this extension's.
- `document` permits `formatCode` (`BO_0296_013`, 2026-09-25): a flag, on unless stored `false`, declared as a member revision through `kernel commit --members` as `runtime` was, with the kernel harness's fixture `serve/testdata/documents-vocabulary.json` mirroring it (`calliopa-bootstrap`'s `BO_0296`). `validateDocument` in `vocabulary.ts` refuses anything but a boolean in this extension's words. `setFormatCode` in `documents.ts` writes it on the document's base as the citation style is written — `false` to switch off, `null` to switch on, which clears the property so the default holds again — reached by the command API's `setFormatCode` (`baseRevisionId`, `on`) as a person's own edit; `DocumentView` carries `formatCode?` as stored and `formatsCode` reads absent as on. Nothing about it reaches the run schema or the document tools.
- The read colours a code block (`BO_0296_014`, 2026-09-25, `server/assemble.ts`): `CodeBlockView` carries `markup`, set as the assembler sets an equation's from the block's `language` through `lib/highlight.ts` — HTML holding only `<span class="hljs-…">` elements and escaped text, so the text inside is the source character for character, which the writing view's overlay depends on. A block with no language, a language the engine does not know and a source it refuses answer no markup at all, and the view draws the plain characters. Proven in `server/code-content.test.ts`: a Python block coloured with its text intact, an unknown language and an unnamed block answered plain, and a block whose source is not valid in its language coloured as far as the grammar reaches, never refused.
- `reviseCode` formats before it writes (`BO_0296_015`, 2026-09-25, `server/documents.ts`, `server/format.ts`): with the document's `formatCode` on, the source goes to `POST /__kernel/code/format` with its language, waiting twelve seconds at most, and the answer is what the revision carries; an answer of *unchanged*, a refusal, a timeout, an answer that is not what was promised and an unreachable kernel each write the source exactly as typed, so a settled edit is never lost to a service being down, and nothing is said to the person. A block with no language, and an empty source, call nothing; with `formatCode` off, nothing is called. Proven in `server/format.test.ts` against a stub of the route for each of those outcomes.
- Acceptance formats (`BO_0296_016`, 2026-09-25, `server/documents.ts`, `formatAccepted` after the members are decided in `answerDocumentProposal`): accepting an item that carries a `sourcecode` block with a language, in a document whose `formatCode` is on, records the acceptance as it does today and then writes one further revision of that block carrying the formatted source, authored by the accepter, so the history shows the acceptance and the format as two revisions; the staged revision is never rewritten. A block whose formatted source equals what was proposed writes no second revision, and a document with the switch off accepts code as it came. A failure of that second write leaves the accepted text standing unformatted and is not the acceptance's to report. It is proven on the served build by the walk (`BO_0296_022`), since the acceptance path runs over the one graph.
- This change's document stands as a member of this extension, `docs/changes/BO_0296_FEAT_code-blocks-formatted-and-highlighted.md`, at the status it holds in `calliopa-bootstrap`, and takes every status it takes there afterwards (`AGENTS.md`, The Docs In The Graph).
- A language is guessed once where a block is created (`BO_0296_017`, 2026-09-25, `codeContent` in `documents.ts`, which `NewCodeBlock` and `turnIntoCode` both store through): a block created with no language gets `guessLanguage`'s answer written into `language` as an ordinary value a person can change, and nothing re-guesses it afterwards — `reviseCode` writes the language as sent, so a block a person empties the language of stays empty and draws plain. The guess is the engine's ranking over thirteen languages, taken only when the winner scores at least two hits — what one pasted line of Python scores, which is what *Turn into → Code* most often gets (walk finding, 2026-09-25) — and the source carries that language's own shape, since the engine's count alone ties a Python program with C++ and reads a Markdown paragraph as shell; a guess the engine will not make leaves the field empty. Proven in `lib/highlight.test.ts` and `server/code-content.test.ts`: Python from one line and from a program, Go, shell, JSON and SQL named, prose and `x = 1` left empty, a word given kept as given.

Under `calliopa-bootstrap`'s `BO_0302` (code blocks carry line numbers), promoted to draft by the
user on 2026-09-25 and transferred here the same day, a code block shows a number beside each of
its lines, switched per document, and a block may continue its numbering from the code block
before it. The drawing is [Block Editor](./block-editor.md#code-and-its-output); what the
document and the block store, and what the read resolves, is here. The rules the kernel states —
the switch is a property of the document's root, the continuation a property of the block, and
nothing of either reaches a run — are `calliopa-bootstrap`'s `ui-kernel.md`, *Code Lines Are
Numbered*.

* Whether line numbers are shown is switched per document; there is no per-block flag for it.
  A document that has never touched the switch shows its numbers. User decisions, 2026-09-25.
* A code block has an option to continue its numbering from the previous code block: with it
  set, its first line takes the number after the previous code block's last. User decision,
  2026-09-25.
* Nothing about the switch reaches the run schema or the document tools, as nothing about
  `formatCode` does; no tool sets it and no run is told it. User decision, 2026-09-25.

- `document` permits `lineNumbers` (`BO_0302_003`, 2026-09-25): a flag, on unless stored `false`, declared as a member revision through `kernel commit --members` as `formatCode` was, with the kernel harness's fixture `serve/testdata/documents-vocabulary.json` mirroring it (`calliopa-bootstrap`'s `BO_0302_001`). `validateDocument` in `vocabulary.ts` refuses anything but a boolean in this extension's words. `setLineNumbers` in `documents.ts` writes it on the document's base as `setFormatCode` does — `false` to switch off, `null` to switch on, which clears the property so the default holds again — reached by the command API's `setLineNumbers` (`baseRevisionId`, `on`) as a person's own edit; `DocumentView` carries `lineNumbers?` as stored and `showsLineNumbers` reads absent as on. Nothing about it reaches the run schema or the document tools. Staging found the `document` declaration at head 2748 without `formatCode` — `BO_0296_013`'s member revision had not landed — so the same members revision restores it beside `lineNumbers`. Proven in `server/vocabulary.test.ts` and `server/code-content.test.ts` beside `formatCode`'s cases, and in `views/bar.test.ts` for the write the toggle sends.
- `sourcecode` permits `continues` (`BO_0302_004`, 2026-09-25): a boolean absent by default, declared as a member revision of the block type beside `source` and `language`, with the kernel harness's fixture mirroring it; `validateCode` in `vocabulary.ts` refuses anything but a boolean. `setCodeContinues` in `documents.ts` writes it on the block's base as the reader's own edit — `true` to set, `null` to clear — a write of its own reached by the command API's `setCodeContinues` (`blockId`, `baseRevisionId`, `continues`), never a `reviseCode`, so a settled edit of the source stays the one whole-block revision it is and `data-code-sending` keeps gating the send; `reviseCode` sets `source` and `language` alone, so the flag stands through a revise of the source. `NewCodeBlock` and `turnIntoCode` store no flag, and no document tool carries it: a run's proposed code block does not continue. `CodeBlockView` carries `continues?` as stored. Proven in `server/code-content.test.ts`: the flag read from a stored block, absent when not stored, and the refusal of a non-boolean; the write on the served build is the walk's (`BO_0302_009`).
- The read resolves every code block's first line (`BO_0302_005`, 2026-09-25, `server/assemble.ts`, `numberCodeLines` after the figures are numbered): `CodeBlockView` carries `firstLine`, counted in reading order over the established code blocks — a block that does not continue starts at one; a block that continues starts after the last line of the nearest code block above it, whatever stands between them and whatever its language; a chain of continuing blocks counts on; a continuing block with no code block above it starts at one — so removing or moving a block re-resolves the ones below on the next read and nothing is stored but the flag; the rule is `resolveFirstLines` in `lib/code-lines.ts`, which the editor runs too over what is being typed ([Block Editor](./block-editor.md#code-and-its-output)). A line is a run of characters ended by a newline or the end of the source, a final newline ending the last line rather than starting another (`lib/code-lines.ts`, `lineCount`), so a formatted block counts the lines a reader sees. A proposed code block's `firstLine` is taken from the reading it would join (`placeCodeLines` in the proposals read): the nearest established code block whose order sorts before its own. `DocumentView` carries `lineNumbers` beside `formatCode`. Proven in `server/code-content.test.ts` and `lib/code-lines.test.ts`: three blocks with the middle one continuing, a chain, a continuing first block, a block continuing across another language, a removed block re-numbering the one below, and a proposed block placed above, between and below numbered ones.
- This change's document stands as a member of this extension, `docs/changes/BO_0302_FEAT_code-blocks-carry-line-numbers.md`, at the status it holds in `calliopa-bootstrap`, and takes every status it takes there afterwards (`AGENTS.md`, The Docs In The Graph).
  generation proposed and not yet paid for is one of these blocks without that property — and that
  is the whole of it: no second type and no state machine.
- `width` and `height` are the block's own, written when the bytes are uploaded, because the blob
  reference deliberately carries no dimensions and a block that wants its layout reserved before
  the bytes arrive has to store them itself.
- `source` is one object this model stores and never interprets, keyed by the extension that wrote
  it: a generator records its prompt, service, model, job id, cost and time there and draws them
  itself through a `below` decoration. Nothing here reads it.
- How these two are drawn, the pending state included, is [Block Editor View](./block-editor.md#pictures-and-moving-pictures).
- A media block is written like any other (`BO_0273_017`): `NewMediaBlock` joins `NewBlock`, so
  `insertBlock`, the editor's `Add image` command and the document's first block take one, and
  `blockContentFor` writes `reference`,
  `alt`, `width`, `height` and `source` — every one optional, because a block with no reference is
  pending and nothing has to be written to say so. Empty words are left out, as an absent role is.
  Creating one is this extension's, since the type is; the `media` extension makes generated bytes,
  and a person's upload supplies uploaded bytes through CCGW.
  Proven in `server/media-content.test.ts`, each behaviour shown to fail with the media branch
  removed.
- A pending media block is filled rather than replaced (`BO_0273_017`, `DO_0018_001`).
  `fillMediaBlock` sets the reference, box and `source` on the block already standing, keeping its
  identity and place — so an upload or generation fills the reader's existing block rather than a
  second one appearing beside it. An absent dimension clears the property, as an absent role does; a block
  that is not a media block is refused, since the reference would be inert data on a type that
  does not recognize it. Proven in `tests/behavior/documents.test.ts`, over the one graph through
  the kernel harness, with the harness fixture's vocabulary carrying the two types.

## Tables

- Under `calliopa-bootstrap`'s `BO_0287`, promoted to draft by the user on 2026-09-23 and
  transferred here the same day, a document holds a table: one block of typed columns and rows,
  edited cell by cell, read and proposed by a run as the one unit it is, with a file's bytes
  standing behind it when the data is more than a block should carry. The kernel's half — the
  document tools' content shape and the harness's copy of the vocabulary — is `calliopa-bootstrap`'s
  `docs/system/ui-kernel.md`, *Tables In Documents*; how a table is drawn, pasted and imported is
  [Block Editor View](./block-editor.md#tables). The type is this extension's, as `image` and
  `video` are and for the same reason: a table stays a table whatever later makes or charts one.
* Columns are typed from the first slice: `text`, `number`, `date` and `boolean`. A cell is a
  string in its type's canonical spelling or empty — a number a decimal in canonical form, a date
  ISO 8601, a boolean `true` or `false` — so a run and the validator agree on one spelling. User
  decision, 2026-09-23.
* The inline rows behind a file are its first 100, all columns; a file under the bound is held
  whole and needs no reference. User decision, 2026-09-23.
* A run's replace of a table that a file stands behind drops the reference: the cells it proposes
  are the whole table it read. User decision, 2026-09-23.
- Rows are not blocks. A table is one block revised whole, so a cell edit keeps the block's
  identity and its place, a proposal to change a table is a replace of the one block, and no
  container type is needed (`CA_0007_010` stays open).
- The content shape: `columns` a list of `{name, type}`; `rows` a list of rows, each one cell per
  column; `caption` optional words; `reference` the core's blob reference to the file's bytes when
  one stands behind the block; `rowCount` the file's row count, written at import and present only
  with `reference`; and `source` the uninterpreted object keyed by its writer, where an import
  records the file's name and time. A cell is validated against its column's type by this
  extension's content validator before the write and by the kernel tool before the stage, since
  CCGW's Validation checks properties, not their insides.
- The same rule holds for a person as for a run: a cell edit, a row or a column added or removed on
  a table that a file stands behind drops the reference and `rowCount`, since the rows no longer
  are the file's first 100; a caption or a column's type changed keeps them, since no cell changed.
  Technical decision under the user's rule for a run's replace, open to their revision.
- The `table` type is declared (`BO_0287_007`, 2026-09-23): an `ext.blocktype` member of this extension staged through `kernel commit --members` as `image` was (`BO_0273_008`), requiring `id` and `order` and permitting `columns`, `rows`, `caption`, `reference`, `rowCount` and `source`, its semantics naming the content shape above; and `document` permits it as a child beside `text`, `divider`, `image` and `video` — a widening. The kernel harness's fixture carries the same declaration (`calliopa-bootstrap`'s `BO_0287_001`).
- A table is written and read like any block (`BO_0287_008`, landed 2026-09-23). `lib/table.ts` is the shape the editor, the parser and the server share, as `lib/runs.ts` is for text: the four column types, `checkCell` and `checkTable` — which name the cell and its column, and say where it is so an editor can ring it — and `readColumns` and `readRows`. `NewTableBlock` joins `NewBlock`, so `insertBlock` and a document's first block take one; `blockContentFor` writes its columns, rows, caption, reference, `rowCount` — only beside the reference — and `source`, leaving absent ones out; `vocabulary.ts`'s `validateTable` refuses runs on a table, a misfit cell, a reference that is not the core's and a count without a file, and the commands route's `readTableBlock` reads a new table the same way. `assemble.ts` answers a `TableBlockView` — the cells, the caption, `file` with the object id and the row count when the reference is one, and `source` — and a stored table it cannot read as one as unsupported content. Proven in `server/table-content.test.ts` and `lib/table-parse.test.ts` and, over the one graph through the kernel harness's widened fixture, in `tests/behavior/documents.test.ts`.
- A cell edit is a whole-block revise (`BO_0287_009`, landed 2026-09-23): `reviseTable` in `documents.ts`, the command `{command: "reviseTable", blockId, baseRevisionId, columns, rows, caption?}` on the commands route, compares the base first as `reviseTextBlock` does, refuses a block that is not a table and a misfit naming the cell and its column, keeps the block's identity and its place, and drops or keeps `reference` and `rowCount` by the rule above — kept when every cell is as it was, so a caption or a column's type changed keeps the file. Proven in `tests/behavior/documents.test.ts`: a table written whole with a real object behind it, read as cells with the file's count, a misfit refused by name, the caption changed with the file kept, a row added with the file gone, a stale base a conflict, and a text block refused.
- The parser is this extension's and pure (`BO_0287_010`, landed 2026-09-23): `lib/table-parse.ts` reads `.csv` (RFC 4180 quoting — a quoted comma, a quoted line break, a doubled quote — and a byte-order mark dropped) and `.tsv`, the file's name saying what it may be (`delimiterFor`) and the header line saying what separates the cells (`sniffDelimiter`: a comma, a semicolon — which a German spreadsheet writes a `.csv` with — or a tab, whichever the header holds most outside quotes, the name deciding a tie; found in the walk, when a semicolon file landed in one column), and a pasted grid as tab-separated lines (`parsePastedGrid`; text is a grid when it holds a tab and a line break, `looksLikeGrid`). The first line is the header, an unnamed column is named from its place, a short row is padded and a long one cut. Each column's type is inferred from its values (`inferColumn`) — every non-empty cell a number as a spreadsheet writes one (`1,5`, `+3`, `007`) makes a number column written canonically, an ISO 8601 date a date column, `true`/`false` or `yes`/`no` a boolean column, else text kept as it was, and a national date spelling is never guessed at — and a file past 100 rows is cut to its first 100 with the total as `rowCount`. Unit-tested over fixtures in `lib/table-parse.test.ts`: the quoting, an empty column, a mixed column falling back to text, a header-only file, the bound, and what is not a grid.

## Mathematics

- Under `calliopa-bootstrap`'s `BO_0290`, promoted to draft by the user on 2026-09-23 and
  transferred here the same day, a document holds mathematics: an equation as a block of its own,
  mathematics inside a sentence as a run, and a run that refers to a numbered equation by its
  number. The kernel's half — the document tools' content shape and the harness's copy of the
  vocabulary — is `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, *Math In Documents*; how
  mathematics is drawn, edited and authored is [Block Editor View](./block-editor.md#mathematics).
  The type is this extension's, as `image`, `video` and `table` are and for the same reason: an
  equation stays an equation whatever renders it.
* An equation stores its TeX and nothing else. The typeset SVG is never stored: it is produced
  where the equation is drawn, from the one source. User decision, 2026-09-23.
* A display equation carries an optional caption, and it can be numbered. User decision,
  2026-09-23.
* An equation is numbered only when its author asks for it; the numbers run in document order over
  the numbered equations alone — TeX's own split between `equation` and `equation*` — so a note
  holding one incidental formula carries no stray number. User decision, 2026-09-23.
* A sentence can refer to a numbered equation: the reference draws that equation's current number
  and follows it when the numbering shifts. User decision, 2026-09-23.
- The content shape: `tex` the exact authored TeX; `caption` optional words; `numbered` the
  author's ask, absent meaning no number, as an absent role means paragraph; and `source` the
  uninterpreted object keyed by its writer. TeX is the one notation, so there is no `syntax`
  property — a second notation is a widening when something needs one.
- `tex` is a plain string property and deliberately not a run property. Runs canonicalize — adjacent
  identical runs merge and empty runs drop — and a mark over source syntax would mean nothing, so
  exact source is stored as text. `BO_0185`'s shape enforcement keys on declared run properties, so
  `tex` receives none and the renderer owns its tolerance for a value that is not a string, as
  `BO_0163` recorded for the same property on the retired shell.
- **A number is derived, never stored.** The document read numbers the `numbered` equations in
  reading order, so inserting, retiring or restoring an equation renumbers the rest by itself:
  there is no renumbering write, no migration, and no stale number anywhere. This is the same rule
  the user's first decision takes for the typeset output — what can be derived from the source is
  not stored beside it.
- Retired and discarded equations carry no number and consume none, since they are not in the order
  a reader reads. An equation inside an open proposal is numbered as it would be were the proposal
  accepted, so the reader sees what they would be accepting.
- Inline mathematics is a run carrying `math: true` whose `text` is the exact TeX. The source lives
  in `text` because the core refuses a run carrying no `text` string (`BO_0185_001`), so the shape
  `link` takes — words beside an attribute — carries nothing that has no words of its own; and a
  plain-text reading of the runs is then the source rather than a blank.
- A reference is a run carrying `equationRef`, the identity of the equation it names, and its
  `text` is empty. Storing the number in `text` as a fallback was rejected: it would be the one
  stale copy of a thing this model derives. A reference names an equation of its own document.
- Normalization needs two exceptions, both in `lib/runs.ts`: two adjacent math runs are never
  joined, which today's rule would merge into one equation, and a run carrying `equationRef` is
  kept although its text is empty, which today's rule would drop.
- The `equation` type is declared (`BO_0290_007`, 2026-09-23): an `ext.blocktype` member of this extension staged through `kernel commit --members` as `table` was (`BO_0287_007`), requiring `id`, `order` and `tex` and permitting `caption`, `numbered` and `source`, its semantics naming the content shape above; and `document` permits it as a child beside `text`, `divider`, `image`, `video` and `table` — a widening. The kernel harness's fixture carries the same declaration (`calliopa-bootstrap`'s `BO_0290_001`).
- An equation is written and read like any block (`BO_0290_008`, landed 2026-09-23): `NewEquationBlock` joins `NewBlock`, so `insertBlock` and a document's first block take one; `equationContent` in `documents.ts` writes `tex`, `caption`, `numbered` and `source`, leaving an empty caption and an unasked number out as an absent role is left out, and never writing a number; `vocabulary.ts`'s `validateEquation` refuses runs on an equation, an equation with no source, a caption that is not words, a `numbered` that is neither true nor false, and **a stored `number`**, which would be the one stale copy of a derived thing; and `assemble.ts` answers an `EquationBlockView` — the source, the caption, the standing, the ask and the number — with a stored equation carrying no source drawn as unsupported content rather than as an empty box. Proven in `server/equation-content.test.ts` and, over the one graph through the kernel harness's widened fixture, in `tests/behavior/documents.test.ts`.
- The run primitives carry mathematics (`BO_0290_009`, landed 2026-09-23, `src/lib/runs.ts`, a root-mapped `ui.shell` member this vocabulary imports as it already imports the marks): a run may carry `math: true` with its TeX as its text, or `equationRef` with no text of its own. **Both are atoms** — `isAtom` — which is the load-bearing part: an atom counts as one character in every offset these primitives deal in, so the caret steps over it, a split sends it whole to one side, a mark applied across a selection leaves it alone, and `explode` does not shatter one equation into one run per character. Normalization keeps a reference although its text is empty, drops mathematics carrying no source, and never joins an atom to anything; `sameRuns` counts both attributes as part of meaning the same thing; and `readRuns` reads them back and refuses a `math` that is not true, a reference naming nothing, a run that is both, and mathematics with no source. Without the last of these a read would rebuild every stored sentence from text, marks and link alone and drop its mathematics. Proven in `src/lib/runs.test.ts`, where eleven cases cover the rules and eight of them fail the moment `isAtom` stops answering.
- Numbering is resolved in the document read (`BO_0290_010`, landed 2026-09-23; `numberEquations` in `assemble.ts`, applied by `assembleDocument` to the blocks in reading order): the `numbered` equations are numbered from one in that order, an equation that asked for none taking none and consuming none, a discarded one likewise, and a retired one never reaching the view. Each numbered equation's view carries its `number`, so no surface derives its own.
- A reference resolves against the document being read (`BO_0290_011`, landed 2026-09-23): the read answers `equationNumbers`, the number of every numbered equation by identity, for the whole document, and a reference run is drawn as the number its equation carries there. A reference whose equation has left the reading order, been discarded or lost its number resolves to nothing, which the surface draws as a marker saying its equation is gone — never a stale number and never silently dropped. Proven in `server/equation-content.test.ts`: the numbering over the numbered alone, an equation inserted above renumbering those below it with no write, a discarded one consuming none, a document with none answering none, and a reference to an unnumbered equation resolving to nothing.
- Editing an equation is a whole-block revise (`BO_0290_012`, landed 2026-09-23): `reviseEquation` in `documents.ts`, the command `{command: "reviseEquation", blockId, baseRevisionId, tex, caption?, numbered?}` on the commands route, compares the base first as `reviseTable` does, refuses a block that is not an equation and an equation with no source, keeps the block's identity and its place, and writes the three by property — so a revise that leaves the caption out clears it and one that leaves `numbered` out takes the number away. A stale base is a conflict. Proven over the one graph in `tests/behavior/documents.test.ts`: an equation written and read back with its caption and its number, the equation that asked for none carrying none, a revise carrying the new source onto the same block and the one below renumbering with nothing written to it, the ask withdrawn taking the number away, a stale base refused, an empty source refused, and a sentence's math run and reference surviving the write and the read.
- `ui.shell.documents`' `structure` convention names mathematics as the units this model holds (`BO_0290_022`, 2026-09-23): an equation is an `equation` block carrying its exact TeX, never TeX in a paragraph; mathematics inside a sentence is a run of that sentence carrying `math: true`; and a reference to a numbered equation is a run carrying `equationRef` and no text of its own. It says what the reads answer and what is never written — a number is the document's order, so `read_document` answers it and a run never sends one back. Revised as a member in the same proposal as the code, as `BO_0287` revised the same skill.

## A Manuscript Out Of The Record

- Under `calliopa-bootstrap`'s `BO_0293`, promoted to draft by the user on 2026-09-23 and
  transferred here the same day, a person gets a manuscript out of a document: LaTeX with its
  `.bib` and the PDF typeset from it, in a venue's format, projected from the accepted reading
  order at a revision — every figure from a block, every citation from a work the bibliography
  holds, every equation from the TeX the block stores, nothing typed a second time. The
  projection, the venues, the kept manuscript, the surface and the tool are an extension of their
  own, `manuscripts`, which `BO_0293_017` created and whose own docs carry its work
  ([Manuscripts](../../../../manuscripts/docs/system/system.md)); the engine is the fixed layer's
  ([Typesetting Service](../../../../../../docs/system/typesetting-service.md) in
  `calliopa-bootstrap`); the kernel's half — the document tools carrying the `abstract` role — is
  its `ui-kernel.md`, *A Manuscript Out Of The Record*. The abstract is this extension's, since it
  is the document's own block and stays readable with the manuscript extension off; the front
  matter is the person's *Paper* role (`BO_0312_Q3`).
* The extension is `manuscripts`, its change prefix `MA`, its kept output a rendition on the
  document carrying *Format* (`calliopa-bootstrap`'s `BO_0312`, the type `formatRendition`).
  `bundled` and active on a fresh install, needing no credential. Technical decision at transfer,
  2026-09-23, revised by the user's decisions of `BO_0312` on 2026-09-30 and of `BO_0332` on
  2026-10-01.
* PDF and LaTeX with its `.bib` ship first, from one pipeline; `.docx` is a second cut. User
  decision, 2026-09-23.
* A generic article and IEEE ship as venues; adding one is adding a template, never code. User
  decision, 2026-09-23.
* Front matter is a role the person owns: the migration creates *Paper* with *Authors*,
  *Affiliations* and *Keywords* and moves each document's values there; the abstract is a `text`
  block of the role `abstract` in the reading order, proposable like any block. User decisions,
  2026-09-23 and 2026-09-30 (`calliopa-bootstrap`'s `BO_0312_Q3`).
* Figures and tables are numbered, captioned and referable in the document before a manuscript
  projects them (`calliopa-bootstrap`'s `BO_0295`, idea); the manuscript never numbers what the
  record does not. User decision, 2026-09-23.
* An execution's output enters as what it is: a picture is a figure, a table a table, each
  captioned with a last line naming the code block and the revision that produced it, and the
  producing code goes to a supplementary section; text output and tracebacks stay out, and the
  manuscript says where a block was left out. User decision, 2026-09-23.
* Every manuscript made is kept: a write, pinned to the revision it projects and the venue,
  listed on the document, downloaded from there. User decision, 2026-09-23.
* A run may make and keep a manuscript through a tool, so it can check what it is helping to
  write against a venue's rules; a run's manuscript is a proposal in its group, never anything but
  a file, proposing no block and changing no property. User decision, 2026-09-23.
- A `manuscript` is a root node with no parent and no block flag, as a `work` is: `of` the
  document's id, `revision` the dataRevision projected, `venue`, `files` the core's blob
  references hoisted top-level with their filenames (`manuscript.pdf`, `manuscript.tex`,
  `references.bib`), `made`, `by` the principal or the process, `outcome` and `log` in the
  service's words, and `omitted` — what the projection left out and why, in words. A person's
  press writes it as truth, scoped by `withBranch`; a run's tool stages it in
  the run's group. Technical decision at transfer, 2026-09-23.
- The projection walks the accepted reading order at the pin, the set the citation numbering
  resolves over: a `text` role becomes a paragraph, a section at three depths or a block quote,
  its marks, link and line breaks carried; `abstract` becomes the abstract; an `image` a figure
  with its caption and number (`BO_0295`); a `table` a table with its caption and number; an
  `equation` a display equation numbered when `numbered`, an `equationRef` its reference, a
  `math` run inline mathematics; a `cite` run a `\cite` of the work's key with its locator, and
  the cited works' CSL-JSON the references; an `output`'s picture a figure and an HTML table in
  its bundle a table, each with the provenance line; a `sourcecode` block that produced one of
  them a listing in *Supplementary Material* under a heading naming what it produced; a `video`,
  a `divider`, a prompt, a code block that produced nothing placed, and everything retired,
  discarded or still proposed — nothing, the left-out ones said by name in `omitted`. Technical
  decision at transfer, 2026-09-23.

- Front matter is no longer the document's (`calliopa-bootstrap`'s `BO_0312_030`, landed
  2026-10-01): `manuscripts`' formats migration moves it into the person's *Paper* role and clears
  the properties ([Manuscripts](../../../../manuscripts/docs/system/system.md#formats)). The editor
  draws no authors and no fields, the read answers none, the validator reads none, and no command
  writes them. `authors`, `affiliations`,
  `keywords` and `venue` stay declared on `document`, read by the migration alone, until every
  install has run it (`calliopa-bootstrap`'s `BO_0312_062`), as `documentRole` stays for
  `BO_0309`. Proven in `server/document-head.test.ts` — a node still carrying them reads and
  validates without them, and the command is refused — and `views/abstract.test.ts`, the head
  drawing no authors and no fields.
- `text` permits the role `abstract` (`BO_0293_013`, landed 2026-09-23): the declaration's permitted roles widened as a member revision, `TEXT_ROLES` in `src/lib/runs.ts` with it, so the validator, the command parser and the kernel's run schema — which enumerates the declaration — all take it. The `structure` convention of the `ui.shell.documents` skill says a paper's abstract is one text block of that role. Proven in `server/document-head.test.ts`, and by the behaviour case writing an abstract and reading its role back.
- The extension exists (`BO_0293_017`, landed 2026-09-23): `src/extensions/manuscripts/` with its manifest (`category: bundled`, version `0.1.0`, depending on `documents`, `bibliography` and `ui.shell`), both entrypoint halves, its `docs/system/system.md` naming the prefix `MA`, and this change's document carried into its `docs/changes/`. The extension's tasks moved there with it: the type, the projection, the venues, the make and the keeping, the surface, the tool and the walk ([Manuscripts](../../../../manuscripts/docs/system/system.md)).


## Figures And Tables Are Numbered

- Under `calliopa-bootstrap`'s `BO_0295`, promoted to draft by the user on 2026-09-23 and
  transferred here the same day, a picture carries a caption, pictures, tables and an execution's
  output picture are numbered on request, and a sentence refers to a numbered figure or table by
  its number — the idiom Mathematics set for equations, and what `BO_0293`'s manuscript projects
  (A Manuscript Out Of The Record). The kernel's half, the document tools, is
  `calliopa-bootstrap`'s `ui-kernel.md`, *Figures And Tables Are Numbered*; how they are drawn and
  authored is [Block Editor View](./block-editor.md#figures-and-tables-are-numbered).
* Figures and tables are numbered only when their author asks, in reading order, figures and
  tables counted apart, as a paper counts them. User decision, 2026-09-23.
* An execution's output picture is a figure: an accepted `output` permits `numbered` and
  `caption`, set by a person after acceptance, its first picture the figure, counted with the
  images in one sequence. User decision, 2026-09-23.
* A number needs no caption: a numbered figure without one is drawn as *Figure 3* alone. User
  decision, 2026-09-23.
- A number is derived, never stored, by Mathematics' rule: retired and discarded blocks take none
  and consume none, and a block in an open proposal is numbered where it would land. A reference
  is a run carrying `figureRef` or `tableRef`, the identity of the block it names, with empty text,
  an atom kept by normalization as `equationRef` is, and names a block of its own document.

- The widening is declared (`BO_0295_006`, landed 2026-09-23): `image` permits `caption` and `numbered`, `table` permits `numbered`, `output` permits `caption` and `numbered`, member revisions staged through `kernel commit --members` in the same proposal as the code, each property's words saying the number is the document's order and never stored, and an output's two properties a person's after acceptance. `validateImage` joins the validators, and `validateNumbering` in `server/vocabulary.ts` says for a picture, a table and an output alike that a caption is words, the ask true or false, and a stored `number` is refused.
- The run primitives carry the references (`BO_0295_007`, landed 2026-09-23; `src/lib/runs.ts`, root-mapped `ui.shell`): `figureRef` and `tableRef` are atoms — one character wide, never joined, kept by normalization although they carry no text (`isEmptyAtom`), compared by `sameRuns` — and `readRuns` reads them back and refuses one naming nothing, one carrying text of its own, and a run that is two atoms at once. Proven in `src/lib/runs.test.ts`.
- Numbering is resolved in the document read (`BO_0295_008`, landed 2026-09-23; `numberFiguresAndTables` in `assemble.ts` after `numberEquations`): the numbered pictures and outputs in one sequence and the numbered tables in another, in reading order, each carrying `number`, the read answering `figureNumbers` and `tableNumbers` by identity; a reference resolves against them or draws as gone. Neither kind carries a standing, so no discarded one is skipped, and a retired one never reaches the view. A picture's and an output's `caption` and all three kinds' `numbered` are read onto their views. The caption and the ask are set by one command, `setFigure` (`documents.ts`, the commands route): a picture's and an accepted output's caption and ask, a table's ask alone — a table's caption stays `reviseTable`'s — each by property against the base, so a revise that leaves the ask out takes the number away; a proposed output is not in the document the command reads and is refused as unknown until accepted. One command rather than the three the transfer named (`reviseImage`, `numbered` on `reviseTable`, `setOutputCaption`), since the three would say the same thing three ways; technical decision at implementation, 2026-09-23. Proven in `server/figure-content.test.ts` and in `tests/behavior/documents.test.ts` over the one graph: two pictures and a table numbered through `setFigure`, the picture below renumbered with nothing written to it, a sentence's references surviving the write and the read, a stale base answered `conflict`, a table's caption and a text block refused.
- `ui.shell.documents`' `structure` convention names a picture's caption and number, a table's number, and a reference to a figure or a table as a run of its sentence carrying `figureRef` or `tableRef`, says never to set a caption or a number on an output, and says a number is the document's order answered by the read, or `missing` (`BO_0295_009`, 2026-09-23), revised as a member in the same proposal as the code.

## References From The Hash

- Under `calliopa-bootstrap`'s `BO_0300`, promoted to draft by the user on 2026-09-25 and
  transferred here the same day, one run kind refers to any block of the document — a numbered
  figure, table or equation by its number, a section by its heading, a plain paragraph — and what
  a reference is drawn and printed as is resolved in the read, as a number is. The kernel's half,
  the run schema, is `calliopa-bootstrap`'s `ui-kernel.md`, *References From The Hash*; how a
  reference is written and drawn is [Block Editor View](./block-editor.md#references-from-the-hash);
  how a manuscript prints one is [Manuscripts](../../../../manuscripts/docs/system/system.md).
* A referenced paragraph becomes a marked unit: a plain block another sentence refers to is set
  apart in the manuscript with a marker of its own — named, numbered, labelled, the way a lemma
  is — and the reference reads as that marker and number, in the editor as in print; a paragraph
  nobody refers to stays prose. User decision, 2026-09-25 (`BO_0300_Q1`).
- The marker is *Remark* unless the venue's template names otherwise (technical default,
  2026-09-25): referenced plain blocks are numbered in reading order among themselves, derived on
  every read and stored nowhere, retired and discarded ones taking none.
- A reference is a run carrying `blockRef`, the identity of the block it names, with empty text —
  an atom kept by normalization as `figureRef` is; the three older keys are read as references of
  the same kind and nothing rewrites a document to the new one.

- The run kind and its resolution (`BO_0300_010`, landed 2026-09-25). `blockRef` joins `src/lib/runs.ts` (root-mapped `ui.shell`) as an atom beside `figureRef`: kept by normalization although it carries no text, one character wide, told apart by its target, read back by `readRuns` and refused when it names nothing, carries text or is another atom at once. The read resolves every reference after the numbering (`labelReferences` in `assemble.ts`): over the blocks a `blockRef` — or one of the three older keys — of the reading order names, `referenceLabels` by target identity answers *Figure 3*, *Table 1* or *(2)* for a numbered figure, table or equation, a heading's words, and *Remark N* for a paragraph or quote, the referred-to ones numbered in reading order among themselves and answered as `remarkNumbers` for the manuscript; a target outside the reading order, an unnumbered float or equation, an abstract and any other kind take no label, so a reference to one draws as gone. `ui.shell.documents`' `structure` convention names `blockRef`, says what the read answers for it and prefers it over the three older keys, revised as a member in the same proposal.
- Verified beside the code (`BO_0300_011`, 2026-09-25): `src/lib/runs.test.ts` reads a `blockRef` back and refuses one naming nothing, carrying text or being two things; `assemble.test.ts` labels a heading by its words, a referred-to paragraph and quote as remarks one and two, a numbered figure by its number, and leaves a paragraph nobody refers to, a discarded target, an abstract and an unnumbered equation without, and answers the labels and remarks with the assembled document.

## A Fixated Block Says Its Words Moved

- [ ] DO_0017_004 A block reports that its words changed after it was fixated. A fixated block is
  what a run is told as standing context, so a fixated block whose words are no longer the ones the
  reader marked is worth saying out loud — and the loss `DO_0017` came from was invisible for exactly
  as long as nobody looked at the block. It is a hint and nothing else: no lock, no refusal, and no
  judgement of what the move meant.
* The hint waits for a change of its own. User decision, 2026-09-24: the guard and the removal
  (`DO_0017_001`, `DO_0017_002`) already stop the loss, and what remains is a nicety whose cost is not
  yet settled. `DO_0017` closes without it and the task stays here, unclaimed.
- Why it is not cheap, found while trying it (`DO_0017`, 2026-09-24). `disposition` says that a block
  is fixated, never since when, so the hint needs something to compare against — and **the standing
  write cannot store its own revision**, since the stamp would have to name the revision that write is
  about to create. `BO_0274`'s `acceptedAt` has no such trouble: the stamp is on the root and the
  comparison is against a block, two different nodes. That leaves three mechanisms, and which is
  right turns on what counts as the words moving, which is a question for the person:
  - The write that changes the words records it, in that write. One write, no read, no extra
    revision, exact at the moment. An accepted rewrite of a fixated block does not raise it, because
    acceptance is CCGW's write and not this extension's.
  - The same, plus a write after an acceptance. Complete, at the cost of a second write on the block
    inside the kernel's per-node floor (`DO_0015`) and a second revision in its history per
    acceptance — the history `DO_0017_003` is about to show the reader.
  - Derived and stored nowhere, as `edited` is. Complete and exact, at the cost of a history read
    carrying content over the fixated blocks on every document read; the document read takes no
    history read today.
- The hint is drawn where a marked block already carries its marks (A Marked Block Is A Card,
  [Block Editor View](./block-editor.md)), and it goes when the reader fixates the block again on
  the words it holds now.

## Instructions

- An instruction holds no generation setup (`calliopa-bootstrap`'s `BO_0336_040`, landed 2026-10-02):
  `document` declares neither `profileType` nor `imageBackend`, and nothing here reads or writes
  them — what a picture or a video is made with is the format an instruction names in *Instruction*'s
  *Format* field (`media`'s
  [Generation Settings Live In The Format](../../../../media/docs/system/system.md#generation-settings-live-in-the-format)).
  The executable migration `migration-bo-0336-profile-generation` (route
  `kernel/migrations/profile-generation`, `clearProfileGenerationStatement`) clears both from
  every established document holding either, once per instance, and nothing moves to a format
  (user decision, 2026-10-02). Proven in `server/migrations.test.ts`.

Under `calliopa-bootstrap`'s `BO_0298` (`docs/changes/BO_0298_FEAT_profiles.md`) and `BO_0311`
(`docs/changes/completed/BO_0311_FEAT_profile-in-the-chip-with-tools.md`): a person keeps reusable
instruction documents — instructions — on the instance and chooses one for each command from the chip
of the block it is written in, and the command's run is guided by the instruction's accepted content.
An instruction is a document, authored and revised in this editor through the proposal loop, and a
person can ask an agent to draft or improve one. The extension is `instructions`, whose decisions and
work are its own ([Instructions](../../../../instructions/docs/system/system.md)); the kernel's half — the
run start reading the command's instruction, its tools and the record — is `calliopa-bootstrap`'s
`docs/system/ui-kernel.md`, *Instructions* and *The Instruction In The Command, With Tools*; the run
detail's line is `ui.shell`'s ([Processes](../../../../../../docs/system/workspace/processes.md#the-run-used-an-instruction)).

* Every run uses the instruction's latest accepted content at run start; a run underway keeps what it
  received; a proposed edit awaiting acceptance is not an instruction. User decision, 2026-09-24
  (`BO_0298_Q2`).
* An instruction is told apart by a `record` value, and the Documents category leaves instructions out.
  User decision, 2026-09-25 (`BO_0298_Q4`).
* An instruction is neither an intention nor a replacement for skill selection; a command may carry
  both. The prompt controls the request, the instruction guides it, the intention's skills keep their
  method rules. User decisions, 2026-09-25 (`BO_0298_Q5`, `BO_0298_Q6`).
* The chosen instruction belongs to the command, and no document names one (`BO_0308_Q7`, reversing
  `BO_0298_Q1` and `BO_0298_Q8`); a document's attached instruction was dropped on upgrade
  (`BO_0311_Q1`). User decisions, 2026-09-30.
- The `record` value is `instruction`, written by `instructions` and read by it — knowledge, never a
  fence, the posture every declaration by instance holds; a document using it stays a document
  when the extension is switched off.
- The Documents category leaves instruction documents out (`BO_0298_011`): `listDocuments` drops a
  `document` carrying `record: instruction`, established or started by a run alike, and lists
  everything else.
- What `instructions` is made of here (`BO_0298_012`, `BO_0311_020`; `server/documents.ts`,
  `lib/instruction.ts`): `createDocument` takes an optional `record` beside the title and the first
  block, so an instruction is created as any document is with its record in the same statement;
  `listInstructions` answers the established documents carrying the record by title;
  `instructionSummary` answers whether a document is an instruction, with its id and title; and
  `clearProfileSlotsStatement` answers one script clearing the `profile` slot every document
  still carries from before `BO_0311`, or none, which `instructions`' upgrade migration runs. The
  vocabulary — `INSTRUCTION_RECORD`, `UNNAMED_INSTRUCTION`, `InstructionSummary` — is `lib/instruction.ts`,
  client-safe.
- The `profile` slot left the `document` declaration (`BO_0311_020`): the property and its
  description are gone from the member, staged through `kernel commit --members` — dropping an
  optional property is no breaking change (`calliopa-bootstrap`'s `validation.md`) — and the
  values documents still carried are cleared by `instructions`' executable migration
  `migration-bo-0311-profile-in-the-chip` on every instance as it takes the release (a `SET` to
  null removes the key). Proven by `tests/behavior/instructions.test.ts` over the one graph: an instruction listed among
  the instructions and not the documents, a document told apart as an instruction or not, and a slot kept
  from before cleared by one script and found nowhere after.

## Document And Block Structures

A person structures a document with structures, which the `structures` extension holds: a block
uses structures — the document, the root block of its reading order, uses them the same way — a structure
allows structures to the blocks under it, and a structure carries fields whose values the block holds
(`calliopa-bootstrap`'s `BO_0299`, 2026-09-25, and `BO_0309`, with `BO_0318` folded in,
2026-09-30). The extension is `bundled`; its work and its truth are its own
[system document](../../../../structures/docs/system/system.md), and this section keeps the
decisions that touch this extension's documents and editor, and the places it draws.

* Every block in the reading order can use a structure that allows blocks — text, picture, table, code,
  equation and the rest — so a picture can be the hook, and the document uses structures of its own.
  User decision, 2026-09-25 (`BO_0299_Q8`). A structure says whether blocks may use it, and *Keyword*,
  *Instruction*, *Format* and *Source* are used by documents alone. User decision, 2026-10-01
  (`calliopa-bootstrap`'s `BO_0332`; `structures`' [Structures](../../../../structures/docs/system/system.md#document-structures-and-block-structures)).
* Structures are created and revised by anyone who can edit documents, and used or given a value by the
  person as truth at once, in every branch alike, no proposal raised; a run proposes structures and
  values, which stand once the person accepts them (`BO_0299_Q2`, `BO_0308_Q4`).
* A block's roles are visible while reading, as small pills at the block; they are taken, cleared
  and given values from the structures chip beside the command chip of the block being edited
  (`RO_0002`), and the document's from the structures line of its header, whose control is always
  drawn (`BO_0299_Q7`, `BO_0318_Q1`, `BO_0318_Q6`, `DO_0030_Q2`).
- The word *role* is taken: `text.role` is the typographic role — `paragraph`, `h1`, `h2`, `h3`,
  `quote`, `abstract` — read by the kernel's document tools as `role`. The structures extension's type
  keeps the name `blockRole`, and the typographic role keeps `role`.
- The structures are the structures extension's own nodes and an assignment is a relation from the block or
  the `document` node, so this extension's declarations do not change for them: an
  `ext.relationtype` fences neither end, and every block kind is this extension's declaration.
- The pills are a `headline` block place and the structures chip an `underCommand` block place, drawn
  in the command chip's row (`RO_0002_002`); nothing of structures is in the document bar or the command
  chip.
- The document's place under its title (`BO_0309_031`, landed 2026-09-30, made the header's rows by
  `DO_0030_002`; `views/block-editor.tsx`, `block-editor.css`): inside the document's header,
  directly after the title's `h2`, the view draws `.document-title-place`
  (`data-document-title-place`) holding `.document-title-place__chip`, where each `title` document
  place a decoration provider contributes is a row of its own (`DocumentDecorations at="title"
  form="full"`, `ui.shell`'s `BO_0309_030` and `DO_0030_001`). The rows are in the flow and drawn
  while reading and editing alike; an empty one takes no room. Their presses are their own
  (`stoppropagation:click`), and a control in them that keeps the caret leaves the title's edit
  open. The structures extension draws the structures line and the values line there, the keywords extension
  the mentions line ([Block Editor View](./block-editor.md#the-document-header)).
- The `ui.shell.documents` skill says nothing of structures: a run reads the skills of every active
  extension that offers it a tool (`calliopa-bootstrap`'s `BO_0299_003`), so the structures extension's
  own skill reaches every run.

## Keywords

Under `calliopa-bootstrap`'s `BO_0301` (`docs/changes/BO_0301_FEAT_keywords-connect-documents.md`,
promoted to draft by the user on 2026-09-25 and transferred here the same day, five of its seven
questions answered the same day): a person marks some documents as keywords — *Quantum
computing* — and every place the words of a block say *quantum computing*, or *quantum
computers*, is connected to that document: the reader follows the mention to the keyword, the
keyword knows where it is mentioned, a run reads the keyword's definition before it writes about
it, and a manuscript carries the keywords it mentions as its glossary. A keyword is a document
carrying a document role (Document And Block Roles, above); what it holds — its definition, its
other names — is the roles its blocks and its focused-work children carry. The extension is
`keywords`, `bundled`, created under `BO_0301_011` on 2026-09-25; its work and its truth are its
own [system document](../../../../keywords/docs/system/system.md), and this section keeps the
decisions and the pointer. Its release lines are `calliopa-bootstrap`'s
`distribution.md` (`BO_0301_001`–`BO_0301_002`); nothing else in the fixed layer moves — the
extension declares no vocabulary, since a mention is stored nowhere, and the kernel already lists
an active extension's `ext.tool` members and answers them through the callback (`ui-kernel.md`,
`BO_0264_007`). The glossary is `manuscripts`' half, `BO_0301_020` in its
[system document](../../../../manuscripts/docs/system/system.md).

* A person marks a document as a keyword by giving it a document role; no second way of saying
  *this document is a keyword* is introduced. A mention of a keyword in the words of a block is
  connected to the keyword document without the person doing anything at the mention. The
  request, 2026-09-25.
* Which document role means *keyword*, which block role means *definition* and which means
  *alias* are choices the person makes in the extension's own section, over the role catalogue,
  kept as the extension's settings; the extension never looks for a role by name, since roles
  have no fixed names and no starter role ships (`BO_0299_Q1`). User decision, 2026-09-25
  (`BO_0301_Q2`).
* Matching is English and follows three rules in order. First, the title in every inflection
  wins — *quantum computers* and *quantum computer's* reach *Quantum computer*, and *quantum
  computing* never does, because *computing* and *computer* are different words, so the hardware
  and the domain stay two keywords. Second, the keyword's aliases in every inflection, the same
  way. Third, only where the first two reach nothing, the full stem: *quantum computation*
  reaches *Quantum computing*. User decision, 2026-09-25 (`BO_0301_Q3`).
* A keyword carries aliases as a block role: each line of a block carrying the alias role is one
  more name the keyword answers to. User decision, 2026-09-25 (`BO_0301_Q4`).
* A keyword's definition — what the hover shows and a run receives — is the first block of the
  keyword document whose block role is the definition role; else the face of the first
  focused-work child whose document role is that role; else the keyword's first paragraph. User
  decision, 2026-09-25 (`BO_0301_Q5`).
* A run learns of mentions through an `ext.tool` of the extension and a skill, not through the
  kernel's `read_document`. User decision, 2026-09-25 (`BO_0301_Q6`).
* A manuscript carries a glossary: every keyword the document mentions in its accepted reading
  order, with its definition, automatically. User decision, 2026-09-25.
- Open: whether the extension is bundled and active on a fresh install (`BO_0301_Q1`, proposed
  yes, as `structures` is), and whether a keyword document's mention of *another* keyword is
  connected (`BO_0301_Q7`, proposed yes; only a keyword's mentions of its own names are left
  alone). Both proposals are in force until the user answers.
- A mention is resolved in the read and stored nowhere, by the rule a citation set
  (`BO_0291_023`): a query over the words, never a maintained edge, so it cannot drift from what
  the block says, a keyword renamed or given an alias re-matches everything at its next read, and
  the graph gains no node, no relation and no run attribute. This extension's declarations do not
  change, and the runs under a mention are untouched — editing inside a mention is editing words.
- What a keyword answers to is its title and each alias line, every one a *name*. A name matches
  a run of words at word boundaries, case-insensitively; the inflection allowed under the first
  two rules is the English plural and possessive — `-s`, `-es`, `-ies`, `'s`; the third rule is
  the Snowball English stem of each word. A word already inside a mention starts no second one.
  Among the matches at one place the higher rule wins over the same words, and the longest span
  wins among what remains, so *quantum computing* names the longer keyword and not *quantum*
  inside it — proposed, to be confirmed by the user, being the one place the rules cross. Where
  the stem rule alone reaches several keywords with the same words, nothing is connected: a
  guess is not a connection, and the person adds the alias that decides it. A keyword's own
  blocks saying its own names are not connected. Words under the `code` mark, inside an inline
  equation, a citation or any other atom are never matched.
- The name `keywords` and *Paper*'s *Keywords* are two things: the field is the author's keyword
  list for the venue (`calliopa-bootstrap`'s `BO_0312_Q3`), and keyword documents leave it alone.
- Where the mentions are drawn: over their words in the editor through the inline annotations
  the editor draws for any extension ([Block Editor](./block-editor.md), *Inline Annotations*,
  `BO_0301_015`), in a treatment of the keywords extension's own, distinct from a link the person
  set, with the definition on pointer hover and the keyword opened on a press; how many blocks
  mention a keyword in its document's header, through the `title` document place (`DO_0030_006`),
  not the inspector, whose facts are the view's own typed contribution.

- Under `calliopa-bootstrap`'s `BO_0310` (transferred 2026-09-30): a person names a keyword on
  purpose by typing `@`. Its decisions and the keyword side are `keywords`'
  ([Keyword Is A Built-In Role](../../../../keywords/docs/system/system.md#keyword-is-a-built-in-structure)),
  and the run schema is the kernel's (`ui-kernel.md` `BO_0310_001`).
- The run primitive (`BO_0310_010`, landed 2026-09-30; `src/lib/runs.ts`, root-mapped `ui.shell`):
  `keyword` on the `Run` shape, the identity of the keyword document, on a run with words. It is
  words, not an atom: each character carries it as it carries a link, so marks, splits and slices
  keep it, `normalizeRuns` joins a run only with a neighbour naming the same keyword, and
  `sameRuns` tells two keywords apart. Words typed inside it belong to it, words typed at its edge
  to the sentence (`replaceRange`), and a link set over its words replaces it, since a run names a
  keyword or carries a link. `readRuns` refuses one naming nothing, one with no words, one beside
  a link, and one that is also a reference, mathematics or a citation, each in words. The editing
  surface paints its words inside `span[data-keyword]` and `runsFrom` reads them back naming it
  (`views/editor-dom.ts`). Reading, it is drawn as plain words, so with `keywords` switched off
  nothing marks it; with `keywords` on, its mention is drawn over it. The kernel's document tools
  read and write it (`calliopa-bootstrap`'s `BO_0310_001`). Proven in `src/lib/runs.test.ts` and
  `views/named-keyword.test.ts`.

## Code Listings Are Numbered

- Under `calliopa-bootstrap`'s `BO_0303`, promoted to draft by the user on 2026-09-25 and
  transferred here the same day, a code block is numbered on request as a listing — the idiom
  Figures And Tables Are Numbered set, a fourth numbered kind with a sequence of its own — with a
  caption a person types beneath it, and a sentence's `#` reference to it reads *Listing N*
  (References From The Hash). The kernel's half, the document tools, is `calliopa-bootstrap`'s
  `ui-kernel.md`, *Code Listings Are Numbered*; how a listing is drawn and authored is
  [Block Editor View](./block-editor.md#code-listings-are-numbered); what a manuscript prints of
  one is [Manuscripts](../../../../manuscripts/docs/system/system.md).
* A code block is numbered only when its author asks, in reading order, listings counted apart
  from figures, tables and equations. User request, 2026-09-25.
* A number needs no caption: a numbered listing without one is drawn as *Listing 2* alone. User
  decision, 2026-09-25.
* Only a `sourcecode` block is a listing; an execution's text output is never one. User decision,
  2026-09-25 (`BO_0303_Q3`).
- A number is derived, never stored, by Mathematics' rule: retired and discarded blocks take none
  and consume none, and a block in an open proposal is numbered where it would land. A reference
  is a `blockRef` like any other, resolved in the read.
- The caption and the ask are written by `setFigure`, widened to a `sourcecode` block — one write
  of the two properties, never through `reviseCode`, so a settled edit of the code stays the one
  whole-block revision the send gate depends on, as `continues` is kept apart (Code And Its
  Output). Technical decision at transfer, 2026-09-25.

- The widening is declared (`BO_0303_007`, landed 2026-09-25): `sourcecode` permits `caption` and `numbered`, member revisions of the block type beside `source`, `language` and `continues`, staged through `kernel commit --members` in the same proposal as the code, the words saying a caption is words and the number is the document's order and never stored; `validateCode` in `server/vocabulary.ts` ends in `validateNumbering`, so a caption that is not words, an ask that is not true or false and a number written back are refused as a picture's are. The kernel harness's fixture mirrors it (`calliopa-bootstrap`'s `BO_0303_001`).
- Written and read (`BO_0303_008`, landed 2026-09-25): `setFigure` in `server/documents.ts` admits a `sourcecode` block and writes its caption and ask as it writes a picture's — one write of the two properties, never through `reviseCode`; the read (`captionedOf` in the code view, `numberFiguresAndTables` in `server/assemble.ts`) numbers the listings in a sequence of their own after the figures and tables, `CodeBlockView` carrying `caption`, `numbered` and `number`, the document answering `listingNumbers` by identity; and `labelReferences` labels a numbered listing *Listing N* and leaves an unnumbered code block without, so a reference to it draws as gone.
- `ui.shell.documents`' `structure` convention names a code block's caption and number the way it names a picture's — counted apart, answered by the read as *Listing N* — revised as a member in the same proposal as the code (`BO_0303_009`, 2026-09-25), so a run that reads a listing knows what it is looking at and one that proposes a code block may caption and number it (`calliopa-bootstrap`'s `BO_0303_003`).
- Verified beside the code (`BO_0303_010`, 2026-09-25): `assemble.test.ts` numbers two listings in reading order with an unnumbered code block between them consuming no number and a picture beside them still figure 1, labels a reference to the second *Listing 2* and leaves one to the unnumbered block without, and answers `listingNumbers`, the label and the listing's caption with the assembled document; `code-content.test.ts` takes a caption and the ask and refuses the three misfits.
- This change's document stands as a member of this extension, `docs/changes/BO_0303_FEAT_code-listings-numbered.md`, at the status it holds in `calliopa-bootstrap`, and takes every status it takes there afterwards (`AGENTS.md`, The Docs In The Graph).

## Moving A Block Between Documents

* A block dropped into another document is moved there, not copied, and keeps its identity; a block that has focused work keeps its `focuses` edge, so the work travels with it. User decision, 2026-09-29 (`CA_0072`).
- A move between documents (`CA_0072_006`): `moveIn` on the target document's command route — `{ blockId, fromDocumentId, placement }`, the placement `{between: [low, high]}` as a drop within a document is, or the end — runs `moveBlockIn` in `server/documents.ts`. In one write it sets the block's key minted in the target, closes its containment where it stands and relates the target document to it, leaving its identity, its content and any `focuses` edge untouched. The close names its origin as `cFrom` — the source document, or the callout holding a child — because the kernel's write gate reads a close from the relation's origin and refuses one it cannot see (`write_close_unverifiable`). Nothing is asked of the block's revision: a drag moves the block the reader sees, as a move within one document does. It refuses, in words and moving nothing, a move within one document (`sameDocument`), a block the source does not hold, which is how a retired block is refused, and a target that is the block's own focused work or lies below it along `focuses` (`insideItsOwnWork`), walked to `FOCUSED_WORK_DEPTH`. Proven in `tests/behavior/move-in.test.ts` under the kernel harness: a block moved between two blocks and back to the end with its identity, gone from where it was; a block with focused work moved with the edge intact, and a move into that work and one level below refused; a move within one document and a block its source does not hold refused, both documents as they were.

## Swipe Removes Or Keeps

Under `calliopa-bootstrap`'s `BO_0315` (2026-09-30): the discarded standing goes away, and a block the reader
discarded becomes a retired block ([Block Editor View](./block-editor.md#swipe-removes-or-keeps)).

* Every `text` block stored with `disposition` `discarded` or `resolved` is retired, keeping its place, and can be
  restored like any retired block ([Retirement And Restore](#retirement-and-restore)). User decision, 2026-09-30.
- [ ] BO_0315_008 The `text` declaration's `disposition` permits `fixate` and `prompt`, revised through
  `kernel commit --members` as `BO_0272_011` revised it. Narrowing a permitted set is a breaking class, so the group
  carries an `ext.migration` Block naming `text` in `migrates`, and a content operation that retires every block
  stored as `discarded` or `resolved` and clears its `disposition`. The operation runs on this instance and on every
  instance that takes the release (`calliopa-bootstrap`'s `extension-model.md`, `validation.md`). This instance is
  counted over CCGW before and after. `setBlockDisposition` and the command API's `setDisposition` take fixate and
  keep. The kernel's fixture `serve/testdata/documents-vocabulary.json` mirrors the declaration. The line that names
  the three values under [Implementation](#implementation) is revised.

## Structures And Instructions

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day: roles become structures and profiles become instructions, with every stored
identifier (`calliopa-bootstrap`'s `ui-kernel.md`, *Structures And Instructions*). The structures
are `structures`'
([Roles Become Structures](../../../../structures/docs/system/system.md#roles-become-structures))
and the instructions `instructions`'
([Profiles Become Instructions](../../../../instructions/docs/system/system.md#profiles-become-instructions));
this document's half is the `document` declaration and the editor that draws both.

- A text block's `role` is its typographic role and keeps its name.
- The `record` slot takes `instruction` where it took `profile` (`BO_0338_040`, 2026-10-02):
  `lib/instruction.ts` names `INSTRUCTION_RECORD` and `InstructionSummary`, `lib/naming.ts` mints
  *Untitled instruction*, `server/documents.ts` lists and tells apart instructions
  (`listInstructions`, `instructionSummary`) and answers `moveInstructionRecordsStatement` for
  `instructions`' migration, which moves `record: profile` and *Untitled profile*
  (`FORMER_INSTRUCTION_RECORD`, `FORMER_UNNAMED_INSTRUCTION`, read by it alone). The slot clear of
  the `profile` property a document carried before `BO_0311` keeps its name, as that is the
  stored property it clears. Verified by `server/instruction-records.test.ts`.
- What the editor shows of structures and instructions says so (`BO_0338_041`, 2026-10-02): the
  pills, the chip's control and the place under the title are `structures`' and say structure;
  the citation popover's empty state says *add one under Structures, Source*; the
  `ui.shell.documents` skill names no structure and keeps *role* for the typographic one; and
  `tests/behavior/instructions.test.ts` replaced the profiles suite.
- This extension's docs speak the new terms (`BO_0338_042`, 2026-10-02): *Instructions* and *Document And
  Block Structures* in this document, the header's structures line and pills in `block-editor.md` and
  the structures chip in `command-mode.md`; the typographic role, the document's former `profile`
  slot and the stored names keep their form.

## A Structure Is A Document

Under `structures`' `RO_0005`, set to draft by the user on 2026-10-02 and transferred the same day:
a structure is a document using the built-in *Structure*, its fields blocks using *Field*
([A Structure Is A Document](../../../../structures/docs/system/system.md#a-structure-is-a-document)).
This extension holds the document and the editor; what it adds is that a structure's document is
listed as any document and guarded where the release fixes it.

* A structure's document stands among the documents, listed and found like any document. User
  decision, 2026-10-02 (`RO_0005_Q2`).
* A structure is retired, never deleted, and a built-in's title and release fields are the
  release's.

- A structure's document carries no `record`: it is listed and found as any document is, and
  nothing here tells it apart. What makes it a structure is `structures`' to read.
- The guards (`RO_0005_020`, landed 2026-10-02; `server/guards.ts`, `lib/fixed.ts`): an extension
  depending on this one registers a guard with `guardDocuments(name, guard)` when its server module
  loads; a guard answers, for one document, `Fixed` — why it is never deleted (`undeletable`), why
  its title is not changed (`title`), and per block why it stays (`blocks`). `fixedOf` asks every
  guard and merges their answers, the first reason for each winning (`mergeFixed`); a guard that
  cannot answer fails the act rather than letting it through unasked, and with no guard registered
  nothing is read. This extension knows no meaning behind what a guard fixes.
- Every act that would delete a document, change its title or take a block out of it asks first and
  is refused in the guard's words: `deleteDocument` by the rule `documentFixed`, `renameDocument` by
  `titleFixed`, and `retireBlock`, `retireBlocks`, `mergeTextBlocks` and `mergeAdmonitionChildren`
  for the block absorbed, `turnIntoAdmonition`, `turnIntoImage`, `turnImageIntoText`,
  `turnIntoCode` and `moveBlockIn` for the block leaving its document, by `blockFixed`
  (`keptBlock`). A kept block's words stay editable, and a split keeps its id.
- A run's removals and gathers are staged by the kernel's own tools (`agenttools`), which never ask
  this extension, so the guard is asked as they are accepted: `answerDocumentProposal` refuses
  accepting a `remove` whose retirement takes out a kept block, or a `gather` moving one under the
  focused work, by `blockFixed` (`keptAtAcceptance`). Measured at implementation: guarding the
  staging itself would be fixed-layer work, and nothing a run stages stands until it is accepted.
- The document read answers what is fixed (`handleDocumentRead`): `DocumentView.fixed`, present only
  when something is. The editor draws a fixed title with `contenteditable="false"`,
  `data-title-fixed` and the guard's words as its title, and the document's bar offers no *Delete*
  on a document a guard keeps. A refused act is said as the editor says any refusal.
- Verified 2026-10-02 (`RO_0005_020`): `lib/fixed.test.ts` for the merge and the first kept block;
  `views/bar.test.ts` for a kept document's bar without *Delete* and its title drawn fixed; the
  `documents` unit suites green (836). With no guard registered every act reads as before; the refusals over CCGW are proven with
  `structures`' guard (`RO_0005_022`).
- Verified over CCGW under the kernel harness with `structures`' guard registered (`RO_0005_022`,
  2026-10-02, `structures`' `tests/behavior/structures.test.ts`): a structure's document refused a
  deletion (`documentFixed`), a built-in's title refused a change (`titleFixed`), a release field's
  block refused a retirement, a merge and a turn into code (`blockFixed`), and a removal staged
  against it refused as it was accepted; a person's own field block retired freely.
