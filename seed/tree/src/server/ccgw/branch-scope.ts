import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The branch a request works in: the open proposal group a person's tab
 * stages every write into and reads through, `node:branch-<document>-<account>`
 * (`block-document-model.md`, `BO_0250_011`). Carried in async-local storage
 * so `commit` and `query` find it without every command threading it: in a
 * branch, `commit` stages instead of writing and `query` overlays the branch
 * unless a read names an overlay of its own. Outside a request, and in the
 * behavior suites, `withBranch` sets it around the call.
 */
const storage = new AsyncLocalStorage<{ readonly branch: string }>();

export function withBranch<T>(branch: string | undefined, run: () => Promise<T>): Promise<T> {
  if (branch === undefined || branch === "") return storage.run({ branch: "" }, run);
  return storage.run({ branch }, run);
}

/** The branch the current request works in, or `undefined` for truth. */
export function currentBranch(): string | undefined {
  const branch = storage.getStore()?.branch;
  return branch === undefined || branch === "" ? undefined : branch;
}

/** Runs a call against truth, whatever branch the request is in. */
export function outsideBranch<T>(run: () => Promise<T>): Promise<T> {
  return storage.run({ branch: "" }, run);
}

/**
 * The name of a person's branch group on a root: one open branch per root and
 * person, and a number once a branch has closed — the first is unnumbered,
 * the next `.2`, then `.3` — since a group's name is taken for good once it
 * is accepted or rejected. Found live in the BO_0250 walk-through,
 * 2026-09-15: the second branch on a root could not be staged. BO_0250_010
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
