import { describe, expect, it } from "vitest";

import type { ConnectionRecord } from "~/lib/connections";
import { SERVER_REGISTRY } from "~/registry.server.gen";
import { existsAt, onDevice } from "./connections";

/**
 * What the settings surface lists where it runs: the keys a device's runs and
 * services use on a device and nowhere else, the agent container's own parties
 * on an instance and nowhere else, and on a device the subscription runtimes
 * shown, never signed in, pointing at the key that stands in for each.
 * BO_0319_047 BO_0319_049
 */

const roster = SERVER_REGISTRY.parties;
const ids = (where: "instance" | "device") => roster.filter((party) => existsAt(party, where)).map((party) => party.id);

const statusRow = (party: string): ConnectionRecord => ({
  party,
  label: party,
  purpose: "",
  channel: false,
  fields: [],
  kind: "status",
  state: "verified",
  keySet: false,
  secretSuffix: null,
  configuration: {},
  lastTestedAt: null,
  lastError: "The agent has not reported on this runtime.",
  status: { installed: true, version: "codex-cli 0.151.0", authenticated: true, billing: "subscription" },
  agent: null,
  signOutBlocked: "A run is going on Codex. Sign out once it ends.",
});

describe("the connections a place lists", () => {
  it("Given a device, Then the five keys are there, the subscriptions too, and the agent container's parties are not", () => {
    const device = ids("device");
    for (const party of ["anthropic", "openai", "openrouter", "search", "embeddings", "higgsfield", "codex", "claude-code"]) {
      expect(device).toContain(party);
    }
    expect(device).not.toContain("hermes");
    expect(device).not.toContain("honcho");
  });

  it("Given an instance, Then nothing of a device's is listed and everything it listed before still is", () => {
    const instance = ids("instance");
    for (const party of ["anthropic", "openai", "openrouter", "search", "embeddings", "higgsfield"]) {
      expect(instance).not.toContain(party);
    }
    for (const party of ["hermes", "honcho", "codex", "claude-code", "evaluation"]) {
      expect(instance).toContain(party);
    }
  });

  it("Given each device key, Then the kernel is handed a probe that presents it", () => {
    for (const party of roster.filter((candidate) => candidate.where === "device")) {
      expect(party.credential).toBe("apiKey");
      expect(party.probe?.authorization.secretField).toBe("apiKey");
      expect(party.probe?.test.url).toMatch(/^https:\/\//u);
    }
    expect(roster.find((party) => party.id === "anthropic")?.probe?.test.headers).toEqual({ "anthropic-version": "2023-06-01" });
    // Higgsfield's key is presented as `Key <id>:<secret>`, and proven by a
    // read that spends nothing: a request nobody made is 404 to a valid key.
    // BO_0319_025
    const higgsfield = roster.find((party) => party.id === "higgsfield")?.probe;
    expect(higgsfield?.authorization).toEqual({ header: "Authorization", scheme: "Key", secretField: "apiKey" });
    expect(higgsfield?.test).toMatchObject({ method: "GET", expectStatus: 404 });
  });
});

describe("a subscription runtime on a device", () => {
  it("Given Codex or Claude Code, Then the row is unavailable, says why, and names the key that stands in for it", () => {
    const codex = onDevice(statusRow("codex"));
    expect(codex.unavailable).toEqual({
      reason: "Subscriptions are signed in on a Calliopa instance. This app uses an API key instead.",
      instead: "openai",
    });
    expect(codex.state).toBe("unconfigured");
    expect(codex.status).toBeNull();
    expect(codex.lastError).toBeNull();
    expect(codex.signOutBlocked).toBeNull();
    expect(onDevice(statusRow("claude-code")).unavailable?.instead).toBe("anthropic");
  });

  it("Given any other party, Then the row is as it was", () => {
    const evaluation = { ...statusRow("evaluation"), kind: "apiKey" as const };
    expect(onDevice(evaluation)).toBe(evaluation);
  });
});
