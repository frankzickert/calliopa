import { describe, expect, it } from "vitest";

import { staleIn } from "./command-target";
import { anchorAt } from "./passage";
import {
  OPENING_CHARS,
  openingWords,
  chipName,
  pinnedChipName,
  pointingOf,
  type PointableBlock,
} from "./pointing";
import { addPassage, NO_MARKING, toggleReference } from "./references";

const blocks: PointableBlock[] = [
  { blockId: "a", text: "Opening.", standing: "neutral" },
  {
    blockId: "b",
    text: "The storm arrives before the lights go out.",
    standing: "pin",
  },
  { blockId: "c", text: "Tone: dry.", standing: "pin" },
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

  it("Given pinned blocks, Then they come in reading order, whatever is marked", () => {
    expect(
      pointingOf(NO_MARKING, blocks).pinned.map((block) => block.blockId),
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

  it("Given a pinned block, Then its chip is named as pinned with its opening", () => {
    expect(pinnedChipName(pointingOf(NO_MARKING, blocks).pinned[1]!)).toBe(
      "Pinned: “Tone: dry.”",
    );
  });
});
