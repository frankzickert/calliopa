import {
  $,
  component$,
  useContext,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";

import type { EpisodeView as Episode } from "~/server/production/assemble";
import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ViewProps } from "~/components/shell/view-host";

/**
 * The episode view: what an episode holds, what it belongs to, and what shape
 * each of its exports is.
 *
 * It presents what the episode holds, and it carries the distribution panel:
 * what this episode is at each destination, the address it has there, and the
 * two acts a person may perform. Every publication is a human act, so a release
 * happens because someone pressed release and for no other reason.
 *
 * The address is edited here rather than in the inspector: the inspector states
 * typed facts and offers named actions, and giving it an editable field for one
 * view would push that view's concerns into the shell.
 */

const ROLE_LABELS: Readonly<Record<string, string>> = {
  "complete-episode": "Complete episode",
  "main-video": "Main video",
  teaser: "Teaser",
  crossover: "Crossover",
  blooper: "Blooper",
  "cinematic-image": "Cinematic image",
  statement: "Statement",
  "image-teaser": "Image teaser",
  "field-note": "Field note",
};

const seconds = (value: number | null): string | null =>
  value === null ? null : `${Math.round(value)}s`;

interface DestinationView {
  readonly channel: string;
  readonly slug: string | null;
  readonly state: "never" | "published" | "retired";
  readonly firstPublishedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly lastAttempt: {
    readonly outcome: "succeeded" | "failed";
    readonly act: "publish" | "retire";
    readonly at: string;
    readonly detail: string | null;
  } | null;
  readonly slugIsSettled: boolean;
}

/** What a state means in the words a reader is shown. */
const STATE_WORDS: Readonly<Record<DestinationView["state"], string>> = {
  never: "Never published",
  published: "Published",
  retired: "Retired",
};

/**
 * The one refusal shape every publishing route answers.
 *
 * It lives at module scope because the handlers that read it are QRLs, and a
 * QRL may only close over serializable values.
 */
const refusalOf = (body: unknown): string => {
  const failures = (body as { failures?: { detail: string }[] } | null)
    ?.failures;
  return failures === undefined
    ? "It did not happen."
    : failures.map((failure) => failure.detail).join(" ");
};

export const EpisodeViewComponent = component$<ViewProps>(({ tab }) => {
  const episode = useSignal<Episode | null>(null);
  const missing = useSignal(false);
  const bridge = useContext(ViewBridgeContext);
  const distribution = useStore<{
    destinations: DestinationView[];
    typed: Record<string, string>;
    notice: string | null;
    busy: string | null;
    reads: number;
  }>({ destinations: [], typed: {}, notice: null, busy: null, reads: 0 });

  const readDistribution$ = $(async (episodeId: string) => {
    const response = await fetch(`/api/episodes/${episodeId}/distribution`);
    const outcome = (await response.json()) as
      { outcome: "success"; result: DestinationView[] } | { outcome: string };
    if (outcome.outcome !== "success") return;
    distribution.destinations = (
      outcome as { result: DestinationView[] }
    ).result;
    distribution.reads += 1;
  });

  /**
   * The first read, and the read again when the tab is pointed at another
   * episode.
   *
   * It is a visible task because it fetches: a task that runs during server
   * rendering has no page to resolve `/api/...` against, so the read must
   * happen where the address is a real one.
   */
  useVisibleTask$(async ({ track }) => {
    const episodeId = track(() => tab.itemId);
    if (episodeId === null) return;
    const response = await fetch(`/api/episodes/${episodeId}`);
    const outcome = (await response.json()) as
      { outcome: "success"; result: Episode } | { outcome: string };
    if (outcome.outcome !== "success") {
      missing.value = true;
      return;
    }
    episode.value = (outcome as { result: Episode }).result;
    await readDistribution$(episodeId);
  });

  const bind$ = $(async (channel: string, slug: string) => {
    const episodeId = tab.itemId;
    if (episodeId === null) return;
    distribution.notice = null;
    const response = await fetch(`/api/episodes/${episodeId}/binding`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel, slug }),
    });
    const body = (await response.json()) as { outcome: string };
    if (body.outcome !== "success") {
      distribution.notice = refusalOf(body);
      return;
    }
    // The address is now stored, so what was typed is dropped rather than
    // blanked: an empty string is still a value, and the field would read it
    // in place of the slug the graph now holds.
    delete distribution.typed[channel];
    await readDistribution$(episodeId);
  });

  const act$ = $(async (channel: string, act: "release" | "retire") => {
    const episodeId = tab.itemId;
    if (episodeId === null) return;
    distribution.notice = null;
    distribution.busy = `${channel}:${act}`;
    const response = await fetch(`/api/episodes/${episodeId}/act`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ act, channel }),
    });
    const body = (await response.json()) as { outcome: string };
    distribution.busy = null;
    if (body.outcome !== "success") {
      distribution.notice = refusalOf(body);
    }
    await readDistribution$(episodeId);
  });

  // The inspector states the facts and offers the acts; the panel below owns
  // the address, which is the one thing here a person writes.
  useTask$(({ track }) => {
    const destinations = track(() => distribution.destinations);
    const reads = track(() => distribution.reads);
    if (reads === 0) return;
    bridge.inspector.facts = destinations.flatMap((destination) => [
      {
        kind: "text" as const,
        label: destination.channel,
        value: STATE_WORDS[destination.state],
      },
      ...(destination.lastPublishedAt === null
        ? []
        : [
            {
              kind: "time" as const,
              label: `${destination.channel} published`,
              value: destination.lastPublishedAt,
            },
          ]),
    ]);
    bridge.inspector.actions = destinations.flatMap((destination) =>
      destination.slug === null
        ? []
        : [
            {
              kind: "button" as const,
              id: `release-${destination.channel}`,
              label:
                destination.state === "published"
                  ? `Publish to ${destination.channel} again`
                  : `Publish to ${destination.channel}`,
              run$: $(() => act$(destination.channel, "release")),
            },
            ...(destination.state === "published"
              ? [
                  {
                    kind: "button" as const,
                    id: `retire-${destination.channel}`,
                    label: `Retire at ${destination.channel}`,
                    run$: $(() => act$(destination.channel, "retire")),
                  },
                ]
              : []),
          ],
    );
  });

  if (missing.value) {
    return (
      <div class="view view--episode" data-view-body="episode">
        <p class="view-fallback" role="status">
          This episode is no longer in the graph.
        </p>
      </div>
    );
  }

  const current = episode.value;
  if (current === null) {
    return (
      <div class="view view--episode" data-view-body="episode">
        <p data-episode-loading>Reading the episode…</p>
      </div>
    );
  }

  return (
    <div class="view view--episode" data-view-body="episode">
      <header class="episode__header">
        <h1 class="episode__title" data-episode-title>
          {current.title}
        </h1>
        <p class="episode__membership" data-episode-membership>
          {current.homeSerial === null ? (
            <span data-episode-serial="none">In no serial</span>
          ) : (
            <span data-episode-serial={current.homeSerial.serialId}>
              {current.homeSerial.name}
              {current.position !== null && (
                <span data-episode-position> · episode {current.position}</span>
              )}
            </span>
          )}
          {current.alsoIn.length > 0 && (
            <span data-episode-also>
              {" "}
              · also in {current.alsoIn.map((serial) => serial.name).join(", ")}
            </span>
          )}
        </p>
      </header>

      <section class="episode__distribution" aria-label="Distribution">
        <h2 class="episode__section">Distribution</h2>
        {distribution.notice !== null && (
          <p class="episode__notice" role="status" data-distribution-notice>
            {distribution.notice}
          </p>
        )}
        <ul class="episode__destinations">
          {distribution.destinations.map((destination) => (
            <li
              key={destination.channel}
              class="episode__destination"
              data-destination={destination.channel}
              data-destination-state={destination.state}
            >
              <span class="episode__destination-name">
                {destination.channel}
              </span>
              <span class="episode__destination-state">
                {STATE_WORDS[destination.state]}
              </span>

              {/* Once published, the address is a permanent citation target:
                  changing it is a retirement and a new publication rather than
                  an edit, so it is shown rather than offered. */}
              {destination.slugIsSettled ? (
                <span class="episode__address" data-destination-address>
                  {destination.slug}
                </span>
              ) : (
                <span class="episode__address">
                  <label>
                    <span class="episode__address-label">Address</span>
                    <input
                      type="text"
                      data-destination-slug={destination.channel}
                      value={
                        distribution.typed[destination.channel] ??
                        destination.slug ??
                        ""
                      }
                      onInput$={(_, element) => {
                        distribution.typed[destination.channel] = element.value;
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    data-destination-bind={destination.channel}
                    disabled={
                      (
                        distribution.typed[destination.channel] ??
                        destination.slug ??
                        ""
                      ).trim() === ""
                    }
                    onClick$={() =>
                      bind$(
                        destination.channel,
                        (
                          distribution.typed[destination.channel] ??
                          destination.slug ??
                          ""
                        ).trim(),
                      )
                    }
                  >
                    {destination.slug === null
                      ? "Set address"
                      : "Change address"}
                  </button>
                </span>
              )}

              {destination.lastAttempt !== null && (
                <span
                  class="episode__attempt"
                  data-destination-attempt={destination.lastAttempt.outcome}
                >
                  {destination.lastAttempt.outcome === "failed"
                    ? `Last attempt failed: ${destination.lastAttempt.detail ?? ""}`
                    : `Last ${destination.lastAttempt.act} succeeded`}
                </span>
              )}
              {distribution.busy === `${destination.channel}:release` && (
                <span data-destination-busy>Publishing…</span>
              )}
              {distribution.busy === `${destination.channel}:retire` && (
                <span data-destination-busy>Retiring…</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section class="episode__assets" aria-label="Assets">
        {current.assets.length === 0 ? (
          <p class="library-empty" data-episode-empty>
            No assets yet
          </p>
        ) : (
          <ul class="episode__list">
            {current.assets.map((asset) => (
              <li
                key={asset.assetId}
                class="episode__asset"
                data-asset-id={asset.assetId}
              >
                <span class="episode__role" data-asset-role={asset.role}>
                  {ROLE_LABELS[asset.role] ?? asset.role}
                </span>
                <span class="episode__medium" data-asset-medium={asset.medium}>
                  {asset.medium}
                  {seconds(asset.durationSeconds) !== null && (
                    <span data-asset-duration>
                      {" "}
                      · {seconds(asset.durationSeconds)}
                    </span>
                  )}
                </span>
                {asset.medium === "prose" ? (
                  <span
                    class="episode__body"
                    data-asset-body={asset.bodyDocumentId ?? undefined}
                  >
                    {asset.bodyDocumentId === null
                      ? "No body yet"
                      : "Body attached"}
                  </span>
                ) : (
                  <span class="episode__renditions">
                    {asset.renditions.length === 0 ? (
                      <span data-asset-renditions="0">No exports yet</span>
                    ) : (
                      asset.renditions.map((rendition) => (
                        <span
                          key={rendition.renditionId}
                          class="episode__rendition"
                          data-rendition-aspect={rendition.aspect}
                        >
                          {rendition.aspect}
                        </span>
                      ))
                    )}
                  </span>
                )}
                {/* Disclosure is stated per asset, so a destination that must
                    declare it reads it here rather than assuming. */}
                {asset.synthetic && (
                  <span class="episode__synthetic" data-asset-synthetic>
                    synthetic
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});
