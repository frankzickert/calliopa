import { $, component$, jsx, useContextProvider, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { ViewBridgeContext } from "~/components/shell/view-bridge";
import type { ChannelsListing } from "../lib/library";
import { ChannelsSection } from "./channels-section";

/**
 * The Channels section pressed by name in Qwik's render harness: its rows
 * with the kind's icon and the state as the badge, the `+` opening the form
 * with the kinds to choose from, *Cancel* closing it, and the empty and
 * unreachable states. PU_0001_008
 */

const section = (data: unknown, opened: { target: unknown }) =>
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
    return jsx(ChannelsSection, {
      data,
      activeItemId: null,
      sectionKey: "publishing:channels",
      filter: null,
      setFilter$: $(async () => {}),
    });
  });

const listing = (over: Partial<ChannelsListing> = {}): ChannelsListing => ({
  reachable: true,
  kinds: [{ id: "website", label: "Website", fields: [], readsIndex: true }],
  channels: [],
  ...over,
});

const mount = async (data: ChannelsListing) => {
  const opened = { target: null as unknown };
  const dom = await createDOM();
  await dom.render(jsx(section(data, opened), {}));
  const html = (): string => (dom.screen as unknown as HTMLElement).innerHTML;
  const form = (): string => /<form[^>]*data-new-channel-form[^>]*>/u.exec(html())?.[0] ?? "";
  return { ...dom, html, form, opened };
};

describe("the Channels section", () => {
  it("Given channels, Then each row carries its kind's icon, its title and its state, and opens the channel", async () => {
    const { html, userEvent, opened } = await mount(
      listing({
        channels: [
          { channelId: "c-1", kind: "website", kindLabel: "Website", title: "Production site", state: "verified", retired: false },
          { channelId: "c-2", kind: "website", kindLabel: "Website", title: "Staging site", state: "unconfigured", retired: false },
        ],
      }),
    );
    expect(html()).toContain('data-channel-row="c-1"');
    expect(html()).toContain('data-kind-icon="website"');
    expect(html()).toContain('data-channel-state="verified"');
    expect(html()).toContain("Production site");
    expect(html()).toContain('data-channel-state="unconfigured"');
    await userEvent('[data-channel-row="c-2"]', "click");
    expect(opened.target).toEqual({ kind: "publishing:channel", itemId: "c-2", title: "Staging site" });
  });

  it("Given no channels, Then the section says so rather than reading as empty", async () => {
    const { html } = await mount(listing());
    expect(html()).toContain("No channels yet");
  });

  it("Given a graph that could not be read, Then the section says so", async () => {
    const { html } = await mount(listing({ reachable: false }));
    expect(html()).toContain("Graph not reachable");
  });

  it("Given the `+` pressed, Then the form opens with the kinds to choose from, and Cancel closes it", async () => {
    const { html, form, userEvent } = await mount(listing());
    expect(form()).toContain("hidden");
    await userEvent("[data-new-channel]", "click");
    expect(form()).not.toContain("hidden");
    expect(html()).toContain('<option value="website">Website</option>');
    await userEvent("[data-new-channel-cancel]", "click");
    expect(form()).toContain("hidden");
  });

  it("Given the form submitted without a title, Then the refusal is shown in the form and nothing is sent", async () => {
    const { html, userEvent } = await mount(listing());
    await userEvent("[data-new-channel]", "click");
    await userEvent("[data-new-channel-form]", "submit");
    expect(html()).toContain("A channel needs a title.");
  });
});
