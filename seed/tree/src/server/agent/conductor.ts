import type { CommandTarget } from "~/lib/command-target";
import type { ProcessRecord } from "~/lib/process";
import { agentStatus } from "./adapters";
import { attachRun, createProcess, listAllProcesses, moveProcess, readProcess } from "../processes";
import {
  cancelBridgeRun,
  followBridgeEvents,
  readBridgeRun,
  startBridgeRun,
} from "./bridge";
import type { RunEvent } from "./run-events";

/**
 * Conducting a run through the kernel's agent bridge. `BO_0207_015`
 *
 * The shell used to open a run of its own, hand the goal to Hermes itself and
 * translate Hermes's stream; the run table, the client record and the shell's
 * MCP surface went with it. Now a run is the bridge's: the kernel binds the
 * agent principal, the pin and the run's proposal group, hands the goal to
 * Hermes with the kernel toolset, and streams normalized events. What the
 * shell keeps is the reader's view of it — the process the registry shows,
 * the events the console lists, and the cancel control — all of it read from
 * the bridge and never from a store of the shell's own.
 */

export type ConductedRun =
  | { readonly ok: true; readonly runId: string; readonly process: ProcessRecord }
  | { readonly ok: false; readonly reason: "busy"; readonly detail: string }
  /** The kernel refused the request for what it said — a target it cannot
   * mean, a goal it cannot take. The reader's to correct, not the agent's
   * failure, so it is not reported as one. BO_0226_004 */
  | { readonly ok: false; readonly reason: "refused"; readonly detail: string }
  /** The kernel refused or could not reach the agent. Answered before a
   * process is opened, because there is nothing to report. */
  | { readonly ok: false; readonly reason: "agent"; readonly detail: string };

/** The step a reader sees while a run is between events. */
const stepFor = (event: RunEvent): string => {
  switch (event.kind) {
    case "runStarted":
      return "Started";
    case "assistantDelta":
      return "Writing";
    case "toolStarted":
      return `Using ${event.tool}`;
    case "toolCompleted":
      return `${event.failed ? "Failed" : "Finished"} ${event.tool}`;
    default:
      return "Finishing";
  }
};

/**
 * Opens a run for a goal: the bridge takes the goal first, so a goal it
 * refuses — busy, no agent configured, unreachable — leaves nothing behind,
 * and a goal it takes gets the process the reader sees it through.
 */
export async function conductRun(input: {
  readonly workspaceId: string;
  readonly goal: string;
  readonly agent?: string;
  /** What the command was aimed at, or null for a command aimed at nothing. */
  readonly target?: CommandTarget | null;
}): Promise<ConductedRun> {
  // The runtime is the reader's explicit choice or the one the agent
  // stamped as active; the bridge reads an empty selection as the API-key
  // provider, which this instance ships unconfigured, and a content run
  // must go to the runtime that is signed in.
  const agent = input.agent ?? (await agentStatus())?.runtime ?? "codex";
  const started = await startBridgeRun({
    goal: input.goal,
    context: `raised from workspace ${input.workspaceId}`,
    agent,
    target: input.target ?? null,
  });
  if (!started.ok) {
    return {
      ok: false,
      reason: started.status === 409 ? "busy" : started.status === 400 ? "refused" : "agent",
      detail: started.detail,
    };
  }
  const process = await createProcess(input.workspaceId, {
    title: input.goal,
    step: "Started",
  });
  const attached = await attachRun(process.id, started.value.id);
  return { ok: true, runId: started.value.id, process: attached ?? process };
}

/**
 * Follows a run to its end through the bridge's stream and keeps the process
 * current: the step while it works, the terminal state when it ends. A
 * stream that ends with no terminal event fails the process rather than
 * leaving it running forever.
 */
export async function followRun(processId: string, runId: string): Promise<void> {
  await moveProcess(processId, { state: "running", step: "Started", error: null });
  let ended = false;
  const followed = await followBridgeEvents(runId, async (event) => {
    if (event.kind === "runCompleted") {
      ended = true;
      await moveProcess(processId, { state: "completed", step: "Done", error: null });
    } else if (event.kind === "runFailed") {
      ended = true;
      await moveProcess(processId, { state: "failed", step: null, error: event.error });
    } else if (event.kind === "runCancelled") {
      ended = true;
      await moveProcess(processId, { state: "cancelled", step: "Cancelled", error: null });
    } else if (!ended) {
      await moveProcess(processId, { state: "running", step: stepFor(event), error: null });
    }
  });
  if (!followed.ok) {
    await moveProcess(processId, { state: "failed", step: null, error: followed.detail });
    return;
  }
  if (!ended) {
    // The stream closed without a terminal event: the bridge's own record
    // says what became of the run, and that is what the process reports.
    const run = await readBridgeRun(runId);
    const status = run.ok ? run.value.status : "";
    if (status === "completed") {
      await moveProcess(processId, { state: "completed", step: "Done", error: null });
    } else if (status === "cancelled") {
      await moveProcess(processId, { state: "cancelled", step: "Cancelled", error: null });
    } else {
      await moveProcess(processId, {
        state: "failed",
        step: null,
        error: "The agent's stream ended without saying how the run finished.",
      });
    }
  }
}

/**
 * Cancels a run. The bridge is asked to stop it, and the process is moved
 * either way: a reader who pressed cancel must not be left watching a run
 * that nothing answered about.
 */
export async function cancelRun(runId: string): Promise<{ readonly runId: string } | null> {
  const run = await readBridgeRun(runId);
  if (!run.ok) return null;
  await cancelBridgeRun(runId);
  const process = await processForRun(runId);
  if (process !== null) {
    await moveProcess(process.id, { state: "cancelled", step: "Cancelled", error: null });
  }
  return { runId };
}

/**
 * The events recorded for a run, oldest first, as the console reads them. The
 * bridge answers its buffered history first, which is what a poll wants; it
 * leaves as soon as the stream goes quiet.
 */
export async function runEvents(runId: string): Promise<readonly RunEvent[]> {
  const events: RunEvent[] = [];
  await followBridgeEvents(runId, (event) => {
    events.push(event);
  }, { idleMs: 400 });
  return events;
}

/** The run a process reports, or null when the process is not a run. */
export async function runForProcess(processId: string): Promise<string | null> {
  try {
    const process = await readProcess(processId);
    return process.runId ?? null;
  } catch {
    return null;
  }
}

async function processForRun(runId: string): Promise<ProcessRecord | null> {
  // A run knows its process only through the process naming the run; the
  // console cancels from the process it shows, so the lookup is rare.
  const all = await listAllProcesses();
  return all.find((process) => process.runId === runId) ?? null;
}
