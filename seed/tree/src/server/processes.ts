import {
  canTransition,
  INITIAL_PROCESS_STATE,
  PROCESS_STATES,
  type ProcessRecord,
  type ProcessState,
} from "~/lib/process";
import { TAB_KINDS, type TabKind } from "~/lib/tabs";
import { db } from "./db";
import { HttpError } from "./http-error";
import { assertRecordId } from "./uuid";
import { readWorkspace } from "./workspaces";

export interface ProcessInput {
  readonly title: string;
  readonly step: string | null;
  readonly itemId: string | null;
  readonly itemKind: TabKind | null;
}

export interface TransitionInput {
  readonly state: ProcessState;
  readonly step: string | null;
  readonly error: string | null;
}

function fields(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "expected an object");
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `${name} must be text`);
  const text = value.trim();
  return text === "" ? null : text;
}

export function parseProcessInput(value: unknown): ProcessInput {
  const input = fields(value);
  const title = optionalText(input.title, "title");
  if (title === null) throw new HttpError(400, "a process needs a title");

  const itemId = optionalText(input.itemId, "itemId");
  const itemKind = optionalText(input.itemKind, "itemKind");
  if (itemKind !== null && !TAB_KINDS.includes(itemKind as TabKind)) {
    throw new HttpError(400, `unknown item kind ${itemKind}`);
  }
  if ((itemId === null) !== (itemKind === null)) {
    throw new HttpError(400, "an affected item needs both identity and kind");
  }

  return {
    title,
    step: optionalText(input.step, "step"),
    itemId,
    itemKind: itemKind as TabKind | null,
  };
}

export function parseTransitionInput(value: unknown): TransitionInput {
  const input = fields(value);
  const state = optionalText(input.state, "state");
  if (state === null || !PROCESS_STATES.includes(state as ProcessState)) {
    throw new HttpError(400, `unknown process state ${state ?? "(none)"}`);
  }
  const error = optionalText(input.error, "error");
  if (state === "failed" && error === null) {
    throw new HttpError(400, "a failed process needs an error to report");
  }
  return {
    state: state as ProcessState,
    step: optionalText(input.step, "step"),
    error,
  };
}

type ProcessRow = {
  id: string;
  workspaceId: string;
  title: string;
  state: ProcessState;
  step: string | null;
  error: string | null;
  itemId: string | null;
  itemKind: TabKind | null;
  acknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function record(row: ProcessRow): ProcessRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const columns = () => db()`
  id, workspace_id as "workspaceId", title, state, step, error,
  item_id as "itemId", item_kind as "itemKind", acknowledged,
  created_at as "createdAt", updated_at as "updatedAt"
`;

export async function listProcesses(
  workspaceId: string,
): Promise<ProcessRecord[]> {
  await readWorkspace(workspaceId);
  const rows = await db()<ProcessRow[]>`
    select ${columns()} from process
    where workspace_id = ${workspaceId}
    order by created_at, id
  `;
  return rows.map(record);
}

export async function createProcess(
  workspaceId: string,
  input: unknown,
): Promise<ProcessRecord> {
  const { title, step, itemId, itemKind } = parseProcessInput(input);
  await readWorkspace(workspaceId);
  const [row] = await db()<ProcessRow[]>`
    insert into process (workspace_id, title, state, step, item_id, item_kind)
    values (${workspaceId}, ${title}, ${INITIAL_PROCESS_STATE}, ${step},
            ${itemId}, ${itemKind})
    returning ${columns()}
  `;
  if (!row) throw new Error("process insert returned no row");
  return record(row);
}

export async function readProcess(id: string): Promise<ProcessRecord> {
  assertRecordId(id, "process");
  const [row] = await db()<ProcessRow[]>`
    select ${columns()} from process where id = ${id}
  `;
  if (!row) throw new HttpError(404, `no process ${id}`);
  return record(row);
}

export async function transitionProcess(
  id: string,
  input: unknown,
): Promise<ProcessRecord> {
  const { state, step, error } = parseTransitionInput(input);
  const current = await readProcess(id);
  if (!canTransition(current.state, state)) {
    throw new HttpError(
      409,
      `a ${current.state} process cannot become ${state}`,
    );
  }
  const [row] = await db()<ProcessRow[]>`
    update process set state = ${state}, step = ${step ?? current.step},
      error = ${error}, updated_at = now()
    where id = ${id} returning ${columns()}
  `;
  if (!row) throw new HttpError(404, `no process ${id}`);
  return record(row);
}

export async function acknowledgeProcess(id: string): Promise<ProcessRecord> {
  const current = await readProcess(id);
  if (current.state !== "failed") {
    throw new HttpError(409, "only a failed process can be acknowledged");
  }
  const [row] = await db()<ProcessRow[]>`
    update process set acknowledged = true, updated_at = now()
    where id = ${id} returning ${columns()}
  `;
  if (!row) throw new HttpError(404, `no process ${id}`);
  return record(row);
}
