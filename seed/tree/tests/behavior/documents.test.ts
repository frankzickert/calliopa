import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  insertBlock,
  listDocuments,
  mergeTextBlocks,
  moveBlock,
  proposeDocumentChanges,
  readDocument,
  readDocumentChanges,
  readDocumentProposals,
  readRetiredBlocks,
  renameDocument,
  restoreBlock,
  retireBlock,
  reviseTextBlock,
  splitTextBlock,
} from "../../src/server/documents/documents";
import { readGraphEnv } from "../../src/server/ccgw/env";

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
