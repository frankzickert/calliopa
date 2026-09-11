import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { Pointing } from "~/lib/command-target";
import { ComposerHost } from "./testing/composer-host";

/**
 * Marks that arrive after the composer is drawn — the order the served shell
 * meets — reach both of the composer's consumers of the report, the `#` offer
 * and the chips, through the shell's own JSX (`composer-host.tsx`). The offer
 * and the disclosure the chips replaced both froze empty in the served shell
 * until each took the report itself rather than `.references` of it.
 * BO_0227_015 BO_0227_017 CA_0039_003
 */
const report: Pointing = {
  references: [
    { kind: "block", number: 1, blockId: "a", words: "Opening.", stale: false },
    {
      kind: "passage",
      number: 2,
      blockId: "b",
      quote: "before the lights",
      words: "before the lights",
      stale: false,
    },
  ],
  pinned: [],
};

const mount = async () => {
  const dom = await createDOM();
  await dom.render(jsx(ComposerHost, { report }));
  const root = dom.screen as unknown as HTMLElement;
  const field = root.querySelector("#command") as HTMLTextAreaElement;
  // This DOM's textarea keeps no caret; the shim stands in for the one the
  // reader's typing leaves.
  field.setSelectionRange = (start: number, end: number) => {
    Object.assign(field, { selectionStart: start, selectionEnd: end });
  };
  await dom.userEvent("[data-report]", "click");
  return { ...dom, root, field };
};

describe("marks that arrive after the composer is drawn", () => {
  it("Given # typed, Then the references are offered", async () => {
    const { root, field, userEvent } = await mount();
    field.value = "tighten #";
    field.setSelectionRange(9, 9);
    await userEvent(field, "input");
    expect(
      Array.from(root.querySelectorAll("[data-reference-option]")).map(
        (option) => option.getAttribute("data-reference-option"),
      ),
    ).toEqual(["1", "2"]);
  });

  it("Given the marks arrived, Then the chips show them", async () => {
    const { root } = await mount();
    expect(
      Array.from(root.querySelectorAll("[data-chips] [data-chip]")).map((chip) =>
        chip.getAttribute("data-chip"),
      ),
    ).toEqual(["1", "2"]);
  });
});
