import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

import type { AgentStatus, RuntimeStatus } from "~/lib/connections";

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
  };
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
