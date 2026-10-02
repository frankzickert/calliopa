import type { ViewRunActivity } from "~/components/shell/view-bridge";
import type { ExecutionRun } from "~/lib/execution";
import type { ProcessRecord } from "~/lib/process";
import type { DocumentActivity, RunEvent } from "~/server/agent/run-events";

/**
 * A finished run played back (`BO_0340`): what the shell reads of the run's
 * record, and the timed steps the playback applies. The playback calls no
 * model, runs no tool and writes nothing; it only shows again what the record
 * holds. Pure, so the order, the spacing and the typing are proven without a
 * browser. BO_0340_002
 */

/** What a replay plays, as `GET /api/runs/:id/replay` answers it. BO_0340_001 */
export interface ReplayRun {
  readonly runId: string;
  /** The command's words, as the kernel read them from the block. */
  readonly words: string;
  /** The document the command was sent from, and its block. */
  readonly document: string;
  readonly block: string;
  /** The data revision the run read at: the document as it stood. */
  readonly pin: number;
  readonly group: string | null;
  readonly agent: string | null;
  /** How the run ended, and why when it did not complete. */
  readonly state: "completed" | "failed" | "cancelled";
  readonly reason: string | null;
  /** Every event the record keeps, in its order, each with its time. */
  readonly events: readonly RunEvent[];
}

/** One step of a replay, at its time from the replay's start in ms. */
export type ReplayStep =
  | { readonly at: number; readonly kind: "type"; readonly words: string }
  | { readonly at: number; readonly kind: "send" }
  | { readonly at: number; readonly kind: "event"; readonly event: RunEvent }
  | { readonly at: number; readonly kind: "end" };

/** The pace a command is typed at, a character at a time. */
export const REPLAY_TYPE_MS = 60;
/** The longest a replay waits between two events: the model thinking or a
 * slow tool, shortened so the replay keeps moving. */
export const REPLAY_WAIT_CAP_MS = 3000;
/** The beat between the last character and the send. */
export const REPLAY_SEND_PAUSE_MS = 400;

/**
 * The command typed character by character, the send, then each event at its
 * recorded spacing from the one before — a wait over the cap shortened to it,
 * and a clock that went backwards read as no wait — and the end at the last
 * event. The words are typed by code point, so a character outside the basic
 * plane is never split.
 */
export function replaySchedule(
  run: Pick<ReplayRun, "words" | "events">,
  options: { readonly typeMs?: number; readonly capMs?: number; readonly sendPauseMs?: number } = {},
): ReplayStep[] {
  const typeMs = options.typeMs ?? REPLAY_TYPE_MS;
  const capMs = options.capMs ?? REPLAY_WAIT_CAP_MS;
  const sendPauseMs = options.sendPauseMs ?? REPLAY_SEND_PAUSE_MS;
  const steps: ReplayStep[] = [{ at: 0, kind: "type", words: "" }];
  const characters = [...run.words];
  let at = 0;
  for (let index = 1; index <= characters.length; index += 1) {
    at += typeMs;
    steps.push({ at, kind: "type", words: characters.slice(0, index).join("") });
  }
  at += sendPauseMs;
  steps.push({ at, kind: "send" });
  let previous: number | null = null;
  for (const event of run.events) {
    if (previous !== null) at += Math.min(capMs, Math.max(0, event.at - previous));
    previous = event.at;
    steps.push({ at, kind: "event", event });
  }
  steps.push({ at, kind: "end" });
  return steps;
}

/** What a replay has shown after some of its steps: the words typed so far
 * (null before the first step), whether the command was sent, the events that
 * have arrived and whether it has ended. */
export interface ReplayPlayed {
  readonly words: string | null;
  readonly sent: boolean;
  readonly events: readonly RunEvent[];
  readonly ended: boolean;
}

/** What the first `count` steps of a schedule have shown. */
export function playedOf(steps: readonly ReplayStep[], count: number): ReplayPlayed {
  let words: string | null = null;
  let sent = false;
  let ended = false;
  const events: RunEvent[] = [];
  for (const step of steps.slice(0, Math.max(0, count))) {
    if (step.kind === "type") words = step.words;
    else if (step.kind === "send") sent = true;
    else if (step.kind === "event") events.push(step.event);
    else ended = true;
  }
  return { words, sent, events, ended };
}

/** The process state a replay's entry holds: queued while the command is
 * typed, running once sent, and how the original ended once it has. */
export function replayState(run: Pick<ReplayRun, "state">, played: ReplayPlayed): "queued" | "running" | ReplayRun["state"] {
  if (played.ended) return run.state;
  return played.sent ? "running" : "queued";
}

/** The id a replay's transient process and run go by: never a registry's or
 * a bridge's, so nothing reads or writes them as real ones. */
export const replayProcessId = (runId: string): string => `replay-${runId}`;
export const replayRunId = (runId: string): string => `replay:${runId}`;
export const isReplayId = (id: string | null | undefined): boolean =>
  typeof id === "string" && (id.startsWith("replay-") || id.startsWith("replay:"));

/** The run as the replay's view takes it, the shape a live run's activity
 * has, once the command is sent; nothing before. BO_0340_004 */
export function replayActivity(run: ReplayRun, played: ReplayPlayed): ViewRunActivity | null {
  if (!played.sent) return null;
  return {
    itemId: run.document,
    runId: replayRunId(run.runId),
    agent: run.agent,
    running: !played.ended,
    events: played.events.flatMap((event): DocumentActivity[] => (event.kind === "documentActivity" ? [event.activity] : [])),
  };
}

/**
 * The replay's transient process: titled as the original was, running while
 * it plays and ending in the original's state and reason. It lives in no
 * registry and is never written. BO_0340_004
 */
export function replayProcess(
  run: ReplayRun,
  played: ReplayPlayed,
  context: { readonly title: string; readonly workspaceId: string; readonly itemKind: string; readonly startedAt: string },
): ProcessRecord {
  const state = replayState(run, played);
  return {
    id: replayProcessId(run.runId),
    workspaceId: context.workspaceId,
    title: context.title,
    state,
    step: null,
    error: played.ended && run.state !== "completed" ? run.reason : null,
    itemId: run.document,
    itemKind: context.itemKind,
    acknowledged: true,
    createdAt: context.startedAt,
    updatedAt: context.startedAt,
    runId: replayRunId(run.runId),
    trigger: "person",
  };
}

/** The replay's entry in the *Execution* list of its tab, as a run of the
 * document reads there. It names no group, so it offers no answers. */
export function replayExecutionRun(run: ReplayRun, played: ReplayPlayed, startedAt: number): ExecutionRun {
  return {
    id: replayRunId(run.runId),
    goal: run.words,
    status: replayState(run, played),
    agent: run.agent,
    group: null,
    source: run.block,
    touched: [],
    references: [],
    startedAt,
  };
}

/** The tab a replay plays in: its document's kind and view, an id of its
 * own, and the run it plays. */
export const replayTabId = (runId: string): string => `replay-tab-${runId}`;

/** Whether a key press is the replay's shortcut: `Ctrl+Alt+R`, or
 * `Cmd+Alt+R` on a Mac — read by the key's place, since `Alt` changes the
 * character a Mac types. */
export const isReplayShortcut = (event: {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}): boolean => event.code === "KeyR" && event.altKey && !event.shiftKey && (event.ctrlKey !== event.metaKey);
