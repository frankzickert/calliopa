# BO_0207_REFACTOR_shell-content-through-ccgw

Status: completed

Requested: 2026-09-07

## Intent

* The shell writes all of its content through CCGW. It keeps no separate Postgres database
  and no gateway of its own: one graph, one store, one entry point for reading and writing
  it.
* Garage is a core component the way Postgres is. An extension reads and writes objects only
  through the kernel, never with a bucket key of its own.

Today there are two graphs. CCGW holds the code, the manifests and the extension docs. The
shell keeps its content — documents, episodes, publishing, workspaces, proposals — in its own
database (`CALLIOPA_APP_DB`) behind its own typed gateway, its own client records and its own
proposal lifecycle, and never writes content through CCGW (`ui-shell.md`, Fixed Constraints;
`BO_0200`, "Two stores, deliberately"). That was the right call for importing `calliopa-app`
in one step, and `BO_0200` recorded the fold as "a different change with a different size".
This is that change.

This document is `completed`, 2026-09-07. Its system work was enumerated as `BO_0207_001`–`BO_0207_020` in `docs/system/` (`ui-kernel.md`, `hermes.md`, `ccgw.md`, `architecture.md`, `distribution.md`, `garage-backup-and-restore.md`, `ui-shell.md`, with `BO_0142_002` carried into `data-model.md`), and every task is folded into truth there; the Outcome section below is the coordination record of what landed, where the plan was corrected, and what it surfaced.

## Sequence

- This change lands first, then `BO_0202` and `BO_0203`, then `BO_0206`. User decision,
  2026-09-07, recorded in `BO_0206` as well.
- `BO_0202` proceeds as drafted for everything that is not storage — sections, tab kinds,
  views, route loaders, API dispatch, settings parties. Its schema-fragment task changes
  meaning from a TypeScript fragment to `ext.blocktype` declarations, a one-line amendment
  when it is drafted.
- `BO_0203` moves types instead of tables and uses the kernel's object store instead of the
  shell's. Its settled lines "the migrations move transparently" and "the object store stays
  in the shell" are superseded by this change, and it is amended to say so when it is drafted.
- `BO_0206` finds one store, one proposal lifecycle and one caller registry to authenticate,
  which is what keeps it small.

## Why

- `BO_0206` puts the authority gate in the core, on CCGW's mutation path, because that path
  is the one choke point. The shell's content never passes through it. A store the shell owns
  cannot be gated by the core, and a fork of Apache-2.0 code can answer its own proposals
  however it likes. The licensing sentence `BO_0204` sells — *the agent can propose, it
  cannot approve itself; a second person holding authority is what costs money* — is
  therefore true of code and false of content, and content is what a user looks at all day.
  One store makes it true of everything.
- Two graphs mean two revisioned stores, two proposal lifecycles, two provenance stamps, two
  caller resolvers, two identity-class rules, two backup surfaces and two vocabularies, each
  implemented once in Go and once in TypeScript. Every one of the TypeScript halves is graph
  content the shell can edit, so none of them is a guarantee. The Go halves are the product.
- A one-store posture is not new. Until `BO_0200` (2026-09-06) the shell's artifacts, blocks
  and media lived in CCGW: media uploaded through `PUT /v1/blobs` from the app origin
  (`binary-content.md`, `BO_0164`), block content written through the kernel bridge's
  `write` verb (`ui-kernel.md`, `BO_0134_001`), block types declared as `ext.blocktype`
  members and enforced by Validation (`extension-model.md`). The machinery exists and is
  verified; the new shell simply does not use it yet.

## What Is Already There

Worth listing, because the change is mostly wiring the shell onto surfaces the core already
has rather than building new ones.

* CCGW's mutation path enforces the identity class, scopes mutations to proposal groups, lands
  candidates with group membership, and accepts or rejects a group atomically under a human
  principal (`ccgw.md`, `BO_0084`). Acceptance is the kernel's.
* The kernel's review bridge is the browser's human write path: `stage` carries a
  proposal-scoped mutation with no confirmation, `write` carries a content truth mutation
  mirrored through CCGW's own explain route and refusing every reserved type, `accept` and
  `reject` answer a group (`ui-kernel.md`, `BO_0103`, `BO_0125`, `BO_0134`). The kernel proxy
  refuses any human-class mutation arriving from the app origin any other way
  (`BO_0103_001`).
* Blobs are CCGW's: `PUT /v1/blobs` with the hash computed server-side, `GET /v1/blobs/{hash}`
  streamed, meaning carried by the referencing revision (`binary-content.md`). The served
  tree's `/v1` proxy already carries both through the kernel's public port.
* Domain vocabulary is graph-defined: an extension's `ext.blocktype` and `ext.relationtype`
  Blocks define its types, and Validation consumes the established set with the compatibility
  invariant that refuses a breaking redefinition (`extension-model.md`).
* The kernel's agent bridge starts runs, streams events, cancels, lists recent runs, and binds
  the agent principal, class, pin and group per run; the kernel toolset gives Hermes
  `calliopa_query`, `calliopa_mutate` and `calliopa_explain` against CCGW (`hermes.md`,
  `BO_0089_004`, `BO_0089_012`). The bridge's intake already carries the intention a content
  run needs (`BO_0142_006`).
* Reads are unfenced, pinned at a `dataRevision`, and answer the assembled graph with
  provenance, with one proposal as an overlay (`BO_0084_005`).

## What Leaves

The shell's schema is eighteen tables in one migration sequence. Each has one of four fates.

- **Content, into CCGW.** The eight `graph_*` tables — node, revision, relation, validity,
  data revision, scope, proposal group, proposal item — are the shell's copy of what CCGW
  already is. They go, and with them `src/server/graph/` entirely: contract, schema,
  validation, traversal, roots, read, mutate, changes, proposals and the gateway module. The
  domain modules above it (`src/server/documents/`, `src/server/production/`) read CCGW and
  write through the kernel bridge.
- **Content of `calliopa-video`, into CCGW.** `publication`, `destination_binding`,
  `front_binding` and `bunny_channel` are content too. Under this change an extension has no
  migrations, and those tables become `ext.blocktype` declarations the extension carries
  (`BO_0203`, amended).
- **Working state, to the kernel's data volume.** `workspace` and `process` hold tabs,
  layouts and the process registry. A tab switch is not a fact about the product and does not
  consume a data revision, appear in provenance or grow the backup. The kernel keeps a small
  unrevisioned per-instance record beside last-known-good and the run workspaces, behind one
  endpoint the shell reads and writes.
- **Credentials and runs, to the core.** `api_client` and `api_credential` are the shell's
  caller resolver for its own external API and MCP surface; `agent_run` and
  `agent_run_event` are the shell's conductor's. With content in CCGW, the shell's
  `/api/v1/graph/**` JSON API, its `/api/v1/mcp` tool server and its Hermes conductor are a
  second copy of the kernel's agent bridge and kernel toolset over the same graph, in
  Apache-2.0 code between the model and the gate. They retire, and every function they carried
  is served by a core component (the table below). `BO_0200`'s "One Hermes, two toolsets"
  is superseded: one Hermes, one toolset, started only through the kernel.
- **Secrets, to the kernel's secret store.** The settings extension's `connection` table holds
  encrypted configuration under the stack's `secrets_key`, and the graph never holds a
  credential (`BO_0200_012`, `extension-model.md`). It moves to Calliopa-owned secret storage
  on the state volume, which `BO_0089_002` already established for agent credentials, behind a
  kernel endpoint. The kernel performs the connection tests itself; the shell's server side
  never holds a decrypted value, and the shell's own `secrets_key` retires with its database.
- **Objects, to the kernel.** The shell's bucket (`GARAGE_APP_BUCKET`), its key pair and
  `src/server/object-store.ts` retire. Garage is a core component: CCGW's blob routes are
  the store, the kernel's public port is how an extension reaches them, and no extension holds
  a bucket key. One bucket, one key, one backup surface.
- `schema_migrations` goes with the sequence it recorded.

### Retired surfaces and the core components that serve them

Every function the shell's retired surfaces carried is provided by a core component. What is
already there is named; what is added is this change's work.

| Retired in the shell | Function | Core component |
| --- | --- | --- |
| `src/server/graph/` gateway | typed reads, rooted and bounded, current or as-of | CCGW `/v1/cypher/query` with the `dataRevision` pin — exists |
| | change count and last-written time for named identities | CCGW metadata read (`INCLUDE HISTORY`) — exists |
| | atomic typed mutations with base-revision conflict | CCGW `/v1/cypher/mutate` via the bridge's `write` verb — exists |
| | validation against the committed vocabulary | Validation over `ext.blocktype`/`ext.relationtype` — exists |
| `src/server/graph/proposals.ts` | staging a group, overlay read of one's own group | bridge `stage`; `proposalOverlay` envelope field — exist |
| | per-item accept and reject, group closing on its last answer | CCGW `ACCEPT PROPOSAL p MEMBER m` / `REJECT PROPOSAL p MEMBER m` (`BO_0113`) and the bridge's `accept`/`reject` with `member` — exist; the confirmation round-trip they park behind is **lifted for content groups** |
| | conflict per item against truth that moved | CCGW per-member drift judgement, `member_drift_conflict` recoverable and `OVERRIDE` explicit (`BO_0113_002`, `_003`) — exists |
| Hermes conductor (`src/server/agent/conductor.ts`) | start a content run from the run surface, stream, cancel, list | kernel agent bridge `/__kernel/agent/runs` with `intention` — exists |
| `agent_run`, `agent_run_event` | run records and their events | kernel run records (`agent-runs/*.json`) and Hermes state — exist |
| `/api/v1/mcp` tools | `list_documents`, `read_document`, `propose_document_changes` | kernel toolset `calliopa-kernel` — **content-aware tools added**, enumerations read from `GET /v1/schema` |
| `/api/v1/graph/**` JSON API | read, mutate, propose and overlay-read for automation | CCGW statement routes through the kernel's public port, under a core credential (`BO_0206`) |
| `api_client`, `api_credential`, `pnpm run client` | caller records, issuance, rotation, suspension, class | the core caller registry and `cck_` credentials (`BO_0206`); the Hermes client is issued there |
| `connection` table, `secrets_key` | encrypted party configuration and connection tests | kernel secret store on the state volume — **added**, tests run by the kernel |
| `workspace`, `process` | tabs, layouts, process registry | kernel per-instance state endpoint on the data volume — **added** |
| `object-store.ts`, `GARAGE_APP_BUCKET` | media upload, retrieval, sweep | CCGW `PUT /v1/blobs`, `GET /v1/blobs/{hash}` through the kernel — exist; sweep is CCGW's retention |
| `scripts/serve.mjs` migrations, `/health` store checks | schema application, store reachability | nothing to apply; `GET /__kernel/healthz` — exists |

## The Direction

- **Reads go straight to CCGW; writes go through the kernel.** The shell's server side reads
  CCGW on the internal network, pinned at head, as the served tree's `/v1` proxy already
  lets it. Every write is a bridge verb under the kernel-held principal: `stage` for a
  proposal, `write` for content truth, `accept` and `reject` for review, per item or whole.
  This is the rule `BO_0206` needs — the shell presents, the core decides — and it costs the
  shell nothing it does not already do, since the kernel proxy refuses the alternative today.
- **One vocabulary.** The shell's block document model — document, the `text` and `divider`
  block types, text roles, marks, containment — becomes `ext.blocktype` and
  `ext.relationtype` members of `ui.shell`, enforced by Validation. The previous shell's
  `artifact` vocabulary was never seeded into this graph — it is a bundled extension of the
  old graph and of release `0.0.2` only (`distribution.md`) — so there is nothing to retire
  here, and the old graph keeps its content untouched in its own volumes. Markings and the
  record slot carry over as properties of the document type, because they are the intention
  mechanism skill selection reads. The `write` verb's non-reserved rule admits the new types
  unchanged.
- **One proposal lifecycle, answered per item.** The shell's typed proposal items become
  proposal-scoped mutations into CCGW groups, and CCGW's existing per-member decisions answer
  them (`BO_0113`): a member is one proposed operation, accepting it is a real acceptance
  point under its own `dataRevision`, drift is judged per member with additive kinds
  auto-correcting and rewrites surfacing a recoverable conflict, and the group stays open
  until its last member is decided. Groups touching the extension namespace stay whole-unit
  by CCGW's own rule, so code review is unaffected. What is added is the bridge verb that
  carries a member decision from the browser.
- **One agent path.** Content runs start from the shell's run surface as a client of the
  kernel's agent bridge, carrying the intention, and hold the kernel toolset; the shell starts
  no run of its own. The toolset gains the document tools the shell's server offered, reading
  every enumerated value from the schema route so a block type added in the graph reaches
  the published tool schema without a code change.
- **One object store, behind the kernel.** An extension uploads and reads blobs through the
  kernel's public port and references them from revisions, the way the previous shell's media
  family did. The kernel holds the one Garage key. `garage-init` converges one content bucket
  and the backup key.
- **One instance layout.** Postgres serves two databases instead of three, Garage two buckets
  instead of three; the `migrate` and `garage-init` one-shots stop creating the shell's; the
  kernel service stops carrying `CALLIOPA_APP_DB_*`, `CALLIOPA_GARAGE_*` and the app key
  files; the serve wrapper stops running migrations and the promotion gate's serve probe has
  nothing to skip. `architecture.md`, `ui-shell.md` and `distribution.md` say so.
- **The rule to carry into review:** a feature that needs a table is a feature that needs a
  type. If it cannot be a graph type, it is a secret or working state, and both live on the
  kernel's volumes behind a kernel endpoint.

## The Transfer

The transfer of this instance is seamless: the operator opens the shell at the new pin and
finds every document, workspace and tab where it was.

- **One command, one revision.** An import reads the shell's database and writes established
  content and open proposals into CCGW as one accepted mutation under the human principal, at
  one `dataRevision`, with a rationale naming the source database and the time. Open
  proposals land as open CCGW groups with their items. Media objects are uploaded through the
  blob route as the revisions referencing them are written, so their hashes are CCGW's.
- **Identifiers are preserved.** The shell's logical UUIDs become the CCGW node identities, so
  tab targets, containment, publication references and every link keep resolving without a
  rewrite table. Workspaces and processes are carried into the kernel's per-instance record
  with the same identifiers.
- **History is not replayed.** CCGW's data revisions cannot be interleaved with another
  store's, and `BO_0206`'s rule holds: history is not re-signed. Imported revisions carry the
  provenance the shell's revisions carried. The shell's revision history stays reachable as a
  final dump of the retired database, kept beside the graph's backups.
- **Verified before the old store is dropped.** The import reads every document back through
  CCGW and compares it with the shell's read of the same document before cut-over; the count
  of documents, blocks, episodes, workspaces and objects is equal on both sides. The
  `calliopa_app` database and the app bucket are dropped by the operator after that
  comparison, never by the import.
- **The Hermes client retires with the table.** Its `cak_` proposer credential authenticated
  it to the shell's MCP surface only; Hermes reaches CCGW through the kernel toolset under the
  kernel's internal bearer, with the agent principal bound server-side, and needs no
  replacement credential until `BO_0206` issues core credentials.

## Outcome

Landed on the dogfood instance on 2026-09-07, in twelve proposals and eight promotions, every
one accepted and promoted by the operator; the truth lines carry the ids and pins.

- **The shell writes everything through CCGW.** Documents (pin 37), the settings extension,
  workspaces and processes (pin 45), the run surface (pin 48), production (pins 54 and 59),
  publishing and the gateway's deletion, and objects with the tree without stores (pin 59).
  `src/server/graph/`, `src/server/db.ts`, `src/server/object-store.ts`, `migrations/` and
  the migration scripts are gone; `postgres` and the S3 client left the lockfile; the shell
  declares 25 members — 12 `ext.blocktype`, 13 `ext.relationtype` — and receives no secret.
- **The core grew what the table above promised.** Content-only member decisions without
  the confirmation round-trip, the kernel's state record and secret store with the brokered
  request and `kernel secret read`, the document tools in the kernel toolset with their
  enumerations from `GET /v1/schema`, a schema route listing graph definitions, the write
  gate's bare-close vantage, and `kernel import-app-content` with its equality report.
- **The transfer ran and the stores are gone.** The instance's content was established at
  dataRevision 64 with the report `EQUAL`, read back through the served shell at pin 59, and
  the old database and bucket were dropped by the operator the same day with the final dump
  archived in the backup bucket. Postgres serves two databases and Garage two buckets; the
  backup dumps two and lists the archived one; release `0.2.0` was cut at pin 59 and a fresh
  install of it verified.

Where the plan was corrected while it landed, each recorded on the task it belongs to:

- The new shell has no `/v1` proxy: it reads CCGW at `CALLIOPA_CCGW_URL` and reaches the
  bridge at `CALLIOPA_KERNEL_URL`, both handed to the tree by the kernel (`BO_0207_001`).
- The production module was a second gateway consumer the enumeration had not named
  (`BO_0207_019`), and the publishing tables became graph types of their own
  (`BO_0207_020`); the schema route did not yet list graph definitions (`BO_0207_018`).
- This shell has no media picker or upload route, so the blob path was verified in the kernel
  harness rather than from a surface (`BO_0207_016`).
- CCGW establishes one revision per node per mutation, so a revise that sets one property and
  clears another is two writes in sequence (`BO_0207_019`).
- The transfer's refusal must not fire on the empty default workspace the served shell writes
  on its first visit; a false refusal on this instance settled it (`BO_0207_005`).
- `distribution/docs/` does not exist and `install.sh` never named a store (`BO_0207_009`).

What it surfaced beyond its own scope:

- `BO_0210`: a relation closed after a pin, on a node revised after the relation was
  anchored, is invisible at every pin between the revision and the close. A rollback to pin 54
  failed on it, and rollback to pins 45–58 stays impossible until it lands. The kernel's
  last-known-good cache did not survive a container rebuild, noted there as an open point.
- Two boundary tests had been red since mid-change — the kernel package rule and the local
  exposure boundary — and are green again; the kernel's key variable is
  `CALLIOPA_KERNEL_SECRETS_KEY_PATH` for the same reason the shell's was `_PATH`.
- `BO_0202` and `BO_0203` carry the amendments the Sequence section names; `BO_0206` finds the
  one store it needs.

## Open

Nothing is open.

## Settled

Decided by the user on 2026-09-07.

* The shell writes all its content through CCGW. There is no separate Postgres database and
  no separate gateway for the shell's content.
* This change lands first, before `BO_0202`, `BO_0203` and `BO_0206`.
* The shell's Hermes conductor, MCP surface and external JSON API retire. Every function they
  carried is provided by a core component: the kernel's agent bridge, the kernel toolset with
  content-aware document tools, CCGW's statement routes under core credentials, and the core
  caller registry.
* Content proposals are answered per item, through CCGW's existing per-member acceptance
  (`BO_0113`), never through a lifecycle the shell runs itself.
* The new shell's block document model is the one vocabulary, declared by `ui.shell` as
  `ext.blocktype` and `ext.relationtype` members, with markings and the record slot carried
  over; the previous shell's artifact family stays in the old graph and is not seeded here.
* Working state — workspaces, tabs, processes — is unrevisioned, kept by the kernel on its
  data volume behind one endpoint.
* Party configuration is stored by the kernel on the state volume, encrypted under a kernel
  key; the kernel runs the connection tests, and the shell never sees a secret.
* The transfer is as seamless as possible: established content and open proposals imported at
  one revision with identifiers preserved, history kept as a dump and not replayed, verified by
  a read-back comparison before the old store is dropped.
* Garage is a core component like Postgres. Extensions, the shell included, read and write
  objects only through the kernel; no extension holds a bucket key.
* Member decisions from the browser travel on a bridge verb with no confirmation round-trip,
  for groups outside the extension namespace only, on the write verb's reasoning; CCGW's own
  rule keeps extension-namespace groups whole-unit. Accept-all is per-member accepts in
  group order, stopping at the first surfaced drift conflict. Decided 2026-09-07.
* The three document operations are Go tools in the kernel toolset, their enumerations read
  from `GET /v1/schema` when the tool list is served, so a block type declared in the graph
  reaches the tool schema without a kernel release; a `ui.shell` `ext.skill` says when and
  how to use them. The propose tool stays propose-only. Decided 2026-09-07.
* Content node ids are the shell's UUIDs verbatim, imported and minted alike, with no prefix
  and no namespace. The source-path id convention stays reserved to root-mapped source
  Blocks, so a content node never collides with a file. Decided 2026-09-07.
* The kernel's per-instance state is one file per workspace and one per process under two
  directories on the data volume, written temp-file-then-rename like the materializer, listed
  by directory read with no index file. A workspace deleted in the shell is removed from the
  volume. Decided 2026-09-07.
* Runtime use of a stored secret is brokered by the kernel: an extension posts the request
  and the kernel adds the credential and forwards it; only the operator can read a value,
  through a kernel CLI command inside the kernel container, which is what the memory script
  uses. Decided 2026-09-07.
* Every field of a party's configuration lives in the kernel's secret store, not in
  `ext.settings` Blocks; the convention stays for settings that are content. Decided
  2026-09-07.
* The vocabulary task carries `BO_0142_002`, optional properties with permitted values, under
  this change's readiness; the shell's document model is its first consumer. Decided
  2026-09-07.
