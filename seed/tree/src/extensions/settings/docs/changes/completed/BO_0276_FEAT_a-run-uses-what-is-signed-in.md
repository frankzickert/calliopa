# A Run Uses What Is Signed In

Status: completed

An agent asked to do something may use the services this instance has signed into. It could not:
the kernel holds every credential and brokers every outbound call that needs one, and the
broker admitted a caller only with a resolved session — a browser's cookie, forwarded by the
shell. A run has no browser and never will, so an extension's tool route, called by the kernel in
the middle of a run, was refused `401 sign_in_required` when it asked for a party the owner signed
in and tested. The person asked for the work; the instance held the credential; the run was the
only party in the chain that could not use it. This change makes a live run able to reach the
parties its instance has, without letting anything read a secret. It collects the user's
requirement and decisions of 2026-09-22, was transferred the same day as `BO_0276_001`–`_007` under
A Run Uses What Is Signed In in `docs/system/ui-kernel.md`, and completed on 2026-09-23: the grant
a run presents, the party record's owning extension, the ownership and allowance refusals, the
record of what a run reached, the settings hand-off to a tool, and the verification in prod mode.
The walk on the instance through a real tool waits as `BO_0276_008` for the first extension tool
that needs a signed-in party, since the one that found the gap retired with refinement.

## Why This Was A Gap Rather Than A Rule

- The kernel calls an extension's tool route with `Content-Type` and its callback secret, and
  nothing else — no cookie, no principal (`internal/kernel/serve/callback.go`). It posts straight
  to the served backend, so the tool route itself is reached; it was the route's own call *back*
  to the kernel that was refused.
- Every `__kernel` path but `healthz`, `session/*` and `agent-tools` sits behind `anonymousGate`,
  which in prod refuses a caller with no resolved session (`internal/kernel/serve/proxy.go`,
  `BO_0214_009`). The secret store's own handler checks `Sec-Fetch-Site` and `Origin` and nothing
  more, so the gate above it was the whole of the refusal.
- Measured on the instance 2026-09-22: a direct `POST /__kernel/secrets/parties/<party>/request`
  from inside the kernel container answered `401 sign_in_required`, while the same party's *Test*
  from the settings row answered `verified` moments earlier, because that press carried a person's
  cookie.
- The gate is off outside prod. A tool route that brokers therefore worked in development and
  failed on a real instance, which is the worst shape a gap can take.
- Nothing about this was decided. `BO_0214_009` closed the instance to anonymous callers, which is
  right; a run is not an anonymous caller, and nothing considered it at the time.

## What The Kernel Already Knew

- A tool call's payload carries the run: `{input, run: {id, group, pin, person, system}}`
  (`internal/kernel/agenttools/extension_tools.go`). `person` is the run's `RequestedBy` — who
  asked — and `system` says nobody did.
- Runs are per-person (`BO_0232`), so *who asked* is a real identity and not a placeholder.
- The registry records which extension contributed each party (`registry.ts`, `RegisteredParty`),
  and a roster's ids are namespaced by their extension, so which extension a party belongs to was
  already known rather than something this change had to invent.
- The kernel already stages a run's writes as that run, with `RequestedBy` on the mutation context.
  Reaching a party is the same shape of act: done by the run, on behalf of the person who asked.

## Decided

The user's decisions of 2026-09-22.

* A live run may reach a party, whether a person asked for the run or an extension's trigger
  started it. The owner's existing allowance for an extension's unasked runs (`BO_0264`) is what
  covers a system run: one allowance says whether the extension may act on its own, and acting
  includes using what the instance has signed into. A second allowance for the same extension,
  asking whether it may also spend, is not built.
* An extension's run reaches that extension's own parties, and any other party the owner has
  granted it. Ownership is what the registry already records; a grant is how a service one
  extension declares comes to be used by another, so that a tool reaching another extension's
  credential is something the owner did rather than something the mechanism allows by default.
* A run's record names each party the run reached and how many calls it made. The party and the
  count, not the destination's own cost fields: the mechanism is general and the response body
  belongs to whatever party was called, so reading a cost out of it would tie the kernel to one
  provider's shape.
* There is no separate switch for this. Activating the extension and entering the key are the
  consent, and an extension that spends says so in its own settings, where the person can be told
  what it will do. The owner withholds it by deactivating the extension or clearing the key, as
  they already can.

## What This Changed

- A call made on behalf of a live run reaches the broker, and the kernel adds the credential as it
  does for a person's press. No secret is answered to anything, which is unchanged and not up for
  revision.
- The caller proves the run rather than the person: the kernel mints a grant as it calls the tool,
  hands it over in the call as `run.grant`, and admits a brokered request carrying it in
  `X-Calliopa-Run-Grant` for two minutes — the window a tool answers in, and the tighter reading
  of *while the run is live*.
- The kernel refuses a party the run's extension does not own, by name, the way it refuses a path
  outside a party's address. The party record carries its owning extension, written by the
  settings extension's `specOf` with every save, which is the graph half of this change.
- A run nobody asked for is held to its extension's allowance at the broker, read at head rather
  than trusted from the run's start.
- The run's record gains what parties it reached and how many calls it made to each.
- A tool is handed what the owner set for its extension with the call (`BO_0276_007`), so a
  setting a tool needs travels with the call rather than becoming another door the grant unlocks.

## Open Functional Questions

- [ ] Where the owner grants one extension the use of another's party, and what a grant is. The
      decision above allows a grant and says nothing about its shape: whether it is made in the
      party's row in Settings or on the granted extension's page, whether it names one extension
      or several, and whether the granting extension has any say. Nothing needs a grant today, so
      the broker admits an extension's own parties alone until something does. Carried as a `[ ]`
      line under A Run Uses What Is Signed In in `docs/system/ui-kernel.md`.

## What This Is Not

- It is not a way for an agent to read a secret. The kernel adds credentials and answers none, and
  this changes neither.
- It is not a relaxation of `anonymousGate`. An anonymous caller stays refused; what is admitted is
  a call that names a live run the kernel itself started.
- It is not specific to evaluation. The tool that found the wall was evaluation's, in the retired
  refinement extension; any extension whose tool needs a signed-in service has the same wall, and
  none in the graph brokers with a grant yet — the shell's kernel client presents a session cookie
  and nothing else, which `BO_0276_008` changes when the first such tool arrives.

## Where This Came From

- The refinement extension's `RF_0002` put an evaluation model behind refinement's typed
  decisions. Its call worked from a route a person pressed and was refused from a run's tool,
  which is where the wall was found. `BO_0280` then made evaluation a service of the kernel, which
  reaches the credential without a grant, and refinement retired; the general mechanism stays, as
  `BO_0280` decided, because the wall is every extension's.
