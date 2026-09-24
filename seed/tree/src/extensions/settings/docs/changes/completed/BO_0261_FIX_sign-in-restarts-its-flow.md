# BO_0261_FIX_sign-in-restarts-its-flow

Status: completed

Requested: 2026-09-17. A Claude sign-in from the settings surface timed out, which was expected. Pressing **Sign in**
again showed *"the login timed out"* at once, with no field for the code. Pressing **Sign in** must start the flow
again and follow the new one.

## Intent

* Pressing **Sign in** starts a fresh flow of the runtime's own login, and the row follows that flow: the URL, the code
  field and the outcome it shows are the new flow's, never a previous flow's. This holds after a failure or a timeout,
  and when a flow is still in flight.

## Where This Starts

- **The cause (verified on the 0.3.10 instance, 2026-09-17).** The shell's `requestLogin` (`src/server/agent/adapters.ts`)
  writes `login/request.json` and leaves the previous flow's `login/state.json` in place. The settings row's first poll
  comes one second after the request. The broker (`infra/hermes/login_broker.py`) looks for requests every two seconds.
  So the poll reads the old `{runtime: "claude-code", status: "failed", output: "…the login timed out"}`, which names the
  same runtime and is not `running`, and the row stops following. The broker does start the new flow: on the instance,
  `claude setup-token` was running and awaiting a code while the row showed the timeout.
- **Clearing the old state is not enough on its own.** When a flow is still in flight, the broker's heartbeat rewrites
  that flow's state within three seconds. The broker then answers the new request by writing `failed` / *"superseded by a
  new request"* for the old flow, and only then consumes the request. The row would follow the old URL and then stop on
  that failure.
- The kernel's own `agent/login` handler removes `state.json` before it writes the request. The shell's does not.

## Proposed Shape

- The request carries an id (the shell mints it). The broker stamps that id into every state it writes for the flow the
  request started. The row follows only a state carrying its own id. The endpoint answers `requested` until the new
  flow's first state exists. A stale or superseded state is then never read as the new flow's, whatever the timing.
- The broker half is fixed layer (`infra/hermes/`, `docs/system/hermes.md`). The request and the row are the shell's, and
  they land in the graph with this change document as a member of `ui.shell`.
- Verification: a broker test for the id round trip and for supersession, a shell test for a row that ignores a foreign
  state, and a walk on the instance: let a Claude flow time out, press **Sign in** again, and see the code field.
