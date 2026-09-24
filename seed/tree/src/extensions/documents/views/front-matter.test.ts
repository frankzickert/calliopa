import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A manuscript's head in the editor (`BO_0293_014`, `BO_0293_016`): the
 * authors and affiliations beneath the title; the four lines beneath them, each
 * saved whole with `setFrontMatter` on the document's base — the inspector
 * contributes no action (CA_0053); and
 * the abstract drawn as a paragraph of its own role while read and edited.
 */
const text = (blockId: string, order: string, words: string, role: "paragraph" | "abstract" = "paragraph"): BlockView => ({
  kind: "text",
  blockId,
  revisionId: `rev-${blockId}`,
  containmentId: `c-${blockId}`,
  order,
  role,
  standing: "keep",
  runs: [{ text: words }],
});

async function mount(frontMatter: DocumentView["frontMatter"], blocks: readonly BlockView[] = [text("blk-a", "a", "Introduction.")]) {
  const document: DocumentView = {
    documentId: "doc-1",
    revisionId: "rev-doc",
    title: "A Manuscript",
    blocks: [...blocks],
    ...(frontMatter === undefined ? {} : { frontMatter }),
  };
  const sent: SentCommand[] = [];
  vi.stubGlobal("fetch", documentsApi(document, sent));
  const view = await mountEditor(document);
  return { view, sent };
}

const field = (root: HTMLElement, id: string) => (root.querySelector(`[data-front-field="${id}"]`) ?? null) as HTMLInputElement | null;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the manuscript's head beneath the title", () => {
  it("draws the authors with their affiliations' numbers and the corresponding mark, then the affiliations", async () => {
    const { view } = await mount({
      authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
      affiliations: ["Analytical Engines Ltd", "Difference Works"],
    });
    const head = view.root.querySelector("[data-document-authors]") as HTMLElement;
    expect(head.textContent).toContain("Ada Lovelace1*");
    expect(head.textContent).toContain("Charles Babbage1,2");
    expect(head.querySelector("[data-document-affiliations]")?.textContent).toBe("1Analytical Engines Ltd2Difference Works");
    await view.idle();
  });

  it("draws nothing there for a document with no authors", async () => {
    const { view } = await mount(undefined);
    expect(view.root.querySelector("[data-document-authors]") ?? null).toBeNull();
    await view.idle();
  });
});

describe("the front matter's lines in the document's head", () => {
  it("shows each line as the document carries it", async () => {
    const { view } = await mount({
      authors: [{ name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true }],
      affiliations: ["Analytical Engines Ltd"],
      keywords: ["provenance", "typesetting"],
      venue: "ieee",
    });
    await view.settle(() => field(view.root, "authors") != null);
    expect(field(view.root, "authors")?.value).toBe("Ada Lovelace (1) <ada@example.org> *");
    expect(field(view.root, "affiliations")?.value).toBe("Analytical Engines Ltd");
    expect(field(view.root, "keywords")?.value).toBe("provenance, typesetting");
    expect(field(view.root, "venue")?.value).toBe("ieee");
    await view.idle();
  });

  it("saves a line as the whole front matter on the document's base, keeping the other lines", async () => {
    const { view, sent } = await mount({ affiliations: ["Analytical Engines Ltd"], venue: "ieee" });
    await view.settle(() => field(view.root, "authors") != null);
    const authors = field(view.root, "authors") as HTMLInputElement;
    authors.value = "Ada Lovelace (1) *; Charles Babbage";
    await view.userEvent(authors, "input");
    await view.userEvent('[data-front-save="authors"]', "click");
    await view.settle(() => sent.some((entry) => entry.body["command"] === "setFrontMatter"));
    expect(sent.find((entry) => entry.body["command"] === "setFrontMatter")?.body).toEqual({
      command: "setFrontMatter",
      baseRevisionId: "rev-doc",
      frontMatter: {
        affiliations: ["Analytical Engines Ltd"],
        venue: "ieee",
        authors: [{ name: "Ada Lovelace", affiliations: [0], corresponding: true }, { name: "Charles Babbage" }],
      },
    });
    await view.idle();
  });

  it("writes nothing for an authors line naming an affiliation the document does not list, and says why", async () => {
    const { view, sent } = await mount({});
    await view.settle(() => field(view.root, "authors") != null);
    const authors = field(view.root, "authors") as HTMLInputElement;
    authors.value = "Ada Lovelace (2)";
    await view.userEvent(authors, "input");
    await view.userEvent('[data-front-save="authors"]', "click");
    await view.settle();
    expect(sent.some((entry) => entry.body["command"] === "setFrontMatter")).toBe(false);
    expect(view.root.textContent ?? "").toContain("Ada Lovelace names affiliation 2, and the document lists none.");
    await view.idle();
  });
});

describe("an abstract", () => {
  it("is drawn with its role while read and while edited, so the stylesheet sets it apart", async () => {
    const { view } = await mount(undefined, [text("blk-ab", "a", "We show that a record can emit a paper.", "abstract"), text("blk-b", "b", "Introduction.")]);
    const reading = view.root.querySelector('[data-block-id="blk-ab"] [data-block-reading]') as HTMLElement;
    expect(reading.getAttribute("data-role")).toBe("abstract");
    expect(reading.tagName).toBe("P");
    await activateBlock(view, "blk-ab");
    expect(view.root.querySelector('[data-block-id="blk-ab"] .block-text--active')?.getAttribute("data-role")).toBe("abstract");
    await view.idle();
  });
});
