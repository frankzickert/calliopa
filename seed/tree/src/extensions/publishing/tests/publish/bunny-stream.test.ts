import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { listChannels } from "../../server/channels";
import { publishItem } from "../../server/release";

/**
 * `pnpm run verify:publish:bunny-stream`: the environment-gated gate that
 * reaches a real Bunny Stream library. It never skips: without the
 * environment, a verified `bunny-stream` channel and a video item, it fails
 * naming what to configure. `CALLIOPA_PUBLISH_CHANNEL` names the channel and
 * `CALLIOPA_PUBLISH_ITEM` the item. PU_0004_007
 */
describe("publishing a video to a real Bunny Stream library", () => {
  it("Given a verified bunny-stream channel and a video item, Then the upload lands and the entry carries the guid", async () => {
    readGraphEnv();
    const channelId = (process.env["CALLIOPA_PUBLISH_CHANNEL"] ?? "").trim();
    const itemId = (process.env["CALLIOPA_PUBLISH_ITEM"] ?? "").trim();
    if (channelId === "" || itemId === "") {
      throw new Error("Set CALLIOPA_PUBLISH_CHANNEL to a bunny-stream channel's id and CALLIOPA_PUBLISH_ITEM to the video item to publish there.");
    }
    const channels = await listChannels();
    if (channels.outcome !== "success") throw new Error(`The channels could not be read: ${JSON.stringify(channels)}`);
    const channel = channels.result.find((found) => found.channelId === channelId);
    if (channel === undefined) throw new Error(`No channel ${channelId}.`);
    if (channel.kind !== "bunny-stream") throw new Error(`${channel.title} is a ${channel.kind} channel; this gate publishes to Bunny Stream.`);
    if (channel.state !== "verified") throw new Error(`${channel.title} is ${channel.state}; save its library address and key in Settings and test it first.`);
    const published = await publishItem({ itemId, channelId });
    expect(published, JSON.stringify(published)).toMatchObject({ outcome: "success" });
    if (published.outcome !== "success") return;
    expect(published.result.refusals, published.result.refusals.map((refusal) => refusal.detail).join(" ")).toEqual([]);
    expect(published.result.released).toBe(true);
    expect(published.result.entry).toMatchObject({ outcome: "succeeded", externalId: expect.any(String) });
  });
});
