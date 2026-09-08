# CA_0033_FEAT_production-content-model

Status: completed

Requested: 2026-09-04

## Intent

Calliopa produces the assets an episode is made of and then publishes them: the
episode itself to `../homepage`, and the assets inside it to TikTok, YouTube,
Instagram, Threads, and the rest. Today Calliopa's only domain model is a generic
document of ordered blocks ([Block Document Model](../../system/documents/block-document-model.md)),
which is the prose half of that and nothing else.

This change document shapes the content model that sits over it. It is a model,
not a slice: it will be split before implementation.

## The Question It Answers

`../homepage/docs/changes/HP_0003_FEAT_publishing-api.md` already fixes a content
model — the episode as canonical unit, assets slotted by narrative role, the
required teaser triple, serials that are ordered or unordered. It is tempting to
adopt that vocabulary here so the two repos agree.

That is the wrong move, and naming why is the load-bearing decision of this
change.

* Homepage's model is the shape of **one destination's pages**. Its four roles —
  scene, fragment, still, field note — exist so a visitor learns the episode page
  once and can then read any episode. That is a reading concern.
* Calliopa's model is the shape of **what the author makes**. The production
  inventory is larger and differently cut: complete episode, main videos,
  teasers, crossovers, bloopers, cinematic images, statement graphics
  (`../calliopa-video/docs/publishing/publishing-approach.md`, §8) — roughly
  16–20 assets an episode, of which the homepage page shows a subset.
* If Calliopa adopts homepage's vocabulary, every other destination either
  distorts it or needs a parallel model beside it. A crossover video is not a
  scene, a fragment, a still, or a field note, and it is still a real thing the
  author made and wants on TikTok.

* So: **Calliopa holds production truth, and every destination — homepage
  included — is a projection of it.** Homepage is a destination, not the model.

## Settled Decisions

These were decided by the user on 2026-09-04 and are not open.

* Calliopa owns all three layers below. `../calliopa-video` stays a creative and
  documentation home; its `publishing-approach.md` is the adopted source of this
  model rather than the specification of a separate service. The bytes, the
  assets, and the log live in one place, so a log entry always names content it
  can resolve and there is no second content contract between repos.
* An episode is its own node type that contains documents and assets. It is not a
  document kind, so [Block Document Model](../../system/documents/block-document-model.md)
  stays purely about prose and gains no non-block children. The workspace library
  gains an `Episodes` category beside `Documents`.
* Media arrives two ways and both are permanent. Calliopa ingests externally
  produced assets today because no creation flow exists here yet; the goal is that
  everything is produced inside Calliopa; and external upload always remains the
  fallback. The asset model therefore never assumes Calliopa authored the bytes,
  and ingest is not scaffolding to be removed.
* Every publication is human-approved. The system prepares and a person releases,
  for every destination. Automation is a later decision that a working log and a
  proven adapter can argue for; nothing is unattended at the start.
* No distribution pool ships in the first cut. A person opens an episode, chooses
  an asset, picks a destination, and releases. The layer keeps its place in the
  model and stays empty until a change fills it.
* Bytes are kept when the publication log references them. Anything a publication
  actually used is permanent; a superseded rendition nothing published may be
  swept.
* Outbound platform credentials are deferred. Bunny is an API key, which the
  `apiKey` connection kind in [Settings](../../../src/extensions/settings/docs/system/connections.md) already holds, and
  the OAuth question arrives with the first social adapter that knows what it
  needs.
* Nothing reads Calliopa's content from outside. Every destination is write-only
  from here, homepage included, and homepage owns its own read side for its pages
  and machine layer. There is no public read contract to design or version.

## Three Layers

`../calliopa-video/docs/publishing/publishing-approach.md` §27 already separates
these, and the separation is adopted here rather than reinvented.

* **Work** — what exists. Episode, serial, asset, document. This is the only
  layer that holds meaning and media.
* **Distribution** — what may go where and when. Destination eligibility,
  windows, pre-release permission, expiry, priority, frequency budgets. It ships
  empty: a person is the selector in the first cut, and the layer is named so
  what fills it later has somewhere to go that is not the asset.
* **Publication log** — what actually happened. Append-only, one record per
  attempt and per success, carrying the platform's returned id.

* The layers stay separate. An asset never carries a `publishedToTikTok` flag,
  because that is the log's answer, and never carries a destination list, because
  that is the distribution layer's.
- Producing an asset creates no obligation to publish it. The inventory is
  allowed to go unused, and nothing counts an episode's unpublished assets
  against it.

## An Asset Has Three Independent Axes

The single most common way this model goes wrong is collapsing two of these into
one field.

* **Production role** — what the author made it as: `complete-episode`,
  `main-video`, `teaser`, `crossover`, `blooper`, `cinematic-image`,
  `statement`, `image-teaser`, `field-note`. This is Calliopa's vocabulary
  because it is what the process actually produces, and every destination mapping
  reads from it.
* **Medium and machine facts** — video, image, or prose, plus duration,
  dimensions, transcript, alt text, and synthetic-media disclosure. These are
  gathered once at production time. Gathering them per destination means
  gathering them once per platform, and homepage refuses a scene with no
  transcript while TikTok wants a caption.
* **Rendition** — one asset, several exports. The 16:9, 9:16, and 1:1 crops of a
  teaser image are one asset with three renditions, not three assets.

- Aspect ratio is a rendition fact and never a role. Homepage says the same for
  its own surfaces; here it is what lets one main video reach a vertical
  destination and a wide one without being modelled twice.
- A rendition records how it came to exist — ingested from outside or produced
  here — because both paths are permanent and a destination adapter must not care
  which one a file took. The first cut has only the ingest path; the production
  path is added beside it rather than in place of it.
- Modelling renditions answers homepage's open question about teaser alt text
  directly: alt text belongs to the asset, so three crops of one picture share
  one description, and three genuinely different pictures are three assets.
- There are no clean and branded classes. Calliopa produces the intended final
  version, ident and wordmark included, as part of the creative work.

## Prose Needs No New Primitive

* An asset whose medium is prose **is a document** in the existing block model.
  Field notes, scripts, statements, premises, and teaser texts are ordered blocks
  with roles and marked runs, which is exactly what the editor already writes.
- This is why homepage's field-note contract already matches: HP_0003 accepts
  precisely Calliopa's committed vocabulary, so nothing degrades between the two
  repos and the alignment costs nothing to maintain.
- Text that travels — the premise, the teaser text, a per-platform caption or
  hook — is authored content and lives here as prose, not as a string handed to a
  publish call. A caption invented at publish time exists only in a log
  afterwards and cannot be revised, reused, or reviewed.

## Media Bytes

* Calliopa holds the bytes. Every asset — image, video, and whatever medium a
  later one turns out to be — is stored locally in Garage for the whole of the
  work process, and the object store is the one place production media lives.
* Bunny Stream is not storage and is not Calliopa's video host. It is the video
  target of exactly one destination: the homepage adapter uploads a published
  video to Bunny and hands homepage the id it gets back, because homepage stores
  no video bytes itself. Nothing else in Calliopa knows Bunny exists.
- A social destination takes the file from Garage directly, so Bunny is not in
  that path at all. Routing every platform through it would make one
  destination's video host a dependency of all of them.
- Objects are content-addressed: the id is the content's hash, and re-exporting a
  cut is a new id rather than a mutation of the old one. That is what lets a
  publication log entry name something that cannot have changed underneath it.
- Holding video is a volume commitment rather than a free choice of store. At
  three episodes a week and 16–20 assets each, with renditions multiplying every
  one of them, Garage grows continuously, and it grows faster once production
  moves inside and intermediate exports land here too.
* What bounds it is the publication log. An object any log entry names is
  permanent and is never swept, because a publication must always be able to say
  what it published. A rendition is sweepable only when a newer one supersedes it
  **and** no log entry names it.
- The sweep is a deliberate command that reports what it removed, the way
  `pnpm run verify:clean` is, rather than a background process. Deleting bytes is
  the one operation here that no undo covers, so it does not happen while nobody
  is looking.
- [Application Foundation](../../system/foundation/runtime.md) and
  [System](../../system/system.md) currently say Garage holds image and file bytes.
  Video is a file and the fixed line already covers it, but the wording is worth
  widening in the change that first writes a video object, so nothing reads it as
  a restriction.
- [Block Document Model](../../system/documents/block-document-model.md) already reserves
  image, video, and file blocks as future vocabulary entries that reference
  Garage objects. An asset is not a block, but a document that embeds one refers
  to the same object rather than to a copy.

## Episode And Serial

* The episode is the atomic unit here as well as on homepage — the same word for
  the same boundary, which is what makes a projection a projection rather than a
  translation.
* `episode` is its own semantic node type in the graph vocabulary, containing
  documents and assets. It is not a document kind, so the block model's own
  vocabulary is untouched.
- An episode is held together by its own relation rather than by `contains`. The
  block model says containment must not be widened to serve a non-structural
  purpose, and episode membership is exactly that. Keeping them separate leaves
  the single-active-parent tree the editor depends on untouched, and lets the
  cardinality of episode membership be settled either way without reaching into
  block containment.
- An episode holds its assets, its prose documents — premise, teaser text,
  captions, field notes — its characters, and its serial membership.
- The workspace library gains an `Episodes` category beside `Documents`, and a
  tab opens an episode rather than an editor. A document still stands on its own:
  world notes and drafts belong to no episode and stay in `Documents`.
- Serial membership, `ordered`, and position are authoring decisions, so they
  live here and are published outward. Homepage says `ordered` is set by the
  author; if Calliopa did not hold it, homepage would need a second author
  surface for it.

## Destination Mapping Is A Per-Destination Rule

* Each destination owns a stated mapping from production roles and renditions
  onto what that destination accepts. Homepage's adapter maps roles onto its four
  narrative slots and supplies the teaser triple; a vertical video destination
  takes 9:16 renditions of main videos, teasers, and crossovers.
* The mapping lives with the destination, not on the asset. When homepage adds a
  role, one mapping changes and no stored content moves.
- A destination may own a transport of its own as well as a mapping. Homepage's
  includes the Bunny upload above; a social one is the platform's publishing API.
- Homepage's contract is discovered over HTTP as a published document rather than
  imported as a package, which HP_0003 fixes from its side. Calliopa keeps its
  own model of that contract and pre-validates; homepage's boundary is the truth.
- Homepage ships first and Calliopa adapts. Nothing here blocks on it and nothing
  there waits on this.

## Agent Fit

- The agent layer is proposal-only: it stages content and a human answers item by
  item ([Calliopa Agent](../../system/agent/calliopa-agent.md)). That is the right shape
  for asset drafting, caption writing, and Reddit preparation, all of which the
  publishing approach already wants a human to approve.
- Publication is a human act. An agent may prepare a caption, a Reddit framing,
  or a selection, and a person releases it; nothing an agent produces reaches a
  platform on its own. That is the proposal model applied outward rather than a
  second rule.

## Functional Questions

- [ ] Are collections part of this model or a later change?
  `../calliopa-video/docs/publishing/publishing-approach.md` §14 makes them
  first-class content — monthly anthology, weekly edition, thematic collection,
  multi-episode visual collection — and §35 has them participating in
  distribution like anything else. Nothing here holds them. They are a second
  container beside the episode, and whether they are that or a serial-shaped
  grouping decides whether the episode is the only thing assets hang from.
- [ ] Does an asset belong to exactly one episode? A crossover connects parts of
  the universe, and §8 lists collection-specific media as its own asset class —
  material produced for a collection rather than for any episode. If either can
  belong to none or several, containment here is not the single-parent tree the
  block model is.

## Likely Slices

This change built the work layer and specified the publishing one.

**Delivered and verified.** The graph stores episodes holding assets; assets
carrying a production role, a medium, its machine facts, an optional label and any
number of categories; renditions naming their bytes by their SHA-256; prose bodies
as documents; characters with a portrait and a description; and serials with their
positions, their opening prose and their cover still. An episode carries its own
premise and teaser text and names the asset that stands for it. A file is ingested
into Garage with its facts read off it rather than typed. The library lists
episodes beside documents and an episode opens in its own view.

**Specified and not built.** Everything that leaves Calliopa. The model is in
[Publishing](../../../src/extensions/calliopa-video/docs/system/publishing/publishing.md) and its tasks are claimed from
[CA_0037](../../../src/extensions/calliopa-video/docs/changes/CA_0037_FEAT_publishing.md), which is where that work continues. The
tasks keep their `CA_0033` identifiers so the reasoning that produced them stays
findable.

**Left open elsewhere.** `CA_0033_015` (collections) and `CA_0033_026` (surfacing
the episode's content on its view) are open in
[Episodes And Assets](../../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md) and belong to neither this
change nor CA_0037. Each needs its own change when it is wanted.

## Likely Slices

The work layer is built and verified. What remains is the publishing half, which
waits on one real destination existing: `../homepage`'s publishing API is still
`Status: idea` in that repository, and an adapter against a contract nothing
serves would be a placeholder.

The model and its enumerated work were transferred into
[Episodes And Assets](../../../src/extensions/calliopa-video/docs/system/production/episodes-and-assets.md) and
[Publishing](../../../src/extensions/calliopa-video/docs/system/publishing/publishing.md) on 2026-09-04, with `CA_0033_001`-`CA_0033_013`
open across those two, [Workspace Shell](../../system/workspace/frame.md), and
[Settings](../../../src/extensions/settings/docs/system/connections.md). Those documents are the truth; the list below is
the reading order and nothing is claimed here.

- The `episode` node type, its assets, and the prose documents it contains.
- Renditions and machine facts, with the ingest path that puts bytes in Garage
  and reads what it can off the file it is given.
- Serials and membership.
- The homepage destination adapter, its published-contract client, and the Bunny
  upload a published video passes through.
- The publication log, and the human release that writes an entry into it.
- A social destination adapter, once one platform is chosen to go first.

These are named now and belong to no slice yet, so nothing quietly assumes them:

- The in-Calliopa production flow that makes assets rather than receiving them,
  added beside the ingest path.
- The distribution layer's hard eligibility rules, when a person selecting by
  hand stops being enough.
- The byte sweep over superseded renditions the log does not name.

## Not In This Change

- Subscriber identity, entitlement, and the subscriber-only layer, which
  `../calliopa-video/docs/publishing/publishing-approach.md` places on the website
  rather than in the production workspace.
- Performance analytics, which the publishing approach keeps separate from all
  three layers.
- Scoring, priority tiers, bounded aging, and destination frequency budgets. They
  describe a selector this cut does not have.
- Any unattended publication, and any read API over Calliopa's content.
- Homepage's page design, catalogue, and machine layer, which are its changes.
