import { describe, expect, it } from "vitest";

import {
  DONE,
  LABEL,
  MARK,
  readStanding,
  SCALE,
  step,
  storedValue,
  swipeTargets,
  type Standing,
} from "./disposition";

describe("the disposition scale", () => {
  it("Given a stored value, Then only the four dispositions read as themselves and anything else is neutral", () => {
    expect(readStanding("pin")).toBe("pin");
    expect(readStanding("discarded")).toBe("discarded");
    expect(readStanding(undefined)).toBe("neutral");
    expect(readStanding("neutral")).toBe("neutral");
    expect(readStanding("banana")).toBe("neutral");
  });

  it("Given a standing, Then neutral is written as nothing and the rest as themselves", () => {
    expect(storedValue("neutral")).toBeNull();
    expect(storedValue("keep")).toBe("keep");
  });

  it("Given every standing, Then each has one label and one verb, and every drawn one a word", () => {
    for (const standing of SCALE) {
      expect(LABEL[standing]).not.toBe("");
      expect(DONE[standing]).not.toBe("");
    }
    expect(MARK.neutral).toBeUndefined();
    expect(MARK.pin).toBe("pinned");
  });
});

describe("a step along the scale", () => {
  const walk = (from: Standing, direction: "left" | "right", times: number) =>
    Array.from({ length: times }).reduce<Standing>(
      (at) => step(at, direction),
      from,
    );

  it("Given a neutral block, When stepped right twice, Then it is kept and then pinned, and the end stays", () => {
    expect(walk("neutral", "right", 1)).toBe("keep");
    expect(walk("neutral", "right", 2)).toBe("pin");
    expect(walk("neutral", "right", 5)).toBe("pin");
  });

  it("Given a kept or pinned block, When stepped left, Then it returns to neutral before it is resolved", () => {
    expect(step("pin", "left")).toBe("neutral");
    expect(step("keep", "left")).toBe("neutral");
    expect(walk("pin", "left", 2)).toBe("resolved");
  });

  it("Given a resolved or discarded block, When stepped right, Then it reopens to neutral before it is kept", () => {
    expect(step("resolved", "right")).toBe("neutral");
    expect(step("discarded", "right")).toBe("neutral");
    expect(walk("discarded", "left", 3)).toBe("discarded");
  });
});

describe("what the swipe's thresholds reach", () => {
  it("Given a neutral block, Then right reaches keep then pin, and left reaches resolve then discard", () => {
    expect(swipeTargets("neutral", "right")).toEqual(["keep", "pin"]);
    expect(swipeTargets("neutral", "left")).toEqual(["resolved", "discarded"]);
  });

  it("Given any block, Then discard is only ever the far threshold's", () => {
    for (const standing of SCALE) {
      const [near] = swipeTargets(standing, "left");
      if (standing !== "discarded") expect(near).not.toBe("discarded");
    }
  });

  it("Given a resolved block, When swiped right, Then the near threshold reopens it before keep is offered", () => {
    expect(swipeTargets("resolved", "right")).toEqual(["neutral", "keep"]);
  });

  it("Given a kept or pinned block, When swiped left, Then the near threshold returns it to neutral", () => {
    expect(swipeTargets("pin", "left")).toEqual(["neutral", "resolved"]);
    expect(swipeTargets("keep", "left")).toEqual(["neutral", "resolved"]);
  });

  it("Given a pinned block, When swiped right, Then nothing moves against the finger", () => {
    expect(swipeTargets("pin", "right")).toEqual(["pin", "pin"]);
  });
});
