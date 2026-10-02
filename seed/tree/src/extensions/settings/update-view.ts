import type { UpdateView } from "~/server/kernel/update";

/**
 * What the Update tab decides from the kernel's answer and its own phase,
 * kept apart from the view so each rule is pinned by a unit test. BO_0242_005
 */

export type Phase =
  | "idle"
  | "running"
  | "waiting"
  | "returned"
  | "accepted"
  | "promoting"
  | "served"
  | "failed";

/**
 * The update buttons are held back only while something runs: the updater's
 * install, the restart after it, or a promotion. A pending update holds
 * nothing back — the owner gets past it by updating past it.
 */
export const updateRunning = (phase: Phase): boolean =>
  phase === "running" || phase === "waiting" || phase === "promoting";

/**
 * The release whose pending update a choice supersedes: the pending one's,
 * when the owner chooses another release; the install that follows rejects it.
 */
export const supersedes = (info: UpdateView | null, version: string): string | null => {
  const pending = info?.pending;
  return pending === null || pending === undefined || pending.version === version ? null : pending.version;
};

/**
 * Accepted content waits to be served: the newest accepted extension truth is
 * past the served pin, however it was accepted and whenever the page loaded.
 */
export const unserved = (info: UpdateView | null): boolean =>
  info?.extensionTruth !== undefined && info.extensionTruth > (info.servedPin ?? 0);

/**
 * What the Update tab says of a migration that failed when the served pin was
 * served, or null when none did: the extension and the migration by id, and
 * that it is tried again at the next serve. BO_0312_003
 */
export const migrationNotice = (info: UpdateView | null): string | null => {
  const failed = info?.migration;
  if (failed === undefined) return null;
  const which = failed.id === "" ? "The migrations" : `The ${failed.extension} migration ${failed.id}`;
  return `${which} could not be applied at pin ${failed.pin}: ${failed.error}. Content it changes stays as it was until it runs; it is tried again the next time a pin is served.`;
};
