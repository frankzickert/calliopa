import { describe, expect, it } from "vitest";

import {
  classificationOf,
  classificationWords,
  documentStateOf,
  judgementsOn,
  recordOf,
  recordWords,
  relativeTime,
  unresolvedPressure,
  type Judgement,
} from "./judgements";

/**
 * The derivations over judgements (`BO_0248_010`), decided without a graph:
 * which pressure still stands on a block, what a block's classification is,
 * a relation's track record, and the document's derived state. The server
 * and the editor share these, so they cannot disagree.
 */

const words = (text: string) => [{ text }];

const judgement = (over: Partial<Judgement> & { judgementId: string }): Judgement => ({
  about: "pressure",
  outcome: "material",
  explanation: words("the premise moved"),
  dataRevision: 1,
  recordedAt: 1000,
  run: "run-1",
  by: "system:refine",
  subject: "rel-1",
  target: "blk-t",
  resolves: null,
  resolved: null,
  ...over,
});

describe("unresolved pressure on a block", () => {
  it("Given a material judgement nothing resolved, Then it stands; one marked seen, named by a later resolves, or followed by a later judgement on the same relation does not, and a silence stands on nothing", () => {
    const standing = judgement({ judgementId: "j-1" });
    const seen = judgement({ judgementId: "j-2", subject: "rel-2", resolved: "alice at 2026-09-14T10:00:00Z" });
    const superseded = judgement({ judgementId: "j-3", subject: "rel-3", dataRevision: 2 });
    const later = judgement({ judgementId: "j-4", subject: "rel-3", dataRevision: 5, outcome: "unaffected" });
    const named = judgement({ judgementId: "j-5", subject: "rel-4", dataRevision: 3 });
    const resolver = judgement({ judgementId: "j-6", subject: "rel-4", dataRevision: 7, outcome: "possiblyRelevant", resolves: "j-5", target: "blk-other" });
    const elsewhere = judgement({ judgementId: "j-7", subject: "rel-5", target: "blk-other" });
    const again = judgement({ judgementId: "j-8", subject: "rel-6", dataRevision: 1, outcome: "invalidated" });
    const renewed = judgement({ judgementId: "j-9", subject: "rel-6", dataRevision: 9, outcome: "material" });
    const list = [standing, seen, superseded, later, named, resolver, elsewhere, again, renewed];
    // The silence on rel-3 resolves j-3 and itself stands on nothing; the
    // newer material on rel-6 stands in place of the older invalidated.
    expect(unresolvedPressure(list, "blk-t").map((entry) => entry.judgementId)).toEqual(["j-9", "j-1"]);
    expect(unresolvedPressure(list, "blk-other").map((entry) => entry.judgementId)).toEqual(["j-6", "j-7"]);
    expect(unresolvedPressure(list, "blk-none")).toEqual([]);
  });
});

describe("a block's classification and the document's state", () => {
  it("Given change judgements on a block, Then the newest is its classification and its words say what it was treated as", () => {
    const first = judgement({ judgementId: "c-1", about: "change", outcome: "changed", subject: "blk-a", target: null, dataRevision: 2 });
    const correction = judgement({ judgementId: "c-2", about: "change", outcome: "reworded", subject: "blk-a", target: null, dataRevision: 4, run: null, by: "alice" });
    expect(classificationOf([first, correction], "blk-a")?.judgementId).toBe("c-2");
    expect(classificationOf([first], "blk-b")).toBeNull();
    expect(classificationWords("changed")).toBe("Treated as a material change");
    expect(classificationWords("reworded")).toBe("Treated as a rewording");
    expect(classificationWords("clarified")).toBe("Treated as a clarification");
  });

  it("Given unresolved pressure by block, Then invalidated makes the document need review, material puts it under pressure, and neither leaves it plain", () => {
    expect(documentStateOf({ "blk-a": [judgement({ judgementId: "p-1", outcome: "material" })], "blk-b": [judgement({ judgementId: "p-2", outcome: "invalidated" })] })).toBe("needsReview");
    expect(documentStateOf({ "blk-a": [judgement({ judgementId: "p-1", outcome: "material" })] })).toBe("underPressure");
    expect(documentStateOf({ "blk-a": [judgement({ judgementId: "p-1", outcome: "possiblyRelevant" })] })).toBeNull();
    expect(documentStateOf({})).toBeNull();
  });
});

describe("a relation's track record", () => {
  it("Given a relation's judgements, Then the record counts fires, quiet changes and a person's corrections, and reads in words", () => {
    const list = [
      judgement({ judgementId: "r-1", outcome: "material", dataRevision: 1 }),
      judgement({ judgementId: "r-2", outcome: "unaffected", dataRevision: 2 }),
      judgement({ judgementId: "r-3", outcome: "invalidated", dataRevision: 3, explanation: words("the reason no longer applies") }),
      judgement({ judgementId: "r-4", about: "change", outcome: "reworded", dataRevision: 4, run: null, by: "alice", subject: "rel-1", target: null }),
      judgement({ judgementId: "r-5", subject: "rel-9", outcome: "material" }),
    ];
    const record = recordOf(list, "rel-1", "exercised");
    expect(record).toMatchObject({ fired: 2, quiet: 1, corrected: 1, needsReview: null });
    expect(recordWords(record)).toBe("fired correctly on 2 changes · stayed quiet on 1 · corrected by a person once");
    const reviewed = recordOf(list, "rel-1", "needsReview");
    expect(reviewed.needsReview).toEqual(words("the reason no longer applies"));
    expect(recordWords(recordOf([], "rel-2", "declared"))).toBe("");
  });

  it("Given a block, Then its history lists the judgements on it or targeting it, newest first", () => {
    const list = [
      judgement({ judgementId: "h-1", dataRevision: 1 }),
      judgement({ judgementId: "h-2", about: "change", outcome: "clarified", subject: "blk-t", target: null, dataRevision: 3 }),
      judgement({ judgementId: "h-3", subject: "rel-2", target: "blk-other", dataRevision: 2 }),
    ];
    expect(judgementsOn(list, "blk-t").map((entry) => entry.judgementId)).toEqual(["h-2", "h-1"]);
  });

  it("Given a stamp, Then the relative time reads in minutes, hours or days, and an unknown stamp says nothing", () => {
    const now = 10_000_000_000;
    expect(relativeTime(now - 30_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("2 hours ago");
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
    expect(relativeTime(0, now)).toBe("");
  });
});
