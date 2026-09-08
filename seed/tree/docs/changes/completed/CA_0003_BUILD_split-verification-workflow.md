# CA_0003_BUILD_split-verification-workflow

Status: completed

Requested: 2026-08-29

## Intent

Split repository verification into a fast development check and a complete
change-completion gate. Agents can use the fast check repeatedly while
implementing work without paying the cost of isolated infrastructure,
production images, and browser testing. The complete gate runs once at the end,
when the user asks an agent to complete a change.

## Proposed Commands

- `pnpm run check` is the fast development command. It runs directly from the
  checkout using already-installed dependencies and does not start Docker,
  services, production builds, migrations, readiness probes, or browsers.
- `pnpm run verify` remains the authoritative completion gate. It includes the
  fast checks and all long-running integration and production checks, so a
  passing gate proves the complete repository contract rather than only the
  checks omitted from `pnpm run check`.

## Fast Development Check

- Check TypeScript with no emitted output.
- Check formatting without rewriting files.
- Run unit tests.
- Run service-free behavior tests, including configuration and repository
  contract tests that only inspect local files or pure code.
- Report each check explicitly and exit non-zero when any check fails or cannot
  run.
- Do not run a frozen dependency installation. Dependency and lockfile
  consistency remains part of the completion gate.

## Change-Completion Gate

- Run the complete fast development check.
- Verify dependencies with a frozen lockfile installation.
- Start a uniquely named, isolated Compose stack with real Postgres and Garage
  and no published ports.
- Run real-dependency behavior tests and migrations.
- Build and serve the production image and require the real `/health` probe to
  pass.
- Run Playwright browser scenarios against the production application on
  desktop and mobile projects.
- Tear down temporary containers, volumes, images, networks, credentials, and
  environment files on success, failure, or termination.
- Report every gate explicitly and exit non-zero when any gate fails or cannot
  run.

## Agent Workflow

- Agents run `pnpm run check` during implementation in proportion to the work
  being performed and report its result when handing off incomplete or
  intermediate work.
- Running `pnpm run verify` is required only when the user asks an agent to
  complete the whole change.
- An agent must not mark a change `Status: completed` unless the complete
  `pnpm run verify` gate passed for the final working tree.
- The user is not responsible for running either command on an agent's behalf.

## Documentation And Implementation Scope

- Update the process documentation so task-level development work uses the fast
  check while change completion is gated by the complete verification command.
- Update system truth describing verification without weakening the existing
  real-dependency, production-image, isolation, cleanup, or browser guarantees.
- Split the current verification orchestration and test selection so the fast
  command cannot accidentally acquire Docker or real-service dependencies.
- Add behavior coverage for command composition and failure propagation.
- Keep `pnpm run verify` as the stable complete-gate command; callers do not need
  to learn a replacement completion command.
