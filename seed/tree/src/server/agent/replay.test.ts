import { describe, expect, it } from "vitest";

import type { BridgeRun } from "./bridge";
import { replayOf } from "./replay";

/**
 * What a replay plays of a run's record, and each refusal in its own words
 * (`BO_0340_001`). Pure; the read itself is the bridge's `readBridgeRun`.
 */
const record: BridgeRun = {
  id: "arun-1",
  goal: "make this tighter",
  staged: true,
  pin: 40,
  status: "completed",
  agent: "codex",
  group: "node:g1",
  artifact: "doc-1",
  source: { block: "blk-a", revisionId: "rev-1" },
  events: [
    { type: "run.started", at: 1000 },
    { type: "document.activity", document: "doc-1", group: "node:g1", activity: { scope: "blocks", action: "replace", blocks: ["blk-a"], member: "node:blk-a" }, at: 2000 },
    { type: "run.completed", text: "", at: 3000 },
  ],
};

describe("a run's record read for a replay", () => {
  it("Given an ended run sent from a block, Then the replay carries its words, document, block, pin, group, agent and events with their times", () => {
    const replay = replayOf(record);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value).toMatchObject({ runId: "arun-1", words: "make this tighter", document: "doc-1", block: "blk-a", pin: 40, group: "node:g1", agent: "codex", state: "completed", reason: null });
    expect(replay.value.events.map((event) => [event.kind, event.at])).toEqual([
      ["runStarted", 1000],
      ["documentActivity", 2000],
      ["runCompleted", 3000],
    ]);
  });

  it("Given a failed or cancelled run, Then the reason is the one its end gave", () => {
    const failed = replayOf({ ...record, status: "failed", events: [{ type: "run.started", at: 1 }, { type: "run.failed", error: "No provider.", at: 2 }] });
    expect(failed.ok && failed.value.reason).toBe("No provider.");
    const cancelled = replayOf({ ...record, status: "cancelled", events: [{ type: "run.cancelled", at: 2 }] });
    expect(cancelled.ok && cancelled.value.reason).toBe("The run was cancelled.");
  });

  it("Given a run still going, one sent from no block, or one whose record holds no events, Then each is refused in its own words", () => {
    expect(replayOf({ ...record, status: "running" })).toMatchObject({ ok: false, status: 409, detail: expect.stringContaining("still going") });
    const { source: _source, artifact: _artifact, ...unsent } = record;
    expect(replayOf({ ...unsent, artifact: "doc-1" })).toMatchObject({ ok: false, status: 409, detail: expect.stringContaining("not sent from a block") });
    expect(replayOf({ ...unsent, source: { block: "blk-a", revisionId: "rev-1" } })).toMatchObject({ ok: false, status: 409 });
    expect(replayOf({ ...record, events: [] })).toMatchObject({ ok: false, status: 410, detail: expect.stringContaining("can no longer be replayed") });
  });
});
