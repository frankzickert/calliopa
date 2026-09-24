/**
 * What the kernel's code surface answers, as this extension reads it
 * (`calliopa-bootstrap`'s `docs/system/ui-kernel.md`, Code From A Document,
 * and `docs/system/code-service.md`). The shapes are the kernel's; nothing
 * here invents a second account of a runtime or a session.
 */

export interface Kernelspec {
  readonly name: string;
  readonly displayName: string;
  readonly language: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly runtime: string;
  readonly kernelspec: string;
  readonly language: string;
  readonly state: string;
  readonly openedAt: string;
  readonly lastUsedAt: string | null;
  readonly running: string | null;
  readonly executions: number;
}

export interface RuntimeRecord {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly kernelspec: Kernelspec | null;
  /** pulling, inspecting, creating, failed, running, stopped. */
  readonly state: string;
  readonly error: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly sessions: readonly SessionRecord[];
}

/** The section's reader: the runtimes, whether the reader is the owner, and
 * whether the kernel serves a code surface at all. */
export interface RuntimeListing {
  readonly reachable: boolean;
  readonly owner: boolean;
  readonly runtimes: readonly RuntimeRecord[];
  readonly refusal?: string;
}

/** A document's connection as the kernel answers it. */
export interface Connection {
  readonly runtime: string | null;
  readonly runtimeName?: string;
  readonly runtimeState?: string;
  readonly session: SessionRecord | null;
  readonly running: string;
}

/** One record of the kernel's executions list. */
export interface ExecutionRecord {
  readonly id: string;
  readonly document: string;
  readonly block: string;
  readonly sender: string;
  readonly run?: string;
  readonly status: string;
  readonly error?: string;
  readonly proposal?: string;
  readonly output?: string;
  readonly startedAt: number;
  readonly endedAt?: number;
}

/** How long a runtime has been idle, in words a row can carry. */
export function idleWords(record: RuntimeRecord, now: number = Date.now()): string {
  const since = record.lastUsedAt ?? record.startedAt;
  if (record.state !== "running" || since === null) return "";
  const seconds = Math.max(0, Math.round((now - Date.parse(since)) / 1000));
  if (seconds < 60) return "used just now";
  if (seconds < 3600) return `idle ${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `idle ${Math.round(seconds / 3600)} h`;
  return `idle ${Math.round(seconds / 86400)} d`;
}
