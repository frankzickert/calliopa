import { $, component$, useContext, useSignal, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import type { StandingListing } from "../lib/work";

/**
 * The Standing Items section: the items no deliverable gathers, each opening
 * its tab, and the section's own `+`, which takes a file through the picker
 * and ingests it as a standing item; a file above the blob store's cap is
 * refused naming the cap. PU_0002_005
 */

const EMPTY: StandingListing = { reachable: true, items: [], uploadCapBytes: 100 * 1024 * 1024 };

const mib = (bytes: number): string => `${Math.round(bytes / 1048576)} MiB`;

export const StandingSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{ listing: StandingListing; reads: number; busy: boolean; refusal: string }>({
    listing: (data as StandingListing | null) ?? EMPTY,
    reads: 0,
    busy: false,
    refusal: "",
  });
  const fileInput = useSignal<HTMLInputElement>();

  useTask$(({ track }) => {
    const next = track(() => data) as StandingListing | null;
    if (next !== null && next !== undefined) {
      state.listing = next;
      state.reads += 1;
    }
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/publishing/standing");
    if (!response.ok) return;
    state.listing = (await response.json()) as StandingListing;
    state.reads += 1;
  });

  const open$ = $((itemId: string, label: string) => bridge.openTarget$({ kind: "publishing:item", itemId, title: label }));

  const ingest$ = $(async (file: File) => {
    state.refusal = "";
    if (file.size > state.listing.uploadCapBytes) {
      state.refusal = `${file.name} is ${mib(file.size)}; an upload is at most ${mib(state.listing.uploadCapBytes)}.`;
      return;
    }
    state.busy = true;
    try {
      const response = await fetch(`/api/x/publishing/items?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream", "x-filename": encodeURIComponent(file.name) },
        body: file,
      });
      const outcome = (await response.json()) as { outcome: "success"; result: { itemId: string } } | { outcome: string; failures?: { detail: string }[] };
      if (outcome.outcome !== "success") {
        state.refusal = (outcome as { failures?: { detail: string }[] }).failures?.map((failure) => failure.detail).join(" ") ?? "The file was not ingested.";
        return;
      }
      await refresh$();
      await open$((outcome as { result: { itemId: string } }).result.itemId, file.name);
    } finally {
      state.busy = false;
    }
  });

  const listing = state.listing;
  return (
    <div data-standing-section>
      <div class="library-section-actions">
        <button type="button" class="library-action library-action--body library-action--icon" aria-label="Read standing items again" data-standing-refresh onClick$={() => refresh$()}>
          <Icon name="arrow-clockwise" />
        </button>
        <button type="button" class="library-action library-action--body library-action--icon" aria-label="Ingest a file" data-ingest-file disabled={state.busy} onClick$={() => fileInput.value?.click()}>
          <Icon name="plus" />
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          data-ingest-input
          onChange$={(_, element) => {
            const file = element.files?.[0];
            if (file !== undefined) void ingest$(file);
            element.value = "";
          }}
        />
      </div>
      {state.refusal !== "" && (
        <p class="library-refusal" role="alert" data-ingest-refusal>
          {state.refusal}
        </p>
      )}
      {!listing.reachable ? (
        <p class="library-empty" data-library-empty="standing">Graph not reachable</p>
      ) : listing.items.length === 0 ? (
        <p class="library-empty" data-library-empty="standing">No standing items</p>
      ) : (
        <ul class="library-list" key={state.reads}>
          {listing.items.map((item) => {
            const current = activeItemId === item.itemId;
            return (
              <li key={item.itemId}>
                <button type="button" class="library-entry" data-item-row={item.itemId} data-item-class={item.class} data-current={current ? "true" : undefined} aria-current={current ? "true" : undefined} onClick$={() => open$(item.itemId, item.label || item.class)}>
                  <span class="library-entry__label">{item.label || `(untitled ${item.class})`}</span>
                  <span class="library-entry__badge">{item.class}</span>
                  {current && <span class="library-entry__marker" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
