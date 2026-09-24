import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { branchGroupId, withBranch } from "~/server/ccgw/branch-scope";
import { readGraphEnv } from "~/server/ccgw/env";
import { branchOf, readStanding } from "~/extensions/documents/server/branch";
import {
  answerDocumentProposal,
  createDocument,
  deleteDocument,
  insertBlock,
  promoteBlock,
  readDocument,
  readDocumentProposals,
  reviseTextBlock,
} from "~/extensions/documents/server/documents";
import { readSession } from "~/server/session";

/**
 * A person's branch over the one graph (`BO_0250_025`, the server side):
 * every editor write staged into the branch as human class and read back
 * through its overlay while truth stands; the standing read; a rejected
 * branch promoting one block on its own; and acceptance establishing every
 * member, a drifted one over its drift. Runs under the kernel harness like
 * `documents.test.ts`. The standing read wraps the core's operation of
 * `ccgw.md` `BO_0250_002`.
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
  blocks: readonly { blockId: string; revisionId: string; kind: string; runs?: readonly { text: string }[] }[];
};

const textOf = (doc: Doc, blockId: string): string =>
  (doc.blocks.find((block) => block.blockId === blockId)?.runs ?? []).map((run) => run.text).join("");

describe.skipIf(!configured)("proposal branches over CCGW", () => {
  let account = "";
  const made: string[] = [];

  beforeAll(async () => {
    account = (await readSession())?.name ?? "";
    expect(account).not.toBe("");
  });

  afterAll(async () => {
    for (const documentId of made) {
      const document = await readDocument(documentId);
      if (document.outcome === "success") {
        await deleteDocument({ documentId, baseRevisionId: document.result.revisionId });
      }
    }
  });

  const root = async (title: string): Promise<{ documentId: string; blockId: string; branch: string }> => {
    const created = ok<{ documentId: string; blockId: string }>(
      await createDocument({ title, block: { kind: "text", runs: words("In truth") } }),
    );
    made.push(created.documentId);
    return { documentId: created.documentId, blockId: created.blockId, branch: branchGroupId(created.documentId, account) };
  };

  it("Given a person in a branch, When they revise and insert, Then truth stands and the branch reads the change; others see it as the person's proposal", async () => {
    const { documentId, blockId, branch } = await root("Branch root");
    expect(ok<{ branch: string; sessions: readonly unknown[] }>(await branchOf(documentId))).toEqual({ branch, sessions: [] });
    // Nothing staged yet: the standing has no members rather than a missing
    // proposal. Found on the served build in the walk, 2026-09-16.
    expect(ok<{ members: readonly unknown[] }>(await readStanding(branch)).members).toEqual([]);

    const before = ok<Doc>(await readDocument(documentId));
    const revised = await withBranch(branch, () =>
      reviseTextBlock({ documentId, blockId, baseRevisionId: before.revisionId === "" ? "" : (before.blocks[0]?.revisionId ?? ""), runs: words("Revised in branch") }),
    );
    expect(revised.outcome).toBe("success");
    expect((revised as { result: { staged?: boolean } }).result.staged).toBe(true);
    await settle();
    const added = ok<{ blockId: string; staged?: boolean }>(
      await withBranch(branch, () => insertBlock({ documentId, block: { kind: "text", runs: words("Added in branch") }, placement: { at: "end" } })),
    );
    expect(added.staged).toBe(true);

    // Truth is untouched; the branch reads both changes.
    const truth = ok<Doc>(await readDocument(documentId));
    expect(textOf(truth, blockId)).toBe("In truth");
    expect(truth.blocks.map((block) => block.blockId)).not.toContain(added.blockId);
    const inBranch = ok<Doc>(await withBranch(branch, () => readDocument(documentId)));
    expect(textOf(inBranch, blockId)).toBe("Revised in branch");
    expect(textOf(inBranch, added.blockId)).toBe("Added in branch");
    // The branch is an open session now, and the next session takes the next
    // name beside it. CA_0057_007 CA_0057_009
    const open = ok<{ branch: string; sessions: readonly { branch: string; since: number }[] }>(await branchOf(documentId));
    expect(open.sessions.map((session) => session.branch)).toEqual([branch]);
    expect(open.sessions[0]?.since).toBeGreaterThan(0);
    expect(open.branch).toBe(branchGroupId(documentId, account, 2));

    // For everyone else the branch is the person's proposal, item by item.
    const proposals = ok<{ groups: readonly { groupId: string; proposer: { kind: string; name?: string }; items: readonly { kind: string; blockId: string }[] }[] }>(
      await readDocumentProposals(documentId),
    );
    const group = proposals.groups.find((candidate) => candidate.groupId === branch);
    expect(group?.proposer).toEqual({ kind: "person", name: account });
    expect(group?.items.map((item) => item.kind).sort()).toEqual(["insert", "replace"]);
    // And for the person in the branch too: proposals read against truth,
    // never under the tab's overlay, so the branch's members are known to
    // the card that accepts them. Found live in the BO_0250 walk-through.
    const fromInside = ok<{ groups: readonly { groupId: string; items: readonly { kind: string }[] }[] }>(
      await withBranch(branch, () => readDocumentProposals(documentId)),
    );
    expect(fromInside.groups.find((candidate) => candidate.groupId === branch)?.items.map((item) => item.kind).sort()).toEqual(["insert", "replace"]);
  });

  it("Given a branch accepted, When the tab still reads under it, Then it reads truth", async () => {
    const { documentId, blockId, branch } = await root("Accepted root");
    const before = ok<Doc>(await readDocument(documentId));
    ok(await withBranch(branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("Accepted from the branch") })));
    await settle();
    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string }[] }[] }>(await readDocumentProposals(documentId));
    for (const item of proposals.groups.find((candidate) => candidate.groupId === branch)?.items ?? []) {
      ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "accepted" }));
    }
    const next = ok<{ branch: string; sessions: readonly unknown[]; previous?: { branch: string; status: string } }>(await branchOf(documentId));
    expect(next.sessions).toEqual([]);
    expect(next.previous).toEqual({ branch, status: "accepted" });
    expect(next.branch).toBe(branchGroupId(documentId, account, 2));
    const after = ok<Doc>(await withBranch(branch, () => readDocument(documentId)));
    expect(textOf(after, blockId)).toBe("Accepted from the branch");
    // A second branch stages under the next name.
    ok(await withBranch(next.branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: after.blocks[0]?.revisionId ?? "", runs: words("Second branch") })));
    await settle();
    expect(ok<{ sessions: readonly { branch: string }[] }>(await branchOf(documentId)).sessions.map((session) => session.branch)).toEqual([next.branch]);
  });

  it("Given a branch, When truth moves under one member and not the other, Then the standing says which", async () => {
    const { documentId, blockId, branch } = await root("Standing root");
    const before = ok<Doc>(await readDocument(documentId));
    ok(await withBranch(branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("Branch words") })));
    await settle();
    const added = ok<{ blockId: string }>(
      await withBranch(branch, () => insertBlock({ documentId, block: { kind: "text", runs: words("Branch block") }, placement: { at: "end" } })),
    );

    let standing = ok<{ members: readonly { ref: string; standing: string }[] }>(await readStanding(branch));
    expect(standing.members.find((member) => member.ref === `node:${blockId}`)?.standing).toBe("clean");

    // Truth moves under the revised block; the inserted one only anchors.
    await settle();
    const truth = ok<Doc>(await readDocument(documentId));
    ok(await reviseTextBlock({ documentId, blockId, baseRevisionId: truth.blocks[0]?.revisionId ?? "", runs: words("Moved in truth") }));
    standing = ok(await readStanding(branch));
    expect(standing.members.find((member) => member.ref === `node:${blockId}`)?.standing).toBe("drifted");
    expect(standing.members.find((member) => member.ref === `node:${added.blockId}`)?.standing).not.toBe("drifted");
  });

  it("Given a rejected branch, Then nothing of it is truth and one block promotes on its own", async () => {
    const { documentId, blockId, branch } = await root("Rejected root");
    const before = ok<Doc>(await readDocument(documentId));
    ok(await withBranch(branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("Rejected words") })));
    await settle();
    const added = ok<{ blockId: string }>(
      await withBranch(branch, () => insertBlock({ documentId, block: { kind: "text", runs: words("Worth keeping") }, placement: { at: "end" } })),
    );

    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string }[] }[] }>(await readDocumentProposals(documentId));
    for (const item of proposals.groups.find((group) => group.groupId === branch)?.items ?? []) {
      ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "rejected" }));
    }
    expect(ok<{ previous?: { status: string } }>(await branchOf(documentId)).previous?.status).toBe("rejected");
    const truth = ok<Doc>(await readDocument(documentId));
    expect(textOf(truth, blockId)).toBe("In truth");
    expect(truth.blocks.map((block) => block.blockId)).not.toContain(added.blockId);
    const promoted = ok<{ groupId: string; itemId: string }>(await promoteBlock({ documentId, group: branch, blockId: added.blockId, account }));
    expect(promoted.groupId).toBe(`node:promote-${added.blockId}-${account}-1`);
    const again = ok<{ groups: readonly { groupId: string; items: readonly { kind: string; blockId: string }[] }[] }>(await readDocumentProposals(documentId));
    const promotion = again.groups.find((group) => group.groupId === promoted.groupId);
    expect(promotion?.items).toMatchObject([{ kind: "insert", blockId: added.blockId }]);

    // The rejected branch still reads through its overlay as it stood
    // (`ccgw.md` `BO_0250_003`).
    const history = ok<Doc>(await withBranch(branch, () => readDocument(documentId)));
    expect(textOf(history, added.blockId)).toBe("Worth keeping");
  });

  it("Given a branch with a member truth moved under, When it is kept over its drift and the rest accepted, Then the branch's words are truth", async () => {
    const { documentId, blockId, branch } = await root("Accepted root");
    const before = ok<Doc>(await readDocument(documentId));
    ok(await withBranch(branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("Accepted words") })));
    await settle();
    const added = ok<{ blockId: string }>(
      await withBranch(branch, () => insertBlock({ documentId, block: { kind: "text", runs: words("Accepted block") }, placement: { at: "end" } })),
    );
    await settle();
    const moved = ok<Doc>(await readDocument(documentId));
    ok(await reviseTextBlock({ documentId, blockId, baseRevisionId: moved.blocks[0]?.revisionId ?? "", runs: words("Moved in truth") }));
    const standing = ok<{ members: readonly { ref: string; standing: string }[] }>(await readStanding(branch));
    expect(standing.members.find((member) => member.ref === `node:${blockId}`)?.standing).toBe("drifted");

    const proposals = ok<{ groups: readonly { groupId: string; items: readonly { itemId: string; blockId: string }[] }[] }>(await readDocumentProposals(documentId));
    for (const item of proposals.groups.find((group) => group.groupId === branch)?.items ?? []) {
      ok(await answerDocumentProposal({ documentId, itemId: item.itemId, answer: "accepted", ...(item.blockId === blockId ? { edited: true } : {}) }));
    }
    const truth = ok<Doc>(await readDocument(documentId));
    expect(textOf(truth, blockId)).toBe("Accepted words");
    expect(textOf(truth, added.blockId)).toBe("Accepted block");
    expect(ok<{ previous?: { status: string } }>(await branchOf(documentId)).previous?.status).toBe("accepted");
  });

  it("Given two proposal sessions of one person, Then both stand open, newest first, each read through its own overlay, and the next takes a third name", async () => {
    // Each session is its own proposal while earlier ones stand open.
    // CA_0057_007 CA_0057_009 CA_0057_011
    const { documentId, blockId, branch } = await root("Two sessions root");
    const before = ok<Doc>(await readDocument(documentId));
    ok(await withBranch(branch, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("First session") })));
    await settle();
    const second = ok<{ branch: string }>(await branchOf(documentId)).branch;
    expect(second).toBe(branchGroupId(documentId, account, 2));
    // A block holds one open candidate at a time: the second session cannot
    // rewrite the block the first one holds, and adds one of its own.
    const refused = await withBranch(second, () => reviseTextBlock({ documentId, blockId, baseRevisionId: before.blocks[0]?.revisionId ?? "", runs: words("Second session") }));
    expect(refused.outcome).toBe("validationFailure");
    const added = ok<{ blockId: string }>(
      await withBranch(second, () => insertBlock({ documentId, block: { kind: "text", runs: words("Second session") }, placement: { at: "end" } })),
    );
    await settle();

    const read = ok<{ branch: string; sessions: readonly { branch: string; since: number }[] }>(await branchOf(documentId));
    expect(read.sessions.map((session) => session.branch)).toEqual([second, branch]);
    expect(read.sessions[0]?.since ?? 0).toBeGreaterThanOrEqual(read.sessions[1]?.since ?? 0);
    expect(read.branch).toBe(branchGroupId(documentId, account, 3));
    expect(textOf(ok<Doc>(await withBranch(branch, () => readDocument(documentId))), blockId)).toBe("First session");
    const inSecond = ok<Doc>(await withBranch(second, () => readDocument(documentId)));
    expect(textOf(inSecond, blockId)).toBe("In truth");
    expect(textOf(inSecond, added.blockId)).toBe("Second session");
    const truth = ok<Doc>(await readDocument(documentId));
    expect(textOf(truth, blockId)).toBe("In truth");
    expect(truth.blocks.map((block) => block.blockId)).not.toContain(added.blockId);
  });
});
