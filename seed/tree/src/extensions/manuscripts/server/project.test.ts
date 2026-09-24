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
    expect(raw).toContain('"citationSuffix":[{"t":"Str","c":", p. 3"}]');
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

  it("escapes a table's cells for TeX", () => {
    expect(raw).toContain("a\\\\_b \\\\& c");
  });

  it("enters an output's picture as a figure whose caption names the code cell and the revision", () => {
    expect(raw).toContain("{figure-out.png}\\\\caption{The fit. Produced by code cell 1 at revision 2186.}\\\\label{fig:out}");
    expect(projected.files).toEqual([
      { name: "figure-img.png", objectId: "obj-img" },
      { name: "figure-out.png", objectId: "obj-out" },
    ]);
  });

  it("places the code that produced a figure in the supplementary material", () => {
    const supplementary = JSON.stringify((projected.ast.meta as Record<string, unknown>)["supplementary"]);
    expect(supplementary).toContain("Code cell 1 (python), producing Figure 2");
    expect(supplementary).toContain("plot(x)");
    expect(supplementary).not.toContain("print(1)");
  });

  it("leaves out what a manuscript cannot carry and says each by name, and a discarded block says nothing", () => {
    expect(projected.omitted).toEqual([
      "An output that showed no picture and no table: text output and tracebacks are not manuscript material.",
      "A video: a manuscript is printed.",
      "A divider.",
      "Code cell 2, which produced no figure and no table.",
    ]);
    expect(raw).not.toContain("Discarded");
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
