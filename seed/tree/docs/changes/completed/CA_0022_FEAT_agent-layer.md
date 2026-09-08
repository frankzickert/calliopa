# CA_0022_FEAT_agent-layer

Status: completed

Requested: 2026-08-30

## Intent

Calliopa has a command dock whose composer accepts text and has no backend
([Workspace Shell](../../system/workspace/frame.md)), a process registry with no
producer, and an authenticated external API at `/api/v1/graph/` that no caller
uses. Three surfaces are waiting for the same missing thing: an agent.

This change adds it. Hermes is the agent the human talks to. It reasons on the
Codex app-server running on the user's ChatGPT subscription, delegates coding
work to Claude Code on the user's Max subscription, remembers across sessions in
a self-hosted Honcho, and reaches Calliopa's documents only through the
authenticated API it already has.

## Depends On CA_0021 And CA_0023

[CA_0021_FEAT_connections-and-credentials](../../../src/extensions/settings/docs/changes/completed/CA_0021_FEAT_connections-and-credentials.md)
is the credential half, split out on 2026-08-30 and delivered first. It brings
`CALLIOPA_SECRETS_KEY`, the encrypted connection store, and the settings surface
reached from a header control opening a tab with a synthetic target.

This change adds to that rather than repeating it: the `honcho` connection's
OpenAI key is the store's first real consumer, and the `claude-code`, `codex`,
and `hermes` rows are the status kind CA_0021 deliberately did not build.

[CA_0023_FEAT_proposal-writes](./CA_0023_FEAT_proposal-writes.md) is the second
dependency and lands between them. It is what an agent write *is* here, and it
was split out for the same reason: it is a graph concept any untrusted writer
wants, and folding it into this change would make this change undeliverable.

## Where This Design Comes From

This is the part most worth reading, because the obvious source is the wrong
one.

- `calliopa-video` has no Hermes. Its only matches are narrative material.
- `/home/calliopa/projects/studio` specifies an agent layer over the Agent
  Client Protocol and **has not built it**. There is no ACP dependency in its
  `package.json`, no ACP code under `src/`, and its three delegation tasks
  (`ST_0004_019`, `ST_0011_002`, `ST_0012_002`) are open `[ ]` behind a
  functional question recording that the released Hermes Agent has no ACP
  client — a generalized one exists only as an open upstream proposal,
  `NousResearch/hermes-agent#5257`, branch `feat/acpx-plugin`.
- `/home/calliopa/projects/_calliopa-old/calliopa-bootstrap` **did** build it,
  and its own `docs/system/hermes.md` records the cycle as dogfood-verified on
  all three paths: the API-key path through repeated full loops, Codex as the
  controller runtime with `executedBy: codex` stamped, and Claude Code as a
  delegated worker with Max-subscription execution corroborated by fresh session
  artifacts on the state volume. Its authority is `docs/system/hermes.md` and
  `infra/hermes/` under the task family `BO_0089`.
- So ACP is dropped. Hermes reaches Codex and Claude Code through its own
  runtimes, which is how it worked. Studio remains the source for exactly one
  thing in this change: Honcho, which bootstrap deliberately excluded.

* The design is taken from what ran, not from what was specified. Where the two
  repos disagree, `calliopa-bootstrap` wins.

## The Roles

* Hermes is Calliopa's agent and the only agent the human talks to.
* Codex is Hermes's controller runtime: `model.provider: openai-codex` with
  `model.openai_runtime: codex_app_server` hands each turn to a Codex app-server
  subprocess authenticated by the user's ChatGPT subscription.
* Claude Code is a delegated coding worker on the user's Max subscription,
  invoked through Hermes's bundled skill, not as a controller.
* Honcho is the agent's memory. It runs self-hosted in the compose stack, so
  agent memory never leaves the machine.
* The agent reaches Calliopa's content only through the graph gateway's
  authenticated API. It never writes to Postgres or Garage directly.

## Runtimes And Billing

The runtime selection chooses the model *under* Hermes — the conversation
loop's own LLM — and it is not symmetric between the two subscriptions. This
asymmetry is the single most expensive thing to rediscover, so it is fixed here.

* The default runtime is `codex`, and it needs no model API key at all. The
  ChatGPT subscription is the reasoning credential.
* `claude-code` is a delegated worker, never the controller. Hermes's own
  Anthropic OAuth provider bills extra-usage credits rather than the plan
  allowance — verified in bootstrap against a live billing refusal — and is
  deliberately not used.
* The active runtime is stamped as executed-by fact. An unavailable selection is
  a structured failure with a setup action, never a silent substitution of agent
  or billing mode.

- Bootstrap carries a third runtime, `provider`, running an explicit API-key
  model as controller. It is kept as a configuration path and left unconfigured:
  it costs nothing to leave in and it is the fallback if a subscription runtime
  breaks, but Calliopa ships with no model API key.
- The consequence of choosing `codex` as the default: Hermes's reasoning depends
  on the ChatGPT subscription being signed in. When it is not, the agent is
  `unconfigured` — which is a defined healthy state, not a failure.

## Subscription Sign-In

* Credential homes live on the agent's own data volume, under `HOME` pointed at
  the Hermes home. No subscription credential is stored in Postgres and none is
  written to `.env.dev`.
* The human signs in from the settings surface. A login broker inside the agent
  container serves the flows over a shared volume, so signing in never requires
  `docker compose exec`.
* Codex signs in with `codex login --device-auth`, which prints a URL and a
  one-time code and polls. Claude Code signs in with `claude setup-token`, which
  prints a URL and takes a code pasted back.

- The broker adopts the Codex CLI's token pair into Hermes's own auth store,
  refreshing an expired pair first. This is not tidiness: Hermes's
  `openai-codex` provider resolves credentials from its own store while the
  device-code login lands them in the CLI's home, and Codex's refresh tokens are
  single-use, so the fresh pair has to land in both stores in one operation.
- A probe reports each runtime's installed state, version, verified
  authentication, and billing mode without exposing any credential. That report
  is what the `claude-code` and `codex` connection rows show, and it is why
  those rows hold status rather than a secret.
- Losing the agent's data volume means signing in again. That is the accepted
  cost of keeping the credentials where their own tooling expects them, and it
  is a development stack where signing in is a minute's work.
- Agent configuration is a first-start step in the settings surface, not an
  install secret. Install stays zero-secret for the human.

## The Pinned Upstream Contract

Hermes is an external Python distribution and this is where it bites. Every item
below was verified in bootstrap against the installed release; none of it is
inferable from the upstream docs alone.

* The pin is `hermes-agent==0.19.0` on Python 3.13. It is a pin, not `latest`.
* Two dependencies the base install misses and the image must add:
  * `aiohttp` — without it the API server silently reports "no adapter
    available".
  * `mcp>=1.24,<2` — the 2.0 SDK drops the legacy symbol the release's
    HTTP-transport gate probes for, disabling HTTP MCP entirely.

- A build-time patch extends Hermes's MCP-elicitation acceptance to the Calliopa
  tool server. In codex app-server mode the release auto-accepts elicitations
  only for its own injected `hermes-tools` server and declines every other one,
  including the toolset the stack explicitly configured. The patch carries an
  assertion that fails the build loudly if a pin bump moves the code, so the
  patch is re-evaluated at every bump rather than silently becoming a no-op.
- `HERMES_HOME` relocates the config, the `.env`, and the SessionDB onto the
  named volume.
- The API server is enabled with `API_SERVER_ENABLED=true` behind
  `API_SERVER_KEY` on port 8642. Hermes refuses a key shorter than 16
  characters; `pnpm run bootstrap` generates one into `.env.dev`.
- `/health` is the upstream half of the service healthcheck. The
  `unconfigured` / `ready` distinction is Calliopa's, layered above it.
- Detached runs are `POST /v1/runs` returning a run id, `GET /v1/runs/{id}` for
  status, and `GET /v1/runs/{id}/events` for the SSE stream.

## What The Agent Reaches

Studio serves its agent an unauthenticated MCP endpoint on the compose network,
because it had no other machine door. Calliopa already built one, and bootstrap
shows the same shape working with a bearer.

- The agent is an API client like any other machine caller
  ([API Authentication](../../system/identity/api-authentication.md)). It holds a `cak_`
  credential issued by `pnpm run client`, and its writes carry its client
  identifier as graph provenance — so an agent write is attributed by the
  mechanism that already exists.
- Suspending the agent is `pnpm run client suspend`, an operator command that
  already works and takes effect on the next request without a redeploy.
- The tool surface is MCP over streamable HTTP behind the same resolver, with
  the bearer in the `Authorization` header of the `mcp_servers` entry. Schemas
  are the gateway's existing ones rather than a second copy.
- The `codex` runtime brings Codex's own tool surface, so the toolset must be
  registered in Codex's MCP config as well — `codex mcp add` with the bearer
  passed by environment variable so it never lands in `config.toml`.
- Calliopa's only domain content is documents and blocks
  ([Block Document Model](../../system/documents/block-document-model.md)), so that is the
  whole tool surface. There is nothing else to offer yet.
- The credential is written into the agent's data volume at start, not baked
  into the image, because a baked credential cannot be rotated.

* Hermes 0.19.0's MCP configuration is global. There is no per-run or
  per-session tool-server scoping, and inspection of the release's MCP client
  confirms tool calls carry only the tool name and arguments — no session
  identity, no per-call metadata.

- That constraint decides the architecture, not just a detail: any per-run
  binding must live inside Calliopa's own tool server, and runs must be
  serialized to one active run at a time. The widening path, if concurrent runs
  ever matter, is Hermes profiles pointing at per-profile tool endpoints. Not
  built here.

## Confinement

* The Codex worker runs non-interactively under Codex's own permission profile:
  `approval_policy = "never"` and `sandbox_mode = "workspace-write"`, with
  Hermes's gateway-context approvals deferring to it (`approvals.mode: "off"`).
  Never the full-bypass combination.
* Claude Code never launches with `--dangerously-skip-permissions`.
* The container is the outer boundary. A gateway context has no UI for approval
  requests, so the choice is between failing closed on every tool call and
  deferring to a real sandbox profile; the sandbox is the deny-by-default gate.

- A shell or network action outside the declared toolchain fails the tool call
  with a structured event rather than pausing for an approval nobody can answer.

## Memory

* The `honcho` connection holds an OpenAI API key. Honcho's deriver and
  dialectic receive it as `LLM_OPENAI_API_KEY` from the credential accessor,
  never from `.env.dev`.

- Honcho runs as `honcho` (`ghcr.io/plastic-labs/honcho`) with its
  `honcho-deriver` worker, against a `honcho` database in the shared Postgres.
  The image serves but does not migrate and refuses to start on an unmigrated
  database, so the service runs `alembic upgrade head` before serving.
- Honcho stores vectors in Postgres, so the `postgres` service image changes from
  `postgres:17` to `pgvector/pgvector:pg17-trixie`. The `-trixie` variant is
  required: pgvector's default `pg17` tag is Debian 12 while `postgres:17` is
  Debian 13, so the default tag moves an existing data directory backwards in
  glibc collation and Postgres reports a collation version mismatch. Delivered
  and proven by hand on the real development volume; [Application Foundation](../../system/foundation/runtime.md)
  carries the truth.
- Honcho refuses to start without an LLM key, so both services sit under a
  compose profile.
* `pnpm run dev` decides the profile from whether the key is stored. The
  application does not mount the Docker socket.

- Studio mounts `/var/run/docker.sock` into its application container so saving
  a key takes effect immediately. Calliopa does not, and the reason is specific
  to Calliopa: it publishes an authenticated external API, so the process that
  would hold root-equivalent control of the Docker daemon is the same process a
  remote caller reaches. The cost is one restart the first time a key is added,
  which is a once-per-machine event.
- This is the least proven part of the change. Bootstrap excluded Honcho
  deliberately, and studio's Honcho runs but has never been exercised by an
  agent. What lands here is a memory service wired correctly, not a memory
  behavior anyone has watched work.

## The Dock Is The Console

* The command dock is the agent surface. The composer is the goal input, each
  request is a process record, and the existing process console lists runs.

- This gives the process registry its first producer. The
  [Workspace Shell](../../system/workspace/frame.md) line saying nothing in
  `CA_0002` produces a process is narrowed there, not removed, and the header's
  count pill starts meaning something.
- No message table and no new region. Bootstrap's console — goal input, live
  event stream, cancel, and a short list of recent runs with status and agent —
  is almost exactly the dock Calliopa already has. Studio's per-owner chat
  threads are the alternative and are not built here.
- The event contract is small, normalized, and versioned: run started,
  assistant delta, tool started, tool completed, run completed, run failed, run
  cancelled. The shell never depends on Hermes-native event JSON.
- One active run at a time. A second goal while a run is active is refused as
  busy, not buffered — which the global MCP configuration above forces anyway.
- A cancelled or failed run leaves the registry's own failed state attached to
  the affected item, as the shell already specifies.
- [CA_0020_FEAT_command-mode-block-references](./CA_0020_FEAT_command-mode-block-references.md)
  meets this change at the composer and neither depends on the other: a request
  can be sent without block references, and marked blocks are inspectable
  without a backend. Whichever lands second inherits the other's account of the
  composer.

## What An Agent Write Is

* An agent write is proposal-only. A run stages into a proposal group and a
  human accepts it; nothing the agent produces becomes truth on its own. This
  was settled on 2026-08-30 and is enforced at the gateway boundary by the
  caller's identity class, not by the agent's good behavior.

- The model itself is [CA_0023_FEAT_proposal-writes](./CA_0023_FEAT_proposal-writes.md),
  which lands before this change. It is a graph and gateway concept rather than
  an agent one — any untrusted writer wants it — and it was already anticipated:
  [Revisioned Graph](../../system/content-store/revisioned-graph.md) fixes `candidate` and
  `rejected` as storable lifecycle states that no operation reaches "until a
  proposal-review change opens that path".
- What this change owns is the consumer half: the agent's client is
  propose-only, a run opens one group and stages into it incrementally, and the
  run closes naming the group. A run never reports acceptance, because it cannot
  cause one.
- Run provenance lands with the group: the goal, the pin the run read at, the
  runtime and model used, and a reference to the run. The graph already carries
  provenance for an externally originated write, so this is a use of the
  existing mechanism.
- This is also what makes the confinement above sufficient. An agent that cannot
  write truth is bounded by review rather than by trust in a sandbox, which is
  the difference between a bad run being a cleanup and being an incident.
- This change also carries the index into what a run proposed, moved here from
  [CA_0023](./CA_0023_FEAT_proposal-writes.md) on 2026-08-31 and enumerated as
  `CA_0022_014` in [Workspace Shell](../../system/workspace/frame.md). A selected
  process names the documents its run staged a group against and opens each.
  It could not live in CA_0023: nothing produces a process and no group carries
  a reference to a run until this change. Answering an item still happens in the
  document, which CA_0023 delivers on its own.

## The Containers

- `hermes` is built on `python:3.13-slim` with the pin above, carries the
  `claude` and `codex` CLIs and `ripgrep`, mounts a data volume at the Hermes
  home, and runs the gateway behind an entrypoint that regenerates the
  configuration whenever the settings surface writes new agent configuration.
- [Application Foundation](../../system/foundation/runtime.md) fixes the host
  port range 4500–4520 and that later services take the next free port. Hermes
  is published on 4503 and Honcho on 4504, for development inspection only and
  behind Hermes's own bearer.
- Secrets reach the container as files or environment, never baked into the
  image and never in a log line.

## What This Is Not

- Not ACP. It was specified next door, never built anywhere, and the runtimes
  that did work do not need it.
- Not mock agents. If a CLI, a subscription, or a model is absent, the affected
  surface says so by name and offers nothing.
- Not a second credential system. The inbound half stays
  [API Authentication](../../system/identity/api-authentication.md), the outbound half is
  CA_0021, and the subscription logins live in the agent's own store.
- Not durable, resumable, or forkable sessions, and not an interactive approval
  broker. Bootstrap deferred both and so does this.
- Not a skill-authoring surface.

## Cost

This is the largest change proposed for this repo. It adds three compose
services, changes the Postgres image under a volume already in use, pins and
patches an upstream Python distribution, adds a login broker, and gives the dock
and the process registry their first real behavior. The verification gate starts
every one of those on every run.

The pin is the part that ages. `hermes-agent` is an external distribution whose
0.19.0 behavior this change encodes in three places — two added dependencies, an
asserted source patch, and a config shape. A bump re-opens all three, which the
assertion is there to force rather than hide.

## Verification Impact

* No subscription credential may appear in Postgres, in `.env.dev`, in the
  image, or in a log line.

- Provable in the gate: Hermes answers `/health` on the compose network; the
  build fails if the elicitation patch no longer applies; the pinned release's
  API server answers with `aiohttp` present and MCP over HTTP works with the
  pinned `mcp` line, so both trap dependencies are proven by a real connection
  rather than by a comment; a suspended agent client is refused at the API; the
  dock composer creates a process record and the console lists it; a second goal
  during an active run is refused as busy.
- Not provable in the ordinary gate: a real run. It needs a signed-in ChatGPT
  subscription, which the verification stack does not have and must not have.
  Bootstrap's equivalent is one deliberately environment-gated test naming a
  real Hermes binary, and the same carve-out is the answer here — the ordinary
  suite cannot assume an external Python distribution or a personal
  subscription. `pnpm run verify:agent` is that carve-out: it refuses unless
  the agent's own probe reports both runtimes signed in, it is absent from the
  ordinary gate's lists, and a behavior test keeps it absent. It proves a
  refused action is an event rather than a hang. The sign-in flow is the half
  it does not yet cover.
- The verification stack publishes no ports and a behavior test asserts it.
  Three new services must not break that, and Honcho's profile keeps it out of
  the gate entirely unless a key is present.
- The pgvector image swap is proven by the existing development volume surviving
  it — a manual check on a real volume, not a gate test.
- `pnpm run verify` gates the result.

## System Work

Transferred on 2026-08-31. `docs/system/` carries the specification and the
tasks; this document is no longer where the work is read from.

- [Calliopa Agent](../../system/agent/calliopa-agent.md) is the new document for the
  roles, the runtimes and their billing asymmetry, the pinned upstream contract,
  sign-in and credential custody, the tool surface the agent reaches,
  confinement, memory, and the run lifecycle. It carries `CA_0022_004` (the
  image), `CA_0022_005` (the entrypoint and the credential), `CA_0022_006` (the
  login broker and the probe), `CA_0022_007` (the status connection kind and the
  sign-in surface), `CA_0022_009` (registering the toolset with both runtimes),
  `CA_0022_010` (confinement), `CA_0022_011` (the propose-only, serialized run),
  and `CA_0022_012` (the normalized event contract).
- [Application Foundation](../../system/foundation/runtime.md) carries
  `CA_0022_001` (the pgvector image swap), `CA_0022_002` (the `hermes` service,
  port 4503, and the generated API key), and `CA_0022_003` (`honcho` and its
  deriver on 4504 behind a profile), and names both ports in its network
  allocation.
- [Graph Gateway](../../system/content-store/graph-gateway.md) gains a `Tool Surface` section and
  `CA_0022_008`, the MCP tools over its existing authenticated boundary.
- [Workspace Shell](../../system/workspace/frame.md) gains the dock as the agent
  surface and `CA_0022_013`, and its process registry names the agent run as its
  first producer.
- [Settings](../../../src/extensions/settings/docs/system/connections.md) points its status-connection line at
  `CA_0022_007` rather than restating it.
- [System](../../system/system.md) routes the new document and records the agent
  layer as specified and not implemented.

The delivery order is unchanged: [CA_0021](../../../src/extensions/settings/docs/changes/completed/CA_0021_FEAT_connections-and-credentials.md),
then [CA_0023](./CA_0023_FEAT_proposal-writes.md), then this change. Two tasks
name that order in their own dependency lines rather than leaving it implicit:
`CA_0022_007` depends on `CA_0021_003` and `CA_0021_006`, and `CA_0022_011`
depends on the proposal group, its typed items, and the client identity class
that CA_0023 has not yet transferred into `docs/system/`.

No functional question remains open in this change. Every one it carried was
answered on 2026-08-30, and the last — what an agent write is — was answered by
making writes proposal-only, which moved the work into
[CA_0023](./CA_0023_FEAT_proposal-writes.md). That change has landed and the
questions it carried are answered, so nothing gates this change through it.

What outlives this change is open work in `docs/system/`, not open questions
here: `CA_0022_019` proves the sign-in flow where a real account and an external
network are available, and the surfaces this change delivered are carried
forward by their own change documents — `CA_0025` for the sign-in surface,
`CA_0026` for what the `hermes` row reports, and `CA_0030` for a run orphaned by
an application restart.
