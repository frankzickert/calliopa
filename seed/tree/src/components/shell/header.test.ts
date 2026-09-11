import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderHost } from "./testing/header-host";

/**
 * The header's controls pressed rather than described, through the shell's
 * own components (`header-host.tsx`). Attributes are asserted rather than
 * properties — this DOM's properties are not a browser's (`BO_0225_004`).
 * CA_0041_001 CA_0041_003 CA_0041_004 CA_0041_006
 */
const LICENCE = "The licence expires in 5 days, on 2026-09-15.";

let calls: string[] = [];
let assigned: string[] = [];

beforeEach(() => {
  calls = [];
  assigned = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(null, { status: 204 });
    }),
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (personClass = "human") => {
  const dom = await createDOM();
  const root = dom.screen as unknown as HTMLElement;
  // The toggle writes the theme onto the page's root element, and the person's
  // menu leaves for the sign-in page: both are this harness's document here.
  vi.stubGlobal("document", root.ownerDocument);
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false }),
    location: { assign: (url: string) => assigned.push(url) },
  });
  await dom.render(
    jsx(HeaderHost, {
      person: { name: "frankzickert", class: personClass, owner: true },
      licence: LICENCE,
    }),
  );
  const one = (selector: string) =>
    root.querySelector(selector) as HTMLElement | null;
  return { ...dom, root, one };
};

describe("the header's one-line controls", () => {
  it("Given the theme toggle pressed through its choices, Then each shows its icon under the matching name", async () => {
    const view = await mount();
    const seen = () => [
      view.one(".theme-toggle")?.getAttribute("aria-label"),
      view.one(".theme-toggle .icon")?.getAttribute("data-icon"),
    ];

    expect(seen()).toEqual(["Theme: system. Switch theme", "circle-half"]);
    expect(view.one(".theme-toggle")?.textContent?.trim()).toBe("");
    await view.userEvent(".theme-toggle", "click");
    expect(seen()).toEqual(["Theme: light. Switch theme", "sun"]);
    await view.userEvent(".theme-toggle", "click");
    expect(seen()).toEqual(["Theme: dark. Switch theme", "moon"]);
    await view.userEvent(".theme-toggle", "click");
    expect(seen()).toEqual(["Theme: system. Switch theme", "circle-half"]);
  });

  it("Given a view reporting its save state after mount, Then the header shows its icon and its word", async () => {
    const view = await mount();
    expect(view.one(".save-status")).toBeFalsy();

    for (const [state, icon, word] of [
      ["saving", "cloud-arrow-up", "Saving"],
      ["saved", "cloud-check", "Saved"],
      ["unsaved", "cloud-warning", "Unsaved"],
    ] as const) {
      await view.userEvent(`[data-report="${state}"]`, "click");
      expect(view.one(".save-status")?.getAttribute("data-save-status")).toBe(
        state,
      );
      expect(view.one(".save-status .icon")?.getAttribute("data-icon")).toBe(
        icon,
      );
      expect(
        view.one(".save-status .icon")?.getAttribute("aria-hidden"),
      ).toBe("true");
      expect(view.one(".save-status__word")?.textContent).toBe(word);
    }
  });

  it("Given the person's button, Then it names who is signed in, and a press shows the name, the role and Sign out", async () => {
    const view = await mount();
    const button = () => view.one('[data-disclosure="person"]');
    const panel = () =>
      view.one(".header-disclosure--person .header-disclosure__panel");

    expect(button()?.getAttribute("aria-label")).toBe(
      "Signed in as frankzickert. Account",
    );
    expect(button()?.querySelector(".icon")?.getAttribute("data-icon")).toBe(
      "user",
    );
    expect(button()?.getAttribute("aria-expanded")).toBe("false");
    expect(button()?.getAttribute("aria-controls")).toBe(
      panel()?.getAttribute("id"),
    );
    expect(panel()?.hasAttribute("hidden")).toBe(true);
    expect(view.one(".identity")?.getAttribute("data-identity")).toBe(
      "frankzickert",
    );

    await view.userEvent('[data-disclosure="person"]', "click");
    expect(button()?.getAttribute("aria-expanded")).toBe("true");
    expect(panel()?.hasAttribute("hidden")).toBe(false);
    expect(view.one(".identity__name")?.textContent).toBe("frankzickert");
    expect(view.one(".identity__class")?.textContent).toBe("may establish");
    expect(view.one(".sign-out")?.textContent?.trim()).toBe("Sign out");
  });

  it("Given a person who only proposes, Then the icon is the same and the role says so", async () => {
    const view = await mount("agent");
    expect(
      view.one('[data-disclosure="person"] .icon')?.getAttribute("data-icon"),
    ).toBe("user");
    expect(view.one(".identity__class")?.textContent).toBe("proposes");
  });

  // A press outside closes it through a `document:` listener, which this
  // harness never dispatches — it walks `on:` listeners up from the element
  // and nothing else — so that press is the walk-through's (CA_0041_009).
  it("Given the menu open, Then a second press or Escape closes it", async () => {
    const view = await mount();
    const expanded = () =>
      view.one('[data-disclosure="person"]')?.getAttribute("aria-expanded");

    await view.userEvent('[data-disclosure="person"]', "click");
    await view.userEvent('[data-disclosure="person"]', "click");
    expect(expanded(), "pressed again").toBe("false");

    await view.userEvent('[data-disclosure="person"]', "click");
    await view.userEvent(".sign-out", "keydown", { key: "Escape" });
    expect(expanded(), "Escape from inside the panel").toBe("false");

    await view.userEvent('[data-disclosure="person"]', "click");
    await view.userEvent('[data-disclosure="person"]', "keydown", {
      key: "Enter",
    });
    expect(expanded(), "a key that is not Escape").toBe("true");
    await view.userEvent('[data-disclosure="person"]', "keydown", {
      key: "Escape",
    });
    expect(expanded(), "Escape on the button").toBe("false");
  });

  it("Given Sign out pressed, Then the kernel's session ends and the page goes to its sign-in", async () => {
    const view = await mount();
    await view.userEvent('[data-disclosure="person"]', "click");
    await view.userEvent(".sign-out", "click");
    expect(calls).toEqual(["POST /__kernel/session/sign-out"]);
    expect(assigned).toEqual(["/__kernel/session/sign-in"]);
  });

  it("Given a live licence warning, Then it is a warning icon named by the word, which a press shows and Escape hides", async () => {
    const view = await mount();
    const button = () => view.one('[data-disclosure="licence"]');
    const text = () => view.one(".licence-warning__text");

    expect(view.one("[data-licence-warning]")?.getAttribute("role")).toBe(
      "status",
    );
    expect(button()?.getAttribute("aria-label")).toBe(LICENCE);
    expect(button()?.querySelector(".icon")?.getAttribute("data-icon")).toBe(
      "warning",
    );
    expect(text()?.closest("[hidden]")).toBeTruthy();

    await view.userEvent('[data-disclosure="licence"]', "click");
    expect(button()?.getAttribute("aria-expanded")).toBe("true");
    expect(text()?.closest("[hidden]")).toBeFalsy();
    expect(text()?.textContent).toBe(LICENCE);

    await view.userEvent('[data-disclosure="licence"]', "keydown", {
      key: "Escape",
    });
    expect(button()?.getAttribute("aria-expanded")).toBe("false");
    expect(text()?.closest("[hidden]")).toBeTruthy();
  });
});
