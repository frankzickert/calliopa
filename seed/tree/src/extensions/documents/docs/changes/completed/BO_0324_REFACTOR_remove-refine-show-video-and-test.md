# Remove Refine, Show, Video And Test

Status: completed

Requested: 2026-10-01. The user wants four extensions gone: `calliopa-refine`, `calliopa-show`,
`calliopa-video` and `test`. None ships in a release, and all four have been switched off on the
dogfood instance since dataRevision 1597 (2026-09-22). Removing them takes out their code, docs,
vocabulary and data, along with what other extensions and the fixed layer hold only for refine.
This document shapes the change and authorizes no implementation.

## What Is Asked

* `calliopa-refine`, `calliopa-show`, `calliopa-video` and `test` are removed from the graph:
  manifest, sources, docs and every member they declare.
* Their data in the graph is deleted by a migration, along with their vocabulary, the way
  `BO_0312` deletes `publishing`'s. For refine that is the claims, judgements, the sixteen
  `BlockKind` instances, the block kinds written on `text`, the derived-block edges and the
  investigation documents. For video it is the serials, episodes, characters, assets, categories,
  publications, renditions and bindings. For show it is its stamps on shapes. User decision,
  2026-10-01 (`BO_0324_Q1`).
* What exists only for refine elsewhere goes too: in `documents` (the depth surface, *Establish…*
  in the bar, the root phase and the `changed` state, the intention mark), in `ui.shell` and in the
  fixed layer's docs and kernel code. The capture, search and evaluation services stay, since any
  run uses them as agent tools (`BO_0284`, `BO_0280`). User decision, 2026-10-01 (`BO_0324_Q2`).
* The root's phase goes too, although `relations` owns it since `BO_0288`: the phase and its
  three values, *Establish…*, the consequences read, the `policy` and `acceptedBy` behind it, and
  the depth surface. `documents` loses the slots and reads that serve them. This reverses
  `BO_0288`'s fixed line that the root's phase is `relations`', and `BO_0271`'s that a commit
  command is answered with a phase item. User decision, 2026-10-01 (`BO_0324_Q5`).
* The fifteen relations stored against claims are deleted with the claims, not retired by state.
  This reverses `BO_0288`'s fixed line that they are retired rather than re-pointed. User
  decision, 2026-10-01 (`BO_0324_Q6`).
* `relations` stays, with the relation itself (kind, reason, origin, state, two blocks), the
  declare path and its read route. How a person reads a block's relations back, now that depth is
  gone, is an open question in `relations`' docs. User decision, 2026-10-01 (`BO_0324_Q7`).
* `calliopa-show`'s removal moves here from `BO_0312` (bundle B1, `BO_0312_051`). `BO_0312` keeps
  only `publishing`'s removal (B2). User decision, 2026-10-01 (`BO_0324_Q3`).
* Their change documents are members of the extensions and are deleted with them. The record
  stays in this repository's git history of `graph/`. That covers the `RF` changes,
  `RF_0004` (`wip`) and `RF_0006` (`idea`) included, and the video and show changes. User decision,
  2026-10-01 (`BO_0324_Q4`).

## Where This Starts

Read from the graph export under `graph/tree` (head 3448) and this repository on 2026-10-01.

Measured again from a checkout at head 3467 at draft.

- **State.** All four are `category: individual` and inactive (`graph/extensions.json`). The
  instance's `kernel.extensionstate` lists them under `inactive`, and refine under `autonomous`
  too. `release-extensions.json` names `calliopa-refine` with `ship: false` and none of the others.
- **`calliopa-refine`.** 72 files. Members: the `claim` and `judgement` block types, `asserts` and
  `judges`, the intention, seven skills (`calliopa-refine.conventions` and the six `refine.*`
  ones), six tools, and the sixteen `BlockKind` instances. Its routes live under
  `/api/x/calliopa-refine/`. `documents` still keeps the server code that writes `claim`
  (`work.ts`, `work-ops.ts`), the judgements read (`server/judgements.ts`, `lib/judgements.ts`),
  the phase (`server/phase.ts`, `lib/phase.ts`), the depth's pure rules (`lib/depth.ts`), the
  `BlockKind` and `RootPhase` slot types, the `derivedFrom` declaration, and refine's hooks in
  `block-bar.tsx`, `block-editor.tsx` and the editor harness. The contract's `depth` block place
  has no other user; the decoration slot itself serves roles, code, media and manuscripts.
- **`relations`.** It owns `relation`, `source`, `target`, `policy`, `acceptedBy` and the three
  `RootPhase` values, and its open tasks plan to move the phase and depth out of refine
  (`BO_0288_016`, `_019`, `_021`, `_027`–`_029`).
- **Data on the dogfood graph (export at head 3448).** 17 `claim` nodes, 13 `asserts`, 11
  `judgement` nodes, 13 `judges`, 15 `relation` nodes with 30 `source` and `target` edges (every
  end a claim), 16 `BlockKind` and 3 `RootPhase` instances, `kind` on 8 `text` blocks, `phase` on 5
  documents and `acceptedAt` on 4, one `derivedFrom` edge, and 2 investigation documents marked
  with refine's intention. No node of video's or show's types is stored. The 14 `focuses` edges
  are focused work and stay.
- **The kernel.** The document tools read and propose the `kind`, `derive` and `phase` items, and
  `read_document` answers `blockKind`, `derivedFrom`, `phase`, `supersededBy` and `acceptedAt`
  (`agenttools/documents.go`, `work.go`). The gate refuses a `RETIRE` of a `relation` node
  (`BO_0244_003`). `kernel.extensionstate` names refine under `autonomous`. The fixed layer describes refine in `ui-kernel.md` (change context, triggers,
  evaluation, Establish), in `extension-model.md`, in `architecture.md` and
  `page-capture-service.md` (capture and search exist *for* refine's reach), and in `mobile.md`,
  which says refine retires with `BO_0308`.
- **`calliopa-video`.** 46 files. Nine block types (including `rendition`) and twelve relation
  types. `ui.shell` keeps redirects for its old tab and panel keys (`lib/tabs.ts`,
  `lib/layout.ts`), and `publishing`'s vocabulary names it.
- **`calliopa-show`.** 12 files, no members of its own. It depends on `publishing` and writes a
  provenance stamp onto publishing's shapes.
- **`test`.** A manifest and a `docs/system/system.md`, nothing else.
- **Tests outside them.** Shell and kernel tests use the ids as fixtures (`lib/*.test.ts`,
  `server/agent/*.test.ts`, `internal/kernel/**_test.go`, `internal/releaseextensions`). Each
  fixture is checked at draft: some test a general mechanism and only need another id.

## Functional Questions

- None open for this change. `BO_0324_Q1`–`BO_0324_Q7` are answered in What Is Asked. How a
  person reads relations back is `relations`' own open question (`BO_0324_Q7`).

## Acceptance Examples To Shape At Draft

- Given the dogfood instance after the change, the Extensions section lists none of the four, and
  `src/extensions/` at the pin holds none of their directories.
- Given the graph after the migration, no `claim`, `judgement`, `episode`, `serial` or video
  `rendition` node remains, no `BlockKind` or `RootPhase` instance remains, and none of their
  declarations does.
- Given a document, the bar shows no *Establish…*, the editor reads no root phase, and no block
  draws a depth.
- Given a run, its toolset lists no `calliopa-refine.*` tool, `propose_document_changes` offers
  no `kind`, `derive` or `phase` item, and search, capture and evaluate still work.
- Given a run proposing a relation between two blocks, it is staged and answered as before.
- Given a release cut afterwards, `check` and the absence check pass, and the seed carries nothing
  of the four.

## Boundaries And Source Documents

- Graph docs (read from `graph/tree`): the four extensions' `docs/system/`; `documents`'
  `block-document-model.md` and `block-editor.md` for refine's hooks; `ui.shell`'s
  `workspace/` topics for the tab and panel keys; `relations`' `system.md` for the relations kept.
- Fixed layer: `docs/system/ui-kernel.md`, `extension-model.md`, `architecture.md`,
  `page-capture-service.md`, `mobile.md`, `distribution.md`, `validation.md`.
- Neighbours: `BO_0312` (B1 moves here; B2 orders after this change), `BO_0285` (refinement does not
  ship) and `BO_0256` (the decision extension).
- Implementation closure includes the accepted graph changes, the graph export, and release notes
  only if something a release ships changes in a way a person notices. None of the four ships, so
  the removal alone needs no line; whether removing refine's hooks from `documents` and `ui.shell`
  does is measured at draft.

## Transferred

Promoted to draft by the user on 2026-10-01. Three questions came up while measuring and were
answered the same day (`BO_0324_Q5`–`BO_0324_Q7`). The change's graph copy is a member of
`documents`, which holds most of what is left behind and the migration.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Refine, Show, Video And Test Are Removed* (new): `BO_0324_001` the
  document tools lose the `kind`, `derive` and `phase` items and what `read_document` answered for
  them, with the sections and fixed lines that described them; `_002` the migration's deletes pass
  the gate; `_003` the harness's vocabulary copy, the extension state and the Go fixtures; `_004`
  verification and the rebuild.
- `docs/system/extension-model.md`: `BO_0324_005`, the lines about refine's vocabulary and
  category.
- `docs/system/architecture.md`: `BO_0324_006`, capture and search described as any run's tools,
  with `page-capture-service.md` and `search-service.md`.
- `docs/system/mobile.md`: `BO_0324_007`, the fixed line naming what retires with `BO_0308`
  corrected, its meaning unchanged.
- `docs/system/distribution.md`: `BO_0324_008`, refine's entry leaving `release-extensions.json`
  and the refine lines; `_009`, the release line.

### The graph

- `documents`' `docs/system/system.md`, *Refine, Show, Video And Test Are Removed* (new): the
  decisions; `BO_0324_010` the migration; `_020` claims and judgements; `_021` block kinds;
  `_022` derived blocks; `_023` the root's phase; `_024` depth; `_025` the intention's marking;
  `_026` refine's leftovers in the editor, the harness and the suites; `_060` verification, walk
  and close.
- `relations`' `docs/system/system.md`: the two fixed lines `BO_0324_Q5` and `BO_0324_Q6`
  reverse rewritten; `BO_0288_016` and `BO_0288_019` narrowed; `BO_0288_028` and `BO_0288_029`
  removed into `BO_0324_023` and `BO_0324_020`; `BO_0324_030` the declarations that leave;
  `BO_0324_031` the docs' truth; the open question on reading relations back.
- `ui.shell`'s `docs/system/system.md`: `BO_0324_040`, the frame's traces of refine and video.
- `calliopa-show`, `calliopa-video`, `calliopa-refine` and `test`: `BO_0324_050`–`_053`, each
  extension's removal, in its own `system.md`. `_050` replaces `BO_0312_051`.
- Staged from a checkout at head 3467. It stays out of every file `BO_0312`'s waiting bundles
  touch (`documents`' `block-document-model.md`, `block-editor.md` and `document-panel.md`,
  `ui.shell`'s `contribution-contract.md` and `contract.ts`, `BO_0312`'s graph copy), so those
  bundles still stage. The tasks name those files, and implementation rebases on whatever lands
  first.

### Technical decisions taken at transfer

- One migration, an executable `ext.migration` of `documents` (`BO_0312_001`), deletes the data
  of all four and of the phase, since the extensions that declared most of it are gone by the time
  it runs. It deletes the way `BO_0312_002` retires a dropped extension's content: closed out of
  truth, with history kept in the revisions.
- The implementation lands as one proposal group: the four extensions' removal, the migration,
  and the trimming of `documents`, `relations` and `ui.shell`. Refine's suites import `documents`,
  and `documents`' harness calls refine's routes, so neither half builds alone.
- `calliopa-show` goes in this group, so `BO_0312`'s B1 is not staged and its B2 (`publishing`)
  orders after this change.
- Refine's `ship: false` entry leaves `release-extensions.json`. No release carried it and no
  install holds it, so there is nothing to retire.
- The `ext.intention` member type and the run intake's `intention` stay the fixed layer's
  (`BO_0142`). Only refine's declaration, and the marking surface that offered it, go.
- `focuses` (focused work), the `relate`, `reason` and `state` items, and the decoration slot stay.


## Implementation

Set to ready by the user on 2026-10-01 and started the same day.

- `calliopa-show` was removed first, in a proposal of its own (`BO_0324_050`, user decision,
  2026-10-01), so that `BO_0312`'s B2 no longer waits on the rest.
- The rest lands as two proposal groups rather than one. The migration has to run while the types
  it deletes are still declared, and a graph's validation refuses removing a declaration while
  live content of it exists. So the first group carries only the migration (`BO_0324_010`); once
  it is accepted and pinned, the kernel runs it. It was accepted as `node:chg-45025f3efb52dbf1`
  and pinned at 3669, and the kernel ran it at dataRevision 3673: afterwards the graph holds no
  `claim`, `judgement` or `relation` node, no active `derivedFrom` edge, no investigation, and no
  `kind`, `phase`, `acceptedAt` or `refine` intention on any block or document. The second group carries the removal of refine,
  video and test, the trimming of `documents`, `relations` and `ui.shell`, the declarations that
  leave, and the skill revisions.
- The fixed layer's half is done in this repository: the document tools, the harness's vocabulary
  copy and fixtures, `release-extensions.json` and the docs (`ui-kernel.md` `BO_0324_001`–`_003`,
  `BO_0324_005`–`_009`). `BO_0324_004` waits for the image rebuild and the walk.
- The second group was rebased on 2026-10-01 onto head 3658 with the first group applied, after
  `publishing`'s removal (`BO_0312`'s B2) had landed beneath it. Its members sidecar is
  authoritative for `calliopa-refine`, `calliopa-video`, `test`, `documents` and `relations`, so
  their dropped members retire with it: refine's and video's all, `BlockKind`, `RootPhase` and
  `derivedFrom` in `documents`, `policy`, `acceptedBy` and the three phase values in `relations`.
  It revises `text`, `document`, `relation`, `source` and `target`, and the skills
  `ui.shell.documents` and `calliopa-base.working`, which still taught the claim, kind, derive and
  phase items.
- With `calliopa-video` gone no extension contributes a channel; `settings`' `channels.md` says so
  and leaves the unused `channel` party kind as an open task there.
- The first group (`chg-45025f3efb52dbf1`) was pinned at 3669 and the kernel ran the migration at
  3673. The second (`chg-5cc0b50ca9369e17`) was accepted at 3690 after a first staging was refused
  as a breaking schema change, since relations of the removed types still counted as active on
  nodes earlier writes had retired; its sidecar revised the migration to cover them. Pinned at
  3698; app, kernel and hermes were rebuilt, and the walk passed (`documents`' `BO_0324_060`,
  `ui-kernel.md` `BO_0324_004`). Completed 2026-10-01.
