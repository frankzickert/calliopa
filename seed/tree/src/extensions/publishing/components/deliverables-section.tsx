import { $, component$, useContext, useSignal, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import type { DeliverablesListing } from "../lib/work";

/**
 * The Deliverables section: one group per top-level shape, rows under each
 * opening the deliverable's tab, and the section's own `+`, which picks a
 * shape and titles the deliverable in the Extensions section's idiom.
 * PU_0002_005
 */

const EMPTY: DeliverablesListing = { reachable: true, shapes: [], groups: [] };

export const DeliverablesSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    listing: DeliverablesListing;
    reads: number;
    formOpen: boolean;
    formShape: string;
    formTitle: string;
    formRefusal: string;
    formBusy: boolean;
  }>({
    listing: (data as DeliverablesListing | null) ?? EMPTY,
    reads: 0,
    formOpen: false,
    formShape: "",
    formTitle: "",
    formRefusal: "",
    formBusy: false,
  });
  const titleInput = useSignal<HTMLInputElement>();

  useTask$(({ track }) => {
    const next = track(() => data) as DeliverablesListing | null;
    if (next !== null && next !== undefined) {
      state.listing = next;
      state.reads += 1;
    }
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/publishing/deliverables");
    if (!response.ok) return;
    state.listing = (await response.json()) as DeliverablesListing;
    state.reads += 1;
  });

  const open$ = $((deliverableId: string, title: string) =>
    bridge.openTarget$({ kind: "publishing:deliverable", itemId: deliverableId, title }),
  );

  const create$ = $(async () => {
    const shapeId = state.formShape !== "" ? state.formShape : (state.listing.shapes[0]?.shapeId ?? "");
    const title = state.formTitle.trim();
    if (shapeId === "") {
      state.formRefusal = "Make a shape first; a deliverable is an instance of one.";
      return;
    }
    if (title === "") {
      state.formRefusal = "A deliverable needs a title.";
      return;
    }
    state.formBusy = true;
    state.formRefusal = "";
    try {
      const response = await fetch("/api/x/publishing/deliverables", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shapeId, title }),
      });
      const outcome = (await response.json()) as
        | { outcome: "success"; result: { deliverableId: string } }
        | { outcome: string; failures?: { detail: string }[] };
      if (outcome.outcome !== "success") {
        state.formRefusal =
          (outcome as { failures?: { detail: string }[] }).failures?.map((failure) => failure.detail).join(" ") ?? "The deliverable was not created.";
        return;
      }
      state.formOpen = false;
      state.formTitle = "";
      await refresh$();
      await open$((outcome as { result: { deliverableId: string } }).result.deliverableId, title);
    } finally {
      state.formBusy = false;
    }
  });

  const listing = state.listing;
  return (
    <div data-deliverables-section>
      <div class="library-section-actions">
        <button type="button" class="library-action library-action--body library-action--icon" aria-label="Read deliverables again" data-deliverables-refresh onClick$={() => refresh$()}>
          <Icon name="arrow-clockwise" />
        </button>
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="New deliverable"
          aria-expanded={state.formOpen}
          aria-controls="library-new-deliverable"
          data-new-deliverable
          onClick$={async () => {
            state.formOpen = !state.formOpen;
            state.formRefusal = "";
            if (!state.formOpen) return;
            setTimeout(() => titleInput.value?.focus(), 0);
            // The shell re-reads this section when a deliverable tab changes,
            // not when a shape is made, so the form reads the shapes again as
            // it opens; the render harness has no fetch, and nothing hangs on it.
            try {
              await refresh$();
            } catch {
              // The listing stands as it was.
            }
          }}
        >
          <Icon name="plus" />
        </button>
      </div>
      <form id="library-new-deliverable" class="library-create" data-new-deliverable-form hidden={!state.formOpen} preventdefault:submit onSubmit$={() => create$()}>
        <label class="library-create__field">
          <span>Shape</span>
          <select name="shape" value={state.formShape !== "" ? state.formShape : (listing.shapes[0]?.shapeId ?? "")} disabled={state.formBusy} onChange$={(_, element) => (state.formShape = element.value)}>
            {listing.shapes.map((shape) => (
              <option key={shape.shapeId} value={shape.shapeId}>
                {shape.title}
              </option>
            ))}
          </select>
        </label>
        <label class="library-create__field">
          <span>Title</span>
          <input ref={titleInput} type="text" name="title" autocomplete="off" placeholder="What this deliverable is" value={state.formTitle} disabled={state.formBusy} onInput$={(_, element) => (state.formTitle = element.value)} />
        </label>
        {state.formRefusal !== "" && (
          <p class="library-refusal" role="alert" data-new-deliverable-refusal>
            {state.formRefusal}
          </p>
        )}
        <div class="library-create__controls">
          <button type="submit" class="library-action" disabled={state.formBusy} data-new-deliverable-create>
            Create
          </button>
          <button type="button" class="library-action" disabled={state.formBusy} data-new-deliverable-cancel onClick$={() => { state.formOpen = false; state.formRefusal = ""; }}>
            Cancel
          </button>
        </div>
      </form>
      {!listing.reachable ? (
        <p class="library-empty" data-library-empty="deliverables">Graph not reachable</p>
      ) : listing.groups.length === 0 ? (
        <p class="library-empty" data-library-empty="deliverables">No deliverables yet</p>
      ) : (
        listing.groups.map((group) => (
          <div key={group.shape.shapeId} data-library-group={group.shape.shapeId}>
            <h3 class="library-group">{group.shape.title}</h3>
            <ul class="library-list" key={state.reads}>
              {group.deliverables.map((deliverable) => {
                const current = activeItemId === deliverable.deliverableId;
                return (
                  <li key={deliverable.deliverableId}>
                    <button type="button" class="library-entry" data-deliverable-row={deliverable.deliverableId} data-current={current ? "true" : undefined} aria-current={current ? "true" : undefined} onClick$={() => open$(deliverable.deliverableId, deliverable.title)}>
                      <span class="library-entry__label">{deliverable.title}</span>
                      {current && <span class="library-entry__marker" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
});
