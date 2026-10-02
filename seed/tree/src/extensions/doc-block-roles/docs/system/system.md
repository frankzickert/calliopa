# Roles

## Purpose

- This document is the entry point of `doc-block-roles`, the extension that lets a person
  structure what they write with roles: a block takes roles — a document, the root block of its
  reading order, takes them the same way — a role offers roles to the blocks under it, and a role
  carries fields whose values the block holds. A *Story* offers *Hook* and *Closing*; a *Blog post*
  carries a publishing date and a position (`calliopa-bootstrap`'s `BO_0299`, requested and
  decided by the user on 2026-09-25, and `BO_0309`, part 1 of `BO_0308`, with `BO_0318` folded in,
  2026-09-30). Roles are read by other extensions, by the browser and by a run.
- It is `bundled` and active on a fresh install. No person's role ships, since instance content
  never travels (`BO_0299_Q1`); the built-in roles are created on every instance by a migration.
  Its release lines are `calliopa-bootstrap`'s `distribution.md` (`BO_0299_001`–`BO_0299_002`,
  `BO_0309_002`).
- It depends on `documents`, whose document and blocks the roles attach to and whose editor draws
  the pills, the chip's control and the place under the title
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#document-and-block-roles)),
  and on `ui.shell`, whose frame it contributes into. In the fixed layer only the kernel harness's
  vocabulary copy moves for it (`ui-kernel.md`, `BO_0299_018`, `BO_0309_001`): the kernel lists an
  active extension's `ext.tool` members and answers them through the callback, and runs its
  executable migrations, as for every extension (`BO_0264_007`, `BO_0312_003`).
- The id stays `doc-block-roles` and the category is *Roles* (`BO_0309_Q3`: rename *if
  migratable*). The kernel has no extension-id migration, and the id keys block ids, materialized
  paths, the release list and each install's extension state.
- Its change documents carry the prefix `RO`. An `RO` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* A role is how data is structured. A block may carry several roles at once, each shown as its
  own applied role. A role *offers* roles and a block *takes* a role, never *parent* and *child*.
  User decisions, 2026-09-30 (`BO_0308_Q1`, `BO_0318`).
* An offered role may offer roles in turn, to any depth, and a block can take a role offered by a
  role on any block above it at any depth, not only on the block directly above it
  (`BO_0308_Q2`). A role that no other role offers can be taken on any block. A role that some role
  offers can be taken only on a block under a block carrying an offering role — never on the block
  carrying it — so *Definition*, offered by *Keyword*, is never offered on a plain paragraph
  (`BO_0309_Q1`).
* A role carries fields: text, long text, number, date, true/false, choice from a list, a
  reference to a document or a block, or a file. A field can be marked required; a missing required
  value is shown on the block and never blocks a write (`BO_0308_Q3`). A field may declare a
  default value, filled in when a block takes the role, which the person can change; no role is
  ever taken automatically (`BO_0318_Q8`).
* Anyone who can edit documents creates and revises roles, written as truth at once with no
  proposal (`BO_0299_Q2`). Taking a role or entering a value directly is the person's deliberate
  act, written as truth at once and shared. A run may propose roles and values, which land only
  when the person accepts them with the run's other proposals, through the run's chip; until then
  the pill says *proposed* (`BO_0308_Q4`, reversing `BO_0299_Q6`; `BO_0309_Q4`).
* Roles are defined in the *Roles* category: their fields, what they offer, and their defaults. A
  role is never assigned there. Each built-in role lists the documents carrying it
  (`BO_0308_Q11`, `BO_0318`).
* A role is assigned from the block. When a block is being edited, a chip of its own carries the
  block's roles: each role taken as a pill, which opens its fields when pressed, and a `+`, which
  opens the typeahead and the suggestions. It stands in the command chip's row, aligned right, when
  the row has room for both, and on the next row, still at the right, when it has not (user
  decision from the walk, 2026-10-01, replacing `RO_0002_Q4`'s left edge below). It is drawn
  whenever the command chip is — on a block with no roles it holds only the `+` — and what it opens
  opens below it. On a phone what it opens, and what the header's roles line opens, is a sheet from the
  bottom of the screen over the dimmed page, which a tap on the page or a swipe down closes and
  which rides above the keyboard (user decisions from the walk, 2026-10-01). The person adds and removes the block's roles there and
  edits their fields there, under each applied role. The command chip carries no role control; the
  profile stays in it, since it chooses how the command runs (`RO_0002_Q1`, `RO_0002_Q2`,
  `RO_0002_Q6`, `RO_0002_Q8`, user decisions 2026-10-01, replacing the role control in the command
  chip). A document's own roles are assigned from the
  roles line of its header, under its title, whose control is always drawn — its pills and a `+`,
  as the block's chip (`DO_0030_Q2`, user decision 2026-10-01, replacing *while the title is being
  edited*). The
  document bar has no *Roles* control and the inspector no *Fields* section (`BO_0318_Q1`,
  `BO_0318_Q2`, `BO_0318_Q6`, replacing `BO_0299_Q7`'s bar and `BO_0309_Q2`'s inspector).
* A role reaches a block in three ways: suggested from the block's content, picked in a typeahead,
  or offered by the structure above. The typeahead lists only the roles the block can take where it
  stands (`BO_0318_Q5`). Suggestions show only inside the opened control; they are built from the
  structure and the block's words, with no model and no cost, and one not taken leaves nothing
  behind (`BO_0318_Q3`, `BO_0318_Q4`).
* A block's roles are visible while reading, as small pills at the block (`BO_0299_Q7`). The pills
  stay while the block is being edited, beside the roles chip below it (`RO_0002_Q3`).
* A block's focused work stands under that block: the roles of the block it was opened from, and
  of everything above that block, are above the focused work and its blocks, so a *Story* block's
  focused work lets its blocks take *Hook*. Its header shows those roles, from above, beside the
  document's own. User decision, 2026-10-01, from the walk.
* A role taken while an offering role stood above stays when that role goes, and says it is not
  offered; the person clears it or leaves it (`BO_0299_Q3`).
* A role is retired, never deleted: nothing offers it any more, its assignments stay and say so
  (`BO_0299_Q4`).
* Every block in the reading order can take a role that allows blocks (`BO_0299_Q8`). A role says
  whether blocks may take it, one switch; the document may always take a role, and no role is
  allowed on blocks but not on the document. A role a person creates allows blocks. User
  decisions, 2026-10-01 (`calliopa-bootstrap`'s `BO_0332`, `RO_0003_Q1`, `RO_0003_Q4`).
* *Keyword*, *Profile*, *Format* and *Source* are built in: on every instance without being
  created, never deleted, retired or renamed, and extended with offered roles and fields like any
  role (`BO_0308_Q5`). They are taken by documents alone, and that setting is the release's, as
  their names are (`BO_0332`, 2026-10-01). What each one means is `BO_0310`–`BO_0313`'s.
  *Definition* and *Alias*, offered by *Keyword*, allow blocks.
* A block that carries a role blocks may not take — one of the four, or a role switched to
  document only while blocks carry it — keeps it, and its pill says it is not allowed on a block,
  as a role no longer offered says so; the person clears it or leaves it. Nothing is migrated,
  removed or moved. User decision, 2026-10-01 (`RO_0003_Q3`).
* An offer never overrides the setting: a document-only role offered by a role above (*Hook* under
  *Story*) is never taken by a block; a document under the offering block — its focused work —
  takes it in its own chip, and the role page says so beside such an offer. User decision,
  2026-10-01 (`RO_0003_Q5`).

- The word *role* is taken on a text block — `text.role` is the typographic role — so the type
  keeps the name `blockRole`, and a run's document read keeps answering the typographic one as
  `role`. The surfaces say *role*.
- The vocabulary (`BO_0309_010`, landed 2026-09-30, staged through `kernel commit --members`):
  `blockRole` is the one role type, a root node requiring `id`, `name` and `order` and permitting
  `description`, `retired`, `builtin`, `fields` and `formerId`. `fields` is an ordered list of
  `{key, name, type, required, options?, default?}`; `key` is minted once and never changes, so a
  rename keeps every value. `offers` runs from any role to any role; `hasBlockRole` from the
  `document` node or any block in its reading order to a role, several per subject. Relations carry
  no properties, so values live on a `roleFields` node, one per subject and role, requiring `id`
  and `role` (the role's id, read in the same read as the values) and permitting `values`, keyed by
  field `key`, and `files`, joined by `fieldsOf` to the subject and `fieldsFor` to the role. A file
  value names `{hash, filename, mediaType, size}` in `values`; its blob reference stands in the
  top-level `files` list, since CCGW keeps a blob alive only from a top-level property
  (`binary-content.md`). A reference value is a node id. An `ext.relationtype` fences neither end
  and every block kind is `documents`' declaration, so any block and the document take roles
  under the one dependency. `documentRole` and `hasDocumentRole` stay declared, read by the
  migration alone. `lib/roles.ts` names the types and the shapes.
- The migration (`BO_0309_011`, landed 2026-09-30; `server/migrations.ts`, the member
  `migration-bo-0309-one-role-type`): an executable `ext.migration` with the route
  `kernel/migrations/one-role-type`, which the kernel runs once per instance when it serves the
  pin carrying it (`calliopa-bootstrap`'s `BO_0312_001`, `BO_0312_Q7`). A node never changes its
  type (CCGW refuses `node_type_change`), so each `documentRole` becomes a new `blockRole` carrying
  its name, description and retired flag, placed after the roles already there, and `formerId`, the
  id it had; each `offers` from it and each document's `hasDocumentRole` to it are closed and
  related again from and to the new role, and the old node is retired. Block roles keep their ids
  and assignments. A reader still holding a former id — `keywords`' settings, a role page open in a
  tab — finds the role by it through the catalogue. An instance with no document role answers an
  empty statement.
- The built-ins (`BO_0309_014`, landed 2026-09-30; the member `migration-bo-0309-builtin-roles`,
  route `kernel/migrations/builtin-roles`): the fixed ids `builtin:keyword`, `builtin:profile`,
  `builtin:format` and `builtin:source`, with `builtin: true` and orders 0–3. The migration creates
  those an instance does not hold and answers nothing when it holds them all. Measured against the
  other path: as manifest members they would ship with the release, but the members sidecar writes
  a member's release content over a person's revision, so fields a person added to a built-in
  would be lost at the next update; a migration creates them once and never touches them again.
  Rename, retire and restore on a built-in are refused in words (`builtinRole`); description,
  fields and offers are open.
- The catalogue and the acts on a role (`BO_0309_013`, landed 2026-09-30; `server/roles.ts`,
  `contributions.server.ts`): `readCatalogue` reads the roles by type and, rooted at them, the
  `offers` hop — the rooted hop being where a read answers relations — and answers each role with
  its fields, what it offers and what offers it, built-ins first, then the person's order.
  `createRole` mints one, placed last. `reviseRole` takes one act — `rename`, `describe`,
  `retire`, `restore`, `offer`, `unoffer`, `addField`, `reviseField` (name, type, required, a
  choice's options, a default of the field's type, a changed type dropping a default that no
  longer fits), `removeField`, `moveField` — each one truth write outside any branch, and answers
  the role as it stands. A field removed keeps its stored values, unread. `GET
  /api/x/doc-block-roles/roles` is the catalogue (also `readers.roles`, the section's), `POST
  …/roles` creates, `GET …/roles/[id]` reads one, `POST …/roles/[id]` posts an act, parsed by
  `parseRoleCommand` and refused in words when it is not one, and `GET …/roles/[id]/documents`
  answers the documents carrying a role as their own (`documentsCarrying`). A role's id in a route
  is a record id or a built-in's.
- Taking and values (`BO_0309_012`, `BO_0309_013`, landed 2026-09-30): `rolesOf(documentId,
  {branch?, dataRevision?})` answers the `DocumentRolesView` — the document's own `roles` and
  `takeable`, and per block in reading order, a callout's children after the callout with their
  `parentId`, its `roles` and `takeable`. A taken role is `{id, name, description, retired,
  builtin, offered, fields, values, missing, proposed?}`. What a subject may take is every
  unretired role no role offers, plus every unretired role offered by a role taken above it: on the
  callout it stands in, on the document, or above the document when it is a block's focused work.
  A role on a block is never offered to that block itself. Found in the walk, 2026-10-01: the first
  build counted the subject's own roles, so a block carrying *Story* — and a *Story* document's own
  chip — was offered *Big Message*. Above a document (`readInherited`, the same day): when the
  document is a block's focused work (`focusOf`, the `focuses` edge), the roles taken on that block,
  on the callout and the document it stands in (`CONTAINS`), and on up the chain while that
  document is focused work in turn, nearest first, stopping after 16 steps or at a document met
  twice. `rolesOf` answers them as `inherited`, `{id, name, description, on, document}`, and
  `read_document_roles` answers them and says the document is the focused work of a block carrying
  them. A focus that cannot be read is no focus. Read as truth, `rolesOf` also marks what open
  groups propose on the subjects (`reachingGroups`): a staged `hasBlockRole` as a role `proposed`,
  a staged or revised `roleFields` as values `proposed`; read at a run's pin it marks nothing. `POST
  …/documents/[id]/roles` and `…/documents/[id]/blocks/[blockId]/roles` take `{role, taken}`, and
  `…/roles/[roleId]/fields` on either takes `{values}`, each written as the signed-in person's
  truth outside any branch and answering the document's roles. Taking relates the role and writes
  its defaults beside any value already stored; clearing closes the relation, naming its vantage
  (`hFrom`) as a bare close must, and keeps the values, so taking the role again finds them. A value
  is read against its field's type, a reference checked to name a node that is there. Each refusal
  is in words: a document that is not there, a block not in its reading order, a role that is not
  here, is retired or is not offered where the subject stands, a value for a role the subject does
  not take, a key the role does not declare, a value not of its type. A write refused by the
  kernel's per-node floor is tried once more after 300ms.
- The interface for extensions (`BO_0299_016`, widened by `BO_0309_012`): an extension declaring
  `doc-block-roles` as a dependency imports `server/roles.ts` — `rolesOf`, `readCatalogue`,
  `listRoles`, `readRole`, `documentsCarrying` — directly, one process and no HTTP hop. The shape
  `rolesOf` answers is the extension's contract: widening it is an ordinary change, and a field is
  never renamed under a reader. The single-role fields it answered before (`documentRole`,
  `blockRole`) went in the proposal that moved `keywords`, their one reader (`BO_0309_020`).
- The agent's tools and skill (`BO_0309_016`, landed 2026-09-30; `server/tools.ts`, the members
  `doc-block-roles.read_document_roles`, `doc-block-roles.propose_roles` and
  `doc-block-roles.roles`): `read_document_roles {document}` answers `rolesOf` at the run's pin,
  each role with its fields and their values as a person reads them, what is missing, and per
  block what it can take, with a note saying how to propose; it stages nothing. `propose_roles
  {document, block?, take?, clear?, values?}` answers the statements the person's own acts would
  write, which the kernel stages into the run's group (`BO_0264_007`), refused `422` in words where
  the person's act would be. A role taken with values in the same call is written as one
  `roleFields` node, its defaults beside the values. The skill says to read the roles first, to
  write each block by its roles with a role's description outranking the word, to rewrite the block
  that already carries a role rather than insert a second (`roledBlockIsThePlace`), to propose a
  role or a value when the command asks for it or when the words say a missing value, and that a
  role or value the person set is rewritten only on the person's word. The skill reaches every run,
  since a run reads the skills of every active extension that offers it a tool
  (`calliopa-bootstrap`'s `BO_0299_003`).
- The Roles category and the role page (`BO_0309_015`, landed 2026-09-30; `views/section.tsx`,
  `views/role-page.tsx`): a section under *Roles*, Phosphor `tag`, listing the unretired roles,
  the built-ins first and marked *built in*, each opening as the kind
  `doc-block-roles:documentRole` — the name the kind had before one role type, kept because a
  workspace's open tabs are stored under it — with its own `+` (`data-new-role`) creating *Untitled
  role* and opening it. A built-in's row unfolds (`data-unfold-role`) to the documents carrying it,
  each opening as itself. The page edits the name (not a built-in's), which renames the tab and the
  library entry, and the description; retires and restores (not a built-in); lists the fields, each
  renamed, retyped, marked required, given a choice's options and a default, moved and removed,
  and adds one by name and type; and lists what the role offers, each taken back by its ×, with a
  choice offering any other unretired role, and says what offers it. Every act posts as it is made
  and the page shows what the route answered; a refusal is shown on the page in the route's words.
- The role control (`BO_0309_021`, landed 2026-09-30; `views/control.tsx`, `BlockRoleControl` and
  `TitleRoleControl`): for a block, the `underCommand` block decoration, drawn in the roles chip
  `documents` stands in the command chip's row (`RO_0002_004`, landed 2026-10-01); for the document,
  the same control in its `title` place (`ui.shell`'s `BO_0309_030`, drawn by `documents`,
  `BO_0309_031`). The block's form (`data-role-form="pills"`) shows at rest one pill per role taken
  (`data-chip-role`, `.block-role`, 24px tall) — the role's name, the `!` and the missing fields in
  its title when a required value is missing, and *not offered*, *retired*, *proposed* or *values
  proposed* beside it, as `label.tsx`'s `pillNote` and `pillTitle` say them while reading — each
  opening the popover unfolded at that role, then a round `+` (`data-roles-add`, *Add a role to
  this block*) opening it on the typeahead and the suggestions; on a block with no roles the `+`
  alone. A second press on what is open closes it (`aria-expanded`). The title's control takes the
  same form, its `+` named *Add a role to this document* (`DO_0030_004`). Every press keeps the caret where it is
  (`preventdefault:mousedown`) and opens, beside the control where *The Popover Fits The Screen*
  places it — a block's chip ending at its right edge, since the chip stands at the right of the
  row, and the title's starting at its left, since the roles line starts at the header's edge —
  a popover (`data-roles-popover`) holding, first, the roles
  taken, each a pill with its own × (`data-clear-role`) that unfolds to its fields, one input per
  type — a text box, a text area, a number, a date, a checkbox, a choice, a node id for a reference,
  a file uploaded through `documents`' `POST /api/x/documents/blobs` — each value posted on commit
  (change: blur or Enter), never on *Send*; then the suggestions (`data-suggested-role`), each taken
  with one press; then a typeahead (`data-role-query`) over the roles the subject can take and does
  not, narrowed by every word typed, Enter taking the first. A role just taken opens on its fields.
  A refusal is said beside the control in the route's words (`data-role-refusal`). Its keys and
  input stay its own, so the editor's keys never act on them. The provider's state is shared with
  every block's control; the title stands outside the document's decoration provider, so its place
  holds a state of its own, read when the chip is first shown, and each write's answer is announced
  on the page (`doc-block-roles-changed`) so the other state takes it: a document's role taken
  under the title offers its roles to the blocks at once.
- The sheet on a phone (after the walk, 2026-10-01; `views/control.tsx`, `roles.css`): under
  `max-width: 640px` the popover is fixed to the bottom of the screen at full width, its top corners
  rounded, over `.role-control__backdrop` (`data-roles-backdrop`), a fixed dimmed layer under it whose
  press closes the popover and keeps the caret (`preventdefault:mousedown`). Both stand in the
  browser's top layer (*The Popover Fits The Screen*), so the dimmed layer covers the shell's bars
  too. Its first child is a
  handle (`data-roles-handle`): a touch dragged down moves the sheet with the finger
  (`--roles-sheet-drag`), and let go past 80px closes it, sooner it settles back. While it is open
  the control follows the page's visual viewport, where the browser has one, and sets the sheet's
  bottom (`--roles-sheet-bottom`) above what the keyboard covers and its room
  (`--roles-sheet-room`) to what stays visible. Its touches stop at the sheet and the backdrop, so
  nothing beneath reads them as a swipe or a pinch. Backdrop and handle are hidden on wider
  screens, where the popover stays under the control. Proven in `views/views.test.ts`: the dimmed
  page closing it; a short swipe settling back and a long one closing it. Raising the threshold
  and dropping the backdrop's press each failed a test.
- The suggestions (`BO_0309_022`, landed 2026-09-30; `lib/suggest.ts`): a pure function with no
  dependency on `keywords`, which depends on this extension. A role offered by a role on the block's
  callout or the document scores by how near the offer stands; the block's words — the
  title's and the first block's for the document — are lowercased, cut at everything that is not a
  letter or a digit, common words dropped, and matched against a role's name (six), description
  (two) and field names (one), a word matching another when either begins with the other and both
  have four letters or more. At most three roles the block does not carry, nothing when nothing
  scores; computed in the browser when the control opens, stored nowhere. Measured on the
  prefixes: *post*/*posts* and *publish*/*publishing* match without a stemmer, so none was added.
- The pills while reading (`BO_0309_021`; `views/label.tsx`, a `headline` block place): one pill
  per role at a block carrying any, `.block-role`, words rather than a glyph, a `!` when a required
  value is missing and the missing fields in its name, and *not offered*, *retired*, *proposed* or
  *values proposed* beside the name. Pressing a pill asks the roles chip standing under the block,
  once the press has started editing it, to open at that role. The pills stay while the block is
  being edited (`RO_0002_Q3`). Under the title the document's roles stand in the header's roles
  line ([The Document Header](#the-document-header)).
- The bar's *Roles* group and its two choices went (`BO_0309_015`): nothing of this extension is in
  the document bar.
- Verified 2026-09-30 (`BO_0309_017`, the unit and behaviour parts): `views/views.test.ts` in Qwik's
  render harness — the section with the built-ins first and a built-in unfolding to its documents;
  the pills with several roles, the missing mark, *proposed* and *not offered*; the control opening
  on the roles taken, the typeahead limited to what the block can take and narrowed by what is
  typed, a role taken with a press and opening on its fields, a suggestion from the structure and
  the words taken with one press, a role cleared by its ×, a field's value posted on commit, a
  refusal said, a pill opening its role; the title's control taking the document's role and
  announcing the answer. `lib/suggest.test.ts` for the ranking; `server/api.test.ts` for the acts,
  the takeable set to depth, values by type, defaults, the missing keys and the migration's
  statement; `server/tools.test.ts` for the tools' input. `tests/behavior/roles.test.ts` over CCGW
  under the kernel harness — offers and fields in the catalogue; several roles on one block, one
  offered from the document, and a role a block carries never offered to that block nor to its
  sibling, nor *Hook* to the *Story* document itself; a role left *not offered* and
  offered again; a same-named field on two roles kept apart, a default filled in on taking, values
  refused by type and kept across clearing; the built-ins created once, refused a rename and taking
  a field; the migration from a document role; `propose_roles` staged, one `roleFields` node, and
  nothing standing before acceptance; the tool's answer. `keywords`' suites green over the one role
  type. Five mutations — the offering rule, the missing mark, the structure's score, the
  typeahead's narrowing, a pill's role — each failed a test. `tsc --noEmit` clean.
- Walked by the user on the served build, 2026-09-30 to 2026-10-01 (`BO_0309_018`, pins 3300 to
  3387): the migrations ran once (`migration-bo-0309-builtin-roles` at revision 3302,
  `migration-bo-0309-one-role-type` at 3303); *Story* and *Keyword*, the instance's two document
  roles, stood as roles of the one type with their former ids, the block roles kept theirs, no
  document role was left, and the four built-ins were listed first. The walk found two things,
  fixed the same day: *Big Message* was offered to a block carrying *Story* and to a *Story*
  document's own chip, since the first build counted a subject's own roles (pin 3363); and a
  *Story* block's focused work neither showed *Story* in its header nor let its blocks take
  *Hook*, since roles were read inside one document alone and a document's own roles were drawn
  only while its title was edited (`readInherited` and the line under the title, pin 3387). After
  both, the user's word: "all works".
- Closed 2026-10-01 (`BO_0309_019`): the release line under *Changed* is `calliopa-bootstrap`'s
  `BO_0309_002`, and this change's document stands in `docs/changes/completed/` at `completed`.
- [ ] BO_0309_023 Drop the `documentRole` and `hasDocumentRole` declarations with an
      `ext.migration` naming them, once every install has run `migration-bo-0309-one-role-type`:
      a release after the one carrying it, since an install that skips a release runs the
      migration from the first pin it serves that carries it.
- [ ] BO_0309_024 A reference field chosen by a document's or a block's title, as the `#` list
      offers them, rather than typed as an id.
- A document taking the built-in *Profile* writes `documents`' `record: profile` in the same
  statement, and clearing it clears the record, so a document given *Profile* here is a profile
  everywhere a profile is read (`calliopa-bootstrap`'s `BO_0311_015`,
  [Profiles](../../../profiles/docs/system/system.md#the-profile-in-the-chip-with-tools)). No
  block takes it (`BO_0332`).
- `profiles`' half of `BO_0299_Q5` (`BO_0299_020`) is `profiles`' chip (`calliopa-bootstrap`'s
  `BO_0311_011`): a profile document carries roles like any document, and the chip groups first
  the profiles carrying a role the block or its document takes, read through `rolesOf` and
  `documentsCarrying` under a declared dependency on this extension, then every other profile
  ([Profiles](../../../profiles/docs/system/system.md#the-profile-in-the-chip-with-tools)). A
  profile's *Hook* block reaches a run as the rest of its words do, since the run's profile
  section (`ui-kernel.md` `BO_0298_001`) carries the profile's blocks.
- The built-ins *Definition* (`builtin:definition`) and *Alias* (`builtin:alias`) (`calliopa-bootstrap`'s
  `BO_0310_030`, landed 2026-09-30; `lib/roles.ts`, `BUILTIN_ROLES`, `BUILTIN_OFFERS`): two more
  built-ins after the four, offered by *Keyword* through `offers` edges a release makes, which
  `unoffer` refuses by the rule `builtinOffer` and the role page draws marked *built in* with no ×.
  They are refused a rename, retire and restore as every built-in is. They reach an instance by the
  executable migration `migration-bo-0310-keyword-builtins`, route `kernel/migrations/keyword-builtins`,
  after `migration-bo-0309-builtin-roles`, which creates them with it on a fresh install:
  `keywordBuiltinsStatement` relates the offers that do not stand and nothing else, so it is
  idempotent. What they mean is `keywords`' ([Keywords](../../../keywords/docs/system/system.md)).
- *Send with prompt* (`BO_0310_031`, landed 2026-09-30): `blockRole` permits `sendWithPrompt`, a
  list of *Keyword*'s field keys and offered-role ids, read into the catalogue's `RoleView` and a
  taken role's `TakenRole` on `builtin:keyword` alone, so `rolesOf` answers it. The act
  `{command: "sendWithPrompt", entry, on}` on `POST /api/x/doc-block-roles/roles/[id]` switches one
  entry, one truth write, refused by the rule `sendWithPrompt` on any other role and for an entry
  that is neither a field nor an offered role of *Keyword*. *Keyword*'s page draws a *Send with
  prompt* heading with one switch per field and per offered role (`data-send-with-prompt-entry`),
  in that order. The same migration sets `sendWithPrompt` to `["builtin:definition"]` where
  `builtin:keyword` holds none, so a fresh install sends the definition and an upgrade never resets
  what a person switched. What is sent is `keywords`' (`BO_0310_025`).
- Verified 2026-09-30 (`BO_0310_030`, `BO_0310_031`): `views/views.test.ts` for *Keyword*'s page —
  a switch per field and offered role, the definition on, a flip posting the act and showing the
  answer, no × on a built-in offer, no switches on another role; `tests/behavior/roles.test.ts`
  over CCGW — the six built-ins created once; the keyword built-ins migration relating the offers,
  setting the default once and answering nothing after; the built-in offer and a built-in's rename
  refused; a switch on and off; the refusals on another role and for an entry *Keyword* does not
  hold.
- *Source*'s release fields (`calliopa-bootstrap`'s `BO_0313_010`, landed 2026-10-01; `lib/roles.ts`
  `SOURCE_FIELDS`, `CSL_TYPES`): *Kind* (`kind`, a required choice of every CSL 1.0.2 type),
  *Authors* and *Editors* (`authors`, `editors`, long text), *Issued*, *Container*, *Volume*,
  *Issue*, *Pages*, *Publisher*, *Place*, *DOI*, *ISBN*, *URL*, *Accessed* (text), *Abstract* (long
  text), *Tags* (text), *File* (file) and *Fetched* (text) — the CSL record of a source document,
  whose title is the document's. What they mean is `bibliography`'s ([Bibliography](../../../bibliography/docs/system/system.md#sources-beyond-papers)).
  A built-in's release fields are the `fields` its `BUILTIN_ROLES` entry declares, read by
  `releaseFieldsOf`: `removeField` refuses one by the rule `builtinField`, naming the role, and a
  person adds fields beside them. The executable migration `migration-bo-0313-source-fields`
  (route `kernel/migrations/source-fields`, after `migration-bo-0309-builtin-roles`) answers
  `releaseFieldsStatement`, the statement *Format*'s `format-fields` answers too: each release
  field put by its key in place of what stands under it or after the fields there, every field a
  person added kept, and nothing when they stand. A fresh install's `builtin-roles` creates
  *Source* with them.
- A built-in role's row in *Roles* carries the create action of the extension owning its meaning
  (`calliopa-bootstrap`'s `BO_0313_011`, landed 2026-10-01; `lib/roles.ts` `BUILTIN_CREATES`,
  `contributions.server.ts` `withCreate`, `views/section.tsx`). The release names it by the
  built-in's fixed id, as it names the built-ins themselves: *Source* → the kind
  `bibliography:new-source`, *Add source*. The section's reader answers it on the row as
  `RoleView.create` only while that kind is in the build — an owner switched off draws none — and
  the row draws it as a `+` (`data-role-create`) after its name, opening the kind with the item
  `new`. A row with none creates nothing. The registry is imported when the reader runs, since it
  imports this module. Proven in `server/api.test.ts`: *Source*'s fields and *Kind*'s options,
  the release fields of each built-in, and the action carried on *Source* alone and only while
  its kind is registered.
- Focused work under a roled block (`RO_0001`, closed 2026-10-01): a block's focused work stands
  under the roles of the block it was opened from, by `readInherited` (*Taking and values*
  above). The focused work's header shows them *from above*, every block in it is offered what
  they offer — *Hook* under *Story* — and nothing is taken until the person takes it. Proven by
  `tests/behavior/roles.test.ts`'s focused-work case and `views/views.test.ts`'s *a block's
  focused work*.
- *Format*'s built-in fields (`calliopa-bootstrap`'s `BO_0312_010`, landed 2026-10-01): `type`, a
  required choice of text, table, image, video, PDF and structured, and `schema`, long text, read
  for structured output — the `fields` *Format*'s `BUILTIN_ROLES` entry declares, read by
  `releaseFieldsOf` as *Source*'s are. A release field is refused a removal and a change of its type
  or options, both by the rule `builtinField` (`isBuiltinField`); a person renames it, marks it
  required and adds fields beside it. The role page draws a release field with no × and its type
  and options fixed (`data-builtin-field`). They reach an instance by the executable migration
  `migration-bo-0312-format-fields` (route `kernel/migrations/format-fields`, after
  `migration-bo-0309-builtin-roles`), which answers `releaseFieldsStatement` as *Source*'s does.
- A field's key is minted from the name it is first given (`mintFieldKey`, `calliopa-bootstrap`'s
  `BO_0312`, 2026-10-01): its words in camel case, ASCII letters and digits, numbered when the role
  holds it already — *Citation style* is `citationStyle` — and a rename keeps it. Before, a key
  was a UUID, which no reader could name; `manuscripts` reads a venue's and a paper's values by key.
  Fields made before keep their UUID keys. A field removed and added again under the same name
  finds its stored values. Technical decision at implementation.
- Verified 2026-10-01 (`BO_0312_010`): `lib/roles.test.ts` for the key's minting and which fields
  are a release's; `views/views.test.ts` for *Format*'s page, its two fields fixed and a person's own
  removable; `tests/behavior/roles.test.ts` over CCGW for the migration adding both once, repairing a drifted one and
  answering nothing after, the removal and the retyping refused, and keys minted, numbered and kept
  through a rename.

## The Roles Chip

- Under `RO_0002` (`docs/changes/RO_0002_FEAT_roles-in-their-own-chip.md`), set to draft by the
  user on 2026-10-01 and transferred here the same day: the block's role control leaves the command
  chip for a chip of its own beside it. The slot is `ui.shell`'s
  ([Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md#a-chip-beside-the-command-chip),
  `RO_0002_001`); drawing the chip is `documents`'
  ([Command Mode](../../../documents/docs/system/documents/command-mode.md#a-chip-beside-the-command-chip),
  `RO_0002_002`). The `title` place and its control, the pills while reading, the *Roles* category
  and how a role is suggested, picked or offered do not change.
- Verified 2026-10-01 (`RO_0002_005`): `views/views.test.ts` in the render harness — the roles
  chip showing two pills and a `+` with nothing open, the `!`, the missing fields and *not offered*
  on its pills, no role icon; a block with no roles holding the `+` alone, which opens the typeahead
  and the suggestions; a pill opening its role's fields, and a second press closing them; a reading
  pill opening the chip at its role; the reading pills standing while the block is edited; the
  control contributed to `underCommand` and nothing to `command`; the block cases before this
  change opening from the `+` or a pill. Drawing the block in the icon's form, a pill opening on
  nothing, and contributing to `command` each failed a test. `doc-block-roles` 38 and `keywords` 30
  pass.
- The release line (`RO_0002_006`): the roles are released for the first time with this change,
  so `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` says it in the roles line under
  *Changed* (`BO_0309_002`'s), rewritten to name the chip beside the command line, its pills and its
  `+`, and the tag under the title, rather than adding a line about a tag no release carried.
- Walked by the user on the served build, 2026-10-01 (`RO_0002_007`, pins 3535 to 3635): the
  roles chip first stood below the command chip as built, and the user moved it into the command
  chip's row at the right (pin 3611); on an iPhone the user expected the popover apart from the
  chip, and it became the sheet from the bottom (pin 3635). After both, on a desktop and an iPhone,
  the user's word: "works".
- Closed 2026-10-01: the release line is the roles line under *Changed* (`RO_0002_006`), and the
  change's document stands in `docs/changes/completed/` at `completed`.


## The Popover Fits The Screen

- Under `RO_0004` (`docs/changes/completed/RO_0004_FIX_the-roles-popover-fits-the-screen.md`), set to draft
  by the user on 2026-10-01 and transferred here the same day: the role control's popover, for the
  block's chip and the title's, fits the visible area rather than extending the page. The popover
  is the one *The role control* above describes; what it holds and how it acts do not change.
* The popover stands wholly inside the visible area of the view on every viewport, for the block's
  chip and the title's, and never lengthens the document, widens it, or scrolls the page to show
  itself. What does not fit inside it scrolls inside it, the typeahead and the roles taken
  reachable without scrolling the page.
* Above the shell's phone width (640 CSS px) it is a popover at its chip: below the chip, or above
  it where the room below is smaller than the room above; its height capped to the room on the side
  it opens to; shifted along the line so it does not cross the view's edge (`RO_0004_Q1`).
* At the shell's phone width and below it is a full-width sheet from the bottom edge of the frame,
  its height capped to the frame, over the dimmed page `RO_0002` drew, a tap on which closes it
  and does nothing else (user decision, 2026-10-01, after `RO_0002`'s walk, replacing
  `RO_0004_Q2`'s sheet with no backdrop).
* Above the phone width a press outside the popover and its chip closes it and still acts; on a
  phone the dimmed page takes the press (user decision, 2026-10-01). Its keys stay its own and the
  caret stays where it was.
* With an on-screen keyboard the popover and the sheet fit the frame that remains while the
  typeahead is focused, the sheet standing directly above the keyboard.
* One role's fields are unfolded at a time; unfolding one folds the one open before (`RO_0004_Q3`).
- The popover above the phone width (`RO_0004_001`, landed 2026-10-01; `lib/placement.ts`,
  `views/control.tsx`, `roles.css`) is `position: fixed`, so it takes no room in the page. While it
  is open the control measures its own box and the frame — its nearest scrolling ancestor, cut to
  the window — on opening and again on any scroll (captured on the document) or window resize;
  `placePopover` answers the side, the top (below) or the bottom (above, so it grows upward from
  the chip), the left, the width and the height cap, 6px from the chip and 8px clear of the frame's
  edges, 22rem wide where the frame has room and the frame's width less the margins where it has
  not. The block's form ends at its chip's right edge and the title's starts at its left, each then
  shifted inside the frame. The control writes the place as its own `style` (`--roles-top`,
  `--roles-bottom`, `--roles-left`, `--roles-width`, `--roles-room`) and `data-roles-side`, which
  the popover reads; until then the popover is hidden, and closing removes both. A page with no
  layout, as the render harness is, is not measured. The typeahead is `box-sizing: border-box`, so
  it stands inside the popover's padding rather than past it.
- The sheet at the phone width (`RO_0004_002`) is `RO_0002`'s: fixed at full width to the bottom of
  the part of the page the keyboard leaves visible, its height capped at `min(75vh, that height −
  1.5rem)`, over the dimmed page. Nothing in `documents`' place keeps a fixed box from the frame
  (its command chip is placed without a transform since `RO_0002`), so `documents` did not change.
- The outside press above the phone width (`RO_0004_006`, landed 2026-10-01; `views/control.tsx`):
  while the popover is open, and only then, the control listens for `pointerdown` on its document
  in the capture phase; a press whose target is outside the control — its chip and its popover —
  blurs a field of the popover that holds the focus, so its pending value posts, and closes it. The
  press is neither prevented nor stopped, so it acts where it lands. At the phone width the listener
  leaves the press to the dimmed page. The block's form and the title's alike.
- Verified 2026-10-01 (`RO_0004_003`): `lib/placement.test.ts` — below near the top with the room
  below as the cap, above near the bottom growing upward, below on equal room, the chip's right
  edge and the shift inside the frame at both ends, a frame that is a pane rather than the window,
  the width narrowed to a narrow frame, and a chip scrolled out of the frame on either side;
  `views/views.test.ts` in the render harness — the popover placed below a chip at the top of a
  1280×800 window, ending at the chip's right edge with the room below as its cap, hidden and its
  place cleared on closing; a press inside the popover or on its chip leaving it open, and one on
  the block's words closing it, not prevented. Removing the listener fails that test.
  `doc-block-roles` 65 and `keywords` 30 pass (one `keywords` view test fails about one run in four
  on the head as well, Qwik's *Must be same function*); the theme-token check passes for
  `roles.css`. Measured in Chromium on this tree served beside the instance, a probe account
  editing *Quantum Advantage* (41 blocks): at 1280×800 a block's chip near the top opened below
  (popover 862–1214 × 362–502 under its chip ending at 1214), one near the bottom above (543–715
  over its chip at 721), the title's chip below from its left edge, each inside the document pane
  (304–1280 × 47–768), the typeahead inside it, nothing scrolling sideways, and every scroll extent
  of the page unchanged by opening it; a press on another block's words closed it and edited that
  block. At 390×844 and 360×740 on a touch screen the sheet spanned the width and ended at the
  screen's bottom edge over the dimmed page, the extents unchanged, and a tap on the dimmed page
  closed it. The keyboard was not simulated; the walk takes it.
- The top layer (after the walk, 2026-10-01; `views/control.tsx`, `roles.css`): the popover and the
  dimmed page are `popover="manual"`, and while the popover is open the control raises the dimmed
  page and then the popover with `showPopover`, where the browser has it. In the top layer no
  stacking context of the page holds them, so on a phone the dimmed page covers the shell's header,
  its view bar and the agents' chip row as well as the document, and a desktop popover near the
  pane's top stands over the view bar. The browser's own margins and sizes for a popover are reset
  in `roles.css`; where it has no popover API both stay where the page draws them. Proven in
  `views/views.test.ts`: the dimmed page raised, then the popover, both `popover="manual"`.
  `doc-block-roles` 66 pass. Measured again on the served copy: in every case above the popover is
  `:popover-open` and is what stands at its own middle; on a phone at 390 and 360 the dimmed page is
  what stands at the header, the view bar and the chip row; the rest as before.
- The release line (`RO_0004_004`): none of its own. The roles have not been released yet
  (`RO_0002_006`), so they ship fitting, and the roles line under *Changed* in
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` already says how the chip opens.
- Walked by the user at pin 3735, 2026-10-01: it works, but on the phone the toolbar and the
  agents' chips stood undimmed over the dimmed page; they now stand under it (the top layer above).
- Walked again by the user at pin 3747, 2026-10-01 (`RO_0004_005`), on a desktop and a phone: the
  user's word, "works".
- Closed 2026-10-01: no release line of its own (`RO_0004_004`), and the change's document stands in
  `docs/changes/completed/` at `completed`.

## Document Roles And Block Roles

- Under `calliopa-bootstrap`'s `BO_0332` (`docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`,
  shaped here as `RO_0003`), set to draft by the user on 2026-10-01 and transferred here the same
  day: a role says whether blocks may take it, and *Keyword*, *Profile*, *Format* and *Source* are
  taken by documents alone (the fixed lines under *What This Extension Holds*). *Format*'s output
  made per document is `manuscripts`'
  ([Manuscripts](../../../manuscripts/docs/system/system.md#formats-per-document), `BO_0332_030`–`BO_0332_033`),
  and `make_manuscript`'s input the kernel's (`calliopa-bootstrap`'s `ui-kernel.md`, *Document Roles
  And Block Roles*, `BO_0332_001`).
- The setting (`BO_0332_010`, landed 2026-10-01; `lib/roles.ts` `blocksAllowed`, `server/roles.ts`):
  `blockRole` permits `blocks`, written `true` or `false` by the act and read as allowed when
  absent, so no role made before needs a write. A built-in's is read from its `BUILTIN_ROLES`
  entry, never from the node, as its name is: `blocks: false` on *Keyword*, *Profile*, *Format* and
  *Source*, nothing on *Definition* and *Alias*. The catalogue's `RoleView` and a taken role's
  `TakenRole` carry `blocks`. The act `{command: "blocks", allowed}` on `POST …/roles/[id]`
  (`parseRoleCommand`) is one truth write, refused in words on a built-in by the rule
  `builtinBlocks`.
- Taking (`BO_0332_011`, landed 2026-10-01): `takeableFrom(roles, above, onBlock)` leaves a role
  blocks may not take out of every block's `takeable`, offered or not, and keeps it in the
  document's — a focused work's document included, so a document-only role offered from above
  reaches that document's chip and none of its blocks. A role a block carries that blocks may not
  take is answered with `notOnBlock: true`. `takeStatement` refuses it on a block by the rule
  `blockNotAllowed`, before the offer is looked at, for the route and for `propose_roles` alike;
  clearing it and its values stay open. `read_document_roles` marks such a role `documentOnly`
  and a block's kept one `notOnBlock`, and the skill `doc-block-roles.roles` says, as
  `documentRolesOnTheDocument`, to propose a document role on the document and leave a kept one
  unless the person asks. `blockRole`'s declaration permits `blocks`, its semantics saying the
  document always may take a role.
- The role page (`BO_0332_012`, landed 2026-10-01; `views/role-page.tsx`): a switch *Blocks may take
  this role* (`data-role-blocks`) under the description, on for a new role, drawn fixed on a
  built-in with the release's word in its title; with it off the label adds *taken by documents
  alone*, and *Offers* says a role nobody offers can be taken by any document. Beside an offer of
  a role blocks may not take, the page says *taken by the document under a block carrying* the
  role, *never by its blocks* (`data-offer-document-only`).
- The pills and the suggestions (`BO_0332_013`, landed 2026-10-01): `roleState` answers *not
  allowed on a block* for a kept role, after *retired* and before *not offered*, so the reading
  pill, its title and the roles chip's pill say it as they say *not offered*. The suggestions are
  drawn from the block's `takeable`, so a role blocks may not take is never suggested to a block.
- Verified 2026-10-01 (`BO_0332_014`): `server/api.test.ts` — the act parsed and refused in words,
  `blocksAllowed` for the built-ins and a person's role, and the takeable sets on a block and on
  the document, with a document-only role offered from above; `lib/suggest.test.ts` — a role whose
  words match never suggested to a block and suggested to the document; `views/views.test.ts` —
  the pill's *not allowed on a block*, the switch posting `{command: "blocks", allowed: false}`
  and the note beside an offered document-only role, and a built-in's switch fixed;
  `tests/behavior/roles.test.ts` over CCGW under the kernel harness — a role switched to documents
  alone leaving every block's `takeable` and staying on the document's, a block keeping it and
  saying `notOnBlock`, the refusals by the route and by `propose_roles`, the tool's
  `documentOnly` and `notOnBlock`, the four built-ins refused on a block and *Format* taken on a
  document, `builtinBlocks`, and a document-only *Beat* offered by *Scene* taken by the Scene
  block's focused work's document and refused on its block. `keywords`', `profiles`' and
  `bibliography`'s suites green; the harness's other failures stand on a pristine checkout of the
  same head too.
- Walked by the user on the served build, 2026-10-01 (`BO_0332_015`, "worked"): a role switched to
  documents alone left a block's `+` and stayed under the title, a block that carried it said *not
  allowed on a block*, *Format* was offered on a document and on none of its blocks, a manuscript
  was made of a document carrying *Format* (PDF) and listed at its end, and an image profile
  generated with no *Format*.
- Closed 2026-10-01 (`BO_0332_016`): the release lines are `calliopa-bootstrap`'s `BO_0332_002`, and
  this change's document stands in `docs/changes/completed/` at `completed`.

## The Document Header

- Under `documents`' `DO_0030` (set to draft by the user on 2026-10-01 and transferred the same
  day): a document's head is one header — route, title, roles line, values line, mentions line
  ([Block Editor View](../../../documents/docs/system/documents/block-editor.md#the-document-header)).
  This extension draws the roles line and the values line through the `title` place, as two rows
  of its one contribution (`ui.shell`'s `DO_0030_001`); the roles line's pills and their order do
  not change.
- The roles line (`DO_0030_004`, landed 2026-10-01; `views/control.tsx`, `roles.css`):
  `TitleRoleControl` draws, with `form="full"`, `.title-roles` holding `.title-roles__line` — the
  roles from above first, muted (`data-role-state="from above"`), *from above*, naming where they
  come from in their title and opening nothing, then the role control in the pills form the block's
  chip has: the document's own pills, each opening the popover at its role, and the `+` — always
  drawn, reading and editing alike. The control has one form. `placePopover` aligns the title's
  popover at the control's start (`align: "start"`), since the line starts at the header's edge,
  and a block's at its end (*The Popover Fits The Screen*). With `form="compact"` it draws `CompactRoles`:
  the pills as words (`data-compact-role`), the roles from above muted, no `+` and no popover, on
  one line; their widths are measured once all are drawn and `fittingPills` keeps as many as leave
  room for a last *+N* (`data-roles-more`) counting the rest, again on every resize of the line.
- The values line (`DO_0030_005`, landed 2026-10-01; `lib/values.ts`, `ValuesLine` in
  `views/control.tsx`): under the roles line, `.title-values` (`data-role-values`), one entry per
  own role holding a filled value (`data-role-values-of`) — the role's name, then its filled values
  in field order joined by *, *, entries apart by *·* — and nothing when no value is filled, for a
  role a run only proposes, or with `form="compact"`. `valueWords` says a value as a person reads
  it: text and a choice as they stand, trimmed; long text to its first line, cut at 80; a number as
  written; a date in the reader's locale at medium length, read as a calendar day so no time zone
  moves it (*12 Oct 2026*); true as the field's name, false left out; a file by its filename; a
  reference by the title `rolesOf` answers for it, or the id it holds when nothing it names reads.
  `rolesOf` answers `referenceTitles` beside the document's view, a widening of the contract: for
  each distinct reference value of the document's own roles, one read of the node, a document by
  its title and a block by its first words cut at 60 (`titleOfNode`). The line reads the state the
  title's control holds, so a value committed in the popover shows at once.
- Verified 2026-10-01 (`DO_0030_011`): `views/views.test.ts` — the document's role taken from the
  `+` and the answer announced, no role icon; the roles from above, the own pills and the `+` in
  that order with nothing focused, a pill opening its role; the values line with a date, a number
  and a choice, an empty field and a role with none left out, a value committed in the popover shown
  at once, and nothing when none is filled; the compact form's pills with no `+`, no values and
  nothing to press; `fittingPills` for pills that fit and pills counted. `lib/values.test.ts` for
  every field type, the long text, nothing filled, a reference naming nothing; `server/api.test.ts`
  for `titleOfNode`. Mutations — a role with no value given an entry, the compact form drawn full —
  each failed a test. `referenceTitles`' read over CCGW, the observer and the *+N* count on a live
  page are the walk's (`DO_0030_009`).
