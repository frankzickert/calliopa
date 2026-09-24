import { describe, expect, it } from "vitest";

import type { BlockView } from "./assemble";
import { orderFor, type Placement } from "./documents";

/**
 * The keys a group of inserts is staged under. Each item is minted against
 * the document and the items staged before it, so a group's inserts never
 * share a key and keep the order they were given in — a shared key left
 * their order to their identities, and accepting one moved it. DO_0004_008
 */
const block = (blockId: string, order: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [],
});

/** Stages each placement in turn, as `proposeDocumentChanges` does. */
const stage = (blocks: readonly BlockView[], placements: readonly Placement[]): string[] => {
  const siblings = [...blocks];
  return placements.map((placement) => {
    const minted = orderFor(siblings, placement);
    if ("failure" in minted) throw new Error("refused");
    siblings.push(block(`staged:${minted.order}`, minted.order));
    return minted.order;
  });
};

const document = [block("a", "a"), block("x", "m"), block("z", "t")];

describe("the keys a group of inserts is staged under", () => {
  it("Given three inserts after one block, Then they get three keys between it and the next, in the items' order", () => {
    const keys = stage(document, [{ after: "x" }, { after: "x" }, { after: "x" }]);
    expect(new Set(keys).size).toBe(3);
    expect([...keys].sort()).toEqual(keys);
    for (const key of keys) expect(key > "m" && key < "t").toBe(true);
  });

  it("Given three inserts at the start, and three before one block, Then each three keep their order and share no key", () => {
    const start = stage(document, [{ at: "start" }, { at: "start" }, { at: "start" }]);
    expect(new Set(start).size).toBe(3);
    expect([...start].sort()).toEqual(start);
    expect(start.every((key) => key < "a")).toBe(true);
    const before = stage(document, [{ before: "z" }, { before: "z" }, { before: "z" }]);
    expect(new Set(before).size).toBe(3);
    expect([...before].sort()).toEqual(before);
    expect(before.every((key) => key > "m" && key < "t")).toBe(true);
  });

  it("Given an anchor that shares its key with the next block, Then the insert is minted past both rather than at the end", () => {
    const shared = [block("a", "a"), block("b", "d"), block("c", "d"), block("e", "f")];
    const [key] = stage(shared, [{ after: "b" }]);
    expect(key !== undefined && key > "d" && key < "f").toBe(true);
  });
});

describe("an insert placed between two drawn rows", () => {
  // The editor places a new block below a drawn row by the row's key and the
  // next key the document knows, which may be a proposal's or a retired
  // block's rather than a sibling's. DO_0016_001
  it("Given two keys in order, Then the key is minted strictly between them, and past the last with no upper one", () => {
    const [between] = stage(document, [{ between: ["m", "p"] }]);
    expect(between !== undefined && between > "m" && between < "p").toBe(true);
    const [end] = stage(document, [{ between: ["t", null] }]);
    expect(end !== undefined && end > "t").toBe(true);
  });

  it("Given two keys out of order, Then it is refused and nothing is minted", () => {
    expect("failure" in orderFor(document, { between: ["p", "m"] })).toBe(true);
    expect("failure" in orderFor(document, { between: ["m", "m"] })).toBe(true);
  });
});
