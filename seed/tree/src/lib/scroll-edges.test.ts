import { describe, expect, it } from "vitest";

import { moreBeyond } from "./scroll-edges";

/**
 * What lies beyond a scrolling row's ends, which the view bar and the run chip
 * line both fade from: the row scrolls as one, so an end is the only thing
 * that says there is more. CA_0060_002 CA_0062_003
 */
describe("what lies beyond a scrolling row's ends", () => {
  it("says there is nothing beyond a row whose content fits", () => {
    expect(moreBeyond(0, 300, 300)).toEqual({ start: false, end: false });
  });

  it("says there is more ahead from the start of a row that overflows", () => {
    expect(moreBeyond(0, 1200, 360)).toEqual({ start: false, end: true });
  });

  it("says there is more both ways in the middle", () => {
    expect(moreBeyond(400, 1200, 360)).toEqual({ start: true, end: true });
  });

  it("says there is more behind only, at the end", () => {
    expect(moreBeyond(840, 1200, 360)).toEqual({ start: true, end: false });
  });

  it("holds a pixel of slack, since a scroll position is fractional", () => {
    expect(moreBeyond(0.5, 1200.5, 1200)).toEqual({ start: false, end: false });
  });
});
