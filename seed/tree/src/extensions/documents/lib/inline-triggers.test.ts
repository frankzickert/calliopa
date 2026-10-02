import { describe, expect, it } from "vitest";

import { matchingEntries, offersCreate, pendingTrigger, type TriggerEntry } from "./inline-triggers";

/** Inline triggers (`calliopa-bootstrap`'s `BO_0310_011`). */
const entries: TriggerEntry[] = [
  { id: "kw-qc", label: "Quantum computer", names: ["Quantum computer", "QC"] },
  { id: "kw-qg", label: "Quantum computing", names: ["Quantum computing"] },
  { id: "kw-q", label: "Qubit", names: ["Qubit"] },
];

describe("a pending trigger", () => {
  it("stands at the start, after a space, a bracket or an atom, with the words to the caret", () => {
    expect(pendingTrigger([{ text: "@quan" }], 5, ["@"])).toEqual({ character: "@", start: 0, typed: "quan" });
    expect(pendingTrigger([{ text: "see @quantum com" }], 16, ["@"])).toEqual({ character: "@", start: 4, typed: "quantum com" });
    expect(pendingTrigger([{ text: "(@q" }], 3, ["@"])).toEqual({ character: "@", start: 1, typed: "q" });
    expect(pendingTrigger([{ text: "", blockRef: "blk-1" }, { text: "@" }], 2, ["@"])).toEqual({ character: "@", start: 1, typed: "" });
  });

  it("is no trigger inside a word, past two spaces, across a line or for an unregistered character", () => {
    expect(pendingTrigger([{ text: "mail@quan" }], 9, ["@"])).toBeNull();
    expect(pendingTrigger([{ text: "@quan  x" }], 8, ["@"])).toBeNull();
    expect(pendingTrigger([{ text: "@quan\nx" }], 7, ["@"])).toBeNull();
    expect(pendingTrigger([{ text: "@quan" }], 5, [])).toBeNull();
    expect(pendingTrigger([{ text: "#quan" }], 5, ["@"])).toBeNull();
  });
});

describe("what a trigger offers", () => {
  it("narrows to the entries holding every word typed, by any of their names", () => {
    expect(matchingEntries(entries, "quan").map((entry) => entry.id)).toEqual(["kw-qc", "kw-qg"]);
    expect(matchingEntries(entries, "quantum computi").map((entry) => entry.id)).toEqual(["kw-qg"]);
    expect(matchingEntries(entries, "qc").map((entry) => entry.id)).toEqual(["kw-qc"]);
    expect(matchingEntries(entries, "")).toHaveLength(3);
  });

  it("offers to create for words no entry is named by exactly, and draws nothing for writing after the character", () => {
    expect(offersCreate(entries, matchingEntries(entries, "quan"), "quan")).toBe(true);
    expect(offersCreate(entries, matchingEntries(entries, "qubit"), "qubit")).toBe(false);
    expect(offersCreate(entries, [], "")).toBe(false);
    expect(offersCreate(entries, [], "entanglement")).toBe(true);
    expect(offersCreate(entries, [], "said that")).toBe(false);
  });
});
