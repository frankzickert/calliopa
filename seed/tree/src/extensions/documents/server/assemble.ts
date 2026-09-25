import { readStanding, type Standing } from "~/extensions/documents/lib/disposition";
import { readFrontMatter, type FrontMatter } from "../lib/front-matter";
import type { CitationStyles } from "~/contract";
import type { Proposer } from "~/extensions/documents/lib/proposals";
import { byOrder, isOrderKey } from "~/lib/order";
import { runsText } from "~/lib/runs";
import type { ReadNode, ReadResult } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { isBlobReference, objectIdOfHash } from "~/server/ccgw/blobs";
import { isTypeset, typeset } from "~/extensions/documents/lib/mathjax";
import { lineCount } from "~/extensions/documents/lib/code-lines";
import { highlightSource } from "~/extensions/documents/lib/highlight";
import { readColumns, readRows, type TableColumn, type TableRow } from "~/extensions/documents/lib/table";
import {
  ACCEPTED_AT_PROPERTY,
  PHASE_PROPERTY,
  SUPERSEDED_BY_PROPERTY,
  isPhase,
  type Phase,
  DOCUMENT_TYPE,
  normalizeRuns,
  TEXT_ROLES,
  type Run,
  type TextRole,
} from "./vocabulary";

/**
 * Turning a CCGW read into an ordered document.
 *
 * Assembly is pure, so ordering, role defaulting, and the treatment of a block
 * type this build does not know are settled without a graph. The read that
 * feeds it lives in `documents.ts`.
 *
 * Identity crosses here once: CCGW names a node `node:<id>` and the shell's
 * API names a document or block by the bare id the shell minted. Every block
 * and document id this module hands out is bare; every id it reads is
 * prefixed. `BO_0207_012`
 */

export const CONTAINS = "CONTAINS";
export const RETIRED = "retired";


interface BlockCommon {
  readonly blockId: string;
  readonly revisionId: string;
  /** The relation placing this block in its document, so a caller closing or
   * moving it does not have to find the relation again. */
  readonly containmentId: string;
  /** The stored order key, or the empty string when the block carries none. */
  readonly order: string;
  /** The data revision the block's current revision landed at, which the
   * reader's mark is compared with (`BO_0246_007`). Absent on a view built
   * without one. */
  readonly revisedAt?: number;
  /** Who made the revision the block carries. BO_0258_016 */
  readonly revisedBy?: string;
}

export interface TextBlockView extends BlockCommon {
  readonly kind: "text";
  readonly role: TextRole;
  readonly runs: readonly Run[];
  /** Each math run's source, set here as the equations are (`BO_0290_015`),
   * keyed by that source. It travels with the block so the line arrives
   * already set and the browser typesets nothing to read it; a source that
   * could not be set is absent, and the run draws as itself. */
  readonly mathSvg?: Readonly<Record<string, string>>;
  /** The standing the reader gave the block; neutral when none is stored. BO_0227_010 */
  readonly standing: Standing;
  /** What the block is in the decision vocabulary — the graph's `kind`
   * property, named apart from the block type here; absent for plain prose.
   * BO_0244_006 */
  readonly blockKind?: string;
  /** The blocks this one was derived from, when a run maintains it: the one
   * cost the document read takes for the body's order and the depth's
   * *Why this matters now*. CA_0046_005 */
  readonly derivedFrom?: readonly string[];
}

export interface DividerBlockView extends BlockCommon {
  readonly kind: "divider";
}

/**
 * A picture or a moving picture (`BO_0273_008`). The bytes are a blob behind
 * CCGW and the block carries only what is needed to draw them: the object id
 * the blob route takes, the reference's own media type — which a video must be
 * retyped with, since retrieval serves every object as an octet stream — and
 * the advisory box the reference does not carry.
 *
 * **`objectId` absent is the pending state**: a generation proposed and not yet
 * paid for is this block with no reference. `source` is whatever made the
 * bytes, stored and never interpreted here; the extension that wrote it draws
 * it (`BO_0273_019`).
 */
export interface MediaBlockView extends BlockCommon {
  readonly kind: "image" | "video";
  readonly objectId?: string;
  readonly mediaType?: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  readonly source?: Record<string, unknown>;
  /** A picture's caption (`BO_0295_006`); a number needs none. */
  readonly caption?: string;
  /** The author's ask for a number, and — when they asked — the number the
   * document's order gives it, figures and tables counted apart
   * (`BO_0295_008`). Resolved on every read, stored nowhere. */
  readonly numbered?: boolean;
  readonly number?: number;
}

/**
 * A block whose stored type or content this build cannot render. It is
 * reported rather than dropped: a document that quietly loses a block on an
 * older deployment is worse than one that says it holds something it cannot
 * show.
 */
export interface UnsupportedBlockView extends BlockCommon {
  readonly kind: "unsupported";
  readonly semanticType: string;
  readonly content: Record<string, unknown>;
}

/**
 * A table (`BO_0287_008`): its typed columns and rows as the block holds them,
 * its caption, and — when a file stands behind it — the object the blob route
 * takes with the file's row count, of which the rows here are the first
 * hundred. `source` is where the data came from, stored and never interpreted
 * here.
 */
export interface TableBlockView extends BlockCommon {
  readonly kind: "table";
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly caption?: string;
  readonly file?: { readonly objectId: string; readonly rowCount: number };
  readonly source?: Record<string, unknown>;
  /** The author's ask for a number, and — when they asked — the number the
   * document's order gives it, figures and tables counted apart
   * (`BO_0295_008`). Resolved on every read, stored nowhere. */
  readonly numbered?: boolean;
  readonly number?: number;
}

/**
 * An equation (`BO_0290_008`): the exact TeX it is set from, its caption, the
 * standing its reader gave it, whether its author asked for a number and — when
 * they did — the `number` the document's order gives it.
 *
 * **The number is resolved on every read and stored nowhere** (`numberEquations`),
 * so an equation inserted above renumbers those below it with no write. `source`
 * is whatever wrote the block, stored and never interpreted here.
 */
export interface EquationBlockView extends BlockCommon {
  readonly kind: "equation";
  readonly tex: string;
  readonly caption?: string;
  readonly standing: Standing;
  readonly numbered?: boolean;
  readonly number?: number;
  /** The equation, typeset here rather than where it is drawn (BO_0290_014).
   * The markup travels in the response, so what arrives already *is* the
   * equation and nothing resizes once the page is live — and MathJax stays
   * out of the browser bundle for reading, since the views import only the
   * types from this module. */
  readonly svg?: string;
  /** Why it could not be set, when it could not: the block draws its source
   * with this sentence, and the engine own error markup never reaches a
   * reader. */
  readonly failure?: string;
  readonly source?: Record<string, unknown>;
}

/**
 * Code (`BO_0289_018`): the source as the block holds it and the language it
 * is written in. Running it is the `code` extension's; this model reads and
 * writes the block.
 */
export interface CodeBlockView extends BlockCommon {
  readonly kind: "sourcecode";
  readonly source: string;
  readonly language?: string;
  /** The source in its language's colours, set here rather than where it is
   * drawn (`BO_0296_014`), as an equation's markup is: it holds only
   * `<span class="hljs-…">` elements and escaped text, so a reader downloads
   * a coloured document and no highlighter. Absent when the block names no
   * language or one the engine does not know, and the view draws the plain
   * characters. */
  readonly markup?: string;
  /** Whether the block's line numbering continues from the nearest code
   * block above it (`BO_0302_004`): content of the block, present only when
   * set. */
  readonly continues?: boolean;
  /** The number of the block's first line (`BO_0302_005`), resolved by the
   * read in reading order — one, or the line after the code block above it
   * when the block continues. Absent on a view built without the pass, and
   * read as one. */
  readonly firstLine?: number;
  /** A listing's caption (`BO_0303_008`); a number needs none. */
  readonly caption?: string;
  /** The author's ask for a listing number, and — when they asked — the
   * number the document's order gives it, counted apart from figures, tables
   * and equations; derived on every read and stored nowhere. */
  readonly numbered?: boolean;
  readonly number?: number;
}

/** One thing an execution streamed, as the output block holds it: text on a
 * stream, an error with its traceback, a display or a result whose bundle
 * names a picture by its index into the block's pictures, a cut. */
export type OutputItem =
  | { readonly kind: "stream"; readonly name: string; readonly text: string }
  | { readonly kind: "error"; readonly name: string; readonly value: string; readonly traceback: readonly string[] }
  | { readonly kind: "display" | "result"; readonly text?: string; readonly html?: string; readonly picture?: number; readonly executionCount?: number }
  | { readonly kind: "cut"; readonly reason: string }
  | { readonly kind: "clear" };

/** A picture an execution showed or a file it wrote: the object the blob
 * route takes, with the name, type and size the reference carries. */
export interface OutputObject {
  readonly objectId: string;
  readonly filename: string;
  readonly mediaType: string;
  readonly size: number;
}

/**
 * What one execution of a code block produced (`BO_0289_018`): proposed after
 * the code block by whoever sent it, never written as truth by the kernel,
 * and read here as the items in order with the pictures and the files they
 * name. `of` is the code block's id; `outcome` is how the execution ended.
 */
export interface OutputBlockView extends BlockCommon {
  readonly kind: "output";
  readonly of: string;
  readonly outcome: string;
  readonly items: readonly OutputItem[];
  readonly pictures: readonly OutputObject[];
  readonly files: readonly OutputObject[];
  readonly elapsed?: number;
  readonly executionCount?: number;
  /** Set by a person after accepting the output (`BO_0295_006`): its first
   * picture is then a figure, counted with the images. */
  readonly caption?: string;
  /** The author's ask for a number, and — when they asked — the number the
   * document's order gives it, figures and tables counted apart
   * (`BO_0295_008`). Resolved on every read, stored nowhere. */
  readonly numbered?: boolean;
  readonly number?: number;
}

export type BlockView =
  | TextBlockView
  | DividerBlockView
  | MediaBlockView
  | TableBlockView
  | EquationBlockView
  | CodeBlockView
  | OutputBlockView
  | UnsupportedBlockView;

export interface DocumentView {
  readonly documentId: string;
  readonly revisionId: string;
  readonly title: string;
  /** The root's phase, absent while proposed (`BO_0249`). */
  readonly phase?: Phase;
  /** The root that superseded this one, with `phase` superseded. */
  readonly supersededBy?: string;
  /** The dataRevision the acceptance was made at, absent for a root that was
   * never accepted: what is accepted is derived from it (`BO_0274_005`). */
  readonly acceptedAt?: number;
  /** The record slot — `profile` for a profile — so the headline paints the
   * minted name the document was given (`BO_0298_014`). */
  readonly record?: string;
  readonly blocks: readonly BlockView[];
  /** The number each numbered equation carries, by block identity, for the
   * whole document: what a reference run is drawn as. Derived on every read
   * and stored nowhere, so it can never be stale (`BO_0290_011`). */
  readonly equationNumbers?: Readonly<Record<string, number>>;
  /** The front matter a manuscript's head projects, as the node carries it.
   * BO_0293_012 */
  readonly frontMatter?: FrontMatter;
  /** The number of every numbered figure and table, by identity. BO_0295_008 */
  readonly figureNumbers?: Readonly<Record<string, number>>;
  readonly tableNumbers?: Readonly<Record<string, number>>;
  /** The number of every numbered code block, a listing, by identity, in a
   * sequence of its own. BO_0303_008 */
  readonly listingNumbers?: Readonly<Record<string, number>>;
  /** What a reference to each referred-to block is drawn as (`BO_0300_010`),
   * by the block's identity: its kind and number, a heading's words, or
   * *Remark N* for a paragraph another sentence refers to; a block outside
   * the reading order has no entry and its reference draws as gone. Derived
   * on every read and stored nowhere. */
  readonly referenceLabels?: Readonly<Record<string, string>>;
  /** The number each paragraph referred to carries as a remark, in reading
   * order among themselves, for the manuscript to set them apart by. */
  readonly remarkNumbers?: Readonly<Record<string, number>>;
  /** The number each cited work carries in this document, by the work's
   * identity, in first-citation order over the reading order: what a
   * citation run is drawn as. Derived on every read and stored nowhere
   * (`BO_0291_013`). */
  readonly citationNumbers?: Readonly<Record<string, number>>;
  /** Each citation's label in the document's style, by `citationKey`, as
   * the bibliography answers it (`BO_0291_030`); absent when nothing
   * answers, and a citation is then drawn as its number. */
  readonly citationLabels?: Readonly<Record<string, string>>;
  /** The document's own citation style, by the style's id, when it chose
   * one; absent, it follows the instance's default. BO_0291_037 */
  readonly citationStyle?: string;
  /** Whether a settled edit of a code block, and an accepted one, is
   * pretty-printed: the document's switch, on unless it was switched off
   * (`BO_0296_013`). Present only as stored, so absent reads as on. */
  readonly formatCode?: boolean;
  /** Whether each line of a code block is numbered: the document's switch,
   * on unless it was switched off (`BO_0302_003`). Present only as stored,
   * so absent reads as on. */
  readonly lineNumbers?: boolean;
  /** The style its citations are drawn in and the styles it may choose, as
   * the citation resolver answers them: present when the document cites
   * anything and a resolver answers. BO_0291_037 */
  readonly citationStyles?: CitationStyles;
  /** The works the document cites that were not at the pin when it was read
   * — retired, or never there — whose citations draw as missing rather than
   * with a stale number (`BO_0291_013`). */
  readonly missingWorks?: readonly string[];
  /** The data revision the document was read at, which the reader's mark
   * records once its derived blocks were in view (`BO_0246_007`). */
  readonly dataRevision?: number;
  /** Present on a document a run started that nobody has taken yet: its node
   * is still a candidate in the run's group, which proposes it. BO_0251_008 */
  readonly proposed?: StartedBy;
}

/** The group a started document is a candidate in, and who proposed it.
 * BO_0251_008 */
export interface StartedBy {
  readonly group: string;
  readonly proposer: Proposer;
}


const orderOf = (content: Record<string, unknown>): string => {
  const order = content["order"];
  return typeof order === "string" && isOrderKey(order) ? order : "";
};

/**
 * One block as the document reads it. Exported because a proposed block is
 * read the same way as a stored one: the surface reviewing an item must not
 * learn a second account of what a block is.
 */
export function toBlock(node: ReadNode, containmentId: string): BlockView {
  const content = contentOf(node);
  const semanticType = typeOf(node);
  const common = {
    blockId: bareId(node.id),
    revisionId: node.revision.id,
    containmentId,
    order: orderOf(content),
    ...(typeof node.revision.dataRevision === "number" ? { revisedAt: node.revision.dataRevision } : {}),
    // Who made the revision the block carries, so a reader of the document
    // can tell a block a run maintains from one a person took as their own
    // without a second read. BO_0258_016
    ...(typeof node.revision.createdBy === "string" && node.revision.createdBy !== "" ? { revisedBy: node.revision.createdBy } : {}),
  };

  if (semanticType === "text") {
    const runs = Array.isArray(content["runs"])
      ? normalizeRuns(content["runs"] as readonly Run[])
      : [];
    const stored = content["role"];
    const role = TEXT_ROLES.includes(stored as TextRole)
      ? (stored as TextRole)
      : "paragraph";
    const standing = readStanding(content["disposition"]);
    const blockKind = content["kind"];
    // The mathematics in the sentence, set once here. BO_0290_015
    const mathSvg: Record<string, string> = {};
    for (const entry of runs) {
      if (entry.math !== true || mathSvg[entry.text] !== undefined) continue;
      const set = typeset(entry.text, false);
      if (isTypeset(set)) mathSvg[entry.text] = set.svg;
    }
    return {
      ...common,
      kind: "text",
      role,
      runs,
      ...(Object.keys(mathSvg).length > 0 ? { mathSvg } : {}),
      standing,
      ...(typeof blockKind === "string" && blockKind !== "" ? { blockKind } : {}),
    };
  }

  if (semanticType === "divider") {
    return { ...common, kind: "divider" };
  }

  if (semanticType === "image" || semanticType === "video") {
    const reference = content["reference"];
    // A reference that is not one is no reference: the block is pending rather
    // than broken, and nothing downstream is handed a hash it cannot resolve.
    const objectId = isBlobReference(reference) ? objectIdOfHash(reference.hash) : null;
    const box = (name: "width" | "height"): number | null => {
      const stored = content[name];
      return typeof stored === "number" && Number.isFinite(stored) && stored > 0 ? stored : null;
    };
    const width = box("width");
    const height = box("height");
    const alt = content["alt"];
    const source = content["source"];
    return {
      ...common,
      kind: semanticType,
      ...(objectId !== null ? { objectId } : {}),
      ...(isBlobReference(reference) && reference.mediaType !== "" ? { mediaType: reference.mediaType } : {}),
      ...(typeof alt === "string" && alt !== "" ? { alt } : {}),
      ...(width !== null ? { width } : {}),
      ...(height !== null ? { height } : {}),
      ...(source !== null && typeof source === "object" && !Array.isArray(source)
        ? { source: source as Record<string, unknown> }
        : {}),
      ...(semanticType === "image" ? captionedOf(content) : {}),
    };
  }

  if (semanticType === "equation") {
    const tex = content["tex"];
    // A stored equation carrying no source is not one: reported, never drawn
    // as an empty box.
    if (typeof tex === "string" && tex.trim() !== "") {
      const caption = content["caption"];
      const source = content["source"];
      const set = typeset(tex, true);
      return {
        ...common,
        kind: "equation",
        tex,
        standing: readStanding(content["disposition"]),
        ...(isTypeset(set) ? { svg: set.svg } : { failure: set.failure }),
        ...(typeof caption === "string" && caption !== "" ? { caption } : {}),
        ...(content["numbered"] === true ? { numbered: true } : {}),
        ...(source !== null && typeof source === "object" && !Array.isArray(source)
          ? { source: source as Record<string, unknown> }
          : {}),
      };
    }
  }

  if (semanticType === "table") {
    const columns = readColumns(content["columns"]);
    const rows = readRows(content["rows"]);
    // A stored table this build cannot read as one is reported, not dropped.
    if ("columns" in columns && "rows" in rows) {
      const reference = content["reference"];
      const objectId = isBlobReference(reference) ? objectIdOfHash(reference.hash) : null;
      const rowCount = content["rowCount"];
      const caption = content["caption"];
      const source = content["source"];
      return {
        ...common,
        kind: "table",
        columns: columns.columns,
        rows: rows.rows,
        ...(typeof caption === "string" && caption !== "" ? { caption } : {}),
        ...(objectId !== null
          ? { file: { objectId, rowCount: typeof rowCount === "number" && rowCount >= 0 ? rowCount : rows.rows.length } }
          : {}),
        ...(content["numbered"] === true ? { numbered: true } : {}),
        ...(source !== null && typeof source === "object" && !Array.isArray(source)
          ? { source: source as Record<string, unknown> }
          : {}),
      };
    }
  }

  if (semanticType === "sourcecode" && typeof content["source"] === "string") {
    const language = content["language"];
    const named = typeof language === "string" && language !== "" ? language : undefined;
    const markup = named === undefined ? null : highlightSource(content["source"], named);
    return {
      ...common,
      kind: "sourcecode",
      source: content["source"],
      ...(named === undefined ? {} : { language: named }),
      ...(markup === null ? {} : { markup }),
      ...(content["continues"] === true ? { continues: true } : {}),
      ...captionedOf(content),
    };
  }

  if (semanticType === "output" && Array.isArray(content["items"])) {
    const pictures = readOutputObjects(content["pictures"], "figure");
    const files = readOutputObjects(content["files"], "file");
    const outcome = content["outcome"];
    const of = content["of"];
    const elapsed = content["elapsed"];
    const executionCount = content["executionCount"];
    return {
      ...common,
      kind: "output",
      of: typeof of === "string" ? of : "",
      outcome: typeof outcome === "string" ? outcome : "",
      items: (content["items"] as readonly unknown[]).flatMap((item) => readOutputItem(item)),
      pictures,
      files,
      ...(typeof elapsed === "number" ? { elapsed } : {}),
      ...(typeof executionCount === "number" ? { executionCount } : {}),
      ...captionedOf(content),
    };
  }

  return {
    ...common,
    kind: "unsupported",
    semanticType,
    content,
  };
}

/** A picture's or an output's caption and number ask, as a read answers
 * them: an empty caption is no caption. `BO_0295_006` */
const captionedOf = (
  content: Record<string, unknown>,
): { caption?: string; numbered?: true } => {
  const caption = content["caption"];
  return {
    ...(typeof caption === "string" && caption !== "" ? { caption } : {}),
    ...(content["numbered"] === true ? { numbered: true as const } : {}),
  };
};

/** The blob references an output hoists, each as the object the blob route
 * takes; one that is not a reference is left out rather than drawn broken. */
const readOutputObjects = (value: unknown, fallback: string): OutputObject[] =>
  Array.isArray(value)
    ? value.flatMap((entry, index) => {
        if (!isBlobReference(entry)) return [];
        const objectId = objectIdOfHash(entry.hash);
        if (objectId === null) return [];
        const named = (entry as { filename?: unknown }).filename;
        return [
          {
            objectId,
            filename: typeof named === "string" && named !== "" ? named : `${fallback}-${index + 1}`,
            mediaType: entry.mediaType,
            size: entry.size,
          },
        ];
      })
    : [];

/** One stored item as the view reads it: a display or result keeps its plain
 * text, its HTML as text, and the index of its picture; the bytes are never
 * in the block. */
const readOutputItem = (value: unknown): OutputItem[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  const kind = item["kind"];
  if (kind === "stream") {
    return [{ kind, name: typeof item["name"] === "string" ? item["name"] : "stdout", text: typeof item["text"] === "string" ? item["text"] : "" }];
  }
  if (kind === "error") {
    const traceback = Array.isArray(item["traceback"]) ? item["traceback"].filter((line): line is string => typeof line === "string") : [];
    return [{ kind, name: String(item["name"] ?? ""), value: String(item["value"] ?? ""), traceback }];
  }
  if (kind === "display" || kind === "result") {
    const data = item["data"];
    const bundle = data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    let picture: number | undefined;
    for (const [mime, entry] of Object.entries(bundle)) {
      if (!mime.startsWith("image/") || entry === null || typeof entry !== "object") continue;
      const index = (entry as { picture?: unknown }).picture;
      if (typeof index === "number") picture = index;
    }
    const text = bundle["text/plain"];
    const html = bundle["text/html"];
    const count = item["executionCount"];
    return [
      {
        kind,
        ...(typeof text === "string" ? { text } : {}),
        ...(typeof html === "string" ? { html } : {}),
        ...(picture !== undefined ? { picture } : {}),
        ...(typeof count === "number" ? { executionCount: count } : {}),
      },
    ];
  }
  if (kind === "cut") return [{ kind, reason: String(item["reason"] ?? "") }];
  if (kind === "clear") return [{ kind }];
  return [];
};

/**
 * The blocks a relation type attaches to a document, in deterministic order.
 *
 * Blocks carrying a usable order key come first in key order. A block with no
 * usable key — which only a future or malformed block type produces — sorts
 * after them by identity, so it stays visible and lands in the same place on
 * every read. Only active relations place a block: a closed containment is
 * history the read may still carry.
 */
export function blocksOf(
  graph: ReadResult,
  documentId: string,
  relationType: string,
): BlockView[] {
  const documentNode = nodeRef(documentId);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const blocks: BlockView[] = [];

  for (const relation of graph.relations) {
    if (relation.type !== relationType) continue;
    if (relation.fromNodeId !== documentNode) continue;
    if (relation.validity.status !== "active") continue;
    if (relation.to.kind !== "node" || relation.to.nodeId === undefined) continue;
    const node = nodes.get(relation.to.nodeId);
    if (node === undefined) continue;
    blocks.push(toBlock(node, relation.id));
  }

  const ordered = blocks.filter((block) => block.order !== "");
  const unplaced = blocks
    .filter((block) => block.order === "")
    .sort((left, right) => (left.blockId < right.blockId ? -1 : 1));
  return [...byOrder(ordered), ...unplaced];
}

/** The document node of a read rooted at it, or undefined. */
export function documentNodeOf(
  graph: ReadResult,
  documentId: string,
): ReadNode | undefined {
  const id = nodeRef(documentId);
  // A read through a branch answers the document as the branch's candidate
  // of it — the carry-forward anchor its inserts hang on — and through a
  // rejected branch as that candidate rejected: both are the document in
  // that view. A truth read answers established revisions alone, so
  // neither reaches it, and an archived node never counts. BO_0250_011
  return graph.nodes.find(
    (candidate) =>
      candidate.id === id &&
      typeOf(candidate) === DOCUMENT_TYPE &&
      candidate.revision.status !== "archived",
  );
}

/** The document at the root of this graph, with its blocks in order, or null
 * when the graph holds no such document. */
/**
 * The numbers no one stores (`BO_0290_010`), and the number every reference
 * run answers (`BO_0290_011`).
 *
 * The numbered equations of the reading order are numbered from one, in that
 * order: an equation that asked for none takes none and consumes none, and
 * neither does a discarded one, since it is not in the order a reader reads.
 * Inserting, retiring or restoring an equation therefore renumbers the rest by
 * itself — there is no renumbering write, no migration, and no number stored
 * anywhere to go stale.
 *
 * A reference whose equation is gone from the reading order, is discarded or
 * carries no number resolves to nothing, and the surface says its equation is
 * gone rather than drawing a stale number.
 */
export function numberEquations(blocks: readonly BlockView[]): {
  readonly blocks: BlockView[];
  readonly numbers: Readonly<Record<string, number>>;
} {
  const numbers: Record<string, number> = {};
  let next = 1;
  const numbered = blocks.map((block) => {
    if (block.kind !== "equation") return block;
    if (block.numbered !== true || block.standing === "discarded") return block;
    const number = next;
    next += 1;
    numbers[block.blockId] = number;
    return { ...block, number };
  });
  return { blocks: numbered, numbers };
}

/**
 * The figures' and the tables' numbers (`BO_0295_008`), by `numberEquations`'
 * rule: the numbered ones of the reading order from one, figures — pictures
 * and the outputs a person numbered — in one sequence and tables in another,
 * a block that asked for none taking none and consuming none. A retired block
 * never reaches this view, and neither kind carries a standing to discard it
 * by, so nothing else is skipped. A reference whose block is gone or carries
 * no number resolves to nothing and draws as missing.
 */
export function numberFiguresAndTables(blocks: readonly BlockView[]): {
  readonly blocks: BlockView[];
  readonly figures: Readonly<Record<string, number>>;
  readonly tables: Readonly<Record<string, number>>;
  /** The listings: the code blocks that ask, a sequence of their own. BO_0303_008 */
  readonly listings: Readonly<Record<string, number>>;
} {
  const figures: Record<string, number> = {};
  const tables: Record<string, number> = {};
  const listings: Record<string, number> = {};
  let nextFigure = 1;
  let nextTable = 1;
  let nextListing = 1;
  const numbered = blocks.map((block): BlockView => {
    if (block.kind === "table") {
      if (block.numbered !== true) return block;
      tables[block.blockId] = nextTable;
      return { ...block, number: nextTable++ };
    }
    if (block.kind === "image" || block.kind === "output") {
      if (block.numbered !== true) return block;
      figures[block.blockId] = nextFigure;
      return { ...block, number: nextFigure++ };
    }
    if (block.kind === "sourcecode") {
      if (block.numbered !== true) return block;
      listings[block.blockId] = nextListing;
      return { ...block, number: nextListing++ };
    }
    return block;
  });
  return { blocks: numbered, figures, tables, listings };
}

/** The roles a heading reference is drawn by its words for, and the roles a
 * referred-to block becomes a remark for (`BO_0300_Q1`). */
const HEADING_ROLES: readonly string[] = ["h1", "h2", "h3"];
const PROSE_ROLES: readonly string[] = ["paragraph", "quote"];

/** Whether a block is in the order a reader reads: not discarded and not a
 * prompt. A retired block never reaches this view. */
const inReadingOrder = (block: BlockView): boolean => !("standing" in block) || (block.standing !== "discarded" && block.standing !== "prompt");

/**
 * What every reference is drawn as (`BO_0300_010`), after the numbering: for
 * each block a `blockRef` of the reading order names — and each the three
 * older keys name — its label: `Figure 3`, `Table 1` or `(2)` when it is a
 * numbered figure, table or equation; a heading's words; `Remark N` for a
 * paragraph or a quote, the referred-to ones numbered in reading order among
 * themselves, as the manuscript sets them apart (user decision, 2026-09-25).
 * A numbered code block is `Listing N` (`BO_0303_008`). A block outside the
 * reading order, an unnumbered float, equation or code block, an abstract
 * and any other kind take no label, so a reference to one draws as gone,
 * never as a stale label.
 */
export function labelReferences(
  blocks: readonly BlockView[],
  numbers: {
    readonly equations: Readonly<Record<string, number>>;
    readonly figures: Readonly<Record<string, number>>;
    readonly tables: Readonly<Record<string, number>>;
    readonly listings?: Readonly<Record<string, number>>;
  },
): { readonly labels: Readonly<Record<string, string>>; readonly remarks: Readonly<Record<string, number>> } {
  const reading = blocks.filter(inReadingOrder);
  const targets = new Set<string>();
  for (const block of reading) {
    if (block.kind !== "text") continue;
    for (const run of block.runs) {
      for (const target of [run.blockRef, run.figureRef, run.tableRef, run.equationRef]) if (target !== undefined) targets.add(target);
    }
  }
  const remarks: Record<string, number> = {};
  let nextRemark = 1;
  for (const block of reading) {
    if (block.kind === "text" && PROSE_ROLES.includes(block.role) && targets.has(block.blockId)) remarks[block.blockId] = nextRemark++;
  }
  const labels: Record<string, string> = {};
  for (const target of targets) {
    const block = reading.find((candidate) => candidate.blockId === target);
    if (block === undefined) continue;
    let label: string | undefined;
    switch (block.kind) {
      case "text":
        if (HEADING_ROLES.includes(block.role)) label = runsText(block.runs).trim() || "Section";
        else if (remarks[block.blockId] !== undefined) label = `Remark ${remarks[block.blockId]}`;
        break;
      case "equation":
        label = numbers.equations[block.blockId] === undefined ? undefined : `(${numbers.equations[block.blockId]})`;
        break;
      case "image":
      case "output":
        label = numbers.figures[block.blockId] === undefined ? undefined : `Figure ${numbers.figures[block.blockId]}`;
        break;
      case "table":
        label = numbers.tables[block.blockId] === undefined ? undefined : `Table ${numbers.tables[block.blockId]}`;
        break;
      case "sourcecode":
        label = numbers.listings?.[block.blockId] === undefined ? undefined : `Listing ${numbers.listings[block.blockId]}`;
        break;
      default:
        break;
    }
    if (label !== undefined) labels[target] = label;
  }
  return { labels, remarks };
}

/**
 * Where each code block's numbering starts (`BO_0302_005`), resolved in
 * reading order and stored nowhere: a block that does not continue starts at
 * one; a block that continues starts after the last line of the nearest code
 * block above it, whatever stands between them and whatever its language; a
 * chain of continuing blocks counts on; a continuing block with no code block
 * above it starts at one. So a block removed or moved re-numbers the ones
 * below on the next read, and nothing but the flag is ever written.
 */
export function numberCodeLines(blocks: readonly BlockView[]): BlockView[] {
  let nextLine = 1;
  return blocks.map((block): BlockView => {
    if (block.kind !== "sourcecode") return block;
    const firstLine = block.continues === true ? nextLine : 1;
    nextLine = firstLine + lineCount(block.source);
    return { ...block, firstLine };
  });
}

/**
 * Where a code block not yet in the reading would start (`BO_0302_005`): a
 * proposed block takes its number from the reading it would join, the code
 * block above its place — the nearest established code block whose order
 * sorts before the proposed block's — and starts at one when it does not
 * continue or nothing stands above it.
 */
export function placeCodeLines(block: BlockView, established: readonly BlockView[]): BlockView {
  if (block.kind !== "sourcecode") return block;
  if (block.continues !== true) return { ...block, firstLine: 1 };
  // The established blocks in reading order, the proposed one among them
  // by its order key; what stands above it is what sorts before it.
  const placed = byOrder([...established, block]);
  const at = placed.indexOf(block);
  const above = placed.slice(0, at).filter((other): other is CodeBlockView => other.kind === "sourcecode");
  const nearest = above.length === 0 ? undefined : above[above.length - 1];
  return { ...block, firstLine: nearest === undefined ? 1 : (nearest.firstLine ?? 1) + lineCount(nearest.source) };
}

/**
 * The citations' numbers (`BO_0291_013`): the works the reading order cites,
 * numbered from one in the order of their first citation, a work cited twice
 * keeping its number. A discarded block's citations take no number and consume
 * none, since it is not in the order a reader reads; a retired block never
 * reaches this view. A citation names a node the document does not contain,
 * so `known` says which cited works the read found at the pin: a work not
 * among them is answered as missing and takes no number, never a stale one.
 * With `known` absent nothing was looked up and every cited work is numbered.
 */
export function numberCitations(
  blocks: readonly BlockView[],
  known?: ReadonlySet<string>,
): {
  readonly numbers: Readonly<Record<string, number>>;
  readonly missing: readonly string[];
} {
  const numbers: Record<string, number> = {};
  const missing: string[] = [];
  let next = 1;
  for (const block of blocks) {
    if (block.kind !== "text") continue;
    for (const run of block.runs) {
      const work = run.cite?.work;
      if (work === undefined) continue;
      if (known !== undefined && !known.has(work)) {
        if (!missing.includes(work)) missing.push(work);
        continue;
      }
      if (block.standing === "discarded" || numbers[work] !== undefined) continue;
      numbers[work] = next;
      next += 1;
    }
  }
  return { numbers, missing };
}

/** The node's front matter when it carries any and it reads as such; a value
 * that does not is left out of the read rather than drawn wrong. BO_0293_012 */
/** The document property naming its citation style. BO_0291_037 */
export const CITATION_STYLE_PROPERTY = "citationStyle";
/** The document property holding its formatting switch. BO_0296_013 */
export const FORMAT_CODE_PROPERTY = "formatCode";
/** Whether the document formats code: on unless the switch is stored off. */
export const formatsCode = (document: { readonly formatCode?: boolean }): boolean => document.formatCode !== false;
/** The document property holding its line-number switch. BO_0302_003 */
export const LINE_NUMBERS_PROPERTY = "lineNumbers";
/** Whether the document numbers the lines of its code: on unless the switch is stored off. */
export const showsLineNumbers = (document: { readonly lineNumbers?: boolean }): boolean => document.lineNumbers !== false;

const frontMatterOf = (content: Record<string, unknown>): { frontMatter?: FrontMatter } => {
  const read = readFrontMatter(content);
  if ("failure" in read || Object.keys(read.frontMatter).length === 0) return {};
  return { frontMatter: read.frontMatter };
};

export function assembleDocument(
  graph: ReadResult,
  documentId: string,
  options: { readonly knownWorks?: ReadonlySet<string> } = {},
): DocumentView | null {
  const node = documentNodeOf(graph, documentId);
  if (node === undefined) return null;

  const content = contentOf(node);
  const title = content["title"];
  const phase = content[PHASE_PROPERTY];
  const supersededBy = content[SUPERSEDED_BY_PROPERTY];
  const acceptedAt = content[ACCEPTED_AT_PROPERTY];
  const equations = numberEquations(blocksOf(graph, documentId, CONTAINS));
  const figures = numberFiguresAndTables(equations.blocks);
  const code = numberCodeLines(figures.blocks);
  const citations = numberCitations(code, options.knownWorks);
  const references = labelReferences(code, { equations: equations.numbers, figures: figures.figures, tables: figures.tables, listings: figures.listings });
  return {
    documentId: bareId(node.id),
    revisionId: node.revision.id,
    title: typeof title === "string" ? title : "",
    ...(isPhase(phase) && phase !== "proposed" ? { phase } : {}),
    ...(typeof supersededBy === "string" && supersededBy !== "" ? { supersededBy } : {}),
    ...(typeof acceptedAt === "number" ? { acceptedAt } : {}),
    ...(typeof content["record"] === "string" && content["record"] !== "" ? { record: content["record"] as string } : {}),
    ...frontMatterOf(content),
    ...(typeof content[CITATION_STYLE_PROPERTY] === "string" && content[CITATION_STYLE_PROPERTY] !== "" ? { citationStyle: content[CITATION_STYLE_PROPERTY] as string } : {}),
    ...(typeof content[FORMAT_CODE_PROPERTY] === "boolean" ? { formatCode: content[FORMAT_CODE_PROPERTY] as boolean } : {}),
    ...(typeof content[LINE_NUMBERS_PROPERTY] === "boolean" ? { lineNumbers: content[LINE_NUMBERS_PROPERTY] as boolean } : {}),
    blocks: code,
    // The numbers a reference run is drawn as, for the whole document: a
    // reference names an equation of its own document and nothing else.
    // BO_0290_011
    ...(Object.keys(equations.numbers).length > 0 ? { equationNumbers: equations.numbers } : {}),
    // The numbers a figure or a table reference is drawn as. BO_0295_008
    ...(Object.keys(figures.figures).length > 0 ? { figureNumbers: figures.figures } : {}),
    ...(Object.keys(figures.tables).length > 0 ? { tableNumbers: figures.tables } : {}),
    // The numbers a listing reference is drawn as. BO_0303_008
    ...(Object.keys(figures.listings).length > 0 ? { listingNumbers: figures.listings } : {}),
    // What a reference to any block is drawn as, and which paragraphs are
    // remarks for being referred to. BO_0300_010
    ...(Object.keys(references.labels).length > 0 ? { referenceLabels: references.labels } : {}),
    ...(Object.keys(references.remarks).length > 0 ? { remarkNumbers: references.remarks } : {}),
    // The numbers a citation run is drawn as, and the works it cannot be:
    // resolved here so every view answers the same number. BO_0291_013
    ...(Object.keys(citations.numbers).length > 0 ? { citationNumbers: citations.numbers } : {}),
    ...(citations.missing.length > 0 ? { missingWorks: citations.missing } : {}),
    ...(graph.resolvedDataRevision > 0 ? { dataRevision: graph.resolvedDataRevision } : {}),
  };
}

/** The blocks retired from this document, in the order they last held. */
export function assembleRetired(
  graph: ReadResult,
  documentId: string,
): BlockView[] {
  return blocksOf(graph, documentId, RETIRED);
}
