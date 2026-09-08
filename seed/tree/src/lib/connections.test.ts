import { describe, expect, it } from "vitest";

import {
  agentNeeds,
  configurationRefusal,
  type AgentStatus,
  type ConnectionRecord,
} from "./connections";

/**
 * What the agent's row says is composed from the rows the surface already has,
 * so this is where the whole picture is proven: which of them block the agent,
 * which are fixed somewhere else, and which are named without stopping
 * anything.
 */

/** The presentational half of a descriptor, as the listing lays it on a record. BO_0202_008 */
const described = (party: string) => ({
  label: party.charAt(0).toUpperCase() + party.slice(1),
  purpose: `What ${party} is for`,
  channel: false,
  fields: [],
});

const status = (party: string, authenticated: boolean): ConnectionRecord => ({
  party,
  ...described(party),
  kind: "status",
  state: authenticated ? "verified" : "unconfigured",
  keySet: false,
  secretSuffix: null,
  configuration: {},
  lastTestedAt: null,
  lastError: null,
  status: {
    installed: true,
    version: "1.0.0",
    authenticated,
    billing: "subscription",
  },
  agent: null,
});

const memory = (keySet: boolean): ConnectionRecord => ({
  party: "honcho",
  ...described("honcho"),
  kind: "apiKey",
  state: keySet ? "configured" : "unconfigured",
  keySet,
  secretSuffix: keySet ? "abcd" : null,
  configuration: {},
  lastTestedAt: null,
  lastError: null,
  status: null,
  agent: null,
});

const hermes = (agent: AgentStatus | null): ConnectionRecord => ({
  ...status("hermes", false),
  status: null,
  agent,
});

const stamped: AgentStatus = {
  runtime: "codex",
  credential: true,
  toolset: true,
};

const keys = (rows: readonly ConnectionRecord[]) =>
  agentNeeds(rows).map((need) => need.key);

describe("what the agent still needs", () => {
  it("Given a signed-in runtime, a credential, a toolset and a memory key, Then nothing is needed", () => {
    expect(
      agentNeeds([hermes(stamped), status("codex", true), memory(true)]),
    ).toEqual([]);
  });

  it("Given the agent has stamped nothing, Then only that is said", () => {
    const needs = agentNeeds([hermes(null), status("codex", true)]);

    expect(needs).toHaveLength(1);
    expect(needs[0]?.key).toBe("running");
    expect(needs[0]?.text).toContain("not running");
  });

  it("Given the reasoning runtime is not signed in, Then it is named and pointed at its own row", () => {
    const needs = agentNeeds([
      hermes(stamped),
      status("codex", false),
      memory(true),
    ]);

    expect(needs.map((need) => need.key)).toEqual(["signIn"]);
    expect(needs[0]?.text).toContain("Codex");
    expect(needs[0]?.text).toContain("own row");
  });

  it("Given the agent holds no credential for the kernel's toolset, Then the reader is told it is the install's to have made", () => {
    const needs = agentNeeds([
      hermes({ ...stamped, credential: false, toolset: false }),
      status("codex", true),
      memory(true),
    ]);

    expect(needs.map((need) => need.key)).toEqual(["credential"]);
    expect(needs[0]?.blocking).toBe(true);
    // The kernel toolset's bearer is generated at install; there is no command
    // a reader types for it any more (BO_0207_015).
    expect(needs[0]?.command).toBeUndefined();
    expect(needs[0]?.text).toContain("bootstrap");
  });

  it("Given a need nothing can be typed for, Then it carries no command", () => {
    for (const need of agentNeeds([
      hermes({ ...stamped, toolset: false }),
      status("codex", false),
      memory(false),
    ])) {
      expect(need.command, need.key).toBeUndefined();
    }
  });

  it("Given a credential with no registration, Then the failure is said rather than a missing credential", () => {
    expect(
      keys([
        hermes({ ...stamped, toolset: false }),
        status("codex", true),
        memory(true),
      ]),
    ).toEqual(["toolset"]);
  });

  it("Given memory has no key, Then it is named without blocking", () => {
    const needs = agentNeeds([
      hermes(stamped),
      status("codex", true),
      memory(false),
    ]);

    expect(needs.map((need) => need.key)).toEqual(["memory"]);
    expect(needs[0]?.blocking).toBe(false);
  });

  it("Given several things are missing at once, Then all of them are said in one picture", () => {
    expect(
      keys([
        hermes({ runtime: "codex", credential: false, toolset: false }),
        status("codex", false),
        memory(false),
      ]),
    ).toEqual(["signIn", "credential", "memory"]);
  });

  it("Given the agent reasons on a runtime with no row, Then that is said rather than a sign-in nobody can do", () => {
    const needs = agentNeeds([
      hermes({ ...stamped, runtime: "provider" }),
      status("codex", true),
      memory(true),
    ]);

    expect(needs.map((need) => need.key)).toEqual(["runtime"]);
    expect(needs[0]?.text).toContain("provider");
  });
});

/**
 * What a channel needs beside its key. The address is refused where it is
 * parsed rather than later inside a request, so a row never says it is ready
 * while pointing at something that is not an address at all. CA_0036_002
 */
/** The descriptors `ui.shell` and `settings` contribute, as the registry holds them. */
const homepage = {
  id: "homepage",
  kind: "channel" as const,
  fields: [{ key: "address", label: "Address", hint: "", check: "address" as const }],
};
const honcho = { id: "honcho", kind: "service" as const, fields: [] };

describe("A channel's configuration", () => {
  it("Given a complete configuration, When it is checked, Then it is accepted", () => {
    expect(
      configurationRefusal(homepage, {
        address: "http://100.114.122.91:4460",
      }),
    ).toBeNull();
    expect(
      configurationRefusal(homepage, { address: "https://example.com" }),
    ).toBeNull();
  });

  it("Given a required field is missing or blank, When it is checked, Then it is refused by name", () => {
    expect(configurationRefusal(homepage, {})).toBe("Address is required.");
    expect(configurationRefusal(homepage, { address: "   " })).toBe(
      "Address is required.",
    );
  });

  it("Given something that is not an http address, When it is checked, Then it is refused", () => {
    for (const address of [
      "example.com",
      "ftp://example.com",
      "javascript:alert(1)",
      "/v1",
      "not an address",
    ]) {
      expect(
        configurationRefusal(homepage, { address }),
        `${address} was accepted`,
      ).toBe("Address must be an http or https address.");
    }
  });

  it("Given a field the channel does not have, When it is checked, Then it is refused", () => {
    expect(
      configurationRefusal(homepage, {
        address: "https://example.com",
        token: "sneaky",
      }),
    ).toBe("homepage takes no token.");
  });

  it("Given a party that is not a channel, When configuration is offered, Then it is refused", () => {
    expect(configurationRefusal(honcho, {})).toBeNull();
    expect(
      configurationRefusal(honcho, { address: "https://example.com" }),
    ).toBe("honcho takes no configuration.");
  });
});
