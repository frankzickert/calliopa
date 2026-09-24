import type { BlockView, DocumentView, OutputBlockView, TableBlockView, TextBlockView } from "~/extensions/documents/server/assemble";
import type { WorkRecord } from "~/extensions/bibliography/lib/work";
import type { Run } from "~/lib/runs";

/**
 * The projection (`BO_0293_019`): a document's accepted reading order at a
 * revision, turned into what the typesetting service takes — a Pandoc JSON
 * document AST whose metadata carries the front matter, the cited works as
 * CSL-JSON, and the figures to send — with nothing typed a second time, so a
 * manuscript can never say what the record does not.
 *
 * Pure: the document's read and the cited works come in, the projection goes
 * out, and every rule is a case of the test beside it.
 *
 * - A `text` block's role becomes a paragraph, a section at three depths, a
 *   block quote, or — for `abstract` — the abstract in the head, wherever it
 *   stands. Its marks, links, line breaks and inline mathematics are carried;
 *   a citation becomes a `\cite` of the work, numbered by `bibtex` in
 *   first-citation order as the document numbers it.
 * - Figures, tables and equations are written as LaTeX with a label, and only
 *   the ones the document numbers carry a numbered caption, so LaTeX numbers
 *   exactly the blocks the document numbers, in the same order; a reference
 *   points at the label. A figure is a picture or an output's first picture,
 *   one sequence, as the document counts them (`BO_0295`).
 * - An output's picture is a figure and its HTML table a table, each with a
 *   last caption line naming the code cell and the revision that produced it;
 *   the code block that produced one is appended under *Supplementary
 *   Material*. Text output and tracebacks are not manuscript material.
 * - What the manuscript cannot carry — a video, a divider, a prompt, code that
 *   produced nothing, a picture not made yet, a picture in a format TeX does
 *   not read — is left out and said by name in `omitted`. Nothing is dropped
 *   without a word.
 */

export const PANDOC_API_VERSION = [1, 22, 1] as const;

type Inline = Record<string, unknown>;
type Block = Record<string, unknown>;
type Meta = Record<string, unknown>;

/** A figure's bytes to send, by the name the AST gives it. */
export interface FigureFile {
  readonly name: string;
  readonly objectId: string;
}

export interface Projection {
  readonly ast: { readonly "pandoc-api-version": readonly number[]; readonly meta: Meta; readonly blocks: readonly Block[] };
  readonly references: readonly Record<string, unknown>[];
  readonly files: readonly FigureFile[];
  readonly omitted: readonly string[];
}

const FIGURE_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "application/pdf": "pdf",
};

/** TeX's special characters, escaped for text written into LaTeX directly. */
export function latexText(text: string): string {
  return text.replace(/[\\{}$&#^_%~]/gu, (character) => {
    switch (character) {
      case "\\":
        return "\\textbackslash{}";
      case "^":
        return "\\textasciicircum{}";
      case "~":
        return "\\textasciitilde{}";
      default:
        return `\\${character}`;
    }
  });
}

const label = (prefix: "fig" | "tab" | "eq", blockId: string): string => `${prefix}:${blockId}`;

const words = (text: string): Inline[] => {
  const inlines: Inline[] = [];
  const lines = text.split("\n");
  lines.forEach((line, at) => {
    if (at > 0) inlines.push({ t: "LineBreak" });
    line.split(/( +)/u).forEach((piece) => {
      if (piece === "") return;
      inlines.push(piece.trim() === "" ? { t: "Space" } : { t: "Str", c: piece });
    });
  });
  return inlines;
};

const meta = (text: string): Meta => ({ t: "MetaInlines", c: words(text) });

interface Context {
  readonly document: DocumentView;
  readonly works: ReadonlyMap<string, WorkRecord>;
  readonly cited: string[];
  readonly omitted: string[];
}

function inlinesOf(runs: readonly Run[], context: Context): Inline[] {
  const inlines: Inline[] = [];
  for (const run of runs) {
    if (run.cite !== undefined) {
      const work = context.works.get(run.cite.work);
      if (work === undefined) {
        inlines.push({ t: "Str", c: "[source gone]" });
        context.omitted.push(`A citation of a work the bibliography no longer holds (${run.cite.work}).`);
        continue;
      }
      if (!context.cited.includes(run.cite.work)) context.cited.push(run.cite.work);
      const suffix = run.cite.locator !== undefined && run.cite.locator !== "" ? [{ t: "Str", c: `, ${run.cite.locator}` }] : [];
      inlines.push({
        t: "Cite",
        c: [[{ citationId: run.cite.work, citationPrefix: [], citationSuffix: suffix, citationMode: { t: "NormalCitation" }, citationNoteNum: 0, citationHash: 0 }], [{ t: "Str", c: `[@${run.cite.work}]` }]],
      });
      continue;
    }
    if (run.equationRef !== undefined) {
      const number = context.document.equationNumbers?.[run.equationRef];
      inlines.push(number === undefined ? { t: "Str", c: "(equation gone)" } : { t: "RawInline", c: ["latex", `\\eqref{${label("eq", run.equationRef)}}`] });
      continue;
    }
    if (run.figureRef !== undefined) {
      const number = context.document.figureNumbers?.[run.figureRef];
      inlines.push(number === undefined ? { t: "Str", c: "(figure gone)" } : { t: "RawInline", c: ["latex", `Figure~\\ref{${label("fig", run.figureRef)}}`] });
      continue;
    }
    if (run.tableRef !== undefined) {
      const number = context.document.tableNumbers?.[run.tableRef];
      inlines.push(number === undefined ? { t: "Str", c: "(table gone)" } : { t: "RawInline", c: ["latex", `Table~\\ref{${label("tab", run.tableRef)}}`] });
      continue;
    }
    if (run.math === true) {
      inlines.push({ t: "Math", c: [{ t: "InlineMath" }, run.text] });
      continue;
    }
    const marks = run.marks ?? [];
    let content: Inline[] = marks.includes("code") ? [{ t: "Code", c: [["", [], []], run.text] }] : words(run.text);
    if (marks.includes("strikethrough")) content = [{ t: "Strikeout", c: content }];
    if (marks.includes("italic")) content = [{ t: "Emph", c: content }];
    if (marks.includes("bold")) content = [{ t: "Strong", c: content }];
    if (run.link !== undefined) content = [{ t: "Link", c: [["", [], []], content, [run.link, ""]] }];
    inlines.push(...content);
  }
  return inlines;
}

/** A float's caption: numbered with its label when the document numbers the
 * block, else unnumbered, else none; the provenance line last, when there is
 * one. */
function captionOf(caption: string | undefined, numbered: boolean, labelled: string, provenance?: string): string {
  // The caption ends as a sentence before the provenance line follows it.
  const said = caption !== undefined && caption.trim() !== "" ? caption.trim() : "";
  const sentence = said !== "" && provenance !== undefined && !/[.!?]$/u.test(said) ? `${said}.` : said;
  const parts = [sentence !== "" ? latexText(sentence) : "", provenance !== undefined ? latexText(provenance) : ""].filter((part) => part !== "");
  const text = parts.join(" ");
  if (numbered) return `\\caption{${text}}\\label{${labelled}}`;
  if (text !== "") return `\\caption*{${text}}`;
  return "";
}

function figureBlock(name: string, caption: string): Block {
  return { t: "RawBlock", c: ["latex", `\\begin{figure}[htbp]\\centering\\includegraphics[width=\\linewidth,height=0.4\\textheight,keepaspectratio]{${name}}${caption}\\end{figure}`] };
}

function tableBlock(columns: readonly { readonly name: string; readonly type?: string }[], rows: readonly (readonly string[])[], caption: string): Block {
  const align = columns.map((column) => (column.type === "number" ? "r" : "l")).join("");
  const line = (cells: readonly string[]): string => `${cells.map((cell) => latexText(cell)).join(" & ")}\\\\`;
  const body = [
    "\\toprule",
    line(columns.map((column) => column.name)),
    "\\midrule",
    ...rows.map((row) => line(columns.map((_, at) => row[at] ?? ""))),
    "\\bottomrule",
  ].join("\n");
  return { t: "RawBlock", c: ["latex", `\\begin{table}[htbp]\\centering${caption}\n\\begin{tabular}{${align}}\n${body}\n\\end{tabular}\n\\end{table}`] };
}

/** An HTML table an output showed — the shape a data frame renders as — read
 * as its header and rows, or null when it is not one. */
export function htmlTable(html: string): { columns: { name: string }[]; rows: string[][] } | null {
  const table = /<table[\s\S]*?<\/table>/iu.exec(html)?.[0];
  if (table === undefined) return null;
  const cellText = (cell: string): string =>
    cell
      .replace(/<[^>]*>/gu, "")
      .replace(/&nbsp;/gu, " ")
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&quot;/gu, '"')
      .replace(/&#39;/gu, "'")
      .replace(/&amp;/gu, "&")
      .trim();
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/giu)].map((row) => [...row[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/giu)].map((cell) => cellText(cell[1] ?? "")));
  const [header, ...body] = rows.filter((row) => row.length > 0);
  if (header === undefined) return null;
  return { columns: header.map((name) => ({ name })), rows: body };
}

const isText = (block: BlockView): block is TextBlockView => block.kind === "text";

/**
 * Projects the document. `revision` is the dataRevision the read was made
 * at, named in each provenance line; `works` holds the bibliography's works
 * the document cites, by identity.
 */
export function project(document: DocumentView, works: ReadonlyMap<string, WorkRecord>, revision: number): Projection {
  const context: Context = { document, works, cited: [], omitted: [] };
  const blocks: Block[] = [];
  const abstract: Block[] = [];
  const supplementary: Block[] = [];
  const files: FigureFile[] = [];
  const reading = document.blocks.filter((block) => !("standing" in block) || (block.standing !== "discarded" && block.standing !== "prompt"));
  const codeCell = new Map<string, number>();
  reading.filter((block) => block.kind === "sourcecode").forEach((block, at) => codeCell.set(block.blockId, at + 1));
  // The code blocks whose output enters as a figure or a table, and what it
  // entered as, so their code is placed in the supplementary material.
  const produced = new Map<string, string[]>();

  const outputFigure = (output: OutputBlockView): Block | null => {
    const cell = codeCell.get(output.of);
    const provenance = cell === undefined ? `Produced by code no longer in the document, at revision ${revision}.` : `Produced by code cell ${cell} at revision ${revision}.`;
    const picture = output.pictures[0];
    if (picture !== undefined) {
      const extension = FIGURE_TYPES[picture.mediaType];
      if (extension === undefined) {
        context.omitted.push(`An output's picture in ${picture.mediaType}, which TeX does not read.`);
        return null;
      }
      const name = `figure-${output.blockId}.${extension}`;
      files.push({ name, objectId: picture.objectId });
      const number = document.figureNumbers?.[output.blockId];
      produced.set(output.of, [...(produced.get(output.of) ?? []), number === undefined ? "an unnumbered figure" : `Figure ${number}`]);
      return figureBlock(name, captionOf(output.caption, number !== undefined, label("fig", output.blockId), provenance));
    }
    for (const item of output.items) {
      if ((item.kind === "display" || item.kind === "result") && item.html !== undefined) {
        const table = htmlTable(item.html);
        if (table === null) continue;
        produced.set(output.of, [...(produced.get(output.of) ?? []), "a table"]);
        return tableBlock(table.columns, table.rows, captionOf(output.caption, false, "", provenance));
      }
    }
    return null;
  };

  for (const block of reading) {
    switch (block.kind) {
      case "text": {
        const inlines = inlinesOf(block.runs, context);
        switch (block.role) {
          case "h1":
          case "h2":
          case "h3":
            blocks.push({ t: "Header", c: [Number(block.role.slice(1)), [block.blockId, [], []], inlines] });
            break;
          case "quote":
            blocks.push({ t: "BlockQuote", c: [{ t: "Para", c: inlines }] });
            break;
          case "abstract":
            abstract.push({ t: "Para", c: inlines });
            break;
          default:
            if (inlines.length > 0) blocks.push({ t: "Para", c: inlines });
        }
        break;
      }
      case "equation": {
        const numbered = document.equationNumbers?.[block.blockId] !== undefined;
        const environment = numbered ? "equation" : "equation*";
        blocks.push({ t: "RawBlock", c: ["latex", `\\begin{${environment}}${numbered ? `\\label{${label("eq", block.blockId)}}` : ""}\n${block.tex}\n\\end{${environment}}`] });
        if (block.caption !== undefined && block.caption !== "") context.omitted.push(`The caption of an equation (“${block.caption}”): a paper's equations carry none.`);
        break;
      }
      case "image": {
        if (block.objectId === undefined) {
          context.omitted.push("A picture not made yet.");
          break;
        }
        const extension = FIGURE_TYPES[block.mediaType ?? ""];
        if (extension === undefined) {
          context.omitted.push(`A picture in ${block.mediaType ?? "an unknown format"}, which TeX does not read.`);
          break;
        }
        const name = `figure-${block.blockId}.${extension}`;
        files.push({ name, objectId: block.objectId });
        const number = document.figureNumbers?.[block.blockId];
        blocks.push(figureBlock(name, captionOf(block.caption, number !== undefined, label("fig", block.blockId))));
        break;
      }
      case "table": {
        const table = block as TableBlockView;
        const number = document.tableNumbers?.[table.blockId];
        blocks.push(tableBlock(table.columns, table.rows, captionOf(table.caption, number !== undefined, label("tab", table.blockId))));
        if (table.file !== undefined && table.file.rowCount > table.rows.length) {
          context.omitted.push(`The rows of a table past its first ${table.rows.length}; its file holds ${table.file.rowCount}.`);
        }
        break;
      }
      case "output": {
        const entered = outputFigure(block);
        if (entered !== null) blocks.push(entered);
        else context.omitted.push("An output that showed no picture and no table: text output and tracebacks are not manuscript material.");
        break;
      }
      case "sourcecode":
        break;
      case "video":
        context.omitted.push("A video: a manuscript is printed.");
        break;
      case "divider":
        context.omitted.push("A divider.");
        break;
      default: {
        const other = block as BlockView;
        context.omitted.push(`A ${other.kind === "unsupported" ? other.semanticType : other.kind} block this manuscript cannot carry.`);
      }
    }
  }

  // The code that produced a figure or a table, as supplementary material;
  // code that produced neither is said by name.
  for (const block of reading) {
    if (block.kind !== "sourcecode") continue;
    const what = produced.get(block.blockId);
    const cell = codeCell.get(block.blockId) ?? 0;
    if (what === undefined) {
      context.omitted.push(`Code cell ${cell}, which produced no figure and no table.`);
      continue;
    }
    supplementary.push(
      { t: "RawBlock", c: ["latex", `\\subsection*{Code cell ${cell}${block.language !== undefined ? ` (${latexText(block.language)})` : ""}, producing ${latexText(what.join(" and "))}}`] },
      { t: "RawBlock", c: ["latex", `\\begin{lstlisting}\n${block.source}\n\\end{lstlisting}`] },
    );
  }

  const head: Meta = { title: meta(document.title) };
  const front = document.frontMatter;
  if (front?.authors !== undefined) {
    head["author"] = {
      t: "MetaList",
      c: front.authors.map((author) => {
        const places = (author.affiliations ?? []).map((at) => front.affiliations?.[at]).filter((place): place is string => place !== undefined);
        return {
          t: "MetaMap",
          c: {
            name: meta(author.corresponding === true ? `${author.name}*` : author.name),
            ...(places.length > 0 ? { affiliation: meta(places.join("; ")) } : {}),
            ...(author.email !== undefined ? { email: meta(author.email) } : {}),
          },
        };
      }),
    };
  }
  if (abstract.length > 0) head["abstract"] = { t: "MetaBlocks", c: abstract };
  if (front?.keywords !== undefined) head["keywords"] = { t: "MetaList", c: front.keywords.map(meta) };
  if (supplementary.length > 0) head["supplementary"] = { t: "MetaBlocks", c: supplementary };

  const references = context.cited.map((workId) => cslOf(workId, works.get(workId) as WorkRecord));
  return { ast: { "pandoc-api-version": [...PANDOC_API_VERSION], meta: head, blocks }, references, files, omitted: context.omitted };
}

/** A work as CSL-JSON, keyed by its identity, which is the citation's key. */
export function cslOf(workId: string, record: WorkRecord): Record<string, unknown> {
  const { kind, tags: _tags, fetched: _fetched, file: _file, ...rest } = record as unknown as Record<string, unknown> & { kind: string };
  return { id: workId, type: kind, ...rest };
}

export { isText };
