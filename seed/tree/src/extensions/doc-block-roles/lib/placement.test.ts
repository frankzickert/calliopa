import { describe, expect, it } from "vitest";

import { placePopover, type Box } from "./placement";

/**
 * The popover above the phone width (`RO_0004_001`): below its chip, or above
 * it where the room below is smaller than the room above; its height capped
 * to the room on that side; shifted along the line so it stays inside the
 * frame.
 */
const frame: Box = { top: 0, left: 0, right: 1280, bottom: 800 };
const chip = (top: number, left: number, width = 80, height = 24): Box => ({ top, left, right: left + width, bottom: top + height });

describe("placePopover", () => {
  it("opens below a chip near the top, its height capped to the room below", () => {
    const place = placePopover({ chip: chip(100, 600), frame, width: 352, align: "start" });
    expect(place.side).toBe("below");
    expect(place.top).toBe(100 + 24 + 6);
    expect(place.bottom).toBeNull();
    expect(place.maxHeight).toBe(800 - 8 - (100 + 24 + 6));
    expect(place.left).toBe(600);
  });

  it("opens above a chip near the bottom, growing upward from it", () => {
    const place = placePopover({ chip: chip(700, 600), frame, width: 352, align: "start" });
    expect(place.side).toBe("above");
    expect(place.top).toBeNull();
    expect(place.bottom).toBe(800 - (700 - 6));
    expect(place.maxHeight).toBe(700 - 6 - 8);
  });

  it("keeps below when the room is equal on both sides", () => {
    const place = placePopover({ chip: chip(388, 600), frame, width: 352, align: "start" });
    expect(place.side).toBe("below");
  });

  it("ends at the chip's right edge for a chip aligned right, and shifts inside the frame", () => {
    const right = placePopover({ chip: chip(100, 1000), frame, width: 352, align: "end" });
    expect(right.left).toBe(1080 - 352);
    const nearLeft = placePopover({ chip: chip(100, 20), frame, width: 352, align: "end" });
    expect(nearLeft.left).toBe(8);
    const nearRight = placePopover({ chip: chip(100, 1250), frame, width: 352, align: "start" });
    expect(nearRight.left).toBe(1280 - 8 - 352);
  });

  it("measures against a frame that does not start at the window's corner", () => {
    const pane: Box = { top: 48, left: 304, right: 944, bottom: 800 };
    const place = placePopover({ chip: chip(60, 310), frame: pane, width: 352, align: "end" });
    expect(place.left).toBe(304 + 8);
    expect(place.side).toBe("below");
    expect(place.maxHeight).toBe(800 - 8 - (60 + 24 + 6));
  });

  it("narrows to the frame when the frame is narrower than the popover", () => {
    const narrow: Box = { top: 0, left: 0, right: 300, bottom: 800 };
    const place = placePopover({ chip: chip(100, 200), frame: narrow, width: 352, align: "end" });
    expect(place.width).toBe(300 - 16);
    expect(place.left).toBe(8);
  });

  it("stays inside the frame when its chip has scrolled out of it", () => {
    const above = placePopover({ chip: chip(-200, 600), frame, width: 352, align: "start" });
    expect(above.side).toBe("below");
    expect(above.top).toBe(8);
    expect(above.maxHeight).toBe(800 - 16);
    const below = placePopover({ chip: chip(900, 600), frame, width: 352, align: "start" });
    expect(below.side).toBe("above");
    expect(below.bottom).toBe(8);
    expect(below.maxHeight).toBe(800 - 16);
  });
});
