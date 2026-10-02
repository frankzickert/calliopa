# Structures

## Purpose

- This document is the entry point of `structures`, the extension that lets a person
  structure what they write with structures: a block uses structures — a document, the root block of its
  reading order, uses them the same way — a structure allows structures to the blocks under it, and a structure
  carries fields whose values the block holds. A *Story* allows *Hook* and *Closing*; a *Blog post*
  carries a publishing date and a position (`calliopa-bootstrap`'s `BO_0299`, requested and
  decided by the user on 2026-09-25, and `BO_0309`, part 1 of `BO_0308`, with `BO_0318` folded in,
  2026-09-30). Structures are read by other extensions, by the browser and by a run.
- It is `bundled` and active on a fresh install. No person's structure ships, since instance content
  never travels (`BO_0299_Q1`); the built-in structures are created on every instance by a migration.
  Its release lines are `calliopa-bootstrap`'s `distribution.md` (`BO_0299_001`–`BO_0299_002`,
  `BO_0309_002`).
- It depends on `documents`, whose document and blocks the structures attach to and whose editor draws
  the pills, the chip's control and the place under the title
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#document-and-block-structures)),
  and on `ui.shell`, whose frame it contributes into. In the fixed layer only the kernel harness's
  vocabulary copy moves for it (`ui-kernel.md`, `BO_0299_018`, `BO_0309_001`): the kernel lists an
  active extension's `ext.tool` members and answers them through the callback, and runs its
  executable migrations, as for every extension (`BO_0264_007`, `BO_0312_003`).
- The id is `structures`, moved from `doc-block-roles` by the kernel's general move
  (`calliopa-bootstrap`'s `BO_0338_001`, *Structures Become Structures* below); the category is
  *Structures* (`BO_0338_024`).
- Its change documents carry the prefix `RO`. An `RO` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does.

## What This Extension Holds

* A structure is how data is structured. A block may use several structures at once, each shown as its
  own applied structure. A structure *allows* structures and a block *uses* a structure, never *parent* and *child*.
  User decisions, 2026-09-30 (`BO_0308_Q1`, `BO_0318`).
* An allowed structure may allow structures in turn, to any depth, and a block can use a structure allowed by a
  structure on any block above it at any depth, not only on the block directly above it
  (`BO_0308_Q2`). A structure that no other structure allows can be used on any block. A structure that some structure
  allows can be used only on a block under a block using an allowing structure — never on the block
  using it — so *Definition*, allowed by *Keyword*, is never allowed on a plain paragraph
  (`BO_0309_Q1`).
* A structure carries fields: text, long text, number, date, true/false, choice from a list, a
  reference to a document or a block, or a file. A field can be marked required; a missing required
  value is shown on the block and never blocks a write (`BO_0308_Q3`). A field may declare a
  default value, filled in when a block uses the structure, which the person can change; no structure is
  ever taken automatically (`BO_0318_Q8`).
* Anyone who can edit documents creates and revises structures, written as truth at once with no
  proposal (`BO_0299_Q2`). Taking a structure or entering a value directly is the person's deliberate
  act, written as truth at once and shared. A run may propose structures and values, which land only
  when the person accepts them with the run's other proposals, through the run's chip; until then
  the pill says *proposed* (`BO_0308_Q4`, reversing `BO_0299_Q6`; `BO_0309_Q4`).
* Structures are defined in the *Structures* category: their fields, what they allow, and their defaults. A
  structure is never assigned there. Each built-in structure lists the documents using it
  (`BO_0308_Q11`, `BO_0318`).
* A structure is assigned from the block. When a block is being edited, a chip of its own carries the
  block's roles: each structure used as a pill, which opens its fields when pressed, and a `+`, which
  opens the typeahead and the suggestions. It stands in the command chip's row, aligned right, when
  the row has room for both, and on the next row, still at the right, when it has not (user
  decision from the walk, 2026-10-01, replacing `RO_0002_Q4`'s left edge below). It is drawn
  whenever the command chip is — on a block with no structures it holds only the `+` — and what it opens
  opens below it. On a phone what it opens, and what the header's structures line opens, is a sheet from the
  bottom of the screen over the dimmed page, which a tap on the page or a swipe down closes and
  which rides above the keyboard (user decisions from the walk, 2026-10-01). The person adds and removes the block's roles there and
  edits their fields there, under each applied structure. The command chip uses no structure control; the
  instruction stays in it, since it chooses how the command runs (`RO_0002_Q1`, `RO_0002_Q2`,
  `RO_0002_Q6`, `RO_0002_Q8`, user decisions 2026-10-01, replacing the structure control in the command
  chip). A document's own structures are assigned from the
  structures line of its header, under its title, whose control is always drawn — its pills and a `+`,
  as the block's chip (`DO_0030_Q2`, user decision 2026-10-01, replacing *while the title is being
  edited*). The
  document bar has no *Structures* control and the inspector no *Fields* section (`BO_0318_Q1`,
  `BO_0318_Q2`, `BO_0318_Q6`, replacing `BO_0299_Q7`'s bar and `BO_0309_Q2`'s inspector).
* A structure reaches a block in three ways: suggested from the block's content, picked in a typeahead,
  or allowed by the structure above. The typeahead lists only the structures the block can use where it
  stands (`BO_0318_Q5`). Suggestions show only inside the opened control; they are built from the
  structure and the block's words, with no model and no cost, and one not used leaves nothing
  behind (`BO_0318_Q3`, `BO_0318_Q4`).
* A block's roles are visible while reading, as small pills at the block (`BO_0299_Q7`). The pills
  stay while the block is being edited, beside the structures chip below it (`RO_0002_Q3`).
* A block's focused work stands under that block: the structures of the block it was opened from, and
  of everything above that block, are above the focused work and its blocks, so a *Story* block's
  focused work lets its blocks use *Hook*. Its header shows those structures, from above, beside the
  document's own. User decision, 2026-10-01, from the walk.
* A structure used while an allowing structure stood above stays when that structure goes, and says it is not
  allowed; the person clears it or leaves it (`BO_0299_Q3`).
* A structure is retired, never deleted: nothing allows it any more, its assignments stay and say so
  (`BO_0299_Q4`).
* Every block in the reading order can use a structure that allows blocks (`BO_0299_Q8`). A structure says
  whether blocks may use it, one switch; the document may always use a structure, and no structure is
  allowed on blocks but not on the document. A structure a person creates allows blocks. User
  decisions, 2026-10-01 (`calliopa-bootstrap`'s `BO_0332`, `RO_0003_Q1`, `RO_0003_Q4`).
* *Keyword*, *Instruction*, *Format* and *Source* are built in: on every instance without being
  created, never deleted, retired or renamed, and extended with allowed structures and fields like any
  structure (`BO_0308_Q5`). They are used by documents alone, and that setting is the release's, as
  their names are (`BO_0332`, 2026-10-01). What each one means is `BO_0310`–`BO_0313`'s, and
  *Format*'s is widened by `BO_0336`: a document using *Format* may be a format an instruction names,
  the definition of what a generation is made with, as well as what a whole document is produced
  as. *Definition* and *Alias*, allowed by *Keyword*, allow blocks, as *Variation*, allowed by
  *Format*, does (`BO_0336`, 2026-10-02).
* A block that uses a structure blocks may not use — one of the four, or a structure switched to
  document only while blocks use it — keeps it, and its pill says it is not allowed on a block,
  as a structure no longer allowed says so; the person clears it or leaves it. Nothing is migrated,
  removed or moved. User decision, 2026-10-01 (`RO_0003_Q3`).
* An allowing never overrides the setting: a document-only structure allowed by a structure above (*Hook* under
  *Story*) is never used by a block; a document under the allowing block — its focused work —
  uses it in its own chip, and the structure page says so beside such an allowing. User decision,
  2026-10-01 (`RO_0003_Q5`).

- The word *role* is taken on a text block — `text.role` is the typographic role — so the type
  keeps the name `blockRole`, and a run's document read keeps answering the typographic one as
  `role`. The surfaces say *structure*.
- The vocabulary (`BO_0309_010`, landed 2026-09-30, staged through `kernel commit --members`):
  `blockRole` is the one structure type, a root node requiring `id`, `name` and `order` and permitting
  `description`, `retired`, `builtin`, `fields` and `formerId`. `fields` is an ordered list of
  `{key, name, type, required, options?, default?}`; `key` is minted once and never changes, so a
  rename keeps every value. `offers` runs from any structure to any structure; `hasBlockRole` from the
  `document` node or any block in its reading order to a structure, several per subject. Relations carry
  no properties, so values live on a `roleFields` node, one per subject and structure, requiring `id`
  and `role` (the structure's id, read in the same read as the values) and permitting `values`, keyed by
  field `key`, and `files`, joined by `fieldsOf` to the subject and `fieldsFor` to the structure. A file
  value names `{hash, filename, mediaType, size}` in `values`; its blob reference stands in the
  top-level `files` list, since CCGW keeps a blob alive only from a top-level property
  (`binary-content.md`). A reference value is a node id. An `ext.relationtype` fences neither end
  and every block kind is `documents`' declaration, so any block and the document use structures
  under the one dependency. `documentRole` and `hasDocumentRole` stay declared, read by the
  migration alone. `lib/structures.ts` names the types and the shapes.
- The migration (`BO_0309_011`, landed 2026-09-30; `server/migrations.ts`, the member
  `migration-bo-0309-one-role-type`): an executable `ext.migration` with the route
  `kernel/migrations/one-role-type`, which the kernel runs once per instance when it serves the
  pin using it (`calliopa-bootstrap`'s `BO_0312_001`, `BO_0312_Q7`). A node never changes its
  type (CCGW refuses `node_type_change`), so each `documentRole` becomes a new `blockRole` carrying
  its name, description and retired flag, placed after the structures already there, and `formerId`, the
  id it had; each `offers` from it and each document's `hasDocumentRole` to it are closed and
  related again from and to the new structure, and the old node is retired. Block structures keep their ids
  and assignments. A reader still holding a former id — `keywords`' settings, a structure page open in a
  tab — finds the structure by it through the catalogue. An instance with no document structure answers an
  empty statement.
- The built-ins (`BO_0309_014`, landed 2026-09-30; the member `migration-bo-0309-builtin-roles`,
  route `kernel/migrations/builtin-roles`): the fixed ids `builtin:keyword`, `builtin:profile`,
  `builtin:format` and `builtin:source`, with `builtin: true` and orders 0–3. The migration creates
  those an instance does not hold and answers nothing when it holds them all. Measured against the
  other path: as manifest members they would ship with the release, but the members sidecar writes
  a member's release content over a person's revision, so fields a person added to a built-in
  would be lost at the next update; a migration creates them once and never touches them again.
  Rename, retire and restore on a built-in are refused in words (`builtinStructure`); description,
  fields and allows are open.
- The catalogue and the acts on a structure (`BO_0309_013`, landed 2026-09-30; `server/structures.ts`,
  `contributions.server.ts`): `readCatalogue` reads the structures by type and, rooted at them, the
  `offers` hop — the rooted hop being where a read answers relations — and answers each structure with
  its fields, what it allows and what allows it, built-ins first, then the person's order.
  `createStructure` mints one, placed last. `reviseStructure` takes one act — `rename`, `describe`,
  `retire`, `restore`, `offer`, `unoffer`, `addField`, `reviseField` (name, type, required, a
  choice's options, a default of the field's type, a changed type dropping a default that no
  longer fits), `removeField`, `moveField` — each one truth write outside any branch, and answers
  the structure as it stands. A field removed keeps its stored values, unread. `GET
  /api/x/doc-block-structures/structures` is the catalogue (also `readers.structures`, the section's), `POST
  …/structures` creates, `GET …/structures/[id]` reads one, `POST …/structures/[id]` posts an act, parsed by
  `parseStructureCommand` and refused in words when it is not one, and `GET …/roles/[id]/documents`
  answers the documents using a structure as their own (`documentsCarrying`). A structure's id in a route
  is a record id or a built-in's.
- Taking and values (`BO_0309_012`, `BO_0309_013`, landed 2026-09-30): `structuresOf(documentId,
  {branch?, dataRevision?})` answers the `DocumentStructuresView` — the document's own `structures` and
  `takeable`, and per block in reading order, a callout's children after the callout with their
  `parentId`, its `roles` and `takeable`. A used structure is `{id, name, description, retired,
  builtin, allowed, fields, values, missing, proposed?}`. What a subject may use is every
  unretired structure no structure allows, plus every unretired structure allowed by a structure used above it: on the
  callout it stands in, on the document, or above the document when it is a block's focused work.
  A structure on a block is never allowed to that block itself. Found in the walk, 2026-10-01: the first
  build counted the subject's own structures, so a block using *Story* — and a *Story* document's own
  chip — was allowed *Big Message*. Above a document (`readInherited`, the same day): when the
  document is a block's focused work (`focusOf`, the `focuses` edge), the structures used on that block,
  on the callout and the document it stands in (`CONTAINS`), and on up the chain while that
  document is focused work in turn, nearest first, stopping after 16 steps or at a document met
  twice. `structuresOf` answers them as `inherited`, `{id, name, description, on, document}`, and
  `read_document_structures` answers them and says the document is the focused work of a block using
  them. A focus that cannot be read is no focus. Read as truth, `structuresOf` also marks what open
  groups propose on the subjects (`reachingGroups`): a staged `hasBlockRole` as a structure `proposed`,
  a staged or revised `roleFields` as values `proposed`; read at a run's pin it marks nothing. `POST
  …/documents/[id]/structures` and `…/documents/[id]/blocks/[blockId]/structures` take `{structure, taken}`, and
  `…/roles/[roleId]/fields` on either takes `{values}`, each written as the signed-in person's
  truth outside any branch and answering the document's structures. Taking relates the structure and writes
  its defaults beside any value already stored; clearing closes the relation, naming its vantage
  (`hFrom`) as a bare close must, and keeps the values, so using the structure again finds them. A value
  is read against its field's type, a reference checked to name a node that is there. Each refusal
  is in words: a document that is not there, a block not in its reading order, a structure that is not
  here, is retired or is not allowed where the subject stands, a value for a structure the subject does
  not use, a key the structure does not declare, a value not of its type. A write refused by the
  kernel's per-node floor is tried once more after 300ms.
- The interface for extensions (`BO_0299_016`, widened by `BO_0309_012`): an extension declaring
  `structures` as a dependency imports `server/structures.ts` — `structuresOf`, `readCatalogue`,
  `listStructures`, `readStructure`, `documentsCarrying` — directly, one process and no HTTP hop. The shape
  `structuresOf` answers is the extension's contract: widening it is an ordinary change, and a field is
  never renamed under a reader. The single-structure fields it answered before (`documentRole`,
  `blockRole`) went in the proposal that moved `keywords`, their one reader (`BO_0309_020`).
- The agent's tools and skill (`BO_0309_016`, landed 2026-09-30; `server/tools.ts`, the members
  `structures.read_document_structures`, `structures.propose_structures` and
  `structures.roles`): `read_document_structures {document}` answers `structuresOf` at the run's pin,
  each structure with its fields and their values as a person reads them, what is missing, and per
  block what it can use, with a note saying how to propose; it stages nothing. `propose_structures
  {document, block?, take?, clear?, values?}` answers the statements the person's own acts would
  write, which the kernel stages into the run's group (`BO_0264_007`), refused `422` in words where
  the person's act would be. A structure used with values in the same call is written as one
  `roleFields` node, its defaults beside the values. The skill says to read the structures first, to
  write each block by its structures with a structure's description outranking the word, to rewrite the block
  that already uses a structure rather than insert a second (`roledBlockIsThePlace`), to propose a
  structure or a value when the command asks for it or when the words say a missing value, and that a
  structure or value the person set is rewritten only on the person's word. The skill reaches every run,
  since a run reads the skills of every active extension that allows it a tool
  (`calliopa-bootstrap`'s `BO_0299_003`).
- The Structures category and the structure page (`BO_0309_015`, landed 2026-09-30; `views/section.tsx`,
  `views/structure-page.tsx`): a section under *Structures*, Phosphor `tag`, listing the unretired structures,
  the built-ins first and marked *built in*, each opening as the kind
  `structures:documentRole` — the name the kind had before one structure type, kept because a
  workspace's open tabs are stored under it — with its own `+` (`data-new-structure`) creating *Untitled
  structure* and opening it. A built-in's row unfolds (`data-unfold-structure`) to the documents using it,
  each opening as itself. The page edits the name (not a built-in's), which renames the tab and the
  library entry, and the description; retires and restores (not a built-in); lists the fields, each
  renamed, retyped, marked required, given a choice's options and a default, moved and removed,
  and adds one by name and type; and lists what the structure allows, each taken back by its ×, with a
  choice allowing any other unretired structure, and says what allows it. Every act posts as it is made
  and the page shows what the route answered; a refusal is shown on the page in the route's words.
- The structure control (`BO_0309_021`, landed 2026-09-30; `views/control.tsx`, `BlockStructureControl` and
  `TitleStructureControl`): for a block, the `underCommand` block decoration, drawn in the structures chip
  `documents` stands in the command chip's row (`RO_0002_004`, landed 2026-10-01); for the document,
  the same control in its `title` place (`ui.shell`'s `BO_0309_030`, drawn by `documents`,
  `BO_0309_031`). The block's form (`data-role-form="pills"`) shows at rest one pill per structure used
  (`data-chip-structure`, `.block-role`, 24px tall) — the structure's name, the `!` and the missing fields in
  its title when a required value is missing, and *not allowed*, *retired*, *proposed* or *values
  proposed* beside it, as `label.tsx`'s `pillNote` and `pillTitle` say them while reading — each
  opening the popover unfolded at that structure, then a round `+` (`data-roles-add`, *Add a structure to
  this block*) opening it on the typeahead and the suggestions; on a block with no structures the `+`
  alone. A second press on what is open closes it (`aria-expanded`). The title's control uses the
  same form, its `+` named *Add a structure to this document* (`DO_0030_004`). Every press keeps the caret where it is
  (`preventdefault:mousedown`) and opens, beside the control where *The Popover Fits The Screen*
  places it — a block's chip ending at its right edge, since the chip stands at the right of the
  row, and the title's starting at its left, since the structures line starts at the header's edge —
  a popover (`data-roles-popover`) holding, first, the structures
  taken, each a pill with its own × (`data-clear-structure`) that unfolds to its fields, one input per
  type — a text box, a text area, a number, a date, a checkbox, a choice, a node id for a reference,
  a file uploaded through `documents`' `POST /api/x/documents/blobs` — each value posted on commit
  (change: blur or Enter), never on *Send*; then the suggestions (`data-suggested-structure`), each taken
  with one press; then a typeahead (`data-role-query`) over the structures the subject can use and does
  not, narrowed by every word typed, Enter taking the first. A structure just used opens on its fields.
  A refusal is said beside the control in the route's words (`data-role-refusal`). Its keys and
  input stay its own, so the editor's keys never act on them. The provider's state is shared with
  every block's control; the title stands outside the document's decoration provider, so its place
  holds a state of its own, read when the chip is first shown, and each write's answer is announced
  on the page (`structures-changed`) so the other state uses it: a document's structure used
  under the title allows its structures to the blocks at once.
- The sheet on a phone (after the walk, 2026-10-01; `views/control.tsx`, `structures.css`): under
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
  dependency on `keywords`, which depends on this extension. A structure allowed by a structure on the block's
  callout or the document scores by how near the allowing stands; the block's words — the
  title's and the first block's for the document — are lowercased, cut at everything that is not a
  letter or a digit, common words dropped, and matched against a structure's name (six), description
  (two) and field names (one), a word matching another when either begins with the other and both
  have four letters or more. At most three structures the block does not use, nothing when nothing
  scores; computed in the browser when the control opens, stored nowhere. Measured on the
  prefixes: *post*/*posts* and *publish*/*publishing* match without a stemmer, so none was added.
- The pills while reading (`BO_0309_021`; `views/label.tsx`, a `headline` block place): one pill
  per structure at a block using any, `.block-role`, words rather than a glyph, a `!` when a required
  value is missing and the missing fields in its name, and *not allowed*, *retired*, *proposed* or
  *values proposed* beside the name. Pressing a pill asks the structures chip standing under the block,
  once the press has started editing it, to open at that structure. The pills stay while the block is
  being edited (`RO_0002_Q3`). Under the title the document's structures stand in the header's structures
  line ([The Document Header](#the-document-header)).
- The bar's *Structures* group and its two choices went (`BO_0309_015`): nothing of this extension is in
  the document bar.
- Verified 2026-09-30 (`BO_0309_017`, the unit and behaviour parts): `views/views.test.ts` in Qwik's
  render harness — the section with the built-ins first and a built-in unfolding to its documents;
  the pills with several structures, the missing mark, *proposed* and *not allowed*; the control opening
  on the structures used, the typeahead limited to what the block can use and narrowed by what is
  typed, a structure used with a press and opening on its fields, a suggestion from the structure and
  the words taken with one press, a structure cleared by its ×, a field's value posted on commit, a
  refusal said, a pill opening its structure; the title's control using the document's structure and
  announcing the answer. `lib/suggest.test.ts` for the ranking; `server/api.test.ts` for the acts,
  the usable set to depth, values by type, defaults, the missing keys and the migration's
  statement; `server/tools.test.ts` for the tools' input. `tests/behavior/structures.test.ts` over CCGW
  under the kernel harness — allows and fields in the catalogue; several structures on one block, one
  allowed from the document, and a structure a block uses never allowed to that block nor to its
  sibling, nor *Hook* to the *Story* document itself; a structure left *not allowed* and
  allowed again; a same-named field on two structures kept apart, a default filled in on using, values
  refused by type and kept across clearing; the built-ins created once, refused a rename and using
  a field; the migration from a document structure; `propose_structures` staged, one `roleFields` node, and
  nothing standing before acceptance; the tool's answer. `keywords`' suites green over the one structure
  type. Five mutations — the allowing rule, the missing mark, the structure's score, the
  typeahead's narrowing, a pill's structure — each failed a test. `tsc --noEmit` clean.
- Walked by the user on the served build, 2026-09-30 to 2026-10-01 (`BO_0309_018`, pins 3300 to
  3387): the migrations ran once (`migration-bo-0309-builtin-roles` at revision 3302,
  `migration-bo-0309-one-role-type` at 3303); *Story* and *Keyword*, the instance's two document
  structures, stood as structures of the one type with their former ids, the block structures kept theirs, no
  document structure was left, and the four built-ins were listed first. The walk found two things,
  fixed the same day: *Big Message* was allowed to a block using *Story* and to a *Story*
  document's own chip, since the first build counted a subject's own structures (pin 3363); and a
  *Story* block's focused work neither showed *Story* in its header nor let its blocks use
  *Hook*, since structures were read inside one document alone and a document's own structures were drawn
  only while its title was edited (`readInherited` and the line under the title, pin 3387). After
  both, the user's word: "all works".
- Closed 2026-10-01 (`BO_0309_019`): the release line under *Changed* is `calliopa-bootstrap`'s
  `BO_0309_002`, and this change's document stands in `docs/changes/completed/` at `completed`.
- [ ] BO_0309_023 Drop the `documentRole` and `hasDocumentRole` declarations with an
      `ext.migration` naming them, once every install has run `migration-bo-0309-one-role-type`:
      a release after the one using it, since an install that skips a release runs the
      migration from the first pin it serves that uses it.
- [ ] BO_0309_024 A reference field limited to no structure chosen by a document's or a block's title,
      as the `#` list allows them, rather than typed as an id. A reference limited to a structure is
      chosen by title already (`BO_0336_011`).
- A document using the built-in *Instruction* writes `documents`' `record: instruction` in the same
  statement, and clearing it clears the record, so a document given *Instruction* here is an instruction
  everywhere an instruction is read (`calliopa-bootstrap`'s `BO_0311_015`,
  [Instructions](../../../instructions/docs/system/system.md#the-instruction-in-the-chip-with-tools)). No
  block uses it (`BO_0332`).
- `instructions`' half of `BO_0299_Q5` (`BO_0299_020`) is `instructions`' chip (`calliopa-bootstrap`'s
  `BO_0311_011`): an instruction document uses structures like any document, and the chip groups first
  the instructions using a structure the block or its document uses, read through `structuresOf` and
  `documentsCarrying` under a declared dependency on this extension, then every other instruction
  ([Instructions](../../../instructions/docs/system/system.md#the-instruction-in-the-chip-with-tools)). A
  instruction's *Hook* block reaches a run as the rest of its words do, since the run's instruction
  section (`ui-kernel.md` `BO_0298_001`) carries the instruction's blocks.
- The built-ins *Definition* (`builtin:definition`) and *Alias* (`builtin:alias`) (`calliopa-bootstrap`'s
  `BO_0310_030`, landed 2026-09-30; `lib/structures.ts`, `BUILTIN_STRUCTURES`, `BUILTIN_OFFERS`): two more
  built-ins after the four, allowed by *Keyword* through `offers` edges a release makes, which
  `unoffer` refuses by the rule `builtinOffer` and the structure page draws marked *built in* with no ×.
  They are refused a rename, retire and restore as every built-in is. They reach an instance by the
  executable migration `migration-bo-0310-keyword-builtins`, route `kernel/migrations/keyword-builtins`,
  after `migration-bo-0309-builtin-roles`, which creates them with it on a fresh install:
  `keywordBuiltinsStatement` relates the allows that do not stand and nothing else, so it is
  idempotent. What they mean is `keywords`' ([Keywords](../../../keywords/docs/system/system.md)).
- *Send with prompt* (`BO_0310_031`, landed 2026-09-30): `blockRole` permits `sendWithPrompt`, a
  list of *Keyword*'s field keys and allowed-structure ids, read into the catalogue's `StructureView` and a
  used structure's `TakenStructure` on `builtin:keyword` alone, so `structuresOf` answers it. The act
  `{command: "sendWithPrompt", entry, on}` on `POST /api/x/structures/roles/[id]` switches one
  entry, one truth write, refused by the rule `sendWithPrompt` on any other structure and for an entry
  that is neither a field nor an allowed structure of *Keyword*. *Keyword*'s page draws a *Send with
  prompt* heading with one switch per field and per allowed structure (`data-send-with-prompt-entry`),
  in that order. The same migration sets `sendWithPrompt` to `["builtin:definition"]` where
  `builtin:keyword` holds none, so a fresh install sends the definition and an upgrade never resets
  what a person switched. What is sent is `keywords`' (`BO_0310_025`).
- Verified 2026-09-30 (`BO_0310_030`, `BO_0310_031`): `views/views.test.ts` for *Keyword*'s page —
  a switch per field and allowed structure, the definition on, a flip posting the act and showing the
  answer, no × on a built-in allowing, no switches on another structure; `tests/behavior/structures.test.ts`
  over CCGW — the six built-ins created once; the keyword built-ins migration relating the allows,
  setting the default once and answering nothing after; the built-in allowing and a built-in's rename
  refused; a switch on and off; the refusals on another structure and for an entry *Keyword* does not
  hold.
- *Source*'s release fields (`calliopa-bootstrap`'s `BO_0313_010`, landed 2026-10-01; `lib/structures.ts`
  `SOURCE_FIELDS`, `CSL_TYPES`): *Kind* (`kind`, a required choice of every CSL 1.0.2 type),
  *Authors* and *Editors* (`authors`, `editors`, long text), *Issued*, *Container*, *Volume*,
  *Issue*, *Pages*, *Publisher*, *Place*, *DOI*, *ISBN*, *URL*, *Accessed* (text), *Abstract* (long
  text), *Tags* (text), *File* (file) and *Fetched* (text) — the CSL record of a source document,
  whose title is the document's. What they mean is `bibliography`'s ([Bibliography](../../../bibliography/docs/system/system.md#sources-beyond-papers)).
  A built-in's release fields are the `fields` its `BUILTIN_STRUCTURES` entry declares, read by
  `releaseFieldsOf`: `removeField` refuses one by the rule `builtinField`, naming the structure, and a
  person adds fields beside them. The executable migration `migration-bo-0313-source-fields`
  (route `kernel/migrations/source-fields`, after `migration-bo-0309-builtin-roles`) answers
  `releaseFieldsStatement`, the statement *Format*'s `format-fields` answers too: each release
  field put by its key in place of what stands under it or after the fields there, every field a
  person added kept, and nothing when they stand. A fresh install's `builtin-roles` creates
  *Source* with them.
- A built-in structure's row in *Structures* carries the create action of the extension owning its meaning
  (`calliopa-bootstrap`'s `BO_0313_011`, landed 2026-10-01; `lib/structures.ts` `BUILTIN_CREATES`,
  `contributions.server.ts` `withCreate`, `views/section.tsx`). The release names it by the
  built-in's fixed id, as it names the built-ins themselves: *Source* → the kind
  `bibliography:new-source`, *Add source*. The section's reader answers it on the row as
  `StructureView.create` only while that kind is in the build — an owner switched off draws none — and
  the row draws it as a `+` (`data-role-create`) after its name, opening the kind with the item
  `new`. A row with none creates nothing. The registry is imported when the reader runs, since it
  imports this module. Proven in `server/api.test.ts`: *Source*'s fields and *Kind*'s options,
  the release fields of each built-in, and the action used on *Source* alone and only while
  its kind is registered.
- Focused work under a structured block (`RO_0001`, closed 2026-10-01): a block's focused work stands
  under the structures of the block it was opened from, by `readInherited` (*Taking and values*
  above). The focused work's header shows them *from above*, every block in it is allowed what
  they allow — *Hook* under *Story* — and nothing is used until the person uses it. Proven by
  `tests/behavior/structures.test.ts`'s focused-work case and `views/views.test.ts`'s *a block's
  focused work*.
- *Format*'s built-in fields (`calliopa-bootstrap`'s `BO_0312_010`, landed 2026-10-01): `type`, a
  required choice of text, table, image, video, PDF and structured, and `schema`, long text, read
  for structured output — the `fields` *Format*'s `BUILTIN_STRUCTURES` entry declares, read by
  `releaseFieldsOf` as *Source*'s are. A release field is refused a removal and a change of its type
  or options, both by the rule `builtinField` (`isBuiltinField`); a person renames it, marks it
  required and adds fields beside it. The structure page draws a release field with no × and its type
  and options fixed (`data-builtin-field`). They reach an instance by the executable migration
  `migration-bo-0312-format-fields` (route `kernel/migrations/format-fields`, after
  `migration-bo-0309-builtin-roles`), which answers `releaseFieldsStatement` as *Source*'s does.
- A field's key is minted from the name it is first given (`mintFieldKey`, `calliopa-bootstrap`'s
  `BO_0312`, 2026-10-01): its words in camel case, ASCII letters and digits, numbered when the structure
  holds it already — *Citation style* is `citationStyle` — and a rename keeps it. Before, a key
  was a UUID, which no reader could name; `manuscripts` reads a venue's and a paper's values by key.
  Fields made before keep their UUID keys. A field removed and added again under the same name
  finds its stored values. Technical decision at implementation.
- Verified 2026-10-01 (`BO_0312_010`): `lib/structures.test.ts` for the key's minting and which fields
  are a release's; `views/views.test.ts` for *Format*'s page, its two fields fixed and a person's own
  removable; `tests/behavior/structures.test.ts` over CCGW for the migration adding both once, repairing a drifted one and
  answering nothing after, the removal and the retyping refused, and keys minted, numbered and kept
  through a rename.

## The Structures Chip

- Under `RO_0002` (`docs/changes/RO_0002_FEAT_roles-in-their-own-chip.md`), set to draft by the
  user on 2026-10-01 and transferred here the same day: the block's role control leaves the command
  chip for a chip of its own beside it. The slot is `ui.shell`'s
  ([Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md#a-chip-beside-the-command-chip),
  `RO_0002_001`); drawing the chip is `documents`'
  ([Command Mode](../../../documents/docs/system/documents/command-mode.md#a-chip-beside-the-command-chip),
  `RO_0002_002`). The `title` place and its control, the pills while reading, the *Structures* category
  and how a structure is suggested, picked or allowed do not change.
- Verified 2026-10-01 (`RO_0002_005`): `views/views.test.ts` in the render harness — the structures
  chip showing two pills and a `+` with nothing open, the `!`, the missing fields and *not allowed*
  on its pills, no structure icon; a block with no structures holding the `+` alone, which opens the typeahead
  and the suggestions; a pill opening its structure's fields, and a second press closing them; a reading
  pill opening the chip at its structure; the reading pills standing while the block is edited; the
  control contributed to `underCommand` and nothing to `command`; the block cases before this
  change opening from the `+` or a pill. Drawing the block in the icon's form, a pill opening on
  nothing, and contributing to `command` each failed a test. `structures` 38 and `keywords` 30
  pass.
- The release line (`RO_0002_006`): the structures are released for the first time with this change,
  so `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` says it in the structures line under
  *Changed* (`BO_0309_002`'s), rewritten to name the chip beside the command line, its pills and its
  `+`, and the tag under the title, rather than adding a line about a tag no release carried.
- Walked by the user on the served build, 2026-10-01 (`RO_0002_007`, pins 3535 to 3635): the
  structures chip first stood below the command chip as built, and the user moved it into the command
  chip's row at the right (pin 3611); on an iPhone the user expected the popover apart from the
  chip, and it became the sheet from the bottom (pin 3635). After both, on a desktop and an iPhone,
  the user's word: "works".
- Closed 2026-10-01: the release line is the structures line under *Changed* (`RO_0002_006`), and the
  change's document stands in `docs/changes/completed/` at `completed`.


## The Popover Fits The Screen

- Under `RO_0004` (`docs/changes/completed/RO_0004_FIX_the-roles-popover-fits-the-screen.md`), set to draft
  by the user on 2026-10-01 and transferred here the same day: the structure control's popover, for the
  block's chip and the title's, fits the visible area rather than extending the page. The popover
  is the one *The structure control* above describes; what it holds and how it acts do not change.
* The popover stands wholly inside the visible area of the view on every viewport, for the block's
  chip and the title's, and never lengthens the document, widens it, or scrolls the page to show
  itself. What does not fit inside it scrolls inside it, the typeahead and the structures used
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
* One structure's fields are unfolded at a time; unfolding one folds the one open before (`RO_0004_Q3`).
- The popover above the phone width (`RO_0004_001`, landed 2026-10-01; `lib/placement.ts`,
  `views/control.tsx`, `structures.css`) is `position: fixed`, so it takes no room in the page. While it
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
  `structures` 65 and `keywords` 30 pass (one `keywords` view test fails about one run in four
  on the head as well, Qwik's *Must be same function*); the theme-token check passes for
  `structures.css`. Measured in Chromium on this tree served beside the instance, a probe account
  editing *Quantum Advantage* (41 blocks): at 1280×800 a block's chip near the top opened below
  (popover 862–1214 × 362–502 under its chip ending at 1214), one near the bottom above (543–715
  over its chip at 721), the title's chip below from its left edge, each inside the document pane
  (304–1280 × 47–768), the typeahead inside it, nothing scrolling sideways, and every scroll extent
  of the page unchanged by opening it; a press on another block's words closed it and edited that
  block. At 390×844 and 360×740 on a touch screen the sheet spanned the width and ended at the
  screen's bottom edge over the dimmed page, the extents unchanged, and a tap on the dimmed page
  closed it. The keyboard was not simulated; the walk uses it.
- The top layer (after the walk, 2026-10-01; `views/control.tsx`, `structures.css`): the popover and the
  dimmed page are `popover="manual"`, and while the popover is open the control raises the dimmed
  page and then the popover with `showPopover`, where the browser has it. In the top layer no
  stacking context of the page holds them, so on a phone the dimmed page covers the shell's header,
  its view bar and the agents' chip row as well as the document, and a desktop popover near the
  pane's top stands over the view bar. The browser's own margins and sizes for a popover are reset
  in `structures.css`; where it has no popover API both stay where the page draws them. Proven in
  `views/views.test.ts`: the dimmed page raised, then the popover, both `popover="manual"`.
  `structures` 66 pass. Measured again on the served copy: in every case above the popover is
  `:popover-open` and is what stands at its own middle; on a phone at 390 and 360 the dimmed page is
  what stands at the header, the view bar and the chip row; the rest as before.
- The release line (`RO_0004_004`): none of its own. The structures have not been released yet
  (`RO_0002_006`), so they ship fitting, and the structures line under *Changed* in
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` already says how the chip opens.
- Walked by the user at pin 3735, 2026-10-01: it works, but on the phone the toolbar and the
  agents' chips stood undimmed over the dimmed page; they now stand under it (the top layer above).
- Walked again by the user at pin 3747, 2026-10-01 (`RO_0004_005`), on a desktop and a phone: the
  user's word, "works".
- Closed 2026-10-01: no release line of its own (`RO_0004_004`), and the change's document stands in
  `docs/changes/completed/` at `completed`.

## Document Structures And Block Structures

- Under `calliopa-bootstrap`'s `BO_0332` (`docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`,
  shaped here as `RO_0003`), set to draft by the user on 2026-10-01 and transferred here the same
  day: a structure says whether blocks may use it, and *Keyword*, *Instruction*, *Format* and *Source* are
  used by documents alone (the fixed lines under *What This Extension Holds*). *Format*'s output
  made per document is `manuscripts`'
  ([Manuscripts](../../../manuscripts/docs/system/system.md#formats-per-document), `BO_0332_030`–`BO_0332_033`),
  and `make_manuscript`'s input the kernel's (`calliopa-bootstrap`'s `ui-kernel.md`, *Document Structures
  And Block Structures*, `BO_0332_001`).
- The setting (`BO_0332_010`, landed 2026-10-01; `lib/structures.ts` `blocksAllowed`, `server/structures.ts`):
  `blockRole` permits `blocks`, written `true` or `false` by the act and read as allowed when
  absent, so no structure made before needs a write. A built-in's is read from its `BUILTIN_STRUCTURES`
  entry, never from the node, as its name is: `blocks: false` on *Keyword*, *Instruction*, *Format* and
  *Source*, nothing on *Definition* and *Alias*. The catalogue's `StructureView` and a used structure's
  `TakenStructure` carry `blocks`. The act `{command: "blocks", allowed}` on `POST …/roles/[id]`
  (`parseStructureCommand`) is one truth write, refused in words on a built-in by the rule
  `builtinBlocks`.
- Taking (`BO_0332_011`, landed 2026-10-01): `takeableFrom(roles, above, onBlock)` leaves a structure
  blocks may not use out of every block's `takeable`, allowed or not, and keeps it in the
  document's — a focused work's document included, so a document-only structure allowed from above
  reaches that document's chip and none of its blocks. A structure a block uses that blocks may not
  use is answered with `notOnBlock: true`. `takeStatement` refuses it on a block by the rule
  `blockNotAllowed`, before the allowing is looked at, for the route and for `propose_structures` alike;
  clearing it and its values stay open. `read_document_structures` marks such a structure `documentOnly`
  and a block's kept one `notOnBlock`, and the skill `structures.roles` says, as
  `documentRolesOnTheDocument`, to propose a document structure on the document and leave a kept one
  unless the person asks. `blockRole`'s declaration permits `blocks`, its semantics saying the
  document always may use a structure.
- The structure page (`BO_0332_012`, landed 2026-10-01; `views/structure-page.tsx`): a switch *Blocks may use
  this structure* (`data-role-blocks`) under the description, on for a new structure, drawn fixed on a
  built-in with the release's word in its title; with it off the label adds *used by documents
  alone*, and *Offers* says a structure nobody allows can be used by any document. Beside an allowing of
  a structure blocks may not use, the page says *used by the document under a block using* the
  structure, *never by its blocks* (`data-offer-document-only`).
- The pills and the suggestions (`BO_0332_013`, landed 2026-10-01): `structureState` answers *not
  allowed on a block* for a kept structure, after *retired* and before *not allowed*, so the reading
  pill, its title and the structures chip's pill say it as they say *not allowed*. The suggestions are
  drawn from the block's `takeable`, so a structure blocks may not use is never suggested to a block.
- Verified 2026-10-01 (`BO_0332_014`): `server/api.test.ts` — the act parsed and refused in words,
  `blocksAllowed` for the built-ins and a person's structure, and the usable sets on a block and on
  the document, with a document-only structure allowed from above; `lib/suggest.test.ts` — a structure whose
  words match never suggested to a block and suggested to the document; `views/views.test.ts` —
  the pill's *not allowed on a block*, the switch posting `{command: "blocks", allowed: false}`
  and the note beside an allowed document-only structure, and a built-in's switch fixed;
  `tests/behavior/structures.test.ts` over CCGW under the kernel harness — a structure switched to documents
  alone leaving every block's `takeable` and staying on the document's, a block keeping it and
  saying `notOnBlock`, the refusals by the route and by `propose_structures`, the tool's
  `documentOnly` and `notOnBlock`, the four built-ins refused on a block and *Format* used on a
  document, `builtinBlocks`, and a document-only *Beat* allowed by *Scene* used by the Scene
  block's focused work's document and refused on its block. `keywords`', `instructions`' and
  `bibliography`'s suites green; the harness's other failures stand on a pristine checkout of the
  same head too.
- Walked by the user on the served build, 2026-10-01 (`BO_0332_015`, "worked"): a structure switched to
  documents alone left a block's `+` and stayed under the title, a block that used it said *not
  allowed on a block*, *Format* was allowed on a document and on none of its blocks, a manuscript
  was made of a document using *Format* (PDF) and listed at its end, and an image instruction
  generated with no *Format*.
- Closed 2026-10-01 (`BO_0332_016`): the release lines are `calliopa-bootstrap`'s `BO_0332_002`, and
  this change's document stands in `docs/changes/completed/` at `completed`.

## The Document Header

- Under `documents`' `DO_0030` (set to draft by the user on 2026-10-01 and transferred the same
  day): a document's head is one header — route, title, structures line, values line, mentions line
  ([Block Editor View](../../../documents/docs/system/documents/block-editor.md#the-document-header)).
  This extension draws the structures line and the values line through the `title` place, as two rows
  of its one contribution (`ui.shell`'s `DO_0030_001`); the structures line's pills and their order do
  not change.
- The structures line (`DO_0030_004`, landed 2026-10-01; `views/control.tsx`, `structures.css`):
  `TitleStructureControl` draws, with `form="full"`, `.title-roles` holding `.title-roles__line` — the
  structures from above first, muted (`data-role-state="from above"`), *from above*, naming where they
  come from in their title and opening nothing, then the structure control in the pills form the block's
  chip has: the document's own pills, each opening the popover at its structure, and the `+` — always
  drawn, reading and editing alike. The control has one form. `placePopover` aligns the title's
  popover at the control's start (`align: "start"`), since the line starts at the header's edge,
  and a block's at its end (*The Popover Fits The Screen*). With `form="compact"` it draws `CompactRoles`:
  the pills as words (`data-compact-structure`), the structures from above muted, no `+` and no popover, on
  one line; their widths are measured once all are drawn and `fittingPills` keeps as many as leave
  room for a last *+N* (`data-roles-more`) counting the rest, again on every resize of the line.
- The values line (`DO_0030_005`, landed 2026-10-01; `lib/values.ts`, `ValuesLine` in
  `views/control.tsx`): under the structures line, `.title-values` (`data-role-values`), one entry per
  own structure holding a filled value (`data-role-values-of`) — the structure's name, then its filled values
  in field order joined by *, *, entries apart by *·* — and nothing when no value is filled, for a
  structure a run only proposes, or with `form="compact"`. `valueWords` says a value as a person reads
  it: text and a choice as they stand, trimmed; long text to its first line, cut at 80; a number as
  written; a date in the reader's locale at medium length, read as a calendar day so no time zone
  moves it (*12 Oct 2026*); true as the field's name, false left out; a file by its filename; a
  reference by the title `structuresOf` answers for it, or the id it holds when nothing it names reads.
  `structuresOf` answers `referenceTitles` beside the document's view, a widening of the contract: for
  each distinct reference value of the document's own structures, one read of the node, a document by
  its title and a block by its first words cut at 60 (`titleOfNode`). The line reads the state the
  title's control holds, so a value committed in the popover shows at once.
- Verified 2026-10-01 (`DO_0030_011`): `views/views.test.ts` — the document's structure used from the
  `+` and the answer announced, no structure icon; the structures from above, the own pills and the `+` in
  that order with nothing focused, a pill opening its structure; the values line with a date, a number
  and a choice, an empty field and a structure with none left out, a value committed in the popover shown
  at once, and nothing when none is filled; the compact form's pills with no `+`, no values and
  nothing to press; `fittingPills` for pills that fit and pills counted. `lib/values.test.ts` for
  every field type, the long text, nothing filled, a reference naming nothing; `server/api.test.ts`
  for `titleOfNode`. Mutations — a structure with no value given an entry, the compact form drawn full —
  each failed a test. `referenceTitles`' read over CCGW, the observer and the *+N* count on a live
  page are the walk's (`DO_0030_009`).

## Formats Carry Generation

Under `calliopa-bootstrap`'s `BO_0336` (promoted to draft by the user on 2026-10-02 and transferred
here the same day; owned in the graph by `media`, whose
[Generation Settings Live In The Format](../../../media/docs/system/system.md#generation-settings-live-in-the-format)
holds the change's fixed lines): a format document carries what a picture or a video is made
with, an instruction names its format, and a field may suggest values without limiting them. This
extension knows the field shapes and the release fields; what a source suggests is its
extension's.

* A field may suggest values without limiting them: anything typed is kept as typed. User
  decision, 2026-10-02.
* A structure the person creates may give a field suggestions — from any source an extension declares,
  and from a list the person types on the field — and may limit a reference to documents using
  any one structure. User decision, 2026-10-02.
- The suggesting field (`BO_0336_010`, landed 2026-10-02; `lib/structures.ts`, `views/control.tsx`
  `SuggestingInput`): a text field's declaration may carry `suggest`, a source as
  `<extension>:<name>` (`isSourceName`), and `suggestions`, words of its own, kept trimmed, without
  blanks or repeats (`cleanWords`); `fieldOf` reads both on a text field alone. Focused, the input
  asks the frame's `GET /api/suggestions/<extension>/<name>` (`ui.shell`'s
  [A Variation And Suggestions](../../../../../docs/system/workspace/contribution-contract.md#a-variation-and-suggestions))
  with the subject's values as the query, and opens the source's answer then the field's words,
  narrowed by what is typed (`narrowed`), eight at most; a press fills one in and posts it, and
  anything typed is posted as typed on commit. A source nothing answers says *Nothing on this
  instance suggests values here*, a note the source gives is shown as given, and the field stays
  typeable. On a block, the values asked with are those of the document's structures allowing the
  block's role, with the block's own over them (`contextOf`): a *Variation* block leaving its
  provider empty is asked for its format's.
- A reference limited to a structure (`BO_0336_011`, landed 2026-10-02; `views/control.tsx`
  `CarryingReference`): a reference field may carry `carrying`, a structure id. Focused, it lists the
  documents using that structure by title (`GET /api/x/structures/roles/<role>/documents`),
  narrowed by what is typed; a press stores the document's id, and clearing the words clears the
  value. A value naming a document that does not use the structure is refused by the rule
  `notCarrying` in words. The field shows the value's title from the view's `referenceTitles`.
- A person's own fields (`BO_0336_012`, landed 2026-10-02; `views/structure-page.tsx`): a text field's
  row carries a source picked from those the frame lists (`GET /api/suggestions`) or none, and a
  list of words; a reference field's row a structure from the catalogue whose documents it uses, or any
  node by id. `reviseField` takes `suggest` (a source or `null`), `suggestions` and `carrying` (a
  structure id or `null`, an unknown structure refused `unknownStructure`); a change of type drops what no longer
  fits it. On a release field all three are the release's: refused by `builtinField`, drawn fixed.
- *Format*'s, *Instruction*'s and *Variation*'s release fields (`BO_0336_013`, `BO_0336_014`, landed
  2026-10-02; `lib/structures.ts` `GENERATION_FIELDS`, `BUILTIN_STRUCTURES`, `BUILTIN_OFFERS`):
  *Format* carries `provider`, `model`, `ratio` and `quality` after `type` and `schema`, text, not
  required, suggesting from `media:provider`, `media:model`, `media:ratio` and `media:quality`;
  *Instruction* carries `format`, a reference carrying `builtin:format`, not required; the built-in
  *Variation* (`builtin:variation`) allows blocks, carries the same four, and is allowed by
  *Format* through a release's allowing. They reach an instance by two executable migrations: the
  member `migration-bo-0336-variation` (route `kernel/migrations/builtin-roles`, after
  `migration-bo-0313-source-fields` and `migration-bo-0310-keyword-builtins`), whose script
  creates the built-ins an instance does not hold, *Variation* here; and
  `migration-bo-0336-generation-fields` (route `kernel/migrations/generation-fields`, after it and
  `migration-bo-0312-format-fields`), `generationFieldsStatement`: the allowing where it does not
  stand and the three structures' release fields by key, every field a person added kept, nothing when
  all stand. A fresh install's `builtin-roles` creates all three with them.
- Verified 2026-10-02 (`BO_0336_015`): `lib/structures.test.ts` — the generation fields and their
  sources on *Format* and *Variation*, *Instruction*'s `format`, the allowing, and `fieldOf` keeping a
  source, words and a structure only where they fit; `views/views.test.ts` — a *Variation* block's model
  suggestions asked with its format's values and one filled in with a press, a value typed outside
  them posted as typed, a source nothing answers said, a reference chosen by title among the
  documents using its structure, a person's text field given a source and a reference a structure on the
  structure page, and a release field's fixed; `tests/behavior/structures.test.ts` under the kernel harness
  — the migration adding the allowing and the fields once and nothing after, *Variation* a block's
  structure allowed by *Format*, a release field's source refused a change, an instruction's format refused a
  document not using *Format* and taken one that does, a value typed kept, a *Variation* block,
  and a person's field given a source, words and a structure, a retype dropping the source.

## Roles Become Structures

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day (its change document is this extension's, `docs/changes/BO_0338_REFACTOR_roles-to-structures-profiles-to-instructions.md`):
a role becomes a *structure* and *Roles* becomes *Structures*, in what people read, in what a run
is told and in every stored identifier and route, and this extension's id becomes `structures`.
The kernel's half — the general extension-id move, the run's intake and record, the harness's
vocabulary — is `calliopa-bootstrap`'s `extension-model.md` (`BO_0338_001`) and `ui-kernel.md`,
*Structures And Instructions* (`BO_0338_003`–`BO_0338_009`); `instructions`' half is its own
([Profiles](../../../instructions/docs/system/system.md#profiles-become-instructions)).

* Role becomes structure and Roles becomes Structures. A block *uses* a structure, and a structure
  *allows* structures — a *Story* allows *Hook* and *Closing* — in place of *takes* and *offers*;
  *parent* and *child* stay excluded. User decisions, 2026-10-02, the verbs reversing those of
  `BO_0308_Q1`.
* A full rename: the extension id, the record values, the routes, tools, skill and refusals move,
  with migrations, and old names are cut in the same release with no aliases. Every structure,
  assignment, field value and allowed structure a person has survives it. User decisions,
  2026-10-02.
* The graph's stored type and relation names (`blockRole`, `roleFields`, `hasBlockRole`, `offers`,
  `documentRole`, `hasDocumentRole`) and the built-in node ids (`builtin:profile` and the rest)
  stay as internal identifiers no person, agent or API reads by name: CCGW never changes a node's
  type or id (`calliopa-bootstrap`'s `BO_0123`). User decision, 2026-10-02.
* The built-in *Profile* becomes *Instruction* by the release; a person still cannot rename a
  built-in, and no rename control is added. The Format field `type` keeps its choice `structured`
  and its stored value. User decisions, 2026-10-02.
- Unrelated uses keep their names: the text block's typographic `role` and the editor's text roles.
- The id moved (`BO_0338_020`, 2026-10-02): the manifest's `id` is `structures`, version 0.2.0,
  with `formerIds: ["doc-block-roles"]`, so the kernel's general move (`calliopa-bootstrap`'s
  `extension-model.md`, *An Extension Moves To A New Id*) carries every member, its state, its
  settings and the tabs open on it; the subtree is `src/extensions/structures/`, its routes
  `/api/x/structures/…` and `/api/library/structures/…`, its kinds `structures:…`, and `keywords`,
  `manuscripts`, `media`, `bibliography` and `instructions` name `structures` in their
  `dependencies`. The registry orders an extension by its first former id (`placeOf` in
  `scripts/registry.mjs`), so *Structures*' rows and controls keep their places (user decision,
  2026-10-02). The change prefix stays `RO`.
- *Instruction* is the built-in's name (`BO_0338_022`, 2026-10-02): `BUILTIN_ROLES` names
  `builtin:profile` *Instruction*, its id kept, and `INSTRUCTION_ROLE` names the id in code. The
  executable migration `migration-bo-0338-builtin-names` (route `kernel/migrations/builtin-names`,
  after `migration-bo-0309-builtin-roles`; `builtinNamesFor`) sets every built-in's stored name and
  description to the release's where they differ, on the same node, and answers nothing after. A
  document using it writes `documents`' `record: instruction`
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#structures-and-instructions)).
  Verified by `server/builtin-names.test.ts`: a stored *Profile* named *Instruction* on its node,
  and an empty script once every built-in reads as the release says.
- What a run is told says structure (`BO_0338_021`, `BO_0338_023`, 2026-10-02): the tools are
  `propose_structures` (input `use`, `clear`, `values`) and `read_document_structures` (answering
  `usable` per block), routes `kernel/tools/propose_structures` and
  `kernel/tools/read_document_structures`, their nodes kept; the skill `doc-block-roles.roles`
  (its node id kept) speaks of structures a block uses and a structure allows, and keeps
  *role* for the typographic one; the declarations' `semantics` and `properties` words say the
  same over their stored names, and the kernel's harness copy follows. Refusals and answers say
  structure, use and allow.
- What a person sees says structure (`BO_0338_024`, 2026-10-02): the category and section
  *Structures* (*No structures yet*, *New structure*), the structure page (*Allows*, *Allow a
  structure*, *Stop allowing …*, *Blocks may use this structure — used by documents alone*), the
  pills (*not allowed here*, *not allowed on a block*), the chip, its suggestions and refusals,
  and the `data-*-structure` attributes and `structure-*` classes. The tab kind `documentRole`
  and the view id `document-role` keep their names, since open tabs are saved by them.
- The code says it (`BO_0338_025`, 2026-10-02): `lib/structures.ts`, `server/structures.ts`,
  `views/structure-page.tsx`, `views/structures.css` and every symbol named for structures
  (`structuresOf`, `setStructure`, `StructureView`, `KEYWORD_STRUCTURE` and the like), the routes
  `/api/x/structures/structures/…` and `/api/library/structures/structures`, and every reader in
  another extension calling the new names. The constants naming stored types and ids keep their
  values, and the field node's stored `role` property and the executed migrations' routes
  (`one-role-type`, `builtin-roles`) keep theirs. Verified by the unit suites: 93 tests of this
  extension and those of `keywords`, `manuscripts`, `media`, `bibliography` and `instructions`.
- Verified 2026-10-02 on a throwaway stack updated from `0.4.3` to a `0.5.0` built from the change
  (`BO_0338_026`; `calliopa-bootstrap`'s `distribution.md`, `BO_0338_012`): a person's structure
  with a date field allowing another, used by a document and its block with a value, read under
  `structures` on the same ids after the update, the built-in named *Instruction* by
  `migration-bo-0338-builtin-names`, a tab open on the structure moved to `structures:documentRole`,
  the versions from before the move listed, and the old routes answering `404`.
- This extension's docs speak the new terms (`BO_0338_027`, 2026-10-02): this document's title and every
  section say structure, *uses* and *allows*, the fixed line of `BO_0308_Q1` with the user's verbs;
  the stored names, the typographic *role* and the change documents' names keep their form.
- This change document stands here at `Status: completed`, under `docs/changes/completed/`
  (`BO_0338_028`, 2026-10-02), as it does in `calliopa-bootstrap`; its follow-up is
  `calliopa-bootstrap`'s `BO_0338_015`, the device's test and walk.

## A Structure Is A Document

Under `RO_0005` (`docs/changes/RO_0005_FEAT_a-structure-is-a-document.md`), set to draft by the
user on 2026-10-02 and transferred here the same day: a structure is defined as a document, with
the pattern and the interface of any structured document, and *Structure* is itself a built-in
structure. It lands after `calliopa-bootstrap`'s `BO_0338` has completed, since it rewrites the code
and the docs that change renames. `documents`' half is its
[A Structure Is A Document](../../../documents/docs/system/documents/block-document-model.md#a-structure-is-a-document);
`keywords`, `instructions`, `bibliography`, `media` and `manuscripts` follow the new ids in their
own docs. No fixed-layer work arises: no declaration changes, so the kernel harness's vocabulary
copy stays as it is.

* A structure is a document. Its name is the document's title, its description the document's
  ordinary blocks, and it uses the built-in *Structure*. Requested by the user, 2026-10-02
  (`RO_0005_Q1`).
* *Structure* is a built-in structure, used by documents alone, carrying the release fields
  *Blocks may use* (true/false) and *Allows* (references to structures), set in the structure's
  header as any document's values are. It allows *Field*. Requested by the user, 2026-10-02.
* A field is a block of the structure's document using the built-in *Field*: the block's words are
  the field's name, its place among the blocks the field order, and *Field*'s release fields —
  *Type*, *Required*, *Options*, *Default*, the suggestions and the structure a reference is
  limited to — its declaration. *Default* takes the type *Type* names and is drawn as that type.
  Requested by the user, 2026-10-02 (`RO_0005_Q4`).
* *Allows* is one value holding several structures, picked from the structures in the value's
  typeahead: a reference holding a list, a field type open to any structure. User decision,
  2026-10-02 (`RO_0005_Q3`).
* A structure's document stands in *Structures* and among the documents, listed and found like any
  document. User decision, 2026-10-02 (`RO_0005_Q2`).
* A structure is created by *Structures*' `+` alone: *Structure* is never offered by a document's
  `+`, and its pill on a structure carries no ×, so no document becomes or stops being a structure
  by taking or clearing it. User decision, 2026-10-02 (`RO_0005_Q9`).
* A person adds a field by giving a block *Field* from its structures chip, where *Field* is
  suggested first on a block of a structure's document; nothing else adds one. User decision,
  2026-10-02 (`RO_0005_Q10`).
* A structure is written as any document: a person's writes are truth at once, a run's are
  proposals the person accepts, so a run may propose a structure and its fields. User decision,
  2026-10-02 (`RO_0005_Q5`), replacing *with no proposal* of `BO_0299_Q2` for structures.
* A person cannot extend *Structure* or *Field* with fields of their own. User decision,
  2026-10-02 (`RO_0005_Q6`).
* Retiring and restoring a structure stay acts beside its header, never a value; a structure is
  still retired, never deleted. User decision, 2026-10-02 (`RO_0005_Q7`).
* Where a structure's description is read, its document's blocks stand in: the first block's text
  in a pill's title, the typeahead and the suggestions, the whole text to an agent. User decision,
  2026-10-02 (`RO_0005_Q8`).
* A built-in's title and its release fields stay the release's: the title cannot be changed, and a
  release field's block cannot be removed nor its type, options, suggestions or limit changed; a
  person renames it, marks it required, describes the built-in and adds fields beside the release's,
  as today. *Structure* and *Field* take no field a person adds.

- Ids (technical decision at transfer): CCGW never changes a node's type and a built-in's id is
  held by its `blockRole`, so every structure gets a new `document` node. A built-in's document
  takes the fixed id `structure:<name>` — `structure:structure`, `structure:field`,
  `structure:keyword`, `structure:instruction` (where `builtin:profile` stood),
  `structure:format`, `structure:source`, `structure:definition`, `structure:alias`,
  `structure:variation` — and a release field's block `structure:<name>:<key>`; the `structure:`
  prefix is what `documents` reads as the release's (`RO_0005_020`). A person's structure takes a
  minted document id. The code names each id once (`lib/roles.ts`), and readers in other extensions
  import the names, never the strings.
- Storage (technical decision at transfer): a structure's document carries `documents`'
  `record: structure` and uses *Structure* through `hasBlockRole`, its *Blocks may use* and *Allows*
  in its `roleFields` for *Structure*; a field's declaration is the `roleFields` its block holds for
  *Field*. Three keys are kept in those values and never drawn as fields: `key` on a *Field* block,
  minted once as today (`mintFieldKey`) and kept through a rename, so every stored value and every
  reader by key (`manuscripts`) finds its field; and `formerId` and `retired` on a structure's
  *Structure* values. `blockRole` and `offers` stay declared and are no longer written, so no
  declaration changes. A reference holding a list is the reference type with `many: true`, its value
  a list of node ids.

- [ ] RO_0005_001 The model: *Structure* and *Field* in `BUILTIN_ROLES` with their release fields
      and the release allow *Structure* → *Field*; the ids above for every built-in and release
      field; `many` on a reference field, read, checked and refused in words like a single one;
      *Default* read against *Type*; `readCatalogue`, `readRole`, `listRoles` and
      `documentsCarrying` read the documents using *Structure*, their *Field* blocks in reading
      order and their values, answering the shapes they answer today with the new ids — the
      contract readers hold is unchanged but for the ids — and the description as the first block's
      text, the whole text where a run reads it.
- [ ] RO_0005_002 The migration: an executable `ext.migration` creating every built-in's document,
      its release field blocks and their values where an instance does not hold them, and moving
      each `blockRole` a person made into a document — its name the title, its description a
      paragraph, each field a *Field* block carrying its key and declaration, *Blocks may use* and
      *Allows* from its `blocks` and its `offers`, `formerId` its old id, `retired` kept. Every
      `hasBlockRole` is closed and related again to the structure's document, every `roleFields`
      takes the new id in `role` and `fieldsFor`, a field's `carrying` and *Keyword*'s
      `sendWithPrompt` entries are rewritten to the new ids, and each old node is retired. Once
      moved it answers nothing. A fresh install's built-ins are created as documents from the start.
- [ ] RO_0005_003 The acts: *Structures*' `+` creates a document using *Structure*, *Untitled
      structure*, and opens it; *Structure* is refused on any other document and its clearing
      refused, by the route and by `propose_structures`, in words; giving a block *Field* adds a
      field, clearing it or removing the block takes the field away with its stored values kept
      unread; *Blocks may use* and *Allows* are values posted from the header's popover, *Allows*
      limited to structures as a reference limited to a structure is; retire and restore are acts,
      refused on a built-in as today. The command route's acts that the document now carries
      (`rename`, `describe`, `allow`, `addField`, `reviseField`, `removeField`, `moveField`,
      `blocks`) go.
- [ ] RO_0005_004 What a person sees: *Structures*' rows open the structure's document as any
      document opens, and a tab still open on the former page kind opens it too; `role-page.tsx`
      goes. On a structure's document the title place draws, beside the header's lines, the
      *Retire* or *Restore* act and *used by* — the documents using it, as a built-in's row
      unfolds today; *Keyword*'s document draws its *Send with prompt* switches there.
      *Structure*'s pill has no ×, *Structure* is never in a `+`'s typeahead or suggestions,
      *Field* is suggested first on a block of a structure's document, and a release field's
      values are drawn fixed. The list reference draws as pills with a typeahead by title.
- [ ] RO_0005_005 A run: `read_document_structures` answers a structure's description as its whole
      text; a run proposes a structure by starting a document through `documents`' tools with
      `propose_structures` giving it *Structure* — the one place *Structure* is taken outside the
      `+` of *Structures*, staged and standing only when the person accepts it — and its fields as
      *Field* blocks with their values; the skill says so, and that a structure's fields are its
      *Field* blocks.
- [ ] RO_0005_006 Verified: unit and view tests for the model, the list reference, *Default* by
      type, the acts and their refusals, the fixed built-ins and the page's controls; behaviour over
      CCGW under the kernel harness for the catalogue read from documents, the migration — a graph
      holding a person's structures with fields, values, allows, a retired one and the built-ins —
      moving every one, keeping every assignment and value by key, and answering nothing after; a
      run's proposed structure standing only after acceptance. The migration run on a throwaway
      stack holding a copy of a real instance's structures, never the live instance.
- [ ] RO_0005_007 This document says what is true after the move: the fixed lines under *What
      This Extension Holds* that name the *Roles* category as where structures are defined, the
      *no proposal* of `BO_0299_Q2` and the page's description reworded to this section's decisions
      without changing anything else they fix; the sections describing `role-page.tsx`, the
      command route's acts and the built-ins' nodes rewritten to the documents, and the walk by the
      user on the dev instance recorded.
- [ ] RO_0005_008 This change document stands here at every status `RO_0005` takes, the release
      note under *Changed* in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` at closure,
      and the graph exported there.
