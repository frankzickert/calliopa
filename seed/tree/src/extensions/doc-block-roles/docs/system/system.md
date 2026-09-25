# Document And Block Roles

## Purpose

- This document is the entry point of `doc-block-roles`, the extension that lets a person give a
  document a role — a *Story* — and, under it, give individual blocks the roles that document
  role offers — *Hook*, *Problem*, *Transformation*, *Closing*. Which roles exist and which block
  roles a document role offers is configured in the app, as profiles are; the roles are read by
  other extensions, by the browser and by a run, so a profile can say how a hook is written
  (`calliopa-bootstrap`'s `BO_0299`, requested and decided by the user on 2026-09-25).
- It is `bundled` and active on a fresh install, and no starter role ships, since instance
  content never travels (`BO_0299_Q1`). Its release line is `calliopa-bootstrap`'s
  `distribution.md` (`BO_0299_001`–`BO_0299_002`).
- It depends on `documents`, whose document and blocks the roles attach to and whose editor draws
  the choices and the label
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#document-and-block-roles)
  holds the decisions), and on `ui.shell`, whose frame it contributes into. Nothing in the fixed
  layer moves for it: the kernel lists an active extension's `ext.tool` members and answers them
  through the callback as it does for every extension (`ui-kernel.md`, `BO_0264_007`).
- Its change documents carry the prefix `RO`. An `RO` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* Anyone who can edit documents creates and revises document roles and their block roles, written
  as truth at once with no proposal (`BO_0299_Q2`). Assigning a role to a document or a block is
  the person's direct act the same way, established at once and shared.
* When a document's role changes, block roles assigned under the previous role stay stored and are
  drawn as not offered by the current role; the person clears or reassigns them (`BO_0299_Q3`).
* A role is retired, never deleted: the choices stop offering it, existing assignments stay and are
  drawn as retired (`BO_0299_Q4`).
* A run reads roles and never writes them (`BO_0299_Q6`).
* A block's role is visible while reading, as a small label at the block, and in the bar while the
  block is active (`BO_0299_Q7`).
* Every block in the reading order can take a block role (`BO_0299_Q8`).

- The word _role_ is taken on a text block — `text.role` is the typographic role — so nothing here
  is called `role` alone: the types are `documentRole` and `blockRole`, the surfaces say _document
  role_ and _block role_, and a run's document read keeps answering the typographic one as `role`.
- The declarations (`BO_0299_011`, landed 2026-09-25, staged through `kernel commit --members`):
  `documentRole`, a root node requiring `id` and `name` and permitting `description` and
  `retired`; `blockRole`, a root node requiring `id`, `name` and `order` and permitting the same
  two; `offers` from a `documentRole` to a `blockRole`; `hasDocumentRole` from a `document` to a
  `documentRole`, at most one active per document; `hasBlockRole` from any block in a reading
  order to a `blockRole`, at most one active per block. An `ext.relationtype` fences neither end
  and every block kind is `documents`' declaration, so `BO_0299_Q8` costs the one dependency; the
  _one active per subject_ rule is this extension's, checked by a read before the write. A
  relation to a role node rather than a property carrying its name means a rename follows
  everywhere at once. `lib/roles.ts` names the types and the shapes.
- The catalogue and the acts on a role (`BO_0299_012`, landed 2026-09-25; `server/roles.ts`,
  `contributions.server.ts`): `readCatalogue` reads the document roles by type and, rooted at
  them, the `offers` hop to their block roles — the rooted hop being where a read answers
  relations; `createDocumentRole` mints one, unnamed unless named; `reviseDocumentRole` takes one
  act — `rename`, `describe`, `retire`, `restore`, `addBlockRole`, `renameBlockRole`,
  `describeBlockRole`, `retireBlockRole`, `restoreBlockRole`, `reorder` — each one truth write
  outside any branch, and answers the role as it stands. `GET /api/x/doc-block-roles/roles` is
  the catalogue (also `readers.roles`, the section's), `POST …/roles` creates, `GET …/roles/[id]`
  reads one and `POST …/roles/[id]` posts an act, parsed by `parseRoleCommand` and refused in
  words when it is not one. A retired role keeps a `retired: true` property; nothing is deleted.
- The Roles category and the role page (`BO_0299_012`; `views/section.tsx`, `views/role-page.tsx`):
  a section under *Roles*, Phosphor `tag` — added to the shell's icon table at regular weight,
  unaltered — listing the unretired document roles by name, each opening as the kind
  `doc-block-roles:documentRole`, with its own `+` (`data-new-role`) creating *Untitled role* and
  opening it. The page edits the name, which renames the tab and the library entry, and the
  description, retires and restores the role, and manages the block roles it offers — rename,
  describe, move up and down, retire, restore, add — every act posted as it is made and the page
  showing what the route answered; a refusal is shown on the page in the route's words. Retired
  block roles stay listed, struck through.
- A document's roles read and written (`BO_0299_013`, landed 2026-09-25; `server/roles.ts`):
  `GET /api/x/doc-block-roles/documents/[id]` answers `rolesOf` — the document's role and, per
  block in reading order, the block's role as `{id, name, description, retired, documentRole,
offered}`, `offered` false when the document's current role does not offer it — with `?branch=`
  reading the reading order in the tab's branch; `POST …/documents/[id]/role` with
  `{documentRole}` and `POST …/documents/[id]/blocks/[blockId]/role` with `{blockRole}`, an id or
  `null` for *No role*, close the standing relation and relate the new one in one script as the
  signed-in person's truth, outside any branch, writing nothing when the choice already stands —
  the close naming its vantage (`hFrom`, the subject) so a bare close for *No role* passes the
  kernel's write gate, which refused it as `write_close_unverifiable` in the walk on 2026-09-25;
  each refusal in words — a document that is not there, a block not in its reading order, a role
  that is not here or is retired, a block role the document's current role does not offer.
- The choices in the bar (`BO_0299_014`, landed 2026-09-25; `views/provider.tsx`,
  `RolesProvider`): a decoration provider of the `document` kind, reading the catalogue and the
  document's roles once per document and again when the editor reads the document again, and
  writing its own group *Roles* into the shell's decoration bar — the decoration bar and the
  `choice` action being the slot, as the profile selector found (`ui.shell`'s `BO_0298_030`), so
  no `bar` document place was needed. *Document role* lists *No role* first and every unretired
  document role, its value the document's role; while a block is active — read from
  `EditorSurfaceContext` under the declared dependency — and the document carries an unretired
  role, *Block role* stands beside it, listing *No role* and the block roles that role offers. A
  block role not offered or retired is drawn as `Hook (not offered)`, chosen and not offered
  again; a retired document role the same way. A choice posts and the control shows the answer; a
  refusal is raised in the route's words and the choice stands. With the roles unreadable nothing
  is offered.
- The label while reading (`BO_0299_015`, landed 2026-09-25; `views/label.tsx`, `RoleLabel`): a
  `headline` block place drawing the role's name as a small label at a block carrying one —
  `.block-role`, the register word's idiom, words rather than a glyph — saying _not offered_ or
  _retired_ beside the name when that is so, and nothing on a block carrying none. It reads what
  the provider read, so a document costs one read for every block.
- The interface for extensions (`BO_0299_016`, landed 2026-09-25): `server/roles.ts` exports
  `rolesOf(documentId, {branch?, dataRevision?})` answering the `DocumentRolesView` of
  `lib/roles.ts` — the shape above — read as truth as it stands, in a branch, or at a data
  revision. An extension declaring `doc-block-roles` as a dependency imports it directly, one
  process and no HTTP hop, as `calliopa-show` imports `publishing`; the route is the same function
  over HTTP for the browser, and the tool the same at a run's pin. This shape is the extension's
  contract: widening it is an ordinary change, and a field is never renamed under a reader.
- The agent's tool and skill (`BO_0299_017`, landed 2026-09-25; `server/tools.ts`, the members
  `doc-block-roles.read_document_roles` and `doc-block-roles.roles`): `read_document_roles`
  `{document}` is answered on `POST /api/x/doc-block-roles/kernel/tools/[tool]`, a `kernelCallback`
  route, with `rolesOf` at the run's pin and a note saying what the document is and that no role
  is proposed; it stages nothing, and a missing or unreadable document is refused `422` in words.
  The skill says to read the roles before proposing into a roled document, to write each block by
  its role with the role's description outranking the word, to follow a profile where it speaks
  to a role, never to assign one, and to keep the block role apart from the typographic `role`.
- The skill reaches every run since `calliopa-bootstrap`'s `BO_0299_003` (2026-09-25): a run reads
  the skills of every active extension that offers it a tool, so this extension's skill is read in
  every document. Before that a person's run read the base's skill, the intention's extension's
  and `documents`' only, and the walk's first roled run called nothing; the convention stood in
  the `documents` skill for the hours between, as refinement's commit convention does
  (`BO_0249_012`), and left it at this change's close as duplication.
- A roled block is that role's place (`BO_0299_017`, 2026-09-25; the convention
  `roledBlockIsThePlace`): when the command asks for a role a block already carries, the run
  proposes a rewrite of that block or answers from it, never a second block of the role; it inserts
  one only where no block carries the role, and an empty roled block is asking to be written.
  Found in the walk, when the first roled run inserted a second *Big Message* beside the block
  carrying the role.
- Verified 2026-09-25 (`BO_0299_018`, the unit and behaviour parts): `views/views.test.ts` in
  Qwik's render harness — the section's rows by name with retired ones left out, a row opening the
  page, the `+` posting the create and opening what came back, the empty and unreadable states;
  the group's *Document role* with *No role* first and the document's role shown, a choice posted
  as `{documentRole: id}` and reflected, *No role* posted as `null`, the block choice present only
  with a block active and a document role chosen and offering that role's block roles, a choice
  posted to the block's route and reflected, a role not offered drawn as such, nothing offered
  while the roles cannot be read, and a refusal raised in the route's words with the choice kept;
  the label naming the role and its state and drawing nothing on a block without one.
  `server/api.test.ts` and `server/tools.test.ts` for the acts parsed and refused and the tool's
  input. `tests/behavior/roles.test.ts` over CCGW under the kernel harness — the catalogue in the
  person's order and a reorder, a rename; a document and a block roled as truth with the
  document's revision untouched; the document's role changed keeping the block's as not offered
  and offered again on return; a block role retired keeping the assignment as retired and refused
  for a new assignment; *No role* clearing the block's and then the document's assignment; the
  refusals by name; and the tool's answer. The harness's vocabulary
  copy carries the five declarations (`calliopa-bootstrap`'s
  `internal/kernel/serve/testdata/documents-vocabulary.json`). `tsc --noEmit` clean with the
  registry generated.
- Walked by the user on the served build on 2026-09-25 (`BO_0299_019`, pins 2671 to 2760):
  *Story* created under Roles with *Hook* and *Big Message* on its page; a document given
  *Story* from the bar, a block given *Hook* and another *Big Message*, the labels read; the
  document's role cleared and set again, the block's label reading *not offered* in between and
  offered again after; and a prompt asking for the big message answered by a run that read the
  document, read its roles, read the *Big Message* block before writing, and proposed a rewrite
  of that block while withdrawing the second block an earlier run had inserted
  (`arun-2a92104b795c9b40`). Three things the walk found and this change fixed: clearing a role
  was refused by the write gate until the close named its vantage; the skill reached no run until
  `BO_0299_003`; and a run wrote a second block for a role until `roledBlockIsThePlace`. Two
  things it found that are not this change's: the *Profile* and *Document role* dropdowns stand
  side by side in the bar and were taken for one another once, and a prompt in a profile document
  is answered as a change to the profile (`BO_0298_Q9`), so roles are walked in an ordinary
  document. Retiring a role was not pressed in the walk; the behaviour suite covers it.
- [ ] BO_0299_020 `profiles`' half of `BO_0299_Q5`, to move into `profiles`' `system.md`: a
      profile document carries a document role like any document, and the profile selector
      (`BO_0298_016`) groups the profiles whose role matches the document's first, reading `rolesOf`
      under a declared dependency on `doc-block-roles`, and lists every other profile after them; a
      profile's *Hook* block is what a run receives as the hook's instructions, since the run's
      profile section (`ui-kernel.md` `BO_0298_001`) carries the profile's blocks and
      `read_document_roles` answers their roles.
