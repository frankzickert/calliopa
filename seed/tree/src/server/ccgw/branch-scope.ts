import { port } from "../port";

/**
 * The branch a request works in: the open proposal group a person's tab
 * stages every write into and reads through, `node:branch-<document>-<account>`
 * (`block-document-model.md`, `BO_0250_011`). Carried in the port's request scope
 * so `commit` and `query` find it without every command threading it: in a
 * branch, `commit` stages instead of writing and `query` overlays the branch
 * unless a read names an overlay of its own. Outside a request, and in the
 * behavior suites, `withBranch` sets it around the call.
 */
const storage = port.scope<{ readonly branch: string }>();

export function withBranch<T>(branch: string | undefined, run: () => Promise<T>): Promise<T> {
  if (branch === undefined || branch === "") return storage.run({ branch: "" }, run);
  return storage.run({ branch }, run);
}

/** The branch the current request works in, or `undefined` for truth. */
export function currentBranch(): string | undefined {
  const branch = storage.current()?.branch;
  return branch === undefined || branch === "" ? undefined : branch;
}

/**
 * The data revision a call reads at: an extension computing what changed
 * between two pins reads the same document at each (`BO_0264_012`). A read
 * at a pin reads truth, never a branch.
 */
const pins = port.scope<{ readonly dataRevision: number }>();

export function atDataRevision<T>(dataRevision: number, run: () => Promise<T>): Promise<T> {
  return outsideBranch(() => pins.run({ dataRevision }, run));
}

/** The data revision the current call reads at, or `undefined` for head. */
export function currentDataRevision(): number | undefined {
  const pinned = pins.current()?.dataRevision;
  return pinned === undefined || pinned <= 0 ? undefined : pinned;
}

/**
 * The read scope of the run a kernel callback is made for: its pin, and its
 * group laid over truth once it has staged — the projection the kernel's own
 * document tools read, so an extension's tool sees what the same run proposed
 * a moment before (`calliopa-bootstrap`'s `BO_0344`). The kernel sends it in
 * `X-Calliopa-Run-Pin` and `X-Calliopa-Run-Overlay`, and `dispatch` sets it.
 * It never sets the branch: `commit` is untouched, so an extension gains no
 * write path. A read at the run's pin — naming it, or inside
 * `atDataRevision` — reads through the group too; one at another revision
 * reads truth there, as before. BO_0344_004
 */
export interface RunScope {
  readonly pin: number;
  readonly overlay?: string;
}

const runs = port.scope<RunScope>();

export function asRun<T>(scope: RunScope, run: () => Promise<T>): Promise<T> {
  return runs.run(scope, run);
}

/** The run the current call reads for, or `undefined` outside one. */
export function currentRun(): RunScope | undefined {
  const scope = runs.current();
  return scope === undefined || scope.pin <= 0 ? undefined : scope;
}

/** Runs a call against truth, whatever branch the request is in. */
export function outsideBranch<T>(run: () => Promise<T>): Promise<T> {
  return storage.run({ branch: "" }, run);
}

/**
 * The name of a person's branch group on a root: a number per session — the
 * first is unnumbered, the next `.2`, then `.3` — since a group's name is
 * taken for good once it is accepted or rejected, and each session is its own
 * proposal while earlier ones stand open. Found live in the BO_0250
 * walk-through, 2026-09-15: the second branch on a root could not be staged.
 * BO_0250_010 CA_0057_007
 */
export function branchGroupId(documentId: string, account: string, attempt = 1): string {
  return `node:branch-${documentId}-${account}${attempt > 1 ? `.${attempt}` : ""}`;
}

/** The document, the person and the attempt a branch group's name carries, or null. */
export function branchGroupOf(groupId: string): { readonly documentId: string; readonly account: string; readonly attempt: number } | null {
  const match = /^node:branch-([0-9a-f-]{36})-(.+?)(?:\.(\d+))?$/u.exec(groupId);
  if (match === null) return null;
  return { documentId: match[1] as string, account: match[2] as string, attempt: match[3] === undefined ? 1 : Number(match[3]) };
}
