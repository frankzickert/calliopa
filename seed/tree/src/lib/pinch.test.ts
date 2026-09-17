import { describe, expect, it } from "vitest";

import { midpoint, PINCH_THRESHOLD, pinchOutcome, pinchProgress, spread } from "./pinch";

/** The pinch's physics, settled without a browser. CA_0047_006 */
describe("the pinch", () => {
  it("measures the spread and the midpoint of two fingers", () => {
    expect(spread({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 });
  });

  it("opens on a pinch outward (zoom in) past the threshold, goes back on one inward, and does nothing for less", () => {
    expect(pinchOutcome(100, 100 * (1 + PINCH_THRESHOLD))).toBe("open");
    expect(pinchOutcome(100, 180)).toBe("open");
    expect(pinchOutcome(100, 100 * (1 - PINCH_THRESHOLD))).toBe("back");
    expect(pinchOutcome(100, 40)).toBe("back");
    expect(pinchOutcome(100, 90)).toBeNull();
    expect(pinchOutcome(100, 110)).toBeNull();
  });

  it("reports its progress toward the threshold, clamped, for the feedback under the fingers", () => {
    expect(pinchProgress(100, 100)).toBe(0);
    expect(pinchProgress(100, 112.5)).toBeCloseTo(0.5);
    expect(pinchProgress(100, 125)).toBe(1);
    expect(pinchProgress(100, 200)).toBe(1);
    expect(pinchProgress(100, 87.5)).toBeCloseTo(-0.5);
    expect(pinchProgress(100, 10)).toBe(-1);
    expect(pinchProgress(0, 50)).toBe(0);
  });

  it("means nothing when the fingers began together", () => {
    expect(pinchOutcome(0, 50)).toBeNull();
  });
});
