# CA_0004_FEAT_revisioned-graph-core

Status: completed

Requested: 2026-08-29

## Intent

Introduce a revisioned graph as Calliopa's durable content foundation. The
design should preserve the useful core of
`/home/calliopa/projects/_calliopa-old/calliopa-bootstrap` without bringing its
extension system into this repository.

This change owns storage primitives and invariants. A separate change owns the
consumer-facing graph gateway, and later changes define the first domain model
and editor over that gateway.

## Proposed Core

- A node has stable identity and owns no mutable content directly.
- An immutable node revision carries the node's content, semantic type,
  lifecycle state, parent revision, provenance, schema version, and monotonic
  data revision.
- A revision's lifecycle state is one of `candidate`, `established`,
  `archived`, or `rejected`. `candidate` is unaccepted content, `established`
  is current truth, `archived` was established and has since been superseded,
  and `rejected` was never accepted.
- Lifecycle state is the one revision field that changes on an existing
  revision. A state change states how a revision stands, it does not edit what
  the revision says, so it must not mint a content-identical revision.
- A revision carries both the data revision it was created at and the data
  revision of its most recent lifecycle change, so an as-of read can separate
  whether a revision existed at a point from whether its state then was the
  state it holds now.
- A directed relation connects a node to another node or relation and carries a
  semantic relation type plus provenance.
- Relation validity records when a relation applies relative to the revisions
  of its endpoints; changing or removing a relation closes its validity rather
  than rewriting or deleting the relation.
- Every node, revision, relation, and validity record carries a graph scope
  identifier. Calliopa is one shared graph whose records are explicitly scoped,
  so a later projects or tenancy change can partition content without
  backfilling existing history.
- The first release runs with a single scope value provisioned by migration.
  Nothing selects, routes, or authorizes by scope yet; the identifier is stored
  so records read outside their own database stay attributable.
- Postgres is the authoritative graph store. This change does not introduce a
  second graph database or require Apache AGE.
- A transaction advances the graph's data revision once and commits all node,
  revision, relation, and validity changes atomically.
- Current and historical graph state can be resolved deterministically from the
  stored primitives.
- Historical resolution is a storage capability the gateway may call. This
  change ships no user-visible history or as-of read surface; a later editor or
  view change owns that surface if the product needs it.

The exact TypeScript and SQL shapes should be derived during the draft transfer
from the old `docs/system/data-model.md`, `internal/domain/`, and
`internal/storage/`, retaining only behavior needed by this product.

## Invariants

- Node identity is stable across content edits.
- Content revisions are append-only; existing revision content is never edited
  in place.
- Lifecycle state is the only in-place revision mutation, and each state change
  advances that revision's lifecycle data revision.
- A revision's creation data revision is stamped once and never changes.
- At most one revision of a node is `established`.
- Relation endpoints and semantic type are immutable after creation.
- A visible relation always has visible endpoints.
- A node's scope identifier is immutable for the node's lifetime and is stamped
  on every revision of that node.
- A relation's scope identifier equals its origin's scope, and equals its
  target's scope when the target is a node. No relation crosses a scope
  boundary.
- A graph transaction either commits every requested operation or none.
- Stored graph records expose stable logical identifiers, never Postgres row
  identity, to consumers.
- Retention and cleanup must preserve any history the product promises to
  users.

## Evolution Model

- The graph is application infrastructure, not a runtime extension host.
- New semantic types, relations, indexes, migrations, and graph behavior enter
  the repository through Calliopa change documents, system tasks, review, and
  deployment.
- There are no extension manifests, installable graph packages, graph-hosted
  source files, materialized extension trees, extension dependency resolution,
  or privileged extension namespaces.
- Database migrations may evolve physical storage. Application-owned schema
  definitions may evolve graph meaning, but both remain ordinary reviewed
  repository changes.

## Proposed Scope

- Define the four durable primitives and their database representation.
- Define the four lifecycle states, the transitions permitted between them, and
  the data-revision stamping each transition performs.
- Stamp and enforce the scope identifier across all four primitives.
- Define monotonic data-revision allocation and atomic transaction behavior.
- Implement current-state and as-of storage operations needed by the gateway.
- Enforce identity, revision, endpoint, lifecycle, scope, and validity
  invariants.
- Add real-Postgres migration and behavior coverage, including rollback on a
  failed multi-operation transaction and an as-of read that spans a lifecycle
  change.
- Document backup and migration implications for revisioned graph records.

## Out Of Scope

- A query language, HTTP API, graph response assembly, domain validation, or
  editor behavior.
- A user-visible history, revision browser, or as-of read surface.
- Proposal creation, review, acceptance policy, and conflict resolution. The
  `candidate` and `rejected` states exist in storage for a later change; this
  change writes only `established` and `archived` and offers no path into the
  other two.
- Scope selection, scope routing, multi-scope reads, tenancy, and authorization
  over the stored scope identifier.
- Collaboration, classification, enrichment, embeddings, and agent-specific
  provenance unless a later accepted requirement needs them.
- Runtime extensions or graph-hosted application code.

## System Transfer

- `docs/system/content-store/revisioned-graph.md` carries the authoritative specification.
- `CA_0004_001` established the real-dependency integration test class in
  `docs/system/foundation/runtime.md`; this change was the first real case
  the foundation reserved it for.
- Completed work becomes truth in `docs/system/content-store/revisioned-graph.md`; the
  remaining `CA_0004_...` lines there are the open work.

## Dependencies

- The Postgres and migration foundation from `CA_0002` must be implemented.
- `CA_0005_FEAT_graph-access-gateway` builds on this change.
