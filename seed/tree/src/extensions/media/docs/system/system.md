# Media

## Purpose

- `media` makes a picture or a moving picture from the words in a block. It owns every surface of
  that — the variation chosen beside *Send* in a block's command chip, the two services' sign-ins in
  Settings, what a format's provider, model, ratio and quality suggest, the generation route and its
  process, the tools an agent may hold, and what a generated block says about its own making — and
  nothing else.
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
* No hidden default provider or model. A picture or a video is made under an instruction the person
  writes, through the format that instruction names: the format's `type` says which, and its provider,
  model, ratio and quality, or those of the variation chosen beside *Send*, what it is made with.
  Settings only connects the accounts. The senders that stood in the agent menu are gone. User
  decisions, 2026-09-21, 2026-09-30 (`BO_0308_Q10`) and 2026-10-02 (`calliopa-bootstrap`'s
  `BO_0336`, revising `BO_0320_Q4` and `BO_0320_Q5`).
* The format decides whether a picture or a moving picture is made — a format of type image or of
  type video (Generation Settings Live In The Format). User decision, 2026-10-02 (`BO_0336`).
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
  (`/__kernel/media/services`), and draws per service whether it is signed in or the login to run.
  A service that is not answering is said in words rather than rendering nothing. Which model makes
  what is a format's to say: the row holds no models (`BO_0336_021`).
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
- Every sign-in is finished by pasting back the `code` and `state` from the address the browser
  landed on: the vendor's redirect goes to a loopback port inside the media service's container,
  which no browser reaches, and the service publishes no port (`BO_0342`, user decision
  2026-10-02). **OpenArt picks a fresh ephemeral port for every flow** — observed choosing
  `37167` — and **Higgsfield's sign-in server accepts only `localhost:8765` through `8774`**, the
  ports its own CLI picks, so neither could be published for a browser to follow (`BO_0273_033`,
  found by the user on 2026-09-21). The page the browser lands on does not load, or shows
  whatever else on the person's machine answers on that port; either way its address is what is
  pasted.
- So the broker reads the loopback out of the authorize URL the CLI printed (`redirect_uri`, which
  both vendors carry) rather than assuming its own, waits in `awaiting_redirect` for every vendor
  rather than Higgsfield alone, and hands the redirect to whatever port the CLI chose. Before this
  an OpenArt flow published no `awaiting_redirect` at all, so the fields to paste into never
  appeared and the login could not be finished.
- The way in comes first on each row (`BO_0273_033`): the standing, then the Sign in button, then
  the flow's URL and paste fields beside them, and the workspace picker once there is an account to
  read it from.
- Proven in `server/media.test.ts`: the request written with its own id and carrying no workspace,
  the choice asked of the kernel that holds the bearer, a refusal carried back in the service's own
  words, no state before a flow, the flow answered by its id, another flow's state not answered
  as this one's, a superseded flow's outcome read through `previous`, and the redirect written
  where the broker reads it. The tree typechecks, the unit project passes for this extension, the
  tree builds, and `kernel toolchain absence` on a release-shaped tree builds without `media`.
* The provider, model, ratio and quality a generation uses are the format's, or the variation's
  chosen beside *Send*, never chosen by a run's words. User decision, 2026-10-02
  (`calliopa-bootstrap`'s `BO_0336`, revising `BO_0320_Q4`).
* A model is suggested under the vendor's own name. The owner no longer offers, names or gives
  icons to models; Settings keeps the sign-ins and the workspace pick alone. User decision,
  2026-10-02 (`BO_0336`, revising `BO_0273_037` and `BO_0273_029`).
- Proven in `server/propose.test.ts`: staged into its own group and after the prompt, no reference
  written, the prompt trimmed onto both the words and the record, the declared kind and never a
  third value, a fresh group per generation, and refusals without a person, without a model and
  without words that write nothing. The staging was shown to bite by taking the branch scope away.
* **Send is the press that spends.** A block is sent with an image or a video instruction the way any
  command is sent: one gesture, no confirmation, and what it cost is reported after, in the run's
  answer and on the picture's own panel. User decision, 2026-09-22, carried over to the instruction by
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
  in the store referenced by nothing and the staging GC uses them.
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
- What an agent may reach: `media.quote_generation`, `media.generate` and
  `media.collect_generation`, each answered by a `kernelCallback` route, the only kind a run can
  reach (*Generation Is An Agent's Tool*). Only `generate` spends, and the kernel admits it once
  per Send. `propose_generation`, which staged a pending block for a person's press, is retired
  with the senders (`BO_0312_042`'s walk found it still allowed to runs, answering 404).
- The tools answer with **statements**, which the kernel stages into the run's group as the run,
  because nothing an extension does may write on a run's behalf; the statements are `documents`'
  to compose, since the block type is its own (`composeMediaInsert`, `composeMediaFill`), and they
  are composed inside the run's group, as the kernel stages them there.
- An inactive extension contributes neither tool nor skill, as it contributes no route: the toolset
  lists the members of active extensions alone.
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

* The vendor is asked when a format's field opens its suggestions, and the answer is kept per
  provider and model, so nothing calls a vendor on the path of *Send*. User decision, 2026-10-02
  (`calliopa-bootstrap`'s `BO_0336`, revising `BO_0279`'s *asked when the owner sets a model up*).
- **A format's fields suggest what the vendors offer** (`BO_0336_020`, landed 2026-10-02;
  `server/suggestions.ts`, `SUGGESTION_SOURCES`), answered through the frame's suggestion sources
  (`ui.shell`'s `BO_0336_052`): `provider` the services signed in, Higgsfield and OpenArt, never
  Codex; `model` the chosen provider's models that make the format's `type`, under the vendor's own
  ids, from the roster; `ratio` the model's `aspect-ratio` values and `quality` its `resolution`
  values, or its `quality` values where it has no resolution, from the service's
  `GET /v1/models/<service>/<model>`, the model's own default marked. Each says in words why it has
  nothing: nothing signed in, no provider or model chosen yet, a model that takes no such axis, the
  service not answering.
- **What a model takes is kept in the extension's process** per provider and model, asked when a
  field opens its suggestions; a description that could not be read leaves the one kept before, so
  a vendor down for a minute does not empty a list. Kept in the process rather than in the
  extension's settings, since that record is the owner's to write and anyone who edits a format
  opens these. Technical decision at implementation, 2026-10-02.
- **The format's ratio and quality are sent as the model's axes**: `ratio` as `aspect-ratio`, and
  `quality` under the axis its kept description answered quality from — `resolution` when nothing
  is kept, which is what *1k* and *1080p* are. A value the model does not take is the vendor's to
  refuse, and the refusal reaches the run in the vendor's own words. Technical decision at
  implementation, 2026-10-02.
- **What a generation would cost** is the run's `quote_generation` (`BO_0279_013`): the adapters'
  own dry run for what the instruction's format would make — its provider, model and axes, with the
  variation chosen beside *Send* — which spends nothing; the skill quotes before it generates and
  says the amount. The credits are given in the vendor's own words.

- **A video animates the picture above it** (`BO_0273_045`, user decision 2026-09-22). Neither
  video generator makes a clip from words alone — both refuse with *at least one image, video, or
  audio reference is required* — so a send to a video model takes the nearest picture above the
  block as the clip's first frame, under the adapters' own `--start-image`, and the block's words
  say what should happen in it. `media.generate` with a format of type video does the same
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
generation are made through an instruction the person writes, by the agent's tool, and the senders
left the agent menu (`BO_0308_Q10`). `BO_0320`'s session built the tool for images with its Codex
backend; `BO_0312` added video and removed the senders.

* A run a person's Send started may make one paid generation, and a second needs another Send; a
  run no person started never spends. This narrows *Nothing bills without a press* (the Send is the
  press) and replaces *An agent names a model; the person sends the block* (`BO_0273_038`). User
  decision, 2026-09-30 (`BO_0312_Q6`). The gate stays in the fixed layer rather than in a
  convention: the kernel admits one call of a `spends` tool per Send (`ui-kernel.md`
  `BO_0312_004`).
* A video is made by Higgsfield or OpenArt, never Codex: since `BO_0336`, under an instruction whose
  format is of type video. User decisions, 2026-10-01 and 2026-10-02.
- The senders are gone (`BO_0312_040`, landed 2026-10-01): `mediaSenders`, `sendToModel`,
  `quoteToModel` and `server/senders.ts` with its tests, and with them the shell's sender contract
  (`ui.shell`'s `BO_0312_061`), so the agent menu lists agents alone.
- `media.generate` (`BO_0312_041`, landed 2026-10-01; `server/tools.ts`) is an `ext.tool` with
  `spends: true` answered on the `kernelCallback` route `kernel/tools/generate`, taking
  `{block, words?}`; what it makes, and with what, is the run's format (Generation Settings Live
  In The Format). It composes the pending picture or video after the block, starts the one paid
  job — a video with the picture above as its start frame (`BO_0273_045`) — puts the job id on the
  pending block and stages it into the run's group. `collect_generation` reads the job, answers
  *running* while it runs, and fills the pending block with what was made — a PNG, or the
  generator's video type — without paying again.
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
- The Generators section lists Higgsfield and OpenArt alone (`BO_0312_063`): the roster also
  answers Codex, signed in under Agents, which the section drew as a second row headed *OpenArt*
  with a *Sign in* its route refuses. `views/settings/section.test.ts` proves it.
- `generate` composes its pending block inside the run's group (`withBranch`), as
  `collect_generation` composes its fill: composed against truth, the CREATE named itself
  established, which the run's group refuses. The walk at pin 3796 (2026-10-01) met it: the
  Higgsfield job was started and paid for, the staging refused, and the job id lost to the run.
  `server/tools.test.ts` uses the real branch scope and records the branch each compose ran in;
  without the fix it fails. The same walk found the tools' declarations behind: `generate` and
  `collect_generation` said image alone and named *Format*, and `propose_generation` was still
  offered; `propose_generation` is retired, and the tools' declarations follow the format
  (`BO_0336_024`).
- Walked by the user on the served build at pin 3888, 2026-10-02 (`BO_0312_042`, "worked"): a
  Send under the user's *hf image* instruction (Higgsfield) called `generate` once, collected that one
  job until it finished, and staged the picture below the block in the run's group. The user closed
  the walk on the image (decision of the same day): the video and a second generation refused in
  one Send were not walked, and stand proven by `server/tools.test.ts` and the kernel's
  `TestExtensionToolGivenASpendingToolThenOneCallPerPersonsSend`.

## Codex Makes No Pictures Yet

- Under `calliopa-bootstrap`'s `BO_0320` (rejected on 2026-10-01): the current Codex app-server
  sign-in route generates no image, and the user declined a separate API-key route. A format naming
  `codex` as its provider is refused before any job call, in words, with no fallback to another
  provider (`BO_0320_014`), and the provider suggestions never offer it.

## Generation Reads The Instruction's Format

- *Format* is used by documents alone (`calliopa-bootstrap`'s `BO_0332`,
  [Structures](../../../structures/docs/system/system.md#document-structures-and-block-structures)), so no
  prompt block carries it, and `media.generate` reads none of the prompt block's roles: what is
  made comes from the format the run's instruction names (Generation Settings Live In The Format).

## Generation Settings Live In The Format

Under `calliopa-bootstrap`'s `BO_0336`
(`docs/changes/BO_0336_FEAT_generation-settings-live-in-the-format.md`, promoted to draft by the
user on 2026-10-02 and transferred here the same day; its copy stands in this extension's
`docs/changes/`): what a picture or a video is made with — provider, model, ratio, quality — moves
from Settings and the instruction to the format. This extension is the change's owner in the graph.
The structures half is `structures`'
([Formats Carry Generation](../../../structures/docs/system/system.md#formats-carry-generation)),
the instruction's `instructions`', the declaration's `documents`', the contract's `ui.shell`'s, and the
kernel's `calliopa-bootstrap`'s `ui-kernel.md`, *Generation Settings Live In The Format*.

* A format is a document using *Format*; an instruction names one in its optional *Format* field.
  `media.generate` makes a picture for a format of type image and a video for type video, with its
  provider, model, ratio and quality. User decision, 2026-10-02 (`BO_0336`).
* A value outside the suggestions is sent as typed; a vendor that does not use it refuses in its
  own words (`BO_0336`, 2026-10-02).
* The format's own values and its variations are the only things a generation under it uses. A
  variation is chosen beside *Send*; the choice returns to the format itself after each *Send*
  (`BO_0336`, 2026-10-02).
* An image or video instruction is not migrated: after the upgrade it names no format, and generation
  under it is refused until the person makes one and names it (`BO_0336`, 2026-10-02).
- The kernel hands a tool callback the run's `instruction` and the `variation` chosen beside *Send*,
  by id, and reads neither (`calliopa-bootstrap`'s `ui-kernel.md` `BO_0336_001`); this extension
  reads the format at the run's pin (`server/format.ts`, `readFormat`, through `structures`'
  `structuresOf`, a declared dependency): the instruction's *Instruction* `format` value, that document's
  *Format* values, and, for a variation, the block of that format using *Variation*, whose
  non-empty values are put over the format's. Technical decision at implementation, 2026-10-02:
  what a format holds is its extensions' to read, as `make_manuscript`'s structures are.
- `media.generate` and `quote_generation` (`BO_0336_022`, landed 2026-10-02; `server/tools.ts`)
  use that format alone: they take no `model` and no `options` from the run's arguments, and the
  tools' declarations no longer offer them. They refuse in words, before anything is composed or
  spent: no instruction (*choose an instruction whose Format names how it is made*); an instruction naming no
  format (*choose a format on the instruction, in its Format field*); a format no longer carrying
  *Format*; a format whose type is neither image nor video; no provider; Codex; a provider that is
  no generation service; a provider signed out (its own words, or *sign in in Settings*); no model;
  a variation that is not a block of the format using *Variation*; and the refusals that stood —
  no block of this Send, no words, no picture above a video. A job the service refuses is said in
  the service's own words. The made block's `source` names the format and the variation.
- The variation beside *Send* (`BO_0336_023`, landed 2026-10-02; `views/command/variation.tsx`
  `VariationChoice`, the `command` place): it follows the command's `instruction` option, which it
  reads among the command's options (`ui.shell`'s `BO_0336_051`), and asks
  `GET /api/x/media/variations?profile=` for the format the instruction names and its variations
  (`server/format.ts` `choicesFor`), each by its block's words, or *Variation n* for a block without.
  With variations it draws a select of the format's title, then each variation; a choice sets the
  command's `variation` option for one send, so after *Send* the shell clears it and the select
  shows the format again. Nothing is drawn while no instruction is chosen or its format has none, and a
  variation set under another instruction is cleared when the instruction changes. Its host takes no room
  in the chip's line (`display: contents`).
- The Generators section (`BO_0336_021`, landed 2026-10-02) reads the roster alone and keeps no
  record of models: the extension's settings hold nothing, and `GET /api/x/media/services` answers
  the roster as the service gives it.
- The skill and the declarations (`BO_0336_024`, landed 2026-10-02, members revised through
  `kernel commit --members`): `media.pictures` says the format the instruction names decides the
  provider, model, ratio and quality, with the variation chosen beside *Send*; a run names none and
  never asks the person to choose one in words; with no format on the instruction it says to choose one
  there; it quotes before it generates. `media.generate` takes `{block, words?}` and
  `quote_generation` `{prompt}`, each described as made from the instruction's format.
- Verified 2026-10-02 (`BO_0336_025`, the code half): `server/tools.test.ts` — a picture made with
  the format's values at the run's pin, its ratio and quality sent as axes; a variation's values
  over the format's and its empty one the format's; a run's model and options ignored; a value
  outside the suggestions sent and the vendor's refusal said in its words; a video from the picture
  above; each refusal with nothing composed or spent; a quote of what the format would make.
  `server/suggestions.test.ts` — each source's answer and words, the kept description surviving a
  vendor not answering, the quality's axis. `views/settings/section.test.ts` — the row with its
  sign-in and workspace and no models, names, icons or axes; `views/command/variation.test.ts` —
  the format and its variations drawn for an instruction and a choice set for one send, nothing without
  an instruction or variations, a variation of another format cleared.
- Walked by the user on the served build at pin 3907, 2026-10-02 (`BO_0336_025`, "worked"): a
  format filled with the suggestions its fields allowed, an instruction naming it in its *Format* field,
  and a Send making an image with the format's values, end to end.
- Walked by the user the same day (`BO_0336_025`, "worked"): a block of the format document
  given *Variation*, the variation chosen beside *Send* under an instruction naming that format, and the
  picture made with the variation's values.
- The walk closes on the image and the variation (`BO_0336_025`, user decision 2026-10-02). The
  video was refused by the vendor for a start frame its prompt did not name, which `ME_0001`
  captured; how a format takes a video's inputs is `ME_0002`'s, whose walk takes the video
  (A Format Says What It Takes).

## Profiles Become Instructions

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day: roles become structures and profiles become instructions, with every stored
identifier and route, and `doc-block-roles` and `profiles` become `structures` and `instructions`
([Roles Become Structures](../../../structures/docs/system/system.md#roles-become-structures)).
`BO_0336` uses the new names already (user decision, 2026-10-02); this is what remains.

- `media.generate` reads the run's instruction (`BO_0338_080`, 2026-10-02): the kernel hands
  `run.instruction` (`calliopa-bootstrap`'s `BO_0338_004`), `server/format.ts` reads the built-in
  *Instruction*'s `format` field through `structures` (`INSTRUCTION_ROLE`), the choice beside
  Send reads the command's `instruction` option and asks `/api/x/media/variations?instruction=`,
  and the refusals say *instruction*.
- The `media.pictures` skill and the tools' descriptions (`media.generate`,
  `media.quote_generation`) say instruction and structure (`BO_0338_081`, 2026-10-02).
- This document speaks the new terms (`BO_0338_082`, 2026-10-02): *Generation Reads The Instruction's
  Format* and every line on the instruction and its structures.

## A Structure Is A Document

Under `structures`' `RO_0005` (2026-10-02): every structure becomes a document and *Format* and
*Variation* take fixed ids `structures` names
([A Structure Is A Document](../../../structures/docs/system/system.md#a-structure-is-a-document)).

- Generation reads a format and its variations by `FORMAT_STRUCTURE` and `VARIATION_STRUCTURE`,
  `structures`' names for their fixed ids, its fields by key as before (`RO_0005_060`, landed
  2026-10-02); the unit suite's views name them so.

## A Format Says What It Takes

Under `ME_0002` (`docs/changes/completed/ME_0002_FEAT_a-format-says-what-it-takes.md`), set to draft by the
user on 2026-10-03 and transferred here the same day: a format says which inputs it takes and how
it is used, and the agent fills the inputs from the command. *Input* is `structures`'
([A Format Says What It Takes](../../../structures/docs/system/system.md#a-format-says-what-it-takes)).
Every kind reaches the vendor by `calliopa-bootstrap`'s `BO_0346` (completed 2026-10-03): the
media service passes each input under its adapter's flag and refuses, in words and before anything
is spent, a kind the model does not take. On a device the cell takes a start frame alone and
refuses any other input in words ([On A Device](#on-a-device)).

* A format's inputs are blocks of its document using *Input*, written, named and reordered as
  blocks are. User decision, 2026-10-03 (`ME_0002_Q1`).
* The format explains itself through its own words: its document's blocks using neither *Input*
  nor *Variation*, and each input's words, are given to a run generating under an instruction
  naming the format, as instructions for using it. User decision, 2026-10-03 (`ME_0002_Q2`).
* The agent fills the inputs from the command — the blocks the person marked with `#`, and the
  picture above the block when the words point at nothing — matched by what the format's words and
  the command say, and says in its answer which picture it used for which input. A required input
  with no picture it can tell is refused in words, with nothing spent; the agent does not ask. User
  decision, 2026-10-03 (`ME_0002_Q3`).
* The agent writes the vendor's prompt, naming each input as the model expects (`@start`);
  `media.generate` refuses, before anything is spent, a call whose words do not name an input it
  attaches, and never adds the name itself. User decision, 2026-10-03 (`ME_0002_Q4`).
* A video format with no *Input* takes the picture above the block as its start frame, which the
  agent names `@start`. User decision, 2026-10-03 (`ME_0002_Q6`).
* An image format declares inputs only where its model takes references; none of today's image
  models is wired for them, so this change delivers video. User decision, 2026-10-03
  (`ME_0002_Q5`).

- The format's words reach the run through a tool of this extension rather than the kernel:
  `media.read_format`, which spends nothing, answers what the instruction's format is and how it
  is used, and the skill reads it before it writes a prompt. Technical decision at transfer,
  2026-10-03: the run's format is already read here (`server/format.ts`), so the kernel stays as
  it is.

- A format's inputs are read with the format at the run's pin (`ME_0002_010`, landed 2026-10-03;
  `server/format.ts`): its blocks using *Input* (`structures`' `INPUT_STRUCTURE`) in reading order,
  each as its *Name* — a leading `@` dropped, letters, digits, `-` and `_` alone — its *Kind* as
  the service's role (`INPUT_KINDS`: `start`, `end`, `image`, `video`, `audio`) and whether it is
  *Required*. An input with no kind, a name of anything else, or two inputs of one name refuse the
  format in words, as a missing provider does. A video format declaring none takes
  `START_BY_DEFAULT`, the start frame `start`, required, standing in no block. A variation varies
  none of them. `guideOf` reads the format's words at head, where the run's document is read: its
  text blocks using neither *Input* nor *Variation*, and each input's own words.
- `media.read_format` (`ME_0002_011`, landed 2026-10-03; `server/tools.ts` `readFormatTool`, an
  `ext.tool` member without `spends`): answers the format's title, type, provider, model, the
  variation chosen, its words, and each input's name, kind in words, whether it is required and
  what it is for — the default start frame saying it is the picture above unless the call names
  another — or refuses as `generate` does for a missing instruction or format.
- `media.generate` and `quote_generation` take `inputs`, each input's name to a block id, or
  `<document id>/<block id>` for a block of another document a `#` reference points into
  (`ME_0002_012`, landed 2026-10-03; `referencesFor`). Before anything is composed or spent they
  refuse in words: a name the format does not declare (or any, on a format declaring none); a
  required input not given; audio, which no block holds; a block that is not a picture for a
  start frame, an end frame or a reference image, or not a video for a reference video; one not
  made yet; and an attached input the words do not name as `@<name>`. A video format declaring
  none takes the picture above the block as `start`, which the words must name too; a quote naming
  no block is quoted without it. Each attachment is sent as its bytes under its name, its kind the
  reference's `role` (`server/make.ts` `referenceBytes`, `madeBlock`). `server/tools.test.ts`
  proves the format's words and inputs read, a video from the first marked picture to the second,
  a picture read from another document, a reference video, a quote carrying what the call names,
  each refusal with nothing composed or spent, and the picture above as `@start`; without the
  naming check its refusals fail.
- `media:inputName` (`ME_0002_013`, landed 2026-10-03; `server/suggestions.ts`) suggests an input's
  name from its *Kind* — `start`, `end`, `image`, `video`, `audio` — asking no vendor, and says to
  choose the kind first without one. `server/suggestions.test.ts` proves it.
- The skill and the declarations (`ME_0002_014`, landed 2026-10-03, members through
  `kernel commit --members`): `media.pictures` reads the format first and follows its words, fills
  each input from the blocks the person marked with `#`, or the picture above when the words point
  at nothing, writes the words naming every attached input as `@name`, says which picture went
  where, and does not call `generate` when a required input has none; `media.read_format` is
  declared; `media.generate` and `media.quote_generation` take `inputs`, the quote a `block` too.
- Walked by the user on the dev instance at pin 4534, 2026-10-03 (`ME_0002_015`, "worked"), after
  `migration-me-0002-input-structure` gave the instance *Input*: a video made through a format's
  inputs, from a command that marked its picture with `#`. Beside the walk stand the unit suite
  (`server/tools.test.ts`, `server/suggestions.test.ts`, `lib/structures.test.ts`,
  `server/api.test.ts`) and `structures`' behavior suite under the kernel harness.

## On A Device

- On a device the generators are the cell's to answer (`calliopa-bootstrap`'s `docs/system/mobile.md`, `BO_0319_025`): Higgsfield through its HTTP API with the person's key, entered under Connections as `higgsfield`, and OpenArt, which offers no API key, unavailable with its reason. The roster (`server/media.ts`) asks the cell's `/__kernel/media/services` for Higgsfield once its capability is ready — the models its API names, read at runtime — and answers each generator that is not ready with its capability's reason and nothing to offer. Every other route — what a model takes, the quote, a generation, its state and its file — is the same `/__kernel/media/…` an instance answers, so nothing else here differs. `BO_0319_025`
- A keyed generator (`ServiceView.byKey`) is entered rather than signed in to: the Generators section shows no *Sign in*, says *Ready: its key is set under Connections.* or why not, and notes that each picture is paid from the key's own Higgsfield balance and that asking what one would cost spends nothing (`views/settings/section.tsx`). `BO_0319_025`
- Verified 2026-10-03 in the desktop harness on the device build at head 4301 with no key: the Generators section reading *This needs a key, entered in Settings.* with the keyed note and no *Sign in* for Higgsfield, and OpenArt unavailable with its reason; the cell answering six models from Higgsfield's own API description, `higgsfield-ai/soul/standard` the image default with its ten ratios and two resolutions. `BO_0319_025`
