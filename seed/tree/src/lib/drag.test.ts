import { describe, expect, it } from "vitest";
import {
  DRAG_MOVE_TOLERANCE_PX,
  EDGE_SCROLL_MAX_PX,
  EDGE_SCROLL_ZONE_PX,
  edgeScroll,
  holdOver,
  inMiddle,
  LONG_PRESS_MS,
  movedDistance,
  pointerIntent,
  PANEL_ICON_KIND,
  resolveDrop,
  resolveOperation,
  SPRING_HOLD_MS,
  springAction,
  springDue,
  springRepeats,
  springs,
  SWIPE_LOCK_PX,
  BACK_GESTURE_EDGE_PX,
  TAB_SWIPE_PX,
  tabSwipeStep,
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
  source: "panel",
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

describe("scrolling while dragging", () => {
  it("Given a pointer in the middle of the area, Then nothing scrolls", () => {
    expect(edgeScroll(400, 100, 700)).toBe(0);
  });

  it("Given a pointer near the top or the bottom, Then the area scrolls that way, faster the nearer the edge", () => {
    const near = edgeScroll(100 + EDGE_SCROLL_ZONE_PX - 10, 100, 700);
    const nearer = edgeScroll(105, 100, 700);
    expect(near).toBeLessThan(0);
    expect(nearer).toBeLessThan(near);
    expect(edgeScroll(700 - 5, 100, 700)).toBeGreaterThan(edgeScroll(700 - EDGE_SCROLL_ZONE_PX + 10, 100, 700));
    expect(edgeScroll(700 - 5, 100, 700)).toBeGreaterThan(0);
  });

  it("Given a pointer past the edge, over the header or the dock, Then it scrolls at full speed", () => {
    expect(edgeScroll(20, 100, 700)).toBe(-EDGE_SCROLL_MAX_PX);
    expect(edgeScroll(900, 100, 700)).toBe(EDGE_SCROLL_MAX_PX);
  });

  it("Given a short area, Then its zone is a quarter of it and a middle still scrolls nothing", () => {
    expect(edgeScroll(150, 100, 200)).toBe(0);
    expect(edgeScroll(110, 100, 200)).toBeLessThan(0);
    expect(edgeScroll(100, 100, 100)).toBe(0);
  });
});

describe("a swipe on the phone's Minimum header", () => {
  const swipe = (dx: number, dy = 0, x = 180, pointerType = "touch") =>
    tabSwipeStep({ pointerType, from: { x, y: 20 }, to: { x: x + dx, y: 20 + dy }, width: 360 });

  it("steps to the next tab when the line moves left and the previous when it moves right", () => {
    expect(swipe(-TAB_SWIPE_PX)).toBe(1);
    expect(swipe(TAB_SWIPE_PX)).toBe(-1);
  });

  it("switches nothing short of the threshold, mostly downward, under a mouse, or from an edge zone", () => {
    expect(swipe(-(TAB_SWIPE_PX - 1))).toBe(0);
    expect(swipe(-60, 50)).toBe(0);
    expect(swipe(-60, 0, 180, "mouse")).toBe(0);
    expect(swipe(60, 0, BACK_GESTURE_EDGE_PX - 1)).toBe(0);
    expect(swipe(-60, 0, 360 - BACK_GESTURE_EDGE_PX + 1)).toBe(0);
  });
});

/** A library icon lands only on the icon column, and nothing else does. CA_0068_008 */
describe("a library icon's drop", () => {
  const icon: DragPayload = {
    itemId: "publishing",
    kind: PANEL_ICON_KIND,
    source: "panel",
    operations: ["move"],
    preview: "Publish",
  };
  const column: DropTarget = { id: "panel-icon:documents", accepts: ["move"] };
  const end: DropTarget = { id: "panel-icon:end", accepts: ["move"] };
  const strip: DropTarget = { id: "tab:t1", accepts: ["move", "open-in-tab"] };

  it("Given an icon over the column, Then it moves", () => {
    expect(resolveDrop(icon, column)).toBe("move");
    expect(resolveDrop(icon, end)).toBe("move");
  });

  it("Given an icon over a tab, or a tab over the column, Then nothing lands", () => {
    expect(resolveDrop(icon, strip)).toBeNull();
    expect(resolveDrop(tab, column)).toBeNull();
    expect(resolveDrop(tab, strip)).toBe("move");
  });
});

describe("a held drag opens the place it is held over", () => {
  const block: DragPayload = {
    itemId: "blk-1",
    kind: "documents:document",
    source: "workspace",
    operations: ["move"],
    preview: "A block",
    from: "doc-1",
  };

  it("springs for what is dragged out of a view, never for a tab or a library icon", () => {
    expect(springs(block)).toBe(true);
    expect(springs(tab)).toBe(false);
    expect(springs({ ...tab, kind: PANEL_ICON_KIND, source: "panel" })).toBe(false);
    expect(springs(null)).toBe(false);
  });

  it("opens after the hold and not before", () => {
    const hold = holdOver(null, "tab:b", 1000);
    expect(springDue(hold, 1000 + SPRING_HOLD_MS - 1)).toBe(false);
    expect(springDue(hold, 1000 + SPRING_HOLD_MS)).toBe(true);
    expect(springDue(hold, 1000 + SPRING_HOLD_MS + 500)).toBe(true);
  });

  it("keeps its start while the pointer stays, and a leave or another place starts again", () => {
    const hold = holdOver(null, "tab:b", 1000);
    expect(holdOver(hold, "tab:b", 1400)).toBe(hold);
    expect(holdOver(hold, null, 1400)).toBeNull();
    const moved = holdOver(hold, "tab:c", 1400);
    expect(moved).toEqual({ id: "tab:c", since: 1400 });
    expect(springDue(moved, 1000 + SPRING_HOLD_MS)).toBe(false);
    expect(springDue(holdOver(null, "tab:b", 1500), 1000 + SPRING_HOLD_MS)).toBe(false);
  });

  it("opens once: a hold that opened its place is not due again", () => {
    expect(springDue({ id: "tab:b", since: null }, 1_000_000)).toBe(false);
    expect(springDue(null, 1_000_000)).toBe(false);
  });
});

describe("what a held place opens", () => {
  it("names a tab, a step, the sheet, an icon's content or an entry's document", () => {
    expect(springAction("tab:documents-d1")).toEqual({ open: "tab", tabId: "documents-d1" });
    expect(springAction("tab-edge:before")).toEqual({ open: "step", step: -1 });
    expect(springAction("tab-edge:after")).toEqual({ open: "step", step: 1 });
    expect(springAction("library-handle")).toEqual({ open: "sheet" });
    expect(springAction("library-icon:documents")).toEqual({ open: "icon", icon: "documents" });
    expect(springAction("library:doc-7")).toEqual({ open: "entry", itemId: "doc-7" });
    expect(springAction("tab:")).toBeNull();
    expect(springAction("block:b1")).toBeNull();
  });

  it("repeats on a tab edge only", () => {
    expect(springRepeats("tab-edge:after")).toBe(true);
    expect(springRepeats("tab:documents-d1")).toBe(false);
    expect(springRepeats("library:doc-7")).toBe(false);
  });
});

describe("a target's middle", () => {
  it("is the middle half of its height, the quarters above and below its edges", () => {
    expect(inMiddle(100, 100, 40)).toBe(false);
    expect(inMiddle(109, 100, 40)).toBe(false);
    expect(inMiddle(110, 100, 40)).toBe(true);
    expect(inMiddle(120, 100, 40)).toBe(true);
    expect(inMiddle(130, 100, 40)).toBe(true);
    expect(inMiddle(131, 100, 40)).toBe(false);
    expect(inMiddle(120, 100, 0)).toBe(false);
  });
});
