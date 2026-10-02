# Profiles

## Purpose

- This document is the entry point of `profiles`, the extension that keeps reusable instruction
  documents — profiles — on the instance and lets a person choose one for each command, so that
  the command's run is guided by the profile's accepted content. A profile is a document:
  authored and revised in the editor through the proposal loop, and an agent can be asked to
  draft or improve one (`calliopa-bootstrap`'s `BO_0298`, requested by the user on 2026-09-24
  and decided on 2026-09-24 and 2026-09-25). Its code blocks are tools the agent can call
  (`calliopa-bootstrap`'s `BO_0311`, part 3 of `BO_0308`, decided on 2026-09-30).
- It is `bundled` and active on a fresh install, and no starter profile ships, since instance
  content never travels (`BO_0298_Q3`).
- It depends on `documents`, whose `document` type declares the `record` slot a profile is told
  apart by ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#profiles)),
  on `doc-block-roles`, whose built-in *Profile* every profile takes, and on `ui.shell`, whose
  frame it contributes into. What a run receives, what its record says, the grants and the named
  secrets are the kernel's, and one call is the code service's (`calliopa-bootstrap`'s
  `docs/system/ui-kernel.md`, *The Profile In The Command, With Tools*, and
  `docs/system/code-service.md`, *Profile Tools*); the run detail's line is `ui.shell`'s
  ([Processes](../../../../docs/system/workspace/processes.md#the-run-used-a-profile)).
- Its change documents carry the prefix `PF`. A `PF` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does (`distribution.md`, Release Notes).

## What This Extension Holds

* A profile has the structure of a document; its authored content is the instructions supplied
  to the agent when it is chosen. User decision, 2026-09-24 (`BO_0298_Q3`).
* Anyone who can edit documents creates and maintains profiles, through the same proposal and
  acceptance loop. User decision, 2026-09-25 (`BO_0298_Q4`).
* A profile document's own chip starts at **No profile**; with none chosen a prompt in it
  addresses the profile's own instructions. User decision, 2026-09-25 (`BO_0298_Q9`).

## Image Generation Profiles

Under `calliopa-bootstrap`'s `BO_0320` (2026-09-30), a profile may be explicitly typed as an
image-generation profile. It carries a saved structured choice of image-generation backend; its
instructions do not determine the backend. The type and choice are profile data, available to the
`media` extension when `media.generate` runs for the selected profile. Codex is temporarily
unavailable: the profile setup does not show it, and existing saved Codex values remain unchanged.

- `BO_0320_011`: image-generation profiles carry a structured backend choice, independent of
  their instructions, and expose it to `media.generate`. Codex values remain stored for existing
  profiles, but profile setup hides Codex while generation through the current Codex sign-in route
  is unavailable.
- `BO_0320_013`: profile setup hides the temporarily unavailable Codex backend, including for
  profiles that already save Codex. The saved backend value remains unchanged when profile type
  changes.

## The Profile In The Chip, With Tools

Under `calliopa-bootstrap`'s `BO_0311` (`docs/changes/completed/BO_0311_FEAT_profile-in-the-chip-with-tools.md`,
part 3 of `BO_0308`, promoted to draft by the user on 2026-09-30 and transferred here the same
day): *Profile* is a built-in role. The profile is chosen per command from an icon in the active
block's chip, and a profile's code blocks are tools an agent can call. It follows `BO_0309`. The
kernel's half is `ui-kernel.md`, *The Profile In The Command, With Tools*, and one call's is
`code-service.md`, *Profile Tools*. Completed on 2026-10-01.

* *Profile* is a built-in role, and the *Profiles* category folds into *Roles*, where *Profile*
  lists the profiles (`BO_0308_Q5`, `BO_0308_Q11`).
* The profile choice is an icon in the active block's command chip, a dropdown opened by a press
  like the agent selector. The document bar's selector goes. The chosen profile belongs to the
  command. Nothing is stored on the document, and nothing is shared. A new command starts with the
  profile the person last sent with in this document, remembered for that person alone
  (`BO_0308_Q7`, reversing `BO_0298_Q1` and `BO_0298_Q8`). A document's attached profile is dropped
  on upgrade, so every chip starts at *No profile* (`BO_0311_Q1`).
* A code block in a profile is a tool the agent can use; the profile's words say how, but nothing
  requires them to. Without the owner's grant a call runs off every network. Only the owner
  grants, an accepted edit to a code block voids its grant, and credentials are the owner's named
  secrets in Settings (`BO_0308_Q8`, `BO_0311_Q2`–`BO_0311_Q5`). Tools run on the runtime the
  profile document is connected to (`BO_0311_Q6`). The grant control stands on the profile
  document for the owner alone, and Settings lists the grants and the secrets (`BO_0311_Q7`).
- A profile keeps its `record: profile` beside the built-in role, so `documents`' Documents
  listing, which leaves out profiles by that value, does not move. Creating a profile writes both.
  Technical decision at transfer, 2026-09-30.
- The built-in role (`BO_0311_010`): `POST /api/x/profiles/profiles` creates a profile as a
  document carrying `record: profile` and one empty text block, minted *Untitled profile*, and
  takes `builtin:profile` on it through `doc-block-roles`' `setRole`, so the *Roles* category's
  *Profile* row (`BO_0309_015`, its `documentsCarrying`) lists every profile. The Profiles
  section, its icon and the library listing of profiles are gone (`BO_0308_Q11`). Every instance
  takes the rest on upgrade, automatically, through the executable migration
  `migration-bo-0311-profile-in-the-chip` (route `kernel/migrations/profile-in-the-chip`, after
  `migration-bo-0309-builtin-roles`; `calliopa-bootstrap`'s `BO_0312_003` runs it): one script
  relating every profile that does not carry *Profile* to it, and clearing every document's
  attached profile (`documents`' `clearProfileSlotsStatement`, `BO_0311_020`), or nothing once
  both stand.
- The chip control (`BO_0311_011`, `views/chip.tsx`, `ProfileChip`): a `command` block place, the
  `compass` icon, named *No profile* or *Profile: <title>* and drawn in the accent once one is
  chosen, opening *No profile* first, then under *For this block's roles* the profiles carrying
  a role the document or the block takes, then the others, each by title. It reads
  `GET /api/x/profiles/documents/[id]/blocks/[block]/choices`, which answers the profiles with
  whether each carries such a role (the document's and the block's roles from `rolesOf`, the
  profiles carrying each from `documentsCarrying`, *Profile* itself left out), whether the
  document is itself a profile, and the person's last profile there. A choice calls the place's
  `setOption$("profile", id | null)` (`ui.shell`'s *Options On A Command*), so *Send* carries
  it, and nothing is written on the document. The chip starts with the person's last while it is
  still a profile, and at *No profile* on a profile's own document. The kernel keeps the last as
  a run starts, in its per-person state (`people/<person>/profile/<document>`), the person's
  alone. Nothing is drawn while the profiles cannot be read or the instance has none. This
  replaces the open `BO_0299_020`; the document bar's selector and the selection route are gone.
- A profile's setup from `calliopa-bootstrap`'s `BO_0320` — *Profile type* and, for an image
  profile, *Image backend* — stood in the selector's component, which went. It stays in the bar
  as a group of its own on a profile's document alone (`views/generation.tsx`,
  `ProfileGenerationSetup`, nested in `ProfileToolsProvider`, since one provider is all an
  extension contributes), read and saved through `GET`/`PUT
  /api/x/profiles/documents/[id]/generation-profile` as before; on any other document the read
  answers nothing and no group stands. Technical decision at the rebase onto head 3448,
  2026-10-01. Proven in `views/views.test.ts`, *a profile's setup in its document's bar*.
- A profile may be a video profile (`calliopa-bootstrap`'s `BO_0312`, user decision 2026-10-01):
  *Profile type* offers *Video generation* beside *Image generation*, and a video profile's backend
  is Higgsfield or OpenArt, never Codex, since Codex makes pictures only. A saved Codex backend
  stays when the type changes (`BO_0320_013`): the setup shows a video profile holding it no
  backend choice, as it shows an image one, and `media.generate` refuses it. `setProfileGeneration`
  (`documents`) refuses Codex for a video profile. `media.generate` makes a video under it
  ([Media](../../../media/docs/system/system.md#generation-is-an-agents-tool)). Proven in
  `views/views.test.ts`, *offers video generation*.
- The tools on a profile's document (`BO_0311_012`, `views/tools.tsx`): `ProfileToolsProvider`
  reads `GET /api/x/profiles/documents/[id]/tools` — whether the document is a profile, whether
  the person is the owner, the kernel's grant answer and, for the owner, the named secrets — and
  `ToolHeadline`, a `headline` place, writes on each code block its tool name and *granted*,
  *changed since the grant* or *offline*, or *cannot run: the profile is connected to no
  runtime*, for everyone who reads it. For the owner alone the provider writes the bar group
  *Profile tools*: the toggle *Outside reach* (`globe`), on to grant every code block as it
  stands and off to revoke; one toggle per set named secret the grant may read, which re-grants
  while a grant stands; and *Grant again* once a block changed since the grant. Each forwards to
  the kernel's `/__kernel/profiles/<id>/grant` through `PUT` and `DELETE
  /api/x/profiles/documents/[id]/grant`, which answer a refusal as `{error}` in the kernel's
  words, raised as a message. A document that is no profile draws nothing.
- The owner's *Profile tools* in Settings (`settings`' `BO_0311_040`) is this extension's
  contributed settings section (`views/settings.tsx`, `owner: true`), so `settings` knows
  nothing of profiles: the granted profiles by title with who granted each, when, and which
  secrets each reads, each with *Revoke*; and the named secrets with whether each is set and its
  last characters, each replaced or cleared, and a new one added by name and value. Its routes
  are `GET /api/x/profiles/settings` and `PUT`/`DELETE /api/x/profiles/secrets/[name]`, forwarded
  to the kernel, which holds them to the owner. A value is never shown once saved.
- The server half's routes are `contributions.server.ts`, and what they do is
  `server/profiles.ts` (`createProfile`, `choicesFor`, `profileInTheChip`), which the behaviour
  suite calls. Technical decision at implementation, 2026-10-01.
- Verified (`BO_0311_013`, the unit and behaviour parts): `views/views.test.ts` in Qwik's render
  harness — the chip restoring the person's last, *No profile* then the block's roles' profiles
  then the rest, a choice and *No profile* set as the command's option, *No profile* on a
  profile's own document and for a last that is no profile any more, and nothing drawn when the
  profiles cannot be read or there are none; the headlines' states for the owner and for anyone
  else, *cannot run* with no runtime, the bar group for the owner alone with a toggle per set
  secret, a grant posting the chosen secrets, a revoke, *Grant again*, and a refusal raised in
  the kernel's words; and the Settings section listing and revoking a grant and adding a secret
  without ever showing its value. `tests/behavior/profiles.test.ts` under the kernel harness — a
  profile created carrying *Profile* while one made before the role does not; the chip's choices
  marking the profile that carries a role the document takes, and the person's last read back,
  none on a profile's own document; the migration giving the role and dropping an attached
  profile, then finding neither; and a grant and a revoke through the kernel naming a code block
  the tool `send_an_email`. `tsc --noEmit` clean with the registry generated.
- A document taking *Profile* is a profile (`BO_0311_015`, found in the walk on 2026-10-01: a
  document given *Profile* from its chip stood in the *Roles* category's *Profile* row and was
  missing from every command's chip, since the chip, the run start and the grant read
  `record: profile`). Taking *Profile* on a document writes the record in the same statement, and
  clearing it clears the record (`doc-block-roles`' `takeStatement` and `clearStatement`, a
  proposed role too). Every instance gives the carriers that lack it the record on upgrade, through
  the executable migration `migration-bo-0311-profile-record` (route
  `kernel/migrations/profile-record`, after `migration-bo-0311-profile-in-the-chip`): one script
  setting the record on each, or nothing. A document so made a profile leaves the Documents
  category, as every profile does (`BO_0298_Q4`). Proven in `tests/behavior/profiles.test.ts`: a
  plain document taking *Profile* told apart as a profile and offered in the chip, clearing the
  role making it a document again, and the migration giving a carrier the record and then finding
  nothing.
- Walked by the user on the served build on 2026-10-01 (`BO_0311_013`, pins 3469 and 3589), and the
  user said it works: a profile chosen in a block's chip and restored in the next command there;
  *Mailer*, whose code block is the tool `the_following_code_sends_an_email` (named from the
  sentence before it, the block having no caption), called with no network and failing to resolve
  its address, then granted outside reach with the secret `smtp` and reaching the network on
  `runtimes` — the run's record naming each call, its network and its error — and offline again
  after an accepted edit until granted again. The walk found that a document given *Profile* from
  its chip was missing from the chip, fixed as `BO_0311_015` above.
- The change document stands in `docs/changes/completed/` at `Status: completed`
  (`BO_0311_014`); `calliopa-bootstrap`'s `BO_0311_009` release lines stand, and the graph export
  that follows the acceptance closes the change in the repository.
