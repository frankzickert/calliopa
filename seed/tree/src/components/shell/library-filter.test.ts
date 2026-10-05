import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { LibraryFilter, LibraryItem } from "~/contract";
import { LibraryFilterHost } from "./testing/library-filter-host";

/**
 * An item section's filter pressed through the shell's own JSX: the funnel
 * reveals the row, a toggle hides the rows carrying its value, an order
 * rearranges them, typed words narrow them by label, the funnel reads as
 * active while the choice is not the default, and a filter hiding every row
 * says so with *Clear filter*. DO_0038_002
 */
const filter: LibraryFilter = {
  search: "Search titles",
  groups: [
    { name: "kind", label: "Kind" },
    { name: "started", label: "Started by an agent" },
  ],
  orders: [
    { id: "title", label: "Title A–Z", by: "label-ascending" },
    { id: "changed", label: "Last changed first", by: "key-descending" },
  ],
  defaultOrder: "title",
  noMatch: "No documents match",
};

const open = (itemId: string, title: string) => ({ kind: "documents:document", itemId, title });
const row = (id: string, label: string, kind: string, changed: number, started = false): LibraryItem => ({
  id,
  label,
  open: open(id, label),
  facets: {
    kind: { value: kind, label: kind === "source" ? "Source" : "Document" },
    ...(started ? { started: { value: "started", label: "Started by an agent", icon: "robot" as const } } : {}),
  },
  orderKeys: { changed },
});
const items: readonly LibraryItem[] = [
  row("a", "Alpha notes", "document", 10),
  row("b", "Beta source", "source", 30),
  row("c", "Gamma plan", "document", 20, true),
];

const mount = async (stored?: readonly string[]) => {
  const dom = await createDOM();
  await dom.render(jsx(LibraryFilterHost, { filter, items, ...(stored === undefined ? {} : { stored }) }));
  const root = dom.screen as unknown as HTMLElement;
  const find = (selector: string) => (root.querySelector(selector) as HTMLElement | null) ?? null;
  await dom.userEvent("[data-load]", "click");
  const listed = () => Array.from(root.querySelectorAll("[data-item-id]")).map((element) => element.getAttribute("data-item-id"));
  const stored$ = () => JSON.parse(find("[data-stored]")?.textContent ?? "null") as string[] | null;
  return { ...dom, root, find, listed, stored: stored$ };
};

describe("an item section's filter", () => {
  it("Given nothing stored, Then every row lists by title, the row is closed and the funnel is not active", async () => {
    const { find, listed } = await mount();
    expect(listed()).toEqual(["a", "b", "c"]);
    const funnel = find('[data-filter-section="documents"]');
    expect(funnel?.getAttribute("aria-label")).toBe("Filter Documents");
    expect(funnel?.getAttribute("aria-pressed")).toBe("false");
    expect(funnel?.hasAttribute("data-filtered")).toBe(false);
    expect(find('[data-library-filter="documents"]')?.hasAttribute("hidden")).toBe(true);
  });

  it("When the funnel is pressed, Then the row shows a search, a toggle per value the rows carry, and the orders", async () => {
    const { find, root, userEvent } = await mount();
    await userEvent('[data-filter-section="documents"]', "click");
    expect(find('[data-filter-section="documents"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(find('[data-library-filter="documents"]')?.hasAttribute("hidden")).toBe(false);
    expect(find("[data-filter-search]")?.getAttribute("aria-label")).toBe("Search titles");
    const toggles = Array.from(root.querySelectorAll("[data-filter-value]")).map((element) => element.getAttribute("data-filter-value"));
    expect(toggles).toEqual(["kind:document", "kind:source", "started:started"]);
    expect(find('[data-filter-value="started:started"]')?.getAttribute("aria-label")).toBe("Started by an agent");
    expect(find('[data-filter-value="kind:source"]')?.textContent).toBe("Source");
    expect(Array.from(root.querySelectorAll("[data-filter-order] option")).map((option) => option.textContent)).toEqual([
      "Title A–Z",
      "Last changed first",
    ]);
  });

  it("When a value is toggled off, Then its rows leave, the choice is stored and the funnel reads as active", async () => {
    const { find, listed, stored, userEvent } = await mount();
    await userEvent('[data-filter-section="documents"]', "click");
    await userEvent('[data-filter-value="started:started"]', "click");
    expect(listed()).toEqual(["a", "b"]);
    expect(find('[data-filter-value="started:started"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(stored()).toEqual(["started:started", "order:title"]);
    expect(find('[data-filter-section="documents"]')?.getAttribute("data-filtered")).toBe("true");
    await userEvent('[data-filter-value="started:started"]', "click");
    expect(listed()).toEqual(["a", "b", "c"]);
    expect(find('[data-filter-section="documents"]')?.hasAttribute("data-filtered")).toBe(false);
  });

  it("When an order is chosen, Then the rows rearrange and the order is stored", async () => {
    const { find, listed, stored, userEvent } = await mount();
    const select = find("[data-filter-order]") as HTMLSelectElement;
    select.value = "changed";
    await userEvent(select, "change");
    expect(listed()).toEqual(["b", "c", "a"]);
    expect(stored()).toEqual(["order:changed"]);
  });

  it("When words are typed, Then the rows narrow to the labels holding them, and nothing is stored", async () => {
    const { find, listed, stored, userEvent } = await mount();
    const search = find("[data-filter-search]") as HTMLInputElement;
    search.value = "NOTES";
    await userEvent(search, "input");
    expect(listed()).toEqual(["a"]);
    expect(stored()).toBeNull();
    expect(find('[data-filter-section="documents"]')?.getAttribute("data-filtered")).toBe("true");
  });

  it("Given a stored choice hiding every row, Then the body says no documents match, and Clear filter brings them back", async () => {
    const { find, listed, stored, userEvent } = await mount(["kind:document", "kind:source", "order:changed"]);
    expect(listed()).toEqual([]);
    expect(find('[data-library-no-match="documents"]')?.textContent).toContain("No documents match");
    expect(find('[data-library-empty="documents"]')).toBeNull();
    await userEvent('[data-clear-filter="documents"]', "click");
    expect(listed()).toEqual(["a", "b", "c"]);
    expect(stored()).toEqual(["order:title"]);
  });
});
