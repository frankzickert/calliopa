import { describe, expect, it } from "vitest";

import type { DocumentView } from "../../documents/server/assemble";
import { acceptanceReading, branchItemsOf, hasDrifted, isRunRecord, memberOf, rejectedEntries, runRecordsOf, sessionChipsOf, sessionWords, standingWords, type Standing } from "./branch";
import { branchOf, enterBranch, leaveBranch, withBranch, withBranchBody } from "../../documents/lib/branch-scope";

/**
 * The branch's pure readings (`BO_0250`): the registry the client helpers
 * consult, a member's standing in words, the acceptance card's reading from
 * the standing and the person's choices, the branch's members, and what a
 * rejected branch held that truth does not.
 */

const standing = (members: Standing["members"]): Standing => ({ proposal: "node:branch-doc-1-alice", status: "open", base: 10, head: 12, members });

describe("the branch registry", () => {
  it("Given a tab entered a branch, Then its reads carry the overlay and its commands the branch, and leaving clears both", () => {
    enterBranch("doc-1", "node:branch-doc-1-alice");
    expect(branchOf("doc-1")).toBe("node:branch-doc-1-alice");
    expect(withBranch("/api/x/documents/d/doc-1", "doc-1")).toBe("/api/x/documents/d/doc-1?branch=node%3Abranch-doc-1-alice");
    expect(withBranch("/api/x/documents/d/doc-1/branch?account=me", "doc-1")).toContain("&branch=");
    expect(withBranchBody({ command: "revise" }, "doc-1")).toEqual({ command: "revise", branch: "node:branch-doc-1-alice" });
    leaveBranch("doc-1");
    expect(branchOf("doc-1")).toBeNull();
    expect(withBranch("/api/x/documents/d/doc-1", "doc-1")).toBe("/api/x/documents/d/doc-1");
    expect(withBranchBody({ command: "revise" }, "doc-1")).toEqual({ command: "revise" });
    expect(withBranch("/x", "doc-1", "node:rejected")).toBe("/x?branch=node%3Arejected");
  });
});

describe("the acceptance card's reading", () => {
  it("Given a standing with no drifted member, Then Accept stands at once and each member's standing is named", () => {
    const reading = acceptanceReading({
      standing: standing([
        { ref: "node:a", kind: "node", standing: "clean" },
        { ref: "node:b", kind: "node", standing: "autoCorrected" },
      ]),
      choices: {},
    });
    expect(reading.accept).toBe(true);
    expect(reading.waiting).toBe(false);
    expect(reading.members.map((member) => member.words)).toEqual(["unchanged", "moved beneath it, corrected on acceptance"]);
    expect(standingWords("drifted")).toBe("moved under it: keep yours, drop it, or rewrite it");
  });

  it("Given a drifted member, Then Accept waits for the person's choice, and stands once every drifted member is kept or dropped", () => {
    const drifted = standing([
      { ref: "node:a", kind: "node", standing: "drifted" },
      { ref: "node:b", kind: "node", standing: "drifted" },
      { ref: "node:c", kind: "node", standing: "clean" },
    ]);
    expect(hasDrifted(drifted)).toBe(true);
    const open = acceptanceReading({ standing: drifted, choices: {} });
    expect(open).toMatchObject({ accept: false, waiting: false });
    expect(open.note).toContain("Keep your words");
    const half = acceptanceReading({ standing: drifted, choices: { "node:a": "keep" } });
    expect(half.accept).toBe(false);
    expect(half.members.map((member) => member.choice)).toEqual(["keep", null, null]);
    const chosen = acceptanceReading({ standing: drifted, choices: { "node:a": "keep", "node:b": "drop" } });
    expect(chosen).toMatchObject({ accept: true, note: null });
  });

  it("Given a run's record among the members, Then the card leaves it out and the record is still named for answering", () => {
    const withRun = standing([
      { ref: "node:blk-a", kind: "node", standing: "clean" },
      { ref: "node:run:arun-1", kind: "node", standing: "clean" },
    ]);
    const reading = acceptanceReading({ standing: withRun, choices: {} });
    expect(reading.members.map((member) => member.ref)).toEqual(["node:blk-a"]);
    expect(runRecordsOf(withRun)).toEqual(["node:run:arun-1"]);
    expect(isRunRecord("node:run-1")).toBe(false);
    expect(acceptanceReading({ standing: standing([{ ref: "node:run:arun-1", kind: "node", standing: "clean" }]), choices: {} }).lead).toBe("Nothing is in this proposal yet.");
  });

  it("Given a branch nothing was staged into, Then the card says so and offers no Accept", () => {
    expect(acceptanceReading({ standing: standing([]), choices: {} })).toMatchObject({ accept: false, waiting: false, lead: "Nothing is in this proposal yet." });
  });

  it("Given no standing yet or a failure, Then the card waits or names the failure without Accept", () => {
    expect(acceptanceReading({ standing: null, choices: {} })).toMatchObject({ waiting: true, accept: false });
    expect(acceptanceReading({ standing: null, choices: {}, failure: "The core refused." })).toMatchObject({ waiting: false, accept: false, lead: "The core refused." });
  });
});

describe("the branch's members and a rejected branch", () => {
  const proposals = {
    groups: [
      { groupId: "node:branch-doc-1-alice", items: [{ itemId: "i-1", blockId: "blk-a", kind: "replace" }, { itemId: "i-2", blockId: "blk-b", kind: "insert" }] },
      { groupId: "node:run-1", items: [{ itemId: "i-3", blockId: "blk-a", kind: "kind" }] },
    ],
  };

  it("Given the proposals read, Then the branch's items are its group's and a block's member is found or not", () => {
    expect(branchItemsOf(proposals, "node:branch-doc-1-alice").map((item) => item.itemId)).toEqual(["i-1", "i-2"]);
    expect(branchItemsOf(proposals, null)).toEqual([]);
    expect(memberOf(branchItemsOf(proposals, "node:branch-doc-1-alice"), "blk-a")?.itemId).toBe("i-1");
    expect(memberOf(branchItemsOf(proposals, "node:branch-doc-1-alice"), "blk-c")).toBeNull();
  });

  it("Given truth and a rejected branch's overlay, Then the blocks it held differently or added are the entries", () => {
    const truth: DocumentView = {
      documentId: "doc-1",
      revisionId: "rev-doc",
      title: "Caching",
      blocks: [
        { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening." }] },
        { kind: "text", blockId: "blk-b", revisionId: "rev-b", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "Same." }] },
      ],
    };
    const overlay: DocumentView = {
      ...truth,
      blocks: [
        { kind: "text", blockId: "blk-a", revisionId: "rev-a2", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Opening, revised in branch." }] },
        { kind: "text", blockId: "blk-b", revisionId: "rev-b2", containmentId: "c-b", order: "b", role: "paragraph", standing: "keep", runs: [{ text: "Same." }] },
        { kind: "text", blockId: "blk-c", revisionId: "rev-c", containmentId: "c-c", order: "c", role: "paragraph", standing: "keep", runs: [{ text: "Added in branch." }] },
        { kind: "divider", blockId: "blk-d", revisionId: "rev-d", containmentId: "c-d", order: "d" },
      ],
    };
    expect(rejectedEntries(truth, overlay).map((block) => block.blockId)).toEqual(["blk-a", "blk-c"]);
  });
});

describe("the session chips", () => {
  const at = (hours: number, minutes: number) => new Date(2026, 8, 18, hours, minutes).getTime();

  it("Given a session's start, Then its chip reads Proposal · yours and the local time", () => {
    expect(sessionWords(at(14, 32))).toBe("Proposal · yours · 14:32");
    expect(sessionWords(at(9, 5))).toBe("Proposal · yours · 09:05");
  });

  it("Given open sessions, Then one chip each, newest first, answered at once, pressed while the tab works in it, and under the policy accepted by someone else", () => {
    const sessions = [
      { branch: "node:branch-doc-1-alice", since: at(9, 5) },
      { branch: "node:branch-doc-1-alice.2", since: at(14, 32) },
    ];
    const hidden = { proposalsOpen: false, shownGroups: [], hiddenGroups: [] };
    const chips = sessionChipsOf(sessions, "node:branch-doc-1-alice", false, hidden);
    expect(chips.map((chip) => [chip.key, chip.group, chip.text, chip.ended, chip.shown, chip.working, chip.session, chip.accepts])).toEqual([
      ["node:branch-doc-1-alice.2", "node:branch-doc-1-alice.2", "Proposal · yours · 14:32", true, false, false, true, undefined],
      ["node:branch-doc-1-alice", "node:branch-doc-1-alice", "Proposal · yours · 09:05", true, true, true, true, undefined],
    ]);
    // Shown as a run's change is: the toggle sets them all, a press one.
    // CA_0057_014
    expect(sessionChipsOf(sessions, null, false, { proposalsOpen: false, shownGroups: ["node:branch-doc-1-alice.2"], hiddenGroups: [] }).map((chip) => chip.shown)).toEqual([true, false]);
    expect(sessionChipsOf(sessions, null, false).every((chip) => chip.shown)).toBe(true);
    expect(sessionChipsOf(sessions, null, true, hidden).every((chip) => chip.accepts === "others" && !chip.shown && !chip.working)).toBe(true);
    expect(sessionChipsOf([], null, false)).toEqual([]);
  });
});
