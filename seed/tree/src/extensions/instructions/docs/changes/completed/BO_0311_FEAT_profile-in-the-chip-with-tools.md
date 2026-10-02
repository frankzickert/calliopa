# The Profile In The Chip, With Tools

Status: completed

Part 3 of 5 of `BO_0308`, after `BO_0309`. *Profile* is a built-in role. The profile is chosen per
command from an icon in the active block's chip, and a profile's code blocks become tools the
agent can call, reaching outside the instance only once the person has granted that profile outside
reach. This document shapes the change and authorizes no implementation.

## What Is Asked

* *Profile* is a built-in role. A profile is an ordinary document carrying it, and it adds to the
  prompt as it does today (`BO_0298`).
* The profile choice is an icon in the active block's command chip: a dropdown opened by a press,
  like the agent selector. The document bar's profile dropdown goes away.
* The chosen profile belongs to the command it is sent with. Nothing is stored on the document,
  and nothing is shared between people. A new command starts with the profile the person last sent
  with in this document, remembered for that person alone (`BO_0308_Q7`, reversing `BO_0298_Q1`
  and `BO_0298_Q8`).
* A code block in a profile is a tool the agent can use. The profile's words should say how to use
  it; nothing technically requires them to.
* A profile's tools reach outside the instance (network, mail, billing) only once the person has
  granted that profile outside reach. Once granted, they run when the agent calls them, with no
  press per call. Without the grant, only a tool that reads, or writes into the run's own
  proposals, runs (`BO_0308_Q8`).
* The *Profiles* category folds into *Roles*, where *Profile* lists the profiles (`BO_0308_Q11`).
* A document's currently attached profile is dropped on upgrade: every chip starts at *No
  profile* until the person chooses. User decision, 2026-09-30 (`BO_0311_Q1`).
* Only the instance owner may grant a profile outside reach, since a grant lets any run under that
  profile spend and send without a press, for everyone who uses it. User decision, 2026-09-30
  (`BO_0311_Q2`).
* A grant covers a profile's code as it stood when granted. An accepted edit to a code block
  leaves that block without outside reach until the owner grants it again. User decision,
  2026-09-30 (`BO_0311_Q3`).
* A tool's credentials are named secrets the owner stores in Settings. A granted tool's code reads
  the ones it names from its environment, and a secret is never written in a profile's words. User
  decision, 2026-09-30 (`BO_0311_Q4`).
* Without the owner's grant, a profile tool's call runs off every network. This narrows the code
  service's fixed rule that every runtime always reaches the internet, for this one kind of call.
  User decision, 2026-09-30 (`BO_0311_Q5`).
* A profile's code tools run on the runtime the profile document is connected to, each call in a
  session of its own. A profile with no runtime offers no tools. User decision, 2026-09-30
  (`BO_0311_Q6`).
* The owner grants outside reach from a control on the profile document, shown to the owner
  alone, and Settings lists the granted profiles and the named secrets. User decision, 2026-09-30
  (`BO_0311_Q7`).

## Where This Starts

- `profiles` (`src/extensions/instructions/docs/system/system.md`): a profile is a document with
  `record: profile`, with one shared `profile` slot on `document` chosen in the bar. The kernel
  reads the slot at the pin and renders the profile as the last instruction section, and the
  record names it (`ui-kernel.md`, *Profiles*, `BO_0298_001`–`BO_0298_005`).
- The chip carries the agent selector and contributed `command` block places (`ui.shell`,
  `workspace/commands-and-runs.md`).
- A code block runs in the code service, and its output lands after it (`BO_0289`,
  `docs/system/code-service.md`). A run's extension tools answer with statements, never a write
  (`BO_0264_007`).

## Proposed Shape

- **Migration.** Every document with `record: profile` takes *Profile*. The document's `profile`
  slot is dropped with its values (`BO_0311_Q1`).
- **Chip.** `profiles` contributes a `command` place: a compass icon opening the profiles and *No
  profile*, the ones matching the block's roles first. The choice goes in the command's intake
  envelope as `profile`. The last choice per person and document is kept in the person's own
  settings record.
- **Kernel.** The intake takes `profile` from the envelope instead of reading the document's slot.
  It still reads the profile at the pin, and still refuses in words a profile the pin cannot honour.
- **Tools.** At run start, each code block of the chosen profile is offered as a tool named from
  its caption, or else the paragraph before it, with a JSON object as input on standard input. A
  call runs the block in the code service at the run's pin and answers its output to the run. The
  call is recorded in the run record.
- **Grant.** A grant is stored on the profile as the granting person's truth, and names the
  revision of each code block it covers. The code service opens network access only to a call
  under a granted profile. Without a grant the call runs with no network.

## Functional Questions

- None open. `BO_0311_Q1`–`BO_0311_Q7` are answered in What Is Asked; `Q5`–`Q7` came up at transfer.

## Acceptance Examples To Shape At Draft

- Given an active block, its chip shows the profile icon. Choosing *Blog post* makes that command
  use it. The next command in the document starts with *Blog post* for that person, while another
  person's chip starts with their own last choice. The document bar has no profile dropdown.
- Given a profile holding a code block captioned *Send an email*, before any grant a run calling it
  gets no network and says so. Once the profile is granted, a run asked to mail a summary sends it,
  and the run record shows the call.
- Given a granted profile whose code block is edited and accepted, the next call runs without
  outside reach until the owner grants it again. A person who is not the owner sees no grant
  control.
- Given a secret *smtp* stored in Settings and a granted mail tool naming it, the call reads it
  from its environment, and the secret appears in no run record or proposal.
- Given a document with *Blog post* attached before the upgrade, after it every person's chip
  starts at *No profile*.
- Given the *Roles* category, *Profile* lists every profile, and there is no *Profiles* icon.

## Boundaries And Source Documents

- Graph: `profiles`' `system.md`; `documents`' `block-document-model.md`, *Profiles*; `ui.shell`'s
  `workspace/commands-and-runs.md` and `contribution-contract.md` (`command` places) and
  `workspace/processes.md`, *The Run Used A Profile*.
- Fixed layer: `docs/system/ui-kernel.md`, *Profiles* and the intake envelope and run tools;
  `docs/system/code-service.md` for running a block as a tool and network per call;
  `docs/system/hermes.md` for tools offered per run.
- Owner: `profiles`. Release note: *Changed* for the chip; *Added* for code tools.

## Transferred

Promoted to draft by the user on 2026-09-30 and transferred the same day. Three questions came up
at transfer and were answered the same day (`BO_0311_Q5`–`BO_0311_Q7`). It builds on `BO_0309`
and is implemented after it.

### The fixed layer, in this repository

- `docs/system/code-service.md`: a new fixed line narrowing *always reaches the internet* for an
  ungranted profile tool call (`BO_0311_Q5`), and *Profile Tools* with `BO_0311_001`, one call in
  a throwaway container on `none` or the runtimes' network.
- `docs/system/ui-kernel.md`, *The Profile In The Command, With Tools* (new): `BO_0311_002` the
  profile from the command; `_003` the tools named in the profile section and `run_profile_tool`;
  `_004` a call, with secrets redacted; `_005` grants by content hash; `_006` named tool secrets;
  `_007` the document's `profile` slot leaving the kernel; `_008` verification and the rebuild.
- `docs/system/distribution.md`: `BO_0311_009`, the release lines under *Changed* and *Added*.

### The graph, staged 2026-09-30

- Staged from a fresh checkout at head 3219 as `node:chg-7acdb890b640341a`: four files, tasks
  only, zero removals. The accept is in `docs/changes/scratchpad.md`.
- `profiles`' `system.md` gains *The Profile In The Chip, With Tools*: the decisions and
  `BO_0311_010`–`_014` (the built-in role, the chip control, the grant control, verification and
  walk, close).
- `documents`' `block-document-model.md`, *Profiles*: `BO_0311_020`, the `profile` slot leaving.
- `ui.shell`'s `workspace/contribution-contract.md` gains *Options On A Command* with
  `BO_0311_030`.
- `settings`' `settings-surface.md` gains *Profile Tools* with `BO_0311_040`, the owner's section
  for grants and secrets.

### Technical decisions taken at transfer

- One kernel tool, `run_profile_tool {name, input}`, with the tools named in the profile section,
  rather than one MCP tool per code block. The toolset's list may be cached by the runtime, so a
  per-run list would arrive stale.
- A call runs in a throwaway container from the profile runtime's image, never in the runtime
  itself. That is how an ungranted call goes offline while the runtime keeps its internet. A
  package installed by hand in the runtime is therefore not there; the image is.
- A grant records each code block's content hash, so an accepted edit voids exactly that block's
  grant.
- Secret values passed to a call are replaced by `«secret»` in what the run and the record see.
- A profile keeps `record: profile` beside the built-in role, so the Documents listing's rule does
  not move.
- The last profile per person and document lives in the person's workspace state. The command's
  choice travels as an option a `command` place sets on its command.

## Completed

Set to ready by the user, implemented on 2026-10-01, walked by the user on the served build the same
day, and completed. The truth is in `docs/system/` (`code-service.md`, *Profile Tools*;
`ui-kernel.md`, *The Profile In The Command, With Tools*; `distribution.md`) and in the extensions'
graph docs (`profiles`, `documents`, `ui.shell`, `settings`, `doc-block-roles`); this section only
says how it closed.

- The graph half was accepted as `chg-f4a73a53d0d8896d`, rebased onto head 3461 by the session
  carrying `BO_0312`, and served at pin 3469 once `BO_0321`'s lost editor half was restored.
- The walk found that a document given *Profile* from its chip was missing from the chip, since
  the chip, the run start and the grant read `record: profile`. Fixed as `BO_0311_015`
  (`chg-17ef5aa983447a0f`, pin 3589): taking *Profile* on a document writes the record, and a
  migration gave existing carriers the record.
- Left open: a tool secret named like a variable the kernel sets for a call (`CALLIOPA_INPUT`)
  is stored without complaint; `ui-kernel.md` carries it as `BO_0311_016`.
