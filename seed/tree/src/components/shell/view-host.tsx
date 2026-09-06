import { component$, type Component } from "@builder.io/qwik";
import type { Tab } from "~/lib/tabs";
import { resolveView, type ViewId } from "~/lib/views";
import { BlockEditorView } from "~/components/views/block-editor";
import { EpisodeViewComponent } from "~/components/views/episode";
import { FrontView } from "~/components/views/front";
import { SettingsView } from "~/extensions/settings/settings";

export interface ViewProps {
  readonly tab: Tab;
}

/**
 * The placeholder context view: the working surface the shell shipped before
 * views were named. It presents any target kind.
 */
export const ContextView = component$<ViewProps>(({ tab }) => (
  <div class="view view--context" data-view-body="context">
    <p data-selection={tab.selection ?? undefined}>
      {tab.drawerContext ?? "Open a story context to begin."}
    </p>
  </div>
));

/** The placeholder outline view: the same target read as ordered structure. */
export const OutlineView = component$<ViewProps>(({ tab }) => (
  <div class="view view--outline" data-view-body="outline">
    <ol class="outline" aria-label={`Outline of ${tab.title}`}>
      <li data-outline="target">{tab.itemId ?? "no target identity"}</li>
      <li data-outline="kind">{tab.kind}</li>
      <li data-outline="selection">{tab.selection ?? "nothing selected"}</li>
    </ol>
  </div>
));

/**
 * Every registered view binds a component here. The total record means a view
 * cannot enter the registry without one.
 */
const VIEW_COMPONENTS: Readonly<Record<ViewId, Component<ViewProps>>> = {
  "block-editor": BlockEditorView,
  episode: EpisodeViewComponent,
  front: FrontView,
  context: ContextView,
  outline: OutlineView,
  settings: SettingsView,
};

/**
 * The one boundary a view mounts through. A tab whose stored view is unknown
 * keeps its target and says so, rather than losing the tab.
 */
export const ViewHost = component$<ViewProps>(({ tab }) => {
  const { view, requested, unsupported } = resolveView(tab.kind, tab.viewType);
  const View = VIEW_COMPONENTS[view.id as ViewId];
  return (
    <div class="view-host" data-view-host={view.id}>
      {unsupported && (
        <p class="view-fallback" role="status" data-view-fallback={requested}>
          The {requested} view is unavailable. Showing {view.name} instead.
        </p>
      )}
      <View tab={tab} />
    </div>
  );
});
