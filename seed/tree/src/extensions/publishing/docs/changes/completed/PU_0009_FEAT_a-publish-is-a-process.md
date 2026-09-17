# PU_0009_FEAT_a-publish-is-a-process

Status: completed

Requested: 2026-09-14, on the `PU_0004` walk: *when I publish to Bunny Stream, or some other distribution, I want UI feedback — a process indicating that this is running, and the result reported.* Today a press on *Publish to <channel>* sends the act, the button stays as it is while the upload runs, and the outcome is a notice on the tab and a row that changes state; nothing says that work is running, and a failure is gone once the tab is left.

## Where This Starts

- The shell has a process registry: one JSON record in the kernel's state record per process, carrying a workspace, a title, a state (`queued → running → waiting for input → completed`, `failed`, `cancelled`), a step, an error, the affected item's identity and kind, and an acknowledgment; shown on the affected tab's marker, the header's count pill, the dock console and the inspector's detail; polled every two seconds; errors stay attached until acknowledged ([Processes](../../../../../docs/system/workspace/processes.md) in `ui.shell`). Its producer is the agent run (`createProcess`, `moveProcess` in `src/server/processes.ts`); nothing else produces one.

- A publish is a human act with an order — gather, project, declare and upload every object, write, record — and a retirement the same act with the opposite intent ([Publishing](../publishing/publishing.md)). A deliverable's publish uploads several objects to a site; an item's uploads a video to Bunny — seconds to minutes, with nothing visible meanwhile.

- The act routes answer when the order is done: `deliverables/[id]/at/[channel]/act` and `items/[id]/at/[channel]/act` ([Channels](../channels/channels.md)). The tab says a projection refusal in words at once and reads the log's last attempt after a delivery.

- A view is handed its tab and the view bridge; neither carries the workspace id a process is created for. The shell's own producer takes it from the workspace it runs in.

## Intent

* **Every publish and every retirement is a process.** Pressing *Publish to <channel>* or *Retire at <channel>* creates a process in the reader's workspace — *Publish E1 to Calliopa.com*, *Publish Main to Bunny* — affected item the deliverable or item and its tab kind, moved to `running` before the first byte leaves and through the order's steps in words — *declaring 3 objects*, *uploading 2 of 3*, *writing the document*, *uploading to Bunny* — and to `completed` with the outcome as its last step, or `failed` with the delivery's words as its error. A projection refusal creates no process: nothing was attempted, and the tab says the rules at once as today.

* **What the reader sees**: the tab's running marker and the header's pill while it runs; the console row with the step; the inspector's detail with the state, the step and the error; a failure stays until acknowledged, on the tab it belongs to. The row under *At its channels* and the inspector's facts follow the log as they do now; the process is the feedback, the log is the record.

* **The act answers at once** with the process it started, and the tab follows the process rather than waiting on the order; the button is disabled while its process runs, and enabled again when it ends.

* **No second record of the outcome.** The process carries the log entry's id when it ends, so its detail opens the entry's words; the log stays the only record of what happened at the destination.

## Design

- The view bridge exposes the reader's workspace id, so a view's act can name the workspace its process belongs to (`CA_0050`, `ui.shell`; a data attribute on the shell root is not a contract).

- The act routes take `workspaceId` and answer `{ processId }` as soon as the process is created and the order started; the order runs on in the request's server, each step a `moveProcess`; the process ends with `completed` (step: the entry's outcome in words, `externalAddress` or the guid) or `failed` (error: the delivery's detail, the log entry's id kept beside it).

- The tabs disable the pressed act while a process of theirs runs, re-read the rows when it ends (the shell's poll is the signal: the bridge's process list, or the view's own poll of `/api/processes/<id>`), and keep saying a projection refusal as the tab's notice.

- A retirement of a deliverable or an item is the same shape.

- Proven in the behaviour suite: a publish creates a process, moves through its steps and completes with the entry; a failing site leaves a failed process carrying its words; a projection refusal leaves none.

## Out Of Scope

- Cancelling a running publish (a partial delivery is retried whole, as today).

- Progress by bytes within one upload; the step counts objects, not bytes.
