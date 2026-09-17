import { describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { listChannels } from "../../server/channels";
import { publishDeliverable } from "../../server/release";

/**
 * `pnpm run verify:publish:website`: the environment-gated gate that reaches
 * a real site. It never skips: without the environment, a verified website
 * channel, and a deliverable to publish, it fails naming what to configure —
 * a gate that quietly passed on an unqualified machine would report proof
 * nobody produced. It runs where the tree's environment is — the kernel's
 * served tree — with `CALLIOPA_PUBLISH_CHANNEL` naming the channel and
 * `CALLIOPA_PUBLISH_DELIVERABLE` the deliverable, bound and assigned by the
 * author beforehand. PU_0003_007
 */
describe("publishing to a real website", () => {
  it("Given a verified website channel and a deliverable bound at it, Then the publish lands", async () => {
    readGraphEnv();
    const channelId = (process.env["CALLIOPA_PUBLISH_CHANNEL"] ?? "").trim();
    const deliverableId = (process.env["CALLIOPA_PUBLISH_DELIVERABLE"] ?? "").trim();
    if (channelId === "" || deliverableId === "") {
      throw new Error("Set CALLIOPA_PUBLISH_CHANNEL to a website channel's id and CALLIOPA_PUBLISH_DELIVERABLE to the deliverable to publish there.");
    }
    const channels = await listChannels();
    if (channels.outcome !== "success") throw new Error(`The channels could not be read: ${JSON.stringify(channels)}`);
    const channel = channels.result.find((found) => found.channelId === channelId);
    if (channel === undefined) throw new Error(`No channel ${channelId}.`);
    if (channel.kind !== "website") throw new Error(`${channel.title} is a ${channel.kind} channel; this gate publishes to a website.`);
    if (channel.state !== "verified") throw new Error(`${channel.title} is ${channel.state}; save its address and key in Settings and test it first.`);
    const published = await publishDeliverable({ deliverableId, channelId });
    expect(published, JSON.stringify(published)).toMatchObject({ outcome: "success" });
    if (published.outcome !== "success") return;
    expect(published.result.refusals, published.result.refusals.map((refusal) => refusal.detail).join(" ")).toEqual([]);
    expect(published.result.released).toBe(true);
    expect(published.result.entry).toMatchObject({ outcome: "succeeded" });
  });
});
