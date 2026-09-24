import { describe, expect, it } from "vitest";

import { carriesMath, mathAtCaret, mathInText } from "./dollar-math";
import type { Run } from "~/lib/runs";

/**
 * `$…$` becoming mathematics (`BO_0290_024`). The gesture has to be fast
 * without being a trap: what converts is only what just closed, and a
 * sentence about money stays a sentence.
 */
describe("$…$ as it is typed", () => {
  const typed = (text: string) => mathAtCaret([{ text }], text.length);

  it("converts the pair that just closed", () => {
    expect(typed("so $x^2$")).toEqual({
      runs: [{ text: "so " }, { text: "x^2", math: true }],
      caret: 4,
    });
  });

  it("puts the caret just after the equation, which is one character wide", () => {
    const converted = mathAtCaret([{ text: "$a$ and more" }], 3);
    expect(converted?.caret).toBe(1);
    expect(converted?.runs[0]).toEqual({ text: "a", math: true });
  });

  it("leaves a sentence about money alone", () => {
    // The closing `$` is spaced away from its source, so this is not a pair.
    expect(typed("I paid $5 and $")).toBeNull();
    expect(mathAtCaret([{ text: "$5 and $10" }], 8)).toBeNull();
  });

  it("wants something between the dollars", () => {
    expect(typed("$$")).toBeNull();
    expect(typed("costs $ $")).toBeNull();
  });

  it("converts nothing when the caret is not on a closing dollar", () => {
    expect(typed("so $x^2")).toBeNull();
    expect(mathAtCaret([{ text: "$x$" }], 0)).toBeNull();
  });

  it("does not reach past mathematics already in the line", () => {
    const runs: Run[] = [{ text: "E", math: true }, { text: " and $y$" }];
    // The caret is at the end: 1 for the atom + 8 characters.
    const converted = mathAtCaret(runs, 9);
    expect(converted?.runs).toEqual([
      { text: "E", math: true },
      { text: " and " },
      { text: "y", math: true },
    ]);
  });
});

describe("$…$ in pasted words", () => {
  it("converts every pair, because nothing here was typed a key at a time", () => {
    expect(mathInText("where $a^2$ and $b^2$ meet")).toEqual([
      { text: "where " },
      { text: "a^2", math: true },
      { text: " and " },
      { text: "b^2", math: true },
      { text: " meet" },
    ]);
  });

  it("keeps money as money", () => {
    expect(mathInText("$5 and $10")).toEqual([{ text: "$5 and $10" }]);
    expect(carriesMath("$5 and $10")).toBe(false);
  });

  it("leaves words with no pair untouched", () => {
    expect(mathInText("a lone $ sign")).toEqual([{ text: "a lone $ sign" }]);
    expect(carriesMath("plain words")).toBe(false);
  });

  it("says when a paste is worth converting", () => {
    expect(carriesMath("where $a^2$ ends")).toBe(true);
  });
});
