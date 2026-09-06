import type postgres from "postgres";

import { db } from "../db";
import {
  readAgentRunEvents,
  startAgentRun,
  stopAgentRun,
  type AgentReply,
} from "./hermes";
import { readSseFrames, runStarted, type RunEvent } from "./run-events";
import {
  activeRunFor,
  moveRun,
  readRun,
  recordAgentRunId,
  startRun,
  type AgentRun,
} from "./runs";

/**
 * The name the agent's own API client is issued under.
 *
 * The agent is identified by name rather than by being the only propose-only
 * client, because it is not: an import, a bulk transform, or a test may hold
 * one too, and "the single proposer" stops being a description the moment a
 * second one exists. A name is something an operator can be told and a
 * refusal can quote.
 */
export const AGENT_CLIENT_NAME = "hermes";

/**
 * The client a run belongs to.
 *
 * It must be the same identity the agent presents to the tool surface: the
 * tool server finds a staging call's run by the caller's client, so a run
 * opened under any other identity would be invisible to the very calls it
 * exists to attribute.
 */
export async function agentClientId(
  sql: postgres.Sql = db(),
): Promise<AgentReply<string>> {
  const [row] = await sql<{ id: string }[]>`
    select id from api_client
    where name = ${AGENT_CLIENT_NAME}
      and identity_class = 'proposer'
      and state = 'active'
  `;
  return row === undefined
    ? {
        ok: false,
        detail: `No agent client is issued. Run \`pnpm run client issue ${AGENT_CLIENT_NAME} --proposer\`.`,
      }
    : { ok: true, value: row.id };
}

export type ConductedRun =
  | { readonly ok: true; readonly run: AgentRun }
  | { readonly ok: false; readonly reason: "busy"; readonly detail: string }
  /** No agent client is issued, or more than one is. Answered before a run is
   * opened, because there is no identity to open it under. */
  | { readonly ok: false; readonly reason: "agent"; readonly detail: string };

/**
 * How long ago the run holding the slot was raised, in words.
 *
 * A refused reader needs to know whether the run is minutes or hours old, not
 * to the second: the age is what tells a run still being worked on apart from
 * one that has been standing since before the reader sat down.
 */
export function ageInWords(startedAt: Date, now: number = Date.now()): string {
  const minutes = Math.floor((now - startedAt.getTime()) / 60_000);
  if (minutes < 1) {
    return "less than a minute ago";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * What a refused goal is told about the run that holds the slot.
 *
 * The slot is instance-wide, so this is the only thing a reader outside the
 * run's own workspace ever sees of it: the console lists the run and offers
 * `Cancel` in the workspace it belongs to and nowhere else. Saying the agent is
 * working says nothing about where, about what, or about since when, which is
 * everything the reader needs to decide whether to wait or to go and stop it.
 *
 * The run's id is the handle `POST /api/runs/:id/cancel` takes. The workspace
 * is not named because a workspace record has no name to say, so the refusal
 * says whether the holder is this one or another rather than quoting a uuid
 * nobody recognises.
 */
export function busyRefusal(
  holder: AgentRun | null,
  workspaceId: string,
  now: number = Date.now(),
): string {
  if (holder === null) {
    return "The agent took another goal a moment ago. Try again.";
  }
  const where =
    holder.workspaceId === workspaceId ? "this workspace" : "another workspace";
  return `The agent is running '${holder.goal}' in ${where}, started ${ageInWords(
    holder.startedAt,
    now,
  )}. Run ${holder.id}.`;
}

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

async function recordEvent(
  sql: postgres.Sql,
  runId: string,
  event: RunEvent,
): Promise<void> {
  await sql`
    insert into agent_run_event (run_id, kind, payload)
    values (${runId}, ${event.kind}, ${sql.json(event)})
  `;
}

/**
 * Opens a run for a goal and hands it to the agent.
 *
 * The run record exists before the agent is asked, so a goal that the agent
 * refuses still leaves something the reader can see failing rather than a
 * button that did nothing. An agent that is unreachable or unconfigured fails
 * the run with what came back: a missing subscription is a state to report, not
 * an error to swallow.
 */
export async function conductRun(
  input: {
    readonly workspaceId: string;
    readonly goal: string;
    readonly runtime?: string;
  },
  sql: postgres.Sql = db(),
): Promise<ConductedRun> {
  const client = await agentClientId(sql);
  if (!client.ok) {
    return { ok: false, reason: "agent", detail: client.detail };
  }

  const opened = await startRun(sql, {
    workspaceId: input.workspaceId,
    clientId: client.value,
    goal: input.goal,
    runtime: input.runtime ?? "codex",
  });
  if (!opened.ok) {
    return {
      ok: false,
      reason: "busy",
      detail: busyRefusal(opened.holder, input.workspaceId),
    };
  }

  const run = opened.run;
  await recordEvent(sql, run.id, runStarted(run.id));
  return { ok: true, run };
}

/**
 * Hands an open run's goal to the agent and follows it to the end.
 *
 * This is deliberately not part of opening the run. An agent that is
 * unreachable takes as long as a network timeout to say so, and a reader who
 * pressed `Run` should not wait on that to learn their run exists: the run is
 * reported the moment it opens, and whatever the agent then does with it
 * arrives through the registry like any other progress.
 */
export async function driveRun(
  runId: string,
  goal: string,
  sql: postgres.Sql = db(),
): Promise<void> {
  const accepted = await startAgentRun(goal);
  if (!accepted.ok) {
    // The refusal is an event as well as a state, so the console reads back why
    // the run ended rather than only that it did.
    await recordEvent(sql, runId, {
      kind: "runFailed",
      runId,
      at: Date.now(),
      error: accepted.detail,
    });
    await moveRun(sql, runId, "failed", { error: accepted.detail });
    return;
  }

  await recordAgentRunId(sql, runId, accepted.value);
  await moveRun(sql, runId, "running", { step: "Started" });
  await followRun(runId, sql);
}

/**
 * Follows a run to its end: reads the agent's stream, records every event the
 * contract recognises, keeps the process step current, and moves the run when
 * a terminal event arrives.
 *
 * An event the contract does not recognise is recorded as nothing and does not
 * end the run — the translator already reports it — but a stream that ends with
 * no terminal event fails the run rather than leaving it running forever.
 */
export async function followRun(
  runId: string,
  sql: postgres.Sql = db(),
  read: (agentRunId: string) => Promise<AgentReply<string>> = readAgentRunEvents,
): Promise<void> {
  const run = await readRun(runId, sql);
  if (run === null || run.agentRunId === null) {
    return;
  }

  const stream = await read(run.agentRunId);
  if (!stream.ok) {
    await moveRun(sql, runId, "failed", { error: stream.detail });
    return;
  }

  let ended = false;
  for (const translated of readSseFrames(stream.value)) {
    if (!translated.ok) {
      continue;
    }
    const event = translated.event;
    await recordEvent(sql, runId, event);

    if (event.kind === "runCompleted") {
      await moveRun(sql, runId, "completed", { step: "Done" });
      ended = true;
    } else if (event.kind === "runFailed") {
      await moveRun(sql, runId, "failed", { error: event.error });
      ended = true;
    } else if (event.kind === "runCancelled") {
      await moveRun(sql, runId, "cancelled", { step: "Cancelled" });
      ended = true;
    } else {
      await moveRun(sql, runId, "running", { step: stepFor(event) });
    }
  }

  if (!ended) {
    await moveRun(sql, runId, "failed", {
      error: "The agent's stream ended without saying how the run finished.",
    });
  }
}

/**
 * Cancels a run. The agent is asked to stop, and the registry is moved either
 * way: a reader who pressed cancel must not be left watching a run that the
 * agent never answered about.
 */
export async function cancelRun(
  runId: string,
  sql: postgres.Sql = db(),
): Promise<AgentRun | null> {
  const run = await readRun(runId, sql);
  if (run === null) {
    return null;
  }
  if (run.agentRunId !== null) {
    await stopAgentRun(run.agentRunId);
  }
  return moveRun(sql, runId, "cancelled", { step: "Cancelled" });
}

/** The events recorded for a run, oldest first, as the console reads them. */
export async function runEvents(
  runId: string,
  sql: postgres.Sql = db(),
): Promise<readonly RunEvent[]> {
  const rows = await sql<{ payload: RunEvent }[]>`
    select payload from agent_run_event where run_id = ${runId} order by id
  `;
  return rows.map((row) => row.payload);
}

export { activeRunFor };
