# Code

## Purpose

- A document runs code. A person writes code in a block and sends it to the session of the
  runtime the document is connected to, as they send a block as a prompt; what came back is
  proposed after the block, and a run aimed at the document can execute code in the same session.
  The runtimes are containers the owner makes from any image that carries a Jupyter kernelspec.
- This extension owns every surface of that: the Runtimes section, the document's connection in
  its bar, and the send beneath a code block. What it does not own: the blocks. `sourcecode` and
  `output` are `documents`' block types (the kind is `sourcecode`, since this extension's id is
  `code` and a declaration and a manifest share one node namespace)
  ([Block Document Model](../../../documents/docs/system/documents/block-document-model.md#code-and-its-output)),
  so a code block and its output stay readable when this extension is switched off. And it runs
  nothing itself: the runtimes and the sessions are the stack's code service, fixed layer because
  an extension cannot ship a container, reached through the kernel alone
  (`calliopa-bootstrap`'s `docs/system/code-service.md` and `docs/system/ui-kernel.md`, Code From
  A Document).
* Its change prefix is `CO`. A change entirely inside this extension is a `CO` change document of
  this extension in the graph; a change that also touches the fixed layer is a `BO` change in
  `calliopa-bootstrap` whose system tasks concerning this extension are enumerated here. It was
  created under `BO_0289` (`docs/changes/BO_0289_FEAT_run-code-from-a-document.md`).
- It is `bundled` and active on a fresh install, deactivatable like any other extension. A
  release carrying it writes its release-notes line in `calliopa-bootstrap`'s
  `docs/release-notes/unreleased.md`, since the release that carries it is cut there.

## Fixed

* The owner alone makes, starts, stops and removes runtimes; every signed-in person may connect a
  document and send code; a run aimed at a connected document may execute code. The kernel's
  gate decides, not this extension: its routes forward with the person's session and answer the
  kernel's refusal in its words. User decision, 2026-09-23.
* One session per document, shared: a document is connected to one runtime and holds one session
  at a time, switchable in the bar; two people with the document open share it; a run uses it.
  User decision, 2026-09-23.
* Every output is a proposal, beside any earlier output proposal of the block still open; nothing
  an execution produces is written as truth. User decision, 2026-09-23.
* A session can be restarted from the bar's session control: closed and a fresh one opened on the
  same runtime, state gone and the runtime's files kept. User decision, 2026-09-23.
* A runtime lives until stopped by hand. User decision, 2026-09-23.

## What It Holds

- **The Runtimes section** (`views/section/runtimes.tsx`, `BO_0289_019`): a section of its own in
  the panel under the `terminal-window` icon, listing every runtime the instance holds — name,
  image, kernel, state, how many sessions are open in it and how long it has been idle — for
  everyone, and for the owner *New runtime* — a name, an image chosen from the Jupyter Docker Stacks the
  form suggests with what each holds, or *Another image…* typed freely, since the service takes
  any image with a kernelspec (`BO_0289_022`, asked by the user on 2026-09-23), and an optional
  kernelspec name —
  *Start*, *Stop* and *Remove*. A runtime being made (`pulling`, `inspecting`, `creating`) is
  re-read every two seconds until it runs or fails; a failed one says why until it is removed; an
  instance whose kernel serves no code surface says *This instance runs no code service*. The
  reader `runtimes` answers the section's first listing with whether the reader is the owner
  (`GET /__kernel/session`'s `owner`).
- **The document's connection in the bar** (`views/session/provider.tsx`): the decoration
  provider for `document` reads the connection (`GET /api/x/code/connection?artifact=`) and the
  runtimes once when the document is shown, shares them with every send control through its
  context, and writes its own group `code` to the shell's decoration bar — *Runtime*, a choice
  among the running runtimes and *No runtime*, which writes the connection (`PUT
  /api/x/code/connection`); *Restart session*, which closes the session and opens a fresh one;
  and *Interrupt* while an execution runs. The group keeps every other extension's group: the bar
  is one store per shell, and the provider replaces its own group alone, as
  `calliopa-refine`'s now does with *Work*.
- **The send beneath a code block** (`views/block/send-control.tsx`): drawn in the `run` place
  `documents` leaves under a code block's source. *Run* settles the block's edit first — the
  field left, and the block's own revise waited for while it says it is sending — then asks the
  kernel's `POST /__kernel/code/execute` for the document and the block, naming no revision, so
  what runs is what the block holds after the person's last edit; the kernel streams `started`,
  every event and `done`, shown beneath the button while it runs and kept until the next run, the
  note afterwards says how it ended and that the output is proposed below, and the control
  dispatches `calliopa:document-proposed`, bubbling from its element, so the editor draws the proposal
  (`BO_0289_023`). *Stop* interrupts the document's session.
  A block whose document is connected to no runtime says *Connect a runtime to run this* and
  runs nothing; an instance with no code surface draws nothing here.
- **The routes** (`contributions.server.ts`, under `/api/x/code/`): `GET` and `POST runtimes`,
  `POST runtimes/<id>/start` and `/stop`, `DELETE runtimes/<id>` (closing its sessions), `GET` and
  `PUT connection`, `POST interrupt`, `POST restart`, `GET executions?artifact=` — each the
  kernel's code surface called with the person's session, the kernel's refusal answered in its
  words with its code. This extension contributes no party and no tool: `execute_code` is the
  kernel toolset's, and the runtimes are the kernel's.
- The shell's contract gained the `run` place and nested providers for this extension
  (`ui.shell`'s [Contribution Contract](../../../../../docs/system/workspace/contribution-contract.md)).

## Open Work

- `docs/changes/BO_0289_FEAT_run-code-from-a-document.md` stands here at the status it holds in
  `calliopa-bootstrap` (`BO_0289_020`): `completed`, 2026-09-23, after the walk on the instance.
- [ ] A document's executions are listed in the right panel's Execution beside its runs (user
      decision, 2026-09-23): the kernel serves them (`GET /__kernel/code/executions?artifact=`)
      and this extension's route forwards them, and nothing draws them yet. A `CO` change draws
      the list where the runs are drawn, with an interrupt for the running one.
- [ ] The code block's language is a word the person types; a runtime's kernel decides what it
      runs. Highlighting by language is a `CO` change once a highlighter is chosen.
