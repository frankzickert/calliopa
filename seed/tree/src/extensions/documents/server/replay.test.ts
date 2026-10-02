import { describe, expect, it } from "vitest";

import type { ReadNode } from "~/server/ccgw/client";
import { nodeRef } from "~/server/ccgw/nodes";
import type { DocumentActivity } from "~/server/agent/run-events";
import { toBlock, type DocumentView } from "./assemble";
import { stagedItems } from "./documents";

/**
 * The items a replay shows, built from the run's activity and the members'
 * stamped revisions against the document as it stood (`BO_0340_007`). Pure;
 * the reads over CCGW are `tests/behavior/replay.test.ts`.
 */
const DOCUMENT = "00000000-0000-4000-8000-0000000000d1";
const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";
const NEW = "00000000-0000-4000-8000-0000000000c1";
const GROUP = "node:chg-replayed";

const text = (id: string, words: string, order: string, stamp?: string): ReadNode => ({
  id: nodeRef(id),
  revision: {
    id: `rev:${id}:${words}`,
    content: { _type: "text", id, role: "paragraph", runs: [{ text: words }], order, ...(stamp === undefined ? {} : { _proposal: stamp }) },
    status: stamp === undefined ? "established" : "candidate",
    dataRevision: 1,
    createdAt: 1,
    createdBy: "agent",
  },
});

const document: DocumentView = {
  documentId: DOCUMENT,
  title: "Replayed",
  revisionId: "rev:doc",
  blocks: [toBlock(text(A, "First.", "a0"), "rel:a"), toBlock(text(B, "Second.", "a1"), "rel:b")],
} as unknown as DocumentView;

const step = (action: string, block: string, member: string, note?: string): DocumentActivity => ({
  document: DOCUMENT,
  scope: "blocks",
  action,
  blocks: [block],
  group: GROUP,
  member,
  ...(note === undefined ? {} : { note }),
});

describe("the items a replayed run staged", () => {
  it("Given a run's rewrite, insert and removal, Then each is an item as staged, once, with its note, and reads are none", () => {
    const members = new Map([
      [nodeRef(A), text(A, "First, tighter.", "a0", GROUP)],
      [nodeRef(NEW), text(NEW, "Added.", "a2", GROUP)],
    ]);
    const items = stagedItems(
      GROUP,
      document,
      [
        step("read", A, ""),
        step("replace", A, nodeRef(A), "Tighter."),
        step("replace", A, nodeRef(A)),
        step("insert", NEW, nodeRef(NEW)),
        step("remove", B, "rel:b"),
      ],
      members,
    );
    expect(items.map((item) => [item.kind, item.blockId])).toEqual([
      ["replace", A],
      ["insert", NEW],
      ["remove", B],
    ]);
    expect(items[0]?.block?.kind === "text" && items[0].block.runs.map((run) => run.text).join("")).toBe("First, tighter.");
    expect(items[0]?.note).toBe("Tighter.");
    expect(items[0]?.itemId.startsWith(`${GROUP}|replace|`)).toBe(true);
    expect(items[1]?.block?.kind === "text" && items[1].block.runs.map((run) => run.text).join("")).toBe("Added.");
    expect(items[2]?.block).toBeNull();
  });

  it("Given a member with no stamped revision left, or one that proposes what stands, Then it is left out", () => {
    const items = stagedItems(GROUP, document, [step("replace", A, nodeRef(A)), step("replace", B, nodeRef(B))], new Map([[nodeRef(B), text(B, "Second.", "a1", GROUP)]]));
    expect(items).toEqual([]);
  });
});
