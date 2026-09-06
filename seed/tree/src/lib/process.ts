import type { TabKind } from "./tabs";

export const PROCESS_STATES = [
  "queued",
  "running",
  "waiting-for-input",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ProcessState = (typeof PROCESS_STATES)[number];

export const INITIAL_PROCESS_STATE: ProcessState = "queued";

export interface ProcessRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly state: ProcessState;
  readonly step: string | null;
  readonly error: string | null;
  readonly itemId: string | null;
  readonly itemKind: TabKind | null;
  readonly acknowledged: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const ALLOWED: Readonly<Record<ProcessState, readonly ProcessState[]>> = {
  queued: ["running", "failed", "cancelled"],
  running: ["waiting-for-input", "completed", "failed", "cancelled"],
  "waiting-for-input": ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function allowedTransitions(
  state: ProcessState,
): readonly ProcessState[] {
  return ALLOWED[state];
}

export function canTransition(from: ProcessState, to: ProcessState): boolean {
  return ALLOWED[from].includes(to);
}

export function isTerminal(state: ProcessState): boolean {
  return ALLOWED[state].length === 0;
}

export function isActive(state: ProcessState): boolean {
  return !isTerminal(state);
}

export function activeProcessCount(
  processes: readonly ProcessRecord[],
): number {
  return processes.filter(({ state }) => isActive(state)).length;
}

/**
 * A tab marks the work that affects the item it holds. The registry owns the
 * state; a tab only projects it, so a failure stays visible until it is
 * acknowledged.
 */
export function tabProcessState(
  processes: readonly ProcessRecord[],
  tab: { readonly itemId: string | null; readonly kind: TabKind },
): "running" | "failed" | null {
  if (tab.itemId === null) return null;
  const affecting = processes.filter(
    (process) => process.itemId === tab.itemId && process.itemKind === tab.kind,
  );
  if (
    affecting.some(
      ({ state, acknowledged }) => state === "failed" && !acknowledged,
    )
  ) {
    return "failed";
  }
  return affecting.some(({ state }) => isActive(state)) ? "running" : null;
}

export function describeProcess(process: ProcessRecord): string {
  return process.step === null
    ? `${process.title} — ${process.state}`
    : `${process.title} — ${process.state} · ${process.step}`;
}
