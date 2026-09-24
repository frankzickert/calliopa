import { describe, expect, it } from "vitest";
import { endedForDocuments } from "./ended-processes";
import type { ProcessState } from "./process";

/**
 * A process that ended for a document is told to the view showing it once,
 * whatever opened the process, unless a run this session follows tells it
 * itself. CA_0063_001
 */

const process = (id: string, state: ProcessState, itemId: string | null, runId?: string) => ({
  id,
  state,
  itemId,
  ...(runId === undefined ? {} : { runId }),
});

describe("the processes that ended for a document", () => {
  it("Given a sender's process completed for an open document, Then the document is raised once and the process is remembered", () => {
    const first = endedForDocuments([process("p1", "completed", "doc-1")], [], []);
    expect(first.itemIds).toEqual(["doc-1"]);
    expect(first.announced).toEqual(["p1"]);
    const again = endedForDocuments([process("p1", "completed", "doc-1")], first.announced, []);
    expect(again.itemIds).toEqual([]);
    expect(again.announced).toEqual(["p1"]);
  });

  it("Given a process that failed for a document, Then it is raised too, since the pending block is what the reader rejects", () => {
    expect(endedForDocuments([process("p1", "failed", "doc-1")], [], []).itemIds).toEqual(["doc-1"]);
  });

  it("Given a process still going, or one without an item, Then nothing is raised and nothing remembered", () => {
    const outcome = endedForDocuments(
      [process("p1", "running", "doc-1"), process("p2", "queued", "doc-1"), process("p3", "completed", null)],
      [],
      [],
    );
    expect(outcome.itemIds).toEqual([]);
    expect(outcome.announced).toEqual([]);
  });

  it("Given a run this session follows ended for a document, Then the poll leaves it to the run's own events", () => {
    const outcome = endedForDocuments([process("p1", "completed", "doc-1", "arun-a")], [], [{ id: "arun-a" }]);
    expect(outcome.itemIds).toEqual([]);
    expect(outcome.announced).toEqual([]);
  });

  it("Given a run started in another session ended for a document, Then it is raised as any other process", () => {
    expect(endedForDocuments([process("p1", "completed", "doc-1", "arun-old")], [], [{ id: "arun-a" }]).itemIds).toEqual(["doc-1"]);
  });

  it("Given several processes ended in one poll, Then each document is raised once in the poll's order", () => {
    const outcome = endedForDocuments(
      [process("p1", "completed", "doc-2"), process("p2", "failed", "doc-1"), process("p3", "completed", "doc-2")],
      [],
      [],
    );
    expect(outcome.itemIds).toEqual(["doc-2", "doc-1"]);
    expect(outcome.announced).toEqual(["p1", "p2", "p3"]);
  });
});
