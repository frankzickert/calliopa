import { describe, expect, it } from "vitest";

import {
  bunnyLibraryUrl,
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

const status = (party: string, authenticated: boolean): ConnectionRecord => ({
  party: party as ConnectionRecord["party"],
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

  it("Given no credential was issued, Then the reader is told and given the command that issues one", () => {
    const needs = agentNeeds([
      hermes({ ...stamped, credential: false, toolset: false }),
      status("codex", true),
      memory(true),
    ]);

    expect(needs.map((need) => need.key)).toEqual(["credential"]);
    expect(needs[0]?.blocking).toBe(true);
    // The client name is what a run's owner is resolved by, so the command is
    // the literal one and not a description of it.
    expect(needs[0]?.command).toBe("pnpm run client issue hermes --proposer");
    expect(needs[0]?.text).toContain("CALLIOPA_AGENT_TOOLS_TOKEN");
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
describe("A channel's configuration", () => {
  it("Given a complete configuration, When it is checked, Then it is accepted", () => {
    expect(
      configurationRefusal("homepage", {
        address: "http://100.114.122.91:4460",
      }),
    ).toBeNull();
    expect(
      configurationRefusal("homepage", { address: "https://example.com" }),
    ).toBeNull();
  });

  it("Given a required field is missing or blank, When it is checked, Then it is refused by name", () => {
    expect(configurationRefusal("homepage", {})).toBe("Address is required.");
    expect(configurationRefusal("homepage", { address: "   " })).toBe(
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
        configurationRefusal("homepage", { address }),
        `${address} was accepted`,
      ).toBe("Address must be an http or https address.");
    }
  });

  it("Given a field the channel does not have, When it is checked, Then it is refused", () => {
    expect(
      configurationRefusal("homepage", {
        address: "https://example.com",
        token: "sneaky",
      }),
    ).toBe("homepage takes no token.");
  });

  it("Given a party that is not a channel, When configuration is offered, Then it is refused", () => {
    expect(configurationRefusal("honcho", {})).toBeNull();
    expect(
      configurationRefusal("honcho", { address: "https://example.com" }),
    ).toBe("honcho takes no configuration.");
  });
});

describe("The bunny channel's library", () => {
  it("Given a numeric library id, When it is checked, Then it is accepted", () => {
    expect(configurationRefusal("bunny", { libraryId: "512345" })).toBeNull();
  });

  it("Given no library, When it is checked, Then it is refused by name", () => {
    expect(configurationRefusal("bunny", {})).toBe("Library is required.");
    expect(configurationRefusal("bunny", { libraryId: "  " })).toBe(
      "Library is required.",
    );
  });

  it("Given a library name rather than its id, When it is checked, Then it is refused", () => {
    // Every call of the channel lives under the library's numeric id, so a
    // name entered here would make each of them reach an address that cannot
    // exist. It is refused where it is typed rather than at the first upload.
    for (const value of ["calliopa", "vz-12345", "12.5", "-1", "5 12345"]) {
      expect(
        configurationRefusal("bunny", { libraryId: value }),
      ).not.toBeNull();
    }
  });

  it("Given surrounding whitespace, When it is checked, Then it is trimmed rather than refused", () => {
    // The store trims what it saves, so refusing here would refuse a value
    // that would have been stored correctly.
    expect(configurationRefusal("bunny", { libraryId: " 512345 " })).toBeNull();
  });

  it("Given a field the channel does not take, When it is checked, Then it is refused", () => {
    expect(
      configurationRefusal("bunny", {
        libraryId: "512345",
        cdnHostname: "x.b-cdn.net",
      }),
    ).toBe("bunny takes no cdnHostname.");
  });

  it("Given a library id, Then every call of the channel lives under it", () => {
    expect(bunnyLibraryUrl("512345")).toBe(
      "https://video.bunnycdn.com/library/512345",
    );
  });
});
