import { randomUUID } from "node:crypto";

import {
  canTransition,
  INITIAL_PROCESS_STATE,
  PROCESS_STATES,
  type ProcessRecord,
  type ProcessState,
} from "~/lib/process";
import { migrateTabKind, type TabKind } from "~/lib/tabs";
import { HttpError } from "./http-error";
import { kernelState } from "./kernel/client";
import { isRegisteredKind } from "./registry";
import { assertRecordId } from "./uuid";
import { readWorkspace } from "./workspaces";

/**
 * The process registry lives in the kernel's per-instance state record, one
 * JSON record per process (`ui-kernel.md`, `BO_0207_002`): a process is
 * working state the registry polls, never content. The transition rule and
 * the parsers are unchanged. `BO_0207_014`
 */

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
  // The item kind is one the registry knows, qualified as the build names it;
  // a kind stored or sent bare from before `BO_0202` is rewritten first.
  const given = optionalText(input.itemKind, "itemKind");
  const itemKind = given === null ? null : migrateTabKind(given);
  if (itemKind !== null && !isRegisteredKind(itemKind)) {
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

const byCreation = (left: ProcessRecord, right: ProcessRecord): number =>
  left.createdAt < right.createdAt
    ? -1
    : left.createdAt > right.createdAt
      ? 1
      : left.id < right.id
        ? -1
        : left.id > right.id
          ? 1
          : 0;

async function readStored(id: string): Promise<ProcessRecord | null> {
  return kernelState.read<ProcessRecord>("processes", id);
}

async function store(record: ProcessRecord): Promise<ProcessRecord> {
  await kernelState.write("processes", record);
  return record;
}

export async function listProcesses(workspaceId: string): Promise<ProcessRecord[]> {
  await readWorkspace(workspaceId);
  const ids = await kernelState.list("processes");
  const records = await Promise.all(ids.map(readStored));
  // A process naming an item kind no extension contributes any more is
  // dropped from the listing, not from the record: absence tolerates what it
  // finds, and nothing is purged. BO_0203_006
  return records
    .filter(
      (record): record is ProcessRecord =>
        record !== null &&
        record.workspaceId === workspaceId &&
        (record.itemKind === null || isRegisteredKind(migrateTabKind(record.itemKind))),
    )
    .map((record) =>
      record.itemKind === null ? record : { ...record, itemKind: migrateTabKind(record.itemKind) },
    )
    .sort(byCreation);
}

/**
 * Opens a process. The optional identity lets a producer that records the
 * process beside its own record — the agent run — name it before it exists.
 */
export async function createProcess(
  workspaceId: string,
  input: unknown,
  id: string = randomUUID(),
): Promise<ProcessRecord> {
  const { title, step, itemId, itemKind } = parseProcessInput(input);
  await readWorkspace(workspaceId);
  const now = new Date().toISOString();
  return store({
    id,
    workspaceId,
    title,
    state: INITIAL_PROCESS_STATE,
    step,
    error: null,
    itemId,
    itemKind,
    acknowledged: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function readProcess(id: string): Promise<ProcessRecord> {
  assertRecordId(id, "process");
  const record = await readStored(id);
  if (record === null) throw new HttpError(404, `no process ${id}`);
  return record;
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
  return store({
    ...current,
    state,
    step: step ?? current.step,
    error,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Moves a process the way its producer reports, without the transition rule:
 * the agent run owns its process and moves it with the run's own lifecycle,
 * which the rule already governs on the run.
 */
export async function moveProcess(
  id: string,
  change: { readonly state: ProcessState; readonly step: string | null; readonly error: string | null },
): Promise<ProcessRecord | null> {
  const current = await readStored(id);
  if (current === null) return null;
  return store({ ...current, ...change, updatedAt: new Date().toISOString() });
}

/** Names the kernel run a process reports. BO_0207_015 */
export async function attachRun(id: string, runId: string): Promise<ProcessRecord | null> {
  const current = await readStored(id);
  if (current === null) return null;
  return store({ ...current, runId, updatedAt: new Date().toISOString() });
}

/** Every process of every workspace, for the rare lookup by what it reports. */
export async function listAllProcesses(): Promise<ProcessRecord[]> {
  const ids = await kernelState.list("processes");
  const records = await Promise.all(ids.map(readStored));
  return records.filter((record): record is ProcessRecord => record !== null).sort(byCreation);
}

export async function acknowledgeProcess(id: string): Promise<ProcessRecord> {
  const current = await readProcess(id);
  if (current.state !== "failed") {
    throw new HttpError(409, "only a failed process can be acknowledged");
  }
  return store({ ...current, acknowledged: true, updatedAt: new Date().toISOString() });
}
