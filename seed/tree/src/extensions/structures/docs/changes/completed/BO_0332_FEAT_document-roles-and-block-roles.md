# Document Roles And Block Roles

Status: completed

Requested 2026-10-01: **only allow *Keyword*, *Profile*, *Format* and *Source* on document
level; make it specifiable on the role whether blocks are allowed.** User statement. Shaped in the
graph as `doc-block-roles`' `RO_0003`, which the user set to draft on 2026-10-01. It became this
`BO` change on 2026-10-01 by the user's decision, because *Format* on documents alone changes the
kernel's `make_manuscript`, which takes a block today. The graph copy is `doc-block-roles`'
`docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`, and `RO_0003` leaves the graph. This
document shapes the change. It does not authorize implementation.

Today every role can be taken on the document and on every block in its reading order
(`BO_0299_Q8`); what limits a role is only what offers it (`BO_0308_Q2`, `BO_0309_Q1`). This
change gives a role a say over where it may be taken: a role states whether blocks may take it,
and the four built-ins are taken by documents alone.

## Scope

- The graph half is `doc-block-roles`' (its `docs/system/system.md`, *Roles*): the `blockRole` type, the catalogue, the takeable set in `rolesOf`, the acts and the role page;
  `documents`' block-document-model.md, for the reading-order line; and `manuscripts`', whose
  output is kept on the document carrying *Format*.
- The kernel half is `make_manuscript` (`internal/kernel/agenttools/manuscript.go`,
  [UI Kernel](../system/ui-kernel.md), *Formats, Migrations And Spending*): it takes the document
  carrying *Format*, not a block and its subtree, and says so in its description.
- A role carries a setting saying whether a block may take it, edited on the role page beside
  its fields and offers. The takeable set leaves a role that blocks may not take off every
  block's typeahead and suggestions; the document's own chip still offers it. Taking it on a
  block is refused in words, by the route and by `propose_roles`.
- *Keyword*, *Profile*, *Format* and *Source* are document roles: blocks may not take them, and
  the setting is the release's on a built-in, as its name is. *Definition* and *Alias*, offered by
  *Keyword*, stay block roles, taken by the keyword document's blocks.
- Revises fixed lines: *Every block in the reading order can take a role* (`BO_0299_Q8`, in
  `doc-block-roles` and in `documents`' block-document-model.md) and the built-ins *extended … like
  any role* (`BO_0308_Q5`) only where the new setting is fixed on them.
- Revises *Format*'s unit in `manuscripts` and the kernel (`BO_0312`): *the block carrying Format*
  and *the block and its children* become the document carrying *Format* and its reading order,
  and the rendition is kept on that document (Q2). *Keyword*, *Profile* and *Source* are already
  taken by documents (`keywords`, `profiles`, `bibliography`), so `BO_0311`/`BO_0298` read a
  profile as they do.
- No migration: an assignment already on a block stays and says so (Q3).

## Decisions

* A role a person creates allows blocks, as every role does today; the person switches it to
  document only on the role page. User decision, 2026-10-01 (`RO_0003_Q1`).
* *Format* is taken by documents alone, and its unit is the whole document: the output is made
  from the document carrying *Format*, its reading order, and kept on that document. A part that
  should be formatted on its own becomes focused work, and its document takes *Format*. User
  decision, 2026-10-01 (`RO_0003_Q2`).
* A block that already carries a role blocks may not take — one of the four, or a role switched
  to document only while blocks carry it — keeps it, and the pill says it is not allowed on a
  block, as a role no longer offered says so (`BO_0299_Q3`); the person clears it or leaves it.
  Nothing is migrated, removed or moved. User decision, 2026-10-01 (`RO_0003_Q3`).
* The setting is one switch, *blocks allowed* or not; the document may always take a role. There
  is no role allowed on blocks but not on the document. User decision, 2026-10-01
  (`RO_0003_Q4`).
* An offer never overrides the setting: a document-only role offered by a role above (*Hook*
  under *Story*) is never taken by a block; a document under the offering block — its focused
  work — takes it in its own chip. The role page says so beside such an offer. User decision,
  2026-10-01 (`RO_0003_Q5`).
* The change is carried as `BO_0332`, since its *Format* half reaches the kernel. User decision,
  2026-10-01.
* Image generation reads no *Format*: `media.generate` refused a prompt block without *Format* =
  image, which no block can carry now; the image profile alone says an image is made. User
  decision, 2026-10-01, found in implementation (`BO_0332_034` in `media`).

## Transfer

Transferred on 2026-10-01, after the user set the change to draft, as `BO_0332_001`–`BO_0332_033`:
- `_001`–`_003` in `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, *Document Roles And Block
  Roles*: `make_manuscript`'s input, the release line and verification with the stack-up.
- `_010`–`_016` in `doc-block-roles`' `docs/system/system.md`, *Document Roles And Block Roles*:
  the setting, taking, the role page, the pills and suggestions, verification, the walk and the
  close. Its fixed lines on `BO_0299_Q8` and on the built-ins are revised there, and `Q3`–`Q5` stand
  beside them.
- `_020` in `documents`' `block-editor.md`, *A Manuscript Out Of The Record*. `documents`'
  block-document-model.md revises its fixed `BO_0299_Q8` line and its fixed line on where a
  rendition is kept.
- `_030`–`_033` in `manuscripts`' `docs/system/system.md`, *Formats Per Document*: the projection
  from the document, the surfaces, the skill and verification. Its fixed line on *the block and its
  children* is revised there, and `Q2` stands beside it.
- `_034` in `media`'s `docs/system/system.md`, *Generation Needs No Format*, added in
  implementation.

The graph copy is `doc-block-roles`' `docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`,
and `RO_0003` leaves the graph in the same proposal.

Order: `_010`, `_011`; `_001` with `_030`, then `_031`, `_032`; `_012`, `_013`; `_014`, `_033`,
`_003`; `_020`; `_002` before completion; `_015` after promotion, then `_016`.

## Walked And Completed

Implemented on 2026-10-01 and staged as `node:chg-d4bdf8f922780e4f` (29 files and the members
`blockRole`, `doc-block-roles.roles` and `manuscripts.making`), accepted the same day; the kernel's
half (`make_manuscript`, the harness vocabulary) and the release lines are this repository's.
Walked by the user on the served build, 2026-10-01: a role switched to documents alone left a
block's `+` and stayed under the title, a block that carried it said *not allowed on a block*,
*Format* was offered on a document and on none of its blocks, a manuscript was made of a document
carrying *Format* (PDF) and listed at its end, and an image profile generated with no *Format*.
The user's word: "worked".

