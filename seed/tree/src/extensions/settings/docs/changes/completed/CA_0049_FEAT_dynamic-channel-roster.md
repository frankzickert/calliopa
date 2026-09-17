# CA_0049_FEAT_dynamic-channel-roster

Status: completed

Requested: 2026-09-14, from the analysis in `docs/material/publishing.md` in `calliopa-bootstrap` (Decisions): the user decided that the settings extension keeps the credential half of a channel while the `publishing` extension (`PU_0001`) creates channels as data from its Channels category. A change of `settings`.

## Where This Starts

- **The roster is the registry's.** `listConnections` walks the party descriptors the present extensions contribute — `honcho`, `hermes`, `codex` and `claude-code` from `settings`, `homepage` and `bunny` from `calliopa-video` — and lays each descriptor's label, purpose, channel-ness and fields on the kernel's record. A party nothing contributes keeps its kernel record unshown. `isChannelParty` in the shell's registry answers from the same roster.

- **The Channels section** renders one row per contributed channel descriptor below Connections, each with its configuration fields, its write-only key, and *Save*, *Test* and *Clear*.

- **The kernel's secret store takes any party id** (`PUT /__kernel/secrets/parties/<party>`), so a party record under `publishing:<channelId>` needs nothing from the kernel.

## Intent

* **One row per channel node.** The Channels section lists, beside the registry's static channel parties, one row for every `channel` node `publishing` holds: the party id `publishing:<channelId>`, the kind's descriptor instantiated with the channel's title as its label and the kind's purpose, fields and probe. *Save*, *Test* and *Clear* work as they do for a static party.

* **The roster is read, not contributed.** `publishing` answers the dynamic descriptors through a reader `settings` calls; the registry's build-time roster is unchanged, and an instance without `publishing` lists no dynamic rows.

* **A retired channel drops its row** and the kernel's record with it; a channel that has published anything cannot be deleted, which `publishing` owns.

* **A sign-in row for an `oauth` party** once `BO_0252` lands: the device code and verification URL in the row, the state moving to `verified` when the kernel has the token. Not in this change's first cut.

## The Shape

- `settings` gains a server contract point: a function `publishing` registers, or a route under `/api/x/publishing/parties` that `settings`' reader calls, answering `PartyDescriptor[]` with `kind: "channel"` and ids under `publishing:`. `listConnections` merges them after the static roster.

- `isChannelParty` consults the merged roster, so a brokered publish to a dynamic channel passes the same check a static one does.

- The row's label is the channel's title, its kind shown beside it, so two YouTube channels read as two rows.

- Verification: the parties behaviour test with a `publishing` channel node present and absent; the settings browser test with a dynamic row saved, tested against a stub, cleared, and gone once the channel is retired.

Settle the contract mechanism as a route publishing exposes and settings' reader calls — not a registered function — before building the listConnections merge and its behaviour test, so the merge is exercised against the same present/absent boundary the roster's read model requires.

## Open Questions

- [ ] Functional question: whether the static `homepage` and `bunny` parties `calliopa-video` contributes stay listed while `calliopa-video` is inactive, or the section shows only what the present tree contributes (today: only the present tree).
