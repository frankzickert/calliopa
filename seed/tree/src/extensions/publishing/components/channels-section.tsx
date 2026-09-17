import { $, component$, useContext, useSignal, useStore, useTask$ } from "@builder.io/qwik";

import { Icon } from "~/components/shell/icons";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { SectionProps } from "~/contract";
import type { ChannelsListing } from "../lib/library";
import { KindIcon } from "./icons";

/**
 * The Channels section's body: one row per channel — its kind's icon, its
 * title, its state as the badge — opening the channel's tab, and the
 * section's own controls on its header's line: a re-read and a `+` that
 * opens a form in the Extensions section's idiom — a kind chooser and a
 * title, *Create* and *Cancel*, nothing stored across reloads — because the
 * header's create control creates at once and can carry no form.
 * PU_0001_005
 */

const EMPTY: ChannelsListing = { reachable: true, kinds: [], channels: [] };

export const ChannelsSection = component$<SectionProps>(({ data, activeItemId }) => {
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    listing: ChannelsListing;
    reads: number;
    formOpen: boolean;
    formKind: string;
    formTitle: string;
    formRefusal: string;
    formBusy: boolean;
  }>({
    listing: (data as ChannelsListing | null) ?? EMPTY,
    reads: 0,
    formOpen: false,
    formKind: "",
    formTitle: "",
    formRefusal: "",
    formBusy: false,
  });
  const titleInput = useSignal<HTMLInputElement>();

  // The shell re-reads the section when a channel tab changes and hands the
  // answer down as data, the rule that keeps Documents current.
  useTask$(({ track }) => {
    const next = track(() => data) as ChannelsListing | null;
    if (next !== null && next !== undefined) {
      state.listing = next;
      state.reads += 1;
    }
  });

  const refresh$ = $(async () => {
    const response = await fetch("/api/library/publishing/channels");
    if (!response.ok) return;
    state.listing = (await response.json()) as ChannelsListing;
    state.reads += 1;
  });

  const open$ = $((channelId: string, title: string) =>
    bridge.openTarget$({ kind: "publishing:channel", itemId: channelId, title }),
  );

  const createChannel$ = $(async () => {
    const kind = state.formKind !== "" ? state.formKind : (state.listing.kinds[0]?.id ?? "");
    const title = state.formTitle.trim();
    if (kind === "") {
      state.formRefusal = "This instance ships no kind of channel.";
      return;
    }
    if (title === "") {
      state.formRefusal = "A channel needs a title.";
      return;
    }
    state.formBusy = true;
    state.formRefusal = "";
    try {
      const response = await fetch("/api/x/publishing/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title }),
      });
      const outcome = (await response.json()) as
        | { outcome: "success"; result: { channelId: string } }
        | { outcome: string; failures?: { detail: string }[] };
      if (outcome.outcome !== "success") {
        state.formRefusal =
          (outcome as { failures?: { detail: string }[] }).failures?.map((failure) => failure.detail).join(" ") ??
          "The channel was not created.";
        return;
      }
      state.formOpen = false;
      state.formTitle = "";
      await refresh$();
      await open$((outcome as { result: { channelId: string } }).result.channelId, title);
    } finally {
      state.formBusy = false;
    }
  });

  const listing = state.listing;
  return (
    <div data-channels-section>
      <div class="library-section-actions">
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="Read channels again"
          data-channels-refresh
          onClick$={() => refresh$()}
        >
          <Icon name="arrow-clockwise" />
        </button>
        <button
          type="button"
          class="library-action library-action--body library-action--icon"
          aria-label="New channel"
          aria-expanded={state.formOpen}
          aria-controls="library-new-channel"
          data-new-channel
          onClick$={() => {
            state.formOpen = !state.formOpen;
            state.formRefusal = "";
            if (state.formOpen) setTimeout(() => titleInput.value?.focus(), 0);
          }}
        >
          <Icon name="plus" />
        </button>
      </div>
      <form
        id="library-new-channel"
        class="library-create"
        data-new-channel-form
        hidden={!state.formOpen}
        preventdefault:submit
        onSubmit$={() => createChannel$()}
      >
        <label class="library-create__field">
          <span>Kind</span>
          <select
            name="kind"
            value={state.formKind !== "" ? state.formKind : (listing.kinds[0]?.id ?? "")}
            disabled={state.formBusy}
            onChange$={(_, element) => (state.formKind = element.value)}
          >
            {listing.kinds.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label class="library-create__field">
          <span>Title</span>
          <input
            ref={titleInput}
            type="text"
            name="title"
            autocomplete="off"
            placeholder="Where this goes, in a few words"
            value={state.formTitle}
            disabled={state.formBusy}
            onInput$={(_, element) => (state.formTitle = element.value)}
          />
        </label>
        {state.formRefusal !== "" && (
          <p class="library-refusal" role="alert" data-new-channel-refusal>
            {state.formRefusal}
          </p>
        )}
        <div class="library-create__controls">
          <button type="submit" class="library-action" disabled={state.formBusy} data-new-channel-create>
            Create
          </button>
          <button
            type="button"
            class="library-action"
            disabled={state.formBusy}
            data-new-channel-cancel
            onClick$={() => {
              state.formOpen = false;
              state.formRefusal = "";
            }}
          >
            Cancel
          </button>
        </div>
      </form>
      {!listing.reachable ? (
        <p class="library-empty" data-library-empty="channels">
          Graph not reachable
        </p>
      ) : listing.channels.length === 0 ? (
        <p class="library-empty" data-library-empty="channels">
          No channels yet
        </p>
      ) : (
        <ul class="library-list" key={state.reads}>
          {listing.channels.map((channel) => {
            const current = activeItemId === channel.channelId;
            return (
              <li key={channel.channelId}>
                <button
                  type="button"
                  class="library-entry"
                  data-channel-row={channel.channelId}
                  data-channel-kind={channel.kind}
                  data-channel-state={channel.state}
                  data-current={current ? "true" : undefined}
                  aria-current={current ? "true" : undefined}
                  title={channel.kindLabel}
                  onClick$={() => open$(channel.channelId, channel.title)}
                >
                  <KindIcon kind={channel.kind} />
                  <span class="library-entry__label">{channel.title}</span>
                  <span class="library-entry__badge">{channel.state}</span>
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
