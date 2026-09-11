import { access, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

import {
  isAgentId,
  type AgentId,
  type AgentStatus,
  type RuntimeStatus,
  type SelectableRuntime,
} from "~/lib/connections";

/**
 * What the agent container reports about itself, and how a sign-in is asked
 * for. The frame's own module, because the run surface reads the agent's
 * stamp to default a run's runtime; the settings extension reads it too for
 * its rows and its sign-in flow, which is the direction a dependency may run
 * (`BO_0202_002`, moved from the settings extension).
 *
 * The application and the agent talk through files on a shared volume rather
 * than over HTTP, because the thing that runs the sign-in flows is a broker
 * beside the gateway rather than the gateway itself, and because the
 * application deliberately holds no control over the Docker daemon: it can ask
 * the agent for a login, and it cannot restart it.
 */

/**
 * Where the agent and the application meet. It is read when it is read rather
 * than when this module loads, so a test can point at a directory of its own
 * and prove what an instance reports without depending on what the machine's
 * own agent happens to have written.
 */
const configDir = () =>
  process.env.CALLIOPA_AGENT_CONFIG_DIR ?? "/var/lib/calliopa/agent-config";
const loginDir = () => join(configDir(), "login");

export type LoginRuntime = "codex" | "claude-code";

export interface LoginState {
  readonly runtime: string;
  readonly status: "running" | "succeeded" | "failed";
  /** Where the human signs in. Shown because it is what they must visit. */
  readonly url?: string;
  /** The one-time device code. Shown because it is what they must type. */
  readonly userCode?: string;
  readonly awaiting?: string | null;
  readonly output?: string;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * What each runtime is, as the agent's probe last answered.
 *
 * An absent report is not an error: the agent may not have started yet, and a
 * settings surface that refused to render because of that would be less useful
 * than one that says the runtime is unconfigured, which it is.
 */
export async function runtimeStatuses(): Promise<
  Record<string, RuntimeStatus>
> {
  const answered = await readJson<Record<string, RuntimeStatus>>(
    join(configDir(), "adapters.json"),
  );
  return answered ?? {};
}

/**
 * What the agent stamped about the start it is running.
 *
 * The tools credential is passed to the agent service alone, so the
 * application cannot see whether the agent holds one and has to be told. A
 * field the stamp does not carry reads as false: a start that said nothing
 * about its toolset did not report one registered. CA_0026_001
 */
export async function agentStatus(): Promise<AgentStatus | null> {
  const stamped = await readJson<Partial<AgentStatus>>(
    join(configDir(), "active-runtime.json"),
  );
  if (stamped === null || typeof stamped.runtime !== "string") return null;
  // The kernel toolset is the agent's one toolset (BO_0207_015); the stamp
  // names it apart from the shell's retired one, which older stamps may still
  // carry.
  const stamp = stamped as Partial<AgentStatus> & { kernelCredential?: boolean; kernelToolset?: boolean };
  return {
    runtime: stamped.runtime,
    credential: stamp.kernelCredential === true || stamped.credential === true,
    toolset: stamp.kernelToolset === true || stamped.toolset === true,
    // A stamp older than BO_0225 carries neither, and a stamp whose selection
    // was configurable carries no reason: absence means the two agree.
    ...(typeof stamped.selected === "string" ? { selected: stamped.selected } : {}),
    ...(typeof stamped.reason === "string" ? { reason: stamped.reason } : {}),
    ...(stamped.hermesModel === "subscription" || stamped.hermesModel === "provider"
      ? { hermesModel: stamped.hermesModel }
      : {}),
    ...(typeof stamped.hermesModelName === "string" && stamped.hermesModelName !== ""
      ? { hermesModelName: stamped.hermesModelName }
      : {}),
  };
}

/**
 * Whether an API-key model is configured: the controller the CLI's `provider`
 * selection names, and what Hermes reasons with when it is set to the API-key
 * model. BO_0228_012
 */
export async function apiKeyModelConfigured(): Promise<boolean> {
  try {
    await access(join(configDir(), "provider.env"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the Claude runner answers, as the kernel's agent health reports it:
 * `ok`, the words of why not, or null when the kernel said nothing about it —
 * a kernel older than BO_0228, or one that could not be asked. BO_0228_009
 */
export type RunnerHealth = string | null;

/**
 * The agents the command area offers, and which of them can be chosen.
 *
 * Each is judged by what it needs to run, from the facts the agent container
 * and the kernel report. Codex needs only to be signed in. Claude Code runs as
 * itself behind the Claude runner, so it needs to be signed in and the runner
 * to answer — never a controller model, since nothing reasons for it. Hermes
 * needs what its model needs: the ChatGPT subscription needs Codex signed in,
 * and the API-key model needs one configured; its label names the model, so
 * the choice is never of an unnamed thing. BO_0225_004 BO_0228_009
 */
export async function selectableRuntimes(runner: RunnerHealth = null): Promise<readonly SelectableRuntime[]> {
  const [reported, model, stamped] = await Promise.all([
    runtimeStatuses(),
    apiKeyModelConfigured(),
    agentStatus(),
  ]);
  const signedIn = (id: string, label: string): string | null => {
    const status = reported[id] ?? null;
    if (status === null || !status.installed) return `${label} is not installed in the agent container.`;
    if (!status.authenticated) return `${label} is not signed in.`;
    return null;
  };
  const agent = (id: AgentId, label: string, reason: string | null): SelectableRuntime => ({
    id,
    label,
    selectable: reason === null,
    reason,
  });

  const claudeReason =
    signedIn("claude-code", "Claude Code") ??
    (runner === null || runner === "ok" ? null : "The Claude runner in the agent container is not answering.");

  const hermesModel = stamped?.hermesModel ?? "subscription";
  const hermesName = stamped?.hermesModelName;
  const hermesReason =
    hermesModel === "provider"
      ? model
        ? null
        : "Hermes is set to the API-key model, and none is configured."
      : signedIn("codex", "Codex") === null
        ? null
        : "Hermes reasons on the ChatGPT subscription, and Codex is not signed in.";

  return [
    agent("codex", "Codex", signedIn("codex", "Codex")),
    agent("claude-code", "Claude Code", claudeReason),
    agent("hermes", hermesName ? `Hermes · ${hermesName}` : "Hermes", hermesReason),
  ];
}

/**
 * The agent the composer last chose, for every device of the instance, or
 * null when nothing was chosen or the file names no agent. BO_0228_009
 */
export async function chosenAgent(): Promise<AgentId | null> {
  const choice = await readJson<{ agent?: unknown }>(join(configDir(), "agent-choice.json"));
  return isAgentId(choice?.agent) ? choice.agent : null;
}

/**
 * Remembers the composer's choice. Written whole and renamed into place, as
 * the login request is, so a reader never sees half of it; it restarts
 * nothing, since the gateway switches only when a command goes to an agent it
 * is not running. BO_0228_009
 */
export async function chooseAgent(agent: AgentId): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  const tmp = join(configDir(), "agent-choice.json.tmp");
  await writeFile(tmp, JSON.stringify({ agent, chosenAt: Date.now() }), { mode: 0o644 });
  await rename(tmp, join(configDir(), "agent-choice.json"));
}

/** Asks the agent's broker to run a runtime's own sign-in flow. */
export async function requestLogin(runtime: LoginRuntime): Promise<void> {
  await mkdir(loginDir(), { recursive: true });
  const tmp = join(loginDir(), "request.json.tmp");
  await writeFile(tmp, JSON.stringify({ runtime }), { mode: 0o600 });
  await rename(tmp, join(loginDir(), "request.json"));
}

/** How the sign-in in flight is going, or null when none is. */
export function loginState(): Promise<LoginState | null> {
  return readJson<LoginState>(join(loginDir(), "state.json"));
}

/**
 * Hands the broker the code a flow asked the human to paste back.
 *
 * It is written where the broker reads it and nowhere else: it is a one-time
 * code, and the state the surface renders never carries it back.
 */
export async function sendLoginCode(code: string): Promise<void> {
  await mkdir(loginDir(), { recursive: true });
  const tmp = join(loginDir(), "code.tmp");
  await writeFile(tmp, code, { mode: 0o600 });
  await rename(tmp, join(loginDir(), "code"));
}
