# One Role Type With Fields

Status: completed

Part 1 of 5 of `BO_0308` (roles carry the structure). It is the foundation the other four
build on. Document roles and block roles become one role type. A role *offers* roles and a block
*takes* roles, several at once and to any depth. A role carries fields that hold values on the
block that takes it. *Keyword*, *Profile*, *Format* and *Source* exist as built-in roles; what
each one means lands in parts 2–5. This document shapes the change and authorizes no
implementation.

## What Is Asked

These are the decisions `BO_0308` fixed that this part carries. They are restated only as far as
this part needs them.

* A role is how data is structured. A block may carry several roles at once.
* A role *offers* roles, and a block *takes* a role, never *parent* and *child* (`BO_0308_Q1`).
* An offered role may offer roles in turn, to any depth. A block can take a role offered by a role
  on any block above it (`BO_0308_Q2`).
* A role carries fields, and a block that takes the role holds values in them. Field types: text,
  long text, number, date, true/false, choice from a list, a reference to a document or a block,
  and a file. A field can be marked required; a missing required value is shown on the block and
  never blocks a write (`BO_0308_Q3`).
* A run may propose role assignments and field values, which land only when the person accepts
  them. Assigning a role or entering a value directly is the person's own act, written as truth at
  once (`BO_0308_Q4`, reversing `BO_0299_Q6`).
* A proposed role or value is accepted or rejected with the run's other proposals, through the
  run's chip, as a document's proposals are. Until then the label shows it as *proposed*. User
  decision, 2026-09-30 (`BO_0309_Q4`).
* *Keyword*, *Profile*, *Format* and *Source* are built-in roles. They exist on every instance
  without being created, cannot be deleted, retired or renamed, and can be extended with offered
  roles and fields (`BO_0308_Q5`).
* Roles are managed in their own category in the left panel (`BO_0308_Q11`). In this part each
  built-in role lists the documents carrying it. Folding in the *Keywords*, *Profiles* and
  *Sources* categories is parts 2, 3 and 5.
* Roles are assigned from the block. The active block's command chip carries a role control
  beside the profile and the agent. A document's own roles are assigned from a chip under its title
  while the title is being edited, which carries only the role control. The document bar has no
  *Roles* control (`BO_0318_Q1`, `BO_0318_Q6`, folded in below).
* A role that no other role offers can be taken on any block. A role that some role offers can be
  taken only on a block under a block carrying an offering role, so *Definition*, offered by
  *Keyword*, is never offered on a plain paragraph. User decision, 2026-09-30 (`BO_0309_Q1`).
* Field values are edited in the chip's role control, under each applied role. The block itself
  shows only its role labels and a mark for a missing required value, and the inspector has no
  *Fields* section. User decision, 2026-09-30 (`BO_0309_Q2`, as revised by `BO_0318_Q2`).
* A role reaches a block by a suggestion, a typeahead limited to the takeable set, or the offer of
  the structure above. Suggestions show only in the opened control and use no model. A field may
  declare a default, filled in when the role is taken (`BO_0318_Q3`–`Q5`, `BO_0318_Q8`).
* The extension is renamed from `doc-block-roles` to `roles` if the kernel can migrate an
  extension id; otherwise the id stays and only what people see is renamed to *Roles*. Which one
  applies is measured at draft. User decision, 2026-09-30 (`BO_0309_Q3`).

## Where This Starts

- `doc-block-roles` as `BO_0308`'s *Where This Starts* describes it: `documentRole` and
  `blockRole` joined by `offers`, one `hasDocumentRole` per document, one `hasBlockRole` per block,
  no fields, reads only for runs. Its graph docs are
  `src/extensions/structures/docs/system/system.md`, and `documents`'
  `block-document-model.md`, *Document And Block Roles*.
- `keywords`, `profiles` and `manuscripts` read `rolesOf` and the catalogue. Their readers must
  keep working through this part, reading the new shape.

## Proposed Shape

- **One type.** `role` has `id`, `name`, `description`, `order`, `retired` and `builtin`, plus its
  field declarations. `offers` runs from a role to any role. `hasRole` runs from any block,
  including a document's root, to a role, and a block may have many. `documentRole`/`blockRole`
  and their assignments migrate one to one: a document role becomes a role taken on the document,
  a block role becomes a role its document role offers.
- **Fields.** A field declaration has `key`, `name`, `type`, `required`, `order`, and for a choice
  its options. A value is stored on the `hasRole` assignment, keyed by the field, so two roles with
  a field of the same name never collide. A file value is a blob reference, as an image block's
  bytes are. A reference value names a node id.
- **Built-ins.** Created idempotently when the extension is activated, marked `builtin`, and
  refused for delete, retire and rename in words. Their meaning is found in code by a fixed id,
  never by name.
- **Runs propose.** A new tool, `propose_roles`, stages an assignment or a field value into the
  run's group, and the person accepts it like any proposal. `read_document_roles` answers the
  new shape: several roles per block, with their values.
- **Surfaces.** The *Roles* category lists the roles, built-ins first. The role page adds a
  *Fields* editor and an *Offers* list that takes any role. On the active block, one *Roles*
  control lists the roles the block can take and toggles them. A block shows one label per role,
  and a missing required value is marked on the label.
- **Interface.** `rolesOf` widens to several roles per block with values and keeps every field it
  answers today, so readers do not break. The shape it answers is the extension's contract.

## Functional Questions

- None open. `BO_0309_Q1`–`BO_0309_Q4` are answered in What Is Asked.

## Acceptance Examples To Shape At Draft

- Given a fresh installation, the *Roles* category holds *Keyword*, *Profile*, *Format* and
  *Source*, each marked built in, with no delete, retire or rename control, and each able to take
  fields and offered roles.
- Given an instance with *Story* offering *Hook* and *Big Message* under today's model, after the
  upgrade *Story* is a role offering the other two, every document and block keeps the role it had,
  and `rolesOf` answers the same roles.
- Given the role *Blog post* with *Publishing date* (date, required) and *Position* (number), when
  a document takes *Blog post*, its label is marked as missing a value. Once a date is entered, the
  mark is gone and another person sees the date at once.
- Given a block carrying both *Keyword* and *Blog post*, it shows two labels, and each role's
  fields are kept apart.
- Given *Story* offering *Hook*, a paragraph two levels under a *Story* block can take *Hook*, and
  a block outside it cannot.
- Given a run asked to set the publishing date, it proposes the value. The value stands only once
  the person accepts, and the run cannot assign it directly.

## Boundaries And Source Documents

- Graph: `doc-block-roles`' `system.md`; `documents`' `block-document-model.md` and
  `block-editor.md`; `keywords`', `profiles`' and `manuscripts`' `system.md`, as readers of
  `rolesOf`; `ui.shell`'s `workspace/contribution-contract.md` for the inspector and the bar.
- Fixed layer: `docs/system/ui-kernel.md` for proposals staged by an extension tool and for the
  kernel harness's vocabulary copy (`internal/kernel/serve/testdata/documents-vocabulary.json`);
  `docs/system/extension-model.md` for migrating a declaration; `docs/system/distribution.md` if
  the extension id changes.
- The owning extension is `doc-block-roles` (or `roles`). This document is carried into its
  `docs/changes/` no later than its completion. Release note: *Changed*, for the roles migration
  and the new surfaces.

## Transferred

Promoted to draft by the user on 2026-09-30 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Profiles* (beside the harness copy's `BO_0299` line):
  `BO_0309_001`, the harness's vocabulary copy and the tripwire's count.
- `docs/system/distribution.md`, *The Release Names Its Extensions*: the id staying
  `doc-block-roles` as truth, and `BO_0309_002`, the release line under *Changed*.

### The graph, staged 2026-09-30

- Staged from a fresh checkout at head 3200 as `node:chg-87d5656f92b0380e`: four files, tasks
  only, zero removals. A first staging, `node:chg-0183eb06acafe4f0`, glued a line to `keywords`'
  last line and is to be rejected. Both are in `docs/changes/scratchpad.md`.
- `doc-block-roles`' `system.md` gains *One Role Type With Fields*: the decisions, the technical
  decisions below, `BO_0309_010`–`BO_0309_019`, and the question `BO_0309_Q4`.
- `documents`' `block-document-model.md`, *Document And Block Roles*: the pointer and
  `BO_0309_031`, the view drawing the inspector place.
- `keywords`' `system.md`: `BO_0309_020`, reading through the one role type until `BO_0310`.
- `ui.shell`'s `workspace/contribution-contract.md` gains *A Place In The Inspector* with
  `BO_0309_030`. The inspector's facts are the view's own and not an extension's to widen
  (found in `BO_0301`), so the *Fields* section needs a place of its own.
- This document is carried into `doc-block-roles`' `docs/changes/` at its status by `BO_0309_019`.

### Technical decisions taken at transfer

- The id stays `doc-block-roles` (`BO_0309_Q3`'s *if migratable*): the kernel has no
  extension-id migration, and the id keys block ids, paths, the release list and extension state.
- `blockRole` is the one role type and `hasBlockRole` the one assignment, so no node changes its
  label. The document's own role is a `hasBlockRole` from the `document` node. `documentRole` and
  `hasDocumentRole` are migrated into them and then dropped with an `ext.migration`.
- Field declarations are an ordered `fields` list on the role, each with a key minted once.
  Values live on a `roleFields` node per block and role (`fieldsOf`, `fieldsFor`), because
  relations carry no properties.
- A run's proposal is the `propose_roles` extension tool's statements, staged into its group by
  the kernel as today. Nothing in the kernel moves beyond the harness copy.
- How the built-ins reach an instance, as manifest members or through an idempotent ensure, is
  measured first in `BO_0309_014`.

### Answered after staging

- `BO_0309_Q4` was answered on 2026-09-30, after `node:chg-87d5656f92b0380e` was staged: with the
  run's group, the label showing *proposed* until then. The graph still carries it as `[ ]`, and
  the implementing proposal folds it into `BO_0309_016`'s truth rather than restaging the
  transfer.

### `BO_0318` folded in, 2026-09-30

The user set this change back to `draft` on 2026-09-30 so that `BO_0318` (roles from the block)
could be folded in (`BO_0318_Q1`). As a result, the bar control and the inspector section are never
built. The title is the view's headline, not a block, so it has no command chip. The user decided
the same day that a chip under the title carries the role control alone.

- Staged from a fresh checkout at head 3267 (rebased; the first staging, `node:chg-9ec9f26f68e42f6e` from 3248, was refused at accept and has been rejected) as `node:chg-dce2d3394060b255`, accepted by the user on 2026-09-30: three files, zero
  added or removed. The accept is in `docs/changes/scratchpad.md`.
- `doc-block-roles`' `system.md` carries the new decisions, and `BO_0309_Q4` is folded into a
  decision.
  - `fields` gains `default?`.
  - `BO_0309_013` writes defaults on taking.
  - `BO_0309_015` removes the bar group.
  - `BO_0309_021` is new: the role control as a `command` block decoration (`BO_0273_009`'s
    place), with pills, fields, suggestions and the typeahead, also contributed to the title.
  - `BO_0309_022` is new: the suggestions as a pure `lib/suggest.ts`.
  - `BO_0309_017` and `BO_0309_018` follow these changes.
- `ui.shell`'s `contribution-contract.md`: *A Place In The Inspector* becomes *A Place Under The
  Title*, and `BO_0309_030` now opens a `title` document place.
- `documents`' `block-document-model.md`: `BO_0309_031` draws that place in a chip under the
  headline while the title is being edited.
- The role control needs no `setOption` (`BO_0311_030`). A role is written as truth at once and
  never travels with the command.

## Implemented

Set to `ready` by the user on 2026-09-30 and implemented the same day, at `wip`.

- The graph half is in `doc-block-roles`, `keywords`, `documents` and `ui.shell`, with the
  members the vocabulary, the two migrations, the two tools and the skill take. Its truth is
  `doc-block-roles`' `system.md`, *What This Extension Holds*. This document is carried into
  `doc-block-roles`' `docs/changes/` at `wip` in the same proposal.
- The repository half is the harness's vocabulary copy and the tripwire at 31 (`BO_0309_001`,
  `ui-kernel.md`).
- Technical decisions taken in implementation:
  - A node never changes its type, so each document role becomes a new `blockRole` that carries
    its old id as `formerId`.
  - The built-ins arrive by an executable migration, not as members, so a release never writes
    over fields a person added to them.
  - `documentRole` and `hasDocumentRole` stay declared until every install has migrated
    (`BO_0309_023`).
  - A file value's blob reference is hoisted to a top-level `files` list on the `roleFields`
    node.
  - The title's chip holds its own state, and the two states share each write's answer through an
    event on the page.
- Verified: unit and behaviour suites green; five mutations each failed a test.
- Accepted as `node:chg-74837c50d7127e52` and served at pin 3300, where both migrations ran once.
  The release line stands under *Changed* (`BO_0309_002`).

## Walked And Completed

The user walked it on the served build between 2026-09-30 and 2026-10-01. The walk found two
things, and both were fixed the same day:

- *Big Message* was offered to a block carrying *Story* itself, and to a *Story* document's own
  chip. `BO_0309_Q1` says an offered role can be taken only *under* the offering block; the first
  build counted the block's own roles. Fixed in `node:chg-beeb1de29b08bf5c` (pin 3363).
- A *Story* block's focused work did not show *Story* in its header, and its blocks could not take
  *Hook*. The user decided that a block's focused work stands under the block: its roles, and those
  above it, are above the focused work and its blocks, and its header shows them. A document's own
  roles now show under its title while reading. Fixed in `node:chg-f16cd6a30f021d39` (pin 3387).

After both fixes, the user's word was "all works". The change completed on 2026-10-01; its graph
copy stands in `doc-block-roles`' `docs/changes/completed/`.

Still open in `doc-block-roles`' `system.md`: dropping the old declarations a release later
(`BO_0309_023`), and a reference field chosen by title (`BO_0309_024`). `RO_0001`, another change
at `draft`, asks for the focused-work behavior this change's second walk fix delivered.
