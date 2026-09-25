# Processes

## Async-Native Interaction Model

Short requests and long-running processes are different primitives.

| Type             | Typical behavior                    | Reporting                                          |
| ---------------- | ----------------------------------- | -------------------------------------------------- |
| Immediate action | Rename, reorder, toggle, save       | Inline response or brief notification              |
| Short request    | Generate summary, inspect asset     | Local progress state with completion message       |
| Long process     | Render, transcribe, analyze footage | Persistent process entry that survives tab changes |
| Failed process   | Recoverable or terminal failure     | Visible error, failed step, retry and details      |

## Process Registry

* The process registry is backed by the kernel's per-instance state record since `BO_0207_014`; it was Postgres-backed from the start.
* A process record carries `queued → running → waiting for input → completed`, with separate `failed` and `cancelled` outcomes.
* Long processes never trap the user in a blocking dialog. The registry lives above individual tabs.
* The registry is displayed through status markers on affected tabs, a compact header indicator, and the right panel, where the list and a selected process's detail both stand. User decision, 2026-09-20 (`CA_0058`, replacing the four surfaces this line named while there was a dock).
* Errors stay attached to the operation and affected item until acknowledged or resolved. A toast alone is insufficient.
* A process may be produced by a contributed extension as well as by the shell: a route of an extension creates one and moves it through `createProcess` and `moveProcess`, and the four surfaces show it with no further contract — its item kind is one the registry knows, qualified by the extension, as `parseProcessInput` already requires. Requested by `PU_0009` in `publishing` — every publish and retirement a process — 2026-09-15 (`CA_0050`).

- The agent run in [Calliopa Agent](../agent/run-lifecycle.md) is the registry's first producer, started from a block's command control; the publishing extension's publish is the second (`PU_0009`).
- `createProcess` and `moveProcess` in `src/server/processes.ts` are the module an extension's server half imports, as it imports `~/server/kernel/client`; `processes.test.ts` proves the input rule accepts an affected item of a contributed kind (`publishing:deliverable`), and `tests/behavior/kernel-surfaces.test.ts` proves such a process is created against the kernel's state record, listed in order, moved through running to failed with its words, and acknowledged like a run's (`CA_0050_002`).
- A process records workspace, title, state, step, error, affected item identity and kind, acknowledgment, and timestamps.
- The API lists and creates processes for a workspace, reads one process, applies validated state transitions, and acknowledges a failure.
- The shell re-attaches to process records through polling. Server events or sockets may replace polling later without changing the registry contract.
- The right panel's *Execution* section lists process state, title, and step ([Agent Activity](./agent-activity.md)). Pressing an entry opens its detail in the same panel, for the tab it was pressed on. The header counts active processes. Affected tabs show running or failed markers. The detail shows state, step, error, the run's events and the acknowledgment control.
- A second press on the selected entry lets the selection go, and a press on another moves it there. The entry says whether it is selected with `aria-pressed` as well as its selected look. The selection is the active tab's, per [Layout](./layout.md#inspector) (`CA_0040_003`).
- The header indicator is a count pill that stays quiet at zero and takes the running colour when work is active.
- The indicator shows the right panel on the list and hides it again, at zero as well, so the list is always one press from the header.
- A process that staged proposals is the index into them: its inspector detail names the documents its groups touched and how many items in each stand unanswered, and opens each. Answering an item happens in the document, per [Block Editor View](../documents/proposed-changes.md); the inspector is what says which documents are waiting.
- A selected process's inspector detail names the documents its run staged a group against, says how many items in each are still unanswered, and opens each in a tab. The count is of what is unanswered because that is the only number a reader can act on: an answered item is already truth or already rejected, and either way there is nothing left to open the document for (`CA_0022_014`).
- A run that proposed nothing says so, and a process that is not a run answers the same question with nothing rather than a refusal. The inspector asks it of whatever is selected, and "this is a render, not a run" is not an error worth a status code (`CA_0022_014`).
- A run is found on a group through the provenance it staged with rather than through a table joining the two. The graph already carries why a write exists, and a second record of the same fact is one that can disagree with it. The detail follows the selection rather than the registry's poll, because what a finished run proposed does not change while a reader looks at it (`CA_0022_014`).
- The browser scenarios stage their own group as the agent, through the same authenticated API the agent uses, because a run here proposes nothing on its own. That the tool server writes this provenance when it stages is proven against real Postgres; what the scenarios prove is that the shell reads it back, names the document, counts what is unanswered, and opens it — on both form factors, with the phone's inspector sheet opened as any reader would (`CA_0022_014`).

## Implementation

- Since `BO_0207_014` a process is one JSON record in the kernel's state record (`/__kernel/state/processes/<id>`), listed for a workspace by reading the collection and keeping its own, in creation order; the transition rule is unchanged, and the agent run moves its process through the same module (`moveProcess`) rather than by SQL, with `migrations/0019_agent_run_detached.sql` dropping the run table's foreign keys to the tables that stay unread in the retired database until `BO_0207_005`. `migrations/0003_process.sql` held the process record: workspace, title, state, step, error, affected item identity and kind, acknowledgment, and timestamps. `src/lib/process.ts` owns the exhaustive transition rule over all thirty-six state pairs, and `src/server/processes.ts` lists and creates processes for a workspace, reads one, applies a validated transition, and acknowledges a failure. `GET`/`POST /api/workspaces/:id/processes`, `GET /api/processes/:id`, `POST /api/processes/:id/transition`, and `POST /api/processes/:id/acknowledge` carry them; a rejected transition answers 409, an unexplained failure 400. Nothing produces a process (`CA_0002_018`).
- The shell loads the workspace's processes with the route and re-attaches to them by polling `/api/workspaces/:id/processes` every two seconds. All three surfaces read that one registry: affected tabs mark running or failed work, the header counts unfinished processes, and the right panel lists state, title and step, selects one, and shows the selected process with its step, its error, its events and the acknowledgment that clears the tab marker. Desktop and mobile scenarios drive creation, transition, and failure through the API (`CA_0002_019`).
- The header indicator is a count pill carrying `data-running`; it stays on the quiet surface at zero and takes the running colour above it. It is an `aria-pressed` toggle that shows the right panel on the run list and hides it again, and stays pressable at zero (`CA_0058_007`).
- A system process is told apart from a person's run (`BO_0245_010`, `src/components/shell/inspector.tsx`): the console row carries the Phosphor `sparkle` glyph (`data-process-system`), the detail's eyebrow says *System*, its trigger line says which extension started it after the change at which revision (`data-process-triggered-by`) and names the document it proposes into, which a press opens (`data-process-item`), and its conclusion is what the run concluded without proposing it (`data-process-concluded`); the header's indicator counts it as it counts any running process. A person's run never carries a system run's trigger (`BO_0264`).

## Command File Attachments

- A run's attachments (`BO_0229`, [Commands And Runs](./commands-and-runs.md), *Command File Attachments*) are listed in its process detail, each with what the run was given.
- The process detail lists the run's attachments (`BO_0229_011`). `GET /api/processes/:id/attachments` reads the run through `runForProcess` and `readBridgeRun` and answers the record's `attachments`, each `{id, filename, mediaType, size, delivered}`, and an empty list for a process that is not a run. The inspector reads it beside the proposals when the selection changes and lists them under *Attached* (`data-process-attachments`), each a download link with its size and what the run was given — *read as text*, *seen as an image*, *name, type and size only*. `GET /api/attachments/:id/file` reads the `attachment` node and sends its `file` blob with the stored media type, `Content-Disposition: attachment` with an ASCII `filename` and a UTF-8 `filename*`, and `X-Content-Type-Options: nosniff`, so an HTML or SVG file downloads rather than rendering in the shell's origin; a node that is not an attachment is `404`.

## Per-Person Runs

- Under `BO_0232`, promoted to draft by the user on 2026-09-16 and transferred the same day: a run a person starts, and its process, belong to that person. The decisions and the kernel's half are `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, *Per-Person Runs* (`BO_0232_001`–`BO_0232_005`): visible to the person and the owner; a run's proposals stay reviewable by others; runs and processes from before the change are the owner's; the kernel's and the shell's routes refuse, CCGW stays open behind them; system runs stay visible to everyone; one person and dev mode behave as today.
- A process names its account (`BO_0232_006`): `conductRun` reads the signed-in person (`readSession`) and `createProcess` writes their name as `account` on the process the run gets (`ProcessRecord.account`); a process started where no session resolves names none, and `systemProcess` writes none. The kernel stamps and filters the record too (`ui-kernel.md` `BO_0232_003`), so the console and the header count read a list that never holds another person's process.
- The run routes say what happened (`BO_0232_007`): `kernel/client.ts` `refusalOf` keeps a kernel `403` as `403`; `conductRun` answers the intake's `403` as reason `forbidden`, which the run route answers `403` in the kernel's words; `runEvents` answers `null` when the bridge answers `404`, and `GET /api/runs/:id/events` answers `404` *No run … is known to the kernel* instead of `200 []`; `POST /api/runs/:id/cancel` answers `404` for a run the kernel does not serve this person, as for an unknown one; the proposals read of a process the kernel does not serve this person answers an empty list, as for a process that is not a run. A busy refusal carries the kernel's words, which name another person's run by its age alone.
- An attachment opens only through its run (`BO_0232_008`): the process detail's links carry `?process=<id>`, and `GET /api/attachments/:id/file` sends the file only when `attachmentForProcess` (`src/server/agent/attachments.ts`) finds the process's run through the kernel as the caller — refused where the kernel does not serve it — and that run's `attachments` name the id; anything else answers `404` *No attachment … is known here*.
- Verified on the tree (`BO_0232_009`), 2026-09-17, at dataRevision 1357: `src/server/agent/per-person.test.ts` at the transport boundary — a signed-in person's command writing their account on every write of the run's process and a session-less one writing none, a kernel `403` kept with its words and code, the intake's `403` answered as `forbidden` and its busy words passed through, a run's events unknown on `404` and empty on an empty stream, and an attachment read through a run that carried it and refused through a run the kernel does not serve, a run that did not carry it, and no process. Each assertion was shown to bite. `tsc --noEmit` clean, the unit project green (815 tests), both production bundles built. The system process's missing account is the kernel's `serve/per_person_verification_test.go`'s to prove, since `systemProcess` is unchanged.
- Verified on this instance (`BO_0232_010`), 2026-09-17, at pin 1361 with the kernel image rebuilt, as two probe human accounts, A and B:
  - A's run (`arun-008834a7281c9759`, Codex, proposing one block into *Testing Doc* and carrying `note.md`) recorded `person: walk0232a`. While it ran, B's command was refused `409` *The agent is busy with another person's run, running for under a minute.* — no id, no goal.
  - For B the run was absent from the kernel's run list and the console's process list, and its record, its events (`GET /api/runs/:id/events`), its cancel, its process, its attachments list and its file (`?process=`) all answered `404` or empty; for A each answered, and the file downloaded. A file route without `?process=` answered `404` to A too.
  - B read *Testing Doc*'s proposals and found A's run's group among them: a run's proposals stay reviewable by others.
  - A run and a process recorded before the change (`arun-65894fedb0fcf666`, a process naming no account) answered `404` to both, as the owner's; a system run (`arun-62b2a70e30d1528d`) and a system process answered both.
  - The owner's view — every person's runs and processes, and those from before the change — was not walked in a browser, since no agent signs in as the owner; it stands on the kernel's `serve/per_person_verification_test.go` over real sessions. The probe's proposal was rejected and both accounts retired after the walk.

## The Run List In The Panel

- Under `ui.shell`'s `CA_0058`, set to draft by the user on 2026-09-20 and implemented the same day, the console left the dock for the right panel ([Commands And Runs](./commands-and-runs.md), *The Dock Went*). The list's own shape and its groups are [Agent Activity](./agent-activity.md), *Execution Is The One List*.
* A run's events stand in the selected process's detail, where its step, its error, its attachments and the documents it proposed into already stand. An entry in the list says state, title and step, and nothing more. User decision, 2026-09-20.
* The header's count pill shows the right panel on the run list and hides it again, at zero as well, so the list is always one press from the header. User decision, 2026-09-20.
- The list is the panel's *Execution* section rather than a second list beside it (`CA_0058_005`). Pressing an entry selects its process and opens its detail, a second press lets it go, and the selection stays the active tab's (`CA_0040_003`); a run's entry keeps its own press for showing and hiding its proposals and carries a caret that opens the detail (`BO_0267`, user decision 2026-09-20). `ProcessList` is gone from `inspector.tsx`, and nothing in the shell draws a console.
- A run's events stand in its detail (`CA_0058_006`). A task in `shell.tsx` reads `GET /api/runs/:id/events` for the selected process's `runId` when the selection changes, and again on the registry's poll while that run is queued or running — a run that has ended is read once, since what it did does not change while a reader looks at it. `InspectorPanel` draws `describeRunEvent`'s lines under the step, the error and above what the run proposed (`.run-activity`, `data-run-activity`, `data-run-event`), and a process that is no run shows none. *Cancel* stays on the run's entry, offered while its process is queued or running (`CA_0022_018`).
- The header's pill opens the panel (`CA_0058_007`). It keeps its count, its quiet zero and its running colour; its `aria-pressed` says whether the right panel is showing the inspector's icon, and a press shows it on that icon or hides it, at zero too. On a phone it opens the inspector's edge sheet on the list, since the panel is the sheet there.
- `process-selection.test.ts`, through `testing/inspector-host.tsx`, presses the list where it now stands: an entry's press taking that tab's detail, the selection held per tab and let go by *Close process* and by a second press, and the selected run's events drawn in its detail in the contract's own words. The events case was shown to fail with the activity taken out of the detail.

## A Process's End Reaches The Open Document

* A generation sent from a block appears in the document that was open when it was sent, without
  a reload, as an agent run's proposals already do (`CA_0063`; found by the user on 2026-09-22,
  sending a picture into a document they had open, which a sender's process — a process and no
  run, `BO_0273_035` — had filled without the document being told).
- What arrives is the proposals read, never a document re-read: `proposed` on the view bridge is
  answered by the block editor reading its proposals again, so a reader typing keeps their caret,
  and a sender's process need not report what it staged, since the read is by document. A closed
  document does nothing; a tab opened later reads its proposals as every open does. The rule is
  every process's, not the sender's: a process of any kind that ended for a document and that no
  run this session follows raises the signal from the poll by its record alone. Taken with the draft on
  2026-09-23 (`CA_0063`).
- `endedForDocuments` (`src/lib/ended-processes.ts`, `CA_0063_001`) is that rule, pure: from the
  registry's items, the ids already told and the runs this session follows, it answers the
  documents to raise `proposed` for in the poll's order, each once, and the told set with the
  newly ended processes appended. A process without an item, one still going, one told already
  and one whose `runId` is a run this session follows answer nothing — the last because a
  followed run tells its own end from its events (`BO_0226_007`). Proven in
  `ended-processes.test.ts`: a sender's completed process raised once and remembered, a failed
  one raised too since the pending block is what the reader rejects, a running or itemless one
  ignored, a followed run left to its events, a run from another session raised like any process,
  and several ends in one poll raising each document once in order.
- The registry's poll in `shell.tsx` calls it on every read (`CA_0063_002`): `run.announced` is
  the told set of every process, and the first poll only primes it, so a reload does not
  re-announce every past process; each document answered raises `runProposed`. A system run's end
  reaches the view the same way ([Run Lifecycle](../agent/run-lifecycle.md)). Verified
  2026-09-23 on the tree: `tsc --noEmit` clean, the unit files green.
- The first walk, at pin 1852 on 2026-09-23, showed the pending block at once and never the
  picture: the signal and the read were right, and the editor's proposal row kept the block it
  mounted with (`documents`, [Agent At Work](../../../src/extensions/documents/docs/system/documents/agent-at-work.md),
  `CA_0063_005`).
- Walked on the served build at pin 1887 on 2026-09-23, and the user said it works
  (`CA_0063_005`): a picture sent from a block in an open document showed its pending block at
  once, and the picture filled it within a poll of the Execution entry reading completed. A
  generation takes the better part of a minute, so the box stands empty that long before the
  fill; the entry's state is what says when to expect the picture.

## The Run Used A Profile

- Under `calliopa-bootstrap`'s `BO_0298`
  ([Block Document Model](../../../src/extensions/documents/docs/system/documents/block-document-model.md#profiles)
  in `documents`): a run started from a document with a profile attached is guided by it, and the
  record says so (`calliopa-bootstrap`'s `ui-kernel.md` `BO_0298_002`). The person sees it in the
  run's detail and nowhere else; the chip stays as it is. User decision, 2026-09-25 (`BO_0298_Q10`).
- The process detail names the profile (`BO_0298_031`, landed 2026-09-25): `GET /api/processes/:id/profile` reads the run through `runForProcess` and `readBridgeRun` and answers the record's `profile` — `{id, title}` — or `null` for a run with none and for a process that is not a run; the shell reads it beside the proposals and the attachments when the selection changes (`ProposedRead.profile`), and the detail draws one line under the step, *Profile: «title»* (`data-process-profile`), whose press (`data-process-profile-open`) opens the profile document in the document tab as `data-process-item` opens what a run proposes into. `BridgeRun` carries the field. Proven in `process-selection.test.ts` through the inspector host: the line with its title for a run guided by one, and nothing for a run with none.
