import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView, TextBlockView } from "../server/assemble";
import { documentsApi, mountEditor } from "./testing/editor-harness";

/**
 * Mathematics inside a sentence as a reader sees it (`BO_0290_018`).
 *
 * The editing surface is `inline-math.test.ts`; this is the other half — the
 * row a reader reads, drawn by `Marked` from the sources the read already set
 * and the numbers it already resolved. The browser typesets nothing here,
 * which is what keeps a sentence from moving once the page is live.
 */
const SET = '<mjx-container class="MathJax" jax="SVG"><svg><path d="M1 1"></path></svg></mjx-container>';

const sentence = (
  blockId: string,
  order: string,
  runs: TextBlockView["runs"],
  mathSvg?: Record<string, string>,
): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role: "paragraph",
  standing: "keep",
  runs,
  ...(mathSvg === undefined ? {} : { mathSvg }),
});

async function mount(blocks: readonly BlockView[], equationNumbers?: Record<string, number>) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "Mathematics",
    blocks: [...blocks],
    ...(equationNumbers === undefined ? {} : { equationNumbers }),
  };
  vi.stubGlobal("fetch", documentsApi(document, []));
  return mountEditor(document);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mathematics in a sentence, as it is read", () => {
  it("draws the equation in the line, from the source the read set", async () => {
    const view = await mount([
      sentence(
        "blk-a",
        "a",
        [
          { text: "Einstein wrote " },
          { text: "E = mc^2", math: true },
          { text: " in 1905." },
        ],
        { "E = mc^2": SET },
      ),
    ]);
    const drawn = view.root.querySelector("[data-math]") as HTMLElement;
    expect(drawn).toBeTruthy();
    expect(drawn.innerHTML).toContain("<svg");
    // Its source is its accessible name, and never its visible words.
    expect(drawn.getAttribute("aria-label")).toBe("E = mc^2");
    // The prose around it is untouched.
    expect(view.root.textContent ?? "").toContain("Einstein wrote ");
    expect(view.root.textContent ?? "").toContain(" in 1905.");
    await view.idle();
  });

  it("draws mathematics the read could not set as its source, so the sentence keeps it", async () => {
    const view = await mount([
      sentence("blk-a", "a", [{ text: "see " }, { text: "\\frac{1}{", math: true }]),
    ]);
    const drawn = view.root.querySelector("[data-math]") as HTMLElement;
    expect(drawn.getAttribute("data-math-unset")).not.toBeNull();
    expect(drawn.textContent).toContain("\\frac{1}{");
    await view.idle();
  });

  it("draws a reference as the number its equation carries", async () => {
    const view = await mount(
      [sentence("blk-a", "a", [{ text: "as " }, { text: "", equationRef: "blk-e" }, { text: " shows." }])],
      { "blk-e": 2 },
    );
    const drawn = view.root.querySelector("[data-equation-ref]") as HTMLElement;
    expect(drawn.textContent).toBe("(2)");
    expect(drawn.getAttribute("data-equation-ref")).toBe("blk-e");
    await view.idle();
  });

  it("says a reference's equation is gone rather than drawing a stale number", async () => {
    const view = await mount([
      sentence("blk-a", "a", [{ text: "as " }, { text: "", equationRef: "blk-vanished" }]),
    ]);
    const drawn = view.root.querySelector("[data-equation-ref]") as HTMLElement;
    expect(drawn.textContent).toContain("equation gone");
    await view.idle();
  });

  it("draws mathematics before the marks are peeled, because a mark means nothing over an equation", async () => {
    const view = await mount(
      [sentence("blk-a", "a", [{ text: "E = mc^2", math: true, marks: ["bold"] }], { "E = mc^2": SET })],
      undefined,
    );
    const drawn = view.root.querySelector("[data-math]") as HTMLElement;
    expect(drawn).toBeTruthy();
    // Drawn as the equation, not wrapped in a <strong> carrying its source.
    expect(drawn.querySelector("strong") ?? null).toBeNull();
    await view.idle();
  });
});

/**
 * An inline `code` mark takes no syntax colour (`BO_0296_019`, user
 * decision 2026-09-23): it is the code face and nothing more. The rule fails
 * the moment a view colours it — a `<code>` in a sentence holding any
 * element, or any highlighter class, is a colouring.
 */
describe("an inline code mark", () => {
  it("is drawn in the code face and takes no syntax colour", async () => {
    const document: DocumentView = {
      documentId: "doc-1",
      revisionId: "rev-doc",
      title: "Reading",
      blocks: [sentence("blk-a", "a", [{ text: "Call " }, { text: "def f(x): return x", marks: ["code"] }, { text: " first." }])],
    };
    vi.stubGlobal("fetch", documentsApi(document, []));
    const view = await mountEditor(document);
    const row = view.root.querySelector("[data-block-id='blk-a'] [data-block-reading]") as HTMLElement;
    const code = row.querySelector("code") as HTMLElement;
    expect(code).toBeTruthy();
    expect(code.textContent).toBe("def f(x): return x");
    // Nothing inside it but the reader's own run wrapper: no token, no colour.
    expect(Array.from(code.querySelectorAll("*")).every((element) => element.tagName === "SPAN" && element.className === "run")).toBe(true);
    expect(row.querySelector("[class*='hljs']")).toBeFalsy();
  });
});
