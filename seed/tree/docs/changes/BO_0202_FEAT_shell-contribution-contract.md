# BO_0202_FEAT_shell-contribution-contract

Status: completed

Requested: 2026-09-06, as the second step of `BO_0201`.

## Intent

* An extension that is not core — `individual`, present in some instances and absent
  from others — can contribute to the `calliopa-app` shell without the shell importing
  it by name: the shell resolves what is present at build time and builds the same
  whether the extension is there or not.

The first consumer is `calliopa-video` (`BO_0203`), and its needs are the enumeration
below; the contract is built against them and nothing wider.

## What A Non-Core Extension Must Be Able To Contribute

Read off what episodes, standing assets and destinations are wired into today
(`shell.tsx`, `views.ts`, `tabs.ts`, the route loaders, `src/routes/api/**`,
`processes.ts`, the settings parties, migrations `0014`–`0018`):

- A **library section** in the left drawer: its title, its list loader, its open and
  create handlers, its toggle state in the persisted workspace layout.
- **Tab kinds** and the **views** that present them, entering the total `DEFAULT_VIEWS`
  record and the `VIEW_COMPONENTS` map, and the **process** item-kind list that names
  tab kinds.
- **Route loader data**: what the shell lists on every page load for the section.
- **API routes**, which Qwik City serves only from `src/routes/`: generated into
  `src/routes/api/<ext>/…` as `*.gen.*` files the kernel never commits, or dispatched
  through one catch-all that the registry routes by extension id.
- Its **vocabulary**: the `ext.blocktype` and `ext.relationtype` members the extension
  declares in the graph, enforced by CCGW's Validation (amended under `BO_0207`; the
  schema fragment and the migrations this line named are gone with the shell's store).
- **Settings parties**: the connection kinds the settings extension offers, so a
  destination's credential belongs to the extension that publishes there.

## Settled

Decided by the user on 2026-09-06.

* **Contributions are code.** The manifest's `entrypoint` names a module that exports
  the extension's contributions as typed values — library sections with their loaders
  and handlers, tab kinds and the views presenting them, route-loader data, an API
  handler table, settings parties. The tree's typecheck sees every reference; the
  manifest stays data. Vocabulary is not code: it is the extension's declared members
  (`BO_0207`).
* **One catch-all for API routes.** `src/routes/api/x/[ext]/[...path]` dispatches to
  the extension's exported handler table by extension id. No generated route files.
* **No privileged path.** `ui.shell` contributes Documents and Extensions through the
  same contract it hosts, so the contract is proven on the shell itself before
  `calliopa-video` uses it, and nothing the shell can do is out of an extension's
  reach.
* **Settings parties are a contribution point.** The settings extension offers
  connection kinds contributed by other extensions; `BO_0203` registers `homepage` and
  `bunny` there.

Further decisions by the user on 2026-09-07.

* **Every extension's API routes move under the catch-all, `ui.shell` included.**
  `/api/documents/**` becomes `/api/x/ui.shell/documents/**` and `/api/settings/**`
  becomes `/api/x/settings/**`. The host's own endpoints are not contributions and stay
  where they are: `/api/workspaces/**`, `/api/processes/**`, `/api/runs/**`,
  `/health` (`/api/v1/graph/**` and `/api/v1/mcp` retired under `BO_0207_015`). The shell's fetches, its browser suites
  and any operator probe that names a moved path are rewritten in this change.
* **This change converts both `ui.shell` and `settings`.** The contract is not built
  beside the shell and adopted later: Documents, the Extensions section `BO_0201`
  delivers, the settings view and the settings parties all arrive through it, so
  nothing keeps a privileged path into `BO_0203`.
* **A library section may contribute either a list or a component.** The section
  contributes its header — title, toggle key, optional create handler — and a body that
  is either the item shape the shell renders uniformly (identity, label, optional badge,
  optional open handler, which covers Documents, Episodes, the inert Standing Assets and
  the state-carrying Destinations) or a Qwik component the shell mounts. Both are
  supported; a section declares one.
* **Section states become a keyed record, with a migration.** `Layout` carries
  `sections: Record<string, SectionState>` keyed `<ext>:<section>`; one migration
  rewrites the stored `library`, `episodes`, `standing` and `destinations` fields; a key
  whose extension is absent is preserved untouched, so an extension removed and restored
  remembers its state; a missing key defaults to expanded.
* **A settings party is a full descriptor.** The contribution carries the party id, its
  kind (service or channel), its label, its configuration fields and its test function;
  `CONNECTION_PARTIES` and `CHANNEL_PARTIES` stop being hand-written lists in
  `src/lib/connections.ts` and come from the registry. Configuration and secrets live in
  the kernel's secret store (`BO_0207_003`, `BO_0207_013`), one record per party, and
  the test function is the party's declared probe the kernel runs; a party nothing
  contributes any more keeps its record unshown, as the settings extension already does
  for an unknown party.
* **Tab kinds are namespaced by their extension.** `ui.shell:document`,
  `settings:settings`, and in `BO_0203` `calliopa-video:episode` and the rest. A
  collision is impossible rather than caught. A migration rewrites the kinds stored in
  `workspace.tabs` and in `process.item_kind`; test selectors and browser suites follow.
* **The fixed lines that forbid scanning are revised, and the runtime ban stays fixed.**
  `workspace-view-types.md:27-30`, `graph-gateway.md:14` and `:117`,
  `block-document-model.md:126` and `revisioned-graph.md:76,78` are rewritten to say
  that contributions resolve at build time from the manifests present in the tree, and
  they keep, as fixed lines, that nothing is loaded at runtime: no dynamic import, no
  graph-source materialization, no enable/disable flow, no dependency resolution in the
  running application. They are revised wherever they live when this change is
  implemented — inside the graph, if `BO_0201` has landed.
* **A change in the graph keeps its own document.** When this change is implemented, its
  change document is written into the graph beside the code it changes —
  `docs/changes/BO_0202_FEAT_shell-contribution-contract.md` at the tree root, `ui.shell`'s
  own member — with the same id, status and content as this copy, so the Extensions
  section shows the owner the change that produced the contract. The rule is general and
  is recorded in [Change Process](../process/change-process.md); this copy stays the
  coordination record here.
* **Verification is fixture tests plus a real absence build.** Unit tests drive the
  plugin's scan, its named validation errors and its emitted module over fixture trees;
  one verification run builds the tree with `src/extensions/settings/` removed and shows
  the shell building, starting, and offering no settings tab, no settings section and no
  party — absence proven on a real extension before `calliopa-video` exists.

## Shape

- A build-time registry: a Vite plugin in `ui.shell` scans `src/extensions/*/manifest.json`
  at `configResolved`, reads each `entrypoint`, and emits `src/registry.gen.ts` — a
  `*.gen.*` module the kernel never commits — importing every present entrypoint and
  exporting the merged contributions. The shell imports only the generated module. An
  extension absent from the tree is absent from the registry, and the build is the same
  build.
- The registry validates while scanning, as the previous shell's did: a directory
  without a manifest, an id not matching its directory, an entrypoint that does not
  export the contract's shape, a declared dependency on an extension the tree does not
  hold, or two extensions contributing the same library section, view id or API prefix
  fail the build with a named error.
- **The entrypoint has two halves.** `src/extensions/<id>/contributions.ts` exports what
  the browser needs — sections, tab kinds with their default view and component, view
  types; `contributions.server.ts` exports what only the server may hold — the API
  handler table, the route-loader readers, the party descriptors with their probes. The plugin emits one generated module per half, and only server code
  imports the server one, so a secret or a database client cannot reach the client
  bundle through the registry.
- **A tab kind arrives whole.** Each contributed kind carries its default view and that
  view's component in one value, so the totality `DEFAULT_VIEWS` and `VIEW_COMPONENTS`
  get from the typechecker today is enforced by the registry's validation once the keys
  are strings.
- **`src/` root is the host, `src/extensions/<id>/` is the extension.** The frame — the
  workspace, tabs, dock, drawers, the process registry, the CCGW and kernel clients
  — is `ui.shell`'s source and not a contribution. What Documents contributes is a
  section, a tab kind, a view, a loader and a handler table, through the same contract
  everything else uses; its vocabulary is declared in the graph, not contributed in code.
- A contributed route loader that fails renders its section empty, the way a refused
  listing does today: the library is one region of a shell that still works without it.
- `src/registry.gen.ts` is not committed and therefore absent from a fresh checkout, so
  a `pnpm gen` step produces it and `pretest`, `pretypecheck` and `prebuild` run it; the
  Vite plugin regenerates it on `configResolved` and on manifest changes in watch mode.
- Process item kinds are not their own contribution: `parseProcessInput` validates
  against the registry's tab kinds.

## Transfer

Transferred to `docs/system/ui-shell.md` on 2026-09-07 as `BO_0202_001`–`BO_0202_011`:
the contract's shape and the registry plugin, the two entrypoint halves, library
sections and the layout migration, namespaced tab kinds and views with their data
migration, route-loader data, the API catch-all and the path move, the vocabulary line
(formerly graph schema fragments), settings parties, the fixed-line revisions, this document's carriage into the
graph, and the verification. Two functional questions stand there unanswered — whether
`process-result` stays bare as the host's own kind, and whether `settings:settings` is
right for the extension whose only kind repeats its name — and both belong to
`BO_0202_004`.

## Amended Under BO_0207

`BO_0207` (completed 2026-09-07) took the shell's own store away, and this document is
amended for it, as `BO_0207`'s Sequence section promised:

- There is no graph schema fragment to contribute. An extension's vocabulary is its
  `ext.blocktype` and `ext.relationtype` members in the graph, enforced by CCGW;
  `calliopaGraphSchema` and `composeGraphSchema` are deleted with `src/server/graph/`.
  `BO_0202_007` is rewritten to say so.
- There are no migrations. The tree carries none, and an extension carries none.
- A settings party's rows and secrets are the kernel's secret store, not a `connection`
  table; the contributed descriptor carries the probe the kernel runs (`BO_0202_008`).
- The host endpoints list loses `/api/v1/graph/**` and `/api/v1/mcp`, both retired.
- The frame the shell keeps as its own source is the workspace, tabs, dock, drawers, the
  process registry and its CCGW and kernel clients; the graph gateway and the MCP
  endpoint no longer exist.
- The fixed-line revisions under `BO_0202_009` name `graph-gateway.md` lines that are now
  a link stub (`BO_0207_016`); the task is re-pointed at the topics that still carry the
  scanning ban when it is implemented.

## Implementation

Implemented 2026-09-07 in `.local/tree-0207` and staged as proposal
`node:chg-54203091b2950a2a` (92 files) from a clean checkout at dataRevision 70; an
incomplete first staging, `node:chg-903bd6aceeaa9005`, is to be rejected (the kernel
refused the contract module directly under `src/extensions/`, which is why it lives at
`src/contract.ts`). Promoted to pin 73 the same day and verified on the instance (`BO_0202_011` in
`ui-shell.md`); the change is completed. What the
shape above did not foresee, and how it was decided:

- The frame's own kinds — the story-development placeholders and `process-result` —
  stay bare and are contributed first by `src/components/shell/host-contributions.tsx`
  with the `context` and `outline` placeholders; `context` presents anything, which
  makes view resolution total for a kind whose extension left the tree. Both functional
  questions stand in `ui-shell.md`, the first widened to the placeholders.
- Two host modules had imported the settings extension by name, which the absence
  build exposed: the publishing transport now reads a channel's address and key-set
  flag from the kernel's secret store directly, and the agent adapters module moved to
  `src/server/agent/adapters.ts`, the host's, because the run surface reads the agent's
  stamp; the settings extension imports it from there.
- The party scenarios of `tests/behavior/kernel-surfaces.test.ts` became the settings
  extension's own suite at `src/extensions/settings/tests/behavior/parties.test.ts`,
  which the behavior project includes from `src/extensions/*/tests/behavior/`, so a tree
  without the extension typechecks and tests clean; the publishing suite configures its
  stub channel through the kernel client with the descriptor's probe from the registry.
- The unit runner needed the Qwik optimizer to import a module holding components, which
  the generated registry does; `vitest.config.ts` carries `qwikVite()` and the registry
  plugin, so `vitest` regenerates the modules itself.
- A host route, `GET /api/library/<ext>/<section>`, re-reads one section through its
  contributed reader, so a section needs no route of its own for the drawer's refresh.
- The two stubs the fixed-line task named, `graph-gateway.md` and `revisioned-graph.md`,
  carried no scanning line left to revise since `BO_0207_016`.

## Not In This Change

- The carve-out itself (`BO_0203`).
- Runtime loading of extension code: the contract resolves at build time, the pin
  promotes a build, and `BO_0200`'s fixed constraint stands.
