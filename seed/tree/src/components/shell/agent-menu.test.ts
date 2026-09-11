import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SelectableRuntime } from "~/lib/connections";
import { AgentMenuHost } from "./testing/agent-menu-host";

/**
 * The agent dropdown pressed rather than described, through the composer's
 * own wiring (`agent-menu-host.tsx`): the agents arrive after it is drawn, it
 * opens where the instance's choice says, and a choice is written to the
 * instance. Attributes are asserted rather than properties — this DOM's
 * properties are not a browser's (`BO_0225_004`). BO_0228_014
 */
const agents: readonly SelectableRuntime[] = [
  { id: "codex", label: "Codex", selectable: true, reason: null },
  {
    id: "claude-code",
    label: "Claude Code",
    selectable: false,
    reason: "Claude Code is not signed in.",
  },
  { id: "hermes", label: "Hermes · gpt-5.5", selectable: true, reason: null },
];

let written: unknown[] = [];

beforeEach(() => {
  written = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/agent/choice" && init?.method === "PUT") {
        written.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ chosen: "x" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (chosen: string | null, active: string | null) => {
  const dom = await createDOM();
  await dom.render(jsx(AgentMenuHost, { runtimes: agents, chosen, active }));
  const root = dom.screen as unknown as HTMLElement;
  await dom.userEvent("[data-load]", "click");
  const button = () =>
    root.querySelector("[data-agent-menu]") as HTMLElement | null;
  const list = () =>
    root.querySelector('[role="listbox"]') as HTMLElement | null;
  const options = () =>
    Array.from(root.querySelectorAll('[role="option"]')) as HTMLElement[];
  const host = () => root.querySelector("[data-host-agent]") as HTMLElement;
  const key = (name: string) =>
    dom.userEvent("[data-agent-menu]", "keydown", { key: name });
  return { ...dom, root, button, list, options, host, key };
};

describe("the agent dropdown in the composer", () => {
  it("Given the agents arrive, Then the closed control names the chosen agent by its face and label", async () => {
    const view = await mount("hermes", "codex");

    expect(view.button()?.getAttribute("aria-label")).toBe(
      "Agent: Hermes · gpt-5.5",
    );
    expect(view.button()?.getAttribute("role")).toBe("combobox");
    expect(view.button()?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("false");
    expect(view.button()?.querySelector("img")?.getAttribute("src")).toBe(
      "/agents/ftrobot.webp",
    );
    expect(view.list()?.hasAttribute("hidden")).toBe(true);
  });

  it("Given it pressed, Then it lists three agents with their faces, the unusable one with its reason", async () => {
    const view = await mount("codex", "codex");
    await view.userEvent("[data-agent-menu]", "click");

    expect(view.button()?.getAttribute("aria-expanded")).toBe("true");
    expect(view.list()?.hasAttribute("hidden")).toBe(false);
    const options = view.options();
    expect(options.map((option) => option.getAttribute("data-agent"))).toEqual([
      "codex",
      "claude-code",
      "hermes",
    ]);
    expect(
      options.map((option) => option.querySelector("img")?.getAttribute("src")),
    ).toEqual([
      "/agents/codey.webp",
      "/agents/clauderic.webp",
      "/agents/ftrobot.webp",
    ]);
    expect(
      options.map((option) => option.querySelector("img")?.getAttribute("alt")),
    ).toEqual(["", "", ""]);
    expect(
      options.map((option) => option.getAttribute("aria-disabled")),
    ).toEqual(["false", "true", "false"]);
    expect(
      options.map((option) => option.getAttribute("aria-selected")),
    ).toEqual(["true", "false", "false"]);
    expect(options[1]?.textContent).toContain("Claude Code is not signed in.");
  });

  it("Given the keys, Then the arrows move and Enter chooses, closing the list and writing the choice", async () => {
    const view = await mount("codex", "codex");
    await view.key("ArrowDown");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("true");
    expect(view.button()?.getAttribute("aria-activedescendant")).toBe(
      view.options()[0]?.getAttribute("id"),
    );

    await view.key("ArrowDown");
    await view.key("ArrowDown");
    expect(view.options()[2]?.getAttribute("data-active")).toBe("true");
    await view.key("Enter");

    expect(view.host().getAttribute("data-host-agent")).toBe("hermes");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("false");
    expect(view.button()?.getAttribute("aria-label")).toBe(
      "Agent: Hermes · gpt-5.5",
    );
    expect(written).toEqual([{ agent: "hermes" }]);
  });

  it("Given an agent that cannot run chosen, Then the choice stays, the list stays open and nothing is written", async () => {
    const view = await mount("codex", "codex");
    await view.userEvent("[data-agent-menu]", "click");
    await view.userEvent('[data-agent="claude-code"]', "click");

    expect(view.host().getAttribute("data-host-agent")).toBe("codex");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("true");
    expect(written).toEqual([]);

    // The press left the keys on Claude Code; Enter there changes nothing too.
    expect(view.options()[1]?.getAttribute("data-active")).toBe("true");
    await view.key("Enter");
    expect(view.host().getAttribute("data-host-agent")).toBe("codex");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("true");
    expect(written).toEqual([]);
  });

  it("Given an option pressed, Then it is chosen and written", async () => {
    const view = await mount("codex", "codex");
    await view.userEvent("[data-agent-menu]", "click");
    await view.userEvent('[data-agent="hermes"]', "click");

    expect(view.host().getAttribute("data-host-agent")).toBe("hermes");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("false");
    expect(written).toEqual([{ agent: "hermes" }]);
  });

  // A press outside closes the list through a `document:` listener, which
  // this harness never dispatches — it walks `on:` listeners up from the
  // element and nothing else — so that press is the browser walk-through's
  // to prove (BO_0228_015), not this file's.
  it("Given Escape, or the button pressed again, Then the list closes with the choice unchanged", async () => {
    const view = await mount("codex", "codex");
    await view.key("ArrowDown");
    await view.key("ArrowDown");
    await view.key("Escape");
    expect(view.button()?.getAttribute("aria-expanded"), "after Escape").toBe(
      "false",
    );
    expect(view.host().getAttribute("data-host-agent")).toBe("codex");

    await view.userEvent("[data-agent-menu]", "click");
    expect(view.button()?.getAttribute("aria-expanded"), "reopened").toBe(
      "true",
    );
    await view.userEvent("[data-agent-menu]", "click");
    expect(view.button()?.getAttribute("aria-expanded"), "pressed again").toBe(
      "false",
    );
    expect(view.host().getAttribute("data-host-agent")).toBe("codex");
    expect(written).toEqual([]);
  });

  it("Given an instance choice that cannot run, Then it opens on the running agent and says why", async () => {
    const view = await mount("claude-code", "codex");

    expect(view.host().getAttribute("data-host-agent")).toBe("codex");
    expect(view.host().getAttribute("data-host-notice")).toBe(
      "Claude Code is not signed in — opened on Codex.",
    );
    expect(view.button()?.getAttribute("aria-label")).toBe("Agent: Codex");
  });
});
