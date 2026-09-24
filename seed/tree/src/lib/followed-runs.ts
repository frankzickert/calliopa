import type { ViewRunActivity } from "~/components/shell/view-bridge";
import type { RunEvent } from "~/server/agent/run-events";

/**
 * The runs the reader started in this session, followed side by side: each
 * one's events as the bridge last answered them, and whether its end has
 * been told to the view showing its document. Pure, so the shell and its
 * tests cannot disagree. BO_0269_014
 */

/** One run the shell follows. */
export interface FollowedRun {
  readonly id: string;
  /** The document it was aimed at, or null. */
  readonly artifact: string | null;
  readonly agent: string | null;
  readonly events: readonly RunEvent[];
  /** Its end has been told to the view showing its document. BO_0226_007 */
  readonly announced: boolean;
}

const RUN_ENDS: readonly RunEvent["kind"][] = ["runCompleted", "runFailed", "runCancelled"];

/** Whether a run's events say it has ended. */
export function runEnded(events: readonly RunEvent[]): boolean {
  return events.some((event) => RUN_ENDS.includes(event.kind));
}

/** A run just started, followed from here. */
export function followRun(runs: readonly FollowedRun[], id: string, artifact: string | null, agent: string | null): FollowedRun[] {
  return [...runs.filter((run) => run.id !== id), { id, artifact, agent, events: [], announced: false }];
}

/** The runs still to be read: those not seen to end. */
export function unfinished(runs: readonly FollowedRun[]): FollowedRun[] {
  return runs.filter((run) => !runEnded(run.events));
}

/** The runs with one run's events replaced by what the bridge answered. */
export function withEvents(runs: readonly FollowedRun[], id: string, events: readonly RunEvent[]): FollowedRun[] {
  return runs.map((run) => (run.id === id ? { ...run, events: [...events] } : run));
}

/** The runs with one run's end told to the view showing its document. */
export function marked(runs: readonly FollowedRun[], id: string, mark: "announced"): FollowedRun[] {
  return runs.map((run) => (run.id === id ? { ...run, [mark]: true } : run));
}

/**
 * What the views hear: every followed run aimed at a document, with what it
 * has done in that document, in the order the runs were started.
 */
export function activitiesOf(runs: readonly FollowedRun[]): ViewRunActivity[] {
  return runs.flatMap((run) => {
    if (run.artifact === null) return [];
    const artifact = run.artifact;
    return [
      {
        itemId: artifact,
        runId: run.id,
        agent: run.agent,
        running: !runEnded(run.events),
        events: run.events.flatMap((event) =>
          event.kind === "documentActivity" && event.activity.document === artifact ? [event.activity] : [],
        ),
      },
    ];
  });
}

/** Whether two readings of the activities say the same, so the views are
 * told only of a change. */
export function sameActivities(left: readonly ViewRunActivity[], right: readonly ViewRunActivity[]): boolean {
  return (
    left.length === right.length &&
    left.every((run, index) => {
      const other = right[index];
      return other !== undefined && run.runId === other.runId && run.running === other.running && run.events.length === other.events.length;
    })
  );
}
