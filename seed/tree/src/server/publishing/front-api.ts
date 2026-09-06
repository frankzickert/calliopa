import type postgres from "postgres";

import { secretsKey } from "~/extensions/settings/server/connections";
import type { OutcomeResponse } from "../graph/outcome";
import type { AssetSummary, EpisodeSummary, FrontSummary, SerialSummary } from "../../lib/library";
import {
  listEpisodes,
  listSerials,
  listStandingAssets,
  readEpisode,
} from "../production/production";
import { readFront, writeFront, type Front } from "./front";
import { readFrontAtDestination } from "./publications";
import { frontChannels } from "./registry";
import { releaseFrontToHomepage } from "./release";

/**
 * The transport the front view reaches publishing through.
 *
 * One read answers everything that surface needs: what the front holds, what
 * the log says has happened to it, and what it may name. A surface that had to
 * assemble those from four reads would be deciding what a front is out of
 * pieces, which is this module's job.
 */

export interface FrontFacts {
  readonly state: "never" | "published";
  readonly firstPublishedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly lastAttempt: {
    readonly outcome: "succeeded" | "failed";
    readonly at: string;
    readonly detail: string | null;
  } | null;
}

/** What a front may name, read where the front is read so the surface picks rather than types. */
export interface FrontChoices {
  /** Standing image assets: the hero is one, and no episode holds it. */
  readonly heroes: readonly AssetSummary[];
  readonly episodes: readonly EpisodeSummary[];
  /** The scenes of the flagship the front currently names, if it names one. */
  readonly scenes: readonly AssetSummary[];
  readonly serials: readonly SerialSummary[];
}

export interface FrontDetail {
  readonly front: Front;
  readonly facts: FrontFacts;
  readonly choices: FrontChoices;
}

const refused = (detail: string, rule = "refused"): OutcomeResponse<never> => ({
  status: 400,
  body: { outcome: "validationFailure", failures: [{ operation: null, rule, detail }] },
});

const summarise = (asset: {
  assetId: string;
  label: string | null;
  role: string;
  medium: string;
}): AssetSummary => ({
  assetId: asset.assetId,
  label: asset.label,
  role: asset.role,
  medium: asset.medium,
});

/** The empty front a destination has before anything is written for it. */
const nothingWritten = (channel: string): Front => ({
  channel,
  headline: null,
  line: null,
  heroAsset: null,
  flagshipEpisode: null,
  flagshipScene: null,
  entrySerial: null,
  wall: [],
});

/**
 * The destinations that show a front, and what each one is.
 *
 * A destination with nothing written is listed rather than hidden: otherwise
 * the first front could never be opened to be written.
 */
export async function listFronts(
  db: postgres.Sql,
): Promise<OutcomeResponse<readonly FrontSummary[]>> {
  const fronts: FrontSummary[] = [];
  for (const channel of frontChannels()) {
    const front = await readFront(db, channel);
    const at = await readFrontAtDestination(db, channel);
    fronts.push({
      channel,
      headline: front?.headline ?? null,
      state: at.state === "published" ? "published" : "never",
    });
  }
  return { status: 200, body: { outcome: "success", result: fronts } };
}

export async function readFrontDetail(
  db: postgres.Sql,
  channel: string,
): Promise<OutcomeResponse<FrontDetail>> {
  if (!frontChannels().includes(channel)) {
    return refused(`No destination ${channel} shows a front.`, "unknownDestination");
  }
  const front = (await readFront(db, channel)) ?? nothingWritten(channel);
  const at = await readFrontAtDestination(db, channel);

  const standing = await listStandingAssets(db);
  const episodes = await listEpisodes(db);
  const serials = await listSerials(db);

  // Only the flagship's own scenes, because that is the only episode whose
  // scenes the front may name: the hero plays one film large, out of the
  // episode it names.
  let scenes: readonly AssetSummary[] = [];
  if (front.flagshipEpisode !== null) {
    const flagship = await readEpisode(db, front.flagshipEpisode);
    if (flagship.outcome === "success") {
      scenes = flagship.result.assets
        .filter(
          (asset) =>
            asset.medium === "video" &&
            asset.assetId !== flagship.result.teaserAssetId,
        )
        .map(summarise);
    }
  }

  return {
    status: 200,
    body: {
      outcome: "success",
      result: {
        front,
        facts: {
          state: at.state === "published" ? "published" : "never",
          firstPublishedAt: at.firstPublishedAt,
          lastPublishedAt: at.lastPublishedAt,
          lastAttempt:
            at.lastAttempt === null
              ? null
              : {
                  outcome: at.lastAttempt.outcome,
                  at: at.lastAttempt.at,
                  detail: at.lastAttempt.detail,
                },
        },
        choices: {
          heroes:
            standing.outcome === "success"
              ? standing.result.filter((asset) => asset.medium === "image").map(summarise)
              : [],
          episodes: episodes.outcome === "success" ? episodes.result : [],
          scenes,
          serials:
            serials.outcome === "success"
              ? serials.result.map((serial) => ({
                  serialId: serial.serialId,
                  name: serial.name,
                  ordered: serial.ordered,
                }))
              : [],
        },
      },
    },
  };
}

/** Writes what a person changed. An absent field is one they did not touch. */
export async function writeFrontValues(
  request: Request,
  db: postgres.Sql,
  channel: string,
): Promise<OutcomeResponse<unknown>> {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return refused("body is not JSON.", "requestShape");
  }
  const asked = body as Partial<Record<keyof Front, unknown>> | null;
  if (asked === null || typeof asked !== "object") {
    return refused("A front write carries the values it changes.", "requestShape");
  }

  const text = (value: unknown): string | null | undefined =>
    value === undefined ? undefined : value === null || value === "" ? null : String(value);

  const outcome = await writeFront(db, {
    channel,
    ...(asked.headline === undefined ? {} : { headline: text(asked.headline) ?? null }),
    ...(asked.line === undefined ? {} : { line: text(asked.line) ?? null }),
    ...(asked.heroAsset === undefined ? {} : { heroAsset: text(asked.heroAsset) ?? null }),
    ...(asked.flagshipEpisode === undefined
      ? {}
      : { flagshipEpisode: text(asked.flagshipEpisode) ?? null }),
    ...(asked.flagshipScene === undefined
      ? {}
      : { flagshipScene: text(asked.flagshipScene) ?? null }),
    ...(asked.entrySerial === undefined
      ? {}
      : { entrySerial: text(asked.entrySerial) ?? null }),
    ...(Array.isArray(asked.wall) ? { wall: asked.wall.map(String) } : {}),
  });
  if (outcome.outcome !== "success") return refused(outcome.detail, outcome.rule);
  return { status: 200, body: { outcome: "success", result: outcome.result } };
}

/**
 * Publishes a front. There is no counterpart act: a front is replaced by the
 * next publication and never retired, because a destination's root holds
 * nothing to tombstone.
 */
export async function releaseFront(
  db: postgres.Sql,
  channel: string,
): Promise<OutcomeResponse<unknown>> {
  if (!frontChannels().includes(channel)) {
    return refused(`No destination ${channel} shows a front.`, "unknownDestination");
  }
  const outcome = await releaseFrontToHomepage(db, secretsKey());
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
  return { status: 200, body: { outcome: "success", result: { entry: outcome.entry } } };
}
