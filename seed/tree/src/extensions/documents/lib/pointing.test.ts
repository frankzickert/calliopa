import { describe, expect, it } from "vitest";

import { chipName, fixatedChipName, staleIn } from "~/lib/command-target";
import { anchorAt } from "~/lib/passage";
import {
  OPENING_CHARS,
  openingWords,
  pointingOf,
  type PointableBlock,
} from "./pointing";
import { addPassage, NO_MARKING, toggleReference } from "./references";

const blocks: PointableBlock[] = [
  { blockId: "a", text: "Opening.", standing: "keep" },
  {
    blockId: "b",
    text: "The storm arrives before the lights go out.",
    standing: "fixate",
  },
  { blockId: "c", text: "Tone: dry.", standing: "fixate" },
];
const words = (text: string, quote: string) => {
  const start = text.indexOf(quote);
  return anchorAt(text, start, start + quote.length);
};

describe("what a view reports of the reader's pointing", () => {
  it("Given a block and a passage marked, Then both come in mark order with the words each stands for", () => {
    const marking = addPassage(
      toggleReference(NO_MARKING, "a"),
      "b",
      words(blocks[1]!.text, "before the lights"),
    );
    expect(pointingOf(marking, blocks).references).toEqual([
      {
        kind: "block",
        number: 1,
        blockId: "a",
        words: "Opening.",
        stale: false,
      },
      {
        kind: "passage",
        number: 2,
        blockId: "b",
        quote: "before the lights",
        words: "before the lights",
        stale: false,
      },
    ]);
  });

  it("Given fixated blocks, Then they come in reading order, whatever is marked", () => {
    expect(
      pointingOf(NO_MARKING, blocks).fixated.map((block) => block.blockId),
    ).toEqual(["b", "c"]);
  });

  it("Given a passage whose words were edited away, Then it is reported stale, and the command names it by number", () => {
    const marking = addPassage(
      NO_MARKING,
      "b",
      words(blocks[1]!.text, "before the lights"),
    );
    const edited = blocks.map((block) =>
      block.blockId === "b"
        ? { ...block, text: "The storm arrives after dark." }
        : block,
    );
    const pointing = pointingOf(marking, edited);
    expect(pointing.references[0]?.stale).toBe(true);
    expect(staleIn(pointing)).toEqual([1]);
  });

  it("Given a long block, Then only its opening is shown", () => {
    const long = "word ".repeat(40);
    expect([...openingWords(long)].length).toBeLessThanOrEqual(
      OPENING_CHARS + 1,
    );
    expect(openingWords(long).endsWith("…")).toBe(true);
    expect(openingWords("Short.")).toBe("Short.");
  });
});

describe("the names of the composer's chips", () => {
  it("Given a block and a passage marked, Then each chip is named by its number and the words it stands for", () => {
    const marking = addPassage(
      toggleReference(NO_MARKING, "a"),
      "b",
      words(blocks[1]!.text, "storm"),
    );
    const [block, passage] = pointingOf(marking, blocks).references;
    expect(chipName(block!)).toBe("Reference 1: “Opening.”");
    expect(chipName(passage!)).toBe("Reference 2: “storm”");
  });

  it("Given a stale passage, Then its chip says so in words", () => {
    const marking = addPassage(NO_MARKING, "b", words(blocks[1]!.text, "storm"));
    const edited = blocks.map((block) =>
      block.blockId === "b" ? { ...block, text: "Calm all night." } : block,
    );
    const [passage] = pointingOf(marking, edited).references;
    expect(chipName(passage!)).toBe("Reference 1, stale: “storm”");
  });

  it("Given a fixated block, Then its chip is named as fixated with its opening", () => {
    expect(fixatedChipName(pointingOf(NO_MARKING, blocks).fixated[1]!)).toBe(
      "Fixated: “Tone: dry.”",
    );
  });
});

/**
 * A reference is what was marked, and the report says what it is and what has
 * happened to it since, with what is sent beside it. BO_0263_006
 */
describe("what the report says of what was marked", () => {
  const proposal = { target: "proposal" as const, group: "node:g", item: "node:g|insert|node:n", revisionId: "rev-n", words: "A new line.", proposer: "Claude Code" };
  const open = new Map([["node:g|insert|node:n", { words: "A new line, restaged." }]]);

  it("Given a proposal still open, Then it is a proposal by its proposer, with its words now and what is sent", () => {
    const [reported] = pointingOf(toggleReference(NO_MARKING, "n", proposal), blocks, open).references;
    expect(reported).toEqual({
      kind: "block", number: 1, blockId: "n", words: "A new line, restaged.", stale: false,
      target: "proposal", group: "node:g", item: "node:g|insert|node:n", revisionId: "rev-n",
      what: "proposal", proposer: "Claude Code",
    });
    expect(chipName(reported!)).toBe("Reference 1: proposed by Claude Code, “A new line, restaged.”");
  });

  it("Given a proposal answered and not become a block, Then it is rowless, since rejected, told in the words marked", () => {
    const [reported] = pointingOf(toggleReference(NO_MARKING, "n", proposal), blocks, new Map()).references;
    expect([reported?.words, reported?.since, reported?.rowless]).toEqual(["A new line.", "rejected", true]);
    expect(chipName(reported!)).toBe("Reference 1: proposed by Claude Code, “A new line.”, since rejected");
  });

  it("Given a retired block, and one restored since, Then each says so", () => {
    const retired = toggleReference(NO_MARKING, "gone", { target: "retired", revisionId: "rev-g", words: "Gone." });
    expect(pointingOf(retired, blocks).references[0]).toMatchObject({ what: "retired", words: "Gone." });
    const restored = toggleReference(NO_MARKING, "a", { target: "retired", revisionId: "rev-a", words: "Opening." });
    expect(pointingOf(restored, blocks).references[0]).toMatchObject({ what: "retired", since: "restored", rowless: true });
  });

  it("Given blocks discarded before or after they were marked, and a block retired since, Then each says what happened", () => {
    const discardedBlocks: PointableBlock[] = [{ blockId: "a", text: "Opening.", standing: "discarded" }, { blockId: "b", text: "Storm.", standing: "keep" }];
    const marking = toggleReference(
      toggleReference(toggleReference(NO_MARKING, "a", { revisionId: "rev-a" }), "b", { revisionId: "rev-b", discarded: true }),
      "c",
      { revisionId: "rev-c", words: "Tone: dry." },
    );
    const [a, b, c] = pointingOf(marking, discardedBlocks).references;
    expect([a?.what, a?.since]).toEqual(["discarded", "discarded"]);
    expect([b?.what, b?.since]).toEqual(["discarded", "reopened"]);
    expect([c?.what, c?.since, c?.rowless, c?.words]).toEqual([undefined, "retired", true, "Tone: dry."]);
  });

  it("Given a passage in an open proposal and one in a retired block, Then the first is checked against the proposal's words and the second is never stale", () => {
    const marking = addPassage(
      addPassage(NO_MARKING, "n", words("A new line.", "line"), proposal),
      "gone",
      words("Gone.", "Gone"),
      { target: "retired", revisionId: "rev-g" },
    );
    const [inProposal, inRetired] = pointingOf(marking, blocks, new Map([["node:g|insert|node:n", { words: "A rewritten sentence." }]])).references;
    expect(inProposal?.stale).toBe(true);
    expect(inRetired?.stale).toBe(false);
  });
});
