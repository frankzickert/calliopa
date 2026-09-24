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

/** A model, which is a sender with axes. BO_0279_007 */
const model: SelectableRuntime = {
  id: "media:higgsfield:gpt_image_2",
  label: "GPT Image 2",
  selectable: true,
  reason: null,
  icon: "image",
  options: [
    { axis: "aspect-ratio", label: "Ratio", values: ["1:1", "16:9", "9:16"], start: "1:1" },
    { axis: "resolution", label: "Quality", values: ["1k", "2k", "4k"], start: "2k" },
  ],
};

const signedIn: readonly SelectableRuntime[] = agents.map((agent) => ({
  ...agent,
  selectable: true,
  reason: null,
}));

let written: unknown[] = [];
/** What `GET /api/agent/runtimes` answers now: a test changes it to stand
 * for a sign-in made after the page read the list. CA_0052 */
let served: {
  runtimes: readonly SelectableRuntime[];
  chosen: string | null;
  active: string | null;
} = { runtimes: agents, chosen: null, active: null };
let reads = 0;

beforeEach(() => {
  written = [];
  reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/agent/runtimes") {
        reads += 1;
        return new Response(JSON.stringify(served), { status: 200 });
      }
      if (url === "/api/agent/choice" && init?.method === "PUT") {
        written.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ chosen: "x" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

/** The test's view, settled after it: a test that opened the menu and
 * asserted without waiting leaves its read to land here, not in the next
 * test's mount. */
let last: Parameters<typeof settle>[0] | null = null;

afterEach(async () => {
  if (last !== null) await settle(last);
  last = null;
  vi.unstubAllGlobals();
});

/**
 * Lets a read the menu started without awaiting it land, and draws what it
 * changed: this platform draws only when an event it dispatched ends, so a
 * store written after that waits for the next one — and a draw left pending
 * breaks the next test's mount. Any event flushes it; the host's line takes
 * one and does nothing.
 */
const settle = async (dom: { userEvent: (query: string, event: string) => Promise<void> }) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await dom.userEvent("[data-host-agent]", "click");
};

const mount = async (
  chosen: string | null,
  active: string | null,
  runtimes: readonly SelectableRuntime[] = agents,
) => {
  served = { runtimes, chosen, active };
  const dom = await createDOM();
  await dom.render(jsx(AgentMenuHost, {}));
  const root = dom.screen as unknown as HTMLElement;
  last = dom;
  await dom.userEvent("[data-load]", "click");
  await settle(dom);
  const button = () =>
    root.querySelector("[data-agent-menu]") as HTMLElement | null;
  const list = () =>
    root.querySelector('[role="listbox"]') as HTMLElement | null;
  const options = () =>
    Array.from(root.querySelectorAll('[role="option"]')) as HTMLElement[];
  const axes = () =>
    Array.from(root.querySelectorAll("[data-agent-axis]")) as HTMLSelectElement[];
  const host = () => root.querySelector("[data-host-agent]") as HTMLElement;
  const key = (name: string) =>
    dom.userEvent("[data-agent-menu]", "keydown", { key: name });
  return { ...dom, root, button, list, options, axes, host, key };
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

describe("the agent list follows sign-in", () => {
  it("Given Claude Code signed in after the page read the list, When the menu opens, Then it lists Claude Code able to run and takes it", async () => {
    const view = await mount("codex", "codex");
    served = { ...served, runtimes: signedIn };

    await view.userEvent("[data-agent-menu]", "click");
    await settle(view);

    const claude = view.options()[1];
    expect(claude?.getAttribute("aria-disabled")).toBe("false");
    expect(claude?.textContent).not.toContain("not signed in");
    await view.userEvent('[data-agent="claude-code"]', "click");
    expect(view.host().getAttribute("data-host-agent")).toBe("claude-code");
    expect(written).toEqual([{ agent: "claude-code" }]);
  });

  it("Given the list shown still says Claude Code cannot run but the server now says it can, When it is chosen, Then the press is not lost", async () => {
    const view = await mount("codex", "codex");
    await view.userEvent("[data-agent-menu]", "click");
    await settle(view);
    expect(view.options()[1]?.getAttribute("aria-disabled")).toBe("true");

    served = { ...served, runtimes: signedIn };
    await view.userEvent('[data-agent="claude-code"]', "click");

    expect(view.host().getAttribute("data-host-agent")).toBe("claude-code");
    expect(view.button()?.getAttribute("aria-expanded")).toBe("false");
    expect(written).toEqual([{ agent: "claude-code" }]);
  });

  it("Given the page opened away from the remembered agent, When a view says the agents changed with the menu closed, Then the remembered agent is chosen again and the notice lowered", async () => {
    const view = await mount("claude-code", "codex");
    expect(view.host().getAttribute("data-host-agent")).toBe("codex");

    served = { ...served, runtimes: signedIn };
    await view.userEvent("[data-agents-changed]", "click");

    expect(view.button()?.getAttribute("aria-expanded")).toBe("false");
    expect(view.host().getAttribute("data-host-agent")).toBe("claude-code");
    expect(view.host().getAttribute("data-host-notice")).toBe("");
    expect(view.button()?.getAttribute("aria-label")).toBe(
      "Agent: Claude Code",
    );
    // Nothing is written: the instance already remembers it.
    expect(written).toEqual([]);
  });

  it("Given the reader chose on this page, When the agents change, Then their choice stands", async () => {
    const view = await mount("claude-code", "codex");
    await view.userEvent("[data-agent-menu]", "click");
    await settle(view);
    await view.userEvent('[data-agent="hermes"]', "click");

    served = { ...served, runtimes: signedIn };
    await view.userEvent("[data-agents-changed]", "click");

    expect(view.host().getAttribute("data-host-agent")).toBe("hermes");
  });

  it("Given the list could not be read again, Then the menu keeps the one it had", async () => {
    const view = await mount("codex", "codex");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    await view.userEvent("[data-agent-menu]", "click");
    await settle(view);

    expect(view.options().map((option) => option.getAttribute("data-agent"))).toEqual([
      "codex",
      "claude-code",
      "hermes",
    ]);
    expect(reads).toBe(1);
  });
});

describe("what a model lets a person choose before the press", () => {
  /**
   * A sender may carry axes: what it makes is not only who makes it
   * (`BO_0279_007`). They are drawn in the menu beneath the sender just
   * chosen, and the press is *Send*, which stands in the same chip.
   */
  it("Given an agent chosen, Then no controls are drawn", async () => {
    const view = await mount("codex", "codex");
    expect(view.axes()).toHaveLength(0);
    await view.userEvent("[data-agent-menu]", "click");
    expect(view.axes()).toHaveLength(0);
  });

  it("Given a model chosen, Then its ratio and its quality stand in the chip, each starting where the model says", async () => {
    const view = await mount(model.id, "codex", [...agents, model]);
    const drawn = view.axes();
    expect(drawn.map((one) => one.getAttribute("data-agent-axis"))).toEqual([
      "aspect-ratio",
      "resolution",
    ]);
    // The values the model takes, and nothing invented.
    expect(
      Array.from(drawn[1]?.querySelectorAll("option") ?? []).map((one) => one.getAttribute("value")),
    ).toEqual(["1k", "2k", "4k"]);
    expect(drawn[0]?.getAttribute("value")).toBe("1:1");
    expect(drawn[1]?.getAttribute("value")).toBe("2k");
  });

  it("Given the list closed, Then the controls still stand, because choosing closes it", async () => {
    // `pick` closes the list on a choice. Drawn inside it, these could only be
    // seen before a model was chosen — which is to say never. BO_0279_007
    const view = await mount(model.id, "codex", [...agents, model]);
    expect(view.list()?.hasAttribute("hidden")).toBe(true);
    expect(view.axes()).toHaveLength(2);
  });

  it("Given a model chosen from the open list, Then the list closes and the controls remain", async () => {
    const view = await mount("codex", "codex", [...agents, model]);
    await view.userEvent("[data-agent-menu]", "click");
    await view.userEvent(`[data-agent="${model.id}"]`, "click");
    expect(view.list()?.hasAttribute("hidden")).toBe(true);
    expect(view.axes().map((one) => one.getAttribute("data-agent-axis"))).toEqual([
      "aspect-ratio",
      "resolution",
    ]);
  });
});
