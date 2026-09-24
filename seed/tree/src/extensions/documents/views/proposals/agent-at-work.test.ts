import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentActivity } from "~/server/agent/run-events";
import { READ_MARK_MS } from "../../lib/agent-at-work";
import type { DocumentView } from "../../server/assemble";
import type { DocumentProposals } from "../../server/documents";
import { documentsApi, mountEditor, type SentCommand } from "../testing/editor-harness";

/**
 * The agent at work in the document, pressed in Qwik's render harness: the
 * reader's run is handed over as the shell's poll hands it over, and the
 * editor marks the blocks it reads, shows its items as they are staged,
 * reports the run chips and answers a chip's Reject all. BO_0265_012
 * BO_0265_013 BO_0265_014
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
    { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "The storm arrives." }] },
  ],
};

const claude = { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" } as const;
const liveRewrite = "node:run-live|replace|node:blk-b";
const liveInsert = "node:run-live|insert|node:blk-new";
const oldRemoval = "node:run-old|remove|node:blk-a|c-a";

const proposals: DocumentProposals = {
  documentId: "doc-1",
  unanswered: 3,
  groups: [
    {
      groupId: "node:run-old",
      stagedBy: ["agent:hermes"],
      proposer: { kind: "agent", agent: "codex", executedBy: "codex" },
      run: { runId: "arun-old", stagedAt: 10 },
      items: [{ itemId: oldRemoval, groupId: "node:run-old", kind: "remove", blockId: "blk-a", block: null, note: "Says it twice" }],
    },
    {
      groupId: "node:run-live",
      stagedBy: ["agent:hermes"],
      proposer: claude,
      items: [
        {
          itemId: liveRewrite,
          groupId: "node:run-live",
          kind: "replace",
          blockId: "blk-b",
          block: { kind: "text", blockId: "blk-b", revisionId: "rev-b2", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "The storm arrives early." }] },
        },
        {
          itemId: liveInsert,
          groupId: "node:run-live",
          kind: "insert",
          blockId: "blk-new",
          block: { kind: "text", blockId: "blk-new", revisionId: "rev-n", containmentId: "", order: "c", role: "paragraph", standing: "keep", runs: [{ text: "A new line." }] },
        },
      ],
    },
  ],
};

/** The same proposals with a run on each group, so both stand as chips once
 * the runs have ended. */
const withRuns: DocumentProposals = {
  ...proposals,
  groups: proposals.groups.map((group) => (group.groupId === "node:run-live" ? { ...group, run: { runId: "arun-live", stagedAt: 20 } } : group)),
};

const readBlocks = (blocks: string[], note?: string): DocumentActivity => ({
  document: "doc-1",
  scope: "blocks",
  action: "read",
  blocks,
  ...(note === undefined ? {} : { note }),
});
const readDocument: DocumentActivity = { document: "doc-1", scope: "document", action: "read", blocks: [] };
const stagedRewrite: DocumentActivity = {
  document: "doc-1",
  scope: "blocks",
  action: "replace",
  blocks: ["blk-b"],
  group: "node:run-live",
  member: "node:blk-b",
  note: "Sharpens the claim",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (served: DocumentProposals = proposals) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent, { proposals: served }));
  const view = await mountEditor(draft);
  const waitFor = async (until: () => boolean) => {
    for (let tick = 0; tick < 200; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await view.userEvent(view.root, "harnessSettle");
      if (until()) return;
    }
    throw new Error("waited, and it did not happen");
  };
  /** Hands the view the reader's run, as the shell's poll does. */
  const run = async (running: boolean, events: DocumentActivity[]) => {
    view.record.activity = { runId: "arun-live", agent: "claude-code", running, events };
    await view.userEvent("[data-harness-activity]", "click");
    await view.settle();
  };
  // The harness's DOM answers a miss with undefined; the tests say null.
  const proposal = (itemId: string) => view.root.querySelector(`[data-proposal-id="${itemId}"]`) ?? null;
  const readMark = (blockId: string) => view.root.querySelector(`.agent-read-mark[data-agent-read="${blockId}"]`) ?? null;
  const commands = (name: string) => sent.filter((command) => command.body["command"] === name);
  return { ...view, waitFor, run, proposal, readMark, commands };
};

describe("the agent at work in the document", () => {
  it("Given the run reads named blocks, Then each carries the agent's face and words on its bottom border, and they go three seconds after the last read", { timeout: 15000 }, async () => {
    const view = await mount();
    await view.run(true, [readDocument]);
    // A whole-document read shows on the chip, never on every block.
    expect(view.root.querySelectorAll(".agent-read-mark").length).toBe(0);

    await view.run(true, [readDocument, readBlocks(["blk-b"], "Weighing the storm")]);
    const mark = view.readMark("blk-b");
    expect(mark?.textContent).toBe("Weighing the storm");
    expect(mark?.querySelector("img")?.getAttribute("src")).toBe("/agents/clauderic.webp");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(view.readMark("blk-a")).toBeNull();

    // Read again before the mark went: it stays three seconds from the new read.
    await new Promise((resolve) => setTimeout(resolve, READ_MARK_MS - 1000));
    await view.run(true, [readDocument, readBlocks(["blk-b"], "Weighing the storm"), readBlocks(["blk-b"])]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await view.settle();
    expect(view.readMark("blk-b")?.textContent).toBe("Reading");
    await view.waitFor(() => view.readMark("blk-b") === null);
    await view.settle();
  });

  it("Given the run stages, Then its items stand at their targets without the toggle, with the note as their words, while older groups stay behind it", { timeout: 10000 }, async () => {
    // The run's group exists once it has staged, as in the graph.
    const groups = [...proposals.groups];
    const served: DocumentProposals = { ...proposals, groups: groups.filter((group) => group.groupId === "node:run-old") };
    const view = await mount(served);
    expect(view.proposal(liveRewrite)).toBeNull();
    expect(view.proposal(oldRemoval)).toBeNull();

    (served.groups as DocumentProposals["groups"][number][]).push(...groups.filter((group) => group.groupId === "node:run-live"));
    await view.run(true, [readDocument, stagedRewrite]);
    await view.waitFor(() => view.proposal(liveRewrite) !== null);
    expect(view.proposal(liveRewrite)?.querySelector(".proposal-block__words")?.textContent).toBe("Sharpens the claim");
    expect(view.proposal(liveInsert)?.querySelector(".proposal-block__words")?.textContent).toBe("Proposes a new block");
    expect(view.proposal(oldRemoval)).toBeNull();

    // Answered while the run is going, and it stays answered.
    await view.userEvent(`[data-proposal-reject="${liveInsert}"]`, "click");
    await view.waitFor(() => view.commands("answerProposal").length === 1);

    // The run ends: its items stay until they are answered.
    await view.run(false, [readDocument, stagedRewrite]);
    expect(view.proposal(liveRewrite)).not.toBeNull();
    await view.settle();
  });

  it("Given the reader's run and older run groups, Then the view reports one chip each, the running one first without answers, and then what it did", { timeout: 10000 }, async () => {
    const view = await mount();
    await view.waitFor(() => view.record.chips !== undefined);
    expect(view.record.chips?.map((chip) => [chip.key, chip.text, chip.ended])).toEqual([["node:run-old", "1 removal", true]]);

    await view.run(true, [readDocument]);
    expect(view.record.chips?.map((chip) => [chip.key, chip.text, chip.ended])).toEqual([
      ["arun-live", "Reading the document", false],
      ["node:run-old", "1 removal", true],
    ]);
    await view.run(true, [readDocument, stagedRewrite]);
    await view.waitFor(() => view.record.chips?.[0]?.key === "node:run-live");
    expect(view.record.chips?.[0]).toMatchObject({ group: "node:run-live", text: "Proposing changes", ended: false, name: "Claude Code (claude-sonnet-5)", tone: "claude" });
    await view.settle();
  });

  it("Given two of the reader's runs going in the document at once, Then each marks with its own agent's face and has its own chip, and one run's end leaves the other's marks", { timeout: 15000 }, async () => {
    const view = await mount();
    // Codex reads the opening while Claude Code reads the storm. BO_0269_018
    view.record.activity = [
      { runId: "arun-codex", agent: "codex", running: true, events: [readBlocks(["blk-a"], "Checking the opening")] },
      { runId: "arun-live", agent: "claude-code", running: true, events: [readBlocks(["blk-b"], "Weighing the storm")] },
    ];
    await view.userEvent("[data-harness-activity]", "click");
    await view.settle();
    expect(view.readMark("blk-a")?.textContent).toBe("Checking the opening");
    expect(view.readMark("blk-a")?.querySelector("img")?.getAttribute("src")).toBe("/agents/codey.webp");
    expect(view.readMark("blk-b")?.textContent).toBe("Weighing the storm");
    expect(view.readMark("blk-b")?.querySelector("img")?.getAttribute("src")).toBe("/agents/clauderic.webp");
    await view.waitFor(() => (view.record.chips ?? []).filter((chip) => !chip.ended).length === 2);
    expect(view.record.chips?.filter((chip) => !chip.ended).map((chip) => [chip.key, chip.tone])).toEqual([
      ["arun-live", "claude"],
      ["arun-codex", "codex"],
    ]);

    // Codex ends; Claude Code keeps going and its mark stays.
    view.record.activity = { runId: "arun-codex", agent: "codex", running: false, events: [readBlocks(["blk-a"], "Checking the opening")] };
    await view.userEvent("[data-harness-activity]", "click");
    await view.settle();
    await view.waitFor(() => (view.record.chips ?? []).filter((chip) => !chip.ended).length === 1);
    expect(view.record.chips?.find((chip) => !chip.ended)?.key).toBe("arun-live");
    expect(view.readMark("blk-b")?.textContent).toBe("Weighing the storm");
    await view.settle();
  });

  it("Given the bar's toggle on a line of several, Then the newest change is shown alone, a chip's press moves the expansion, and its own press leaves none", { timeout: 15000 }, async () => {
    const view = await mount(withRuns);
    const block = (blockId: string) => view.root.querySelector(`.block-row[data-block-id="${blockId}"]`) ?? null;
    const shownChips = () => (view.record.chips ?? []).map((chip) => [chip.key, chip.shown]);

    // Turned on, the toggle expands the newest chip and shows that change
    // alone. CA_0061_009
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.waitFor(() => view.proposal(liveRewrite) !== null);
    // The rewrite stands in its block's place. CA_0055_005
    expect(block("blk-b")).toBeNull();
    expect(view.proposal(oldRemoval)).toBeNull();
    await view.waitFor(() => JSON.stringify(shownChips()) === JSON.stringify([["node:run-live", true], ["node:run-old", false]]));

    // The older run's chip takes the expansion: its change is drawn, the
    // newest one's is not, and the rewritten block comes back. CA_0061_008
    view.record.toggleRun = "node:run-old";
    await view.userEvent("[data-harness-toggle-run]", "click");
    await view.waitFor(() => view.proposal(oldRemoval) !== null);
    expect(view.proposal(liveRewrite)).toBeNull();
    expect(block("blk-b")).not.toBeNull();
    await view.waitFor(() => JSON.stringify(shownChips()) === JSON.stringify([["node:run-live", false], ["node:run-old", true]]));

    // Its own press collapses it, and the document stands with no change
    // drawn at all. CA_0061_008
    await view.userEvent("[data-harness-toggle-run]", "click");
    await view.waitFor(() => view.proposal(oldRemoval) === null);
    expect(view.proposal(liveRewrite)).toBeNull();
    await view.waitFor(() => shownChips().every(([, shown]) => shown === false));
    await view.settle();
  });

  it("Given a run still staging while another change is expanded, Then its items stand too, and its end takes the expansion", { timeout: 15000 }, async () => {
    const view = await mount(withRuns);
    const shownChips = () => (view.record.chips ?? []).map((chip) => [chip.key, chip.shown]);

    await view.run(true, [readDocument, stagedRewrite]);
    await view.waitFor(() => view.proposal(liveRewrite) !== null);

    // The older change is expanded while the run goes: the run's own items
    // stay, since they appear as it stages them. BO_0265_012 CA_0061_008
    view.record.toggleRun = "node:run-old";
    await view.userEvent("[data-harness-toggle-run]", "click");
    await view.waitFor(() => view.proposal(oldRemoval) !== null);
    expect(view.proposal(liveRewrite)).not.toBeNull();

    // The run ends: its chip is the expanded one and the other collapses.
    // CA_0061_010
    await view.run(false, [readDocument, stagedRewrite]);
    await view.waitFor(() => view.proposal(oldRemoval) === null);
    expect(view.proposal(liveRewrite)).not.toBeNull();
    await view.waitFor(() => JSON.stringify(shownChips()) === JSON.stringify([["node:run-live", true], ["node:run-old", false]]));
    await view.settle();
  });

  it("Given a change that lands while another stands shown, Then the newest is the expanded one and the rest collapse", { timeout: 15000 }, async () => {
    // A tab restored with its proposals shown turns the toggle on before it
    // has read them, so the line the rule acts on is empty; the same shape as
    // a group landing while several stand shown. CA_0061_009
    const groups = [...withRuns.groups];
    const served: DocumentProposals = { ...withRuns, groups: groups.filter((group) => group.groupId === "node:run-old") };
    const view = await mount(served);
    const shownChips = () => (view.record.chips ?? []).map((chip) => [chip.key, chip.shown]);
    await view.userEvent('[data-bar-action="proposed-changes"]', "click");
    await view.waitFor(() => view.proposal(oldRemoval) !== null);

    (served.groups as DocumentProposals["groups"][number][]).push(...groups.filter((group) => group.groupId === "node:run-live"));
    await view.run(false, [readDocument, stagedRewrite]);
    await view.waitFor(() => view.proposal(liveRewrite) !== null);
    expect(view.proposal(oldRemoval)).toBeNull();
    await view.waitFor(() => JSON.stringify(shownChips()) === JSON.stringify([["node:run-live", true], ["node:run-old", false]]));
    await view.settle();
  });

  it("Given the chips, Then each carries the number of changes its group holds", { timeout: 10000 }, async () => {
    const view = await mount(withRuns);
    await view.waitFor(() => (view.record.chips ?? []).length === 2);
    expect((view.record.chips ?? []).map((chip) => [chip.key, chip.text, chip.count])).toEqual([
      ["node:run-live", "1 rewrite, 1 insert", 2],
      ["node:run-old", "1 removal", 1],
    ]);
  });

  it("Given a run chip's Reject all, Then every unanswered item of its group is rejected, one at a time, and no other group's", { timeout: 10000 }, async () => {
    const view = await mount();
    view.record.answerAll = { group: "node:run-live", answer: "rejected" };
    await view.userEvent("[data-harness-answer-all]", "click");
    await view.waitFor(() => view.commands("answerProposal").length === 2);
    expect(view.commands("answerProposal").map((command) => command.body)).toEqual([
      { command: "answerProposal", itemId: liveRewrite, answer: "rejected" },
      { command: "answerProposal", itemId: liveInsert, answer: "rejected" },
    ]);
    await view.settle();
  });
});
