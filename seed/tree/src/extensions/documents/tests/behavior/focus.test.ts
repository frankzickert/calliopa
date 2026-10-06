import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDocument,
  deleteDocument,
  insertBlock,
  moveBlockIn,
  proposeDocumentChanges,
  readDocument,
  readRetiredBlocks,
  restoreBlock,
  retireBlock,
  reviseTextBlock,
} from "~/extensions/documents/server/documents";
import { handleDocumentCommand } from "~/extensions/documents/server/api";
import { childTitle, DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { readEmptyFocusedWork } from "~/extensions/documents/server/migrations";
import { bringBackFocusedWork, childrenOf, facesOf, focusOf, openFocusedWork, removeEmptyFocusedWork } from "~/server/focused-work";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * Focused work over the one graph (`CA_0047_002`, `CA_0047_007`): a block
 * opened as its own document with the `focuses` edge, the one-child rule,
 * the read-back from the block with the child's synthesis for the parent's
 * face, the retire refusal while the child stands, and the delete that
 * closes the edge. Runs under the kernel harness like `work.test.ts`.
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

const words = (text: string) => [{ text }];

type Doc = {
  documentId: string;
  revisionId: string;
  title: string;
  blocks: readonly { blockId: string; revisionId: string; kind: string; runs?: readonly { text: string }[] }[];
};

const revisionOf = async (documentId: string, blockId: string): Promise<string> =>
  ok<Doc>(await readDocument(documentId)).blocks.find((block) => block.blockId === blockId)?.revisionId ?? "";

describe("a child's title", () => {
  it("is the block's words to the first sentence", () => {
    expect(childTitle("Caching helps. It is also risky.")).toBe("Caching helps.");
    expect(childTitle("No sentence end here")).toBe("No sentence end here");
    expect(childTitle("   ")).toBe("Focused work");
  });
});

describe.skipIf(!configured)("focused work over CCGW", () => {
  let parent = "";
  let blockA = "";
  let blockB = "";
  let child = "";
  const created: string[] = [];

  beforeAll(async () => {
    const made = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Caching" }));
    parent = made.documentId;
    blockA = made.blockId;
    created.push(parent);
    await settle();
    await reviseTextBlock({
      documentId: parent,
      blockId: blockA,
      baseRevisionId: await revisionOf(parent, blockA),
      runs: words("Request-local caching could reduce repeated checks. It needs a validity rule."),
    });
    const inserted = ok<{ blockId: string }>(
      await insertBlock({ documentId: parent, block: { kind: "text", runs: words("Revision changes complicate this.") }, placement: { at: "end" } }),
    );
    blockB = inserted.blockId;
  });

  afterAll(async () => {
    for (const documentId of [...created].reverse()) {
      const document = await readDocument(documentId);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
      }
    }
  });

  it("Given a block opened as focused work, Then a child titled from its first sentence focuses it, with a first block to write in, and a second open answers the same child", async () => {
    await settle();
    const opened = ok<{ itemId: string; title: string; created: boolean }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: parent, blockId: blockA }));
    child = opened.itemId;
    created.push(child);
    expect(opened.created).toBe(true);
    expect(opened.title).toBe("Request-local caching could reduce repeated checks.");
    await settle();
    const read = ok<Doc>(await readDocument(child));
    expect(read.title).toBe(opened.title);
    expect(read.blocks.length).toBe(1);

    const again = ok<{ itemId: string; created: boolean }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: parent, blockId: blockA }));
    expect(again.created).toBe(false);
    expect(again.itemId).toBe(child);

    const children = ok<Map<string, { itemId: string }>>(await childrenOf(DOCUMENT_TARGET_KIND, [blockA, blockB]));
    expect(children.get(blockA)?.itemId).toBe(child);
    expect(children.has(blockB)).toBe(false);
    const focus = ok<{ blockId: string } | null>(await focusOf(DOCUMENT_TARGET_KIND, child));
    expect(focus?.blockId).toBe(blockA);
    // The parent's block keeps its place.
    expect(ok<Doc>(await readDocument(parent)).blocks.map((block) => block.blockId)).toEqual([blockA, blockB]);
  });

  it("Given focused work, Then the parent's face reads its title and no words, and lists none of its empty first block", async () => {
    await settle();
    const face = ok<Record<string, { title: string; face: unknown; lines?: readonly string[] }>>(await facesOf(DOCUMENT_TARGET_KIND, parent));
    expect(face[blockA]?.face).toBeNull();
    expect(face[blockA]?.title).toBe("Request-local caching could reduce repeated checks.");
    expect(face[blockA]?.lines).toEqual([]);
  });

  it("Given a block opened blank and a block moved in, Then the work holds that block alone, first, and the parent's face lists its words (BO_0349_019)", async () => {
    const made = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Nesting" }));
    created.push(made.documentId);
    await settle();
    await reviseTextBlock({ documentId: made.documentId, blockId: made.blockId, baseRevisionId: await revisionOf(made.documentId, made.blockId), runs: words("What is the story telling the reader") });
    const moving = ok<{ blockId: string }>(
      await insertBlock({ documentId: made.documentId, block: { kind: "text", runs: words("The hook lands here.") }, placement: { at: "end" } }),
    ).blockId;
    await settle();
    const opened = ok<{ itemId: string; created: boolean }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: made.documentId, blockId: made.blockId, blank: true }));
    created.push(opened.itemId);
    expect(opened.created).toBe(true);
    await settle();
    expect(ok<Doc>(await readDocument(opened.itemId)).blocks).toEqual([]);
    ok(await moveBlockIn({ documentId: opened.itemId, fromDocumentId: made.documentId, blockId: moving, placement: { at: "end" } }));
    await settle();
    expect(ok<Doc>(await readDocument(opened.itemId)).blocks.map((block) => block.blockId)).toEqual([moving]);
    const face = ok<Record<string, { lines?: readonly string[] }>>(await facesOf(DOCUMENT_TARGET_KIND, made.documentId));
    expect(face[made.blockId]?.lines).toEqual(["The hook lands here."]);
  });

  it("Given a block with focused work, Then retiring it is refused naming the child, and deleting the child closes the edge so the retire goes through", async () => {
    await settle();
    const refused = await retireBlock({ documentId: parent, blockId: blockA });
    expect(refused.outcome).toBe("validationFailure");
    if (refused.outcome === "validationFailure") {
      expect(refused.failures[0].rule).toBe("focusedWork");
      expect(refused.failures[0].detail).toContain("Request-local caching could reduce repeated checks.");
    }
    const document = ok<Doc>(await readDocument(child));
    ok(await deleteDocument({ documentId: child, baseRevisionId: document.revisionId }));
    await settle();
    expect(ok<Map<string, unknown>>(await childrenOf(DOCUMENT_TARGET_KIND, [blockA])).has(blockA)).toBe(false);
    ok(await retireBlock({ documentId: parent, blockId: blockA }));
    await settle();
    expect(ok<Doc>(await readDocument(parent)).blocks.map((block) => block.blockId)).toEqual([blockB]);
  });
});

/**
 * A focused work with no standing block goes, and the parent block stays
 * (`CA_0083_001`, `CA_0083_004`, `CA_0083_005`): the writes that empty a child
 * answer what went, a child still holding a block or awaited by a proposed
 * insert stands, and *Take back* brings it back as it was.
 */
describe.skipIf(!configured)("an empty focused work goes", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const documentId of [...created].reverse()) {
      const document = await readDocument(documentId);
      if (document.outcome === "success") {
        await settle();
        await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
      }
    }
  });

  /** A parent with one block opened as focused work, the child holding the
   * blocks named, each with words. */
  const parentWithWork = async (title: string, held: readonly string[]) => {
    const made = ok<{ documentId: string; blockId: string }>(await createDocument({ title }));
    created.push(made.documentId);
    await settle();
    await reviseTextBlock({ documentId: made.documentId, blockId: made.blockId, baseRevisionId: await revisionOf(made.documentId, made.blockId), runs: words(`${title}. More.`) });
    await settle();
    const opened = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: made.documentId, blockId: made.blockId, blank: true }));
    created.push(opened.itemId);
    const blocks: string[] = [];
    for (const said of held) {
      await settle();
      blocks.push(ok<{ blockId: string }>(await insertBlock({ documentId: opened.itemId, block: { kind: "text", runs: words(said) }, placement: { at: "end" } })).blockId);
    }
    await settle();
    return { parent: made.documentId, block: made.blockId, child: opened.itemId, blocks };
  };

  /** A command through the documents route, as the editor sends it. */
  const command = async (documentId: string, body: Record<string, unknown>) =>
    (await handleDocumentCommand(new Request("http://harness/commands", { method: "POST", body: JSON.stringify(body) }), documentId)).body as {
      outcome: string;
      result?: { emptied?: { itemId: string; blockId: string; parent: { itemId: string; title: string } | null; kept: Record<string, unknown> } };
    };

  it("Given a focused work holding two blocks, When one is removed, Then it stands", async () => {
    const work = await parentWithWork("Two blocks", ["First.", "Second."]);
    const answered = await command(work.child, { command: "retire", blockId: work.blocks[0] });
    expect(answered.outcome).toBe("success");
    expect(answered.result?.emptied).toBeUndefined();
    await settle();
    expect(ok<Map<string, { itemId: string }>>(await childrenOf(DOCUMENT_TARGET_KIND, [work.block])).get(work.block)?.itemId).toBe(work.child);
  });

  it("When its last block is removed, Then it goes with the removed blocks, the parent block stays and wears no face, And Take back brings it back as it was with the block standing again", async () => {
    const work = await parentWithWork("Removed last", ["Kept away.", "The last one."]);
    ok(await retireBlock({ documentId: work.child, blockId: work.blocks[0] ?? "" }));
    await settle();
    const answered = await command(work.child, { command: "retire", blockId: work.blocks[1] });
    expect(answered.outcome).toBe("success");
    const emptied = answered.result?.emptied;
    expect(emptied?.itemId).toBe(work.child);
    expect(emptied?.blockId).toBe(work.block);
    expect(emptied?.parent).toEqual({ itemId: work.parent, title: "Removed last" });
    expect(emptied?.kept["title"]).toBe("Removed last.");
    expect([...((emptied?.kept["retired"] as string[]) ?? [])].sort()).toEqual([...work.blocks].sort());
    await settle();
    expect(ok<Map<string, unknown>>(await childrenOf(DOCUMENT_TARGET_KIND, [work.block])).has(work.block)).toBe(false);
    expect(ok<Record<string, unknown>>(await facesOf(DOCUMENT_TARGET_KIND, work.parent))[work.block]).toBeUndefined();
    expect((await readDocument(work.child)).outcome).toBe("noResult");
    expect(ok<Doc>(await readDocument(work.parent)).blocks.map((block) => block.blockId)).toEqual([work.block]);

    const back = ok<{ itemId: string; title: string }>(await bringBackFocusedWork({ kind: DOCUMENT_TARGET_KIND, blockId: work.block, kept: emptied?.kept ?? {} }));
    created.push(back.itemId);
    expect(back.title).toBe("Removed last.");
    await settle();
    ok(await restoreBlock({ documentId: back.itemId, blockId: work.blocks[1] ?? "", placement: { at: "end" } }));
    await settle();
    expect(ok<Doc>(await readDocument(back.itemId)).blocks.map((block) => block.blockId)).toEqual([work.blocks[1]]);
    expect(ok<readonly { blockId: string }[]>(await readRetiredBlocks(back.itemId)).map((block) => block.blockId)).toEqual([work.blocks[0]]);
    expect(ok<Map<string, { itemId: string }>>(await childrenOf(DOCUMENT_TARGET_KIND, [work.block])).get(work.block)?.itemId).toBe(back.itemId);
    const refused = await bringBackFocusedWork({ kind: DOCUMENT_TARGET_KIND, blockId: work.block, kept: emptied?.kept ?? {} });
    expect(refused.outcome).toBe("validationFailure");
  });

  it("When its last block is dragged out into the parent, Then it goes, And the block stands in the parent", async () => {
    const work = await parentWithWork("Dragged out", ["Going home."]);
    const answered = await command(work.parent, { command: "moveIn", blockId: work.blocks[0], fromDocumentId: work.child, placement: { at: "end" } });
    expect(answered.outcome).toBe("success");
    expect(answered.result?.emptied?.itemId).toBe(work.child);
    await settle();
    expect(ok<Doc>(await readDocument(work.parent)).blocks.map((block) => block.blockId)).toEqual([work.block, work.blocks[0]]);
    expect(ok<Map<string, unknown>>(await childrenOf(DOCUMENT_TARGET_KIND, [work.block])).has(work.block)).toBe(false);
  });

  it("Given an empty focused work a proposal would insert into, Then it stands, And when that proposal is rejected it goes", async () => {
    const work = await parentWithWork("Awaited", []);
    const staged = ok<{ items: readonly { itemId: string }[] }>(
      await proposeDocumentChanges({ documentId: work.child, items: [{ kind: "insert", block: { kind: "text", runs: words("Proposed.") }, placement: { at: "end" } }] }),
    );
    await settle();
    expect(ok<unknown>(await removeEmptyFocusedWork(DOCUMENT_TARGET_KIND, work.child))).toBeNull();
    expect(ok<readonly { itemId: string }[]>(await readEmptyFocusedWork()).some((found) => found.itemId === work.child)).toBe(false);
    const answered = await command(work.child, { command: "answerProposal", itemId: staged.items[0]?.itemId, answer: "rejected" });
    expect(answered.outcome).toBe("success");
    expect(answered.result?.emptied?.itemId).toBe(work.child);
  });

  it("Given a focused work already empty, Then the migration finds it, And not one that holds a block", async () => {
    const empty = await parentWithWork("Already empty", []);
    const full = await parentWithWork("Still full", ["Here."]);
    const found = ok<readonly { itemId: string }[]>(await readEmptyFocusedWork()).map((one) => one.itemId);
    expect(found).toContain(empty.child);
    expect(found).not.toContain(full.child);
  });
});
