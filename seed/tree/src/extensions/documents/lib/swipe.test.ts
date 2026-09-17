import { describe, expect, it } from "vitest";

import {
  EDGE_GUARD,
  FAR_MIN,
  NEAR_MIN,
  startsAtEdge,
  swipeOutcome,
  swipeReveal,
  swipeTarget,
  thresholds,
} from "./swipe";

describe("where the thresholds fall", () => {
  it("Given the 172px column a phone measured, Then the floors hold, not the proportions", () => {
    expect(thresholds(172, 390)).toEqual({ near: NEAR_MIN, far: FAR_MIN });
  });

  it("Given a full-width row on a 414px phone, Then the proportions rise above the floors and far stays inside the screen", () => {
    const limits = thresholds(414, 414);
    expect(limits.near).toBeCloseTo(414 * 0.18);
    expect(limits.far).toBeCloseTo(414 * 0.55);
    expect(limits.far).toBeLessThanOrEqual(414 * 0.72);
  });

  it("Given a wide desktop column, Then the ceilings keep the travel a thumb can make", () => {
    expect(thresholds(1400, 1600)).toEqual({ near: 120, far: 380 });
  });

  it("Given a narrow screen, Then the far threshold stays inside a thumb's reach even below its floor", () => {
    expect(thresholds(600, 250).far).toBe(250 * 0.72);
  });

  it("Given a press within the edge guard, Then it is the system's back gesture and not a swipe", () => {
    expect(startsAtEdge(EDGE_GUARD - 1, 400)).toBe(true);
    expect(startsAtEdge(400 - EDGE_GUARD + 1, 400)).toBe(true);
    expect(startsAtEdge(200, 400)).toBe(false);
  });
});

describe("a swipe walked out on a 414px phone", () => {
  const limits = thresholds(414, 414);

  it("Given travel in 30px steps to the left, Then resolve holds between the thresholds and discard begins at the far one", () => {
    const walked = [30, 60, 90, 120, 150, 180, 210, 240, 270].map((distance) =>
      swipeTarget("neutral", -distance, limits),
    );
    expect(walked.slice(0, 2)).toEqual(["neutral", "neutral"]);
    expect(
      walked.filter((standing) => standing === "resolved").length,
    ).toBeGreaterThan(3);
    expect(walked.at(-1)).toBe("discarded");
    expect(walked.indexOf("discarded")).toBeGreaterThan(
      walked.indexOf("resolved"),
    );
  });

  it("Given travel to the right past both thresholds, Then keep, then pin", () => {
    expect(swipeTarget("neutral", limits.near, limits)).toBe("keep");
    expect(swipeTarget("neutral", limits.far, limits)).toBe("pin");
  });

  it("Given a reversal back inside the neutral zone, Then release commits nothing", () => {
    expect(swipeOutcome("neutral", limits.near - 1, limits, 0)).toBe("neutral");
  });
});

describe("what the reveal names", () => {
  const limits = thresholds(414, 414);

  it("Given travel inside the neutral zone, Then nothing is armed and the near action lies ahead", () => {
    expect(swipeReveal("neutral", -20, limits)).toEqual({
      armed: null,
      further: "resolved",
    });
  });

  it("Given travel between the thresholds, Then the near action is armed and the far one named beyond it", () => {
    expect(swipeReveal("neutral", -(limits.near + 5), limits)).toEqual({
      armed: "resolved",
      further: "discarded",
    });
  });

  it("Given travel past the far threshold, Then only the far action is named", () => {
    expect(swipeReveal("neutral", limits.far + 5, limits)).toEqual({
      armed: "pin",
      further: null,
    });
  });

  it("Given a pinned block swiped right, Then nothing is named, since nothing would change", () => {
    expect(swipeReveal("pin", limits.far + 5, limits)).toEqual({
      armed: null,
      further: null,
    });
  });
});

describe("a flick", () => {
  const limits = thresholds(414, 414);

  it("Given a fast release most of the way to the near threshold, Then the near action commits", () => {
    expect(swipeOutcome("neutral", -limits.near * 0.7, limits, -1.2)).toBe(
      "resolved",
    );
  });

  it("Given a fast release at the near threshold, Then the near action commits and never the far one", () => {
    expect(swipeOutcome("neutral", -limits.near, limits, -3)).toBe("resolved");
    expect(swipeOutcome("neutral", limits.near + 1, limits, 3)).toBe("keep");
  });

  it("Given a fast release travelling back towards neutral, Then it commits nothing", () => {
    expect(swipeOutcome("neutral", -limits.near * 0.7, limits, 1.2)).toBe(
      "neutral",
    );
  });

  it("Given a slow release short of the near threshold, Then it commits nothing", () => {
    expect(swipeOutcome("neutral", -limits.near * 0.7, limits, -0.2)).toBe(
      "neutral",
    );
  });
});
