import { describe, expect, it } from "vitest";

import { parseSseFrames, translateBridgeEvent } from "./bridge";

/**
 * The bridge's normalized vocabulary maps onto the console's contract, and
 * its stream parses frame by frame. Both are pure; the transport is proven
 * where a kernel runs. BO_0207_015
 */
describe("translating bridge events", () => {
  it("Given each bridge event type, Then it becomes the contract's kind with its fields", () => {
    const at = 1_700_000_000_000;
    expect(translateBridgeEvent("r1", { type: "run.started", at })).toEqual({ kind: "runStarted", runId: "r1", at });
    expect(translateBridgeEvent("r1", { type: "assistant.delta", text: "hi", at })).toEqual({
      kind: "assistantDelta",
      runId: "r1",
      at,
      text: "hi",
    });
    expect(translateBridgeEvent("r1", { type: "tool.started", tool: "read_document", at })).toMatchObject({
      kind: "toolStarted",
      tool: "read_document",
      preview: null,
    });
    expect(translateBridgeEvent("r1", { type: "tool.completed", tool: "propose_document_changes", ok: false, at })).toMatchObject({
      kind: "toolCompleted",
      tool: "propose_document_changes",
      failed: true,
    });
    expect(translateBridgeEvent("r1", { type: "proposal.staged", group: "node:chg-1", at })).toMatchObject({
      kind: "assistantDelta",
      text: "Staged into proposal node:chg-1",
    });
    expect(translateBridgeEvent("r1", { type: "run.completed", text: "done", at })).toEqual({
      kind: "runCompleted",
      runId: "r1",
      at,
      output: "done",
    });
    expect(translateBridgeEvent("r1", { type: "run.failed", error: "no runtime", at })).toMatchObject({
      kind: "runFailed",
      error: "no runtime",
    });
    expect(translateBridgeEvent("r1", { type: "run.cancelled", at })).toEqual({ kind: "runCancelled", runId: "r1", at });
  });

  it("Given a type the contract does not know, Then it is reported as nothing rather than as something else", () => {
    expect(translateBridgeEvent("r1", { type: "reasoning.available", at: 1 })).toBeNull();
  });

  it("Given a stamp of zero, Then the event takes the time it was read", () => {
    const before = Date.now();
    const event = translateBridgeEvent("r1", { type: "run.started", at: 0 });
    expect(event?.at ?? 0).toBeGreaterThanOrEqual(before);
  });
});

describe("parsing the bridge's stream", () => {
  it("Given a chunk of frames, Then each carries its event name and parsed data", () => {
    const frames = parseSseFrames(
      'event: run.started\ndata: {"type":"run.started","at":5}\n\nevent: assistant.delta\ndata: {"type":"assistant.delta","text":"a","at":6}\n\nevent: end\ndata: {}\n\n',
    );
    expect(frames.map((frame) => frame.event)).toEqual(["run.started", "assistant.delta", "end"]);
    expect(frames[1]?.data).toEqual({ type: "assistant.delta", text: "a", at: 6 });
  });

  it("Given data that is not JSON, Then the frame is kept with no data rather than dropped", () => {
    const [frame] = parseSseFrames("event: odd\ndata: not json\n\n");
    expect(frame).toEqual({ event: "odd", data: null });
  });
});
