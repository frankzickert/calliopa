import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import type { TextRole } from "../server/vocabulary";
import { documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * A pinch on a block (BO_0322_010, BO_0322_011), through the editor's own
 * adapter: zooming in on a reading row sends the deepen pinch for that block
 * in explore + create, zooming out the gather pinch in consolidate +
 * understand, and both name the block and nothing else; a pinch off a row or
 * on a proposal sends nothing. While the fingers move the row carries the
 * progress, armed once past the threshold either way, and while they close
 * the rows around it up to the nearest heading draw toward it; all of it is
 * cleared on release.
 */
const text = (blockId: string, order: string, words: string, role: TextRole = "paragraph"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role,
  standing: "keep",
  runs: [{ text: words }],
});

const doc: DocumentView = {
  documentId: "doc-pinch",
  revisionId: "rev-doc",
  title: "Pinch",
  blocks: [
    text("blk-0", "a", "Before the section."),
    text("blk-h", "b", "Weather", "h2"),
    text("blk-b", "c", "The storm arrives."),
    text("blk-c", "d", "The lights go out."),
    text("blk-d", "e", "Candles are found."),
  ],
} as DocumentView;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a pinch on a block", () => {
  const mount = async () => {
    vi.stubGlobal("fetch", documentsApi(doc, []));
    const mounted = await mountEditor(doc);
    const page = mounted.root.ownerDocument;
    let under: Element | null = null;
    Object.defineProperty(page, "elementFromPoint", { configurable: true, value: () => under });
    const touch = (type: string, gap: number) => {
      const event = page.createEvent("Event");
      event.initEvent(type, true, true);
      const touches = type === "touchend" ? [] : [{ clientX: 100, clientY: 100 }, { clientX: 100 + gap, clientY: 100 }];
      Object.defineProperty(event, "touches", { value: touches });
      page.dispatchEvent(event);
    };
    const row = (blockId: string) => mounted.root.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    // The test DOM parses no custom property, so each row records the
    // style it is given instead; what the stylesheet does with it is the
    // browser's.
    for (const element of mounted.root.querySelectorAll("[data-block-id]")) {
      const recorded: Record<string, string> = {};
      Object.defineProperty(element, "style", {
        configurable: true,
        value: {
          recorded,
          setProperty: (name: string, value: string) => {
            recorded[name] = value;
          },
          removeProperty: (name: string) => {
            delete recorded[name];
          },
        },
      });
    }
    const aimAt = (element: Element | null) => {
      under = element;
    };
    return { ...mounted, touch, row, aimAt };
  };

  it("zooming in on a reading row deepens it, armed past the threshold and cleared on release", async () => {
    const { touch, row, aimAt, record } = await mount();
    aimAt(row("blk-c").querySelector("[data-block-reading]"));
    touch("touchstart", 100);
    touch("touchmove", 110);
    expect(row("blk-c").getAttribute("data-pinch")).toBe("zooming-in");
    touch("touchmove", 140);
    expect(row("blk-c").getAttribute("data-pinch")).toBe("in");
    expect((row("blk-c").style as unknown as { recorded: Record<string, string> }).recorded["--pinch"]).toBe("1");
    expect(row("blk-b").hasAttribute("data-pinch-neighbour")).toBe(false);
    touch("touchend", 0);
    expect(row("blk-c").hasAttribute("data-pinch")).toBe(false);
    expect(record.pinches).toEqual([{ itemId: "doc-pinch", blockId: "blk-c", pinch: "in", mode: { field: "explore", work: "create" } }]);
  });

  it("zooming out gathers, drawing its section's rows toward it up to the heading", async () => {
    const { touch, row, aimAt, record } = await mount();
    aimAt(row("blk-c").querySelector("[data-block-reading]"));
    touch("touchstart", 100);
    touch("touchmove", 70);
    expect(row("blk-c").getAttribute("data-pinch")).toBe("out");
    expect(row("blk-b").getAttribute("data-pinch-neighbour")).toBe("above");
    expect(row("blk-d").getAttribute("data-pinch-neighbour")).toBe("below");
    expect(row("blk-h").hasAttribute("data-pinch-neighbour")).toBe(false);
    expect(row("blk-0").hasAttribute("data-pinch-neighbour")).toBe(false);
    touch("touchend", 0);
    for (const id of ["blk-b", "blk-c", "blk-d"]) {
      expect(row(id).hasAttribute("data-pinch")).toBe(false);
      expect(row(id).hasAttribute("data-pinch-neighbour")).toBe(false);
    }
    expect(record.pinches).toEqual([{ itemId: "doc-pinch", blockId: "blk-c", pinch: "out", mode: { field: "consolidate", work: "understand" } }]);
  });

  it("a pinch off a row, on a proposal, or short of the threshold sends nothing", async () => {
    const { touch, row, aimAt, record, root } = await mount();
    aimAt(root);
    touch("touchstart", 100);
    touch("touchmove", 160);
    touch("touchend", 0);
    const proposal = root.ownerDocument.createElement("div");
    proposal.setAttribute("data-proposal-id", "g|replace|node:blk-c");
    row("blk-c").appendChild(proposal);
    aimAt(proposal);
    touch("touchstart", 100);
    touch("touchmove", 40);
    touch("touchend", 0);
    aimAt(row("blk-c").querySelector("[data-block-reading]"));
    touch("touchstart", 100);
    touch("touchmove", 110);
    touch("touchend", 0);
    expect(record.pinches ?? []).toEqual([]);
  });
});
