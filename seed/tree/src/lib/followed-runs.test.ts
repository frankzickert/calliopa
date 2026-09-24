import { describe, expect, it } from "vitest";
import type { RunEvent } from "~/server/agent/run-events";
import { activitiesOf, followRun, marked, runEnded, sameActivities, unfinished, withEvents } from "./followed-runs";

/**
 * The runs the shell follows side by side: each is read until it ends, its
 * activity reaches the view of the document it is aimed at, and its end is
 * told once. BO_0269_014
 */

const activity = (document: string, action: string): RunEvent =>
  ({ kind: "documentActivity", activity: { document, scope: "blocks", action, blocks: ["b1"] }, at: 1 }) as unknown as RunEvent;
const ended = { kind: "runCompleted", at: 2 } as unknown as RunEvent;

describe("the runs a session follows", () => {
  it("Given two runs started, Then both are followed until each ends, and a restart of one replaces it", () => {
    let runs = followRun([], "arun-a", "doc-1", "codex");
    runs = followRun(runs, "arun-b", "doc-1", "claude-code");
    runs = followRun(runs, "arun-c", null, "hermes");
    expect(unfinished(runs).map((run) => run.id)).toEqual(["arun-a", "arun-b", "arun-c"]);
    runs = withEvents(runs, "arun-a", [activity("doc-1", "read"), ended]);
    expect(runEnded(runs[0]?.events ?? [])).toBe(true);
    expect(unfinished(runs).map((run) => run.id)).toEqual(["arun-b", "arun-c"]);
    expect(followRun(runs, "arun-b", "doc-2", "codex").map((run) => [run.id, run.artifact])).toEqual([
      ["arun-a", "doc-1"],
      ["arun-c", null],
      ["arun-b", "doc-2"],
    ]);
  });

  it("Given runs aimed at documents, Then each run's activity in its own document reaches the views, in the order they started", () => {
    let runs = followRun([], "arun-a", "doc-1", "codex");
    runs = followRun(runs, "arun-b", "doc-1", "claude-code");
    runs = followRun(runs, "arun-c", null, "hermes");
    runs = withEvents(runs, "arun-a", [activity("doc-1", "read"), activity("doc-9", "insert"), ended]);
    runs = withEvents(runs, "arun-b", [activity("doc-1", "insert")]);
    const heard = activitiesOf(runs);
    expect(heard.map((run) => [run.itemId, run.runId, run.agent, run.running, run.events.map((event) => event.action)])).toEqual([
      ["doc-1", "arun-a", "codex", false, ["read"]],
      ["doc-1", "arun-b", "claude-code", true, ["insert"]],
    ]);
    expect(sameActivities(heard, activitiesOf(runs))).toBe(true);
    expect(sameActivities(heard, activitiesOf(withEvents(runs, "arun-b", [activity("doc-1", "insert"), ended])))).toBe(false);
  });

  it("Given a run's end told, Then it is marked on that run alone", () => {
    let runs = followRun(followRun([], "arun-a", "doc-1", "codex"), "arun-b", "doc-2", "codex");
    runs = marked(runs, "arun-a", "announced");
    expect(runs.map((run) => [run.id, run.announced])).toEqual([
      ["arun-a", true],
      ["arun-b", false],
    ]);
  });
});
