import {
  $,
  component$,
  jsx,
  useContextProvider,
  useStore,
  type JSXOutput,
} from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ViewBridgeContext,
  type ViewBar,
  type ViewBridge,
} from "~/components/shell/view-bridge";
import {
  EditorSurfaceContext,
  type EditorSurface,
} from "~/extensions/documents/views/editor-surface";

import type {
  DocumentRolesView,
  RolesListing,
  RoleView,
  TakenRole,
} from "../lib/roles";
import { BlockRoleControl, fittingPills, TitleRoleControl } from "./control";
import { RoleLabel } from "./label";
import { RolesProvider, ROLES_CHANGED } from "./provider";
import { RolesSection } from "./section";
import { contributions } from "../contributions";

/**
 * The roles extension's surfaces in Qwik's render harness (`BO_0309_017`):
 * the section listing the roles, built-ins first, each built-in unfolding to
 * the documents carrying it; the pills a roled block carries — one per role,
 * the missing mark, *proposed* and *not offered*; and the role control in a
 * block's chip and under the title — the typeahead limited to what the block
 * can take, a suggestion taken with one press, a role cleared by its ×, a
 * field's value posted on commit, and a refusal said in the route's words.
 * What the routes answer is stood in for by the browser's own `fetch`.
 */

const role = (id: string, name: string, extra: Partial<RoleView> = {}): RoleView => ({
  id,
  name,
  description: "",
  retired: false,
  builtin: false,
  order: 1,
  fields: [],
  offers: [],
  offeredBy: [],
  blocks: true,
  ...extra,
});

const STORY = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const HOOK = "1a2b3c4d-1111-4aaa-8bbb-000000000001";
const BIG = "1a2b3c4d-1111-4aaa-8bbb-000000000002";
const BLOG = "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b";
const OLD = "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c";
const DEFINITION = "4e4e4e4e-4e4e-4e4e-8e4e-4e4e4e4e4e4e";
const KEYWORD = "builtin:keyword";

const keyword = role(KEYWORD, "Keyword", { builtin: true, order: 0, offers: [DEFINITION] });
const definition = role(DEFINITION, "Definition", { order: 6, offeredBy: [KEYWORD] });
const story = role(STORY, "Story", { order: 2, offers: [HOOK, BIG] });
const hook = role(HOOK, "Hook", { order: 3, description: "Opens the story", offeredBy: [STORY] });
const big = role(BIG, "Big Message", { order: 4, offeredBy: [STORY] });
const blog = role(BLOG, "Blog post", {
  order: 5,
  description: "A post for the blog",
  fields: [
    { key: "date", name: "Publishing date", type: "date", required: true },
    { key: "position", name: "Position", type: "number", required: false, default: 1 },
    { key: "channel", name: "Channel", type: "choice", required: false, options: ["Blog", "Newsletter"] },
  ],
});
const old = role(OLD, "Old", { order: 7, retired: true });
const listing: RolesListing = { reachable: true, roles: [story, hook, big, blog, old, definition, keyword] };

const documentId = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const first = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";
const second = "6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f";

const taken = (source: RoleView, extra: Partial<TakenRole> = {}): TakenRole => ({
  id: source.id,
  name: source.name,
  description: source.description,
  retired: source.retired,
  builtin: source.builtin,
  offered: true,
  fields: source.fields,
  values: {},
  missing: source.fields.filter((field) => field.required).map((field) => field.key),
  blocks: source.blocks,
  ...extra,
});

/** A Story document whose first block carries Hook and Blog post. */
const view = (
  firstRoles: readonly TakenRole[] = [taken(hook), taken(blog)],
  documentRoles: readonly TakenRole[] = [taken(story)],
  inherited: DocumentRolesView["inherited"] = [],
): DocumentRolesView => ({
  documentId,
  dataRevision: 7,
  inherited,
  roles: documentRoles,
  takeable: [KEYWORD, STORY, BLOG],
  blocks: [
    { blockId: first, kind: "text", parentId: null, roles: firstRoles, takeable: [KEYWORD, STORY, HOOK, BIG, BLOG] },
    { blockId: second, kind: "image", parentId: null, roles: [], takeable: [KEYWORD, STORY, HOOK, BIG, BLOG] },
  ],
});

const opened: { kind: string; itemId: string; title: string }[] = [];
const hosted = (child: JSXOutput) =>
  component$(() => {
    const decorationBar = useStore<ViewBar>({ groups: [] });
    const bridge = {
      decorationBar,
      openTarget$: $((target: { kind: string; itemId: string; title: string }) => {
        opened.push({ kind: target.kind, itemId: target.itemId, title: target.title });
      }),
    } as unknown as ViewBridge;
    useContextProvider(ViewBridgeContext, bridge);
    const surface = useStore({
      documentId,
      document: null,
      activeBlockId: first,
      focusedBlockId: null,
      focusedItemId: null,
      proposals: null,
      loaded: 1,
      readMark: null,
      notice: null,
    });
    useContextProvider(EditorSurfaceContext, surface as unknown as EditorSurface);
    return jsx("div", {
      children: [jsx("p", { "data-block-id": first, children: "Our publishing plan for the blog post" }), child],
    });
  });

async function mount(child: JSXOutput) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 60; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { dom, root, settle };
}

type Asked = { url: string; body?: unknown };

/** The routes: the catalogue, the document's roles, and each post answered
 * with `answer` or refused. */
const api =
  (asked: Asked[], current: DocumentRolesView, answer: DocumentRolesView = current, refuse = false) =>
  async (url: string, init?: RequestInit) => {
    asked.push({ url, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}) });
    if (url === "/api/library/doc-block-roles/roles") return new Response(JSON.stringify(listing), { status: 200 });
    if (init?.method === "POST") {
      if (refuse)
        return new Response(
          JSON.stringify({
            outcome: "validationFailure",
            failures: [{ operation: null, rule: "notOffered", detail: "Hook is offered by Story, and nothing above this block carries it." }],
          }),
          { status: 422 },
        );
      return new Response(JSON.stringify({ outcome: "success", result: answer }), { status: 200 });
    }
    return new Response(JSON.stringify({ outcome: "success", result: current }), { status: 200 });
  };

const posted = (asked: readonly Asked[]) => asked.filter((entry) => entry.body !== undefined);

const control = (active = true) =>
  jsx(RolesProvider, {
    documentId,
    children: [
      jsx(RoleLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "label"),
      jsx(BlockRoleControl, { documentId, blockId: first, revisionId: "rev:1", active }, "control"),
    ],
  });

afterEach(() => {
  opened.length = 0;
  vi.unstubAllGlobals();
});

describe("the Roles section", () => {
  const section = (data: RolesListing) =>
    jsx(RolesSection, { data, activeItemId: STORY, sectionKey: "doc-block-roles:roles", filter: null, setFilter$: $(async () => {}) });

  it("lists the roles with the built-ins first and retired ones left out, and opens one on its page", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(listing), { status: 200 }));
    const { root, settle, dom } = await mount(section(listing));
    const rows = () => Array.from(root.querySelectorAll("[data-role-row]")).map((row) => row.querySelector(".library-entry__label")?.textContent);
    expect(rows()).toEqual(["Keyword", "Story", "Hook", "Big Message", "Blog post", "Definition"]);
    expect(root.querySelector(`[data-role-row="${KEYWORD}"] .roles-row__builtin`)?.textContent).toBe("built in");
    expect(root.querySelector(`[data-role-row="${STORY}"]`)?.getAttribute("aria-current")).toBe("true");
    await dom.userEvent(`[data-role-row="${BLOG}"]`, "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "doc-block-roles:documentRole", itemId: BLOG, title: "Blog post" }]);
  });

  it("unfolds a built-in to the documents carrying it, each opening as itself", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push({ url });
      return new Response(JSON.stringify({ outcome: "success", result: [{ id: documentId, title: "Quantum computing" }] }), { status: 200 });
    });
    const { root, settle, dom } = await mount(section(listing));
    expect(root.querySelector(`[data-unfold-role="${STORY}"]`)).toBeFalsy();
    await dom.userEvent(`[data-unfold-role="${KEYWORD}"]`, "click");
    await settle(() => root.querySelector("[data-carrying-document]") !== null);
    expect(asked.map((entry) => entry.url)).toEqual([`/api/x/doc-block-roles/roles/${encodeURIComponent(KEYWORD)}/documents`]);
    expect(root.querySelector("[data-carrying-document]")?.textContent?.trim()).toBe("Quantum computing");
    await dom.userEvent("[data-carrying-document]", "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: documentId, title: "Quantum computing" }]);
  });

  it("says when there are none, and when they could not be read", async () => {
    const none = await mount(section({ reachable: true, roles: [old] }));
    expect(none.root.querySelector("[data-roles-empty]")?.textContent?.trim()).toBe("No roles yet");
    const unread = await mount(section({ reachable: false, roles: [] }));
    expect(unread.root.querySelector("[data-roles-empty]")?.textContent?.trim()).toBe("The roles could not be read");
  });
});

describe("the pills at a roled block", () => {
  it("draws one pill per role, marks a missing required value, and says proposed and not offered", async () => {
    vi.stubGlobal(
      "fetch",
      api([], view([taken(hook, { offered: false }), taken(blog), taken(big, { proposed: "role" })])),
    );
    const { root, settle } = await mount(
      jsx(RolesProvider, {
        documentId,
        children: [
          jsx(RoleLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "first"),
          jsx(RoleLabel, { documentId, blockId: second, revisionId: "rev:2", active: false }, "second"),
        ],
      }),
    );
    await settle(() => root.querySelectorAll("[data-block-role]").length > 2);
    const pills = Array.from(root.querySelectorAll("[data-block-role]"));
    expect(pills.map((pill) => pill.getAttribute("data-block-role"))).toEqual([HOOK, BLOG, BIG]);
    expect(pills[0]?.getAttribute("data-role-state")).toBe("not offered");
    expect(pills[1]?.getAttribute("data-role-missing")).toBe("true");
    expect(pills[1]?.getAttribute("title")).toBe("A post for the blog. Missing: Publishing date");
    expect(pills[2]?.querySelector(".block-role__state")?.textContent).toBe("proposed");
    expect(root.querySelectorAll(`[data-block-roles-of="${second}"]`)).toHaveLength(0);
  });
});

describe("the role control in the roles chip below a block's command chip", () => {
  it("opens on the roles taken, offers only what the block can take, narrowed by what is typed, and takes one with a press", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), view([taken(hook), taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-roles-popover]") !== null);
    expect(Array.from(root.querySelectorAll("[data-taken-role]")).map((row) => row.getAttribute("data-taken-role"))).toEqual([HOOK]);
    // Definition is offered by Keyword alone, and nothing here carries it.
    expect(Array.from(root.querySelectorAll("[data-take-role]")).map((button) => button.getAttribute("data-take-role"))).toEqual([KEYWORD, STORY, BIG, BLOG]);

    const query = root.querySelector("[data-role-query]") as HTMLInputElement;
    query.value = "blo";
    await dom.userEvent("[data-role-query]", "input");
    await settle(() => root.querySelectorAll("[data-take-role]").length === 1);
    expect(root.querySelector("[data-take-role]")?.getAttribute("data-take-role")).toBe(BLOG);

    await dom.userEvent(`[data-take-role="${BLOG}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([{ url: `/api/x/doc-block-roles/documents/${documentId}/blocks/${first}/roles`, body: { role: BLOG, taken: true } }]);
    await settle(() => root.querySelectorAll("[data-taken-role]").length === 2);
    // The role just taken opens on its fields.
    expect(root.querySelector(`[data-taken-role="${BLOG}"]`)?.getAttribute("data-expanded")).toBe("true");
  });

  it("suggests the roles offered from above first and a role the block's words meet, each taken with one press", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-role-suggestions]") !== null);
    // Story on the document offers Hook and Big Message; the words say "blog post".
    expect(Array.from(root.querySelectorAll("[data-suggested-role]")).map((button) => button.getAttribute("data-suggested-role"))).toEqual([HOOK, BIG, BLOG]);
    await dom.userEvent(`[data-suggested-role="${BIG}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)[0]?.body).toEqual({ role: BIG, taken: true });
  });

  it("clears a role with its ×", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector(`[data-clear-role="${HOOK}"]`) !== null);
    await dom.userEvent(`[data-clear-role="${HOOK}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([{ url: `/api/x/doc-block-roles/documents/${documentId}/blocks/${first}/roles`, body: { role: HOOK, taken: false } }]);
  });

  it("edits a role's fields under it, each value posted on commit", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(blog, { values: { position: 1 } })])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-role="${BLOG}"]`) !== null);
    // A pill in the chip opens the popover unfolded at its role.
    await dom.userEvent(`[data-chip-role="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-role-fields]") !== null);
    expect(Array.from(root.querySelectorAll("[data-role-field]")).map((input) => input.getAttribute("data-field-type"))).toEqual(["date", "number", "choice"]);
    expect(root.querySelector('[data-role-field="date"]')?.getAttribute("data-missing")).toBe("true");
    expect((root.querySelector('[data-role-field="position"]') as HTMLInputElement).value).toBe("1");

    (root.querySelector('[data-role-field="date"]') as HTMLInputElement).value = "2026-10-01";
    await dom.userEvent('[data-role-field="date"]', "change");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([
      { url: `/api/x/doc-block-roles/documents/${documentId}/blocks/${first}/roles/${BLOG}/fields`, body: { values: { date: "2026-10-01" } } },
    ]);
  });

  it("says a refusal beside the control in the route's words", async () => {
    vi.stubGlobal("fetch", api([], view([]), view([]), true));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector(`[data-take-role="${HOOK}"]`) !== null);
    await dom.userEvent(`[data-take-role="${HOOK}"]`, "click");
    await settle(() => root.querySelector("[data-role-refusal]") !== null);
    expect(root.querySelector("[data-role-refusal]")?.textContent).toBe("Hook is offered by Story, and nothing above this block carries it.");
  });

  it("opens at the role a pill was pressed on", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook), taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-block-role="${BLOG}"]`) !== null);
    await dom.userEvent(`[data-block-role="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-roles-popover]") !== null);
    expect(root.querySelector(`[data-taken-role="${BLOG}"]`)?.getAttribute("data-expanded")).toBe("true");
  });

  it("draws nothing while the roles cannot be read", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify({ reachable: false, roles: [] }), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: view() }), { status: 200 }),
    );
    const { root, settle } = await mount(control());
    await settle(() => false);
    expect(root.querySelector("[data-roles-add]")).toBeFalsy();
  });

  it("shows the roles taken as pills and a +, with nothing else at rest", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook, { offered: false }), taken(blog)])));
    const { root, settle } = await mount(control());
    await settle(() => root.querySelectorAll("[data-chip-role]").length === 2);
    const chip = root.querySelector(`[data-role-control="${first}"]`)!;
    expect(chip.getAttribute("data-role-form")).toBe("pills");
    const pills = Array.from(chip.querySelectorAll("[data-chip-role]"));
    expect(pills.map((pill) => pill.getAttribute("data-chip-role"))).toEqual([HOOK, BLOG]);
    expect(pills[0]?.querySelector(".block-role__state")?.textContent).toBe("not offered");
    expect(pills[1]?.getAttribute("data-role-missing")).toBe("true");
    expect(pills[1]?.getAttribute("title")).toBe("A post for the blog. Missing: Publishing date");
    expect(chip.querySelector("[data-roles-add]")?.getAttribute("aria-label")).toBe("Add a role to this block");
    expect(chip.querySelector("[data-roles-toggle]")).toBeFalsy();
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
  });

  it("holds the + alone on a block with no roles, opening the typeahead and the suggestions", async () => {
    vi.stubGlobal("fetch", api([], view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    expect(root.querySelectorAll("[data-chip-role]")).toHaveLength(0);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-roles-popover]") !== null);
    expect(root.querySelector("[data-role-query]")).toBeTruthy();
    expect(root.querySelector("[data-role-suggestions]")).toBeTruthy();
    expect(root.querySelector("[data-roles-add]")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes what is open on a second press", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-role="${BLOG}"]`) !== null);
    await dom.userEvent(`[data-chip-role="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-roles-popover]") !== null);
    expect(root.querySelector(`[data-chip-role="${BLOG}"]`)?.getAttribute("aria-expanded")).toBe("true");
    await dom.userEvent(`[data-chip-role="${BLOG}"]`, "click");
    await settle(() => !root.querySelector("[data-roles-popover]"));
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
  });

  it("keeps the reading pills while the block is edited", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook)])));
    const { root, settle } = await mount(
      jsx(RolesProvider, {
        documentId,
        children: [
          jsx(RoleLabel, { documentId, blockId: first, revisionId: "rev:1", active: true }, "label"),
          jsx(BlockRoleControl, { documentId, blockId: first, revisionId: "rev:1", active: true }, "control"),
        ],
      }),
    );
    await settle(() => root.querySelector(`[data-block-role="${HOOK}"]`) !== null && root.querySelector(`[data-chip-role="${HOOK}"]`) !== null);
    expect(root.querySelector(`[data-block-role="${HOOK}"]`)).toBeTruthy();
  });

  it("closes from the dimmed page around it, as the phone's sheet does", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    expect(root.querySelector("[data-roles-backdrop]")).toBeFalsy();
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-roles-backdrop]") !== null);
    await dom.userEvent("[data-roles-backdrop]", "click");
    await settle(() => !root.querySelector("[data-roles-popover]"));
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
    expect(root.querySelector("[data-roles-backdrop]")).toBeFalsy();
  });

  it("closes when its handle is swiped down far enough, and settles back when not", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-roles-handle]") !== null);
    // A short swipe: the sheet follows the finger and settles back.
    await dom.userEvent("[data-roles-handle]", "touchstart", { touches: [{ clientY: 400 }] });
    await dom.userEvent("[data-roles-handle]", "touchmove", { touches: [{ clientY: 430 }] });
    await settle(() => root.querySelector("[data-roles-popover]")?.getAttribute("style")?.includes("30px") === true);
    await dom.userEvent("[data-roles-handle]", "touchend");
    await settle(() => !root.querySelector("[data-roles-popover]")?.getAttribute("style"));
    expect(root.querySelector("[data-roles-popover]")).toBeTruthy();
    // A long one closes it.
    await dom.userEvent("[data-roles-handle]", "touchstart", { touches: [{ clientY: 400 }] });
    await dom.userEvent("[data-roles-handle]", "touchmove", { touches: [{ clientY: 520 }] });
    await dom.userEvent("[data-roles-handle]", "touchend");
    await settle(() => !root.querySelector("[data-roles-popover]"));
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
  });

  it("is placed beside its chip once opened, and hidden until it is (RO_0004_001)", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    const chip = root.querySelector("[data-role-control]") as HTMLElement;
    // The harness lays nothing out: give its window the size of a desktop and
    // the chip a box near the top, as a browser would measure them.
    const harness = chip.ownerDocument.defaultView as unknown as Record<string, unknown>;
    Object.assign(harness, {
      innerWidth: 1280,
      innerHeight: 800,
      getComputedStyle: () => ({ fontSize: "16px", overflowY: "visible" }),
    });
    Object.assign(chip, { getBoundingClientRect: () => ({ top: 100, left: 900, right: 1000, bottom: 124 }) });
    expect(chip.getAttribute("data-roles-side")).toBeNull();
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => chip.getAttribute("data-roles-side") !== null);
    expect(chip.getAttribute("data-roles-side")).toBe("below");
    // Ending at the chip's right edge, 22rem wide, the room below capped.
    const style = chip.getAttribute("style") ?? "";
    expect(style).toContain(`--roles-left: ${1000 - 352}px`);
    expect(style).toContain("--roles-top: 130px");
    expect(style).toContain("--roles-bottom: auto");
    expect(style).toContain(`--roles-room: ${800 - 8 - 130}px`);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => !root.querySelector("[data-roles-popover]"));
    expect(chip.getAttribute("data-roles-side")).toBeNull();
    expect(chip.getAttribute("style")).toBeNull();
  });

  it("raises the dimmed page and then the popover into the top layer, over the shell's bars", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    // The harness has no top layer: record what the browser would be asked
    // to raise, and in which order.
    const raised: string[] = [];
    const div = Object.getPrototypeOf(root.ownerDocument.createElement("div")) as Record<string, unknown>;
    div.showPopover = function (this: HTMLElement) {
      raised.push(this.hasAttribute("data-roles-backdrop") ? "backdrop" : this.hasAttribute("data-roles-popover") ? "popover" : "other");
    };
    try {
      await dom.userEvent("[data-roles-add]", "click");
      await settle(() => raised.length === 2);
      expect(raised).toEqual(["backdrop", "popover"]);
      expect(root.querySelector("[data-roles-popover]")?.getAttribute("popover")).toBe("manual");
      expect(root.querySelector("[data-roles-backdrop]")?.getAttribute("popover")).toBe("manual");
    } finally {
      delete div.showPopover;
    }
  });

  it("closes on a press outside it and its chip, and lets the press act (RO_0004_006)", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-role="${BLOG}"]`) !== null);
    const press = (element: Element) => {
      const event = element.ownerDocument.createEvent("Event");
      event.initEvent("pointerdown", true, true);
      element.dispatchEvent(event);
      return event;
    };
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-roles-popover]") !== null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Inside the popover and on its chip, it stays open.
    press(root.querySelector("[data-role-query]")!);
    press(root.querySelector(`[data-chip-role="${BLOG}"]`)!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.querySelector("[data-roles-popover]")).toBeTruthy();
    // Outside, on the block's words, it closes and the press is not prevented.
    const outside = press(root.querySelector(`[data-block-id="${first}"]`)!);
    expect(outside.defaultPrevented).toBe(false);
    await settle(() => !root.querySelector("[data-roles-popover]"));
    expect(root.querySelector("[data-roles-popover]")).toBeFalsy();
  });

  it("is contributed beside the command chip, and nothing of roles stands in the command chip", () => {
    const places = contributions.decorations?.document?.places ?? {};
    expect(places.underCommand).toBe(BlockRoleControl);
    expect(places.command).toBeUndefined();
  });
});

// The document header's rows (`DO_0030_004`, `DO_0030_005`, `DO_0030_011`):
// the roles line always drawn — the roles from above, the document's own pills
// and a `+` — the values line under it, and in the compact header the pills
// alone.
describe("the roles and values lines in the document's header", () => {
  const fromAbove = [{ id: HOOK, name: "Hook", description: "", on: "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a", document: "doc-parent" }];

  it("takes the document's own roles from the + and announces what the route answered", async () => {
    const asked: Asked[] = [];
    const after = view([taken(hook)], [taken(story), taken(keyword)]);
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), after));
    const announced: unknown[] = [];
    const listen = (event: Event) => announced.push((event as CustomEvent).detail);
    const { root, settle, dom } = await mount(jsx(TitleRoleControl, { documentId, form: "full" }));
    const page = root.ownerDocument as unknown as EventTarget;
    page.addEventListener(ROLES_CHANGED, listen);
    try {
      await settle(() => root.querySelector('[data-role-control="document"] [data-roles-add]') !== null);
      expect(Array.from(root.querySelectorAll('[data-role-control="document"] [data-chip-role]')).map((pill) => pill.getAttribute("data-chip-role"))).toEqual([STORY]);
      expect(root.querySelector("[data-roles-toggle]")).toBeFalsy();
      expect(root.querySelector('[data-role-control="document"] [data-roles-add]')?.getAttribute("aria-label")).toBe("Add a role to this document");
      await dom.userEvent('[data-role-control="document"] [data-roles-add]', "click");
      await settle(() => root.querySelector(`[data-take-role="${KEYWORD}"]`) !== null);
      expect(Array.from(root.querySelectorAll("[data-take-role]")).map((button) => button.getAttribute("data-take-role"))).toEqual([KEYWORD, BLOG]);
      await dom.userEvent(`[data-take-role="${KEYWORD}"]`, "click");
      await settle(() => posted(asked).length > 0 && announced.length > 0);
      expect(posted(asked)).toEqual([{ url: `/api/x/doc-block-roles/documents/${documentId}/roles`, body: { role: KEYWORD, taken: true } }]);
      expect(announced).toEqual([after]);
    } finally {
      page.removeEventListener(ROLES_CHANGED, listen);
    }
  });

  it("draws the roles from above, the own pills and the + with nothing focused, and a pill opens its role", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog)], fromAbove)));
    const { root, settle, dom } = await mount(jsx(TitleRoleControl, { documentId }));
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    const line = root.querySelector(".title-roles__line")!;
    expect(Array.from(line.querySelectorAll("[data-inherited-role], [data-chip-role], [data-roles-add]")).map((element) =>
      element.getAttribute("data-inherited-role") ?? element.getAttribute("data-chip-role") ?? "+",
    )).toEqual([HOOK, STORY, BLOG, "+"]);
    expect(line.querySelector(`[data-inherited-role="${HOOK}"]`)?.getAttribute("data-role-state")).toBe("from above");
    await dom.userEvent(`[data-chip-role="${BLOG}"]`, "click");
    await settle(() => root.querySelector(`[data-role-fields="${BLOG}"]`) !== null);
    expect(root.querySelector(`[data-chip-role="${BLOG}"]`)?.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the filled values per role, leaves out empty fields and roles with none, and shows a committed value at once", async () => {
    const asked: Asked[] = [];
    const before = view([], [taken(story), taken(blog, { values: { date: "2026-10-12", position: null } })]);
    const after = view([], [taken(story), taken(blog, { values: { date: "2026-10-12", position: 3, channel: "Newsletter" } })]);
    vi.stubGlobal("fetch", api(asked, before, after));
    const { root, settle, dom } = await mount(jsx(TitleRoleControl, { documentId }));
    await settle(() => root.querySelector("[data-role-values]") !== null);
    const values = () => root.querySelector("[data-role-values]")?.textContent?.replace(/\s+/gu, " ").trim();
    expect(root.querySelector(`[data-role-values-of="${STORY}"]`)).toBeFalsy();
    expect(values()).toMatch(/^Blog post: .*2026$/u);
    await dom.userEvent(`[data-chip-role="${BLOG}"]`, "click");
    await settle(() => root.querySelector('[data-role-field="channel"]') !== null);
    const channel = root.querySelector('[data-role-field="channel"]') as HTMLSelectElement;
    channel.value = "Newsletter";
    await dom.userEvent('[data-role-field="channel"]', "change");
    await settle(() => (values() ?? "").includes("Newsletter"));
    expect(values()).toMatch(/^Blog post: .*2026, 3, Newsletter$/u);
  });

  it("draws nothing for values when none is filled", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog)])));
    const { root, settle } = await mount(jsx(TitleRoleControl, { documentId }));
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    expect(root.querySelector("[data-role-values]")).toBeFalsy();
  });

  it("draws the pills alone in the compact header: no +, no values, nothing to press", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog, { values: { date: "2026-10-12" } })], fromAbove)));
    const { root, settle } = await mount(jsx(TitleRoleControl, { documentId, form: "compact" }));
    await settle(() => root.querySelector('[data-title-roles="compact"]') !== null);
    expect(Array.from(root.querySelectorAll("[data-compact-role]")).map((pill) => pill.textContent)).toEqual(["Hook", "Story", "Blog post"]);
    expect(root.querySelector('[data-compact-role$=":' + HOOK + '"]')?.getAttribute("data-role-state")).toBe("from above");
    expect(root.querySelector("[data-roles-add]")).toBeFalsy();
    expect(root.querySelector("[data-role-values]")).toBeFalsy();
    expect(root.querySelector('[data-title-roles="compact"] button')).toBeFalsy();
  });
});

describe("fittingPills", () => {
  it("Given pills that fit, Then all of them", () => {
    expect(fittingPills([40, 50, 30], 6, 200)).toBe(3);
  });

  it("Given pills that do not fit, Then as many as leave room for the count", () => {
    // All three: 162. Two with the count: 40 + 6 + 50 + 6 + 34 = 136.
    expect(fittingPills([40, 50, 60], 6, 140)).toBe(2);
    expect(fittingPills([40, 50, 60], 6, 120)).toBe(1);
    expect(fittingPills([40, 50, 60], 6, 20)).toBe(0);
  });
});

// *Keyword*'s page (`calliopa-bootstrap`'s `BO_0310_031`): one *Send with
// prompt* switch per field and per offered role, the definition on as a fresh
// install holds it; a flip posts the one act and shows what the route
// answered; the offers the release makes carry no ×.
describe("Keyword's page", () => {
  const ALIAS = "builtin:alias";
  const builtinKeyword = role(KEYWORD, "Keyword", {
    builtin: true,
    order: 0,
    offers: ["builtin:definition", ALIAS],
    fields: [{ key: "domain", name: "Domain", type: "text", required: false }],
    sendWithPrompt: ["builtin:definition"],
  });
  const builtinDefinition = role("builtin:definition", "Definition", { builtin: true, order: 4, offeredBy: [KEYWORD] });
  const builtinAlias = role(ALIAS, "Alias", { builtin: true, order: 5, offeredBy: [KEYWORD] });

  it("draws a switch per field and offered role, and posts a flip", async () => {
    const { RolePage } = await import("./role-page");
    const asked: Asked[] = [];
    let current = builtinKeyword;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}) });
      if (url === "/api/library/doc-block-roles/roles")
        return new Response(JSON.stringify({ reachable: true, roles: [builtinKeyword, builtinDefinition, builtinAlias] }), { status: 200 });
      if (init?.method === "POST") current = { ...current, sendWithPrompt: ["builtin:definition", "domain"] };
      return new Response(JSON.stringify({ outcome: "success", result: current }), { status: 200 });
    });
    const tab = { id: "tab-1", kind: "doc-block-roles:documentRole", itemId: KEYWORD, title: "Keyword" };
    const { root, settle, dom } = await mount(jsx(RolePage, { tab } as never));
    await settle(() => root.querySelector("[data-send-with-prompt]") !== null);
    const switches = () =>
      Array.from(root.querySelectorAll("[data-send-with-prompt-entry]")).map((input) => [
        input.getAttribute("data-send-with-prompt-entry"),
        (input as HTMLInputElement).checked,
      ]);
    expect(switches()).toEqual([
      ["domain", false],
      ["builtin:definition", true],
      [ALIAS, false],
    ]);
    expect(root.querySelector(`[data-unoffer="${ALIAS}"]`)).toBeFalsy();
    expect(root.querySelector(`[data-builtin-offer="${ALIAS}"]`)).toBeTruthy();
    const domain = root.querySelector('[data-send-with-prompt-entry="domain"]') as HTMLInputElement;
    domain.checked = true;
    await dom.userEvent('[data-send-with-prompt-entry="domain"]', "change");
    await settle(() => posted(asked).length > 0 && switches()[0]?.[1] === true);
    expect(posted(asked).map((entry) => entry.body)).toEqual([{ command: "sendWithPrompt", entry: "domain", on: true }]);
    expect(switches()[0]).toEqual(["domain", true]);
  });

  it("draws no switches on any other role", async () => {
    const { RolePage } = await import("./role-page");
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify(listing), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: blog }), { status: 200 }),
    );
    const tab = { id: "tab-2", kind: "doc-block-roles:documentRole", itemId: BLOG, title: "Blog post" };
    const { root, settle } = await mount(jsx(RolePage, { tab } as never));
    await settle(() => root.querySelector("[data-role-page]") !== null);
    expect(root.querySelector("[data-role-page]")).toBeTruthy();
    expect(root.querySelector("[data-send-with-prompt]")).toBeFalsy();
  });
});

describe("a block's focused work", () => {
  const parent = "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a";
  const storyBlock = "9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b";
  const fromAbove = [{ id: STORY, name: "Story", description: "", on: storyBlock, document: parent }];

  it("shows the roles above it in its header, from above, and none of them removable there", async () => {
    vi.stubGlobal("fetch", api([], view([], [], fromAbove)));
    const { root, settle } = await mount(jsx(TitleRoleControl, { documentId }));
    await settle(() => root.querySelector("[data-inherited-role]") !== null);
    const pill = root.querySelector(`[data-inherited-role="${STORY}"]`)!;
    expect(pill.querySelector(".block-role__name")?.textContent).toBe("Story");
    expect(pill.querySelector(".block-role__state")?.textContent).toBe("from above");
    expect(root.querySelector(`[data-clear-role="${STORY}"]`)).toBeFalsy();
  });

  it("suggests to a block what the block it was opened from offers", async () => {
    vi.stubGlobal("fetch", api([], view([], [], fromAbove)));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-roles-add]") !== null);
    await dom.userEvent("[data-roles-add]", "click");
    await settle(() => root.querySelector("[data-role-suggestions]") !== null);
    expect(Array.from(root.querySelectorAll("[data-suggested-role]")).map((button) => button.getAttribute("data-suggested-role")).slice(0, 2)).toEqual([HOOK, BIG]);
  });
});

// BO_0312_010: Format's type and schema are the release's — no ×, and the
// type and its options cannot be changed — while a field the person added
// beside them can be removed.
describe("Format's page", () => {
  const FORMAT = "builtin:format";
  const builtinFormat = role(FORMAT, "Format", {
    builtin: true,
    order: 2,
    fields: [
      { key: "type", name: "Type", type: "choice", required: true, options: ["text", "table", "image", "video", "PDF", "structured"] },
      { key: "schema", name: "Schema", type: "longText", required: false },
      { key: "paper", name: "Paper size", type: "text", required: false },
    ],
  });

  it("draws the built-in fields fixed and a person's own removable", async () => {
    const { RolePage } = await import("./role-page");
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify({ reachable: true, roles: [builtinFormat] }), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: builtinFormat }), { status: 200 }),
    );
    const tab = { id: "tab-3", kind: "doc-block-roles:documentRole", itemId: FORMAT, title: "Format" };
    const { root, settle } = await mount(jsx(RolePage, { tab } as never));
    await settle(() => root.querySelector('[data-field-row="type"]') !== null);
    expect(root.querySelector('[data-field-row="type"]')?.getAttribute("data-builtin-field")).toBe("true");
    expect(root.querySelector('[data-remove-field="type"]')).toBeFalsy();
    expect(root.querySelector('[data-remove-field="schema"]')).toBeFalsy();
    expect((root.querySelector('[data-field-type-of="type"]') as HTMLSelectElement).disabled).toBe(true);
    expect((root.querySelector('[data-field-options="type"]') as HTMLInputElement).disabled).toBe(true);
    expect(root.querySelector('[data-remove-field="paper"]')).toBeTruthy();
    expect(root.querySelector('[data-field-row="paper"]')?.getAttribute("data-builtin-field")).toBeNull();
  });
});

describe("roles taken by documents alone", () => {
  it("says on a block's pill that blocks may no longer take the role it keeps", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook, { blocks: false, notOnBlock: true }), taken(blog)])));
    const { root, settle } = await mount(
      jsx(RolesProvider, {
        documentId,
        children: [jsx(RoleLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "first")],
      }),
    );
    await settle(() => root.querySelectorAll("[data-block-role]").length > 1);
    const pills = Array.from(root.querySelectorAll("[data-block-role]"));
    expect(pills[0]?.getAttribute("data-role-state")).toBe("not allowed on a block");
    expect(pills[0]?.getAttribute("title")).toBe("Hook is not allowed on a block");
    expect(pills[1]?.getAttribute("data-role-state")).toBeNull();
  });

  it("switches a person's role to documents alone, and says where an offered document-only role is taken", async () => {
    const { RolePage } = await import("./role-page");
    const asked: Asked[] = [];
    const documentHook = { ...hook, blocks: false };
    let current = story;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}) });
      if (url === "/api/library/doc-block-roles/roles")
        return new Response(JSON.stringify({ reachable: true, roles: [story, documentHook, big] }), { status: 200 });
      if (init?.method === "POST") current = { ...current, blocks: false };
      return new Response(JSON.stringify({ outcome: "success", result: current }), { status: 200 });
    });
    const tab = { id: "tab-4", kind: "doc-block-roles:documentRole", itemId: STORY, title: "Story" };
    const { root, settle, dom } = await mount(jsx(RolePage, { tab } as never));
    await settle(() => root.querySelector("[data-role-blocks]") !== null);
    const toggle = () => root.querySelector("[data-role-blocks]") as HTMLInputElement;
    expect(toggle().checked).toBe(true);
    expect(toggle().disabled).toBe(false);
    expect(root.querySelector(`[data-offer-document-only="${HOOK}"]`)?.textContent).toBe(
      "taken by the document under a block carrying Story, never by its blocks",
    );
    expect(root.querySelector(`[data-offer-document-only="${BIG}"]`)).toBeFalsy();
    toggle().checked = false;
    await dom.userEvent("[data-role-blocks]", "change");
    await settle(() => posted(asked).length > 0 && !toggle().checked);
    expect(posted(asked).map((entry) => entry.body)).toEqual([{ command: "blocks", allowed: false }]);
    expect(root.querySelector("[data-role-blocks-row]")?.textContent).toContain("taken by documents alone");
  });

  it("draws a built-in's switch fixed, as the release says", async () => {
    const { RolePage } = await import("./role-page");
    const format = role("builtin:format", "Format", { builtin: true, order: 2, blocks: false });
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/doc-block-roles/roles"
        ? new Response(JSON.stringify({ reachable: true, roles: [format] }), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: format }), { status: 200 }),
    );
    const tab = { id: "tab-5", kind: "doc-block-roles:documentRole", itemId: "builtin:format", title: "Format" };
    const { root, settle } = await mount(jsx(RolePage, { tab } as never));
    await settle(() => root.querySelector("[data-role-blocks]") !== null);
    const toggle = root.querySelector("[data-role-blocks]") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("title")).toBe("Built in: taken by documents alone, as the release says.");
  });
});
