# Working Modes: Explore Or Consolidate, Understand Or Create

Status: wip

Requested: 2026-09-29. In the user's words: *i want to support different dimensions of work with
ai in calliopa: explore vs consolidate, understand vs create. i want two toggles at the very left
(left to "work in a proposal") in the toolbar.* And: *the user specifies the modes. how should
calliopa make the agents follow the mode?* This change shapes the answer. It authorizes no
implementation.

## The Two Axes

- **Explore or consolidate** is a promise about the field. Explore widens it: alternatives,
  preserved ambiguity, sharper questions, reversible sketches, nothing presented as settled.
  Consolidate narrows it: name what now seems durable, merge duplicates, withdraw weaker framings,
  state consequences, prepare the decision a person takes.
- **Understand or create** is the run's relation to the graph. Understand reads more than it
  writes: it traces definitions and dependencies, tells established material from open proposals,
  and returns a map of what follows from what. Create writes, in small reviewable units, with its
  assumptions visible, so a person can accept, reject or refine each one without taking the whole.
- The quadrants:
  - Explore + understand is **reconnaissance**: read, compare, name tensions, leave trails.
  - Explore + create is **prototyping**: candidates, marked as candidates, cheap to discard.
  - Consolidate + understand is **synthesis**: compress the record into clearer claims and
    relations.
  - Consolidate + create is **commitment support**: the few changes that make the next decision
    concrete.
- The same tool call is good or bad depending on the quadrant: ten alternatives help exploration
  and are noise in consolidation; a rewrite is premature in understanding and right in creation.

## Where This Starts

- A run already carries structured context the person chose, as fields rather than prose: the
  effective `intention` on `POST /__kernel/agent/runs`, recorded on the run, because *a selector
  that recovers the intention by parsing prose is not a rule* (`BO_0142_006`, `ui-kernel.md`).
- A run's instructions say where an answer goes and never what it is made of; what it is made of is
  a skill's rule in the graph (`BO_0270`). A profile's words render as the instructions' closing
  section with a stated precedence (`BO_0298`).
- A run never answers a proposal; acceptance stays the person's, so a run that misreads its mode
  costs the person a rejection, never their established words (`BO_0271`).
- The items a run can stage already name the kinds of work the axes speak about: insert
  (widening), replace and refinement (making), withdraw (narrowing), relation (understanding),
  phase and status (committing).
- The bar's leading *Work* group is `documents`' own: *Work in a proposal*, then
  `calliopa-refine`'s *Establish…* (`DO_0010`, `documents`' Block Editor in the graph). The two
  mode controls would lead it.

## How Calliopa Makes A Run Follow The Mode

The mode is part of the run's contract, set by the person and fixed for the run. The
instructions carry it and the review makes the fit visible; nothing a run stages is refused
because of its mode (user decision, 2026-09-29).

1. **The mode is a field of the run.** The shell sends `mode: {field: explore|consolidate, work:
   understand|create}` beside `intention`; the bridge records it on the run and its `agent.run`
   node. The run cannot change it; a person who changes the toggles changes the next run, never the
   one going.
2. **Instruction: the kernel names the mode, a skill says what it means.** The instructions carry
   one line naming the quadrant; what each pole asks — the proportion of reading to writing, the
   proposal shapes, how much certainty to claim, what demands the person's attention — is a
   `calliopa-base` skill convention per pole, established in the graph like every other method
   rule, so it can be revised without a kernel release and cannot contradict the instructions.
3. **Review: the kernel measures the fit, the chip shows it.** When a run ends, `Summary` derives
   its shape from what it actually staged — new blocks, rewrites and refinements, withdrawals,
   relations, phase items — and judges it against the mode: a consolidating run that staged more
   new blocks than it withdrew or merged, an exploring run that rewrote established words or
   proposed a phase or status transition, an understanding run that rewrote, removed or moved an
   established block the command did not reference. The judgement is derived from the staging,
   never the agent's own account, and is recorded on the `agent.run` node as `drift` with its
   reasons. The proposal chip wears the quadrant's mark and, when drift was found, says so in one
   line; accepting is never blocked by it.

## Decided

* The toolset refuses nothing because of a run's mode: no refusals at all for now. The mode reaches
  the run as instructions and is judged in review. User decision, 2026-09-29.
* Each of the two controls is a toggle that shows the mode in force — the icon and name of the
  active pole — so what the person sees is what is active; pressing it switches to the other pole.
  User decision, 2026-09-29 (`BO_0306_Q1`).
* Every run a document starts is in a quadrant; there is no neutral state. A person's first mode in
  a document is explore + create, the closest to what a run does today. User decision, 2026-09-29
  (`BO_0306_Q2`).
* The mode is held per person and document and remembered, so reopening a document keeps how the
  person was working in it. User decision, 2026-09-29 (`BO_0306_Q3`).
* The console's composer does not name the mode. User decision, 2026-09-29 (`BO_0306_Q5`).
* Create mode sets no limit on the size of a staged item, and size is no part of the drift
  judgement. User decision, 2026-09-29 (`BO_0306_Q6`).
- Proposed icons: `arrows-out-simple` explore / `arrows-in-simple` consolidate; `book-open-text`
  understand / `pencil-simple-line` create.

## Progress

- 2026-09-29, wip: the kernel half (`BO_0306_001`–`BO_0306_007`) is implemented and verified in this repository; the graph half (`BO_0306_003`, `_010`–`_015`, `_017`) is implemented on a tree at head 3094 and verified in the render harness, and is staged as one proposal with the change document carried into `documents`' `docs/changes/`. Open: `_008` (the user's stack rebuild) and `_016` (the walk on the served build).

## Transfer

- Transferred 2026-09-29: the kernel's tasks `BO_0306_001`–`BO_0306_008` are `docs/system/ui-kernel.md`, *Working Modes*; the shell's `BO_0306_010`–`BO_0306_016` are `documents`' Block Editor, *Working Modes*, and The Agent At Work, *The Mode A Proposal Served*, and `BO_0306_017` is `ui.shell`'s Commands And Runs, *Working Modes*, in the graph (proposal `node:chg-056d69f460db3782`).

## Scope

- The kernel (this repository): the `mode` field on the intake, the run and `agent.run`; the
  instruction line; the derived shape and `drift`.
- `documents` (graph): the two controls leading the *Work* group; the mode sent with every run the
  document starts, from the bar and the console; the person's mode per document, remembered; the
  chip's mark and drift line; its docs.
- `calliopa-base` (graph): the four pole conventions in `calliopa-base.working`.
- The change is `BO` because it spans the fixed layer and the graph; its graph copy is a member of
  `documents` (Change Process).
- Not in scope: triggered and system runs carry no mode; the shell's affordance layer — surfacing
  different tools per mode in the bar — waits until the review shows which misfits recur.
