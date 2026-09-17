import { describe, expect, it } from "vitest";

import { cardReading, conflictWords, consequenceWords, phaseOf, phaseWords, policyReading, type Consequences } from "./phase";

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
  it("Given no phase, Then the root reads proposed; a change document carries none", () => {
    expect(phaseOf({})).toBe("proposed");
    expect(phaseOf({ phase: "accepted" })).toBe("accepted");
    expect(phaseOf({ phase: "nonsense" })).toBe("proposed");
    expect(phaseOf({ phase: "accepted", change: "ui.shell" })).toBeNull();
  });

  it("Given each phase, Then the marker's words name it, the successor by title", () => {
    expect(phaseWords("proposed")).toBe("Proposed");
    expect(phaseWords("accepted")).toBe("Accepted");
    expect(phaseWords("superseded", "Caching v2")).toBe("Superseded by Caching v2");
    expect(phaseWords("superseded")).toBe("Superseded");
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
