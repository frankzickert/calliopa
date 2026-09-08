# CA_0032_FIX_verify-stack-leftovers

Status: completed

Requested: 2026-09-04

## Intent

Every `pnpm run verify` run leaves part of itself behind. The leftovers accumulate
silently — nothing fails, the disk just fills — and there is no command that
removes them.

Two things are wanted: the gate should stop leaving them, and there should be a
`package.json` script that clears what earlier runs already left.

## What Happens

[Application Foundation](../../system/foundation/runtime.md), Verification,
says the gate "tears down temporary containers, volumes, images, networks,
credentials, and environment files on success, failure, or termination". Three of
those are true and two are not.

Measured in this checkout on 2026-09-04:

- 17 containers named `calliopa-verify-*`, every one of them `*-honcho-1`.
- 396 images named `calliopa-verify-*`.
- 2 `.env.verify-*` files in the repository root.
- 0 leftover `calliopa-verify-*` volumes and 0 leftover networks, so those two
  parts of the teardown do work.

Both causes are in `startVerificationStack`'s `teardown`
(`scripts/lib/verify-stack.mjs:19`).

### The Memory Service Outlives Its Project

`teardown` runs `compose(["down", "-v", "--remove-orphans"])` with no profile.
`honcho` and `honcho-deriver` sit under the `memory` profile
(`docker-compose.yml:112`, `docker-compose.yml:144`), and `verifyMemoryService`
starts `honcho` with `--profile memory` and only `stop`s it at the end
(`scripts/lib/verify-stack.mjs:744`, `scripts/lib/verify-stack.mjs:770`).

This was reproduced directly on the installed Docker Compose v5.1.4 rather than
inferred, using a throwaway two-service project — one plain service, one under a
profile:

- `up` the plain service, then `--profile memory up` the profiled one: both run.
- `down -v --remove-orphans` with no profile: the plain service is removed and
  the profiled container is left **still running**, not merely stopped.
- `--profile memory down -v --remove-orphans` on the same project: both are
  removed.
- `--profile '*' down -v --remove-orphans`: both are removed.

So a profile-less `down` does not reach a service outside the active profiles on
this Compose version. The gate's stopped `honcho` container survives the project
that owned it, while its network and volumes are removed around it — which is
exactly why the leftovers are containers only.

### Compose-Built Images Are Never Removed

`teardown` removes `names.browserImage` and `names.integrationImage` by name,
which are the two images the script builds itself. The images Compose builds —
`<project>-app` and `<project>-hermes`, one pair per run — are named after the
per-run project and nothing ever removes them. `down` does not remove built
images unless asked.

Also verified directly on v5.1.4: `down -v --rmi local` on a project with a built
service removes the Compose-built image, so the teardown needs no hand-maintained
list of per-run image names.

The per-run project name is unique by construction (`verifyNames`,
`scripts/lib/run.mjs:47`: `calliopa-verify-<pid>-<random>`), so nothing is
reused between runs and every run's share is additive.

## Intended Outcome

- A `pnpm run verify` run leaves no container, image, volume, network,
  environment file, or credential behind, on success, failure, or signal. The
  line in [Application Foundation](../../system/foundation/runtime.md) becomes
  true rather than aspirational.
- `pnpm run verify:clean` removes what runs before this change already left, and
  reports what it removed. Run against a clean checkout it removes nothing and
  exits `0`.
- Neither the fix nor the cleanup command can reach anything outside this repo's
  verification runs.

## Settled Decisions

These were decided by the user on 2026-09-04 and are not open.

- The change carries both halves: the cleanup command and the teardown fix. The
  command alone would be a permanent chore, and the fix alone would leave the
  existing backlog.
- `teardown`'s `down` gains `--profile '*'` rather than `--profile memory`, so it
  reaches every profiled service without teardown having to know which profiles a
  particular run activated. A gate that later puts a second service behind a
  profile does not have to remember to update the teardown.
- The same `down` gains `--rmi local`, which is what removes the per-run
  `app` and `hermes` images. The two explicit `image rm` calls for the script's
  own `browserImage` and `integrationImage` stay, because those carry custom
  names and `--rmi local` does not reach them.
- `pnpm run verify` does not sweep automatically. `verify:clean` is a separate
  command the user runs deliberately. Once the teardown is fixed there is no
  ongoing accumulation to sweep, and a sweep at the start of a gate run would
  collide with concurrent runs at the worst possible moment while making the gate
  mutate state outside its own run.
- `verify:clean` reaches only `calliopa-verify-*`. Wider disk reclamation is not
  this command's job.

## Scope Of What May Be Removed

This is the part that has to be exact, because the wrong scope deletes a
colleague's work or the development stack.

- The cleanup command matches the `calliopa-verify` prefix `verifyNames` already
  defines (`scripts/lib/run.mjs:45`) and nothing else. That prefix is the
  authority; the command must not carry a second copy of the string.
- Containers, volumes, and networks are selected by the Compose project label
  (`com.docker.compose.project`) rather than by container name, so a run's
  containers are found through the thing that actually owns them.
- Images are selected by repository name, which is the only handle a
  Compose-built image leaves once its project is gone.
- The development stack is the `calliopa` project and is never matched by the
  `calliopa-verify-` prefix. Other checkouts on the same daemon (`web-verify-*`,
  `studio-*`, `calliopa-page-*`, `calliopa-bootstrap-*`) are not matched either.
  This was observed: those projects have leftovers of their own on this machine
  and none of them are this repo's to remove.
- Dangling images in general are not this command's business. `docker image
  prune` exists and is the user's call.

## Concurrent Runs

- Other agents work in this tree at the same time, and a verification run takes
  minutes. A cleanup that removed a project with a running container would
  destroy a gate run in progress.
- So: a verify project with any running container is skipped and named in the
  report, rather than removed. Only projects whose containers are all exited are
  cleared.
- `--force` clears the skipped ones too, for the case where a run was killed and
  left something up.
- The environment file for a skipped project stays with it. `.env.verify-<token>`
  and project `calliopa-verify-<token>` share the token, so the pairing is
  already there to read.
- An orphaned `.env.verify-<token>` whose project no longer exists is a leftover
  in its own right and is removed, since the run that owned it is gone.

## Docs This Will Touch

- [Application Foundation](../../system/foundation/runtime.md), Verification:
  the teardown line, which has to name the profile and the built images rather
  than claim a completeness the code did not have; and a new line for
  `pnpm run verify:clean` beside the `check` and `verify` lines, since it is a
  third entry point.
- The same document's Implementation section, where `CA_0002_007` describes what
  the gate tears down.
- [Calliopa Agent](../../system/agent/calliopa-agent.md) is not touched. The memory
  service's behavior does not change; only what happens to its container
  afterwards.

## Verification Impact

- The teardown fix is provable from the gate itself: run `pnpm run verify`, then
  assert no container, image, or environment file carrying that run's token
  survives. That is a shell observation, not a test suite.
- The scope rule is worth a behavior test, because it is the part that could
  destroy something: given a list of Compose projects including `calliopa`,
  `calliopa-verify-<token>`, and `web-verify-<token>`, only the middle one is
  selected. That wants the selection to be a pure function over listings, with
  the `docker` calls at the edges.
- The running-project skip belongs in the same test, over the same listings: a
  project with a running container is reported and not selected, and `--force`
  selects it.
- `pnpm run verify` gates the result.

## System Work

The specification lives in `docs/system/`. This section is the coordination record only.

- `CA_0032_001` in [Application Foundation](../../system/foundation/runtime.md),
  Verification: the teardown's `down` carries `--profile '*'` and `--rmi local`, so a
  service behind a profile and the images Compose built for the run go with it.
- `CA_0032_002` in the same section: `pnpm run verify:clean` removes what earlier runs
  left, reaching only this repo's verification runs through the prefix every run name is
  already derived from.
- `CA_0032_003` in the same section: a run still working is named and left alone, and
  `--force` clears it.
- `CA_0032_004` in the same section: the selection is a pure function over listings, and
  `tests/behavior/verify-clean.test.mjs` covers it.

## Out Of Scope

- The leftovers other repos left on this machine.
- General Docker disk reclamation, image pruning, and build cache.
- Any automatic sweep from `pnpm run verify`.
- Anything about what the memory gate proves or how it runs.
- The development stack's own containers and volumes; `pnpm run db:clear`
  already owns clearing development data.
