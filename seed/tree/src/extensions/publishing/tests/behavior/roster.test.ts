import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import {
  clearConnectionSecret,
  listConnections,
  proveConnection,
  readConnection,
  writeConnectionSecret,
} from "~/extensions/settings/server/connections";
import { createChannel, deleteChannel, partyOf, readChannel } from "../../server/channels";

/**
 * The dynamic party roster seen from the channel's side, over a real kernel:
 * `CALLIOPA_KERNEL_URL` names it, and without it the suite skips; the
 * repository's kernel harness provides it over a scratch kernel with a secret
 * store mounted.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

/**
 * A channel the author made is a party this extension's roster answers:
 * its row lists in the settings surface by its title, saves an address and
 * a key, proves against the site, clears, and is gone once the channel is.
 * The direction a dependency may run: `publishing` depends on `settings`,
 * so the channel is made through this extension's module and read back
 * through settings'. Carried by settings' `parties.test.ts` until
 * CA_0051, which made settings build without this extension.
 * CA_0049_003 CA_0049_004 CA_0051_002
 */
describe.skipIf(!configured)("a channel the author made", () => {
  let site: Server;
  let address = "";
  let sawAuthorization = "";
  let channelId = "";

  beforeAll(async () => {
    site = createServer((request, response) => {
      sawAuthorization = String(request.headers.authorization ?? "");
      if (sawAuthorization !== "Bearer site-key-9876") {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { code: "unauthorized", message: "A valid key is required." } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ version: 1, containers: [], slots: [], copy: [] }));
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    const bound = site.address();
    address = typeof bound === "object" && bound !== null ? `http://127.0.0.1:${bound.port}` : "";
    const written = await createChannel({ kind: "website", title: "Roster site" });
    if (written.outcome === "success") channelId = written.result.channelId;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => site.close(() => resolve()));
  });

  it("Given the channel, Then it lists as a row by its title with its address field, after the contributed parties", async () => {
    expect(channelId).not.toBe("");
    const rows = await listConnections();
    const row = rows.find((candidate) => candidate.party === partyOf(channelId));
    expect(row).toMatchObject({
      label: "Roster site",
      channel: true,
      kind: "apiKey",
      state: "unconfigured",
      keySet: false,
    });
    expect(row?.fields.map((field) => field.key)).toEqual(["address"]);
    const contributed = rows.findIndex((candidate) => candidate.party === "honcho");
    const dynamic = rows.findIndex((candidate) => candidate.party === partyOf(channelId));
    expect(contributed).toBeLessThan(dynamic);
  });

  it("Given an address and a key saved on the row, Then the record shows the address and the key's suffix, proves against the site, and clears", async () => {
    const saved = await writeConnectionSecret(partyOf(channelId), {
      configuration: { address },
      secret: "site-key-9876",
    });
    expect(saved.state).toBe("configured");
    expect(saved.configuration["address"]).toBe(address);
    expect(saved.secretSuffix).toBe("9876");
    expect(JSON.stringify(saved)).not.toContain("site-key-9876");

    const proven = await proveConnection(partyOf(channelId));
    expect(proven.state).toBe("verified");
    expect(sawAuthorization).toBe("Bearer site-key-9876");

    const notAnAddress = writeConnectionSecret(partyOf(channelId), { configuration: { address: "not an address" } });
    await expect(notAnAddress).rejects.toMatchObject({ status: 400 });

    const cleared = await clearConnectionSecret(partyOf(channelId));
    expect(cleared.keySet).toBe(false);
  });

  it("Given the channel deleted, Then its row is gone and the party is unknown here", async () => {
    const detail = await readChannel(channelId);
    expect(detail.outcome).toBe("success");
    if (detail.outcome !== "success") return;
    const deleted = await deleteChannel({ channelId, baseRevisionId: detail.result.revisionId });
    expect(deleted.outcome).toBe("success");
    const rows = await listConnections();
    expect(rows.some((candidate) => candidate.party === partyOf(channelId))).toBe(false);
    await expect(readConnection(partyOf(channelId))).rejects.toMatchObject({ status: 404 });
  });
});
