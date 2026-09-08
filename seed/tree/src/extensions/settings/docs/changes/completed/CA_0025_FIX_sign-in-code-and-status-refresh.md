# CA_0025_FIX_sign-in-code-and-status-refresh

Status: completed

Requested: 2026-09-03

## Intent

Both subscription sign-ins work. The surface around them does not finish the
job: the code the Claude flow asks for has no control that sends it, and a
sign-in that succeeded leaves the runtime's row reading as if it had not until
the reader reloads the page by hand.

Reported after signing in to `codex` and `claude-code` against a real agent
container: "both worked, but I had to reload the screen, and there is no send
button when I entered the corresponding codes".

Neither half is a broker fault. [Calliopa Agent](../../../../../../docs/system/agent/calliopa-agent.md)'s
sign-in design holds; this is the settings surface's half of it.

## What Happens

### The pasted code has no control that sends it

The Claude flow prints a URL and takes a code pasted back
([Calliopa Agent](../../../../../../docs/system/agent/calliopa-agent.md)). The surface renders a field for
it (`src/components/views/settings.tsx:268`) and sends it from `onChange$`
alone (`settings.tsx:283`).

- `onChange$` fires when the field is committed — `Enter`, or moving focus away
  — not when the reader has finished typing or pasting.
- Every other control on this surface is a button. The key-taking rows have
  `Save`, `Test` and `Clear`; the sign-in field has nothing, so the reader is
  left looking at a filled field with no way to act on it.
- A reader who pastes and waits sees nothing happen. The flow is still running
  and still waiting for the code, so the surface looks stuck at exactly the
  moment it is asking for something.

The `Sign in` button in the same block also loses its label while a flow is in
flight: it is only `disabled` (`settings.tsx:234`), so it still reads `Sign in`
while the thing it starts is already running.

### A succeeded sign-in reads stale until a reload

A status row's state is not stored; it is what the agent's probe last reported,
laid over the row on read (`src/server/connections.ts:62`). The browser follows
the sign-in by polling `/api/settings/agent/login` once a second, breaks out of
the loop as soon as the state stops being `running`, and immediately re-reads
the connections (`settings.tsx:110`, `settings.tsx:118`).

The broker's order is the other way round. It writes the succeeded state
(`hermes-login-broker.py:383`), then adopts the Codex tokens, then probes
(`hermes-login-broker.py:386`). The probe shells out to `codex login status`
and `claude auth status`, each with its own timeout.

So the re-read races a probe that has not run yet, and reads the `adapters.json`
written before the sign-in — `authenticated: false`. The row stays
`unconfigured` and keeps offering `Sign in`, and only a reload, once the probe
has landed, shows the truth. That is exactly the reload the report describes.

## Decided Behaviour

Answered by the user on 2026-09-03, implemented as `CA_0025_001` (the send
control and what replaces it), `CA_0025_002` (the button's label) and
`CA_0025_003` (the broker publishing after the probe), and now current truth in
[Calliopa Agent](../../../../../../docs/system/agent/calliopa-agent.md). That document is the
authoritative version of what follows.

### Sending the code

- A `Send` button sits beside the code field, reading as the other controls on
  this surface read.
- `Enter` in the field sends as well, so the habit that already works keeps
  working.
- Leaving the field no longer sends. `onChange$` fires on blur as well as on
  `Enter`, which means today a reader who types a code and clicks away has sent
  it without meaning to; the two deliberate gestures replace it.
- An empty field sends nothing, as it does today.

### While the runtime finishes

- Once the code is sent, the field and its button give way to a line saying the
  code was sent and the runtime is finishing.
- That line is driven by the `awaiting: "cli"` the broker already writes when it
  has handed the code to the pseudo-terminal (`hermes-login-broker.py:349`).
  The state exists; this is what renders it.
- Nothing interactive is left in the block, which is true to the flow: the code
  is one-time and already spent.

### The row catching up

- The broker probes before it says the sign-in succeeded. `adopt_codex_tokens()`
  and `probe_adapters()` move ahead of the succeeded write, so the order becomes
  adopt, probe, then publish.
- Adoption already had to precede the probe for Codex, because the probe asks
  `codex login status` and the adopted pair is what makes that answer true.
- The surface is unchanged here. The single re-read it already does when the
  state stops being `running` (`settings.tsx:118`) is enough once the row it
  reads is true by then, so no second polling loop is added.
- The human watches the sign-in for as long as the two `status` calls take.
  That is honest rather than slow: the sign-in is not confirmed until the
  runtime says it is authenticated.

### The Sign in button

- While its flow is running the button reads `Signing in…` and stays disabled.
- A control that still reads `Sign in` names an action already under way; the
  label follows the state instead.
- Abandoning a running flow is not part of this change. The broker supersedes a
  flow when a new request arrives, so the mechanism exists, but a cancel is its
  own behaviour to specify and prove.

## Verification Impact

- `tests/browser/agent-settings.spec.ts` covers the runtimes as rows and the
  no-agent-answering path. It cannot cover either half of this: no agent
  container runs beside it, and both halves need a flow that reaches
  `awaiting: "code"` and then succeeds.
- The Playwright container has no way to put a login state in front of the
  application either. The state is a file on the agent's shared volume, and
  nothing in the product writes one, so a scenario could only reach it by
  standing something in for the broker — which the repo does not allow.
- So this proves itself where a real flow already runs: the environment-gated
  work `CA_0022_019` names. The code control, the progress line, the button
  label, and the row being true without a reload are all things that scenario
  can observe on a real sign-in, and the last of them is what it was already
  going to have to watch for.
- `pnpm run verify` gates the result. The broker reordering is the part with
  reach beyond the surface, and the gate's `hermes service` stage already runs
  the broker and its probe against the real image — it proves the startup probe
  answers and that a request over the shared volume is answered, so a reordering
  that broke either would be caught there even though no sign-in succeeds in it.
