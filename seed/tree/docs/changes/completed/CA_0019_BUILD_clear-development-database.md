# CA_0019_BUILD_clear-development-database

Status: completed

Requested: 2026-08-30

## Intent

Development fills the stack with documents, blocks, revisions, workspace tabs,
and layout left over from earlier work. There is no way back to an empty
instance short of removing the Postgres volume and re-running
`pnpm run bootstrap`, which also tears down Garage and re-issues its
credentials to solve a problem that only concerns Postgres.

This change adds `pnpm run db:clear`, one command that empties the development
database and leaves it immediately usable.

[Application Foundation](../../system/foundation/runtime.md) already fixes
that the application stays valid and renderable while the database holds
nothing, and that every gate run proves it. That state is currently only
reachable at first bootstrap. This script makes it reachable on demand, which
is also what makes it worth testing against by hand.

## The Command

- The command is `pnpm run db:clear`.
- It never asks for confirmation. Every other script in the repo runs without
  prompting, and a command that never blocks can be invoked from another script
  or by an agent without a bypass flag existing.
- Because nothing stops the command, the refusal rules under Safety carry the
  whole weight of not destroying the wrong data.
- It leaves the database migrated and ready to use. After it returns, the
  application works against it with no further command.
- The name says `db`, so the fact that it does not touch object bytes is
  stated by the command itself rather than being a gap in it.

## What The Empty State Is

- Empty does not mean no tables, and it does not mean no rows. Migrations seed
  structural rows the application cannot run without: the `calliopa` row in
  `graph_scope`, and the single `graph_data_revision` row holding the current
  data revision.
- Dropping the schema and re-applying migrations would restore those seeds by
  construction, and would have been the simplest definition of empty. Keeping
  API clients rules it out: their rows cannot survive a drop, and reading them
  out and writing them back afterwards couples the script to a schema shape it
  otherwise never needs to know.
- So the script deletes content rows and keeps the schema. That means it holds
  an explicit account of every table — cleared, preserved, or seeded — and that
  account is knowledge the migrations already carry, held in a second place.
- That duplicate is the real cost of this change, and it drifts silently: a
  table added by a later migration is simply missed, and the miss looks like a
  successful clear. Verification below closes that, and it is the part of this
  change worth building carefully.
- Every table falls in exactly one class:
  - Cleared: `workspace`, `process`, `graph_node`, `graph_node_revision`,
    `graph_relation`, `graph_relation_validity`.
  - Preserved: `api_client`, `api_credential`, `schema_migrations`.
  - Seeded: `graph_scope` keeps its `calliopa` row, and
    `graph_data_revision.current` returns to `0`.

## What Is Cleared

- Workspace persistence: tabs, the active tab, layout, and preferred views. The
  shell comes back as a fresh workspace.
- Process records, which cascade from the workspace anyway.
- The graph content: nodes, node revisions, relations, and relation validity.
  Every document and every block lives here, so this is the part the request is
  actually about.

The data revision returns to `0`, so a browser tab left open across a clear
holds revisions that no longer exist. Reload after clearing. This is a
development convenience, not a live-migration path, and it does not need to
survive an open session.

Garage is not in scope. It holds no application bytes today — `/health` is the
only thing that reaches it — so there is nothing there to clear. When something
does store bytes, clearing them belongs with that change.

## What Is Preserved

* API clients and their credentials survive a clear. An operator issued them
  deliberately, external callers hold tokens against them, and re-issuing after
  every clear would make the command expensive to use.

- Nothing in the graph references `api_client`, and `api_credential` cascades
  from it, so the two tables lift out cleanly. Preserving them costs no
  referential care.
- The consequence is stated plainly: a cleared development database still
  authenticates the callers it authenticated before. Clearing is about content,
  not about access.
- `schema_migrations` is preserved for the same structural reason the seeds
  are — the database stays migrated, so the ledger stays true.

## Safety

* The script only ever touches the development stack. It must not be able to
  reach the verification stack or any other database.

- `pnpm run dev` already refuses when `.env.dev` is absent or incomplete, and
  the scripts reach the development stack through the shared Compose helper.
  This script uses the same door, which is what keeps the guarantee above from
  being a promise in prose only.
- Since the command never asks, that refusal is the only thing between a
  mistyped invocation and lost data, so it is a behavior to test rather than an
  incidental property of the helper it borrows.
- `pnpm run verify` builds its own uniquely named, isolated project per run and
  is unaffected by this script either way.
- The script does not touch `.env.dev` and does not re-issue Garage
  credentials. Clearing data is not re-bootstrapping the stack.

## What This Is Not

- Not a migration rollback tool. It returns the database to the state the
  current migrations define, not to an earlier one.
- Not a seeding or fixture command. Mock data is not allowed in this repo, so
  the result is an empty instance, never a demo one.
- Not part of `pnpm run check` or `pnpm run verify`. Both gates already own
  their own data lifecycle, and a destructive command inside a gate is a way to
  lose work.

## Verification Impact

* A table the script does not classify must fail the gate, not pass a clear
  silently.

- That is one integration test against real Postgres: read the live table list
  from the catalog and require every table to appear in exactly one of the
  script's three classes. It destroys nothing, so it is safe in the shared
  integration database, and it fails on the migration that introduces an
  unclassified table rather than months later on a clear that quietly kept
  someone's data.
- The refusal rules are service-free and belong in behavior tests, the way
  `pnpm run dev`'s environment-file rules already do.
- Proving the clearing effect itself is harder. Integration files share one
  database and one global data revision and run one at a time in a single fork,
  so a test that actually clears fights every other integration test. Either
  that proof restores what it cleared, or it does not run against the shared
  integration database.
- A scenario belonging with this change: a preserved API client still
  authenticating against the external API after a clear that removed every
  document. That is the promise the preserve decision makes.
- `pnpm run verify` gates the result.

## System Work

Transferred into [Application Foundation](../../system/foundation/runtime.md),
which owns the development environment and the `bootstrap`, `dev`, and
`migrate` scripts:

- Two fixed requirement lines: that clearing never removes API clients or their
  credentials, and that a clearing operation reaches only the development
  stack's database.
- `CA_0019_001` builds `pnpm run db:clear` with its table classification,
  refusal rules, and proofs.
- `CA_0019_002` guards the classification against drift with a catalog check,
  reading the script's own classification rather than restating it.

Implementation waits for the user to set this change to `Status: ready`.
