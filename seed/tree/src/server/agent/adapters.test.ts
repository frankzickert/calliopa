import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { agentStatus, chooseAgent, chosenAgent, selectableRuntimes } from "./adapters";

/**
 * What the command area may offer.
 *
 * Three agents, each judged by what it needs to run. Codex needs only to be
 * signed in. Claude Code runs as itself behind the Claude runner, so it needs
 * to be signed in and the runner to answer — never a controller model. Hermes
 * needs what its model needs: the ChatGPT subscription needs Codex signed in,
 * the API-key model needs one configured. BO_0225_004 BO_0228_009
 */
describe("the runtimes a command may be given to", () => {
  const previous = process.env["CALLIOPA_AGENT_CONFIG_DIR"];

  afterEach(() => {
    if (previous === undefined) delete process.env["CALLIOPA_AGENT_CONFIG_DIR"];
    else process.env["CALLIOPA_AGENT_CONFIG_DIR"] = previous;
  });

  const configured = async (files: Record<string, string>): Promise<void> => {
    const dir = await mkdtemp(join(tmpdir(), "agent-config-"));
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(dir, name), content);
    }
    process.env["CALLIOPA_AGENT_CONFIG_DIR"] = dir;
  };

  const signedIn = JSON.stringify({
    codex: { installed: true, version: "codex-cli 0.151.0", authenticated: true, billing: "subscription" },
    "claude-code": { installed: true, version: "2.1.251", authenticated: true, billing: "subscription" },
  });

  it("Given both subscriptions signed in and no model, Then all three agents can be chosen", async () => {
    await configured({ "adapters.json": signedIn });

    const runtimes = await selectableRuntimes("ok");

    expect(runtimes.map((runtime) => [runtime.id, runtime.selectable, runtime.reason])).toEqual([
      ["codex", true, null],
      ["claude-code", true, null],
      ["hermes", true, null],
    ]);
  });

  it("Given a runner that is not answering, Then Claude Code says so and the others are unaffected", async () => {
    await configured({ "adapters.json": signedIn });

    const runtimes = await selectableRuntimes("unreachable: connection refused");

    expect(runtimes.map((runtime) => runtime.selectable)).toEqual([true, false, true]);
    expect(runtimes[1]?.reason).toBe("The Claude runner in the agent container is not answering.");
    // A kernel that said nothing about a runner is not read as a runner that is down.
    expect((await selectableRuntimes(null))[1]?.selectable).toBe(true);
  });

  it("Given Codex signed out, Then Hermes on the subscription cannot run either, and says why", async () => {
    await configured({
      "adapters.json": JSON.stringify({
        codex: { installed: true, version: "", authenticated: false, billing: "" },
      }),
    });

    const runtimes = await selectableRuntimes("ok");

    expect(runtimes[0]).toMatchObject({ id: "codex", selectable: false });
    expect(runtimes[0]?.reason).toContain("not signed in");
    expect(runtimes[1]?.reason).toContain("not installed");
    expect(runtimes[2]?.reason).toBe("Hermes reasons on the ChatGPT subscription, and Codex is not signed in.");
  });

  it("Given Hermes set to the API-key model, Then it needs one configured and its label names the model", async () => {
    const stamp = JSON.stringify({
      runtime: "codex",
      hermesModel: "provider",
      hermesModelName: "anthropic/claude-sonnet-5",
      kernelCredential: true,
      kernelToolset: true,
    });
    await configured({ "adapters.json": signedIn, "active-runtime.json": stamp });
    const without = await selectableRuntimes("ok");
    expect(without[2]).toMatchObject({
      id: "hermes",
      label: "Hermes · anthropic/claude-sonnet-5",
      selectable: false,
      reason: "Hermes is set to the API-key model, and none is configured.",
    });

    await configured({
      "adapters.json": signedIn,
      "active-runtime.json": stamp,
      "provider.env": "CALLIOPA_AGENT_MODEL=anthropic/claude-sonnet-5\n",
    });
    expect((await selectableRuntimes("ok"))[2]).toMatchObject({ selectable: true, reason: null });
  });

  it("Given a choice, Then it is remembered for the instance, and a file naming no agent reads as none", async () => {
    await configured({});
    expect(await chosenAgent()).toBeNull();

    await chooseAgent("claude-code");
    expect(await chosenAgent()).toBe("claude-code");
    const dir = process.env["CALLIOPA_AGENT_CONFIG_DIR"] ?? "";
    expect(JSON.parse(await readFile(join(dir, "agent-choice.json"), "utf8"))).toMatchObject({ agent: "claude-code" });

    await writeFile(join(dir, "agent-choice.json"), JSON.stringify({ agent: "provider" }));
    expect(await chosenAgent()).toBeNull();
    await writeFile(join(dir, "agent-choice.json"), "{not json");
    expect(await chosenAgent()).toBeNull();
  });

  it("Given a stamp that fell back, Then the choice and the reason are read back with it", async () => {
    await configured({
      "adapters.json": signedIn,
      "active-runtime.json": JSON.stringify({
        runtime: "codex",
        selected: "provider",
        reason: "the provider runtime names no model, so it accepts no run",
        kernelCredential: true,
        kernelToolset: true,
      }),
    });

    expect(await agentStatus()).toEqual({
      runtime: "codex",
      credential: true,
      toolset: true,
      selected: "provider",
      reason: "the provider runtime names no model, so it accepts no run",
    });
  });

  it("Given a stamp from before the fallback existed, Then absence means the two agree", async () => {
    await configured({
      "adapters.json": signedIn,
      "active-runtime.json": JSON.stringify({
        runtime: "codex",
        kernelCredential: true,
        kernelToolset: true,
      }),
    });

    const stamped = await agentStatus();

    expect(stamped).toEqual({ runtime: "codex", credential: true, toolset: true });
    expect(stamped && "selected" in stamped).toBe(false);
  });
});
