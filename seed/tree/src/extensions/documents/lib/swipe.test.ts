import { describe, expect, it } from "vitest";

import {
  startsAtEdge,
  SWIPE,
  swipeOutcome,
  swipeReveal,
  swipeTarget,
  thresholds,
  type SwipeTable,
} from "./swipe";

describe("where the threshold falls", () => {
  it("Given the 172px column a phone measured, Then the floor holds, not the proportion", () => {
    expect(thresholds(172, 390).commit).toBe(SWIPE.min);
  });

  it("Given a full-width row on a 414px phone, Then the proportion rises above the floor and stays inside the screen", () => {
    const limits = thresholds(414, 414);
    expect(limits.commit).toBeCloseTo(414 * SWIPE.fraction);
    expect(limits.commit).toBeLessThanOrEqual(414 * SWIPE.ofViewport);
  });

  it("Given a wide desktop column, Then the ceiling keeps the travel a thumb can make", () => {
    expect(thresholds(1400, 1600).commit).toBe(SWIPE.max);
  });

  it("Given a narrow screen, Then the threshold stays inside a thumb's reach even below its floor", () => {
    expect(thresholds(600, 150).commit).toBe(150 * SWIPE.ofViewport);
  });

  it("Given the distance in use, Then it sits between the two the five-position scale had", () => {
    // 18% floored at 64px and 55% floored at 200px were the near and far
    // thresholds of `BO_0138`; with one action each way there is one
    // distance, between them. BO_0272_007
    expect(SWIPE.fraction).toBeGreaterThan(0.18);
    expect(SWIPE.fraction).toBeLessThan(0.55);
    expect(SWIPE.min).toBeGreaterThan(64);
    expect(SWIPE.min).toBeLessThan(200);
  });

  it("Given a press within the edge guard, Then it is the system's back gesture and not a swipe", () => {
    expect(startsAtEdge(SWIPE.edgeGuard - 1, 400)).toBe(true);
    expect(startsAtEdge(400 - SWIPE.edgeGuard + 1, 400)).toBe(true);
    expect(startsAtEdge(200, 400)).toBe(false);
  });
});

/** The table is a value, so another one is configuration rather than a
 * rewrite: every function takes it. BO_0272_007 */
describe("another table", () => {
  const short: SwipeTable = { ...SWIPE, fraction: 0.1, min: 20, max: 40, edgeGuard: 2 };

  it("Given a table of its own, Then the threshold and the edge guard follow it", () => {
    expect(thresholds(414, 414, short).commit).toBe(40);
    expect(startsAtEdge(3, 400, short)).toBe(false);
    expect(startsAtEdge(3, 400)).toBe(true);
  });

  it("Given a threshold made with one table, Then the flick it allows is that table's", () => {
    const limits = thresholds(414, 414, { ...short, flickVelocity: 10 });
    expect(swipeOutcome("keep", -limits.commit * 0.7, limits, -3)).toBe("keep");
    expect(swipeOutcome("keep", -limits.commit * 0.7, thresholds(414, 414, short), -3)).toBe("discarded");
  });
});

describe("a swipe walked out on a 414px phone", () => {
  const limits = thresholds(414, 414);

  it("Given travel in 30px steps to the left, Then nothing is committed before the threshold and discard at it", () => {
    const walked = [30, 60, 90, 120, 150, 180, 210].map((distance) =>
      swipeTarget("keep", -distance, limits),
    );
    expect(walked.slice(0, 4)).toEqual(["keep", "keep", "keep", "keep"]);
    expect(walked.at(-1)).toBe("discarded");
    // One action each way: nothing on the way to discard is committed on the
    // way, and nothing lies beyond it.
    expect(new Set(walked)).toEqual(new Set(["keep", "discarded"]));
  });

  it("Given travel to the right at the threshold, Then the block is fixated", () => {
    expect(swipeTarget("keep", limits.commit - 1, limits)).toBe("keep");
    expect(swipeTarget("keep", limits.commit, limits)).toBe("fixate");
  });

  it("Given a swipe back from either end, Then it returns to keep", () => {
    expect(swipeTarget("fixate", -limits.commit, limits)).toBe("keep");
    expect(swipeTarget("discarded", limits.commit, limits)).toBe("keep");
  });

  it("Given a reversal back short of the threshold, Then release commits nothing", () => {
    expect(swipeOutcome("keep", limits.commit - 1, limits, 0)).toBe("keep");
  });
});

describe("what the reveal names", () => {
  const limits = thresholds(414, 414);

  // Naming the action only once armed left the reader swiping at nothing
  // until it appeared, on a phone where the strip is narrow. BO_0272_016
  it("Given the first movement, Then the action is already named, and not yet armed", () => {
    expect(swipeReveal("keep", -4, limits)).toEqual({
      action: "discarded",
      armed: false,
    });
    expect(swipeReveal("keep", 4, limits)).toEqual({
      action: "fixate",
      armed: false,
    });
  });

  it("Given travel at the threshold, Then the same action is armed", () => {
    expect(swipeReveal("keep", -limits.commit, limits)).toEqual({
      action: "discarded",
      armed: true,
    });
    expect(swipeReveal("keep", limits.commit + 5, limits)).toEqual({
      action: "fixate",
      armed: true,
    });
  });

  it("Given no movement at all, Then nothing is named", () => {
    expect(swipeReveal("keep", 0, limits)).toEqual({ action: null, armed: false });
  });

  it("Given a fixated block swiped right, Then nothing is named at any distance, since nothing would change", () => {
    for (const offset of [2, limits.commit, limits.commit + 200]) {
      expect(swipeReveal("fixate", offset, limits)).toEqual({
        action: null,
        armed: false,
      });
    }
  });
});

describe("a flick", () => {
  const limits = thresholds(414, 414);

  it("Given a fast release most of the way to the threshold, Then the action commits", () => {
    expect(swipeOutcome("keep", -limits.commit * 0.7, limits, -1.2)).toBe(
      "discarded",
    );
    expect(swipeOutcome("keep", limits.commit * 0.7, limits, 1.2)).toBe(
      "fixate",
    );
  });

  it("Given a fast release travelling back towards keep, Then it commits nothing", () => {
    expect(swipeOutcome("keep", -limits.commit * 0.7, limits, 1.2)).toBe(
      "keep",
    );
  });

  it("Given a slow release short of the threshold, Then it commits nothing", () => {
    expect(swipeOutcome("keep", -limits.commit * 0.7, limits, -0.2)).toBe(
      "keep",
    );
  });
});
