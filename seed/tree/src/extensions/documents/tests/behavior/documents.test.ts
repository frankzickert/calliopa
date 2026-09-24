import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  fillMediaBlock,
  reviseEquation,
  reviseTable,
  insertBlock,
  listDocuments,
  mergeTextBlocks,
  moveBlock,
  moveRetiredBlock,
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
  setCitationStyle,
  setFigure,
  setFrontMatter,
  splitTextBlock,
} from "~/extensions/documents/server/documents";
import { documentsCiting } from "~/extensions/documents/server/cited-by";
import { randomBytes, randomUUID } from "node:crypto";

import { orderBetween } from "~/lib/order";
import { readGraphEnv } from "~/server/ccgw/env";
import { stage } from "~/server/ccgw/client";
import { blobReference, objectIdOfHash, putBlob } from "~/server/ccgw/blobs";

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

  it("Given a standing set with the base, Then it lands, survives a save and a split, counts as a change, and keep clears it", async () => {
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
      await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: before?.revisionId ?? "", standing: "fixate" }),
    );
    expect((await block(headId))?.standing).toBe("fixate");
    expect(await counted()).toBe(changesBefore + 1);

    // A stale base is a conflict that writes nothing.
    await settle();
    const stale = await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: before?.revisionId ?? "", standing: "discarded" });
    expect(stale.outcome).toBe("conflict");

    // Typing writes runs and role by property, so the standing stands.
    await settle();
    const saved = ok<{ revisionId: string }>(
      await reviseTextBlock({ documentId: standingId, blockId: headId, baseRevisionId: pinned.revisionId, runs: [{ text: "Fixated words, split here." }] }),
    );
    expect((await block(headId))?.standing).toBe("fixate");

    // A split carries the standing to the tail, as it carries the role — and
    // the head's words as the editor holds them, split in place of the runs
    // the graph holds, in one write of the head. DO_0015_001
    await settle();
    const split = ok<{ revisionId: string; tailBlockId: string }>(
      await splitTextBlock({ documentId: standingId, blockId: headId, baseRevisionId: saved.revisionId, at: 13, runs: [{ text: "Typed words, split here, and more." }], role: "h2" }),
    );
    expect((await block(split.tailBlockId))?.standing).toBe("fixate");
    type Words = { blocks: readonly { blockId: string; kind: string; runs?: readonly { text: string }[]; role?: string }[] };
    const words = ok<Words>(await readDocument(standingId)).blocks;
    expect(words.find((candidate) => candidate.blockId === headId)?.runs?.map((run) => run.text).join("")).toBe("Typed words, ");
    expect(words.find((candidate) => candidate.blockId === split.tailBlockId)?.runs?.map((run) => run.text).join("")).toBe("split here, and more.");
    expect(words.find((candidate) => candidate.blockId === headId)?.role).toBe("h2");
    expect(words.find((candidate) => candidate.blockId === split.tailBlockId)?.role).toBe("h2");
    // A stale base is a conflict that writes nothing, words or no words.
    await settle();
    const staleSplit = await splitTextBlock({ documentId: standingId, blockId: headId, baseRevisionId: saved.revisionId, at: 3, runs: [{ text: "Never written." }] });
    expect(staleSplit.outcome).toBe("conflict");
    expect(ok<Words>(await readDocument(standingId)).blocks.length).toBe(words.length);

    await settle();
    ok(await setBlockDisposition({ documentId: standingId, blockId: headId, baseRevisionId: split.revisionId, standing: "keep" }));
    expect((await block(headId))?.standing).toBe("keep");

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

  it("Given a picture proposed and then made, Then the same block carries it", async () => {
    // A generation is proposed before it is made: the block goes in with no
    // reference, which is the whole of the pending state, and filling it keeps
    // the same block so the reader answers the proposal already in front of
    // them. BO_0273_017
    const pending = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: { kind: "image", alt: "a laurel", source: { extension: "media", model: "seedream_v5_pro" } },
        placement: { at: "end" },
      }),
    );
    let document = ok<{ blocks: readonly { blockId: string; kind: string; objectId?: string; alt?: string }[] }>(
      await readDocument(documentId),
    );
    const before = document.blocks.find((block) => block.blockId === pending.blockId);
    expect(before?.kind).toBe("image");
    expect(before?.objectId).toBeUndefined();
    expect(before?.alt).toBe("a laurel");

    await settle();
    const filled = ok<{ blockId: string }>(
      await fillMediaBlock({
        documentId,
        blockId: pending.blockId,
        baseRevisionId: pending.revisionId,
        reference: { _kind: "blob", hash: "sha256:" + "a".repeat(64), mediaType: "image/png", size: 12 },
        width: 1280,
        height: 720,
        source: { extension: "media", model: "seedream_v5_pro", cost: "$0.42" },
      }),
    );
    expect(filled.blockId).toBe(pending.blockId);

    document = ok(await readDocument(documentId));
    const after = document.blocks.find((block) => block.blockId === pending.blockId) as
      | { objectId?: string; width?: number; height?: number }
      | undefined;
    expect(after?.objectId).toBe("a".repeat(64));
    expect(after?.width).toBe(1280);
    expect(after?.height).toBe(720);
  });

  it("Given a text block, Then filling it with a picture is refused", async () => {
    const document = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(
      await readDocument(documentId),
    );
    const text = document.blocks[0]!;
    const refused = await fillMediaBlock({
      documentId,
      blockId: text.blockId,
      baseRevisionId: text.revisionId,
      reference: { _kind: "blob", hash: "sha256:" + "b".repeat(64), mediaType: "image/png", size: 4 },
    });
    expect(refused.outcome).not.toBe("success");
  });

  it("Given a table, Then it is written whole, read as cells, revised on the same block, and the file behind it goes with a cell edit", async () => {
    // A table is one block revised whole (BO_0287_008, BO_0287_009): a cell
    // edit keeps the block's identity, a misfit is refused naming the cell,
    // and a table behind a file drops the reference once its rows are no
    // longer the file's first hundred.
    const columns = [
      { name: "City", type: "text" as const },
      { name: "Population", type: "number" as const },
    ];
    // The file behind the table is a real object: CCGW refuses a reference
    // that resolves to nothing, as the blob contract says.
    const bytes = new TextEncoder().encode("City,Population\nBerlin,3755000\nHamburg,1892000\n");
    const uploaded = ok<{ hash: string; size: number }>(await putBlob(bytes));
    const objectId = objectIdOfHash(uploaded.hash)!;
    const inserted = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: {
          kind: "table",
          columns,
          rows: [["Berlin", "3755000"]],
          caption: "German cities",
          reference: blobReference(objectId, "text/csv", uploaded.size),
          rowCount: 12400,
          source: { extension: "documents", file: "cities.csv" },
        },
        placement: { at: "end" },
      }),
    );
    type Table = { blockId: string; revisionId: string; kind: string; columns?: unknown; rows?: unknown; caption?: string; file?: { objectId: string; rowCount: number } };
    let document = ok<{ blocks: readonly Table[] }>(await readDocument(documentId));
    const before = document.blocks.find((block) => block.blockId === inserted.blockId);
    expect(before?.kind).toBe("table");
    expect(before?.columns).toEqual(columns);
    expect(before?.rows).toEqual([["Berlin", "3755000"]]);
    expect(before?.caption).toBe("German cities");
    expect(before?.file).toEqual({ objectId, rowCount: 12400 });

    await settle();
    const misfit = await reviseTable({
      documentId,
      blockId: inserted.blockId,
      baseRevisionId: inserted.revisionId,
      columns,
      rows: [["Berlin", "many"]],
    });
    expect(misfit.outcome).toBe("validationFailure");
    const detail = misfit.outcome === "validationFailure" ? misfit.failures[0]?.detail : "";
    expect(detail).toContain('column "Population": "many" is not a number');

    // The caption alone changes: the file stays behind the block.
    const captioned = ok<{ blockId: string; revisionId: string }>(
      await reviseTable({ documentId, blockId: inserted.blockId, baseRevisionId: inserted.revisionId, columns, rows: [["Berlin", "3755000"]], caption: "Cities" }),
    );
    expect(captioned.blockId).toBe(inserted.blockId);
    document = ok(await readDocument(documentId));
    const kept = document.blocks.find((block) => block.blockId === inserted.blockId);
    expect(kept?.caption).toBe("Cities");
    expect(kept?.file).toEqual({ objectId, rowCount: 12400 });

    await settle();
    const revised = ok<{ blockId: string; revisionId: string }>(
      await reviseTable({
        documentId,
        blockId: inserted.blockId,
        baseRevisionId: captioned.revisionId,
        columns,
        rows: [["Berlin", "3755000"], ["Hamburg", "1892000"]],
        caption: "Cities",
      }),
    );
    expect(revised.blockId).toBe(inserted.blockId);
    document = ok(await readDocument(documentId));
    const after = document.blocks.find((block) => block.blockId === inserted.blockId);
    expect(after?.rows).toEqual([["Berlin", "3755000"], ["Hamburg", "1892000"]]);
    expect(after?.file).toBeUndefined();

    const stale = await reviseTable({ documentId, blockId: inserted.blockId, baseRevisionId: captioned.revisionId, columns, rows: [] });
    expect(stale.outcome).toBe("conflict");
    const text = document.blocks.find((block) => block.kind === "text")!;
    const wrongKind = await reviseTable({ documentId, blockId: text.blockId, baseRevisionId: text.revisionId, columns, rows: [] });
    expect(wrongKind.outcome).toBe("validationFailure");

    await settle();
    await retireBlock({ documentId, blockId: inserted.blockId });
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

  it("Given a split whose tail the caller names, Then the tail takes that identity and its revision is answered; a name already taken is refused and writes nothing; an unnamed split is unchanged", async () => {
    // Its own document, so the splits it makes move nothing the others read.
    // CA_0045_004
    const created = ok<{ documentId: string; blockId: string; revisionId: string }>(
      await createDocument({ title: "Named tails", block: { kind: "text", runs: [{ text: "one two three" }] } }),
    );
    const own = created.documentId;
    const head = ok<{ blocks: readonly { blockId: string; revisionId: string }[] }>(await readDocument(own)).blocks[0];
    const tailBlockId = crypto.randomUUID();

    await settle();
    const named = ok<{ revisionId: string; tailBlockId: string; tailRevisionId: string }>(
      await splitTextBlock({ documentId: own, blockId: created.blockId, baseRevisionId: head?.revisionId ?? "", at: 4, tailBlockId }),
    );
    expect(named.tailBlockId).toBe(tailBlockId);
    let document = ok<{ blocks: readonly { blockId: string; revisionId: string; runs?: readonly { text: string }[] }[] }>(await readDocument(own));
    expect(document.blocks.map((block) => block.blockId)).toEqual([created.blockId, tailBlockId]);
    const tail = document.blocks[1];
    expect(tail?.runs).toEqual([{ text: "two three" }]);
    // The answered revision is the tail's base: a save naming it lands.
    expect(named.tailRevisionId).toBe(tail?.revisionId);
    await settle();
    ok(await reviseTextBlock({ documentId: own, blockId: tailBlockId, baseRevisionId: named.tailRevisionId, runs: [{ text: "two three, typed on" }] }));

    // A name already taken would write a revision over the block that holds
    // it: refused as a conflict, and the document and its count unchanged.
    const before = ok<{ changeCount: number }>(await readDocumentChanges(own)).changeCount;
    await settle();
    const taken = await splitTextBlock({ documentId: own, blockId: created.blockId, baseRevisionId: named.revisionId, at: 2, tailBlockId });
    expect(taken.outcome).toBe("conflict");
    document = ok(await readDocument(own));
    expect(document.blocks.map((block) => block.blockId)).toEqual([created.blockId, tailBlockId]);
    expect(document.blocks[0]?.runs).toEqual([{ text: "one " }]);
    expect(ok<{ changeCount: number }>(await readDocumentChanges(own)).changeCount).toBe(before);

    // A split that names no tail mints one, as it always did.
    const unnamed = ok<{ tailBlockId: string; tailRevisionId: string }>(
      await splitTextBlock({ documentId: own, blockId: created.blockId, baseRevisionId: named.revisionId, at: 2 }),
    );
    expect([created.blockId, tailBlockId]).not.toContain(unnamed.tailBlockId);
    document = ok(await readDocument(own));
    expect(document.blocks.map((block) => block.blockId)).toEqual([created.blockId, unnamed.tailBlockId, tailBlockId]);
    expect(unnamed.tailRevisionId).toBe(document.blocks[1]?.revisionId);

    const last = ok<{ revisionId: string }>(await readDocument(own));
    await settle();
    await deleteDocument({ documentId: own, baseRevisionId: last.revisionId });
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
    ok(await setBlockDisposition({ documentId, blockId: target?.blockId ?? "", baseRevisionId: target?.revisionId ?? "", standing: "fixate" }));
    await settle();
    ok(await answerDocumentProposal({ documentId, itemId: staged.items[0]?.itemId ?? "", answer: "accepted" }));
    document = ok<Read>(await readDocument(documentId));
    const accepted = document.blocks.find((block) => block.blockId === target?.blockId);
    expect(accepted?.runs).toEqual([{ text: "Rewritten while pinned" }]);
    expect(accepted?.standing).toBe("fixate");

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
    ok(await setBlockDisposition({ documentId, blockId: target?.blockId ?? "", baseRevisionId: written.revisionId, standing: "keep" }));
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
    expect(edited?.standing).toBe("keep");

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

  /**
   * A document a run started from a command (`BO_0251`): its node, first
   * block and containment are candidates in the run's group, with the run's
   * provenance beside them, as the kernel's `create_document` stages them.
   */
  const startDocument = async (title: string, lines: readonly string[]) => {
    const suffix = randomBytes(8).toString("hex");
    const groupId = `node:run-${suffix}`;
    const startedId = randomUUID();
    const blockIds = lines.map(() => randomUUID());
    const parameters: Record<string, unknown> = { dref: `node:${startedId}`, d_id: startedId, d_title: title };
    const statements = [`CREATE (d:document {id: $d_id, title: $d_title})`];
    let order = "";
    lines.forEach((line, index) => {
      order = orderBetween(order, "");
      parameters[`b${index}_id`] = blockIds[index];
      parameters[`b${index}_order`] = order;
      parameters[`b${index}_runs`] = [{ text: line }];
      parameters[`b${index}ref`] = `node:${blockIds[index]}`;
      statements.push(`CREATE (b${index}:text {id: $b${index}_id, order: $b${index}_order, runs: $b${index}_runs})`);
      statements.push(`RELATE dref -[c${index}:CONTAINS]-> b${index}ref`);
    });
    ok(await stage(groupId, statements.join("; "), parameters, `agent creates document ${title}`));
    ok(
      await stage(
        groupId,
        "CREATE (r:agent.run {id: $id, goal: $goal, pin: $pin, groupId: $group, agent: $agent, executedBy: $executedBy, runStatus: $status, verification: $verification, skillRevisions: $skills})",
        { id: `run:${suffix}`, goal: `draft ${title}`, pin: 1, group: groupId, agent: "codex", executedBy: "codex (gpt-5.5)", status: "completed", verification: "unverified", skills: [] },
        "run provenance",
      ),
    );
    return { groupId, startedId, blockIds };
  };

  it("Given a started document, Then it reads and lists as the run's proposal, its blocks are the run's inserts, and taking a block takes the document first", async () => {
    const started = await startDocument("Started checklist", ["First day", "Laptop"]);
    const proposer = { kind: "agent", agent: "codex", executedBy: "codex (gpt-5.5)" };

    type Read = { title: string; revisionId: string; blocks: readonly unknown[]; proposed?: { group: string; proposer: unknown } };
    const read = ok<Read>(await readDocument(started.startedId));
    expect(read.title).toBe("Started checklist");
    expect(read.blocks).toEqual([]);
    expect(read.proposed).toEqual({ group: started.groupId, proposer });

    type Listed = readonly { documentId: string; title: string; proposed?: { group: string; proposer: unknown } }[];
    const listed = ok<Listed>(await listDocuments());
    expect(listed.find((entry) => entry.documentId === started.startedId)).toEqual({
      documentId: started.startedId,
      title: "Started checklist",
      proposed: { group: started.groupId, proposer },
    });
    // An established document lists as it did, with nothing proposed.
    expect(listed.find((entry) => entry.documentId === documentId)?.proposed).toBeUndefined();

    type Proposals = { unanswered: number; groups: readonly { groupId: string; items: readonly { itemId: string; kind: string; blockId: string }[] }[] };
    const proposals = ok<Proposals>(await readDocumentProposals(started.startedId));
    const group = proposals.groups.find((candidate) => candidate.groupId === started.groupId);
    // In the touched set's order: the editor places them by their keys.
    expect(group?.items.map((item) => [item.kind, item.blockId]).sort()).toEqual(
      [
        ["insert", started.blockIds[0]],
        ["insert", started.blockIds[1]],
      ].sort(),
    );
    expect(proposals.unanswered).toBe(2);

    // The second block taken first: the document goes with it, so no block
    // is ever established into a document that is not.
    const second = group?.items.find((item) => item.blockId === started.blockIds[1])?.itemId ?? "";
    ok(await answerDocumentProposal({ documentId: started.startedId, itemId: second, answer: "accepted" }));
    const taken = ok<Read>(await readDocument(started.startedId));
    expect(taken.proposed).toBeUndefined();
    expect(taken.blocks.map((block) => (block as { blockId: string }).blockId)).toEqual([started.blockIds[1]]);
    const after = ok<Listed>(await listDocuments());
    expect(after.find((entry) => entry.documentId === started.startedId)?.proposed).toBeUndefined();

    // The rest is an ordinary insert into the ordinary document.
    const rest = ok<Proposals>(await readDocumentProposals(started.startedId));
    const first = rest.groups.find((candidate) => candidate.groupId === started.groupId)?.items;
    expect(first?.map((item) => item.blockId)).toEqual([started.blockIds[0]]);
    ok(await answerDocumentProposal({ documentId: started.startedId, itemId: first?.[0]?.itemId ?? "", answer: "accepted" }));
    expect(ok<Read>(await readDocument(started.startedId)).blocks).toHaveLength(2);

    await settle();
    ok(await deleteDocument({ documentId: started.startedId, baseRevisionId: ok<Read>(await readDocument(started.startedId)).revisionId }));
  });

  it("Given a started document retitled, Then the rename takes it with the new title on top", async () => {
    const started = await startDocument("Untaken title", ["Only line"]);
    const read = ok<{ revisionId: string; proposed?: unknown }>(await readDocument(started.startedId));
    expect(read.proposed).toBeDefined();
    ok(await renameDocument({ documentId: started.startedId, baseRevisionId: read.revisionId, title: "Taken title" }));
    const taken = ok<{ title: string; proposed?: unknown; blocks: readonly unknown[] }>(await readDocument(started.startedId));
    expect(taken.title).toBe("Taken title");
    expect(taken.proposed).toBeUndefined();
    // Its block is still the run's proposal, now into a document that is.
    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; kind: string }[] }[] }>(await readDocumentProposals(started.startedId));
    const item = proposals.groups.find((candidate) => candidate.groupId === started.groupId)?.items[0];
    expect(item?.kind).toBe("insert");
    ok(await answerDocumentProposal({ documentId: started.startedId, itemId: item?.itemId ?? "", answer: "rejected" }));
    // Rejecting the last block of a document that was taken leaves the document.
    expect(ok<{ blocks: readonly unknown[] }>(await readDocument(started.startedId)).blocks).toEqual([]);
    await settle();
    ok(await deleteDocument({ documentId: started.startedId, baseRevisionId: ok<{ revisionId: string }>(await readDocument(started.startedId)).revisionId }));
  });

  it("Given a started document rejected item by item, Then nothing of it remains to read or list", async () => {
    const started = await startDocument("Rejected checklist", ["One", "Two"]);
    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string }[] }[] }>(await readDocumentProposals(started.startedId));
    const items = proposals.groups.find((candidate) => candidate.groupId === started.groupId)?.items ?? [];
    expect(items).toHaveLength(2);
    ok(await answerDocumentProposal({ documentId: started.startedId, itemId: items[0]?.itemId ?? "", answer: "rejected" }));
    // One item still stands, so the document does too.
    expect(ok<{ proposed?: unknown }>(await readDocument(started.startedId)).proposed).toBeDefined();
    ok(await answerDocumentProposal({ documentId: started.startedId, itemId: items[1]?.itemId ?? "", answer: "rejected" }));
    const gone = await readDocument(started.startedId);
    expect(gone.outcome).toBe("noResult");
    const listed = ok<readonly { documentId: string }[]>(await listDocuments());
    expect(listed.some((entry) => entry.documentId === started.startedId)).toBe(false);
  });

  it("Given a sentence citing a work, Then the work is cited by that document and block, and no longer once the block is retired (BO_0291_023)", async () => {
    const work = randomUUID();
    const created = ok<{ documentId: string }>(await createDocument({ title: "Citing" }));
    const documentId = created.documentId;
    await settle();
    const inserted = ok<{ blockId: string }>(
      await insertBlock({ documentId, block: { kind: "text", runs: [{ text: "Measured " }, { text: "", cite: { work, locator: "p. 4" } }, { text: "." }] }, placement: { at: "end" } }),
    );
    const cited = ok<readonly { documentId: string; citations: readonly { blockId: string; words: string }[] }[]>(await documentsCiting(work));
    expect(cited).toEqual([{ documentId, title: "Citing", citations: [{ blockId: inserted.blockId, words: "Measured ." }] }]);

    await settle();
    ok(await retireBlock({ documentId, blockId: inserted.blockId }));
    expect(ok<readonly unknown[]>(await documentsCiting(work))).toEqual([]);
  });

  it("Given a document, Then its own citation style is set on its base, read back, and cleared to follow the instance (BO_0291_037)", async () => {
    const created = ok<{ documentId: string; revisionId: string }>(await createDocument({ title: "Cited" }));
    const documentId = created.documentId;
    type Read = { revisionId: string; citationStyle?: string };
    const first = ok<Read>(await readDocument(documentId));
    expect(first.citationStyle).toBeUndefined();

    await settle();
    const set = ok<{ revisionId: string }>(await setCitationStyle({ documentId, baseRevisionId: first.revisionId, style: "apa" }));
    expect(ok<Read>(await readDocument(documentId)).citationStyle).toBe("apa");

    // A stale base is refused; a style the declaration does not permit is refused by it.
    await settle();
    expect((await setCitationStyle({ documentId, baseRevisionId: first.revisionId, style: "ieee" })).outcome).toBe("conflict");
    expect((await setCitationStyle({ documentId, baseRevisionId: set.revisionId, style: "harvard" })).outcome).not.toBe("success");

    await settle();
    ok(await setCitationStyle({ documentId, baseRevisionId: set.revisionId, style: null }));
    expect(ok<Read>(await readDocument(documentId)).citationStyle).toBeUndefined();
  });

  it("Given a manuscript's head, Then the front matter is set whole on the document's base, read back, and the abstract is a block of its role", async () => {
    const created = ok<{ documentId: string; revisionId: string }>(await createDocument({ title: "A Manuscript" }));
    const documentId = created.documentId;
    type Read = { revisionId: string; frontMatter?: Record<string, unknown>; blocks: readonly { blockId: string; role?: string }[] };
    let document = ok<Read>(await readDocument(documentId));
    expect(document.frontMatter).toBeUndefined();

    await settle();
    const set = ok<{ revisionId: string }>(
      await setFrontMatter({
        documentId,
        baseRevisionId: document.revisionId,
        frontMatter: {
          authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
          affiliations: ["Analytical Engines Ltd", "Difference Works"],
          keywords: ["provenance", "typesetting"],
          venue: "ieee",
        },
      }),
    );
    document = ok<Read>(await readDocument(documentId));
    expect(document.frontMatter).toEqual({
      authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
      affiliations: ["Analytical Engines Ltd", "Difference Works"],
      keywords: ["provenance", "typesetting"],
      venue: "ieee",
    });

    // A stale base is refused; setting it whole again clears what is left out.
    await settle();
    // The document's first revision is stale now that the front matter moved it.
    expect((await setFrontMatter({ documentId, baseRevisionId: created.revisionId, frontMatter: {} })).outcome).toBe("conflict");
    ok(await setFrontMatter({ documentId, baseRevisionId: set.revisionId, frontMatter: { keywords: ["provenance"] } }));
    document = ok<Read>(await readDocument(documentId));
    expect(document.frontMatter).toEqual({ keywords: ["provenance"] });

    // The abstract is a text block of its own role, written and read as one.
    await settle();
    const abstract = ok<{ blockId: string }>(
      await insertBlock({ documentId, block: { kind: "text", role: "abstract", runs: [{ text: "We show that a record can emit a paper." }] }, placement: { at: "start" } }),
    );
    document = ok<Read>(await readDocument(documentId));
    expect(document.blocks.find((block) => block.blockId === abstract.blockId)?.role).toBe("abstract");
  });

  it("Given pictures and a table, Then numbering one is a setFigure on its base, figures and tables count apart, and a reference follows", async () => {
    const created = ok<{ documentId: string }>(await createDocument({ title: "Figures" }));
    const documentId = created.documentId;
    type Figure = { blockId: string; revisionId: string; kind: string; caption?: string; numbered?: boolean; number?: number };
    type Read = { blocks: readonly Figure[]; figureNumbers?: Record<string, number>; tableNumbers?: Record<string, number> };

    const first = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({ documentId, block: { kind: "image" }, placement: { at: "end" } }),
    );
    const second = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({ documentId, block: { kind: "image" }, placement: { at: "end" } }),
    );
    const table = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({ documentId, block: { kind: "table", columns: [{ name: "x", type: "number" }], rows: [["1"]] }, placement: { at: "end" } }),
    );
    let document = ok<Read>(await readDocument(documentId));
    expect(document.figureNumbers).toBeUndefined();

    await settle();
    // The second picture asks for a number with a caption; the first none.
    const captioned = ok<{ blockId: string; revisionId: string }>(
      await setFigure({ documentId, blockId: second.blockId, baseRevisionId: second.revisionId, caption: "The control", numbered: true }),
    );
    ok(await setFigure({ documentId, blockId: table.blockId, baseRevisionId: table.revisionId, numbered: true }));
    document = ok<Read>(await readDocument(documentId));
    expect(document.figureNumbers).toEqual({ [second.blockId]: 1 });
    expect(document.tableNumbers).toEqual({ [table.blockId]: 1 });
    expect(document.blocks.find((block) => block.blockId === second.blockId)).toMatchObject({ caption: "The control", number: 1 });

    await settle();
    // Numbering the picture above renumbers the one below with nothing
    // written to it, and a number needs no caption.
    ok(await setFigure({ documentId, blockId: first.blockId, baseRevisionId: first.revisionId, numbered: true }));
    document = ok<Read>(await readDocument(documentId));
    expect(document.figureNumbers).toEqual({ [first.blockId]: 1, [second.blockId]: 2 });
    expect(document.blocks.find((block) => block.blockId === second.blockId)?.revisionId).toBe(captioned.revisionId);

    // A sentence refers to the figure and the table; the references survive
    // the write and the read, and carry no text of their own.
    await settle();
    ok(
      await insertBlock({
        documentId,
        block: { kind: "text", runs: [{ text: "See " }, { text: "", figureRef: second.blockId }, { text: " and " }, { text: "", tableRef: table.blockId }] },
        placement: { at: "start" },
      }),
    );
    const withWords = ok<{ blocks: readonly (Figure & { runs?: readonly Record<string, unknown>[] })[] }>(await readDocument(documentId));
    expect(withWords.blocks[0]?.runs).toEqual([
      { text: "See " },
      { text: "", figureRef: second.blockId },
      { text: " and " },
      { text: "", tableRef: table.blockId },
    ]);

    // A stale base is refused as for text, a table's caption is the table's
    // own revise, and a block that is neither is refused by name.
    await settle();
    expect((await setFigure({ documentId, blockId: second.blockId, baseRevisionId: second.revisionId, numbered: false })).outcome).toBe("conflict");
    const tableAgain = document.blocks.find((block) => block.blockId === table.blockId);
    expect((await setFigure({ documentId, blockId: table.blockId, baseRevisionId: tableAgain?.revisionId ?? "", caption: "x" })).outcome).toBe("validationFailure");
    const words = withWords.blocks[0];
    expect((await setFigure({ documentId, blockId: words?.blockId ?? "", baseRevisionId: words?.revisionId ?? "", numbered: true })).outcome).toBe("validationFailure");
  });

  it("Given an equation, Then it is written and read back with its number, revised whole, and renumbered by what stands above it", async () => {
    const created = ok<{ documentId: string }>(await createDocument({ title: "Mathematics" }));
    const documentId = created.documentId;
    type Equation = {
      blockId: string;
      revisionId: string;
      kind: string;
      tex?: string;
      caption?: string;
      numbered?: boolean;
      number?: number;
    };

    const plain = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: { kind: "equation", tex: "a^2 + b^2 = c^2" },
        placement: { at: "end" },
      }),
    );
    const numbered = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: { kind: "equation", tex: "e^{i\\pi} + 1 = 0", caption: "Euler's identity", numbered: true },
        placement: { at: "end" },
      }),
    );

    let document = ok<{ blocks: readonly Equation[]; equationNumbers?: Record<string, number> }>(
      await readDocument(documentId),
    );
    const stored = document.blocks.find((block) => block.blockId === numbered.blockId);
    expect(stored?.kind).toBe("equation");
    expect(stored?.tex).toBe("e^{i\\pi} + 1 = 0");
    expect(stored?.caption).toBe("Euler's identity");
    // The number is the document's order, answered by the read and stored
    // nowhere: the equation that asked for none carries none.
    expect(stored?.number).toBe(1);
    expect(document.blocks.find((block) => block.blockId === plain.blockId)?.number).toBeUndefined();
    expect(document.equationNumbers).toEqual({ [numbered.blockId]: 1 });

    await settle();
    // A revise carries the whole equation onto the same block; asking for a
    // number gives the one its place earns, not the one it was written with.
    const revised = ok<{ blockId: string; revisionId: string }>(
      await reviseEquation({
        documentId,
        blockId: plain.blockId,
        baseRevisionId: plain.revisionId,
        tex: "c = \\sqrt{a^2 + b^2}",
        numbered: true,
      }),
    );
    expect(revised.blockId).toBe(plain.blockId);

    document = ok<{ blocks: readonly Equation[]; equationNumbers?: Record<string, number> }>(
      await readDocument(documentId),
    );
    // Nothing was written to the equation below, and it renumbered all the
    // same: the number was never its content.
    expect(document.equationNumbers).toEqual({ [plain.blockId]: 1, [numbered.blockId]: 2 });
    const grown = document.blocks.find((block) => block.blockId === plain.blockId);
    expect(grown?.tex).toBe("c = \\sqrt{a^2 + b^2}");
    expect(grown?.number).toBe(1);
    expect(document.blocks.find((block) => block.blockId === numbered.blockId)?.revisionId).toBe(
      numbered.revisionId,
    );

    await settle();
    // A revise that leaves the ask out takes the number away, and a stale
    // base is refused as it is for text.
    const plainAgain = ok<{ revisionId: string }>(
      await reviseEquation({
        documentId,
        blockId: plain.blockId,
        baseRevisionId: revised.revisionId,
        tex: "c = \\sqrt{a^2 + b^2}",
      }),
    );
    document = ok<{ blocks: readonly Equation[]; equationNumbers?: Record<string, number> }>(
      await readDocument(documentId),
    );
    expect(document.equationNumbers).toEqual({ [numbered.blockId]: 1 });

    await settle();
    const stale = await reviseEquation({
      documentId,
      blockId: plain.blockId,
      baseRevisionId: revised.revisionId,
      tex: "x",
    });
    expect(stale.outcome).toBe("conflict");
    expect(plainAgain.revisionId).not.toBe(revised.revisionId);

    // A block that is not an equation is refused by name, and so is an
    // equation carrying no source.
    const wrongKind = await reviseEquation({
      documentId,
      blockId: numbered.blockId,
      baseRevisionId: numbered.revisionId,
      tex: "",
    });
    expect(wrongKind.outcome).toBe("validationFailure");

    // Mathematics inside a sentence survives the write and the read: the
    // source is the run's text, and a reference carries none of its own.
    await settle();
    const sentence = ok<{ blockId: string; revisionId: string }>(
      await insertBlock({
        documentId,
        block: {
          kind: "text",
          runs: [
            { text: "Einstein wrote " },
            { text: "E = mc^2", math: true },
            { text: ", see " },
            { text: "", equationRef: numbered.blockId },
            { text: "." },
          ],
        },
        placement: { at: "end" },
      }),
    );
    const withWords = ok<{ blocks: readonly (Equation & { runs?: readonly Record<string, unknown>[] })[] }>(
      await readDocument(documentId),
    );
    const words = withWords.blocks.find((block) => block.blockId === sentence.blockId);
    expect(words?.runs?.[1]).toEqual({ text: "E = mc^2", math: true });
    expect(words?.runs?.[3]).toEqual({ text: "", equationRef: numbered.blockId });
  });
});


/**
 * Every drawn row has a place (BO_0263_001): a block moves between the keys
 * of any two rows the reader saw — a proposed insert, a retired block — and
 * lands there; the insert, once accepted, stays after it; a dragged proposal
 * is placed the same way, unanswered. Over the one graph.
 */
describe.skipIf(!configured)("a move between drawn rows", () => {
  let documentId = "";

  afterAll(async () => {
    const document = await readDocument(documentId);
    if (document.outcome === "success") {
      await settle();
      await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
    }
  });


  it("Given a staged insert and a retired block, When blocks are moved between their keys, Then each lands where it was dropped", async () => {
    type Read = { blocks: readonly { blockId: string; revisionId: string; order: string }[] };
    const created = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Between rows" }));
    documentId = created.documentId;
    const a = created.blockId;
    const b = ok<{ blockId: string }>(
      await insertBlock({ documentId, block: { kind: "text", runs: [{ text: "B" }] }, placement: { at: "end" } }),
    ).blockId;
    const c = ok<{ blockId: string }>(
      await insertBlock({ documentId, block: { kind: "text", runs: [{ text: "C" }] }, placement: { at: "end" } }),
    ).blockId;
    await settle();
    const staged = ok<{ groupId: string; items: readonly { itemId: string; kind: string; blockId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "insert", block: { kind: "text", runs: [{ text: "Proposed" }] }, placement: { after: a } }],
        request: { by: "the behaviour suite" },
      }),
    );
    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; block: { order: string } | null }[] }[] }>(
      await readDocumentProposals(documentId),
    );
    const insert = proposals.groups.find((group) => group.groupId === staged.groupId)?.items[0];
    const proposedKey = insert?.block?.order ?? "";
    let document = ok<Read>(await readDocument(documentId));
    const keyOf = (blockId: string) => document.blocks.find((block) => block.blockId === blockId)?.order ?? "";
    expect(keyOf(a) < proposedKey && proposedKey < keyOf(b)).toBe(true);

    // C dropped directly before the proposed insert, after A.
    await settle();
    ok(await moveBlock({
      documentId,
      blockId: c,
      baseRevisionId: document.blocks.find((block) => block.blockId === c)?.revisionId ?? "",
      placement: { between: [keyOf(a), proposedKey] },
    }));
    document = ok<Read>(await readDocument(documentId));
    expect(keyOf(a) < keyOf(c) && keyOf(c) < proposedKey).toBe(true);

    // B retired; A dropped directly before the retired row, where it sits.
    await settle();
    ok(await retireBlock({ documentId, blockId: b }));
    const retiredKey = ok<readonly { blockId: string; order: string }[]>(await readRetiredBlocks(documentId)).find((block) => block.blockId === b)?.order ?? "";
    await settle();
    ok(await moveBlock({
      documentId,
      blockId: a,
      baseRevisionId: document.blocks.find((block) => block.blockId === a)?.revisionId ?? "",
      placement: { between: [proposedKey, retiredKey] },
    }));
    document = ok<Read>(await readDocument(documentId));
    expect(proposedKey < keyOf(a) && keyOf(a) < retiredKey).toBe(true);

    // Accepted, the insert stays where it stood: after C, before A.
    ok(await answerDocumentProposal({ itemId: insert?.itemId ?? "", answer: "accepted" }));
    document = ok<Read>(await readDocument(documentId));
    expect(document.blocks.map((block) => block.blockId)).toEqual([c, staged.items[0]?.blockId, a]);

    // Two keys out of order are refused, and nothing moves.
    await settle();
    const refused = await moveBlock({
      documentId,
      blockId: c,
      baseRevisionId: document.blocks.find((block) => block.blockId === c)?.revisionId ?? "",
      placement: { between: [retiredKey, proposedKey] },
    });
    expect(refused.outcome).not.toBe("success");
    expect(ok<Read>(await readDocument(documentId)).blocks.map((block) => block.blockId)).toEqual([c, staged.items[0]?.blockId, a]);
  });

  it("Given a retired block, When it is moved, Then it stays retired at its new key, a stale base is refused, and restoring there lands it there", async () => {
    type Read = { blocks: readonly { blockId: string; revisionId: string; order: string }[] };
    type Retired = readonly { blockId: string; revisionId: string; order: string }[];
    const document = ok<Read>(await readDocument(documentId));
    const [first, second] = document.blocks;
    const retired = ok<Retired>(await readRetiredBlocks(documentId))[0];
    expect(retired).toBeDefined();
    await settle();
    ok(await moveRetiredBlock({
      documentId,
      blockId: retired?.blockId ?? "",
      baseRevisionId: retired?.revisionId ?? "",
      placement: { between: [first?.order ?? null, second?.order ?? null] },
    }));
    const moved = ok<Retired>(await readRetiredBlocks(documentId)).find((block) => block.blockId === retired?.blockId);
    expect((first?.order ?? "") < (moved?.order ?? "") && (moved?.order ?? "") < (second?.order ?? "")).toBe(true);
    expect(ok<Read>(await readDocument(documentId)).blocks.some((block) => block.blockId === retired?.blockId)).toBe(false);

    await settle();
    const stale = await moveRetiredBlock({
      documentId,
      blockId: retired?.blockId ?? "",
      baseRevisionId: retired?.revisionId ?? "",
      placement: { at: "end" },
    });
    expect(stale.outcome).not.toBe("success");
    const notRetired = await moveRetiredBlock({ documentId, blockId: first?.blockId ?? "", baseRevisionId: first?.revisionId ?? "", placement: { at: "end" } });
    expect(notRetired.outcome).not.toBe("success");

    await settle();
    ok(await restoreBlock({ documentId, blockId: retired?.blockId ?? "", placement: { between: [first?.order ?? null, second?.order ?? null] } }));
    expect(ok<Read>(await readDocument(documentId)).blocks.map((block) => block.blockId).slice(0, 3)).toEqual([first?.blockId, retired?.blockId, second?.blockId]);
  });

  it("Given a staged insert, When it is placed between two keys, Then it is staged there and stays unanswered", async () => {
    type Read = { blocks: readonly { blockId: string; order: string }[] };
    const document = ok<Read>(await readDocument(documentId));
    const [first, second] = document.blocks;
    await settle();
    const staged = ok<{ groupId: string; items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "insert", block: { kind: "text", runs: [{ text: "Placed" }] }, placement: { at: "end" } }],
        request: { by: "the behaviour suite" },
      }),
    );
    const itemId = staged.items[0]?.itemId ?? "";
    await settle();
    const placed = ok<{ order: string }>(
      await placeProposedItem({ documentId, itemId, placement: { between: [first?.order ?? null, second?.order ?? null] } }),
    );
    expect((first?.order ?? "") < placed.order && placed.order < (second?.order ?? "")).toBe(true);
    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; block: { order: string } | null }[] }[] }>(
      await readDocumentProposals(documentId),
    );
    expect(proposals.groups.find((group) => group.groupId === staged.groupId)?.items[0]?.block?.order).toBe(placed.order);
  });
});
