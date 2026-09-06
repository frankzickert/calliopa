import { describe, expect, it } from "vitest";

import { ageInWords, busyRefusal } from "./conductor";
import type { AgentRun } from "./runs";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000);

const holder = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "4f2a1c9e-0000-4000-8000-000000000001",
  processId: "p1",
  workspaceId: "w1",
  clientId: "c1",
  agentRunId: "run_abc",
  goal: "Draft the outline",
  runtime: "codex",
  model: null,
  baseDataRevision: "7",
  state: "running",
  startedAt: minutesAgo(7),
  ...overrides,
});

describe("A run's age in words", () => {
  it("Given a run raised seconds ago, Then it reads as less than a minute", () => {
    expect(ageInWords(minutesAgo(0), NOW)).toBe("less than a minute ago");
  });

  it("Given a run one minute old, Then the unit is singular", () => {
    expect(ageInWords(minutesAgo(1), NOW)).toBe("1 minute ago");
  });

  it("Given a run under an hour old, Then it reads in minutes", () => {
    expect(ageInWords(minutesAgo(59), NOW)).toBe("59 minutes ago");
  });

  it("Given a run over an hour old, Then it reads in hours", () => {
    expect(ageInWords(minutesAgo(150), NOW)).toBe("2 hours ago");
    expect(ageInWords(minutesAgo(60), NOW)).toBe("1 hour ago");
  });
});

describe("Refusing a goal while a run holds the slot", () => {
  it("Given the run belongs elsewhere, Then the refusal says where, what, since when, and which run", () => {
    expect(busyRefusal(holder(), "w2", NOW)).toBe(
      "The agent is running 'Draft the outline' in another workspace, " +
        "started 7 minutes ago. Run 4f2a1c9e-0000-4000-8000-000000000001.",
    );
  });

  it("Given the run belongs to the reader's own workspace, Then the refusal says so", () => {
    expect(busyRefusal(holder(), "w1", NOW)).toContain("in this workspace");
  });

  it("Given the run ended between the refusal and the read, Then the refusal claims nothing about it", () => {
    expect(busyRefusal(null, "w1", NOW)).toBe(
      "The agent took another goal a moment ago. Try again.",
    );
  });
});
