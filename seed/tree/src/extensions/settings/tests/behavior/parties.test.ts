import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "~/server/ccgw/env";
import { createChannel, deleteChannel, partyOf, readChannel } from "~/extensions/publishing/server/channels";
import {
  clearConnectionSecret,
  listConnections,
  proveConnection,
  readConnection,
  writeConnectionSecret,
} from "../../server/connections";

/**
 * The party roster in the kernel's secret store, against a real kernel:
 * `CALLIOPA_KERNEL_URL` names it. Without it the suite skips; the
 * repository's kernel harness provides it over a scratch kernel with a secret
 * store mounted. The settings extension's own behavior suite, run only while
 * the extension is present in the tree; the channel scenarios are
 * `calliopa-video`'s since `BO_0203_007`. `BO_0207_013` `BO_0202_011`
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("party configuration in the kernel's secret store", () => {
  it("Given every party, Then the listing names them all, unconfigured until something is stored", async () => {
    const rows = await listConnections();
    // The four parties this extension contributes; a channel another
    // extension contributes lists beside them when that extension is present.
    expect(rows.map((row) => row.party)).toEqual(
      expect.arrayContaining(["claude-code", "codex", "hermes", "honcho"]),
    );
    expect(rows.find((row) => row.party === "honcho")?.keySet).toBe(false);
  });


  it("Given a party with no key, Then proving it is refused rather than reported as failing", async () => {
    await expect(proveConnection("honcho")).rejects.toMatchObject({ status: 409 });
  });

  /**
   * A channel the author made is a party the publishing extension's roster
   * answers: its row lists here by its title, saves an address and a key,
   * proves against the site, clears, and is gone once the channel is. The
   * direction a dependency may run: `publishing` depends on `settings`, so
   * the channel is made through publishing's own module and read back
   * through this one. CA_0049_003 CA_0049_004
   */
  describe("a channel the author made", () => {
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
});
