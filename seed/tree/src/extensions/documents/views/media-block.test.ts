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

  it("shows linked text as an editable image caption beside the upload field", async () => {
    const view = await mount([media("blk-b", "b", { kind: "image", captionRuns: [{ text: "linked caption", link: "https://example.test/caption" }] })]);
    const caption = view.root.querySelector('[data-caption-runs="blk-b"]') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.getAttribute("contenteditable")).toBe("true");
    expect(caption.querySelector("a")?.getAttribute("href")).toBe("https://example.test/caption");
    expect(view.root.querySelector('[data-image-upload="blk-b"] input[type="file"]')).toBeTruthy();
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

  it("shows an empty upload field for a pending image and leaves it empty when no file is chosen", async () => {
    const view = await mount([
      media("blk-b", "b", { kind: "image", alt: "A laurel on a dark ground" }),
    ]);
    const field = view.root.querySelector('[data-image-upload="blk-b"]') as HTMLLabelElement;
    const input = field.querySelector('input[type="file"]') as HTMLInputElement;
    expect(field).toBeTruthy();
    expect(input.getAttribute("accept")).toBe("image/*");
    expect(input.getAttribute("aria-label")).toBe("Choose an image file to upload");
    expect(view.root.querySelector("[data-media-image]")).toBeFalsy();
    await view.userEvent(input, "change");
    await view.settle();
    expect(input.value).toBe("");
    expect(view.root.querySelector("[data-media-image]")).toBeFalsy();
  });

  it("uploads a chosen image, then fills the same block with its reference and pixel dimensions", async () => {
    const document: DocumentView = {
      documentId: "doc-upload",
      revisionId: "rev-doc",
      title: "Draft",
      blocks: [media("blk-image", "a", { kind: "image" })],
    };
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const api = documentsApi(document, sent);
    const uploads: { input: string | URL | Request; init?: RequestInit }[] = [];
    const reference = { _kind: "blob", hash: `sha256:${"a".repeat(64)}`, mediaType: "image/png", size: 3, filename: "laurel.png" };
    vi.stubGlobal("createImageBitmap", async () => ({ width: 320, height: 180, close: vi.fn() }));
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/x/documents/blobs") {
        uploads.push({ input, ...(init === undefined ? {} : { init }) });
        return new Response(JSON.stringify({ outcome: "success", result: { reference } }), {
          headers: { "content-type": "application/json" },
        });
      }
      return api(input, init);
    });
    const view = await mountEditor(document);
    const input = view.root.querySelector('[data-image-upload="blk-image"] input') as HTMLInputElement;
    const file = new File(["png"], "laurel.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await view.userEvent(input, "change");
    await view.settle(() => sent.some((command) => command.body["command"] === "fillMediaBlock"));

    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.init?.body).toBe(file);
    expect(uploads[0]?.init?.headers).toMatchObject({ "content-type": "image/png", "x-calliopa-filename": "laurel.png" });
    expect(sent.find((command) => command.body["command"] === "fillMediaBlock")?.body).toMatchObject({
      command: "fillMediaBlock",
      blockId: "blk-image",
      baseRevisionId: "rev-blk-image",
      reference,
      width: 320,
      height: 180,
    });
    await view.idle();
  });

  it("keeps the upload field available and reports an upload failure", async () => {
    const document: DocumentView = {
      documentId: "doc-upload-failure",
      revisionId: "rev-doc",
      title: "Draft",
      blocks: [media("blk-image", "a", { kind: "image" })],
    };
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const api = documentsApi(document, sent);
    vi.stubGlobal("createImageBitmap", async () => ({ width: 320, height: 180, close: vi.fn() }));
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/x/documents/blobs") throw new Error("network unavailable");
      return api(input, init);
    });
    const view = await mountEditor(document);
    const input = view.root.querySelector('[data-image-upload="blk-image"] input') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["png"], "laurel.png", { type: "image/png" })],
    });
    await view.userEvent(input, "change");
    await view.settle(() => view.root.textContent?.includes("network unavailable") === true);

    expect(view.root.querySelector('[data-image-upload="blk-image"] input')).toBeTruthy();
    expect(sent.some((command) => command.body["command"] === "fillMediaBlock")).toBe(false);
    expect(view.root.querySelector("[data-media-image]")).toBeFalsy();
    await view.idle();
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
