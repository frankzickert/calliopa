import { describe, expect, it } from "vitest";

import type {
  AgentStatus,
  ConnectionRecord,
  RuntimeStatus,
} from "~/lib/connections";
import { withStatus } from "./connections";

/**
 * What a status row says is not stored, so it is composed on read from what the
 * agent reports. That composition is the whole behaviour here: the row in the
 * database carries no state worth asserting, and the agent that would report
 * one lives in another container.
 */

const row = (party: string): ConnectionRecord => ({
  party: party as ConnectionRecord["party"],
  kind: "status",
  state: "unconfigured",
  keySet: false,
  secretSuffix: null,
  configuration: {},
  lastTestedAt: null,
  lastError: null,
  status: null,
  agent: null,
});

const signedIn: RuntimeStatus = {
  installed: true,
  version: "codex-cli 0.151.0",
  authenticated: true,
  billing: "subscription",
};

const stamp = (over: Partial<AgentStatus> = {}): AgentStatus => ({
  runtime: "codex",
  credential: true,
  toolset: true,
  ...over,
});

describe("the agent's row", () => {
  it("Given the agent has stamped nothing, Then the row says it is not running", () => {
    const record = withStatus(row("hermes"), {}, null);

    expect(record.state).toBe("unconfigured");
    expect(record.lastError).toBe("The agent is not running.");
    expect(record.agent).toBeNull();
  });

  it("Given the reasoning runtime is signed in and the toolset registered, Then the row is verified and carries what the agent stamped", () => {
    const record = withStatus(row("hermes"), { codex: signedIn }, stamp());

    expect(record.state).toBe("verified");
    expect(record.lastError).toBeNull();
    expect(record.agent).toEqual(stamp());
  });

  it("Given no credential was ever issued, Then the row is unconfigured rather than failing", () => {
    const record = withStatus(
      row("hermes"),
      { codex: signedIn },
      stamp({ credential: false, toolset: false }),
    );

    // Nothing failed: the human has not issued a credential yet, and that is
    // what they must be told rather than that something broke.
    expect(record.state).toBe("unconfigured");
    expect(record.lastError).toBeNull();
    expect(record.agent?.credential).toBe(false);
  });

  it("Given a credential is held but the toolset was not registered, Then the row is failing and says so", () => {
    const record = withStatus(
      row("hermes"),
      { codex: signedIn },
      stamp({ toolset: false }),
    );

    expect(record.state).toBe("failing");
    expect(record.lastError).toContain("toolset was not registered");
  });

  it("Given the runtime that reasons is not signed in, Then the row is unconfigured however complete the rest is", () => {
    const record = withStatus(
      row("hermes"),
      { codex: { ...signedIn, authenticated: false } },
      stamp(),
    );

    expect(record.state).toBe("unconfigured");
  });

  it("Given the agent reasons on a runtime nothing reported, Then the row is unconfigured", () => {
    const record = withStatus(
      row("hermes"),
      { codex: signedIn },
      stamp({ runtime: "provider" }),
    );

    expect(record.state).toBe("unconfigured");
    expect(record.agent?.runtime).toBe("provider");
  });

  it("Given a runtime row, Then it still reads from its own report and carries no agent stamp", () => {
    const record = withStatus(row("codex"), { codex: signedIn }, stamp());

    expect(record.state).toBe("verified");
    expect(record.status).toEqual(signedIn);
    expect(record.agent).toBeNull();
  });
});
