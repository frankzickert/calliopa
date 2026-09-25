import { describe, expect, it } from "vitest";

import type { BlockView } from "~/extensions/documents/server/assemble";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";

import { cslOf, htmlTable, latexText, project } from "./project";
import { common, document, works } from "./testing/fixture";

/**
 * The projection (`BO_0293_019`) on one document holding every kind of block:
 * each rule a case, the left-out blocks named.
 */
const projected = project(document, works, 2186);
const raw = JSON.stringify(projected.ast);

describe("the head", () => {
  it("carries the title, the authors with their affiliations and the corresponding mark, the keywords and the abstract", () => {
    const head = projected.ast.meta as Record<string, { c: unknown }>;
    expect(JSON.stringify(head["title"])).toContain("Manuscript");
    expect(JSON.stringify(head["author"])).toContain('"Lovelace*"');
    expect(JSON.stringify(head["author"])).toContain("Difference");
    expect(JSON.stringify(head["keywords"])).toContain("typesetting");
    expect(JSON.stringify(head["abstract"])).toContain("record");
  });

  it("takes the abstract to the head wherever it stands, and out of the body", () => {
    expect(projected.ast.blocks.some((block) => JSON.stringify(block).includes("emit"))).toBe(false);
  });
});

describe("the body", () => {
  it("writes a heading as a section and a paragraph with its marks", () => {
    expect(projected.ast.blocks[0]).toMatchObject({ t: "Header", c: [1, ["h", [], []], [{ t: "Str", c: "Introduction" }]] });
    expect(raw).toContain('{"t":"Strong","c":[{"t":"Str","c":"work"}]}');
  });

  it("cites a work by its identity with its locator, and references the cited works as CSL-JSON in first-citation order", () => {
    expect(raw).toContain('"citationId":"w1"');
    // The locator as its own words after the comma, so natbib sets one space (dry walk, 2026-09-25).
    expect(raw).toContain('"citationSuffix":[{"t":"Str","c":","},{"t":"Space"},{"t":"Str","c":"p."},{"t":"Space"},{"t":"Str","c":"3"}]');
    expect(projected.references.map((reference) => reference["id"])).toEqual(["w1", "w2"]);
    expect(projected.references[0]).toMatchObject({ id: "w1", type: "article-journal", title: "On records" });
  });

  it("points each reference at its block's label and sets inline mathematics as mathematics", () => {
    expect(raw).toContain("Figure~\\\\ref{fig:img}");
    expect(raw).toContain("Table~\\\\ref{tab:tab}");
    expect(raw).toContain("\\\\eqref{eq:eq}");
    expect(raw).toContain('{"t":"Math","c":[{"t":"InlineMath"},"E = mc^2"]}');
  });

  it("numbers only what the document numbers: an equation, a figure and a table with their labels, the rest unnumbered", () => {
    expect(raw).toContain("\\\\begin{equation}\\\\label{eq:eq}");
    expect(raw).toContain("\\\\begin{equation*}\\nx = 1");
    expect(raw).toContain("\\\\includegraphics[width=\\\\linewidth,height=0.4\\\\textheight,keepaspectratio]{figure-img.png}\\\\caption{The apparatus}\\\\label{fig:img}");
    expect(raw).toContain("\\\\caption{Readings}\\\\label{tab:tab}");
  });

  it("prints a reference to a heading as its section, to a referred-to paragraph as a remark set apart, and says a gone one (BO_0300_012)", () => {
    expect(raw).toContain("Section~\\\\ref{h}");
    expect(raw).toContain("Remark~\\\\ref{par:claim}");
    expect(raw).toContain("\\\\begin{remark}\\\\label{par:claim}");
    expect(raw).toContain('"t":"Str","c":"(gone)"');
    expect(projected.omitted).toContain("A reference to a block outside the reading order (gone).");
    // The heading keeps the block's identity as its label, which Pandoc writes as \label.
    expect(projected.ast.blocks[0]).toMatchObject({ t: "Header", c: [1, ["h", [], []], [{ t: "Str", c: "Introduction" }]] });
  });

  it("escapes a table's cells for TeX", () => {
    expect(raw).toContain("a\\\\_b \\\\& c");
  });

  it("shrinks a table to the line only when it is wider, with a box the source defines itself", () => {
    expect(raw).toContain("\\\\ifdefined\\\\calliopatable\\\\else\\\\newsavebox{\\\\calliopatable}\\\\fi");
    expect(raw).toContain("\\\\ifdim\\\\wd\\\\calliopatable>\\\\linewidth\\\\resizebox{\\\\linewidth}{!}{\\\\usebox{\\\\calliopatable}}\\\\else\\\\usebox{\\\\calliopatable}\\\\fi");
  });

  it("enters an output's picture as a figure whose caption names the code cell and the revision", () => {
    expect(raw).toContain("{figure-out.png}\\\\caption{The fit. Produced by code cell 1 at revision 2186.}\\\\label{fig:out}");
    expect(projected.files).toEqual([
      { name: "figure-img.png", objectId: "obj-img", mediaType: "image/png" },
      { name: "figure-out.png", objectId: "obj-out", mediaType: "image/png" },
    ]);
  });

  it("places the code that produced a figure in the supplementary material", () => {
    const supplementary = JSON.stringify((projected.ast.meta as Record<string, unknown>)["supplementary"]);
    expect(supplementary).toContain("Code cell 1 (python), producing Figure 2");
    expect(supplementary).toContain("plot(x)");
    expect(supplementary).not.toContain("print(1)");
  });

  it("hands the supplementary code to Pandoc as a code block carrying its language, not as raw LaTeX (BO_0296_020)", () => {
    const supplementary = (projected.ast.meta as Record<string, { c: unknown }>)["supplementary"];
    const blocks = JSON.stringify(supplementary);
    expect(blocks).not.toContain("lstlisting");
    expect(blocks).toContain(JSON.stringify({ t: "CodeBlock", c: [["", ["python", "numberLines"], []], "plot(x)"] }));
  });

  it("numbers the supplementary code as the document numbers it: the numberLines class while the switch is on, startFrom where a continued block starts, neither when off (BO_0302_010)", () => {
    const supplementary = (projection: ReturnType<typeof project>) => JSON.stringify((projection.ast.meta as Record<string, { c: unknown }>)["supplementary"]);
    // The fixture's document says nothing about its switch, so it is on.
    expect(supplementary(projected)).toContain(JSON.stringify({ t: "CodeBlock", c: [["", ["python", "numberLines"], []], "plot(x)"] }));
    const continued = {
      ...document,
      blocks: document.blocks.map((block) => (block.kind === "sourcecode" && block.blockId === "code" ? { ...block, continues: true, firstLine: 40 } : block)),
    };
    expect(supplementary(project(continued, works, 2186))).toContain(JSON.stringify({ t: "CodeBlock", c: [["", ["python", "numberLines"], [["startFrom", "40"]]], "plot(x)"] }));
    const off = { ...continued, lineNumbers: false };
    expect(supplementary(project(off, works, 2186))).toContain(JSON.stringify({ t: "CodeBlock", c: [["", ["python"], []], "plot(x)"] }));
  });

  it("leaves out what a manuscript cannot carry and says each by name, and a discarded block says nothing", () => {
    expect(projected.omitted).toEqual([
      "A reference to a block outside the reading order (gone).",
      "An output that showed no picture and no table: text output and tracebacks are not manuscript material.",
      "A video: a manuscript is printed.",
      "A divider.",
      "Code cell 2, which produced no figure and no table.",
    ]);
    expect(raw).not.toContain("Discarded");
  });
});

describe("a numbered listing", () => {
  // The fixture's `code` block, numbered by its author, and a sentence
  // referring to it and to the unnumbered `code2` (BO_0303_016).
  const numbered = {
    ...document,
    blocks: document.blocks.flatMap((block): BlockView[] =>
      block.blockId === "code"
        ? [
            { ...block, numbered: true, caption: "The fit" } as BlockView,
            { ...common("ref", "g1"), kind: "text", role: "paragraph", standing: "keep", runs: [{ text: "See " }, { text: "", blockRef: "code" }, { text: " and " }, { text: "", blockRef: "code2" }] } as unknown as BlockView,
          ]
        : [block],
    ),
    listingNumbers: { code: 1 },
  };
  const listed = project(numbered, works, 2186);
  const body = JSON.stringify(listed.ast.blocks);
  const supplementary = (listed.ast.meta as Record<string, unknown>)["supplementary"];

  it("prints a code block its author numbered where it stands, as a listing float holding the coloured code, captioned and labelled", () => {
    const at = listed.ast.blocks.findIndex((block) => JSON.stringify(block) === JSON.stringify({ t: "RawBlock", c: ["latex", "\\begin{listing}[htbp]"] }));
    expect(at).toBeGreaterThan(0);
    expect(listed.ast.blocks[at + 1]).toEqual({ t: "CodeBlock", c: [["", ["python", "numberLines"], []], "plot(x)"] });
    expect(listed.ast.blocks[at + 2]).toEqual({ t: "RawBlock", c: ["latex", "\\caption{The fit}\\label{lst:code}\\end{listing}"] });
    // Where it stands: after the table that precedes it in the reading order.
    expect(JSON.stringify(listed.ast.blocks.slice(0, at))).toContain("\\begin{table}");
  });

  it("prints a reference to the listing as Listing~\\ref, and one to a code block nobody numbered as gone", () => {
    expect(body).toContain("Listing~\\\\ref{lst:code}");
    expect(body).toContain("(gone)");
    expect(listed.omitted).toContain("A reference to a code block nobody numbered (code2).");
  });

  it("names the listing in the provenance line of the figure it produced and prints the code once, with no supplementary section for it", () => {
    expect(raw).toContain("Produced by code cell 1 at revision 2186.");
    expect(body).toContain("The fit. Produced by Listing~\\\\ref{lst:code} at revision 2186.");
    // The listing was the only producing code, so the manuscript has no supplement at all.
    expect(supplementary).toBeUndefined();
    expect(listed.omitted).toContain("Code cell 2, which produced no figure and no table.");
  });

  it("keeps producing code nobody numbered in the supplement", () => {
    expect(JSON.stringify((projected.ast.meta as Record<string, unknown>)["supplementary"])).toContain("plot(x)");
    expect(raw).not.toContain("begin{listing}");
  });
});

describe("the parts", () => {
  it("escapes TeX's special characters", () => {
    expect(latexText("50% of $x_1 & {y} # ~ ^ \\")).toBe("50\\% of \\$x\\_1 \\& \\{y\\} \\# \\textasciitilde{} \\textasciicircum{} \\textbackslash{}");
  });

  it("reads a data frame's HTML table as its header and rows", () => {
    expect(htmlTable('<table border="1"><thead><tr><th></th><th>a</th></tr></thead><tbody><tr><th>0</th><td>1 &amp; 2</td></tr></tbody></table>')).toEqual({
      columns: [{ name: "" }, { name: "a" }],
      rows: [["0", "1 & 2"]],
    });
    expect(htmlTable("<p>no table</p>")).toBeNull();
  });

  it("writes a work as CSL-JSON keyed by its identity, without the bibliography's own fields", () => {
    expect(cslOf("w9", { title: "T", kind: "book", tags: ["x"], fetched: { by: "e", at: "t", from: "f" } } as unknown as WorkRecord)).toEqual({ id: "w9", type: "book", title: "T" });
  });

  it("answers a citation of a gone work in words and says so", () => {
    const gone = project({ ...document, blocks: [{ ...common("q", "a0"), kind: "text", role: "paragraph", standing: "keep", runs: [{ text: "", cite: { work: "nowhere" } }] }] as BlockView[] }, works, 1);
    expect(JSON.stringify(gone.ast.blocks)).toContain("[source gone]");
    expect(gone.omitted[0]).toContain("nowhere");
    expect(gone.references).toEqual([]);
  });
});

describe("the glossary", () => {
  it("sets every mentioned keyword once, alphabetically, with its definition, under a Glossary heading before the head is built", () => {
    const withGlossary = project(document, works, 2186, [
      { title: "Qubit", definition: [{ text: "The unit of " }, { text: "quantum", marks: ["italic"] }, { text: " information." }] },
      { title: "Entanglement", definition: null },
    ]);
    const heading = withGlossary.ast.blocks.findIndex((block) => block["t"] === "Header" && JSON.stringify(block).includes("Glossary"));
    expect(heading).toBeGreaterThan(0);
    const list = withGlossary.ast.blocks[heading + 1] as { t: string; c: [unknown[], unknown[][]][] };
    expect(list.t).toBe("DefinitionList");
    expect(list.c.map(([term]) => JSON.stringify(term))).toEqual([JSON.stringify([{ t: "Str", c: "Entanglement" }]), JSON.stringify([{ t: "Str", c: "Qubit" }])]);
    expect(list.c[0]?.[1]).toEqual([[]]);
    expect(JSON.stringify(list.c[1]?.[1])).toContain('"Emph"');
    expect(JSON.stringify(list.c[1]?.[1])).toContain("information.");
  });

  it("carries no glossary when nothing is mentioned", () => {
    expect(raw).not.toContain("Glossary");
    expect(raw).not.toContain("DefinitionList");
  });
});
