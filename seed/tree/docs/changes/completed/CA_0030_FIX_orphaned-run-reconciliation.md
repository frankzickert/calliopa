# CA_0030_FIX_orphaned-run-reconciliation

Status: completed

Requested: 2026-09-03

## Intent

A run that is in flight when the application restarts is never moved. It stays
`running` for as long as the database keeps it, it holds the agent's one active
run slot, and every later goal — in any workspace — is refused as busy.

Found by `CA_0022_017` while building `pnpm run verify:agent`: the development
stack restarted mid-run, and the next scenario was refused with `The agent is
already working. Wait for it to finish.` on an agent that was doing nothing.

## What Happens

A run is followed by the process that started it.
`src/routes/api/workspaces/[id]/runs/index.ts` answers the reader and then
calls `driveRun` without awaiting it; `followRun` in
`src/server/agent/conductor.ts` reads the agent's stream and is the only thing
that moves the run when it ends.

That is the right shape for the request — handing over a goal is quick and the
run is not — but it means the run's whole lifecycle lives in one application
process and nothing outside it knows the run exists.

- When that process goes away, the run is not failed, not cancelled, and not
  resumed. `followRun`'s own guard against a stream that stops saying anything
  never runs, because the code that would run it is gone.
- The agent keeps working. Hermes is a separate container and finishes the run
  it was given; only Calliopa's record of it is abandoned.
- The slot is held instance-wide. `migrations/0010_agent_run.sql` makes one
  active run a unique index on `client_id` where the state is `queued` or
  `running`, and the agent is a single client, so an orphan in one workspace
  refuses every goal in every other workspace.
- The console offers `Cancel` only while the run's process is queued or running
  ([Workspace Shell](../../system/workspace/frame.md)), which the orphan still is
  — so the recovery exists, but only for a reader who is in the workspace the
  orphaned run belongs to. From anywhere else the agent is simply busy forever,
  and nothing says why or where.
- Today's way out is `POST /api/runs/:id/cancel` with an id read from the
  database by hand.

This is not confined to a developer restarting a stack. Any deploy, crash, or
container replacement during a run leaves the same state.

## Shape Of A Fix

* A run that has not been heard from within a bound is failed. Nothing waits
  for a restart to reconcile it: the bound is read by whoever next looks at the
  agent's slot, so an application that stays up while the process following a
  run dies recovers too, and a crash needs no separate startup path.
* An abandoned run reaches the registry's `failed` state carrying its own
  error, which says that the application stopped following the run and that the
  agent may have finished the work. The process state set fixed by
  [Workspace Shell](../../system/workspace/frame.md) is preserved; abandonment is
  told in the error the console already shows, not in a sixth state word.
* The busy refusal says what holds the slot: whether the run belongs to this
  workspace or another one, its goal, how long it has been running, and its id.
  The refusal is the only thing a reader outside the run's own workspace ever
  sees, and today it says the one thing that is not true. It cannot name the
  workspace, because a workspace record has no name; the id it carries is the
  run's, which is the handle the cancel route takes.
* Adoption is not built. A run that was abandoned is failed, and the proposal
  group it had already staged survives and is still there to accept — so the
  work reaching the reader does not depend on following the run again.

- The bound is derived from the follower's own ceiling rather than from how
  long work takes. `readAgentRunEvents` aborts the whole read at 600 seconds,
  and `ask` buffers the stream to its end, so a followed run cannot outlive
  that: a live run's row is untouched between its move to `running` and its
  terminal move, and a run still silent well past the ceiling has nothing
  following it. A bound above the ceiling can therefore only ever move a run
  that is already dead.
- 15 minutes is the proposed bound: the ceiling plus enough margin that a slow
  start or a loaded machine cannot trip a run that is still being followed.

- Whether the pinned Hermes replays a run's events from the start is the one
  thing that would let adoption be judged worth building, and it is unanswered.
  It is open as `CA_0030_003` in [Calliopa Agent](../../system/agent/calliopa-agent.md),
  Run Lifecycle, and neither part of this fix waits on it.

## System Work

The specification lives in `docs/system/`. This section is the
coordination record only.

- `CA_0030_001` in [Calliopa Agent](../../system/agent/calliopa-agent.md),
  Run Lifecycle: a run nothing is following is failed and the slot
  freed before the slot is answered. Landed; folded into truth there.
- `CA_0030_002` in the same section: the busy refusal says what holds
  the slot instead of claiming the agent is working. Landed; folded
  into truth there.
- `CA_0030_003` in the same section: the replay probe that decides
  whether adoption is worth building, held with `pnpm run verify:agent`.
  Still open, and neither of the other two waits on it.

The bound, its derivation from the follower's 600-second ceiling, the
abandonment error, and what the refusal may say about a workspace that
has no name are fixed and mutable lines in that section, not tasks.

## Verification Impact

- Provable against real Postgres: a run left `running` past the bound with no
  process following it is failed with the abandonment error, the slot is
  freed, and a later goal is accepted.
- Provable in the gate without performing a restart. What matters is a run
  record with nothing following it and an `updated_at` older than the bound,
  which is a state that can be written directly.
- The busy refusal is provable in the same place: a run inside the bound still
  refuses a second goal, and the refusal carries whether the run is elsewhere,
  the goal, the run's age, and its id rather than claiming the agent is working.
- `tests/integration/agent-runs.test.ts` already proves the slot is held and
  freed by ordinary terminal states, so this extends a suite rather than
  starting one.
