import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  proposeDocumentChanges,
  readDocument,
  readDocumentProposals,
  reopenProposal,
} from "~/extensions/documents/server/documents";
import { readGraphEnv } from "~/server/ccgw/env";

/**
 * *Show removed* over a real CCGW and a real kernel (`BO_0315_015`,
 * `BO_0315_017`): a proposed rewrite and a proposed insert rejected by the
 * command the swipe sends are read back, with the document's proposals, only
 * when asked for, each as it was staged; and
 * *Restore* stages the same item again as a new open proposal, which the
 * rejected read then no longer answers. Without the harness the suite skips.
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

type Item = { itemId: string; kind: string; blockId: string; block: { runs?: readonly { text: string }[]; order: string } | null };
type Proposals = { groups: readonly { groupId: string; items: readonly Item[] }[]; rejected?: readonly Item[] };

const wordsOf = (item: Item | undefined) => item?.block?.runs?.map((run) => run.text).join("") ?? null;

describe.skipIf(!configured)("rejected proposals read back and reopened over CCGW", () => {
  let documentId = "";
  let blockId = "";

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "Removed and reopened", block: { kind: "text", runs: [{ text: "As it stands." }] } }),
    );
    documentId = created.documentId;
    blockId = created.blockId;
  });

  afterAll(async () => {
    if (documentId === "") return;
    const read = ok<{ revisionId: string }>(await readDocument(documentId));
    await deleteDocument({ documentId, baseRevisionId: read.revisionId });
  });

  it("Given a rewrite and an insert rejected, Then both are read back, only when asked and as staged, and Restore reopens one as a new open proposal", async () => {
    await settle();
    const base = ok<{ blocks: readonly { blockId: string; revisionId: string; order: string }[] }>(await readDocument(documentId));
    // Each in a group of its own, rejected as the swipe rejects one.
    type Staged = { groupId: string; items: readonly { itemId: string; kind: string }[] };
    const rewrite = ok<Staged>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "replace", blockId, baseRevisionId: base.blocks[0]?.revisionId ?? "", runs: [{ text: "As it was proposed." }] }],
      }),
    );
    await settle();
    const staged = ok<Staged>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "insert", block: { kind: "text", runs: [{ text: "A line turned down." }] }, placement: { at: "end" } }],
      }),
    );
    await settle();
    const groups = [rewrite, staged];
    for (const item of groups.flatMap((group) => group.items)) {
      ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "rejected" }));
    }
    await settle();

    // Without the flag nothing rejected is read.
    const plain = ok<Proposals>(await readDocumentProposals(documentId));
    expect(plain.rejected).toBeUndefined();
    expect(plain.groups.some((group) => groups.some((staging) => staging.groupId === group.groupId))).toBe(false);

    // With it, the rewrite and the insert, each as it was staged.
    const shown = ok<Proposals>(await readDocumentProposals(documentId, { rejected: true }));
    const rejected = shown.rejected ?? [];
    expect(rejected.map((item) => item.kind).sort()).toEqual(["insert", "replace"]);
    expect(wordsOf(rejected.find((item) => item.kind === "replace"))).toBe("As it was proposed.");
    expect(wordsOf(rejected.find((item) => item.kind === "insert"))).toBe("A line turned down.");
    expect(rejected.find((item) => item.kind === "replace")?.itemId.startsWith(`${rewrite.groupId}|`)).toBe(true);
    expect(rejected.find((item) => item.kind === "insert")?.itemId.startsWith(`${staged.groupId}|`)).toBe(true);

    // Restore stages the insert again as a new open proposal of the reader's.
    const insert = rejected.find((item) => item.kind === "insert") as Item;
    const reopened = ok<{ groupId: string; items: readonly { kind: string }[] }>(await reopenProposal(documentId, insert.itemId));
    expect(reopened.groupId).not.toBe(staged.groupId);
    expect(reopened.items.map((item) => item.kind)).toEqual(["insert"]);
    await settle();
    const after = ok<Proposals>(await readDocumentProposals(documentId, { rejected: true }));
    const open = after.groups.find((group) => group.groupId === reopened.groupId);
    expect(wordsOf(open?.items[0])).toBe("A line turned down.");
    // Where it stood: after the block it followed.
    expect((open?.items[0]?.block?.order ?? "") > (base.blocks[0]?.order ?? "~")).toBe(true);
    // An item that was never rejected here is refused.
    expect((await reopenProposal(documentId, `${staged.groupId}|insert|node:nowhere`)).outcome).toBe("validationFailure");
  });
});
