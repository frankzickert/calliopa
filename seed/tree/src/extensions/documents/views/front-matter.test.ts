import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlockView, DocumentView } from "../server/assemble";
import { activateBlock, documentsApi, mountEditor, type SentCommand } from "./testing/editor-harness";

/**
 * A manuscript's head in the editor (`BO_0293_014`, `BO_0293_016`,
 * `BO_0293_025`): the authors and affiliations beneath the title; the fields
 * beneath them — chips for the affiliations and the keywords, a row per
 * author, the venue as a word — each settled edit writing the whole front
 * matter with `setFrontMatter` on the document's base, since the inspector
 * contributes no action (CA_0053); and the abstract drawn as a paragraph of
 * its own role while read and edited.
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
const chips = (root: HTMLElement, part: string) => [...root.querySelectorAll(`[data-front-chip="${part}"] > span`)].map((chip) => chip.textContent ?? "");
const input = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLInputElement;
const written = (sent: SentCommand[]) => sent.filter((entry) => entry.body["command"] === "setFrontMatter").map((entry) => entry.body);

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

describe("the front matter's fields in the document's head", () => {
  it("shows the affiliations and keywords as chips, each author as a row and the venue as a word", async () => {
    const { view } = await mount({
      authors: [{ name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true }],
      affiliations: ["Analytical Engines Ltd"],
      keywords: ["provenance", "typesetting"],
      venue: "ieee",
    });
    await view.settle(() => view.root.querySelector('[data-front-author-name="0"]') != null);
    expect(chips(view.root, "affiliations")).toEqual(["1Analytical Engines Ltd"]);
    expect(chips(view.root, "keywords")).toEqual(["provenance", "typesetting"]);
    expect(input(view.root, '[data-front-author-name="0"]').value).toBe("Ada Lovelace");
    expect(input(view.root, '[data-front-author-email="0"]').value).toBe("ada@example.org");
    expect(input(view.root, '[data-front-author-affiliation="0:0"]').checked).toBe(true);
    expect(input(view.root, '[data-front-author-corresponding="0"]').checked).toBe(true);
    expect(field(view.root, "venue")?.value).toBe("ieee");
    await view.idle();
  });

  it("enters an affiliation with Enter, writing the whole front matter on the document's base and keeping the rest", async () => {
    const { view, sent } = await mount({ authors: [{ name: "Ada Lovelace", affiliations: [0] }], affiliations: ["Analytical Engines Ltd"], venue: "ieee" });
    await view.settle(() => field(view.root, "affiliations") != null);
    const entry = field(view.root, "affiliations") as HTMLInputElement;
    entry.value = " Difference Works ";
    await view.userEvent(entry, "input");
    await view.userEvent(entry, "keydown", { key: "Enter" });
    await view.settle(() => written(sent).length > 0);
    expect(written(sent)[0]).toEqual({
      command: "setFrontMatter",
      baseRevisionId: "rev-doc",
      frontMatter: { authors: [{ name: "Ada Lovelace", affiliations: [0] }], affiliations: ["Analytical Engines Ltd", "Difference Works"], venue: "ieee" },
    });
    await view.idle();
  });

  it("removes an affiliation from its chip and renumbers the authors", async () => {
    const { view, sent } = await mount({
      authors: [{ name: "Ada Lovelace", affiliations: [0, 1] }, { name: "Charles Babbage", affiliations: [0] }],
      affiliations: ["Analytical Engines Ltd", "Difference Works"],
    });
    await view.settle(() => view.root.querySelector('[data-front-remove="affiliations"][data-front-at="0"]') != null);
    await view.userEvent('[data-front-remove="affiliations"][data-front-at="0"]', "click");
    await view.settle(() => written(sent).length > 0);
    expect(written(sent)[0]?.["frontMatter"]).toEqual({ affiliations: ["Difference Works"], authors: [{ name: "Ada Lovelace", affiliations: [0] }, { name: "Charles Babbage" }] });
    await view.idle();
  });

  it("adds an author as a row that writes once it is named, and marks one corresponding", async () => {
    const { view, sent } = await mount({ affiliations: ["Analytical Engines Ltd"] });
    await view.settle(() => view.root.querySelector("[data-front-author-add]") != null);
    await view.userEvent("[data-front-author-add]", "click");
    await view.settle(() => view.root.querySelector('[data-front-author-name="0"]') != null);
    expect(written(sent)).toEqual([]);
    const name = input(view.root, '[data-front-author-name="0"]');
    name.value = "Grace Hopper";
    await view.userEvent(name, "change");
    await view.settle(() => written(sent).length > 0);
    expect(written(sent)[0]?.["frontMatter"]).toEqual({ affiliations: ["Analytical Engines Ltd"], authors: [{ name: "Grace Hopper" }] });
    await view.settle(() => view.root.querySelector('[data-front-author-corresponding="0"]') != null);
    const corresponding = input(view.root, '[data-front-author-corresponding="0"]');
    corresponding.checked = true;
    await view.userEvent(corresponding, "change");
    await view.settle(() => written(sent).length > 1);
    expect(written(sent)[1]?.["frontMatter"]).toEqual({ affiliations: ["Analytical Engines Ltd"], authors: [{ name: "Grace Hopper", corresponding: true }] });
    await view.idle();
  });

  it("refuses a row with an email but no name in words, and writes nothing", async () => {
    const { view, sent } = await mount({});
    await view.settle(() => view.root.querySelector("[data-front-author-add]") != null);
    await view.userEvent("[data-front-author-add]", "click");
    await view.settle(() => view.root.querySelector('[data-front-author-email="0"]') != null);
    const email = input(view.root, '[data-front-author-email="0"]');
    email.value = "grace@example.org";
    await view.userEvent(email, "change");
    await view.settle();
    expect(written(sent)).toEqual([]);
    expect(view.root.textContent ?? "").toContain("Author 1 has no name yet.");
    await view.idle();
  });

  it("writes the venue when its field settles", async () => {
    const { view, sent } = await mount({ keywords: ["provenance"] });
    await view.settle(() => field(view.root, "venue") != null);
    const venue = field(view.root, "venue") as HTMLInputElement;
    venue.value = "ieee";
    await view.userEvent(venue, "change");
    await view.settle(() => written(sent).length > 0);
    expect(written(sent)[0]?.["frontMatter"]).toEqual({ keywords: ["provenance"], venue: "ieee" });
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
