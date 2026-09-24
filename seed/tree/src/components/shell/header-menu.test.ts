import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEADER_MODE_STORAGE_KEY, MENU_FLASH_MS } from "~/lib/header-mode";
import type { Tab, TabsState } from "~/lib/tabs";
import { HeaderMenuHost } from "./testing/header-menu-host";

/**
 * The phone header's *Minimum* parts pressed rather than described, through
 * the shell's own components (`header-menu-host.tsx`). The stylesheet decides
 * which mode draws what, and this DOM applies none, so what is asserted is
 * the markup the stylesheet keys on: the root's mode, names, `hidden`,
 * `aria-expanded` and the flash. A press outside is a `document:` listener
 * this harness never dispatches, so that press is the walk-through's.
 * CA_0054_005 CA_0054_009
 */
const tab = (id: string): Tab => ({
  id,
  kind: "documents:document",
  title: id,
  itemId: id,
  viewType: "block-editor",
  selection: null,
  drawerContext: null,
  unsaved: false,
});
const TABS: TabsState = { tabs: [tab("a"), tab("b"), tab("c")], activeTabId: "b" };

let stored: Map<string, string>;
let last: (() => Promise<void>) | null = null;

beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(async () => {
  vi.useRealTimers();
  await last?.();
  last = null;
  vi.unstubAllGlobals();
});

const mount = async ({
  licence = null as string | null,
  mode = null as string | null,
  tabs = TABS,
} = {}) => {
  const dom = await createDOM();
  const root = dom.screen as unknown as HTMLElement;
  const html = root.ownerDocument.documentElement;
  if (mode !== null) html.setAttribute("data-header-mode", mode);
  else html.removeAttribute("data-header-mode");
  vi.stubGlobal("document", root.ownerDocument);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  await dom.render(
    jsx(HeaderMenuHost, {
      person: { name: "frankzickert", class: "human", owner: true },
      licence,
      tabs,
    }),
  );
  const one = (selector: string) =>
    root.querySelector(selector) as HTMLElement | null;
  // The visible tasks write after the mount's draw, and this platform draws
  // only when a dispatched event ends: a tick and an event settle them.
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await dom.userEvent("header", "focusin");
  };
  await settle();
  // This DOM leaves an event's target unset; a press names what it pressed,
  // as a browser's would.
  const press = (selector: string) =>
    dom.userEvent(selector, "click", { target: one(selector) });
  last = settle;
  // Under fake timers the tick is the clock's to give.
  const settleFake = () => dom.userEvent("header", "focusin");
  return { ...dom, root, html, one, press, settle, settleFake };
};

describe("the phone header's mode control", () => {
  it("Given no stored mode, Then the page is in Minimum and the control offers Full, And a press switches, stores and offers the other", async () => {
    const view = await mount({ mode: "minimum" });
    const control = () => view.one(".header-mode-toggle");
    const seen = () => [
      control()?.getAttribute("aria-label"),
      control()?.querySelector(".icon")?.getAttribute("data-icon"),
      control()?.querySelector(".menu-label")?.textContent,
    ];

    expect(seen()).toEqual(["Full header", "arrows-out-line-vertical", "Full header"]);
    await view.press(".header-mode-toggle");
    expect(view.html.getAttribute("data-header-mode")).toBe("full");
    expect(stored.get(HEADER_MODE_STORAGE_KEY)).toBe("full");
    expect(seen()).toEqual(["Minimum header", "arrows-in-line-vertical", "Minimum header"]);
    await view.press(".header-mode-toggle");
    expect(view.html.getAttribute("data-header-mode")).toBe("minimum");
    expect(stored.get(HEADER_MODE_STORAGE_KEY)).toBe("minimum");
  });

  it("Given Full set before paint, Then the control offers Minimum", async () => {
    const view = await mount({ mode: "full" });
    expect(view.one(".header-mode-toggle")?.getAttribute("aria-label")).toBe("Minimum header");
  });
});

describe("the Minimum menu", () => {
  it("Given the menu, Then it is one button named Menu drawing a list, over a panel holding every control", async () => {
    const view = await mount({ licence: "Expires soon." });
    const button = view.one(".header-menu__button");
    const panel = view.one(".header-menu__panel");

    expect(button?.getAttribute("aria-label")).toBe("Menu");
    expect(button?.getAttribute("aria-controls")).toBe(panel?.getAttribute("id"));
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hasAttribute("hidden")).toBe(true);
    for (const control of [".header-mode-toggle", ".close-all-tabs", ".settings-control", ".theme-toggle", ".identity", ".licence-warning"])
      expect(panel?.querySelector(control), control).toBeTruthy();
    expect(view.one(".theme-toggle .menu-label")?.textContent).toBe("Theme: system");
  });

  it("Given the menu opened, Then a press on a control closes it, except the theme, And a second press or Escape closes it", async () => {
    const view = await mount();
    const expanded = () => view.one(".header-menu__button")?.getAttribute("aria-expanded");
    const hidden = () => view.one(".header-menu__panel")?.hasAttribute("hidden");

    await view.press(".header-menu__button");
    expect([expanded(), hidden()]).toEqual(["true", false]);
    await view.press(".theme-toggle");
    expect(expanded(), "the theme keeps it open").toBe("true");
    await view.press(".settings-control");
    expect([expanded(), hidden()], "settings closes it").toEqual(["false", true]);

    await view.press(".header-menu__button");
    await view.press(".header-menu__button");
    expect(expanded(), "pressed again").toBe("false");

    await view.press(".header-menu__button");
    await view.userEvent(".sign-out", "keydown", { key: "Escape" });
    expect(expanded(), "Escape from inside").toBe("false");
  });

  it("Given a save following a save, Then its icon holds the button's place for three seconds and says its word, And then the list comes back with a dot, which opening clears", async () => {
    const view = await mount();
    const icon = () => view.one(".header-menu__button .icon")?.getAttribute("data-icon");
    const dot = () => view.one(".header-menu__dot");

    await view.press('[data-report="saving"]');
    expect(icon(), "a save state appearing is not news").toBe("list");
    expect(dot()).toBeFalsy();

    vi.useFakeTimers({ toFake: ["setTimeout"] });
    await view.press('[data-report="saved"]');
    expect(icon()).toBe("cloud-check");
    expect(view.one(".header-menu__announce")?.textContent).toBe("Saved");
    expect(view.one(".header-menu__button")?.getAttribute("aria-label")).toBe("Menu");
    expect(dot(), "no dot while the change shows").toBeFalsy();

    await vi.advanceTimersByTimeAsync(MENU_FLASH_MS);
    await view.settleFake();
    expect(icon()).toBe("list");
    expect(dot()).toBeTruthy();
    expect(view.one(".header-menu__announce")?.textContent).toBe("");

    await view.press(".header-menu__button");
    expect(dot(), "opening clears it").toBeFalsy();
  });

  it("Given a change arriving while another shows, Then it takes the place and the three seconds start again", async () => {
    const view = await mount();
    const flash = () => view.one(".header-menu")?.getAttribute("data-flash");

    vi.useFakeTimers({ toFake: ["setTimeout"] });
    await view.press('[data-report="process"]');
    expect(flash()).toBe("processes");
    expect(view.one(".header-menu__count")?.textContent).toBe("1");
    expect(view.one(".header-menu__announce")?.textContent).toBe("1 active processes");

    await vi.advanceTimersByTimeAsync(MENU_FLASH_MS - 1000);
    await view.press('[data-report="update"]');
    expect(flash()).toBe("update");
    expect(view.one(".header-menu__button .icon")?.getAttribute("data-icon")).toBe("arrow-circle-up");

    await vi.advanceTimersByTimeAsync(1500);
    await view.settleFake();
    expect(flash(), "the first change's time does not end the second").toBe("update");
    await vi.advanceTimersByTimeAsync(MENU_FLASH_MS);
    await view.settleFake();
    expect(flash()).toBeNull();
  });

  it("Given a licence warning at load, Then it flashes and leaves the dot", async () => {
    const view = await mount({ licence: "Expires soon." });
    expect(view.one(".header-menu")?.getAttribute("data-flash")).toBe("licence");
    expect(view.one(".header-menu__button .icon")?.getAttribute("data-icon")).toBe("warning");
    expect(view.one(".header-menu")?.getAttribute("data-dot")).toBe("true");
  });
});

describe("closing every tab at once", () => {
  it("Given open tabs, Then the strip's end and the menu each hold Close all tabs, And one press empties the strip, And an empty strip holds neither", async () => {
    const view = await mount();
    const strip = () => view.one('nav [data-close-all-tabs="strip"]');
    const menu = () => view.one('.header-menu__panel [data-close-all-tabs="menu"]');

    expect(strip()?.getAttribute("aria-label")).toBe("Close all tabs");
    expect(menu()?.getAttribute("aria-label")).toBe("Close all tabs");
    expect(menu()?.querySelector(".menu-label")?.textContent).toBe("Close all tabs");

    await view.press('[data-close-all-tabs="strip"]');
    expect(view.one("nav")?.getAttribute("data-active-tab")).toBe("");
    expect(view.one("[data-tab-edge]"), "no tab lies either way").toBeFalsy();
    expect(strip(), "nothing left to close").toBeFalsy();
    expect(menu()).toBeFalsy();
  });

  it("Given the menu opened, Then a press on Close all tabs closes the tabs and the menu", async () => {
    const view = await mount();
    await view.press(".header-menu__button");
    expect(view.one(".header-menu__button")?.getAttribute("aria-expanded")).toBe("true");

    await view.press('[data-close-all-tabs="menu"]');
    expect(view.one("nav")?.getAttribute("data-active-tab")).toBe("");
    expect(view.one(".header-menu__button")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("Given no open tabs, Then neither control is drawn", async () => {
    const view = await mount({ tabs: { tabs: [], activeTabId: null } });
    expect(view.one("[data-close-all-tabs]")).toBeFalsy();
  });
});

describe("the one tab's faded edges", () => {
  it("Given tabs on both sides, Then each edge counts its side and a press steps that way, And an end draws no edge", async () => {
    const view = await mount({ tabs: { ...TABS, tabs: [...TABS.tabs, tab("d")] } });
    const edge = (side: string) => view.one(`[data-tab-edge="${side}"]`);
    const active = () => view.one("nav")?.getAttribute("data-active-tab");

    expect(edge("before")?.getAttribute("aria-label")).toBe("1 tab before. Previous tab");
    expect(edge("after")?.getAttribute("aria-label")).toBe("2 tabs after. Next tab");
    expect(edge("after")?.textContent?.trim()).toBe("2");

    await view.press('[data-tab-edge="after"]');
    expect(active()).toBe("c");
    await view.press('[data-tab-edge="after"]');
    expect(active()).toBe("d");
    expect(edge("after"), "the last tab has nothing after it").toBeFalsy();
    expect(edge("before")?.getAttribute("aria-label")).toBe("3 tabs before. Previous tab");

    for (const expected of ["c", "b", "a"]) {
      await view.press('[data-tab-edge="before"]');
      expect(active()).toBe(expected);
    }
    expect(edge("before"), "the first tab has nothing before it").toBeFalsy();
  });
});
