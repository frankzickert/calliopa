# BO_0253_REFACTOR_documents-and-decision-extensions

Status: completed

Requested: 2026-09-16. *I want to separate the decision/document structure and especially ui from
the ui.shell extension. The decision part should move into its own extension (private).* User
statement.

`BO_0243` put the recursive decision and refinement system into `ui.shell`, and by `BO_0250` the
shell is two products in one subtree: the frame every extension mounts in, and the decision system
that happens to be the frame's only tenant. This change separates them. The block document model
and its editor become `documents`, a `bundled` extension of their own; claims, relations,
judgements, phases, acceptance, pressure, depth and derived work grow `calliopa-refine` into the
decision extension, `individual` and private to this instance. `ui.shell` keeps the frame.

This is the umbrella. It records what the split adopts as fixed, where the boundary runs, the
three parts that deliver it and their order; nothing is implemented under this document.

This is a refactor, not a feature: nothing a person can do changes, except where the split forces
a decision — change documents, the shell's own fixed definition, and what the distribution ships.
Those three are decided below.

## Where This Starts

Measured against `graph/` at head 1057 (release pin 1039), the shell's graph docs, and this
repository's `docs/system/`.

- **The contribution contract already carries this.** An extension contributes library sections,
  tab kinds with their views, route-loader readers, an API handler table, parties and a party
  roster, resolved at build time; `ui.shell` and `settings` contribute through it like everyone
  else ([Contribution Contract], `BO_0202`). `calliopa-video` (`BO_0203`) is the precedent for
  exactly this move: episodes, standing assets, destinations and two channels left the shell for
  an `individual` extension and contribute back through the contract.
- **`ui.shell` contributes only two sections and three kinds.** `contributions.ts` declares the
  Documents section (`document` → the block editor) and the Extensions section (a component,
  opening `ui.shell:extension`, `ui.shell:extension-import` and change rows as
  `ui.shell:document`). Everything else in `src/` is the frame and not a contribution.
- **The frame barely touches the document model.** Across `src/components/shell`, `src/routes`
  and `src/server/*.ts`, exactly two files reach into it: `reference-chips.tsx` imports
  `~/lib/pointing`, and `src/routes/api/agent/refinement/index.ts` imports `~/lib/refinement`.
  The composer, the dock, the inspector, the tabs, the view bridge and the process registry are
  clean.
- **The document surface is most of the shell's code.** `src/components/views/` is ~13,700 lines
  — `block-editor.tsx` alone is 3,790 — beside ~6,600 for the whole frame in
  `src/components/shell/`. `src/server/documents/` is ~5,900 lines. Roughly thirty modules under
  `src/lib/` are document or decision work.
- **`ui.shell` declares the whole vocabulary.** Six `ext.blocktype` members — `document`, `text`,
  `divider`, `claim`, `relation`, `policy` — and seven `ext.relationtype` — `retired`, `asserts`,
  `source`, `target`, `derivedFrom`, `focuses`, `acceptedBy` — plus the `ui.shell.documents`
  skill. `calliopa-refine` (`bundled`) declares `judgement`, `judges`, the `refine` intention and
  five skills.
- **The block types mix the two models.** `text` carries `role` and `intention` beside `kind` and
  `disposition`; `document` carries `intention` and `record` beside `phase`, `supersededBy`,
  `change` and `changeStatus`. One `ext.blocktype` is declared by one extension, so the mixture
  is the split's central problem — answered by Declaration By Instance below.
- **Undeclared properties are tolerated.** `validation.md` `BO_0142_003` states it and
  `internal/ccgw/run_shape_test.go:150` pins it: *an undeclared property should stay tolerated*.
  A property the public declaration does not name is still writable.
- **Declaration By Instance is the mechanism for a private vocabulary.** A slot-owning extension
  defines an ordinary graph type whose instances are declarations, and a declaring extension
  creates instances and attaches them to its own manifest by `partOf` ([Extension Model],
  `BO_0199`). Its stated rule is this change's: *a declaration made by an `individual` extension
  lives in that instance's graph and nowhere else*, and *a bundled extension cannot declare this
  way*. The declaration is knowledge, never a fence.
- **The core knows the model.** `internal/kernel/agenttools/documents.go`, `work.go` and the
  phase item compile `propose_document_changes` into the shell's own statements and enumerate
  block kinds, relation kinds, origins, states and phases; `internal/kernel/refinement/` and the
  post-change system run (`BO_0245`) are keyed on `calliopa-refine`. The fixtures are named
  `serve/testdata/ui-shell-vocabulary.json` and `calliopa-refine-vocabulary.json`.
- **Change documents are block documents.** A `document` node carrying `change` and
  `changeStatus`, listed under its extension, created by the section's `+` and by an agent's
  `create_document`, edited in the block editor, its status set in the inspector (`BO_0222`).
  This repository's `AGENTS.md` and `docs/process/change-process.md` fix that protocol. The graph
  holds 91 `document` nodes, of which roughly half are change documents across five extensions.
- **An extension's own docs are already files, rendered without the editor.** `ext.source`
  members under `docs/`, read through `readExtensionDocument` and drawn by `src/lib/owner-docs/`
  in the `extension` view. That function builds the extension's network from its `docs/` members
  and then bolts change documents on through a *separate* `listChangeDocuments()` read over
  document nodes — two paths where one would do.
- **The required set is code-registered.** `ui.shell`, `settings`, `calliopa-base` and
  `calliopa-extension` are what the kernel refuses to run without ([Extension Model],
  `BO_0218_012`); `category: bundled` is the release export's rule and a separate one.
- **What ships is what is Apache-2.0.** Everything in the graph the export keeps — every
  `category: bundled` extension — is Apache-2.0; the Core is proprietary
  ([Distribution](../system/distribution.md), user decision 2026-09-07). An `individual`
  extension is dropped by the export guard, never reaches `distribution/seed/`, and never
  reaches the public `calliopa` repository.

## Intent

* **The frame must be total without either extension.** A tree holding neither still builds,
  serves, signs a person in, opens tabs and runs the dock. View resolution is already total — a
  kind nothing contributes opens in the `context` placeholder and says so — and this change must
  not introduce a path that needs the document surface to exist.
* **One extension, one body of software, one licence.** `documents` is Apache-2.0 and ships;
  `calliopa-refine` is this instance's and ships nowhere. Nothing decision-shaped may sit in the
  public body because it was cheaper to leave it there.
* **The move preserves behaviour.** Every acceptance expectation `BO_0243`'s parts established
  stays true, in the same words, in the extension that now owns it. A refactor that quietly
  changes what a person sees is not this change.
* **Neither extension gets a privileged path into the shell.** Both contribute through
  `src/contract.ts` like `settings` and `publishing` do, and the contract grows only where the
  split proves it too narrow.

## The Split

### `ui.shell` keeps

- The frame: workspace, tabs, the command dock and its composer, the drawers, the header, the
  process registry, the CCGW and kernel clients, the session, the view bridge, themes, drag.
- Its own endpoints: `/api/workspaces/**`, `/api/processes/**`, `/api/runs/**`,
  `/api/library/<ext>/<section>`, `/health`.
- The Extensions section, the `extension` and `extension-import` views, `readExtensionDocument`
  and `src/lib/owner-docs/` — extension administration, which after the change-document decision
  needs no document surface at all. `src/lib/changes.ts` becomes the `Status:` line's parse in
  `owner-docs`, and `listChangeDocuments()` disappears with the second read path.
- `src/lib/command-target.ts` and `command-typeahead.ts`: what a command is aimed at is the
  frame's, not the document model's.

### `documents` — `bundled`, Apache-2.0, prefix `DO`

- Vocabulary: `document` (`intention`, `record`), `text` (`role`, `intention`, `disposition`),
  `divider`, the `retired` relation type, and `BlockKind` — the slot type whose instances name
  the kinds a block may carry, enumerated by nobody here.
- The Documents section, the `document` kind, and the block editor view with everything under it
  that is reading and editing rather than deciding: `block-editor.tsx`, `block-text`,
  `block-pinch`, `block-swipe`, `editor-dom`, `reading-order`, `press`, `reveal`, `row-name`,
  `documents-client`, `marking/`, `passages/`, `proposals/`.
- `src/server/documents/` minus the decision half: `documents.ts`, `content.ts`, `assemble.ts`,
  `vocabulary.ts`, and the document, block, structure, proposal and command routes of `api.ts`,
  served under `/api/x/documents/…`.
- `src/lib/`: `order`, `passage`, `pointing`, `proposals`, `references`, `disposition`.
- The `ui.shell.documents` skill, renamed to the extension that now owns it.

### `calliopa-refine` — `individual`, private, prefix `RE`

- Vocabulary it already holds: `judgement`, `judges`, the `refine` intention and its five skills.
- Vocabulary it takes from `ui.shell`: `claim`, `relation`, `policy`, and the `asserts`,
  `source`, `target`, `derivedFrom`, `focuses` and `acceptedBy` relation types.
- Vocabulary it declares by instance: the sixteen `BlockKind` values — assertion, question,
  observation, assumption, alternative, argument, evidence, concern, consequence, requirement,
  proposal, decision, synthesis, tension, frontier, next. They live in this graph and travel with
  no release.
- Properties it writes undeclared: `text.kind` and `document.phase`/`supersededBy`, tolerated by
  Validation as open content.
- The decision surfaces: `depth/` (block depth, derived work, focused work, pressure), `phase/`
  (the transition card), `standing/`, `proposals/relation-card`, and the parts of the block
  editor that draw a kind, a claim, a relation, a judgement or a phase.
- `src/server/documents/` decision half: `work.ts`, `work-ops.ts`, `judgements.ts`, `phase.ts`,
  `focus.ts`, `read-mark.ts`, and the relations, judgements, consequences, focused, provenance,
  history and read-mark routes, served under `/api/x/calliopa-refine/…`.
- `src/lib/`: `depth`, `judgements`, `phase`, `refinement`.
- `/api/agent/refinement` leaves the frame's routes for the extension's table.

### What stays in the core

- The kernel's document, work and phase tools keep reading their enumerations from the
  established declarations through `GET /v1/schema`, so they follow the vocabulary wherever it is
  declared; what changes is the fixture names, the skill the run instructions name, and the
  post-change system run tolerating an instance where `calliopa-refine` is absent.
- Nothing decision-shaped moves *into* the core to escape the split. The Core is proprietary,
  which makes it a comfortable hiding place and not a correct one.

## Decided

User decisions, 2026-09-16.

* **Two extensions, not one.** The document structure is public and ships; the decision part is
  private. A single private extension holding both was rejected: the block document model is what
  makes the frame worth having to anyone else, and the decision system is the part that is the
  author's own.
* **The decision extension is `category: individual`.** It lives in this graph, the release
  export's `bundled`-only guard drops it, nothing of it reaches `distribution/seed/` or the
  public `calliopa` repository, and it is outside the Apache-2.0 body the distribution ships.
* **The names are `documents` and `calliopa-refine`.** The public half takes a bare id like
  `settings` and `publishing`; the private half grows the extension that already holds
  `judgement`, `judges`, the `refine` intention and the five skills, so going private is one
  manifest property rather than a ninth extension. Their change prefixes are `DO` and `RE`.
* **The decision vocabulary is declared by instance, not by the public declaration.** `documents`
  owns the `BlockKind` slot and enumerates nothing; `calliopa-refine` declares the sixteen kinds
  as instances of it. `text.kind` and `document.phase` are written as undeclared properties,
  which Validation tolerates. Leaving the decision values in the public declaration was rejected
  — the Apache-2.0 body would enumerate a product that is not in it — and moving them onto
  decision-owned nodes was rejected as a breaking migration that makes a derived block, which
  *is* a text block its kind identifies, into two nodes.
* **`disposition` stays with `documents`.** It arrived with passages and references (`BO_0227`)
  as a reading gesture a person makes while working, not as part of the decision model.
* **`documents` does not join the code-registered required set.** `bundled` carries it in every
  release; an instance may still switch it off, and `ui.shell` declares no dependency on it.
* **Change documents stop being block documents.** An extension's change documents become its own
  `ext.source` members under `docs/changes/`, rendered read-only by the Extensions section
  through `src/lib/owner-docs/` the way its topics already are, with the `Status:` line carrying
  what `changeStatus` carries today. This removes the second read path in
  `readExtensionDocument` and leaves extension administration needing neither extension. The
  graph's change-document protocol in `AGENTS.md` and `docs/process/change-process.md` follows,
  reversing `BO_0222`'s move from files to documents.
* **A status is set by accepting the proposal that changes it.** With the body read-only, an
  agent stages the `Status:` line like any other docs member and the user accepts it; the
  acceptance is the act the protocol reserves for the user, so its words become *only the user
  may establish* a `draft` or `ready` status rather than *only the user may set* it. A status
  control on the row and a CLI-only path were both rejected: acceptance is already the one
  non-delegable human action in the architecture, and a second path would weaken it.
* **What Calliopa is changes.** The shell's `docs/system/system.md` fixes Calliopa as *a
  recursive, versioned, networked decision and refinement system whose visible interface is
  document-like* (`BO_0243`, 2026-09-13). It becomes: Calliopa is a graph-backed, versioned,
  extensible browser workspace; the recursive decision and refinement system is an extension over
  it. This weakens a fixed line, on the user's decision.
* **The installer-facing texts follow that line.** `distribution/README.md`,
  `docs/material/public-docs/extending.md` and `bundled-extensions.md` describe what actually
  ships: a browser workspace over a versioned knowledge graph, everything a person works with an
  extension over it, nothing changing without a proposal someone accepted, and `documents`,
  `settings` and `publishing` in the box.

Agent decisions, 2026-09-16, no product consequence:

- Completed change documents stay under the extension they were made against. A `CA` document
  recording a change of `ui.shell` records what `ui.shell` was at the time; reassigning it to
  `documents` or `calliopa-refine` would falsify the record. New change documents go to the
  extension that owns the code.
- The route names inside each extension's own table are that extension's; `/api/x/documents/d/…`
  rather than `/api/x/documents/documents/…` where the repetition reads badly.

## The Set

In the order they are implemented. `BO_0250` settles first — it is `wip` and touches the surfaces
all three parts move. Each part is its own change document, written at `idea` on 2026-09-16, and
carries the decisions above rather than restating them; each transfers its own system work when
the user promotes it. Nothing is implemented under this umbrella.

1. `BO_0254` — change documents as `ext.source` members. The Extensions section reads them from
   the extension's `docs/changes/` members and renders them read-only; `listChangeDocuments()`,
   the `change` and `changeStatus` properties on the `document` declaration and the inspector's
   status control go; the 45-odd existing change documents are exported to members, the inverse
   of `kernel import-changes`; `AGENTS.md`, `docs/process/change-process.md` and
   `docs/changes/README.md` carry the new protocol and the acceptance rule.
   **First, and this is the reason for the order**: while a change row opens as
   `ui.shell:document`, moving documents out would force `ui.shell` to declare a dependency on
   `documents`. Doing this first means that dependency never exists.
2. `BO_0255` — `documents` out of `ui.shell`. The manifest and entrypoints, the vocabulary
   members moved by the sidecar, the Documents section and the `document` kind, the block editor
   and its reading surfaces, `src/server/documents/`'s document half under `/api/x/documents/`,
   the six `src/lib/` modules, the skill, the tests. Behaviour-preserving throughout; the
   decision surfaces move with it and leave in `BO_0256`.
3. `BO_0256` — the decision half out of `documents` into `calliopa-refine`. The extension flips
   to `individual` and gains an entrypoint; `claim`, `relation`, `policy` and the five relation
   types move to it; `BlockKind` instances replace the enumerated `kind`; the decision surfaces,
   server half and `src/lib/` modules follow; the kernel's fixtures and system-run trigger are
   renamed and made tolerant of the extension's absence; the shell's fixed *What Calliopa Is*
   line and the distribution texts are rewritten.

Then `CA_0048` (the work surface) and `BO_0251` (cold start), the two parts of `BO_0243` still at
`idea`. `CA_0048` deletes the placeholder view kinds and folds the inspector's facts into the
document's own depth — deciding which side of the boundary each of those lands on *is* this
split, so doing it first would mean making those calls twice. `BO_0251` becomes a clean question
about how the frame's composer reaches the decision extension, which is only askable once the
boundary exists.

## Open

- [ ] `calliopa-refine` flips from `bundled` to `individual` in `BO_0256`, and a release that
  stops carrying a bundled extension reaches an install as a removal: the pre-seed hook clears
  every bundled subtree from the baseline and whatever the release no longer carries becomes a
  deletion (`distribution.md`, `BO_0197_003`). The clearing is keyed on the manifest's `category`
  in the *receiving* graph, so what an existing install does when its own copy is still marked
  `bundled` has to be established before the release after `BO_0256` is cut.
- [ ] Whether the kernel's phase enumeration reads a declaration or stays hard-coded. `phase` is
  written undeclared, so `documentPhases` in `agenttools` keeps three decision-model values in
  the Core. Shaped in `BO_0256`: either a `RootPhase` slot on `documents` mirroring `BlockKind`,
  or the enumeration stays and the tension is recorded rather than hidden.
- [ ] Removing `change` and `changeStatus` from the `document` declaration while established
  content carries them is a compatibility class the check may refuse (`validation.md`
  `BO_0109_004`). `BO_0254` establishes whether it needs an `ext.migration`.

## What The Set Made

Completed 2026-09-16, served at pin 1151. Three parts, and one thing the umbrella did not foresee.

- **`BO_0254`** — an extension's change documents are its own `docs/changes/` members, read-only in
  the Extensions section, their status established by accepting the proposal that changes them.
  85 documents migrated and their nodes retired. It came first so that extension administration
  never depended on the document surface, and that is exactly what let `documents` leave.
- **`BO_0255`** — `documents` is a `bundled` extension; `ui.shell` is the frame and extension
  administration. The contract gained `proposedTargets` and `labelOf`.
- **`BO_0256`** — `calliopa-refine` is `individual` and private: the decision surfaces, the read
  routes, the library's glyph, and the sixteen kinds and three phases declared by instance. The
  contract gained a block-level decoration slot and `itemGlyphs`; the Core stopped holding any
  decision vocabulary.

* **The separation is partial, and by decision.** A proposal group carries both vocabularies and
  is staged as one script, so the statements that write a claim, a relation or a phase stay in the
  Apache-2.0 body — as do the `claim`, `relation` and `policy` types they use, and the server that
  compiles them. What a release ships is the structure a document has and the statements that
  write it, and nothing that says what any of it means. User decision, 2026-09-16 (`BO_0256_012`),
  which also records what making the write half movable would take.
- **One mechanism, five uses.** `proposedTargets`, `labelOf`, `itemGlyphs`, the block-level
  decoration slot and `EditorSurfaceContext` are the same shape: the owner asks rather than knows.
  Any later carve-out should reach for it first.
- **The absence check is the tool that works.** It found every leak, both times, before anything
  was staged — the extension views that should never have moved, the frame reading documents for
  its run detail and its process titles, and the backwards dependency the whole change exists to
  prevent. Run it first, not last.

## Out Of Scope

- Any change to what a person can do. Where the split makes a behaviour awkward, the awkwardness
  is recorded as open work, not fixed here.
- The licence of `calliopa-refine`. It is outside the Apache-2.0 body because it does not ship;
  what it would be licensed as if it ever shipped is the change that ships it.
- Publishing `documents` anywhere but a Calliopa release. A separately installable extension for
  other people's instances is its own change.
- `calliopa-video` and `calliopa-show`, which already sit outside the shell and are untouched.

[Contribution Contract]: the shell's `docs/system/workspace/contribution-contract.md` in the graph
[Extension Model]: ../system/extension-model.md
