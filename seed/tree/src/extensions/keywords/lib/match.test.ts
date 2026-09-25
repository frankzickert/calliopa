import { describe, expect, it } from "vitest";

import type { Run } from "~/lib/runs";

import { baseOf, findMentions, inflects, nameWords, type KeywordNames } from "./match";
import { stemEnglish } from "../server/stem";

/**
 * The matcher's rules by example (`BO_0301_018`): the hardware and the
 * domain kept apart, an alias and its plural, the stem fallback and its
 * ambiguity, the longest span, the code run, the self-mention.
 */
const computer: KeywordNames = { keyword: "k-computer", title: "Quantum computer", aliases: [] };
const computing: KeywordNames = { keyword: "k-computing", title: "Quantum computing", aliases: ["QC"] };
const quantum: KeywordNames = { keyword: "k-quantum", title: "Quantum", aliases: [] };
const qubit: KeywordNames = { keyword: "k-qubit", title: "Qubit", aliases: [] };

const text = (words: string): Run[] => [{ text: words }];
const found = (runs: Run[], keywords: KeywordNames[], self: string | null = null) =>
  findMentions(runs, keywords, stemEnglish, self).map((mention) => ({
    ...mention,
    words: runs
      .flatMap((run) => (run.cite !== undefined || run.math === true || run.equationRef !== undefined ? ["\u2400"] : [...run.text]))
      .slice(mention.start, mention.end)
      .join(""),
  }));

describe("words and their inflections", () => {
  it("takes the possessive off and lowercases", () => {
    expect(baseOf("Computer's")).toBe("computer");
    expect(baseOf("computers’")).toBe("computers");
    expect(baseOf("QC")).toBe("qc");
  });

  it("matches a plural and a possessive to the singular, and never a different word", () => {
    expect(inflects("computers", "computer")).toBe(true);
    expect(inflects("computer", "computers")).toBe(true);
    expect(inflects("computing's", "computing")).toBe(true);
    expect(inflects("theories", "theory")).toBe(true);
    expect(inflects("computing", "computer")).toBe(false);
    expect(inflects("computation", "computing")).toBe(false);
  });

  it("splits a name into its words", () => {
    expect(nameWords("Quantum computing")).toEqual(["Quantum", "computing"]);
    expect(nameWords("Quantum-computing")).toEqual(["Quantum", "computing"]);
    expect(nameWords("   ")).toEqual([]);
  });
});

describe("the three rules in order", () => {
  it("keeps the hardware and the domain apart under the first rule", () => {
    const mentions = found(text("Quantum computers are loud; quantum computing is a field."), [computer, computing]);
    expect(mentions).toEqual([
      { start: 0, end: 17, keyword: "k-computer", rule: "inflection", words: "Quantum computers" },
      { start: 28, end: 45, keyword: "k-computing", rule: "inflection", words: "quantum computing" },
    ]);
  });

  it("reaches a keyword by an alias and its plural, under the second rule", () => {
    const mentions = found(text("Two QCs and one QC."), [computer, computing]);
    expect(mentions.map((mention) => [mention.words, mention.keyword, mention.rule])).toEqual([
      ["QCs", "k-computing", "alias"],
      ["QC", "k-computing", "alias"],
    ]);
  });

  it("falls back to the stem only where nothing else reaches, and connects nothing where the stem is ambiguous", () => {
    // Both keywords share the stem *quantum comput*: a guess is not a connection.
    expect(found(text("quantum computation"), [computer, computing])).toEqual([]);
    // One keyword alone reaches by the stem.
    expect(found(text("quantum computation"), [computing]).map((mention) => [mention.words, mention.rule])).toEqual([["quantum computation", "stem"]]);
    // An alias decides it.
    const aliased = { ...computing, aliases: ["quantum computation"] };
    expect(found(text("quantum computation"), [computer, aliased]).map((mention) => [mention.keyword, mention.rule])).toEqual([["k-computing", "alias"]]);
  });

  it("lets the longest span win, so the shorter keyword inside it is no mention", () => {
    const mentions = found(text("Quantum computing needs qubits, and quantum too."), [quantum, computing, qubit]);
    expect(mentions.map((mention) => [mention.words, mention.keyword])).toEqual([
      ["Quantum computing", "k-computing"],
      ["qubits", "k-qubit"],
      ["quantum", "k-quantum"],
    ]);
  });

  it("lets the higher rule win over the same words", () => {
    // *Quantum computing* matches the domain by inflection and the hardware by stem over the same two words.
    const mentions = found(text("quantum computing"), [computer, computing]);
    expect(mentions.map((mention) => [mention.keyword, mention.rule])).toEqual([["k-computing", "inflection"]]);
  });
});

describe("what is never matched", () => {
  it("matches nothing under the code mark or inside an atom", () => {
    const runs: Run[] = [
      { text: "run " },
      { text: "quantum computing", marks: ["code"] },
      { text: " and " },
      { text: "", cite: { work: "w" } },
      { text: "\\text{quantum computing}", math: true },
      { text: " here." },
    ];
    expect(found(runs, [computing])).toEqual([]);
  });

  it("matches at word boundaries only, in any case", () => {
    expect(found(text("QUANTUM COMPUTING!"), [computing]).map((mention) => mention.words)).toEqual(["QUANTUM COMPUTING"]);
    expect(found(text("aquantum computing"), [computing])).toEqual([]);
    expect(found(text("quantum computingx"), [computing])).toEqual([]);
    // A suffix the stemmer strips is the third rule's, by design.
    expect(found(text("quantum computingly"), [computing]).map((mention) => mention.rule)).toEqual(["stem"]);
  });

  it("leaves a keyword's own names alone in its own document", () => {
    expect(found(text("Quantum computing is a field of QC."), [computing], "k-computing")).toEqual([]);
    expect(found(text("Quantum computing uses qubits."), [computing, qubit], "k-computing").map((mention) => mention.keyword)).toEqual(["k-qubit"]);
  });

  it("counts an atom as one character in the offsets", () => {
    const runs: Run[] = [{ text: "", cite: { work: "w" } }, { text: " qubits" }];
    expect(found(runs, [qubit])).toEqual([{ start: 2, end: 8, keyword: "k-qubit", rule: "inflection", words: "qubits" }]);
  });

  it("matches across marks and a line break inside the words", () => {
    const runs: Run[] = [{ text: "quantum " }, { text: "computers", marks: ["bold"] }, { text: "\nquantum computing" }];
    expect(found(runs, [computer, computing]).map((mention) => mention.keyword)).toEqual(["k-computer", "k-computing"]);
  });
});
