import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * References from the hash (`BO_0300_008`): `#` typed in a paragraph offers
 * the document's blocks and a choice writes one `blockRef` atom with the `#`
 * taken back; a reference is drawn as the read's label, a heading's words or
 * a remark, or gone, and a click takes the reader to the block; the bar's
 * three reference choices are gone.
 */
const common = (blockId: string, order: string) => ({ blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order });
const words = (blockId: string, order: string, text: string, role = "paragraph", runs?: Record<string, unknown>[]): BlockView =>
  ({ ...common(blockId, order), kind: "text", role, standing: "keep", runs: runs ?? [{ text }] }) as unknown as BlockView;

async function mount(blocks: readonly BlockView[], rest: Partial<DocumentView> = {}) {
  const document: DocumentView = { documentId: "doc-1", revisionId: "rev-doc", title: "References", blocks: [...blocks], ...rest };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  return { view, sent };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("writing a reference from #", () => {
  it("offers the document's blocks when # is typed in a paragraph, the block itself left out, and writes the chosen one as an atom with the # taken back", async () => {
    const { view } = await mount(
      [words("h", "a", "The Method", "h2"), words("p", "b", "See #"), words("p2", "c", "Another paragraph."), { ...common("img", "d"), kind: "image", objectId: "o", numbered: true, number: 1, caption: "The apparatus" } as BlockView],
      { figureNumbers: { img: 1 }, referenceLabels: { img: "Figure 1" } },
    );
    await activateBlock(view, "p");
    await view.settle(() => view.root.querySelector("[data-block-reference-list]") !== null);
    const offered = [...view.root.querySelectorAll("[data-block-reference-option]")].map((option) => option.getAttribute("data-block-reference-option"));
    expect(offered).toEqual(["h", "p2", "img"]);
    await view.userEvent('[data-block-reference-option="h"]', "click");
    await view.settle(() => view.root.querySelector('[data-block-id="p"] [data-block-editor] [data-block-ref="h"]') !== null);
    const atom = view.root.querySelector('[data-block-id="p"] [data-block-editor] [data-block-ref="h"]') as HTMLElement;
    expect(atom.getAttribute("data-block-ref-label")).toBe("(gone)");
    expect(view.root.querySelector('[data-block-id="p"] [data-block-editor]')?.textContent).toBe("See ​".replace("​", atom.textContent ?? ""));
    await view.idle();
  });

  it("measures the # past the atoms before it, so a reference after a citation keeps every typed word and two may stand side by side", async () => {
    const { view } = await mount(
      [
        words("h", "a", "The Method", "h2"),
        words("p", "b", "", "paragraph", [{ text: "As " }, { text: "", cite: { work: "w1" } }, { text: " and " }, { text: "", blockRef: "h" }, { text: "#" }]),
      ],
      { referenceLabels: { h: "The Method" }, citationNumbers: { w1: 1 } },
    );
    await activateBlock(view, "p");
    await view.settle(() => view.root.querySelector('[data-block-reference-option="h"]') !== null);
    await view.userEvent('[data-block-reference-option="h"]', "click");
    await view.settle(() => view.root.querySelectorAll('[data-block-id="p"] [data-block-editor] [data-block-ref="h"]').length === 2);
    const surface = view.root.querySelector('[data-block-id="p"] [data-block-editor]') as HTMLElement;
    // The words before the citation and between the atoms are all still there, and the # is gone.
    expect(surface.textContent?.startsWith("As ")).toBe(true);
    expect(surface.textContent).toContain(" and ");
    expect(surface.textContent).not.toContain("#");
    expect(surface.querySelectorAll("[data-cite-work]").length).toBe(1);
    await view.idle();
  });

  it("narrows the list by the words typed after the #", async () => {
    const { view } = await mount([words("h", "a", "The Method", "h2"), words("p", "b", "See #meth"), words("p2", "c", "Another paragraph.")]);
    await activateBlock(view, "p");
    await view.settle(() => view.root.querySelector("[data-block-reference-list]") !== null);
    expect([...view.root.querySelectorAll("[data-block-reference-option]")].map((option) => option.getAttribute("data-block-reference-option"))).toEqual(["h"]);
    await view.idle();
  });

  it("offers no reference choice on the bar any more", async () => {
    const { view } = await mount([words("p", "a", "See"), { ...common("img", "b"), kind: "image", objectId: "o", numbered: true, number: 1 } as BlockView], { figureNumbers: { img: 1 } });
    await activateBlock(view, "p");
    for (const id of ["block-reference-figure", "block-reference-table", "block-reference-equation"]) {
      expect(view.root.querySelector(`[data-bar-action="${id}"]`) ?? null).toBeNull();
    }
    await view.idle();
  });
});

describe("a reference drawn", () => {
  it("reads as the label the read resolved, as gone when there is none, and a click takes the reader to the block", async () => {
    const { view } = await mount(
      [
        words("h", "a", "The Method", "h2"),
        words("p", "b", "", "paragraph", [{ text: "As " }, { text: "", blockRef: "h" }, { text: " and " }, { text: "", blockRef: "q" }, { text: " say, unlike " }, { text: "", blockRef: "gone" }, { text: "." }]),
        words("q", "c", "A paragraph referred to."),
      ],
      { referenceLabels: { h: "The Method", q: "Remark 1" }, remarkNumbers: { q: 1 } },
    );
    const row = view.root.querySelector('[data-block-id="p"] [data-block-reading]') as HTMLElement;
    expect(row.querySelector('[data-block-ref="h"]')?.textContent).toBe("The Method");
    expect(row.querySelector('[data-block-ref="q"]')?.textContent).toBe("Remark 1");
    const gone = row.querySelector('[data-block-ref="gone"]') as HTMLElement;
    expect(gone.textContent).toBe("(gone)");
    expect(gone.classList.contains("run-block-ref--missing")).toBe(true);
    // A press takes the reader to the block: its row is brought into view.
    const revealed: string[] = [];
    for (const candidate of view.root.querySelectorAll<HTMLElement>("[data-block-id]")) {
      candidate.scrollIntoView = () => void revealed.push(candidate.getAttribute("data-block-id") ?? "");
    }
    await view.userEvent('[data-block-ref="q"]', "click");
    await view.settle(() => revealed.length > 0);
    expect(revealed).toEqual(["q"]);
    await view.idle();
  });

  it("paints a reference on the editing surface with its label as an attribute and reads it back as the run it was", async () => {
    const { view } = await mount([words("h", "a", "The Method", "h2"), words("p", "b", "", "paragraph", [{ text: "See " }, { text: "", blockRef: "h" }])], { referenceLabels: { h: "The Method" } });
    await activateBlock(view, "p");
    const atom = view.root.querySelector('[data-block-editor] [data-block-ref="h"]') as HTMLElement;
    expect(atom).toBeTruthy();
    expect(atom.getAttribute("data-block-ref-label")).toBe("The Method");
    expect(atom.textContent?.length).toBe(1);
    await view.idle();
  });
});
