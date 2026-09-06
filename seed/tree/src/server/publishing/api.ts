import type postgres from "postgres";

import { secretsKey } from "~/extensions/settings/server/connections";
import type { OutcomeResponse } from "../graph/outcome";
import { readBinding, writeBinding, type BoundKind } from "./bindings";
import { HOMEPAGE_CHANNEL } from "./homepage";
import { readRecordAtDestination } from "./publications";
import { releaseEpisodeToHomepage, retireEpisodeAtHomepage } from "./release";

/**
 * The transport the distribution panel reaches publishing through.
 *
 * Reads answer what a record is at each destination; writes are the two acts a
 * person performs. Nothing here decides that something should be published: a
 * release happens because someone pressed release.
 */

/** The destinations a record may be bound to. One today. */
const CHANNELS = [HOMEPAGE_CHANNEL] as const;

export interface DestinationView {
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
  /** Whether the address may still be edited in place. */
  readonly slugIsSettled: boolean;
}

/**
 * What this episode is at every destination, whether or not it is bound to one.
 * A destination it has never been bound to is answered rather than omitted: the
 * panel says what could be done, not only what has been.
 */
export async function readDistribution(
  db: postgres.Sql,
  recordId: string,
): Promise<OutcomeResponse<readonly DestinationView[]>> {
  const destinations: DestinationView[] = [];
  for (const channel of CHANNELS) {
    const binding = await readBinding(db, { recordId, channel });
    const at = await readRecordAtDestination(db, { recordId, channel });
    destinations.push({
      channel,
      slug: binding?.slug ?? null,
      state: at.state,
      firstPublishedAt: at.firstPublishedAt,
      lastPublishedAt: at.lastPublishedAt,
      lastAttempt:
        at.lastAttempt === null
          ? null
          : {
              outcome: at.lastAttempt.outcome,
              act: at.lastAttempt.act,
              at: at.lastAttempt.at,
              detail: at.lastAttempt.detail,
            },
      slugIsSettled: at.firstPublishedAt !== null,
    });
  }
  return { status: 200, body: { outcome: "success", result: destinations } };
}

const refused = (detail: string, rule = "refused"): OutcomeResponse<never> => ({
  status: 400,
  body: { outcome: "validationFailure", failures: [{ operation: null, rule, detail }] },
});

/** Gives a record its address at a destination, or changes one not yet spent. */
export async function writeRecordBinding(
  request: Request,
  db: postgres.Sql,
  input: { readonly recordId: string; readonly recordKind: BoundKind },
): Promise<OutcomeResponse<unknown>> {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return refused("body is not JSON.", "requestShape");
  }
  const asked = body as { channel?: string; slug?: string } | null;
  if (asked === null || typeof asked.channel !== "string") {
    return refused("A binding names its destination.", "requestShape");
  }
  const outcome = await writeBinding(db, {
    recordId: input.recordId,
    recordKind: input.recordKind,
    channel: asked.channel,
    ...(asked.slug === undefined ? {} : { slug: asked.slug }),
  });
  if (outcome.outcome !== "success") {
    return refused(outcome.detail, outcome.rule);
  }
  return { status: 200, body: { outcome: "success", result: outcome.result } };
}

/**
 * Releases or retires an episode at a destination. Both answer the same shape:
 * whether it happened, and what stopped it when it did not.
 */
export async function actOnEpisode(
  db: postgres.Sql,
  input: {
    readonly episodeId: string;
    readonly act: "release" | "retire";
    readonly channel: string;
  },
): Promise<OutcomeResponse<unknown>> {
  if (input.channel !== HOMEPAGE_CHANNEL) {
    return refused(`No destination ${input.channel}.`, "unknownDestination");
  }
  const key = secretsKey();
  const outcome =
    input.act === "release"
      ? await releaseEpisodeToHomepage(db, key, input.episodeId)
      : await retireEpisodeAtHomepage(db, key, input.episodeId);

  if (!outcome.released) {
    const failures = outcome.refusals.map((refusal) => ({
      operation: null,
      rule: refusal.rule,
      detail: refusal.detail,
    }));
    const [first, ...rest] = failures;
    return {
      status: 400,
      body: {
        outcome: "validationFailure",
        failures:
          first === undefined
            ? [
                {
                  operation: null,
                  rule: "notReleased",
                  detail: outcome.detail ?? "It did not happen.",
                },
              ]
            : [first, ...rest],
      },
    };
  }
  return {
    status: 200,
    body: { outcome: "success", result: { entry: outcome.entry } },
  };
}
