import { randomUUID } from "node:crypto";

import {
  canTransition,
  INITIAL_PROCESS_STATE,
  PROCESS_STATES,
  SYSTEM_WORKSPACE,
  type ProcessRecord,
  type ProcessState,
} from "~/lib/process";
import { DOCUMENT_KIND } from "~/lib/command-target";
import { conclusionOf, listBridgeRuns, triggerOf, type BridgeRun } from "./agent/bridge";
import { migrateTabKind, type TabKind } from "~/lib/tabs";
import { HttpError } from "./http-error";
import { kernelState } from "./kernel/client";
import { isRegisteredKind, labelOf } from "./registry";
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
  await syncSystemRuns();
  const ids = await kernelState.list("processes");
  const records = await Promise.all(ids.map(readStored));
  // A process naming an item kind no extension contributes any more is
  // dropped from the listing, not from the record: absence tolerates what it
  // finds, and nothing is purged. BO_0203_006
  // A system process belongs to no workspace and is listed in every one:
  // a run an extension started is not a fact about where a reader sat. BO_0245_009
  return records
    .filter(
      (record): record is ProcessRecord =>
        record !== null &&
        (record.workspaceId === workspaceId || record.workspaceId === SYSTEM_WORKSPACE) &&
        (record.itemKind === null || isRegisteredKind(migrateTabKind(record.itemKind))),
    )
    .map((record) =>
      record.itemKind === null ? record : { ...record, itemKind: migrateTabKind(record.itemKind) },
    )
    .sort(byCreation);
}

/** The process state a bridge run's status reads as. */
const stateOfRun = (status: string): ProcessState => {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "running";
  }
};

/**
 * The kernel's own runs, as processes: a system run is started by nobody
 * here, so the registry learns of it from the bridge's list and keeps one
 * record per run under the system workspace, its state following the run's.
 * A bridge that cannot be reached leaves the records as they are. BO_0245_009
 */
async function syncSystemRuns(): Promise<void> {
  const listed = await listBridgeRuns();
  if (!listed.ok) return;
  const system = listed.value.filter((run) => triggerOf(run) === "system");
  if (system.length === 0) return;
  const ids = await kernelState.list("processes");
  const records = (await Promise.all(ids.map(readStored))).filter((record): record is ProcessRecord => record !== null);
  for (const run of system) {
    const existing = records.find((record) => record.runId === run.id);
    const state = stateOfRun(run.status);
    if (existing !== undefined) {
      const concluded = conclusionOf(run);
      if (existing.state !== state || (concluded !== "" && existing.concluded !== concluded)) {
        await store({
          ...existing,
          state,
          step: state === "running" ? "Running" : state === "completed" ? "Done" : existing.step,
          ...(concluded === "" ? {} : { concluded }),
          updatedAt: new Date().toISOString(),
        });
      }
      continue;
    }
    await store(await systemProcess(run, state));
  }
}

async function systemProcess(run: BridgeRun, state: ProcessState): Promise<ProcessRecord> {
  // The run's goal is the extension's own words for it; the document it
  // proposes into is named by the extension listing documents, or by its
  // identity when none does. BO_0255_007 BO_0264_017
  const documentId = run.artifact !== undefined && run.artifact !== "" ? run.artifact : null;
  const label = documentId === null ? null : await labelOf(DOCUMENT_KIND, documentId);
  const now = new Date().toISOString();
  const concluded = conclusionOf(run);
  return {
    id: randomUUID(),
    workspaceId: SYSTEM_WORKSPACE,
    title: run.goal.replace(/\.$/u, ""),
    state,
    step: state === "running" ? "Running" : state === "completed" ? "Done" : null,
    error: null,
    itemId: documentId,
    itemKind: documentId === null ? null : DOCUMENT_KIND,
    ...(documentId === null ? {} : { itemLabel: label ?? documentId }),
    acknowledged: false,
    createdAt: now,
    updatedAt: now,
    runId: run.id,
    trigger: "system",
    triggeredBy: { extension: run.extension ?? "", dataRevision: run.pin },
    ...(concluded === "" ? {} : { concluded }),
  };
}

/**
 * Opens a process. The optional identity lets a producer that records the
 * process beside its own record — the agent run — name it before it exists.
 */
export async function createProcess(
  workspaceId: string,
  input: unknown,
  id: string = randomUUID(),
  /** Whose process: the person whose command started the run. BO_0232_006 */
  account?: string,
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
    ...(account === undefined ? {} : { account }),
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
  change: Partial<Pick<ProcessRecord, "trigger" | "concluded">> & {
    readonly state: ProcessState;
    readonly step: string | null;
    readonly error: string | null;
  },
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
