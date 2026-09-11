import {
  $,
  component$,
  jsx,
  useContextProvider,
  useStore,
} from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { Standing } from "~/lib/disposition";
import type { BlockView } from "~/server/documents/assemble";
import { StandingControl } from "./standing-control";
import {
  StandingContext,
  type StandingControls,
  type StandingStore,
} from "./use-standing";

/**
 * The bar's Standing control pressed in Qwik's render harness: the active
 * block's standing, and every position on the scale reachable without a
 * gesture. Asserted by attribute: this DOM leaves `option.selected` undefined
 * (`BO_0224`). BO_0227_012 BO_0227_017
 */
const block: BlockView = {
  kind: "text",
  blockId: "blk-a",
  revisionId: "rev-a",
  containmentId: "c-a",
  order: "a",
  role: "paragraph",
  standing: "keep",
  runs: [{ text: "Opening." }],
};

const harness = (chosen: Standing[], activeBlockId: string | null) =>
  component$(() => {
    const store = useStore<StandingStore>({ overlay: {}, announcement: "" });
    const controls: StandingControls = {
      store,
      setStanding$: $(async (_blockId: string, to: Standing) => {
        chosen.push(to);
        store.overlay = { ...store.overlay, [block.blockId]: to };
      }),
    };
    useContextProvider(StandingContext, controls);
    return jsx(StandingControl, {
      surface: { document: { blocks: [block] } },
      editor: { blockId: activeBlockId },
    });
  });

const mount = async (activeBlockId: string | null) => {
  const chosen: Standing[] = [];
  const dom = await createDOM();
  await dom.render(jsx(harness(chosen, activeBlockId), {}));
  const root = dom.screen as unknown as HTMLElement;
  const select = () =>
    (root.querySelector("[data-block-standing]") as HTMLSelectElement | null) ??
    null;
  return { ...dom, root, chosen, select };
};

describe("the bar's Standing control", () => {
  it("Given an active block, Then it offers the whole scale with the block's standing chosen", async () => {
    const { select } = await mount("blk-a");
    const options = Array.from(select()?.options ?? []);
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "discarded",
      "resolved",
      "neutral",
      "keep",
      "pin",
    ]);
    expect(
      options
        .filter((option) => option.hasAttribute("selected"))
        .map((option) => option.getAttribute("value")),
    ).toEqual(["keep"]);
  });

  it("Given a standing chosen, Then it is set on the active block and the control shows it", async () => {
    const view = await mount("blk-a");
    const select = view.select()!;
    select.value = "pin";
    await view.userEvent(select, "change");
    expect(view.chosen).toEqual(["pin"]);
    const chosen = Array.from(view.select()?.options ?? []).filter((option) =>
      option.hasAttribute("selected"),
    );
    expect(chosen.map((option) => option.getAttribute("value"))).toEqual([
      "pin",
    ]);
  });

  it("Given no active block, Then there is no control", async () => {
    const { select } = await mount(null);
    expect(select()).toBeNull();
  });
});
