# BO_0302_FIX_graph-defined-member-identifiers

Status: completed

Requested: 2026-09-28, by the user: create the fixed-layer follow-up needed to finish CA_0070's graph declaration update.

## Behavior

- `kernel commit --members` must safely revise an established `ext.blocktype` declaration whose `name` is not a valid CCGW node-label identifier. It must discover that declaration through the statically named `ext.blocktype` member type, stage the corrected content from the sidecar, and avoid interpolating the invalid name into a CCGW query.
- Member transfer must validate graph-defined type names before using them as CCGW labels. An invalid existing name must not prevent a `kernel commit --members` from correcting that declaration by its node identity; other invalid names must produce an actionable materializer result rather than a parser error from a generated query.
- CA_0070's admonition pattern declaration uses `admonition_pattern` as its graph type name; the user-facing pattern name remains content on each pattern record.

## Implementation

- `kernel checkout --members` validates graph-defined names before query construction and reports invalid declarations as conflicts. `kernel commit --members` reads transferred members through their fixed kinds, so a sidecar can revise an established `ext.blocktype` by node identity without querying its invalid current name.
- The documents declaration uses `admonition_pattern`; each pattern's display label remains its `name` property. The container permits ordered `text` children.
- `TestCommitGivenAnInvalidBlockTypeNameThenSidecarCorrectsItByNodeIdentity` verifies the invalid checkout result and correction staged through the sidecar.

## Scope

- The kernel materializer's member baseline and declaration-type query path.
- CA_0070's graph declaration correction and the extension's graph copy of this change document travel with the same accepted proposal group.
