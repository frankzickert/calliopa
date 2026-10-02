# CA_0074_REFACTOR_the-server-port

Status: completed

Requested: 2026-10-01, by the user: scaffold the two apps of `BO_0319` (`calliopa-bootstrap`) as
changes that can be processed concurrently. This change is the shell's first part of the
scaffold. The frame's server half reaches the world through one port, so that the same handlers
can later run in a WebView with the device cell behind that port. Nothing changes on an
instance. It shapes the work and authorizes no implementation.

## Transfer

Set to draft by the user on 2026-10-01 and transferred the same day. The work is enumerated in
[Device](../../system/foundation/device.md), *The Port*: `CA_0074_001` (the port and the Node
adapter, in place of `BO_0319_040`) and `CA_0074_002` (the frame's ten modules on it).
`BO_0319_041` is narrowed to the extensions' server halves, which `CA_0075` takes over.

## Implementation

Claimed on 2026-10-01 from head 3631 and completed the same day. The port, its Node adapter and the ten modules
on it are in [Device](../../system/foundation/device.md), *The Port*. The gateway and the kernel are
reached by route, and `#port` binds the adapter at build time. Verified in a checkout:
`typecheck`, `build`, the unit suite and the behaviour suites (`TestShellDocumentsOverCCGW`) pass
as they did at head 3631. Head already fails 9 unit tests and 14 behaviour files (42 tests), so
the comparison is with those. One documents scenario in the behaviour suites runs close to its
5-second limit and times out on both trees. Walked by the user at pin 3649: documents, a run and an acceptance behave as before. The frame's
other clients go onto the port in `CA_0074_003`, which the user left open on 2026-10-01.

## What Is Asked

- The fixed lines are [Device](../../system/foundation/device.md)'s. The one this change must keep:
  the instance's behavior does not change, and `build` stays what the kernel runs.
- `src/server/port/`: the one interface the server half reaches the world through. It covers the
  graph gateway (query, mutate, explain, head, blobs), the kernel (sessions, acceptance,
  proposals, document tools, party records, runs), the clock, and outbound fetch.
- `adapters/node-server/` implements the port with what the server half does today.
- The frame's own server modules reach Node, the environment and HTTP only through the port. On
  2026-10-01 these are the ten non-test modules under `src/server/` that do so: `processes.ts`,
  `kernel-callback.ts`, `graph-gateway.ts`, `request-context.ts`, `workspaces.ts`, `registry.ts`,
  `ccgw/branch-scope.ts`, `ccgw/env.ts`, `agent/attachments.ts` and `agent/adapters.ts`.
- The extensions' server halves are not this change's (`CA_0075`), and neither is the rule that
  refuses a Node import. They keep working unchanged, because the port is added beside what they
  call today.

## Takes Over From BO_0319

- `BO_0319_040` whole, in [Device](../../system/foundation/device.md), *The Port*.

## Depends On

- Nothing. It can start at once, beside `BO_0326` in `calliopa-bootstrap`. It is the only
  scaffold change in the graph that can.
- `CA_0075` and `CA_0076` start after it, and so does `calliopa-bootstrap`'s `BO_0319_053`: the
  kernel's operations in the device cell, registered for the routes this port names.

## Owns

- `src/server/port/`, `adapters/node-server/`'s port implementation, the ten modules above.

## Verification To Shape At Draft

- `check` and the behaviour suites pass unchanged on an instance, before and after.
- A pin builds and serves, and a walk of documents, a run and an acceptance behaves as before.

## Release Notes

- None. Nothing an installer or a user sees changes.
