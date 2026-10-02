import { component$, jsx, useContextProvider, useStore, type JSXOutput } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorSurfaceContext, type EditorSurface } from "~/extensions/documents/views/editor-surface";

import type { RenditionView } from "../lib/rendition";
import { RenditionsContext, RenditionsProvider, type RenditionsState } from "./provider";
import { contributions } from "../contributions";
import { DocumentRenditions } from "./renditions";

/**
 * Where a document carrying *Format* shows what it was produced as
 * (`calliopa-bootstrap`'s `BO_0312_022`, `BO_0332_031`), in Qwik's render
 * harness: the provider reading a document's renditions once, and every
 * rendition of the document at its end, newest first with the PDF to open,
 * the source and references to download, what was left out and what the
 * typesetting said — one kept on a block before included, since no block
 * draws one. What the route answers is stood in for by the browser's own
 * `fetch`, answered with the shape the server's tests prove.
 */
const rendition = (id: string, of: string, made: string): RenditionView => ({
  renditionId: id,
  revisionId: `rev-${id}`,
  of,
  document: "doc-1",
  type: "pdf",
  title: "A Manuscript",
  revision: 2186,
  venue: "ieee",
  files: [
    { objectId: "a", filename: "manuscript.pdf", mediaType: "application/pdf", size: 93730 },
    { objectId: "b", filename: "manuscript.tex", mediaType: "text/x-tex", size: 2048 },
  ],
  made,
  by: "claude",
  outcome: "ok",
  log: ["Package caption Warning: Unknown document class (or package)"],
  omitted: ["A video: a manuscript is printed."],
});
const newer = rendition("0ba160b6-1819-4d78-a04b-7d2ba21a01fa", "doc-1", "2026-10-01T10:00:00.000Z");
const onBlock = rendition("1ba160b6-1819-4d78-a04b-7d2ba21a01fa", "blk-1", "2026-10-01T09:30:00.000Z");
const older = rendition("2ba160b6-1819-4d78-a04b-7d2ba21a01fa", "doc-1", "2026-09-30T10:00:00.000Z");
const elsewhere = { ...rendition("3ba160b6-1819-4d78-a04b-7d2ba21a01fa", "doc-2", "2026-10-01T11:00:00.000Z"), document: "doc-2" };

/** A host supplying the editor surface the provider reads, and the
 * renditions as the provider holds them. */
const hosted = (child: JSXOutput, renditions: readonly RenditionView[] | null) =>
  component$(() => {
    const surface = useStore({ documentId: "doc-1", focusedBlockId: null, loaded: 1 }) as unknown as EditorSurface;
    useContextProvider(EditorSurfaceContext, surface);
    if (renditions === null) return child;
    const state = useStore<RenditionsState>({ loaded: true, renditions });
    useContextProvider(RenditionsContext, state);
    return child;
  });

async function mount(child: JSXOutput, renditions: readonly RenditionView[] | null = [newer, onBlock, older, elsewhere]) {
  const dom = await createDOM();
  await dom.render(jsx(hosted(child, renditions), {}));
  const root = dom.screen as unknown as HTMLElement;
  const settle = async (until: () => boolean) => {
    for (let at = 0; at < 50; at++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await dom.userEvent(root, "harnessSettle");
      if (until()) return;
    }
  };
  return { root, settle };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the document's renditions", () => {
  it("lists every rendition of the document at its end, newest first, one kept on a block before included", async () => {
    const { root } = await mount(jsx(DocumentRenditions, { documentId: "doc-1" }));
    const items = Array.from(root.querySelectorAll("[data-rendition]")).map((item) => item.getAttribute("data-rendition"));
    expect(items).toEqual([newer.renditionId, onBlock.renditionId, older.renditionId]);
    const pdf = root.querySelector('[data-rendition-file="manuscript.pdf"]') as HTMLAnchorElement;
    expect(pdf.getAttribute("href")).toBe(`/api/x/manuscripts/renditions/${newer.renditionId}/files/manuscript.pdf`);
    expect(pdf.getAttribute("target")).toBe("_blank");
    expect((root.querySelector('[data-rendition-file="manuscript.tex"]') as HTMLAnchorElement).getAttribute("download")).toBe("manuscript.tex");
    expect(root.querySelector("[data-rendition-omitted]")?.textContent).toContain("video");
    expect(root.querySelector("[data-rendition-log]")?.textContent).toContain("Unknown document class");
    expect(root.querySelector("[data-rendition-outcome]")?.textContent).toBe("Typeset");
  });

  it("draws nothing for a document with none", async () => {
    expect((await mount(jsx(DocumentRenditions, { documentId: "doc-3" }))).root.querySelector("[data-renditions]")).toBeFalsy();
  });

  it("is the one place drawn: no block draws a rendition", () => {
    const places = contributions.decorations?.document;
    expect(places?.places ?? {}).toEqual({});
    expect(Object.keys(places?.documentPlaces ?? {})).toEqual(["end"]);
  });
});

describe("the provider", () => {
  it("reads the document's renditions once and shares them with the places", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({ renditions: [newer] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const { root, settle } = await mount(jsx(RenditionsProvider, { documentId: "doc-1", children: jsx(DocumentRenditions, { documentId: "doc-1" }) }), null);
    await settle(() => root.querySelector("[data-renditions]") !== null);
    expect(asked).toEqual(["/api/x/manuscripts/renditions?document=doc-1"]);
    expect(root.querySelector(`[data-rendition="${newer.renditionId}"]`)).toBeTruthy();
  });
});
