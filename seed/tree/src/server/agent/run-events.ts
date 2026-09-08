/**
 * The normalized event contract for an agent run.
 *
 * The shell reads these and never the agent's own JSON. Since `BO_0207_015`
 * the events arrive from the kernel's agent bridge, already normalized, and
 * `bridge.ts` maps the bridge's vocabulary onto these kinds; the Hermes-shaped
 * translator that used to live here went with the shell's own conductor.
 * CA_0022_012
 */

/** Bumped when the meaning of an event changes, not when one is added. */
export const RUN_EVENT_CONTRACT_VERSION = 1;

export type RunEvent =
  | { readonly kind: "runStarted"; readonly runId: string; readonly at: number }
  | {
      readonly kind: "assistantDelta";
      readonly runId: string;
      readonly at: number;
      readonly text: string;
    }
  | {
      readonly kind: "toolStarted";
      readonly runId: string;
      readonly at: number;
      readonly tool: string;
      readonly preview: string | null;
    }
  | {
      readonly kind: "toolCompleted";
      readonly runId: string;
      readonly at: number;
      readonly tool: string;
      readonly failed: boolean;
      readonly seconds: number | null;
    }
  | {
      readonly kind: "runCompleted";
      readonly runId: string;
      readonly at: number;
      readonly output: string;
    }
  | {
      readonly kind: "runFailed";
      readonly runId: string;
      readonly at: number;
      readonly error: string;
    }
  | {
      readonly kind: "runCancelled";
      readonly runId: string;
      readonly at: number;
    };

/** The first event of every run, recorded the moment the run opens. */
export function runStarted(runId: string, when = Date.now()): RunEvent {
  return { kind: "runStarted", runId, at: when };
}
