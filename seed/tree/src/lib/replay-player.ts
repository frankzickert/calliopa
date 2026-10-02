import type { ReplayStep } from "./replay";

/**
 * The replay's clock in the browser (`BO_0340_004`): one timer per step,
 * held by the tab the replay plays in so closing it stops them. Timers are
 * the page's, not state the shell renders, so they live here rather than in a
 * store.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

/** Plays `steps` from now, calling `apply` with how many have played. */
export function playSteps(key: string, steps: readonly ReplayStep[], apply: (played: number) => void): void {
  stopSteps(key);
  timers.set(
    key,
    steps.map((step, index) => setTimeout(() => apply(index + 1), step.at)),
  );
}

/** Stops a replay's remaining steps. */
export function stopSteps(key: string): void {
  for (const timer of timers.get(key) ?? []) clearTimeout(timer);
  timers.delete(key);
}
