import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionControl } from "~/components/shell/inspector";
import { ViewBridgeContext, type ViewBar, type ViewBridge } from "~/components/shell/view-bridge";

import type { ProfilesListing } from "../contributions.server";
import { ProfilesSection } from "./section";
import { GONE_PROFILE, NO_PROFILE, ProfileSelector } from "./selector";

/**
 * The profiles extension's surfaces in Qwik's render harness (`BO_0298_017`):
 * the section listing the profiles and creating one, and the selector in the
 * document's bar — *No profile* first, every profile by title, the document's
 * selection shown, a choice posted and reflected, a gone profile said. What
 * the routes answer is stood in for by the browser's own `fetch`.
 */
const listing: ProfilesListing = {
  reachable: true,
  profiles: [
    { id: "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c", title: "Blog post" },
    { id: "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b", title: "Exploration" },
  ],
};
const blog = listing.profiles[0]!;
const exploration = listing.profiles[1]!;

const opened: { kind: string; itemId: string; title: string }[] = [];
const raised: string[] = [];
const hosted = (child: JSXOutput) =>
  component$(() => {
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const bridge = {
      decorationBar,
      openTarget$: $((target: { kind: string; itemId: string; title: string }) => {
        opened.push({ kind: target.kind, itemId: target.itemId, title: target.title });
      }),
      raiseMessage$: $((message: { body: string }) => {
        raised.push(message.body);
      }),
    } as unknown as ViewBridge;
    useContextProvider(ViewBridgeContext, bridge);
    return jsx("div", {
      children: [
        child,
        jsx("div", {
          "data-test-bar": "",
          children: decorationBar.groups.flatMap((group) => group.actions.map((action) => jsx(ActionControl, { action, surface: "bar" }, action.id))),
        }),
      ],
    });
  });

async function mount(child: JSXOutput) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 50; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { dom, root, settle };
}

const options = (root: HTMLElement): string[] => Array.from(root.querySelectorAll("[data-test-bar] option")).map((option) => option.textContent ?? "");
const select = (root: HTMLElement): HTMLSelectElement | null => root.querySelector("[data-test-bar] select");
/** The harness DOM does not reflect a select's value; the drawn option does. */
const chosen = (root: HTMLElement): string | null => root.querySelector("[data-test-bar] option[selected]")?.getAttribute("value") ?? null;

afterEach(() => {
  opened.length = 0;
  raised.length = 0;
  vi.unstubAllGlobals();
});

describe("the Profiles section", () => {
  it("lists the profiles by title, opens one in the document tab, and its + creates one and opens it", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (url === "/api/x/profiles/profiles") {
        return new Response(JSON.stringify({ outcome: "success", result: { documentId: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f", blockId: "b", dataRevision: "3" } }), { status: 201 });
      }
      return new Response(JSON.stringify(listing), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ProfilesSection, { data: listing, activeItemId: blog.id, sectionKey: "profiles:profiles", filter: null, setFilter$: $(async () => {}) }));
    const rows = () => Array.from(root.querySelectorAll("[data-profile-row]"));
    expect(rows().map((row) => row.textContent?.trim())).toEqual(["Blog post", "Exploration"]);
    expect(root.querySelector(`[data-profile-row="${blog.id}"]`)?.getAttribute("aria-current")).toBe("true");

    await dom.userEvent(`[data-profile-row="${exploration.id}"]`, "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: exploration.id, title: "Exploration" }]);

    await dom.userEvent("[data-new-profile]", "click");
    await settle(() => opened.length > 1);
    expect(asked.find((entry) => entry.url === "/api/x/profiles/profiles")?.body).toBe(JSON.stringify({ title: "Untitled profile" }));
    expect(opened[1]).toEqual({ kind: "documents:document", itemId: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f", title: "Untitled profile" });
  });

  it("says when there are none, and when they could not be read", async () => {
    const none = await mount(jsx(ProfilesSection, { data: { reachable: true, profiles: [] }, activeItemId: null, sectionKey: "profiles:profiles", filter: null, setFilter$: $(async () => {}) }));
    expect(none.root.querySelector("[data-profiles-empty]")?.textContent?.trim()).toBe("No profiles yet");
    const unread = await mount(jsx(ProfilesSection, { data: { reachable: false, profiles: [] }, activeItemId: null, sectionKey: "profiles:profiles", filter: null, setFilter$: $(async () => {}) }));
    expect(unread.root.querySelector("[data-profiles-empty]")?.textContent?.trim()).toBe("The profiles could not be read");
  });
});

describe("the profile selector in the document's bar", () => {
  const api = (selection: { profile: { id: string; title: string } | null; gone: string | null }, asked: { url: string; body?: string }[]) =>
    async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (url === "/api/library/profiles/profiles") return new Response(JSON.stringify(listing), { status: 200 });
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { profile: string | null };
        const chosen = listing.profiles.find((profile) => profile.id === body.profile) ?? null;
        return new Response(JSON.stringify({ outcome: "success", result: { profile: chosen, gone: null } }), { status: 200 });
      }
      return new Response(JSON.stringify({ outcome: "success", result: selection }), { status: 200 });
    };

  it("offers No profile first and every profile by title, shows the selection, and a choice is posted and reflected", async () => {
    const asked: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", api({ profile: blog, gone: null }, asked));
    const { root, settle, dom } = await mount(jsx(ProfileSelector, { documentId: "doc-1" }));
    await settle(() => select(root) !== null);
    expect(options(root)).toEqual(["No profile", "Blog post", "Exploration"]);
    expect(chosen(root)).toBe(blog.id);
    expect(asked.map((entry) => entry.url)).toContain("/api/x/profiles/documents/doc-1/selection");

    const control = select(root) as HTMLSelectElement;
    control.value = exploration.id;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(() => asked.some((entry) => entry.body !== undefined));
    expect(asked.find((entry) => entry.body !== undefined)).toEqual({ url: "/api/x/profiles/documents/doc-1/selection", body: JSON.stringify({ profile: exploration.id }) });
    await settle(() => chosen(root) === exploration.id);
    expect(chosen(root)).toBe(exploration.id);

    control.value = NO_PROFILE;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(() => asked.filter((entry) => entry.body !== undefined).length > 1);
    expect(asked.filter((entry) => entry.body !== undefined)[1]?.body).toBe(JSON.stringify({ profile: null }));
    await settle(() => chosen(root) === NO_PROFILE);
    expect(chosen(root)).toBe(NO_PROFILE);
  });

  it("says when the selected profile is gone, with No profile offered", async () => {
    vi.stubGlobal("fetch", api({ profile: null, gone: "0f0e0d0c-0b0a-4908-8706-050403020100" }, []));
    const { root, settle } = await mount(jsx(ProfileSelector, { documentId: "doc-1" }));
    await settle(() => select(root) !== null);
    expect(options(root)).toEqual(["No profile", "The selected profile is gone", "Blog post", "Exploration"]);
    expect(chosen(root)).toBe(GONE_PROFILE);
  });

  it("offers nothing while the profiles cannot be read", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/profiles/profiles"
        ? new Response(JSON.stringify({ reachable: false, profiles: [] }), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: { profile: null, gone: null } }), { status: 200 }),
    );
    const { root, settle } = await mount(jsx(ProfileSelector, { documentId: "doc-1" }));
    await settle(() => false);
    expect(select(root)).toBeFalsy();
  });

  it("says a refused choice in the route's words and keeps the selection", async () => {
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/library/profiles/profiles") return new Response(JSON.stringify(listing), { status: 200 });
      if (init?.method === "POST") return new Response(JSON.stringify({ outcome: "noResult", detail: "No document doc-1." }), { status: 404 });
      return new Response(JSON.stringify({ outcome: "success", result: { profile: null, gone: null } }), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ProfileSelector, { documentId: "doc-1" }));
    await settle(() => select(root) !== null);
    (select(root) as HTMLSelectElement).value = blog.id;
    await dom.userEvent("[data-test-bar] select", "change");
    await settle(() => raised.length > 0);
    expect(raised).toEqual(["No document doc-1."]);
    expect(chosen(root)).toBe(NO_PROFILE);
  });
});
