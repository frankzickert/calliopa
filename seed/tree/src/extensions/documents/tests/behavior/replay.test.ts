import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  proposeDocumentChanges,
  readDocument,
  readDocumentProposals,
  replayDocumentAt,
} from "~/extensions/documents/server/documents";
import { readGraphEnv } from "~/server/ccgw/env";
import type { DocumentActivity } from "~/server/agent/run-events";

/**
 * A replay's read over a real CCGW and a real kernel (`BO_0340_007`): the
 * document as it stood at the run's pin, whatever has been written since, and
 * the items the run's activity names as they were staged — from a group
 * accepted since and from one rejected since. Without the harness the suite
 * skips.
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

type Block = { blockId: string; revisionId: string; order: string; runs?: readonly { text: string }[] };
type Item = { itemId: string; kind: string; blockId: string; block: { runs?: readonly { text: string }[] } | null };
type Staged = { groupId: string; items: readonly { itemId: string; kind: string }[] };

const words = (runs: readonly { text: string }[] | undefined): string => (runs ?? []).map((run) => run.text).join("");

describe.skipIf(!configured)("a replay's document and proposal over CCGW", () => {
  let documentId = "";
  let blockId = "";

  beforeAll(async () => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title: "Replayed", block: { kind: "text", runs: [{ text: "As it stood." }] } }),
    );
    documentId = created.documentId;
    blockId = created.blockId;
  });

  afterAll(async () => {
    if (documentId === "") return;
    const read = ok<{ revisionId: string }>(await readDocument(documentId));
    await deleteDocument({ documentId, baseRevisionId: read.revisionId });
  });

  it("Given a run's rewrite and insert accepted and the block revised since, Then the replay reads the document at the pin and both items as staged", async () => {
    await settle();
    const before = ok<{ dataRevision: number; blocks: readonly Block[] }>(await readDocument(documentId));
    const pin = before.dataRevision;
    const staged = ok<Staged>(
      await proposeDocumentChanges({
        documentId,
        items: [
          { kind: "replace", blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: [{ text: "As the run proposed." }] },
          { kind: "insert", block: { kind: "text", runs: [{ text: "A line the run added." }] }, placement: { at: "end" } },
        ],
      }),
    );
    await settle();
    const open = ok<{ groups: readonly { groupId: string; items: readonly Item[] }[] }>(await readDocumentProposals(documentId));
    const inserted = open.groups.find((group) => group.groupId === staged.groupId)?.items.find((item) => item.kind === "insert")?.blockId ?? "";
    expect(inserted).not.toBe("");
    for (const item of staged.items) ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "accepted" }));
    await settle();
    const accepted = ok<{ blocks: readonly Block[] }>(await readDocument(documentId));
    expect(words(accepted.blocks.find((block) => block.blockId === blockId)?.runs)).toBe("As the run proposed.");

    const activity: DocumentActivity[] = [
      { document: documentId, scope: "blocks", action: "read", blocks: [blockId] },
      { document: documentId, scope: "blocks", action: "replace", blocks: [blockId], group: staged.groupId, member: `node:${blockId}`, note: "Tighter." },
      { document: documentId, scope: "blocks", action: "insert", blocks: [inserted], group: staged.groupId, member: `node:${inserted}` },
    ];
    const replayed = ok<{ document: { blocks: readonly Block[] }; proposals: { groups: readonly { groupId: string; items: readonly Item[] }[] } }>(
      await replayDocumentAt(documentId, { runId: "arun-replayed", pin, group: staged.groupId, startedAt: 1, activity }),
    );
    // The document as it stood when the run started: one block, its words.
    expect(replayed.document.blocks.map((block) => words(block.runs))).toEqual(["As it stood."]);
    // The run's items, pending as staged, though both were accepted since.
    const items = replayed.proposals.groups[0]?.items ?? [];
    expect(replayed.proposals.groups[0]?.groupId).toBe(staged.groupId);
    expect(items.map((item) => item.kind)).toEqual(["replace", "insert"]);
    expect(words(items[0]?.block?.runs)).toBe("As the run proposed.");
    expect((items[0] as Item & { note?: string }).note).toBe("Tighter.");
    expect(words(items[1]?.block?.runs)).toBe("A line the run added.");
  });

  it("Given a run's rewrite rejected, Then the replay still reads it as staged", async () => {
    await settle();
    const before = ok<{ dataRevision: number; blocks: readonly Block[] }>(await readDocument(documentId));
    const target = before.blocks.find((block) => block.blockId === blockId) as Block;
    const staged = ok<Staged>(
      await proposeDocumentChanges({
        documentId,
        items: [{ kind: "replace", blockId, baseRevisionId: target.revisionId, runs: [{ text: "Turned down." }] }],
      }),
    );
    await settle();
    for (const item of staged.items) ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "rejected" }));
    await settle();
    const replayed = ok<{ document: { blocks: readonly Block[] }; proposals: { groups: readonly { items: readonly Item[] }[] } }>(
      await replayDocumentAt(documentId, {
        runId: "arun-rejected",
        pin: before.dataRevision,
        group: staged.groupId,
        startedAt: 1,
        activity: [{ document: documentId, scope: "blocks", action: "replace", blocks: [blockId], group: staged.groupId, member: `node:${blockId}` }],
      }),
    );
    expect(words(replayed.document.blocks.find((block) => block.blockId === blockId)?.runs)).toBe("As the run proposed.");
    expect(replayed.proposals.groups[0]?.items.map((item) => words(item.block?.runs))).toEqual(["Turned down."]);
  });
});
