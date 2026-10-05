# Curation By Drop

Status: completed

Requested: 2026-10-05, by the user, as an idea still to be sharpened.

The flood of AI answers is not a storage problem, so a better store is not the product. What is
scarce is the shaped relation between pieces, and shaping by hand does not scale. The bet: the AI
does the shaping and the person judges it. Curation becomes a sequence of small acceptances, not an
act of authorship.

That gives curation a cost model. Every structuring act the AI proposes costs one unit of the
person's attention, and attention cannot be delegated. The claim holds only where a proposed
relation is cheaper to judge than it would have been to make. Every part of this change has to pass
that test.

The request held two more ideas. Answers as an inbox of decisions, and how accumulated knowledge
shows, are `BO_0350`, a separate change (user decision, 2026-10-05).

Use cases from the request, kept as ways to test the idea and not as scope:

- Turning AI insights into advice someone can act on: ask, make an instruction from the answer,
  apply that instruction to content.
- Getting the most out of explainer videos.
- Agents as characters in everyday situations, each bringing popup props: a way to present the
  idea, not a product feature.

## One Rule

* The dragged item is the actor and the drop target is what changes: dropping A on B shapes B by A.
  Direction matters, so A on B and B on A are two different acts.
* The type pair decides what a drop means. A drop opens no choice except one: a block dropped on a
  structured block offers that block's fields. Any other wrong guess is paid at review, where every
  other proposal is paid.
* The drop that shapes is the one that lands on a block's middle, the drop that today nests a
  dragged block into the block's focused work (`documents`' Block Editor, Dragging Into Blocks And
  Other Documents; `CA_0072`). That middle drop is what gets extended, so the upper and lower edges
  keep placing a block before and after. Reordering is untouched. User decision, 2026-10-05.
* A drop that triggers an action lights its target red, not with the nesting light. The person sees
  before releasing that letting go will start something. Only a drop that starts a run lights red;
  *use structure*, *use instruction* and a nest are the person's own writes and keep the nesting
  light. User decision, 2026-10-05 (`BO_0349_Q8`).
* The instructions behind the AI rows are built in, shipped as instruction documents the way
  *Keyword* and *Instruction* are, and each can be shaped by dropping material on it like any
  instruction, so the drops themselves learn the person's taste. User decision, 2026-10-05
  (`BO_0349_Q4`).

| Dragged | Dropped on | What the drop does | Who does it |
|---|---|---|---|
| Block | Block | The dragged block nests into the target's focused work, as today. When the target uses a structure, the drop offers the structure's fields, and the dragged block becomes the child that fills the chosen one | the person, at once |
| Structure | Block or document | The target uses the structure. Its unfilled required fields become the next visible thing to do | the person, at once |
| Structure | Document or passage | The AI proposes which part fills which field. The person reviews the mapping, not a label | a run proposes |
| Instruction | Block or document | The instruction stands on the target and governs how it is written and what an agent may do in it | the person, at once |
| Block or passage | Instruction | The AI proposes the revision of the instruction that would have produced this material: teaching by example | a run proposes |
| Block | Structure | The AI proposes fields the structure lacks, read off this block | a run proposes |

* Two of the rows share their pair, *Structure onto document*, and the place tells them apart: a
  drop on the document's header or its structures line uses the structure, at once, and a drop on
  the body or a passage applies it, a run proposing which part fills which field, so it lights red.
  User decision, 2026-10-05 (`BO_0349_Q11`).
- Same-type pairs other than block onto block (structure onto structure, instruction onto
  instruction) are not draggable. A rule that answers every pair cannot say when it does not know.

### Block Onto Block Nests, Into A Field When The Target Has A Structure

* Block onto block stays a nest: the dragged block moves into the target's focused work. When the
  target uses a structure, the drop offers that structure's fields to choose from, and the nested
  block becomes the child for the chosen field. The relation between the two blocks is the child
  relation with a field named, not a reason-bearing `relation` with an AI-written kind and reason.
  User decision, 2026-10-05 (`BO_0349_Q1`). It is the person's own write and starts no run, so
  `BO_0349_Q3` — who owns a relation whose reason the AI wrote — no longer arises, and declaring a
  reason-bearing relation stays `relations`' `BO_0288_020`, outside this change.
* The chosen field holds the nested child itself: the dragged block moves into the target's focused
  work, as every nest moves it, and the field's value points at it, so editing the child is editing
  the field's value. Nothing is copied. Every field of the target's structures is offered. User
  decision, 2026-10-05 (`BO_0349_Q9`).
* A field whose kind is not text — a number, a date, a choice, a file — is offered too: the child is
  nested and pointed at, and a run proposes the field's value read off it, answered where every
  proposal is. Choosing such a field starts a run, so it is marked red in the field choice, since
  the field is chosen after the release. User decision, 2026-10-05 (`BO_0349_Q10`).
* A field may hold several children, in order, and a new one lands after those already there;
  nothing is displaced. When the target uses several structures, the choice groups the fields under
  each structure's name. User decision, 2026-10-05 (`BO_0349_Q12`).
* This row is built first: it extends the nest people already use, needs no run, and lays the ground
  the other rows drop onto. User decision, 2026-10-05 (`BO_0349_Q7`).

### An Instruction Stands On A Block Or A Document Again

* An instruction dropped on a block or a document stands there and governs how it is written and
  what an agent may do in it. This reverses `instructions`' `BO_0308_Q7` and `BO_0311_Q1`, under
  which the chosen instruction belongs to the command, nothing is stored on the document and a
  document's attached instruction was dropped on upgrade. The fixed lines there change when this
  change is drafted. User decision, 2026-10-05.
* A standing instruction is the default for commands: every command in that block, or anywhere in
  that document, starts with it in the chip, and the person may still choose another for one
  command. A block's instruction wins over its document's. It shows as a pill on its target and is
  removed there. Dropping it runs nothing, so it keeps the nesting light. User decision, 2026-10-05
  (`BO_0349_Q2`).

### What Sharpening Showed

- **Every AI row is a command.** Each AI row is a run on the target, with the dragged item as its
  reference and an instruction chosen by the type pair. All of that already exists: a command acts
  on its scope, it can reference a block, a passage or a proposal item (`documents`' command mode),
  an instruction is chosen per command, and a run's writes are proposals answered where every
  proposal is answered. A structure and an instruction are documents (`structures`' `RO_0005`), so
  revising one is an ordinary proposal in its own document. The drop adds no new store and no new
  review surface. It is a fast way to issue a command that already exists. So the table is really
  a table of built-in instructions, one per AI row, and those are the request's own loop: ask,
  make an instruction, apply it.
- **What the person does is truth, and what the AI does is a proposal.** This settles *frequency*.
  Taking a structure is already the person's deliberate act, written as truth at once
  (`structures`, *What This Extension Holds*), so a drop that only uses a structure needs no
  confirmation. Every AI row stages proposals, which pile up quietly and are answered in batches
  where proposals are answered today.
- **The drop is a fourth way a structure reaches a block**, beside suggestion, typeahead and
  allowing. It obeys the same rule: only a structure the block can use where it stands. A drop of
  any other structure is refused at the drop with the reason, never guessed.
- **An item's type is read from the document it is.** A structure is a document defining a
  structure. An instruction is a document using the built-in *Instruction* structure. Anything else
  is a block or a passage. Dragging an instruction document and dragging the *Instruction*
  structure are two different items.
- **How far one drop may reach:** one relation per drop, with anything it implies offered on
  request. Review must not grow faster than the gain. This is still a guess.
- **Shape instruction compounds.** It is the one row where the person's taste builds up as
  readable instructions rather than as a habit of re-prompting, and with every AI row being a
  command it is the cheapest run to build. It comes after block onto block (`BO_0349_Q7`).

## Collisions With What Stands

- **Block onto block's middle already nests**, and keeps nesting (`BO_0349_Q1`). The field choice
  is new: the first time a drop asks something before it lands.
- **Drag sources live in other surfaces.** Structures and instructions are listed in the
  *Structures* category, which `CA_0048` makes a sheet over the work. The shell already holds a
  dragged block over a library entry to open it (`CA_0072`), but nothing drags an entry out of the
  library into a document yet.
* A drop reaches from the *Structures* sheet into the editor, and across open tabs: a block held
  over another tab opens it, as `CA_0072` does, and drops onto an instruction or a structure there.
  No equivalent without dragging is part of this change. User decision, 2026-10-05 (`BO_0349_Q5`).

## Questions

- No functional question stands open. The change is ready for the user to set to draft.

## Progress

- The first row landed, 2026-10-05: a block dropped on a structured block nests and is offered the
  block's fields; the chosen field holds the nested block and reads as its words; the popover lists
  a field's blocks and takes one out (`BO_0349_010`, `020`–`022`, `050`). Split off as open work:
  a non-text field's run and red mark (`BO_0349_018`), a child opening from the popover
  (`BO_0349_024`), and the structure drop's call (`BO_0349_025`).
- The walk at pin 4622 (2026-10-05) found a nest showing the target's own words where the dragged
  block had gone. User decision: the dragged block shows under the target. A nest now opens its
  work with no empty first block, and a focused work's face lists the first words of the blocks it
  holds (`BO_0349_019`). The same walk lost the dragged block's typed words before the drag; where is
  `BO_0349_027`.
- The first row was walked again at pin 4654 and works (2026-10-05).
- A non-text field starts its run (2026-10-05): the draft assumed a drop starts a command carrying its
  instruction with the kernel unchanged, but a command's words are read from the block it was written
  in. User decision: the kernel hands an instruction to a run whose words a view writes
  (`BO_0349_052`, here), the shell sends one (`sendInstructed$`), *Fill a field* is built in
  (`BO_0349_033`, the other three split to `034`, the delete guard to `035`), and a non-text field is
  red and starts it (`BO_0349_018`). Walked at pin 4679 and works (2026-10-05), with the dev kernel
  still without `052`: the run proposed the date from the goal's words alone.
- *Shape an instruction* (2026-10-05): an instruction's header takes a block dropped on it, red while
  the drop would start a run, and the run under the built-in *Shape an instruction* proposes the
  revision of the instruction (`BO_0349_014`). The structure's header split off to `BO_0349_036`. Walked
  at pin 4776 and works (2026-10-05).
- A structure dragged out of the *Structures* sheet onto a block's middle or a document's header is
  used there (2026-10-05, `BO_0349_002`, the structure's half of `011`, `025`), through a `drops` hook
  on the decorations contract. Split off: the phone's sheet (`003`), the instruction's half of `011`,
  and opening on its fields (`037`).
- An instruction dragged out of the sheet onto a block or a document's header stands there as the
  default its commands start with, shown as a pill and taken off by its × (2026-10-05, `BO_0349_011`,
  `030`–`032`, `051`). Walked at pin 4805 and works (2026-10-05), after the document's pill was
  made to read for itself; the structure's drop from the sheet, walked the same day, used the structure but drew it only
  after a reload, and the structures listed under *Structure* did not drag; both fixed: a drop reads
  the document again, and those rows drag as structures. Walked again at pin 4820 and works.
- *Extend a structure* (2026-10-05): a structure's header takes a block dropped on it, and a run
  under the built-in *Extend a structure* proposes the fields the structure lacks, through the tools
  that stand (`BO_0349_036`, `023`). The header's mark now lights only where a drop would land; it lit
  red under a block on any header since pin 4795. Walked at pin 4829 and works.
- *Apply a structure* (2026-10-05): a structure dropped between a document's rows is applied to the
  whole document by a run under the built-in *Apply a structure*, the body lit red while it is held
  there (`BO_0349_012`, `034`). Applying to a marked passage split off to `BO_0349_038`. All four
  built-in instructions stand. Walked at pin 4864 and works.
- The smaller pieces, first part (2026-10-05): a built-in instruction is never deleted (`035`), a
  dropped structure opens on its fields (`037`), a field's child opens from the popover (`024`), a
  drag saves what is typed first (`027`), the red marks stand as the views draw them (`001`), and a
  library item dragged on a phone closes the sheet and springs over tabs (`003`).
- The smaller pieces, second part (2026-10-05): a marked passage's number drags the passage, which an
  instruction's or a structure's header takes as its example (`013`), and a structure dropped on that
  number is applied to the passage alone (`038`). Both parts walked at pin 4897 and all worked.

- Completed 2026-10-05, after the user tested all of it ("all tested"): the drop-started runs were
  proven by the walks of each kind rather than a harness test per kind (`BO_0349_015`), the walk is
  recorded (`016`), and the release line stands under *Added* with a *Fixed* line for a dragged
  block's typed words (`017`). It ships in `0.5.2`.

## Where It Lands

- The system work is enumerated in the graph, transferred 2026-10-05:
  - The shell's Drag And Drop, Curation By Drop: `BO_0349_001`–`002`, the red mark and the drag
    out of the library.
  - `documents`' Block Editor, Curation By Drop: `BO_0349_010`–`019` and `027`, the drops, the passage drag,
    the drop-started runs, the walk and the release line.
  - `structures`' Curation By Drop: `BO_0349_020`–`025`, a field's children, the field choice, a run
    proposing fields, and the structure drop's call.
  - `instructions`' An Instruction Stands On A Block Or A Document: `BO_0349_030`–`033`, the
    standing instruction, the chip's start, the pill, and the four built-in instructions.
  - This repository's `docs/system/ui-kernel.md`, Curation By Drop: `BO_0349_050`, the harness's
    vocabulary copy.
- The change document stands in the graph as a member of `documents`, the extension whose editor
  the drop lives in, at the status it holds here.
- What the person sees changes in `bundled` extensions, so it carries a release line under *Added*
  (`BO_0349_017`).
