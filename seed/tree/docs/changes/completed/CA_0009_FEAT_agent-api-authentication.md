# CA_0009_FEAT_agent-api-authentication

Status: completed

Requested: 2026-08-29

## Intent

Give Calliopa a way to know who is calling its external API, so the graph
gateway can expose authenticated read and mutate endpoints to agents and
automation.

Calliopa has no identity today. The workspace shell records that
authentication, users, and collaboration arrive through their own changes, and
this is that change for the machine-caller half. It settles how a non-browser
consumer proves who it is and how Calliopa attributes and revokes that access.

## Where The Work Lives

The work is implemented and its truth is authoritative in
[API Authentication](../../system/identity/api-authentication.md). `CA_0009_001` through
`CA_0009_005` are folded into that document as current truth.

`CA_0004_001` in [Application Foundation](../../system/foundation/runtime.md)
was required supporting work: every proof here runs against real Postgres, and
the integration test class did not exist. It is implemented and folded there.

## Settled Decisions

All six shaping questions are answered and folded into that document:

- Credentials are issued, rotated, suspended, resumed, and revoked through an
  operator command-line script. There is no administration screen yet.
- A credential may carry an expiry chosen at issuance; absent one it is valid
  until revoked.
- Rotation invalidates its predecessor immediately, with no overlap window.
- A credential records its last successful use. Failed attempts go to the server
  log only, and no attempt log is stored.
- A client presents `Authorization: Bearer cak_<public credential id>_<secret>`.
- Suspension is reversible; revocation is terminal.

Authentication is implemented in the application against the existing Postgres.
Calliopa adopts no identity product and adds no auth container, because the
client record must stay the anchor for graph provenance. The decision and its
revisit trigger are recorded under Placement in the system document.

## Dependencies

- The Postgres and migration foundation from `CA_0002` is implemented.
- `CA_0009_001` needs the real-dependency integration test class from
  `CA_0004_001`, since every proof here runs against real Postgres.
- `CA_0005_008` in [Graph Gateway](../../system/content-store/graph-gateway.md) consumes the
  resolver from `CA_0009_005` and stays blocked until it is truth.

## Verification

`pnpm run verify` passed every gate: frozen install, fast development check,
migrations, integration tests, production build, application healthy, and
browser scenarios.

## Functional Questions

- None open.
