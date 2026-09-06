import { describe, expect, it } from "vitest";
import {
  DRAG_MOVE_TOLERANCE_PX,
  LONG_PRESS_MS,
  movedDistance,
  pointerIntent,
  resolveOperation,
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
