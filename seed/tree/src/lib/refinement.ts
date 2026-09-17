/**
 * Refinement as the settings row says it (`BO_0245_011`): whether the kernel
 * refines a document on its own after a change settles, and after how long a
 * quiet. Pure, so the row's words and the route's parsing are settled
 * without a browser or a kernel.
 */

export interface RefinementSettings {
  readonly enabled: boolean;
  readonly settleSeconds: number;
}

/** The settings a request carries, or null for a shape that is not one. */
export function parseRefinement(value: unknown): RefinementSettings | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { enabled?: unknown; settleSeconds?: unknown };
  if (typeof record.enabled !== "boolean") return null;
  const seconds = record.settleSeconds;
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0) return null;
  return { enabled: record.enabled, settleSeconds: seconds };
}

/**
 * What the row says: on with its settle time, off, or — with no runtime
 * signed in — that refinement waits until one is.
 */
export function refinementWords(settings: RefinementSettings, runtimeReady: boolean): string {
  if (!settings.enabled) return "Refinement: off.";
  const after = settings.settleSeconds === 0 ? "at once after a change" : `after ${settings.settleSeconds} s of quiet`;
  if (!runtimeReady) return `Refinement: on, ${after} — it waits until a runtime is signed in.`;
  return `Refinement: on, ${after}.`;
}
