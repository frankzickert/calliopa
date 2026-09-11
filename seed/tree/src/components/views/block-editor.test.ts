import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "~/server/documents/assemble";
import { anchorAt } from "~/lib/passage";
import { REVEAL_MS } from "./reveal";
import {
  documentsApi,
  mountEditor,
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
      standing: "neutral",
      runs: [{ text: "Opening." }],
    },
    {
      kind: "text",
      blockId: "blk-b",
      revisionId: "rev-b",
      containmentId: "c-b",
      order: "b",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: "The storm arrives before the lights go out." }],
    },
    {
      kind: "text",
      blockId: "blk-c",
      revisionId: "rev-c",
      containmentId: "c-c",
      order: "c",
      role: "paragraph",
      standing: "neutral",
      runs: [{ text: "Closing." }],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Mounts the editor on the draft, with one block given a standing first. */
const mount = async (
  standings: { readonly pinned?: string; readonly discarded?: string } = {},
) => {
  const sent: SentCommand[] = [];
  const document: DocumentView = {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.kind !== "text"
        ? block
        : block.blockId === standings.pinned
          ? { ...block, standing: "pin" }
          : block.blockId === standings.discarded
            ? { ...block, standing: "discarded" }
            : block,
    ),
  };
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const harness = await mountEditor(document);
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

  it("enters command mode from the dock and marks blocks in mark order", async () => {
    const { root, userEvent, record } = await mount();
    expect(
      root
        .querySelector('[data-dock-action="command-mode"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    await userEvent('[data-dock-action="command-mode"]', "click");
    expect(
      root.querySelector("[data-view-body]")?.getAttribute("data-editor-mode"),
    ).toBe("command");

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

    // Leaving keeps the marks and draws none of them.
    await userEvent('[data-dock-action="command-mode"]', "click");
    expect(
      root.querySelector("[data-view-body]")?.getAttribute("data-editor-mode"),
    ).toBe("reading");
    expect(row(root, "blk-c")?.hasAttribute("data-reference")).toBe(false);
    expect(record.pointing?.references).toHaveLength(2);
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
    const { root, userEvent, settle } = await mount();
    await userEvent('[data-dock-action="command-mode"]', "click");
    await userEvent('[data-block-id="blk-b"] [data-block-reading]', "click");
    await settle();
    expect(row(root, "blk-b")?.getAttribute("data-reference")).toBe("1");
    expect(root.querySelector("[data-block-toolbar]") ?? null).toBeNull();
    // The words are the marking control now, pressed because the block is
    // marked — not the reading text's way into editing.
    expect(words(root, "blk-b")?.getAttribute("role")).toBe("button");
    expect(words(root, "blk-b")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("a block's standing in the render harness", () => {
  it("Given the chord on a focused reading row, Then its standing steps, the row says so, and the dock can take it back", async () => {
    const { root, userEvent, record, sent, settle } = await mount();
    await userEvent(
      '[data-block-id="blk-b"] [data-block-reading]',
      "keydown",
      chord("ArrowRight"),
    );
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "keep",
    );

    expect(standingWrites(sent)).toEqual([
      {
        command: "setDisposition",
        blockId: "blk-b",
        baseRevisionId: "rev-b",
        standing: "keep",
      },
    ]);
    expect(
      row(root, "blk-b")
        ?.querySelector("[data-block-reading]")
        ?.getAttribute("aria-label"),
    ).toBe("Edit block 2, kept");
    expect(
      row(root, "blk-b")?.querySelector('[data-standing-mark="keep"]'),
    ).toBeTruthy();
    expect(root.querySelector("[data-standing-said]")?.textContent).toBe(
      "Kept “The storm arrives before the lights go out.”",
    );
    expect(record.undo?.label).toBe(
      "Kept “The storm arrives before the lights go out.”",
    );

    await record.undo?.undo$();
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "neutral",
    );
    expect(standingWrites(sent).at(-1)).toMatchObject({
      blockId: "blk-b",
      standing: "neutral",
    });
  });

  it("Given a marked block discarded, Then it leaves the flow with its marks, the panel shows it in place, and the undo brings both back", async () => {
    const { root, userEvent, record, settle } = await mount();
    await userEvent('[data-dock-action="command-mode"]', "click");
    await userEvent('[data-block-id="blk-b"]', "click");
    expect(
      record.pointing?.references.map((reference) => reference.blockId),
    ).toEqual(["blk-b"]);

    // Left twice: resolved at the first step, discarded at the second.
    await userEvent('[data-block-id="blk-b"]', "keydown", chord("ArrowLeft"));
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "resolved",
    );
    await userEvent('[data-block-id="blk-b"]', "keydown", chord("ArrowLeft"));
    await settle(() => row(root, "blk-b") === null);
    expect(record.pointing?.references).toEqual([]);

    await userEvent('[data-inspector-action="discarded-blocks"]', "click");
    await settle(
      () => root.querySelector('[data-discarded-id="blk-b"]') != null,
    );
    expect(
      root.querySelector('[data-discarded-reopen="blk-b"]')?.textContent,
    ).toBe("Reopen");
    await userEvent('[data-inspector-action="discarded-blocks"]', "click");
    await settle(
      () => root.querySelector('[data-discarded-id="blk-b"]') == null,
    );

    await record.undo?.undo$();
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "resolved",
    );
    await settle(() => (record.pointing?.references.length ?? 0) === 1);
    expect(row(root, "blk-b")?.getAttribute("data-reference")).toBe("1");
  });

  it("Given a discarded block shown in place, When it is reopened, Then it is neutral and back in the flow", async () => {
    const { root, userEvent, sent, settle } = await mount({
      discarded: "blk-c",
    });
    expect(row(root, "blk-c")).toBeNull();
    await userEvent('[data-inspector-action="discarded-blocks"]', "click");
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
        standing: "neutral",
      },
    ]);
  });

  it("Given a pinned block, Then the pointing the composer reads carries it with its words", async () => {
    const { record, settle } = await mount({ pinned: "blk-c" });
    await settle(() => record.pointing !== null);
    expect(record.pointing?.pinned).toEqual([
      { blockId: "blk-c", words: "Closing." },
    ]);
  });
});

describe("taking a passage back by its number", () => {
  it("Given a stale passage, When its number is pressed, Then the passage is taken back and the block below is not marked", async () => {
    // A session left in command mode with one passage whose words are gone,
    // as the page would have kept it.
    const stored = JSON.stringify({
      mode: "command",
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
    const { root, userEvent, record, settle } = await mount();
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

describe("standing in command mode", () => {
  const toolbar = (root: HTMLElement, blockId: string) =>
    (root.querySelector(
      `[data-block-id="${blockId}"] [data-standing-toolbar]`,
    ) as HTMLElement | null) ?? null;
  const option = (root: HTMLElement, blockId: string, standing: string) =>
    (root.querySelector(
      `[data-block-id="${blockId}"] [data-standing-option="${standing}"]`,
    ) as HTMLElement | null) ?? null;

  it("Given command mode, Then every text block carries the toolbar beside its marking words, none of it inside a button, and reading carries none", async () => {
    const { root, userEvent } = await mount();
    expect(toolbar(root, "blk-a")).toBeNull();
    await userEvent('[data-dock-action="command-mode"]', "click");
    for (const blockId of ["blk-a", "blk-b", "blk-c"]) {
      const buttons = Array.from(
        toolbar(root, blockId)?.querySelectorAll("button") ?? [],
      );
      expect(
        buttons.map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Keep", "Pin", "Resolve", "Discard"]);
      for (const button of buttons) {
        // A boolean, so a failure prints a line rather than this DOM's element.
        expect(button.parentElement?.closest('[role="button"]') != null).toBe(
          false,
        );
      }
    }
    await userEvent('[data-dock-action="command-mode"]', "click");
    expect(root.querySelector("[data-standing-toolbar]") ?? null).toBeNull();
  });

  it("Given Pin pressed, Then the block is pinned and Pin reads pressed; pressed again, the block returns to neutral", async () => {
    const { root, userEvent, sent, settle } = await mount();
    await userEvent('[data-dock-action="command-mode"]', "click");
    const pin = option(root, "blk-b", "pin")!;
    await userEvent(pin, "click", { target: pin });
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "pin",
    );
    expect(option(root, "blk-b", "pin")?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(option(root, "blk-b", "keep")?.getAttribute("aria-pressed")).toBe(
      "false",
    );

    const pressed = option(root, "blk-b", "pin")!;
    await userEvent(pressed, "click", { target: pressed });
    await settle(
      () => row(root, "blk-b")?.getAttribute("data-standing") === "neutral",
    );
    expect(standingWrites(sent).map((write) => write["standing"])).toEqual([
      "pin",
      "neutral",
    ]);
  });

  it("Given a press or Enter on a toolbar button, Then the block is not marked by it", async () => {
    const { root, userEvent, settle } = await mount();
    await userEvent('[data-dock-action="command-mode"]', "click");
    const keep = option(root, "blk-a", "keep")!;
    await userEvent(keep, "click", { target: keep });
    await settle(
      () => row(root, "blk-a")?.getAttribute("data-standing") === "keep",
    );
    const again = option(root, "blk-a", "keep")!;
    await userEvent(again, "keydown", { key: "Enter", target: again });
    expect(row(root, "blk-a")?.hasAttribute("data-reference")).toBe(false);
  });

  it("Given a divider, Then it carries no toolbar and stays its own marking control", async () => {
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
    const { root, userEvent } = await mountEditor(document);
    await userEvent('[data-dock-action="command-mode"]', "click");
    expect(toolbar(root, "blk-d")).toBeNull();
    expect(row(root, "blk-d")?.getAttribute("role")).toBe("button");
    expect(row(root, "blk-a")?.hasAttribute("role")).toBe(false);
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
      mode: "reading",
      references: [{ kind: "passage", blockId: "blk-b", number: 1, anchor: anchorAt(text, 25, 35) }],
      next: 2,
    });
    vi.stubGlobal("window", {
      localStorage: { getItem: () => stored, setItem: () => undefined, removeItem: () => undefined },
    });
    const { root, userEvent, record, settle } = await mount();
    const calls = watchScroll(row(root, "blk-b"));
    record.reveal = { kind: "passage", blockId: "blk-b", number: 1 };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "passage");
    expect(calls).toHaveLength(1);
  });

  it("Given a block revealed in command mode, Then it is emphasized and the mode stays command", async () => {
    const { root, userEvent, record, settle } = await mount();
    await userEvent('[data-dock-action="command-mode"]', "click");
    record.reveal = { kind: "block", blockId: "blk-b" };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "block");
    expect(
      root.querySelector('[data-dock-action="command-mode"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(row(root, "blk-b")?.hasAttribute("data-reference")).toBe(false);
  });

  it("Given a stale passage revealed, Then the block that lost its words is revealed", async () => {
    const stored = JSON.stringify({
      mode: "reading",
      references: [
        { kind: "passage", blockId: "blk-b", number: 1, anchor: { quote: "words no longer here", prefix: "", suffix: "", hint: 0 } },
      ],
      next: 2,
    });
    vi.stubGlobal("window", {
      localStorage: { getItem: () => stored, setItem: () => undefined, removeItem: () => undefined },
    });
    const { root, userEvent, record, settle } = await mount();
    record.reveal = { kind: "passage", blockId: "blk-b", number: 1 };
    await userEvent("[data-harness-reveal]", "click");
    await settle(() => row(root, "blk-b")?.getAttribute("data-revealed") === "block");
  });
});
