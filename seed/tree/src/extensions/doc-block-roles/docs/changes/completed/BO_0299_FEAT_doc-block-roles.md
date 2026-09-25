# Document And Block Roles

Status: completed

Requested: 2026-09-25. A new `doc-block-roles` extension lets a person give a document a role —
*Story* — and, under that role, give individual blocks the roles the document role offers —
*Hook*, *Problem*, *Transformation*, *Closing*. Which roles exist, and which block roles a document
role offers, is configured in the app, the way profiles are (`BO_0298`). The extension offers an
interface through which other extensions, first `profiles`, read a document's role and its blocks'
roles, so a profile can say how an agent writes a *Hook* and how it relates the *Closing* to it.
This document shapes the change; it authorizes no implementation.

## What Is Asked

* A person assigns a role to a document. The document role is chosen from the roles the instance
  holds.
* A document role offers a set of block roles. Once a document carries a role, the person can give
  individual blocks one of the block roles that role offers: a *Story* offers *Hook*, *Problem*,
  *Transformation* and *Closing*.
* Document roles and their block roles are configured within the app, as profiles are: created,
  named and revised by a person on the instance, never in an extension's source.
* The extension offers an interface through which other extensions read a document's role and the
  roles of its blocks. `profiles` is the first reader: a profile can say how the agent is to write
  a block of a given role and how it relates one role's block to another's.
* The extension is bundled with Calliopa and arrives switched on, as `profiles` is. User
  decision, 2026-09-25 (`BO_0299_Q1`).
* Anyone who can edit documents may create and revise document roles and their block roles,
  written as truth at once with no proposal, as for profiles (`BO_0298_Q4`). User decision,
  2026-09-25 (`BO_0299_Q2`).
* When a document's role changes, block roles assigned under the previous role stay stored and
  are drawn as not offered by the current role; the person clears or reassigns them. Switching
  back loses nothing. User decision, 2026-09-25 (`BO_0299_Q3`).
* A role is retired, never deleted: removing a block role from a document role, or a document
  role documents carry, stops the choices offering it, while existing assignments stay and are
  drawn as retired. User decision, 2026-09-25 (`BO_0299_Q4`).
* A profile that carries a document role is offered on every document, the profiles matching the
  document's role grouped first in the dropdown; the match is a hint, nothing is hidden. This is
  `BO_0298`'s to enumerate. User decision, 2026-09-25 (`BO_0299_Q5`).
* A run reads roles and never writes them: the tool answers reads alone, and assigning is the
  person's act. A proposal path is a later change once the reading side is in use. User decision,
  2026-09-25 (`BO_0299_Q6`).
* A block's role is visible while reading, as a small label at the block, and in the bar while the
  block is active. User decision, 2026-09-25 (`BO_0299_Q7`).
* Every block in the reading order can take a block role — text, picture, table, code, equation
  and the rest — so a picture can be the hook. User decision, 2026-09-25 (`BO_0299_Q8`).

## Proposed Shape

- The extension is `doc-block-roles`, satisfying the kernel's id rule (`^[a-z][a-z0-9]*([.-][a-z0-9]+)*$`,
  `ui-kernel.md` `BO_0224_001`). Its change documents carry the prefix `RO`, which no extension
  in the graph uses (`BI`, `CA`, `CO`, `CS`, `DO`, `MA`, `ME`, `PU`, `RF`, `RL` are taken). It
  depends on `documents`, whose document and `text` blocks the roles attach to, and on `ui.shell`,
  whose frame it contributes into.
- The word *role* is already taken on a text block: `text.role` is the typographic role —
  `paragraph`, `h1`, `h2`, `h3`, `quote`, `abstract` — declared by `documents` and read by the
  kernel's document tools as `role`. The new concept must not share that name in the vocabulary,
  the routes or the tool answers. Proposed: the surfaces say *document role* and *block role*, and
  the vocabulary names them `documentRole` and `blockRole`; the typographic role keeps `role`.
- The roles are the extension's own nodes, and an assignment is a relation, so `documents`'
  declarations do not change:
  - `documentRole`, a root node with `id`, `name` and an optional `description`, and `blockRole`,
    a node with `id`, `name`, an optional `description` and an `order`, joined to the document
    role that offers it by an `offers` edge. Both are `ext.blocktype` members of this extension,
    non-block types as a bibliography's `work` and a `manuscript` are.
  - `hasDocumentRole`, an `ext.relationtype` from a `document` to a `documentRole`, at most one
    active per document; `hasBlockRole`, from any block in the reading order to a `blockRole`, at
    most one active per block. Found at transfer, 2026-09-25: an `ext.relationtype` declaration
    carries `id`, `name` and `semantics` and fences neither end, and every block kind — `text`,
    `divider`, `image`, `video`, `table`, `equation`, `sourcecode`, `output` — is `documents`'
    own declaration, so `BO_0299_Q8` costs one dependency, on `documents`, and no shift to a
    property. Which kinds may carry a role is the extension's rule, checked before the write, the
    way `documents` checks single containment.
  - A relation to a role node rather than a property carrying its name means renaming a role
    renames it everywhere at once, and a role's identity survives the rename. The alternative —
    `documentRole` and `blockRole` as optional properties `documents` adds to its `document` and
    `text` declarations, filled by declaration by instance (`extension-model.md`, Declaration By
    Instance) — is measured at draft against the kernel's reads before it is chosen against.
- Assigning a role is the person's direct act, established at once and shared, as attaching a
  profile is (`BO_0298_Q7`, `BO_0298_Q8`) and as the investigation's `record` and the root's
  `phase` are: choosing a role writes the relation as the person's own truth, no proposal is raised
  and nothing is accepted. Creating or revising a role is the same kind of write.
- The surfaces, through the contract as it stands, no new slot:
  - A library category *Roles* under the extension's own icon, listing the document roles with a
    create control; a document role opens as the kind `doc-block-roles:documentRole`, a page where
    the person names and describes it and manages the block roles it offers — add, rename,
    describe, reorder, remove.
  - In a document tab, a *Roles* group in the bar, contributed by the extension's decoration
    provider the way `manuscripts` contributes its *Manuscript* group: at rest a *Document role*
    choice listing the instance's document roles and *No role*; while a block is active, a
    *Block role* choice listing the block roles the document's role offers and *No role*. With no
    document role chosen, the block choice is not offered, since there is nothing to choose from.
  - While reading, a block that carries a block role says so quietly — a `headline` place drawing
    the role's name as a small label, the idiom `standing` and the relations' neutral mark use —
    so the structure of a *Story* is visible without activating each block.
- The interface for other extensions is the extension's server module and a route, and a tool for
  the agent:
  - `server/roles.ts` exports `rolesOf(document, scope)`: the document's role and, per block in
    reading order, the block's role, each role as `{id, name, description}`, read at a data
    revision and in a branch when the caller works in one. An extension that declares
    `doc-block-roles` as a dependency imports it directly, one process and no HTTP hop, as
    `calliopa-show` imports `publishing` (`contribution-contract.md`, `CS_0001_005`).
  - `GET /api/x/doc-block-roles/documents/[id]` answers the same shape to the browser, and
    `GET /api/x/doc-block-roles/roles` the document roles with their block roles, for a surface
    such as the profile dropdown that wants them client-side.
  - `read_document_roles`, an `ext.tool` member `{document}` answered through the kernel callback
    (`ui-kernel.md` `BO_0264_007`), answering the same shape at the run's pin, as
    `calliopa-refine`'s `read_source` does; and a `doc-block-roles.roles` skill saying that a
    document carrying a document role is written by its roles — read them first, keep each block's
    role in mind when proposing into it, and never propose a block role, which is the person's.
    The kernel's `read_document` keeps answering what it answers; teaching it this vocabulary is a
    fixed-layer change and is the alternative measured at draft, not the proposal.
- How a profile speaks to roles, proposed for `BO_0298` to take up at its draft rather than
  enumerated here: a profile is a document, so it can carry a document role and its blocks block
  roles through this extension — a profile carrying *Story* whose block roled *Hook* holds the
  instructions for hook blocks. The run receives the profile's content with the roles read the same
  way, so *write the hook like this* is the profile's *Hook* block and nothing else is invented.
  The dropdown lists every profile with the matching ones first (`BO_0299_Q5`).
- No starter roles are bundled, as no starter profiles are (`BO_0298_Q3`); *Story* with its four
  block roles is the example a person creates, with an agent's help if they like.

## Functional Questions

- None open. `BO_0299_Q1`–`BO_0299_Q8` are answered in What Is Asked.

## Acceptance Examples To Shape At Draft

- Given a fresh installation with the extension active, the library shows a *Roles* category
  holding no roles, and a document's bar offers *Document role* with *No role* alone.
- Given the *Roles* category, when the person creates *Story* and gives it the block roles *Hook*,
  *Problem*, *Transformation* and *Closing*, the role page lists them in that order and the
  document role is offered in every document's bar.
- Given an open document, when the person chooses *Story* as its document role, the choice is
  established at once, another person opening the document sees it, and the bar offers *Block
  role* while a block is active, listing the four block roles.
- Given a document carrying *Story* and its first paragraph active, when the person chooses
  *Hook*, the block carries the role, says so while reading, and keeps it through edits, splits and
  moves, because the assignment names the block's identity. A picture active takes a role the
  same way.
- Given a document carrying *Story* with a *Hook* block, when the person changes the document's
  role to *Essay*, the block still says *Hook* and says that *Essay* does not offer it; choosing
  *Story* again offers it as before.
- Given *Story* with *Closing* removed while a document carries it, the block still says *Closing*
  as retired, and the bar no longer offers it.
- Given a document carrying no document role, no block role is offered.
- Given *Story* renamed to *Short story*, every document carrying it shows the new name without
  being touched.
- Given a document carrying *Story* with roled blocks, when a dependent extension asks
  `rolesOf` for it, it receives the document role and each block's role by id, name and
  description, in reading order, at the revision it asked for.
- Given a run in a document carrying *Story*, when the run calls `read_document_roles`, it
  receives the same answer at its pin, and its skill tells it to write each block by its role and
  to propose no role.
- Given a profile carrying *Story* whose *Hook* block says how a hook is written, when the person
  sends a prompt in a *Story* document with that profile attached, the run's profile instructions
  carry the *Hook* block with its role, and the run writes the document's hook by it.
- Given the extension switched off, a document carrying a role stays a document: nothing is
  offered, nothing is drawn, and the assignments stand in the graph for when it is switched on
  again.

## Boundaries And Source Documents

- Read from the checkout `.local/tree-bo296i` at dataRevision **2538** on 2026-09-25, one
  revision past what `BO_0298` read. The graph paths below name the authoritative extension docs;
  this idea does not establish their behavior.
- `ui.shell`: `docs/system/workspace/contribution-contract.md` — sections and their icon, kinds
  and views, routes, `decorations` with the block places `headline`, `depth`, `below`, `command`
  and `run`, the nested providers, and the rule that a dependent extension imports another's
  server modules directly; `docs/system/workspace/layout.md` for the bar's groups.
- `documents`: `src/extensions/documents/docs/system/documents/block-document-model.md` — the
  `document` declaration with `intention` and `record`, `text` with its typographic `role`, the
  `focuses` relation as the precedent for an extension's relation anchored on a block, and the
  root's `phase` as the precedent for a person's direct write; `block-editor.md` for the
  block-level slot and `EditorSurfaceContext`.
- `relations` (`src/extensions/relations/docs/system/system.md`) and `manuscripts`
  (`src/extensions/manuscripts/docs/system/system.md`) as the two newest extensions created by a
  `BO` change: their manifests, prefixes, dependency declarations, the bar group and the library
  category. `calliopa-refine`'s `read_source` (`RF_0003_004`) for an `ext.tool` answered through
  the callback.
- Fixed layer: `docs/system/extension-model.md` for members, declaration by instance and what
  ships; `docs/system/ui-kernel.md` for extension tools (`BO_0264_007`), the extension create
  (`BO_0224_001`) and what `read_document` answers; `docs/system/distribution.md`, The Release
  Names Its Extensions, for `release-extensions.json`.
- `BO_0298` (`docs/changes/BO_0298_FEAT_profiles.md`, draft) is the first reader. Nothing here is
  enumerated for `profiles`; what a profile does with a role is that change's, and `BO_0299_Q5` is
  recorded here only because it keys on the role — it belongs in that change's What Is Asked too.
- This is a `BO` change spanning a new extension in the graph and, if bundled, this repository's
  release list. At draft, determine whether anything else in the fixed layer moves — the answer
  proposed above is nothing — and enumerate the extension's tasks in its own `docs/system/system.md`,
  with pointers from the fixed-layer tasks. The new extension names `RO` as its prefix there, and
  this document travels into its `docs/changes/` at the same status through a checkout proposal.
- Implementation closure includes the accepted graph change, the graph export, and a release note
  for anything the release ships. This idea changes no shipped behavior, so none is due at
  capture time.
