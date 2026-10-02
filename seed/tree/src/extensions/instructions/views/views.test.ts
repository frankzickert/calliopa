import { $, component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionControl } from "~/components/shell/inspector";
import { ViewBridgeContext, type ViewBar, type ViewBridge } from "~/components/shell/view-bridge";

import type { GrantView, InstructionChoices, InstructionGrants, InstructionTools } from "../lib/instructions";
import { InstructionChip } from "./chip";
import { InstructionToolsSettings } from "./settings";
import { InstructionToolsProvider, ToolHeadline } from "./tools";

/**
 * The instructions extension's surfaces in Qwik's render harness
 * (`calliopa-bootstrap`'s `BO_0311_013`): the chip in a block's command —
 * *No instruction* first, the instructions for the block's roles grouped before the
 * rest, the person's last restored, a choice set as the command's option —
 * and on an instruction's document each code block named as its tool with its
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

const chip = () => jsx(InstructionChip, { documentId: "doc-1", blockId: "blk-1", revisionId: "rev-1", active: true, setOption$ });

afterEach(() => {
  options.length = 0;
  raised.length = 0;
  vi.unstubAllGlobals();
});

describe("the instruction in the command chip", () => {
  const answering = (choices: InstructionChoices, asked: string[] = []) => async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify(choices), { status: 200 });
  };

  it("restores the person's last, offers No instruction then the block's roles' instructions then the rest, and sets the choice on the command", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", answering({ reachable: true, isInstruction: false, instructions: [blog, exploration, archive], last: blog.id }, asked));
    const { root, settle, dom } = await mount(chip());
    await settle(() => root.querySelector("[data-instruction-toggle]") !== null && options.length > 0);
    expect(asked).toEqual(["/api/x/instructions/documents/doc-1/blocks/blk-1/choices"]);
    expect(options).toEqual([{ name: "instruction", value: blog.id }]);
    expect(root.querySelector("[data-instruction-toggle]")?.getAttribute("title")).toBe("Instruction: Blog post");

    await dom.userEvent("[data-instruction-toggle]", "click");
    await settle(() => root.querySelector("[data-instruction-popover]") !== null);
    const offered = Array.from(root.querySelectorAll("[data-instruction-option]")).map((option) => option.textContent?.trim());
    expect(offered).toEqual(["No instruction", "Exploration", "Archive", "Blog post"]);
    expect(root.querySelector(`[data-instruction-matching] [data-instruction-option="${exploration.id}"]`)).toBeTruthy();
    expect(root.querySelector(`[data-instruction-option="${blog.id}"]`)?.getAttribute("aria-pressed")).toBe("true");

    await dom.userEvent(`[data-instruction-option="${exploration.id}"]`, "click");
    await settle(() => options.length > 1);
    expect(options[1]).toEqual({ name: "instruction", value: exploration.id });
    expect(root.querySelector("[data-instruction-popover]")).toBeFalsy();

    await dom.userEvent("[data-instruction-toggle]", "click");
    await settle(() => root.querySelector("[data-instruction-popover]") !== null);
    await dom.userEvent('[data-instruction-option=""]', "click");
    await settle(() => options.length > 2);
    expect(options[2]).toEqual({ name: "instruction", value: null });
    expect(root.querySelector("[data-instruction-toggle]")?.getAttribute("title")).toBe("No instruction");
  });

  it("starts at No instruction on an instruction's own document, and with a last that is no instruction any more", async () => {
    vi.stubGlobal("fetch", answering({ reachable: true, isInstruction: true, instructions: [blog], last: null }));
    const own = await mount(chip());
    await own.settle(() => own.root.querySelector("[data-instruction-toggle]") !== null);
    expect(own.root.querySelector("[data-instruction-toggle]")?.getAttribute("title")).toBe("No instruction");
    vi.stubGlobal("fetch", answering({ reachable: true, isInstruction: false, instructions: [blog], last: "0f0e0d0c-0b0a-4908-8706-050403020100" }));
    const gone = await mount(chip());
    await gone.settle(() => gone.root.querySelector("[data-instruction-toggle]") !== null);
    expect(gone.root.querySelector("[data-instruction-toggle]")?.getAttribute("title")).toBe("No instruction");
    expect(options).toEqual([]);
  });

  it("draws nothing while the instructions cannot be read, or the instance has none", async () => {
    vi.stubGlobal("fetch", answering({ reachable: false, isInstruction: false, instructions: [], last: null }));
    const unread = await mount(chip());
    await unread.settle(() => false);
    expect(unread.root.querySelector("[data-instruction-chip]")).toBeFalsy();
    vi.stubGlobal("fetch", answering({ reachable: true, isInstruction: false, instructions: [], last: null }));
    const none = await mount(chip());
    await none.settle(() => false);
    expect(none.root.querySelector("[data-instruction-chip]")).toBeFalsy();
  });
});

describe("an instruction's tools on its document", () => {
  const grant = (granted: boolean, runtime: string | null = "rt-1"): GrantView => ({
    instruction: "prof-1",
    granted,
    runtime,
    tools: [
      { block: "blk-send", name: "send_an_email", description: "Send an email", state: granted ? "granted" : "never" },
      { block: "blk-count", name: "count_words", description: "Count the words.", state: granted ? "changed" : "never" },
    ],
    ...(granted ? { grantedBy: "frank", grantedAt: 1, secrets: [] } : {}),
  });
  const tree = () =>
    jsx(InstructionToolsProvider, {
      documentId: "prof-1",
      children: [
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-send", revisionId: "r", active: false }),
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-count", revisionId: "r", active: false }),
        jsx(ToolHeadline, { documentId: "prof-1", blockId: "blk-words", revisionId: "r", active: false }),
      ],
    });
  const bar = (root: HTMLElement) => Array.from(root.querySelectorAll("[data-test-bar] button")).map((button) => `${button.getAttribute("aria-label")}=${button.getAttribute("aria-pressed") ?? "button"}`);
  const states = (root: HTMLElement) => Array.from(root.querySelectorAll("[data-instruction-tool]")).map((tool) => `${tool.getAttribute("data-instruction-tool")}: ${tool.querySelector(".instruction-tool__state")?.textContent}`);

  it("shows the owner the grant with a toggle per set secret, and grants and revokes with the secrets chosen", async () => {
    const asked: { url: string; method: string; body?: string }[] = [];
    let granted = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (method === "PUT") granted = true;
      if (method === "DELETE") granted = false;
      if (method !== "GET") return new Response("{}", { status: 200 });
      const tools: InstructionTools = {
        instruction: true,
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
    expect(bar(root)).toEqual(["Grant this instruction outside reach=false", "The grant may read the secret SMTP=false"]);
    expect(states(root)).toEqual(["send_an_email: offline", "count_words: offline"]);

    await dom.userEvent('[data-bar-action="instruction-secret-SMTP"]', "click");
    await settle(() => bar(root)[1] === "The grant may read the secret SMTP=true");
    expect(asked.some((entry) => entry.method !== "GET")).toBe(false);
    await dom.userEvent('[data-bar-action="instruction-grant"]', "click");
    await settle(() => states(root)[0] === "send_an_email: granted");
    expect(asked.find((entry) => entry.method === "PUT")).toEqual({ url: "/api/x/instructions/documents/prof-1/grant", method: "PUT", body: JSON.stringify({ secrets: ["SMTP"] }) });
    expect(states(root)).toEqual(["send_an_email: granted", "count_words: changed since the grant"]);
    expect(bar(root)).toContain("Grant the changed code blocks again=button");

    await dom.userEvent('[data-bar-action="instruction-grant"]', "click");
    await settle(() => asked.some((entry) => entry.method === "DELETE") && states(root)[0] === "send_an_email: offline");
    expect(asked.filter((entry) => entry.method === "DELETE")).toEqual([{ url: "/api/x/instructions/documents/prof-1/grant", method: "DELETE" }]);
  });

  it("shows anyone else the tools' states and no grant, and says the tools cannot run with no runtime", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ instruction: true, owner: false, grant: grant(true), secrets: [] } satisfies InstructionTools), { status: 200 }));
    const reader = await mount(tree());
    await reader.settle(() => states(reader.root).length > 0);
    expect(states(reader.root)).toEqual(["send_an_email: granted", "count_words: changed since the grant"]);
    expect(bar(reader.root)).toEqual([]);

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ instruction: true, owner: true, grant: grant(false, null), secrets: [] } satisfies InstructionTools), { status: 200 }));
    const offline = await mount(tree());
    await offline.settle(() => states(offline.root).length > 0);
    expect(states(offline.root)).toEqual(["send_an_email: cannot run: the instruction is connected to no runtime", "count_words: cannot run: the instruction is connected to no runtime"]);
  });

  it("draws nothing on a document that is no instruction, and raises a refused grant in its words", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ instruction: false } satisfies InstructionTools), { status: 200 }));
    const plain = await mount(tree());
    await plain.settle(() => false);
    expect(states(plain.root)).toEqual([]);
    expect(bar(plain.root)).toEqual([]);

    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ error: "only the owner grants an instruction outside reach" }), { status: 403 })
        : new Response(JSON.stringify({ instruction: true, owner: true, grant: grant(false), secrets: [] } satisfies InstructionTools), { status: 200 }),
    );
    const refused = await mount(tree());
    await refused.settle(() => bar(refused.root).length > 0);
    await refused.dom.userEvent('[data-bar-action="instruction-grant"]', "click");
    await refused.settle(() => raised.length > 0);
    expect(raised).toEqual(["only the owner grants an instruction outside reach"]);
  });
});

// What an instruction makes a picture or a video with is the format its *Format*
// field names (`calliopa-bootstrap`'s `BO_0336_030`): its bar carries no
// instruction type and no backend.
describe("an instruction's bar", () => {
  it("holds no generation setup, and asks for none", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({ instruction: true, owner: false, grant: null, secrets: [] } satisfies InstructionTools), { status: 200 });
    });
    const { root, settle } = await mount(jsx(InstructionToolsProvider, { documentId: "prof-1" }));
    await settle(() => asked.length > 0);
    await settle(() => false);
    expect(root.querySelector('[data-bar-action="profile-type"]')).toBeFalsy();
    expect(root.querySelector('[data-bar-action="profile-image-backend"]')).toBeFalsy();
    expect(asked.some((url) => url.endsWith("/generation-instruction"))).toBe(false);
  });
});

describe("Instruction tools in Settings", () => {
  it("lists the grants with their instructions and revokes one, and keeps the secrets without ever showing a value", async () => {
    const asked: { url: string; method: string; body?: string }[] = [];
    let view: InstructionGrants = {
      grants: [{ instruction: "prof-1", title: "Mailer", grantedBy: "frank", grantedAt: Date.UTC(2026, 8, 30), secrets: ["SMTP"] }],
      secrets: [{ name: "SMTP", set: true, suffix: "smtp" }],
    };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      asked.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (method === "DELETE" && url.endsWith("/grant")) view = { ...view, grants: [] };
      if (method === "PUT") view = { ...view, secrets: [...view.secrets, { name: "API_KEY", set: true, suffix: "9f2c" }] };
      return new Response(JSON.stringify(method === "GET" ? view : {}), { status: 200 });
    });
    const { root, settle, dom } = await mount(jsx(InstructionToolsSettings, {}));
    await settle(() => root.querySelector("[data-instruction-grant]") !== null);
    expect(root.querySelector('[data-instruction-grant="prof-1"]')?.textContent).toContain("Mailer");
    expect(root.querySelector('[data-instruction-grant="prof-1"]')?.textContent).toContain("reads SMTP");
    expect(root.querySelector('[data-instruction-secret="SMTP"]')?.textContent).toContain("set, ending smtp");

    await dom.userEvent('[data-revoke-grant="prof-1"]', "click");
    await settle(() => root.querySelector("[data-instruction-grants-empty]") !== null);
    expect(asked.find((entry) => entry.method === "DELETE")).toEqual({ url: "/api/x/instructions/documents/prof-1/grant", method: "DELETE" });

    const name = root.querySelector("[data-new-secret-name]") as HTMLInputElement;
    name.value = "API_KEY";
    await dom.userEvent("[data-new-secret-name]", "input");
    const value = root.querySelector("[data-new-secret-value]") as HTMLInputElement;
    value.value = "sk-live-9f2c";
    await dom.userEvent("[data-new-secret-value]", "input");
    await dom.userEvent("[data-add-secret]", "click");
    await settle(() => root.querySelector('[data-instruction-secret="API_KEY"]') !== null);
    expect(asked.find((entry) => entry.method === "PUT")).toEqual({ url: "/api/x/instructions/secrets/API_KEY", method: "PUT", body: JSON.stringify({ value: "sk-live-9f2c" }) });
    expect(root.textContent).not.toContain("sk-live-9f2c");
  });
});
