import { describe, expect, it } from "vitest";

import { anchorAt } from "~/lib/passage";
import { NO_MARKING, type Marking } from "~/lib/references";
import type { BlockView } from "~/server/documents/assemble";
import { revealedPassage } from "./reveal";

/**
 * Where a chip's passage stands in the document, for the editor to scroll to
 * and draw. CA_0039_005
 */
const text = "The storm arrives before the lights go out.";
const blocks: readonly BlockView[] = [
  {
    kind: "text",
    blockId: "blk-b",
    revisionId: "rev-b",
    containmentId: "c-b",
    order: "b",
    role: "paragraph",
    standing: "neutral",
    runs: [{ text }],
  },
];
const marking: Marking = {
  ...NO_MARKING,
  references: [
    { kind: "block", blockId: "blk-b", number: 1 },
    { kind: "passage", blockId: "blk-b", number: 2, anchor: anchorAt(text, 25, 35) },
  ],
  next: 3,
};

describe("the passage a chip reveals", () => {
  it("Given a passage whose words stand, Then its range in its block is revealed", () => {
    expect(
      revealedPassage({ kind: "passage", blockId: "blk-b", number: 2 }, marking, blocks),
    ).toEqual({ blockId: "blk-b", number: 2, start: 25, end: 35 });
  });

  it("Given a stale passage, a number no passage carries, or a block, Then there is no range and the block is revealed", () => {
    const edited = [{ ...blocks[0]!, runs: [{ text: "Nothing left of it." }] }] as BlockView[];
    expect(
      revealedPassage({ kind: "passage", blockId: "blk-b", number: 2 }, marking, edited),
    ).toBeNull();
    expect(
      revealedPassage({ kind: "passage", blockId: "blk-b", number: 9 }, marking, blocks),
    ).toBeNull();
    expect(revealedPassage({ kind: "block", blockId: "blk-b" }, marking, blocks)).toBeNull();
  });
});
