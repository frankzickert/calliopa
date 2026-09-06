import { appEnv } from "../env";

/**
 * The agent's HTTP surface, as this application reaches it.
 *
 * Everything Hermes-shaped stops here and at the event contract beside it. A
 * pin bump that moves a path or renames a field is a change to these two files
 * and to nothing that renders a console.
 */

export type AgentReply<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly detail: string };

function base(): string {
  return appEnv().hermes.url.replace(/\/+$/u, "");
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${appEnv().hermes.apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * A request to the agent, with the reason it failed rather than an exception.
 *
 * An agent that is unreachable, unconfigured, or refusing is an ordinary
 * outcome here: the human asked for something and deserves to be told what
 * came back. Nothing about a missing subscription should read as a bug in
 * Calliopa.
 */
async function ask(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<AgentReply<string>> {
  const abort = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(`${base()}${path}`, {
      ...init,
      headers: headers(),
      signal: abort,
    });
    const body = await response.text();
    return response.ok
      ? { ok: true, value: body }
      : { ok: false, detail: `The agent answered ${response.status}: ${body}` };
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "TimeoutError"
        ? "The agent did not answer in time."
        : `The agent could not be reached: ${
            error instanceof Error ? error.message : String(error)
          }`;
    return { ok: false, detail };
  }
}

/**
 * Hands a goal to the agent. The reply carries the agent's own run identifier,
 * which is what the events and the stop request are addressed to.
 */
export async function startAgentRun(
  goal: string,
): Promise<AgentReply<string>> {
  const reply = await ask(
    "/v1/runs",
    { method: "POST", body: JSON.stringify({ input: goal }) },
    30_000,
  );
  if (!reply.ok) return reply;

  try {
    const id = (JSON.parse(reply.value) as { run_id?: unknown }).run_id;
    return typeof id === "string" && id !== ""
      ? { ok: true, value: id }
      : { ok: false, detail: "The agent accepted the goal without naming a run." };
  } catch {
    return { ok: false, detail: "The agent's answer was not JSON." };
  }
}

/**
 * Reads the run's event stream to its end.
 *
 * The release closes the stream when the run finishes, so this returns the
 * whole of it rather than yielding: a run is followed by one caller, the
 * frames are small, and a generator would buy nothing but a lifetime to manage.
 */
export function readAgentRunEvents(
  agentRunId: string,
  timeoutMs = 600_000,
): Promise<AgentReply<string>> {
  return ask(`/v1/runs/${agentRunId}/events`, { method: "GET" }, timeoutMs);
}

/** Asks the agent to interrupt a run. */
export function stopAgentRun(agentRunId: string): Promise<AgentReply<string>> {
  return ask(`/v1/runs/${agentRunId}/stop`, { method: "POST" }, 15_000);
}
