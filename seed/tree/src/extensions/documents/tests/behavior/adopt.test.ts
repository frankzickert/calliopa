import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDocument, deleteDocument, readDocument } from "~/extensions/documents/server/documents";
import { DOCUMENT_TARGET_KIND } from "~/extensions/documents/server/focus";
import { adoptFocusedWork, childrenOf } from "~/server/focused-work";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * A document dropped into a document (`DO_0043_001`, `DO_0043_003`): one write
 * makes a text block of the target carrying the dropped document's title and
 * moves the document's `focuses` edge onto it, closing the one it held
 * elsewhere, and a drop into the document itself or below it along
 * `focuses` is refused with nothing written. Runs under the kernel harness
 * like `move-in.test.ts`.
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

type Block = { blockId: string; order: string; kind: string; runs?: readonly { text: string }[] };
type Doc = { title: string; revisionId: string; blocks: readonly Block[] };

const read = async (documentId: string): Promise<Doc> => ok<Doc>(await readDocument(documentId));
const idsOf = async (documentId: string): Promise<readonly string[]> => (await read(documentId)).blocks.map((block) => block.blockId);
const childOf = async (blockId: string): Promise<string | undefined> =>
  ok<Map<string, { itemId: string }>>(await childrenOf(DOCUMENT_TARGET_KIND, [blockId])).get(blockId)?.itemId;

describe.skipIf(!configured)("a document dropped into a document over CCGW", () => {
  let host = "";
  let hostFirst = "";
  let dropped = "";
  let droppedFirst = "";
  let other = "";
  let adoptedBlock = "";
  const created: string[] = [];

  beforeAll(async () => {
    const a = ok<{ documentId: string; blockId: string }>(await createDocument({ title: "The host" }));
    host = a.documentId;
    hostFirst = a.blockId;
    created.push(host);
    const b = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "The dropped one", block: { kind: "text", runs: words("What it says.") } }),
    );
    dropped = b.documentId;
    droppedFirst = b.blockId;
    created.push(dropped);
    const c = ok<{ documentId: string }>(await createDocument({ title: "Another host" }));
    other = c.documentId;
    created.push(other);
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

  it("Given a document, When it is dropped before the host's first block, Then a new block carrying its title stands there and focuses it, And the document is unchanged", async () => {
    const before = await read(dropped);
    const first = (await read(host)).blocks[0];
    await settle();
    adoptedBlock = ok<{ blockId: string; targetId: string }>(
      await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: host, childId: dropped, placement: { between: [null, first?.order ?? null] } }),
    ).blockId;
    const hostNow = await read(host);
    expect(hostNow.blocks.map((block) => block.blockId)).toEqual([adoptedBlock, hostFirst]);
    expect(hostNow.blocks[0]?.kind).toBe("text");
    expect(hostNow.blocks[0]?.runs?.map((run) => run.text).join("")).toBe("The dropped one");
    expect(await childOf(adoptedBlock)).toBe(dropped);
    const after = await read(dropped);
    expect(after.title).toBe(before.title);
    expect(after.blocks.map((block) => block.blockId)).toEqual([droppedFirst]);
  });

  it("Given the document already focuses a block, When it is dropped into another document, Then it moves there, And the old block keeps its words and has no focused work", async () => {
    await settle();
    const moved = ok<{ blockId: string }>(await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: other, childId: dropped })).blockId;
    expect((await idsOf(other)).at(-1)).toBe(moved);
    expect(await childOf(moved)).toBe(dropped);
    expect(await childOf(adoptedBlock)).toBeUndefined();
    const old = (await read(host)).blocks.find((block) => block.blockId === adoptedBlock);
    expect(old?.runs?.map((run) => run.text).join("")).toBe("The dropped one");
  });

  it("Given a drop on a block's middle, Then that block's focused work is opened blank and the document lands in it as its first block", async () => {
    await settle();
    const adopted = ok<{ blockId: string; targetId: string }>(
      await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: host, childId: dropped, into: hostFirst }),
    );
    const work = await childOf(hostFirst);
    expect(work).toBe(adopted.targetId);
    if (work !== undefined) created.push(work);
    expect(await idsOf(adopted.targetId)).toEqual([adopted.blockId]);
    expect(await childOf(adopted.blockId)).toBe(dropped);
  });

  it("A document dropped into itself, or into its own focused work, is refused with nothing written, And a refused nest opens no focused work", async () => {
    const hostBefore = await idsOf(host);
    const droppedBefore = await idsOf(dropped);
    const self = await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: dropped, childId: dropped });
    expect(self.outcome).not.toBe("success");
    expect(JSON.stringify(self)).toContain("itself");

    // `dropped` now lies below the host, as the focused work of a block in
    // its first block's work, so the host dropped into `dropped` would come
    // to hold itself.
    const below = await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: dropped, childId: host });
    expect(below.outcome).not.toBe("success");
    expect(JSON.stringify(below)).toContain("own focused work");

    const nest = await adoptFocusedWork({ kind: DOCUMENT_TARGET_KIND, targetId: dropped, childId: host, into: droppedFirst });
    expect(nest.outcome).not.toBe("success");
    expect(await childOf(droppedFirst)).toBeUndefined();

    expect(await idsOf(host)).toEqual(hostBefore);
    expect(await idsOf(dropped)).toEqual(droppedBefore);
  });
});
