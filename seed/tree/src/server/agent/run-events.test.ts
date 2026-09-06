import { describe, expect, it } from "vitest";

import {
  RUN_EVENT_CONTRACT_VERSION,
  readSseFrames,
  runStarted,
  translateRunEvent,
  type RunEvent,
} from "./run-events";

/**
 * Every payload below is the shape the pinned release emits on
 * `/v1/runs/{id}/events`, read off `gateway/platforms/api_server.py` rather
 * than invented. A bump that changes one of these should fail here.
 */
const frame = (event: Record<string, unknown>) =>
  `data: ${JSON.stringify(event)}\n\n`;

function eventOf(value: unknown): RunEvent {
  const translated = translateRunEvent(value);
  if (!translated.ok) {
    throw new Error(`expected a translated event: ${translated.detail}`);
  }
  return translated.event;
}

describe("Translating a run's events", () => {
  it("Given a message delta, When translated, Then it is assistant text", () => {
    expect(
      eventOf({
        event: "message.delta",
        run_id: "run_a",
        timestamp: 1000,
        delta: "half a sen",
      }),
    ).toEqual({
      kind: "assistantDelta",
      runId: "run_a",
      at: 1_000_000,
      text: "half a sen",
    });
  });

  it("Given a tool starting, When translated, Then it names the tool and its preview", () => {
    expect(
      eventOf({
        event: "tool.started",
        run_id: "run_a",
        timestamp: 2,
        tool: "read_document",
        preview: "reading",
      }),
    ).toEqual({
      kind: "toolStarted",
      runId: "run_a",
      at: 2000,
      tool: "read_document",
      preview: "reading",
    });
  });

  it("Given a tool completing, When translated, Then the release's boolean becomes a failure", () => {
    expect(
      eventOf({
        event: "tool.completed",
        run_id: "run_a",
        timestamp: 3,
        tool: "read_document",
        duration: 0.25,
        error: true,
      }),
    ).toEqual({
      kind: "toolCompleted",
      runId: "run_a",
      at: 3000,
      tool: "read_document",
      failed: true,
      seconds: 0.25,
    });
  });

  it("Given a run completing, When translated, Then it carries the output", () => {
    expect(
      eventOf({
        event: "run.completed",
        run_id: "run_a",
        timestamp: 4,
        output: "done",
        usage: { tokens: 12 },
      }),
    ).toEqual({
      kind: "runCompleted",
      runId: "run_a",
      at: 4000,
      output: "done",
    });
  });

  it("Given a run failing, When translated, Then it carries what went wrong", () => {
    expect(
      eventOf({
        event: "run.failed",
        run_id: "run_a",
        timestamp: 5,
        error: "the model refused",
      }),
    ).toEqual({
      kind: "runFailed",
      runId: "run_a",
      at: 5000,
      error: "the model refused",
    });
  });

  it("Given a run failing without a reason, Then it still says something", () => {
    const event = eventOf({ event: "run.failed", run_id: "run_a", timestamp: 5 });
    expect(event).toMatchObject({ kind: "runFailed" });
    expect("error" in event && event.error.length).toBeGreaterThan(0);
  });

  it("Given a run cancelled, When translated, Then it is the cancellation", () => {
    expect(
      eventOf({ event: "run.cancelled", run_id: "run_a", timestamp: 6 }),
    ).toEqual({ kind: "runCancelled", runId: "run_a", at: 6000 });
  });

  it("Given a run's acceptance, Then the lifecycle raises the start the stream never sends", () => {
    expect(runStarted("run_a", 7000)).toEqual({
      kind: "runStarted",
      runId: "run_a",
      at: 7000,
    });
  });
});

describe("Refusing to translate silently", () => {
  it("Given an event the release renamed, Then it is reported rather than dropped", () => {
    const translated = translateRunEvent({
      event: "run.finished",
      run_id: "run_a",
    });

    expect(translated.ok).toBe(false);
    expect(translated).toMatchObject({ name: "run.finished" });
  });

  it("Given an event the release knows and we do not carry, Then it is named", () => {
    for (const name of [
      "reasoning.available",
      "approval.request",
      "approval.responded",
    ]) {
      const translated = translateRunEvent({ event: name, run_id: "run_a" });
      expect(translated.ok, `${name} should not be carried`).toBe(false);
      expect(translated).toMatchObject({ name });
    }
  });

  it("Given an event naming no run, Then it is refused", () => {
    expect(translateRunEvent({ event: "run.completed" }).ok).toBe(false);
  });

  it("Given something that is not an event at all, Then it is refused", () => {
    expect(translateRunEvent("run.completed").ok).toBe(false);
    expect(translateRunEvent(null).ok).toBe(false);
    expect(translateRunEvent([]).ok).toBe(false);
  });

  it("Given a delta with no text, Then it is refused rather than read as empty", () => {
    expect(
      translateRunEvent({ event: "message.delta", run_id: "run_a" }).ok,
    ).toBe(false);
  });
});

describe("Reading the stream", () => {
  it("Given a chunk of frames, When read, Then each becomes one event in order", () => {
    const chunk = [
      frame({ event: "message.delta", run_id: "r", timestamp: 1, delta: "a" }),
      ": keepalive\n\n",
      frame({ event: "run.completed", run_id: "r", timestamp: 2, output: "x" }),
    ].join("");

    const kinds = readSseFrames(chunk).map((t) => (t.ok ? t.event.kind : "?"));
    expect(kinds).toEqual(["assistantDelta", "runCompleted"]);
  });

  it("Given a keepalive alone, Then it yields nothing to report", () => {
    expect(readSseFrames(": keepalive\n\n")).toEqual([]);
  });

  it("Given a malformed frame, Then the stream continues past it", () => {
    const chunk = `data: not json\n\n${frame({
      event: "run.cancelled",
      run_id: "r",
      timestamp: 9,
    })}`;

    const read = readSseFrames(chunk);
    expect(read[0]?.ok).toBe(false);
    expect(read[1]).toMatchObject({ ok: true, event: { kind: "runCancelled" } });
  });
});

describe("A stream the release actually produced", () => {
  /**
   * Captured verbatim from `GET /v1/runs/{id}/events` on the pinned release,
   * for a run started with no subscription signed in. The failure is the point:
   * it is the one terminal event reachable without a ChatGPT account, so it is
   * the one real frame the ordinary suite can hold. The gate captures a fresh
   * one on every run and asserts the shape still matches.
   */
  const captured =
    'data: {"event": "run.failed", "run_id": "run_0429da5db9e54294a33ac5272775a8e0", ' +
    '"timestamp": 1788176858.6199489, "error": "No Codex credentials stored. ' +
    'Run `hermes auth` to authenticate."}\n\n: stream closed\n\n';

  it("Given the release's own frames, When read, Then the contract carries them", () => {
    const read = readSseFrames(captured);

    expect(read).toHaveLength(1);
    expect(read[0]).toEqual({
      ok: true,
      event: {
        kind: "runFailed",
        runId: "run_0429da5db9e54294a33ac5272775a8e0",
        at: 1788176858620,
        error: "No Codex credentials stored. Run `hermes auth` to authenticate.",
      },
    });
  });

  it("Given the keepalive and close comments beside it, Then neither becomes an event", () => {
    expect(readSseFrames(": keepalive\n\n: stream closed\n\n")).toEqual([]);
  });
});

describe("The contract itself", () => {
  it("Given the version, Then it is stated so a consumer can pin it", () => {
    expect(RUN_EVENT_CONTRACT_VERSION).toBe(1);
  });
});
