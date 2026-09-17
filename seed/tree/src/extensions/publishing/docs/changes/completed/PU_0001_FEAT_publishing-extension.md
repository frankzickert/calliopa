# PU_0001_FEAT_publishing-extension

Status: completed

Requested: 2026-09-14, from the analysis in `docs/material/publishing.md` in `calliopa-bootstrap`, whose Decisions section the user settled the same day. This is the first change of `publishing`, the bundled core extension that holds the general ability to publish content: channel kinds, channels, the connection to a channel, shapes and deliverables as concepts, bindings, the publication log, and publishing a single piece of content to a channel. The extension does not exist yet; this document lists under *Other* until it is created.

## Where This Starts

- **No extension holds channels as data.** `calliopa-video` (inactive, pinned at 0.1.0) contributes `homepage` and `bunny` as party descriptors, so the set of channels is application source with no affordance for adding one. Its destinations are code, its nine production roles are one show's vocabulary, its Bunny credential has no upload, and its asset-shaped publication path is schema only.

- **The settings extension's Channels section** lists the registry's channel parties beside Connections; `isChannelParty` consults the registry. The kernel's secret store takes any party id and brokers any request within the party's configured address.

- **The shell's contribution contract** gives an extension library sections, tab kinds with views, readers, an API table under `/api/x/<ext>/`, and parties. Vocabulary is declared as `ext.blocktype` and `ext.relationtype` members and validated by CCGW. Bytes are CCGW blobs referenced from a top-level property.

- **Four earlier cuts exist** and the analysis compares them: `studio` (channel as data, the website declares a content index, deliverable types assigned to slots), `calliopa-video` (three layers, pure projection and transport, log-derived state, every publication a human act), `homepage` (`/v1`, media by hash, tombstones, no video bytes) and the archived CMS (the asset package as variable inventory).

## Intent

* **A Channels main category** in the library, contributed by `publishing`, listing every channel with its kind's icon and its state as a badge, with a `+` that picks a kind and names the channel. A channel opens as a `publishing:channel` tab.

* **A channel kind is code**: an adapter the extension ships, with an id, a label, the credential it needs (`apiKey`, `oauth`, `manual`), its configuration fields and probe, the **offer** of slots it fills (each a content class with constraints), the **units** it takes (a deliverable, an item, its own front) and the **acts** it supports, a pure **projection** that answers the platform's document or every rule broken, and a **transport** that alone reaches outward through the kernel's broker.

* **A channel is data**: a `channel` node with a kind, a title and a party record in the kernel's store under `publishing:<channelId>`, so two channels of one kind are two channels. Its state is read from the kernel's record, never stored twice. A channel that has published anything is retired, not deleted.

* **The credential half stays in settings**: a channel's row appears in the settings extension's Channels section (`CA_0049`); the channel tab links there and holds no credential field.

* **The website kind speaks a site-declared index**: `GET <address>/index` (containers with route templates and fields, slots typed by content class with constraints, copy fields), media declared by hash and uploaded when absent, `PUT` on the route, `DELETE` to a tombstone, video never as bytes. Strict parse; a key that vanishes from the index is retired, never dropped.

* **Shapes and deliverables are this extension's concepts**: `shape`, `part`, `deliverable`, `item`, `rendition`, `binding` and `publication` are its declared types; a personal extension (`calliopa-show`) installs specific shapes as data. The smallest unit is one item published to one slot of one channel.

* **Every publication is a human act.** An agent prepares and proposes; a person releases. State at a channel is derived from the append-only log; a projection refusal is not a failed publication; a `200` that is not the platform's answer is a failure; refuse, never skip.

* **Bundled.** Every release carries the extension; its changes are release-note gated.

## The Shape

- The manifest: id `publishing`, `bundled`, `entrypoint: contributions`, dependencies on `ui.shell` and `settings`. `docs/system/system.md` names the prefix `PU` and the areas *channels*, *shapes*, *publishing*.

- The vocabulary: `channel` (kind, title, state derived), `shape` and `part` (content class `video | image | audio | prose | file`, cardinality, role label, constraints), `deliverable` and `item` (class, machine facts, label, disclosure) with `rendition` (a blob reference, dimensions, provenance), `binding` (address, per-channel copy fields, disclosure), `publication` (append-only entry). Relations: `holds`, `shaped`, `fills`, `exports`, `body` to the shell's `document`, `takes` (channel to shape) and `assigns` (part to slot).

- The channel tab: *Credential* as a link to the settings row with the state it reports; *Takes* — the shapes this channel takes and the assignment of parts onto the kind's slots, refused where class or constraint cannot meet; *Published* — the log's answer for this channel.

- The inspector on a deliverable or item: one row per channel — never published, published with the time, retired — with what is missing and the acts.

- This change delivers the extension, the vocabulary, the Channels category, the channel tab with its *Credential* and *Published* sections, the `website` kind reading an index, and publishing one item to one slot. The shape editor and ingest are `PU_0002`; the *Takes* assignment and the composite publish with the log and inspector rows are `PU_0003`; Bunny as the website's video host is `PU_0004`; YouTube is `PU_0005` after `BO_0252`; the manual kinds are `PU_0006`.

## Decided

User decisions, 2026-09-14, in the material's Decisions section: two extensions (`publishing` bundled, `calliopa-show` individual superseding `calliopa-video`, which is deleted once the new one publishes to homepage); shapes are `publishing`'s concept; the website kind speaks a site-declared index and homepage serves one first; settings keeps the credential half; per-channel copy is fields on the binding; YouTube by the device flow is the first social kind; scope is instance-wide; `CA_0037` is set rejected.

## Open Questions

- [ ] Functional question: whether a channel of the `website` kind carries stages (preview, staging, live — one address and key each, as studio had) or each stage is its own channel. Recommendation: each is its own channel; a stage is a channel with a different address.

- [ ] Functional question: the Channels category's row order and grouping — by kind, or as created.
