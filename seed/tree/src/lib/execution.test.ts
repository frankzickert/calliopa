import { describe, expect, it } from "vitest";

import {
  executionGroups,
  executionProcess,
  executionRun,
  firstLineOf,
  isRunning,
  processRunning,
  stateWords,
  type ExecutionRun,
} from "./execution";

/**
 * What the panel's *Execution* section lists: the runs of a document — every
 * one, or with a block selected the runs sent from it and then the runs that
 * touched it — and the reader's other processes beside them.
 * BO_0267_010 CA_0058_008
 */
const run = (id: string, extra: Partial<ExecutionRun> = {}): ExecutionRun => ({
  id,
  goal: `command ${id}`,
  status: "completed",
  agent: "claude-code",
  group: `node:run-${id}`,
  source: null,
  touched: [],
  references: [],
  startedAt: 1,
  ...extra,
});

describe("the runs of a document by block", () => {
  const runs = [
    run("sent-from-b", { source: "blk-b", touched: ["blk-c"] }),
    run("touched-b", { touched: ["node:blk-b"] }),
    run("marked-b", { references: [{ number: 1, blockId: "blk-b" }] }),
    run("elsewhere", { source: "blk-a", touched: ["blk-a"] }),
  ];

  it("Given no block selected, Then every run is listed as it came", () => {
    expect(executionGroups(runs, null)).toEqual({ kind: "all", runs, elsewhere: [] });
  });

  it("Given a block selected, Then the runs from it come first and the runs that staged against it or marked it after, never twice", () => {
    const groups = executionGroups(runs, "blk-b");
    expect(groups.kind === "block" && groups.from.map((held) => held.id)).toEqual(["sent-from-b"]);
    expect(groups.kind === "block" && groups.touching.map((held) => held.id)).toEqual(["touched-b", "marked-b"]);
    // A run sent from a block that also touched it is listed once, as from it.
    const both = executionGroups([run("both", { source: "blk-c", touched: ["blk-c"] })], "blk-c");
    expect(both.kind === "block" && [both.from.length, both.touching.length]).toEqual([1, 0]);
  });

  it("Given a block no run concerns, Then both groups are empty", () => {
    expect(executionGroups(runs, "blk-z")).toEqual({ kind: "block", from: [], touching: [], elsewhere: [] });
  });
});

describe("the reader's other processes", () => {
  const runs = [
    run("sent-from-b", { source: "blk-b", touched: ["blk-c"] }),
    run("touched-b", { touched: ["node:blk-b"] }),
  ];
  const process = (id: string, runId: string | null) =>
    executionProcess({ id, title: `process ${id}`, state: "running", step: null, ...(runId === null ? {} : { runId }) });

  it("Given a process reporting a listed run, Then it is not listed again under Elsewhere", () => {
    const groups = executionGroups(runs, null, [process("p-1", "sent-from-b"), process("p-2", "arun-elsewhere"), process("p-3", null)]);
    expect(groups.elsewhere.map((held) => held.id)).toEqual(["p-2", "p-3"]);
  });

  it("Given a tab with no document, Then every process of the reader's is listed, runs and all", () => {
    const groups = executionGroups([], null, [process("p-1", "sent-from-b"), process("p-3", null)]);
    expect(groups.kind === "all" && groups.runs).toEqual([]);
    expect(groups.elsewhere.map((held) => held.id)).toEqual(["p-1", "p-3"]);
  });

  it("Given a block selected, Then the other processes stand beside the two groups", () => {
    const groups = executionGroups(runs, "blk-b", [process("p-2", "arun-elsewhere")]);
    expect(groups.kind === "block" && groups.from.length).toBe(1);
    expect(groups.elsewhere.map((held) => held.id)).toEqual(["p-2"]);
  });

  it("Given a process, Then what is running is what can be cancelled", () => {
    expect(processRunning(process("p-1", null))).toBe(true);
    expect(processRunning(executionProcess({ id: "p-4", title: "done", state: "completed", step: null }))).toBe(false);
    expect(executionProcess({ id: "p-5", title: "s", state: "running", step: "half", trigger: "system" }).system).toBe(true);
  });
});

describe("an entry's words", () => {
  it("Given a command of several lines, Then the entry shows the first", () => {
    expect(firstLineOf("  Tighten #1\nand keep the tone")).toBe("Tighten #1");
  });

  it("Given each state, Then it reads in the section's words, and a running run can be cancelled", () => {
    expect(["running", "completed", "failed", "cancelled"].map(stateWords)).toEqual(["running", "ended", "failed", "cancelled"]);
    expect(isRunning(run("r", { status: "running" }))).toBe(true);
    expect(isRunning(run("e"))).toBe(false);
  });

  it("Given a bridge record, Then the route answers what the section reads and nothing else", () => {
    expect(
      executionRun({
        id: "arun-1",
        goal: "What does #1 mean?",
        status: "running",
        agent: "codex",
        group: "",
        source: { block: "blk-b" },
        references: [{ number: 1, blockId: "blk-a", kind: "block" }],
        startedAt: 7,
      }),
    ).toEqual({
      id: "arun-1",
      goal: "What does #1 mean?",
      status: "running",
      agent: "codex",
      group: null,
      source: "blk-b",
      touched: [],
      references: [{ number: 1, blockId: "blk-a", kind: "block" }],
      startedAt: 7,
    });
  });
});
