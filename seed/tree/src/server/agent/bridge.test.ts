import { afterEach, describe, expect, it, vi } from "vitest";

import { withRequestContext } from "../request-context";
import { followBridgeEvents, parseSseFrames, startBridgeRun, translateBridgeEvent } from "./bridge";

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

/**
 * The stream is the one bridge verb that cannot go through `ask`, because it
 * needs the body unread — and that is how it came to be the one verb that
 * carried no session. The kernel's prod listener refuses a session-less
 * request, so the omission cost the reader every event the run recorded,
 * including the reason it failed, and reported it as a bare 401 instead.
 * BO_0209_002
 */
describe("following a run's events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const stream = (): Response =>
    new Response("event: message\ndata: {\"type\":\"run.started\",\"at\":1}\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

  it("Given a request carrying a session, Then the stream is opened as that person", async () => {
    vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test");
    vi.stubEnv("CALLIOPA_KERNEL_URL", "http://kernel.test");
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      seen.push(new Headers(init.headers));
      return Promise.resolve(stream());
    });

    const events: string[] = [];
    const followed = await withRequestContext("calliopa_session=abc", () =>
      followBridgeEvents("arun-1", (event) => {
        events.push(event.kind);
      }),
    );

    expect(followed.ok).toBe(true);
    expect(seen[0]?.get("cookie")).toBe("calliopa_session=abc");
    expect(seen[0]?.get("accept")).toBe("text/event-stream");
    expect(events).toEqual(["runStarted"]);
  });
});

/**
 * A command aimed at a document says so in fields the kernel's intake has
 * taken since BO_0173 and BO_0226_001; one aimed at nothing sends none of them,
 * so a caller predating the change is told what it always was.
 */
describe("starting a run aimed at a document", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const accepted = (): Response =>
    new Response(JSON.stringify({ run: { id: "arun-1", goal: "g", staged: false, pin: 1, status: "running" } }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });

  const sentBodies = (): Record<string, unknown>[] => {
    vi.stubEnv("CALLIOPA_CCGW_URL", "http://ccgw.test");
    vi.stubEnv("CALLIOPA_KERNEL_URL", "http://kernel.test");
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Promise.resolve(accepted());
    });
    return bodies;
  };

  it("Given a target, Then the artifact, the delivery and the references travel in mark order", async () => {
    const bodies = sentBodies();
    await startBridgeRun({
      goal: "tighten #2",
      agent: "codex",
      target: {
        artifact: "doc-1",
        delivery: "propose",
        references: [
          { kind: "block", blockId: "blk-a", number: 1 },
          { kind: "passage", blockId: "blk-a", number: 2, quote: "a clause" },
          { kind: "block", blockId: "blk-b", number: 3 },
        ],
      },
    });
    // A passage travels with its words, a block with its identity alone, and
    // each says which it is. BO_0227_015
    expect(bodies[0]).toEqual({
      goal: "tighten #2",
      context: "",
      agent: "codex",
      artifact: "doc-1",
      delivery: "propose",
      references: [
        { kind: "block", number: 1, blockId: "blk-a" },
        { kind: "passage", number: 2, blockId: "blk-a", quote: "a clause" },
        { kind: "block", number: 3, blockId: "blk-b" },
      ],
    });
  });

  it("Given no target, Then none of the three is sent", async () => {
    const bodies = sentBodies();
    await startBridgeRun({ goal: "g", target: null });
    expect(bodies[0]).toEqual({ goal: "g", context: "", agent: "" });
  });
});
