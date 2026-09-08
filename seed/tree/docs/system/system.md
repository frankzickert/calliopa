# System

## Purpose

- `docs/system/` is the authoritative source for the system under construction.
- System requirements, scoped implementation tasks, open work, and completed implementation truth live across this folder.
- This document is the system documentation entry point.
- System documentation may be split across `docs/system/` when a section becomes independently meaningful.

- [ ] The Purpose lines of this index and of every primary topic still describe the flat documents they came from; rewrite each to its topic's own scope, and this section to say what the shell is for, so the owner document's Purpose reads as a purpose (the editorial pass `BO_0201`'s restructuring deferred).

## What Calliopa Is

* `calliopa` is `Calliopa`: a browser workspace for story development, used by people directly.
* Calliopa may serve other repos in the Calliopa family; which repos consume which capabilities is decided by the change introducing the first shared capability.

- The workspace shell is the frame for later story-development tools. It does not define a content model.

## Fixed Stack

* TypeScript is the application language.
* Qwik and Qwik City are the application framework, serving HTML routes and API routes from one application.
* Vite is the build, development, and preview toolchain.
* Node is the runtime and pnpm is the package manager.
* The one graph, through CCGW, is the content store, and the kernel holds working state and party secrets; the shell keeps no database and no bucket of its own (`BO_0207`).
* Bytes are CCGW blobs in the graph's own store, uploaded through CCGW and referenced from the revision that needs them (`binary-content.md`, `BO_0207_016`).
* Docker Compose is the orchestration layer. Everything runs in containers; a checkout and Docker are the whole prerequisite.

- Fixing a provider does not authorize building against it. Each capability is introduced by its own change.

## Areas

### workspace

- [Workspace Shell](./workspace/frame.md) describes identity, responsive layout, tabs, workspace persistence, process reporting, themes, and drag coordination.
- [Workspace View Types](./workspace/view-types.md) describes the view contract, the built-in view registry, and how a tab chooses, remembers, and mounts a view.
- [Workspace Shell](./workspace/frame.md)
- [Layout](./workspace/layout.md)
- [Tabs](./workspace/tabs.md)
- [Command Dock](./workspace/command-dock.md)
- [Messages](./workspace/messages.md)
- [Processes](./workspace/processes.md)
- [Drag And Drop](./workspace/drag-and-drop.md)
- [Themes](./workspace/themes.md)
- [Workspace View Types](./workspace/view-types.md)
- [Contribution Contract](./workspace/contribution-contract.md)

### documents

- [Block Editor View](./documents/block-editor.md) describes the first real view type: reading presentation, in-place block editing, saving, structural gestures, and its action surfaces.
- [Block Document Model](./documents/block-document-model.md) describes the first domain model over the graph: documents, blocks, the block vocabulary, ordering, containment, retirement, and structural operations.
- [Block Document Model](./documents/block-document-model.md)
- [Proposed Changes](./documents/proposed-changes.md)
- [Schema Evolution](./documents/schema-evolution.md)
- [Block Editor View](./documents/block-editor.md)
- [Document Panel](./documents/document-panel.md)
- [Command Mode](./documents/command-mode.md)

### content-store

- Since `BO_0207_016` the content-store topics are links: the store, the boundary over it, proposals, the external surface and retention are the core's (`ccgw.md`, `binary-content.md`, `ui-kernel.md`), and each topic says where.
- [Graph Gateway](./content-store/graph-gateway.md)
- [Proposals](./content-store/proposals.md)
- [External API](./content-store/external-api.md)
- [Revisioned Graph](./content-store/revisioned-graph.md)
- [Retention And Backup](./content-store/retention-and-backup.md)

### identity

- Since `BO_0207_016` the identity topic is a link: who a caller is and what its class may do are the core's (`BO_0206`, `ccgw.md`).
- [API Authentication](./identity/api-authentication.md)

### settings

- [Settings](../../src/extensions/settings/docs/system/connections.md) describes the instance's settings surface and the outbound half of credentials: the connection record for an external party, its secret encrypted at rest, and the settings tab that administers it.
- The settings extension carries its own docs: [Settings](../../src/extensions/settings/docs/system/system.md).

### agent

- [Calliopa Agent](./agent/calliopa-agent.md) describes the agent layer: the roles, the runtimes and their billing asymmetry, the pinned upstream contract, subscription sign-in and credential custody, confinement, memory, and the run lifecycle.
- [Calliopa Agent](./agent/calliopa-agent.md)
- [Pinned Upstream Contract](./agent/pinned-upstream-contract.md)
- [Tool Access](./agent/tool-access.md)
- [Confinement](./agent/confinement.md)
- [Memory](./agent/memory.md)
- [Run Lifecycle](./agent/run-lifecycle.md)

### production

- The production area is `calliopa-video`'s since `BO_0203_008`; its topics live under the extension's own [docs](../../src/extensions/calliopa-video/docs/system/system.md) and are linked here for the reader who knew them as the shell's.
- [Episodes And Assets](../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md) describes what Calliopa produces: the episode as the canonical unit, the assets inside it, their roles, machine facts and renditions, the bytes in Garage, and serials.
- [Episodes And Assets](../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md)
- [Deleting Published Records](../../src/extensions/calliopa-video/docs/system/production/deleting-published-records.md)
- [Episode View](../../src/extensions/calliopa-video/docs/system/production/episode-view.md)

### publishing

- The publishing area is `calliopa-video`'s since `BO_0203_008`, with the production area above.
- [Publishing](../../src/extensions/calliopa-video/docs/system/publishing/publishing.md) describes what leaves Calliopa: destinations and their mappings and transports, the homepage adapter, the append-only publication log, and what that log protects from deletion.
- [Publishing](../../src/extensions/calliopa-video/docs/system/publishing/publishing.md)
- [Destination Bindings](../../src/extensions/calliopa-video/docs/system/publishing/destination-bindings.md)
- [Adapters](../../src/extensions/calliopa-video/docs/system/publishing/adapters.md)
- [Homepage Destination](../../src/extensions/calliopa-video/docs/system/publishing/homepage-destination.md)
- [Homepage Front](../../src/extensions/calliopa-video/docs/system/publishing/homepage-front.md)
- [Publication Log](../../src/extensions/calliopa-video/docs/system/publishing/publication-log.md)

### foundation

- [Application Foundation](./foundation/runtime.md) describes the runtime boundary, development environment, verification gate, and the deployed production instance.
- [Application Foundation](./foundation/runtime.md)
- [Development Environment](./foundation/development-environment.md)
- [Production Instance](./foundation/production-instance.md)
- [Verification](./foundation/verification.md)

## Implementation

- The application foundation and the workspace shell are implemented and verified; the linked documents carry their current truth.
- The durable content store the shell kept is retired under `BO_0207`; [Revisioned Graph](./content-store/revisioned-graph.md) links to the core's.
- The workspace's main area mounts registered view types; [Workspace View Types](./workspace/view-types.md) carries that truth. Its registry holds placeholder views until the first real one arrives.
- The graph gateway was implemented and verified and is retired under `BO_0207`; [Graph Gateway](./content-store/graph-gateway.md) records what it was. Features reach the one graph through CCGW and the kernel bridge (`BO_0207_012`, `BO_0207_019`, `BO_0207_020`).
- Machine-caller identity is implemented; [API Authentication](./identity/api-authentication.md) carries its truth, including the identity class that says whether a caller writes truth or may only propose. No caller holds `proposer` yet and nothing enforces the class, which is `CA_0023_008`. Human identity does not exist yet.
- Credentials have two halves. The outbound half — what Calliopa presents to someone else — is implemented and verified; [Settings](../../src/extensions/settings/docs/system/connections.md) carries its truth. A connection's secret is encrypted at rest under `CALLIOPA_SECRETS_KEY`, never leaves the server, and is administered from the settings tab. `honcho` is the only connection, and nothing consumes its key until the agent layer arrives.
- The block document model is implemented and verified; [Block Document Model](./documents/block-document-model.md) carries its current truth, with `CA_0007_010` and `CA_0007_011` left open. Documents and blocks are the only domain content the graph stores.
- The block editor in [Block Editor View](./documents/block-editor.md) is implemented and verified: it is the first real registered view type, and a document can be read, edited, restructured, and reordered through it. The document title is editable in place. `CA_0008_012` there is the open follow-up.
- Proposal writes are implemented and verified. A caller may stage a group of typed changes against a document instead of writing truth, read its own group back laid over truth, and a person answers it item by item in the document itself; the client's identity class decides which of the two a caller may do. [Revisioned Graph](./content-store/revisioned-graph.md), [Graph Gateway](./content-store/proposals.md), [Block Document Model](./documents/proposed-changes.md), [Block Editor View](./documents/proposed-changes.md), and [API Authentication](./identity/api-authentication.md) carry that truth. No caller holds `proposer` yet, because the agent that will is `CA_0022`.
- The agent layer is implemented; [Calliopa Agent](./agent/calliopa-agent.md) carries its truth, with [Application Foundation](./foundation/development-environment.md), [Graph Gateway](./content-store/external-api.md), and [Workspace Shell](./workspace/command-dock.md) carrying the service, the tool surface, and the console. The dock's composer sends a goal to an agent that reasons on a subscription runtime, reaches documents only through the authenticated API, and stages what it produces as a proposal a human answers. The process registry has its first producer.
- What a signed-in subscription proves is proven separately, because the verification stack has no account and must not have one: `pnpm run verify:agent` is the environment-gated gate, and `CA_0022_019` is what remains open there. `pnpm run verify` stays subscription-free and cannot reach it.
- The production work layer is implemented and verified; [Episodes And Assets](../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md) carries its truth. The graph stores episodes holding assets, each episode carrying its own premise and teaser text and naming the asset that stands for it; assets carrying a production role, a medium, machine facts, an optional label and any number of categories; renditions naming their bytes by hash; prose bodies as documents; characters with a portrait and a description; and serials with their positions, their opening prose and their cover. A file is ingested into Garage with its facts read off it, the library lists episodes beside documents, and an episode opens in its own view. `CA_0033_015` and `CA_0033_026` are the open follow-ups there.
- Publishing is half built. [Publishing](../../src/extensions/calliopa-video/docs/system/publishing/publishing.md) carries it: the append-only publication log, the destination binding holding what a record is worth at one destination and refusing a slug once its address is published, the adapter contract's pure half, the homepage projection and every refusal it makes before a request is sent, and the sweep over superseded bytes no publication protects. All of it is proven by `pnpm run verify` because none of it reaches a destination.
- Calliopa publishes. An episode is projected onto homepage's document, its media put there, the record delivered, and every attempt recorded in the append-only log; retiring ends what that destination serves and the address stays spent. `pnpm run verify:publish` proves it against a real homepage and refuses on a machine with no channel configured. A film waits on a video host, so what publishes today is stills and prose (`CA_0033_010`, `CA_0037_005`). An episode's view carries its distribution panel: what it is at each destination, the address it has there, and the two acts a person may perform.
- A platform destination waits on a change that gives the credential store an OAuth kind and answers how a platform's redirect reaches an instance on a Tailscale address. [Settings](../../src/extensions/settings/docs/system/channels.md) records both, and neither is publishing work.
- Story-development tools, users, and collaboration each arrive through their own change.
