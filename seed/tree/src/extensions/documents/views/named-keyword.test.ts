import { describe, expect, it } from "vitest";

import { createDOM } from "@builder.io/qwik/testing";

import { runsLength, type Run } from "~/lib/runs";
import { paintRuns, runsFrom, textLength } from "./editor-dom";

/**
 * A named keyword in the editing surface (`calliopa-bootstrap`'s
 * `BO_0310_010`): words the caret walks through like any others, carrying the
 * keyword's identity as `data-keyword`, and read back with it — under a mark
 * too.
 */
const elementIn = async (): Promise<HTMLElement> => {
  const { screen } = await createDOM();
  return screen.ownerDocument.createElement("div") as HTMLElement;
};

describe("a named keyword in the editing surface", () => {
  it("paints its words inside data-keyword and reads them back naming it", async () => {
    const runs: Run[] = [
      { text: "Both " },
      { text: "quantum computers", keyword: "kw-qc" },
      { text: " and " },
      { text: "qubits", marks: ["bold"], keyword: "kw-q" },
      { text: "." },
    ];
    const element = await elementIn();
    paintRuns(element, runs);
    const named = Array.from(element.querySelectorAll("[data-keyword]")) as HTMLElement[];
    expect(named.map((span) => [span.getAttribute("data-keyword"), span.textContent])).toEqual([
      ["kw-qc", "quantum computers"],
      ["kw-q", "qubits"],
    ]);
    // Words, not an atom: every character counts.
    expect(textLength(element)).toBe(runsLength(runs));
    expect(runsFrom(element)).toEqual(runs);
  });
});
