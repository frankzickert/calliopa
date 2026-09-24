import { describe, expect, it } from "vitest";
import type { DocumentActivity } from "~/server/agent/run-events";
import type { DocumentProposals, ProposedChange } from "../server/documents";
import {
  groupShown,
  itemWords,
  liveGroupsOf,
  markWords,
  READ_MARK_MS,
  readMarks,
  refinerOf,
  revealGroup,
  runChipsOf,
  withdrawerOf,
  withdrawnCountOf,
  runningWords,
  shownAlone,
  summaryWords,
  toggledGroup,
} from "./agent-at-work";

const item = (kind: string, member: string, extra: Partial<ProposedChange> = {}): ProposedChange => ({
  itemId: `node:run-a|${kind}|${member}`,
  groupId: "node:run-a",
  kind,
  blockId: member.replace(/^node:/u, ""),
  block: null,
  ...extra,
});

const read = (blocks: string[], note?: string): DocumentActivity => ({
  document: "doc-1",
  scope: blocks.length === 0 ? "document" : "blocks",
  action: "read",
  blocks,
  ...(note === undefined ? {} : { note }),
});

describe("the agent at work in the document", () => {
  it("Given an operation, Then its words are derived, and the agent's own note replaces them", () => {
    expect(markWords("read")).toBe("Reading");
    expect(markWords("replace")).toBe("Proposes a rewrite");
    expect(markWords("insert")).toBe("Proposes a new block");
    expect(markWords("remove")).toBe("Proposes removal");
    expect(markWords("move")).toBe("Proposes a move");
    expect(markWords("replace", "Tightens the definition")).toBe("Tightens the definition");
    expect(markWords("replace", "  ")).toBe("Proposes a rewrite");
  });

  it("Given an item, Then its words are the note its staging reported while the run goes, and the recorded note after", () => {
    const rewrite = item("replace", "node:blk-b", { note: "Recorded" });
    expect(itemWords(rewrite, [])).toBe("Recorded");
    const staged: DocumentActivity = { document: "doc-1", scope: "blocks", action: "replace", blocks: ["blk-b"], member: "node:blk-b", note: "Live" };
    expect(itemWords(rewrite, [staged])).toBe("Live");
    expect(itemWords(item("insert", "node:blk-n"), [staged])).toBe("Proposes a new block");
  });

  it("Given a refined item, Then its words say whose proposal they refine, and its refiner is the run's provenance or the live run's agent", () => {
    // BO_0271_011
    const codex = { kind: "agent", agent: "codex", executedBy: "codex" } as const;
    const known = item("replace", "node:blk-b", { refinedBy: { runId: "arun-r", proposer: { kind: "agent", agent: "claude-code", executedBy: "" } } });
    expect(itemWords(known, [], codex)).toBe("Proposes a rewrite, refining Codex's rewrite");
    expect(itemWords(known, [])).toBe("Proposes a rewrite, refining an earlier rewrite");
    expect(itemWords({ ...known, note: "Sharpens the claim" }, [], codex)).toBe("Sharpens the claim, refining Codex's rewrite");
    expect(itemWords(item("replace", "node:blk-b"), [], codex)).toBe("Proposes a rewrite");
    expect(refinerOf(known, [])).toEqual({ kind: "agent", agent: "claude-code", executedBy: "" });
    // The refining run still going: its provenance has not landed, and its
    // agent is the one its activity names.
    const going = item("replace", "node:blk-b", { refinedBy: { runId: "arun-r", proposer: { kind: "agent", agent: null, executedBy: "" } } });
    expect(refinerOf(going, [{ runId: "arun-r", agent: "hermes", running: true, events: [] }])).toEqual({ kind: "agent", agent: "hermes", executedBy: "" });
    expect(refinerOf(going, [])).toEqual({ kind: "agent", agent: null, executedBy: "" });
    expect(refinerOf(item("replace", "node:blk-b"), [])).toBeNull();
  });

  it("Given a withdrawn item, Then its words say whose proposal should go and why, its withdrawer is resolved like a refiner, and its successor counts it", () => {
    // BO_0286_009 BO_0286_011
    const codex = { kind: "agent", agent: "codex", executedBy: "codex" } as const;
    const hermes = { kind: "agent", agent: "hermes", executedBy: "" } as const;
    const withReason = item("insert", "node:blk-n", { withdrawal: { runId: "arun-w", proposer: hermes, successor: "node:run-a|replace|node:blk-b", reason: "folded into the rewrite" } });
    expect(itemWords(withReason, [], codex)).toBe("Proposes to withdraw Codex's new block: folded into the rewrite");
    const bySuccessor = item("replace", "node:blk-c", { withdrawal: { runId: "arun-w", proposer: hermes, successor: "node:run-a|replace|node:blk-b" } });
    expect(itemWords(bySuccessor, [], codex)).toBe("Proposes to withdraw Codex's rewrite, superseded by its replacement");
    expect(itemWords(bySuccessor, [])).toBe("Proposes to withdraw the rewrite, superseded by its replacement");
    const removal = item("remove", "node:blk-d", { withdrawal: { runId: "arun-w", proposer: hermes } });
    expect(itemWords(removal, [], codex)).toBe("Proposes to withdraw Codex's removal — the block stays as it stands");
    // Withdrawn wins over refined: the item reads as withdrawn.
    const both = item("replace", "node:blk-e", { refinedBy: { runId: "arun-r", proposer: codex }, withdrawal: { runId: "arun-w", proposer: hermes, reason: "surplus" } });
    expect(itemWords(both, [], codex)).toBe("Proposes to withdraw Codex's rewrite: surplus");
    expect(withdrawerOf(withReason, [])).toEqual(hermes);
    const going = item("insert", "node:blk-n", { withdrawal: { runId: "arun-w", proposer: { kind: "agent", agent: null, executedBy: "" } } });
    expect(withdrawerOf(going, [{ runId: "arun-w", agent: "claude-code", running: true, events: [] }])).toEqual({ kind: "agent", agent: "claude-code", executedBy: "" });
    expect(withdrawerOf(item("insert", "node:blk-n"), [])).toBeNull();
    const proposals: DocumentProposals = { documentId: "doc-1", unanswered: 3, groups: [{ groupId: "node:run-a", stagedBy: [], proposer: codex, items: [withReason, bySuccessor, removal] }] };
    expect(withdrawnCountOf("node:run-a|replace|node:blk-b", proposals)).toBe(2);
    expect(withdrawnCountOf("node:run-a|replace|node:blk-z", proposals)).toBe(0);
    expect(withdrawnCountOf("node:run-a|replace|node:blk-b", null)).toBe(0);
  });

  it("Given a successor to show, Then its group is shown beside what is shown, never in its place", () => {
    // BO_0286_012
    expect(revealGroup("node:run-b", { proposalsOpen: false, shownGroups: ["node:run-a"], hiddenGroups: [] })).toEqual({ shownGroups: ["node:run-a", "node:run-b"], hiddenGroups: [] });
    expect(revealGroup("node:run-a", { proposalsOpen: false, shownGroups: ["node:run-a"], hiddenGroups: [] })).toEqual({ shownGroups: ["node:run-a"], hiddenGroups: [] });
    expect(revealGroup("node:run-b", { proposalsOpen: true, shownGroups: [], hiddenGroups: ["node:run-b", "node:run-c"] })).toEqual({ shownGroups: [], hiddenGroups: ["node:run-c"] });
  });

  it("Given reads, Then each named block is marked for three seconds from its last read, and a whole-document read marks none", () => {
    const first = readMarks({}, [read([]), read(["blk-a", "blk-b"], "Checking")], 1000);
    expect(first).toEqual({
      "blk-a": { words: "Checking", until: 1000 + READ_MARK_MS, agent: null },
      "blk-b": { words: "Checking", until: 1000 + READ_MARK_MS, agent: null },
    });
    // A read by another run marks with that run's agent. BO_0269_018
    const again = readMarks(first, [read(["blk-a"])], 2500, "codex");
    expect(again["blk-a"]).toEqual({ words: "Reading", until: 2500 + READ_MARK_MS, agent: "codex" });
    expect(again["blk-b"]?.until).toBe(1000 + READ_MARK_MS);
    const later = readMarks(again, [], 1000 + READ_MARK_MS);
    expect(Object.keys(later)).toEqual(["blk-a"]);
  });

  it("Given two of the reader's runs going in one document, Then each has its own running chip, newest first, and each staged group is a chip once", () => {
    const codex = { kind: "agent", agent: "codex", executedBy: "codex" } as const;
    const proposals: DocumentProposals = {
      documentId: "doc-1",
      unanswered: 2,
      groups: [
        { groupId: "node:run-one", stagedBy: ["agent:hermes"], proposer: codex, run: { runId: "arun-one", stagedAt: 10 }, items: [item("insert", "node:a")] },
        { groupId: "node:run-done", stagedBy: ["agent:hermes"], proposer: codex, run: { runId: "arun-done", stagedAt: 5 }, items: [item("replace", "node:b")] },
      ],
    };
    const staging: DocumentActivity = { document: "doc-1", scope: "blocks", action: "insert", blocks: ["a"], group: "node:run-one" };
    const chips = runChipsOf(proposals, [
      { runId: "arun-one", agent: "codex", running: true, events: [staging] },
      { runId: "arun-two", agent: "claude-code", running: true, events: [read([])] },
      { runId: "arun-done", agent: "codex", running: false, events: [] },
    ]);
    expect(chips.map((chip) => [chip.key, chip.text, chip.ended, chip.tone])).toEqual([
      ["arun-two", "Reading the document", false, "claude"],
      ["node:run-one", "Proposing changes", false, "codex"],
      ["node:run-done", "1 rewrite", true, "codex"],
    ]);
  });

  it("Given what a run left, Then the chip counts it by kind", () => {
    expect(summaryWords([item("replace", "node:a"), item("replace", "node:b"), item("replace", "node:c"), item("insert", "node:d")])).toBe("3 rewrites, 1 insert");
    expect(summaryWords([item("remove", "node:a"), item("relate", "node:r")])).toBe("1 removal, 1 change");
    expect(runningWords([])).toBe("Starting");
    expect(runningWords([read([])])).toBe("Reading the document");
    expect(runningWords([read([]), { document: "doc-1", scope: "blocks", action: "insert", blocks: ["n"] }])).toBe("Proposing changes");
  });

  it("Given open groups and the reader's run, Then one chip per run group, newest first, the running one first and without answers, and none for a branch", () => {
    const claude = { kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" } as const;
    const proposals: DocumentProposals = {
      documentId: "doc-1",
      unanswered: 4,
      groups: [
        { groupId: "node:run-old", stagedBy: ["agent:hermes"], proposer: { kind: "agent", agent: "codex", executedBy: "codex" }, run: { runId: "arun-old", stagedAt: 10 }, items: [item("remove", "node:x")] },
        { groupId: "node:run-new", stagedBy: ["agent:hermes"], proposer: claude, run: { runId: "arun-new", stagedAt: 20 }, items: [item("replace", "node:y")] },
        { groupId: "node:branch-doc-1-frank", stagedBy: ["frankzickert"], proposer: { kind: "person", name: "frankzickert" }, items: [item("replace", "node:z")] },
        { groupId: "node:run-live", stagedBy: ["agent:hermes"], proposer: claude, items: [item("insert", "node:n")] },
      ],
    };
    const ended = runChipsOf(proposals, []);
    expect(ended.map((chip) => [chip.key, chip.text, chip.ended])).toEqual([
      ["node:run-new", "1 rewrite", true],
      ["node:run-old", "1 removal", true],
    ]);
    expect(ended[0]?.name).toBe("Claude Code (claude-sonnet-5)");
    expect(ended[0]?.tone).toBe("claude");

    const staging: DocumentActivity = { document: "doc-1", scope: "blocks", action: "insert", blocks: ["n"], group: "node:run-live" };
    const running = runChipsOf(proposals, [{ runId: "arun-live", agent: "claude-code", running: true, events: [read([]), staging] }]);
    expect(running.map((chip) => [chip.key, chip.text, chip.ended])).toEqual([
      ["node:run-live", "Proposing changes", false],
      ["node:run-new", "1 rewrite", true],
      ["node:run-old", "1 removal", true],
    ]);

    const before = runChipsOf(null, [{ runId: "arun-live", agent: "codex", running: true, events: [read([])] }]);
    expect(before).toEqual([
      { key: "arun-live", group: null, face: { kind: "image", src: expect.any(String) }, tone: "codex", name: "Codex", text: "Reading the document", ended: false, shown: true },
    ]);
  });

  it("Given an ended group, Then its chip carries the number its words count, and a run still going carries none", () => {
    const codex = { kind: "agent", agent: "codex", executedBy: "codex" } as const;
    const proposals: DocumentProposals = {
      documentId: "doc-1",
      unanswered: 4,
      groups: [
        {
          groupId: "node:run-done",
          stagedBy: ["agent:hermes"],
          proposer: codex,
          run: { runId: "arun-done", stagedAt: 10 },
          items: [item("replace", "node:a"), item("replace", "node:b"), item("replace", "node:c"), item("insert", "node:d")],
        },
      ],
    };
    const [ended] = runChipsOf(proposals, []);
    expect([ended?.text, ended?.count]).toEqual(["3 rewrites, 1 insert", 4]);
    const [running] = runChipsOf(proposals, [{ runId: "arun-live", agent: "codex", running: true, events: [read([])] }]);
    expect(running?.count).toBeUndefined();
  });

  it("Given a line of one, Then a press flips that change alone, as each change is shown on its own", () => {
    const open = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] };
    expect(toggledGroup("node:run-a", open, { groups: ["node:run-a"], live: [] })).toEqual({ shownGroups: [], hiddenGroups: ["node:run-a"] });
    const closed = { proposalsOpen: false, shownGroups: [], hiddenGroups: [] };
    expect(toggledGroup("node:run-a", closed, { groups: ["node:run-a"], live: [] })).toEqual({ shownGroups: ["node:run-a"], hiddenGroups: [] });
  });

  it("Given a line of several, Then showing one hides every other, and collapsing it leaves none shown", () => {
    const line = { groups: ["node:run-a", "node:run-b", "node:run-c"], live: [] };
    const open = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] };
    const shownB = toggledGroup("node:run-b", { ...open, hiddenGroups: ["node:run-b"] }, line);
    expect(shownB.hiddenGroups).toEqual(["node:run-a", "node:run-c"]);
    expect(groupShown("node:run-b", { ...open, ...shownB })).toBe(true);
    expect(groupShown("node:run-a", { ...open, ...shownB })).toBe(false);
    const collapsed = toggledGroup("node:run-b", { ...open, ...shownB }, line);
    expect(collapsed.hiddenGroups).toEqual(["node:run-a", "node:run-b", "node:run-c"]);
    expect(line.groups.every((group) => !groupShown(group, { ...open, ...collapsed }))).toBe(true);
  });

  it("Given a run still staging, Then another chip's expansion leaves its items, and its own chip still hides them", () => {
    const line = { groups: ["node:run-live", "node:run-a", "node:run-b"], live: ["node:run-live"] };
    const closed = { proposalsOpen: false, shownGroups: ["node:run-live"], hiddenGroups: [] };
    const shownA = toggledGroup("node:run-a", closed, line);
    expect(shownA.shownGroups).toEqual(["node:run-live", "node:run-a"]);
    const hidLive = toggledGroup("node:run-live", { ...closed, ...shownA }, line);
    expect(hidLive.shownGroups).toEqual([]);
    const open = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] };
    expect(toggledGroup("node:run-a", { ...open, hiddenGroups: ["node:run-a"] }, line).hiddenGroups).toEqual(["node:run-b"]);
  });

  it("Given a line of several, Then one group can be shown alone, and none at all", () => {
    const line = { groups: ["node:run-a", "node:run-b"], live: [] };
    const open = { proposalsOpen: true, shownGroups: [], hiddenGroups: [] };
    expect(shownAlone("node:run-a", open, line).hiddenGroups).toEqual(["node:run-b"]);
    expect(shownAlone(null, open, line).hiddenGroups).toEqual(["node:run-a", "node:run-b"]);
    const closed = { proposalsOpen: false, shownGroups: ["node:run-b"], hiddenGroups: [] };
    expect(shownAlone("node:run-a", closed, line).shownGroups).toEqual(["node:run-a"]);
  });

  it("Given the runs the view holds, Then the ones still going name the groups their items keep landing in", () => {
    const staging: DocumentActivity = { document: "doc-1", scope: "blocks", action: "insert", blocks: ["a"], group: "node:run-live" };
    expect(
      liveGroupsOf([
        { runId: "arun-live", agent: "codex", running: true, events: [staging] },
        { runId: "arun-done", agent: "codex", running: false, events: [{ ...staging, group: "node:run-done" }] },
        { runId: "arun-quiet", agent: "codex", running: true, events: [read([])] },
      ]),
    ).toEqual(["node:run-live"]);
  });
});
