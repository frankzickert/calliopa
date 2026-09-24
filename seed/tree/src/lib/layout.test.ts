import { describe, expect, it } from "vitest";
import {
  clampPanelWidth,
  contentIcon,
  defaultPanelWidth,
  draggedPanelWidth,
  iconDropBefore,
  movedIconOrder,
  orderedIcons,
  PANEL_WIDTH_SCRIPT,
  PANEL_WIDTH_STORAGE_KEY,
  panelBounds,
  panelDraw,
  parsePanelWidth,
  pressClosesSheet,
  pressHandle,
  pressIcon,
  readPanel,
  resizeKey,
  shownIcon,
  stepPanelWidth,
  togglePanel,
} from "./layout";

/** A panel's icon column and the header's control, as rules. CA_0056_005 */
describe("a panel", () => {
  const icons = ["documents", "publishing", "ui.shell"];

  it("Given a press on an icon, Then its content shows alone, and a second press leaves the icon column", () => {
    const shown = pressIcon({ shown: true }, icons, "publishing", false);
    expect(shown).toEqual({ shown: true, icon: "publishing" });
    expect(shownIcon(shown, icons)).toBe("publishing");
    const small = pressIcon(shown, icons, "publishing", false);
    expect(panelDraw(small)).toBe("small");
    expect(shownIcon(small, icons)).toBeNull();
    expect(pressIcon(small, icons, "documents", false)).toEqual({ shown: true, icon: "documents" });
  });

  it("Given a press on the shown icon in a phone's sheet, Then the sheet closes and the panel stays", () => {
    const panel = { shown: true, icon: "ui.shell" };
    expect(pressClosesSheet(panel, icons, "ui.shell", true)).toBe(true);
    expect(pressClosesSheet(panel, icons, "documents", true)).toBe(false);
    expect(pressClosesSheet(panel, icons, "ui.shell", false)).toBe(false);
    expect(pressClosesSheet({ shown: true, icon: null }, icons, "documents", true)).toBe(false);
  });

  it("Given a press on the handle of the open sheet, Then it closes, and any other handle opens its own", () => {
    expect(pressHandle("left", "left")).toBe(null);
    expect(pressHandle("right", "right")).toBe(null);
    expect(pressHandle("left", "right")).toBe("right");
    expect(pressHandle(null, "left")).toBe("left");
  });

  it("Given a press on the shown icon in a phone's sheet, Then the panel keeps its content", () => {
    expect(pressIcon({ shown: true, icon: "ui.shell" }, icons, "ui.shell", true)).toEqual({
      shown: true,
      icon: "ui.shell",
    });
    expect(pressIcon({ shown: true, icon: "ui.shell" }, icons, "documents", true)).toEqual({
      shown: true,
      icon: "documents",
    });
  });

  it("Given the small mode, Then only a phone's sheet carries content, the first icon's", () => {
    expect(shownIcon({ shown: true, icon: null }, icons)).toBeNull();
    expect(contentIcon({ shown: true, icon: null }, icons)).toBe("documents");
  });

  it("Given no icon or one nothing answers to, Then the panel shows its first", () => {
    expect(shownIcon({ shown: true }, icons)).toBe("documents");
    expect(shownIcon({ shown: true, icon: "calliopa-video" }, icons)).toBe("documents");
    expect(shownIcon({ shown: true }, [])).toBeNull();
  });

  it("Given the header's control, Then the panel hides and comes back with what it had", () => {
    const hidden = togglePanel({ shown: true, icon: "publishing" });
    expect(panelDraw(hidden)).toBe("hidden");
    expect(togglePanel(hidden)).toEqual({ shown: true, icon: "publishing" });
    expect(panelDraw(togglePanel(togglePanel({ shown: true, icon: null })))).toBe("small");
  });

  it("Given a panel stored as a drawer state, Then it reads as the panel it meant", () => {
    expect(readPanel("expanded")).toEqual({ shown: true });
    expect(readPanel("compact")).toEqual({ shown: true, icon: null });
    expect(readPanel("hidden")).toEqual({ shown: false });
    expect(readPanel({ shown: false, icon: "publishing" })).toEqual({ shown: false, icon: "publishing" });
    expect(readPanel("wide")).toBeUndefined();
    expect(readPanel({ icon: "x" })).toBeUndefined();
  });
});

/** A panel's width at its inner border, as rules. CA_0066_001 */
describe("a panel's width", () => {
  const rem = 16;
  // 1280 wide, the other panel hidden: 1280 - 0 - 48 - 320.
  const bounds = panelBounds(1280, 0, rem);

  it("Given nothing dragged, Then each panel has the width it always had", () => {
    expect(defaultPanelWidth("left", rem)).toBe(256);
    expect(defaultPanelWidth("right", rem)).toBe(288);
  });

  it("Given a viewport and the other panel's column, Then the bounds leave the workspace its room", () => {
    expect(bounds).toEqual({ min: 160, max: 912 });
    expect(panelBounds(1280, 336, rem)).toEqual({ min: 160, max: 576 });
    expect(panelBounds(600, 336, rem), "never below the minimum, however little room").toEqual({ min: 160, max: 160 });
  });

  it("Given a drag past either bound, Then the width stops at it", () => {
    expect(clampPanelWidth(100, bounds)).toBe(160);
    expect(clampPanelWidth(2000, bounds)).toBe(912);
    expect(clampPanelWidth(300.4, bounds)).toBe(300);
    expect(draggedPanelWidth("left", 256, -200, bounds), "the library dragged left narrows and stops").toBe(160);
  });

  it("Given a drag toward the workspace, Then the panel widens, on either side", () => {
    expect(draggedPanelWidth("left", 256, 40, bounds)).toBe(296);
    expect(draggedPanelWidth("left", 256, -40, bounds)).toBe(216);
    expect(draggedPanelWidth("right", 288, 40, bounds), "the inspector's border dragged right narrows it").toBe(248);
    expect(draggedPanelWidth("right", 288, -40, bounds)).toBe(328);
  });

  it("Given a key on the separator, Then the arrow toward the workspace widens, the other narrows, and Enter resets", () => {
    expect(resizeKey("left", "ArrowRight")).toBe("wider");
    expect(resizeKey("left", "ArrowLeft")).toBe("narrower");
    expect(resizeKey("right", "ArrowLeft")).toBe("wider");
    expect(resizeKey("right", "ArrowRight")).toBe("narrower");
    expect(resizeKey("left", "Enter")).toBe("reset");
    expect(resizeKey("left", "Tab")).toBeNull();
    expect(stepPanelWidth(256, "wider", bounds)).toBe(272);
    expect(stepPanelWidth(256, "narrower", bounds)).toBe(240);
    expect(stepPanelWidth(165, "narrower", bounds), "a step stops at the bound too").toBe(160);
  });

  it("Given a stored width, Then a positive number of px reads and anything else is the default", () => {
    expect(parsePanelWidth("300")).toBe(300);
    expect(parsePanelWidth("300.6")).toBe(301);
    expect(parsePanelWidth(null)).toBeNull();
    expect(parsePanelWidth("")).toBeNull();
    expect(parsePanelWidth("wide")).toBeNull();
    expect(parsePanelWidth("-20")).toBeNull();
    expect(parsePanelWidth("0")).toBeNull();
  });

  it("is applied before paint from the same keys, with the same reading", () => {
    const run = (stored: Record<string, string | null>) => {
      const set = new Map<string, string>();
      new Function("localStorage", "document", PANEL_WIDTH_SCRIPT)(
        { getItem: (key: string) => stored[key] ?? null },
        { documentElement: { style: { setProperty: (name: string, value: string) => set.set(name, value) } } },
      );
      return Object.fromEntries(set);
    };
    expect(run({})).toEqual({});
    expect(run({ [`${PANEL_WIDTH_STORAGE_KEY}.left`]: "300", [`${PANEL_WIDTH_STORAGE_KEY}.right`]: "wide" })).toEqual({
      "--left-content": "300px",
    });
    expect(run({ [`${PANEL_WIDTH_STORAGE_KEY}.right`]: "200.4" })).toEqual({ "--right-content": "200px" });
  });
});

/** The library's icons in the reader's order, and a drop's new order. CA_0068_005 */
describe("the library's icon order", () => {
  const icons = [{ id: "documents" }, { id: "publishing" }, { id: "ui.shell" }];
  const ids = (list: readonly { id: string }[]) => list.map((icon) => icon.id);

  it("Given no stored order, Then the icons stand in contribution order", () => {
    expect(ids(orderedIcons(icons, []))).toEqual(["documents", "publishing", "ui.shell"]);
  });

  it("Given a stored order, Then it comes first, a newly contributing icon joins at the end, and a gone or repeated id is passed over", () => {
    expect(ids(orderedIcons(icons, ["ui.shell", "documents"]))).toEqual(["ui.shell", "documents", "publishing"]);
    expect(ids(orderedIcons(icons, ["gone", "publishing", "publishing"]))).toEqual([
      "publishing",
      "documents",
      "ui.shell",
    ]);
  });

  it("Given a drop over an icon, Then its upper half lands before it and its lower half before the next, or at the end", () => {
    const order = ["documents", "publishing", "ui.shell"];
    expect(iconDropBefore(order, "publishing", false)).toBe("publishing");
    expect(iconDropBefore(order, "publishing", true)).toBe("ui.shell");
    expect(iconDropBefore(order, "ui.shell", true)).toBeNull();
  });

  it("Given an icon dropped before another or at the end, Then it moves there and the rest keep their order", () => {
    const order = ["documents", "publishing", "ui.shell"];
    expect(movedIconOrder(order, "ui.shell", "documents")).toEqual(["ui.shell", "documents", "publishing"]);
    expect(movedIconOrder(order, "documents", null)).toEqual(["publishing", "ui.shell", "documents"]);
    expect(movedIconOrder(order, "documents", "ui.shell")).toEqual(["publishing", "documents", "ui.shell"]);
  });

  it("Given a drop onto the icon's own place or of an icon the column does not hold, Then the order is unchanged", () => {
    const order = ["documents", "publishing", "ui.shell"];
    expect(movedIconOrder(order, "publishing", "publishing")).toEqual(order);
    expect(movedIconOrder(order, "publishing", "ui.shell")).toEqual(order);
    expect(movedIconOrder(order, "gone", "documents")).toEqual(order);
    expect(movedIconOrder(order, "documents", "gone")).toEqual(order);
  });
});
