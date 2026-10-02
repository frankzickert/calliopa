import { describe, expect, it } from "vitest";

import type { RunEvent } from "~/server/agent/run-events";
import {
  isReplayShortcut,
  playedOf,
  replayActivity,
  replayExecutionRun,
  replayProcess,
  replaySchedule,
  replayState,
  type ReplayRun,
} from "./replay";

/**
 * A replay's schedule and what it has shown, pure (`BO_0340_002`): the
 * command typed at its pace, the send, the events in their order and at their
 * recorded spacing with long waits capped, and the end.
 */
const started = (at: number): RunEvent => ({ kind: "runStarted", runId: "r1", at });
const activity = (at: number, action: string, block: string): RunEvent => ({
  kind: "documentActivity",
  runId: "r1",
  at,
  activity: { document: "doc-1", scope: "blocks", action, blocks: [block], group: "node:g1", member: `node:${block}` },
});
const completed = (at: number): RunEvent => ({ kind: "runCompleted", runId: "r1", at, output: "" });

const run: ReplayRun = {
  runId: "r1",
  words: "tighten",
  document: "doc-1",
  block: "blk-a",
  pin: 40,
  group: "node:g1",
  agent: "claude-code",
  state: "completed",
  reason: null,
  events: [started(1_000), activity(1_500, "read", "blk-a"), activity(61_500, "replace", "blk-a"), completed(62_000)],
};

describe("a replay's schedule", () => {
  it("Given a run, Then the words are typed a character at a time, sent after a beat, and each event follows at its recorded spacing", () => {
    const steps = replaySchedule(run, { typeMs: 60, capMs: 3000, sendPauseMs: 400 });
    const typed = steps.filter((step) => step.kind === "type");
    expect(typed.map((step) => (step.kind === "type" ? step.words : ""))).toEqual(["", "t", "ti", "tig", "tigh", "tight", "tighte", "tighten"]);
    expect(typed.map((step) => step.at)).toEqual([0, 60, 120, 180, 240, 300, 360, 420]);
    const send = steps.find((step) => step.kind === "send");
    expect(send?.at).toBe(820);
    const events = steps.filter((step) => step.kind === "event");
    // 500 ms kept; a minute of the model thinking capped to 3 s; 500 ms kept.
    expect(events.map((step) => step.at)).toEqual([820, 1320, 4320, 4820]);
    expect(steps.at(-1)).toEqual({ at: 4820, kind: "end" });
  });

  it("Given a clock that went backwards, Then the next event comes at once rather than before the last", () => {
    const steps = replaySchedule({ words: "", events: [started(5_000), completed(4_000)] }, { sendPauseMs: 0 });
    expect(steps.filter((step) => step.kind === "event").map((step) => step.at)).toEqual([0, 0]);
  });

  it("Given words outside the basic plane, Then a character is never split", () => {
    const steps = replaySchedule({ words: "a😀", events: [completed(1)] });
    expect(steps.flatMap((step) => (step.kind === "type" ? [step.words] : []))).toEqual(["", "a", "a😀"]);
  });

  it("Given the steps played so far, Then the entry is queued while typing, running once sent and ends as the original did", () => {
    const steps = replaySchedule(run);
    const typing = playedOf(steps, 3);
    expect(typing).toEqual({ words: "ti", sent: false, events: [], ended: false });
    expect(replayState(run, typing)).toBe("queued");
    const sendAt = steps.findIndex((step) => step.kind === "send") + 1;
    const going = playedOf(steps, sendAt + 2);
    expect(replayState(run, going)).toBe("running");
    expect(going.events.map((event) => event.kind)).toEqual(["runStarted", "documentActivity"]);
    const done = playedOf(steps, steps.length);
    expect(replayState({ ...run, state: "failed" }, done)).toBe("failed");
  });
});

describe("what a replay shows", () => {
  it("Given the run sent, Then its view takes the document activity alone, running until the end", () => {
    const steps = replaySchedule(run);
    expect(replayActivity(run, playedOf(steps, 2))).toBeNull();
    const all = playedOf(steps, steps.length);
    const shown = replayActivity(run, all);
    expect(shown?.runId).toBe("replay:r1");
    expect(shown?.running).toBe(false);
    expect(shown?.events.map((event) => event.action)).toEqual(["read", "replace"]);
  });

  it("Given a failed run played out, Then its transient process carries the original's title, state and reason, and its entry offers no answers", () => {
    const failed: ReplayRun = { ...run, state: "failed", reason: "The agent stopped." };
    const steps = replaySchedule(failed);
    const record = replayProcess(failed, playedOf(steps, steps.length), { title: "tighten", workspaceId: "w1", itemKind: "documents:document", startedAt: "2026-10-02T00:00:00.000Z" });
    expect(record).toMatchObject({ id: "replay-r1", runId: "replay:r1", title: "tighten", state: "failed", error: "The agent stopped.", itemId: "doc-1" });
    const midway = replayProcess(failed, playedOf(steps, 2), { title: "tighten", workspaceId: "w1", itemKind: "documents:document", startedAt: "" });
    expect(midway.error).toBeNull();
    expect(replayExecutionRun(failed, playedOf(steps, 2), 5)).toMatchObject({ id: "replay:r1", goal: "tighten", status: "queued", group: null, source: "blk-a" });
  });
});

describe("the replay's shortcut", () => {
  const press = (code: string, keys: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean }) => ({
    code,
    ctrlKey: keys.ctrl === true,
    metaKey: keys.meta === true,
    altKey: keys.alt === true,
    shiftKey: keys.shift === true,
  });
  it("Given Ctrl+Alt+R or Cmd+Alt+R, Then it is the shortcut, and nothing else is", () => {
    expect(isReplayShortcut(press("KeyR", { ctrl: true, alt: true }))).toBe(true);
    expect(isReplayShortcut(press("KeyR", { meta: true, alt: true }))).toBe(true);
    expect(isReplayShortcut(press("KeyR", { ctrl: true }))).toBe(false);
    expect(isReplayShortcut(press("KeyR", { alt: true }))).toBe(false);
    expect(isReplayShortcut(press("KeyR", { ctrl: true, alt: true, shift: true }))).toBe(false);
    expect(isReplayShortcut(press("KeyR", { ctrl: true, meta: true, alt: true }))).toBe(false);
    expect(isReplayShortcut(press("KeyT", { ctrl: true, alt: true }))).toBe(false);
  });
});
