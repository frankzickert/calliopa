import { describe, expect, it } from "vitest";

import { clippedBounds, roomFor } from "./agent-menu";

/**
 * Where the agent list opens, and how tall it may be (`BO_0273_036`).
 *
 * It opened upward always, which was right in the composer at the foot of the
 * page and wrong on a block: a chip near the top pushed the list off the
 * screen, and the models made the list long enough for that to happen on most
 * blocks. The rule is pure, so it is proven without a browser; the component
 * applies what it answers.
 */
const screen = { top: 0, bottom: 800, left: 0, right: 1000 };

describe("where the agent list opens", () => {
  it("opens upward from a chip low on the page, as the composer always did", () => {
    expect(roomFor({ top: 700, bottom: 728, left: 20 }, 300, screen).side).toBe("above");
  });

  it("opens downward from a chip near the top, where upward would leave the screen", () => {
    const held = roomFor({ top: 40, bottom: 68, left: 20 }, 300, screen);
    expect(held.side).toBe("below");
    expect(held.room).toBe(724);
  });

  it("never asks for more room than the side it opens on has", () => {
    // A chip 200px down: 192 above, 572 below. It opens below and takes 572.
    expect(roomFor({ top: 200, bottom: 220, left: 20 }, 300, screen).room).toBe(572);
  });

  it("keeps a floor, so a chip with almost no room still shows something to scroll", () => {
    expect(roomFor({ top: 10, bottom: 790, left: 20 }, 300, screen).room).toBe(120);
  });

  it("hangs from the right when opening left would cross the edge", () => {
    expect(roomFor({ top: 400, bottom: 428, left: 20 }, 300, screen).from).toBe("left");
    expect(roomFor({ top: 400, bottom: 428, left: 820 }, 300, screen).from).toBe("right");
  });
});

/**
 * The room is measured to the edge that clips the list (`CA_0081`). The list
 * hangs inside the region the document scrolls in, and that region clips it;
 * above a chip near the top of a document the window still has the header and
 * the document's bar, which are no room at all.
 */
describe("the room is measured to the edge that clips the list", () => {
  // The document's region starts under a 360px header and bar.
  const region = { top: 360, bottom: 800, left: 0, right: 1000 };

  it("opens downward from a chip near the top of its region, though the window has more above", () => {
    // 492 above in the window, 272 below; but only 132 above inside the region.
    const held = roomFor({ top: 500, bottom: 520, left: 20 }, 300, region);
    expect(held.side).toBe("below");
    expect(held.room).toBe(272);
  });

  it("still opens upward from a chip at the foot of its region", () => {
    const held = roomFor({ top: 740, bottom: 760, left: 20 }, 300, region);
    expect(held.side).toBe("above");
    expect(held.room).toBe(372);
  });

  it("hangs from the right when opening left would cross the region's right edge", () => {
    const narrow = { top: 0, bottom: 800, left: 0, right: 600 };
    expect(roomFor({ top: 400, bottom: 428, left: 320 }, 300, narrow).from).toBe("right");
  });

  it("bounds the list by the window and every region that clips it", () => {
    const window = { top: 0, bottom: 800, left: 0, right: 1000 };
    const clips = [
      { top: 360, bottom: 900, left: 0, right: 1000 },
      { top: 100, bottom: 780, left: 240, right: 1200 },
    ];
    expect(clippedBounds(window, clips)).toEqual({ top: 360, bottom: 780, left: 240, right: 1000 });
  });

  it("is the window when nothing clips the list", () => {
    const window = { top: 0, bottom: 800, left: 0, right: 1000 };
    expect(clippedBounds(window, [])).toEqual(window);
  });
});
