import { describe, expect, it } from "vitest";

import type { BlockView } from "../server/assemble";
import { matchingChoices, referenceChoices } from "./reference-choices";

/**
 * What the `#` list offers (`BO_0300_005`): every block a sentence can refer
 * to, in reading order, the block being edited left out, filtered by the
 * words typed after the `#`.
 */
const common = (blockId: string, order: string) => ({ blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order });
const words = (blockId: string, order: string, role: string, text: string, standing = "keep"): BlockView =>
  ({ ...common(blockId, order), kind: "text", role, standing, runs: [{ text }] }) as unknown as BlockView;

const blocks: BlockView[] = [
  words("abs", "a", "abstract", "We show a thing."),
  words("h", "b", "h2", "The Method"),
  words("p", "c", "paragraph", "The paragraph being edited, which refers to the rest."),
  words("p2", "d", "paragraph", "A long paragraph whose first words are what the list shows, and whose tail is cut off after forty characters."),
  words("gone", "e", "paragraph", "Discarded.", "discarded"),
  { ...common("img", "f"), kind: "image", objectId: "o", numbered: true, number: 1, caption: "The apparatus" } as BlockView,
  { ...common("img2", "g"), kind: "image", objectId: "o2" } as BlockView,
  { ...common("tab", "h"), kind: "table", columns: [], rows: [], numbered: true, number: 1 } as unknown as BlockView,
  { ...common("eq", "i"), kind: "equation", tex: "e^{i\\pi} + 1 = 0", numbered: true, number: 1 } as unknown as BlockView,
  { ...common("code", "j"), kind: "sourcecode", source: "x" } as unknown as BlockView,
  { ...common("lst", "k"), kind: "sourcecode", source: "def f(x):\n    return x", language: "python", numbered: true, number: 1 } as unknown as BlockView,
  { ...common("lst2", "l"), kind: "sourcecode", source: "\nprint(2)", caption: "The second listing", numbered: true, number: 2 } as unknown as BlockView,
];

describe("the # list's entries", () => {
  it("offers headings, paragraphs, numbered figures, tables and equations in reading order, and leaves out the block edited, the abstract, the discarded and the unnumbered", () => {
    const choices = referenceChoices({ blocks, referenceLabels: { p2: "Remark 1", img: "Figure 1", tab: "Table 1", lst: "Listing 1", lst2: "Listing 2" }, equationNumbers: { eq: 1 } }, "p");
    expect(choices.map((choice) => [choice.blockId, choice.label, choice.glimpse])).toEqual([
      ["h", "The Method", ""],
      ["p2", "Remark 1", "A long paragraph whose first words are w…"],
      ["img", "Figure 1", "The apparatus"],
      ["tab", "Table 1", ""],
      ["eq", "(1)", "e^{i\\pi} + 1 = 0"],
      ["lst", "Listing 1", "def f(x):"],
      ["lst2", "Listing 2", "The second listing"],
    ]);
  });

  it("offers a numbered code block as its listing with its caption, or its first source line when it has none, and never an unnumbered one (BO_0303_013)", () => {
    const choices = referenceChoices({ blocks, referenceLabels: {} }, null);
    expect(choices.find((choice) => choice.blockId === "code")).toBeUndefined();
    expect(choices.find((choice) => choice.blockId === "lst")).toMatchObject({ label: "Listing 1", glimpse: "def f(x):", icon: "code" });
    expect(choices.find((choice) => choice.blockId === "lst2")).toMatchObject({ label: "Listing 2", glimpse: "The second listing", icon: "code" });
  });

  it("names a paragraph nobody refers to yet as a paragraph, since its remark number comes with the reference", () => {
    const [, paragraph] = referenceChoices({ blocks, referenceLabels: {} }, "p");
    expect(paragraph?.label).toBe("Paragraph");
  });

  it("filters by every word typed, against the label and the glimpse alike, case aside", () => {
    const choices = referenceChoices({ blocks, referenceLabels: { img: "Figure 1" }, equationNumbers: { eq: 1 } }, null);
    expect(matchingChoices(choices, "meth").map((choice) => choice.blockId)).toEqual(["h"]);
    expect(matchingChoices(choices, "fig app").map((choice) => choice.blockId)).toEqual(["img"]);
    expect(matchingChoices(choices, "").length).toBe(choices.length);
    expect(matchingChoices(choices, "nothing-here")).toEqual([]);
  });
});
