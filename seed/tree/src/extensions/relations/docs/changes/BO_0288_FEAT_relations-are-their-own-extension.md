# Relations Are Their Own Extension

Status: completed

Requested: 2026-09-23. Refinement does too much and a reader cannot tell what it
does. The predictable half of it — a relation between two blocks, with a reason,
declared by a person and read as a plain query — leaves `calliopa-refine` for
`relations`, an extension of its own. What stays behind is everything whose
output is a model's opinion. The shape below is settled; this document
authorizes no implementation.

## What This Change Delivered

Completed 2026-09-23.

- **The kernel anchors a relation on a block** (`BO_0288_002`–`_008`). `relate`'s ends are block
  ids, `enrichWork` roots the relations read at the blocks and drops the `asserts` hop — five
  bounded reads become four for every run on every install — `read_document` answers no claims and
  `propose_document_changes` refuses a `claim` item by name, and the kernel's dead copy of the
  relation states is gone. Verified over a real CCGW; each rule shown to bite.
- **`relations` exists** (`BO_0288_014`), `bundled` and active on a fresh install, named in
  `release-extensions.json` (`BO_0288_009`) with its line under *Added* (`BO_0288_010`).
- **It owns the vocabulary** (`BO_0288_015`): `relation`, `source`, `target`, `policy`,
  `acceptedBy` and the three `RootPhase` values moved to it; `claim` and `asserts` went to
  `calliopa-refine` (`BO_0288_024`). Their `semantics` say a relation anchors a block.
- **It has a write path** (`BO_0288_017`, additive half): its own commands route under
  `/api/x/relations/`, branch-scoped by the shared helper, with a `declareRelation` that resolves
  each end as a text block which stands, is held by an active containment and is not discarded.
- **The supporting truth followed**: the harness fixtures (`BO_0288_005`), `calliopa-base.working`
  (`BO_0288_006`), this document in the graph (`BO_0288_012`), and `documents` keeping its drawing
  and its `kind` slot (`BO_0288_022`, `_023`).

## What It Did Not Do

Kept open under this change's identifiers so the trail holds, all unclaimed.

- **No person can declare a relation yet, and no surface reads one back.** `BO_0288_020` and
  `BO_0288_019` are the two that close the gap this change exists for; until they land, `relations`
  ships a vocabulary and a route nothing reaches. They are the next work and depend on nothing open.
- `BO_0288_021` (the mark a block carries), `BO_0288_027` and `_028` (the other operations and the
  phase), `BO_0288_016` (the migration, which needs a run in the app or the owner's own mutation,
  since a CCGW mutation carries a credential an agent working from a shell does not hold).
- Everything claim-shaped — `BO_0288_013`, `_018`, `_025`, `_026`, `_029`, `_030` — waits on
  `BO_0292`. Retiring refinement deletes those tasks rather than doing them.
- **Separately, and true today**: `documents` still carries 470 lines of refinement's judgement
  machinery. *The rest of the app is consistent without refinement* is therefore not yet true, and
  no task anywhere covers it. It needs one, whatever `BO_0292` decides.

## Where This Starts

At head 1761, release pin 1721. `calliopa-refine` is `individual` since `BO_0285`
and inactive on this instance since 2026-09-22, so what is described below as
*bundled* is what an install actually receives today.

- **The engine is already built and bundled.** `documents` owns the write
  operations (`declareRelation`, `reviseRelationReason`, `setRelationState`,
  `addClaim`, `reviseClaim`, `dropClaim`, `setBlockKind`), the reads
  (`readClaims`, `readRelationsOf`, `readRelationEnds`, `relationsOf`,
  `relationProvenanceOf`, `provenanceRead`, `historyRead`, `previousWords`), the
  views (`ClaimView`, `RelationView`, `RelationEnd`, `RelationProvenance`,
  `BlockProvenance`, `DocumentRelations`, `BlockHistory`) and `CA_0046`'s pure
  depth logic in `lib/depth.ts`.

- **`relation` and `claim` are bundled declarations.** `relation` carries the ten
  kinds, the three origins and the five states as permitted values, with `reason`
  required; `claim` carries `id` and `text`. `asserts`, `source`, `target`,
  `derivedFrom`, `acceptedBy`, `focuses` and `retired` are `documents`'
  relation types.

- **No person can declare a relation, and none ever has.** Nothing in any view
  calls `declareRelation`; it is reachable only through `d/[id]/commands` and the
  kernel's `relate` tool. All 15 relations in the graph carry `origin: inferred`
  — every one proposed by a run — and only three of the ten kinds have ever been
  used (`dependsOn` 6, `supports` 5, `qualifies` 4). Fourteen carry no `state`
  and one carries `exercised`.

- **Refine owns every surface that shows one.** Its contribution is four things:
  the `Investigations` section, and document decorations at `headline`
  (`HeadlineMarks`), `depth` (`Depth`) and `below` (`FocusedFace`). Its routes are
  `relations`, `provenance`, `history`, `judgements`, `proposed-judgements`,
  `acceptance`, `consequences`, `focused`, `staleness`, `sources`, `gesture`,
  `investigations`. `documents` serves `read`, `commands`, `proposals`, `branch`,
  `standing`, `retired`, `changes`, `policy` and nothing else. So a relation a
  person accepts today lands in the graph and is drawn nowhere.

- **The vocabulary values are refine's members.** The sixteen `BlockKind` and
  three `RootPhase` declarations belong to `calliopa-refine`; `documents` declares
  only the slot types and says so — *the phases are the decision extension's, so
  an instance holding none can propose no phase, which is correct rather than a
  gap*.

- **Type declarations survive deactivation.** Validation resolves every
  graph-defined definition *established at the current head* (`ccgw.md`), not per
  active extension, which is why refine's `judgement` type is still valid on this
  instance with the extension switched off. What deactivation removes is routes,
  views, skills, tools, triggers and intentions.

- **`source` and `target` carry no endpoint constraint.** *Directed relation to
  claim* is prose in each declaration's `semantics`, not a fence. Re-anchoring is
  a semantics rewrite plus a data migration.

- **The graph holds little of it.** 15 relation nodes, 17 claims, 11 judgements
  over 21 documents (`graph/EXPORT.json`). `documents` already carries an
  `ext.migration` member (`migration-bo-0272`), so the mechanism exists.

## Intent

* **A relation anchors a block, not a claim.** User decision, 2026-09-23. This
  revises the fixed line of `BO_0244` (user decision, 2026-09-13) that stands as
  truth in `documents`' `block-document-model.md`, Vocabulary: *A block asserts
  one or more claims, each with an identity of its own, and relations anchor on
  claims.*

* **`claim` is refinement's vocabulary.** It leaves `documents` for
  `calliopa-refine` with `asserts`. User decision, 2026-09-23.

* **The predictable half becomes an extension of its own**, rather than moving
  into `documents`. User decision, 2026-09-23.

- The line the split follows is refine's own, written for staleness: *a plain
  query at the pin — no run, no inference, no cost*. A read over what people
  wrote is predictable and ships; an opinion a model formed is not and does not.

- The precedent for anchoring on blocks is `BO_0274`, whose walk retired the
  claim-counting shape the same day it was built: *The unit is the block, not the
  claim: any block says something, so what matters is whether what it says moved.
  A document nobody has refined holds no claims at all.*

- The precedent for a person declaring one is `BO_0244`'s own fixed line, which
  refine drifted off: *A person's declared relation is truth, written through the
  block's depth as every human content write is; a run only proposes.*

## Decided

Answered by the user on 2026-09-23.

* **The extension is `relations`, and its change prefix is `RL`.** A bare name,
  as every bundled first-party extension has, named after the type it owns as
  `documents` is. `RE` is not used: refine's prefix line already moved off it.

* **It is `bundled` and active on a fresh install.** Relations behave the same on
  every install, which is the point of the split. It costs an install that never
  uses them nothing, because depth is invisible while reading and draws only the
  categories that hold material, so a document with no relations draws none.
  It is deactivated like any other extension.

* **The root's phase moves with it**, and so do the `policy` block type, the
  `acceptedBy` relation type and the three `RootPhase` values, which leave
  `calliopa-refine`. *What would change if I accept this* is a relation traversal
  — `constrains` for a `dependsOn`, `implements` or `affectedBy` reaching here,
  `supports` for a `supports` or `evidences` sourced here, and `contradicts` and
  `supersedes` sourced here — and its one non-relation part, an item per
  unresolved pressure judgement, stays with refinement and drops out. `documents`
  keeps the `RootPhase` slot type; the values are this extension's.

* **`text.kind` does not ship in this change.** A relation's own kind and its
  reason already carry the meaning, so a block need not also be labelled. The
  sixteen values stay refine's, `setBlockKind` and the `kind` proposal item stay
  where they are with no declared values behind them, and widening the bundled
  vocabulary is its own change once relations are in use. Shipping a second
  vocabulary alongside the first is how refinement became seven things.

* **A block that has relations carries a neutral mark while reading**: a gutter
  glyph saying only that relations stand on this block and that focusing it reads
  them. It is a free query and asserts nothing, and it draws no kind, origin or
  state, so material rule 13 holds. `standing` already uses the idiom. An
  invisible relation is one nobody maintains, which is the failure this change
  exists to end.

* **`documents` keeps drawing a run's proposed relation.** `proposal-block.tsx`
  already draws `relate`, `reason`, `state`, `claim` and `kind`, including
  vocabulary refine owns, so this is the standing arrangement rather than a new
  compromise. A decoration place for proposal items would have to be invented and
  nothing else has asked for one.

* **`relation.state` narrows to `declared`, `orphaned` and `retired`.**
  `exercised` and `needsReview` are refinement's and nothing in a bundled install
  could ever set or explain them. Narrowing is breaking, and the migration is one
  row: the single relation carrying `exercised` returns to absent, which reads as
  `declared`. It rides with the re-anchoring migration already in this change.

## The Shape

Mutable, and the starting point for the transfer.

### `relations` holds

- The `relation` blocktype, re-anchored block to block, keeping `reason`
  required, its ten kinds and its three origins.
- The `source` and `target` relation types, re-pointed at `text` blocks.
- The `policy` blocktype and the `acceptedBy` relation type, and the three
  `RootPhase` values, with the phase and its consequences read.
- The routes `relations`, `provenance`, `history`, `consequences`.
- The depth surface: *What this rests on*, *What rests on this*, *Where this came
  from* — three directional reads and no fourth category, since *What a run
  proposed* is answered by the proposal chips the editor already draws.
- The gutter mark on a block that has relations.
- A person's path to declare a relation: a target, a kind, and the reason in
  their own words. This is the part that has never existed, and the reason every
  relation in the graph today reads `inferred`.
- The server modules it inherits, already written and under test:
  `declareRelation`, `reviseRelationReason`, `setRelationState`,
  `readRelationsOf`, `readRelationEnds`, `relationsOf`, `relationProvenanceOf`,
  `provenanceRead`, `historyRead`, and `lib/depth.ts`.

### `calliopa-refine` keeps

`claim`, `asserts`, `derivedFrom`, `judgement`, `judges`, the sixteen `BlockKind`
values, the derived blocks, the four gestures, staleness, investigations and the
evaluation service — with `addClaim`, `reviseClaim` and `dropClaim` following the
vocabulary, and the acceptance drift report, which needs judgements.

### `documents` keeps

`text`, `document`, `divider`, `image`, `video`, `retired`, and the `BlockKind`
and `RootPhase` slot types. The slots are the editor's; their values were always
another extension's. It goes on drawing every proposal item, including those of
vocabularies it does not own. `focuses` is not in this list because `CA_0065` is
moving focused work to `ui.shell` (below).

### The migration

- Each of the 15 relation nodes has its `source` and `target` re-pointed from a
  claim to the block that asserts it, one `asserts` hop. Deterministic, and small
  enough to verify by reading.
- The one relation carrying `state: exercised` returns to absent in the same
  migration, so the narrowed set holds over stored content.
- The 17 claims and their `asserts` edges stay where they are and become
  refinement's. Nothing is deleted: a claim keeps its history like every node.

### What it costs

- A rewording of a block and a change of its meaning become the same event, and a
  block that says two things cannot be depended on for one of them. That was the
  whole argument for claims in `BO_0244`. The trade is accepted because a claim
  only ever exists where refinement has been, which `BO_0274`'s walk found in
  use.

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day.

* **The relation and phase write commands go on `relations`' own commands route**, scoped by the
  shared `withBranch` helper (`src/server/ccgw/branch-scope.ts`), not on `documents`' single switch.
  An extension owns its own routes, as `calliopa-refine` does; the scope helper is already shared,
  so a second route costs nothing and keeps the vocabulary's writes with the extension that owns
  it. `documents`' switch keeps the block operations. This settles `BO_0288_001`, which was the one
  point left open at shaping; it decides nothing a person sees, so it is a technical decision
  rather than a question for the user. A task in the graph half proves that a relation declared
  inside a branch stages into that branch's group rather than into truth.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Relations Anchor A Block*: `BO_0288_002`–`BO_0288_008`. The `relate`
  item's ends become blocks, `enrichWork` drops the `asserts` hop, the narrowed state set, the three
  harness vocabulary fixtures moved to their new owners, `calliopa-base.working`'s convention, the
  verification over a real CCGW, and one functional question — whether `read_document` goes on
  answering each block's claims.
- `docs/system/distribution.md`, *The Release Names Its Extensions*: `BO_0288_009` and
  `BO_0288_010`. `release-extensions.json` gains `relations` with both answers true, the Licences
  enumeration follows, and the release-notes line is owed because a bundled extension arriving is
  something the people who install can observe.

### The kernel half, landed 2026-09-23

- `BO_0288_002`, `_003`, `_004`, `_007` and `_008` are truth in `docs/system/ui-kernel.md`,
  *Relations Anchor A Block*. A relation's ends are blocks, the relations read is rooted at the
  blocks, `read_document` answers no claims and `propose_document_changes` refuses a `claim` item
  by name, and the kernel's dead copy of the relation states is removed rather than narrowed.
  `BO_0244`'s own lines in that document are corrected to the new anchor rather than left to rot.
- The `claim` item kind went with the read, which the answer to `BO_0288_008` did not explicitly
  decide. Keeping a write the kernel cannot read would have been the incoherent half of the move,
  so it went; `BO_0288_013` records the claims tool `calliopa-refine` now owes itself, and nothing
  bundled regresses because nothing bundled ever wrote a claim.

### The extension exists, staged 2026-09-23

- `BO_0288_014` is staged as `node:chg-fd1828eade90a33d`, three files: `relations`' `manifest.json`
  and its `docs/system/system.md`, and `documents`' `block-document-model.md` with six task lines
  taken out of it. The manifest names `documents` and `ui.shell` as dependencies and **no
  entrypoint** — the shape `test` already stands in — because the extension renders nothing until
  `BO_0288_019` and `BO_0288_020` give it a surface. Creating it this way rather than from the
  Extensions section is deliberate: that control is a human-class write an agent cannot make, and
  a manifest added through `kernel commit` is the same subtree by a route the change process
  already uses.
- Its `docs/system/system.md` carries the purpose, the six fixed decisions and the `RL` prefix, and
  holds `BO_0288_015`, `_016`, `_017`, `_019`, `_020` and `_021`. `documents` keeps `_018`, `_022`
  and `_023` — what it loses and what it goes on doing — and points at the two tasks that will give
  `relations` something to draw. Verified as its own overlay at dataRevision 1929, 0 conflicts.

### The graph, still to transfer

- The graph half is transferred (`BO_0288_011`, 2026-09-23), staged from a checkout at dataRevision
  1906 as `node:chg-96384077c1df608d`, two files and nothing else. `documents`'
  `block-document-model.md` gains *Relations Are Their Own Extension* with the five fixed decisions
  and `BO_0288_014`–`BO_0288_023`: the extension's creation, the declarations that move, the
  migration, the work operations on a commands route of their own, the depth surface, a person's
  path to declare, the gutter mark, the drawing that stays, and `text.kind` staying out. Its fixed
  claim line — *A block asserts one or more claims … relations anchor on claims* — is revised to the
  block anchor, which is the user's decision of 2026-09-23 and the one `*` line this change rewrites.
  `calliopa-refine`'s `system.md` gains *The Claim Vocabulary Arrives* with `BO_0288_013`,
  `BO_0288_024`–`BO_0288_026`. Verified by checking the proposal out as its own overlay
  (dataRevision 1910, 0 conflicts): the tasks stand in both files and the old claim line is gone.
  Tasks only — nothing in the proposal implements anything. It waits on the owner's acceptance;
  until then the graph's own docs still read the claim anchor.
- `BO_0288_006` is staged beside it as `node:chg-f95cbf0bfd590261`, one member and no files:
  `calliopa-base.working`'s `workVocabulary` convention follows the kernel's tools to the block
  anchor. It was done out of order, ahead of the declarations moving, because the kernel half has
  already landed and the skill was telling runs to draft a claim `propose_document_changes` now
  refuses by name.
### Established and staged, 2026-09-23

- `BO_0288_014` is established: `relations` exists, `bundled`, depending on `documents` and
  `ui.shell`, carrying its own `docs/system/system.md` and no entrypoint yet.
- `BO_0288_006` is established at dataRevision 1935: `calliopa-base.working` and the kernel's tools
  agree on the block anchor again.
- `BO_0288_015` and `BO_0288_024` are staged as `node:chg-bbc27b12048d8aa9`, ten members and no
  files. `relation`, `source`, `target`, `policy` and `acceptedBy` leave `documents` for
  `relations`, the three `RootPhase` values leave `calliopa-refine` for it, and `claim` and
  `asserts` leave `documents` for `calliopa-refine`. Each moved member's `partOf` is closed and
  re-related with its content untouched but for the `semantics`, which now say a relation anchors a
  block — the move the commit path has supported since `BO_0203_011`, written for exactly this: *a
  vocabulary carved out of one extension into another keeps every node written under its types*.
  `relation.state` is deliberately left wide, because narrowing is breaking and rides with the
  migration (`BO_0288_016`). Verified as its own overlay at dataRevision 1944: the eight members
  stand under `relations`, the two under `calliopa-refine`, and none of them under `documents`.
- `BO_0288_012` is staged as `node:chg-7c57dab8443f6cc0`: this document stands in `relations`'
  `docs/changes/` at `Status: wip`, the status it holds here, and follows every status it takes
  from here.

## The Migration Retires What Was There

User decision, 2026-09-23, answering `BO_0288_016`.

* The relations stored against claims are retired rather than re-pointed. All fifteen carry
  `origin: inferred`, none was ever declared by a person, and none has ever been drawn on any
  surface, so nothing anyone chose is lost. Re-pointing each through its `asserts` hop — sixty
  edge operations — was the alternative and buys nothing.

- Retiring a relation is `SET r.state = "retired"`, never `RETIRE`: the gate refuses a `RETIRE`
  naming a `relation` node as `write_relation_retires_by_state` (`BO_0244_003`), because a relation
  ends by its state so its record stays readable. The fifteen SETs also clear the one row carrying
  `exercised`, which is what makes the narrowed permitted set valid over stored content.
- So `BO_0288_016` is three things in one proposal group, as `ext.migration` requires: the member
  itself, carrying the rationale and `migrates: ["relation"]`; the narrowed `state` set on the
  `relation` declaration; and the fifteen `SET` statements, which travel as ordinary staged
  operations in the same group.
- **How the statements are staged is the open part.** No `kernel` verb stages an arbitrary
  mutation — `commit` packages a tree diff and a members sidecar and nothing else — so the member
  and the narrowed set can be committed but the fifteen SETs cannot travel with them by that route.
  CCGW is reachable inside the stack (`http://app:8080` answers from a container on the compose
  network), so a proposal-scoped mutation is possible; it was not attempted here rather than
  guessing at the API's shape and auth against the dogfood graph. The alternative is a run in the
  app, which holds the document tools and the proposal scope already.

## The Code Tasks Are Split

- `BO_0288_017` bundled a commands route, three relation operations, the root's phase and its
  consequences read, across `documents`' `server/work.ts` (756 lines), `server/work-ops.ts` (330)
  and `server/phase.ts` (319). That is more than one agent session can do honestly and more than
  one reviewer can read, so it is three tasks as of 2026-09-23: `BO_0288_017` is the route and
  `declareRelation`, `BO_0288_027` is the other two operations with the reads that serve them, and
  `BO_0288_028` is the phase, which shares nothing with a relation's write beyond its extension.
  `BO_0288_019` now names what it moves out of `calliopa-refine` and what it waits on.
- **`BO_0288_016` cannot be staged from this side.** A CCGW mutation carries a core-issued
  credential — `context.credential`, or the `Authorization: Bearer` header the HTTP layer maps into
  it — which CCGW resolves to exactly one principal or refuses (`ccgw.md`, `BO_0206_002`). The
  `kernel` CLI holds one and stages only a tree diff and a members sidecar; an agent working from a
  shell holds none, and minting one is the owner's. So the fifteen `SET`s travel either as a run in
  the app, which the kernel gives both a credential and a proposal scope, or as the owner's own
  mutation. The task says so rather than leaving the next session to discover it.
- Nothing is observable to a person until `BO_0288_017`, `BO_0288_020` and `BO_0288_019` are all
  in: the write path, the way to make a relation, and the surface that reads it back. That is why
  `BO_0288_009` and `BO_0288_010` — the release file and its note — stay last.

## The Shell Side Was Never Re-Anchored

- Found 2026-09-23, reading the tree at dataRevision 1991, before starting `BO_0288_017`.
  `BO_0288_002` re-anchored the kernel's agent tools on blocks and `BO_0288_015` re-anchored the
  declarations, but `documents`' own path was never touched. `declareRelation` reads the document's
  claims, resolves each end to a claim, drafts one where a block asserts none, and refuses
  `sameClaim`; `server/work.ts` holds ninety references to claims and `asserts` across the reads
  that serve it.
- Nothing is broken in use, and the reason is the one this change exists to fix: **no surface has
  ever called `declareRelation`**, which is why every relation an instance holds carries
  `origin: inferred`. A relation declared through that path today would anchor a claim and be
  invisible to the kernel, which now reads relations rooted at blocks.
- So moving the code and re-anchoring it are one job. `BO_0288_017`, `BO_0288_027` and
  `BO_0288_028` each carry the re-anchoring of what they move, and `BO_0288_019` reads an end as a
  block rather than as a claim and the block asserting it. None of them is a lift and shift, and
  none should be estimated as one.

## Consistent Without Refinement

* The rest of the app is consistent without `calliopa-refine`, and that is the test every remaining
  part of this change is held to: `documents`, `relations` and the frame carry no claim, and what a
  reader or a run can do with a bundled install never depends on that extension being present. User
  direction, 2026-09-23, given while considering whether to retire refinement altogether — which is
  not decided, and is not this change's to decide.

- `BO_0288_017`'s additive half is truth: `relations` has its own commands route and a
  `declareRelation` anchored on blocks, typechecked against the whole tree. Its removal half is
  `BO_0288_029` — `documents` losing the claim-anchored operation — blocked on `BO_0288_030`, which
  moves that operation into `calliopa-refine` beside the claim operations `BO_0288_018` already
  sends there. The rule is the one already in force: the extension that owns the vocabulary owns
  the writes of it.
- What blocks the removal is concrete and was found by doing it: five of `calliopa-refine`'s
  behaviour suites import `declareRelation` from `documents` to set their scenarios up, twelve call
  sites passing claim ends, and the tree stops compiling the moment it goes. Refinement's own
  semantics are claim-based — `BO_0248`'s pressure compares a claim's revisions and staleness counts
  established claim revisions — so this is not a rename.
- If refinement is retired, `BO_0288_030` goes with it and `BO_0288_029` becomes a deletion. That
  would remove most of what is left here, so the retirement decision is worth taking before the
  remaining code tasks are started rather than after.

## Paused On BO_0292

- User decision, 2026-09-23: the refinement retirement is shaped in
  `BO_0292_REVERT_retire-refinement.md` before anything more of this change is implemented, so
  nothing is deleted before its replacement has a home.
- What pauses is the claim work — `BO_0288_018`, `_024`, `_025`, `_026`, `_030` and the `_029` they
  block. Each moves the claim vocabulary into an extension that may be retired, and `BO_0292_Q1`
  may send claims the other way entirely, back into `relations` or `documents` as the citable unit
  a research tool needs. `BO_0288_024` is already truth, so inverting it would be its own revision
  rather than an edit of a task.
- What does not pause: `BO_0288_019`, `_020` and `_021` — the depth surface, a person's path to
  declare a relation, and the mark a block carries. None touches claims, and `_020` is what makes a
  relation reachable by a person for the first time, which is the gap this whole change exists to
  close.
- Nothing is claimed, so the pause costs nothing and no task needs releasing.

## Depends On

- **`CA_0065` is the sibling move and is already `draft`**, taking focused work
  out of refine and into `ui.shell` for the same reason this change exists — *no
  install has a visible way in* since `BO_0285`. It settles where `focuses` lives
  and is the precedent for how a capability leaves refinement: to the frame when
  every view should offer it, to an extension of its own when it is one
  capability among others. The two must not both claim the depth surface, so
  whichever lands second takes the other's shape as given.

- Nothing else blocking. `BO_0285` already made refinement `individual`, so the
  split moves surfaces between extensions; what a release carries changes only by
  gaining `relations`, which is `bundled` above.

- It spans this repository and the graph: `relations`, `documents` and
  `calliopa-refine` are graph subtrees, and the migration, the release rule and
  `release-extensions.json` are the fixed layer's. So it is a `BO` change here, as
  `BO_0256` and `BO_0264` were for the same kind of move, and its graph half
  stands as a change document of the owning extension at the same status.
