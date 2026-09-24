import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kernel: { calls: { path: string; body: unknown }[]; ok: boolean; refusal: unknown } = {
  calls: [],
  ok: true,
  refusal: {},
};
vi.mock("~/server/kernel/client", () => ({
  call: async (path: string, init: { body?: string }) => {
    kernel.calls.push({ path, body: init.body === undefined ? null : JSON.parse(init.body) });
    return { ok: kernel.ok, json: async () => (kernel.ok ? {} : kernel.refusal) };
  },
}));

import { chooseWorkspace, handBackRedirect, requestSignIn, signInState } from "./media";

/**
 * Signing in to a generator writes the broker's request and reads its state
 * over the volume both containers mount — no network, no secret in the tree,
 * the way the agent's sign-in already works (`BO_0273_025`). Every state
 * carries its request's id, so a row follows its own flow and never reads an
 * older one's outcome as its own (`BO_0261`).
 */
let area: string;
const held = process.env.CALLIOPA_MEDIA_CONFIG_DIR;

beforeEach(async () => {
  area = await mkdtemp(join(tmpdir(), "media-config-"));
  process.env.CALLIOPA_MEDIA_CONFIG_DIR = area;
  await mkdir(join(area, "login"), { recursive: true });
});

afterEach(() => {
  if (held === undefined) delete process.env.CALLIOPA_MEDIA_CONFIG_DIR;
  else process.env.CALLIOPA_MEDIA_CONFIG_DIR = held;
});

const request = async () => JSON.parse(await readFile(join(area, "login", "request.json"), "utf8"));
const publish = async (state: unknown) =>
  writeFile(join(area, "login", "state.json"), JSON.stringify(state));

describe("signing in to a generator", () => {
  it("writes the request the broker watches, with its own id", async () => {
    const id = await requestSignIn("openart");
    const written = await request();
    expect(written.service).toBe("openart");
    expect(written.id).toBe(id);
    expect(written.workspace).toBeUndefined();
  });

  it("carries no workspace at all: one is picked after signing in, not before", async () => {
    // Its id is only knowable once the login reveals it. BO_0273_042
    await requestSignIn("higgsfield");
    expect((await request()).workspace).toBeUndefined();
  });

  it("answers nothing before a flow has published", async () => {
    expect(await signInState()).toBeNull();
  });

  it("answers the flow whose id was asked for", async () => {
    await publish({ service: "openart", status: "running", id: "flow-1", url: "https://x" });
    const state = await signInState("flow-1");
    expect(state?.status).toBe("running");
    expect(state?.url).toBe("https://x");
  });

  it("answers nothing for a flow another one replaced without saying so", async () => {
    await publish({ service: "openart", status: "running", id: "flow-2" });
    expect(await signInState("flow-1")).toBeNull();
  });

  it("answers the outcome of the flow it superseded, so a row following it learns", async () => {
    await publish({
      service: "higgsfield",
      status: "running",
      id: "flow-2",
      previous: { id: "flow-1", status: "superseded" },
    });
    const state = await signInState("flow-1");
    expect(state?.status).toBe("superseded");
    expect(state?.service).toBe("higgsfield");
  });

  it("hands the redirect back where the broker reads it", async () => {
    await handBackRedirect("higgsfield", "flow-1", "c1", "zz");
    expect(await request()).toEqual({
      service: "higgsfield",
      id: "flow-1",
      code: "c1",
      state: "zz",
    });
  });
});

describe("choosing the workspace a service submits into", () => {
  beforeEach(() => {
    kernel.calls = [];
    kernel.ok = true;
    kernel.refusal = {};
  });

  it("asks the kernel, which holds the service's bearer", async () => {
    const taken = await chooseWorkspace("higgsfield", "ws-9");
    expect(taken.ok).toBe(true);
    expect(kernel.calls).toEqual([
      { path: "/__kernel/media/workspaces", body: { service: "higgsfield", workspace: "ws-9" } },
    ]);
  });

  it("carries the service's own words back when it refuses", async () => {
    kernel.ok = false;
    kernel.refusal = { error: "'ws-9' is not one of this account's workspaces" };
    const taken = await chooseWorkspace("higgsfield", "ws-9");
    expect(taken).toEqual({ ok: false, refusal: "'ws-9' is not one of this account's workspaces" });
  });

  it("says something even when the refusal carries no words", async () => {
    kernel.ok = false;
    const taken = await chooseWorkspace("higgsfield", "ws-9");
    expect(taken.ok).toBe(false);
    expect(taken.ok === false && taken.refusal).toBeTruthy();
  });
});
