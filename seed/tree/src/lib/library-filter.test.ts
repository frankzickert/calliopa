import { describe, expect, it } from "vitest";
import type { LibraryFilter, LibraryItem } from "~/contract";
import {
  applyFilter,
  defaultChoice,
  filterChoiceOf,
  groupValues,
  isDefaultChoice,
  storedChoice,
  toggleFacet,
} from "./library-filter";

// The rules an item section's filter is drawn by, over the shape the Documents
// section declares. DO_0038_001
const filter: LibraryFilter = {
  search: "Search titles",
  groups: [
    { name: "kind", label: "Kind" },
    { name: "started", label: "Started" },
  ],
  orders: [
    { id: "title", label: "Title A–Z", by: "label-ascending" },
    { id: "title-desc", label: "Title Z–A", by: "label-descending" },
    { id: "changed", label: "Last changed first", by: "key-descending" },
  ],
  defaultOrder: "title",
  noMatch: "No documents match",
};

const item = (
  id: string,
  label: string,
  kind: string,
  extra: Partial<Pick<LibraryItem, "facets" | "orderKeys">> = {},
): LibraryItem => ({
  id,
  label,
  facets: { kind: { value: kind, label: kind }, ...extra.facets },
  ...(extra.orderKeys === undefined ? {} : { orderKeys: extra.orderKeys }),
});

const items: readonly LibraryItem[] = [
  item("a", "alpha notes", "document", { orderKeys: { changed: 10 } }),
  item("b", "Beta Source", "source", { orderKeys: { changed: 30 } }),
  item("c", "gamma notes", "document", {
    facets: { started: { value: "started", label: "Started by an agent" } },
    orderKeys: { changed: 20 },
  }),
  item("d", "Delta", "document"),
];

const ids = (rows: readonly LibraryItem[]) => rows.map((row) => row.id);

describe("an item section's filter", () => {
  it("reads the default when nothing was stored, and what was stored otherwise", () => {
    expect(filterChoiceOf(filter, null)).toEqual({ hidden: [], order: "title" });
    expect(filterChoiceOf({ ...filter, defaultHidden: ["kind:source"] }, undefined)).toEqual({
      hidden: ["kind:source"],
      order: "title",
    });
    expect(filterChoiceOf(filter, ["kind:source", "order:changed"])).toEqual({
      hidden: ["kind:source"],
      order: "changed",
    });
  });

  it("keeps a hidden value no item carries, and reads an order it no longer declares as the default", () => {
    expect(filterChoiceOf(filter, ["kind:manuscript", "order:gone"])).toEqual({
      hidden: ["kind:manuscript"],
      order: "title",
    });
  });

  it("stores a choice it reads back unchanged", () => {
    const choice = { hidden: ["started:started"], order: "title-desc" };
    expect(filterChoiceOf(filter, storedChoice(choice))).toEqual(choice);
  });

  it("toggles one value, and reads as default only when the choice is the default", () => {
    const hidden = toggleFacet(defaultChoice(filter), "kind", "source");
    expect(hidden.hidden).toEqual(["kind:source"]);
    expect(isDefaultChoice(filter, hidden)).toBe(false);
    expect(isDefaultChoice(filter, toggleFacet(hidden, "kind", "source"))).toBe(true);
    expect(isDefaultChoice(filter, { hidden: [], order: "changed" })).toBe(false);
  });

  it("offers each value the listed items carry once, by label", () => {
    expect(groupValues(items, "kind").map((facet) => facet.value)).toEqual(["document", "source"]);
    expect(groupValues(items, "started").map((facet) => facet.value)).toEqual(["started"]);
    expect(groupValues(items, "unnamed")).toEqual([]);
  });

  it("hides the rows carrying a hidden value and never one carrying no value for the group", () => {
    expect(ids(applyFilter(filter, { hidden: ["kind:source"], order: "title" }, "", items))).toEqual(["a", "d", "c"]);
    expect(ids(applyFilter(filter, { hidden: ["started:started"], order: "title" }, "", items))).toEqual(["a", "b", "d"]);
  });

  it("keeps the labels holding every typed word, ignoring case", () => {
    expect(ids(applyFilter(filter, defaultChoice(filter), "NOTES", items))).toEqual(["a", "c"]);
    expect(ids(applyFilter(filter, defaultChoice(filter), "notes gam", items))).toEqual(["c"]);
    expect(ids(applyFilter(filter, defaultChoice(filter), "   ", items))).toEqual(["a", "b", "d", "c"]);
    const { search: _search, ...unsearched } = filter;
    expect(ids(applyFilter(unsearched, defaultChoice(filter), "notes", items))).toHaveLength(4);
  });

  it("orders by label either way, and by key with the rows carrying none last", () => {
    expect(ids(applyFilter(filter, { hidden: [], order: "title" }, "", items))).toEqual(["a", "b", "d", "c"]);
    expect(ids(applyFilter(filter, { hidden: [], order: "title-desc" }, "", items))).toEqual(["c", "d", "b", "a"]);
    expect(ids(applyFilter(filter, { hidden: [], order: "changed" }, "", items))).toEqual(["b", "c", "a", "d"]);
  });
});
