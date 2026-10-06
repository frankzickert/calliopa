import { describe, expect, it } from "vitest";
import { emptiedOf, leftBy, NOTHING_LEFT } from "./emptied";

/** What a write's answer says went, and how the block that left goes back.
 * CA_0083_005 CA_0083_006 */
describe("an emptied focused work in a write's answer", () => {
  const emptied = { itemId: "child-1", blockId: "blk-a", parent: { itemId: "doc-1", title: "Caching" }, kept: { title: "Focused", retired: ["blk-x"] }, dataRevision: "9" };

  it("Given the answer names what went, Then it is read with its parent and what was kept", () => {
    expect(emptiedOf({ outcome: "success", result: { blockId: "blk-x", emptied } })).toEqual({
      itemId: "child-1",
      blockId: "blk-a",
      parent: { itemId: "doc-1", title: "Caching" },
      kept: { title: "Focused", retired: ["blk-x"] },
    });
  });

  it("Given an answer without it, or a refusal, Then nothing went", () => {
    expect(emptiedOf({ outcome: "success", result: { blockId: "blk-x" } })).toBeNull();
    expect(emptiedOf({ outcome: "validationFailure", result: { emptied } })).toBeNull();
    expect(emptiedOf({ outcome: "success", result: { emptied: { itemId: "child-1" } } })).toBeNull();
  });

  it("Given a parent the server could not name, Then it is read as none", () => {
    expect(emptiedOf({ outcome: "success", result: { emptied: { ...emptied, parent: null } } })?.parent).toBeNull();
  });
});

describe("the blocks that left", () => {
  it("Given a removal, Then the removed blocks go back by a restore", () => {
    expect(leftBy({ command: "retire", blockId: "blk-x" }, "child-1")).toEqual({ blockIds: ["blk-x"], wentTo: null });
    expect(leftBy({ command: "retireBlocks", blocks: [{ blockId: "blk-x", baseRevisionId: "r" }, { blockId: "blk-y", baseRevisionId: "r" }] }, "child-1")).toEqual({
      blockIds: ["blk-x", "blk-y"],
      wentTo: null,
    });
  });

  it("Given a block moved in from the focused work, Then it goes back from the document it moved into", () => {
    expect(leftBy({ command: "moveIn", blockId: "blk-x", fromDocumentId: "child-1" }, "doc-9")).toEqual({ blockIds: ["blk-x"], wentTo: "doc-9" });
  });

  it("Given any other command, Then nothing is put back", () => {
    expect(leftBy({ command: "move", blockId: "blk-x" }, "child-1")).toEqual(NOTHING_LEFT);
  });
});
