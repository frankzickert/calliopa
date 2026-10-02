# System

## Purpose

- `documents` is the block document model and the surface that reads and edits it: a document as a graph node with ordered blocks, the Documents category that lists them, and the block editor that presents one.
- It left `ui.shell` under `BO_0255` (2026-09-16), the second part of `calliopa-bootstrap`'s `BO_0253`, so the shell is the frame and extension administration alone and nothing keeps a privileged path into it.
* This extension's change documents use the prefix `DO`, as `docs/process/change-process.md` in `calliopa-bootstrap` requires a new extension to name (`BO_0255_002`).

## What It Is

- `category: bundled`: every release carries it, and it is part of the Apache-2.0 body the distribution ships.
- It is not in the kernel's code-registered required set, so an instance may switch it off. A tree without it builds and serves: the Documents category is absent and a tab that remembers a document opens in the frame's `context` placeholder, which is what makes view resolution total.
- The Documents section stands under the *Docs* icon in the shell's icon column, Phosphor `files` (`ui.shell`'s `CA_0056`, [Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md); `CA_0056_009`).
- It declares no dependency. An extension that reads or draws on documents declares one on it.

## Areas

### documents

- [Block Document Model](./documents/block-document-model.md) — documents, blocks, the block vocabulary, ordering, containment, retirement and structural operations.
- [Block Editor View](./documents/block-editor.md) — reading presentation, in-place editing, saving, structural gestures and the action surfaces.
- [Proposed Changes](./documents/proposed-changes.md) — what a run stages into a document and how a person answers it in place.
- [Document Panel](./documents/document-panel.md) — the document's facts, its sessions, its deletion and what it shows.
- [Command Mode](./documents/command-mode.md) — passages, references and the standing a reader gives a block.
- [Schema Evolution](./documents/schema-evolution.md) — how the vocabulary changes.

## Vocabulary

- The extension declares `document`, `text`, `divider`, `admonition`, `admonition_pattern`, `image`, `video`, `table`, `equation`, `sourcecode` and `output` as `ext.blocktype` members, and `retired` and `focuses` as `ext.relationtype` members. What a block *means* beyond its type is said by the extensions that draw on documents, through the editor's places (`block-editor.md`).

## Refine, Show, Video And Test Are Removed

Under `calliopa-bootstrap`'s `BO_0324` (2026-10-01): `calliopa-refine`, `calliopa-show`,
`calliopa-video` and `test` are gone from the graph with their data, and so is what this extension
held only for refinement. The change's document is a member of this extension
(`docs/changes/BO_0324_REFACTOR_remove-refine-show-video-and-test.md`). The fixed layer's half is
`calliopa-bootstrap`'s `ui-kernel.md`, *Refine, Show, Video And Test Are Removed*.

* The four extensions are removed, and a migration deletes what they stored. User decision,
  2026-10-01 (`BO_0324_Q1`).
* What existed only for refinement goes from this extension too: block kinds, claims, judgements,
  derived blocks, the root's phase with *Establish…*, depth and refinement's intention. User
  decisions, 2026-10-01 (`BO_0324_Q2`, `BO_0324_Q5`).
* Their change documents went with them; this repository's git history keeps the record. User
  decision, 2026-10-01 (`BO_0324_Q4`).
- `calliopa-show` was removed first, in a proposal of its own (`BO_0324_050`, 2026-10-01), so that
  `publishing`'s removal (`BO_0312`'s B2) no longer waited on the rest. The rest landed as two
  groups: the migration alone, run while the types it deletes were still declared, and then the
  removal of refine, video and test with the trimming here, in `relations` and in `ui.shell`.
  `focuses`, the `relate`, `reason` and `state` items, and the decoration slot stay.

- The migration `migration-bo-0324-retire-refinement` is this extension's (`BO_0324_010`): its
  route `kernel/migrations/retire-refinement` (`server/migrations.ts`, `readRefinement`,
  `retireRefinementStatement`) answers one script that clears `kind` on every `text` block, a
  document's `phase`, `supersededBy` and `acceptedAt`, and an `intention` of `refine` on either;
  closes every relation on a claim, a judgement or a relation anchored on a claim, every
  `derivedFrom` edge and an investigation's `focuses` edge; and retires those nodes and the
  documents with `record: investigation`. A type no longer declared reads as empty, so the route
  answers nothing on a graph that never held refinement or that it has run on. The kernel's runner
  writes the script through the core as the owner (`ui-kernel.md`, `BO_0324_002`); the bridge's
  gate refuses its relation retirement to every other writer. The `BlockKind` and `RootPhase`
  instances are members, retired with their extensions' declarations rather than by the route.
  Video's and show's nodes are not read: neither extension ever shipped, and this instance stores
  none. Proven in `server/migrations.test.ts` (the script's order and parameters) and
  `tests/behavior/migration.test.ts` (what the route answers over the harness's seeded refinement:
  five nodes retired, six relations closed before any retirement, the block's `kind` and the
  document's `acceptedAt`, `intention` and `phase` cleared, a relation between blocks untouched).
- The store still holds `asserts`, `judges` and `derivedFrom` relations that earlier writes left
  active on nodes they retired: 58, 34 and 83 on this instance, read by nothing, since every read
  hides a relation with a retired end. Validation counts them when a relation type's declaration
  is removed, so the removal's group revises `migration-bo-0324-retire-refinement` (its rationale,
  and `acceptedBy` among what it migrates) and the revision covers the types leaving. The kernel
  runs a migration once by its id, so the revision does not run it again.
- A relation item anchors on blocks here as in the kernel's tools (`BO_0288_002`): `relate` names a
  source and a target block, `reason` and `state` name the relation, and the proposals read draws a
  candidate relation with an end among the document's blocks under that block, an end elsewhere
  read as that block and its document (`server/work.ts`, `farBlock`, `endHere`). `work-ops.ts`
  keeps a relation's reason and its state as a person's writes; a person declares a relation
  through `relations`' commands route. No claim is read or written here.
- No block carries a kind, no root a phase: the `BlockKind` and `RootPhase` slot types and the
  `derivedFrom` relation type are gone from this extension's members, `text` no longer declares
  `kind`, and `document` no longer declares `phase` or `supersededBy`. The proposals read offers
  no `kind`, `claim`, `derive` or `phase` item, and nothing draws a derived idiom, a depth, a phase
  marker or *Establish…*. The contract's block places are `headline`, `below`, `command`,
  `underCommand` and `run`.
- A document child opened as focused work wears its title on the parent's block and no face of its
  words, since no block of it is a synthesis any more (`server/focus.ts`).
- The editor harness queues a store write that lands while another frame is drawn, as a browser
  does, instead of throwing *Must be same function* (`views/testing/editor-harness.ts`,
  `queueFrames`): refinement's reads had kept every other provider's writes out of a draw by
  timing alone.
- Verified and walked (`BO_0324_060`, 2026-10-01). On the group's tree: `tsc --noEmit` clean; the
  unit project with the failures it has at head and none of its own; the behaviour project over
  CCGW runs the migration over `seedRefinement`'s graph and passes it. The migration ran at 3673;
  on the served build at pin 3698, after the kernel rebuild and hermes restart, the Extensions
  section lists none of the four, the served tree holds no *Establish…*, phase or depth, the graph
  holds no node of a removed type and its schema none of their declarations, and a run on *Use
  Case For Calliopa* staged a `dependsOn` relation between two blocks with its reason, answered
  as before.
