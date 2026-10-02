# Roles Become Structures, Profiles Become Instructions

Status: completed

Rename Calliopa's role concept to structure and its profile concept to instruction.
This change covers the terminology people read and the terminology supplied to agents.
It collects the requested work before specification and implementation.

## Requested Names

* Role becomes structure; Roles becomes Structures. Requested by the user, 2026-10-02.
* Profile becomes instruction; Profiles becomes Instructions. Requested by the user, 2026-10-02.
* The verbs change with the nouns: a block *uses* a structure, and a structure *allows*
  structures — a *Story* allows *Hook* and *Closing*. They replace *takes* and *offers*; *parent*
  and *child* stay excluded. User decision, 2026-10-02, reversing the verbs of `BO_0308_Q1`.
- The rename includes the built-in Profile name, the command's selector and empty choice,
  document and block controls, the category, tool guidance, refusals and run details.
- Formats and keywords keep their names and are described using the new structure terminology.
* The Format field `type` keeps its choice `structured` and its stored value: it names a kind
  of output, not the concept. User decision, 2026-10-02.

## Rename Scope

* This is a full rename, including stored identifiers and API names, with migrations.
  User decision, 2026-10-02.
* The extension ids move: `doc-block-roles` becomes `structures` and `profiles` becomes
  `instructions`. User decision, 2026-10-02.
* The kernel gains a general extension-id move: a release declares an extension's former id,
  and one migration moves everything the id keys — extension state, pins and the inactive set,
  other extensions' dependencies, members, materialized paths and block ids. It is not a
  special case for these two extensions. User decision, 2026-10-02.
* The graph's stored type and relation names (`blockRole`, `roleFields`, `hasBlockRole`,
  `offers`, `documentRole`, `hasDocumentRole`) and the built-in node ids (`builtin:profile` and
  the rest) stay as internal identifiers that no person, agent or API reads by name: CCGW never
  changes a node's type or id (`BO_0123`), and re-creating every structure would cut its
  history and risk a lost reference. User decision, 2026-10-02.
* Old names are cut in the same release, with no aliases: routes, tool names, grants, relation
  names and record values answer only by their new names, and stored data is migrated to them.
  User decision, 2026-10-02.
- Stored identifiers found so far: the built-in id `builtin:profile`, the `document` node's
  `record: profile`, the relations `hasBlockRole`, `hasDocumentRole` and `offers`, the
  `profile_tool` grants, `profileId` on runs, the remembered selection under
  `/__kernel/state/people/me/profile/`, the kernel routes `/__kernel/profiles/…`, and the
  `/api/x/doc-block-roles/…`, `/api/library/doc-block-roles/…` and `/api/x/profiles/…` routes.
  New relation and field names follow the new nouns and verbs; the exact identifiers are a
  technical choice made when the scope is transferred.
- Inventory the rest of the concept's graph types, fields and record values, tool names, run
  records, state keys, code symbols, migration member ids, skills and authoritative docs from a
  checkout before specifying the migration.
- Preserve existing documents, assignments, field values, remembered selections, run provenance,
  runtime connections and grants through the rename. Unrelated uses of role or profile, such
  as typographic roles, authentication roles or compose profiles, are outside this rename.
* The extensions keep their change-document prefixes `RO` and `PF`; existing change documents
  keep their names. User decision, 2026-10-02.

## Affected Owners

- `doc-block-roles` owns the structure definitions, assignments, fields and built-in names.
- `profiles` owns instruction documents, their selection and tool controls.
- `documents`, `ui.shell`, `settings`, `keywords`, `media` and `manuscripts` consume these
  concepts in their surfaces, skills or documentation. Their affected members must be found
  from a checkout when the scope is transferred.
- The fixed-layer kernel supplies the selected document to a run, names its tools and grants,
  and records what guided the run (`docs/system/ui-kernel.md`, Profiles and The Profile In
  The Command, With Tools). Its messages and agent guidance are part of the rename, and it
  carries the general extension-id move.
- Existing concept behavior remains the baseline; this request changes its terminology.

## Fixed Requirements To Reconcile

- `doc-block-roles`' graph docs fix the built-in names, including Profile, and state that
  they cannot be renamed by a person. The release renames *Profile* to *Instruction* by
  migration; a person still cannot rename a built-in, and no instance rename control is added.
- The same docs keep `doc-block-roles` as the extension id because the kernel has no
  extension-id migration (`BO_0309_Q3`: rename *if migratable*). The general extension-id move
  makes it migratable; the line becomes the new id once the move exists.
- `doc-block-roles`' fixed line *A role offers roles and a block takes a role* (`BO_0308_Q1`)
  is rewritten with the new verbs above; its exclusion of *parent* and *child* stands.

## Where The Tasks Stand

- Transferred 2026-10-02. Fixed layer: `extension-model.md` (`BO_0338_001`–`_002`, the general
  extension-id move), `ui-kernel.md` *Structures And Instructions* (`_003`–`_009`),
  `distribution.md` (`_010`–`_012`), `code-service.md` (`_013`) and `mobile.md` (`_014`).
- Graph: `doc-block-roles` (`_020`–`_028`), `profiles` (`_030`–`_036`), `documents` (`_040`–`_042`),
  `ui.shell` (`_050`–`_052`), `settings` (`_060`), `keywords` (`_070`), `media` (`_080`),
  `manuscripts` (`_090`) and `bibliography` (`_095`). This change document is a member of
  `doc-block-roles`, its owning extension.
- Landed 2026-10-02: `_001`–`_002` (the general move), and in step 1, the cut, the kernel's
  `_003`–`_006` with `_008`'s tests, and the graph's `_020`, `_022`, `_030`–`_034`, `_040`, `_050`,
  `_051`, `_080` and `_090`, staged as one graph proposal committed with a kernel CLI carrying
  `_001`. `_007` is withdrawn by the stored-names decision; `media`'s `_081` and `manuscripts`'
  `_091` hold their wording left over. A moved extension keeps its place among the extensions
  (user decision, 2026-10-02).
- Step 1 served 2026-10-02 at pin 4021 and walked by the user. Step 3, the wording, built
  2026-10-02 from head 4029: the agent-facing members (skills, tools — `propose_structures`,
  `read_document_structures`, input `use`, answer `usable` — and the declarations' words), the
  structures UI and code, the consumers' refusals and `release-extensions.json` (`_010`). The
  stored `role` property of a field node, the tab kind `documentRole` and the settings keys
  `keywordRole` and the like keep their names. Left: the docs (`_009`, `_027`, `_036`, `_042`,
  `_053`, `_060`, `_071`, `_082`, `_092`, `_096`), `_092`'s code names, the throwaway-stack
  verification (`_012`, `_026`, `_035`), the device (`_014`), the release note (`_011`) and the
  closure (`_028`).
- Step 3 served 2026-10-02 at pin 4052 and looked at by the user. The docs step, built from head
  4060: the kernel's docs (`_009`) and the graph docs (`_027`, `_036`, `_042`, `_053`, `_060`,
  `_071`, `_082`, `_092` with `manuscripts`' `server/structures-read.ts`, `_096`). Left: the
  throwaway-stack update verification (`_012` with `_026` and `_035`), the device (`_014`), the
  release note (`_011`) and the closure (`_028`, the graph export).
- The docs step accepted 2026-10-02. Verified on a throwaway stack the same day (`_012`, with
  `_026` and `_035`): `0.4.3` with content updated to a `0.5.0` built from this tree, 19 checks
  passing. The release note stands (`_011`). The device takes a moving release (`_014`), its test
  and walk left as `_015`. `_013` (`code-service.md`) taken over at the user's word and closed;
  `_028` and the graph export closed the change on 2026-10-02. Follow-up: `_015`.
- Order: the id move (`_001`) first; then each extension's vocabulary and record migrations
  (`_021`, `_022`, `_031`) before the readers that use the new names; the kernel's intake and the
  shell's runs route (`_003`, `_050`) together, since old names are cut with no aliases.

## Closure To Specify

* `BO_0336` adopts the new names now: its new surfaces — the Format field on an instruction
  and the generation guidance — say structure and instruction rather than role and profile.
  User decision, 2026-10-02.
* `BO_0336` and this change ship in the same release, so no release shows both terminologies;
  `BO_0336` may land in the graph first. User decision, 2026-10-02.
- Verify the affected controls and agent guidance and preserve existing content, assignments,
  selections and grants through the full identifier and API migration, on a throwaway stack.
- Carry this change document into the owning extension's graph proposal at each established
  status, update its authoritative docs alongside code, and export the accepted graph at closure.
- Add the user-visible rename under Changed in `docs/release-notes/unreleased.md` at closure.
