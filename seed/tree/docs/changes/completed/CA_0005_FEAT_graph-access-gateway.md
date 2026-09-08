# CA_0005_FEAT_graph-access-gateway

Status: completed

Requested: 2026-08-29

## Intent

Provide one application-owned boundary through which Calliopa reads and mutates
the revisioned graph. It retains the useful role of CCGW plus the retrieval and
graph-assembly core in
`/home/calliopa/projects/_calliopa-old/calliopa-bootstrap`, adapted to this
repository's TypeScript, Qwik City, and Postgres stack.

Consumers express graph intent without knowing tables, revision joins, or
relation-validity mechanics. The gateway is not an extension boundary and does
not load runtime-defined code or schemas.

## Where The Work Lives

The work is implemented and its truth is authoritative in
[Graph Gateway](../../system/content-store/graph-gateway.md). `CA_0005_001` through
`CA_0005_008` are folded into that document as current truth.

Two additions to the graph core were required supporting work and are folded
into [Revisioned Graph](../../system/content-store/revisioned-graph.md): a resolved relation now
carries the validity window it applied in, because the assembled response
promises it, and `readRelationSummary` resolves one relation by identity for a
write checking an endpoint or a closure.

`resolveRequestCaller` in
[API Authentication](../../system/identity/api-authentication.md) now takes its SQL client
as a parameter, matching the convention of the module it wraps, so the external
boundary can be proved against real Postgres without the application's whole
environment.

## Settled Decisions

- The consumer boundary is a typed TypeScript command and query API. No
  statement text, no parser. The old CCGW statement subset informed the
  semantics only, and a textual language may later compile into these same
  typed operations.
- Parameter separation is structural rather than an enforced rule: values are
  typed arguments, so there is no statement for a value to escape into.
- Calliopa exposes the gateway as an authenticated external API for agents and
  automation, over separate versioned read and mutate endpoints at
  `/api/v1/graph/`, refusing every unauthenticated request.
- Authentication is not built here. Authorization stays out of scope, so a
  caller the authentication change accepts reaches the whole graph.
- A write based on a revision that is no longer established refuses the whole
  mutation and returns a conflict naming the node, the expected revision, and
  the current one. The gateway resolves nothing automatically.
- The gateway carries no vocabulary of its own. `calliopaGraphSchema` composes
  nothing until the block document model contributes definitions, so reads work
  today and writes naming a type are refused until then.

## Dependencies

- `CA_0004_FEAT_revisioned-graph-core` supplies storage and transaction
  invariants. It is completed.
- `CA_0009_FEAT_agent-api-authentication` supplies the resolved caller. It is
  completed.
- `CA_0007_FEAT_graph-block-document-model` is the first domain consumer and
  contributes the first vocabulary.

## Verification

`pnpm run verify` passed every gate: frozen install, fast development check,
migrations, integration tests, production build, application healthy, and
browser scenarios.

## Functional Questions

- External API rate limits are unanswered and recorded as an open question in
  [Graph Gateway](../../system/content-store/graph-gateway.md). The API enforces none today.
  Nothing else waits on the answer.
