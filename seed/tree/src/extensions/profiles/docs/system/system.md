# Profiles

## Purpose

- This document is the entry point of `profiles`, the extension that keeps reusable instruction
  documents — profiles — on the instance and attaches one to a document, so that every prompt
  sent from that document is guided by the profile's accepted content until the person changes
  the selection. A profile is a document: authored and revised in the editor through the
  proposal loop, and an agent can be asked to draft or improve one (`calliopa-bootstrap`'s
  `BO_0298`, requested by the user on 2026-09-24 and decided on 2026-09-24 and 2026-09-25).
- It is `bundled` and active on a fresh install, and no starter profile ships, since instance
  content never travels (`BO_0298_Q3`).
- It depends on `documents`, whose `document` type declares the `profile` property and the
  `record` slot a profile is told apart by
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#profiles)),
  and on `ui.shell`, whose frame it contributes into. What a run receives and what its record
  says are the kernel's (`calliopa-bootstrap`'s `docs/system/ui-kernel.md`, Profiles); the run
  detail's line is `ui.shell`'s
  ([Processes](../../../../docs/system/workspace/processes.md#the-run-used-a-profile)).
- Its change documents carry the prefix `PF`. A `PF` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does (`distribution.md`, Release Notes).

## What This Extension Holds

* A profile has the structure of a document; its authored content is the instructions supplied
  to the agent when it is selected. User decision, 2026-09-24 (`BO_0298_Q3`).
* The selection stays attached to the document and applies to every later prompt sent from it
  until the person changes it; **No profile** is a valid choice and clears it. User decisions,
  2026-09-24 (`BO_0298_Q1`).
* Anyone who can edit documents creates and maintains profiles, through the same proposal and
  acceptance loop; profile documents list only in the Profiles category. User decisions,
  2026-09-25 (`BO_0298_Q4`).
* Attaching a profile is the person's direct act, established at once with no proposal, and the
  attachment is the document's — one per document, seen and changeable by everyone with access.
  User decisions, 2026-09-25 (`BO_0298_Q7`, `BO_0298_Q8`).
* A profile document shows the selector too, defaulting to **No profile**; with none selected a
  prompt in it addresses the profile's own instructions. User decision, 2026-09-25
  (`BO_0298_Q9`).
- The Profiles category (`BO_0298_014`, landed 2026-09-25; `contributions.ts`,
  `views/section.tsx`): a section under *Profiles*, Phosphor `compass` — added to the shell's
  icon table at regular weight, unaltered — listing the profiles by title (`readers.profiles`,
  `GET /api/library/profiles/profiles`, over `documents`' `listProfiles`), each opening in the
  `documents:document` kind through the view bridge with the active one marked. Its own `+`
  (`data-new-profile`) creates a profile through `POST /api/x/profiles/profiles` — a document
  carrying `record: profile` and one empty text block, minted *Untitled profile* — unnamed by
  `documents`' naming rule, so the headline paints those words as its placeholder and the row is
  drawn muted until the person names it — and opens it. The section opens `documents:document`
  (`LibrarySection.opens`), so the shell re-reads it when a profile is renamed or deleted. The section is a component rather than the
  header's create control because a section's create control opens a kind of the section's own
  extension, and a profile is `documents`' kind. Technical decision at implementation,
  2026-09-25.
- The selection route (`BO_0298_015`, landed 2026-09-25; `contributions.server.ts`):
  `GET /api/x/profiles/documents/[id]/selection` answers `{profile: {id, title} | null, gone}`
  through `documents`' `readProfileSelection`, `gone` naming an attached id the graph no longer
  holds as a profile; `POST` with `{profile}` — an id or `null` for **No profile** — writes it
  through `setProfile` as the signed-in person's own act, as truth outside any branch, and
  answers what it wrote. A document that is not there is `404` in words, a profile that is not
  one a validation failure naming it, and a body that is neither an id nor `null` `400`.
- The selector (`BO_0298_016`, landed 2026-09-25; `views/selector.tsx`, `ProfileSelector`): a
  decoration provider of the `document` kind writing its own group *Profile* into the shell's
  decoration bar — one `choice` action, `profile-selection`, **No profile** first and every
  profile by title, its value the document's selection, read with the listing through the routes
  when the document changes — drawn after the view's groups as every decoration group is, on
  every document tab, a profile's own included. A choice posts and the control shows the answer;
  a refusal is raised in the route's words and the selection stands. A selection naming a
  profile that is gone is drawn as *The selected profile is gone* with **No profile** offered,
  and choosing that line writes nothing. Nothing new was needed in the contract: the decoration
  bar and the choice action are the slot (`ui.shell`'s `BO_0298_030`).
- Verified 2026-09-25 (`BO_0298_017`, the unit and behaviour parts): `views/views.test.ts` in
  Qwik's render harness — the rows by title with the active one marked, a row opening the
  document tab, the `+` posting the create and opening what came back, the empty and the
  unreadable state; the selector's options with **No profile** first, the selection shown, a
  choice posted as `{profile: id}` and reflected, **No profile** posted as `null`, the gone line,
  and a refusal raised in the route's words with the selection kept. `documents`'
  `tests/behavior/profiles.test.ts` over CCGW under the kernel harness — a profile created with
  its record listing among the profiles and not among the documents, a selection set and read
  back as truth and cleared to none, and the three refusals. `tsc --noEmit` clean with the
  registry generated.
- Walked by the user on the served build at pin 2603 on 2026-09-25 (`BO_0298_017`), and the
  user said it works: profiles created and written in the category, attached from the bar, a
  prompt guided by one profile and then by another, the run's detail naming the profile. Two
  findings, fixed in the same day's second proposal: a new profile showed its minted name as
  text rather than as the placeholder a new document shows, and a renamed profile kept its old
  title in the category until the next reload — the naming rule and the section's `opens` above.
- The change document stands in `docs/changes/completed/` at `Status: completed`
  (`BO_0298_018`); the graph export that follows the acceptance closes the change in the
  repository.
  `docs/changes/completed/`, in the proposal that folds the walk, and the graph export after it.
