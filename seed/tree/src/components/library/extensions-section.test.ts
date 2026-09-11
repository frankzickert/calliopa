import { $, component$, jsx, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import { ExtensionsSection } from "./extensions-section";

/**
 * The section's own controls, pressed rather than described. Three defects
 * live behind these assertions, each invisible to a test that only read the
 * markup:
 *
 * - the create form is `display: flex`, which overrode the user agent's
 *   `[hidden] { display: none }` until `global.css` claimed the attribute
 *   back, so the form stood open and *Cancel* looked broken;
 * - the `+` lived on the category header and told the section through a
 *   window event, which never arrived — Qwik renders a window listener as
 *   `on-window:<event>` and the loader reads the name up to the next colon,
 *   and the channel stayed unproven after the name was repaired, so the
 *   control moved into the section where its form is its own state;
 * - a person who is not the owner must see no import control, since the
 *   kernel refuses them.
 *
 * BO_0224_009 BO_0224_011
 */
const section = (data: unknown) =>
  component$(() => {
    const bridge = useStore({
      drag: {},
      inspector: { text: null, facts: [], actions: [] },
      dock: {},
      save: {},
      openTarget$: $(async () => {}),
    });
    useContextProvider(ViewBridgeContext, bridge as never);
    return jsx(ExtensionsSection, {
      data,
      activeItemId: null,
      sectionKey: "ui.shell:extensions",
      filter: null,
      setFilter$: $(async () => {}),
    });
  });

const listing = (over: Record<string, unknown> = {}) => ({
  reachable: true,
  extensions: [],
  other: [],
  ...over,
});

const mount = async (data: unknown = listing()) => {
  const dom = await createDOM();
  await dom.render(jsx(section(data), {}));
  const html = (): string => (dom.screen as unknown as HTMLElement).innerHTML;
  const form = (): string => /<form[^>]*data-new-extension-form[^>]*>/u.exec(html())?.[0] ?? "";
  return { ...dom, html, form };
};

describe("the Extensions section's own controls", () => {
  it("Given the section, Then the create form is in the tree and hidden", async () => {
    const view = await mount();
    expect(view.form()).not.toBe("");
    expect(view.form()).toContain("hidden");
  });

  it("Given the create control pressed, Then the form opens; pressed again or cancelled, it closes", async () => {
    const view = await mount();
    await view.userEvent("[data-new-extension]", "click");
    expect(view.form(), "the form stayed hidden after the create control").not.toContain("hidden");
    await view.userEvent("[data-new-extension-cancel]", "click");
    expect(view.form(), "Cancel did not close the form").toContain("hidden");
    await view.userEvent("[data-new-extension]", "click");
    expect(view.form()).not.toContain("hidden");
    await view.userEvent("[data-new-extension]", "click");
    expect(view.form(), "the control does not close what it opened").toContain("hidden");
  });

  it("Given the section, Then it needs no window listener to work", async () => {
    const view = await mount();
    expect(view.html().match(/on-window:[^=\s]*/gu) ?? []).toEqual([]);
  });

  it("Given the funnel pressed, Then the filter row opens and closes with it", async () => {
    const view = await mount();
    const row = (): string => /<div[^>]*id="library-change-filter"[^>]*>/u.exec(view.html())?.[0] ?? "";
    expect(row()).toContain("hidden");
    await view.userEvent("[data-filter-changes]", "click");
    expect(row()).not.toContain("hidden");
    await view.userEvent("[data-filter-changes]", "click");
    expect(row()).toContain("hidden");
  });

  it("Given a person who is not the owner, Then no import control is offered", async () => {
    expect((await mount(listing({ owner: true }))).html()).toContain("data-import-extension");
    expect((await mount(listing({ owner: false }))).html()).not.toContain("data-import-extension");
  });
});
