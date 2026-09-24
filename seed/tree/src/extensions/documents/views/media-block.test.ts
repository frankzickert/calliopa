import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, MediaBlockView } from "../server/assemble";
import { documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * A picture and a moving picture in a document (`BO_0273_011`). The bytes are
 * a blob behind CCGW; an image streams from the blob route, a video is handed
 * an object URL retyped from the reference's own media type, and a block with
 * no reference is a generation not made yet, drawn as its reserved box.
 */
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

const media = (
  blockId: string,
  order: string,
  rest: Omit<MediaBlockView, "blockId" | "revisionId" | "containmentId" | "order">,
): BlockView => ({
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  ...rest,
});

async function mount(blocks: readonly BlockView[]) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Draft",
    blocks: [...blocks],
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a picture in a document", () => {
  it("streams an image from the blob route, with its words as the alt", async () => {
    const view = await mount([
      text("blk-a", "a", "Opening."),
      media("blk-b", "b", { kind: "image", objectId: "abc123", mediaType: "image/png", alt: "A laurel" }),
    ]);
    const drawn = view.root.querySelector("[data-media-image]") as HTMLElement;
    expect(drawn).toBeTruthy();
    // The shell's own route. CCGW's `/v1/blobs` is not reachable from the app
    // origin, and a picture pointed there drew nothing at all. BO_0273_046
    expect(drawn.getAttribute("src")).toBe("/api/blobs/abc123");
    expect(drawn.getAttribute("alt")).toBe("A laurel");
  });

  it("reserves the box the block stores, because the reference carries none", async () => {
    const view = await mount([
      media("blk-b", "b", { kind: "image", objectId: "abc123", width: 1280, height: 720 }),
    ]);
    const drawn = view.root.querySelector("[data-media-image]") as HTMLElement;
    expect(drawn.getAttribute("width")).toBe("1280");
    expect(drawn.getAttribute("height")).toBe("720");
    // The style carries the shape, so the box holds before the bytes land.
    expect(drawn.getAttribute("style") ?? "").toContain("--media-width");
  });

  it("draws a moving picture as a video element, never as an image", async () => {
    const view = await mount([
      media("blk-b", "b", { kind: "video", objectId: "def456", mediaType: "video/mp4" }),
    ]);
    expect(view.root.querySelector("[data-media-video]")).toBeTruthy();
    expect(view.root.querySelector("[data-media-image]")).toBeFalsy();
    // Never the blob route directly: retrieval serves an octet stream, which a
    // media element will not take. The source arrives retyped, from the task.
    const drawn = view.root.querySelector("[data-media-video]") as HTMLElement;
    expect(drawn.getAttribute("src") ?? "").not.toContain("/api/blobs/");
  });

  it("draws a block with no reference as a generation not made yet", async () => {
    const view = await mount([
      media("blk-b", "b", { kind: "image", alt: "A laurel on a dark ground", width: 800, height: 600 }),
    ]);
    const pending = view.root.querySelector("[data-media-pending]") as HTMLElement;
    expect(pending).toBeTruthy();
    expect(pending.getAttribute("data-media-pending")).toBe("image");
    expect(pending.getAttribute("aria-label") ?? "").toContain("not made yet");
    expect(pending.textContent ?? "").toContain("A laurel on a dark ground");
    // And nothing was asked of the blob route for it.
    expect(view.root.querySelector("[data-media-image]")).toBeFalsy();
  });

  it("keeps a picture beside the prose, in its order", async () => {
    const view = await mount([
      text("blk-a", "a", "Opening."),
      media("blk-b", "b", { kind: "image", objectId: "abc123" }),
      text("blk-c", "c", "Closing."),
    ]);
    const rows = [...view.root.querySelectorAll("[data-block-id]")].map((row) =>
      row.getAttribute("data-block-id"),
    );
    expect(rows).toEqual(["blk-a", "blk-b", "blk-c"]);
  });
});
