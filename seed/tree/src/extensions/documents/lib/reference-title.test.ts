import { describe, expect, it } from "vitest";

import type { PointedReference } from "~/lib/command-target";
import type { MarkRef } from "~/lib/runs";

import { blockTitles, drawnMark, markRefFrom, markReveal, markTitle, promptMarks } from "./reference-title";
import { NO_MARKING } from "./references";

/** What a prompt's reference is drawn as and pressed to show (`BO_0352_009`,
 * `BO_0352_012`): each kind's title, the cut, standing or unbound, and the
 * atom a mark is written as. */
describe("a prompt's reference as its chip draws it", () => {
  const blocks = blockTitles([
    { blockId: "blk-h", label: "The Method", glimpse: "", icon: "text-h-two" },
    { blockId: "blk-p", label: "Paragraph", glimpse: "It begins with a quiet start.", icon: "article-ny-times" },
    { blockId: "blk-i", label: "Figure 3", glimpse: "A map", icon: "image" },
  ]);
  const standing = (reference: Partial<PointedReference> & { number: number }): PointedReference =>
    ({ kind: "block", blockId: "blk-h", words: "", stale: false, ...reference }) as PointedReference;

  it("Given each kind, Then its title follows the kind", () => {
    const title = (reference: MarkRef, shown?: PointedReference) => markTitle(reference, shown, blocks);
    expect(title({ number: 1, kind: "block", blockId: "blk-h", words: "An older heading" })).toBe("The Method");
    expect(title({ number: 1, kind: "block", blockId: "blk-i" })).toBe("Figure 3");
    expect(title({ number: 1, kind: "block", blockId: "blk-p" })).toBe("It begins with a quiet start.");
    expect(title({ number: 1, kind: "block", blockId: "blk-gone", words: "Words it had" })).toBe("Words it had");
    expect(title({ number: 1, kind: "passage", blockId: "blk-p", quote: "a quiet start" })).toBe("a quiet start");
    expect(title({ number: 1, kind: "document", document: "doc-2", words: "Second" })).toBe("Second");
    expect(title({ number: 1, kind: "block", blockId: "blk-x", document: "doc-2", words: "Second" }, standing({ number: 1, blockId: "blk-x", document: "doc-2", documentTitle: "Second, renamed" }))).toBe("Second, renamed");
    expect(title({ number: 1, kind: "block", blockId: "blk-h", target: "retired", words: "Gone words" })).toBe("Gone words (retired)");
    expect(title({ number: 1, kind: "block", blockId: "blk-h", target: "proposal", words: "New words" })).toBe("New words (proposed)");
  });

  it("Given its mark standing under another number, Then the chip is titled and named by the number now; with none standing it warns as written", () => {
    const reference: MarkRef = { number: 1, kind: "block", blockId: "blk-p" };
    expect(drawnMark(reference, [standing({ number: 4, blockId: "blk-p" })], blocks)).toEqual({
      title: "It begins with a quiet start.",
      shown: "It begins with a…",
      number: 4,
      standing: true,
      name: "Reference 4: “It begins with a quiet start.”",
    });
    expect(drawnMark(reference, [standing({ number: 1, blockId: "blk-h" })], blocks)).toMatchObject({ shown: "#1", number: 1, standing: false });
    expect(drawnMark(reference, null, blocks)).toMatchObject({ standing: true, number: 1 });
  });

  it("Given a prompt the page holds no marks for, Then its chips are drawn from its words; the prompt pointed from, from the report", () => {
    const report = { references: [standing({ number: 2 })] };
    expect(promptMarks({ prompt: "blk-q", byPrompt: {}, report }, "blk-q")).toBe(report.references);
    expect(promptMarks({ prompt: "blk-q", byPrompt: {}, report }, "blk-r")).toBeNull();
    expect(promptMarks({ prompt: null, byPrompt: { "blk-r": NO_MARKING }, report }, "blk-r")).toEqual([]);
  });

  it("Given a mark chosen, Then it is written with what the shell sends of it and the words it is told by; into another document, that document's title", () => {
    expect(markRefFrom(standing({ number: 2, blockId: "blk-h", words: "The Method", revisionId: "rev-h" }))).toEqual({ number: 2, kind: "block", blockId: "blk-h", revisionId: "rev-h", words: "The Method" });
    expect(markRefFrom(standing({ number: 3, kind: "passage", blockId: "blk-p", quote: "a quiet start", words: "a quiet start" } as Partial<PointedReference> & { number: number }))).toEqual({ number: 3, kind: "passage", blockId: "blk-p", quote: "a quiet start", words: "a quiet start" });
    expect(markRefFrom(standing({ number: 4, blockId: "blk-x", document: "doc-2", documentTitle: "Second", words: "Elsewhere." }))).toMatchObject({ document: "doc-2", words: "Second" });
  });

  it("Given a chip pressed, Then what it names is asked for, its document with it; a warning chip asks for nothing", () => {
    const reference: MarkRef = { number: 1, kind: "block", blockId: "blk-x", document: "doc-2", words: "Second" };
    expect(markReveal(reference, drawnMark(reference, null, blocks))).toEqual({ kind: "block", blockId: "blk-x", document: "doc-2", documentTitle: "Second" });
    expect(markReveal(reference, drawnMark(reference, [], blocks))).toBeNull();
  });
});
