import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Layout } from "~/lib/layout";
import { DEFAULT_WORKSPACE_STATE } from "~/lib/workspace";
import { PanelHost } from "./testing/panel-host";

/**
 * The panels' icon columns and the header's controls pressed rather than
 * described, through the shell's own components (`testing/panel-host.tsx`).
 * The stylesheet decides what each draw shows, and this DOM applies none, so
 * what is asserted is the markup it keys on: the draw on the root, names,
 * tooltips, `aria-pressed`, `aria-expanded` and the caret. CA_0056_005
 */
afterEach(() => vi.unstubAllGlobals());

const mount = async (
  layout: Partial<Layout> = {},
  phone = false,
  remembered: Record<string, string> = {},
  over?: string,
) => {
  const dom = await createDOM();
  const root = dom.screen as unknown as HTMLElement;
  vi.stubGlobal("document", root.ownerDocument);
  // A desktop's width, which the handle's bounds are measured against; no
  // drawer exists here, so the other panel's column measures 0. CA_0066_002
  vi.stubGlobal("window", { matchMedia: () => ({ matches: phone }), innerWidth: 1280 });
  const stored = new Map<string, string>(Object.entries(remembered));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  });
  await dom.render(jsx(PanelHost, { layout: { ...DEFAULT_WORKSPACE_STATE.layout, ...layout }, over }));
  const one = (selector: string) => root.querySelector(selector) as HTMLElement | null;
  // This DOM leaves an event's target unset; a press names what it pressed.
  const press = (selector: string) => dom.userEvent(selector, "click", { target: one(selector) });
  const pointer = (selector: string) => dom.userEvent(selector, "pointerdown", { target: one(selector) });
  const pressed = (side: "left" | "right") =>
    [...root.querySelectorAll(`.panel-icons[data-side="${side}"] .panel-icon[aria-pressed="true"]`)].map(
      (button) => button.getAttribute("data-panel-icon"),
    );
  const draw = (side: "left" | "right") => one("main")?.getAttribute(`data-${side}`);
  const handle = (side: "left" | "right") => one(`.panel-resize[data-side="${side}"]`);
  const width = (side: "left" | "right") => handle(side)?.getAttribute("aria-valuenow") ?? null;
  const key = (side: "left" | "right", name: string) =>
    dom.userEvent(`.panel-resize[data-side="${side}"]`, "keydown", { target: handle(side), key: name });
  const event = (side: "left" | "right", name: string, init: Record<string, unknown>) =>
    dom.userEvent(`.panel-resize[data-side="${side}"]`, name, { target: handle(side), ...init });
  const order = (side: "left" | "right") =>
    [...root.querySelectorAll(`.panel-icons[data-side="${side}"] .panel-icon`)].map((button) =>
      button.getAttribute("data-panel-icon"),
    );
  const places = () =>
    Object.fromEntries(
      [...root.querySelectorAll('.panel-icons[data-side="left"] .panel-icon')].map((button) => [
        button.getAttribute("data-panel-icon"),
        button.getAttribute("data-drop-place"),
      ]),
    );
  return { one, press, pointer, pressed, draw, handle, width, key, event, stored, order, places };
};

describe("the library's icon order", () => {
  it("Given a stored order, Then the column draws it, and an icon it does not name follows in contribution order", async () => {
    const view = await mount({ libraryOrder: ["ui.shell", "gone", "documents"] });
    expect(view.order("left")).toEqual(["ui.shell", "documents", "publishing"]);
    expect(view.pressed("left"), "the first icon is the reader's first").toEqual(["ui.shell"]);
    const fresh = await mount();
    expect(fresh.order("left")).toEqual(["documents", "publishing", "ui.shell"]);
  });

  it("Given a press on a library icon, Then it starts a drag of kind panel-icon offering move, and the inspector's does not", async () => {
    const view = await mount();
    expect(view.one("main")?.getAttribute("data-dragged")).toBe("");
    await view.pointer('[data-panel-icon="publishing"]');
    expect(view.one("main")?.getAttribute("data-dragged")).toBe("panel-icon:publishing:move");
    expect(view.one('[data-panel-icon="publishing"]')?.getAttribute("data-drop-target")).toBe("panel-icon:publishing");
    expect(view.one('.panel-icons[data-side="left"]')?.getAttribute("data-drop-target")).toBe("panel-icon:end");
    const inspector = view.one('.panel-icons[data-side="right"] .panel-icon');
    expect(inspector?.hasAttribute("data-drop-target"), "the inspector's column does not reorder").toBe(false);
    expect(view.one('.panel-icons[data-side="right"]')?.hasAttribute("data-drop-target")).toBe(false);
  });

  it("Given a drag over the column, Then the line marks the icon the drop lands before, or the last for the end", async () => {
    const between = await mount({}, false, {}, "panel-icon:ui.shell");
    expect(between.places()).toEqual({ documents: "none", publishing: "none", "ui.shell": "none" });
    await between.pointer('[data-panel-icon="documents"]');
    expect(between.places()).toEqual({ documents: "none", publishing: "none", "ui.shell": "before" });
    const end = await mount({}, false, {}, "panel-icon:end");
    await end.pointer('[data-panel-icon="documents"]');
    expect(end.places()).toEqual({ documents: "none", publishing: "none", "ui.shell": "after" });
    const elsewhere = await mount({}, false, {}, "tab:t1");
    await elsewhere.pointer('[data-panel-icon="documents"]');
    expect(elsewhere.places(), "no line while over anything but the column").toEqual({
      documents: "none",
      publishing: "none",
      "ui.shell": "none",
    });
  });

  it("Given a press without travel, Then the icon's content shows as before", async () => {
    const view = await mount();
    await view.pointer('[data-panel-icon="publishing"]');
    await view.press('[data-panel-icon="publishing"]');
    expect(view.pressed("left")).toEqual(["publishing"]);
  });
});

describe("a panel's icon column", () => {
  it("Given a workspace that never chose, Then the library shows its first icon and the inspector is hidden", async () => {
    const view = await mount();
    expect([view.draw("left"), view.draw("right")]).toEqual(["shown", "hidden"]);
    expect(view.pressed("left")).toEqual(["documents"]);
    expect(view.one('[data-side="right"].layout-control')?.getAttribute("aria-pressed")).toBe("false");
    const publish = view.one('[data-panel-icon="publishing"]');
    expect([publish?.getAttribute("aria-label"), publish?.getAttribute("title")]).toEqual(["Publish", "Publish"]);
    expect(publish?.querySelector(".icon")?.getAttribute("data-icon")).toBe("paper-plane-tilt");
    expect(view.one('.panel-icons[data-side="right"] .icon')?.getAttribute("data-icon")).toBe("info");
  });

  it("Given a press on an icon, Then its content shows alone, And a second press leaves the icon column", async () => {
    const view = await mount();
    await view.press('[data-panel-icon="publishing"]');
    expect(view.pressed("left")).toEqual(["publishing"]);
    expect(view.draw("left")).toBe("shown");
    await view.press('[data-panel-icon="publishing"]');
    expect(view.pressed("left")).toEqual([]);
    expect(view.draw("left")).toBe("small");
    await view.press('[data-panel-icon="ui.shell"]');
    expect([view.draw("left"), ...view.pressed("left")]).toEqual(["shown", "ui.shell"]);
  });

  it("Given the header's control, Then the panel hides and comes back with the icon it showed, or the column alone", async () => {
    const view = await mount();
    await view.press('[data-panel-icon="ui.shell"]');
    await view.press('[data-side="left"].layout-control');
    expect(view.draw("left")).toBe("hidden");
    expect(view.one('[data-side="left"].layout-control')?.getAttribute("aria-pressed")).toBe("false");
    await view.press('[data-side="left"].layout-control');
    expect([view.draw("left"), ...view.pressed("left")]).toEqual(["shown", "ui.shell"]);

    await view.press('[data-side="right"].layout-control');
    expect([view.draw("right"), ...view.pressed("right")]).toEqual(["shown", "ui.shell:inspector"]);
    await view.press('[data-panel-icon="ui.shell:inspector"]');
    await view.press('[data-side="right"].layout-control');
    await view.press('[data-side="right"].layout-control');
    expect(view.draw("right"), "the small mode comes back as it was").toBe("small");
  });

  it("Given a phone's sheet, Then a press on another icon shows it, And a press on the shown icon closes the sheet and keeps the panel", async () => {
    const view = await mount({}, true);
    const sheet = () => view.one("main")?.getAttribute("data-sheet") ?? null;
    await view.press('[data-panel-icon="publishing"]');
    expect([sheet(), ...view.pressed("left")]).toEqual(["left", "publishing"]);
    await view.press('[data-panel-icon="publishing"]');
    expect(sheet()).toBeNull();
    expect([view.draw("left"), ...view.pressed("left")]).toEqual(["shown", "publishing"]);
  });

  it("Given a phone's sheet, Then a row closes it and still opens, And the panel is left as it was", async () => {
    const view = await mount({}, true);
    const main = () => view.one("main");
    expect(main()?.getAttribute("data-sheet")).toBe("left");
    await view.press(".library-entry");
    expect(main()?.getAttribute("data-sheet")).toBeNull();
    expect(main()?.getAttribute("data-opened")).toBe("A document");
    expect(
      [view.draw("left"), ...view.pressed("left")],
      "only the sheet closes: what the panel shows is the workspace record's",
    ).toEqual(["shown", "documents"]);
    // A second press on the same row reveals the tab already open rather than
    // opening a second, and closes the sheet the same way. CA_0059_001
    await view.press('.sheet-handle--left');
    expect(main()?.getAttribute("data-sheet")).toBe("left");
    await view.press(".library-entry");
    expect(main()?.getAttribute("data-sheet")).toBeNull();
    expect(main()?.getAttribute("data-opened")).toBe("A document,A document");
  });

  it("Given a phone's sheet, Then the shield covers the workspace while it is open, And a press on it closes the sheet", async () => {
    const view = await mount({}, true);
    expect(view.one(".sheet-shield")).toBeTruthy();
    await view.press(".sheet-shield");
    expect(view.one("main")?.getAttribute("data-sheet")).toBeNull();
    expect(view.one(".sheet-shield"), "nothing is shielded when no sheet is open").toBeFalsy();
  });

  it("Given a press on the handle of the open sheet, Then it closes, And the other handle opens its own", async () => {
    const view = await mount({}, true);
    const sheet = () => view.one("main")?.getAttribute("data-sheet") ?? null;
    await view.press(".sheet-handle--left");
    expect(sheet()).toBeNull();
    await view.press(".sheet-handle--right");
    expect(sheet()).toBe("right");
    await view.press(".sheet-handle--left");
    expect(sheet()).toBe("left");
  });

  it("Given a press on a header control while a sheet is open, Then the sheet closes and the control still acts", async () => {
    const view = await mount({}, true);
    await view.pointer(".settings-control");
    expect(view.one("main")?.getAttribute("data-sheet")).toBeNull();
    expect(view.one(".settings-control"), "the control is still there to do its own work").toBeTruthy();
  });

  it("Given a stored drawer state, Then the columns read it as the panel it meant", async () => {
    const view = await mount({ left: { shown: true, icon: null }, right: { shown: true } });
    expect([view.draw("left"), view.draw("right")]).toEqual(["small", "shown"]);
    expect(view.pressed("left")).toEqual([]);
  });
});

describe("a section's header", () => {
  it("Given one section under its icon, Then it is named without a caret, And one of several collapses by its caret", async () => {
    const view = await mount();
    const alone = view.one('[data-section="documents:documents"]');
    expect(alone?.querySelector(".library-category__toggle")).toBeFalsy();
    expect(alone?.querySelector(".library-category__title")?.textContent).toBe("Documents");
    expect(alone?.querySelector('[aria-label="New"]')).toBeTruthy();

    const band = '[data-section="publishing:channels"] .library-category__toggle';
    expect(view.one(band)?.getAttribute("aria-expanded")).toBe("true");
    expect(view.one(band)?.querySelector(".library-category__caret")).toBeTruthy();
    await view.press(band);
    expect(view.one(band)?.getAttribute("aria-expanded")).toBe("false");
  });
});

/** The handle on a panel's inner border, pressed and keyed in the harness;
 * what the stylesheet does with the width is the measurement's. CA_0066_002 */
describe("a panel's inner border", () => {
  it("Given a shown panel, Then its border carries a named separator reporting the width, And a hidden or small one carries none", async () => {
    const view = await mount();
    const left = view.handle("left");
    expect(left?.getAttribute("role")).toBe("separator");
    expect(left?.getAttribute("aria-orientation")).toBe("vertical");
    expect(left?.getAttribute("aria-label")).toBe("Resize library");
    expect(view.width("left")).toBe("256");
    expect(view.handle("right"), "the inspector is hidden").toBeFalsy();
    await view.press('[data-side="right"].layout-control');
    expect(view.handle("right")?.getAttribute("aria-label")).toBe("Resize inspector");
    expect(view.width("right")).toBe("288");
    await view.press('[data-panel-icon="ui.shell:inspector"]');
    expect(view.draw("right")).toBe("small");
    expect(view.handle("right"), "the column alone has nothing to resize").toBeFalsy();
    await view.press('[data-panel-icon="documents"]');
    expect(view.handle("left"), "the library in the small mode").toBeFalsy();
  });

  it("Given a key on the separator, Then the arrow toward the workspace widens by a step and the other narrows, within the bounds", async () => {
    const view = await mount();
    await view.key("left", "ArrowRight");
    expect(view.width("left")).toBe("272");
    expect(view.handle("left")?.getAttribute("aria-valuemin")).toBe("160");
    expect(view.handle("left")?.getAttribute("aria-valuemax"), "1280 less the icons and the workspace's room").toBe("912");
    await view.key("left", "ArrowLeft");
    await view.key("left", "ArrowLeft");
    expect(view.width("left")).toBe("240");
    expect(view.stored.get("calliopa.panelWidth.left"), "each step is kept").toBe("240");
    await view.key("left", "Tab");
    expect(view.width("left"), "any other key asks nothing").toBe("240");

    await view.press('[data-side="right"].layout-control');
    await view.key("right", "ArrowLeft");
    expect(view.width("right"), "the inspector widens toward the workspace, leftward").toBe("304");
    await view.key("right", "ArrowRight");
    expect(view.width("right")).toBe("288");
  });

  it("Given a drag past the minimum, Then the width stops at it, And the panel stays shown", async () => {
    const view = await mount();
    await view.event("left", "pointerdown", { button: 0, clientX: 300, pointerId: 1 });
    expect(view.handle("left")?.hasAttribute("data-active"), "the workspace takes no press meanwhile").toBe(true);
    await view.event("left", "pointermove", { clientX: 340 });
    expect(view.width("left")).toBe("296");
    await view.event("left", "pointermove", { clientX: 0 });
    expect(view.width("left"), "stopped at the minimum").toBe("160");
    expect(view.draw("left"), "and not collapsed").toBe("shown");
    await view.event("left", "pointerup", {});
    expect(view.handle("left")?.hasAttribute("data-active")).toBe(false);
    expect(view.stored.get("calliopa.panelWidth.left"), "kept on release").toBe("160");
    await view.event("left", "pointermove", { clientX: 600 });
    expect(view.width("left"), "nothing moves once released").toBe("160");
  });

  it("Given a double press on the border, or Enter on the separator, Then the default width is back and nothing is stored", async () => {
    const view = await mount();
    await view.key("left", "ArrowRight");
    expect(view.stored.has("calliopa.panelWidth.left")).toBe(true);
    await view.event("left", "dblclick", {});
    expect(view.width("left")).toBe("256");
    expect(view.stored.has("calliopa.panelWidth.left")).toBe(false);
    await view.key("left", "ArrowLeft");
    await view.key("left", "Enter");
    expect(view.width("left")).toBe("256");
    expect(view.stored.has("calliopa.panelWidth.left")).toBe(false);
  });

  it("Given a width stored by an earlier visit, Then the separator reports it on the way in, clamped to the page", async () => {
    const view = await mount({}, false, { "calliopa.panelWidth.left": "300" });
    await view.event("left", "qvisible", {});
    expect(view.width("left")).toBe("300");
    const wide = await mount({}, false, { "calliopa.panelWidth.left": "5000" });
    await wide.event("left", "qvisible", {});
    expect(wide.width("left"), "a width the page cannot hold stops at the maximum").toBe("912");
    expect(wide.stored.get("calliopa.panelWidth.left"), "storage keeps what was stored").toBe("5000");
  });
});
