import type postgres from "postgres";

import { db } from "../db";
import type { JSONValue } from "postgres";

/**
 * A run's lifecycle. `queued` and `running` are the states that hold the one
 * active slot; the other three are terminal and release it.
 */
export const RUN_STATES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunState = (typeof RUN_STATES)[number];

const ACTIVE: readonly RunState[] = ["queued", "running"];

export interface AgentRun {
  readonly id: string;
  readonly processId: string;
  readonly workspaceId: string;
  readonly clientId: string;
  readonly agentRunId: string | null;
  readonly goal: string;
  readonly runtime: string;
  readonly model: string | null;
  readonly baseDataRevision: string;
  readonly state: RunState;
  /** When the goal was raised. The busy refusal reports the run's age from it. */
  readonly startedAt: Date;
}

/**
 * What a run leaves on every group it stages. The graph already carries
 * provenance for an externally originated write, so this is what the group's
 * request field holds beside it: why the write exists, and against what.
 */
export interface RunProvenance extends Record<string, JSONValue> {
  readonly runId: string;
  readonly goal: string;
  readonly runtime: string;
  readonly model: string | null;
  readonly baseDataRevision: string;
}

export type StartOutcome =
  | { readonly ok: true; readonly run: AgentRun }
  /** The run that holds the slot, so the refusal can say what it is rather than
   * that the agent is busy. Null only if that run ended between the refusal and
   * the read. */
  | {
      readonly ok: false;
      readonly reason: "busy";
      readonly holder: AgentRun | null;
    };

interface Row {
  readonly id: string;
  readonly process_id: string;
  readonly workspace_id: string;
  readonly client_id: string;
  readonly agent_run_id: string | null;
  readonly goal: string;
  readonly runtime: string;
  readonly model: string | null;
  readonly base_data_revision: string;
  readonly state: RunState;
  readonly created_at: Date;
}

const toRun = (row: Row): AgentRun => ({
  id: row.id,
  processId: row.process_id,
  workspaceId: row.workspace_id,
  clientId: row.client_id,
  agentRunId: row.agent_run_id,
  goal: row.goal,
  runtime: row.runtime,
  model: row.model,
  baseDataRevision: String(row.base_data_revision),
  state: row.state,
  startedAt: row.created_at,
});

/** Postgres' unique-violation code. The one active run is a storage invariant. */
const UNIQUE_VIOLATION = "23505";

/**
 * How long a run may go unheard from before nothing is following it.
 *
 * This is derived from the follower's own ceiling, not from how long work
 * takes: `readAgentRunEvents` aborts the whole read at 600 seconds and buffers
 * the stream to its end, so a followed run cannot outlive that and its row is
 * untouched between the move to `running` and the terminal move. A bound above
 * the ceiling can therefore only ever move a run that is already dead.
 */
export const ABANDONED_AFTER_MS = 15 * 60 * 1000;

/** What an abandoned run reports, in place of the terminal event it never got. */
export const ABANDONED_ERROR =
  "The application stopped following this run. The agent may have finished the work.";

/**
 * Fails this client's runs that nothing is following, freeing the slot.
 *
 * A run's whole lifecycle lives in the process that started it, so a deploy, a
 * crash, or a container replacement mid-run leaves a record nothing will ever
 * move. The bound is the run's own age rather than a startup path, so an
 * application that stayed up while the process following a run died recovers
 * the same way one that restarted does.
 *
 * It runs before the slot is answered rather than on a timer, because the only
 * moment an orphan costs anything is the moment someone asks for the slot it
 * holds.
 */
export async function failAbandonedRuns(
  sql: postgres.Sql,
  clientId: string,
): Promise<readonly AgentRun[]> {
  return sql.begin(async (tx) => {
    const rows = await tx<Row[]>`
      update agent_run set state = 'failed', updated_at = now()
      where client_id = ${clientId}
        and state in ${tx(ACTIVE)}
        and updated_at < now() - make_interval(secs => ${ABANDONED_AFTER_MS / 1000})
      returning *
    `;
    if (rows.length === 0) {
      return [];
    }
    await tx`
      update process
      set state = 'failed', step = null, error = ${ABANDONED_ERROR}, updated_at = now()
      where id in ${tx(rows.map((row) => row.process_id))}
    `;
    return rows.map(toRun);
  });
}

/**
 * Opens a run and the process record the shell reports it through, in one
 * transaction.
 *
 * A second goal while a run is active is refused as busy rather than buffered.
 * The refusal comes from the partial unique index rather than from a check
 * before the insert, because a check has a window between reading and writing
 * and this one does not.
 */
export async function startRun(
  sql: postgres.Sql,
  input: {
    readonly workspaceId: string;
    readonly clientId: string;
    readonly goal: string;
    readonly runtime: string;
    readonly model?: string | null;
  },
): Promise<StartOutcome> {
  await failAbandonedRuns(sql, input.clientId);
  try {
    const run = await sql.begin(async (tx) => {
      const [process] = await tx<{ id: string }[]>`
        insert into process (workspace_id, title, state, step)
        values (${input.workspaceId}, ${input.goal}, 'queued', 'Waiting for the agent')
        returning id
      `;
      const [revision] = await tx<{ current: string }[]>`
        select current from graph_data_revision
      `;
      const [row] = await tx<Row[]>`
        insert into agent_run (
          process_id, workspace_id, client_id, goal, runtime, model,
          base_data_revision, state
        )
        values (
          ${process?.id ?? ""}, ${input.workspaceId}, ${input.clientId},
          ${input.goal}, ${input.runtime}, ${input.model ?? null},
          ${revision?.current ?? 0}, 'queued'
        )
        returning *
      `;
      if (row === undefined) {
        throw new Error("the run was not written");
      }
      return toRun(row);
    });
    return { ok: true, run };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return {
        ok: false,
        reason: "busy",
        holder: await activeRunFor(input.clientId, sql),
      };
    }
    throw error;
  }
}

/**
 * The one run this client currently has open, or null.
 *
 * This is what the tool server resolves a staging call against. The agent's
 * MCP client carries no session identity and no per-call metadata, so the run
 * cannot arrive as an argument; serializing runs is what makes resolving it
 * here unambiguous rather than a guess between several.
 */
export async function activeRunFor(
  clientId: string,
  sql: postgres.Sql = db(),
): Promise<AgentRun | null> {
  await failAbandonedRuns(sql, clientId);
  const [row] = await sql<Row[]>`
    select * from agent_run
    where client_id = ${clientId} and state in ${sql(ACTIVE)}
  `;
  return row === undefined ? null : toRun(row);
}

/** The run a process is reporting, or null when the process is not a run. */
export async function runForProcess(
  processId: string,
  sql: postgres.Sql = db(),
): Promise<AgentRun | null> {
  const [row] = await sql<Row[]>`
    select * from agent_run where process_id = ${processId}
  `;
  return row === undefined ? null : toRun(row);
}

export async function readRun(
  id: string,
  sql: postgres.Sql = db(),
): Promise<AgentRun | null> {
  const [row] = await sql<Row[]>`select * from agent_run where id = ${id}`;
  return row === undefined ? null : toRun(row);
}

/**
 * Moves a run and the process reporting it together, so the registry never
 * shows a finished run as still working. A run that has already reached a
 * terminal state stays there.
 */
export async function moveRun(
  sql: postgres.Sql,
  id: string,
  state: RunState,
  detail?: { readonly step?: string; readonly error?: string },
): Promise<AgentRun | null> {
  return sql.begin(async (tx) => {
    const [row] = await tx<Row[]>`
      update agent_run set state = ${state}, updated_at = now()
      where id = ${id} and state in ${tx(ACTIVE)}
      returning *
    `;
    if (row === undefined) {
      return null;
    }
    await tx`
      update process
      set state = ${state},
          step = ${detail?.step ?? null},
          error = ${detail?.error ?? null},
          updated_at = now()
      where id = ${row.process_id}
    `;
    return toRun(row);
  });
}

/** Records the identifier the agent gave the run once it accepted the goal. */
export async function recordAgentRunId(
  sql: postgres.Sql,
  id: string,
  agentRunId: string,
): Promise<void> {
  await sql`
    update agent_run set agent_run_id = ${agentRunId}, updated_at = now()
    where id = ${id}
  `;
}

/** What a group staged by this run carries, beside the client identity the
 * graph already records. */
export function provenanceOf(run: AgentRun): RunProvenance {
  return {
    runId: run.id,
    goal: run.goal,
    runtime: run.runtime,
    model: run.model,
    baseDataRevision: run.baseDataRevision,
  };
}
