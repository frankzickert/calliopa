# Workspace View Types

## Purpose

- This document is the authoritative description of Calliopa's view types: what a view type is, how the built-in registry resolves one, how a tab chooses and remembers one, and how a view mounts inside the shell.
- `CA_0006_FEAT_workspace-view-types` is the originating change.
- [Workspace Shell](./frame.md) owns tabs, drawers, command dock, themes, drag coordination, and process reporting. This document owns only the boundary where a tool mounts inside a tab.
- The first real registered view is the block editor in [Block Editor View](../documents/block-editor.md).

## View Contract

* A view type has a stable identifier, a display name, the target kinds it supports, and a Qwik component.
* A view type declares its inspector contribution and its drag capabilities. The shell reads those declarations; a view never takes ownership of a shell surface.
* View-local state such as selection and focus lives in the tab context. Durable content lives in the graph. Scroll stays browser-local.
* Desktop and mobile mount the same view identity against the same data contract, however their layouts differ.

- The contract declares only fields with a consumer in this change. A view's context loader and selection model enter with the first real view, because a placeholder view exercises neither.
- The bridge's save channel carries a save state — saving, saved, or unsaved — for the tab the reporting view is mounted on, not a bare unsaved flag for whichever tab is active. One channel: the header renders it and the tab's marker is projected from it, so the shell cannot hold two answers to whether a tab has unsaved work.
- The inspector contribution is typed facts and named actions, not rendered content. A view declares facts the shell knows how to render — a save state, a time, a count, a line of text — and actions carrying their own handlers, and the shell renders them in its own idiom, so every view's panel reads as the same drawer.
- A view handing over its own markup would make the drawer's look a per-view accident and would be a view owning a shell surface in all but name, which the fixed line above forbids.
- The vocabulary of facts and controls grows by change when a view needs a shape it lacks. That cost is the point: a shape no vocabulary covers becomes a decision rather than something a view renders on its own.
- The contribution stays a store rather than a value, for the reason it already is one: the shell renders it and the view writes it, so a plain field would change with nothing re-rendering.
- What a view contributes acts on that view's own content, so the view supplies the handlers. The shell renders a named action without knowing what it does.

## Built-In Registry

* View types are contributions resolved at build time from the manifests present in the tree: an extension's entrypoint exports its tab kinds, each with the view presenting it and that view's component, and the registry plugin merges what is present into `src/registry.gen.ts` (revised under `BO_0202_009`; [Contribution Contract](./contribution-contract.md)).
* Nothing is loaded at runtime: no dynamic import, no graph-source materialization, no enable/disable flow, no dependency resolution in the running application. The build the pin promotes holds every view there is.
* A new view type is added by an approved change that updates its graph and domain requirements, its contribution, its UI, and its verification together, in the extension it belongs to.
* The registry performs no privileged extension review and no runtime loading; its scan is the build's, over the tree, and a collision or a missing dependency fails the build by name rather than resolving anything.

- The registry declares a default view per target kind, used when a target opens with no remembered preference.
- The `block-editor` view type from `CA_0008` presents the `document` target kind and is its default view. The `context` and `outline` placeholders stay registered for the story-development target kinds that have no real view yet, which is what keeps a target kind able to offer one view or several.
- `context` does not present `document`. A document has one compatible view, so the tab's view affordance renders nothing for it and `Open in Context` never appears, while the affordance stays for the target kinds that genuinely offer several. Suppressing the button while leaving the view compatible would contradict the fixed line requiring a tab to expose its compatible views; removing the `Open in <view>` group outright would contradict it too, and neither is done here.

## Choosing A View

* Choosing another view for a target always opens a new tab. The existing tab keeps its target and its view, so two views on one target stay open together.
* A tab exposes a view-type affordance listing the views compatible with its target kind. Selecting one opens the new tab.
* An unsupported or removed view identifier is the one case resolved in place: the tab fails visibly, keeps its target, and adopts a compatible fallback view rather than opening a second tab.

- Opening a target that already has a tab in the same view selects that tab instead of duplicating it, extending the existing open behavior from target identity and target kind to target identity, target kind, and view type.
- A stored tab carrying no view identifier resolves to its target kind's default view. Only a present-but-unknown identifier produces the visible fallback notice.

## Remembering A View

* A target has a preferred default view, reused when that target opens in a future tab. The preference is per user and per workspace.
* The preference is stored in workspace state, never in the graph. Presentation choice is not shared domain data.

- The preference records the most recently chosen view for that target.
- A preference naming a view the registry no longer knows resolves through the fallback rule and is then replaced by the fallback's identifier.

## Tabs And Targets

- A tab's target is its item identity and item kind. The view type presenting that target is a third, independent field, and it is immutable for the tab's lifetime: `updateTab` cannot patch it, because choosing another view opens another tab.
- The shell resolves the registered view for the active tab and mounts it through one stable host boundary in the center workspace.
- Target identity stays opaque to the shell. It becomes graph identity when the graph gateway from `CA_0005` provides one; nothing here defines graph persistence.

## Out Of Scope

- A marketplace, plugin API, runtime extension mechanism, user-authored code, and graph-hosted UI definitions.
- User-configured saved views. A named, user-configured instance of a view type with its own settings arrives in its own change, once a view type has settings worth saving.
- Defining every future view type, the block document model, and graph persistence.

## Implementation

- `src/lib/views.ts` holds the resolution rules over the registry the build emitted: `viewsFor`, `defaultViewFor`, `resolveView`, `preferredView`, and `rememberView` take the registry rather than importing it, so they are pure and unit-tested over a fixture; resolution always answers, so a removed identifier, or a kind nothing contributes any more, cannot strand a tab — the host's `context` placeholder presents anything. The view table itself — each view's identifier, display name, target kinds, inspector contribution, drag operations and component — is the merged contributions, and the view every kind opens with is what its extension declared beside the kind (`CA_0006_001`, rewritten under `BO_0202_004`).
- The registry carries `block-editor` for the `document` target kind, and the `context` and `outline` placeholders for the story-development kinds. `context` presents every story-development kind and `outline` presents only `script`, `scene`, `storyboard`, and `timeline`, so a target kind offers either one view or several. `document` is the kind that offers one (`CA_0006_001`, `CA_0015_005`).
- `src/lib/tabs.ts` carries `viewType` on every tab, `openTab` selects an existing tab only when item identity, item kind, and view type all match, and `updateTab` cannot patch the view. `parseTab` in `src/server/workspaces.ts` defaults a missing identifier to the target kind's default and preserves an unknown one for the visible fallback (`CA_0006_002`).
- `migrations/0004_workspace_views.sql` adds the workspace record's `preferred_views` column. The state validates on the way in, `newContext$` opens a target in its remembered view, and choosing a view writes the preference in the same save as the tabs (`CA_0006_003`).
- `src/components/shell/view-host.tsx` is the boundary every view mounts through. The component comes from the registry's view, where a view cannot enter without one — the contract's `ViewContribution` carries it, and the merge refuses a view id contributed twice — so the totality `VIEW_COMPONENTS` held by type is held by the registry's validation once the keys are strings. An unknown identifier renders the fallback notice while the tab keeps its target, and desktop and mobile mount through the same boundary (`CA_0006_004`, `BO_0202_004`).
- The shell mounts the host keyed by tab id, so switching tabs unmounts the view rather than handing it a different target. A view holding unsaved input has to be told it is leaving, and per-tab view-local state must not leak sideways.
- The workspace region exposes the active tab's compatible views as `Open in <view>` buttons in an accessible group. Choosing one opens the target again in a new tab, leaves the original open, and remembers the choice (`CA_0006_005`).
- The inspector renders the active view's declared contribution when no process is selected, and a tab's drag payload offers the operations its view declares rather than a fixed pair (`CA_0006_006`).
- `setSaveState$` takes the reporting view's own tab id. A view flushes its last save as it unmounts, which lands after the switch that unmounted it; reported as "the active tab" that save would mark the tab the reader had moved to (`CA_0012_003`).
- `tests/browser/views.spec.ts` proves the contract on desktop and mobile: mounting through the host, opening a second view in a new tab, per-tab view-local state, reload, the remembered view answering a reopened target, and the fallback for a retired identifier. `pnpm run verify` passes every gate (`CA_0006_007`).
- `ViewInspector` in `src/components/shell/view-bridge.ts` carries typed facts and named actions beside the fallback text. `InspectorFact` is a save state, a time, a count, or a line of text; `ViewAction` is a button or a toggle carrying its own handler, and is the one named-action vocabulary, rendered by the inspector and by the command dock in [Workspace Shell](./command-dock.md). A view that declares neither still falls back to its registry line, which is what the placeholder views contribute (`CA_0015_004`).
- `context` no longer lists `document` among its target kinds, so a document resolves one compatible view and the workspace region renders no `Open in <view>` group for it. The group is untouched for the kinds that offer several (`CA_0015_005`).
