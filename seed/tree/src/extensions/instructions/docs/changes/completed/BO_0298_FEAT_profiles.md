# Profiles

Status: completed

Requested: 2026-09-24. A new `profiles` extension provides instance-managed, reusable
instruction documents that guide the direction of an agent's work on a document. A person
manages profiles in a left-panel category and can use an agent to create and maintain them.
This document shapes the change; it authorizes no implementation.

## What Is Asked

* Profiles are managed on the instance. The person can create and maintain the instructions
  they need and reuse a profile across documents.
* The `profiles` extension is bundled with Calliopa. User decision, 2026-09-24
  (`BO_0298_Q3`).
* No starter profiles are bundled for now. Exploration and Blog post are examples of
  profiles the person can create on the instance, including with agent assistance.
  User decision, 2026-09-24 (`BO_0298_Q3`).
* A profile has the same structure as a document. Its authored content becomes the reusable
  instructions supplied to the agent when that profile is selected.
* The left panel has a **Profiles** category where the person manages profiles.
* Choosing a profile guides the direction of the agent's work together with the person's
  prompt and the content of the document.
* The selected profile stays attached to the document and applies to future prompts sent
  from that document until the person changes it. The person can change the attached profile
  at any time as the direction of the work changes: start with Exploration, then select
  Blog post on the same document to turn the developed content into a blog post. Subsequent
  prompts use the newly selected profile, which stays attached until changed again.
  User decisions, 2026-09-24 (`BO_0298_Q1`).
* The profile selector is a dropdown in the toolbar at the top of the tab content. It lists
  all available profiles and shows the document's selected profile. User decision,
  2026-09-24 (`BO_0298_Q1`).
* **No profile** is a valid selection in the dropdown. Choosing it clears the document's
  attached profile; subsequent prompts receive no additional profile instructions until
  a profile is selected again. User decision, 2026-09-24 (`BO_0298_Q1`).
* With **Exploration**, the agent uses the prompt as the basis for exploring the page's
  content further and beyond it: developing questions, connections and avenues to investigate.
* With **Blog post**, the agent aims to turn the content of the entire document into a blog
  post. Its scope includes the whole document, even though the prompt is written in one block.
* The person can ask an agent to create a profile and to maintain an existing profile,
  including revising its instructions as their needs change.
* Every run uses the selected profile's latest accepted instructions at run start. Accepted
  edits apply to the next run in every document using that profile; runs already underway
  keep their original instructions. Unaccepted proposed edits are not active instructions.
  User decision, 2026-09-24 (`BO_0298_Q2`).
* Anyone who can edit documents can create and maintain profiles. A profile is a document, so
  authoring and revising it go through the same proposal and acceptance loop; there is no
  separate management permission. User decision, 2026-09-25 (`BO_0298_Q4`).
* Profile documents list only in the Profiles category, told apart by a `record` value on the
  document node the way investigations are; the Documents category leaves them out. User
  decision, 2026-09-25 (`BO_0298_Q4`).
* A profile is neither an intention nor a replacement for skill selection. The document gets a
  profile slot beside its `intention` property; intention resolution and skill selection stay
  as they are, and the kernel supplies the selected profile's accepted content as one more
  instruction section at run start. A document may carry an intention and a profile at once.
  User decision, 2026-09-25 (`BO_0298_Q6`).
* Precedence when directions differ: the explicit prompt controls the current request, the
  profile supplies reusable guidance, and the intention's skills keep their method rules.
  Permission and acceptance rules remain binding regardless of the profile. User decision,
  2026-09-25 (`BO_0298_Q5`).
* Attaching a profile is the person's direct act, established at once: choosing in the dropdown
  writes the document's profile slot as the person's own act, the way opening focused work or
  marking an investigation does, and the next prompt uses it. No proposal is raised and nothing
  is accepted. User decision, 2026-09-25 (`BO_0298_Q7`).
* The attachment is shared: one profile per document, seen and changeable by everyone with
  access to it. User decision, 2026-09-25 (`BO_0298_Q8`).
* A profile document shows the dropdown too, defaulting to **No profile**, so a person may guide
  the authoring of a profile with another profile. With no profile selected, a prompt in a
  profile document addresses that profile's own instructions. User decision, 2026-09-25
  (`BO_0298_Q9`).
* The run record carries the profile and the revision of its content the run received, shown in
  the run's detail where the console opens a process. The run chip in the document stays as it
  is. User decision, 2026-09-25 (`BO_0298_Q10`).

## Proposed Shape

- `profiles` owns the profile identity, its listing and management, and the selection that
  connects a profile to agent work. Reuse `documents`' structure, editing and proposal behavior
  rather than introducing a separate instruction editor or a second block model.
- Profile definitions are instance content. Editing their instructions should require an
  ordinary content edit, not an extension source change, rebuild or promotion.
- A profile opens as a document that the person can read and edit. A prompt in that document
  can ask an agent to improve the profile; the agent proposes changes and the person accepts
  or rejects them through the existing document workflow.
- A profile's instruction content and a prompt asking to revise that content have distinct
  roles. Maintaining a Blog post profile must let the agent improve its instructions, rather
  than accidentally treating the profile itself as material to turn into a blog post.
- At a run's start, resolve the selected profile and supply its instruction content alongside
  the prompt and document context. Preserve the profile identity and the revision used with
  the run so later edits do not obscure which instructions guided it.
- Selection guides a run when the person sends a prompt. Selecting or editing a profile
  alone does not start an agent or change another document.
- Profiles guide content and approach within the existing tool, permission and human
  acceptance contracts; the relationship with intention and skill selection is decided above
  (`BO_0298_Q6`).

## Functional Questions

- None open. `BO_0298_Q1`–`BO_0298_Q10` are answered in What Is Asked.

## Acceptance Examples To Shape At Draft

- Given a fresh Calliopa installation, the bundled Profiles extension is available without
  starter profile content; the person creates the profiles they want.
- Given an open document tab, the toolbar at the top of its content shows a profile dropdown
  listing all available profiles; choosing one sets the document's attached profile.
- Given a document with a selected profile, when the person chooses **No profile**, the
  selection is cleared and subsequent prompts run without additional profile instructions.
- Given a document with a selected profile, when the person returns to the document and
  sends another prompt without changing the selection, the same profile applies without
  being selected again.
- Given a document developed using Exploration, when the person changes its attached
  profile to Blog post and sends a prompt, the agent uses Blog post's instructions to shape
  the accumulated document content into a blog post. Blog post remains selected for later
  prompts until the person changes it again.
- Given an Exploration profile and a document with a prompt, when the person selects that
  profile and sends the prompt, the agent receives its instructions and proposes further
  exploration grounded in the prompt and the document, including relevant avenues beyond it.
- Given a Blog post profile and a document with several sections, when the person sends a
  prompt with that profile selected, the agent reads the whole document and proposes a blog
  post shaped from its content rather than rewriting only the prompt block.
- Given a saved profile, when the person uses it on another document, its instructions are
  reusable without retyping or copying them into that document.
- Given the Profiles category, when the person creates and opens a profile, they can author
  it with the document structure and editing surface they already use.
- Given a request to create or revise a profile, the agent can propose its instruction
  content, and the person can review and accept it before it guides subsequent work.
- Given a run using a profile, a later profile edit does not change what that running agent
  was instructed to do; the run records which profile content it received.
- Given several documents using Blog post, when an edit to that profile is accepted, the
  next run in each document uses the updated instructions without reselecting the profile.
  A proposed edit awaiting acceptance does not affect those runs.
- Given a document that carries an intention, when the person attaches a profile and sends a
  prompt, the run keeps the intention's skills and receives the profile's instructions besides;
  neither displaces the other.
- Given a person choosing a profile in the dropdown, the attachment is established at once with
  no proposal to accept, and another person opening the same document sees the same selection.
- Given the Documents category, profile documents are not listed there; the Profiles category
  lists them.
- Given an open profile document, its dropdown shows **No profile** until the person chooses
  one; a prompt sent with none selected addresses the profile's own instructions.
- Given a completed run that used a profile, the run's detail names the profile and the
  revision of its content the run received.

## Boundaries And Source Documents

- Read from a fresh graph checkout at dataRevision **2537** on 2026-09-24. The graph paths
  below name the authoritative extension docs; this idea does not establish their behavior.
- `ui.shell`: `docs/system/workspace/contribution-contract.md` for the Profiles category and
  contributed controls; `docs/system/workspace/commands-and-runs.md` for sending a block's
  command; `docs/system/agent/tool-access.md` for the agent's content access.
- `documents`: `src/extensions/documents/docs/system/system.md`,
  `docs/system/documents/block-document-model.md` and `docs/system/documents/command-mode.md`
  within that extension for document structure and block prompts. Read its editor and
  proposal topics when transferring the management and agent-authoring work.
- Fixed layer: `docs/system/extension-model.md` for extension members and instance content;
  `docs/system/ui-kernel.md` for run intake, instructions and extension tools; and
  `docs/system/hermes.md` for the agent contract.
- The contribution contract offers no slot yet for one extension to place a control in the
  view bar of another extension's tab; it has sections, kinds, readers, routes, parties,
  settings sections, a citation resolver and a control in the command chip. The profile
  dropdown in the document tab needs such a slot, from `ui.shell`'s contract or from
  `documents`' view, decided and enumerated at draft.
- The run record's profile and content revision (`BO_0298_Q10`), and the run start reading the
  document's profile slot and supplying its accepted content as an instruction section
  (`BO_0298_Q6`), are kernel work enumerated in `docs/system/ui-kernel.md` at draft.
- This is a `BO` change spanning the new extension, its document and shell integration, and
  the kernel's run context and record. At draft, determine the smallest required contract
  additions and enumerate tasks in each owner's system docs. Keep profile behavior in
  `profiles`' graph docs, with pointers from the fixed-layer tasks.
- The new extension must name its own change prefix in its `docs/system/system.md`. This
  cross-boundary change travels as the same `BO_0298` document into its `docs/changes/`, at
  the same status, through a checkout proposal. Code and extension docs travel together.
- Implementation closure includes the accepted graph change, the graph export, and a release
  note for anything the release ships. This idea changes no shipped behavior, so none is due
  at capture time.

## Transferred

Promoted to draft by the user on 2026-09-25 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Profiles*: `BO_0298_001`–`BO_0298_006`. The run start reading the
  profile document at the pin and rendering its established words as one instruction section
  after the skills, the distinct-roles sentence for a run aimed at a profile, the record's
  `Profile`, the intake refusal of a selection the pin cannot honour, the harness vocabulary, the
  verification with the byte-identity proof, the image rebuild.
- `docs/system/distribution.md`, *The Release Names Its Extensions*: `BO_0298_007`
  (`release-extensions.json`, the Licences enumeration, the *next release ships …* line) and
  `BO_0298_008` (the release note under *Added*).
- `docs/system/extension-model.md` and `docs/system/hermes.md` need nothing: the `record` value is
  a declaration by instance as `investigation` is, and the instructions already reach every
  runtime.

### The graph, staged 2026-09-25

- Staged from a checkout at dataRevision 2548 as `node:chg-ff88bb49180f288c`, four files and
  nothing else, tasks only — nothing in the proposal implements anything. `documents`' `block-document-model.md` gains *Profiles* with the fixed decisions and
  `BO_0298_010`–`BO_0298_018`: the `profile` slot on the `document` declaration, the Documents
  listing leaving profiles out, the exported server functions, the extension's creation (`_013`,
  after which `_014`–`_018` move into its own `system.md` in the same proposal), the Profiles
  category, the selection route, the selector as a `bar` document place, the verification with the
  walk, and the docs. `block-editor.md` gains *Profiles* with `BO_0298_020`, the bar drawing
  contributed `bar` places as a group of its own. `ui.shell`'s `workspace/contribution-contract.md`
  gains *A Control In The View Bar* with `BO_0298_030` (`bar` joins `DocumentPlace`) and
  `workspace/processes.md` *The Run Used A Profile* with `BO_0298_031` (the detail's line).
- The change document is not carried into the graph yet: its owner is `profiles`, which
  `BO_0298_013` creates, and that task carries the document into the extension's `docs/changes/`
  in the same proposal. Until then the graph lists the work under `documents`.

### Technical decisions taken at transfer

- The profile is read from the document node at the run's pin, not sent by the shell: the
  attachment is the document's (`BO_0298_Q8`), so the kernel reads the same fact every reader
  sees, and the intake envelope grows no field.
- The content revision is the run's pin, already recorded; `Profile` on the record carries the
  id and the title alone.
- A selection applies to a command sent from the document; a gesture and a triggered run read no
  profile, since each names its own question under an intention.
- A selection the pin cannot honour — the profile gone, or not a profile — refuses the run at
  intake in words rather than starting it unguided.
- The selector is one more `DocumentPlace`, `bar`, as the command chip's control was one more
  `BlockPlace`; the bar draws contributed places as one group between *View* and the block groups.
- The write of the selection and the creation of a profile are `profiles`' routes over
  `documents`' exported server functions, the way `calliopa-refine`'s press imports
  `openFocusedWork`; the `record` value `profile` is written and read and enforced by nothing.
- The extension's change prefix is `PF`, free among the prefixes in use.

## The Kernel Half Landed

- 2026-09-25, `BO_0298_001`–`BO_0298_005` in `docs/system/ui-kernel.md`, *Profiles*:
  `agentbridge/bridge.go` (`readProfile`, `profileNote`, `Run.Profile`, `RunProfile`),
  `agenttools/standing.go` and `documents.go` (`Document.Title`/`Record`/`Profile`, the view's
  `record` and `profile`), `serve/testdata/documents-vocabulary.json`, and
  `agentbridge/profile_test.go`. The section is the instructions' closing section, after the
  skills; the golden of every earlier rendering held unchanged. `BO_0298_006`, the image
  rebuild, is the user's.
- Uncommitted in the repository: those five files and these docs.

## The Graph Half

- 2026-09-25, staged from a fresh checkout at dataRevision 2595 as `node:chg-7badd988c68add3f`,
  22 files and one member: `documents`' `lib/profile.ts` and `server/documents.ts` (`BO_0298_010`–`_012`, with
  the `document` declaration widened through the members sidecar), the `profiles` extension
  (`BO_0298_013`–`_016`: manifest, the two halves, the section, the selector, its `system.md`
  and this document), `ui.shell`'s `icons.tsx` (compass), `server/agent/bridge.ts`,
  `routes/api/processes/[id]/profile`, `shell.tsx` and `inspector.tsx` (`BO_0298_031`), and the
  four docs folded. `BO_0298_020` and `BO_0298_030` needed nothing built: the decoration bar and
  the choice action were the slot.
- Verified in the tree: `tsc --noEmit` clean with the registry generated; the profiles views
  in the render harness (6), the process detail (`process-selection.test.ts`), the registry
  tests; the behaviour project under the kernel harness with `documents`'
  `tests/behavior/profiles.test.ts` green (the failures beside it — the theme-token check, the
  outward reach, two phase cases — fail on head without this change too); the whole unit
  project green but for two cases that fail on a pristine head checkout as well
  (`never-waits.test.ts`, `block-depth.test.ts`).
- Left: `BO_0298_006` (the user's rebuild), `BO_0298_017`'s walk on the served build,
  `BO_0298_007`–`_008` (the release lines, after the manifest is in), `BO_0298_018` (the close).

## Served

- 2026-09-25: the graph half accepted, the stack rebuilt by the user (`BO_0298_006` folded) and
  head pinned at 2603, which serves eleven extensions with `profiles` among them, active. The
  credential-free half of the walk ran from a probe agent's session inside the kernel container:
  the profiles listing answers reachable and empty, a document's selection answers none, a
  document that is not there `404` in words, a selection naming a missing profile the validation
  failure naming it, and the served page registers the Profiles section with the compass beside
  the other categories. The writes and the runs are the user's half, in the scratchpad.

## Walked

- 2026-09-25, on the served build at pin 2603, by the user, who said it works. Two findings,
  fixed the same day: a new profile's minted name stood as text in the headline rather than as
  the placeholder a new document shows (`documents`' naming rule now knows `UNNAMED_PROFILE`
  and answers the placeholder by the record, the view carrying `record`), and a renamed profile
  kept its old title in the Profiles category until a reload (`LibrarySection.opens` in the
  shell's contract: a section naming another extension's kind is re-read when a tab of that kind
  changes, refused when nothing contributes it; `profiles` names `documents:document`). The
  Investigations section has the same staleness and is left as it is.
- The release lines landed (`BO_0298_007`, `BO_0298_008`): `profiles` in
  `release-extensions.json` and the line under *Added*.
- The closing proposal carries the fixes, the docs and this document at `completed` under
  `profiles`' `docs/changes/completed/`; the export after its acceptance closes the change here.

