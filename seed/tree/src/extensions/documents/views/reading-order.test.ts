import { describe, expect, it } from "vitest";

import type { BlockView } from "../server/assemble";
import type { ProposedChange } from "../server/documents";
import { belowPlacement, dropPlacement, placeProposals, positionOf, readingOrder, type ReadingEntry } from "./reading-order";

/**
 * Where a proposed change is drawn: a rewrite in the place of the block it
 * rewrites, whose own row is then not drawn — unless a removal or a move
 * frames that block, the reader is editing it, or the rewrite is a system
 * run's derived candidate. CA_0055_005
 */
const block = (blockId: string, order: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [{ text: blockId }],
});
const entry = (blockId: string, order: string): ReadingEntry => ({ block: block(blockId, order), retired: false, discarded: false });
const entries = [entry("a", "a"), entry("b", "b"), entry("c", "c")];
const item = (kind: string, blockId: string, extra: Partial<ProposedChange> = {}): ProposedChange => ({
  itemId: `node:g|${kind}|node:${blockId}`,
  groupId: "node:g",
  kind,
  blockId,
  block: kind === "remove" ? null : block(blockId, blockId),
  ...extra,
});
const drawn = (rows: ReturnType<typeof placeProposals>) =>
  rows.map((row) => (row.kind === "block" ? row.block.blockId : `${row.item.kind}:${row.item.blockId}${row.replaces === undefined ? "" : "*"}`));

describe("where a proposed change is drawn", () => {
  it("Given a rewrite, Then it stands in its block's place, takes its position and key, and the block's row is not drawn", () => {
    const rows = placeProposals(entries, [item("replace", "b")]);
    expect(drawn(rows)).toEqual(["a", "replace:b*", "c"]);
    const rewrite = rows[1];
    expect(rewrite === undefined ? null : positionOf(rewrite)).toBe("b");
    expect(dropPlacement(rows, "b")).toEqual({ between: ["a", "b"] });
  });

  it("Given a block a removal or a move frames, the block being edited, or a derived rewrite, Then the block keeps its row and the rewrite follows it", () => {
    expect(drawn(placeProposals(entries, [item("replace", "b"), item("remove", "b", { itemId: "node:h|remove|node:b" })]))).toEqual([
      "a",
      "b",
      "replace:b",
      "remove:b",
      "c",
    ]);
    expect(drawn(placeProposals(entries, [item("replace", "b")], "b"))).toEqual(["a", "b", "replace:b", "c"]);
    expect(drawn(placeProposals(entries, [item("replace", "b", { derived: true })]))).toEqual(["a", "b", "replace:b", "c"]);
  });

  it("Given two rewrites of one block, Then the first takes its place and the second follows it", () => {
    const second = item("replace", "b", { itemId: "node:h|replace|node:b", groupId: "node:h" });
    expect(drawn(placeProposals(entries, [item("replace", "b"), second]))).toEqual(["a", "replace:b*", "replace:b", "c"]);
  });
});

/** A prompt leaves the flow and comes back under Show prompts. BO_0267_015 */
describe("prompts in the reading order", () => {
  const prompt = { ...block("p", "b1"), standing: "prompt" } as BlockView;
  it("Given a prompt, Then it is not drawn until Show prompts, and then where it sits, said to be a prompt", () => {
    const blocks = [block("a", "a"), prompt, block("c", "c")];
    expect(readingOrder(blocks, [], false).map((entry) => entry.block.blockId)).toEqual(["a", "c"]);
    const shown = readingOrder(blocks, [], false, true);
    expect(shown.map((entry) => [entry.block.blockId, entry.prompt === true])).toEqual([
      ["a", false],
      ["p", true],
      ["c", false],
    ]);
  });
});

describe("proposals beside blocks that share their key", () => {
  // A run once staged several inserts under one key; the reading order breaks
  // such ties by block, and a drawn proposal must stand where accepting it
  // puts it. DO_0004_008
  const tied = [entry("a", "a"), entry("m", "d"), entry("x", "d"), entry("z", "f")];
  const insert = (blockId: string, order: string) => item("insert", blockId, { block: block(blockId, order) });

  it("Given inserts sharing a block's key, Then each is drawn where the reading order puts it once accepted", () => {
    const items = [insert("q", "d"), insert("b", "d")];
    const rows = drawn(placeProposals(tied, items));
    expect(rows).toEqual(["a", "insert:b", "m", "insert:q", "x", "z"]);
    // The same blocks, accepted: the order the document then reads in.
    const accepted = readingOrder([...tied.map((row) => row.block), block("q", "d"), block("b", "d")], [], false).map((row) => row.block.blockId);
    expect(accepted).toEqual(["a", "b", "m", "q", "x", "z"]);
  });
});

describe("where a new block goes below a drawn row", () => {
  // Blocks at a, b and c; a proposed insert at "bb" between b and c. DO_0016_001
  const insert = item("insert", "n", { block: block("n", "bb") });

  it("Given a block, Then the new block goes between its key and the next key drawn", () => {
    const rows = placeProposals(entries, []);
    expect(belowPlacement(rows, { blockId: "a" }, [])).toEqual({ between: ["a", "b"] });
    expect(belowPlacement(rows, { blockId: "c" }, [])).toEqual({ between: ["c", null] });
  });

  it("Given a proposed insert drawn, Then below it is between its key and the next block's", () => {
    const rows = placeProposals(entries, [insert]);
    expect(belowPlacement(rows, { itemId: insert.itemId }, [])).toEqual({ between: ["bb", "c"] });
    expect(belowPlacement(rows, { blockId: "b" }, [])).toEqual({ between: ["b", "bb"] });
  });

  it("Given a proposal hidden, Then its key still bounds the new block, so it follows it once shown", () => {
    const rows = placeProposals(entries, []);
    expect(belowPlacement(rows, { blockId: "b" }, ["bb"])).toEqual({ between: ["b", "bb"] });
  });

  it("Given the end, Then the new block goes below the body's lowest row, and after every key the document knows", () => {
    expect(belowPlacement(placeProposals(entries, [item("insert", "z", { block: block("z", "z") })]), "end", [])).toEqual({
      between: ["z", null],
    });
    expect(belowPlacement(placeProposals([], []), "end", [])).toEqual({ at: "end" });
  });

  it("Given a row with no key of its own, Then it goes below the nearest keyed row above it", () => {
    const remove = item("remove", "b");
    const rows = placeProposals(entries, [remove]);
    expect(belowPlacement(rows, { itemId: remove.itemId }, [])).toEqual({ between: ["b", "c"] });
  });

  it("Given a block with no key or one not drawn, Then it is named as the anchor", () => {
    expect(belowPlacement(placeProposals([entry("u", "")], []), { blockId: "u" }, [])).toEqual({ after: "u" });
    expect(belowPlacement(placeProposals(entries, []), { blockId: "gone" }, [])).toEqual({ after: "gone" });
  });
});
