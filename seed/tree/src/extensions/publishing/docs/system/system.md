# Publishing

## Purpose

- This document is the entry point of `publishing`, the extension that holds the general ability to publish content: the kinds of channel Calliopa can reach, the channels an author creates, the connection to each, shapes and deliverables as concepts, what a record is worth at a channel, the append-only log of what was published, and publishing one piece of content to one channel.
* The extension is `bundled`: every release carries it, so every instance has Channels. Its changes are release-note gated. User decision, 2026-09-14 (`PU_0001`).
* Its change prefix is `PU`. A change entirely inside this extension is a `PU` change document of this extension in the graph; a change that also touches the fixed layer is a `BO` change in `calliopa-bootstrap` whose system tasks concerning this extension are enumerated here.
- It depends on `ui.shell`, whose `document` type a prose item's body targets, and on `settings`, which keeps the credential half of a channel ([Channels](./channels/channels.md)).
- The specific structure one show publishes — the *Episode* and *Series* shapes — is not here. `calliopa-show`, an `individual` extension, installs them as data on top of this one and supersedes `calliopa-video`, which is deleted from the graph once `calliopa-show` publishes to homepage. User decision, 2026-09-14.
- `docs/material/publishing.md` in `calliopa-bootstrap` is the analysis this extension was cut from: the four earlier implementations, the comparison, and the decisions. It is material, not truth.
- The manifest is `category: bundled`, `entrypoint: contributions`, `capabilities.renders: ["views"]`, with dependencies `ui.shell >=0.1.0` and `settings >=1.0.0`. `contributions.ts` exports the Channels section and the `channel` tab kind with its view; `contributions.server.ts` the section's reader and the handler table under `/api/x/publishing/`, and no static party — a channel's party record is written when the channel is created ([Channels](./channels/channels.md)). Both halves go through the shell's `contributions()` and `serverContributions()` helpers (`PU_0001_001`).
- `PU_0001` delivered the extension, the Channels category, the channel tab with its credential facts and the website kind reading a site's index. The first publish — one item to one slot of a website channel — arrives with `PU_0003`, once items exist (`PU_0002`), which the change document's intent line about publishing a single piece of content still names as this change's; the docs here are what the implementation works from.

## Areas

### channels

- [Channels](./channels/channels.md) — a channel is the author's record of one destination: its kind, its title, its credential in the kernel's store, its state.
- [Channel Kinds](./channels/channel-kinds.md) — a kind is code: what it needs, what it offers, what it takes, how it projects and how it transports.
- [Website](./channels/website.md) — the first kind: a site that declares its own content index.
- [Bunny Stream](./channels/bunny-stream.md) — the video host as a kind of its own, taking video items whose ids a website's video slots carry.

### shapes

- [Shapes And Deliverables](./shapes/shapes-and-deliverables.md) — the concepts between the work and the channel: content classes, shapes and parts, deliverables, items and renditions.

### publishing

- [Publishing](./publishing/publishing.md) — what leaves Calliopa: the three layers, bindings, the publication log, and the rules every publication follows.
