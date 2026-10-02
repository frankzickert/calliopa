import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDocument,
  deleteDocument,
  insertBlock,
  readDocument,
  retireBlock,
  reviseTextBlock,
} from "~/extensions/documents/server/documents";
import { childTitle, DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { childrenOf, facesOf, focusOf, openFocusedWork } from "~/server/focused-work";
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

  it("Given focused work, Then the parent's face reads its title and no words", async () => {
    await settle();
    const face = ok<Record<string, { title: string; face: unknown }>>(await facesOf(DOCUMENT_TARGET_KIND, parent));
    expect(face[blockA]?.face).toBeNull();
    expect(face[blockA]?.title).toBe("Request-local caching could reduce repeated checks.");
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
