import {
  $,
  component$,
  useContext,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

import type {
  AssetSummary,
  EpisodeSummary,
  SerialSummary,
} from "~/lib/library";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";

/**
 * The front view: what a destination shows as itself.
 *
 * A front is that destination's own document rather than a record here, so
 * this surface writes a binding and never content. Its values are chosen from
 * what the workspace holds rather than typed as identities, and its observed
 * facts are the publication log's answers.
 *
 * There is one act and not two. A front is replaced by the next publication
 * and never retired, because a destination's root holds nothing to tombstone.
 */

interface Front {
  readonly channel: string;
  readonly headline: string | null;
  readonly line: string | null;
  readonly heroAsset: string | null;
  readonly flagshipEpisode: string | null;
  readonly flagshipScene: string | null;
  readonly entrySerial: string | null;
  readonly wall: readonly string[];
}

interface FrontFacts {
  readonly state: "never" | "published";
  readonly firstPublishedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly lastAttempt: {
    readonly outcome: "succeeded" | "failed";
    readonly at: string;
    readonly detail: string | null;
  } | null;
}

interface FrontDetail {
  readonly front: Front;
  readonly facts: FrontFacts;
  readonly choices: {
    readonly heroes: readonly AssetSummary[];
    readonly episodes: readonly EpisodeSummary[];
    readonly scenes: readonly AssetSummary[];
    readonly serials: readonly SerialSummary[];
  };
}

/** The one refusal shape every publishing route answers. */
const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)
    ?.failures;
  return failures === undefined
    ? "It did not happen."
    : failures.map((failure) => failure.detail).join(" ");
};

const nameOf = (asset: AssetSummary): string => asset.label ?? asset.role;

const titleOf = (
  episodes: readonly EpisodeSummary[],
  episodeId: string,
): string =>
  episodes.find((episode) => episode.episodeId === episodeId)?.title ??
  episodeId;

export const FrontView = component$<ViewProps>(({ tab }) => {
  const missing = useSignal(false);
  const bridge = useContext(ViewBridgeContext);
  const state = useStore<{
    detail: FrontDetail | null;
    notice: string | null;
    busy: boolean;
    reads: number;
  }>({ detail: null, notice: null, busy: false, reads: 0 });

  const read$ = $(async (channel: string) => {
    const response = await fetch(`/api/fronts/${channel}`);
    const body = (await response.json()) as
      { outcome: "success"; result: FrontDetail } | { outcome: string };
    if (body.outcome !== "success") {
      missing.value = true;
      return;
    }
    state.detail = (body as { result: FrontDetail }).result;
    state.reads += 1;
  });

  /**
   * It is a visible task because it fetches: a task running during server
   * rendering has no page to resolve `/api/...` against.
   */
  useVisibleTask$(async ({ track }) => {
    const channel = track(() => tab.itemId);
    if (channel === null) return;
    await read$(channel);
  });

  const write$ = $(async (values: Partial<Record<keyof Front, unknown>>) => {
    const channel = tab.itemId;
    if (channel === null) return;
    state.notice = null;
    const response = await fetch(`/api/fronts/${channel}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = (await response.json()) as { outcome: string };
    if (body.outcome !== "success") {
      state.notice = refusalOf(body);
      return;
    }
    await read$(channel);
  });

  const publish$ = $(async () => {
    const channel = tab.itemId;
    if (channel === null) return;
    state.notice = null;
    state.busy = true;
    const response = await fetch(`/api/fronts/${channel}/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = (await response.json()) as { outcome: string };
    state.busy = false;
    if (body.outcome !== "success") state.notice = refusalOf(body);
    await read$(channel);
  });

  // The inspector states what the log says and offers the one act. A front
  // never published says so rather than reading as empty.
  useTask$(({ track }) => {
    const detail = track(() => state.detail);
    track(() => state.reads);
    if (detail === null) return;
    bridge.inspector.facts = [
      {
        kind: "text" as const,
        label: detail.front.channel,
        value:
          detail.facts.state === "published" ? "Published" : "Never published",
      },
      ...(detail.facts.lastPublishedAt === null
        ? []
        : [
            {
              kind: "time" as const,
              label: "Published",
              value: detail.facts.lastPublishedAt,
            },
          ]),
      ...(detail.facts.lastAttempt === null ||
      detail.facts.lastAttempt.outcome === "succeeded"
        ? []
        : [
            {
              kind: "text" as const,
              label: "Last attempt",
              value: detail.facts.lastAttempt.detail ?? "It did not land.",
            },
          ]),
    ];
    bridge.inspector.actions = [
      {
        kind: "button" as const,
        id: `publish-${detail.front.channel}`,
        label:
          detail.facts.state === "published"
            ? `Publish ${detail.front.channel}'s front again`
            : `Publish ${detail.front.channel}'s front`,
        run$: publish$,
      },
    ];
  });

  if (missing.value) {
    return (
      <div class="view view--front" data-view-body="front">
        <p data-front-missing>No destination {tab.itemId} shows a front.</p>
      </div>
    );
  }

  const detail = state.detail;
  if (detail === null) {
    return (
      <div class="view view--front" data-view-body="front">
        <p data-front-loading>Reading the front…</p>
      </div>
    );
  }

  const { front, choices } = detail;
  const wall = [...front.wall];

  return (
    <div
      class="view view--front"
      data-view-body="front"
      data-front={front.channel}
    >
      <header class="front__header">
        <h1 class="front__title">{front.channel}</h1>
        <p class="front__state" data-front-state={detail.facts.state}>
          {detail.facts.state === "published" ? "Published" : "Never published"}
        </p>
      </header>

      {state.notice !== null && (
        <p class="front__notice" role="status" data-front-notice>
          {state.notice}
        </p>
      )}

      <section class="front__section" aria-label="What the front says">
        <label class="front__field">
          <span>Headline</span>
          <input
            type="text"
            value={front.headline ?? ""}
            data-front-headline
            onChange$={(_, element) => write$({ headline: element.value })}
          />
        </label>
        <label class="front__field">
          <span>Line</span>
          <input
            type="text"
            value={front.line ?? ""}
            data-front-line
            onChange$={(_, element) => write$({ line: element.value })}
          />
        </label>
      </section>

      <section class="front__section" aria-label="What the front shows">
        <label class="front__field">
          <span>Hero</span>
          <select
            data-front-hero
            value={front.heroAsset ?? ""}
            onChange$={(_, element) => write$({ heroAsset: element.value })}
          >
            <option value="">Nothing chosen</option>
            {choices.heroes.map((asset) => (
              <option key={asset.assetId} value={asset.assetId}>
                {nameOf(asset)}
              </option>
            ))}
          </select>
        </label>
        {choices.heroes.length === 0 && (
          <p class="front__empty" data-front-no-heroes>
            No standing image yet. A hero is an asset no episode holds.
          </p>
        )}

        <label class="front__field">
          <span>Flagship episode</span>
          <select
            data-front-flagship
            value={front.flagshipEpisode ?? ""}
            onChange$={(_, element) =>
              // The scene is one of the flagship's own, so changing the
              // episode clears a scene that is no longer among its assets.
              write$({ flagshipEpisode: element.value, flagshipScene: null })
            }
          >
            <option value="">Nothing chosen</option>
            {choices.episodes.map((episode) => (
              <option key={episode.episodeId} value={episode.episodeId}>
                {episode.title}
              </option>
            ))}
          </select>
        </label>

        <label class="front__field">
          <span>Flagship scene</span>
          <select
            data-front-scene
            value={front.flagshipScene ?? ""}
            onChange$={(_, element) => write$({ flagshipScene: element.value })}
          >
            <option value="">Nothing chosen</option>
            {choices.scenes.map((asset) => (
              <option key={asset.assetId} value={asset.assetId}>
                {nameOf(asset)}
              </option>
            ))}
          </select>
        </label>

        <label class="front__field">
          <span>Entry serial</span>
          <select
            data-front-entry-serial
            value={front.entrySerial ?? ""}
            onChange$={(_, element) => write$({ entrySerial: element.value })}
          >
            <option value="">Nothing chosen</option>
            {choices.serials.map((serial) => (
              <option key={serial.serialId} value={serial.serialId}>
                {serial.ordered ? serial.name : `${serial.name} (unordered)`}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section class="front__section" aria-label="The wall">
        <h2 class="front__heading">Wall</h2>
        {wall.length === 0 ? (
          <p class="front__empty" data-front-wall-empty>
            Nothing on the wall. The destination falls back to its most recent
            episodes.
          </p>
        ) : (
          <ol class="front__wall" data-front-wall>
            {wall.map((episodeId, index) => (
              <li key={episodeId} class="front__wall-entry">
                <span>{titleOf(choices.episodes, episodeId)}</span>
                <button
                  type="button"
                  aria-label={`Move ${titleOf(choices.episodes, episodeId)} up`}
                  disabled={index === 0}
                  onClick$={() => {
                    const next = [...wall];
                    const above = next[index - 1] as string;
                    next[index - 1] = episodeId;
                    next[index] = above;
                    return write$({ wall: next });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${titleOf(choices.episodes, episodeId)} from the wall`}
                  onClick$={() =>
                    write$({ wall: wall.filter((held) => held !== episodeId) })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
        <label class="front__field">
          <span>Add to the wall</span>
          <select
            data-front-wall-add
            value=""
            onChange$={(_, element) => {
              const chosen = element.value;
              if (chosen === "" || wall.includes(chosen)) return;
              return write$({ wall: [...wall, chosen] });
            }}
          >
            <option value="">Choose an episode</option>
            {choices.episodes
              .filter((episode) => !wall.includes(episode.episodeId))
              .map((episode) => (
                <option key={episode.episodeId} value={episode.episodeId}>
                  {episode.title}
                </option>
              ))}
          </select>
        </label>
      </section>
    </div>
  );
});
