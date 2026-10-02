# Media

## Purpose

- `media` makes a picture or a moving picture from the words in a block. It owns every surface of
  that — the model dropdown and the make control on a block's command chip, the two services in
  Settings, the generation route and its process, the tools an agent may hold, and what a generated
  block says about its own making — and nothing else.
- What it does not own: the blocks. `image` and `video` are `documents`' block types, so a picture
  stays a picture when this extension is switched off ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#pictures-and-moving-pictures)).
  And it does not generate: the generators and the vendor credentials are the stack's `media`
  service, which is fixed layer because an extension cannot ship a container
  (`calliopa-bootstrap`'s `docs/system/media-service.md`).
- Change documents of this extension take the prefix `ME`, and live in `docs/changes/` beside this
  file under the live-line protocol, as every extension's do.

## Fixed

* Nothing bills without a press, and *Send* is the press. A run a person's *Send* started may make
  one paid generation, and a second needs another *Send*; a run no person started never spends.
  User decisions, 2026-09-21 (`calliopa-bootstrap`'s `BO_0273`), narrowed on 2026-09-30
  (`BO_0312_Q6`).
* The gate is the kernel's, not a convention: `media.generate` is an `ext.tool` marked
  `spends: true`, which the kernel admits once in a run a person's command started and in no other
  run, refusing before this extension's route is reached (`calliopa-bootstrap`'s `BO_0312_004`).
* No hidden default provider or model. A picture or a video is made under a profile the person
  writes: the profile's type says which, and its saved backend which service makes it
  (`calliopa-bootstrap`'s `BO_0320_Q4`, `BO_0320_Q5`); the services and the models they offer are
  set in Settings. The senders that stood in the agent menu are gone. User decisions, 2026-09-21,
  2026-09-30 (`BO_0308_Q10`) and 2026-10-01 (video as a profile type).
* The profile's type decides whether a picture or a moving picture is made — an image or a video
  profile; no *Format* is read (Generation Needs No Format).
* A generated block records what made it — prompt, service, model, job id, cost and time — and the
  record is shown when the reader turns to the block, not drawn in the document at rest. User
  decision, 2026-09-21.

## Open Work

Transferred from `calliopa-bootstrap`'s `BO_0273` on 2026-09-21, when this extension was created.
Each line is claimable on its own; `BO_0273_015` and `BO_0273_016` need the contributed block
controls (`ui.shell`, `BO_0273_007`, `BO_0273_009`) and `BO_0273_017` needs the block types
(`documents`, `BO_0273_008`).

- The two services stand in Settings (`BO_0273_014`) in this extension's own `generators` section,
  and nowhere else: the row is a label, a standing and the way in, and the credential belongs to
  the vendor's own home.
* This extension contributes **no party**, and that is a rule rather than an omission
  (`BO_0273_032`). A `credential: "status"` party is an *agent runtime* to the settings extension:
  `withStatus` reads its state from what the agent reported, which the hermes broker writes for
  `codex` and `claude-code` alone. The generators were first contributed that way, copying the
  agent runtimes without checking what a `status` party means, and both rows read *The agent has
  not reported on this runtime* whatever their real state. Found by the user on 2026-09-21.
  Proven in `no-parties.test.ts`.
- The section reads `GET /api/x/media/services`, which reads the roster through the kernel
  (`/__kernel/media/services`), and draws per service: whether it is signed in or the login to run,
  every model it offers with what that model makes, and, for a set the service marks open, that a
  job type may be named when one is sent. A service that is not answering is said in words rather
  than rendering nothing.
- Signing in touches no network. `POST /api/x/media/sign-in` writes the broker's request over the
  shared volume with a fresh id, `GET /api/x/media/sign-in?id=` follows that flow and no other —
  a state carrying another id is not this row's, and a flow that superseded it says so through
  `previous`, which is where a row following the older one learns its outcome — and
  `POST /api/x/media/sign-in/redirect` hands back the `code` and `state` for a Higgsfield login,
  written where the broker reads it and never answered back, since it is a one-time code.
- The row says what each vendor needs before it can fail: Higgsfield submits into a workspace and
  refuses a generation until one is chosen, and its programmatic generation needs a paid plan — a
  free plan refuses every submission before a job exists and nothing is spent. Both are said on the
  row, not discovered through a refused generation.
- **A workspace is picked after signing in, from the account's own** (`BO_0273_042`, found by the
  user on 2026-09-22). Its id is only knowable once the login reveals it, so the field that asked
  for one before the flow could only ever serve someone who already knew it, and an owner who left
  it empty had no way to choose at all short of signing in again — every generation failing with
  *No workspace selected* and nothing saying where to fix it. The roster carries the account's
  workspaces with their plan and credits, asked only of a service that has them and only when it
  answers; `POST /api/x/media/workspace` takes the one picked, and the row shows the choice
  unselected until the owner makes it. The login request carries no workspace any more, so there is
  one way to choose one.
- The redirect is a paste for OpenArt and usually invisible for Higgsfield, and the difference is
  the vendors' (`BO_0273_033`, found by the user on 2026-09-21). Higgsfield's login takes `--port`,
  so the broker fixes it at the one the service publishes on `127.0.0.1` and a browser on this host
  follows the redirect straight in. **OpenArt takes no port and picks a fresh ephemeral one for
  every flow** — observed choosing `37167` — so it can be neither published nor guessed, and a
  browser outside the container reaches its own loopback rather than the service's. Its login can
  only ever be finished by pasting back the `code` and `state`.
- So the broker reads the loopback out of the authorize URL the CLI printed (`redirect_uri`, which
  both vendors carry) rather than assuming its own, waits in `awaiting_redirect` for every vendor
  rather than Higgsfield alone, and hands the redirect to whatever port the CLI chose. Before this
  an OpenArt flow published no `awaiting_redirect` at all, so the fields to paste into never
  appeared and the login could not be finished.
- The way in comes first on each row (`BO_0273_033`): the standing, then the Sign in button, then
  the flow's URL and paste fields beside them, and the workspace picker once there is an account to
  read it from. Which models are offered is
  the owner's configuration and folds away below, because it was above the button and pushed it off
  the bottom of the screen.
- Proven in `server/media.test.ts`: the request written with its own id and carrying no workspace,
  the choice asked of the kernel that holds the bearer, a refusal carried back in the service's own
  words, no state before a flow, the flow answered by its id, another flow's state not answered
  as this one's, a superseded flow's outcome read through `previous`, and the redirect written
  where the broker reads it. The tree typechecks, the unit project passes for this extension, the
  tree builds, and `kernel toolchain absence` on a release-shaped tree builds without `media`.
- The owner chooses which models are offered (`BO_0273_029`). The service answers everything it
  can validate; the owner says which of those are worth offering, and the dropdown lists that set
  alone (`GET /api/x/media/services?offered=1`) while Settings lists the whole roster, because that
  is what the choice is made from. The record is the extension's settings, which the kernel keeps
  and only the owner may write — so the set is the instance's rather than a person's, and nothing
  has to ask who is looking.
* An empty set means everything. A fresh instance offers what the services answer rather than
  nothing, so an owner who has never chosen has not accidentally turned the extension off — and
  the boxes read as ticked until one is unticked, because an unticked box on a fresh instance
  would be a lie.
- A Higgsfield video job type is offered by name, since that set is open: the owner types one and
  it joins the dropdown with the open set's kind. A name the service already answers is not
  offered twice, and a name given for a service whose sets are all closed is not offered at all.
- Proven in `server/offered.test.ts`: everything offered when nothing is chosen, the owner's set
  alone when there is one, a named job type joining with the open set's kind, no duplicate for a
  name the service answers, nothing named for a closed set, what is written kept clean of blanks
  and repeats, and an absent or malformed record read as nothing chosen.
* The backend a generation uses is the profile's, saved with it, never chosen by a run's words
  (`calliopa-bootstrap`'s `BO_0320_Q4`); the model is the backend's offered default for the kind
  unless the run names another offered one. User decision, 2026-09-30.
* A model is called what the owner calls it, and wears the icon they gave it. The extension names
  the models it knows and that is the default; Settings can rename any of them and choose its
  icon, which is the only way a job type the owner typed themselves is called anything but its raw
  id. An empty field is not a name: it gives the model the extension's own back. User decision,
  2026-09-22 (`BO_0273_037`), after the declared table alone left nothing to configure.
- The naming lives in the offered record beside what is offered, keyed `<service>:<model>`, so it
  is the instance's and the kernel keeps it. An icon outside the shell's table is ignored rather
  than taken, because the contract refuses an unknown icon by name and one bad entry would take
  the whole roster down.
- The table itself is `lib/models.ts`, server-free on purpose: the settings view reads it, and a view reaching into a server module dragged the request context into the
  browser bundle — which is what the contract's two halves exist to stop, and what the build said
  when it did.
- Proven in `server/propose.test.ts`: staged into its own group and after the prompt, no reference
  written, the prompt trimmed onto both the words and the record, the declared kind and never a
  third value, a fresh group per generation, and refusals without a person, without a model and
  without words that write nothing. The staging was shown to bite by taking the branch scope away.
* **Send is the press that spends.** A block is sent with an image or a video profile the way any
  command is sent: one gesture, no confirmation, and what it cost is reported after, in the run's
  answer and on the picture's own panel. User decision, 2026-09-22, carried over to the profile by
  `calliopa-bootstrap`'s `BO_0312`.
- The press that spends (`BO_0273_017b`). `POST /api/x/media/make` does four things in an order
  that is what makes a failure survivable: it stages the picture as a pending block, so there is
  something to look at and to reject; it opens a process, so a generation that fails leaves
  something the reader can watch fail rather than a button that did nothing; it starts the job and
  **puts the job id on the process before anything after it can fail**, since that id is the only
  thing that collects a paid job without paying again; and only then does it follow the job.
- The prompt is the block's own words, read on the server for the quote and for the making alike,
  never taken from the caller: the picture is made from what the document says.
- A job that does not finish says what the generator said (`BO_0273_041`), with the job id kept in
  the words because that is what collects a paid job again. The first real sends failed with a
  message the job record held and the process did not show — twice, at two different points — so
  the reason had to be dug out of the service's volume both times.
- A generator's refusal reaches the process in its own words (`BO_0273_040`). It used to be
  thrown away and reported as *the generator did not take the job*, which said nothing and hid a
  body the service had explained perfectly well — the first real send failed that way and the
  reason had to be found in the service's log.
- Following happens after the answer is sent, as an agent run's does — handing over the goal is
  quick and the making is not, so the reader watches the process rather than a held request. The
  follower asks before it waits, since a job may already be done. When the bytes arrive they are
  uploaded through CCGW and `fillMediaBlock` fills the block already standing, inside the
  generation's own group, on that block's own revision.
- The open document is told at both ends (`CA_0063_004`): the shell shows the pending block when
  the process is answered and the picture when the process ends, through the same signal a run's
  end raises — `ui.shell`'s [Processes](../../../../docs/system/workspace/processes.md). Nothing
  here changes for it: the process names the document as its item and completes on the fill.
- **A picture rejected while it was being made is never forced back.** If the pending block has
  gone by the time the bytes arrive, the process completes and nothing is written; the bytes stay
  in the store referenced by nothing and the staging GC takes them.
- `CommandControls` (`views/command/controls.tsx`) is what the chip draws: the model dropdown and
  the press, in one component because a place takes one. The press shows the cost and only then
  offers to make it, and refuses in words while no model is chosen.
- Proven in `server/make.test.ts`: the order of propose, process and job id; the prompt read from
  the block; refusals without a person, a model or words that ask the generator for nothing; a
  generator that will not take the job failing the process in words while the proposal still
  stands; the bytes stored and the standing block filled in its own group on its own revision; a
  rejected picture forcing nothing back; and a job that does not finish keeping its id in the
  words. Three guards were shown to bite by removing the code behind them. The tree typechecks,
  builds, and this extension's suites pass (31 tests).
- What an agent may reach (`BO_0273_018`): one tool, `media.quote_generation`, answered by a
  `kernelCallback` route — the only kind a run can reach,
  since the kernel holds that secret and strips the header from every browser request. **Nothing
  that bills is behind one.** The press that spends is an ordinary human-session route a run
  cannot call at all, so the boundary is the route's kind and not a rule a skill has to remember.
- Quoting needs no session, and that is not an oversight: a quote is the adapters' dry run, which
  spends nothing. Proposing answers with **statements**, which the kernel stages into the run's
  group as the run, because nothing an extension does may write on a run's behalf; the statements
  are `documents`' to compose, since the block type is its own (`composeMediaInsert`).
- An agent proposes the same pending block a person's press would, from the block's own words, and
  records who asked and which run in `source`. It may give words of its own, and the skill says to
  do that only when the block's would make a poor picture.
- `media.pictures` is the skill: offer a picture where a document would be clearer for one and
  never make it yourself; stop and say so when no generator is signed in; quote first and put the
  figure in the answer, so the person decides with the price in front of them; let the model decide
  whether a picture or a moving picture is made; and propose one at a time, because a run that
  stages six pictures has decided six times that someone should pay.
- An inactive extension contributes neither tool nor skill, as it contributes no route: the toolset
  lists the members of active extensions alone.
- Proven in `server/tools.test.ts`: the quote reaching the quote route and nothing else with nothing
  staged; the proposal answering statements and asking the service for nothing; the block's own
  words used and who asked recorded; given words taken only when given; refusals for a wordless
  block and for a missing service or model that stage nothing; and the model's kind followed.
- What a picture says about its own making (`BO_0273_019`). `SourcePanel` is the `below` place on
  a media block: hidden while the reader is not at the block and shown when they turn to it, the
  way a proposal's chip behaves, so the reading surface shows no machinery of its own. **It is read
  only when it is shown**, through `GET /api/x/media/source`, so a document full of pictures costs
  nothing to read. It names the service and model, the cost, when, and the words it was made from,
  all out of `source` — the record this extension wrote and the document model never interprets.
- *Try again* is a fresh press and a fresh cost, and says so on the control. `POST /api/x/media/remake`
  reads the block's own record for the service, the model and the words, opens its own process, and
  fills the same block from its own group: a second picture is a second proposal to answer.
- Arriving with no account (`BO_0273_020`). The extension ships active, so the first person to
  open a document meets its controls before it can do anything, and what they must never meet is a
  failed call or a dead button. The settings section names each service with the login to run; the
  model dropdown says no generator is signed in rather than standing empty; the make control
  refuses in words; and **a run is told what to say** — both tools refuse with *sign in to
  Higgsfield or OpenArt in Settings, with your own subscription* before they reach for anything,
  which the skill already tells it to pass on.

## What A Model Takes

`calliopa-bootstrap`'s `BO_0279`, drafted by the user on 2026-09-22. The service's half is that
repository's `docs/system/media-service.md`; the contract's is `ui.shell`'s
[Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md).

* The vendor is asked when the owner sets a model up, not when the menu opens. Both vendors
  describe their models at runtime, and Settings is already where the owner says which models are
  offered and what to call them — so that is where the answer is captured and kept. Nothing calls a
  vendor on the path of a press. User decision, 2026-09-22.
- **Offering a model captures what it takes** (`BO_0279_011`). The Generators section asks the
  service what each offered model takes and keeps the answer in the offered record beside the names
  and icons; the row shows the axes and their values, so an owner sees what a model will offer
  before anyone sends to it.
- **A model whose axes could not be read is offered anyway** (`BO_0279_014`), with the row reading
  *options not read* and carrying *Ask again*. It stands in the chip with no controls, and a press
  sends no options, so the vendor applies its own defaults — the ordinary unchosen case rather
  than a special one.
- **The axes re-ask themselves** (`BO_0279_015`): opening the Generators section refreshes every
  offered model, and so does a change to what is offered, since a model just offered has nothing
  captured yet. A description is a few hundred milliseconds and both CLIs cache on disk. Nothing
  read leaves what was read before rather than forgetting it, so a vendor down for a minute does
  not empty a chip.
- **A refusal naming an axis re-asks the vendor** (`BO_0279_017`). The adapters refuse in the
  vendor's own vocabulary — *"gpt_image_2 takes aspect_ratio [...]"* — so a refusal that mentions
  an axis this send carried a value for is evidence that what was captured and what the vendor
  takes have parted. The send re-asks for that model and tells the reader the choices are up to
  date now, rather than leaving them to press the same thing again. The axis is matched in both
  spellings, because the service's name is hyphenated and the vendor's is not; a refusal about a
  workspace, a plan or an empty prompt says nothing about the captured set and is left alone.
- A run may pass a model's axes as `options` to `media.generate`; a value the model does not offer
  is the generator's to refuse, in its own words.
- **What a generation would cost** is the run's `quote_generation` (`BO_0279_013`): the adapters'
  own dry run for the model and its axes, which spends nothing; the skill quotes before it
  generates and says the amount. The credits are given in the vendor's own words.

- **A video animates the picture above it** (`BO_0273_045`, user decision 2026-09-22). Neither
  video generator makes a clip from words alone — both refuse with *at least one image, video, or
  audio reference is required* — so a send to a video model takes the nearest picture above the
  block as the clip's first frame, under the adapters' own `--start-image`, and the block's words
  say what should happen in it. `media.generate` under a video profile does the same
  (`calliopa-bootstrap`'s `BO_0312`): with nothing above the block to animate it refuses in words
  that say what to do about it, **before the block is proposed and before anything is spent**. A picture that is proposed but not yet
  made does not count, because it has no bytes to open on.

- **Walked on the instance, 2026-09-22** (`BO_0273_021`), which is the only step that spends and
  the only one that could confirm any of the rest. Signed in to Higgsfield with the owner's own
  subscription and a workspace picked; a block's words sent to `gpt_image_2`; the process opened,
  carried its job id, and completed; the picture came back as a proposed block in the document and
  the reader saw it. It cost 6.5 credits, quoted free beforehand by the same path. Four defects
  stood between the press and the picture and none of them were in the generator — each was a layer
  that had never run: the kernel sent the body chunked, the output name was not versioned, no
  workspace was selected, and the drawn `<img>` pointed at a route nothing served.
- What the walk has not covered: a video, which needs a picture to animate and a paid clip of its
  own; *Try again* on a made picture; and the source panel's words. Each is a press away and none
  is blocked.

## Generation Is An Agent's Tool

Under `calliopa-bootstrap`'s `BO_0312` (part 4 of `BO_0308`), landed 2026-10-01: image and video
generation are made through a profile the person writes, by the agent's tool, and the senders
left the agent menu (`BO_0308_Q10`). `BO_0320`'s session built the tool for images with its Codex
backend; `BO_0312` added video and removed the senders.

* A run a person's Send started may make one paid generation, and a second needs another Send; a
  run no person started never spends. This narrows *Nothing bills without a press* (the Send is the
  press) and replaces *An agent names a model; the person sends the block* (`BO_0273_038`). User
  decision, 2026-09-30 (`BO_0312_Q6`). The gate stays in the fixed layer rather than in a
  convention: the kernel admits one call of a `spends` tool per Send (`ui-kernel.md`
  `BO_0312_004`).
* A video is made under a video profile, whose backend is Higgsfield or OpenArt, never Codex. User
  decision, 2026-10-01.
- The senders are gone (`BO_0312_040`, landed 2026-10-01): `mediaSenders`, `sendToModel`,
  `quoteToModel` and `server/senders.ts` with its tests, and with them the shell's sender contract
  (`ui.shell`'s `BO_0312_061`), so the agent menu lists agents alone. The Generators section in
  Settings, the offered models, their names, icons and axes stay, since the tool chooses from them.
- `media.generate` (`BO_0312_041`, landed 2026-10-01; `server/tools.ts`), an `ext.tool` with
  `spends: true` answered on the `kernelCallback` route `kernel/tools/generate`, takes
  `{block, model?, options?, words?}` and the run's profile: its `profileType`, image or video, and
  its saved backend (`imageBackend`, handed by the kernel, `BO_0320_005`). It refuses in words,
  before anything is composed or spent: no image or video profile with a backend fit for its kind
  (Codex makes pictures only, and is refused for now, `BO_0320_014`); no block of this Send; a
  backend signed out; a model not offered for the kind; a block with no words; and, for a
  video, no picture above the block to animate, or its bytes unreadable. It then composes the
  pending picture or video after the block, starts the one paid job — a video with the picture
  above as its start frame (`BO_0273_045`) — puts the job id on the pending block and stages it
  into the run's group. `collect_generation` reads the job, answers *running* while it runs, and
  fills the pending block with what was made — a PNG, or the generator's video type — without
  paying again. The skill `media.pictures` says: quote first where a quote exists, generate once
  in the Send, follow the job rather than start another, say the cost, use the profile's backend,
  and make the picture first when a video needs one.
- Verified 2026-10-01 (`BO_0312_042`, the code half): `server/tools.test.ts` — an image and a video
  made with the pending block composed before the one paid request, the video carrying the
  picture above as its start frame; every refusal above made with nothing composed and nothing
  spent; a refused job said in words; a pending video filled from its finished job and a running
  one answered as running, with nothing paid again; disabling the picture check fails the suite. The kernel's gate is `calliopa-bootstrap`'s
  `TestExtensionToolGivenASpendingToolThenOneCallPerPersonsSend` (`BO_0312_007`).
- A run's generation reaches the service under its grant (`calliopa-bootstrap`'s `BO_0312_063`,
  2026-10-01, user decision of the same day): the tool route answers each tool through
  `answerTool`, which runs it under the grant the kernel handed it (`withRunGrant`), so every
  kernel call it makes presents that grant rather than a session it does not have, and the kernel's
  gate admits the media extension's grant on the media surface. Before it, every generator read
  signed out to a run whatever *Settings* showed. `server/tools.test.ts` proves each kernel call
  of an answered tool carries the grant; `src/server/kernel/client.test.ts` that `call()` sends it.
  The models the owner offers come with the call too, as `settings` (`BO_0276_007`): the state
  record they live in refuses a callback, so `generate` reads them through `offeredFrom` rather
  than `readOffered`, found by the walk at pin 3786 as a run told "sign in first". The suite's
  state record refuses as the gate does, and a handed offer set decides the model.
- The Generators section lists Higgsfield and OpenArt alone (`BO_0312_063`): the roster also
  answers Codex, signed in under Agents, which the section drew as a second row headed *OpenArt*
  with a *Sign in* its route refuses. `views/settings/section.test.ts` proves it.
- [ ] BO_0312_042 The walk on the served build, which spends: an *Image* profile written by the
      user with its backend, a Send producing one picture below the block, a second generation in
      the same run refused; then a *Video* profile, a prompt block under the picture, and a Send
      producing a moving picture.

## Codex Image Backend

Under `calliopa-bootstrap`'s `BO_0320` (2026-09-30), an image-generation profile has an explicit
image type and a saved structured backend choice. The person chooses the backend while setting up
the profile; prose instructions do not choose it. Codex was added as an intended `media.generate`
backend using the Codex sign-in already entered in Calliopa. The current Codex app-server route
does not support image generation, and repeated dev Sends returned no PNG. The user directed that
setup hide Codex and `media.generate` refuse saved Codex choices before submitting a job, without
fallback. The user declined a separate API-key route.

- `BO_0320_010`: image profiles persist a structured backend and pass it to `media.generate`.
  Codex is hidden in profile setup because the current Codex sign-in route cannot generate images.
- `BO_0320_012`: Codex dispatch was implemented, but end-to-end generation cannot be completed
  through the current Codex app-server sign-in route; repeated dev Sends returned no PNG. The app
  refuses saved Codex profiles before submitting a job and does not fall back to another backend.
- `BO_0320_014`: `media.generate` refuses before any job call when the saved image-profile backend
  is Codex. It returns a clear temporary-unavailability message with no fallback and preserves the
  saved profile value.

## Generation Needs No Format

- Under `calliopa-bootstrap`'s `BO_0332` (`docs/changes/BO_0332_FEAT_document-roles-and-block-roles.md`),
  in implementation on 2026-10-01: *Format* is taken by documents alone
  ([Roles](../../../doc-block-roles/docs/system/system.md#document-roles-and-block-roles)), so no
  prompt block can carry it.
* `media.generate` reads no *Format*: the profile — its type and its backend — says an image or a
  video is made, and *Format* says only what a whole document is produced as. User decision, 2026-10-01,
  revising the check that refused a prompt block without *Format* = image.
- `media.generate` reads no role (`BO_0332_034`, landed 2026-10-01; `server/tools.ts`): after the
  image profile and the Send's document and block, the next check is the backend's sign-in.
  `server/tools.test.ts` proves it: the suite mocks no role read, and an image profile's
  generation, signed out, is refused for the sign-in with nothing spent.
