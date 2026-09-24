import { describe, expect, it } from "vitest";

import { roomFor } from "./agent-menu";

/**
 * Where the agent list opens, and how tall it may be (`BO_0273_036`).
 *
 * It opened upward always, which was right in the composer at the foot of the
 * page and wrong on a block: a chip near the top pushed the list off the
 * screen, and the models made the list long enough for that to happen on most
 * blocks. The rule is pure, so it is proven without a browser; the component
 * applies what it answers.
 */
const screen = { width: 1000, height: 800 };

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
