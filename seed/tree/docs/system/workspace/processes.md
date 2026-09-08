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
* The registry is displayed through status markers on affected tabs, a compact header indicator, the expanded command dock, and contextual details in the right drawer.
* Errors stay attached to the operation and affected item until acknowledged or resolved. A toast alone is insufficient.
* Nothing in this change produces a process. The first producer arrives with the first real long process.

- The agent run in [Calliopa Agent](../agent/run-lifecycle.md) is the registry's first producer, started from the dock composer. Until it lands nothing produces a process.
- A process records workspace, title, state, step, error, affected item identity and kind, acknowledgment, and timestamps.
- The API lists and creates processes for a workspace, reads one process, applies validated state transitions, and acknowledges a failure.
- The shell re-attaches to process records through polling. Server events or sockets may replace polling later without changing the registry contract.
- The dock console lists process state, title, and step. Selecting one opens its inspector detail. The header counts active processes. Affected tabs show running or failed markers. The inspector shows state, step, error, and acknowledgment control.
- The header indicator is a count pill that stays quiet at zero and takes the running colour when work is active.
- The indicator toggles the dock console: pressing it moves the dock to its console position, and pressing it again returns the dock to composer. It stays pressable at zero and then opens an empty console, so the console is always reachable from the header.
- A process that staged proposals is the index into them: its inspector detail names the documents its groups touched and how many items in each stand unanswered, and opens each. Answering an item happens in the document, per [Block Editor View](../documents/proposed-changes.md); the inspector is what says which documents are waiting.
- A selected process's inspector detail names the documents its run staged a group against, says how many items in each are still unanswered, and opens each in a tab. The count is of what is unanswered because that is the only number a reader can act on: an answered item is already truth or already rejected, and either way there is nothing left to open the document for (`CA_0022_014`).
- A run that proposed nothing says so, and a process that is not a run answers the same question with nothing rather than a refusal. The inspector asks it of whatever is selected, and "this is a render, not a run" is not an error worth a status code (`CA_0022_014`).
- A run is found on a group through the provenance it staged with rather than through a table joining the two. The graph already carries why a write exists, and a second record of the same fact is one that can disagree with it. The detail follows the selection rather than the registry's poll, because what a finished run proposed does not change while a reader looks at it (`CA_0022_014`).
- The browser scenarios stage their own group as the agent, through the same authenticated API the agent uses, because a run here proposes nothing on its own. That the tool server writes this provenance when it stages is proven against real Postgres; what the scenarios prove is that the shell reads it back, names the document, counts what is unanswered, and opens it — on both form factors, with the phone's inspector sheet opened as any reader would (`CA_0022_014`).

## Implementation

- Since `BO_0207_014` a process is one JSON record in the kernel's state record (`/__kernel/state/processes/<id>`), listed for a workspace by reading the collection and keeping its own, in creation order; the transition rule is unchanged, and the agent run moves its process through the same module (`moveProcess`) rather than by SQL, with `migrations/0019_agent_run_detached.sql` dropping the run table's foreign keys to the tables that stay unread in the retired database until `BO_0207_005`. `migrations/0003_process.sql` held the process record: workspace, title, state, step, error, affected item identity and kind, acknowledgment, and timestamps. `src/lib/process.ts` owns the exhaustive transition rule over all thirty-six state pairs, and `src/server/processes.ts` lists and creates processes for a workspace, reads one, applies a validated transition, and acknowledges a failure. `GET`/`POST /api/workspaces/:id/processes`, `GET /api/processes/:id`, `POST /api/processes/:id/transition`, and `POST /api/processes/:id/acknowledge` carry them; a rejected transition answers 409, an unexplained failure 400. Nothing produces a process (`CA_0002_018`).
- The shell loads the workspace's processes with the route and re-attaches to them by polling `/api/workspaces/:id/processes` every two seconds. All four surfaces read that one registry: affected tabs mark running or failed work, the header counts unfinished processes, the dock console lists state, title, and step and selects one, and the inspector shows the selected process with its step, its error, and the acknowledgment that clears the tab marker. Desktop and mobile scenarios drive creation, transition, and failure through the API (`CA_0002_019`).
- The header indicator is a count pill carrying `data-running`; it stays on the quiet surface at zero and takes the running colour above it. It is an `aria-pressed` toggle that moves the dock between its console and composer positions and stays pressable at zero. Registry coverage opens the console from the header on both form factors and toggles it at zero (`CA_0010_006`).
