import { describe, expect, it } from "vitest";

import {
  serviceSave,
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

describe("what the agent still needs when Hermes reasons", () => {
  const onHermes = (over: Partial<AgentStatus> = {}): AgentStatus => ({ ...stamped, runtime: "hermes", ...over });

  it("Given Hermes on the subscription and Codex signed in, Then nothing is needed: it reasons on Codex's sign-in", () => {
    expect(keys([hermes(onHermes({ hermesModel: "subscription" })), status("codex", true), memory(true)])).toEqual([]);
  });

  it("Given Hermes on the subscription and Codex signed out, Then Codex's sign-in is what is needed", () => {
    const needs = agentNeeds([hermes(onHermes()), status("codex", false), memory(true)]);
    expect(needs.map((need) => need.key)).toEqual(["signIn"]);
    expect(needs[0]?.text).toContain("Codex");
  });

  it("Given Hermes on the API-key model, Then it needs the model configured and no sign-in", () => {
    const on = onHermes({ hermesModel: "provider" });
    expect(agentNeeds([hermes(on), status("codex", false), memory(true)])).toEqual([
      { key: "runtime", text: "Hermes is set to the API-key model, and none is configured.", blocking: true },
    ]);
    expect(keys([{ ...hermes(on), apiKeyModel: true }, status("codex", false), memory(true)])).toEqual([]);
  });
});

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

  it("Given a service that declares a field, Then it takes that field and nothing else", () => {
    const evaluation = {
      id: "evaluation",
      kind: "service" as const,
      fields: [{ key: "retention", label: "Data retention", hint: "require or allow" }],
      fixed: { address: "https://ai-gateway.vercel.sh/v1" },
    };
    // A service takes what it declares: the key it fixes and the field it asks
    // the owner for. Its row draws the field as a channel's does. BO_0280_008
    expect(
      configurationRefusal(evaluation, { address: "https://ai-gateway.vercel.sh/v1", retention: "require" }),
    ).toBeNull();
    // A field it declares is required once declared, so a row cannot be saved
    // half-answered.
    expect(configurationRefusal(evaluation, { address: "https://ai-gateway.vercel.sh/v1" })).toBe(
      "Data retention is required.",
    );
    expect(
      configurationRefusal(evaluation, { address: "https://ai-gateway.vercel.sh/v1", retention: "  " }),
    ).toBe("Data retention is required.");
    // Anything it neither fixes nor declares is still nothing it takes.
    expect(
      configurationRefusal(evaluation, { address: "x", retention: "allow", library: "512345" }),
    ).toBe("evaluation takes no configuration.");
  });

  it("Given a service that fixes its own address, When that address is in the record, Then it is accepted", () => {
    const evaluation = {
      id: "calliopa-refine-evaluation",
      kind: "service" as const,
      fields: [],
      fixed: { address: "https://ai-gateway.vercel.sh/v1" },
    };
    // Written with the record by the save, never typed: the kernel's broker
    // refuses a party with no configured address, so refusing it here left a
    // service that could hold a credential and never be used with it.
    expect(
      configurationRefusal(evaluation, {
        address: "https://ai-gateway.vercel.sh/v1",
      }),
    ).toBeNull();
    expect(configurationRefusal(evaluation, {})).toBeNull();
    // Anything it does not fix is still nothing a service takes.
    expect(
      configurationRefusal(evaluation, {
        address: "https://ai-gateway.vercel.sh/v1",
        library: "512345",
      }),
    ).toBe("calliopa-refine-evaluation takes no configuration.");
  });
});

describe("What a service row's Save would write", () => {
  const fields = [{ key: "retention", label: "Data retention", hint: "require or allow" }];
  const stored = { address: "https://ai-gateway.vercel.sh/v1", retention: "require" };

  it("Given nothing typed anywhere, Then there is nothing to save", () => {
    expect(serviceSave("", fields, {}, stored)).toBeNull();
    expect(serviceSave("   ", fields, {}, stored)).toBeNull();
    // A party with no fields and no key typed has nothing either.
    expect(serviceSave("", [], {}, {})).toBeNull();
  });

  it("Given a field changed and no key typed, Then the field is saved and the key is left alone", () => {
    const save = serviceSave("", fields, { retention: "allow" }, stored);
    // An empty key box is a person who did not touch it. Sending it would have
    // cleared the credential of anyone who came to change a field.
    expect(save).toEqual({ configuration: { retention: "allow" } });
    expect(save && "secret" in save).toBe(false);
  });

  it("Given a key typed, Then it is saved with the configuration as it stands", () => {
    expect(serviceSave("sk-new", fields, {}, stored)).toEqual({
      secret: "sk-new",
      configuration: { retention: "require" },
    });
    expect(serviceSave("sk-new", fields, { retention: "allow" }, stored)).toEqual({
      secret: "sk-new",
      configuration: { retention: "allow" },
    });
  });

  it("Given a party that declares no fields, Then only the key is written", () => {
    expect(serviceSave("sk-new", [], {}, {})).toEqual({ secret: "sk-new" });
  });

  it("Given a field typed back to what it already was, Then nothing was changed", () => {
    expect(serviceSave("", fields, { retention: "require" }, stored)).toBeNull();
  });
});
