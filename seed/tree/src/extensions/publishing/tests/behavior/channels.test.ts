import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { kernelSecrets } from "~/server/kernel/client";
import { createChannel, deleteChannel, listChannels, partyOf, readChannel } from "../../server/channels";
import { readIndex } from "../../server/index-read";

/**
 * Channels over a real CCGW and a real kernel, run by the repository's
 * kernel harness against a scratch graph seeded with this extension's
 * members: a channel created with its party record and listed with its
 * state, a title refused blank, an unknown kind refused, the index read from
 * a stub site through the kernel's broker, stored and re-read with a
 * vanished key dropped, a site answering HTML refused, and a channel deleted
 * with its record gone. PU_0001_008
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const KEY = "site-key-4242";

describe.skipIf(!configured)("channels as data", () => {
  let site: Server;
  let address = "";
  let index: unknown = null;
  let html = false;
  let sawAuthorization = "";
  let sawPath = "";

  beforeAll(async () => {
    site = createServer((request, response) => {
      sawAuthorization = String(request.headers.authorization ?? "");
      sawPath = request.url ?? "";
      if (sawAuthorization !== `Bearer ${KEY}`) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { code: "unauthorized", message: "A valid key is required." } }));
        return;
      }
      if (html) {
        // A dev server mid-restart answers 200 with an error page.
        response.writeHead(200, { "content-type": "text/html" });
        response.end("<html><body>Internal error</body></html>");
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(index));
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    const bound = site.address();
    // Under a path, like homepage's `/v1`: the index must be asked for there, not at the host's root.
    address = typeof bound === "object" && bound !== null ? `http://127.0.0.1:${bound.port}/v1` : "";
    index = {
      version: 1,
      containers: [{ key: "episodes", title: "Episode", route: "/episodes/{number}", fields: [{ key: "title", title: "Title", type: "line" }] }],
      slots: [
        { key: "scene", title: "Scene", class: "video", container: "episodes", required: true, aspect: "9:16" },
        { key: "still", title: "Still", class: "image", container: "episodes" },
      ],
      copy: [{ key: "tagline", title: "Tagline", type: "line" }],
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => site.close(() => resolve()));
  });

  const created: string[] = [];

  it("Given a kind and a title, Then the channel is established, listed unconfigured, and its party record exists", async () => {
    const written = await createChannel({ kind: "website", title: "Test site" });
    expect(written.outcome).toBe("success");
    if (written.outcome !== "success") return;
    created.push(written.result.channelId);

    const listed = await listChannels();
    expect(listed.outcome).toBe("success");
    if (listed.outcome !== "success") return;
    const row = listed.result.find((channel) => channel.channelId === written.result.channelId);
    expect(row).toMatchObject({ kind: "website", kindLabel: "Website", title: "Test site", state: "unconfigured" });

    const view = await kernelSecrets.read(partyOf(written.result.channelId));
    expect(view.test?.url).toBe("{configuration.address}/index");
    expect(view.secretFields["apiKey"]?.set ?? false).toBe(false);
  });

  it("Given a blank title or an unknown kind, Then the channel is refused in words and nothing is written", async () => {
    const blank = await createChannel({ kind: "website", title: "   " });
    expect(blank.outcome).toBe("validationFailure");
    if (blank.outcome === "validationFailure") expect(blank.failures[0].rule).toBe("titleRequired");
    const unknown = await createChannel({ kind: "carrier-pigeon", title: "Loft" });
    expect(unknown.outcome).toBe("validationFailure");
    if (unknown.outcome === "validationFailure") expect(unknown.failures[0].rule).toBe("unknownKind");
  });

  it("Given an address and a key saved on the party record, Then the channel reads as configured and the index is read through the broker, stored and shown", async () => {
    const channelId = created[0] as string;
    const unread = await readIndex(channelId);
    expect(unread.outcome).toBe("validationFailure");
    if (unread.outcome === "validationFailure") expect(unread.failures[0].rule).toBe("unconfigured");

    await kernelSecrets.write(partyOf(channelId), { configuration: { address }, secrets: { apiKey: KEY } });
    const detail = await readChannel(channelId);
    expect(detail.outcome).toBe("success");
    if (detail.outcome !== "success") return;
    expect(detail.result.credential.state).toBe("configured");
    expect(detail.result.credential.keySet).toBe(true);
    expect(detail.result.credential.configuration["address"]).toBe(address);
    expect(JSON.stringify(detail.result)).not.toContain(KEY);
    expect(detail.result.index).toBeNull();

    const read = await readIndex(channelId);
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect(sawPath).toBe("/v1/index");
    expect(sawAuthorization).toBe(`Bearer ${KEY}`);
    expect(read.result.index.containers.map((kept) => kept.entry.key)).toEqual(["episodes"]);
    expect(read.result.index.slots.map((kept) => [kept.entry.key, kept.inIndex])).toEqual([
      ["scene", true],
      ["still", true],
    ]);
    expect(read.result.dropped).toEqual([]);

    const again = await readChannel(channelId);
    expect(again.outcome).toBe("success");
    if (again.outcome !== "success") return;
    expect(again.result.index?.slots.length).toBe(2);
    expect(again.result.index?.readAt).toBe(read.result.index.readAt);
  });

  it("Given the site no longer lists a slot, Then the next read drops it, since nothing is assigned to it yet", async () => {
    const channelId = created[0] as string;
    const current = index as { slots: unknown[] };
    index = { ...current, slots: current.slots.slice(0, 1) };
    const read = await readIndex(channelId);
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect(read.result.dropped).toEqual(["slot:still"]);
    expect(read.result.index.slots.map((kept) => kept.entry.key)).toEqual(["scene"]);
  });

  it("Given a site answering HTML where its index should be, Then the read is refused and what was stored stands", async () => {
    const channelId = created[0] as string;
    html = true;
    try {
      const read = await readIndex(channelId);
      expect(read.outcome).toBe("validationFailure");
      if (read.outcome === "validationFailure") expect(read.failures[0].rule).toBe("notAnIndex");
    } finally {
      html = false;
    }
    const detail = await readChannel(channelId);
    if (detail.outcome === "success") expect(detail.result.index?.slots.length).toBe(1);
  });

  it("Given a site declaring an addressed container with references, slot fields and crops, Then the read stores every new property and reads it back", async () => {
    const channelId = created[0] as string;
    const held = index;
    index = {
      version: 1,
      containers: [
        {
          key: "episodes",
          title: "Episode",
          route: "/episodes/{slug}",
          fields: [
            { key: "home_serial", title: "Home serial", type: "reference", container: "serials" },
            { key: "characters", title: "Characters", type: "reference", container: "characters", many: true },
            { key: "position", title: "Position", type: "integer" },
            { key: "card_scene", title: "Card scene", type: "entry", slot: "scene", required: true },
          ],
        },
        { key: "serials", title: "Serial", route: "/serials/{slug}" },
        { key: "characters", title: "Character", route: "/characters/{slug}" },
      ],
      slots: [
        {
          key: "scene",
          title: "Scene",
          class: "video",
          container: "episodes",
          fields: [{ key: "transcript", title: "Transcript", type: "text" }],
        },
        { key: "teaser", title: "Teaser", class: "image", container: "episodes", required: true, aspects: ["16:9", "9:16", "1:1"] },
      ],
      copy: [],
    };
    try {
      const read = await readIndex(channelId);
      expect(read, JSON.stringify(read)).toMatchObject({ outcome: "success" });
      if (read.outcome !== "success") return;
      const stored = await readChannel(channelId);
      expect(stored.outcome).toBe("success");
      if (stored.outcome !== "success") return;
      const episodes = stored.result.index?.containers.find((kept) => kept.entry.key === "episodes")?.entry;
      expect(episodes?.route).toBe("/episodes/{slug}");
      expect(episodes?.fields.map((field) => [field.type, field.container, field.many])).toEqual([
        ["reference", "serials", false],
        ["reference", "characters", true],
        ["integer", null, false],
        ["entry", null, false],
      ]);
      expect(episodes?.fields[3]).toMatchObject({ slot: "scene", required: true });
      const scene = stored.result.index?.slots.find((kept) => kept.entry.key === "scene")?.entry;
      expect(scene?.fields.map((field) => field.key)).toEqual(["transcript"]);
      const teaser = stored.result.index?.slots.find((kept) => kept.entry.key === "teaser")?.entry;
      expect(teaser?.aspects).toEqual(["16:9", "9:16", "1:1"]);
    } finally {
      index = held;
    }
  });

  it("Given a broken index, Then every refusal is named and nothing is stored", async () => {
    const channelId = created[0] as string;
    const held = index;
    index = { version: 1, containers: [{ key: "Bad", title: "", route: "nope" }], slots: [], copy: [] };
    try {
      const read = await readIndex(channelId);
      expect(read.outcome).toBe("validationFailure");
      if (read.outcome === "validationFailure") {
        expect(read.failures.map((failure) => failure.detail)).toEqual(
          expect.arrayContaining([
            "containers[0].key: key must be lowercase letters, digits and hyphens.",
            "containers[0].route: route must start with /.",
          ]),
        );
      }
    } finally {
      index = held;
    }
  });

  it("Given a channel deleted, Then it is gone from the listing and its party record with it; a stale revision is refused", async () => {
    const channelId = created[0] as string;
    const detail = await readChannel(channelId);
    expect(detail.outcome).toBe("success");
    if (detail.outcome !== "success") return;

    const stale = await deleteChannel({ channelId, baseRevisionId: "rev:not-this-one" });
    expect(stale.outcome).toBe("conflict");

    const deleted = await deleteChannel({ channelId, baseRevisionId: detail.result.revisionId });
    expect(deleted, JSON.stringify(deleted)).toMatchObject({ outcome: "success" });
    const listed = await listChannels();
    if (listed.outcome === "success") expect(listed.result.some((channel) => channel.channelId === channelId)).toBe(false);
    // The kernel answers an empty record for a party it holds nothing for,
    // the way the settings listing relies on: nothing set, nothing configured.
    const view = await kernelSecrets.read(partyOf(channelId));
    expect(view.secretFields?.["apiKey"]?.set ?? false).toBe(false);
    expect(view.configuration?.["address"] ?? "").toBe("");
    const gone = await readChannel(channelId);
    expect(gone.outcome).toBe("noResult");
  });
});
