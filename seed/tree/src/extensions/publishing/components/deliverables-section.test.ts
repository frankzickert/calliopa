import { $, component$, jsx, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { DeliverablesListing, StandingListing } from "../lib/work";
import { DeliverablesSection } from "./deliverables-section";
import { StandingSection } from "./standing-section";

/**
 * The Deliverables and Standing Items sections pressed by name in Qwik's
 * render harness: groups per shape with rows opening the deliverable, the
 * `+` opening the form with the shapes to choose from, a blank title refused
 * in the form, the standing rows with their class, and the empty states.
 * PU_0002_007
 */

const host = (Section: typeof DeliverablesSection | typeof StandingSection, data: unknown, opened: { target: unknown }, sectionKey: string) =>
  component$(() => {
    const bridge = useStore({
      drag: {},
      inspector: { text: null, facts: [], actions: [] },
      dock: {},
      save: {},
      openTarget$: $(async (target: unknown) => {
        opened.target = target;
      }),
    });
    useContextProvider(ViewBridgeContext, bridge as never);
    return jsx(Section, { data, activeItemId: null, sectionKey, filter: null, setFilter$: $(async () => {}) });
  });

const mount = async (Section: typeof DeliverablesSection | typeof StandingSection, data: unknown, sectionKey: string) => {
  const opened = { target: null as unknown };
  const dom = await createDOM();
  await dom.render(jsx(host(Section, data, opened, sectionKey), {}));
  const html = (): string => (dom.screen as unknown as HTMLElement).innerHTML;
  return { ...dom, html, opened };
};

const listing = (over: Partial<DeliverablesListing> = {}): DeliverablesListing => ({
  reachable: true,
  shapes: [
    { shapeId: "s-ep", title: "Episode" },
    { shapeId: "s-se", title: "Series" },
  ],
  groups: [],
  ...over,
});

describe("the Deliverables section", () => {
  it("Given deliverables of two shapes, Then each group carries its shape's title and a row opens its deliverable", async () => {
    const { html, userEvent, opened } = await mount(
      DeliverablesSection,
      listing({
        groups: [
          { shape: { shapeId: "s-ep", title: "Episode" }, deliverables: [{ deliverableId: "d-1", title: "E1", shapeId: "s-ep", shapeTitle: "Episode" }] },
          { shape: { shapeId: "s-se", title: "Series" }, deliverables: [{ deliverableId: "d-2", title: "Season 1", shapeId: "s-se", shapeTitle: "Series" }] },
        ],
      }),
      "publishing:deliverables",
    );
    expect(html()).toContain('data-library-group="s-ep"');
    expect(html()).toContain(">Episode<");
    expect(html()).toContain(">Series<");
    await userEvent('[data-deliverable-row="d-2"]', "click");
    expect(opened.target).toEqual({ kind: "publishing:deliverable", itemId: "d-2", title: "Season 1" });
  });

  it("Given the `+` pressed, Then the form offers the shapes and refuses a blank title without sending", async () => {
    const { html, userEvent } = await mount(DeliverablesSection, listing(), "publishing:deliverables");
    expect(html()).toContain("No deliverables yet");
    await userEvent("[data-new-deliverable]", "click");
    expect(html()).toContain('<option value="s-ep">Episode</option>');
    await userEvent("[data-new-deliverable-form]", "submit");
    expect(html()).toContain("A deliverable needs a title.");
    await userEvent("[data-new-deliverable-cancel]", "click");
    expect(/<form[^>]*data-new-deliverable-form[^>]*>/u.exec(html())?.[0]).toContain("hidden");
  });

  it("Given no shapes, Then creating says to make a shape first", async () => {
    const { html, userEvent } = await mount(DeliverablesSection, listing({ shapes: [] }), "publishing:deliverables");
    await userEvent("[data-new-deliverable]", "click");
    await userEvent("[data-new-deliverable-form]", "submit");
    expect(html()).toContain("Make a shape first");
  });
});

describe("the Standing Items section", () => {
  const standing = (over: Partial<StandingListing> = {}): StandingListing => ({ reachable: true, items: [], uploadCapBytes: 104857600, ...over });

  it("Given standing items, Then each row carries its label and class and opens the item", async () => {
    const { html, userEvent, opened } = await mount(
      StandingSection,
      standing({ items: [{ itemId: "i-1", class: "image", label: "Key art", durationSeconds: null, width: 1920, height: 1080, exportCount: 1 }] }),
      "publishing:standing",
    );
    expect(html()).toContain('data-item-row="i-1"');
    expect(html()).toContain(">image<");
    await userEvent('[data-item-row="i-1"]', "click");
    expect(opened.target).toEqual({ kind: "publishing:item", itemId: "i-1", title: "Key art" });
  });

  it("Given nothing standing, Then the section says so, and offers the file picker", async () => {
    const { html } = await mount(StandingSection, standing(), "publishing:standing");
    expect(html()).toContain("No standing items");
    expect(html()).toContain("data-ingest-file");
  });
});
