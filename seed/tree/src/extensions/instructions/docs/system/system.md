# Instructions

## Purpose

- This document is the entry point of `instructions`, the extension that keeps reusable instruction
  documents — instructions — on the instance and lets a person choose one for each command, so that
  the command's run is guided by the instruction's accepted content. An instruction is a document:
  authored and revised in the editor through the proposal loop, and an agent can be asked to
  draft or improve one (`calliopa-bootstrap`'s `BO_0298`, requested by the user on 2026-09-24
  and decided on 2026-09-24 and 2026-09-25). Its code blocks are tools the agent can call
  (`calliopa-bootstrap`'s `BO_0311`, part 3 of `BO_0308`, decided on 2026-09-30).
- It is `bundled` and active on a fresh install, and no starter instruction ships, since instance
  content never travels (`BO_0298_Q3`).
- It depends on `documents`, whose `document` type declares the `record` slot an instruction is told
  apart by ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#instructions)),
  on `structures`, whose built-in *Instruction* every instruction uses, and on `ui.shell`, whose
  frame it contributes into. What a run receives, what its record says, the grants and the named
  secrets are the kernel's, and one call is the code service's (`calliopa-bootstrap`'s
  `docs/system/ui-kernel.md`, *The Instruction In The Command, With Tools*, and
  `docs/system/code-service.md`, *Instruction Tools*); the run detail's line is `ui.shell`'s
  ([Processes](../../../../docs/system/workspace/processes.md#the-run-used-an-instruction)).
- Its change documents carry the prefix `PF`. A `PF` change that alters what a release ships
  writes its line in the repository's `docs/release-notes/unreleased.md`, as every change of a
  `bundled` extension does (`distribution.md`, Release Notes).

## What This Extension Holds

* An instruction has the structure of a document; its authored content is the instructions supplied
  to the agent when it is chosen. User decision, 2026-09-24 (`BO_0298_Q3`).
* Anyone who can edit documents creates and maintains instructions, through the same proposal and
  acceptance loop. User decision, 2026-09-25 (`BO_0298_Q4`).
* An instruction document's own chip starts at **No instruction**; with none chosen a prompt in it
  addresses the instruction's own instructions. User decision, 2026-09-25 (`BO_0298_Q9`).

## An Instruction Names Its Format

Under `calliopa-bootstrap`'s `BO_0336` (promoted to draft by the user on 2026-10-02 and transferred
here the same day; owned in the graph by `media`,
[Generation Settings Live In The Format](../../../media/docs/system/system.md#generation-settings-live-in-the-format)):
an instruction no longer carries a type or a backend; what a generation makes is the format the
instruction names in *Instruction*'s optional *Format* field (`structures`' `BO_0336_013`), which the
document header shows as every structure field.

* The instruction carries no instruction type and no backend; choosing what kind of output is made is the
  format's. Nothing migrates them: an image or video instruction names no format after the upgrade.
  User decision, 2026-10-02.
- An instruction's bar holds no generation setup (`BO_0336_030`, landed 2026-10-02): the *Instruction
  tools* group alone stands there, for the owner, and `views/tools.tsx`'s provider draws nothing
  else. The format is chosen in the document header's *Instruction* values, as every structure field is.
  Proven in `views/views.test.ts`, *an instruction's bar*: no setup control and no read of one.

## The Instruction In The Chip, With Tools

Under `calliopa-bootstrap`'s `BO_0311` (`docs/changes/completed/BO_0311_FEAT_profile-in-the-chip-with-tools.md`,
part 3 of `BO_0308`, promoted to draft by the user on 2026-09-30 and transferred here the same
day): *Instruction* is a built-in structure. The instruction is chosen per command from an icon in the active
block's chip, and an instruction's code blocks are tools an agent can call. It follows `BO_0309`. The
kernel's half is `ui-kernel.md`, *The Instruction In The Command, With Tools*, and one call's is
`code-service.md`, *Instruction Tools*. Completed on 2026-10-01.

* *Instruction* is a built-in structure, and the *Instructions* category folds into *Structures*, where *Instruction*
  lists the instructions (`BO_0308_Q5`, `BO_0308_Q11`).
* The instruction choice is an icon in the active block's command chip, a dropdown opened by a press
  like the agent selector. The document bar's selector goes. The chosen instruction belongs to the
  command. A new command starts with the instruction standing on its block, else on its document
  (*An Instruction Stands On A Block Or A Document*, below), else with the instruction the person
  last sent with in this document, remembered for that person alone (`BO_0308_Q7`, reversing
  `BO_0298_Q1` and `BO_0298_Q8`; the standing instruction is `calliopa-bootstrap`'s `BO_0349_Q2`,
  user decision 2026-10-05, reversing `BO_0308_Q7`'s *nothing is stored on the document*). A
  document's attached instruction was dropped on upgrade, so every chip started at *No instruction*
  (`BO_0311_Q1`).
* A code block in an instruction is a tool the agent can use; the instruction's words say how, but nothing
  requires them to. Without the owner's grant a call runs off every network. Only the owner
  grants, an accepted edit to a code block voids its grant, and credentials are the owner's named
  secrets in Settings (`BO_0308_Q8`, `BO_0311_Q2`–`BO_0311_Q5`). Tools run on the runtime the
  instruction document is connected to (`BO_0311_Q6`). The grant control stands on the instruction
  document for the owner alone, and Settings lists the grants and the secrets (`BO_0311_Q7`).
- An instruction keeps its `record: instruction` beside the built-in structure, so `documents`' Documents
  listing, which leaves out instructions by that value, does not move. Creating an instruction writes both.
  Technical decision at transfer, 2026-09-30.
- The built-in structure (`BO_0311_010`): `POST /api/x/instructions/profiles` creates an instruction as a
  document carrying `record: instruction` and one empty text block, minted *Untitled instruction*, and
  takes `builtin:profile` on it through `structures`' `setStructure`, so the *Structures* category's
  *Instruction* row (`BO_0309_015`, its `documentsCarrying`) lists every instruction. The Instructions
  section, its icon and the library listing of instructions are gone (`BO_0308_Q11`). Every instance
  takes the rest on upgrade, automatically, through the executable migration
  `migration-bo-0311-profile-in-the-chip` (route `kernel/migrations/profile-in-the-chip`, after
  `migration-bo-0309-builtin-roles`; `calliopa-bootstrap`'s `BO_0312_003` runs it): one script
  relating every instruction that does not use *Instruction* to it, and clearing every document's
  attached instruction (`documents`' `clearProfileSlotsStatement`, `BO_0311_020`), or nothing once
  both stand.
- The chip control (`BO_0311_011`, `views/chip.tsx`, `InstructionChip`): a `command` block place, the
  `compass` icon, 24px on every pointer with no touch minimum like the chip's own buttons (`documents`'
  `BO_0273` line; the coarse-pointer 44px rule went with `PF_0002_001`, which made the bar 48px high on a phone), named *No instruction* or *Instruction: <title>* and drawn in the accent once one is
  chosen, opening *No instruction* first, then under *For this block's structures* the instructions using
  a structure the document or the block uses, then the others, each by title. It reads
  `GET /api/x/instructions/documents/[id]/blocks/[block]/choices`, which answers the instructions with
  whether each uses such a structure (the document's and the block's roles from `structuresOf`, the
  instructions using each from `documentsCarrying`, *Instruction* itself left out), whether the
  document is itself an instruction, and the person's last instruction there. A choice calls the place's
  `setOption$("instruction", id | null)` (`ui.shell`'s *Options On A Command*), so *Send* carries
  it, and nothing is written on the document. A command carrying no choice starts with the
  person's last while it is still an instruction, and at *No instruction* on an instruction's own
  document; one carrying a choice keeps it (`PF_0001_001`, below). The kernel keeps the last as
  a run starts, in its per-person state (`people/<person>/profile/<document>`), the person's
  alone. Nothing is drawn while the instructions cannot be read or the instance has none. This
  replaces the open `BO_0299_020`; the document bar's selector and the selection route are gone.
- The tools on an instruction's document (`BO_0311_012`, `views/tools.tsx`): `InstructionToolsProvider`
  reads `GET /api/x/instructions/documents/[id]/tools` — whether the document is an instruction, whether
  the person is the owner, the kernel's grant answer and, for the owner, the named secrets — and
  `ToolHeadline`, a `headline` place, writes on each code block its tool name and *granted*,
  *changed since the grant* or *offline*, or *cannot run: the instruction is connected to no
  runtime*, for everyone who reads it. For the owner alone the provider writes the bar group
  *Instruction tools*: the toggle *Outside reach* (`globe`), on to grant every code block as it
  stands and off to revoke; one toggle per set named secret the grant may read, which re-grants
  while a grant stands; and *Grant again* once a block changed since the grant. Each forwards to
  the kernel's `/__kernel/instructions/<id>/grant` through `PUT` and `DELETE
  /api/x/instructions/documents/[id]/grant`, which answer a refusal as `{error}` in the kernel's
  words, raised as a message. A document that is no instruction draws nothing.
- The owner's *Instruction tools* in Settings (`settings`' `BO_0311_040`) is this extension's
  contributed settings section (`views/settings.tsx`, `owner: true`), so `settings` knows
  nothing of instructions: the granted instructions by title with who granted each, when, and which
  secrets each reads, each with *Revoke*; and the named secrets with whether each is set and its
  last characters, each replaced or cleared, and a new one added by name and value. Its routes
  are `GET /api/x/instructions/settings` and `PUT`/`DELETE /api/x/instructions/secrets/[name]`, forwarded
  to the kernel, which holds them to the owner. A value is never shown once saved.
- The server half's routes are `contributions.server.ts`, and what they do is
  `server/instructions.ts` (`createInstruction`, `choicesFor`, `profileInTheChip`), which the behaviour
  suite calls. Technical decision at implementation, 2026-10-01.
- Verified (`BO_0311_013`, the unit and behaviour parts): `views/views.test.ts` in Qwik's render
  harness — the chip restoring the person's last, *No instruction* then the block's roles' instructions
  then the rest, a choice and *No instruction* set as the command's option, *No instruction* on a
  instruction's own document and for a last that is no instruction any more, and nothing drawn when the
  instructions cannot be read or there are none; the headlines' states for the owner and for anyone
  else, *cannot run* with no runtime, the bar group for the owner alone with a toggle per set
  secret, a grant posting the chosen secrets, a revoke, *Grant again*, and a refusal raised in
  the kernel's words; and the Settings section listing and revoking a grant and adding a secret
  without ever showing its value. `tests/behavior/instructions.test.ts` under the kernel harness — a
  instruction created using *Instruction* while one made before the structure does not; the chip's choices
  marking the instruction that uses a structure the document uses, and the person's last read back,
  none on an instruction's own document; the migration giving the structure and dropping an attached
  instruction, then finding neither; and a grant and a revoke through the kernel naming a code block
  the tool `send_an_email`. `tsc --noEmit` clean with the registry generated.
- A document using *Instruction* is an instruction (`BO_0311_015`, found in the walk on 2026-10-01: a
  document given *Instruction* from its chip stood in the *Structures* category's *Instruction* row and was
  missing from every command's chip, since the chip, the run start and the grant read
  `record: instruction`). Taking *Instruction* on a document writes the record in the same statement, and
  clearing it clears the record (`structures`' `takeStatement` and `clearStatement`, a
  proposed structure too). Every instance gives the carriers that lack it the record on upgrade, through
  the executable migration `migration-bo-0311-profile-record` (route
  `kernel/migrations/profile-record`, after `migration-bo-0311-profile-in-the-chip`): one script
  setting the record on each, or nothing. A document so made an instruction leaves the Documents
  category, as every instruction does (`BO_0298_Q4`). Proven in `tests/behavior/instructions.test.ts`: a
  plain document using *Instruction* told apart as an instruction and allowed in the chip, clearing the
  structure making it a document again, and the migration giving a carrier the record and then finding
  nothing.
- Walked by the user on the served build on 2026-10-01 (`BO_0311_013`, pins 3469 and 3589), and the
  user said it works: an instruction chosen in a block's chip and restored in the next command there;
  *Mailer*, whose code block is the tool `the_following_code_sends_an_email` (named from the
  sentence before it, the block having no caption), called with no network and failing to resolve
  its address, then granted outside reach with the secret `smtp` and reaching the network on
  `runtimes` — the run's record naming each call, its network and its error — and offline again
  after an accepted edit until granted again. The walk found that a document given *Instruction* from
  its chip was missing from the chip, fixed as `BO_0311_015` above.
- The change document stands in `docs/changes/completed/` at `Status: completed`
  (`BO_0311_014`); `calliopa-bootstrap`'s `BO_0311_009` release lines stand, and the graph export
  that follows the acceptance closes the change in the repository.

## Profiles Become Instructions

Under `calliopa-bootstrap`'s `BO_0338`, promoted to draft by the user on 2026-10-02 and transferred
here the same day (its change document is `structures`'): a profile becomes an *instruction*
and *Profiles* becomes *Instructions*, in what people read, in what a run is told and in every
stored identifier and route, and this extension's id becomes `instructions`. The kernel's half —
the general extension-id move, the intake and record, `run_instruction_tool`, the grants and the
remembered choice — is `calliopa-bootstrap`'s `extension-model.md` (`BO_0338_001`) and
`ui-kernel.md`, *Structures And Instructions* (`BO_0338_003`–`BO_0338_009`); the structures' half is
`structures`' ([Roles](../../../structures/docs/system/system.md#roles-become-structures)).

* Profile becomes instruction and Profiles becomes Instructions: the built-in, the command's
  selector and its empty choice, the document and block controls, the category, the tool guidance,
  the refusals and the run's detail. A full rename with migrations and no aliases; every
  instruction document, remembered choice, runtime connection and grant survives it. User
  decisions, 2026-10-02.
- The id moved (`BO_0338_030`, 2026-10-02): the manifest's `id` is `instructions`, version 0.2.0,
  with `formerIds: ["profiles"]` and `dependencies` naming `structures`, so the kernel's general
  move carries every member, its state and the tabs open on it; the subtree is
  `src/extensions/instructions/`, its routes `/api/x/instructions/…` (`instructions`,
  `documents/[id]`, `documents/[id]/grant`, `documents/[id]/tools`,
  `documents/[id]/blocks/[block]/choices`, `secrets/[name]`, `settings`). It keeps its place
  among the extensions by its former id. The change prefix stays `PF`.
- The record moved (`BO_0338_031`, 2026-10-02): the executable migration
  `migration-bo-0338-instructions-from-profiles` (route `kernel/migrations/instructions-from-profiles`,
  after `migration-bo-0311-profile-record`) answers `documents`' `moveInstructionRecordsStatement`:
  every established document carrying `record: profile` takes `record: instruction`, and one
  still titled *Untitled profile* is titled *Untitled instruction*, so it stays unnamed; nothing
  once none is left. Using the built-in *Instruction* writes `record: instruction`. The two
  migrations before it keep their routes (`profile-in-the-chip`, `profile-record`), which every
  instance records them run by.
- The chip, the bar, the grant control and the Settings section say instruction (`BO_0338_032`,
  `BO_0338_033`, 2026-10-02): the selector, its empty choice *No instruction*, its groups, the
  bar's tools and grant, and the section *Instruction tools*; the option the chip sets on a
  command is `instruction` (`ui.shell`'s `BO_0338_050`), the last choice is read at
  `/__kernel/state/people/me/instruction/<document>`, the grant forwarded to
  `/__kernel/instructions/<id>/grant` and the list to `/__kernel/instructions/`
  (`calliopa-bootstrap`'s `BO_0338_006`); the `data-instruction-*` attributes and the
  `instruction-*` classes replace the profile ones.
- The code says it (`BO_0338_034`, 2026-10-02): `lib/instructions.ts`, `server/instructions.ts`,
  `views/instructions.css` and `tests/behavior/instructions.test.ts`, their symbols named for
  instructions, `INSTRUCTION_ROLE` naming the built-in's id `builtin:profile`, and `documents`'
  readers (`lib/instruction.ts`, `INSTRUCTION_RECORD`, `listInstructions`, `instructionSummary`).
  An executed migration keeps its member id and route.
- Verified 2026-10-02 on the same throwaway stack (`BO_0338_035`; `calliopa-bootstrap`'s
  `distribution.md`, `BO_0338_012`): a profile with a grant, a secret and a remembered choice, and
  `profiles` switched off, carried to `instructions` still off; switched on, its migration moved
  the document to `record: instruction`, its tools answered as an instruction's, the grant and the
  secret under `/__kernel/instructions/…`, the chip restored the remembered choice, a run sent with
  it still named it, and the old routes answered `404`.
- This extension's docs speak the new terms (`BO_0338_036`, 2026-10-02): this document's title and every
  section say instruction, the stored names (`builtin:profile`, the executed migrations) keeping
  their form.

## A Structure Is A Document

Under `structures`' `RO_0005` (2026-10-02): every structure becomes a document and *Instruction*
takes a fixed id `structures` names, where `builtin:profile` stood
([A Structure Is A Document](../../../structures/docs/system/system.md#a-structure-is-a-document)).

- `INSTRUCTION_STRUCTURE` is `structures`' name for *Instruction*'s fixed id, re-exported by
  `lib/instructions.ts` (`RO_0005_040`, landed 2026-10-02), so an instruction created or listed
  relates and reads *Instruction* by it; the format an instruction names is a document id and moved
  nothing.

## The Chip Keeps The Command's Instruction

Under `PF_0001` (`docs/changes/completed/PF_0001_FIX_the-chip-keeps-the-commands-instruction.md`, promoted
to draft by the user on 2026-10-03 and transferred here the same day): the chip set the person's
last on the command each time it was drawn, so a choice was lost when the block was left and
opened again, and *Send* carried the last instead.

* An instruction chosen for a command stays chosen until the person chooses another or sends.
  Requested by the user, 2026-10-02.
* After *Send*, the command in that block keeps the instruction it was sent with, even when the
  person has since sent with another one elsewhere in the document; the person's last starts only a
  command that carries no choice, as on a fresh page. User decision, 2026-10-03 (`PF_0001_Q1`).
- The chip reads its command's choice (`PF_0001_001`, landed 2026-10-03; `views/chip.tsx`): from
  the place's `commandOptions` (`ui.shell`'s `BO_0336_051`), a command carrying an `instruction` is
  shown with it and nothing is set over it; a command carrying `no-instruction` stays at *No
  instruction*; only a command carrying neither starts with the person's last. Choosing *No
  instruction* sets `no-instruction` (`NO_INSTRUCTION_OPTION`, `lib/instructions.ts`) beside
  clearing `instruction`, and choosing an instruction clears it, since the shell drops an option
  set to nothing (`withOption`); the runs route reads only `instruction` and `variation`, so the
  mark goes no further. The shell is unchanged: `afterSend` keeps both after *Send*.
- Proven in `views/views.test.ts` (`PF_0001_002`, 2026-10-03): a chip drawn again on a command
  carrying an instruction shows it over the person's last, sets nothing, and `afterSend` keeps it
  for *Send*; one drawn again on *No instruction* chosen over a remembered last stays at none; a
  command carrying nothing still starts with the last. Both fail against the chip before the fix.
- Walked by the user on the served build on 2026-10-03 (`PF_0001_003`, pin 4499), and the
  user said it works: an instruction chosen, the block left and opened again, the choice kept and
  the run naming it; *No instruction* chosen over a remembered last, kept the same way.
- The change document stands in `docs/changes/completed/` at `Status: completed`; the
  *Fixed* line stands in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`.

## An Instruction Stands On A Block Or A Document

Under `calliopa-bootstrap`'s `BO_0349` (`documents`' `docs/changes/completed/BO_0349_FEAT_curation-by-drop.md`,
promoted to draft by the user on 2026-10-05 and transferred here the same day): the dragged item
shapes the drop target. This extension's half is an instruction dropped on a block or a document,
which then stands there, and the built-in instructions behind the drops that start a run. The drop
itself is `documents`' [Curation By Drop](../../../documents/docs/system/documents/block-editor.md#curation-by-drop).

* An instruction dropped on a block or a document stands there and is the default for commands:
  every command in that block, or anywhere in that document, starts with it in the chip, and the
  person may still choose another for one command. A block's instruction wins over its document's.
  It shows as a pill on its target and is removed there. Dropping it runs nothing. User decisions,
  2026-10-05 (`BO_0349_Q2`), reversing `BO_0308_Q7` and `BO_0311_Q1`.
* The instructions behind the drops that start a run are built in: shipped as instruction documents
  the way *Keyword* and *Instruction* are, and each can be shaped by dropping material on it like any
  instruction. User decision, 2026-10-05 (`BO_0349_Q4`).
- The standing instruction is stored (`BO_0349_030`, landed 2026-10-05; `server/standing.ts`): the
  relation `usesInstruction`, declared by this extension, from a `document` or a block in its reading
  order to an instruction's document, at most one per subject — a new one closes the one standing in
  the same script. `POST …/documents/[id]/standing` and `…/blocks/[block]/standing` take `{instruction}`,
  or `null` to take it off, written as the person's truth outside any branch, refused in words for a
  document that is no instruction (`notAnInstruction`) and a block not in the reading order
  (`unknownBlock`); `GET …/documents/[id]/standing` answers the document's and each block's, by title.
  The harness's vocabulary copy carries it (`calliopa-bootstrap`'s `BO_0349_051`). Proven under the
  kernel harness in `tests/behavior/instructions.test.ts`.
- The chip starts from the standing instruction (`BO_0349_031`, landed 2026-10-05; `choicesFor`'s
  `standing`, `startingInstruction`): a command carrying neither `instruction` nor `no-instruction`
  starts with its block's standing instruction, else its document's, else the person's last, each only
  while it is still an instruction; a command's own choice is never set over (`PF_0001`). Proven in
  `lib/instructions.test.ts`, `views/views.test.ts` and under the kernel harness.
- A standing instruction shows as a pill (`BO_0349_032`, landed 2026-10-05; `views/standing.tsx`): on a
  block in its `headline` place, beside a code block's tool (`HeadlineMarks`), and on a document in its
  header's `title` place, the compass and the title, its × taking it off. The header's title rows stand
  outside the document's decoration provider, so the document's pill reads what stands for itself;
  a pill's × applies the answer at once and announces it on its own page. Found in the walk at pin
  4795, 2026-10-05, where an instruction dropped on a header stood but showed nowhere. Proven in
  `views/views.test.ts`. Walked by the user on the served build at pin 4805, 2026-10-05, "works":
  an instruction dragged from the sheet onto a block and onto three documents' headers, each shown as
  a pill, a pill's × taking it off at once, and a block's chip starting with the document's standing
  instruction. `InstructionsProvider` reads
  what stands once per document, inside the tools' provider, and takes every write's answer announced
  on the page (`instruction-standing-changed`). An instruction listed under *Instruction* in the
  *Structures* sheet is dragged out as `instructions:instruction` and, dropped on a block's middle or a
  document's header, stands there (`drops`, `standDroppedInstruction`).
- *Fill a field* is built in (`BO_0349_033`, landed 2026-10-05; `lib/instructions.ts`
  `BUILTIN_INSTRUCTIONS`, `server/builtins.ts`): an instruction document under the fixed id
  `FILL_A_FIELD_INSTRUCTION` — named in `documents`' `lib/instruction.ts`, so `structures`, which
  starts its run, names it without depending on this extension — titled *Fill a field*, carrying
  `record: instruction` and *Instruction*, its four paragraphs the release's: read a non-text field's
  value off the block put into it (#2) and propose it on the structured block (#1) with
  `propose_structures` for that field alone, written as the kind takes it, a file never; propose
  nothing else, and nothing with a sentence why when #2 says nothing that fits. The member
  `migration-bo-0349-builtin-instructions` (route `kernel/migrations/builtin-instructions`, after
  `structures`' `structures-as-documents` and this extension's `instructions-from-profiles`) makes it
  once per instance where none stands (`builtinInstructionsStatement`, pure); nothing of the release
  is written over it again, so it is revised like any instruction. Proven in
  `server/builtins.test.ts` and under the kernel harness in `tests/behavior/instructions.test.ts`.
- *Shape an instruction* is built in (`BO_0349_014`, landed 2026-10-05): the second of
  `BUILTIN_INSTRUCTIONS`, under `SHAPE_AN_INSTRUCTION` (named in `documents`' `lib/instruction.ts`),
  its four paragraphs the release's: read the instruction and the dropped block (#1), find what #1
  does that the instruction does not ask for and what it contradicts, propose revisions to the
  instruction's own blocks so it would produce material like #1 — teaching #1's manner, never its
  subject — propose nothing outside the instruction and never change #1, and propose nothing with a
  sentence why when the instruction already would. The member `migration-bo-0349-shape-instruction`,
  after `-builtin-instructions`, runs the same route, which makes every built-in an instance does not
  hold. Proven in `server/builtins.test.ts` and under the kernel harness.
- *Extend a structure* is built in (`BO_0349_036`, landed 2026-10-05): the third of
  `BUILTIN_INSTRUCTIONS`, under `EXTEND_A_STRUCTURE` (named in `documents`' `lib/instruction.ts`), its
  four paragraphs the release's: read the structure's fields and the dropped block (#1), and for each
  thing #1 says that no field holds, insert a block naming the field into the structure's document and
  propose *Field* on it with its type and options; only fields the structure lacks, named as a reader
  of the structure would, never #1's words or values, no standing field changed, and nothing with a
  sentence why when every thing has a field. The member `migration-bo-0349-extend-structure`, after
  `-shape-instruction`, runs the same route.
- *Apply a structure* is built in (`BO_0349_034`, landed 2026-10-05 with `documents`' `BO_0349_012`): the
  fourth of `BUILTIN_INSTRUCTIONS`, under `APPLY_A_STRUCTURE` (named in `documents`' `lib/instruction.ts`),
  its four paragraphs the release's: propose the structure (#1) on the document with
  `propose_structures` and each field's value its words answer, written as the kind takes it; never
  rewrite, add or remove a block or invent a value, a required field left unanswered said in a
  sentence; only the missing values where the document already uses it, and nothing with a sentence
  why where it cannot be used. The member `migration-bo-0349-apply-structure`, after
  `-extend-structure`, runs the same route. An instruction dropped between rows means nothing
  (`standDroppedInstruction`).
- A built-in instruction is never deleted (`BO_0349_035`, landed 2026-10-05; `builtinGuard`, registered
  with `documents`' `guardDocuments`): deleting one is refused in words — *«title» is built in: the
  drops that start work run under it, so revise it rather than deleting it.* — and a run's removal of
  it is refused as it is accepted, as for a structure's document. Its words stay revisable. Proven in
  `server/builtins.test.ts` and under the kernel harness.

