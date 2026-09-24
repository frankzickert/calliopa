import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import type { Pointing } from "~/lib/command-target";
import { ReferenceChipsHost } from "./testing/reference-chips-host";

/**
 * What a command carries, as chips, pressed through real JSX
 * (`reference-chips-host.tsx`): a block's command control draws them on its
 * line (`BO_0267_012`). The report arrives after the chips are drawn, the
 * order the served shell meets, which froze the chips once while the plain
 * report was taken apart (`qwik-member-props-freeze`). CA_0039_003
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
  fixated: [{ blockId: "c", words: "Tone: dry." }],
};

const mount = async (shown: Pointing = report) => {
  const dom = await createDOM();
  await dom.render(jsx(ReferenceChipsHost, { report: shown }));
  const root = dom.screen as unknown as HTMLElement;
  // This DOM answers `undefined`, not `null`, when nothing matches.
  const find = (selector: string) =>
    (root.querySelector(selector) as HTMLElement | null) ?? null;
  const revealed = () =>
    JSON.parse(find("[data-reveal]")?.textContent ?? "null") as {
      target: unknown;
      seq: number;
    };
  return { ...dom, root, find, revealed };
};

describe("the chips along the field", () => {
  it("Given nothing marked or fixated, Then there is no chip row", async () => {
    const { find } = await mount();
    expect(find("[data-chips]")).toBeNull();
  });

  it("Given marks and a fixated block, Then the chips come in mark order with the fixated one after them, each named by its words", async () => {
    const { root, userEvent } = await mount();
    await userEvent("[data-report]", "click");
    const chips = Array.from(root.querySelectorAll("[data-chips] button"));
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "Reference 1: “Opening.”",
      "Reference 2, stale: “before the lights”",
      "Fixated: “Tone: dry.”",
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
      target: { kind: "passage", blockId: "b", number: 2 },
      seq: 1,
    });
    await userEvent('[data-chip="2"]', "click");
    expect(revealed().seq).toBe(2);
    await userEvent('[data-chip-fixated="c"]', "click");
    expect(revealed()).toEqual({
      target: { kind: "block", blockId: "c" },
      seq: 3,
    });
  });
});

/**
 * A reference to what was marked: its chip says what it is in a word and
 * what has happened since in its name, and a rowless one — a proposal
 * rejected since — carries the × that takes it back, since its row has gone.
 * BO_0263_007
 */
describe("the chips of what was marked", () => {
  const marked: Pointing = {
    references: [
      { kind: "block", number: 1, blockId: "n", words: "A new line.", stale: false, target: "proposal", group: "node:g", item: "node:g|insert|node:n", revisionId: "rev-n", what: "proposal", proposer: "Claude Code", since: "rejected", rowless: true },
      { kind: "block", number: 2, blockId: "r", words: "Gone.", stale: false, target: "retired", revisionId: "rev-r", what: "retired" },
    ],
    fixated: [],
  };

  it("Given a rejected proposal and a retired block, Then each chip says what it is, and only the rowless one has a ×", async () => {
    const { root, find, userEvent } = await mount(marked);
    await userEvent("[data-report]", "click");
    const chips = Array.from(root.querySelectorAll("[data-chip]"));
    expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
      "Reference 1: proposed by Claude Code, “A new line.”, since rejected",
      "Reference 2: retired block, “Gone.”",
    ]);
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(["#1proposed", "#2retired"]);
    expect(find('[data-chip-take-back="1"]')?.getAttribute("aria-label")).toBe("Take back reference 1");
    expect(find('[data-chip-take-back="2"]')).toBeNull();
  });

  it("When the × is pressed, Then the view is asked to take the reference back, and the chip itself reveals nothing", async () => {
    const { revealed, userEvent } = await mount(marked);
    await userEvent("[data-report]", "click");
    await userEvent('[data-chip="1"]', "click");
    expect(revealed().seq).toBe(0);
    await userEvent('[data-chip-take-back="1"]', "click");
    expect(revealed()).toEqual({ target: { kind: "takeBack", number: 1 }, seq: 1 });
  });
});
