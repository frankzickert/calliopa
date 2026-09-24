# Image And Video In Documents

Status: completed

A document can hold a picture and a moving picture, and both can be made from the words in a
block. The making is a new extension, `media`, shipped with the release and deactivateable like
any other, built on one generalized generation function over the provider adapters ported from
the author's own tools (`/home/calliopa/projects/filmset/scripts`, blueprint
`/home/calliopa/projects/world/scripts`). This document shapes the work; it authorizes no
implementation.

## What Is Asked

- A new extension of the core, shipped with it and deactivateable like any other.
- Image and video creation in a document, built on one generalized function over the providers,
  rather than one surface per service.
- A control on the command chip at the bottom of a block, which is how a block is sent today.

## What The System Already Holds

Nothing here is new work. These are the parts this change rests on.

- Bytes are solved. Blob content is content-addressed in Garage behind CCGW, referenced from
  revision content by hash, permanent once referenced, with the upload-then-reference contract,
  the size cap and the staging GC all built and verified ([Binary Block Content](../system/binary-content.md)).
  `PUT /v1/blobs` from the app origin is a measured path, and the reference is a plain JSON object
  at a top-level content property — no primitive, no schema change.
- An extension can already give the agent tools. An `ext.tool` member of an active extension is
  listed in the kernel toolset beside its own; a call posts `{input, run}` to the extension's
  `kernelCallback` route, and the route answers `{result, stage, conclusion}` — the kernel stages
  each statement of `stage` into the run's group as the run ([UI Kernel](../system/ui-kernel.md),
  `BO_0264_007`). The extension gains no write path of its own, and an inactive extension
  contributes no tools.
- An extension can already hold credentials and run long work. Parties with their probes are a
  contribution, and a party roster may be read at runtime for parties that are data rather than
  source, as `publishing` holds its channels
  ([Contribution Contract](../../graph/tree/docs/system/workspace/contribution-contract.md));
  a process with its steps, its cancel, its failure and its right-panel detail is produced by a
  contributed route through `createProcess` and `moveProcess`, as `publishing` produces one per
  publish ([Processes](../../graph/tree/docs/system/workspace/processes.md), `CA_0050`).
- An extension can already teach the agent. `ext.skill` members are read into a run's
  instructions at the run's pin, as `calliopa-refine`'s are.
- Deactivation is already the whole story the user wants: an inactive extension is absent from the
  tree the kernel materializes, so its sections, routes, tools and skills are absent from the
  build with nothing else changing.

## What The System Does Not Hold

- **No media block.** The block types are `document`, `text` and `divider`. A document holding
  bytes is named as future work, not built ([Block Document Model](../../graph/tree/src/extensions/documents/docs/system/documents/block-document-model.md):
  *"Media blocks reference blobs through CCGW's blob routes when a later change introduces them"*).
  A block type this build cannot read is drawn as unsupported content and never dropped.
- **No slot on the block's command chip.** The chip is one border around five controls of
  `documents`' own — the agent menu, the speed, *Point from this block*, *Attach files*, and
  *Send* with its caret — with no contribution point for another extension
  ([Command Mode](../../graph/tree/src/extensions/documents/docs/system/documents/command-mode.md), `BO_0267_012`).
- **No approval gesture for spending.** Every existing external side effect — a publish — is a
  person's press. A tool call is not.

## Decided

* Nothing bills without a press. A paid call is made only by a person's deliberate press, one
  call at a time, as the author's own generation gate in `filmset` requires. An agent may quote a
  cost and propose a generation; it never spends. User decision, 2026-09-21.
* The extension is `media`, its change documents take the prefix `ME`, and it is bundled with the
  release arriving active. User decision, 2026-09-21.
* Higgsfield and OpenArt ship. OpenRouter does not: it is the only provider needing a reference
  the open internet can fetch, and it is the fallback video route its siblings already cover. User
  decision, 2026-09-21; the follow-up is named under Not Here.
* Voice is not in this change. User decision, 2026-09-21; the follow-up is named under Not Here.
* No hidden default provider or model. The chip carries a second dropdown beside the agent menu
  listing every service and model the owner has configured, and the services and their models are
  set in Settings. User decision, 2026-09-21.
* A generated block records what made it — prompt, service, model, job id, cost and time — and the
  record is shown when the reader turns to the block, not drawn in the document at rest. User
  decision, 2026-09-21.

- **The media services accompany the agent as tools it holds. They do not stand in the agent
  selector.** The user asked for this call rather than making it, and may overrule it. The reason
  the cost gate makes decisive: under *nothing bills without a press*, an agent in the selector
  could not generate at all — a run on "Higgsfield" would have to stop and wait for a press, which
  is not a run, and nothing is left for such an agent to be. Held as `ext.tool` members instead,
  the capability costs no kernel change (`BO_0264_007`), its results are ordinary proposed blocks
  the person answers, it composes inside one run — *write the caption and illustrate it* is one
  group, where two agents would be two runs that cannot see each other — and switching the
  extension off takes it away cleanly. Against it: the agent menu is where a person looks for "who
  does this", and a generator will not be found there. The block's own controls answer that, and
  they are the better place for it, because the block's words reach the service unrewritten.
- **Both routes converge on one primitive: a pending generation that a press turns into bytes.**
  The agent's `propose_generation` stages a media block that is not made yet, carrying the prompt,
  the service, the model and the quoted cost; the chip's control stages the same thing from the
  block's own words. Either way the person presses, which spends, runs the generation as a process
  and fills that proposal's candidate with the result. Accepting or rejecting the block is then
  the ordinary answer it already has, so a picture that came out wrong is rejected like any
  proposal and a second press costs a second time. One primitive, one gate, one review.

## How Each Is Solved

Each of the problems this change would otherwise discover during implementation is solved here,
with a mechanism the system already has or with one small general addition.

### The media block

- **`documents` owns the block and its presentation; the `media` extension owns the making.** A
  document that can hold a picture is a document's concern, and a pasted, dropped or uploaded
  image needs the same block as a generated one. The extension declares a dependency on
  `documents` and writes blocks of its types, as `calliopa-show` builds on `publishing`'s shapes;
  nothing ties a content node's type to the extension that writes it, because only `ext.*`
  namespace types are extension-scoped. Switching the generator off then leaves every picture
  drawn exactly as it was, which is the whole reason for the split.
- **Two block types, `image` and `video`, not one `media` type.** They are genuinely different in
  presentation — an image streams straight from the blob route, while a video must be fetched and
  retyped from the reference's own `mediaType` into an object URL before an element is given a
  source, because retrieval serves every object as `application/octet-stream` by the mirror rule
  ([Binary Block Content](../system/binary-content.md)) — and separate names keep the block types
  `documents` owns from reading as the `media` extension's own.
- Each requires `id` and `order`, and permits the blob reference, `alt`, `width`, `height`, and
  `source` — one object the document model stores and never interprets, keyed by the extension
  that wrote it. The reference shape deliberately carries no dimensions, so `width` and `height`
  are the block's own advisory metadata, written when the bytes are uploaded, which is what lets
  the editor reserve layout before they arrive.
- A pending generation is the same block with its reference absent, drawn as a placeholder that
  reserves `width` × `height` and carries the controls contributed for it. No second type and no
  state machine: the bytes are there or they are not.
- The risk this closes: a media block owned by the generator would become unsupported content in
  every document the moment the owner switched the generator off — visible and never dropped, by
  the fixed rule, but no longer a picture.

### The services' credentials, and where generation runs

- **A `media` service in the stack, on the pattern of `hermes`.** Both services keep their
  credential inside a vendor CLI — OpenArt's at `~/.openart/cli-credentials.json`, refreshed by
  `openart account`; Higgsfield's behind `higgsfield`. A vendor runtime the project does not
  control does not belong in the app image, and an extension is graph-hosted code materialized
  into the tree, so it cannot ship a container at all. It belongs in the fixed layer, which is why
  this is a `BO` change and not a change of the extension alone: internal network only, its
  credentials on a named volume and never in the image, no database credentials, reached over HTTP
  by the extension's server route — the way `src/server/agent/hermes.ts` is the only place the
  application knows Hermes's HTTP shape.
- The service runs behind a compose profile, so an install whose owner never signs in to either
  service runs no container for it. Technical decision.
- **The adapters are the existing scripts, ported rather than rewritten.** They already share the
  contract this change needs: one JSON result object, exit `0` ok / `2` bad request / `75` retry
  later, a `retry` block in every result, `--reference @alias=PATH` attachments the prompt names by
  alias, a `--dry-run` that spends nothing and quotes the cost, and `--job-id` / `--resume` to
  collect a job already paid for without paying again. Their tests are offline with the transport
  mocked. The generalized function is that contract; the adapters are its implementations.
- Reference bytes need no public URL: both services take them through their own CLIs, so a
  reference is a file the service writes from the blob and hands over.
- **Signing in follows the agent login broker**, which already solves exactly this problem for
  Codex and Claude: a broker in the container runs the CLI's own login under a pty, the flow is
  started by a request file carrying its id, every state of that flow is stamped with that id, a
  request arriving mid-flow supersedes the one in flight, and the owner completes the device flow
  from Settings ([Hermes](../system/hermes.md), `BO_0261`). The two services are parties
  contributed by the extension with their probes, so Settings needs no table of its own.

### What the chip carries, and the press that spends

- **One addition to the contribution contract: block controls.** An extension contributes a named
  control — a title, an icon from the shell's table, a placement, and a component so a control may
  be a menu as well as a button — and `documents` draws it. Two placements, both needed here:
  `command`, standing in the block's command chip, and `block`, drawn inside a block of a type the
  extension writes. Collisions are refused by name as every registry merge already refuses them,
  and an inactive extension contributes none.
- **The `media` extension contributes two `command` controls**, which together read exactly like
  the agent menu and *Send* beside them:
  - a **model dropdown** beside the agent menu, listing every model of every service the owner has
    configured, grouped by service. It opens on the person's last choice, remembered for that
    person as the speed already is; with no choice yet it opens unchosen.
  - a **make control**, one button, which stages the pending block from the block's own words with
    the model the dropdown names, and refuses in words while no model is chosen.
- **The chosen model decides whether a picture or a moving picture is made.** A service's models
  each declare their kind in the roster, so `seedream_v5_pro` makes an `image` block and
  `Seedance 2.5` a `video` block. There is no image-or-video toggle to keep in step with the model.
- **What the dropdown lists is set in Settings**: the extension's settings section holds each
  service, whether it is signed in, and which of its models are offered, read at runtime through
  the contract's party roster the way `publishing`'s channels are. A model the owner has not
  enabled is not offered anywhere.
- **The gate is a route-kind boundary, not a convention.** The generation route is an ordinary
  human-session route of the extension, permitted to a signed-in person the way the consequences
  read already decides `permitted`. It is not a `kernelCallback` route, and a callback route is the
  only kind a run can reach — the kernel holds the callback secret and strips the header from every
  browser request it forwards. So the agent's tools, which are callback routes, can quote a cost
  and stage a pending block and can reach nothing that spends. Nothing has to remember the rule.
- **The generation is a process** with its steps, its cancel and its failure, started by the press
  and shown on the surfaces the registry already feeds. The process records the service's job id,
  so a failure after the job exists is collected with `--resume` rather than paid for twice. The
  registry's `waiting for input` state stays unused: the person presses in the document, where they
  are already looking, so nothing waits for an answer elsewhere.
- The result fills the same proposal's candidate, and is answered as any proposal is.

### Arriving active with no account

- The extension ships active, so the first person to open a document meets its controls before it
  can do anything. That is a requirement rather than an accident: with no service signed in, the
  model dropdown says so and offers the way to Settings, and the make control refuses in words
  naming the two services — never a failed call, never a blank menu, and never a dead button.
  The agent's tools answer the same way, so a run that reaches for one is told why it cannot.

### What a generated block records

- The block's `source` carries the prompt, the service, the model, the job id, the cost and the
  time. The prompt is what makes a second try possible and the cost is what the person paying
  needs to see.
- It is drawn by the `media` extension through a `block` control, not by `documents`, which never
  interprets `source`: hidden while the reader is not at the block and shown on hover or focus, the
  way the proposal chip already behaves ([The Agent At Work](../../graph/tree/src/extensions/documents/docs/system/documents/agent-at-work.md), `DO_0004_004`),
  with *Try again* in it — a fresh press, a fresh cost.

## Not Here

- **OpenRouter.** Its video route requires an HTTPS URL it can fetch, refuses a `data:` URI, and
  its model requires at least one reference, so the route without one does not exist. CCGW issues
  no presigned or direct-access URL by a fixed constraint, so serving it would mean a reference
  handoff — one blob, an unguessable single-purpose token, a short life, revoked on submit — and an
  instance reachable from the internet, which a self-hosted instance behind NAT is not. Its two
  siblings already cover both image and video. A later change may add it with that handoff.
- **Voice.** `filmset` puts ElevenLabs beside the image and video tools, and the user's ruling
  there is that voice bills but is not under the generation gate. It is a further service, an audio
  block and a second gate rule; it lands cheaply once the block types and the service exist.
- **Paste, drop and upload of a picture.** The block types this change adds are what such a
  surface would need, and `BO_0164` measured the browser upload path, but nothing here builds it.

## Open Functional Questions

- None. Every question this change raised is answered above.

## Closure

- Completed 2026-09-22, walked on the instance: a block's words sent to `gpt_image_2`, the picture
  back as a proposed block the reader saw, 6.5 credits spent on the one press that spends.
- **Two things landed differently from what was decided above**, and the truth is the extension's
  `docs/system/system.md` rather than this file. The pending generation is no longer a shared
  primitive: `propose_generation` went (`BO_0273_038`), because the press that completed a pending
  block moved into the agent menu with `BO_0273_035`, so an agent names a model and the person
  sends the block — one press, always a person's. And a video is not made from words: both
  generators refuse without a picture, so a video send animates the picture above the block and a
  send with nothing to animate is refused before it can spend (`BO_0273_045`).
- Four defects stood between the press and the picture, and **none of them were in the generator**.
  Each was a layer that had never run: the kernel sent the request body chunked, so the service saw
  nothing; the output name was not versioned, which the adapters refuse; no Higgsfield workspace
  was selected, and one could only be chosen during a sign-in that could not know its id; and the
  picture, once made and filled into the block, was drawn by an `<img>` pointing at `/v1/blobs`,
  which nothing on the app origin serves. The last one had three tests over the drawing of a
  picture and not one asked whether anything served the bytes.
- The release notes carry the extension under *Added* and the publishing preview under *Fixed*
  (`calliopa-bootstrap`'s `docs/release-notes/unreleased.md`), and the graph is exported.
