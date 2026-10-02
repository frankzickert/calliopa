# Generation Settings Live In The Format

Status: completed

What an image or a video is made with — the provider, the model, the ratio and the quality — is
spread today over Settings (which models are offered, their names, icons and captured axes) and
the profile (its *Profile type* and *Image backend*). It belongs to the format. Settings keeps
connecting the accounts and nothing else. A person creates a format and chooses its provider,
model, ratio and quality there, as role fields that suggest what the connected accounts offer
without being limited to it. A profile gains an optional *Format* field that suggests the
person's formats. This document shapes the change and authorizes no implementation.

## What Is Asked

* Settings only connects the accounts: signing in to Higgsfield and OpenArt stays there, and every
  choice of model leaves it. Requested by the user, 2026-10-02.
* The profile no longer carries a profile type or a backend. Choosing what kind of output is made
  is what the format is for. Requested by the user, 2026-10-02.
* A person creates a format and selects there a provider, a model, a ratio and a quality (for
  example *1k* or *1080p*). Requested by the user, 2026-10-02.
* These are ordinary role fields, so the implementation stays flexible as models change: a value is
  not limited to a fixed list. They still suggest what is available — the providers, the models,
  the ratios and the qualities. Requested by the user, 2026-10-02.
* A profile has an optional field that takes a format. It is an ordinary role field that suggests
  every format the person has as its possible values. Requested by the user, 2026-10-02.
* A format may specify variations, and the person chooses among them; nothing outside the format
  and its variations is used. Requested by the user, 2026-10-02.

## Where This Starts

- `media` (graph, `src/extensions/media/docs/system/system.md`): the Generators section in
  Settings holds the sign-ins and workspace pick, and also the owner's offered models
  (`BO_0273_029`), their names and icons (`BO_0273_037`) and their captured axes (`BO_0279_011`–
  `_017`). `media.generate` takes the profile's `profileType` and saved backend, uses the backend's
  offered default model unless the run names another, and passes the axes as `options`.
- `profiles` (graph): a profile's bar shows *Profile type* (instructions, image, video) and *Image
  backend* (`BO_0320_011`, `BO_0320_013`, video from `BO_0312`), stored as `profileType` and
  `imageBackend` on the `document` node (`documents`' `BO_0320_013`).
- The kernel hands the selected profile's `profileType` and `imageBackend` to every extension tool
  callback (`docs/system/ui-kernel.md`, `BO_0320_005`).
- `doc-block-roles` (graph): *Format* is a built-in role taken by documents alone, with the release
  fields `type` (a required choice of text, table, image, video, PDF, structured) and `schema`
  (`BO_0312_010`, `BO_0332`). Field types are text, long text, number, date, true/false, choice
  from a fixed list, reference to a document or block, and file; a choice's options are fixed and
  a reference is typed as an id (`BO_0309_024` is open for choosing it by title).
- Open around it: `BO_0312_042`, the spending walk with an image and a video profile;
  `BO_0320_013` stands claimed in `documents`' docs.

## Fixed Lines This Reverses

Each is a user decision; promoting this change to draft confirms its reversal.

- `media`, *Generation Needs No Format* (2026-10-01): `media.generate` reads no *Format*, the
  profile's type and backend decide. Here the format the profile names decides.
- `media`, *No hidden default provider or model* and *The profile's type decides whether a picture
  or a moving picture is made* (`BO_0320_Q4`, `BO_0320_Q5`, 2026-10-01): the format's `type` decides
  instead, and its provider and model are the person's, still never hidden defaults.
- `media`, *The backend a generation uses is the profile's … the model is the backend's offered
  default unless the run names another* (`BO_0320_Q4`): the format's provider and model are used,
  or a variation's the format lists; a run's words no longer name a model.
- `media`, *The vendor is asked when the owner sets a model up, not when the menu opens*
  (`BO_0279`): there is no setting-up in Settings any more, so the vendor is asked when a format's
  suggestions are opened.
- `media`, *A model is called what the owner calls it, and wears the icon they gave it*
  (`BO_0273_037`) and *An empty set means everything* (`BO_0273_029`): the offered set, the names
  and the icons go with the model choice in Settings.
- `doc-block-roles`: *Format*'s meaning is `BO_0310`–`BO_0313`'s, today *what a whole document is
  produced as* (`BO_0332`). A format the person creates and a profile points to widens it.

## Proposed Shape

- **A format is a document carrying *Format*,** the way a profile is a document carrying
  *Profile*: the person creates it, names it (*Instagram square*, *Trailer 1080p*), and fills its
  fields. *Format*'s *Roles* row lists them. *Format* on a document thereby has two senses: a
  format document is a definition, and a manuscript carrying *Format* (PDF) is both definition and
  assignment. User decision, 2026-10-02.
- ***Format* gains four release fields** beside `type` and `schema`: `provider`, `model`, `ratio`
  and `quality`. They stand on every format and are read for image and video alone, as `schema` is
  read for structured alone. All four are open fields with suggestions; `type` stays a fixed
  choice. User decision, 2026-10-02.
- **A field may suggest values without limiting them.** A new field shape in `doc-block-roles`:
  text with suggestions. The field control opens its suggestions as the roles chip's typeahead
  does, a press fills one in, and anything typed is kept as typed and sent as it is; the field
  shows nothing extra for a value outside the suggestions, and a vendor that does not take it
  refuses in its own words (user decision, 2026-10-02). Suggestions come from a source named on
  the field and answered by the extension that owns it, so `doc-block-roles` knows nothing of
  vendors. The vendor is asked when a field opens its suggestions, the answer cached per provider
  and model as `BO_0279`'s capture is, so nothing calls a vendor on the path of *Send* (user
  decision, 2026-10-02):
  - `provider`: the generation services signed in under Settings (Higgsfield, OpenArt; Codex left
    out while it cannot generate, `BO_0320_014`).
  - `model`: the chosen provider's models that make the format's `type`.
  - `ratio` and `quality`: the chosen model's axes as the vendor describes them (`aspect_ratio`,
    `resolution` or the vendor's equivalent).
  - With nothing signed in, or a vendor not answering, the field says so in the suggestions and
    stays typeable.
- ***Profile* gains a release field `format`**: optional, a reference to a document carrying
  *Format*, its suggestions every format by title (the `#` list's way of naming, `BO_0309_024`).
- **Both field shapes are open to the person's own roles,** not only to release fields: a role the
  person creates may give a field suggestions, and may make a reference that takes only documents
  carrying a given role. User decision, 2026-10-02. Such a field may name any suggestion source an
  extension declares, and may in addition carry a list of suggestions the person types on the
  field; a reference may be limited to documents carrying any one role. User decision,
  2026-10-02.
- **A format may list variations.** A variation is named (*Story 9:16*, *OpenArt fallback*) and
  may set any of `provider`, `model`, `ratio` and `quality`; what it leaves empty is the format's.
  The format's own values and its variations are the only things a generation under it may use: a
  run's words do not override them, and a run wanting anything else needs another format. User
  decision, 2026-10-02. Each variation is a block in the format document carrying a new release
  role *Variation*: its name is the block's title, its fields the same four open fields with the
  same suggestions, an empty one meaning the format's value, so variations are made, named and
  reordered as blocks are and the field model gains no list shape. User decision, 2026-10-02.
- **The variation is chosen at *Send*.** When the selected profile's format lists variations, the
  composer shows a choice beside *Send*: the format itself or one of its variations. A format
  without variations shows no choice. After each *Send* the choice returns to the format itself,
  so a costlier variation is never spent again by surprise. User decision, 2026-10-02.
- **Generation reads the format.** The kernel hands a tool callback the selected profile's format —
  its id and its field values at the run's pin, with the variation chosen at *Send* applied — in
  place of `profileType` and `imageBackend`. `media.generate` makes a picture for a format of type
  image and a video for type video, with the provider, model, ratio and quality it is handed, and
  takes no model, ratio or quality from the run's own arguments. It refuses in words, before
  anything is spent, a profile with no format, a format of another type, a provider signed out or missing, or a
  missing model. A value the vendor does not take is refused in the vendor's own words, as today.
- **Settings keeps the connection.** The Generators section keeps each service's standing, *Sign
  in*, the redirect paste and the workspace pick; the offered-models list, the names, the icons and
  the axes go, and every model a vendor offers is suggested under the vendor's own name. User
  decision, 2026-10-02.
- **The profile's setup goes.** *Profile type* and *Image backend* leave the profile's bar;
  `profileType` and `imageBackend` stop being read and are dropped from the `document` declaration.
  Nothing migrates them: after the upgrade an image or video profile has no format, generation
  under it is refused until the person creates a format and points the profile at it, and the
  release notes say so. User decision, 2026-10-02.

## Acceptance Examples To Shape At Draft

- Given Higgsfield signed in, Settings' Generators row shows its standing, *Sign in* and the
  workspace pick, and no list of models, names or icons.
- Given a new format of type image, its *Provider* field suggests Higgsfield and OpenArt; choosing
  Higgsfield, *Model* suggests Higgsfield's image models; choosing `gpt_image_2`, *Ratio* and
  *Quality* suggest what that model takes; typing a model the list does not hold keeps it.
- Given a profile, its *Format* field suggests every format by title, and may stay empty.
- Given an *Image* profile pointing at *Instagram square* (Higgsfield, `gpt_image_2`, 1:1, 1k),
  Send makes one picture with those values, and the profile's bar shows no *Profile type* or
  *Image backend*.
- Given a profile with no format, a Send asking for a picture is refused in words before anything
  is spent, saying to choose a format on the profile.
- Given a format of type video, Send under a profile pointing at it makes a video from the picture
  above the block.
- Given *Instagram square* (`gpt_image_2`, 1:1) listing the variation *Story 9:16* (ratio 9:16),
  the composer under a profile pointing at it shows a choice beside *Send* of *Instagram square*
  and *Story 9:16*; choosing *Story 9:16* makes one picture at 9:16 with `gpt_image_2`, and the
  choice then shows *Instagram square* again.
- Given a format with no variations, the composer shows no choice beside *Send*, and a Send whose
  words ask for another ratio makes the picture at the format's ratio.
- Given an instance whose *Image* profile saved Higgsfield, after the upgrade the profile has no
  format, and a Send asking for a picture is refused in words saying to choose a format on the
  profile.

## System Tasks

Transferred on 2026-10-02, after the user promoted the change to draft:

- Kernel: `docs/system/ui-kernel.md`, *Generation Settings Live In The Format*, `BO_0336_001`–`_004`
  (the format handed to a tool callback, the harness copy, the release lines, verification);
  `docs/system/media-service.md`'s fixed line on when the vendor is asked, revised.
- `media`: *Generation Settings Live In The Format*, `BO_0336_020`–`_026`, with its fixed lines
  revised; this change's copy stands in its `docs/changes/`.
- `doc-block-roles`: *Formats Carry Generation*, `BO_0336_010`–`_015`.
- `profiles`: *A Profile Names Its Format*, `BO_0336_030`.
- `documents`: *Profiles* in its block document model, `BO_0336_040`.
- `ui.shell`: the contribution contract's *A Variation And Suggestions*, `BO_0336_050`–`_052`.

## Boundaries And Source Documents

- Graph: `doc-block-roles` (the suggesting field shape, *Format*'s and *Profile*'s release fields,
  the *Variation* release role,
  the migration adding them), `media` (the suggestion sources, the Generators section reduced to
  the sign-ins, `media.generate` reading the format, the fixed lines above), `profiles` (the bar's
  setup removed), the shell (the variation choice beside *Send*), `documents` (`profileType` and `imageBackend`
  leaving the `document` declaration).
- Fixed layer: `docs/system/ui-kernel.md` (what a tool callback is handed in place of `BO_0320_005`'s
  `profileType` and `imageBackend`, and the variation chosen at *Send* reaching the run), `docs/system/media-service.md` if the service is asked for
  models and axes differently, the kernel harness's vocabulary copy.
- Owner in the graph: `media`, since the change is about what a generation is made with; its copy
  goes into `media`'s `docs/changes/`.
- Builds on `BO_0312` (its media walk `BO_0312_042`) and `BO_0320`, and on `BO_0309_024` for
  naming a reference by title.
- Release notes: *Breaking* for model choice leaving Settings and the profile's type and backend
  moving to formats, with existing image and video profiles needing a format before they generate
  again; *Added* for formats carrying provider, model, ratio and quality with
  suggestions, their variations chosen beside *Send*, the profile's *Format* field, and suggesting
  fields and role-limited references on the person's own roles.

## Closed

Completed on 2026-10-02. The walk was made on the served build for a format's image and its
variation; the user closed it there. The video was refused by the vendor for an unnamed start frame
(`media`'s `ME_0001`), and how a format takes a video's inputs is `media`'s `ME_0002`, whose
acceptance walks the video. The fixes found on the way are `profiles`' `PF_0001` and `documents`'
`DO_0032`.
