import { refusal, respond, type OutcomeResponse } from "~/server/outcome";
import type { ChannelDetail, ChannelsListing, IndexReadReport } from "../lib/library";
import { createChannel, deleteChannel, listChannels, readChannel, type WrittenChannel } from "./channels";
import { readIndex } from "./index-read";
import { KINDS, summarize } from "./kinds/registry";

/**
 * The transport the workspace reaches channels through. It reads a request
 * and reports an outcome; what an operation means lives in `channels.ts`.
 */

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

async function decode(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return record((await request.json()) as unknown);
  } catch {
    return null;
  }
}

const text = (body: Record<string, unknown> | null, name: string): string => {
  const value = body?.[name];
  return typeof value === "string" ? value : "";
};

/** The listing the Channels category renders: the kinds one can be created as, and every channel with its state. */
export async function channelsListing(): Promise<ChannelsListing> {
  const outcome = await listChannels();
  return {
    reachable: outcome.outcome === "success",
    kinds: KINDS.map(summarize),
    channels: outcome.outcome === "success" ? outcome.result : [],
  };
}

export async function handleChannelCreate(request: Request): Promise<OutcomeResponse<WrittenChannel>> {
  const body = await decode(request);
  if (body === null) return respond(refusal("body", "The request body must be a JSON object."));
  return respond(await createChannel({ kind: text(body, "kind"), title: text(body, "title") }));
}

export async function handleChannelRead(channelId: string): Promise<OutcomeResponse<ChannelDetail>> {
  return respond(await readChannel(channelId));
}

export async function handleChannelDelete(channelId: string, request: Request): Promise<OutcomeResponse<WrittenChannel>> {
  const body = await decode(request);
  const baseRevisionId = text(body, "baseRevisionId");
  if (baseRevisionId === "") return respond(refusal("baseRevisionId", "Say which revision of the channel is being deleted."));
  return respond(await deleteChannel({ channelId, baseRevisionId }));
}

export async function handleIndexRead(channelId: string): Promise<OutcomeResponse<IndexReadReport>> {
  return respond(await readIndex(channelId));
}
