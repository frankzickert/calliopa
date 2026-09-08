import { component$ } from "@builder.io/qwik";
import type { Tab } from "~/lib/tabs";
import { resolveView } from "~/lib/views";
import { REGISTRY } from "~/registry.gen";

export interface ViewProps {
  readonly tab: Tab;
}

/**
 * The one boundary a view mounts through. The view's component comes from the
 * registry, where a view cannot enter without one (`BO_0202_004`); a tab
 * whose stored view is unknown keeps its target and says so, rather than
 * losing the tab.
 */
export const ViewHost = component$<ViewProps>(({ tab }) => {
  const { view, requested, unsupported } = resolveView(REGISTRY, tab.kind, tab.viewType);
  const View = view.component;
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
