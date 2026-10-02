import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentActivity } from "~/server/agent/run-events";
import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * One read per answer (`DO_0024`), pressed in Qwik's render harness over a
 * slow proposals read: a run's stagings handed over in several batches show
 * every item with one read's answer, a burst of reads costs at most two, and
 * retiring a selection declines its proposals together. DO_0024_003
 * DO_0024_004
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "Closing." }] },
  ],
};

const group = "node:run-live";
const inserts = ["one", "two", "three", "four"].map((name, index) => ({
  itemId: `${group}|insert|node:blk-${name}`,
  groupId: group,
  kind: "insert",
  blockId: `blk-${name}`,
  block: { kind: "text", blockId: `blk-${name}`, revisionId: `rev-${name}`, containmentId: "", order: `b${index}`, role: "paragraph", standing: "keep", runs: [{ text: `Line ${name}.` }] },
}));
const staged: DocumentProposals = {
  documentId: "doc-1",
  unanswered: inserts.length,
  groups: [{ groupId: group, stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "claude-code", executedBy: "claude-code" }, items: inserts as never }],
};
const nothing: DocumentProposals = { documentId: "doc-1", unanswered: 0, groups: [] };

const stagedEvent = (name: string): DocumentActivity => ({
  document: "doc-1",
  scope: "blocks",
  action: "insert",
  blocks: [`blk-${name}`],
  group,
  member: `node:blk-${name}`,
});

const READ_MS = 1500;

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, READ_MS * 3));
  vi.unstubAllGlobals();
});

describe("one read per answer", () => {
  it("Given a run's stagings arriving in ten batches over a slow read, Then every item appears with one read's answer, and the reads are two at most", async () => {
    let served: DocumentProposals = nothing;
    let reads = 0;
    const sent: SentCommand[] = [];
    vi.stubGlobal(
      "fetch",
      documentsApi(draft, sent, {
        proposalsRead: () => served,
        proposalsDelayMs: () => {
          reads += 1;
          return READ_MS;
        },
      }),
    );
    const view = await mountEditor(draft, { awaitReads: false });
    await new Promise((resolve) => setTimeout(resolve, READ_MS * 2));
    await view.userEvent(view.root, "harnessSettle");
    reads = 0;

    // The kernel stages every item in one write; the events reach the view
    // in batches as the shell's poll hands them over.
    served = staged;
    const shown = () => inserts.filter((item) => view.root.querySelector(`[data-proposal-id="${item.itemId}"]`) !== null).length;
    const counts: number[] = [];
    const events: DocumentActivity[] = [];
    // Ten batches, the four stagings and then more events for them, each a
    // call to read the proposals again.
    for (const name of ["one", "two", "three", "four", "one", "two", "three", "four", "one", "two"]) {
      events.push(stagedEvent(name));
      view.record.activity = { runId: "arun-live", agent: "claude-code", running: true, events: [...events] };
      await view.userEvent("[data-harness-activity]", "click");
      await new Promise((resolve) => setTimeout(resolve, 30));
      counts.push(shown());
    }
    for (let tick = 0; tick < 400 && shown() < inserts.length; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await view.userEvent(view.root, "harnessSettle");
      counts.push(shown());
    }
    await new Promise((resolve) => setTimeout(resolve, READ_MS * 3));
    await view.userEvent(view.root, "harnessSettle");

    expect(shown()).toBe(inserts.length);
    // Never some of the items and not the rest: they arrive together.
    expect(counts.filter((count) => count > 0 && count < inserts.length)).toEqual([]);
    expect(reads).toBeLessThanOrEqual(2);
  }, 20_000);
});
