# BO_0075_FEAT_second-cell

Status: superseeded

## Summary

- Make a second knowledge system, and therefore a second cell, possible.
- `BO_0074_FEAT_cell-per-knowledge-system` establishes that one cell serves exactly one knowledge system, and deliberately defers everything that only becomes real once more than one exists.
- This change collects that deferred half so it is recorded rather than rediscovered.
- Nothing here is needed to run the first knowledge system.

## Problem

- `BO_0074` sets the structure for one cell per knowledge system but explicitly builds no knowledge-system creation, no provisioning automation, and no second cell.
- Several decisions are cheap to defer and expensive to forget. At one cell they are invisible: there is one contract version, one host, one database, one deployment, and no negotiation to do.
- The point at which they stop being invisible is the second cell, not gradually. That makes this a real boundary worth naming rather than a vague backlog.
- Without a change document holding them, these questions resurface inside whichever feature change happens to hit them first, which is the failure `BO_0074` was itself split out to avoid.

## Desired Outcome

- A second knowledge system can be created and served without revisiting the isolation model settled in `BO_0074`.
- Consumers that meet several cells at once behave correctly when those cells are at different contract versions.
- Provisioning a cell is a defined operation rather than a manual sequence performed once.
- The cost decisions deferred in `BO_0074`, particularly database instance sharing, are made with real numbers rather than in advance.

## Deferred From BO_0074

- Knowledge-system creation and provisioning automation. `BO_0074` runs one knowledge system with no creation path.
- Cell assignment. `BO_0074` settles that cell ids are platform-assigned, region-scoped, and independent of the knowledge system, but not who assigns one or when.
- Database instance topology. `BO_0074` establishes that a cell requires its own database and credentials and that sharing a PostgreSQL instance between cells is invisible to the cell. Which way to go is a cost decision that only matters at scale.
- Deployment rollout across many cells. `BO_0074` makes rollout order irrelevant to correctness by having consumers negotiate per cell, but operating a rollout across many cells is still platform-owned work that does not exist yet.

## Scope

- Define how a second knowledge system is created and how its cell is provisioned and assigned.
- Define how a consumer discovers what a specific cell supports, if `contractVersion` alone proves insufficient.
- Verify that two cells cannot reach each other's graph, which is the first point at which the `BO_0074` isolation guarantee can be tested against real separation rather than asserted.
- Verify that a consumer meeting two cells at different contract versions behaves correctly against both.

## Non-Goals

- Do not revisit the one-cell-one-knowledge-system decision. That is settled in `BO_0074`.
- Do not add cross-knowledge-system access.
- Do not add row-level knowledge-system scoping inside a cell. The cell boundary is the isolation mechanism.
- Do not build custom-domain management.

## Blocked On

- `BO_0074_FEAT_cell-per-knowledge-system` must land first. There is no second cell until there is a defined first one.
- `calliopa-platform` owns provisioning, host-to-cell routing, and release orchestration, so most of this change is coordination with that repository rather than work in this one.

## Consumers

- `calliopa-ui` is one build serving every knowledge system, so it is the consumer most exposed to contract differences between cells.
- `hermes-worker` is shared across knowledge systems by accepted contract and calls back into individual cells, so it meets the same exposure. `BO_0068_001`

## Functional Questions

- [ ] Functional question: does `cell-app` need capability discovery beyond the `contractVersion` reported by `GET /version`? `BO_0067_006` At one knowledge system with one cell and one UI build, `contractVersion` is sufficient. Capability discovery earns its keep when consumers meet cells at different versions, which is precisely this change. The accepted contract-compatibility requirement already names capability discovery as in-scope for the future. `BO_0070_005`
- [ ] Functional question: who assigns a cell id to a new knowledge system, and at what moment in the creation flow?
- [ ] Functional question: do cell databases share one PostgreSQL instance with separate databases, or one instance per cell? This was deliberately left open in `BO_0074` because the cell cannot observe the answer and the cost only appears at scale.
- [ ] Functional question: how does a shared `hermes-worker` learn which cell to call back into for a given run, once more than one cell exists? `BO_0074` requires that the task or capability carry that routing; this change is where it is exercised.

## Draft Transfer Notes

- The system work belongs in `docs/system/production-cell.md`, extending the routing, provisioning, and version sections rather than adding a new document.
- Most of the outcome will be platform-owned. This repository's share is the cell-side contract: what a cell advertises about itself, and what it refuses from a routing context naming another knowledge system.
- Do not transfer anything from this change until a second knowledge system is actually wanted. It exists to hold decisions, not to schedule them.
