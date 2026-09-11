import { $, component$, jsx, useStore } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { NO_POINTING, type PointedReference } from "~/lib/command-target";
import { CommandField } from "./command-field";

/** Naming a reference by typing `#`, pressed in the render harness.
 * BO_0227_015 BO_0227_017 */
const references: PointedReference[] = [
  {
    kind: "block",
    number: 1,
    blockId: "blk-a",
    words: "Opening.",
    stale: false,
  },
  {
    kind: "passage",
    number: 2,
    blockId: "blk-b",
    quote: "before the lights",
    words: "before the lights",
    stale: false,
  },
];

const mount = async () => {
  const dom = await createDOM();
  await dom.render(jsx(CommandField, { pointing: { references, pinned: [] } }));
  const root = dom.screen as unknown as HTMLElement;
  const field = root.querySelector("#command") as HTMLTextAreaElement;
  // This DOM's textarea keeps no caret; a browser's does. The shim stands in
  // for the caret the reader's typing leaves, and nothing else.
  field.setSelectionRange = (start: number, end: number) => {
    Object.assign(field, { selectionStart: start, selectionEnd: end });
  };
  const type = async (text: string) => {
    field.value = text;
    field.setSelectionRange(text.length, text.length);
    await dom.userEvent(field, "input");
  };
  const options = () =>
    Array.from(root.querySelectorAll("[data-reference-option]")).map((option) =>
      option.getAttribute("data-reference-option"),
    );
  return { ...dom, root, field, type, options };
};

describe("typing # in the composer", () => {
  it("Given # typed, Then every reference is offered, and a digit narrows the offer", async () => {
    const view = await mount();
    await view.type("tighten #");
    expect(view.options()).toEqual(["1", "2"]);
    await view.type("tighten #2");
    expect(view.options()).toEqual(["2"]);
  });

  it("Given a reference chosen, Then #<number> is written where the reader was typing and the offer closes", async () => {
    const view = await mount();
    await view.type("keep #");
    await view.userEvent('[data-reference-option="2"]', "click");
    expect(view.field.value).toBe("keep #2 ");
    expect(view.options()).toEqual([]);
  });

  it("Given a # inside a word, Then nothing is offered", async () => {
    const view = await mount();
    await view.type("C#");
    expect(view.options()).toEqual([]);
  });
});

describe("the offer when marks arrive after the field", () => {
  // Wired as the shell wires it: the references are the report's, held in
  // the parent's store and replaced by the next report — the sequence in
  // which a list taken as a prop once stayed as empty as it began.
  const harness = component$(() => {
    const state = useStore({ shown: NO_POINTING });
    return jsx("div", {
      children: [
        jsx(CommandField, { pointing: state.shown }),
        jsx("button", {
          type: "button",
          "data-report": "",
          onClick$: $(() => {
            state.shown = { references: [...references], pinned: [] };
          }),
          children: "report",
        }),
      ],
    });
  });

  it("Given the field there before anything was marked, When marks arrive, Then # offers them", async () => {
    const dom = await createDOM();
    await dom.render(jsx(harness, {}));
    const root = dom.screen as unknown as HTMLElement;
    const field = root.querySelector("#command") as HTMLTextAreaElement;
    field.setSelectionRange = (start: number, end: number) => {
      Object.assign(field, { selectionStart: start, selectionEnd: end });
    };
    await dom.userEvent("[data-report]", "click");
    field.value = "keep #";
    field.setSelectionRange(6, 6);
    await dom.userEvent(field, "input");
    expect(
      Array.from(root.querySelectorAll("[data-reference-option]")).map(
        (option) => option.getAttribute("data-reference-option"),
      ),
    ).toEqual(["1", "2"]);
  });
});
