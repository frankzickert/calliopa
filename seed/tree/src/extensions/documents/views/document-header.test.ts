import { readFileSync } from "node:fs";
import { jsx } from "@builder.io/qwik";
import { createDOM } from "@builder.io/qwik/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentView } from "../server/assemble";
import { CompactLine, headerHasLeft } from "./document-header";
import { documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * The document's header (`DO_0030_002`, `DO_0030_003`, `DO_0030_007`) in
 * Qwik's render harness: the route, the title and the extensions' rows under
 * it as one header, the rows in extension order and drawn full; the compact
 * line absent at rest, drawn from the title and the compact rows, a press on
 * it scrolling the surface back to the top; and when the header counts as
 * gone. Where the lines stand on a page is measured in a browser.
 */

const draft: DocumentView = {
  documentId: "doc-1",
  revisionId: "rev-doc",
  title: "Caching",
  blocks: [
    { kind: "text", blockId: "blk-a", revisionId: "rev-a", containmentId: "c-a", order: "a", role: "paragraph", standing: "keep", runs: [{ text: "Independent checks preserve boundaries." }] },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = async (route?: { itemId: string; title: string; blockId?: string }[]) => {
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(draft, sent));
  return mountEditor(draft, route === undefined ? {} : { route });
};

describe("the document's header", () => {
  it("Given a focused work's route, Then the header holds the route, the title and the rows under it, in that order", async () => {
    const view = await mount([
      { itemId: "doc-0", title: "Architecture", blockId: "blk-0" },
      { itemId: "doc-1", title: "Caching" },
    ]);
    const header = view.root.querySelector("[data-document-header]");
    expect(header?.tagName.toLowerCase()).toBe("header");
    const parts = Array.from(header?.children ?? [])
      .filter((child) => !child.classList.contains("visually-hidden"))
      .map((child) => child.getAttribute("data-document-route") !== null ? "route" : child.classList.contains("document-title") ? "title" : child.getAttribute("data-document-title-place") !== null ? "place" : child.tagName);
    expect(parts).toEqual(["route", "title", "place"]);
    // The first block is not in the header.
    expect(header?.querySelector("[data-block-id]")).toBeFalsy();
  });

  it("Given no route, Then the header holds the title and the rows alone", async () => {
    const view = await mount();
    expect(view.root.querySelector("[data-document-header] [data-document-route]")).toBeFalsy();
    expect(view.root.querySelector("[data-document-header] .document-title")).toBeTruthy();
  });

  it("Then each extension's title contribution is a row of its own, in extension order", async () => {
    const view = await mount();
    const rows = Array.from(view.root.querySelectorAll("[data-document-title-place] [data-title-place-row]")).map((row) => row.getAttribute("data-title-place-row"));
    expect(rows).toEqual(["structures", "keywords"]);
  });

  it("Then the compact line is absent at rest, and its anchor stands at the top of the surface, before the header", async () => {
    const view = await mount();
    expect(view.root.querySelector("[data-document-header-compact]")).toBeFalsy();
    const surface = view.root.querySelector("[data-block-surface]");
    expect(surface?.firstElementChild?.getAttribute("data-document-header-anchor")).not.toBeNull();
  });
});

describe("the compact line", () => {
  it("Given the header has left, Then the line says the title, draws the rows compact, and a press scrolls the surface to the top", async () => {
    const dom = await createDOM();
    await dom.render(jsx("div", { class: "block-surface", children: jsx(CompactLine, { title: "Caching", documentId: "doc-1", dataRevision: 3 }) }));
    const root = dom.screen as unknown as HTMLElement;
    const line = root.querySelector("[data-document-header-compact]") as HTMLElement;
    expect(line.tagName.toLowerCase()).toBe("button");
    expect(line.querySelector(".document-header-compact__title")?.textContent).toBe("Caching");
    expect(line.getAttribute("aria-label")).toBe("Caching: back to the top");
    // The rows are drawn compact: no row wrappers, which only the full header has.
    expect(line.querySelector("[data-title-place-row]")).toBeFalsy();
    const surface = root.querySelector(".block-surface") as HTMLElement & { scrollTo: (options: ScrollToOptions) => void };
    const scrolled: ScrollToOptions[] = [];
    surface.scrollTo = (options: ScrollToOptions) => {
      scrolled.push(options);
    };
    await dom.userEvent("[data-document-header-compact]", "click");
    expect(scrolled).toEqual([{ top: 0, behavior: "smooth" }]);
  });
});

describe("headerHasLeft", () => {
  const sighting = (isIntersecting: boolean, top: number) => ({ isIntersecting, boundingClientRect: { top }, rootBounds: { top: 48 } });

  it("Given the header in view, Then it has not left", () => {
    expect(headerHasLeft(sighting(true, 60))).toBe(false);
  });

  it("Given the header out of view above the visible area, Then it has left", () => {
    expect(headerHasLeft(sighting(false, -120))).toBe(true);
  });

  it("Given the header out of view below it, or no root measured, Then it has not left", () => {
    expect(headerHasLeft(sighting(false, 900))).toBe(false);
    expect(headerHasLeft({ isIntersecting: false, boundingClientRect: { top: -10 }, rootBounds: null })).toBe(false);
  });
});

describe("the header's stylesheet", () => {
  const css = readFileSync(new URL("./block-editor.css", import.meta.url), "utf8");

  it("hangs the compact line from a sticky anchor of no height under the bar, so its appearing moves no content", () => {
    // Held inside the surface's top padding, the bar's height and a row's
    // clearance: the clearance taken back puts it directly under the bar.
    expect(css).toMatch(/\n\.block-surface\s*\{[^}]*padding:\s*calc\(var\(--block-bar-height\) \+ 0\.5rem\)/u);
    expect(css).toMatch(/\n\.document-header-anchor\s*\{[^}]*position:\s*sticky;[^}]*top:\s*-0\.5rem;[^}]*height:\s*0;/u);
    expect(css).toMatch(/\n\.document-header-compact\s*\{[^}]*position:\s*absolute;/u);
  });

  it("stacks the compact line over every layer of the document and under the shell's panels on a phone", () => {
    // BO_0343_010: at the drawer's own level the line was drawn over the
    // drawer and the inspector, whichever came later in the page.
    const level = (source: string, selector: string): number => {
      const rule = new RegExp(`\\n\\s*${selector.replace(".", "\\.")}\\s*\\{[^}]*z-index:\\s*(\\d+);`, "u").exec(source);
      expect(rule, selector).not.toBeNull();
      return Number(rule?.[1]);
    };
    const shell = readFileSync(new URL("../../../components/shell/shell.css", import.meta.url), "utf8");
    const line = level(css, ".document-header-anchor");
    const inside = css
      .split(/\n(?=[^\s}])/u)
      .filter((rule) => !rule.startsWith(".document-header-anchor") && !/position:\s*fixed/u.test(rule))
      .flatMap((rule) => [...rule.matchAll(/z-index:\s*(\d+);/gu)].map((match) => Number(match[1])));
    expect(Math.max(...inside)).toBeLessThan(line);
    expect(line).toBeLessThan(level(shell, ".drawer"));
    expect(line).toBeLessThan(level(shell, ".sheet-handle"));
  });

  it("puts the header's left edge on the blocks' gutter, its other lines on the text inside it", () => {
    expect(css).toMatch(/\n\.document-header\s*\{[^}]*padding-inline:\s*var\(--block-grip-gutter\)/u);
    expect(css).toMatch(/\.document-header > \.document-title-place\s*\{[^}]*padding-inline-start:\s*var\(--document-header-text\)/u);
  });
});
