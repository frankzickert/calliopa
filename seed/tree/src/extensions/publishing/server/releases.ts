import { randomUUID } from "node:crypto";

import type { GraphOutcome } from "~/server/outcome";
import type { RecordAtChannel, ReleaseEntry } from "../lib/work";
import { commit, matching, nodesOfType, properties, read, text } from "./graph";
import { RELEASE_TYPE } from "./vocabulary";

/**
 * The publication log: one `release` entry per attempt, created as an
 * established revision and never revised, retired or removed. A record's
 * state at a channel is derived from its entries, never stored beside them.
 * PU_0003_005
 */

const entryOf = (content: Record<string, unknown>, releaseId: string): ReleaseEntry => ({
  releaseId,
  recordId: text(content, "recordId"),
  recordKind: (text(content, "recordKind") || "deliverable") as "deliverable" | "item",
  recordTitle: text(content, "recordTitle"),
  channel: text(content, "channel"),
  act: (text(content, "act") || "publish") as "publish" | "retire",
  outcome: (text(content, "outcome") || "failed") as "succeeded" | "failed",
  objectIds: Array.isArray(content["objectIds"]) ? (content["objectIds"] as unknown[]).filter((found): found is string => typeof found === "string") : [],
  externalId: text(content, "externalId") || null,
  externalAddress: text(content, "externalAddress") || null,
  detail: text(content, "detail") || null,
  at: text(content, "at"),
});

const newestFirst = (left: ReleaseEntry, right: ReleaseEntry): number => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0);

async function entries(where: Record<string, unknown>): Promise<GraphOutcome<ReleaseEntry[]>> {
  const outcome = await matching(RELEASE_TYPE, where, "log read");
  if (outcome.outcome !== "success") return outcome as GraphOutcome<ReleaseEntry[]>;
  return { outcome: "success", result: nodesOfType(outcome.result, RELEASE_TYPE).map((node) => entryOf(read(node).content, read(node).id)).sort(newestFirst) };
}

/** Every entry for a record at a channel, newest first. */
export const entriesForRecord = (recordId: string, channel: string): Promise<GraphOutcome<ReleaseEntry[]>> => entries({ recordId, channel });

/** Every entry naming a channel, newest first. */
export const entriesForChannel = (channel: string): Promise<GraphOutcome<ReleaseEntry[]>> => entries({ channel });

/** Whether anything was ever published to a channel, which is what stops it being deleted. */
export async function channelWasPublishedTo(channel: string): Promise<GraphOutcome<boolean>> {
  const found = await entriesForChannel(channel);
  if (found.outcome !== "success") return found as GraphOutcome<boolean>;
  return { outcome: "success", result: found.result.some((entry) => entry.outcome === "succeeded") };
}

/** The state derived from the entries: never, published, or retired, with the first and last publication and the last attempt. */
export function deriveState(found: readonly ReleaseEntry[]): RecordAtChannel {
  const successes = found.filter((entry) => entry.outcome === "succeeded");
  const published = successes.filter((entry) => entry.act === "publish");
  const last = successes[0] ?? null;
  const lastAttempt = found[0] ?? null;
  return {
    state: last === null ? "never" : last.act === "retire" ? "retired" : "published",
    firstPublishedAt: published.at(-1)?.at ?? null,
    lastPublishedAt: published[0]?.at ?? null,
    externalAddress: published[0]?.externalAddress ?? null,
    externalId: published[0]?.externalId ?? null,
    lastAttempt: lastAttempt === null ? null : { act: lastAttempt.act, outcome: lastAttempt.outcome, at: lastAttempt.at, detail: lastAttempt.detail },
  };
}

export async function stateAt(recordId: string, channel: string): Promise<GraphOutcome<RecordAtChannel>> {
  const found = await entriesForRecord(recordId, channel);
  if (found.outcome !== "success") return found as GraphOutcome<RecordAtChannel>;
  return { outcome: "success", result: deriveState(found.result) };
}

/** The channels a record is live at, so deleting it can name them. */
export async function liveAt(recordId: string): Promise<GraphOutcome<string[]>> {
  const found = await entries({ recordId });
  if (found.outcome !== "success") return found as GraphOutcome<string[]>;
  const byChannel = new Map<string, ReleaseEntry[]>();
  for (const entry of found.result) byChannel.set(entry.channel, [...(byChannel.get(entry.channel) ?? []), entry]);
  return { outcome: "success", result: [...byChannel.entries()].filter(([, own]) => deriveState(own).state === "published").map(([channel]) => channel) };
}

interface EntryInput {
  readonly recordId: string;
  readonly recordKind: "deliverable" | "item";
  readonly recordTitle: string;
  readonly channel: string;
  readonly act: "publish" | "retire";
  readonly objectIds: readonly string[];
  readonly now?: () => Date;
}

async function record(input: EntryInput & { readonly outcome: "succeeded" | "failed"; readonly externalId?: string; readonly externalAddress?: string; readonly detail?: string }): Promise<GraphOutcome<ReleaseEntry>> {
  const releaseId = randomUUID();
  const at = (input.now ?? (() => new Date()))().toISOString();
  const parameters: Record<string, unknown> = {};
  const content: Record<string, unknown> = {
    id: releaseId,
    recordId: input.recordId,
    recordKind: input.recordKind,
    recordTitle: input.recordTitle,
    channel: input.channel,
    act: input.act,
    outcome: input.outcome,
    objectIds: [...input.objectIds],
    at,
    ...(input.externalId === undefined ? {} : { externalId: input.externalId }),
    ...(input.externalAddress === undefined ? {} : { externalAddress: input.externalAddress }),
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };
  const statement = `CREATE (r:${RELEASE_TYPE} {${properties("r", content, parameters)}})`;
  return commit(statement, parameters, `log ${input.act} of ${input.recordId} at ${input.channel}: ${input.outcome}`, async () => entryOf(content, releaseId));
}

/** A success names what the destination now holds. */
export const recordSuccess = (input: EntryInput & { readonly externalId: string; readonly externalAddress: string }): Promise<GraphOutcome<ReleaseEntry>> =>
  record({ ...input, outcome: "succeeded" });

/** A failure says why not, and protects nothing. */
export const recordFailure = (input: EntryInput & { readonly detail: string }): Promise<GraphOutcome<ReleaseEntry>> => record({ ...input, outcome: "failed" });
