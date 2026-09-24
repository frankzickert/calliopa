import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { anchorAt } from "~/lib/passage";
import { REVEAL_MS } from "./reveal";
import {
  activateBlock,
  documentsApi,
  mountEditor,
  pointFrom,
  stopPointing,
  type SentCommand,
} from "./testing/editor-harness";

/**
 * The block editor pressed in Qwik's render harness. `BO_0226_009` could not
 * mount it: its load task reached the global `document`, which this DOM does
 * not install. The load task now reaches the page through the view's own
 * element (`BO_0227_006`), and these are the first presses of the editor
 * itself.
 */
const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [
    {
      kind: "text",
      blockId: "blk-a",
      revisionId: "rev-a",
      containmentId: "c-a",
      order: "a",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Opening." }],
    },
    {
      kind: "text",
      blockId: "blk-b",
      revisionId: "rev-b",
      containmentId: "c-b",
      order: "b",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "The storm arrives before the lights go out." }],
    },
    {
      kind: "text",
      blockId: "blk-c",
      revisionId: "rev-c",
      containmentId: "c-c",
      order: "c",
      role: "paragraph",
      standing: "keep",
      runs: [{ text: "Closing." }],
    },
  ],
};

/** The editor last mounted, left idle before the stubs go: a read a late
 * render starts must not reach the next test's `fetch`. DO_0001_003 */
let last: { idle: () => Promise<void> } | null = null;

afterEach(async () => {
  await last?.idle();
  last = null;
  vi.unstubAllGlobals();
});

/** Mounts the editor on the draft, with one block given a standing first. */
const mount = async (
  standings: { readonly fixated?: string; readonly discarded?: string } = {},
) => {
  const sent: SentCommand[] = [];
  const document: DocumentView = {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.kind !== "text"
        ? block
        : block.blockId === standings.fixated
          ? { ...block, standing: "fixate" }
          : block.blockId === standings.discarded
            ? { ...block, standing: "discarded" }
            : block,
    ),
  };
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const harness = await mountEditor(document);
  last = harness;
  return { ...harness, sent };
};

// This DOM answers undefined, not null, when nothing matches (BO_0224).
// In command mode a text block's marking control is the element around its
// words (`BO_0231_001`).
const words = (root: HTMLElement, blockId: string) =>
  (root.querySelector(
    `[data-block-id="${blockId}"] [data-block-marking]`,
  ) as HTMLElement | null) ?? null;
const row = (root: HTMLElement, blockId: string) =>
  (root.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null) ??
  null;

describe("the block editor in the render harness", () => {
  it("reads its document and draws every block", async () => {
    const { root } = await mount();
    expect(root.querySelector("[data-document-title]")?.textContent).toBe(
      "Draft",
    );
    expect(
      Array.from(root.querySelectorAll("[data-block-id]")).map((node) =>
        node.getAttribute("data-block-id"),
      ),
    ).toEqual(["blk-a", "blk-b", "blk-c"]);
  });

  it("enters command mode from a block's command control and marks blocks in mark order", async () => {
    const view = await mount();
    const { root, userEvent, record } = view;
    await activateBlock(view, "blk-b");
    expect(
      root
        .querySelector('[data-block-command="blk-b"] [data-block-point]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    await pointFrom(view, "blk-b");
    expect(
      root.querySelector('[data-pointing-from] [data-block-point]')?.getAttribute("aria-pressed"),
    ).toBe("true");

    await userEvent('[data-block-id="blk-c"]', "click");
    await userEvent('[data-block-id="blk-a"]', "click");
    expect(row(root, "blk-c")?.getAttribute("data-reference")).toBe("1");
    expect(row(root, "blk-a")?.getAttribute("data-reference")).toBe("2");
    expect(row(root, "blk-b")?.hasAttribute("data-reference")).toBe(false);
    // In command mode a text block's words are its marking control
    // (`BO_0231_001`), so they carry its name.
    expect(words(root, "blk-a")?.getAttribute("aria-label")).toBe(
      "Block 1, reference 2",
    );
    expect(
      record.pointing?.references.map(({ kind, blockId, number }) => ({
        kind,
        blockId,
        number,
      })),
    ).toEqual([
      { kind: "block", blockId: "blk-c", number: 1 },
      { kind: "block", blockId: "blk-a", number: 2 },
    ]);

    // Leaving keeps the marks, draws none of them, and edits the prompt
    // again.
    await stopPointing(view);
    expect(row(root, "blk-c")?.hasAttribute("data-reference")).toBe(false);
    expect(record.pointing?.references).toHaveLength(2);
    expect(root.querySelector('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(true);
  });
});

const chord = (key: "ArrowLeft" | "ArrowRight") => ({
  key,
  altKey: true,
  shiftKey: true,
  ctrlKey: false,
  metaKey: false,
});
const standingWrites = (sent: SentCommand[]) =>
  sent
    .filter((command) => command.body["command"] === "setDisposition")
    .map((command) => command.body);

describe("a press on a block's words in command mode", () => {
  it("Given the mode entered after reading, When the words themselves are pressed, Then the block is marked and no editor opens", async () => {
    // The press is on the words, as a reader's is, not on the row around
    // them: the words carry the reading text's activation while reading.
    const view = await mount();
    const { root, userEvent, settle } = view;
    await pointFrom(view, "blk-a");
    await userEvent('[data-block-id="blk-b"] [data-block-reading]', "click");
    await settle();
    expect(row(root, "blk-b")?.getAttribute("data-reference")).toBe("1");
    // No editor opens on the block pressed; the prompt pointed from keeps its
    // own. BO_0267_023
    expect(root.querySelector('[data-block-id="blk-b"] [data-block-editor]') != null).toBe(false);
    expect(root.querySelector('[data-block-id="blk-a"] [data-block-editor]') != null).toBe(true);
    // The words are the marking control now, pressed because the block is
    // marked — not the reading text's way into editing.
    expect(words(root, "blk-b")?.getAttribute("role")).toBe("button");
    expect(words(root, "blk-b")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("a block's standing in the render harness", () => {
  it("Given the chord on a focused reading row, Then its standing steps, the row says so, and the bar can take it back", async () => {
    const { root, userEvent, sent, settle } = await mount();
    await userEvent(
      '[data-block-id="blk-b"] [data-block-reading]',
      "keydown",
      chord("ArrowRight"),
    );
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "fixate",
    );

    expect(standingWrites(sent)).toEqual([
      {
        command: "setDisposition",
        blockId: "blk-b",
        baseRevisionId: "rev-b",
        standing: "fixate",
      },
    ]);
    expect(
      row(root, "blk-b")
        ?.querySelector("[data-block-reading]")
        ?.getAttribute("aria-label"),
    ).toBe("Edit block 2, fixated");
    expect(
      row(root, "blk-b")?.querySelector('[data-card-label="fixate"]'),
    ).toBeTruthy();
    expect(root.querySelector("[data-standing-said]")?.textContent).toBe(
      "Fixated “The storm arrives before the lights go out.”",
    );
    // The take-back stands in the bar's trailing group, named by what it
    // returns to, and writes the previous value. CA_0058_011
    expect(
      root.querySelector('[data-bar-action="take-back-standing"]')?.getAttribute("aria-label"),
    ).toBe("Take back: Fixated “The storm arrives before the lights go out.”");

    await userEvent('[data-bar-action="take-back-standing"]', "click");
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "keep",
    );
    expect(standingWrites(sent).at(-1)).toMatchObject({
      blockId: "blk-b",
      standing: "keep",
    });
  });

  it("Given a marked block discarded, Then it leaves the flow and keeps its mark, the panel shows it in place marked, and the undo leaves the mark standing", async () => {
    const view = await mount();
    const { root, userEvent, record, settle } = view;
    await pointFrom(view, "blk-a");
    await userEvent('[data-block-id="blk-b"]', "click");
    expect(
      record.pointing?.references.map((reference) => reference.blockId),
    ).toEqual(["blk-b"]);

    // One action each way: a single step left discards it. BO_0272_006
    await userEvent('[data-block-id="blk-b"]', "keydown", chord("ArrowLeft"));
    await settle(() => row(root, "blk-b") === null);
    // A reference is what was marked: discarding keeps it, and says so.
    // BO_0263_004
    await settle(() => record.pointing?.references[0]?.since === "discarded");
    expect(record.pointing?.references.map((reference) => [reference.number, reference.what, reference.since])).toEqual([
      [1, "discarded", "discarded"],
    ]);

    await userEvent('[data-bar-action="discarded-blocks"]', "click");
    await settle(
      () => root.querySelector('[data-discarded-id="blk-b"]') != null,
    );
    expect(
      root.querySelector('[data-discarded-reopen="blk-b"]')?.textContent,
    ).toBe("Reopen");
    expect(root.querySelector('[data-discarded-id="blk-b"]')?.getAttribute("data-reference")).toBe("1");
    await userEvent('[data-bar-action="discarded-blocks"]', "click");
    await settle(
      () => root.querySelector('[data-discarded-id="blk-b"]') == null,
    );

    await userEvent('[data-bar-action="take-back-standing"]', "click");
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "keep",
    );
    await settle(() => record.pointing?.references[0]?.since === undefined);
    expect(row(root, "blk-b")?.getAttribute("data-reference")).toBe("1");
  });

  it("Given a discarded block shown in place, When it is reopened, Then it is kept and back in the flow", async () => {
    const { root, userEvent, sent, settle } = await mount({
      discarded: "blk-c",
    });
    expect(row(root, "blk-c")).toBeNull();
    await userEvent('[data-bar-action="discarded-blocks"]', "click");
    await settle(
      () => root.querySelector('[data-discarded-reopen="blk-c"]') != null,
    );
    await userEvent('[data-discarded-reopen="blk-c"]', "click");
    await settle(() => row(root, "blk-c") !== null);
    expect(standingWrites(sent)).toEqual([
      {
        command: "setDisposition",
        blockId: "blk-c",
        baseRevisionId: "rev-c",
        standing: "keep",
      },
    ]);
  });

  it("Given a fixated block, Then the pointing the composer reads carries it with its words", async () => {
    const { record, settle } = await mount({ fixated: "blk-c" });
    await settle(() => record.pointing !== null);
    expect(record.pointing?.fixated).toEqual([
      { blockId: "blk-c", words: "Closing." },
    ]);
  });
});

describe("taking a passage back by its number", () => {
  it("Given a stale passage, When its number is pressed, Then the passage is taken back and the block below is not marked", async () => {
    // A prompt's marks with one passage whose words are gone, as the page
    // would have kept them.
    const stored = JSON.stringify({
      references: [
        {
          kind: "passage",
          blockId: "blk-b",
          number: 1,
          anchor: {
            quote: "words no longer here",
            prefix: "",
            suffix: "",
            hint: 0,
          },
        },
      ],
      next: 2,
    });
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => stored,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
    const view = await mount();
    const { root, userEvent, record, settle } = view;
    await pointFrom(view, "blk-a");
    await settle(() => root.querySelector('[data-passage-stale="1"]') != null);
    const badge = root.querySelector('[data-passage-stale="1"]') as HTMLElement;
    // This harness dispatches without a DOM target, so the press names it.
    await userEvent(badge, "click", { target: badge });
    await settle(
      () => (root.querySelector('[data-passage-stale="1"]') ?? null) === null,
    );
    expect(row(root, "blk-b")?.hasAttribute("data-reference")).toBe(false);
    expect(record.pointing?.references).toEqual([]);
  });
});

describe("standing while reading", () => {
  const toolbar = (root: HTMLElement, blockId: string) =>
    (root.querySelector(
      `[data-block-id="${blockId}"] [data-standing-toolbar]`,
    ) as HTMLElement | null) ?? null;
  const option = (root: HTMLElement, blockId: string, standing: string) =>
    (root.querySelector(
      `[data-block-id="${blockId}"] [data-standing-option="${standing}"]`,
    ) as HTMLElement | null) ?? null;
  /** Turns to a reading row, as a rest of the pointer or a tap does. */
  const turnTo = async (
    view: Awaited<ReturnType<typeof mount>>,
    blockId: string,
  ) => {
    await view.userEvent(
      `[data-block-id="${blockId}"] [data-block-reading]`,
      "focus",
    );
    await view.settle();
  };

  it("Given the row turned to, Then it alone carries the three buttons, beside its words and none of it inside a button", async () => {
    const view = await mount();
    const { root } = view;
    expect(root.querySelector("[data-standing-toolbar]") ?? null).toBeNull();
    await turnTo(view, "blk-b");
    expect(toolbar(root, "blk-a")).toBeNull();
    expect(toolbar(root, "blk-c")).toBeNull();
    const buttons = Array.from(
      toolbar(root, "blk-b")?.querySelectorAll("button") ?? [],
    );
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Discard",
      "Keep",
      "Fixate",
    ]);
    for (const button of buttons) {
      // A boolean, so a failure prints a line rather than this DOM's element.
      expect(button.parentElement?.closest('[role="button"]') != null).toBe(
        false,
      );
    }
  });

  it("Given the focus turned to another row, Then the toolbar goes with it: one row carries it at a time", async () => {
    const view = await mount();
    const { root } = view;
    await turnTo(view, "blk-b");
    await turnTo(view, "blk-c");
    expect(toolbar(root, "blk-b")).toBeNull();
    expect(toolbar(root, "blk-c")).not.toBeNull();
    expect(root.querySelectorAll("[data-standing-toolbar]")).toHaveLength(1);
  });

  it("Given a block being edited, Then it carries the toolbar, as the subject it is", async () => {
    const view = await mount();
    const { root } = view;
    await activateBlock(view, "blk-b");
    expect(toolbar(root, "blk-b")).not.toBeNull();
    expect(toolbar(root, "blk-a")).toBeNull();
  });

  it("Given command mode, Then no row carries the toolbar, the prompt being edited to point from included; and it comes back on that prompt when the mode ends", async () => {
    const view = await mount();
    const { root } = view;
    await turnTo(view, "blk-b");
    await pointFrom(view, "blk-c");
    // The mode clears the focus and draws none on the prompt it is pointing
    // from, which is being edited. DO_0014_001
    expect(root.querySelector("[data-standing-toolbar]") ?? null).toBeNull();
    await stopPointing(view);
    // Pointing ends with the prompt still edited, so reading finds a subject
    // again and it is that block. BO_0267_013 DO_0014_002
    expect(toolbar(root, "blk-c")).not.toBeNull();
    expect(root.querySelectorAll("[data-standing-toolbar]")).toHaveLength(1);
  });

  it("Given Fixate pressed, Then the block is fixated and Fixate reads pressed; pressed again, the block returns to keep", async () => {
    const view = await mount();
    const { root, userEvent, sent, settle } = view;
    await turnTo(view, "blk-b");
    const fixate = option(root, "blk-b", "fixate")!;
    await userEvent(fixate, "click", { target: fixate });
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "fixate",
    );
    expect(option(root, "blk-b", "fixate")?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(option(root, "blk-b", "keep")?.getAttribute("aria-pressed")).toBe(
      "false",
    );

    const pressed = option(root, "blk-b", "fixate")!;
    await userEvent(pressed, "click", { target: pressed });
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "keep",
    );
    expect(standingWrites(sent).map((write) => write["standing"])).toEqual([
      "fixate",
      "keep",
    ]);
  });

  it("Given a divider turned to, Then it carries no toolbar", async () => {
    const sent: SentCommand[] = [];
    const document: DocumentView = {
      ...draft,
      blocks: [
        draft.blocks[0]!,
        {
          kind: "divider",
          blockId: "blk-d",
          revisionId: "rev-d",
          containmentId: "c-d",
          order: "b",
        },
      ],
    };
    vi.stubGlobal("fetch", documentsApi(document, sent));
    const view = await mountEditor(document);
    const { root } = view;
    await view.userEvent('[data-block-id="blk-d"]', "focus");
    await view.settle();
    expect(toolbar(root, "blk-d")).toBeNull();
  });
});

describe("revealing what a chip in the composer points at", () => {
  /** The row's scroll, recorded, since this DOM scrolls nothing. */
  const watchScroll = (element: HTMLElement | null) => {
    const calls: unknown[] = [];
    if (element !== null)
      Object.assign(element, { scrollIntoView: (options: unknown) => calls.push(options) });
    return calls;
  };

  it("Given a block revealed while reading, Then it is scrolled into view and emphasized, and the emphasis leaves no trace", async () => {
    const { root, userEvent, record, settle } = await mount();
    const calls = watchScroll(row(root, "blk-c"));
    record.reveal = { kind: "block", blockId: "blk-c" };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-c")?.getAttribute("data-revealed") === "block");
    expect(calls).toHaveLength(1);
    expect(row(root, "blk-a")?.hasAttribute("data-revealed")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, REVEAL_MS + 50));
    await settle();
    expect(row(root, "blk-c")?.hasAttribute("data-revealed")).toBe(false);
  });

  it("Given the same chip pressed again, Then the block is revealed again", async () => {
    const { root, userEvent, record, settle } = await mount();
    const calls = watchScroll(row(root, "blk-a"));
    record.reveal = { kind: "block", blockId: "blk-a" };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => calls.length === 1);
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => calls.length === 2);
    expect(row(root, "blk-a")?.getAttribute("data-revealed")).toBe("block");
  });

  it("Given a passage revealed while reading, Then its block is scrolled to and the passage emphasized", async () => {
    const text = "The storm arrives before the lights go out.";
    const stored = JSON.stringify({
      references: [{ kind: "passage", blockId: "blk-b", number: 1, anchor: anchorAt(text, 25, 35) }],
      next: 2,
    });
    vi.stubGlobal("window", {
      localStorage: { getItem: () => stored, setItem: () => undefined, removeItem: () => undefined },
    });
    const view = await mount();
    const { root, userEvent, record, settle } = view;
    // The marks are the prompt's: editing it brings them back.
    await activateBlock(view, "blk-a");
    const calls = watchScroll(row(root, "blk-b"));
    record.reveal = { kind: "passage", blockId: "blk-b", number: 1 };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "passage");
    expect(calls).toHaveLength(1);
  });

  it("Given a block revealed in command mode, Then it is emphasized and the mode stays command", async () => {
    const view = await mount();
    const { root, userEvent, record, settle } = view;
    await pointFrom(view, "blk-a");
    record.reveal = { kind: "block", blockId: "blk-b" };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "block");
    expect(
      root.querySelector('[data-pointing-from] [data-block-point]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(row(root, "blk-b")?.hasAttribute("data-reference")).toBe(false);
  });

  it("Given a stale passage revealed, Then the block that lost its words is revealed", async () => {
    const stored = JSON.stringify({
      references: [
        { kind: "passage", blockId: "blk-b", number: 1, anchor: { quote: "words no longer here", prefix: "", suffix: "", hint: 0 } },
      ],
      next: 2,
    });
    vi.stubGlobal("window", {
      localStorage: { getItem: () => stored, setItem: () => undefined, removeItem: () => undefined },
    });
    const view = await mount();
    const { root, userEvent, record, settle } = view;
    await activateBlock(view, "blk-a");
    record.reveal = { kind: "passage", blockId: "blk-b", number: 1 };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "block");
  });
});
