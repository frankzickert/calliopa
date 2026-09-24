import { describe, expect, it } from "vitest";

import {
  cardReading,
  conflictWords,
  consequenceWords,
  leadWords,
  judgedSince,
  standingFor,
  phaseOf,
  phaseWords,
  policyReading,
  reportLines,
  standingOf,
  type Acceptance,
  type Consequences,
  type JudgedEdit,
} from "./phase";

/** The root's phase and the card's words, decided once (`BO_0249`). */

const read = (over: Partial<Consequences> = {}): Consequences => ({
  documentId: "doc-1",
  phase: "proposed",
  permitted: true,
  policy: "owner",
  conflicts: [],
  items: [],
  ...over,
});

describe("the root's phase", () => {
  it("Given nothing decided, Then the root carries no phase at all, as a change document does not", () => {
    // A document nobody has decided anything about draws no line: absent no
    // longer reads as proposed. BO_0274_007
    expect(phaseOf({})).toBeNull();
    expect(phaseOf({ phase: "proposed" })).toBeNull();
    expect(phaseOf({ phase: "nonsense" })).toBeNull();
    expect(phaseOf({ phase: "accepted" })).toBe("accepted");
    expect(phaseOf({ phase: "accepted", change: "ui.shell" })).toBeNull();
  });

  it("Given an accepted root, Then the line names each kind that is not accepted and drops the empty clause", () => {
    const standing = (changed: number, notAccepted: number, edited = 0) => ({ changed, edited, notAccepted });
    expect(phaseWords("accepted")).toBe("Accepted");
    expect(phaseWords("accepted", null, standing(0, 0))).toBe("Accepted");
    expect(phaseWords("accepted", null, standing(2, 0))).toBe("Accepted · 2 changed");
    expect(phaseWords("accepted", null, standing(0, 1))).toBe("Accepted · 1 not accepted");
    expect(phaseWords("accepted", null, standing(2, 1))).toBe("Accepted · 2 changed, 1 not accepted");
    // The hint that costs nothing: the page moved and nothing has judged it.
    expect(phaseWords("accepted", null, standing(0, 0, 1))).toBe("Accepted · 1 block edited since");
    expect(phaseWords("accepted", null, standing(0, 0, 3))).toBe("Accepted · 3 blocks edited since");
    expect(phaseWords("accepted", null, standing(1, 0, 2))).toBe("Accepted · 1 changed, 2 blocks edited since");
    expect(phaseWords("superseded", "Caching v2")).toBe("Superseded by Caching v2");
    expect(phaseWords("superseded")).toBe("Superseded");
    // There are no words for a root with nothing decided: it has no line.
    expect(phaseWords("proposed")).toBe("");
  });

  it("Given what has moved, Then the counts and the lead's word follow it", () => {
    const acceptance = (standings: readonly string[]): Acceptance => ({
      documentId: "doc-1",
      phase: "accepted",
      acceptedAt: 100,
      items: standings.map((standing, index) => ({
        blockId: `blk-${index}`,
        words: `block ${index}`,
        standing: standing as "changed" | "edited" | "notAccepted",
      })),
    });
    expect(standingOf(null)).toBeNull();
    // Nothing has moved: the line says Accepted and nothing more.
    expect(standingOf(acceptance([]))).toBeNull();
    expect(standingOf(acceptance(["changed", "notAccepted", "changed", "edited"]))).toEqual({
      changed: 2,
      edited: 1,
      notAccepted: 1,
    });
    // A run may rely on a root where nothing has moved since the stamp, and is
    // told when something has. BO_0274_011
    expect(leadWords("accepted", standingOf(acceptance([])))).toBe("accepted");
    expect(leadWords("accepted", standingOf(acceptance(["changed"])))).toBe("accepted · changed");
    expect(leadWords("accepted", standingOf(acceptance(["notAccepted"])))).toBe("accepted · changed");
    expect(leadWords("accepted", null)).toBe("accepted");
    expect(leadWords("superseded", null)).toBe("superseded");
    expect(leadWords(null, null)).toBe("");
  });
});

describe("what moved since the decision", () => {
  const judged = (over: Partial<JudgedEdit> = {}): JudgedEdit => ({
    about: "change",
    outcome: "changed",
    subject: "node:blk-a",
    dataRevision: 120,
    explanation: [{ text: "treated as changing «per request» to «per session»" }],
    ...over,
  });

  it("Given judgements since the stamp, Then the newest per block stands and nothing older than the stamp counts", () => {
    // Nothing judged at or before the stamp, and nothing about something else.
    expect(judgedSince([judged({ dataRevision: 100 }), judged({ dataRevision: 99 })], 100).size).toBe(0);
    expect(judgedSince([judged({ about: "pressure", outcome: "material" })], 100).size).toBe(0);
    const seen = judgedSince(
      [
        judged({ outcome: "narrowed", dataRevision: 130, explanation: [{ text: "narrowed to repeated checks" }] }),
        judged({ outcome: "changed", dataRevision: 120 }),
        judged({ subject: "node:blk-b", outcome: "reworded", dataRevision: 110, explanation: [{ text: "same claim, other words" }] }),
      ],
      100,
    );
    expect([...seen.keys()]).toEqual(["blk-a", "blk-b"]);
    expect(seen.get("blk-a")).toEqual({ outcome: "narrowed", explanation: "narrowed to repeated checks", dataRevision: 130 });
    expect(seen.get("blk-b")?.outcome).toBe("reworded");
  });

  it("Given a block's revision and what was judged of it, Then the hint gives way to the judgement and an overtaken judgement gives way to the hint", () => {
    const material = { outcome: "changed", explanation: "treated as changing «was» to «is now»", dataRevision: 120 };
    const reworded = { outcome: "reworded", explanation: "same claim, other words", dataRevision: 120 };
    // Untouched since the decision: nothing to say.
    expect(standingFor(90, 100, undefined)).toBeNull();
    expect(standingFor(undefined, 100, undefined)).toBeNull();
    // Moved and unjudged: the free hint.
    expect(standingFor(110, 100, undefined)).toBe("edited");
    // Judged material, and the judgement is as new as the block.
    expect(standingFor(110, 100, material)).toBe("changed");
    // Judged a rewording: not a change to what the document says.
    expect(standingFor(110, 100, reworded)).toBeNull();
    // Edited again after it was judged: the judgement is overtaken, so the
    // hint comes back rather than the stale answer standing.
    expect(standingFor(130, 100, material)).toBe("edited");
    expect(standingFor(130, 100, reworded)).toBe("edited");
  });

  it("Given a report, Then a changed block reads with the refinement's own sentence and a collision names what it contradicts", () => {
    expect(
      reportLines({
        documentId: "doc-1",
        phase: "accepted",
        acceptedAt: 100,
        items: [
          {
            blockId: "blk-a",
            words: "Request-local caching could reduce repeated checks.",
            standing: "changed",
            judgement: { outcome: "changed", explanation: "treated as changing «per request» to «per session»" },
          },
          {
            blockId: "blk-b",
            words: "Opening.",
            standing: "notAccepted",
            collidesWith: { words: "One stable revision per request", documentId: "doc-9", documentTitle: "Request semantics", relationId: "rel-9" },
          },
        ],
      }),
    ).toEqual([
      "Request-local caching could reduce repeated checks. — changed: treated as changing «per request» to «per session»",
      "Opening. is not accepted: it contradicts One stable revision per request in Request semantics",
    ]);
    expect(reportLines(null)).toEqual([]);
  });
});

describe("the transition card", () => {
  it("Given consequences, Then each reads as its verb, the far words and the other document, and a judgement as reopen", () => {
    expect(consequenceWords({ kind: "constrains", words: "traversal security", documentId: "doc-2", documentTitle: "Security" }, "doc-1")).toBe(
      "constrain traversal security in Security",
    );
    expect(consequenceWords({ kind: "supersedes", words: "the current caching proposal", documentId: "doc-1", documentTitle: "Caching" }, "doc-1")).toBe(
      "supersede the current caching proposal",
    );
    expect(consequenceWords({ kind: "judgement", words: "one implementation assumption" })).toBe("reopen: one implementation assumption");
  });

  it("Given no consequences, Then the card says nothing rests on this yet and still offers Establish", () => {
    const card = cardReading(read());
    expect(card.question).toBe("Establish this as the accepted direction?");
    expect(card.lead).toBe("Nothing else in the network rests on this yet");
    expect(card.lines).toEqual([]);
    expect(card.control).toBe("establish");
    expect(card.label).toBe("Establish");
    expect(card.note).toBeNull();
  });

  it("Given an accepted root that contradicts this one, Then the card names it and the control supersedes", () => {
    const card = cardReading(read({ conflicts: [{ documentId: "doc-2", title: "Old direction" }] }));
    expect(card.conflict?.title).toBe("Old direction");
    expect(card.control).toBe("supersede");
    expect(card.label).toBe("Establish and supersede Old direction");
    expect(conflictWords("Old direction")).toBe("Old direction is the accepted direction and contradicts this");
  });

  it("Given the three policy readings, Then the owner establishes, the unpermitted see the policy named, and another's policy proposes", () => {
    expect(policyReading(true, "owner")).toEqual({ control: "establish", note: null });
    expect(policyReading(false, "owner")).toEqual({ control: "none", note: "Only the owner may establish this" });
    expect(policyReading(false, "reviewers")).toEqual({ control: "propose", note: "reviewers establishes this; you may propose it" });
    const unpermitted = cardReading(read({ permitted: false, conflicts: [{ documentId: "doc-2", title: "Old" }] }));
    expect(unpermitted.control).toBe("none");
    expect(cardReading(read({ permitted: false, policy: "reviewers" })).label).toBe("Propose acceptance");
  });
});
