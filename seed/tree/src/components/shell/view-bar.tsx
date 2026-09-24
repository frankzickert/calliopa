import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";

import { moreBeyond } from "~/lib/scroll-edges";
import { ActionControl } from "./inspector";
import type { ViewBar, ViewBarGroup } from "./view-bridge";

/**
 * The bar at the top of the tab's region, drawn from the groups the active
 * view contributes, and nothing while it contributes none. CA_0053_003
 *
 * The groups stand in the order contributed. A line stands between two
 * groups drawn — it belongs to the group after it, so no group absent can
 * leave one doubled or at an edge — and the trailing group takes the bar's
 * trailing edge while the groups fit.
 *
 * Its own component for the reason the inspector's contribution is one: a view
 * rewriting its bar re-renders the bar alone. Re-rendering the shell for it
 * would re-render the view, and for an editing surface that rebuilds the
 * element the caret is in. CA_0053_004
 *
 * Nothing is held at an edge: when the groups need more room than the bar has,
 * the whole row scrolls, and an end with groups beyond it fades, so the bar
 * says it holds more than the reader can see. The fade is drawn from
 * `data-more-start` and `data-more-end`, which the bar reads off itself on a
 * scroll and on a resize, because no stylesheet can see a scroll position.
 * CA_0060_001 CA_0060_002
 */
export const ViewBarPanel = component$<{ bar: ViewBar; decorations?: ViewBar }>(
  ({ bar, decorations }) => {
  const element = useSignal<HTMLElement>();
  const more = useStore({ start: false, end: false });
  const read$ = $(() => {
    const node = element.value;
    if (node == null) return;
    const beyond = moreBeyond(node.scrollLeft, node.scrollWidth, node.clientWidth);
    more.start = beyond.start;
    more.end = beyond.end;
  });
  // The groups changing changes what the bar holds, and the region resizing
  // changes the room it has; either can put an end beyond the edge or bring
  // it back. A measurement has to be taken from the drawn element, which is
  // what a visible task is for, and the bar re-renders alone, so it costs the
  // view nothing.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => bar.groups);
    track(() => decorations?.groups);
    const node = element.value;
    if (node == null) return;
    void read$();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => void read$());
    observer?.observe(node);
    cleanup(() => observer?.disconnect());
  });
  const own = bar.groups.filter((group) => group.actions.length > 0);
  // A view contributing no bar is given none by a decoration alone: the bar
  // belongs to the view, and a decoration adds to it. BO_0274_004
  if (own.length === 0) return null;
  const groups = merged(own, decorations?.groups ?? []);
  const leading = groups.filter((group) => group.trailing !== true);
  const trailing = groups.filter((group) => group.trailing === true);
  return (
    <div
      ref={element}
      class="view-bar"
      role="toolbar"
      aria-label="View bar"
      data-view-bar
      data-more-start={more.start ? "" : undefined}
      data-more-end={more.end ? "" : undefined}
      onScroll$={read$}
    >
      <div class="view-bar__groups">
        {leading.map((group, index) => (
          <BarGroup key={group.id} group={group} ruled={index > 0} />
        ))}
      </div>
      {trailing.length > 0 && (
        <div class="view-bar__trailing">
          {trailing.map((group, index) => (
            <BarGroup
              key={group.id}
              group={group}
              ruled={index > 0 || leading.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
  },
);

/**
 * The view's groups with a decoration's folded in: a contributed group whose
 * id the view already has appends its actions to that group, one it does not
 * stands after the view's, in contribution order. The order, the line and the
 * trailing edge are the bar's own rules and do not change. BO_0274_004
 */
const merged = (
  own: readonly ViewBarGroup[],
  contributed: readonly ViewBarGroup[],
): ViewBarGroup[] => {
  const folded = own.map((group) => {
    const added = contributed
      .filter((group_) => group_.id === group.id)
      .flatMap((group_) => group_.actions);
    return added.length === 0
      ? group
      : { ...group, actions: [...group.actions, ...added] };
  });
  const apart = contributed.filter(
    (group) =>
      group.actions.length > 0 && !own.some((group_) => group_.id === group.id),
  );
  return [...folded, ...apart];
};

const BarGroup = component$<{ group: ViewBarGroup; ruled: boolean }>(
  ({ group, ruled }) => (
    <div
      class="view-bar__group"
      role="group"
      aria-label={group.label}
      data-bar-group={group.id}
      data-ruled={ruled ? "" : undefined}
    >
      {group.actions.map((action) => (
        <ActionControl key={action.id} action={action} surface="bar" />
      ))}
    </div>
  ),
);
