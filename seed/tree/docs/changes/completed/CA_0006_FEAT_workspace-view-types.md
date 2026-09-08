# CA_0006_FEAT_workspace-view-types

Status: completed

Requested: 2026-08-29

## Intent

Make the workspace's main area host explicit view types. A tab identifies a
working target and the view used to present that target, so the same graph data
can be opened through different purpose-built surfaces over time.

View types are built-in application capabilities delivered through Calliopa's
change process. They are not extensions, plugins, graph-hosted UI code, or
runtime-installed contributions.

## Outcome

The specification and its results live in
[Workspace View Types](../../system/workspace/view-types.md). `CA_0006_001`
through `CA_0006_007` are folded into truth there. `pnpm run verify` passed
every gate against the final working tree.

## Answered Functional Questions

- Choosing another view for a target always opens a new tab; the existing tab
  keeps its target and view. Only the removed-view fallback resolves in place.
- A target has a preferred default view reused by future tabs, stored in
  workspace state rather than in the graph.
- User-configured saved views stay out of scope and become their own change.
- A tab carries a view-type affordance listing the views compatible with its
  target kind.
- Opening a target that already has a tab in the same view selects that tab
  rather than duplicating it.

## Follow-Up

- The block editor in `CA_0008_FEAT_block-editor-view` registers the first real
  view and replaces the placeholder registry entries. A view's context loader
  and selection model enter the contract with it, because no placeholder view
  exercises either.
