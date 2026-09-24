import { describe, expect, it } from "vitest";

import { createDOM } from "@builder.io/qwik/testing";

import { paintRuns, runsFrom, textLength } from "./editor-dom";
import { runsLength, type Run } from "~/lib/runs";

/**
 * Mathematics inside a sentence, in the editing surface (`BO_0290_015`).
 *
 * The rule the whole design rests on is here: an equation **stays typeset
 * while its block is edited**, as one element the caret steps over rather
 * than into. Were the source to take its place on entry, the line would
 * reflow every time a reader put a caret in the sentence — which is what the
 * popover exists to avoid, and what the retired shell was forced into.
 */
/** An element in the harness's own document: the unit project runs in node,
 * where there is no global one, which is why `paintRuns` works through
 * `ownerDocument` (`BO_0233_009`). */
const elementIn = async (): Promise<HTMLElement> => {
  const { screen } = await createDOM();
  return screen.ownerDocument.createElement("div") as HTMLElement;
};

const equation: Run = { text: "E = mc^2", math: true };
const reference: Run = { text: "", equationRef: "blk-e2" };
const SET = "<svg><path d='M1 1'/></svg>";

const paint = async (runs: readonly Run[]) => {
  const element = await elementIn();
  paintRuns(element, runs, {
    svgOf: (tex) => (tex === "E = mc^2" ? SET : undefined),
    numberOf: (blockId) => (blockId === "blk-e2" ? 1 : undefined),
  });
  return element;
};

describe("mathematics inside the editing surface", () => {
  it("paints an equation as one element the browser must not edit", async () => {
    const element = await paint([{ text: "so " }, equation, { text: " holds" }]);
    const atom = element.querySelector("[data-math]") as HTMLElement;
    expect(atom).toBeTruthy();
    expect(atom.getAttribute("contenteditable")).toBe("false");
    // Typeset, not source: the sentence does not reflow on entering the block.
    expect(atom.innerHTML).toContain("<svg");
    expect(atom.getAttribute("aria-label")).toBe("E = mc^2");
  });

  it("counts as one character, so the caret steps over it", async () => {
    const runs = [{ text: "so " }, equation, { text: " holds" }];
    const element = await paint(runs);
    // The DOM's own count and the run model's agree. Without the atom's one
    // character the DOM would count the equation as nothing and every caret
    // position after it would be wrong.
    expect(textLength(element)).toBe(runsLength(runs));
    expect(textLength(element)).toBe(10);
  });

  it("reads back as the run it was painted from, never as what is drawn inside it", async () => {
    const runs = [{ text: "so " }, equation, { text: " holds" }];
    const read = runsFrom(await paint(runs));
    expect(read).toEqual(runs);
    // The equation's own markup is not the sentence's words.
    expect(read.some((entry) => entry.text.includes("path"))).toBe(false);
  });

  it("paints a reference as its number and reads it back by identity", async () => {
    const element = await paint([{ text: "see " }, reference]);
    const atom = element.querySelector("[data-equation-ref]") as HTMLElement;
    expect(atom.textContent).toContain("(1)");
    expect(runsFrom(element)).toEqual([{ text: "see " }, reference]);
  });

  it("says a reference's equation is gone rather than drawing a stale number", async () => {
    const element = await elementIn();
    paintRuns(element, [{ text: "", equationRef: "blk-vanished" }], {});
    const atom = element.querySelector("[data-equation-ref]") as HTMLElement;
    expect(atom.textContent).toContain("equation gone");
    expect(atom.textContent).not.toContain("(0)");
  });

  it("draws mathematics it could not set as its source, so nothing is lost from the sentence", async () => {
    const element = await elementIn();
    paintRuns(element, [{ text: "\\frac{1}{", math: true }], {});
    const atom = element.querySelector("[data-math]") as HTMLElement;
    expect(atom.getAttribute("data-math-unset")).not.toBeNull();
    expect(atom.textContent).toContain("\\frac{1}{");
    // And it still reads back as mathematics, not as words.
    expect(runsFrom(element)).toEqual([{ text: "\\frac{1}{", math: true }]);
  });

  it("keeps two adjacent equations apart through a paint and a read", async () => {
    const runs = [equation, { text: "a^2", math: true } as Run];
    expect(runsFrom(await paint(runs))).toEqual(runs);
  });

  it("survives a round trip beside marked words", async () => {
    const runs: Run[] = [
      { text: "Einstein ", marks: ["bold"] },
      equation,
      { text: " again" },
    ];
    expect(runsFrom(await paint(runs))).toEqual(runs);
  });

  it("leaves the caret somewhere to land after an atom that ends the block", async () => {
    // A reference is not editable, so with nothing after it a reader cannot
    // type past one that ends a sentence — the walk's report. The trailing
    // `<br>` the block already uses for a final newline holds the line here
    // too, and is read back as nothing.
    const element = await paint([{ text: "see " }, reference]);
    expect(element.lastChild?.nodeName).toBe("BR");
    expect(runsFrom(element)).toEqual([{ text: "see " }, reference]);
  });

  it("adds no such break when words follow the atom", async () => {
    const element = await paint([equation, { text: " holds" }]);
    expect(element.lastChild?.nodeName).not.toBe("BR");
  });
});
