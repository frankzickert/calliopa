import { describe, expect, it } from "vitest";

import { entryText } from "../lib/segment";
import { orderedWorks, referencesFrom } from "./references";

/** A document's references in its style, with what a hover card shows (`BO_0291_027`, `BO_0291_020`). */
describe("referencesFrom", () => {
  const works = [
    { workId: "wrk-1", revisionId: "r1", record: { title: "Deep learning", kind: "book" as const, author: [{ family: "Goodfellow", given: "Ian" }], issued: { "date-parts": [[2016]] }, publisher: "MIT Press", file: { _kind: "blob" } } },
    { workId: "wrk-2", revisionId: "r2", record: { title: "Thermometry", kind: "article-journal" as const, author: [{ family: "Kucsko", given: "G." }], DOI: "10.1038/nature12373", "container-title": "Nature", issued: { "date-parts": [[2013]] } } },
    { workId: "wrk-3", revisionId: "r3", record: { title: "Cited nowhere", kind: "book" as const } },
  ];
  const numbers = { "wrk-2": 1, "wrk-1": 2 };

  it("orders the cited works by their numbers and leaves out works cited nowhere", () => {
    expect(orderedWorks(numbers, works).map((work) => work.workId)).toEqual(["wrk-2", "wrk-1"]);
  });

  it("lists IEEE in number order with its labels, and what a hover card shows", () => {
    const answer = referencesFrom("ieee", numbers, ["wrk-gone"], works, [{ work: "wrk-2" }, { work: "wrk-1" }]);
    expect(answer.references.map((reference) => [reference.workId, reference.label, reference.number])).toEqual([
      ["wrk-2", "[1]", 1],
      ["wrk-1", "[2]", 2],
    ]);
    expect(answer.references[0]).toMatchObject({ line: "Kucsko (2013) — Thermometry", doi: "10.1038/nature12373", file: false });
    expect(answer.references[1]).toMatchObject({ file: true });
    expect(answer.missing).toEqual(["wrk-gone"]);
  });

  it("lists APA by author with no labels", () => {
    const answer = referencesFrom("apa", numbers, [], works, [{ work: "wrk-2" }, { work: "wrk-1" }]);
    expect(answer.references.map((reference) => reference.workId)).toEqual(["wrk-1", "wrk-2"]);
    expect(answer.references[0]?.label).toBeUndefined();
    expect(entryText(answer.references[0]!.entry)).toBe("Goodfellow, I. (2016). Deep learning. MIT Press.");
  });
});
