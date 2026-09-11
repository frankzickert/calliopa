import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { Pointing } from "~/lib/command-target";
import { ComposerHost } from "./testing/composer-host";

/**
 * The command bar pressed through the shell's own JSX (`composer-host.tsx`):
 * the strip above the bar, the bar, and the chips along the field's edge.
 * CA_0039_001 CA_0039_002 CA_0039_003 CA_0039_006
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
      stale: true,
    },
  ],
  pinned: [{ blockId: "c", words: "Tone: dry." }],
};

const mount = async () => {
  const dom = await createDOM();
  await dom.render(jsx(ComposerHost, { report }));
  const root = dom.screen as unknown as HTMLElement;
  // This DOM answers `undefined`, not `null`, when nothing matches.
  const find = (selector: string) =>
    (root.querySelector(selector) as HTMLElement | null) ?? null;
  const sent = () =>
    JSON.parse(find("[data-target]")?.textContent ?? "null") as {
      delivery: string;
      references: unknown[];
    } | null;
  const revealed = () =>
    JSON.parse(find("[data-reveal]")?.textContent ?? "null") as {
      itemId: string | null;
      target: unknown;
      seq: number;
    };
  return { ...dom, root, find, sent, revealed };
};

describe("the strip above the bar", () => {
  it("Given a document tab, Then the strip holds the view's toggle and the document's title, named in full", async () => {
    const { find } = await mount();
    const strip = find("[data-command-strip]");
    expect(strip?.getAttribute("aria-label")).toBe(
      "Command aimed at Draft of the storm chapter",
    );
    expect(strip?.querySelector('[data-dock-action="command-mode"]') != null).toBe(true);
    expect(find("[data-aim-title]")?.textContent).toBe("Draft of the storm chapter");
  });

  it("Given a tab that is not a document and contributes nothing, Then there is no strip", async () => {
    const { find, userEvent } = await mount();
    await userEvent('[data-switch="tab-settings"]', "click");
    expect(find("[data-command-strip]")).toBeNull();
    expect(find("[data-aim-title]")).toBeNull();
    expect(find("[data-aim-dismiss]")).toBeNull();
  });

  it("When × is pressed, Then the command answers in the console and still carries the references, and the title brings propose back", async () => {
    const { find, sent, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    expect(sent()?.delivery).toBe("propose");
    await userEvent("[data-aim-dismiss]", "click");
    expect(sent()?.delivery).toBe("answer");
    expect(sent()?.references).toHaveLength(2);
    expect(find("[data-aim-answer]")?.textContent).toBe("Answer in the console");
    expect(find("[data-aim-dismiss]")).toBeNull();
    await userEvent("[data-aim-restore]", "click");
    expect(sent()?.delivery).toBe("propose");
    expect(find("[data-aim-dismiss]") != null).toBe(true);
  });

  it("Given × pressed in one document, Then another comes forward on propose, and the first is still dismissed on return", async () => {
    const { sent, userEvent } = await mount();
    await userEvent("[data-aim-dismiss]", "click");
    await userEvent('[data-switch="tab-doc-2"]', "click");
    expect(sent()?.delivery).toBe("propose");
    await userEvent('[data-switch="tab-doc-1"]', "click");
    expect(sent()?.delivery).toBe("answer");
  });
});

describe("the bar", () => {
  it("Given the bar, Then the field is labelled though no label shows, Run is named and there is no Result select, disclosure or drop target", async () => {
    const { root, find } = await mount();
    const label = find('label[for="command"]');
    expect(label?.textContent).toBe("Command");
    expect(label?.getAttribute("class")).toContain("visually-hidden");
    expect(find("[data-run]")?.getAttribute("aria-label")).toBe("Run");
    expect(root.querySelector(".composer select") ?? null).toBeNull();
    expect(find("[data-run-marks]")).toBeNull();
    expect(find("[data-drop-target]")).toBeNull();
    expect(find("[data-accepts]")).toBeNull();
  });

  it("Given a command sending, Then Run is disabled", async () => {
    const { find, userEvent } = await mount();
    expect(find("[data-run]")?.hasAttribute("disabled")).toBe(false);
    await userEvent("[data-sending]", "click");
    expect(find("[data-run]")?.hasAttribute("disabled")).toBe(true);
  });

  it("Given # typed, Then the offer opens before the field, above it", async () => {
    const { root, find, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    const field = find("#command") as HTMLTextAreaElement;
    field.value = "tighten #";
    field.setSelectionRange = (start: number, end: number) => {
      Object.assign(field, { selectionStart: start, selectionEnd: end });
    };
    field.setSelectionRange(9, 9);
    await userEvent(field, "input");
    const offer = find(".composer__references");
    expect(offer != null).toBe(true);
    const siblings = Array.from(field.parentElement?.children ?? []);
    expect(siblings.indexOf(offer as Element)).toBeLessThan(siblings.indexOf(field));
    expect(root.querySelectorAll("[data-reference-option]").length).toBe(2);
  });
});

describe("the chips along the field", () => {
  it("Given nothing marked or pinned, Then there is no chip row", async () => {
    const { find } = await mount();
    expect(find("[data-chips]")).toBeNull();
  });

  it("Given marks and a pinned block, Then the chips come in mark order with the pin after them, each named by its words", async () => {
    const { root, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    const chips = Array.from(root.querySelectorAll("[data-chips] button"));
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "Reference 1: “Opening.”",
      "Reference 2, stale: “before the lights”",
      "Pinned: “Tone: dry.”",
    ]);
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(["#1", "#2", ""]);
  });

  it("Given a stale passage, Then its chip says so beyond colour", async () => {
    const { find, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    expect(find('[data-chip="1"]')?.getAttribute("data-stale")).toBe("false");
    const stale = find('[data-chip="2"]');
    expect(stale?.getAttribute("data-stale")).toBe("true");
    expect(stale?.querySelector("svg") != null).toBe(true);
  });

  it("When a chip is pressed, Then reveal asks the document's view for its area, and a second press asks again", async () => {
    const { revealed, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    await userEvent('[data-chip="2"]', "click");
    expect(revealed()).toEqual({
      itemId: "doc-1",
      target: { kind: "passage", blockId: "b", number: 2 },
      seq: 1,
    });
    await userEvent('[data-chip="2"]', "click");
    expect(revealed().seq).toBe(2);
    await userEvent('[data-chip-pinned="c"]', "click");
    expect(revealed()).toEqual({
      itemId: "doc-1",
      target: { kind: "block", blockId: "c" },
      seq: 3,
    });
  });
});
