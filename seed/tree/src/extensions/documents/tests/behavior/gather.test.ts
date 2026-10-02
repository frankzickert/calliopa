import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  readDocument,
  readDocumentProposals,
  insertBlock,
} from "~/extensions/documents/server/documents";
import { stage } from "~/server/ccgw/client";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * A gather over a real CCGW and a real kernel (`BO_0322_014`): staged as the
 * kernel's `gather` item compiles it, the document's proposals read it as one
 * item on its block with the blocks it moves; accepted, it lands whole as its
 * group — the summary on the block, the focused work holding the moved block
 * and the block's original words in document order; a second gather into the
 * focused work the block already has, rejected, leaves the document as it
 * was, and accepted lands after its last block. Without the harness the
 * suite skips.
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
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome)}`);
  return outcome["result"] as T;
};

type Block = { blockId: string; revisionId: string; containmentId: string; order: string; runs?: readonly { text: string }[] };
type Read = { revisionId: string; blocks: readonly Block[] };
const words = (read: Read): string[] => read.blocks.map((block) => block.runs?.map((run) => run.text).join("") ?? "");
const runs = (text: string) => [{ text }];

describe.skipIf(!configured)("a gather over CCGW", () => {
  let documentId = "";
  const child = randomUUID();

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "Gathered", block: { kind: "text", runs: runs("The storm arrives.") } }),
    );
    documentId = created.documentId;
    for (const text of ["The lights go out.", "Candles are found."]) {
      await settle();
      const read = ok<Read>(await readDocument(documentId));
      const last = read.blocks[read.blocks.length - 1] as Block;
      ok(await insertBlock({ documentId, block: { kind: "text", runs: runs(text) }, placement: { after: last.blockId } }));
    }
  });

  afterAll(async () => {
    if (documentId === "") return;
    const read = ok<Read>(await readDocument(documentId));
    await deleteDocument({ documentId, baseRevisionId: read.revisionId });
  });

  /** Stages the script the kernel's compileGather writes for a block, its
   * stretch and its summary, into a group of its own. */
  const stageGather = async (head: Block, moved: readonly Block[], summary: string, creates: boolean, after: string): Promise<string> => {
    const group = `node:chg-${randomBytes(8).toString("hex")}`;
    const statements: string[] = [];
    const parameters: Record<string, unknown> = { gc: `node:${child}` };
    if (creates) {
      statements.push("CREATE (gd:document {id: $gd_id, title: $gd_title})", "RELATE gc -[gf:focuses]-> gh");
      Object.assign(parameters, { gd_id: child, gd_title: summary, gh: `node:${head.blockId}` });
    }
    let order = after;
    const next = () => (order = `${order}m`);
    const stretch = [...moved, head].sort((a, b) => (a.order < b.order ? -1 : 1));
    stretch.forEach((block, k) => {
      const a = `g${k}`;
      if (block.blockId === head.blockId) {
        statements.push(`CREATE (${a}:text {id: $${a}_id, order: $${a}_order, runs: $${a}_runs})`, `RELATE gc -[${a}c:CONTAINS]-> ${a}n`);
        const original = randomUUID();
        Object.assign(parameters, { [`${a}_id`]: original, [`${a}_order`]: next(), [`${a}_runs`]: head.runs, [`${a}n`]: `node:${original}` });
        return;
      }
      statements.push(`CLOSE ${a}c`, `RELATE gc -[${a}m:CONTAINS]-> ${a}n`, `SET ${a}.order = $${a}order`);
      Object.assign(parameters, { [`${a}cRelationId`]: block.containmentId, [`${a}NodeId`]: `node:${block.blockId}`, [`${a}n`]: `node:${block.blockId}`, [`${a}order`]: next() });
    });
    statements.push("SET h.runs = $hruns");
    Object.assign(parameters, { hNodeId: `node:${head.blockId}`, hruns: runs(summary) });
    ok(await stage(group, statements.join("; "), parameters, "gather, as a pinch out proposes it"));
    return group;
  };

  it("Given a gather, Then it is read as one item and accepted whole, and a second one joins the focused work it made", async () => {
    await settle();
    const read = ok<Read>(await readDocument(documentId));
    const [first, second] = read.blocks as [Block, Block, Block];
    const group = await stageGather(second, [first], "Night falls.", true, "");
    await settle();

    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; kind: string; blockId: string; gathered?: readonly string[]; createsChild?: boolean }[] }[] }>(
      await readDocumentProposals(documentId),
    );
    const items = proposals.groups.find((candidate) => candidate.groupId === group)?.items ?? [];
    expect(items.map((item) => [item.kind, item.blockId, item.gathered, item.createsChild])).toEqual([["gather", second.blockId, [first.blockId], true]]);

    ok(await answerDocumentProposal({ documentId, itemId: items[0]?.itemId ?? "", answer: "accepted" }));
    await settle();
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["Night falls.", "Candles are found."]);
    expect(words(ok<Read>(await readDocument(child)))).toEqual(["The storm arrives.", "The lights go out."]);

    // A second gather into the focused work the block has: rejected whole,
    // nothing moves; accepted, it lands after the child's last block.
    const now = ok<Read>(await readDocument(documentId));
    const [head, last] = now.blocks as [Block, Block];
    const childLast = (ok<Read>(await readDocument(child)).blocks.at(-1) as Block).order;
    const rejected = await stageGather(head, [last], "The whole night.", false, childLast);
    await settle();
    const standing = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; createsChild?: boolean }[] }[] }>(await readDocumentProposals(documentId));
    const offered = standing.groups.find((candidate) => candidate.groupId === rejected)?.items[0];
    expect(offered?.createsChild).toBe(false);
    ok(await answerDocumentProposal({ documentId, itemId: offered?.itemId ?? "", answer: "rejected" }));
    await settle();
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["Night falls.", "Candles are found."]);

    const accepted = await stageGather(head, [last], "The whole night.", false, childLast);
    await settle();
    const again = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string }[] }[] }>(await readDocumentProposals(documentId));
    ok(await answerDocumentProposal({ documentId, itemId: again.groups.find((candidate) => candidate.groupId === accepted)?.items[0]?.itemId ?? "", answer: "accepted" }));
    await settle();
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["The whole night."]);
    expect(words(ok<Read>(await readDocument(child)))).toEqual(["The storm arrives.", "The lights go out.", "Night falls.", "Candles are found."]);
  });
});
