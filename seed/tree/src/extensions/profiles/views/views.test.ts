import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionControl } from "~/components/shell/inspector";
import { ViewBridgeContext, type ViewBar, type ViewBridge } from "~/components/shell/view-bridge";

import type { GrantView, ProfileChoices, ProfileGrants, ProfileTools } from "../lib/profiles";
import { ProfileChip } from "./chip";
import { ProfileToolsSettings } from "./settings";
import { ProfileToolsProvider, ToolHeadline } from "./tools";

/**
 * The profiles extension's surfaces in Qwik's render harness
 * (`calliopa-bootstrap`'s `BO_0311_013`): the chip in a block's command —
 * *No profile* first, the profiles for the block's roles grouped before the
 * rest, the person's last restored, a choice set as the command's option —
 * and on a profile's document each code block named as its tool with its
 * state, and the grant in the bar for the owner alone. What the routes answer
 * is stood in for by the browser's own `fetch`.
 */
const blog = { id: "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c", title: "Blog post", matches: false };
const exploration = { id: "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b", title: "Exploration", matches: true };
const archive = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", title: "Archive", matches: false };

const options: { name: string; value: string | null }[] = [];
const raised: string[] = [];
const hosted = (child: JSXOutput) =>
  component$(() => {
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const bridge = {
      decorationBar,
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

const setOption$ = $((name: string, value: string | null) => {
  options.push({ name, value });
});

const chip = () => jsx(ProfileChip, { documentId: "doc-1", blockId: "blk-1", revisionId: "rev-1", active: true, setOption$ });

afterEach(() => {
  options.length = 0;
  raised.length = 0;
  vi.unstubAllGlobals();
});

describe("the profile in the command chip", () => {
  const answering = (choices: ProfileChoices, asked: string[] = []) => async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify(choices), { status: 200 });
  };

  it("restores the person's last, offers No profile then the block's roles' profiles then the rest, and sets the choice on the command", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", answering({ reachable: true, isProfile: false, profiles: [blog, exploration, archive], last: blog.id }, asked));
    const { root, settle, dom } = await mount(chip());
    await settle(() => root.querySelector("[data-profile-toggle]") !== null && options.length > 0);
    expect(asked).toEqual(["/api/x/profiles/documents/doc-1/blocks/blk-1/choices"]);
    expect(options).toEqual([{ name: "profile", value: blog.id }]);
    expect(root.querySelector("[data-profile-toggle]")?.getAttribute("title")).toBe("Profile: Blog post");

    await dom.userEvent("[data-profile-toggle]", "click");
    await settle(() => root.querySelector("[data-profile-popover]") !== null);
    const offered = Array.from(root.querySelectorAll("[data-profile-option]")).map((option) => option.textContent?.trim());
    expect(offered).toEqual(["No profile", "Exploration", "Archive", "Blog post"]);
    expect(root.querySelector(`[data-profile-matching] [data-profile-option="${exploration.id}"]`)).toBeTruthy();
    expect(root.querySelector(`[data-profile-option="${blog.id}"]`)?.getAttribute("aria-pressed")).toBe("true");

    await dom.userEvent(`[data-profile-option="${exploration.id}"]`, "click");
    await settle(() => options.length > 1);
    expect(options[1]).toEqual({ name: "profile", value: exploration.id });
    expect(root.querySelector("[data-profile-popover]")).toBeFalsy();

    await dom.userEvent("[data-profile-toggle]", "click");
    await settle(() => root.querySelector("[data-profile-popover]") !== null);
    await dom.userEvent('[data-profile-option=""]', "click");
    await settle(() => options.length > 2);
    expect(options[2]).toEqual({ name: "profile", value: null });
    expect(root.querySelector("[data-profile-toggle]")?.getAttribute("title")).toBe("No profile");
  });

  it("starts at No profile on a profile's own document, and with a last that is no profile any more", async () => {
    vi.stubGlobal("fetch", answering({ reachable: true, isProfile: true, profiles: [blog], last: null }));
    const own = await mount(chip());
    await own.settle(() => own.root.querySelector("[data-profile-toggle]") !== null);
    expect(own.root.querySelector("[data-profile-toggle]")?.getAttribute("title")).toBe("No profile");
    vi.stubGlobal("fetch", answering({ reachable: true, isProfile: false, profiles: [blog], last: "0f0e0d0c-0b0a-4908-8706-050403020100" }));
    const gone = await mount(chip());
    await gone.settle(() => gone.root.querySelector("[data-profile-toggle]") !== null);
    expect(gone.root.querySelector("[data-profile-toggle]")?.getAttribute("title")).toBe("No profile");
    expect(options).toEqual([]);
  });

  it("draws nothing while the profiles cannot be read, or the instance has none", async () => {
    vi.stubGlobal("fetch", answering({ reachable: false, isProfile: false, profiles: [], last: null }));
    const unread = await mount(chip());
    await unread.settle(() => false);
    expect(unread.root.querySelector("[data-profile-chip]")).toBeFalsy();
    vi.stubGlobal("fetch", answering({ reachable: true, isProfile: false, profiles: [], last: null }));
    const none = await mount(chip());
    await none.settle(() => false);
    expect(none.root.querySelector("[data-profile-chip]")).toBeFalsy();
  });
});

describe("a profile's tools on its document", () => {
  const grant = (granted: boolean, runtime: string | null = "rt-1"): GrantView => ({
    profile: "prof-1",
    granted,
    runtime,
    tools: [
      { block: "blk-send", name: "send_an_email", description: "Send an email", state: granted ? "granted" : "never" },
      { block: "blk-count", name: "count_words", description: "Count the words.", state: granted ? "changed" : "never" },
    ],
    ...(granted ? { grantedBy: "frank", grantedAt: 1, secrets: [] } : {}),
  });
  const tree = () =>
    jsx(ProfileToolsProvider, {
      documentId: "prof-1",
      children: [
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-send", revisionId: "r", active: false }),
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-count", revisionId: "r", active: false }),
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-words", revisionId: "r", active: false }),
      ],
    });
  const bar = (root: HTMLElement) => Array.from(root.querySelectorAll("[data-test-bar] button")).map((button) => `${button.getAttribute("aria-label")}=${button.getAttribute("aria-pressed") ?? "button"}`);
  const states = (root: HTMLElement) => Array.from(root.querySelectorAll("[data-profile-tool]")).map((tool) => `${tool.getAttribute("data-profile-tool")}: ${tool.querySelector(".profile-tool__state")?.textContent}`);

  it("shows the owner the grant with a toggle per set secret, and grants and revokes with the secrets chosen", async () => {
    const asked: { url: string; method: string; body?: string }[] = [];
    let granted = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (method === "PUT") granted = true;
      if (method === "DELETE") granted = false;
      if (method !== "GET") return new Response("{}", { status: 200 });
      const tools: ProfileTools = {
        profile: true,
        owner: true,
        grant: granted ? { ...grant(true), secrets: ["SMTP"] } : grant(false),
        secrets: [
          { name: "SMTP", set: true, suffix: "smtp" },
          { name: "UNSET", set: false, suffix: "" },
        ],
      };
      return new Response(JSON.stringify(tools), { status: 200 });
    });
    const { root, settle, dom } = await mount(tree());
    await settle(() => bar(root).length > 0);
    expect(bar(root)).toEqual(["Grant this profile outside reach=false", "The grant may read the secret SMTP=false"]);
    expect(states(root)).toEqual(["send_an_email: offline", "count_words: offline"]);

    await dom.userEvent('[data-bar-action="profile-secret-SMTP"]', "click");
    await settle(() => bar(root)[1] === "The grant may read the secret SMTP=true");
    expect(asked.some((entry) => entry.method !== "GET")).toBe(false);
    await dom.userEvent('[data-bar-action="profile-grant"]', "click");
    await settle(() => states(root)[0] === "send_an_email: granted");
    expect(asked.find((entry) => entry.method === "PUT")).toEqual({ url: "/api/x/profiles/documents/prof-1/grant", method: "PUT", body: JSON.stringify({ secrets: ["SMTP"] }) });
    expect(states(root)).toEqual(["send_an_email: granted", "count_words: changed since the grant"]);
    expect(bar(root)).toContain("Grant the changed code blocks again=button");

    await dom.userEvent('[data-bar-action="profile-grant"]', "click");
    await settle(() => asked.some((entry) => entry.method === "DELETE") && states(root)[0] === "send_an_email: offline");
    expect(asked.filter((entry) => entry.method === "DELETE")).toEqual([{ url: "/api/x/profiles/documents/prof-1/grant", method: "DELETE" }]);
  });

  it("shows anyone else the tools' states and no grant, and says the tools cannot run with no runtime", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ profile: true, owner: false, grant: grant(true), secrets: [] } satisfies ProfileTools), { status: 200 }));
    const reader = await mount(tree());
    await reader.settle(() => states(reader.root).length > 0);
    expect(states(reader.root)).toEqual(["send_an_email: granted", "count_words: changed since the grant"]);
    expect(bar(reader.root)).toEqual([]);

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ profile: true, owner: true, grant: grant(false, null), secrets: [] } satisfies ProfileTools), { status: 200 }));
    const offline = await mount(tree());
    await offline.settle(() => states(offline.root).length > 0);
    expect(states(offline.root)).toEqual(["send_an_email: cannot run: the profile is connected to no runtime", "count_words: cannot run: the profile is connected to no runtime"]);
  });

  it("draws nothing on a document that is no profile, and raises a refused grant in its words", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ profile: false } satisfies ProfileTools), { status: 200 }));
    const plain = await mount(tree());
    await plain.settle(() => false);
    expect(states(plain.root)).toEqual([]);
    expect(bar(plain.root)).toEqual([]);

    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ error: "only the owner grants a profile outside reach" }), { status: 403 })
        : new Response(JSON.stringify({ profile: true, owner: true, grant: grant(false), secrets: [] } satisfies ProfileTools), { status: 200 }),
    );
    const refused = await mount(tree());
    await refused.settle(() => bar(refused.root).length > 0);
    await refused.dom.userEvent('[data-bar-action="profile-grant"]', "click");
    await refused.settle(() => raised.length > 0);
    expect(raised).toEqual(["only the owner grants a profile outside reach"]);
  });
});

// `calliopa-bootstrap`'s `BO_0320`, kept on a profile's document when the bar's
// selector went with `BO_0311`: the profile's type, and an image profile's
// backend, each saved on a choice.
describe("a profile's setup in its document's bar", () => {
  it("draws the type on a profile, omits Codex, and saves an available backend", async () => {
    const asked: { url: string; method: string; body?: string }[] = [];
    let generation: { profileType: string; imageBackend: string | null } = { profileType: "instructions", imageBackend: null };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (!url.endsWith("/generation-profile")) return new Response(JSON.stringify({ profile: false } satisfies ProfileTools), { status: 200 });
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body)) as { profileType: string; imageBackend?: string };
        generation = { profileType: body.profileType, imageBackend: body.imageBackend ?? generation.imageBackend };
      }
      return new Response(JSON.stringify({ outcome: "success", result: generation }), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ProfileToolsProvider, { documentId: "prof-1" }));
    const choice = (id: string) => root.querySelector(`[data-test-bar] select[data-bar-action="${id}"]`) as HTMLSelectElement | null;
    await settle(() => choice("profile-type") !== null);
    expect(choice("profile-type")?.querySelector("option[selected]")?.getAttribute("value")).toBe("instructions");
    expect(choice("profile-image-backend")).toBeFalsy();

    (choice("profile-type") as HTMLSelectElement).value = "image";
    await dom.userEvent('[data-bar-action="profile-type"]', "change");
    await settle(() => choice("profile-image-backend") !== null);
    expect(asked.filter((entry) => entry.method === "PUT")).toEqual([{ url: "/api/x/profiles/documents/prof-1/generation-profile", method: "PUT", body: JSON.stringify({ profileType: "image" }) }]);
    expect(Array.from(choice("profile-image-backend")?.options ?? []).map((option) => option.text)).not.toContain("Codex");

    (choice("profile-image-backend") as HTMLSelectElement).value = "openart";
    await dom.userEvent('[data-bar-action="profile-image-backend"]', "change");
    await settle(() => asked.filter((entry) => entry.method === "PUT").length === 2);
    expect(asked.filter((entry) => entry.method === "PUT")[1]?.body).toBe(JSON.stringify({ profileType: "image", imageBackend: "openart" }));
  });

  it("offers video generation, whose backends are the video generators and never Codex, and keeps a saved Codex backend hidden", async () => {
    const asked: { method: string; body?: string }[] = [];
    let generation: { profileType: string; imageBackend: string | null } = { profileType: "image", imageBackend: null };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (!url.endsWith("/generation-profile")) return new Response(JSON.stringify({ profile: false } satisfies ProfileTools), { status: 200 });
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body)) as { profileType: string; imageBackend?: string };
        generation = { profileType: body.profileType, imageBackend: body.imageBackend ?? generation.imageBackend };
      }
      return new Response(JSON.stringify({ outcome: "success", result: generation }), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ProfileToolsProvider, { documentId: "prof-1" }));
    const choice = (id: string) => root.querySelector(`[data-test-bar] select[data-bar-action="${id}"]`) as HTMLSelectElement | null;
    const values = (id: string) => Array.from(choice(id)?.querySelectorAll("option") ?? []).map((option) => option.getAttribute("value"));
    await settle(() => choice("profile-image-backend") !== null);
    expect(values("profile-type")).toEqual(["instructions", "image", "video"]);

    (choice("profile-type") as HTMLSelectElement).value = "video";
    await dom.userEvent('[data-bar-action="profile-type"]', "change");
    await settle(() => asked.filter((entry) => entry.method === "PUT").length === 1);
    expect(asked.filter((entry) => entry.method === "PUT")[0]?.body).toBe(JSON.stringify({ profileType: "video" }));
    expect(values("profile-image-backend")).toEqual(["", "higgsfield", "openart"]);

    (choice("profile-image-backend") as HTMLSelectElement).value = "openart";
    await dom.userEvent('[data-bar-action="profile-image-backend"]', "change");
    await settle(() => asked.filter((entry) => entry.method === "PUT").length === 2);
    expect(asked.filter((entry) => entry.method === "PUT")[1]?.body).toBe(JSON.stringify({ profileType: "video", imageBackend: "openart" }));
  });

  it("shows a video profile saved with Codex no backend choice, as it shows an image one (BO_0320_013)", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/generation-profile")
        ? new Response(JSON.stringify({ outcome: "success", result: { profileType: "video", imageBackend: "codex" } }), { status: 200 })
        : new Response(JSON.stringify({ profile: false } satisfies ProfileTools), { status: 200 }));
    const { root, settle } = await mount(jsx(ProfileToolsProvider, { documentId: "prof-1" }));
    await settle(() => root.querySelector('[data-test-bar] select[data-bar-action="profile-type"]') !== null);
    expect(root.querySelector('[data-test-bar] select[data-bar-action="profile-image-backend"]')).toBeFalsy();
  });

  it("draws nothing on a document that is no profile", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/generation-profile")
        ? new Response(JSON.stringify({ outcome: "success", result: null }), { status: 200 })
        : new Response(JSON.stringify({ profile: false } satisfies ProfileTools), { status: 200 }),
    );
    const { root, settle } = await mount(jsx(ProfileToolsProvider, { documentId: "doc-1" }));
    await settle(() => false);
    expect(root.querySelector('[data-bar-action="profile-type"]')).toBeFalsy();
  });

  it("hides all image-backend choices for a profile already saved with Codex", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/generation-profile")
        ? new Response(JSON.stringify({ outcome: "success", result: { profileType: "image", imageBackend: "codex" } }), { status: 200 })
        : new Response(JSON.stringify({ profile: true, owner: false, grant: null, secrets: [] } satisfies ProfileTools), { status: 200 }),
    );
    const { root, settle } = await mount(jsx(ProfileToolsProvider, { documentId: "prof-1" }));
    await settle(() => root.querySelector('[data-bar-action="profile-type"]') !== null);
    expect(root.querySelector('[data-bar-action="profile-image-backend"]')).toBeFalsy();
    expect(Array.from(root.querySelectorAll("[data-test-bar] option")).map((option) => option.textContent)).not.toContain("Codex");
  });
});

describe("Profile tools in Settings", () => {
  it("lists the grants with their profiles and revokes one, and keeps the secrets without ever showing a value", async () => {
    const asked: { url: string; method: string; body?: string }[] = [];
    let view: ProfileGrants = {
      grants: [{ profile: "prof-1", title: "Mailer", grantedBy: "frank", grantedAt: Date.UTC(2026, 8, 30), secrets: ["SMTP"] }],
      secrets: [{ name: "SMTP", set: true, suffix: "smtp" }],
    };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (method === "DELETE" && url.endsWith("/grant")) view = { ...view, grants: [] };
      if (method === "PUT") view = { ...view, secrets: [...view.secrets, { name: "API_KEY", set: true, suffix: "9f2c" }] };
      return new Response(JSON.stringify(method === "GET" ? view : {}), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(ProfileToolsSettings, {}));
    await settle(() => root.querySelector("[data-profile-grant]") !== null);
    expect(root.querySelector('[data-profile-grant="prof-1"]')?.textContent).toContain("Mailer");
    expect(root.querySelector('[data-profile-grant="prof-1"]')?.textContent).toContain("reads SMTP");
    expect(root.querySelector('[data-profile-secret="SMTP"]')?.textContent).toContain("set, ending smtp");

    await dom.userEvent('[data-revoke-grant="prof-1"]', "click");
    await settle(() => root.querySelector("[data-profile-grants-empty]") !== null);
    expect(asked.find((entry) => entry.method === "DELETE")).toEqual({ url: "/api/x/profiles/documents/prof-1/grant", method: "DELETE" });

    const name = root.querySelector("[data-new-secret-name]") as HTMLInputElement;
    name.value = "API_KEY";
    await dom.userEvent("[data-new-secret-name]", "input");
    const value = root.querySelector("[data-new-secret-value]") as HTMLInputElement;
    value.value = "sk-live-9f2c";
    await dom.userEvent("[data-new-secret-value]", "input");
    await dom.userEvent("[data-add-secret]", "click");
    await settle(() => root.querySelector('[data-profile-secret="API_KEY"]') !== null);
    expect(asked.find((entry) => entry.method === "PUT")).toEqual({ url: "/api/x/profiles/secrets/API_KEY", method: "PUT", body: JSON.stringify({ value: "sk-live-9f2c" }) });
    expect(root.textContent).not.toContain("sk-live-9f2c");
  });
});
