import { showsLineNumbers, type BlockView, type CodeBlockView, type DocumentView, type OutputBlockView, type TableBlockView, type TextBlockView } from "~/extensions/documents/server/assemble";
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
  /** The picture's type, for keeping the figure beside the source. */
  readonly mediaType: string;
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

const label = (prefix: "fig" | "tab" | "eq" | "par" | "lst", blockId: string): string => `${prefix}:${blockId}`;

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
  /** The blocks of the reading order, by identity, and the paragraphs a
   * sentence refers to, which are set apart as remarks (`BO_0300_012`). */
  readonly reading: ReadonlyMap<string, BlockView>;
  readonly remarks: ReadonlySet<string>;
}

const HEADING_ROLES: readonly string[] = ["h1", "h2", "h3"];
const PROSE_ROLES: readonly string[] = ["paragraph", "quote"];

/**
 * What a reference to any block prints as (`BO_0300_012`, user decisions
 * 2026-09-25): a numbered figure, table or equation as its number, a heading
 * as `Section~\\ref` of the label Pandoc gives the header from the block's
 * identity, a paragraph or quote as `Remark~\\ref` of the remark it is set in;
 * a block outside the reading order, or one a paper cannot name, is said
 * gone and named in what was left out.
 */
function blockReference(target: string, context: Context): Inline {
  const block = context.reading.get(target);
  const gone = (why: string): Inline => {
    context.omitted.push(why);
    return { t: "Str", c: "(gone)" };
  };
  if (block === undefined) return gone(`A reference to a block outside the reading order (${target}).`);
  switch (block.kind) {
    case "text":
      if (HEADING_ROLES.includes(block.role)) return { t: "RawInline", c: ["latex", `Section~\\ref{${block.blockId}}`] };
      if (context.remarks.has(block.blockId)) return { t: "RawInline", c: ["latex", `Remark~\\ref{${label("par", block.blockId)}}`] };
      return gone(`A reference to a block a paper cannot name (${target}, ${block.role}).`);
    case "equation":
      return context.document.equationNumbers?.[block.blockId] === undefined ? gone(`A reference to an unnumbered equation (${target}).`) : { t: "RawInline", c: ["latex", `\\eqref{${label("eq", block.blockId)}}`] };
    case "image":
    case "output":
      return context.document.figureNumbers?.[block.blockId] === undefined ? gone(`A reference to an unnumbered figure (${target}).`) : { t: "RawInline", c: ["latex", `Figure~\\ref{${label("fig", block.blockId)}}`] };
    case "table":
      return context.document.tableNumbers?.[block.blockId] === undefined ? gone(`A reference to an unnumbered table (${target}).`) : { t: "RawInline", c: ["latex", `Table~\\ref{${label("tab", block.blockId)}}`] };
    case "sourcecode":
      // A numbered code block is a listing in the body (`BO_0303_016`).
      return context.document.listingNumbers?.[block.blockId] === undefined ? gone(`A reference to a code block nobody numbered (${target}).`) : { t: "RawInline", c: ["latex", `Listing~\\ref{${label("lst", block.blockId)}}`] };
    default:
      return gone(`A reference to a ${block.kind} block, which a paper cannot name (${target}).`);
  }
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
      // The locator is natbib's post-note and goes in as its own words after
      // the comma: the image's Pandoc (2.17) keeps the leading space of a
      // suffix written as one string, and natbib then set `[1,  p. 3]` with two
      // spaces (found in the dry walk of 2026-09-25).
      const suffix = run.cite.locator !== undefined && run.cite.locator !== "" ? [{ t: "Str", c: "," }, { t: "Space" }, ...words(run.cite.locator)] : [];
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
    if (run.blockRef !== undefined) {
      inlines.push(blockReference(run.blockRef, context));
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
 * one — already LaTeX, since it may carry a `\\ref` to the listing that
 * produced the block (`BO_0303_016`). */
function captionOf(caption: string | undefined, numbered: boolean, labelled: string, provenance?: string): string {
  // The caption ends as a sentence before the provenance line follows it.
  const said = caption !== undefined && caption.trim() !== "" ? caption.trim() : "";
  const sentence = said !== "" && provenance !== undefined && !/[.!?]$/u.test(said) ? `${said}.` : said;
  const parts = [sentence !== "" ? latexText(sentence) : "", provenance ?? ""].filter((part) => part !== "");
  const text = parts.join(" ");
  if (numbered) return `\\caption{${text}}\\label{${labelled}}`;
  if (text !== "") return `\\caption*{${text}}`;
  return "";
}

function figureBlock(name: string, caption: string): Block {
  return { t: "RawBlock", c: ["latex", `\\begin{figure}[htbp]\\centering\\includegraphics[width=\\linewidth,height=0.4\\textheight,keepaspectratio]{${name}}${caption}\\end{figure}`] };
}

/** A table, shrunk to the line only when it is wider: the tabular is set in
 * a box and measured, and one that overflows is scaled down while a narrow
 * one keeps its size. The box is the source's own, so no venue template
 * loads a package for it. A seven-column table had run off the page in both
 * venues (dry walk, 2026-09-25). */
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
  const tabular = `\\begin{tabular}{${align}}\n${body}\n\\end{tabular}`;
  const fitted = `\\ifdefined\\calliopatable\\else\\newsavebox{\\calliopatable}\\fi\n\\sbox{\\calliopatable}{${tabular}}\n\\ifdim\\wd\\calliopatable>\\linewidth\\resizebox{\\linewidth}{!}{\\usebox{\\calliopatable}}\\else\\usebox{\\calliopatable}\\fi`;
  return { t: "RawBlock", c: ["latex", `\\begin{table}[htbp]\\centering${caption}\n${fitted}\n\\end{table}`] };
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
/** One entry of the glossary (`BO_0301_020`): a keyword the document
 * mentions, with its definition's runs, or none. */
export interface GlossaryEntry {
  readonly title: string;
  readonly definition: readonly Run[] | null;
}

export function project(document: DocumentView, works: ReadonlyMap<string, WorkRecord>, revision: number, glossary: readonly GlossaryEntry[] = []): Projection {
  const blocks: Block[] = [];
  const abstract: Block[] = [];
  const supplementary: Block[] = [];
  const files: FigureFile[] = [];
  const reading = document.blocks.filter((block) => !("standing" in block) || (block.standing !== "discarded" && block.standing !== "prompt"));
  // The paragraphs a sentence refers to, set apart as remarks so a reference
  // has a number to point at (`BO_0300_012`, user decision 2026-09-25):
  // the read's own answer when it gave one, else derived here the same way.
  const referred = new Set<string>();
  for (const block of reading) if (block.kind === "text") for (const run of block.runs) if (run.blockRef !== undefined) referred.add(run.blockRef);
  const remarks = new Set<string>(
    document.remarkNumbers !== undefined
      ? Object.keys(document.remarkNumbers)
      : reading.filter((block) => block.kind === "text" && PROSE_ROLES.includes(block.role) && referred.has(block.blockId)).map((block) => block.blockId),
  );
  const context: Context = { document, works, cited: [], omitted: [], reading: new Map(reading.map((block) => [block.blockId, block])), remarks };
  const codeCell = new Map<string, number>();
  reading.filter((block) => block.kind === "sourcecode").forEach((block, at) => codeCell.set(block.blockId, at + 1));
  // The code blocks whose output enters as a figure or a table, and what it
  // entered as, so their code is placed in the supplementary material.
  const produced = new Map<string, string[]>();

  const outputFigure = (output: OutputBlockView): Block | null => {
    const cell = codeCell.get(output.of);
    // Code its author numbered is a listing in the body, so the line names
    // it and the supplement carries no copy (`BO_0303_Q2`).
    const listing = document.listingNumbers?.[output.of];
    const provenance =
      cell === undefined
        ? latexText(`Produced by code no longer in the document, at revision ${revision}.`)
        : listing === undefined
          ? latexText(`Produced by code cell ${cell} at revision ${revision}.`)
          : `Produced by Listing~\\ref{${label("lst", output.of)}} at revision ${revision}.`;
    const picture = output.pictures[0];
    if (picture !== undefined) {
      const extension = FIGURE_TYPES[picture.mediaType];
      if (extension === undefined) {
        context.omitted.push(`An output's picture in ${picture.mediaType}, which TeX does not read.`);
        return null;
      }
      const name = `figure-${output.blockId}.${extension}`;
      files.push({ name, objectId: picture.objectId, mediaType: picture.mediaType });
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
            blocks.push(...remarked(block.blockId, { t: "BlockQuote", c: [{ t: "Para", c: inlines }] }, context));
            break;
          case "abstract":
            abstract.push({ t: "Para", c: inlines });
            break;
          default:
            if (inlines.length > 0) blocks.push(...remarked(block.blockId, { t: "Para", c: inlines }, context));
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
        files.push({ name, objectId: block.objectId, mediaType: block.mediaType ?? "" });
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
      case "sourcecode": {
        // A code block its author numbers prints where it stands, as a
        // listing float holding the coloured code, captioned and labelled
        // (`BO_0303_016`, user decision 2026-09-25); the rest is supplement
        // or left out, below.
        if (document.listingNumbers?.[block.blockId] === undefined) break;
        blocks.push(
          { t: "RawBlock", c: ["latex", "\\begin{listing}[htbp]"] },
          codeBlockOf(block, document),
          { t: "RawBlock", c: ["latex", `${captionOf(block.caption, true, label("lst", block.blockId))}\\end{listing}`] },
        );
        break;
      }
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
    // A numbered listing stands in the body and prints once (`BO_0303_Q2`).
    if (document.listingNumbers?.[block.blockId] !== undefined) continue;
    const what = produced.get(block.blockId);
    const cell = codeCell.get(block.blockId) ?? 0;
    if (what === undefined) {
      context.omitted.push(`Code cell ${cell}, which produced no figure and no table.`);
      continue;
    }
    supplementary.push(
      { t: "RawBlock", c: ["latex", `\\subsection*{Code cell ${cell}${block.language !== undefined ? ` (${latexText(block.language)})` : ""}, producing ${latexText(what.join(" and "))}}`] },
      codeBlockOf(block, document),
    );
  }

  // The glossary (`BO_0301_020`): every keyword the document mentions, once,
  // alphabetically by title, its definition as the entry — a definition list
  // in the AST, so every venue's template carries it without a package the
  // service would have to add — under a heading before the references,
  // which the template sets last. Nothing with nothing mentioned.
  if (glossary.length > 0) {
    const entries = [...glossary].sort((left, right) => left.title.localeCompare(right.title));
    blocks.push({ t: "Header", c: [1, ["glossary", ["unnumbered"], []], words("Glossary")] });
    blocks.push({
      t: "DefinitionList",
      c: entries.map((entry) => [words(entry.title), [entry.definition === null || entry.definition.length === 0 ? [] : [{ t: "Para", c: inlinesOf(entry.definition, context) }]]]),
    });
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

/**
 * Code, as code: a CodeBlock carrying the language as its class, so Pandoc's
 * own highlighter sets it in colour through the macros the venues' templates
 * carry, with shell escape still off; a block with no language is set
 * plainly rather than refused (`BO_0296_020`). Numbered as the document
 * numbers it (`BO_0302_010`): the numberLines class while the document's
 * switch is on, and startFrom where a continued block starts, so the print
 * says what the screen says. The same block in the body, as a listing, and
 * in the supplement (`BO_0303_016`).
 */
function codeBlockOf(block: CodeBlockView, document: DocumentView): Block {
  return {
    t: "CodeBlock",
    c: [
      [
        "",
        [...(block.language === undefined ? [] : [block.language]), ...(showsLineNumbers(document) ? ["numberLines"] : [])],
        showsLineNumbers(document) && (block.firstLine ?? 1) !== 1 ? [["startFrom", String(block.firstLine)]] : [],
      ],
      block.source,
    ],
  };
}

/** A paragraph or quote a sentence refers to, set apart as a numbered,
 * labelled remark — the venues' templates define the environment — so the
 * reference prints as *Remark N* and the reader finds it (`BO_0300_012`);
 * any other block passes through. */
function remarked(blockId: string, block: Block, context: Context): Block[] {
  if (!context.remarks.has(blockId)) return [block];
  return [{ t: "RawBlock", c: ["latex", `\\begin{remark}\\label{${label("par", blockId)}}`] }, block, { t: "RawBlock", c: ["latex", "\\end{remark}"] }];
}

/** A work as CSL-JSON, keyed by its identity, which is the citation's key. */
export function cslOf(workId: string, record: WorkRecord): Record<string, unknown> {
  const { kind, tags: _tags, fetched: _fetched, file: _file, ...rest } = record as unknown as Record<string, unknown> & { kind: string };
  return { id: workId, type: kind, ...rest };
}

export { isText };
