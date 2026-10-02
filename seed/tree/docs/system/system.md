# System

## Purpose

- `docs/system/` is the authoritative source for the system under construction.
- System requirements, scoped implementation tasks, open work, and completed implementation truth live across this folder.
- This document is the system documentation entry point.
- System documentation may be split across `docs/system/` when a section becomes independently meaningful.

- [ ] The Purpose lines of this index and of every primary topic still describe the flat documents they came from; rewrite each to its topic's own scope, and this section to say what the shell is for, so the owner document's Purpose reads as a purpose (the editorial pass `BO_0201`'s restructuring deferred).

## What Calliopa Is

* `calliopa` is `Calliopa`: a graph-backed, versioned, extensible browser workspace — a frame, and extensions over it, where nothing changes without a proposal someone accepted. User decision, 2026-09-16 (`BO_0253`, Decided).
* Calliopa may serve other repos in the Calliopa family; which repos consume which capabilities is decided by the change introducing the first shared capability.

- The workspace shell is the frame the extensions mount in. The one type it declares is `attachment`, the record of a file sent with a command ([Commands And Runs](./workspace/commands-and-runs.md), `BO_0229_007`); documents and every other content model are extensions'.

## Fixed Stack

* TypeScript is the application language.
* Qwik and Qwik City are the application framework. On an instance they serve HTML routes and API routes from one application.
* Vite is the build, development, and preview toolchain.
* pnpm is the package manager. On an instance, Node is the runtime.
* The one graph, through CCGW, is the content store; the shell keeps no database and no bucket of its own (`BO_0207`). On an instance, the kernel holds working state and party secrets.
* Bytes are CCGW blobs in the graph's own store, uploaded through CCGW and referenced from the revision that needs them (`binary-content.md`, `BO_0207_016`).
* On an instance, Docker Compose is the orchestration layer. Everything runs in containers; a checkout and Docker are the whole prerequisite.
* [ ] CA_0076_004 On a device (the Android and iOS apps, `calliopa-bootstrap`'s `docs/system/mobile.md`), the same tree at the same release pin is built for a WebView inside the native host; its server half runs in the page behind the port, the device cell holds the graph and working state, and secrets are in the platform keystore. No feature has device-specific UI code ([Device](./foundation/device.md)). User decision, 2026-10-01 (`BO_0319`).

- Fixing a provider does not authorize building against it. Each capability is introduced by its own change.

## Areas

### workspace

- [Workspace Shell](./workspace/frame.md) describes identity, responsive layout, tabs, workspace persistence, process reporting, themes, and drag coordination.
- [Workspace View Types](./workspace/view-types.md) describes the view contract, the built-in view registry, and how a tab chooses, remembers, and mounts a view.
- [Workspace Shell](./workspace/frame.md)
- [Layout](./workspace/layout.md)
- [Tabs](./workspace/tabs.md)
- [Commands And Runs](./workspace/commands-and-runs.md)
- [Messages](./workspace/messages.md)
- [Processes](./workspace/processes.md)
- [Drag And Drop](./workspace/drag-and-drop.md)
- [Themes](./workspace/themes.md)
- [Workspace View Types](./workspace/view-types.md)
- [Contribution Contract](./workspace/contribution-contract.md)

### documents

- The documents area is `documents`' own `docs/` since `BO_0255_009`; its topics live under the extension's [docs](../../src/extensions/documents/docs/system/system.md) and are linked here for the reader who knew them as the shell's.
- [Block Document Model](../../src/extensions/documents/docs/system/documents/block-document-model.md)
- [Block Editor View](../../src/extensions/documents/docs/system/documents/block-editor.md)
- [Proposed Changes](../../src/extensions/documents/docs/system/documents/proposed-changes.md)
- [Document Panel](../../src/extensions/documents/docs/system/documents/document-panel.md)
- [Command Mode](../../src/extensions/documents/docs/system/documents/command-mode.md)
- [Schema Evolution](../../src/extensions/documents/docs/system/documents/schema-evolution.md)

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

### foundation

- [Application Foundation](./foundation/runtime.md) describes the runtime boundary, development environment, verification gate, and the deployed production instance.
- [Application Foundation](./foundation/runtime.md)
- [Development Environment](./foundation/development-environment.md)
- [Production Instance](./foundation/production-instance.md)
- [Verification](./foundation/verification.md)
- [Device](./foundation/device.md): the same tree on the Android and iOS apps — the server port, the import rule, the device build and capability states

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
- The agent layer is implemented; [Calliopa Agent](./agent/calliopa-agent.md) carries its truth, with [Application Foundation](./foundation/development-environment.md), [Graph Gateway](./content-store/external-api.md), and [Workspace Shell](./workspace/commands-and-runs.md) carrying the service, the tool surface, and the console. A block sent as a command reaches an agent that reasons on a subscription runtime, reaches documents only through the authenticated API, and stages what it produces as a proposal a human answers. The process registry has its first producer.
- What a signed-in subscription proves is proven separately, because the verification stack has no account and must not have one: `pnpm run verify:agent` is the environment-gated gate, and `CA_0022_019` is what remains open there. `pnpm run verify` stays subscription-free and cannot reach it.
- Story-development tools, users, and collaboration each arrive through their own change.

## Refine, Show, Video And Test Are Removed

Under `calliopa-bootstrap`'s `BO_0324` (2026-10-01): the frame keeps nothing of `calliopa-refine` or
`calliopa-video`. The change's document and its decisions stand in `documents`' `system.md` (*Refine,
Show, Video And Test Are Removed*).

- The frame's traces are gone (`BO_0324_040`): the contract's block places are `headline`, `below`,
  `command`, `underCommand` and `run`, with no `depth`; no tab or panel key is redirected to
  `calliopa-video` (`src/lib/tabs.ts`, `src/lib/layout.ts`), and a workspace that still remembers
  one drops it as it drops any kind nothing contributes; the view bridge has no `retarget$`, since
  focused work and the route open their own tabs (`openAlongRoute$`); and the icon table has no
  `lighthouse`, `clock-countdown`, `warning-circle` or `eye-slash`. The unit tests that used the
  removed ids as fixtures use neutral ones.
