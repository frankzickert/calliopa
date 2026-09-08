# BO_0200_FEAT_calliopa-app-in-the-graph

Status: completed

Requested: 2026-09-06

## Intent

Recreate `calliopa-app` (`/home/calliopa/projects/calliopa-app`) as the graph-hosted UI of a
**new** calliopa-bootstrap graph. The new graph keeps the mechanism that lets code be
changed through reviewed proposals — the meta-schema, `calliopa-base`, `calliopa-extension`,
the kernel and its CLI — and replaces everything the old graph carried as UI. The eight
change documents that were open against the old UI were moved to `docs/changes/superseded/`
on 2026-09-06 with this request; this change supersedes them.

* The new graph keeps `calliopa-base` and `calliopa-extension` — the very mechanism that
  allows code to be changed and edited through the graph.
* Developing and approving changes from the CLI stays possible.
* The shell and the entire UI are `calliopa-app`'s build, inside the new graph — not a
  re-implementation, and not the old `ui.shell`.
* `calliopa-app`'s settings live in a separate extension.
* `calliopa-app`'s connections to Codex, Claude and Hermes work well and are what the new
  graph uses.

## What Exists On Each Side

Measured on 2026-09-06 against both repositories.

**The old graph** (`calliopa-bootstrap_postgres-data`, data revision 4369, last write
2026-08-24): 1,338 nodes, 187 proposal groups, ten extension manifests — `ui.shell`,
`artifact`, `calliopa-base`, `calliopa-extension`, the five intentions (`understand`,
`apply`, `discuss`, `stay-tuned`, `extend` — the last as a skill under `calliopa-extension`)
and two `individual` extensions (`channels`, `recent-nodes`) — plus 80 artifacts of content
written in the old UI's block vocabulary. The release bundle at pin 4364
(`distribution/seed/`) is a materialized copy of the eight bundled extensions and their
30 sidecar members, so `calliopa-base` and `calliopa-extension` already exist outside the
database in shippable form.

**`calliopa-app`**: a single-package Qwik City 1.20 + Vite 7 app, pnpm, Node 22, TypeScript
strict. About 28,000 lines under `src/` in 155 files, 17,000 lines of tests in `tests/`,
18 SQL migrations, and an operator layer of Node scripts that drive Docker Compose. Two HTML
routes (`/`, `/w/[id]`) render one `Shell`; six built-in view types
(`block-editor`, `episode`, `front`, `context`, `outline`, `settings`) are compiled-in
source and the code says so on purpose (`src/lib/views.ts:4-8`). The backend is the same
process: Qwik City API routes under `src/routes/api/` wrapping `src/server/*` — its **own
revisioned graph** with proposals (`src/server/graph/`, `migrations/0005`, `0009`), block
documents, production, publishing, an MCP server at `/api/v1/mcp`, and the Hermes conductor.
Storage is Postgres (`postgres` driver) and Garage (S3). There is no CCGW client and no
notion of extensions, kernel, or `ext.source` anywhere in the code; its docs name
calliopa-bootstrap only as the design reference it deliberately did not copy.

**The agent side of `calliopa-app`** is what the request singles out as working well:
`Dockerfile.hermes` (hermes-agent 0.19.0 with Node 22, `@anthropic-ai/claude-code`,
`@openai/codex`, and a patch admitting the `calliopa` MCP server through Codex's elicitation
gate), `hermes-entrypoint.sh` (writes Hermes and Codex config; registers the app's MCP
toolset with Codex), `hermes-login-broker.py` (drives `codex login --device-auth` and
`claude setup-token` and lands the results on a shared volume), `src/server/agent/*`
(HTTP client, conductor, run events as SSE, adapter state read from that volume), and the
settings view with its encrypted connection store (`migrations/0006`, `0012`, `0013`;
`src/server/connections.ts`; secrets under `CALLIOPA_SECRETS_KEY`).

## The Shape

Where the two sides fit without a fight, and the three places they do not.

### The kernel already accepts this app

The kernel assumes nothing about the framework: pnpm, and `build`, `dev`, `serve`,
`typecheck` scripts in the root `package.json` (`ui-kernel.md:15`). The graph owns the build
root through root-mapped `ext.source` Blocks of the elevated shell extension. `calliopa-app`
is a Qwik City app with its own `package.json`, `vite.config.ts`, `tsconfig.json`, entries,
and `src/routes/` — the same set the old `ui.shell` root-mapped. The kernel passes its own
environment through to the tree's serve process (`internal/kernel/toolchain/serve.go:63`),
so the app's `CALLIOPA_*` variables reach it the way they reach the app container today.

- The new `ui.shell` extension — `calliopa-app` in the role the old shell held — root-maps `calliopa-app`'s whole tree. Qwik City file-convention
  routing stays intact, because `src/routes/` is root-mapped rather than placed under
  `src/extensions/`. The old shell's generated route registry and the `ext.uicontribution`
  contract are **not** carried: the app's views are compiled-in by its own design, and
  nothing contributes into it yet. The kernel still validates contributions on commit, so
  the contract remains available the day something wants it.
- The root `package.json` in the graph is the app's, reshaped to the kernel contract:
  `build` = `vite build && vite build -c adapters/node-server/vite.config.ts`,
  `serve` = `node server/entry.node-server.js` honouring `PORT`, `dev` = the Vite SSR dev
  server, `typecheck` = `tsc --noEmit`. The operator scripts (`bootstrap`, `dev`, `prod`,
  `migrate`, `client`, `verify`) drive Docker Compose and do not belong in a graph-hosted
  tree; the compose stack in this repository takes over that job.
- `dist/` and `server/` are build outputs; the kernel never commits them (`diff.go:70-72`)
  and the promotion gate rebuilds them. `src/server/*.mjs` modules commit as ordinary
  `ext.source` Blocks.
- `pnpm-workspace.yaml` needs `allowBuilds` for `esbuild` (and `sharp: false`, matching the
  app's own file), or the frozen install refuses (`ui-kernel.md:45`).

### The two graphs

This is the one structural decision. `calliopa-app`'s workspace content lives in its own
revisioned graph with its own proposal lifecycle, in Postgres tables it migrates itself.
The bootstrap graph is where the **code** lives. Putting the app's source into the bootstrap
graph does not make the app read its content from CCGW, and the app's docs record that it
chose not to (`graph-gateway.md:27`).

- **Two stores, deliberately.** The CCGW graph holds the extensions; the app's own schema
  holds workspaces, documents, episodes, publishing and connections, in a second database
  in the same Postgres service (`CALLIOPA_DATABASE_URL` points there). Nothing in the app
  changes. Folding the app's content graph into CCGW is a different change with a different
  size, and not a precondition for this one.
- The app's 18 migrations need an owner in the new stack. The app runs them today through
  `scripts/migrate.mjs` driving compose. In the new stack they should run as a compose
  one-shot service before the kernel serves, or on the app's own startup — a technical
  decision, taken at implementation.
- The app's Garage bucket sits beside the bootstrap blob bucket on the one Garage service:
  two buckets, two key pairs, the way `garage-init` already provisions the content key.

### One Hermes, two toolsets

Both sides run a Hermes and both are HTTP clients of it. Bootstrap's kernel is one client:
the agent bridge starts runs, inlines the selected skills, and offers the kernel's own MCP
toolset — `calliopa_query`/`mutate`/`explain` against CCGW plus the run-scoped
`calliopa_workspace_*` tools that check out, edit, build and commit code
(`internal/kernel/agenttools/`). That toolset is what `calliopa-extension`'s skill teaches
and is the mechanism the request keeps. `calliopa-app`'s conductor is the other client: it
starts runs against the app's MCP toolset at `/api/v1/mcp` and streams events to the shell.

- **The new stack runs `calliopa-app`'s Hermes image and entrypoint, and its Honcho**, not bootstrap's — the
  login broker, the Codex/Claude sign-in flow, the adapter state on the shared agent-config
  volume, and the connection store are the part that works well. Bootstrap's own
  `infra/hermes/` becomes unused.
- **Both toolsets register with that one Hermes.** The entrypoint already registers the app's
  toolset by `codex mcp add calliopa --url …`; it gains a second registration for the kernel
  toolset at the kernel's `agent-tools` URL with the kernel bearer. The Claude and provider
  runtimes take the same pair through Hermes's MCP config.
- **Both clients keep their own run path.** The app's conductor keeps starting content runs
  from the shell. Code runs start from the CLI — `kernel agent run "<goal>"` already sends a
  goal through the bridge and streams the events to the terminal (`cmd/kernel/agent.go`) —
  and are reviewed with `kernel proposal list|diff|accept|reject` and promoted with
  `kernel pin`. No Hermes console in the shell is needed for the request, and none is built.
- The kernel bridge's run intake carries an `intention` resolved from the old UI's markings.
  With no intention extensions in the new graph, every run takes the shared base alone,
  which the bridge already permits (an absent intention is legal, `ui-kernel.md:156`).

### Settings as its own extension

`ext.settings` in bootstrap is a per-instance state Block that neither materializes nor
ships (`extension-model.md:80`), with no encryption. `calliopa-app`'s settings are a
feature: the settings view (`src/components/views/settings.tsx`, 745 lines), its API
routes (`src/routes/api/settings/**`), `src/server/connections.ts`,
`src/server/connection-tests.ts`, `src/server/agent/adapters.ts`, three migrations, and
the encrypted connection store.

- **The settings extension carries the code, and the values stay in the connection store.**
  Secrets encrypted at rest under `CALLIOPA_SECRETS_KEY` must not move into `ext.settings`
  Blocks, which are plain graph content readable by every principal. What "separate
  extension" buys is graph-level identity: its own manifest, its own `partOf` membership,
  its own proposals and review, its own version, and a subtree an agent can be pointed at.
- Layout: `src/extensions/settings/` holds the view and the server modules; the shell keeps
  the thin Qwik City route files under `src/routes/api/settings/` importing from there,
  because file-convention routes must live under `src/routes/` and those files are already
  one-line wrappers. The tree remains one pnpm package, so the import is a relative path —
  the same way `artifact`'s components were imported beside `ui.shell` in the old graph.
- The view registry (`src/lib/views.ts`) keeps naming `settings` as a built-in view and
  imports it from the extension. Whether that registry later becomes the contribution point
  for other extensions is a follow-up, not this change.

### What is not carried from the old graph

- `ui.shell`, `artifact`, the five intention extensions, `channels`, `recent-nodes`, and the
  80 artifacts — all written in the old UI's vocabulary, which the new UI does not render.
- The old graph itself is **not** destroyed or migrated in place: the new graph is a fresh
  instance with its own volumes, and the old one stays readable until the user retires it.

## Recreating The Graph

In order, because each step needs the one before it. All writes go through CCGW under the
operator's principal, the way `make seed` and the release install already do.

1. **Fresh instance.** New compose project name (or new volumes), bootstrap secrets,
   Postgres with two databases, Garage with two buckets, CCGW, kernel, the app's Hermes.
2. **Meta-schema.** `cmd/seed` with the install profile: the eleven definition Blocks, and
   nothing else — the dogfood profile would also seed `calliopa-extension`, but the version
   the old graph holds is newer than the seed's, and step 3 carries that one.
3. **`calliopa-base` and `calliopa-extension`** from the old graph, at pin 4364: their
   manifests and skills are sidecar members in `distribution/seed/members.json` already, or
   come fresh from `kernel checkout --members` against the old CCGW. Committed with
   `kernel commit --members` and `--truth` as the first establishment. The
   `create-extension` skill's text teaches the old shell's contribution contract and
   `entrypoint`; it is revised as an ordinary proposal once the new shell is in.
4. **The shell.** `calliopa-app`'s tree, reshaped as above, committed with `--map-root ui.shell`
   and `--truth`, then `kernel pin --to head` — the promotion gate builds it and
   serve-probes it before it becomes the served pin. The settings extension is committed in
   the same change set so the tree never has a hole.
5. **Prove the loop.** One code change staged as a proposal from a `.local/tree-*` checkout,
   reviewed and accepted from the CLI, promoted; then one agent run from
   `kernel agent run` that stages a proposal through the kernel toolset.
6. **Release.** Mark the new shell and settings extensions `category: "bundled"`, cut a
   release with `release-distribution.sh`, so the distribution's install and update paths
   carry the new UI instead of the old.

## Settled

Decided by the user on 2026-09-06.

* **The shell extension's id is `ui.shell`.** The elevated CCGW policy, the release bundle's
  `marker` and `mapRoot`, and the install script's posture check all name it already, so
  the repository changes nothing for it. The name describes the role — the extension that
  owns the build root — and `calliopa-app` is what fills that role in this graph. Block ids
  read `ui.shell.<path>`.
* **Tests travel partially: the `unit` and `behavior` vitest projects only.** The browser
  and integration suites need Playwright and a running stack and stay in the `calliopa-app`
  repository. The root `package.json` in the graph keeps `vitest` and a `check` script
  scoped to those two projects, and drops `@playwright/test` and `@axe-core/playwright`
  from the lockfile. Running `check` inside the promotion gate is a follow-up.
* **Honcho is in from the start.** This repository's compose stack gains the `memory`
  profile's two services (`honcho`, `honcho-deriver`) and the key path that sources
  `LLM_OPENAI_API_KEY` from the connection store, so the new stack matches
  `calliopa-app`'s dev stack rather than a subset of it.
* **The code loop is CLI-only in this change.** Humans stage with `kernel commit`, agents
  run through `kernel agent run`, review is `kernel proposal list|diff|accept|reject`,
  promotion is `kernel pin`. Hermes holds the kernel toolset, and only runs started through
  the kernel bridge use it: runs the shell's conductor starts never reach it, so the shell
  does not need to know a run's target. A shell surface for code runs and review is a later
  change.

## System Tasks

Transferred 2026-09-06. Seventeen tasks, enumerated where each subject is owned; the
recreation order above is their dependency order.

- `BO_0200_001`–`BO_0200_005` (`docs/system/architecture.md`, Deployment topology) — the
  new compose instance under its own project name; the shell's database and `honcho`
  created by `migrate`, with the shell applying its own migrations at serve and the
  promotion gate forbidden from migrating; the app bucket and key in Garage; the kernel
  service carrying the shell's runtime environment, the secrets key on the secrets volume
  and the tree-side `_FILE` assembly; Honcho from the start with the key read from the
  connection store.
- `BO_0200_006` (`docs/system/garage-backup-and-restore.md`) — three-database backup,
  restore and drill.
- `BO_0200_007`–`BO_0200_010` (`docs/system/hermes.md`) — `calliopa-app`'s Hermes image,
  entrypoint and login broker in `infra/hermes/` reading secrets from files; the
  `calliopa-kernel` MCP server registered beside `calliopa` and admitted by the elicitation
  patch; the shell's `cak_` credential issued into the secrets volume; both loops proven —
  a content run from the shell and a code run from `kernel agent run` reviewed and promoted
  from the CLI.
- `BO_0200_011`–`BO_0200_014` (`docs/system/ui-shell.md`, Calliopa App As The Shell) — the
  tree reshaped to the kernel contract with a tree-owned `serve` wrapper and the unit and
  behavior tests only; the `settings` extension subtree with its manifest and members; the
  truth import with `--map-root ui.shell`, promotion, verification, and a proposal round
  trip; the rewrite of `ui-shell.md` itself, which replaces three Fixed Constraints the
  decision contradicts.
- `BO_0200_015`–`BO_0200_016` (`docs/system/extension-model.md`) — seeding the new graph
  with the install profile and carrying `calliopa-base` and `calliopa-extension` from the
  pin-4364 sidecar as one truth commit; revising the `create-extension` skill for a shell
  without the contribution contract.
- `BO_0200_017` (`docs/system/distribution.md`) — the distribution stack and docs
  following the new topology, the bundled set becoming `ui.shell`, `settings`,
  `calliopa-base` and `calliopa-extension`, and a `0.1.0` release cut `--no-push` and
  verified by a fresh install.

Two things the transfer decided that the shape did not, both reversible before a task is
claimed:

- **The shell applies its own migrations at serve time**, so the graph is authoritative for
  the shell's schema and a promoted pin carries the schema it needs. The cost is a rule the
  gate must honour — the serve probe's environment does not name the shell's database, so
  the probe cannot migrate — stated in `BO_0200_002`.
- **The compose-driving operator scripts leave the tree** except the two the stack still
  calls (`client.mjs` for the `cak_` credential, `run-honcho-key.mjs` for the memory
  profile) and their `scripts/lib` dependencies. The stack in this repository is the
  operator layer now.

## Implementation

- **2026-09-06, the stack (`BO_0200_001`–`_005`).** `docker-compose.yml` is project `calliopa-graph`; `migrate` creates `calliopa_app` and `honcho`; `garage-init` converges the `calliopa-app` bucket and key; `bootstrap` generates `secrets_key`; the `kernel` service carries the shell's runtime variables in `_FILE`/`_PATH` form; `honcho` and `honcho-deriver` run under the `memory` profile with `setpriv` dropping root after reading the password file; `make memory-up` reads the stored key from the served tree. `ProbeServe` sets `CALLIOPA_SERVE_PROBE=1`. Brought up on fresh volumes, every one-shot re-run a no-op, Honcho migrated and running as uid 100, `go test ./...` green against the new instance. The old graph's volumes were not opened. Left open: `make memory-up` end to end, which needs the served tree.
- **2026-09-06, Hermes (`BO_0200_007`–`_009`).** `infra/hermes/` is `calliopa-app`'s image, entrypoint and broker, reading this stack's secret files, registering `calliopa-kernel` beside `calliopa` in Hermes and Codex, with the elicitation patch widened. Started: healthy, kernel toolset registered and stamped, shell toolset waiting for the `cak_` credential that `make agent-credential` will issue once the tree serves.
- **2026-09-06, the graph and the shell (`BO_0200_015`, `_011`–`_013`).** Seeded (install profile, dataRevision 11), `calliopa-base` and `calliopa-extension` carried as one truth commit (12). `calliopa-app` reshaped in `.local/tree-0200` — kernel scripts, tree-owned `serve` wrapper, migration runner spanning extension directories, unit tests plus the one behavior test whose subject travels, the `settings` extension subtree — built, typechecked, tested and served locally, then staged as a 200-file proposal, accepted from the CLI (14) and promoted through the gate; the kernel serves it in prod mode. A kernel fix rode along: derived directory names are foreign only at the tree root, or `src/server/` would have been dropped. Decided at implementation: the app's `docs/` and repository-only suites stay in `calliopa-app`; the import took the working tree as it stood (commit `6f40628` plus uncommitted edits).
- **2026-09-06, the rest (`BO_0200_006`, `_009`, the `_005` remainder, `_014`, `_016`, `_017`).** Backup covers three databases and the app bucket, both drills verified. `scripts/agent-credential.sh` issued the `hermes` client and both toolsets registered; `scripts/memory-up.sh` brought Honcho up from a key stored through the settings view. `ui-shell.md` rewritten. The `create-extension` skill revision is staged as proposal `node:chg-26c56898e7df61b5` and left for the user to accept: establishing truth is human-only, and this one did not need to land to keep the pipeline moving. `BO_0200_010` stays open, proven up to the point where a signed-in runtime must answer. Release `0.1.0` cut `--no-push` at pin 17 and verified by a fresh install under its own project name.
- **Acceptances performed under the user's principal.** To bring the shell to serve, this session accepted the import proposal and the README round trip and promoted pins 14 and 17 with `--principal frankzickert`. The change process reserves acceptance for the human; the user should confirm those stand, or reject and re-stage them.

## Not In This Change

- Reading the app's content from CCGW, or merging the two graphs.
- A Hermes console or code-proposal review inside the new shell.
- Making the app's view registry a contribution point for other extensions.
- Migrating the old graph's artifacts or content into the new one.
- Running the carried unit and behavior suites inside the promotion gate, and carrying the
  browser and integration suites at all.
