import { describe, expect, it } from "vitest";
import {
  DRAG_MOVE_TOLERANCE_PX,
  LONG_PRESS_MS,
  movedDistance,
  pointerIntent,
  resolveOperation,
  SWIPE_LOCK_PX,
  type DragPayload,
  type DropTarget,
} from "./drag";

const tab: DragPayload = {
  itemId: "placeholder-scene",
  kind: "storyboard",
  source: "tab-strip",
  operations: ["move", "open-in-tab"],
  preview: "Scene board",
};
const failure: DragPayload = {
  itemId: "process-1",
  kind: "process-result",
  source: "dock",
  operations: ["attach-to-command", "process-input"],
  preview: "Render opening",
};
const target = (accepts: DropTarget["accepts"]): DropTarget => ({
  id: "target",
  accepts,
});

describe("drag model", () => {
  it("Given a payload and a target, Then the first mutually supported operation wins", () => {
    expect(resolveOperation(tab, target(["open-in-tab", "move"]))).toBe("move");
    expect(resolveOperation(tab, target(["open-in-tab"]))).toBe("open-in-tab");
    expect(resolveOperation(failure, target(["attach-to-command"]))).toBe(
      "attach-to-command",
    );
  });

  it("Given a target that accepts nothing offered, Then no operation resolves", () => {
    expect(resolveOperation(tab, target(["attach-to-command"]))).toBe(null);
    expect(resolveOperation(failure, target(["move", "copy"]))).toBe(null);
  });

  it("Given a mouse, Then movement past the tolerance begins the drag", () => {
    expect(
      pointerIntent({ pointerType: "mouse", heldMs: 0, movedPx: 40 }),
    ).toBe("drag");
    expect(
      pointerIntent({
        pointerType: "mouse",
        heldMs: 0,
        movedPx: DRAG_MOVE_TOLERANCE_PX,
      }),
    ).toBe("wait");
  });

  it("Given a coarse pointer, Then a held press drags and ordinary movement scrolls", () => {
    expect(
      pointerIntent({
        pointerType: "touch",
        heldMs: LONG_PRESS_MS,
        movedPx: 2,
      }),
    ).toBe("drag");
    expect(
      pointerIntent({ pointerType: "touch", heldMs: 120, movedPx: 40 }),
    ).toBe("scroll");
    expect(
      pointerIntent({ pointerType: "touch", heldMs: 120, movedPx: 2 }),
    ).toBe("wait");
  });

  it("Given two pointer positions, Then the distance is their separation", () => {
    expect(movedDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("a target that offers a swipe", () => {
  const touch = (dx: number, dy: number, heldMs = 60) =>
    pointerIntent({
      pointerType: "touch",
      heldMs,
      movedPx: Math.hypot(dx, dy),
      swipe: { dx, dy },
    });

  it("Given a touch that has barely moved, Then the gesture waits rather than locking early", () => {
    expect(touch(SWIPE_LOCK_PX - 2, 0)).toBe("wait");
  });

  it("Given clearly horizontal travel past the lock, Then it is a swipe, in either direction", () => {
    expect(touch(30, 5)).toBe("swipe");
    expect(touch(-30, 5)).toBe("swipe");
  });

  it("Given travel that is not clearly horizontal, Then vertical wins and the page scrolls", () => {
    expect(touch(20, 18)).toBe("scroll");
    expect(touch(3, 40)).toBe("scroll");
  });

  it("Given a held press, Then it is still the long press, swipe or no swipe", () => {
    expect(touch(0, 0, LONG_PRESS_MS)).toBe("drag");
  });

  it("Given a mouse, Then it never swipes", () => {
    expect(
      pointerIntent({
        pointerType: "mouse",
        heldMs: 0,
        movedPx: 40,
        swipe: { dx: 40, dy: 0 },
      }),
    ).toBe("drag");
  });

  it("Given a target that offers none, Then early horizontal travel still scrolls, as the tab strip always read it", () => {
    expect(
      pointerIntent({ pointerType: "touch", heldMs: 60, movedPx: 30 }),
    ).toBe("scroll");
  });
});
