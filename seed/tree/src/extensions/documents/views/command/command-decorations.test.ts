import { component$, jsx } from "@builder.io/qwik";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockDecorationProps } from "~/contract";
import type { BlockView, DocumentView } from "../../server/assemble";
import { activateBlock, documentsApi, mountEditor } from "../testing/editor-harness";

/**
 * An extension puts a control in a block's command chip (`BO_0273_007`,
 * `BO_0273_009`). The chip draws the `command` place of every decorating
 * extension and knows nothing of what it draws; a tree holding no such
 * extension draws an undecorated chip.
 *
 * The generated registry is the build's own seam — in production it is written
 * from the manifests in the tree — so it is what this test supplies. Nothing
 * else is stood in for: the real editor, the real chip and the real
 * `BlockDecorations` run.
 */
const Offered = component$<BlockDecorationProps>(({ blockId, active }) =>
  jsx("button", {
    type: "button",
    "data-fixture-command": blockId,
    "data-fixture-active": String(active),
    children: "Make a picture",
  }),
);

const Second = component$<BlockDecorationProps>(() =>
  jsx("button", { type: "button", "data-fixture-second": "", children: "Second" }),
);

const places: { value: Record<string, unknown> } = { value: {} };
const sets: { value: readonly unknown[] } = { value: [] };

vi.mock("~/registry.gen", () => ({
  PRESENT_EXTENSIONS: [],
  REGISTRY: {
    get decorations() {
      return { "documents:document": sets.value };
    },
  },
}));

const text = (blockId: string, order: string, words: string): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs: [{ text: words }],
});

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Draft",
  blocks: [text("blk-a", "a", "Opening."), text("blk-b", "b", "Closing.")],
};

async function mountWith(decorating: readonly { extension: string; places: Record<string, unknown> }[]) {
  sets.value = decorating.map((one) => ({ extension: one.extension, decorations: { places: one.places } }));
  vi.stubGlobal("fetch", documentsApi(draft, []));
  const view = await mountEditor(draft);
  await activateBlock(view, "blk-a");
  return view;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sets.value = [];
  places.value = {};
});

describe("a contributed control in the command chip", () => {
  it("draws the command place of a decorating extension, on the block being edited", async () => {
    const view = await mountWith([{ extension: "media", places: { command: Offered } }]);
    const drawn = view.root.querySelector("[data-fixture-command]") as HTMLElement | null;
    expect(drawn).not.toBeNull();
    expect(drawn?.getAttribute("data-fixture-command")).toBe("blk-a");
    // `active` is what tells a control it is on the block being edited.
    expect(drawn?.getAttribute("data-fixture-active")).toBe("true");
  });

  it("stands in the chip's line, after pointing and before Send", async () => {
    const view = await mountWith([{ extension: "media", places: { command: Offered } }]);
    const line = view.root.querySelector("[data-block-command-controls]") as HTMLElement;
    const html = line.innerHTML;
    // The order the chip is specified in: the agent and pointing, then what an
    // extension offers, then the chips of what the command carries and Send.
    expect(html.indexOf("data-block-point")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("data-fixture-command")).toBeGreaterThan(html.indexOf("data-block-point"));
    expect(html.indexOf("data-fixture-command")).toBeLessThan(html.indexOf("data-block-send"));
  });

  it("draws every decorating extension, in contribution order", async () => {
    const view = await mountWith([
      { extension: "media", places: { command: Offered } },
      { extension: "other", places: { command: Second } },
    ]);
    const line = view.root.querySelector("[data-block-command-controls]") as HTMLElement;
    const html = line.innerHTML;
    expect(html.indexOf("data-fixture-command")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("data-fixture-second")).toBeGreaterThan(html.indexOf("data-fixture-command"));
  });

  it("draws nothing when no extension offers one", async () => {
    const view = await mountWith([{ extension: "media", places: { below: Offered } }]);
    const line = view.root.querySelector("[data-block-command-controls]") as HTMLElement;
    expect(line.innerHTML).not.toContain("data-fixture-command");
    // And the chip is otherwise itself.
    expect(line.innerHTML).toContain("data-block-send");
  });
});
