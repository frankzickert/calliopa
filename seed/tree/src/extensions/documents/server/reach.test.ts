import { describe, expect, it } from "vitest";
import { gatherOf, reachesDocument } from "./reach";

const set = (overrides: Partial<Parameters<typeof reachesDocument>[0]> = {}) => ({
  touchedNodes: [],
  stagedRelations: [],
  closedRelations: [],
  ...overrides,
});
const relation = (fromNodeId: string, toId: string) => ({ id: "rel:x", type: "t", fromNodeId, toKind: "node", toId });

// A document's proposals read reads a group's members only when its touched
// set reaches the document: the document's node, its blocks, the claims they
// assert, or the relation nodes on those claims. BO_0257_008
describe("reachesDocument", () => {
  const reach = new Set(["node:doc", "node:block-a", "node:claim-a", "node:relation-a"]);

  it("reaches through a candidate of the document, a block, a claim or a relation node", () => {
    for (const node of reach) expect(reachesDocument(set({ touchedNodes: [node] }), reach)).toBe(true);
  });

  it("reaches through a staged relation at either end, such as a new relation between claims here", () => {
    expect(reachesDocument(set({ touchedNodes: ["node:relation-new"], stagedRelations: [relation("node:relation-new", "node:claim-a")] }), reach)).toBe(true);
    expect(reachesDocument(set({ stagedRelations: [relation("node:doc", "node:block-new")] }), reach)).toBe(true);
  });

  it("reaches through a relation the group closes", () => {
    expect(reachesDocument(set({ closedRelations: [relation("node:doc", "node:block-a")] }), reach)).toBe(true);
  });

  it("does not reach a document another document's group touches", () => {
    expect(
      reachesDocument(
        set({ touchedNodes: ["node:elsewhere"], stagedRelations: [relation("node:elsewhere", "node:other-claim")], closedRelations: [relation("node:x", "node:y")] }),
        reach,
      ),
    ).toBe(false);
  });
});

// A gather (BO_0322_013): the group closes blocks' containment in the
// document and places the same blocks under another node, its focused work.
describe("gatherOf", () => {
  const established = new Map([["node:b", {}], ["node:c", {}], ["node:d", {}]]);
  const contains = (id: string, fromNodeId: string, toId: string) => ({ id, type: "CONTAINS", fromNodeId, toKind: "node", toId });

  it("reads the moved blocks and the focused work they move into", () => {
    const gathered = gatherOf(
      {
        closedRelations: [contains("rel:cb", "node:doc", "node:b"), contains("rel:cd", "node:doc", "node:d")],
        stagedRelations: [contains("rel:mb", "node:child", "node:b"), contains("rel:md", "node:child", "node:d"), contains("rel:mo", "node:child", "node:orig")],
      },
      "node:doc",
      established,
    );
    expect(gathered === null ? null : { moved: [...gathered.moved].sort(), child: gathered.child }).toEqual({ moved: ["node:b", "node:d"], child: "node:child" });
  });

  it("is nothing for a removal, which closes a containment and places the block nowhere, or a group that moves nothing", () => {
    expect(gatherOf({ closedRelations: [contains("rel:cb", "node:doc", "node:b")], stagedRelations: [{ ...contains("rel:r", "node:doc", "node:b"), type: "retired" }] }, "node:doc", established)).toBeNull();
    expect(gatherOf({ stagedRelations: [contains("rel:n", "node:doc", "node:new")] }, "node:doc", established)).toBeNull();
  });
});
