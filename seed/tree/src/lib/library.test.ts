import { describe, expect, it } from "vitest";

import { tabUnnamed } from "./library";

/**
 * Whether a tab holds an item nobody has named: the listing says so, and the
 * tab reads it from the section whose rows open its kind. DO_0012_008
 */
const sections = [
  { key: "documents:documents", opens: "documents:document" },
  { key: "calliopa-video:episodes", opens: "calliopa-video:episode" },
  { key: "ui.shell:extensions" },
];

const data: Record<string, unknown> = {
  "documents:documents": [
    { id: "doc-new", label: "Untitled document", unnamed: true },
    { id: "doc-named", label: "Release plan" },
  ],
  "calliopa-video:episodes": [{ id: "doc-new", label: "Untitled document", unnamed: true }],
  "ui.shell:extensions": { extensions: [] },
};

describe("a tab holding an item nobody has named", () => {
  it("Given the listing marks the item, Then the tab reads as unnamed", () => {
    expect(tabUnnamed(sections, data, { itemId: "doc-new", kind: "documents:document" })).toBe(true);
  });

  it("Given the listing does not mark it, Then the tab reads as named", () => {
    expect(tabUnnamed(sections, data, { itemId: "doc-named", kind: "documents:document" })).toBe(false);
  });

  it("Given no listing carries the item, Then the tab reads as named", () => {
    expect(tabUnnamed(sections, data, { itemId: "doc-child", kind: "documents:document" })).toBe(false);
    expect(tabUnnamed(sections, {}, { itemId: "doc-new", kind: "documents:document" })).toBe(false);
  });

  it("Given another section marks an item of the same identity, Then a tab of this kind is unaffected", () => {
    expect(tabUnnamed(sections, data, { itemId: "doc-new", kind: "settings:settings" })).toBe(false);
  });

  it("Given a tab with no item, Then it reads as named", () => {
    expect(tabUnnamed(sections, data, { itemId: null, kind: "documents:document" })).toBe(false);
  });

  it("Given a section whose body is not a list of rows, Then it answers nothing", () => {
    expect(tabUnnamed([{ key: "ui.shell:extensions", opens: "ui.shell:extension" }], data, { itemId: "doc-new", kind: "ui.shell:extension" })).toBe(false);
  });
});
