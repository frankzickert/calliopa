import type postgres from "postgres";

import type { GraphOutcome } from "../graph/contract";
import { refusal, respond, type OutcomeResponse } from "../graph/outcome";
import type { EpisodeView } from "./assemble";
import {
  createEpisode,
  listEpisodes,
  listStandingAssets,
  readEpisode,
  type EpisodeSummary,
  type WrittenEpisode,
} from "./production";
import type { AssetSummary } from "../../lib/library";

/**
 * The transport the workspace reaches episodes through.
 *
 * It reads a request and reports an outcome. Nothing here decides what an
 * operation means: the meanings live in `production.ts` and the validation
 * lives in the gateway.
 */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

async function decode(request: Request): Promise<unknown | undefined> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The listing the library's `Episodes` category renders. It answers identity
 * and title per episode and nothing else, so opening the drawer never pays for
 * the assets the category does not show.
 */
export async function handleEpisodeList(
  db: postgres.Sql,
): Promise<OutcomeResponse<readonly EpisodeSummary[]>> {
  return respond(await listEpisodes(db));
}

/**
 * The assets no episode holds. They are listed as identity, label, role and
 * medium: the drawer renders a name and never the renditions behind one.
 */
export async function handleStandingAssets(
  db: postgres.Sql,
): Promise<OutcomeResponse<readonly AssetSummary[]>> {
  const outcome = await listStandingAssets(db);
  if (outcome.outcome !== "success") return respond(outcome);
  return respond({
    outcome: "success",
    result: outcome.result.map((asset) => ({
      assetId: asset.assetId,
      label: asset.label,
      role: asset.role,
      medium: asset.medium,
    })),
  });
}

export async function handleEpisodeRead(
  episodeId: string,
  db: postgres.Sql,
): Promise<OutcomeResponse<EpisodeView>> {
  return respond(await readEpisode(db, episodeId));
}

export async function handleEpisodeCreate(
  request: Request,
  db: postgres.Sql,
): Promise<OutcomeResponse<WrittenEpisode>> {
  const body = await decode(request);
  if (body === undefined) {
    return respond(refusal("requestShape", "body is not JSON.") as GraphOutcome<never>);
  }
  const input = record(body);
  const title = input === null ? null : input["title"];
  if (typeof title !== "string") {
    return respond(refusal("episodeShape", "An episode carries a title."));
  }
  return respond(await createEpisode(db, { title }));
}
