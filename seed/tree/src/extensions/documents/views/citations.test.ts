import { describe, expect, it } from "vitest";

import { createDOM } from "@builder.io/qwik/testing";

import { runsLength, type Run } from "~/lib/runs";
import { citeLabel, workLine } from "../lib/citation-label";
import { paintRuns, runsFrom, textLength } from "./editor-dom";

/**
 * A citation in the editing surface (`BO_0291_025`): one atom the caret
 * steps over, drawn as its work's number with the locator as written, as
 * words when its work is gone, and as a placeholder until the read numbers
 * it; read back by what it says it is, never by what is drawn in it.
 */
const elementIn = async (): Promise<HTMLElement> => {
  const { screen } = await createDOM();
  return screen.ownerDocument.createElement("div") as HTMLElement;
};

const cite: Run = { text: "", cite: { work: "wrk-2", locator: "p. 54" } };
const again: Run = { text: "", cite: { work: "wrk-2" } };
const gone: Run = { text: "", cite: { work: "wrk-gone" } };
const fresh: Run = { text: "", cite: { work: "wrk-new" } };

const paint = async (runs: readonly Run[]) => {
  const element = await elementIn();
  paintRuns(element, runs, {
    citationOf: (work) => (work === "wrk-2" ? { number: 1 } : work === "wrk-gone" ? { missing: true } : undefined),
  });
  return element;
};

describe("a citation in the editing surface", () => {
  it("paints as one non-editable element reading its number and locator, one character wide", async () => {
    const runs = [{ text: "so " }, cite, { text: " holds" }];
    const element = await paint(runs);
    const atom = element.querySelector("[data-cite-work]") as HTMLElement;
    expect(atom.getAttribute("contenteditable")).toBe("false");
    expect(atom.getAttribute("data-cite-work")).toBe("wrk-2");
    expect(atom.getAttribute("data-cite-locator")).toBe("p. 54");
    // The label is an attribute the stylesheet draws, never text the caret
    // would count.
    expect(atom.getAttribute("data-cite-label")).toBe("[1, p. 54]");
    expect(atom.textContent).not.toContain("[1");
    expect(textLength(element)).toBe(runsLength(runs));
    expect(textLength(element)).toBe(10);
  });

  it("says its work is gone, and holds a place until the read numbers it", async () => {
    const element = await paint([gone, fresh]);
    const atoms = Array.from(element.querySelectorAll("[data-cite-work]")) as HTMLElement[];
    expect(atoms[0]?.getAttribute("data-cite-label")).toBe("[source gone]");
    expect(atoms[0]?.className).toContain("run-cite--missing");
    expect(atoms[1]?.getAttribute("data-cite-label")).toBe("[…]");
  });

  it("reads back as the run it was painted from", async () => {
    const runs = [{ text: "so " }, cite, { text: " and " }, again, { text: "." }];
    expect(runsFrom(await paint(runs))).toEqual(runs);
  });
});

describe("the label and the line", () => {
  it("draws the number with the locator, the placeholder and the gone words", () => {
    expect(citeLabel({ work: "w" }, 3, false)).toBe("[3]");
    expect(citeLabel({ work: "w", locator: "p. 12" }, 3, false)).toBe("[3, p. 12]");
    expect(citeLabel({ work: "w", locator: "p. 12" }, undefined, false)).toBe("[…, p. 12]");
    expect(citeLabel({ work: "w" }, 3, true)).toBe("[source gone]");
  });

  it("names a work as who, when and what", () => {
    expect(workLine({ title: "T", author: [{ family: "Kucsko" }, { family: "Maurer" }, { family: "Yao" }], issued: { "date-parts": [[2013]] } })).toBe("Kucsko et al. (2013) — T");
    expect(workLine({ title: "T", editor: [{ literal: "The Consortium" }] })).toBe("The Consortium — T");
    expect(workLine({ title: "Only a title" })).toBe("Only a title");
  });
});
