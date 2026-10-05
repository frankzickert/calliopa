# CA_0080_FIX_a-quiet-run-cannot-crash-the-shell

Status: completed

Requested: 2026-10-04, by the user, after the instance stopped serving: the shell's server process
died at 14:41:34 UTC on pin 152 and the kernel went to `state broken`. The kernel's side, which
restarts a pin whose process crashed while serving, is `BO_0348` in the bootstrap repository.

## What Happened

- The serve process exited with an uncaught `TypeError: terminated`, cause `BodyTimeoutError`,
  `code: 'UND_ERR_BODY_TIMEOUT'`, thrown from `server/entry.node-server.js` into Node's top level.
  The process had been serving for about two hours; the person's last review action was at
  14:33:56.
- Undici aborts a response body that sends nothing for its body timeout, five minutes by default.
- The likely source: `POST /api/workspaces/[id]/runs` starts a run and then calls
  `void followRun(processId, runId)` (`src/routes/api/workspaces/[id]/runs/index.ts`). `followRun`
  (`src/server/agent/conductor.ts`) reads the run's event stream through `followBridgeEvents`
  (`src/server/agent/bridge.ts`) with no `idleMs`. A run that sends no event for five minutes —
  a long tool call, a waiting model — makes `reader.read()` reject. Nothing catches it: the read
  is outside the function's `try`, `followRun` lets it through, and the route discards the promise
  with `void`. Node ends the process on an unhandled rejection.
- Not confirmed: the stack points into the bundle, not at a source line, so `followRun` is the
  one call in the server that matches, not a traced one.
- The shell's server has no process-level guard (`unhandledRejection`, `uncaughtException`): any
  rejected promise nobody awaits ends it, and every person on the instance loses the shell.

## The Request

- A run that stays quiet longer than the stream's timeout does not end the shell's server. A
  failure inside work the server starts in the background ends that work, logged with what it was
  doing, and leaves the server serving.
- When the follower loses a run's event stream while the run is still going, the run keeps showing
  *running* and the shell reconnects quietly. The kernel answers a reconnect with the run's buffered
  events first, so a run that ended in the meantime still ends *completed*, *failed* or
  *cancelled*. Only when reconnecting keeps failing for five minutes does the run take the
  abandoned outcome `run-lifecycle.md` fixes: `failed`, with the error saying the application
  stopped following the run and the agent may have finished the work — never as a failure of the
  run itself. User decisions, 2026-10-05.
- A quiet run no longer reaches the timeout at all once the kernel sends a keep-alive every minute
  on the event stream, which is `BO_0348`'s. This change keeps the shell safe without it.
