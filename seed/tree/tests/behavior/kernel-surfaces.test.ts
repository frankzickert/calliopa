import { afterAll, describe, expect, it } from "vitest";

import { readGraphEnv } from "../../src/server/ccgw/env";
import {
  acknowledgeProcess,
  createProcess,
  listProcesses,
  readProcess,
  transitionProcess,
} from "../../src/server/processes";
import {
  createWorkspace,
  DEFAULT_WORKSPACE_ID,
  deleteWorkspace,
  readDefaultWorkspace,
  readWorkspace,
  saveWorkspace,
} from "../../src/server/workspaces";

/**
 * The shell's working state over the kernel's state record, against a real
 * kernel: `CALLIOPA_KERNEL_URL` names it (and `CALLIOPA_CCGW_URL` beside it,
 * though nothing here reads the graph). Without both the suite skips; the
 * repository's kernel harness provides them over a scratch kernel. The party
 * scenarios that stood here are the settings extension's own suite since
 * `BO_0202_011` (`src/extensions/settings/tests/behavior/parties.test.ts`).
 * `BO_0207_014`
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!configured)("workspaces and processes in the kernel's state record", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      try {
        await deleteWorkspace(id);
      } catch {
        // already gone
      }
    }
  });

  it("Given a first visit, Then the default workspace exists under its fixed identity and reads back the same", async () => {
    const first = await readDefaultWorkspace();
    expect(first.id).toBe(DEFAULT_WORKSPACE_ID);
    // A new workspace opens with no tabs (BO_0203_005).
    expect(first.tabs).toEqual([]);
    const again = await readDefaultWorkspace();
    expect(again.createdAt).toBe(first.createdAt);
  });

  it("Given a workspace, Then tabs and layout save, read back, and a deleted workspace is gone", async () => {
    const workspace = await createWorkspace();
    created.push(workspace.id);
    const saved = await saveWorkspace(workspace.id, {
      ...workspace,
      tabs: [
        {
          id: "t1",
          kind: "ui.shell:document",
          title: "Kept",
          itemId: null,
          selection: null,
          drawerContext: null,
          unsaved: false,
        },
      ],
      activeTabId: "t1",
    });
    expect(saved.tabs.map((tab) => tab.title)).toEqual(["Kept"]);
    const read = await readWorkspace(workspace.id);
    expect(read.activeTabId).toBe("t1");
    expect(read.createdAt).toBe(workspace.createdAt);

    await expect(
      saveWorkspace(workspace.id, { ...read, activeTabId: "nope" }),
    ).rejects.toMatchObject({ status: 400 });

    await deleteWorkspace(workspace.id);
    await expect(readWorkspace(workspace.id)).rejects.toMatchObject({ status: 404 });
    created.pop();
  });

  it("Given a workspace, Then processes are created, listed in creation order, moved by the rule, and acknowledged", async () => {
    const workspace = await createWorkspace();
    created.push(workspace.id);
    const first = await createProcess(workspace.id, { title: "Render", step: "queued up" });
    const second = await createProcess(workspace.id, { title: "Publish" });
    const listed = await listProcesses(workspace.id);
    expect(listed.map((process) => process.id)).toEqual([first.id, second.id]);

    const running = await transitionProcess(first.id, { state: "running", step: "encoding" });
    expect(running.state).toBe("running");
    await expect(
      transitionProcess(first.id, { state: "queued" }),
    ).rejects.toMatchObject({ status: 409 });
    const failed = await transitionProcess(first.id, { state: "failed", error: "the encoder said no" });
    expect(failed.error).toBe("the encoder said no");
    expect((await readProcess(first.id)).acknowledged).toBe(false);
    expect((await acknowledgeProcess(first.id)).acknowledged).toBe(true);
    await expect(acknowledgeProcess(second.id)).rejects.toMatchObject({ status: 409 });

    // A process an extension produces, affecting an item of its own kind, lists, moves and is acknowledged like a run's. CA_0050_002
    const published = await createProcess(workspace.id, { title: "Publish E1 to Calliopa.com", step: "declaring 3 objects", itemId: "e1", itemKind: "publishing:deliverable" });
    expect(published).toMatchObject({ itemId: "e1", itemKind: "publishing:deliverable", state: "queued" });
    expect((await listProcesses(workspace.id)).map((process) => process.id)).toEqual([first.id, second.id, published.id]);
    expect((await transitionProcess(published.id, { state: "running", step: "uploading 2 of 3" })).step).toBe("uploading 2 of 3");
    const landed = await transitionProcess(published.id, { state: "failed", error: "Writing /episodes/e1: 400 validation (title)" });
    expect(landed.error).toContain("/episodes/e1");
    expect((await acknowledgeProcess(published.id)).acknowledged).toBe(true);
  });

  it("Given an oauth party, Then the device flow signs it in through the kernel, and the broker carries headers, Location and Range, and a blob slice", async () => {
    // BO_0252_006: the shell client half against the kernel's oauth kind; the provider and the destination are stubs in this process.
    const { createServer } = await import("node:http");
    const { kernelSecrets } = await import("../../src/server/kernel/client");
    const { putBlob } = await import("../../src/server/ccgw/blobs");
    let polls = 0;
    const seen: { auth: string; path: string; headers: Record<string, string>; body: Buffer }[] = [];
    const provider = createServer((request, response) => {
      let raw = "";
      request.on("data", (chunk: Buffer) => (raw += chunk.toString("utf8")));
      request.on("end", () => {
        const form = new URLSearchParams(raw);
        response.setHeader("content-type", "application/json");
        if (request.url === "/device/code") {
          response.end(JSON.stringify({ device_code: "dc-9", user_code: "WXYZ-1234", verification_url: "https://example.test/device", expires_in: 60, interval: 1 }));
          return;
        }
        if (form.get("grant_type") === "refresh_token") {
          response.end(JSON.stringify({ access_token: "tok-2", expires_in: 3600 }));
          return;
        }
        polls += 1;
        if (polls < 2) {
          response.statusCode = 428;
          response.end(JSON.stringify({ error: "authorization_pending" }));
          return;
        }
        response.end(JSON.stringify({ access_token: "tok-1", refresh_token: "ref-1", expires_in: 3600 }));
      });
    });
    const destination = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        seen.push({ auth: String(request.headers.authorization ?? ""), path: request.url ?? "", headers: Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k, String(v)])), body: Buffer.concat(chunks) });
        response.setHeader("content-type", "application/json");
        if (request.method === "POST") response.setHeader("location", "http://stub/session?upload_id=u-1");
        if (request.method === "PUT") {
          response.setHeader("range", "bytes=0-3");
          response.statusCode = 308;
        }
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    await new Promise<void>((resolve) => destination.listen(0, "127.0.0.1", resolve));
    const at = (server: ReturnType<typeof createServer>) => { const bound = server.address(); return typeof bound === "object" && bound !== null ? `http://127.0.0.1:${bound.port}` : ""; };
    try {
      const party = "oauth-probe";
      await kernelSecrets.write(party, {
        kind: "oauth",
        configuration: { address: `${at(destination)}/api/v3`, clientId: "cid-9" },
        secrets: { clientSecret: "cs-9" },
        provider: { deviceAuthorizationUrl: `${at(provider)}/device/code`, tokenUrl: `${at(provider)}/token`, scopes: ["scope.one"] },
        test: { url: "{configuration.address}/me", expectStatus: 200 },
        paths: ["/api/v3", "/upload/v3"],
      });
      const started = await kernelSecrets.signIn(party);
      expect(started).toMatchObject({ userCode: "WXYZ-1234", verificationUrl: "https://example.test/device" });
      let view = await kernelSecrets.read(party);
      for (let tick = 0; tick < 100 && view.flow?.state !== "verified"; tick++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        view = await kernelSecrets.read(party);
      }
      expect(view.flow?.state).toBe("verified");
      expect(view.state).toBe("verified");
      expect(JSON.stringify(view)).not.toContain("tok-1");
      expect(view.secretFields["accessToken"]?.set).toBe(true);

      const opened = await kernelSecrets.request(party, { method: "POST", path: "/upload/v3/videos", headers: { "X-Upload-Content-Length": "4" }, body: { title: "E1" } });
      expect(opened.status).toBe(200);
      expect(opened.location).toContain("upload_id=u-1");
      expect(seen.at(-1)?.headers["x-upload-content-length"]).toBe("4");
      expect(seen.at(-1)?.auth).toBe("Bearer tok-1");

      const stored = await putBlob(new Uint8Array([10, 11, 12, 13, 14, 15]));
      if (stored.outcome !== "success") throw new Error(JSON.stringify(stored));
      const chunk = await kernelSecrets.request(party, { method: "PUT", path: "/upload/v3/videos?upload_id=u-1", blob: stored.result.hash, range: [1, 4], contentType: "video/mp4", headers: { "Content-Range": "bytes 1-4/6" } });
      expect(chunk.status).toBe(308);
      expect(chunk.range).toBe("bytes=0-3");
      expect([...(seen.at(-1)?.body ?? [])]).toEqual([11, 12, 13, 14]);
      expect(seen.at(-1)?.headers["content-length"]).toBe("4");

      await expect(kernelSecrets.request(party, { method: "GET", path: "/elsewhere" })).rejects.toMatchObject({ status: 400 });
      await kernelSecrets.remove(party);
    } finally {
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      await new Promise<void>((resolve) => destination.close(() => resolve()));
    }
  }, 60000);
});
