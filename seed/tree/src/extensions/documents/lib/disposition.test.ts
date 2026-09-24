import { describe, expect, it } from "vitest";

import {
  CONTROL_GLYPH,
  DONE,
  GLYPH,
  LABEL,
  MARK,
  MEANING,
  readStanding,
  SCALE,
  step,
  storedValue,
  type Standing,
} from "./disposition";

describe("the disposition scale", () => {
  it("Given a stored value, Then the two dispositions read as themselves and anything else is keep", () => {
    expect(readStanding("fixate")).toBe("fixate");
    expect(readStanding("discarded")).toBe("discarded");
    expect(readStanding(undefined)).toBe("keep");
    expect(readStanding("keep")).toBe("keep");
    expect(readStanding("banana")).toBe("keep");
  });

  // The values an instance carried before BO_0272 narrowed the scale read as
  // what the reader decided they become, until the next write stores it.
  // BO_0272_006 BO_0272_011
  it("Given a value from before the narrowing, Then it reads as what it became", () => {
    expect(readStanding("pin")).toBe("fixate");
    expect(readStanding("resolved")).toBe("discarded");
    expect(readStanding("keep")).toBe("keep");
    expect(readStanding("banana")).toBe("keep");
  });

  it("Given a standing, Then keep is written as nothing and the rest as themselves", () => {
    expect(storedValue("keep")).toBeNull();
    expect(storedValue("fixate")).toBe("fixate");
    expect(storedValue("discarded")).toBe("discarded");
  });

  it("Given every standing, Then each has one label, one verb and one meaning, and only an acted-on one a mark", () => {
    for (const standing of SCALE) {
      expect(LABEL[standing]).not.toBe("");
      expect(DONE[standing]).not.toBe("");
      expect(MEANING[standing]).not.toBe("");
      expect(CONTROL_GLYPH[standing]).not.toBe("");
    }
    expect(SCALE).toEqual(["discarded", "keep", "fixate"]);
    // Keep is where a block stands unless someone says otherwise: a mark
    // means someone acted, so it carries neither word nor glyph in the
    // gutter, while the control that offers it still has a face.
    expect(MARK.keep).toBeUndefined();
    expect(GLYPH.keep).toBeUndefined();
    expect(CONTROL_GLYPH.keep).not.toBe("");
    expect(MARK.fixate).toBe("fixated");
  });
});

describe("a step along the scale", () => {
  const walk = (from: Standing, direction: "left" | "right", times: number) =>
    Array.from({ length: times }).reduce<Standing>(
      (at) => step(at, direction),
      from,
    );

  it("Given a kept block, Then one step right fixates it and one step left discards it", () => {
    expect(step("keep", "right")).toBe("fixate");
    expect(step("keep", "left")).toBe("discarded");
  });

  it("Given either end, Then the step back is keep and the ends stay where they are", () => {
    expect(step("fixate", "left")).toBe("keep");
    expect(step("discarded", "right")).toBe("keep");
    expect(walk("keep", "right", 4)).toBe("fixate");
    expect(walk("keep", "left", 4)).toBe("discarded");
  });

  it("Given one action each way, Then no step crosses the scale in one press", () => {
    expect(step("fixate", "left")).not.toBe("discarded");
    expect(step("discarded", "right")).not.toBe("fixate");
  });
});

/** A prompt is a standing Send sets and the scale never reaches. BO_0267_014 */
describe("the prompt standing", () => {
  it("Given a stored prompt, Then it reads back as itself and is written as itself", () => {
    expect(readStanding("prompt")).toBe("prompt");
    expect(storedValue("prompt")).toBe("prompt");
    expect(LABEL.prompt).toBe("Prompt");
    expect(DONE.prompt).toBe("Sent as prompt");
  });

  it("Given a prompt, Then no chord or swipe moves it, and no step on the scale reaches it", () => {
    expect(SCALE).not.toContain("prompt");
    expect(step("prompt", "left")).toBe("prompt");
    expect(step("prompt", "right")).toBe("prompt");
    for (const standing of SCALE) {
      for (const direction of ["left", "right"] as const) {
        expect(step(standing, direction)).not.toBe("prompt");
      }
    }
  });
});
