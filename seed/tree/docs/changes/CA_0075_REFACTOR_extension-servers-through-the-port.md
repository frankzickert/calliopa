# CA_0075_REFACTOR_extension-servers-through-the-port

Status: ready

Requested: 2026-10-01, by the user: scaffold the two apps of `BO_0319` (`calliopa-bootstrap`) as
changes that can be processed concurrently. This change moves every extension's server half onto
the port `CA_0074` adds. It then turns on the rule that keeps them there, which is the "derive
from the same source" guarantee in mechanical form. Nothing changes on an instance. It shapes the
work and authorizes no implementation.

## Transfer

Set to draft by the user on 2026-10-01 and transferred the same day into
[Device](../system/foundation/device.md), *The Port*: `BO_0319_041` became `CA_0075_001` (the
modules on the port) and `CA_0075_002` (the rule). Measured at head 3751: `publishing`,
`calliopa-refine` and `calliopa-video` are removed, so nothing is left out of the rule; twelve
modules remain, not fourteen (`manuscripts`' `make.ts`, `bibliography`'s `tools.ts` and
`documents`' `judgements.ts` no longer reach Node; `manuscripts`' `migrations.ts` does). The rule
also refuses `process.env`, `AsyncLocalStorage` and the global `fetch`, and covers `src/server/` and
`src/routes/`, so it waits for `CA_0074_003`. Worked in `calliopa-bootstrap`'s shared app track
(`BO_0335`).

## What Is Asked

- The fixed lines are [Device](../system/foundation/device.md)'s. The one this change must keep:
  the instance's behavior does not change.
- The server half of every extension the apps carry reaches Node, the environment and HTTP only
  through the port. On 2026-10-01 these are fourteen non-test modules:
  - `documents`: `admonitions.ts`, `documents.ts`, `work.ts`, `focus.ts`, `judgements.ts`;
  - `doc-block-roles`: `roles.ts`, `migrations.ts`;
  - `bibliography`: `works.ts`, `tools.ts`;
  - `manuscripts`: `make.ts`, `tools.ts`;
  - `media`: `propose.ts`, `media.ts`;
  - `relations`: `relations.ts`.
- The extensions' files are disjoint, so the migration can be shared among sessions by extension
  within this one change.
- The rule (`BO_0319_041`): a test in the tree's `check` refuses a server module that imports a
  Node built-in (`node:*`, `fs`, `path`, `crypto`, `process.env`, …) outside `src/server/port/`
  and `adapters/`.

## Takes Over From BO_0319

- `BO_0319_041` whole, in [Device](../system/foundation/device.md), *The Port*.

## Depends On

- `CA_0074` (the port).
- The rule can be turned on only once no server module still reaches Node directly. `publishing`,
  `calliopa-refine` and `calliopa-video` also reach Node directly, in fourteen modules, and the
  apps do not carry them. They are removed by `BO_0312` and `BO_0324` in `calliopa-bootstrap`.
  Proposed: this change does not migrate them. Its rule lands after those removals are accepted,
  or it names exactly those three extensions as not yet removed and drops each one when it goes.
- Runs beside `CA_0076` and every `calliopa-bootstrap` scaffold change.

## Owns

- The fourteen modules above and the rule's test.

## Verification To Shape At Draft

- The rule fails on a planted `node:fs` import in an extension's server half and passes on the
  whole tree.
- `check` and the behaviour suites pass unchanged on an instance.

## Release Notes

- None. Nothing an installer or a user sees changes.
