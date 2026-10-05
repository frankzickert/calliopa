import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { agentStatus, chooseAgent, chosenAgent, loginState, requestLogin, requestLogout, selectableRuntimes } from "./adapters";

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

  it("Given both subscriptions signed in, Then Codex and Claude Code can be chosen, and Hermes is not offered", async () => {
    await configured({ "adapters.json": signedIn });

    const runtimes = await selectableRuntimes("ok");

    // Hermes prepares in the background and takes no command. BO_0350_021
    expect(runtimes.map((runtime) => [runtime.id, runtime.selectable, runtime.reason])).toEqual([
      ["codex", true, null],
      ["claude-code", true, null],
    ]);
  });

  it("Given a runner that is not answering, Then Claude Code says so and the others are unaffected", async () => {
    await configured({ "adapters.json": signedIn });

    const runtimes = await selectableRuntimes("unreachable: connection refused");

    expect(runtimes.map((runtime) => runtime.selectable)).toEqual([true, false]);
    expect(runtimes[1]?.reason).toBe("The Claude runner in the agent container is not answering.");
    // A kernel that said nothing about a runner is not read as a runner that is down.
    expect((await selectableRuntimes(null))[1]?.selectable).toBe(true);
  });

  it("Given Codex signed out, Then Codex says why and Claude Code is unaffected by it", async () => {
    await configured({
      "adapters.json": JSON.stringify({
        codex: { installed: true, version: "", authenticated: false, billing: "" },
      }),
    });

    const runtimes = await selectableRuntimes("ok");

    expect(runtimes[0]).toMatchObject({ id: "codex", selectable: false });
    expect(runtimes[0]?.reason).toContain("not signed in");
    expect(runtimes[1]?.reason).toContain("not installed");
    expect(runtimes).toHaveLength(2);
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
    // A choice of Hermes, stored before it stopped taking commands. BO_0350_021
    await writeFile(join(dir, "agent-choice.json"), JSON.stringify({ agent: "hermes" }));
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

/**
 * The sign-in a request started, and no other.
 *
 * Pressing Sign in again after a flow failed or timed out found that flow's
 * state still on the volume: the row read it as the new request's answer and
 * stopped following, while the broker started the new flow unseen. The broker
 * stamps every state with the id of the request that started its flow, so only
 * a state carrying the request's own id is followed. BO_0261_002
 */
describe("the sign-in a request started", () => {
  const previous = process.env["CALLIOPA_AGENT_CONFIG_DIR"];

  afterEach(() => {
    if (previous === undefined) delete process.env["CALLIOPA_AGENT_CONFIG_DIR"];
    else process.env["CALLIOPA_AGENT_CONFIG_DIR"] = previous;
  });

  const earlierFlow = async (state: Record<string, unknown>): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), "agent-config-"));
    await mkdir(join(dir, "login"));
    await writeFile(join(dir, "login", "state.json"), JSON.stringify(state));
    process.env["CALLIOPA_AGENT_CONFIG_DIR"] = dir;
    return dir;
  };

  const timedOut = {
    runtime: "claude-code",
    status: "failed",
    awaiting: null,
    output: "Paste code here if prompted >\nthe login timed out",
  };

  it("Given an earlier flow that timed out, When Sign in is pressed again, Then its failure is not the new request's answer", async () => {
    const dir = await earlierFlow(timedOut);

    const id = await requestLogin("claude-code");

    expect(JSON.parse(await readFile(join(dir, "login", "request.json"), "utf8"))).toEqual({
      runtime: "claude-code",
      id,
    });
    expect(await loginState(id)).toBeNull();
  });

  it("Given a flow still in flight under another request, Then neither its progress nor its supersession is the new request's", async () => {
    await earlierFlow({ ...timedOut, id: "earlier", status: "running", awaiting: "code", url: "https://claude.com/old" });
    const id = await requestLogin("claude-code");
    expect(await loginState(id)).toBeNull();

    await earlierFlow({ ...timedOut, id: "earlier", output: "superseded by a new request" });
    expect(await loginState(id)).toBeNull();
  });

  it("Given the broker has started the request's flow, Then that flow is answered", async () => {
    const dir = await earlierFlow(timedOut);
    const id = await requestLogin("claude-code");
    const started = { runtime: "claude-code", id, status: "running", awaiting: "code", url: "https://claude.com/new", output: "" };
    await writeFile(join(dir, "login", "state.json"), JSON.stringify(started));

    expect(await loginState(id)).toEqual(started);
    // Two requests never share an id.
    expect(await requestLogin("claude-code")).not.toBe(id);
  });
});

/**
 * A sign-out is asked for the way a sign-in is: a request the broker reads,
 * carrying an id its states are stamped with, and an action that makes it a
 * sign-out. BO_0316_006
 */
describe("the sign-out a request started", () => {
  const previous = process.env["CALLIOPA_AGENT_CONFIG_DIR"];

  afterEach(() => {
    if (previous === undefined) delete process.env["CALLIOPA_AGENT_CONFIG_DIR"];
    else process.env["CALLIOPA_AGENT_CONFIG_DIR"] = previous;
  });

  it("Given Sign out confirmed, Then the broker is asked to sign the runtime out under a new id, and only that sign-out is answered", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-config-"));
    await mkdir(join(dir, "login"), { recursive: true });
    const signedIn = { runtime: "codex", id: "earlier", status: "succeeded", awaiting: null, output: "" };
    await writeFile(join(dir, "login", "state.json"), JSON.stringify(signedIn));
    process.env["CALLIOPA_AGENT_CONFIG_DIR"] = dir;

    const id = await requestLogout("codex");

    expect(JSON.parse(await readFile(join(dir, "login", "request.json"), "utf8"))).toEqual({
      runtime: "codex",
      action: "logout",
      id,
    });
    // The sign-in that left its state is not the sign-out's answer.
    expect(await loginState(id)).toBeNull();

    const signedOut = { runtime: "codex", id, action: "logout", status: "succeeded", awaiting: null, output: "" };
    await writeFile(join(dir, "login", "state.json"), JSON.stringify(signedOut));
    expect(await loginState(id)).toEqual(signedOut);
    expect(await requestLogout("codex")).not.toBe(id);
  });
});
