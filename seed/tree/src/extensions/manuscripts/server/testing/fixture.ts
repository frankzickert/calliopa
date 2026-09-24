import type { BlockView, DocumentView } from "~/extensions/documents/server/assemble";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";

/**
 * One document holding every kind of block (`BO_0293_019`), shared by the
 * projection's test and its run against the real typesetting service.
 */
export const common = (blockId: string, order: string) => ({ blockId, revisionId: `rev-${blockId}`, containmentId: `c-${blockId}`, order });

export const blocks: BlockView[] = [
  { ...common("abs", "a0"), kind: "text", role: "abstract", standing: "keep", runs: [{ text: "We show that a record can emit a paper." }] },
  { ...common("h", "b0"), kind: "text", role: "h1", standing: "keep", runs: [{ text: "Introduction" }] },
  {
    ...common("p", "c0"),
    kind: "text",
    role: "paragraph",
    standing: "keep",
    runs: [
      { text: "Prior " },
      { text: "work", marks: ["bold"] },
      { text: " " },
      { text: "", cite: { work: "w1", locator: "p. 3" } },
      { text: " and " },
      { text: "", cite: { work: "w2" } },
      { text: "; see " },
      { text: "", figureRef: "img" },
      { text: ", " },
      { text: "", tableRef: "tab" },
      { text: ", " },
      { text: "", equationRef: "eq" },
      { text: " and " },
      { text: "E = mc^2", math: true },
      { text: "." },
    ],
  },
  { ...common("gone", "c5"), kind: "text", role: "paragraph", standing: "discarded", runs: [{ text: "Discarded words." }] },
  { ...common("eq", "d0"), kind: "equation", standing: "keep", tex: "e^{i\\pi} + 1 = 0", numbered: true, number: 1 },
  { ...common("eq2", "d5"), kind: "equation", standing: "keep", tex: "x = 1" },
  { ...common("img", "e0"), kind: "image", objectId: "obj-img", mediaType: "image/png", caption: "The apparatus", numbered: true, number: 1 },
  { ...common("tab", "f0"), kind: "table", columns: [{ name: "x", type: "number" }, { name: "note", type: "text" }], rows: [["1", "a_b & c"]], caption: "Readings", numbered: true, number: 1 },
  { ...common("code", "g0"), kind: "sourcecode", source: "plot(x)", language: "python" },
  {
    ...common("out", "h0"),
    kind: "output",
    of: "code",
    outcome: "ok",
    items: [{ kind: "display", picture: 0 }],
    pictures: [{ objectId: "obj-out", filename: "figure-1.png", mediaType: "image/png", size: 10 }],
    files: [],
    numbered: true,
    number: 2,
    caption: "The fit",
  },
  { ...common("code2", "i0"), kind: "sourcecode", source: "print(1)" },
  { ...common("out2", "j0"), kind: "output", of: "code2", outcome: "ok", items: [{ kind: "stream", name: "stdout", text: "1" }], pictures: [], files: [] },
  { ...common("vid", "k0"), kind: "video", objectId: "obj-vid", mediaType: "video/mp4" },
  { ...common("div", "l0"), kind: "divider" },
] as BlockView[];

export const document: DocumentView = {
  documentId: "doc",
  revisionId: "rev-doc",
  title: "A Manuscript",
  blocks,
  equationNumbers: { eq: 1 },
  figureNumbers: { img: 1, out: 2 },
  tableNumbers: { tab: 1 },
  frontMatter: {
    authors: [{ name: "Ada Lovelace", affiliations: [0], email: "ada@example.org", corresponding: true }, { name: "Charles Babbage", affiliations: [0, 1] }],
    affiliations: ["Analytical Engines Ltd", "Difference Works"],
    keywords: ["provenance", "typesetting"],
    venue: "ieee",
  },
};

export const works = new Map<string, WorkRecord>([
  ["w1", { title: "On records", kind: "article-journal", author: [{ family: "Smith", given: "Anna" }], issued: { "date-parts": [[2020]] } } as WorkRecord],
  ["w2", { title: "Manuscripts", kind: "book", author: [{ family: "Doe", given: "John" }] } as WorkRecord],
]);

