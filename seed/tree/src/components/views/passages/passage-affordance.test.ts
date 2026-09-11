import {
  $,
  component$,
  jsx,
  useContextProvider,
  useStore,
} from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { describe, expect, it } from "vitest";

import { anchorAt, MAX_PASSAGE_QUOTE, type PassageAnchor } from "~/lib/passage";
import { addPassage, NO_MARKING, type Marking } from "~/lib/references";
import type { DocumentView } from "~/server/documents/assemble";
import { MarkingContext, type MarkingControls } from "../marking/use-marking";
import { PassageAffordance } from "./passage-affordance";
import { PassageNumbers } from "./passage-numbers";
import { PassagesContext, type PassagesStore } from "./use-passages";

/**
 * The passage controls pressed in Qwik's render harness, with the selection
 * handed to them as the page would: this DOM keeps no Selection, so the words
 * the reader selected are the store the editor's tracker writes. BO_0227_009
 * BO_0227_017
 */
const text = "The storm arrives before the lights go out.";
const start = text.indexOf("before");
const document = (blockText: string): DocumentView => ({
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    {
      kind: "text",
      blockId: "blk-b",
      revisionId: "rev-b",
      containmentId: "c-b",
      order: "b",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: blockText }],
    },
  ],
});

interface Pressed {
  added: { blockId: string; anchor: PassageAnchor }[];
  repointed: { number: number; anchor: PassageAnchor }[];
  removed: number[];
}

const harness = (input: {
  marking: Marking;
  blockText: string;
  end: number;
  pressed: Pressed;
}) =>
  component$(() => {
    const markingStore = useStore({ marking: input.marking });
    const passages = useStore<PassagesStore>({
      selected: {
        blockId: "blk-b",
        start,
        end: input.end,
        bottom: 10,
        left: 20,
      },
      badges: { "blk-b": [{ number: 1, top: 2, left: 30 }] },
    });
    const noop = $(() => undefined);
    const controls: MarkingControls = {
      store: markingStore,
      setMode$: $(async () => undefined),
      toggleReference$: noop,
      addPassage$: $((blockId: string, anchor: PassageAnchor) => {
        input.pressed.added.push({ blockId, anchor });
      }),
      repointPassage$: $((number: number, anchor: PassageAnchor) => {
        input.pressed.repointed.push({ number, anchor });
      }),
      removeReference$: $((number: number) => {
        input.pressed.removed.push(number);
      }),
      restore$: noop,
      recover$: noop,
    };
    useContextProvider(MarkingContext, controls);
    useContextProvider(PassagesContext, passages);
    const surface = { document: document(input.blockText) };
    return jsx("div", {
      children: [
        jsx(PassageAffordance, { surface }),
        jsx(PassageNumbers, { block: surface.document.blocks[0]! }),
      ],
    });
  });

const mount = async (input: {
  marking?: Marking;
  blockText?: string;
  end?: number;
}) => {
  const pressed: Pressed = { added: [], repointed: [], removed: [] };
  const dom = await createDOM();
  await dom.render(
    jsx(
      harness({
        marking: input.marking ?? { ...NO_MARKING, mode: "command" },
        blockText: input.blockText ?? text,
        end: input.end ?? start + "before the lights".length,
        pressed,
      }),
      {},
    ),
  );
  return { ...dom, root: dom.screen as unknown as HTMLElement, pressed };
};

describe("referencing selected words", () => {
  it("Given words selected in command mode, When Reference is pressed, Then the passage is marked by its words", async () => {
    const view = await mount({});
    expect(
      view.root.querySelector("[data-passage-reference]")?.textContent,
    ).toBe("Reference");
    await view.userEvent("[data-passage-reference]", "pointerdown");
    expect(view.pressed.added).toHaveLength(1);
    expect(view.pressed.added[0]?.blockId).toBe("blk-b");
    expect(view.pressed.added[0]?.anchor.quote).toBe("before the lights");
  });

  it("Given the reader is not in command mode, Then nothing is offered", async () => {
    const view = await mount({ marking: NO_MARKING });
    expect(
      view.root.querySelector("[data-passage-affordance]") ?? null,
    ).toBeNull();
  });

  it("Given more words than a passage holds, Then Reference is not offered and the reason is", async () => {
    const long = "word ".repeat(MAX_PASSAGE_QUOTE);
    const view = await mount({
      blockText: long,
      end: start + MAX_PASSAGE_QUOTE + 1,
    });
    expect(
      view.root.querySelector("[data-passage-reference]") ?? null,
    ).toBeNull();
    expect(view.root.textContent).toContain("Too long for a passage");
  });
});

describe("a stale passage", () => {
  const anchored = addPassage(
    { ...NO_MARKING, mode: "command" },
    "blk-b",
    anchorAt(text, start, start + "before the lights".length),
  );
  const edited = "The storm arrives after the candles go out.";
  const candles = edited.indexOf("candles");

  it("Given a passage whose words were edited away, Then its number says stale, and a selection offers to re-point it under the same number", async () => {
    const view = await mount({
      marking: anchored,
      blockText: edited,
      end: candles + "candles".length,
    });
    expect(
      view.root.querySelector('[data-passage-stale="1"]')?.textContent,
    ).toBe("#1 stale");
    await view.userEvent('[data-passage-repoint="1"]', "pointerdown");
    expect(view.pressed.repointed[0]?.number).toBe(1);
  });

  it("Given a passage whose words stand, Then its number is drawn beside them and nothing is stale", async () => {
    const view = await mount({ marking: anchored });
    expect(
      view.root.querySelector('[data-passage-number="1"]')?.textContent,
    ).toBe("#1");
    expect(view.root.querySelector("[data-passage-stale]") ?? null).toBeNull();
    expect(
      view.root.querySelector("[data-passage-repoint]") ?? null,
    ).toBeNull();
  });
});

describe("taking a passage back from the page", () => {
  it("Given a passage's own words selected again, Then Take back is offered in place of Reference, and takes it back", async () => {
    const anchored = addPassage(
      { ...NO_MARKING, mode: "command" },
      "blk-b",
      anchorAt(text, start, start + "before the lights".length),
    );
    const view = await mount({ marking: anchored });
    expect(
      view.root.querySelector("[data-passage-reference]") ?? null,
    ).toBeNull();
    expect(
      view.root.querySelector('[data-passage-take-back="1"]')?.textContent,
    ).toBe("Take back #1");
    await view.userEvent('[data-passage-take-back="1"]', "pointerdown");
    expect(view.pressed.removed).toEqual([1]);
  });
});
