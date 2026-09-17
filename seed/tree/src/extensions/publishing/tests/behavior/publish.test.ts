import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { kernelSecrets } from "~/server/kernel/client";
import type { GraphOutcome } from "~/server/outcome";
import { assignPart, dropShape, readTakes, takeShape } from "../../server/assignments";
import { createChannel, deleteChannel, listChannels, partyOf, readChannel, retireChannel } from "../../server/channels";
import { createDeliverable, deleteDeliverable, placeItem, readDeliverable } from "../../server/deliverables";
import { readIndex } from "../../server/index-read";
import { addExport, createProseItem, ingestItem, reviseItem } from "../../server/items";
import { deleteItem, readItem } from "../../server/items";
import { readProcess } from "~/server/processes";
import { createWorkspace, deleteWorkspace } from "~/server/workspaces";
import { bindDeliverable, publishDeliverable, publishItem, readAt, readItemAt, retireDeliverable, retireItem, startAct } from "../../server/release";
import { entriesForChannel, stateAt } from "../../server/releases";
import { addPart, createShape } from "../../server/shapes";
import { mp4, png } from "./media";
import { HOST_KEY, startHost, type StubHost } from "./host";
import { SITE_KEY, startSite, type StubSite } from "./site";

/**
 * The join and the first publish over the kernel harness, against a stub
 * site that validates what it receives: a shape taken into a container with
 * its parts assigned and every refusal, a binding written and its address
 * settled after the first publish, a publish landing with every object
 * declared and only the absent ones uploaded, the entry and the derived
 * state, an unchanged republish, a site answering HTML logged as failed, a
 * retirement, and the deletes refused while live. PU_0003_007
 *
 * With PU_0004: a Bunny Stream channel beside the site; the video slot's
 * part assigned with its host; the video published to Bunny from its rows
 * with the guid in the entry, the same export again uploading nothing, a
 * wrong key logged as failed; the website's document carrying the guid as
 * the entry's `host`, refused in words before the video was published there;
 * the item refused deletion while live, and retired. PU_0004_006
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const success = <T>(outcome: GraphOutcome<T>): T => {
  expect(outcome, JSON.stringify(outcome)).toMatchObject({ outcome: "success" });
  if (outcome.outcome !== "success") throw new Error("unreachable");
  return outcome.result;
};

const refused = <T>(outcome: GraphOutcome<T>, rule: string): void => {
  expect(outcome, JSON.stringify(outcome)).toMatchObject({ outcome: "validationFailure" });
  if (outcome.outcome === "validationFailure") expect(outcome.failures[0].rule).toBe(rule);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 320));

describe.skipIf(!configured)("the join and the first publish", () => {
  let site: StubSite;
  let host: StubHost;
  const ids = { shape: "", teaser: "", still: "", main: "", note: "", channel: "", bunny: "", e1: "", teaserItem: "", stillItem: "", clip: "", prose: "" };

  beforeAll(async () => {
    site = await startSite();
    host = await startHost();
  });

  afterAll(async () => {
    await site.close();
    await host.close();
  });

  it("Given a website channel and a shape, Then the channel takes the shape into a container and parts are assigned where they fit", async () => {
    ids.shape = success(await createShape({ title: "Episode" })).shapeId;
    ids.teaser = success(await addPart({ shapeId: ids.shape, part: { title: "Teaser", class: "image", cardinality: "one" } })).partId;
    await settle();
    ids.still = success(await addPart({ shapeId: ids.shape, part: { title: "Still", class: "image", cardinality: "any" } })).partId;
    await settle();
    ids.main = success(await addPart({ shapeId: ids.shape, part: { title: "Main video", class: "video", cardinality: "some", constraints: { aspect: "9:16" } } })).partId;
    await settle();
    ids.note = success(await addPart({ shapeId: ids.shape, part: { title: "Field note", class: "prose", cardinality: "optional" } })).partId;
    await settle();

    ids.channel = success(await createChannel({ kind: "website", title: "Stub site" })).channelId;
    await kernelSecrets.write(partyOf(ids.channel), { configuration: { address: site.address }, secrets: { apiKey: SITE_KEY } });
    success(await readIndex(ids.channel));

    refused(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.teaser, slot: "teaser" }), "notTaken");
    refused(await takeShape({ channelId: ids.channel, shapeId: ids.shape, container: "nowhere" }), "unknownContainer");
    success(await takeShape({ channelId: ids.channel, shapeId: ids.shape, container: "episodes" }));
    await settle();
    refused(await takeShape({ channelId: ids.channel, shapeId: ids.shape, container: "episodes" }), "alreadyTaken");
    success(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.teaser, slot: "teaser" }));
    await settle();
    refused(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.main, slot: "still" }), "doesNotFit");
    refused(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.still, slot: "nowhere" }), "unknownSlot");
    success(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.still, slot: "still" }));
    await settle();
    // A video slot may be assigned without its host, and names one later: a bunny-stream channel, not retired, and nothing else. PU_0004_002
    success(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.main, slot: "scene" }));
    await settle();
    refused(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.main, slot: "scene", host: ids.channel }), "notAVideoHost");
    ids.bunny = success(await createChannel({ kind: "bunny-stream", title: "Stub Bunny" })).channelId;
    await kernelSecrets.write(partyOf(ids.bunny), { configuration: { address: host.address }, secrets: { apiKey: HOST_KEY } });
    refused(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.still, slot: "still", host: ids.bunny }), "hostNotForClass");
    success(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.main, slot: "scene", host: ids.bunny }));
    await settle();
    success(await assignPart({ channelId: ids.channel, shapeId: ids.shape, partId: ids.note, slot: "prose" }));
    await settle();

    const takes = success(await readTakes(ids.channel));
    expect(takes.assignments).toHaveLength(1);
    expect(takes.assignments[0]).toMatchObject({ container: "episodes", missing: [] });
    expect(takes.assignments[0]?.parts.map((entry) => entry.slot).sort()).toEqual(["prose", "scene", "still", "teaser"]);
    expect(takes.assignments[0]?.parts.find((entry) => entry.slot === "scene")?.host).toBe(ids.bunny);
    expect(takes.videoHosts.map((found) => found.channelId)).toEqual([ids.bunny]);
    // The shape's parts travel along, so the tab offers them by title rather than asking for an id.
    expect(takes.assignments[0]?.shapeParts.map((part) => part.title).sort()).toEqual(["Field note", "Main video", "Still", "Teaser"]);

    // A key the site stops listing is kept while assigned: read the index again with the same site, nothing vanishes.
    const again = success(await readIndex(ids.channel));
    expect(again.dropped).toEqual([]);
  });

  it("Given a deliverable filled, Then its row at the channel says what is missing, a binding is written, and the address rule holds", async () => {
    ids.e1 = success(await createDeliverable({ shapeId: ids.shape, title: "E1" })).deliverableId;
    ids.teaserItem = success(await ingestItem({ bytes: png(1920, 1080), mediaType: "image/png", label: "Teaser" })).itemId;
    await settle();
    success(await addExport({ itemId: ids.teaserItem, bytes: png(1080, 1920, 9), mediaType: "image/png" }));
    ids.stillItem = success(await ingestItem({ bytes: png(1600, 900, 2), mediaType: "image/png", label: "Key art" })).itemId;
    await settle();
    success(await reviseItem({ itemId: ids.stillItem, alt: "The laurel" }));
    ids.clip = success(await ingestItem({ bytes: mp4({ width: 1080, height: 1920, seconds: 45 }), mediaType: "video/mp4", label: "Main" })).itemId;
    await settle();
    success(await reviseItem({ itemId: ids.clip, transcript: "Words spoken in the scene" }));
    ids.prose = success(await createProseItem({ label: "Field note one" })).itemId;
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.teaser, itemId: ids.teaserItem }));
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.still, itemId: ids.stillItem }));
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.main, itemId: ids.clip }));
    await settle();
    success(await placeItem({ deliverableId: ids.e1, partId: ids.note, itemId: ids.prose }));
    await settle();

    let at = success(await readAt(ids.e1));
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ container: "episodes", addressed: true, numbered: false, at: { state: "never" } });
    expect(at[0]?.missing.join(" ")).toContain("no address");
    expect(at[0]?.missing.join(" ")).toContain("requires Title");
    expect(at[0]?.missing.join(" ")).toContain("publish it to Stub Bunny first");

    refused(await bindDeliverable({ deliverableId: ids.e1, channelId: ids.channel, values: { address: "Bad Slug" } }), "addressShape");
    refused(await bindDeliverable({ deliverableId: ids.e1, channelId: ids.channel, values: { fields: { nope: "x" } } }), "unknownField");
    refused(await bindDeliverable({ deliverableId: ids.e1, channelId: ids.channel, values: { fields: { title: 5 } } }), "fieldValue");
    const bound = success(await bindDeliverable({ deliverableId: ids.e1, channelId: ids.channel, values: { address: "e1", fields: { title: "Episode one", premise: "A first one" } } }));
    expect(bound).toMatchObject({ address: "e1", fields: { title: "Episode one", premise: "A first one" }, addressSettled: false });
    await settle();
    at = success(await readAt(ids.e1));
    expect(at[0]?.missing).toEqual([expect.stringContaining("publish it to Stub Bunny first")]);
  });

  it("Given a video item and a Bunny channel, Then its rows say so, the publish uploads once under the deliverable's title, and the same export again sends nothing", async () => {
    let rows = success(await readItemAt(ids.clip));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: { channelId: ids.bunny }, at: { state: "never" }, missing: [] });
    expect(success(await readItemAt(ids.stillItem))).toEqual([]);

    // A wrong key is Bunny's refusal, logged as failed; nothing else is sent.
    await kernelSecrets.write(partyOf(ids.bunny), { secrets: { apiKey: "wrong" } });
    const failed = success(await publishItem({ itemId: ids.clip, channelId: ids.bunny }));
    expect(failed.released).toBe(false);
    expect(failed.entry).toMatchObject({ outcome: "failed", detail: expect.stringContaining("401: Unauthorized") });
    await kernelSecrets.write(partyOf(ids.bunny), { secrets: { apiKey: HOST_KEY } });

    host.seen.length = 0;
    const published = success(await publishItem({ itemId: ids.clip, channelId: ids.bunny }));
    expect(published, JSON.stringify(published)).toMatchObject({ released: true });
    expect(published.entry).toMatchObject({ act: "publish", outcome: "succeeded", recordKind: "item", externalId: expect.any(String) });
    const guid = published.entry?.externalId as string;
    expect(host.videos.get(guid)).toMatchObject({ title: "E1 — Main video" });
    expect(host.videos.get(guid)?.bytes).toBeGreaterThan(0);
    expect(host.seen.map((seen) => seen.method)).toEqual(["POST", "PUT"]);

    host.seen.length = 0;
    const again = success(await publishItem({ itemId: ids.clip, channelId: ids.bunny }));
    expect(again.released).toBe(true);
    expect(again.entry?.externalId).toBe(guid);
    expect(host.seen).toEqual([]);

    rows = success(await readItemAt(ids.clip));
    expect(rows[0]?.at).toMatchObject({ state: "published", externalId: guid });
  });

  it("Given the video released, Then the publish lands: every object declared, the absent uploaded, the document written and validated, the entry logged", async () => {
    // A projection refusal is not a failed publication: nothing is logged at the site.
    // The video's publication at Bunny is retired for a moment to prove the refusal.
    success(await retireItem({ itemId: ids.clip, channelId: ids.bunny }));
    const refusedPublish = success(await publishDeliverable({ deliverableId: ids.e1, channelId: ids.channel }));
    expect(refusedPublish.released).toBe(false);
    expect(refusedPublish.entry).toBeNull();
    expect(refusedPublish.refusals.map((refusal) => refusal.rule)).toEqual(["noVideoHost"]);
    expect(refusedPublish.refusals[0]?.detail).toContain("publish it to Stub Bunny first");
    expect(success(await entriesForChannel(ids.channel))).toEqual([]);
    const hosted = success(await publishItem({ itemId: ids.clip, channelId: ids.bunny }));
    expect(hosted.released).toBe(true);
    const guid = hosted.entry?.externalId as string;

    site.seen.length = 0;
    const published = success(await publishDeliverable({ deliverableId: ids.e1, channelId: ids.channel }));
    expect(published, JSON.stringify(published)).toMatchObject({ released: true });
    expect(published.entry).toMatchObject({ act: "publish", outcome: "succeeded", externalAddress: "/episodes/e1", recordTitle: "E1" });
    expect(published.entry?.objectIds).toHaveLength(3);
    const declares = site.seen.filter((seen) => seen.method === "POST" && seen.path === "/v1/media");
    const uploads = site.seen.filter((seen) => seen.method === "PUT" && seen.path.startsWith("/v1/media/"));
    expect(declares).toHaveLength(3);
    expect(uploads).toHaveLength(3);
    const written = site.seen.find((seen) => seen.method === "PUT" && seen.path === "/v1/episodes/e1");
    expect(written?.body).toMatchObject({ fields: { title: "Episode one", premise: "A first one" } });
    const document = written?.body as { slots: Record<string, { id: string; crops?: Record<string, string>; media?: string; document?: { blocks: unknown[] } }[]> };
    expect(document.slots["teaser"]?.[0]?.crops).toEqual({ "16:9": expect.any(String), "9:16": expect.any(String) });
    // The video entry carries the guid its publication at Bunny answered. PU_0004_005
    expect((document.slots["scene"]?.[0] as { host?: string } | undefined)?.host).toBe(guid);
    expect(document.slots["still"]?.[0]).toMatchObject({ id: ids.stillItem, fields: { alt: "The laurel" } });
    expect(document.slots["prose"]?.[0]?.document?.blocks).toBeDefined();
    expect(site.records.has("/episodes/e1")).toBe(true);

    const state = success(await stateAt(ids.e1, ids.channel));
    expect(state).toMatchObject({ state: "published", externalAddress: "/episodes/e1" });
    expect(state.firstPublishedAt).not.toBeNull();

    // The address is settled now.
    refused(await bindDeliverable({ deliverableId: ids.e1, channelId: ids.channel, values: { address: "e1-moved" } }), "addressSettled");
    const at = success(await readAt(ids.e1));
    expect(at[0]?.binding.addressSettled).toBe(true);

    // An unchanged republish declares and uploads nothing, and is a new entry with the first publication where it was.
    site.seen.length = 0;
    const again = success(await publishDeliverable({ deliverableId: ids.e1, channelId: ids.channel }));
    expect(again.released).toBe(true);
    expect(site.seen.filter((seen) => seen.method === "PUT" && seen.path.startsWith("/v1/media/"))).toHaveLength(0);
    const after = success(await stateAt(ids.e1, ids.channel));
    expect(after.firstPublishedAt).toBe(state.firstPublishedAt);
    expect(success(await entriesForChannel(ids.channel))).toHaveLength(2);
  });

  it("Given a workspace, Then a publish runs as a process moved through its steps to completed with the entry, a failing site leaves a failed one with its words, and a refused projection leaves none", async () => {
    // PU_0009_003
    const workspace = await createWorkspace();
    const ended = async (processId: string) => {
      for (let tick = 0; tick < 100; tick++) {
        const process = await readProcess(processId);
        if (process.state === "completed" || process.state === "failed") return process;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`process ${processId} did not end`);
    };
    try {
      const started = success(await startAct({ recordKind: "deliverable", recordId: ids.e1, channelId: ids.channel, act: "publish", workspaceId: workspace.id }));
      expect(started).toHaveProperty("processId");
      const processId = (started as { processId: string }).processId;
      expect(await readProcess(processId)).toMatchObject({ title: "Publish E1 to Stub site", itemId: ids.e1, itemKind: "publishing:deliverable" });
      const landed = await ended(processId);
      expect(landed.state).toBe("completed");
      expect(landed.step).toContain("landed at /episodes/e1");
      expect(landed.step).toContain("entry ");

      site.html = true;
      let failed;
      try {
        const attempt = success(await startAct({ recordKind: "deliverable", recordId: ids.e1, channelId: ids.channel, act: "publish", workspaceId: workspace.id }));
        failed = await ended((attempt as { processId: string }).processId);
      } finally {
        site.html = false;
      }
      expect(failed.state).toBe("failed");
      expect(failed.error).toContain("Declaring");

      // A projection refusal: the video retired at Bunny, the publish answers the rules and no process.
      success(await retireItem({ itemId: ids.clip, channelId: ids.bunny }));
      const refusedAct = success(await startAct({ recordKind: "deliverable", recordId: ids.e1, channelId: ids.channel, act: "publish", workspaceId: workspace.id }));
      expect(refusedAct).toMatchObject({ released: false, entry: null });
      expect(("refusals" in refusedAct ? refusedAct.refusals : []).map((refusal) => refusal.rule)).toEqual(["noVideoHost"]);
      const hosted = success(await startAct({ recordKind: "item", recordId: ids.clip, channelId: ids.bunny, act: "publish", workspaceId: workspace.id }));
      const rehosted = await ended((hosted as { processId: string }).processId);
      expect(rehosted.state).toBe("completed");
      expect(rehosted.title).toBe("Publish Main to Stub Bunny");
    } finally {
      await deleteWorkspace(workspace.id);
    }
  });

  it("Given the site answering HTML, Then the publish is logged as failed and the state stays published; the deletes refuse while live", async () => {
    site.html = true;
    try {
      const failed = success(await publishDeliverable({ deliverableId: ids.e1, channelId: ids.channel }));
      expect(failed.released).toBe(false);
      expect(failed.entry).toMatchObject({ outcome: "failed" });
    } finally {
      site.html = false;
    }
    const state = success(await stateAt(ids.e1, ids.channel));
    expect(state.state).toBe("published");
    expect(state.lastAttempt).toMatchObject({ outcome: "failed" });

    const e1 = success(await readDeliverable(ids.e1));
    refused(await deleteDeliverable({ deliverableId: ids.e1, baseRevisionId: e1.revisionId }), "liveAtChannel");
    const channel = success(await readChannel(ids.channel));
    refused(await deleteChannel({ channelId: ids.channel, baseRevisionId: channel.revisionId }), "channelPublishedTo");
    refused(await dropShape({ channelId: ids.channel, shapeId: "no-such-shape" }), "notTaken");
  });

  it("Given a retirement, Then the site holds a tombstone, the state reads retired, a second retirement is refused, and the channel retires rather than deletes", async () => {
    const retired = success(await retireDeliverable({ deliverableId: ids.e1, channelId: ids.channel }));
    expect(retired.released).toBe(true);
    expect(site.tombstones.has("/episodes/e1")).toBe(true);
    expect(success(await stateAt(ids.e1, ids.channel)).state).toBe("retired");
    refused(await retireDeliverable({ deliverableId: ids.e1, channelId: ids.channel }), "alreadyRetired");

    const e1 = success(await readDeliverable(ids.e1));
    success(await deleteDeliverable({ deliverableId: ids.e1, baseRevisionId: e1.revisionId }));

    // The video, no longer gathered, is still refused deletion while live at Bunny; retired there — a delete
    // at Bunny — the state reads retired and a second retirement is refused.
    const clip = success(await readItem(ids.clip));
    refused(await deleteItem({ itemId: ids.clip, baseRevisionId: clip.revisionId }), "liveAtChannel");
    const retiredClip = success(await retireItem({ itemId: ids.clip, channelId: ids.bunny }));
    expect(retiredClip.released).toBe(true);
    expect(host.seen.at(-1)).toMatchObject({ method: "DELETE" });
    expect(success(await readItemAt(ids.clip))[0]?.at.state).toBe("retired");
    refused(await retireItem({ itemId: ids.clip, channelId: ids.bunny }), "alreadyRetired");

    const channel = success(await readChannel(ids.channel));
    success(await retireChannel({ channelId: ids.channel, baseRevisionId: channel.revisionId }));
    await settle();
    const listed = success(await listChannels());
    expect(listed.find((found) => found.channelId === ids.channel)?.retired).toBe(true);
    const view = await kernelSecrets.read(partyOf(ids.channel));
    expect(view.secretFields?.["apiKey"]?.set ?? false).toBe(false);
    expect(success(await entriesForChannel(ids.channel)).length).toBeGreaterThan(0);
  });
});
