# Formats Replace Manuscripts And Publishing

Status: completed

Part 4 of 5 of `BO_0308`, after `BO_0309` and `BO_0311`. Manuscripts become *formats*: a built-in
role that declares an output of type text, table, image, video, PDF or structured, produced by a
profile. Image and video generation become profiles, and the media senders leave the agent menu.
`publishing` and `calliopa-show` are removed, and their data is deleted. This document shapes the
change and authorizes no implementation.

## What Is Asked

* *Format* is a built-in role. A format has one of these types: text, table, image, video, PDF,
  or structured (JSON-like).
* Making a manuscript is a profile that produces a PDF. The profile says how to evaluate the block
  and its children.
* *Venue* is a role the person creates; it is not built in.
* Image and video generation are profiles. The Higgsfield and OpenArt senders leave the agent
  menu. Pressing Send is still what spends (`BO_0308_Q10`).
* No profile ships: *Manuscript*, *Image* and *Video* are profiles the person writes, with an
  agent's help if they like. A fresh install makes no manuscript, image or video until one exists.
  `BO_0298_Q3` holds. User decision, 2026-09-30 (`BO_0312_Q1`).
* A profile produces its output through the agent's tools: typesetting (`make_manuscript` today)
  and image and video generation from `media`. The profile's words tell the agent to use them on the
  block and its children, and the result is kept on the block carrying *Format*. A profile's own
  code blocks cannot reach the stack's services, since a runtime never joins the stack's network.
  User decision, 2026-09-30 (`BO_0312_Q5`), reading `BO_0308`'s *the code that generates the image
  becomes a profile* as the profile directing the generating tools.
* A PDF made by a manuscript profile keeps the LaTeX source with its `.bib` and the `.docx` beside
  it, since venues ask for them. User decision, 2026-09-30 (`BO_0312_Q2`).
* Front matter (authors, affiliations, abstract, keywords) moves to a role the person owns. The
  migration creates one ordinary role named *Paper* with those fields, has every document with
  front matter take it, and moves the values there. After that it is the person's to change.
  User decision, 2026-09-30 (`BO_0312_Q3`).
* Manuscripts already kept on documents are dropped with the manuscripts surface; they do not stay
  downloadable. User decision, 2026-09-30 (`BO_0312_Q4`).
* `publishing` and `calliopa-show` are removed. A migration deletes their data (channels, shapes,
  parts, deliverables, items, exports, assignments, bindings, releases and their relations) and
  their vocabulary. The Channels rows they fed into Settings go (`BO_0308_Q9`).
* Publishing to a website later is a profile's code tool the person builds inside the app, out of
  scope here.
* A run a person's Send started may make one paid generation, and a second needs another Send. A
  run no person started never spends. This narrows `media`'s fixed *an agent never spends*; Send is
  the press. User decision, 2026-09-30 (`BO_0312_Q6`).
* An install's content is migrated automatically as part of accepting an update, and the dogfood
  instance's when a pin is promoted: roles merged, keyword roles folded, profile attachments
  dropped, publishing's data and the kept manuscripts deleted, front matter moved to *Paper*. User
  decision, 2026-09-30 (`BO_0312_Q7`), asked because releases 0.4.1 and 0.4.2 shipped all of these
  extensions.

## Where This Starts

- `manuscripts` (`src/extensions/manuscripts/docs/system/system.md`): the Pandoc AST projection
  into PDF, LaTeX and Word for a chosen venue, the front matter, the numbering, the glossary, kept
  on the document. The typesetting service (`docs/system/typesetting-service.md`).
- `media` (`BO_0273`, `docs/system/media-service.md`): senders in the agent menu, and the
  Higgsfield and OpenArt sign-ins in Settings.
- `publishing` (`PU_0001`–`PU_0009`), `calliopa-show` (`CS_0001`), and the settings
  extension's dynamic Channels roster (`CA_0049`, `partyRoster`).
- No profile ships on a fresh install (`BO_0298_Q3`), and instance content never travels.
- A code-service runtime never joins the stack's network (`code-service.md`, a fixed line), so
  a profile's code cannot call the typesetting or media service.

## Proposed Shape

- **Format role.** Fields: `type`, and for structured output a `schema`. The output a profile
  produces is kept on the block carrying *Format*, with the revision it projects, as a manuscript
  is kept today.
- **Manuscript as profile.** `manuscripts`' projection stays as a server function behind the
  agent's typesetting tool. The tool takes a block, projects it and its children, reads the
  template and citation style from the venue role the block carries and the front matter from the
  *Paper* role, and keeps the PDF with its LaTeX, `.bib` and `.docx` on the block carrying
  *Format*.
- **Image and video as profiles.** `media`'s generation becomes an agent tool, spending only in a
  run a person's Send started. Its senders are removed, and its sign-ins stay in Settings. The
  result is an image or video block, kept as the output of the block carrying *Format*.
- **Removal.** A migration, run once per instance, deletes `publishing`'s and `calliopa-show`'s
  nodes, relations and declarations, then removes both extensions. The same migration removes the
  kept manuscripts and their blobs (`BO_0312_Q4`) and moves front matter to *Paper*
  (`BO_0312_Q3`). The release list drops
  `publishing`. `ui.shell`'s `partyRoster` stays in the contract only if another extension uses it;
  otherwise it goes.

## Functional Questions

- None open. `BO_0312_Q1`–`BO_0312_Q7` are answered in What Is Asked; `Q6` and `Q7` came up at transfer.

## Acceptance Examples To Shape At Draft

- Given a fresh installation, no *Manuscript*, *Image* or *Video* profile exists, and *Profile*
  under *Roles* lists none.
- Given a *Manuscript* profile the person wrote, telling the agent to typeset the block, and a
  document carrying *Format* (PDF), the person's *IEEE conference* venue role and *Paper* with its
  authors, sending with that profile produces the PDF `manuscripts` produces today, kept on the
  document with its LaTeX, `.bib` and `.docx`.
- Given an *Image* profile the person wrote, sending a prompt with it produces an image block, and
  nothing is billed before Send. The agent menu lists no Higgsfield or OpenArt sender.
- Given an instance with front matter on two documents and a manuscript kept on one, after the
  upgrade both documents carry *Paper* with their values, *Paper* is an ordinary role the person
  can rename, and the kept manuscript is gone.
- Given an instance holding publishing's channels and deliverables, after the upgrade neither
  extension is listed, their nodes and declarations are gone, and Settings shows no Channels row
  from them.

## Boundaries And Source Documents

- Graph: `manuscripts`', `media`'s, `publishing`'s, `calliopa-show`'s and `settings`' docs;
  `ui.shell`'s `contribution-contract.md` (`senders`, `partyRoster`).
- Fixed layer: `docs/system/typesetting-service.md`, `docs/system/media-service.md`,
  `docs/system/extension-model.md` (removing an extension and its declarations),
  `docs/system/distribution.md` (the release list), `docs/system/ui-kernel.md` (the harness's
  vocabulary copy).
- Owner: `manuscripts`, with the removal recorded in `publishing`'s docs before they go. Release
  notes: *Breaking* for the removal, the deleted data (publishing's and the kept manuscripts), the
  senders, and the manuscript and image making that now waits for a profile; *Changed* for
  manuscripts as formats and front matter as *Paper*.

## Transferred

Promoted to draft by the user on 2026-09-30 and transferred the same day. Two questions came up at
transfer and were answered the same day (`BO_0312_Q6`, `BO_0312_Q7`). It builds on `BO_0309` and
`BO_0311` and is implemented after them.

### The fixed layer, in this repository

- `docs/system/extension-model.md`, `ext.migration`: the `BO_0312_Q7` fixed line and `BO_0312_001`,
  an executable migration (`route`, `after`). `BO_0309_011`, `BO_0310_021`, `BO_0311_010`,
  `BO_0311_020` and this change's migrations take that path.
- `docs/system/ui-kernel.md`, *Formats, Migrations And Spending* (new): `BO_0312_003` the migration
  runner at serve; `_004` the spending gate (`spends: true`, one per Send); `_005`
  `make_manuscript`'s new input; `_006` the harness and tripwires; `_007` verification and rebuild.
- `docs/system/distribution.md`: `BO_0312_002`, a dropped extension's content retired with its
  members; `_008`, `publishing` set `ship: false`; `_009`, the release lines under *Breaking* and
  *Changed*.

### The graph, staged 2026-09-30

- Staged from a fresh checkout at head 3231 as `node:chg-d405ca7d3babbf3c`: ten files, tasks
  only, zero removals. The accept is in `docs/changes/scratchpad.md`.
- `manuscripts`' `system.md` gains *Formats*: the decisions and `BO_0312_020`–`_026` (projection
  from a block, `rendition` in place of `manuscript`, the surfaces, the migration, the skill,
  verification and walk, close).
- `media`'s `system.md` gains *Generation Is An Agent's Tool*: the narrowed fixed line and
  `BO_0312_040`–`_042` (senders removed, `media.generate` as a spending tool, verification and
  a walk that spends).
- `doc-block-roles`: `BO_0312_010`, *Format*'s built-in fields, and a note that `BO_0309_011` is
  an executable migration. `keywords` and `profiles`: the same note for `BO_0310_021` and
  `BO_0311_010`.
- `documents`' `block-document-model.md`, *A Manuscript Out Of The Record*: `BO_0312_030`, front
  matter leaving the `document` declaration.
- `publishing`: `BO_0312_050`, its removal. `calliopa-show`: `BO_0312_051`, its removal first.
- `settings`' `channels.md`: `BO_0312_060`, the dynamic Channels rows going. `ui.shell`'s
  `contribution-contract.md` gains *Senders And Rosters After Publishing* with `BO_0312_061`.

### Technical decisions taken at transfer

- The manuscript tool reads front matter and venue by field key (`authors`, `affiliations`,
  `keywords`, `template`, `citationStyle`) from the roles the run names, and answers which keys it
  read and which were missing. *Venue* and *Paper* are the person's roles, and nothing may look a
  role up by name.
- The kept output is a new `rendition` node on the block carrying *Format*, replacing `manuscript`.
- *Paper*'s *Authors* and *Affiliations* become long text, one per line. The structured author rows
  of `BO_0293_025` go with the front matter, since a role field has no list-of-records type.
- The migration runner runs at serve, before the shell is served from the pin. It is ordered by
  dependency, `after` and id, recorded per instance, and a failure stops the order and is retried
  at the next serve.
- The spending gate is the kernel's (`spends: true`), not a convention in `media`, keeping the fixed
  line's *route-kind boundary* intent.
- A release that drops an extension now retires its content with its members. Without that,
  publishing's channels and deliverables would stay behind on installs, unreadable.

## Implementation

Under way since 2026-10-01. The media half — the spending gate (`BO_0312_004`, landed with
`BO_0320`), `media.generate` and the senders' removal (`BO_0312_040`–`_042`, and the senders half
of `BO_0312_061`) — is `BO_0320`'s session's, by the user's decision of 2026-10-01; this change
completes after it.

- Fixed layer, landed: a release that drops an extension whole retires its content with its
  declarations, and validation counts nothing a change set retires as left behind (`_002`);
  `make_manuscript` takes a block and the venue and paper roles (`_005`); the harness's vocabulary
  copy follows (`_006`); `publishing` is `ship: false` and `check` lets a dropped extension be gone
  from the pin (`_008`). Open: `_007` (the gate's half, claimed with `_004`), `_009` (release
  lines, after the graph accepts) and `_062` (the old declarations, a release later).
- Graph, built on `BO_0311`'s tree and staged in three proposals: A, formats — *Format*'s fields
  and keys minted from names (`doc-block-roles`), manuscripts as renditions on the block carrying
  *Format* with the migration to *Paper* (`manuscripts`), front matter leaving `documents`; B1,
  `calliopa-show` removed; B2, `publishing` removed with its content, the dynamic Channels rows
  (`settings`) and the party roster (`ui.shell`). B2 goes after B1, since a manifest another still
  names cannot be removed in the same commit, and after the kernel and app images are rebuilt,
  since only the new kernel retires the content and only the new validation accepts it.
- B1 is not staged: `calliopa-show`'s removal moved to `BO_0324` (`BO_0324_Q3`, user decision
  2026-10-01), whose transfer replaces `BO_0312_051` with `BO_0324_050`. B2 goes after `BO_0324`'s
  implementation has removed `calliopa-show`. With `calliopa-video` removed by the same change,
  `rendition` is free again, should this change want the name.
- Technical decisions: the rendition's type is `formatRendition`, as `rendition` is
  `calliopa-video`'s; `manuscript` and the front-matter properties stay declared until `_062`; a
  field's key is minted from its first name.
- Landed 2026-10-01: BO_0311 underneath at pin 3467; A (`node:chg-bd52d491d0f4bdc1`) pinned at 3483,
  its migration run at 3486 and walked by the user (`_025`); `calliopa-show` removed alone as
  `BO_0324_050` (`node:chg-59df65e5f21639b4`, user decision of the same day, since BO_0324 was not
  under way); B2 (`node:chg-b7c382e768a8ffd3`) pinned at 3655, `publishing` removed with its 20
  declarations — the dogfood graph held none of its content. Release lines for both halves are
  written. Open: the media half (`BO_0312_004` landed with `BO_0320`; `_007`, `_040`–`_042`, the
  senders half of `_061`, and their `_009` lines), `_062` a release later, and the close (`_026`).
- The media half, taken over by the user's decision of 2026-10-01 ("complete the implementation"),
  with the senders removed rather than kept (`BO_0308_Q10`) and video added as a profile type:
  proposal M (`node:chg-310e8fa45fe03a27`, staged at head 3703) removes the senders from the shell
  contract, the agent menu and `media` (`_040`, the senders half of `_061`), makes images and
  videos through `media.generate` under an image or video profile (`_041`), and proves it in
  `server/tools.test.ts` (`_042`'s code half). Rebased over `BO_0332_034` and `BO_0320_013`/`_014`:
  generation reads no *Format*, Codex stays refused, and a saved backend stays when the type
  changes. `_007` is folded (the gate's test), and the media release lines are written (`_009`).
  Open: the user's spending walk (`_042`), then the close (`_026`); `_062` a release later.
- Found in the user's walk of `_042` at pin 3707: every generator read signed out to the run. A
  tool's callback holds no session and the prod gate refused its kernel calls, so the roster was
  empty. User decision, 2026-10-01: the gate admits the media extension's run grant on the media
  surface (`BO_0312_063` in [Kernel](../../system/ui-kernel.md)); the tool forwards the grant it is
  handed. The Generators section also drew Codex as a second *OpenArt* row; it lists Higgsfield and
  OpenArt alone. The Higgsfield sign-in failure of the same walk was a pasted code and state from a
  flow that a second press of *Sign in* had superseded.
  The walk's next run, at pin 3786, passed the gate and was told "sign in first" one step later:
  `generate` read the owner's offered models from the kernel's state record, which a callback
  cannot reach; it reads them from the settings the kernel hands the call (`BO_0276_007`).
- The walk's run at pin 3796 (`arun-84078f20565e6fd1`, 2026-10-01) passed the gate and the sign-in
  and started the Higgsfield job, then had its pending block refused: `generate` composed it
  against truth, so the CREATE named itself established, which the run's group refuses. The job
  was accepted by the service and its id lost to the run. The same run was offered the retired
  `propose_generation` (404) and read `generate` as image-only and bound to *Format*. Proposal W
  (`node:chg-c80552d9a60c4ab5`, restaged at head 3885 over `BO_0336`'s transfer: `media`'s `tools.ts`, its test and
  `system.md`, and the media members) composes in the run's group, retires `propose_generation`
  and corrects the declarations. The run told the person no job had started; the kernel's half,
  naming what a refused spending tool already did, is open as `BO_0312_064`.
- Completed 2026-10-02. W2 (`node:chg-c80552d9a60c4ab5`) pinned at 3888 and walked by the user:
  a Send under the *hf image* profile made one picture, collected from its one job and staged below
  the block. The user closed `_042` on the image walk; the video and the refused second generation
  stand on their tests. The close folded `_042` and `_026` and moved this document to completed in
  `settings`' `docs/changes/` in the same proposal. Left open: `_062` a release later, and
  `BO_0312_064`, a refused spending tool's staging naming what was already done.
