# Run Code From A Document

Status: completed

Requested: 2026-09-23. In the user's words: *I want a way to run code from a document. Just like
sending something as a prompt, I want to be able to run it as code against a backend kernel. That
means I want to create and manage backend kernels (dockerized). Then I want to connect a document
to it. It supports multi-sessions. More or less like Jupyter notebooks, but with a flexible
dockerized backend.* The open points were answered by the user the same day (Decided, below). This
document shapes the change; it authorizes no implementation.

## Where This Starts

At head 1873 of the dogfood instance, release 0.3.11.

- **A block is already the command.** Under `BO_0267` a person writes a block, sends it, and it
  becomes a prompt: the kernel records the block and the revision it was sent from, the run is told
  which block is the command and that its answer is one insert placed directly after it, and the
  block takes the `prompt` standing so it leaves the reading order unless kept. Sending code is the
  same gesture with a different addressee: the words of a revision go to a runtime instead of a
  model, and what comes back lands after the block.
- **Nothing in the stack starts a container.** No service mounts the docker socket, in the dogfood
  stack or the distribution's. Every service sits on the one default compose network with no
  `internal:` isolation, so anything placed on it reaches `app:8080` and reads the graph — the
  reason the capture service carries an address rule (`docs/system/page-capture-service.md`).
  Hermes is the only thing that executes code today, confined to the run's build view.
- **The pattern for a service that must be a container is settled three times.** Media, capture
  and search are fixed layer because an extension is graph-hosted code materialized into the tree
  and cannot ship a container; each is internal network only, holds no database credential, is
  reached through the kernel alone with a bearer the bootstrap one-shot generates, and its one
  consumer in the graph owns every surface (`docs/system/media-service.md`, Purpose). Capture and
  search run unconditionally because every run holds them as tools (`BO_0284`).
- **`documents` has no code block.** A `text` block's role is `paragraph`, `h1`–`h3` or `quote`,
  and `code` is a mark on a run, not a block. The table block (`BO_0287`, draft) is the newest
  precedent for a block whose content is structure a run reads as such and proposes as one unit.
  `image` and `video` blocks exist (`BO_0273`), so a picture an execution produces has somewhere to
  land. Command file attachments (`BO_0229`) are how a file already travels with a document.
- **`kernel` is taken.** It is the Go process that serves the shell, gates every surface and runs
  the agent bridge. Jupyter's word for the process that executes code is not used here.

## Decided

Answered by the user on 2026-09-23. These are the fixed requirements the transfer enumerates.

* **The container is a runtime and its live process is a session.** *Kernel* stays the Go
  process. No route, doc or control calls a runtime a kernel.
* **A runtime is any image with a Jupyter kernelspec.** The owner names an image; inside it the
  code service speaks Jupyter's kernel messaging protocol. That is what *flexible* means: every
  `jupyter/*` image, IJulia, IRkernel, the Deno and Go kernels and the rest are runtimes with no
  work of ours, and state per session, interrupt, streamed `stdout` and rich outputs (text,
  traceback, image, HTML) come with the protocol. No plain-exec kind.
* **The owner manages runtimes; every signed-in person sends code; an agent run may execute code
  as a tool.** Creating, stopping and removing a runtime is the owner's alone. A run aimed at a
  document that is connected to a runtime holds an `execute_code` tool of the kernel toolset; a run
  with no connected document holds none.
* **One session per document, shared.** A document is connected to one runtime and holds one
  session at a time, switchable in the document's bar. Two people with the document open share
  that session, as they share the document. Several documents on one runtime each hold their own
  session. An agent run aimed at the document uses the document's session, sharing its state with
  the people in it.
* **Every output is a proposal.** What an execution produces — a person's press or a run's tool
  call alike — lands as a proposal directly after the code block, accepted or rejected like any
  other. Nothing an execution produces is written as truth by the service or the kernel.
* **A runtime always reaches the internet, and never the stack's network.** `pip install` works in
  every runtime. No runtime has a route to `app`, `postgres`, `garage`, `kernel`, `hermes` or any
  other service of the stack; a runtime can no more read the graph than a captured page can. This
  is a security invariant of the same rank as the capture service's address rule.
* **The document's material is copied into the session per send, and written files come back as
  attachments.** Before an execution, the document's tables' files and attached files are copied
  into the session's working directory; after it, files the execution created or changed there are
  proposed as attachments of the document, in the same proposal as the output. What counts as
  written (new or changed since the copy, never what was copied in unchanged) and the size cap are
  technical decisions at transfer.
* **A runtime lives until stopped by hand.** It never stops itself; the Runtimes surface says how
  long each has been idle. Session state is never lost by surprise; a stop or a remove by the owner
  is the only thing that ends a session.
* **A new bundled extension `code` owns the surfaces, with the change prefix `CO`; `documents`
  declares the block types.** The send control, the session control in the bar, the Runtimes
  surface and the tool's surfaces are `code`'s; it is active on a fresh install and deactivatable
  like any other extension. The `code` and `output` block types are `documents`' and the editor
  draws them, as it does `image`, `video` and `table`, so a code block and its output stay readable
  when `code` is switched off — the rule of 2026-09-21 (`BO_0273`) kept, revising the answer first
  given today. User decision, 2026-09-23.
* **Each send keeps the earlier output proposals.** A block sent again adds a new output proposal
  beside the ones still open; nothing is withdrawn on the person's behalf. User decision,
  2026-09-23.
* **A session can be restarted from the bar's session control**, closing it and opening a fresh
  one on the same runtime, state gone and files kept. User decision, 2026-09-23.
* **Written files are blobs in Garage** that the output block references, drawn as downloadable
  names; no automatic table or picture is made of them. User decision, 2026-09-23.
* **The Runtimes surface is a section of `code`'s own in the panel, and a document's executions
  list in Execution beside its runs.** User decision, 2026-09-23.
* **The service is Python on `jupyter_client` with the Docker SDK.** User decision, 2026-09-23.
* **What is copied in is the document's own bytes**, fetched from Garage by the kernel and handed
  to the service: the file behind each table, each image and video block, and the files earlier
  outputs of the same document carry. The code service holds no store credential and a runtime
  reaches nothing of the stack, so the kernel is the courier. User decision, 2026-09-23.
* **The code service runs unconditionally.** No compose profile: it stands in both stacks with the
  docker socket mounted, as capture and search stand with no profile. The trust that mounting the
  socket takes on is answered by the service's posture, not by an opt-out.

## The Shape

The starting point for the transfer. Mutable except where a Decided line fixes it.

### The code service, fixed layer

- A `code` compose service in both stacks, built from `infra/code/`: the only holder of
  `/var/run/docker.sock`, internal network only, no published port, no database credential, its
  bearer generated by the bootstrap one-shot beside the others. It starts, lists, stops and removes
  runtime containers, opens, lists and closes sessions in them, sends code to a session, streams
  what comes back, interrupts a session on request, and copies files into and out of a session's
  working directory.
- Each runtime container is placed on a network of the code service's own with a route to the
  internet and none to the stack (Decided). Nothing of the stack is mounted into it; it has a
  volume of its own for its files, kept across restarts and removed with the runtime.
- A runtime is bounded: a memory and CPU cap, a cap on the size of one output, a cap on the bytes
  copied in and out per send, and a cap on how many run at once, each a technical decision at
  implementation with the owner's values in `.env`.
- Inside a runtime the service speaks the Jupyter kernel messaging protocol (Decided): it starts
  the image's kernelspec as a session and reads its `iopub` stream, so `stdout`, errors with
  traceback and rich outputs arrive already typed.
- A process holding the docker socket is root on the host, which is why the service holds
  nothing else, answers the kernel alone with its bearer, and takes an image reference and code
  from the kernel only, never from the browser.

### The kernel's half, fixed layer

- Routes under the reserved prefix, behind the session gate: runtimes (create from an image,
  list, start, stop, remove — the owner's alone), sessions of a runtime (open, list, close,
  interrupt), and execute (a block's revision against a session, answered as a stream of output
  events the way a run's events stream to the console). The kernel reads the code from the
  revision at the pin, as it reads a prompt's words (`BO_0267`), so what runs is what the graph
  holds; it copies the document's material in before the send and collects written files after.
- The output and the written files are staged as one proposal under the sender's principal — a
  person's press stages it as a proposal the way a run's work is staged — directly after the code
  block, beside any earlier output proposal of the block still open.
- `execute_code` joins the kernel toolset for a run aimed at a connected document, bound to the
  document's session server-side like every run binding; its output is a proposal of the run's
  group. `read_document` and `read_blocks` answer a `code` block's language and source and an
  `output` block's content, as they answer a table's cells (`BO_0287`).
- An execution is recorded like a run is: who sent it, which block and revision, which session,
  when, and how it ended; whether it lists in the console's Execution beside agent runs is decided
  at transfer.
- The bootstrap one-shot generates the code service's bearer; the stack-up and the release ship
  the service beside media, capture and search (`docs/system/distribution.md`).

### The graph half: the `code` extension

- In `documents`: a `code` block type — `language` and `source` — drawn as an editor with the
  language's highlighting, and an `output` block type holding what an execution produced — text,
  an error with its traceback, a picture, HTML, and the files the code wrote as references drawn
  as downloadable names — proposed directly after its code block.
- In `code`: the send control in a code block's toolbar that runs it against the document's
  session, streaming its output beneath it while it runs, and the interrupt while it runs.
- The document's connection: a control in the document's bar naming the runtime and the session,
  listing the runtimes that exist, opening a session on first send, and interrupting the one
  running.
- A Runtimes surface where the owner creates and manages them: the image, a name, the state, how
  long idle, the sessions open in it and which documents hold them, and start, stop and remove.
  Where it lives — a section of the extension's own, or settings — is decided at transfer; the
  recommendation is the extension's own section, since it owns the concept.
- The extension's `docs/system/system.md` names its prefix `CO`; its tasks and its change
  document live in the graph (`AGENTS.md`, The Docs In The Graph).

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day, after the user answered
the block-type question (Decided).

### The fixed layer, in this repository

- `docs/system/code-service.md`, new: the vocabulary, the fixed constraints, the service's routes
  and its verification, `BO_0289_001`–`BO_0289_006`, and the release-notes line, `BO_0289_016`.
- `docs/system/ui-kernel.md`, *Code From A Document*: `BO_0289_007`–`BO_0289_014` — the surface
  and the owner's gate, the execute route, the connection, `execute_code`, the document tools, the
  execution record, the verification, the rebuild and the walk — with four technical decisions:
  what is copied in, how what comes back lands (blob references on the `output` block, no
  `attachment` node, no table or picture made of a written file), the connection as a root
  property with the session in kernel state, and an execution as a record rather than a run.
- `docs/system/distribution.md`, *Code* and *The Release Names Its Extensions*: `BO_0289_015` the
  image and the compose service in the release, `BO_0289_017` `code` joining
  `release-extensions.json`.

### Landed, 2026-09-23

- The code service (`BO_0289_001`–`BO_0289_006`), its release shape (`BO_0289_015`,
  `BO_0289_017`), the kernel half (`BO_0289_007`–`BO_0289_014`) and the release note
  (`BO_0289_016`) are in this repository, each converted to truth in its document. The graph half
  is accepted and served — `documents` declares `sourcecode` and `output` and draws them
  (`BO_0289_018`), a paragraph turns into code in its place (`BO_0289_021`), the `code` extension
  exists with its section, its bar group and its send (`BO_0289_019`), the Runtimes form suggests
  images (`BO_0289_022`), the editor re-reads proposals on `calliopa:document-proposed`
  (`BO_0289_023`), and the shell's contract gained the `run` place and nested providers — through
  the proposals accepted at 2087, 2118, 2155 and after. The walk (`BO_0289_014`, in
  `docs/system/ui-kernel.md`) found five things, each fixed and re-accepted before it went on.
  This document is a member of `code` (`BO_0289_020`) and follows the status here.

### The graph

- BO_0289_018 `documents`' half is enumerated in its graph docs from a checkout, in the proposal
      that will carry it (`AGENTS.md`, The Docs In The Graph): the `code` and `output` block types
      declared as `ext.blocktype` members — `code` requiring `language` and `source`, `output`
      carrying `items` and the file references, `document` permitting both as children — the
      editor drawing a code block with its language's highlighting and an output block's items and
      downloadable files, a code block written like any other block, and `read`'s view of both.
- BO_0289_019 The `code` extension is created — manifest `bundled`, depending on `documents` and
      `ui.shell`, its `docs/system/system.md` naming the prefix `CO` — and its half is enumerated
      there: the send and interrupt controls on a code block, the session control in the
      document's bar (the runtime, the session, opening on first send, restart), the Runtimes
      section of its own in the panel where
      the owner creates and manages runtimes (image, name, state, idle time, sessions and their
      documents; start, stop, remove) and every signed-in person sees them, the executions of a
      document listed in Execution beside its runs, and streaming the output beneath the block while it runs.
      Its creation is the change's first implementation step, as `relations`' was for `BO_0288`.
- BO_0289_020 The change document is carried into the graph as a member of `code` at the status
      it then holds, and stays in step with every status it takes afterwards.

## Depends On

- `BO_0267` (completed): the sent-block gesture and the source record are what a sent code block
  reuses.
- `BO_0287` (draft): the table block lands the `read_document` widening for a structured block and
  the file behind a table, which the copy-in reads; `code` and `output` widen the same reads the
  same way.
- `BO_0229` (completed): command file attachments are the shape a written file returns as.
- `BO_0284` (completed): the kernel toolset's `read_page` and `search_web` are the precedent for
  `execute_code` as a tool the kernel answers itself, bound per run.
- It spans this repository and the graph: the service, its bearer, the kernel routes, the tool and
  the distribution are the fixed layer's; the block types, the bar control and the Runtimes surface
  are the `code` extension's. So it is a `BO` change here, and its graph half stands as a change
  document of `code` at the same status — which, as for `relations` (`BO_0288`), cannot hold docs
  until the extension exists, so its creation is the first implementation step.
