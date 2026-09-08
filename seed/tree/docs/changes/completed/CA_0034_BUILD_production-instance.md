# CA_0034_BUILD_production-instance

Status: completed

Requested: 2026-09-04

## Intent

Run a production instance of Calliopa on this machine, beside the development
stack, on the host port range 4000–4020. It restarts by itself — after a crash,
after a Docker daemon restart, and after the host reboots. No script in this
repo may write content into it.

This is the instance that will hold real production work. The development stack
stays what it is: a place where content is created and cleared freely.

## What Happens Today

- `docker-compose.yml` plus `docker-compose.dev.yml` is the only stack a
  developer can start. `scripts/lib/run.mjs` exports `DEV_ENV_FILE` and
  `devCompose` and nothing else that addresses a long-lived stack;
  `verifyComposeFor` builds a throwaway project per gate run.
- Every operator script is hard-wired to `devCompose`: `scripts/bootstrap.mjs`,
  `scripts/dev.mjs`, `scripts/migrate.mjs`, `scripts/db-clear.mjs`, and
  `scripts/client.mjs`. There is no second stack for any of them to reach.
- No service carries a `restart:` policy. A daemon restart leaves the whole
  development stack down.
- `Dockerfile` already has the `production` target: it builds the client bundle,
  prunes to production dependencies, and runs
  `node server/entry.node-server.js`. Nothing in the repo starts it outside a
  verification run.
- Measured on the daemon on 2026-09-04: nothing publishes a port in 4000–4020.
  The occupied ranges are `calliopa` (4500–4503), `web` (4420–4422), `homepage`
  (4460–4462), and `studio` (4400–4420, currently down). Windows-side listeners
  that are not Docker containers were not enumerated, so the first `pnpm run
  prod` is what finally proves the range is free.
- Docker Desktop 28.1.1 on the `default` context over
  `unix:///var/run/docker.sock`.

The sibling repo `~/projects/studio` has already solved the same problem —
`docker-compose.prod.yml`, `.env.prod.example`, `scripts/prod.mjs`,
`scripts/bootstrap-prod.mjs`, `scripts/lib/bootstrap-stack.mjs`, and a
`prodCompose` in its `scripts/lib/run.mjs` under the project `studio-prod`. Its
shape is the reference for this change, not a thing to copy blindly.

## Intended Outcome

- A production stack runs under its own Compose project with its own volumes,
  its own environment file, and its own secrets, reachable at
  `http://100.114.122.91:4000`.
- It runs the `production` image target: no Vite, no source syncing, no
  `develop.watch`. A code change is deployed by re-running the deploy command,
  which rebuilds the image and recreates the application.
- It comes back on its own after a container crash, a Docker daemon restart, and
  a host reboot, with nobody running a command.
- No script in this repo can write or clear content in it. That is provable, not
  merely intended.
- The development stack, the verification gate, and the other repos' stacks on
  this daemon are untouched by all of it.

## Settled Decisions

Decided by the user on 2026-09-04.

- The production instance runs on this same machine, beside development, on the
  host port range 4000–4020.
- It runs the full stack, mirroring development: `app`, `postgres`, `garage`,
  `hermes`, and `honcho` with its deriver behind the `memory` profile.
  Production gets its own agent, with its own signed-in subscriptions and its
  own memory, rather than borrowing development's.
- Restarting automatically includes surviving a host reboot. The change owns
  making that true and proving it, including the host-level configuration that
  sits outside this repo.
- Keeping scripts away from production content is structural *and* proven: the
  content-writing scripts reach only the development stack by construction, and
  a behavior test asserts that no script can address the production project or
  its environment file. Drift fails where it is introduced.
- Production comes back after a reboot the same way the code-server container
  already does, on the Docker Desktop daemon this machine already runs. No
  second daemon, no systemd distribution, no Task Scheduler entry.
- Nothing in this change reserves machine resources or limits what may run
  beside production. The machine is not contended.
- The production agent stages proposals and may not write truth. Its credential
  is issued with `--proposer`.
- Backups are not in this change. `CA_0035_BUILD_production-backups` carries
  them, and production runs unbacked until it lands.

## Port Allocation

- This repo gains a second owned host range, 4000–4020 on `100.114.122.91`, for
  production. 4500–4520 stays what it is: development, and the verification
  gate's isolated projects that publish nothing.
- Production takes the front of the new range in the same service order
  development uses: web 4000, Postgres 4001, Garage S3 4002, Hermes 4003, Honcho
  4004. 4005–4020 stays free for later services.
- Every port stays overridable through the environment file, as development's
  are.
- The fixed line in [Application Foundation](../../system/foundation/runtime.md),
  Network — "This repo owns the host port range 4500–4520 … nothing outside that
  range is published" — is contradicted by this and has to be rewritten to name
  both ranges. It is a `*` line, so the rewrite happens only on the user's word;
  this decision is that word, recorded here so the draft transfer can carry it.

## Isolation From Scripts

This is the part that has to be exact, because getting it wrong means a script
deletes real work.

- The production stack is reached only through a `prodCompose` and a
  `PROD_ENV_FILE` in `scripts/lib/run.mjs`, beside the existing `devCompose` and
  `DEV_ENV_FILE`. Nothing else in the repo may name the production project or
  environment file.
- Content-writing scripts keep addressing `devCompose` alone. Today that is
  `scripts/db-clear.mjs`, which already relies on reaching the development stack
  through that helper as its only guard. It must not gain a target flag, an
  environment override, or any other way to be pointed at production.
- Access-writing is a different thing from content-writing and is deliberately
  allowed to reach production. `pnpm run client issue` creates API clients and
  credentials, which the fixed line in [Application
  Foundation](../../system/foundation/runtime.md) already exempts from
  clearing. Production needs its own issued `cak_` credential for the agent, so
  the operator script needs a way to address the production stack. Structural
  and access-carrying scripts (`bootstrap`, `migrate`, `client`) get a
  production form; content-clearing scripts do not.
- The verification gate is already isolated by construction: `verifyNames`
  builds a unique per-run project and `verify:clean` matches only the
  `calliopa-verify` prefix. The production project name must not begin with that
  prefix, or a cleanup would reach it. It must also not be `calliopa`, or it
  would be the development stack.
- Integration and browser tests run inside a verification project and never see
  a published port, so they cannot reach production even by address.

## Restarting Without Anyone Present

- Every production service carries `restart: unless-stopped`. That covers a
  container crash and a Docker daemon restart, and it deliberately does not
  restart a stack an operator stopped on purpose.
- Surviving a host reboot needs the Docker daemon itself to come back. On this
  machine that is Docker Desktop 28.1.1 on Windows, and it already does: the
  `devstack-vscode-production` container carrying `restart: unless-stopped` is
  the code-server the work happens inside, it is the only container on the
  daemon with a restart policy, and it returns after a reboot without anyone
  starting it. Production needs no mechanism that is not already proven on this
  machine by the environment the developer uses every day.
- The reboot behaviour is proven by an actual reboot and observing the stack
  answer on 4000 with no command run, not by reading the restart policy back.
- That proof is the user's to run, and the change document says so rather than
  pretending otherwise. Agent sessions execute inside the `devstack` container
  with the Docker socket mounted and no `/mnt/c`: an agent can neither read nor
  change Docker Desktop's Windows-side autostart setting, nor reboot the host,
  nor watch it come back. Confirming the autostart setting is on is a one-time
  user action, and the reboot observation is a user observation.
- No resource constraint is placed on the machine. 32 cores and 31 GiB carry
  production beside a development stack and a verification run without
  contention worth designing around. Disk pressure is real — the daemon holds
  roughly 250 GB of reclaimable images, build cache and volumes — but it belongs
  to `CA_0032_FIX_verify-stack-leftovers` and `pnpm run verify:clean`, not here.

## The Agent In Production

- Production's `hermes` gets its own `hermes_data` and `agent_config` volumes, so
  its subscriptions are signed in once, in production, and are not shared with
  development's.
- `CALLIOPA_HERMES_API_KEY` and `CALLIOPA_SECRETS_KEY` are generated per stack
  and never shared. A production secrets key that ever changed would make every
  stored connection secret unreadable while reporting success, exactly as it
  would in development.
- `CALLIOPA_AGENT_TOOLS_TOKEN` is issued against the production database with
  the operator script, not copied from `.env.dev`. A development token names a
  client row that does not exist in production.
- Honcho runs only when its key is stored, decided the same way `pnpm run dev`
  decides it: read through the credential accessor and handed to Compose in the
  spawned process's environment, never written into the environment file. The
  application holds no control over the Docker daemon, so a key saved in
  production takes effect the next time the deploy command runs. That is a
  once-per-instance event.
- The production agent is a proposer. Its credential is issued with
  `--proposer`, so an agent run stages proposal groups and a human answers them
  per item; nothing the agent does becomes production truth unaccepted. The
  class is chosen at issue time and moved afterwards with `pnpm run client
  class`, so this is a starting position rather than a wall.

## Deployment And Data

- Production starts empty. No development content is copied into it; the
  application is valid and renderable with nothing in the database, and every
  gate run already proves that.
- Bringing production up is a deliberate command, never automatic and never part
  of `pnpm run dev` or `pnpm run verify`.
- The deploy command does not gate on `pnpm run verify`. Running the quality
  gate before deploying is the user's call.
- Migrations reach production through their own command. A schema change is
  applied deliberately; nothing migrates production as a side effect of a
  development action.
- Production runs unbacked until `CA_0035_BUILD_production-backups` lands. That
  is a stated decision rather than an oversight: this change is runtime assembly
  and backups are their own piece of work with their own failure modes.

## Docs This Will Touch

- [Application Foundation](../../system/foundation/runtime.md), Network: the
  fixed port-range line, rewritten to own both ranges and say what each is for.
- The same document gains a Production Stack section: what production is, the
  project and volumes, the ports, the image target, the restart guarantee and
  what it depends on, the commands that reach it, and the rule that
  content-writing scripts cannot.
- The same document's Development Environment section, where the clearing lines
  live: the fixed line "An operation that clears development data reaches only
  the development stack's database. It must not be able to reach the
  verification stack or any other database" already covers production and stays
  true; the surrounding mutable lines should name production explicitly so the
  guarantee is readable rather than implied.
- [Calliopa Agent](../../system/agent/calliopa-agent.md): that an instance's agent
  credentials, subscriptions and memory belong to that instance.
- No product behaviour changes, so no view, editor, graph or publishing document
  is touched.

## Verification Impact

- `tests/behavior/compose-environment.test.ts` already keeps
  `config/required-env.json`, the Compose application environment, and
  `.env.dev.example` aligned, and asserts the verification override publishes
  nothing. It grows the production assertions: the production example file names
  every required variable, every production port falls inside 4000–4020 and
  differs from the development default, the override builds the `production`
  target and restarts every service, and the override carries no `develop`
  section.
- A behavior test proves the isolation rule over the scripts themselves: the
  content-clearing script reaches only the development helper, and no script
  names the production project or environment file except the ones allowed to.
  This is the assertion that would catch a future agent adding a `--target prod`
  flag to a clearing command.
- The reboot guarantee is proven by user observation, not by a test and not by
  an agent: reboot the host, run nothing, and see the stack answer on 4000. An
  agent session cannot reach the Windows side or the host's power state, so a
  test asserting the restart policy string would prove only that the string is
  there. The change document must say which half is mechanical and which half is
  observed.
- `pnpm run verify` gates the change. It runs against its own isolated project
  and must stay untouched by production existing — including `verify:clean`,
  which must not select the production project.

## Out Of Scope

- Any product behaviour, view, or content-model change. This is runtime assembly
  only.
- Moving production off this machine, TLS, a public hostname, or anything
  reached from outside the Tailscale network.
- Monitoring, alerting, and log shipping.
- Backing up the production database and object bytes, which
  `CA_0035_BUILD_production-backups` owns.
- Reclaiming the daemon's accumulated disk, which
  `CA_0032_FIX_verify-stack-leftovers` owns.
- A migration path for content that already exists in the development stack.
- The other repos' stacks on this daemon and the leftovers they have left.
