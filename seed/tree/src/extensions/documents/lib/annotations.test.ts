import { describe, expect, it } from "vitest";

import type { Run } from "~/lib/runs";

import { annotate, type Annotation } from "./annotations";

const keyword = (start: number, end: number, id = "k"): Annotation => ({ start, end, kind: "keyword", id, title: "Keyword" });

const words = (segments: ReturnType<typeof annotate>) => segments.map((segment) => [segment.run.text, segment.annotation?.id ?? null]);

describe("annotating runs", () => {
  it("leaves runs whole with nothing to draw", () => {
    const runs: Run[] = [{ text: "one " }, { text: "two", marks: ["bold"] }];
    expect(annotate(runs, [])).toEqual(runs.map((run) => ({ run, annotation: null })));
  });

  it("cuts a run at the annotation's edges and keeps its marks on every piece", () => {
    const runs: Run[] = [{ text: "about quantum computing here", marks: ["italic"] }];
    const segments = annotate(runs, [keyword(6, 23)]);
    expect(words(segments)).toEqual([
      ["about ", null],
      ["quantum computing", "k"],
      [" here", null],
    ]);
    expect(segments.every((segment) => segment.run.marks?.[0] === "italic")).toBe(true);
  });

  it("carries an annotation across runs and counts an atom as one character", () => {
    const runs: Run[] = [{ text: "see " }, { text: "", cite: { work: "w" } }, { text: " quantum " }, { text: "computers", marks: ["bold"] }, { text: "." }];
    // "see " = 0..4, the citation 4..5, " quantum " 5..14, "computers" 14..23.
    expect(words(annotate(runs, [keyword(6, 23)]))).toEqual([
      ["see ", null],
      ["", null],
      [" ", null],
      ["quantum ", "k"],
      ["computers", "k"],
      [".", null],
    ]);
  });

  it("annotates an atom whole and never cuts it", () => {
    const runs: Run[] = [{ text: "a" }, { text: "x", math: true }, { text: "b" }];
    expect(words(annotate(runs, [keyword(0, 3)]))).toEqual([
      ["a", "k"],
      ["x", "k"],
      ["b", "k"],
    ]);
  });

  it("drops an annotation overlapping an earlier one and an empty one", () => {
    const runs: Run[] = [{ text: "quantum computing" }];
    expect(words(annotate(runs, [keyword(0, 17, "long"), keyword(8, 17, "short"), keyword(3, 3, "empty")]))).toEqual([["quantum computing", "long"]]);
  });

  it("takes two annotations in one run in order", () => {
    const runs: Run[] = [{ text: "qubits and quantum" }];
    expect(words(annotate(runs, [keyword(11, 18, "q"), keyword(0, 6, "b")]))).toEqual([
      ["qubits", "b"],
      [" and ", null],
      ["quantum", "q"],
    ]);
  });
});
