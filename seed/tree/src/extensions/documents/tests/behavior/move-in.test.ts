import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDocument,
  deleteDocument,
  insertBlock,
  moveBlockIn,
  readDocument,
} from "~/extensions/documents/server/documents";
import { DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { childrenOf, openFocusedWork } from "~/server/focused-work";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * A block moved from one document into another (`CA_0072_006`): one write
 * closes its containment in the source and relates the target to it at the
 * minted key, keeping its identity and any `focuses` edge, and refusing a
 * move into the block's own focused work. Runs under the kernel harness like
 * `focus.test.ts`.
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

type Doc = { revisionId: string; blocks: readonly { blockId: string; order: string }[] };

const idsOf = async (documentId: string): Promise<readonly string[]> =>
  ok<Doc>(await readDocument(documentId)).blocks.map((block) => block.blockId);

describe.skipIf(!configured)("a block moved between documents over CCGW", () => {
  let source = "";
  let target = "";
  let moving = "";
  let staying = "";
  let first = "";
  let second = "";
  const created: string[] = [];

  beforeAll(async () => {
    const from = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Where it starts" }));
    source = from.documentId;
    staying = from.blockId;
    created.push(source);
    moving = ok<{ blockId: string }>(
      await insertBlock({ documentId: source, block: { kind: "text", runs: words("The block that travels.") }, placement: { at: "end" } }),
    ).blockId;
    const to = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "Where it lands" }));
    target = to.documentId;
    first = to.blockId;
    created.push(target);
    second = ok<{ blockId: string }>(
      await insertBlock({ documentId: target, block: { kind: "text", runs: words("The second block there.") }, placement: { at: "end" } }),
    ).blockId;
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

  it("Given a block of another document, When it is moved between two blocks, Then it stands there with its identity and is gone from where it was", async () => {
    const blocks = ok<Doc>(await readDocument(target)).blocks;
    await settle();
    ok(await moveBlockIn({
      documentId: target,
      fromDocumentId: source,
      blockId: moving,
      placement: { between: [blocks[0]?.order ?? null, blocks[1]?.order ?? null] },
    }));
    expect(await idsOf(target)).toEqual([first, moving, second]);
    expect(await idsOf(source)).toEqual([staying]);
  });

  it("When it is moved back to the end, Then it lands after the last block", async () => {
    await settle();
    ok(await moveBlockIn({ documentId: source, fromDocumentId: target, blockId: moving, placement: { at: "end" } }));
    expect(await idsOf(source)).toEqual([staying, moving]);
    expect(await idsOf(target)).toEqual([first, second]);
  });

  it("Given a block with focused work, When it is moved, Then the work travels with it, and a move into that work or below it is refused with nothing moved", async () => {
    await settle();
    const work = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: source, blockId: moving })).itemId;
    created.push(work);
    await settle();
    ok(await moveBlockIn({ documentId: target, fromDocumentId: source, blockId: moving, placement: { at: "end" } }));
    const children = ok<Map<string, { itemId: string }>>(await childrenOf(DOCUMENT_TARGET_KIND, [moving]));
    expect(children.get(moving)?.itemId).toBe(work);

    const into = await moveBlockIn({ documentId: work, fromDocumentId: target, blockId: moving, placement: { at: "end" } });
    expect(into.outcome).not.toBe("success");
    expect(JSON.stringify(into)).toContain("own focused work");

    // One level further down: the work's own first block opened as work.
    const inner = ok<Doc>(await readDocument(work)).blocks[0]?.blockId ?? "";
    await settle();
    const deeper = ok<{ itemId: string }>(await openFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: work, blockId: inner })).itemId;
    created.push(deeper);
    await settle();
    const below = await moveBlockIn({ documentId: deeper, fromDocumentId: target, blockId: moving, placement: { at: "end" } });
    expect(below.outcome).not.toBe("success");
    expect(await idsOf(target)).toEqual([first, second, moving]);
  });

  it("A move within one document, and a block its source does not hold, are refused with nothing moved", async () => {
    const same = await moveBlockIn({ documentId: target, fromDocumentId: target, blockId: moving, placement: { at: "end" } });
    expect(same.outcome).not.toBe("success");
    const absent = await moveBlockIn({ documentId: target, fromDocumentId: source, blockId: moving, placement: { at: "end" } });
    expect(absent.outcome).not.toBe("success");
    expect(await idsOf(target)).toEqual([first, second, moving]);
    expect(await idsOf(source)).toEqual([staying]);
  });
});
