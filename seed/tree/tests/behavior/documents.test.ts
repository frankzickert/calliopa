import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  insertBlock,
  listChangeDocuments,
  listDocuments,
  mergeTextBlocks,
  moveBlock,
  placeProposedItem,
  proposeDocumentChanges,
  readDocument,
  readDocumentChanges,
  readDocumentProposals,
  readRetiredBlocks,
  renameDocument,
  restoreBlock,
  retireBlock,
  reviseTextBlock,
  setBlockDisposition,
  setChangeStatus,
  splitTextBlock,
} from "../../src/server/documents/documents";
import { readGraphEnv } from "../../src/server/ccgw/env";
import { stage } from "../../src/server/ccgw/client";

/**
 * The document operations over the one graph, against a real CCGW and a real
 * kernel: `CALLIOPA_CCGW_URL` and `CALLIOPA_KERNEL_URL` name them, and the
 * kernel's `--principal` is who the writes are attributed to. Without both the
 * suite skips, so the tree's `check` stays runnable anywhere; the repository's
 * kernel harness (`shell_documents_verification_test.go`) provides both over
 * a scratch graph seeded with the shell's vocabulary, which is how this suite
 * is run for verification. `BO_0207_012`
 *
 * The kernel's per-node floor refuses a second write to one node within
 * 250ms, because every save archives a revision into permanent history; the
 * suite settles between writes to the same node for that reason and no other.
 */

const configured = ((): boolean => {
  try {
    readGraphEnv();
    return true;
  } catch {
    return false;
  }
})();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 300));

const ok = <T>(outcome: { outcome: string } & Record<string, unknown>): T => {
  if (outcome["outcome"] !== "success") {
    throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  }
  return outcome["result"] as T;
};

describe.skipIf(!configured)("documents over CCGW", () => {
  let documentId = "";
  let firstBlockId = "";

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "Over CCGW" }),
    );
    documentId = created.documentId;
    firstBlockId = created.blockId;
  });

  afterAll(async () => {
    const document = await readDocument(documentId);
    if (document.outcome === "success") {
      await settle();
      await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
    }
  });

  it("Given a created document, Then it lists, reads with its first block, and counts one change", async () => {
    const listed = ok<readonly { documentId: string; title: string }[]>(await listDocuments());
    expect(listed.some((entry) => entry.documentId === documentId && entry.title === "Over CCGW")).toBe(true);

    const document = ok<{ title: string; revisionId: string; blocks: readonly { blockId: string; kind: string }[] }>(
      await readDocument(documentId),
    );
    expect(document.title).toBe("Over CCGW");
    expect(document.revisionId.startsWith("rev:")).toBe(true);
    expect(document.blocks.map((block) => block.blockId)).toEqual([firstBlockId]);
    expect(document.blocks[0]?.kind).toBe("text");

    const changes = ok<{ changeCount: number; lastWrittenAt: string | null }>(
      await readDocumentChanges(documentId),
    );
    expect(changes.changeCount).toBe(1);
    expect(changes.lastWrittenAt).not.toBeNull();
  });

  it("Given a revise with the current base, Then the runs land and the next base is answered", async () => {
    const before = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(await readDocument(documentId));
    const base = before.blocks[0]?.revisionId ?? "";
    await settle();
    const written = ok<{ revisionId: string }>(
      await reviseTextBlock({
        documentId,
        blockId: firstBlockId,
        baseRevisionId: base,
        runs: [{ text: "Once upon " }, { text: "a time", marks: ["bold"] }],
        role: "h1",
      }),
    );
    expect(written.revisionId.startsWith("rev:")).toBe(true);
    expect(written.revisionId).not.toBe(base);

    const after = ok<{ blocks: readonly { revisionId: string; kind: string; role?: string; runs?: unknown }[] }>(
      await readDocument(documentId),
    );
    expect(after.blocks[0]).toMatchObject({
      revisionId: written.revisionId,
      kind: "text",
      role: "h1",
      runs: [{ text: "Once upon " }, { text: "a time", marks: ["bold"] }],
    });

    // The base that was just replaced is stale, and a stale base is a
    // conflict that writes nothing.
    await settle();
    const stale = await reviseTextBlock({
      documentId,
      blockId: firstBlockId,
      baseRevisionId: base,
      runs: [{ text: "lost" }],
    });
    expect(stale.outcome).toBe("conflict");
  });

  it("Given a standing set with the base, Then it lands, survives a save and a split, counts as a change, and neutral clears it", async () => {
    // Its own document, so the split it makes moves nothing the other
    // scenarios count.
    const { documentId: standingId, blockId: headId } = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "Standing" }),
    );
    type Read = { revisionId: string; blocks: readonly { blockId: string; revisionId: string; standing?: string }[] };
    const block = async (blockId: string) =>
      ok<Read>(await readDocument(standingId)).blocks.find((candidate) => candidate.blockId === blockId);
    const counted = async () => ok<{ changeCount: number }>(await readDocumentChanges(standingId)).changeCount;

    const before = await block(headId);
    const changesBefore = await counted();
    await settle();
    const pinned = ok<{ revisionId: string }>(
      await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: before?.revisionId ?? "", standing: "pin" }),
    );
    expect((await block(headId))?.standing).toBe("pin");
    expect(await counted()).toBe(changesBefore + 1);

    // A stale base is a conflict that writes nothing.
    await settle();
    const stale = await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: before?.revisionId ?? "", standing: "discarded" });
    expect(stale.outcome).toBe("conflict");

    // Typing writes runs and role by property, so the standing stands.
    await settle();
    const saved = ok<{ revisionId: string }>(
      await reviseTextBlock({ documentId: standingId, blockId: headId, baseRevisionId: pinned.revisionId, runs: [{ text: "Pinned words, split here." }] }),
    );
    expect((await block(headId))?.standing).toBe("pin");

    // A split carries the standing to the tail, as it carries the role.
    await settle();
    const split = ok<{ revisionId: string; tailBlockId: string }>(
      await splitTextBlock({ documentId: standingId, blockId: headId, baseRevisionId: saved.revisionId, at: 13 }),
    );
    expect((await block(split.tailBlockId))?.standing).toBe("pin");

    await settle();
    ok(await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: split.revisionId, standing: "neutral" }));
    expect((await block(headId))?.standing).toBe("neutral");

    await settle();
    await deleteDocument({ documentId: standingId, baseRevisionId: ok<Read>(await readDocument(standingId)).revisionId });
  });

  it("Given a role the vocabulary does not permit, Then Validation refuses it and nothing is written", async () => {
    const document = ok<{ blocks: readonly { revisionId: string }[] }>(await readDocument(documentId));
    await settle();
    const refused = await reviseTextBlock({
      documentId,
      blockId: firstBlockId,
      baseRevisionId: document.blocks[0]?.revisionId ?? "",
      runs: [{ text: "x" }],
      role: "h7" as never,
    });
    expect(refused.outcome).toBe("validationFailure");
    const after = ok<{ blocks: readonly { revisionId: string }[] }>(await readDocument(documentId));
    expect(after.blocks[0]?.revisionId).toBe(document.blocks[0]?.revisionId);
  });

  it("Given inserts, a split, a move, a merge, a retire and a restore, Then identity and order hold", async () => {
    const divider = ok<{ blockId: string }>(
      await insertBlock({ documentId, block: { kind: "divider" }, placement: { at: "end" } }),
    );
    const second = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: { kind: "text", runs: [{ text: "second third" }] },
        placement: { after: firstBlockId },
      }),
    );
    let document = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([firstBlockId, second.blockId, divider.blockId]);

    await settle();
    const split = ok<{ blockId: string; tailBlockId: string }>(
      await splitTextBlock({ documentId, blockId: second.blockId, baseRevisionId: second.revisionId, at: 7 }),
    );
    document = ok(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([
      firstBlockId,
      second.blockId,
      split.tailBlockId,
      divider.blockId,
    ]);
    const tail = (await readDocument(documentId)) as { result: { blocks: readonly { blockId: string; runs?: readonly { text: string }[] }[] } };
    expect(tail.result.blocks.find((block) => block.blockId === split.tailBlockId)?.runs).toEqual([{ text: "third" }]);

    await settle();
    const tailBefore = document.blocks.find((block) => block.blockId === split.tailBlockId);
    ok(await moveBlock({
      documentId,
      blockId: split.tailBlockId,
      baseRevisionId: tailBefore?.revisionId ?? "",
      placement: { at: "start" },
    }));
    document = ok(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([
      split.tailBlockId,
      firstBlockId,
      second.blockId,
      divider.blockId,
    ]);

    await settle();
    const secondNow = document.blocks.find((block) => block.blockId === second.blockId);
    ok(await mergeTextBlocks({
      documentId,
      intoBlockId: second.blockId,
      intoBaseRevisionId: secondNow?.revisionId ?? "",
      blockId: split.tailBlockId,
    }));
    document = ok(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([firstBlockId, second.blockId, divider.blockId]);
    let retired = ok<readonly { blockId: string }[]>(await readRetiredBlocks(documentId));
    expect(retired.map((block) => block.blockId)).toEqual([split.tailBlockId]);

    await settle();
    ok(await retireBlock({ documentId, blockId: divider.blockId }));
    document = ok(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([firstBlockId, second.blockId]);
    retired = ok(await readRetiredBlocks(documentId));
    expect(retired.map((block) => block.blockId).sort()).toEqual([divider.blockId, split.tailBlockId].sort());

    await settle();
    ok(await restoreBlock({ documentId, blockId: divider.blockId, placement: { at: "start" } }));
    document = ok(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([divider.blockId, firstBlockId, second.blockId]);
    const again = await restoreBlock({ documentId, blockId: divider.blockId, placement: { at: "end" } });
    expect(again.outcome).toBe("validationFailure");

    // Every gesture above landed as its own data revision. How many of them a
    // read can still see depends on the store's history support — CCGW over
    // Postgres answers every prior revision, a scratch store may answer the
    // current ones — so the count is asserted as a property rather than a
    // number: well past the single change creation counted, and rising
    // with the next write.
    const changes = ok<{ changeCount: number }>(await readDocumentChanges(documentId));
    expect(changes.changeCount).toBeGreaterThan(4);
    await settle();
    const firstNow = document.blocks.find((block) => block.blockId === firstBlockId);
    ok(await reviseTextBlock({
      documentId,
      blockId: firstBlockId,
      baseRevisionId: firstNow?.revisionId ?? "",
      runs: [{ text: "counted" }],
    }));
    const more = ok<{ changeCount: number }>(await readDocumentChanges(documentId));
    expect(more.changeCount).toBe(changes.changeCount + 1);
  });

  it("Given a proposal, Then it stages nothing into truth and its items answer per member", async () => {
    const before = ok<{ blocks: readonly { blockId: string; revisionId: string; kind: string }[] }>(await readDocument(documentId));
    const target = before.blocks.find((block) => block.blockId === firstBlockId);
    await settle();
    const staged = ok<{ groupId: string; items: readonly { itemId: string; kind: string; blockId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [
          { kind: "replace", blockId: firstBlockId, baseRevisionId: target?.revisionId ?? "", runs: [{ text: "Proposed opening" }] },
          { kind: "insert", block: { kind: "text", runs: [{ text: "Proposed addition" }] }, placement: { at: "end" } },
        ],
        request: { by: "the behaviour suite" },
      }),
    );
    expect(staged.groupId.startsWith("node:chg-")).toBe(true);
    expect(staged.items.map((item) => item.kind)).toEqual(["replace", "insert"]);

    // Truth is untouched by staging.
    const unchanged = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(await readDocument(documentId));
    expect(unchanged.blocks.map((block) => block.blockId)).toEqual(before.blocks.map((block) => block.blockId));
    expect(unchanged.blocks.find((block) => block.blockId === firstBlockId)?.revisionId).toBe(target?.revisionId);

    const proposals = ok<{ unanswered: number; groups: readonly { groupId: string; items: readonly { itemId: string; kind: string; blockId: string; block: { runs?: readonly { text: string }[] } | null }[] }[] }>(
      await readDocumentProposals(documentId),
    );
    const group = proposals.groups.find((candidate) => candidate.groupId === staged.groupId);
    expect(group).toBeDefined();
    expect(proposals.unanswered).toBeGreaterThanOrEqual(2);
    const replace = group?.items.find((item) => item.kind === "replace");
    const insert = group?.items.find((item) => item.kind === "insert");
    expect(replace?.blockId).toBe(firstBlockId);
    expect(replace?.block?.runs).toEqual([{ text: "Proposed opening" }]);
    expect(insert?.block?.runs).toEqual([{ text: "Proposed addition" }]);

    // Accepting the insert establishes the block and the containment that
    // travels with it; the group stays open for the other item.
    const accepted = ok<{ groupState: string }>(
      await answerDocumentProposal({ itemId: insert?.itemId ?? "", answer: "accepted" }),
    );
    expect(accepted.groupState).toBe("open");
    let document = ok<{ blocks: readonly { blockId: string; runs?: readonly { text: string }[] }[] }>(await readDocument(documentId));
    expect(document.blocks[document.blocks.length - 1]?.runs).toEqual([{ text: "Proposed addition" }]);

    // Rejecting the replace leaves the block as it was and closes the group.
    const rejected = ok<{ groupState: string }>(
      await answerDocumentProposal({ itemId: replace?.itemId ?? "", answer: "rejected" }),
    );
    expect(rejected.groupState).toBe("closed");
    document = ok(await readDocument(documentId));
    expect(document.blocks.find((block) => block.blockId === firstBlockId)?.runs).not.toEqual([{ text: "Proposed opening" }]);
    const after = ok<{ groups: readonly { groupId: string }[] }>(await readDocumentProposals(documentId));
    expect(after.groups.some((candidate) => candidate.groupId === staged.groupId)).toBe(false);
  });

  it("Given an agent's proposal, Then its proposer is the agent its run names, and a reader placing it keeps its text and proposer", async () => {
    const before = ok<{ blocks: readonly { blockId: string; revisionId: string; order: string; kind: string }[] }>(await readDocument(documentId));
    // A text block: a divider has no words for a rewrite to change.
    const target = before.blocks.find((block) => block.kind === "text");
    await settle();
    const staged = ok<{ groupId: string; items: readonly { itemId: string; kind: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [
          { kind: "replace", blockId: target?.blockId ?? "", baseRevisionId: target?.revisionId ?? "", runs: [{ text: "Agent rewrite" }] },
          { kind: "insert", block: { kind: "text", runs: [{ text: "Agent addition" }] }, placement: { at: "end" } },
        ],
      }),
    );
    // The run's provenance node, staged into the same group as the bridge
    // stages it when a run closes (`stageRunSummary`). BO_0233_001
    const provenance = await stage(
      staged.groupId,
      "CREATE (r:agent.run {id: $id, goal: $goal, pin: $pin, groupId: $group, agent: $agent, executedBy: $executedBy, runStatus: $status, verification: $verification, skillRevisions: $skills})",
      {
        id: `run:behaviour-${staged.groupId.slice(-8)}`,
        goal: "rewrite the opening",
        pin: 1,
        group: staged.groupId,
        agent: "claude-code",
        executedBy: "claude-code (claude-sonnet-5)",
        status: "completed",
        verification: "unverified",
        skills: [],
      },
      "run provenance",
    );
    expect(provenance.outcome).toBe("success");

    type Read = { groups: readonly { groupId: string; proposer: Record<string, unknown>; items: readonly { itemId: string; kind: string; block: { order: string; runs?: readonly { text: string }[] } | null }[] }[] };
    let read = ok<Read>(await readDocumentProposals(documentId));
    let group = read.groups.find((candidate) => candidate.groupId === staged.groupId);
    expect(group?.proposer).toEqual({ kind: "agent", agent: "claude-code", executedBy: "claude-code (claude-sonnet-5)" });
    const replace = staged.items.find((item) => item.kind === "replace")?.itemId ?? "";
    const insert = staged.items.find((item) => item.kind === "insert")?.itemId ?? "";

    // The reader places the rewrite at the end and the new block first. It
    // is a staging into the agent's group, and nothing is answered. BO_0233_007
    await settle();
    ok(await placeProposedItem({ documentId, itemId: replace, placement: { at: "end" } }));
    await settle();
    ok(await placeProposedItem({ documentId, itemId: insert, placement: { before: target?.blockId ?? "" } }));
    read = ok<Read>(await readDocumentProposals(documentId));
    group = read.groups.find((candidate) => candidate.groupId === staged.groupId);
    const placedReplace = group?.items.find((item) => item.itemId === replace);
    const placedInsert = group?.items.find((item) => item.itemId === insert);
    // The rewrite keeps its words: the key was set on the group's own
    // candidate, not on the established revision.
    expect(placedReplace?.block?.runs).toEqual([{ text: "Agent rewrite" }]);
    expect((placedReplace?.block?.order ?? "") > (before.blocks[before.blocks.length - 1]?.order ?? "")).toBe(true);
    expect(placedInsert?.block?.runs).toEqual([{ text: "Agent addition" }]);
    // Before the block it was dropped on.
    const targetAt = before.blocks.findIndex((block) => block.blockId === target?.blockId);
    expect((placedInsert?.block?.order ?? "~") < (target?.order ?? "")).toBe(true);
    expect((placedInsert?.block?.order ?? "") > (before.blocks[targetAt - 1]?.order ?? "")).toBe(true);
    expect(group?.items).toHaveLength(2);
    expect(group?.proposer).toMatchObject({ kind: "agent", agent: "claude-code" });
    // Truth is untouched: nothing was answered.
    const unchanged = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(await readDocument(documentId));
    expect(unchanged.blocks.find((block) => block.blockId === target?.blockId)?.revisionId).toBe(target?.revisionId);
    // A removal proposes no place.
    const removal = await placeProposedItem({ documentId, itemId: `${staged.groupId}|remove|node:x|c-x`, placement: { at: "end" } });
    expect(removal.outcome).not.toBe("success");

    // A person's own proposal is the person's.
    await settle();
    const mine = ok<{ groupId: string; items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({ documentId, items: [{ kind: "insert", block: { kind: "text", runs: [{ text: "Mine" }] }, placement: { at: "start" } }] }),
    );
    read = ok<Read>(await readDocumentProposals(documentId));
    expect(read.groups.find((candidate) => candidate.groupId === mine.groupId)?.proposer).toMatchObject({ kind: "person" });

    for (const itemId of [replace, insert, mine.items[0]?.itemId ?? ""]) {
      ok(await answerDocumentProposal({ itemId, answer: "rejected" }));
    }
  });

  it("Given a rewrite and a standing set after it, Then accepting lands the words and keeps the standing; a rewrite whose words moved says so, unless the reader typed into it", async () => {
    type Read = { blocks: readonly { blockId: string; revisionId: string; kind: string; runs?: readonly { text: string }[]; standing?: string }[] };
    let document = ok<Read>(await readDocument(documentId));
    const target = document.blocks.find((block) => block.kind === "text");
    await settle();
    const staged = ok<{ items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "replace", blockId: target?.blockId ?? "", baseRevisionId: target?.revisionId ?? "", runs: [{ text: "Rewritten while pinned" }] }],
      }),
    );
    // The reader pins the block after the proposal was staged: a revision
    // CCGW reads as drift, though not a word moved. BO_0233_011
    await settle();
    ok(await setBlockDisposition({ documentId, blockId: target?.blockId ?? "", baseRevisionId: target?.revisionId ?? "", standing: "pin" }));
    await settle();
    ok(await answerDocumentProposal({ documentId, itemId: staged.items[0]?.itemId ?? "", answer: "accepted" }));
    document = ok<Read>(await readDocument(documentId));
    const accepted = document.blocks.find((block) => block.blockId === target?.blockId);
    expect(accepted?.runs).toEqual([{ text: "Rewritten while pinned" }]);
    expect(accepted?.standing).toBe("pin");

    // A rewrite whose block's words changed since is refused in words, and
    // nothing is written.
    await settle();
    const again = ok<{ items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "replace", blockId: accepted?.blockId ?? "", baseRevisionId: accepted?.revisionId ?? "", runs: [{ text: "A stale rewrite" }] }],
      }),
    );
    await settle();
    const written = ok<{ revisionId: string }>(
      await reviseTextBlock({ documentId, blockId: accepted?.blockId ?? "", baseRevisionId: accepted?.revisionId ?? "", runs: [{ text: "Written by the reader" }] }),
    );
    // And the reader takes the pin back, after the rewrite that carries it.
    await settle();
    ok(await setBlockDisposition({ documentId, blockId: target?.blockId ?? "", baseRevisionId: written.revisionId, standing: "neutral" }));
    await settle();
    const stale = await answerDocumentProposal({ documentId, itemId: again.items[0]?.itemId ?? "", answer: "accepted" });
    expect(stale.outcome).not.toBe("success");
    expect(JSON.stringify(stale)).toContain("older version of the block");
    document = ok<Read>(await readDocument(documentId));
    expect(document.blocks.find((block) => block.blockId === target?.blockId)?.runs).toEqual([{ text: "Written by the reader" }]);

    // Typed into, the same rewrite is accepted over the reader's words, and
    // the standing stays the one the reader set since. CA_0042_002
    await settle();
    ok(await answerDocumentProposal({ documentId, itemId: again.items[0]?.itemId ?? "", answer: "accepted", edited: true }));
    document = ok<Read>(await readDocument(documentId));
    const edited = document.blocks.find((block) => block.blockId === target?.blockId);
    expect(edited?.runs).toEqual([{ text: "A stale rewrite" }]);
    expect(edited?.standing).toBe("neutral");

    // A move takes no typing, so an edit's acceptance of a stale one is
    // refused as the icons' is.
    await settle();
    const moving = ok<{ items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "move", blockId: target?.blockId ?? "", baseRevisionId: edited?.revisionId ?? "", placement: { at: "end" } }],
      }),
    );
    await settle();
    ok(await reviseTextBlock({ documentId, blockId: edited?.blockId ?? "", baseRevisionId: edited?.revisionId ?? "", runs: [{ text: "Written again" }] }));
    await settle();
    const staleMove = await answerDocumentProposal({ documentId, itemId: moving.items[0]?.itemId ?? "", answer: "accepted", edited: true });
    expect(JSON.stringify(staleMove)).toContain("older version of the block");
    ok(await answerDocumentProposal({ itemId: moving.items[0]?.itemId ?? "", answer: "rejected" }));
  });

  it("Given a rename and a delete, Then the listing follows and history stays", async () => {
    const document = ok<{ revisionId: string }>(await readDocument(documentId));
    await settle();
    const renamed = ok<{ revisionId: string }>(
      await renameDocument({ documentId, baseRevisionId: document.revisionId, title: "Renamed" }),
    );
    expect(renamed.revisionId).not.toBe(document.revisionId);
    const listed = ok<readonly { documentId: string; title: string }[]>(await listDocuments());
    expect(listed.find((entry) => entry.documentId === documentId)?.title).toBe("Renamed");

    await settle();
    ok(await deleteDocument({ documentId, baseRevisionId: renamed.revisionId }));
    const gone = await readDocument(documentId);
    expect(gone.outcome).toBe("noResult");
    const listedAfter = ok<readonly { documentId: string }[]>(await listDocuments());
    expect(listedAfter.some((entry) => entry.documentId === documentId)).toBe(false);
    const twice = await deleteDocument({ documentId, baseRevisionId: renamed.revisionId });
    expect(twice.outcome).toBe("noResult");
  });
});

/**
 * A change of an extension is a document carrying `change` and
 * `changeStatus` (BO_0222): created with both, it is absent from the
 * documents listing and present in the change listing under its extension;
 * its status is written through the bridge with the base compared first, a
 * stale base answered as a conflict; a value outside the declaration's set is
 * refused by Validation naming the six; and a status on an ordinary document
 * is refused before the graph. BO_0222_011
 */
describe.skipIf(!configured)("change documents over CCGW", () => {
  let changeId = "";
  let plainId = "";

  beforeAll(async () => {
    changeId = ok<{ documentId: string }>(
      await createDocument({ title: "Untitled change", change: "calliopa-video", status: "idea" }),
    ).documentId;
    plainId = ok<{ documentId: string }>(await createDocument({ title: "Plain" })).documentId;
  });

  afterAll(async () => {
    for (const id of [changeId, plainId]) {
      const document = await readDocument(id);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId: id, baseRevisionId: document.result.revisionId });
      }
    }
  });

  it("Given a change document, Then it lists under its extension and never among the documents", async () => {
    const documents = ok<readonly { documentId: string }[]>(await listDocuments());
    expect(documents.some((entry) => entry.documentId === changeId)).toBe(false);
    expect(documents.some((entry) => entry.documentId === plainId)).toBe(true);
    const changes = ok<readonly { documentId: string; change: string; status: string; title: string }[]>(
      await listChangeDocuments(),
    );
    const listed = changes.find((entry) => entry.documentId === changeId);
    expect(listed).toMatchObject({ change: "calliopa-video", status: "idea", title: "Untitled change" });
    expect(changes.some((entry) => entry.documentId === plainId)).toBe(false);
    const read = ok<{ change?: string; changeStatus?: string }>(await readDocument(changeId));
    expect(read.change).toBe("calliopa-video");
    expect(read.changeStatus).toBe("idea");
  });

  it("Given a status written with the base, Then it lands; a stale base is a conflict; a value outside the set is refused by the graph", async () => {
    await settle();
    const before = ok<{ revisionId: string }>(await readDocument(changeId));
    const written = ok<{ revisionId: string }>(
      await setChangeStatus({ documentId: changeId, baseRevisionId: before.revisionId, status: "draft" }),
    );
    expect(written.revisionId).not.toBe(before.revisionId);
    const after = ok<{ changeStatus?: string; revisionId: string }>(await readDocument(changeId));
    expect(after.changeStatus).toBe("draft");

    const stale = await setChangeStatus({ documentId: changeId, baseRevisionId: before.revisionId, status: "ready" });
    expect(stale.outcome).toBe("conflict");

    await settle();
    const odd = await setChangeStatus({
      documentId: changeId,
      baseRevisionId: after.revisionId,
      status: "done" as unknown as "ready",
    });
    expect(odd.outcome).toBe("validationFailure");
    expect(JSON.stringify(odd)).toMatch(/property_value_not_permitted/u);
    expect(JSON.stringify(odd)).toMatch(/rejected/u);
    const unchanged = ok<{ changeStatus?: string }>(await readDocument(changeId));
    expect(unchanged.changeStatus).toBe("draft");
  });

  it("Given an ordinary document, Then a status is refused before the graph", async () => {
    const plain = ok<{ revisionId: string }>(await readDocument(plainId));
    const refused = await setChangeStatus({ documentId: plainId, baseRevisionId: plain.revisionId, status: "wip" });
    expect(refused.outcome).toBe("validationFailure");
    expect(JSON.stringify(refused)).toMatch(/notAChange/u);
  });
});
