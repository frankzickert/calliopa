# CA_0035_BUILD_production-backups

Status: idea

Requested: 2026-09-04

## Intent

The production instance from `CA_0034_BUILD_production-instance` holds real
production work and nothing copies it anywhere. A lost volume loses the work.
This change gives production a backup that is taken automatically, kept for a
stated period, and — the part that matters — proven restorable.

## Why It Is Its Own Change

- `CA_0034` is runtime assembly: what production is, where it listens, how it
  restarts, and what may not write to it. It can be finished and useful without
  backups existing.
- Backups have their own failure mode, and it is a quiet one. A backup job that
  runs nightly and produces unrestorable dumps reports success every night. That
  deserves its own verification thinking rather than being an afterthought at
  the end of a larger change.

## What Has To Be Protected

Amended under `BO_0207` (2026-09-07). The shell keeps no store of its own any more, so
what this section listed is protected elsewhere or does not exist:

- The shell's content — documents, episodes, assets, publishing records — is the one
  graph's, in CCGW's database, and its bytes are CCGW blobs in the content bucket. Both
  are covered by the core's `backup` service: consistent dumps of the graph and the memory
  database, the blob-integrity drill, and the off-machine copy of the backup and content
  buckets (`garage-backup-and-restore.md`, `BO_0207_010`). There is no production Postgres
  database of the shell's and no `calliopa-assets` bucket.
- API clients and credentials are the core's (`BO_0206`), and the shell's `secrets_key`
  no longer exists.
- What is *not* covered by the core's backup is the kernel's data volume: the state
  record (workspaces, processes), the secret store under `kernel_secrets_key` with the
  party configuration and credentials, the run records and the last-known-good pin
  (`ui-kernel.md`, `BO_0207_002`, `BO_0207_003`). Losing it loses working state and every
  stored party secret, while the content survives. That volume is what this change is
  about now.

## The Precedent

`_calliopa-old/calliopa-bootstrap` has a complete working implementation at
`infra/backup/backup.sh`, built as one tool with several verbs so the scheduled
job, the restore, the drill, and the off-machine copy all exercise the same
code:

- `backup run` — the scheduled loop: dump, upload, retention, forever.
- `backup once` — one pass.
- `backup list` — what is in the bucket.
- `backup restore [NAME|latest] [DBNAME]` — restore into a named database.
- `backup drill` — restore the latest into a scratch database, sanity-check it,
  verify blob integrity, drop it.
- `backup offsite` — sync the backup bucket and the content bucket to an
  operator-configured rclone remote.

Its defaults were `BACKUP_INTERVAL_SECONDS=86400` and
`BACKUP_RETENTION_DAYS=14`. It dumps with `pg_dump -Fc -Z 6` in a single
snapshot, which is what makes the dump a consistent point in time on a live
database, and it compares local and remote byte sizes after upload rather than
trusting the copy.

`backup drill` is the verb worth keeping above all the others: it is the only
one that turns "a backup exists" into "a backup restores".

That code is no longer a precedent but the running implementation: the instance is a
second instance of that stack since `BO_0200`, and `BO_0207_010` verified its two-database
schedule, archived dump listing and drill on this instance. What remains for this change
is whether and how the kernel's data volume joins that backup, and the functional
questions below as they apply to it.

## Open Questions

- [ ] Functional question: does a backup leave this machine? Backups written to
      the same Garage that holds the originals survive a dropped database and a
      bad migration, and do not survive a lost disk or a lost machine. The
      bootstrap precedent had an rclone offsite path left unconfigured. If
      offsite is wanted, the destination and who holds its credentials are the
      user's to name.
- [ ] Functional question: how much loss is acceptable? A daily dump means up to
      a day of work is gone in a restore. That is a product decision about the
      work being done in production, not a technical default.
- [ ] Functional question: how long are backups kept, and is anything kept
      indefinitely? Fourteen days was the bootstrap default and it was never
      argued for here.
- [ ] Functional question: does the drill run on a schedule, and does a failing
      drill have to reach a human? A drill nobody reads is the same as no drill.
      This repo has no alerting, so the honest options are a drill whose result
      is visible in the application, or a drill the user runs deliberately.
- [ ] Functional question: is restoring production an operator command in this
      repo, or a documented manual procedure? The difference is whether a
      restore path exists that has been run, or a description that has not.

## Constraints Already Settled Elsewhere

- Whatever this change adds must not become a way for a script to write content
  into production. `CA_0034` establishes that content-writing scripts reach only
  the development stack and that a behavior test proves it; a restore command is
  the one deliberate exception and has to be shaped as such rather than as a
  hole in that rule.
- Backups run inside the production Compose project, under the same
  `restart: unless-stopped` the rest of that stack carries.
- The daemon this machine runs already holds roughly 250 GB of reclaimable
  images and cache. Backup retention has to be sized against real free disk, and
  `CA_0032_FIX_verify-stack-leftovers` is what keeps that number honest.

## Out Of Scope

- Backing up the graph and the content bucket: the core's `backup` service does, and
  its questions are `BO_0207_010`'s and the backup topic's, not this change's.
- Backing up the development stack, whose content is disposable.
- Backing up the agent's `hermes_data` subscriptions or Honcho's memory.
  Subscriptions are signed in again; memory is derived.
- Monitoring and alerting in general.
