import { afterAll, describe, expect, it } from "vitest";

import {
  answerDocumentGroup,
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  insertBlock,
  proposeDocumentChanges,
  readDocument,
  readDocumentProposals,
  reviseTextBlock,
} from "~/extensions/documents/server/documents";
import { withBranch } from "~/server/ccgw/branch-scope";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * *Accept all* and *Reject all* answer a group in one request over a real
 * CCGW and a real kernel (`BO_0343_012`): every item lands, or leaves, as
 * answering it alone would, with one batch of member decisions to the kernel;
 * a rewrite whose block's words changed since it was staged stays, and the
 * answer says why. Without the harness the suite skips.
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
  if (outcome["outcome"] !== "success") throw new Error(`expected success, got ${JSON.stringify(outcome).slice(0, 400)}`);
  return outcome["result"] as T;
};
type Block = { blockId: string; revisionId: string; runs?: readonly { text: string }[] };
type Read = { revisionId: string; blocks: readonly Block[] };
const words = (read: Read): string[] => read.blocks.map((block) => block.runs?.map((run) => run.text).join("") ?? "");

let reviews: string[] = [];
const original = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("/__kernel/review/")) reviews.push(`${new URL(url).pathname} ${String(init?.body ?? "").includes('"members"') ? "batch" : "one"}`);
  return original(input, init);
}) as typeof fetch;

const created: string[] = [];
const documentOf = async (texts: readonly string[]): Promise<{ documentId: string; blocks: readonly Block[] }> => {
  const { documentId } = ok<{ documentId: string }>(await createDocument({ title: "Answered whole", block: { kind: "text", runs: [{ text: texts[0] ?? "" }] } }));
  created.push(documentId);
  for (const text of texts.slice(1)) {
    const read = ok<Read>(await readDocument(documentId));
    const last = read.blocks[read.blocks.length - 1] as Block;
    ok(await insertBlock({ documentId, block: { kind: "text", runs: [{ text }] }, placement: { after: last.blockId } }));
  }
  return { documentId, blocks: ok<Read>(await readDocument(documentId)).blocks };
};

const rewrites = async (documentId: string, blocks: readonly Block[]): Promise<string> =>
  ok<{ groupId: string }>(
    await proposeDocumentChanges({
      documentId,
      items: [
        ...blocks.map((block, i) => ({ kind: "replace" as const, blockId: block.blockId, baseRevisionId: block.revisionId, runs: [{ text: `Rewritten ${i}` }] })),
        { kind: "insert" as const, block: { kind: "text" as const, runs: [{ text: "Added" }] }, placement: { at: "end" as const } },
      ] as never,
      request: { by: "the behaviour suite" },
    }),
  ).groupId;

describe.skipIf(!configured)("a whole proposal answered at once over CCGW", () => {
  afterAll(async () => {
    for (const documentId of created) {
      const read = await readDocument(documentId);
      if (read.outcome === "success") await deleteDocument({ documentId, baseRevisionId: (read.result as Read).revisionId });
    }
  });

  it("Given a run's rewrites and an insert, When Accept all, Then every item lands with one batch to the kernel", async () => {
    const { documentId, blocks } = await documentOf(["One", "Two", "Three"]);
    const groupId = await rewrites(documentId, blocks);
    reviews = [];
    const answered = ok<{ answered: readonly string[]; notice?: string }>(await answerDocumentGroup({ documentId, groupId, answer: "accepted" }));
    expect(answered.answered).toHaveLength(4);
    expect(answered.notice).toBeUndefined();
    expect(reviews).toEqual(["/__kernel/review/accept batch"]);
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["Rewritten 0", "Rewritten 1", "Rewritten 2", "Added"]);
    const left = ok<{ groups: readonly { groupId: string }[] }>(await readDocumentProposals(documentId));
    expect(left.groups.some((group) => group.groupId === groupId)).toBe(false);
  });

  it("Given a rewrite whose block's words changed since, When Accept all, Then the rest lands and that one stays, said", async () => {
    const { documentId, blocks } = await documentOf(["One", "Two"]);
    const groupId = await rewrites(documentId, blocks);
    const first = blocks[0] as Block;
    await settle();
    ok(await reviseTextBlock({ documentId, blockId: first.blockId, baseRevisionId: first.revisionId, runs: [{ text: "One, edited" }] } as never));
    const answered = ok<{ answered: readonly string[]; notice?: string }>(await answerDocumentGroup({ documentId, groupId, answer: "accepted" }));
    expect(answered.answered).toHaveLength(2);
    expect(answered.notice).toMatch(/older version of the block/u);
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["One, edited", "Rewritten 1", "Added"]);
    const left = ok<{ groups: readonly { groupId: string; items: readonly { blockId: string }[] }[] }>(await readDocumentProposals(documentId));
    expect(left.groups.find((group) => group.groupId === groupId)?.items.map((item) => item.blockId)).toEqual([first.blockId]);
  });

  it("Given a run's rewrites, When Reject all, Then the document is as it was and the proposal is gone", async () => {
    const { documentId, blocks } = await documentOf(["One", "Two"]);
    const groupId = await rewrites(documentId, blocks);
    reviews = [];
    const answered = ok<{ answered: readonly string[] }>(await answerDocumentGroup({ documentId, groupId, answer: "rejected" }));
    expect(answered.answered).toHaveLength(3);
    expect(reviews).toEqual(["/__kernel/review/reject batch"]);
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["One", "Two"]);
    const left = ok<{ groups: readonly { groupId: string }[] }>(await readDocumentProposals(documentId));
    expect(left.groups.some((group) => group.groupId === groupId)).toBe(false);
  });

  /** A run that also started a document elsewhere, in the same group. DO_0034 */
  const runWithStarted = async (): Promise<{ documentId: string; groupId: string; started: string }> => {
    const { documentId, blocks } = await documentOf(["One"]);
    const groupId = await rewrites(documentId, blocks);
    const started = ok<{ documentId: string }>(
      await withBranch(groupId, () => createDocument({ title: "Started elsewhere", block: { kind: "text", runs: [{ text: "Its words" }] } })),
    ).documentId;
    created.push(started);
    await settle();
    return { documentId, groupId, started };
  };

  it("Given a run that also started a document, When Accept all here, Then the chip named it, it stands too, and the notice says so (DO_0034_001, DO_0034_002, DO_0034_003)", async () => {
    const { documentId, groupId, started } = await runWithStarted();
    const read = ok<{ groups: readonly { groupId: string; elsewhere?: readonly { documentId: string; title: string; kind?: string }[] }[] }>(await readDocumentProposals(documentId));
    expect(read.groups.find((group) => group.groupId === groupId)?.elsewhere).toEqual([{ documentId: started, title: "Started elsewhere" }]);
    const answered = ok<{ answered: readonly string[]; notice?: string }>(await answerDocumentGroup({ documentId, groupId, answer: "accepted" }));
    expect(answered.answered).toHaveLength(2);
    expect(answered.notice).toBe("Started elsewhere now stands as a document.");
    expect(words(ok<Read>(await readDocument(started)))).toEqual(["Its words"]);
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["Rewritten 0", "Added"]);
  });

  it("Given a run that also started a document, When Reject all here, Then nothing of it stands, the started document included (DO_0034_001)", async () => {
    const { documentId, groupId, started } = await runWithStarted();
    const answered = ok<{ notice?: string }>(await answerDocumentGroup({ documentId, groupId, answer: "rejected" }));
    expect(answered.notice).toBe("Started elsewhere was discarded.");
    expect((await readDocument(started)).outcome).not.toBe("success");
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["One"]);
  });

  it("Given a run that also started a document, When one item is accepted, Then that item alone lands and the started document still waits (DO_0034_004)", async () => {
    const { documentId, groupId, started } = await runWithStarted();
    const read = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; kind: string }[] }[] }>(await readDocumentProposals(documentId));
    const insert = read.groups.find((group) => group.groupId === groupId)?.items.find((item) => item.kind === "insert");
    ok(await answerDocumentProposal({ documentId, itemId: insert?.itemId ?? "", answer: "accepted" }));
    expect(words(ok<Read>(await readDocument(documentId)))).toEqual(["One", "Added"]);
    // The started document is still the run's proposal, waiting to be taken.
    const waiting = ok<{ groups: readonly { groupId: string; items: readonly unknown[] }[] }>(await readDocumentProposals(started));
    expect(waiting.groups.find((group) => group.groupId === groupId)?.items.length).toBeGreaterThan(0);
  });
});
