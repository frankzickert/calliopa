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

import {
  FIELD_STRUCTURE,
  KEYWORD_STRUCTURE,
  STRUCTURE_STRUCTURE,
  type DocumentStructuresView,
  type StructuresListing,
  type StructureView,
  type TakenStructure,
} from "../lib/structures";
import { BlockStructureControl, fittingPills, TitleStructureControl } from "./control";
import { StructureLabel } from "./label";
import { StructuresProvider, STRUCTURES_CHANGED } from "./provider";
import { StructuresSection } from "./section";
import { contributions } from "../contributions";

/**
 * The structures extension's surfaces in Qwik's render harness (`BO_0309_017`):
 * the section listing the structures, built-ins first, each built-in unfolding to
 * the documents carrying it; the pills a structured block carries — one per structure,
 * the missing mark, *proposed* and *not offered*; and the structure control in a
 * block's chip and under the title — the typeahead limited to what the block
 * can take, a suggestion taken with one press, a structure cleared by its ×, a
 * field's value posted on commit, and a refusal said in the route's words.
 * What the routes answer is stood in for by the browser's own `fetch`.
 */

const structure = (id: string, name: string, extra: Partial<StructureView> = {}): StructureView => ({
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
  text: "",
  ...extra,
});

const STORY = "2b0c1f3a-0f6a-4d1e-9a3c-1d2e3f4a5b6c";
const HOOK = "1a2b3c4d-1111-4aaa-8bbb-000000000001";
const BIG = "1a2b3c4d-1111-4aaa-8bbb-000000000002";
const BLOG = "7e8f9a0b-1c2d-4e3f-8a5b-6c7d8e9f0a1b";
const OLD = "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c";
const DEFINITION = "4e4e4e4e-4e4e-4e4e-8e4e-4e4e4e4e4e4e";
const KEYWORD = KEYWORD_STRUCTURE;

const keyword = structure(KEYWORD, "Keyword", { builtin: true, order: 0, offers: [DEFINITION] });
const definition = structure(DEFINITION, "Definition", { order: 6, offeredBy: [KEYWORD] });
const story = structure(STORY, "Story", { order: 2, offers: [HOOK, BIG] });
const hook = structure(HOOK, "Hook", { order: 3, description: "Opens the story", offeredBy: [STORY] });
const big = structure(BIG, "Big Message", { order: 4, offeredBy: [STORY] });
const blog = structure(BLOG, "Blog post", {
  order: 5,
  description: "A post for the blog",
  fields: [
    { key: "date", name: "Publishing date", type: "date", required: true },
    { key: "position", name: "Position", type: "number", required: false, default: 1 },
    { key: "channel", name: "Channel", type: "choice", required: false, options: ["Blog", "Newsletter"] },
  ],
});
const old = structure(OLD, "Old", { order: 7, retired: true });
const listing: StructuresListing = { reachable: true, structures: [story, hook, big, blog, old, definition, keyword] };

const documentId = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const first = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";
const second = "6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f";

const taken = (source: StructureView, extra: Partial<TakenStructure> = {}): TakenStructure => ({
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
  firstStructures: readonly TakenStructure[] = [taken(hook), taken(blog)],
  documentStructures: readonly TakenStructure[] = [taken(story)],
  inherited: DocumentStructuresView["inherited"] = [],
): DocumentStructuresView => ({
  documentId,
  dataRevision: 7,
  inherited,
  structures: documentStructures,
  takeable: [KEYWORD, STORY, BLOG],
  blocks: [
    { blockId: first, kind: "text", parentId: null, structures: firstStructures, takeable: [KEYWORD, STORY, HOOK, BIG, BLOG] },
    { blockId: second, kind: "image", parentId: null, structures: [], takeable: [KEYWORD, STORY, HOOK, BIG, BLOG] },
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

/** The routes: the catalogue, the document's structures, and each post answered
 * with `answer` or refused. */
const api =
  (asked: Asked[], current: DocumentStructuresView, answer: DocumentStructuresView = current, refuse = false) =>
  async (url: string, init?: RequestInit) => {
    asked.push({ url, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}) });
    if (url === "/api/library/structures/structures") return new Response(JSON.stringify(listing), { status: 200 });
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
  jsx(StructuresProvider, {
    documentId,
    children: [
      jsx(StructureLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "label"),
      jsx(BlockStructureControl, { documentId, blockId: first, revisionId: "rev:1", active }, "control"),
    ],
  });

afterEach(() => {
  opened.length = 0;
  vi.unstubAllGlobals();
});

describe("the Structures section", () => {
  const section = (data: StructuresListing) =>
    jsx(StructuresSection, { data, activeItemId: STORY, sectionKey: "structures:structures", filter: null, setFilter$: $(async () => {}) });

  it("lists the structures with the built-ins first and retired ones left out, and opens one as its document (RO_0005)", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(listing), { status: 200 }));
    const { root, settle, dom } = await mount(section(listing));
    const rows = () => Array.from(root.querySelectorAll("[data-structure-row]")).map((row) => row.querySelector(".library-entry__label")?.textContent);
    expect(rows()).toEqual(["Keyword", "Story", "Hook", "Big Message", "Blog post", "Definition"]);
    expect(root.querySelector(`[data-structure-row="${KEYWORD}"] .structures-row__builtin`)?.textContent).toBe("built in");
    expect(root.querySelector(`[data-structure-row="${STORY}"]`)?.getAttribute("aria-current")).toBe("true");
    await dom.userEvent(`[data-structure-row="${BLOG}"]`, "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: BLOG, title: "Blog post" }]);
  });

  it("unfolds a built-in to the documents carrying it, each opening as itself", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push({ url });
      return new Response(JSON.stringify({ outcome: "success", result: [{ id: documentId, title: "Quantum computing" }] }), { status: 200 });
    });
    const { root, settle, dom } = await mount(section(listing));
    expect(root.querySelector(`[data-unfold-structure="${STORY}"]`)).toBeFalsy();
    await dom.userEvent(`[data-unfold-structure="${KEYWORD}"]`, "click");
    await settle(() => root.querySelector("[data-carrying-document]") !== null);
    expect(asked.map((entry) => entry.url)).toEqual([`/api/x/structures/structures/${encodeURIComponent(KEYWORD)}/documents`]);
    expect(root.querySelector("[data-carrying-document]")?.textContent?.trim()).toBe("Quantum computing");
    await dom.userEvent("[data-carrying-document]", "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: documentId, title: "Quantum computing" }]);
  });

  it("says when there are none, and when they could not be read", async () => {
    const none = await mount(section({ reachable: true, structures: [old] }));
    expect(none.root.querySelector("[data-structures-empty]")?.textContent?.trim()).toBe("No structures yet");
    const unread = await mount(section({ reachable: false, structures: [] }));
    expect(unread.root.querySelector("[data-structures-empty]")?.textContent?.trim()).toBe("The structures could not be read");
  });
});

describe("the pills at a structured block", () => {
  it("draws one pill per structure, marks a missing required value, and says proposed and not offered", async () => {
    vi.stubGlobal(
      "fetch",
      api([], view([taken(hook, { offered: false }), taken(blog), taken(big, { proposed: "structure" })])),
    );
    const { root, settle } = await mount(
      jsx(StructuresProvider, {
        documentId,
        children: [
          jsx(StructureLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "first"),
          jsx(StructureLabel, { documentId, blockId: second, revisionId: "rev:2", active: false }, "second"),
        ],
      }),
    );
    await settle(() => root.querySelectorAll("[data-block-structure]").length > 2);
    const pills = Array.from(root.querySelectorAll("[data-block-structure]"));
    expect(pills.map((pill) => pill.getAttribute("data-block-structure"))).toEqual([HOOK, BLOG, BIG]);
    expect(pills[0]?.getAttribute("data-structure-state")).toBe("not allowed here");
    expect(pills[1]?.getAttribute("data-structure-missing")).toBe("true");
    expect(pills[1]?.getAttribute("title")).toBe("A post for the blog. Missing: Publishing date");
    expect(pills[2]?.querySelector(".block-structure__state")?.textContent).toBe("proposed");
    expect(root.querySelectorAll(`[data-block-structures-of="${second}"]`)).toHaveLength(0);
  });
});

describe("the structure control in the structures chip below a block's command chip", () => {
  it("opens on the structures taken, offers only what the block can take, narrowed by what is typed, and takes one with a press", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), view([taken(hook), taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structures-popover]") !== null);
    expect(Array.from(root.querySelectorAll("[data-taken-structure]")).map((row) => row.getAttribute("data-taken-structure"))).toEqual([HOOK]);
    // Definition is offered by Keyword alone, and nothing here carries it.
    expect(Array.from(root.querySelectorAll("[data-take-structure]")).map((button) => button.getAttribute("data-take-structure"))).toEqual([KEYWORD, STORY, BIG, BLOG]);

    const query = root.querySelector("[data-structure-query]") as HTMLInputElement;
    query.value = "blo";
    await dom.userEvent("[data-structure-query]", "input");
    await settle(() => root.querySelectorAll("[data-take-structure]").length === 1);
    expect(root.querySelector("[data-take-structure]")?.getAttribute("data-take-structure")).toBe(BLOG);

    await dom.userEvent(`[data-take-structure="${BLOG}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([{ url: `/api/x/structures/documents/${documentId}/blocks/${first}/structures`, body: { structure: BLOG, taken: true } }]);
    await settle(() => root.querySelectorAll("[data-taken-structure]").length === 2);
    // The structure just taken opens on its fields.
    expect(root.querySelector(`[data-taken-structure="${BLOG}"]`)?.getAttribute("data-expanded")).toBe("true");
  });

  it("suggests the structures offered from above first and a structure the block's words meet, each taken with one press", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structure-suggestions]") !== null);
    // Story on the document offers Hook and Big Message; the words say "blog post".
    expect(Array.from(root.querySelectorAll("[data-suggested-structure]")).map((button) => button.getAttribute("data-suggested-structure"))).toEqual([HOOK, BIG, BLOG]);
    await dom.userEvent(`[data-suggested-structure="${BIG}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)[0]?.body).toEqual({ structure: BIG, taken: true });
  });

  it("clears a structure with its ×", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector(`[data-clear-structure="${HOOK}"]`) !== null);
    await dom.userEvent(`[data-clear-structure="${HOOK}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([{ url: `/api/x/structures/documents/${documentId}/blocks/${first}/structures`, body: { structure: HOOK, taken: false } }]);
  });

  it("edits a structure's fields under it, each value posted on commit", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", api(asked, view([taken(blog, { values: { position: 1 } })])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-structure="${BLOG}"]`) !== null);
    // A pill in the chip opens the popover unfolded at its structure.
    await dom.userEvent(`[data-chip-structure="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-structure-fields]") !== null);
    expect(Array.from(root.querySelectorAll("[data-structure-field]")).map((input) => input.getAttribute("data-field-type"))).toEqual(["date", "number", "choice"]);
    expect(root.querySelector('[data-structure-field="date"]')?.getAttribute("data-missing")).toBe("true");
    expect((root.querySelector('[data-structure-field="position"]') as HTMLInputElement).value).toBe("1");

    (root.querySelector('[data-structure-field="date"]') as HTMLInputElement).value = "2026-10-01";
    await dom.userEvent('[data-structure-field="date"]', "change");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([
      { url: `/api/x/structures/documents/${documentId}/blocks/${first}/structures/${BLOG}/fields`, body: { values: { date: "2026-10-01" } } },
    ]);
  });

  it("says a refusal beside the control in the route's words", async () => {
    vi.stubGlobal("fetch", api([], view([]), view([]), true));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector(`[data-take-structure="${HOOK}"]`) !== null);
    await dom.userEvent(`[data-take-structure="${HOOK}"]`, "click");
    await settle(() => root.querySelector("[data-structure-refusal]") !== null);
    expect(root.querySelector("[data-structure-refusal]")?.textContent).toBe("Hook is offered by Story, and nothing above this block carries it.");
  });

  it("opens at the structure a pill was pressed on", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook), taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-block-structure="${BLOG}"]`) !== null);
    await dom.userEvent(`[data-block-structure="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-structures-popover]") !== null);
    expect(root.querySelector(`[data-taken-structure="${BLOG}"]`)?.getAttribute("data-expanded")).toBe("true");
  });

  it("draws nothing while the structures cannot be read", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url === "/api/library/structures/structures"
        ? new Response(JSON.stringify({ reachable: false, structures: [] }), { status: 200 })
        : new Response(JSON.stringify({ outcome: "success", result: view() }), { status: 200 }),
    );
    const { root, settle } = await mount(control());
    await settle(() => false);
    expect(root.querySelector("[data-structures-add]")).toBeFalsy();
  });

  it("shows the structures taken as pills and a +, with nothing else at rest", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook, { offered: false }), taken(blog)])));
    const { root, settle } = await mount(control());
    await settle(() => root.querySelectorAll("[data-chip-structure]").length === 2);
    const chip = root.querySelector(`[data-structure-control="${first}"]`)!;
    expect(chip.getAttribute("data-structure-form")).toBe("pills");
    const pills = Array.from(chip.querySelectorAll("[data-chip-structure]"));
    expect(pills.map((pill) => pill.getAttribute("data-chip-structure"))).toEqual([HOOK, BLOG]);
    expect(pills[0]?.querySelector(".block-structure__state")?.textContent).toBe("not allowed here");
    expect(pills[1]?.getAttribute("data-structure-missing")).toBe("true");
    expect(pills[1]?.getAttribute("title")).toBe("A post for the blog. Missing: Publishing date");
    expect(chip.querySelector("[data-structures-add]")?.getAttribute("aria-label")).toBe("Add a structure to this block");
    expect(chip.querySelector("[data-structures-toggle]")).toBeFalsy();
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
  });

  it("holds the + alone on a block with no structures, opening the typeahead and the suggestions", async () => {
    vi.stubGlobal("fetch", api([], view([])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    expect(root.querySelectorAll("[data-chip-structure]")).toHaveLength(0);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structures-popover]") !== null);
    expect(root.querySelector("[data-structure-query]")).toBeTruthy();
    expect(root.querySelector("[data-structure-suggestions]")).toBeTruthy();
    expect(root.querySelector("[data-structures-add]")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes what is open on a second press", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-structure="${BLOG}"]`) !== null);
    await dom.userEvent(`[data-chip-structure="${BLOG}"]`, "click");
    await settle(() => root.querySelector("[data-structures-popover]") !== null);
    expect(root.querySelector(`[data-chip-structure="${BLOG}"]`)?.getAttribute("aria-expanded")).toBe("true");
    await dom.userEvent(`[data-chip-structure="${BLOG}"]`, "click");
    await settle(() => !root.querySelector("[data-structures-popover]"));
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
  });

  it("keeps the reading pills while the block is edited", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook)])));
    const { root, settle } = await mount(
      jsx(StructuresProvider, {
        documentId,
        children: [
          jsx(StructureLabel, { documentId, blockId: first, revisionId: "rev:1", active: true }, "label"),
          jsx(BlockStructureControl, { documentId, blockId: first, revisionId: "rev:1", active: true }, "control"),
        ],
      }),
    );
    await settle(() => root.querySelector(`[data-block-structure="${HOOK}"]`) !== null && root.querySelector(`[data-chip-structure="${HOOK}"]`) !== null);
    expect(root.querySelector(`[data-block-structure="${HOOK}"]`)).toBeTruthy();
  });

  it("closes from the dimmed page around it, as the phone's sheet does", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    expect(root.querySelector("[data-structures-backdrop]")).toBeFalsy();
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structures-backdrop]") !== null);
    await dom.userEvent("[data-structures-backdrop]", "click");
    await settle(() => !root.querySelector("[data-structures-popover]"));
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
    expect(root.querySelector("[data-structures-backdrop]")).toBeFalsy();
  });

  it("closes when its handle is swiped down far enough, and settles back when not", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structures-handle]") !== null);
    // A short swipe: the sheet follows the finger and settles back.
    await dom.userEvent("[data-structures-handle]", "touchstart", { touches: [{ clientY: 400 }] });
    await dom.userEvent("[data-structures-handle]", "touchmove", { touches: [{ clientY: 430 }] });
    await settle(() => root.querySelector("[data-structures-popover]")?.getAttribute("style")?.includes("30px") === true);
    await dom.userEvent("[data-structures-handle]", "touchend");
    await settle(() => !root.querySelector("[data-structures-popover]")?.getAttribute("style"));
    expect(root.querySelector("[data-structures-popover]")).toBeTruthy();
    // A long one closes it.
    await dom.userEvent("[data-structures-handle]", "touchstart", { touches: [{ clientY: 400 }] });
    await dom.userEvent("[data-structures-handle]", "touchmove", { touches: [{ clientY: 520 }] });
    await dom.userEvent("[data-structures-handle]", "touchend");
    await settle(() => !root.querySelector("[data-structures-popover]"));
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
  });

  it("is placed beside its chip once opened, and hidden until it is (RO_0004_001)", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    const chip = root.querySelector("[data-structure-control]") as HTMLElement;
    // The harness lays nothing out: give its window the size of a desktop and
    // the chip a box near the top, as a browser would measure them.
    const harness = chip.ownerDocument.defaultView as unknown as Record<string, unknown>;
    Object.assign(harness, {
      innerWidth: 1280,
      innerHeight: 800,
      getComputedStyle: () => ({ fontSize: "16px", overflowY: "visible" }),
    });
    Object.assign(chip, { getBoundingClientRect: () => ({ top: 100, left: 900, right: 1000, bottom: 124 }) });
    expect(chip.getAttribute("data-structures-side")).toBeNull();
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => chip.getAttribute("data-structures-side") !== null);
    expect(chip.getAttribute("data-structures-side")).toBe("below");
    // Ending at the chip's right edge, 22rem wide, the room below capped.
    const style = chip.getAttribute("style") ?? "";
    expect(style).toContain(`--structures-left: ${1000 - 352}px`);
    expect(style).toContain("--structures-top: 130px");
    expect(style).toContain("--structures-bottom: auto");
    expect(style).toContain(`--structures-room: ${800 - 8 - 130}px`);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => !root.querySelector("[data-structures-popover]"));
    expect(chip.getAttribute("data-structures-side")).toBeNull();
    expect(chip.getAttribute("style")).toBeNull();
  });

  it("raises the dimmed page and then the popover into the top layer, over the shell's bars", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    // The harness has no top layer: record what the browser would be asked
    // to raise, and in which order.
    const raised: string[] = [];
    const div = Object.getPrototypeOf(root.ownerDocument.createElement("div")) as Record<string, unknown>;
    div.showPopover = function (this: HTMLElement) {
      raised.push(this.hasAttribute("data-structures-backdrop") ? "backdrop" : this.hasAttribute("data-structures-popover") ? "popover" : "other");
    };
    try {
      await dom.userEvent("[data-structures-add]", "click");
      await settle(() => raised.length === 2);
      expect(raised).toEqual(["backdrop", "popover"]);
      expect(root.querySelector("[data-structures-popover]")?.getAttribute("popover")).toBe("manual");
      expect(root.querySelector("[data-structures-backdrop]")?.getAttribute("popover")).toBe("manual");
    } finally {
      delete div.showPopover;
    }
  });

  it("closes on a press outside it and its chip, and lets the press act (RO_0004_006)", async () => {
    vi.stubGlobal("fetch", api([], view([taken(blog)])));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector(`[data-chip-structure="${BLOG}"]`) !== null);
    const press = (element: Element) => {
      const event = element.ownerDocument.createEvent("Event");
      event.initEvent("pointerdown", true, true);
      element.dispatchEvent(event);
      return event;
    };
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structures-popover]") !== null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Inside the popover and on its chip, it stays open.
    press(root.querySelector("[data-structure-query]")!);
    press(root.querySelector(`[data-chip-structure="${BLOG}"]`)!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.querySelector("[data-structures-popover]")).toBeTruthy();
    // Outside, on the block's words, it closes and the press is not prevented.
    const outside = press(root.querySelector(`[data-block-id="${first}"]`)!);
    expect(outside.defaultPrevented).toBe(false);
    await settle(() => !root.querySelector("[data-structures-popover]"));
    expect(root.querySelector("[data-structures-popover]")).toBeFalsy();
  });

  it("is contributed beside the command chip, and nothing of structures stands in the command chip", () => {
    const places = contributions.decorations?.document?.places ?? {};
    expect(places.underCommand).toBe(BlockStructureControl);
    expect(places.command).toBeUndefined();
  });
});

// The document header's rows (`DO_0030_004`, `DO_0030_005`, `DO_0030_011`):
// the structures line always drawn — the structures from above, the document's own pills
// and a `+` — the values line under it, and in the compact header the pills
// alone.
describe("the structures and values lines in the document's header", () => {
  const fromAbove = [{ id: HOOK, name: "Hook", description: "", on: "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a", document: "doc-parent" }];

  it("takes the document's own structures from the + and announces what the route answered", async () => {
    const asked: Asked[] = [];
    const after = view([taken(hook)], [taken(story), taken(keyword)]);
    vi.stubGlobal("fetch", api(asked, view([taken(hook)]), after));
    const announced: unknown[] = [];
    const listen = (event: Event) => announced.push((event as CustomEvent).detail);
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId, form: "full" }));
    const page = root.ownerDocument as unknown as EventTarget;
    page.addEventListener(STRUCTURES_CHANGED, listen);
    try {
      await settle(() => root.querySelector('[data-structure-control="document"] [data-structures-add]') !== null);
      expect(Array.from(root.querySelectorAll('[data-structure-control="document"] [data-chip-structure]')).map((pill) => pill.getAttribute("data-chip-structure"))).toEqual([STORY]);
      expect(root.querySelector("[data-structures-toggle]")).toBeFalsy();
      expect(root.querySelector('[data-structure-control="document"] [data-structures-add]')?.getAttribute("aria-label")).toBe("Add a structure to this document");
      await dom.userEvent('[data-structure-control="document"] [data-structures-add]', "click");
      await settle(() => root.querySelector(`[data-take-structure="${KEYWORD}"]`) !== null);
      expect(Array.from(root.querySelectorAll("[data-take-structure]")).map((button) => button.getAttribute("data-take-structure"))).toEqual([KEYWORD, BLOG]);
      await dom.userEvent(`[data-take-structure="${KEYWORD}"]`, "click");
      await settle(() => posted(asked).length > 0 && announced.length > 0);
      expect(posted(asked)).toEqual([{ url: `/api/x/structures/documents/${documentId}/structures`, body: { structure: KEYWORD, taken: true } }]);
      expect(announced).toEqual([after]);
    } finally {
      page.removeEventListener(STRUCTURES_CHANGED, listen);
    }
  });

  it("draws the structures from above, the own pills and the + with nothing focused, and a pill opens its structure", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog)], fromAbove)));
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId }));
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    const line = root.querySelector(".title-structures__line")!;
    expect(Array.from(line.querySelectorAll("[data-inherited-structure], [data-chip-structure], [data-structures-add]")).map((element) =>
      element.getAttribute("data-inherited-structure") ?? element.getAttribute("data-chip-structure") ?? "+",
    )).toEqual([HOOK, STORY, BLOG, "+"]);
    expect(line.querySelector(`[data-inherited-structure="${HOOK}"]`)?.getAttribute("data-structure-state")).toBe("from above");
    await dom.userEvent(`[data-chip-structure="${BLOG}"]`, "click");
    await settle(() => root.querySelector(`[data-structure-fields="${BLOG}"]`) !== null);
    expect(root.querySelector(`[data-chip-structure="${BLOG}"]`)?.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the filled values per structure, leaves out empty fields and structures with none, and shows a committed value at once", async () => {
    const asked: Asked[] = [];
    const before = view([], [taken(story), taken(blog, { values: { date: "2026-10-12", position: null } })]);
    const after = view([], [taken(story), taken(blog, { values: { date: "2026-10-12", position: 3, channel: "Newsletter" } })]);
    vi.stubGlobal("fetch", api(asked, before, after));
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId }));
    await settle(() => root.querySelector("[data-structure-values]") !== null);
    const values = () => root.querySelector("[data-structure-values]")?.textContent?.replace(/\s+/gu, " ").trim();
    expect(root.querySelector(`[data-structure-values-of="${STORY}"]`)).toBeFalsy();
    expect(values()).toMatch(/^Blog post: .*2026$/u);
    await dom.userEvent(`[data-chip-structure="${BLOG}"]`, "click");
    await settle(() => root.querySelector('[data-structure-field="channel"]') !== null);
    const channel = root.querySelector('[data-structure-field="channel"]') as HTMLSelectElement;
    channel.value = "Newsletter";
    await dom.userEvent('[data-structure-field="channel"]', "change");
    await settle(() => (values() ?? "").includes("Newsletter"));
    expect(values()).toMatch(/^Blog post: .*2026, 3, Newsletter$/u);
  });

  it("draws nothing for values when none is filled", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog)])));
    const { root, settle } = await mount(jsx(TitleStructureControl, { documentId }));
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    expect(root.querySelector("[data-structure-values]")).toBeFalsy();
  });

  it("draws the pills alone in the compact header: no +, no values, nothing to press", async () => {
    vi.stubGlobal("fetch", api([], view([], [taken(story), taken(blog, { values: { date: "2026-10-12" } })], fromAbove)));
    const { root, settle } = await mount(jsx(TitleStructureControl, { documentId, form: "compact" }));
    await settle(() => root.querySelector('[data-title-structures="compact"]') !== null);
    expect(Array.from(root.querySelectorAll("[data-compact-structure]")).map((pill) => pill.textContent)).toEqual(["Hook", "Story", "Blog post"]);
    expect(root.querySelector('[data-compact-structure$=":' + HOOK + '"]')?.getAttribute("data-structure-state")).toBe("from above");
    expect(root.querySelector("[data-structures-add]")).toBeFalsy();
    expect(root.querySelector("[data-structure-values]")).toBeFalsy();
    expect(root.querySelector('[data-title-structures="compact"] button')).toBeFalsy();
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

// A structure's acts on its document (RO_0005_004): beside its header's lines,
// Retire on a person's structure, Used by unfolding to the documents using it,
// and on Keyword one Send with prompt switch per field and allowed structure
// (`calliopa-bootstrap`'s `BO_0310_031`); Structure's pill carries no ×.
describe("a structure's acts on its document", () => {
  const structureBuiltin = structure(STRUCTURE_STRUCTURE, "Structure", { builtin: true, order: 7, blocks: false, offers: [FIELD_STRUCTURE] });
  const fieldBuiltin = structure(FIELD_STRUCTURE, "Field", { builtin: true, order: 8, offeredBy: [STRUCTURE_STRUCTURE] });
  const builtinKeyword = structure(KEYWORD, "Keyword", {
    builtin: true,
    order: 0,
    offers: [DEFINITION],
    fields: [{ key: "domain", name: "Domain", type: "text", required: false }],
    sendWithPrompt: [DEFINITION],
  });
  const usingStructure = (id: string): DocumentStructuresView => ({
    ...view([], [taken(structureBuiltin, { values: { blocks: true }, missing: [] })]),
    documentId: id,
    takeable: [],
  });

  /** The routes on a structure's document, each request kept. */
  const routes = (asked: Asked[], structures: readonly StructureView[], current: DocumentStructuresView, after: (body: unknown) => void = () => {}) =>
    async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
      asked.push({ url, ...(body === undefined ? {} : { body }) });
      if (url === "/api/library/structures/structures") return new Response(JSON.stringify({ reachable: true, structures }), { status: 200 });
      if (init?.method === "POST") {
        after(body);
        return new Response(JSON.stringify({ outcome: "success", result: structures[0] }), { status: 200 });
      }
      if (url.endsWith("/documents") && url.startsWith("/api/x/structures/structures/"))
        return new Response(JSON.stringify({ outcome: "success", result: [{ id: documentId, title: "Quantum computing" }] }), { status: 200 });
      return new Response(JSON.stringify({ outcome: "success", result: current }), { status: 200 });
    };

  it("draws Keyword's switches per field and allowed structure, posts a flip, and offers no Retire on a built-in", async () => {
    const asked: Asked[] = [];
    let current = builtinKeyword;
    vi.stubGlobal(
      "fetch",
      async (url: string, init?: RequestInit) =>
        routes(asked, [current, definition, structureBuiltin, fieldBuiltin], usingStructure(KEYWORD), () => {
          current = { ...current, sendWithPrompt: [DEFINITION, "domain"] };
        })(url, init),
    );
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId: KEYWORD, form: "full" }));
    await settle(() => root.querySelector("[data-send-with-prompt]") !== null);
    const switches = () =>
      Array.from(root.querySelectorAll("[data-send-with-prompt-entry]")).map((input) => [input.getAttribute("data-send-with-prompt-entry"), (input as HTMLInputElement).checked]);
    expect(switches()).toEqual([
      ["domain", false],
      [DEFINITION, true],
    ]);
    expect(root.querySelector("[data-structure-retire]")).toBeFalsy();
    // Structure's pill carries no ×: a structure stays one (RO_0005_Q9).
    expect(root.querySelector(`[data-chip-structure="${STRUCTURE_STRUCTURE}"]`)).toBeTruthy();
    const domain = root.querySelector('[data-send-with-prompt-entry="domain"]') as HTMLInputElement;
    domain.checked = true;
    await dom.userEvent('[data-send-with-prompt-entry="domain"]', "change");
    await settle(() => posted(asked).length > 0 && switches()[0]?.[1] === true);
    expect(posted(asked).map((entry) => [entry.url, entry.body])).toEqual([
      [`/api/x/structures/structures/${encodeURIComponent(KEYWORD)}`, { command: "sendWithPrompt", entry: "domain", on: true }],
    ]);
  });

  it("retires a person's structure by its act, and unfolds Used by to the documents using it, each opening as itself", async () => {
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", routes(asked, [story, structureBuiltin, fieldBuiltin], usingStructure(STORY)));
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId: STORY, form: "full" }));
    await settle(() => root.querySelector("[data-structure-retire]") !== null);
    expect(root.querySelector("[data-send-with-prompt]")).toBeFalsy();
    expect(root.querySelector("[data-structure-retire]")?.textContent?.trim()).toBe("Retire");
    await dom.userEvent("[data-structure-retire]", "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked).map((entry) => [entry.url, entry.body])).toEqual([[`/api/x/structures/structures/${STORY}`, { command: "retire" }]]);
    await dom.userEvent("[data-structure-used-by]", "click");
    await settle(() => root.querySelector("[data-using-document]") !== null);
    await dom.userEvent("[data-using-document]", "click");
    await settle(() => opened.length > 0);
    expect(opened).toEqual([{ kind: "documents:document", itemId: documentId, title: "Quantum computing" }]);
  });

  it("says beside an allowing of a structure blocks may not use that the document under a block using this one uses it (RO_0003_Q5)", async () => {
    const documentHook = { ...hook, blocks: false };
    vi.stubGlobal("fetch", routes([], [story, documentHook, big, structureBuiltin, fieldBuiltin], usingStructure(STORY)));
    const { root, settle } = await mount(jsx(TitleStructureControl, { documentId: STORY, form: "full" }));
    await settle(() => root.querySelector("[data-structure-acts]") !== null);
    expect(root.querySelector(`[data-offer-document-only="${HOOK}"]`)?.textContent).toBe("Hook: used by the document under a block using Story, never by its blocks");
    expect(root.querySelector(`[data-offer-document-only="${BIG}"]`)).toBeFalsy();
  });

  it("draws Structure's pill without a × in the document's control, and nothing of a structure's acts on a document that is none", async () => {
    vi.stubGlobal("fetch", routes([], [story, structureBuiltin, fieldBuiltin], usingStructure(STORY)));
    const { root, settle, dom } = await mount(jsx(TitleStructureControl, { documentId: STORY, form: "full" }));
    await settle(() => root.querySelector(`[data-chip-structure="${STRUCTURE_STRUCTURE}"]`) !== null);
    await dom.userEvent(`[data-chip-structure="${STRUCTURE_STRUCTURE}"]`, "click");
    await settle(() => root.querySelector(`[data-taken-structure="${STRUCTURE_STRUCTURE}"]`) !== null);
    expect(root.querySelector(`[data-clear-structure="${STRUCTURE_STRUCTURE}"]`)).toBeFalsy();
    vi.stubGlobal("fetch", routes([], [story], view([], [taken(story)])));
    const plain = await mount(jsx(TitleStructureControl, { documentId, form: "full" }));
    await plain.settle(() => plain.root.querySelector("[data-chip-structure]") !== null);
    expect(plain.root.querySelector("[data-structure-acts]")).toBeFalsy();
  });
});

describe("a block's focused work", () => {
  const parent = "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a";
  const storyBlock = "9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b";
  const fromAbove = [{ id: STORY, name: "Story", description: "", on: storyBlock, document: parent }];

  it("shows the structures above it in its header, from above, and none of them removable there", async () => {
    vi.stubGlobal("fetch", api([], view([], [], fromAbove)));
    const { root, settle } = await mount(jsx(TitleStructureControl, { documentId }));
    await settle(() => root.querySelector("[data-inherited-structure]") !== null);
    const pill = root.querySelector(`[data-inherited-structure="${STORY}"]`)!;
    expect(pill.querySelector(".block-structure__name")?.textContent).toBe("Story");
    expect(pill.querySelector(".block-structure__state")?.textContent).toBe("from above");
    expect(root.querySelector(`[data-clear-structure="${STORY}"]`)).toBeFalsy();
  });

  it("suggests to a block what the block it was opened from offers", async () => {
    vi.stubGlobal("fetch", api([], view([], [], fromAbove)));
    const { root, settle, dom } = await mount(control());
    await settle(() => root.querySelector("[data-structures-add]") !== null);
    await dom.userEvent("[data-structures-add]", "click");
    await settle(() => root.querySelector("[data-structure-suggestions]") !== null);
    expect(Array.from(root.querySelectorAll("[data-suggested-structure]")).map((button) => button.getAttribute("data-suggested-structure")).slice(0, 2)).toEqual([HOOK, BIG]);
  });
});

// BO_0312_010: Format's type and schema are the release's — no ×, and the
// type and its options cannot be changed — while a field the person added
// beside them can be removed.
describe("structures used by documents alone", () => {
  it("says on a block's pill that blocks may no longer take the structure it keeps", async () => {
    vi.stubGlobal("fetch", api([], view([taken(hook, { blocks: false, notOnBlock: true }), taken(blog)])));
    const { root, settle } = await mount(
      jsx(StructuresProvider, {
        documentId,
        children: [jsx(StructureLabel, { documentId, blockId: first, revisionId: "rev:1", active: false }, "first")],
      }),
    );
    await settle(() => root.querySelectorAll("[data-block-structure]").length > 1);
    const pills = Array.from(root.querySelectorAll("[data-block-structure]"));
    expect(pills[0]?.getAttribute("data-structure-state")).toBe("not allowed on a block");
    expect(pills[0]?.getAttribute("title")).toBe("Hook is not allowed on a block");
    expect(pills[1]?.getAttribute("data-structure-state")).toBeNull();
  });
});

describe("fields that suggest and references by title (calliopa-bootstrap's BO_0336)", () => {
  const FORMAT = "7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c";
  const VARIATION = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b6b";
  const PROFILE = "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a";
  const FORMAT_DOC = "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a";
  const generation = [
    { key: "provider", name: "Provider", type: "text", required: false, suggest: "media:provider" },
    { key: "model", name: "Model", type: "text", required: false, suggest: "media:model" },
  ] as const;
  const format = structure(FORMAT, "Format", { builtin: true, blocks: false, offers: [VARIATION], fields: [{ key: "type", name: "Type", type: "choice", required: true, options: ["image", "video"] }, ...generation] });
  const variation = structure(VARIATION, "Variation", { builtin: true, offeredBy: [FORMAT], fields: [...generation] });
  const profile = structure(PROFILE, "Profile", { builtin: true, blocks: false, fields: [{ key: "format", name: "Format", type: "reference", required: false, carrying: FORMAT }] });
  const catalogue: StructuresListing = { reachable: true, structures: [format, variation, profile] };
  const formatView = (blockStructures: readonly TakenStructure[]): DocumentStructuresView => ({
    ...view(blockStructures, [taken(format, { values: { type: "image", provider: "higgsfield" }, missing: [] })]),
    takeable: [],
  });

  /** The routes, the frame's suggestions among them, each request kept. */
  const routes =
    (asked: Asked[], current: DocumentStructuresView, suggestions: Response | null) =>
    async (url: string, init?: RequestInit) => {
      asked.push({ url, ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) as unknown } : {}) });
      if (url === "/api/library/structures/structures") return new Response(JSON.stringify(catalogue), { status: 200 });
      if (url.startsWith("/api/suggestions/")) return suggestions ?? new Response("{}", { status: 404 });
      if (url === `/api/x/structures/structures/${encodeURIComponent(FORMAT)}/documents`)
        return new Response(JSON.stringify({ outcome: "success", result: [{ id: FORMAT_DOC, title: "Instagram square" }] }), { status: 200 });
      return new Response(JSON.stringify({ outcome: "success", result: current }), { status: 200 });
    };

  const openAt = async (structureId: string, current: DocumentStructuresView, asked: Asked[], suggestions: Response | null) => {
    vi.stubGlobal("fetch", routes(asked, current, suggestions));
    const mounted = await mount(control());
    await mounted.settle(() => mounted.root.querySelector(`[data-chip-structure="${structureId}"]`) !== null);
    await mounted.dom.userEvent(`[data-chip-structure="${structureId}"]`, "click");
    await mounted.settle(() => mounted.root.querySelector("[data-structure-fields]") !== null);
    return mounted;
  };

  it("opens a Variation's model suggestions asked with its format's values, and fills one in with a press", async () => {
    const asked: Asked[] = [];
    const answer = new Response(JSON.stringify({ suggestions: [{ value: "gpt_image_2", label: "GPT Image 2" }, { value: "seedream_v5_pro" }] }), { status: 200 });
    const { root, settle, dom } = await openAt(VARIATION, formatView([taken(variation, { values: {}, missing: [] })]), asked, answer);
    await dom.userEvent('[data-structure-field="model"]', "focus");
    await settle(() => root.querySelector('[data-suggestion="gpt_image_2"]') !== null);
    // The block leaves the provider empty, so its format's is what is asked with.
    expect(asked.map((one) => one.url)).toContain("/api/suggestions/media/model?type=image&provider=higgsfield");
    expect(root.querySelector('[data-suggestion="gpt_image_2"]')?.textContent).toContain("GPT Image 2");
    await dom.userEvent('[data-suggestion="gpt_image_2"]', "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)).toEqual([
      { url: `/api/x/structures/documents/${documentId}/blocks/${first}/structures/${encodeURIComponent(VARIATION)}/fields`, body: { values: { model: "gpt_image_2" } } },
    ]);
  });

  it("keeps a value typed outside the suggestions as typed", async () => {
    const asked: Asked[] = [];
    const answer = new Response(JSON.stringify({ suggestions: [{ value: "gpt_image_2" }] }), { status: 200 });
    const { root, settle, dom } = await openAt(VARIATION, formatView([taken(variation, { values: {}, missing: [] })]), asked, answer);
    await dom.userEvent('[data-structure-field="model"]', "focus");
    await settle(() => root.querySelector('[data-suggestion="gpt_image_2"]') !== null);
    (root.querySelector('[data-structure-field="model"]') as HTMLInputElement).value = "nano_banana_9";
    await dom.userEvent('[data-structure-field="model"]', "input");
    await settle(() => root.querySelector("[data-suggestions-empty]") !== null);
    expect(root.querySelector("[data-suggestions-empty]")?.textContent).toContain("what you type is kept");
    await dom.userEvent('[data-structure-field="model"]', "change");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)[0]?.body).toEqual({ values: { model: "nano_banana_9" } });
  });

  it("says when nothing answers the field's source, and stays typeable", async () => {
    const asked: Asked[] = [];
    const { root, settle, dom } = await openAt(VARIATION, formatView([taken(variation, { values: {}, missing: [] })]), asked, null);
    await dom.userEvent('[data-structure-field="provider"]', "focus");
    await settle(() => root.querySelector("[data-suggestions-note]") !== null);
    expect(root.querySelector("[data-suggestions-note]")?.textContent).toBe("Nothing on this instance suggests values here.");
    expect((root.querySelector('[data-structure-field="provider"]') as HTMLInputElement).disabled).toBe(false);
  });

  it("chooses a reference limited to a structure by title, among the documents carrying it", async () => {
    const asked: Asked[] = [];
    const personal = structure("9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d9d", "Delivery", { fields: [{ key: "format", name: "Format", type: "reference", required: false, carrying: FORMAT }] });
    const { root, settle, dom } = await openAt(personal.id, view([taken(personal, { values: {}, missing: [] })]), asked, null);
    await dom.userEvent('[data-structure-field="format"]', "focus");
    await settle(() => root.querySelector(`[data-choice="${FORMAT_DOC}"]`) !== null);
    expect(root.querySelector(`[data-choice="${FORMAT_DOC}"]`)?.textContent).toBe("Instagram square");
    await dom.userEvent(`[data-choice="${FORMAT_DOC}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)[0]?.body).toEqual({ values: { format: FORMAT_DOC } });
  });

  it("holds several references as pills, each removed by its ×, and adds one chosen by title (RO_0005_Q3)", async () => {
    const asked: Asked[] = [];
    const OTHER = "9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f";
    const allowing = structure("9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d9e", "Chapter", {
      fields: [{ key: "allows", name: "Allows", type: "reference", required: false, many: true, carrying: FORMAT }],
    });
    const current = { ...view([taken(allowing, { values: { allows: [OTHER] }, missing: [] })]), referenceTitles: { [OTHER]: "Square" } };
    const { root, settle, dom } = await openAt(allowing.id, current, asked, null);
    expect(root.querySelector(`[data-field-chosen="${OTHER}"]`)?.textContent?.trim()).toBe("Square");
    await dom.userEvent('[data-structure-field="allows"]', "focus");
    await settle(() => root.querySelector(`[data-choice="${FORMAT_DOC}"]`) !== null);
    await dom.userEvent(`[data-choice="${FORMAT_DOC}"]`, "click");
    await settle(() => posted(asked).length > 0);
    expect(posted(asked)[0]?.body).toEqual({ values: { allows: [OTHER, FORMAT_DOC] } });
    await dom.userEvent(`[data-field-chosen="${OTHER}"] button`, "click");
    await settle(() => posted(asked).length > 1);
    expect(posted(asked)[1]?.body).toEqual({ values: { allows: [] } });
  });
});
