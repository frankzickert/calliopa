# BO_0226_FEAT_commands-propose-into-the-open-document

Status: completed

Requested: 2026-09-09, after the first run that actually executed on the runtime `BO_0225` selected. **When I issue a command to the agents with an opened document, hermes agent only replies inside the command log. But I want it to actually propose a change to the opened doc.** User statement.

## Where This Starts

- **The composer's post carries no document.** `sendGoal$` posts `{goal, agent}` — the second field is `BO_0225_004`'s, and nothing else was ever added — the route reads `goal` and `agent` alone (`src/routes/api/workspaces/[id]/runs/index.ts`), `conductRun` takes `{workspaceId, goal, agent}` and `startBridgeRun` sends `{goal, context, agent}` (`src/server/agent/conductor.ts`, `src/server/agent/bridge.ts`). The context note it does send is `raised from workspace <id>`: the workspace, never the document. The word *artifact* does not occur anywhere in the shell's source.

- **The kernel has been waiting for that field since `BO_0173`.** The intake declares it — *"The artifact the command was issued in. The context names the blocks a reader pointed at and never their artifact, so 'explain into the artifact they are reading' had a subject the run could only infer — and the first run that tried staged a block belonging to nothing"* (`internal/kernel/agentbridge/http.go:36`) — `StartRun` takes it and records it on the run (`bridge.go:128`, `:213`), and `instructions` writes *"The reader issued this command while reading artifact X"* whenever it is non-empty (`bridge.go:869`). A test asserts that sentence is there (`skill_selection_test.go:209`). All of it has been unreachable since `BO_0207_015` moved run intake to the bridge and the shell stopped being the caller that filled it.

- **The run on record shows the consequence.** `arun-0aa4745a3e415ff3` (pin 161, `codex`, completed 2026-09-09): the goal is the reader's own draft paragraph, the record carries no `artifact` and no `intention`, `staged` is `false`, the only tools called are `web_search` twice, and the whole output is one `assistant.delta`. Nothing told the run a document was open, and nothing told it that a command issued from a document is answered by proposing into it — so it answered as a chatbot with a web search, in the console, which is exactly what the user is reporting.

- **Naming the artifact would only inform.** The sentence lands under *"Context (informational)"*, and the one line about content says to use the document tools *"for content — the documents a reader writes in"*. A run that has already decided it is being asked a question never gets there. The instructions are decisive exactly once — about the runtime, *"the user's explicit choice, not optional"* — and that is the register this needs.

- **The document tools already take what a tab holds.** `read_document` and `propose_document_changes` take a bare `documentId` (`internal/kernel/agenttools/documents.go`), a document tab's `itemId` *is* that id, and its kind is the constant the shell already has (`DOCUMENT_KIND = "ui.shell:document"`). `propose_document_changes` stages `replace`, `insert`, `remove` and `move` into the run's group *"exactly as the editor would"*. Nothing new is needed on the tool side.

- **The pointing gesture already exists, and was built for this change.** Command mode marks blocks as numbered references in mark order — `#2`, `#1`, `#3` down the page saying both which blocks were marked and in what order (`src/lib/references.ts`, `docs/system/documents/command-mode.md`, `CA_0020`). It is device-local, survives a tab switch and a reload, and — because marking is not activation — survives the reader clicking into the composer. The doc that specified it parked exactly this question: *"The composer is where references belong once something can consume them, and feeding one that cannot run would settle a shape the first real command has not had a chance to decide"*, and *"What the composer does with references, and what `Run` says while it cannot run, belong to the change that gives the composer its first backend."* This is that change.

- **`tab.selection` is not that pointer.** It holds the one block the caret is in, and `deactivate$` clears it to `null` on the way out of the editor — which is what clicking the composer does. By the time `Run` is pressed it is always empty. The marks are what a reader can point with and then go and type.

- **The open editor would not show it anyway.** `reloadProposals$` runs from a task tracking `state.loaded` and `state.saveState` — the read that follows a load or a save. A proposal staged into the document that is already open changes neither, so the panel keeps the count it was rendered with until the reader reopens the tab. The only surface that reports a run's staged documents today is the run's own detail (`runProposals`, `BO_0207_015`) — the command log again.

## Intent

* A command issued while a document is open is aimed at that document: the run is told which document it is, and that content it produces belongs there as a staged proposal the reader answers per item — not as prose in the console.

* Where the work is delivered is the reader's to state and the run's to obey, not the run's to infer from how the command was phrased.

* What the reader marked is what the command can name. Command mode stops being a gesture nothing consumes.

* The reader sees it in the document they are looking at, without reopening the tab.

* The record says what the command was aimed at. `Run.Artifact` stops being a field nothing fills, so a run's behaviour can be judged afterwards against what it was pointed at — which is what `BO_0173` added it for.

* Acceptance stays where it is. A run proposes; the human answers each item.

## The Shape

- **The composer names the target.** `sendGoal$` reads the active tab from the tabs store (never a captured closure, per the note already there); when its kind is `ui.shell:document` it posts `artifact: tab.itemId`. Not `tab.selection`, which is always `null` by then. The route, `conductRun` and `startBridgeRun` each widen, and the body reaches `POST /__kernel/agent/runs`, which has taken an artifact since `BO_0173`.

- **The composer says where the work is delivered, and the reader sets it.** A control beside the runtime selector, in the row `BO_0225_004` added: *Propose into «title»* or *Answer in the console*, present only while the active tab is a document and defaulting to propose. It travels as `delivery: "propose" | "answer"` — a field, for the reason the intake already gives about `intention`: *"a selector that recovers the intention by parsing prose is not a rule"*. It defaults again whenever the active document tab changes, so a deliberate *Answer* in one document never silently governs a command in the next.

- **The reader's pointing travels with the command.** The view bridge gains `setPointing$` beside `setSelection$` — the same direction and the same reason, a view asking the shell to record what the reader pointed at — and the block editor calls it whenever `state.marking` changes. The composer renders the marks as the count and the document they are in, which is what `command-mode.md` reserved the composer for; the body carries `references: [{number, blockId}]` in mark order. The marks stay device-local presentation state, and a command sends a copy of them rather than moving them anywhere.

- **The kernel takes both as fields.** `http.go`'s intake and `Run` gain `Delivery` and `References` beside `Artifact` and `Intention`, so the record says what the command was aimed at *and* what it pointed at — `BO_0173`'s reason, extended by the two facts it lacked. `StartRun` takes a request struct rather than an eighth positional string.

- **The instructions make the artifact a target rather than a note.** Under `delivery: "propose"` the document is named by the identity the document tools take, and the rule is stated where the runtime selection is stated — the register the instructions already keep for a choice that is not the run's to make: read that document first, stage what you write with `propose_document_changes`, and let the final words say what was staged rather than carry the content. The references are rendered in mark order, `#1 → <blockId>`, as what the reader pointed at and may name by number — pointing, not targets: what to do with them is the command's own words. Under `delivery: "answer"` the artifact stays the informational sentence it is today. The rendering stays deterministic — the same run must produce the same instructions twice (`skill_selection_test.go:197`), so the references render in mark order and nothing iterates a map.

- **The editor reads its proposals again when a run that named it ends.** The other direction of the bridge, and the shape `ViewDrop` already models: the shell writes `proposed: {itemId, seq}` when a run's terminal event arrives, `seq` rising so a second run against the same document is told apart from the first, and the block editor reloads its proposals on it. The panel's count is already what it renders from and the editor already places proposal rows in the reading order (`placeProposals`), so what the reader sees is the proposal standing where the change would land — nothing new is drawn.

### Out Of Scope

- **Resolving the run's `intention` from the document.** The intake takes it and the bridge refuses an undeclared one, but documents and blocks carry no marking in the current vocabulary (`src/server/documents/vocabulary.ts`) — the `artifact` vocabulary that carried markings was never seeded into this graph. Runs keep the base skills until markings exist.

- **More than one document per run.** The artifact is the one the command was issued in; a run that wants another reads it with the document tools as it does today.

- **Acceptance, and any auto-apply of a staged item.** Unchanged: review and acceptance belong to the human, and the instructions say so.

- **A passage reference.** Marking a range inside a block is `command-mode.md`'s own exclusion and stays one: whole blocks are what the pointing carries.

- **Remembering the delivery choice.** It defaults to propose per document tab rather than becoming a fourth thing `localStorage` keeps; a preference that outlives the session is a change once there is evidence a reader wants it.

### Decided

Decided by the user on 2026-09-09, on the three points this change could not settle for itself:

- **The reader sets where the work goes, not the model.** The composer carries the control and the run carries the choice, so a run that writes prose when the reader asked for content has disobeyed rather than judged. The alternatives — one instruction sentence leaving the judgement with the model, and every command proposing whatever it was — were both declined; the first is what the failing run already had, in weaker words.

- **The marks travel, as pointing.** Command mode's references reach the run with their numbers, and the command's own words say what to do with them. Marks as *targets* the run must replace was declined: it would settle the shape of every later command from this one case and make `add a paragraph after #2` inexpressible.

- **Documents only.** An extension tab names no artifact. Its propose path is staging `ext.source`, which a run already does by default, and one field with two meanings would have to be branched on everywhere it is read.

## Verification

- In the kernel: `instructions` under `delivery: "propose"` states the rule and names the document by the identity the document tools take; renders the references in mark order; falls back to today's informational sentence under `"answer"`; is unchanged with no artifact; and is identical across two renderings of the same run. The intake carries `delivery` and `references` through to the record.

- In the shell: the route, `conductRun` and `startBridgeRun` carry artifact, delivery and references through, each proven against the unfixed call; `setPointing$` proven by the editor's marking, and the composer's delivery control and its marks line pressed in Qwik's render harness with a document tab active and with a non-document tab active, per `BO_0224`'s lesson — and proven not vacuous by deleting the control.

- On the instance: mark two blocks, issue a command naming one of them by number, and read four things — the run record carries `artifact`, `delivery`, the references and `staged: true`; the run's tool events include `read_document` and `propose_document_changes`; the group holds document items against the marked block; and the open editor shows them in place without the tab being reopened. Then the same command under *Answer*, which must stage nothing.

## Transfer

Transferred on 2026-09-10 as `BO_0226_001`–`BO_0226_010`, each under a section *Commands From The Open Document*: the intake and the record, the instructions and the kernel verification in `docs/system/ui-kernel.md` (`_001`–`_003`); the run intake, the delivery control, the pointing through the view bridge, the editor's reload on a run's end, the graph's docs, the tree tests and the on-instance verification in `docs/system/ui-shell.md` (`_004`–`_010`), as pointers whose graph-side copies land in `command-mode.md` and `commands-and-runs.md` in the implementing proposal. This document travels into the graph as a `ui.shell` document through `kernel import-changes --file` when the work lands (`BO_0222_013`).

Order: `_001` before `_002`, and `_003` follows both; `_004` needs nothing on the shell side but reaches the run only once `_001` is served; `_005` needs `_004`; `_006` and `_007` need nothing but the bridge contract and go with `_005`; `_008` goes with `_005`–`_007`; `_009` follows its rows, and `_010` needs everything, rebuilt kernel images, an accepted proposal and a promotion.

## Implementation

- 2026-09-10. The kernel's half (`BO_0226_001`–`BO_0226_003`) landed in this repository, uncommitted: `RunRequest`, `validateTarget` and `RequestError` in `internal/kernel/agentbridge/bridge.go`, `Delivery` and `References` on the run record, the intake's two new fields in `http.go`, and `deliveryNote` composing the target into the instructions. `delivery_test.go` covers the renderings, the refusals through the real intake and the record across a restart; the no-delivery rendering was proven byte-identical to the one before the change across twelve renderings. The live-Hermes test now starts its run aimed and pointed, and was not run here — it is gated on a Hermes binary this container lacks.

- 2026-09-10. The shell's half (`BO_0226_004`–`BO_0226_009`) is staged as proposal `node:chg-d5cc8837396186bc`, fifteen files from `.local/tree-0226` checked out at dataRevision 161: `src/lib/command-target.ts`, the *Result* control, `setPointing$` and `proposed` on the view bridge, the editor's two tasks, the route, conductor and bridge, and the three graph docs. 384 unit tests and the typecheck pass and both bundles build. The block editor could not be mounted in Qwik's render harness — it reaches the global `document` the test DOM does not install — so its half is proven through `proposedFor` and waits on the walk-through (`BO_0226_010`).

- 2026-09-10, found in the walk-through (`BO_0226_010`). Both halves are served — kernel image rebuilt, the proposal accepted at 162 and promoted to pin 163 — and the first command from an open document, *write a brief intro for agent context*, reached the kernel aimed: `arun-947da371d2ec4d95` records `artifact: d3608833-…` and `delivery: propose`. It still answered in prose, in eight seconds, with **no tool call at all**. The cause is below everything this change touched: **on the `codex_app_server` runtime, Hermes 0.19.0 never forwards a run's instructions to the model.** `/v1/runs` takes `instructions` as the agent's ephemeral system prompt (`gateway/platforms/api_server.py`), which only Hermes's own loop applies (`agent/conversation_loop.py`); for this runtime that loop is *"bypassed entirely"*, and `CodexAppServerSession` sends `thread/start` with `{"cwd": …}` alone and `turn/start` with the reader's text alone (`agent/transports/codex_app_server_session.py`, `agent/codex_runtime.py`). Codex has the tools — `~/.codex/config.toml` registers `calliopa-kernel` at `/__kernel/agent-tools` — and Codex 0.151.0's `thread/start` accepts `developerInstructions` and `baseInstructions`; nothing sends them. So since `BO_0225` made codex the one runnable runtime, every run has gone out without the document, the delivery, the pin and group, or the skills — the web-search answer that started this change included.

- 2026-09-10. The fix, decided by the user the same day over carrying the instructions in the run's input (`BO_0226_011`): a second pinned-release patch in the Hermes image threads the run's ephemeral prompt into `thread/start`'s `developerInstructions`, in `infra/hermes/Dockerfile` and its distribution copy. It rewrites three upstream lines, each asserted to occur exactly once; a dry run against the running release's own files applied it, compiled both files, and refused a second application by name. The input route was declined because it would put the contract at the reader's priority rather than above it, and every runtime that forwards instructions properly would have to be special-cased back out.

- 2026-09-10. The second walk-through run proved `_011`: Codex's first developer message was the kernel's contract, the model said it would read the document and stage an introduction into it — and then searched its tool list four times, found only `codex_apps`, and reported *Staged 0 items into document `d3608833-…`; the required Calliopa document tools were unavailable in this run*, which is the final-words rule `_002` wrote, obeyed. The tools were missing because the entrypoint exported their bearer inside a subshell (`BO_0226_012`); fixed in both copies of the entrypoint, with a test on the shipped text, and the endpoint probed with the same bearer answering the four document tools.

- 2026-09-10. The third walk-through run reached the tools — `calliopa_schema` and `read_document` called with the document's id — and Codex failed both before sending them: *MCP tool call requires approval, but approval policy is never*. The kernel toolset's tools are now approved for Codex after every registration (`BO_0226_013`), the confinement unchanged since the kernel is where the gate is.

- 2026-09-10. Completed. The fourth walk-through run did what the user asked for: `arun-4fe9767e52f5f503`, aimed at the open document under *Propose*, called `calliopa_schema`, `read_document` and `propose_document_changes`, staged one introductory paragraph into its group `node:run-4fe9767e52f5f503`, said so in its final words, and the proposal appeared in the open document (`BO_0226_010`). Marks, *Answer* and a non-document tab were not walked on the instance; their tests stand for them. What it took beyond this change's own shape were three defects of the agent image, each hidden by the one before: the instructions never reached Codex (`_011`), Codex never held the kernel toolset's credential (`_012`), and Codex refused to call its tools under `approval_policy = "never"` (`_013`). Every codex run since `BO_0225` had run without its contract or its tools, and `hermes.md`'s `BO_0200_010` — a content run through the bridge staging with the document tools — is the loop this run just recorded.
