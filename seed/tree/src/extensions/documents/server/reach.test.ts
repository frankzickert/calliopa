import { describe, expect, it } from "vitest";
import { reachesDocument } from "./reach";

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
