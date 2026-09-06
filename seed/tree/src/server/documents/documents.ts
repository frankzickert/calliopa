import type postgres from "postgres";
import type { JSONValue } from "postgres";

import type { DocumentSummary } from "../../lib/library";
import { orderBetween } from "../../lib/order";
import { readChangeSummary } from "../graph/changes";
import type {
  AnsweredItem,
  AssembledGraph,
  ChangeSummary,
  GraphActor,
  GraphMutationResult,
  GraphNodeView,
  GraphOperation,
  GraphOutcome,
  NonEmpty,
  ProposalAnswer,
  ProposalItemRequest,
  ProposalItemView,
  StagedProposal,
} from "../graph/contract";
import { mutateGraph } from "../graph/mutate";
import {
  answerProposalItem,
  listOpenProposalGroups,
  readProposalGroup,
  stageProposal,
} from "../graph/proposals";
import { readGraph } from "../graph/read";
import { resolveRoots } from "../graph/roots";
import { calliopaGraphSchema } from "../graph/schema";
import { asContent, asRecord } from "./content";
import {
  assembleDocument,
  assembleRetired,
  toBlock,
  type BlockView,
  type DocumentView,
} from "./assemble";
import {
  DOCUMENT_TYPE,
  normalizeRuns,
  splitRuns,
  type Run,
  type TextRole,
} from "./vocabulary";

/**
 * The document and block operations the editor works through.
 *
 * Every read is rooted at a document and bounded, and every structural gesture
 * compiles into one gateway mutation, so a refusal leaves the document exactly
 * as it was. Nothing here reaches the graph tables; the gateway is the only
 * way in.
 */

const actor = { kind: "application" } as const;

/**
 * Blocks hang directly off their document. The first container block type
 * raises this, and the read that walks it is already written in terms of
 * relations rather than one level.
 */
const CONTAINMENT_DEPTH = 1;

/** Where a block goes among its siblings. */
export type Placement =
  | { readonly at: "start" }
  | { readonly at: "end" }
  | { readonly before: string }
  | { readonly after: string };

/** A slice of a document's blocks. Bounds name blocks and are exclusive. */
export interface DocumentRange {
  readonly after?: string;
  readonly before?: string;
  readonly limit?: number;
}

export interface NewTextBlock {
  readonly kind: "text";
  readonly runs?: readonly Run[];
  readonly role?: TextRole;
}

export interface NewDividerBlock {
  readonly kind: "divider";
}

export type NewBlock = NewTextBlock | NewDividerBlock;

export interface CreatedDocument {
  readonly documentId: string;
  readonly blockId: string;
  readonly dataRevision: string;
}

/** A write onto the document node itself, answering the revision it
 * established so a caller may write again without reading the document back. */
export interface WrittenDocument {
  readonly documentId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

export interface WrittenBlock {
  readonly blockId: string;
  /** The revision this write established, which is the base the next write of
   * this block names. Returning it is what lets an editor save twice without
   * reading the document back in between. */
  readonly revisionId: string;
  readonly dataRevision: string;
}

export interface SplitBlocks {
  readonly blockId: string;
  readonly revisionId: string;
  readonly tailBlockId: string;
  readonly dataRevision: string;
}

function refuse<T>(rule: string, detail: string): GraphOutcome<T> {
  return {
    outcome: "validationFailure",
    failures: [{ operation: null, rule, detail }],
  };
}

/** A node's stored content as a record, so an operation can rewrite one
 * property and leave everything else it does not model untouched. */
function contentOf(graph: AssembledGraph, nodeId: string): Record<string, unknown> {
  const node = graph.nodes.find((candidate) => candidate.nodeId === nodeId);
  const content = node === undefined ? null : asRecord(node.content);
  return content === null ? {} : { ...content };
}

function nodeOf(graph: AssembledGraph, nodeId: string): GraphNodeView | undefined {
  return graph.nodes.find((candidate) => candidate.nodeId === nodeId);
}

const blockContent = (block: NewBlock, order: string): JSONValue =>
  asContent(
    block.kind === "divider"
      ? { order }
      : {
          order,
          runs: normalizeRuns(block.runs ?? []),
          ...(block.role !== undefined && block.role !== "paragraph"
            ? { role: block.role }
            : {}),
        },
  );

const blockType = (block: NewBlock): string => block.kind;

/**
 * Reads a document and the graph it came from. Callers that only need the
 * ordered document use `readDocument`; the operations need the raw graph too,
 * so a revision can preserve content this build does not model.
 */
async function loadDocument(
  db: postgres.Sql,
  documentId: string,
  relationType: "contains" | "retired" = "contains",
): Promise<
  | { readonly ok: true; readonly graph: AssembledGraph; readonly document: DocumentView }
  | { readonly ok: false; readonly outcome: GraphOutcome<never> }
> {
  const outcome = await readGraph(db, {
    roots: [documentId],
    traverse: [
      {
        direction: "outgoing",
        depth: CONTAINMENT_DEPTH,
        relationTypes: [relationType],
      },
    ],
  });
  if (outcome.outcome !== "success") {
    return { ok: false, outcome: outcome as GraphOutcome<never> };
  }
  const document = assembleDocument(outcome.result, documentId);
  if (document === null) {
    return {
      ok: false,
      outcome: {
        outcome: "noResult",
        detail: `No document ${documentId} in this graph.`,
      },
    };
  }
  return { ok: true, graph: outcome.result, document };
}

/** The blocks that carry a usable order key, which are the ones a placement
 * can be computed against. */
const placeable = (blocks: readonly BlockView[]): BlockView[] =>
  blocks.filter((block) => block.order !== "");

/**
 * The order key a placement asks for, or a refusal when it names a block that
 * is not among these siblings.
 *
 * A block being moved stays in this list. Its own key can only ever bound the
 * side it already sits on, so the key minted against it still lands the block
 * where the caller asked; leaving it out would change the key and not the
 * order.
 */
function orderFor(
  blocks: readonly BlockView[],
  placement: Placement,
): { readonly order: string } | { readonly failure: GraphOutcome<never> } {
  const siblings = placeable(blocks);

  if ("at" in placement) {
    const first = siblings[0]?.order ?? "";
    const last = siblings[siblings.length - 1]?.order ?? "";
    return {
      order:
        placement.at === "start"
          ? orderBetween("", first)
          : orderBetween(last, ""),
    };
  }

  const anchorId = "before" in placement ? placement.before : placement.after;
  const index = siblings.findIndex((block) => block.blockId === anchorId);
  if (index < 0) {
    return {
      failure: refuse(
        "unknownAnchor",
        `Block ${anchorId} is not a placeable block of this document.`,
      ),
    };
  }
  const anchor = siblings[index] as BlockView;
  if ("before" in placement) {
    return {
      order: orderBetween(siblings[index - 1]?.order ?? "", anchor.order),
    };
  }
  return {
    order: orderBetween(anchor.order, siblings[index + 1]?.order ?? ""),
  };
}

async function commit<T>(
  db: postgres.Sql,
  operations: NonEmpty<GraphOperation>,
  result: (written: GraphMutationResult) => T,
): Promise<GraphOutcome<T>> {
  const outcome = await mutateGraph(
    db,
    calliopaGraphSchema,
    { operations },
    actor,
  );
  if (outcome.outcome !== "success") return outcome as GraphOutcome<T>;
  return { outcome: "success", result: result(outcome.result) };
}

/** The revision a mutation established for one node. */
const revisionOf = (written: GraphMutationResult, nodeId: string): string =>
  written.nodes.find((node) => node.nodeId === nodeId)?.revisionId ?? "";

/**
 * Creates a document and its first block as one mutation, so a document never
 * exists without somewhere to type.
 */
export async function createDocument(
  db: postgres.Sql,
  input: { readonly title: string; readonly block?: NewBlock },
): Promise<GraphOutcome<CreatedDocument>> {
  const block = input.block ?? { kind: "text" as const };
  const operations: NonEmpty<GraphOperation> = [
    {
      op: "createNode",
      ref: "document",
      semanticType: DOCUMENT_TYPE,
      content: { title: input.title },
    },
    {
      op: "createNode",
      ref: "block",
      semanticType: blockType(block),
      content: blockContent(block, orderBetween("", "")),
    },
    {
      op: "createRelation",
      relationType: "contains",
      from: { kind: "ref", ref: "document" },
      to: { kind: "node", node: { kind: "ref", ref: "block" } },
    },
  ];

  const outcome = await mutateGraph(
    db,
    calliopaGraphSchema,
    { operations },
    actor,
  );
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<CreatedDocument>;
  }
  const written = new Map(
    outcome.result.nodes.map((node) => [node.ref, node.nodeId]),
  );
  return {
    outcome: "success",
    result: {
      documentId: written.get("document") as string,
      blockId: written.get("block") as string,
      dataRevision: outcome.result.dataRevision,
    },
  };
}

/**
 * Titles compare case-insensitively by code unit, not by locale. Locale
 * collation answers differently on different runtimes, and this order is read
 * back by tests and by two form factors that must agree.
 */
const byTitle = (left: DocumentSummary, right: DocumentSummary): number => {
  const a = left.title.toLowerCase();
  const b = right.title.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The documents no document contains, each with its title.
 *
 * A `document` is never the target of `contains` today, so the parentless
 * filter currently keeps every document. It is written as the rule so nesting
 * documents later narrows this listing rather than rewriting it.
 *
 * Roots come from the gateway in creation order and the sort is stable, so two
 * documents sharing a title keep the order they were created in rather than
 * swapping places between reads. Titles are read without assembling any
 * document's blocks: the library renders names, not content.
 */
export async function listDocuments(
  db: postgres.Sql,
): Promise<GraphOutcome<readonly DocumentSummary[]>> {
  const resolved = await resolveRoots(db, { semanticType: DOCUMENT_TYPE });
  if (resolved.outcome !== "success") {
    return resolved as GraphOutcome<readonly DocumentSummary[]>;
  }

  const [first, ...rest] = resolved.result.nodeIds;
  if (first === undefined) return { outcome: "success", result: [] };
  const roots: NonEmpty<string> = [first, ...rest];

  const outcome = await readGraph(db, {
    roots,
    traverse: [
      {
        direction: "incoming",
        depth: CONTAINMENT_DEPTH,
        relationTypes: ["contains"],
      },
    ],
  });
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<readonly DocumentSummary[]>;
  }

  const contained = new Set(
    outcome.result.relations
      .filter(
        (relation) =>
          relation.relationType === "contains" &&
          relation.validity.status === "active" &&
          relation.target.kind === "node",
      )
      .map((relation) =>
        relation.target.kind === "node" ? relation.target.nodeId : "",
      ),
  );

  const summaries: DocumentSummary[] = [];
  for (const documentId of resolved.result.nodeIds) {
    if (contained.has(documentId)) continue;
    const node = nodeOf(outcome.result, documentId);
    if (node === undefined || node.semanticType !== DOCUMENT_TYPE) continue;
    const title = asRecord(node.content)?.["title"];
    summaries.push({
      documentId,
      title: typeof title === "string" ? title : "",
    });
  }

  return { outcome: "success", result: summaries.sort(byTitle) };
}

/**
 * The ordered document, optionally narrowed to a range of its blocks. Bounds
 * name blocks and are exclusive, so a caller reading what follows a block does
 * not have to drop the first result.
 */
export async function readDocument(
  db: postgres.Sql,
  documentId: string,
  range?: DocumentRange,
): Promise<GraphOutcome<DocumentView>> {
  const loaded = await loadDocument(db, documentId);
  if (!loaded.ok) return loaded.outcome;
  if (range === undefined) {
    return { outcome: "success", result: loaded.document };
  }

  const blocks = loaded.document.blocks;
  let start = 0;
  let end = blocks.length;

  if (range.after !== undefined) {
    const index = blocks.findIndex((block) => block.blockId === range.after);
    if (index < 0) {
      return refuse("unknownAnchor", `Block ${range.after} is not in this document.`);
    }
    start = index + 1;
  }
  if (range.before !== undefined) {
    const index = blocks.findIndex((block) => block.blockId === range.before);
    if (index < 0) {
      return refuse("unknownAnchor", `Block ${range.before} is not in this document.`);
    }
    end = Math.max(start, index);
  }
  if (range.limit !== undefined) {
    if (!Number.isInteger(range.limit) || range.limit < 1) {
      return refuse("limit", "A range reads at least one block.");
    }
    end = Math.min(end, start + range.limit);
  }

  return {
    outcome: "success",
    result: { ...loaded.document, blocks: blocks.slice(start, end) },
  };
}

/**
 * Retitles a document. The title is the document node's own content, so this
 * revises the document rather than any block, and the blocks are untouched.
 *
 * Content the build does not model is preserved, the same as any block
 * revision, and a stale base is a conflict rather than a silent overwrite.
 */
export async function renameDocument(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly baseRevisionId: string;
    readonly title: string;
  },
): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const content = contentOf(loaded.graph, input.documentId);
  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.documentId,
        baseRevisionId: input.baseRevisionId,
        semanticType: DOCUMENT_TYPE,
        content: asContent({ ...content, title: input.title }),
      },
    ],
    (written) => ({
      documentId: input.documentId,
      revisionId: revisionOf(written, input.documentId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * One block of a document with everything it contains. A block holds no
 * children until a container block type exists, so today this is the block
 * itself, read without pulling in its siblings.
 */
export async function readBlock(
  db: postgres.Sql,
  documentId: string,
  blockId: string,
): Promise<GraphOutcome<BlockView>> {
  const loaded = await loadDocument(db, documentId);
  if (!loaded.ok) return loaded.outcome;
  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === blockId,
  );
  if (block === undefined) {
    return {
      outcome: "noResult",
      detail: `Block ${blockId} is not in document ${documentId}.`,
    };
  }
  return { outcome: "success", result: block };
}

/** Inserts a new block at a placement among its siblings. */
export async function insertBlock(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly block: NewBlock;
    readonly placement: Placement;
  },
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  const outcome = await mutateGraph(
    db,
    calliopaGraphSchema,
    {
      operations: [
        {
          op: "createNode",
          ref: "block",
          semanticType: blockType(input.block),
          content: blockContent(input.block, order.order),
        },
        {
          op: "createRelation",
          relationType: "contains",
          from: { kind: "id", nodeId: input.documentId },
          to: { kind: "node", node: { kind: "ref", ref: "block" } },
        },
      ],
    },
    actor,
  );
  if (outcome.outcome !== "success") return outcome as GraphOutcome<WrittenBlock>;

  const written = outcome.result.nodes.find((node) => node.ref === "block");
  return {
    outcome: "success",
    result: {
      blockId: written?.nodeId as string,
      revisionId: written?.revisionId as string,
      dataRevision: outcome.result.dataRevision,
    },
  };
}

/** Revises a text block's runs and role, keeping its identity and position. */
export async function reviseTextBlock(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly blockId: string;
    readonly baseRevisionId: string;
    readonly runs: readonly Run[];
    readonly role?: TextRole;
  },
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (block === undefined) {
    return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  }
  if (block.kind !== "text") {
    return refuse(
      "blockKind",
      `Block ${input.blockId} is a ${block.kind} block and carries no runs.`,
    );
  }

  const content = contentOf(loaded.graph, input.blockId);
  const role = input.role ?? block.role;
  const revised: Record<string, unknown> = {
    ...content,
    runs: normalizeRuns(input.runs),
  };
  if (role === "paragraph") {
    delete revised["role"];
  } else {
    revised["role"] = role;
  }

  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.blockId,
        baseRevisionId: input.baseRevisionId,
        semanticType: "text",
        content: asContent(revised),
      },
    ],
    (written) => ({
      blockId: input.blockId,
      revisionId: revisionOf(written, input.blockId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Splits a text block at a character position. The head keeps the block's
 * identity and the tail becomes a new block directly after it, carrying the
 * same role: a split is a structural gesture, and changing what the
 * continuation is called is a separate decision the editor makes.
 */
export async function splitTextBlock(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly blockId: string;
    readonly baseRevisionId: string;
    readonly at: number;
  },
): Promise<GraphOutcome<SplitBlocks>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (block === undefined) {
    return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  }
  if (block.kind !== "text") {
    return refuse("blockKind", `A ${block.kind} block does not split.`);
  }
  if (!Number.isInteger(input.at) || input.at < 0) {
    return refuse("splitPoint", "A split happens at a character position.");
  }

  const [head, tail] = splitRuns(block.runs, input.at);
  const content = contentOf(loaded.graph, input.blockId);
  const order = orderFor(loaded.document.blocks, { after: input.blockId });
  if ("failure" in order) return order.failure;

  const outcome = await mutateGraph(
    db,
    calliopaGraphSchema,
    {
      operations: [
        {
          op: "reviseNode",
          nodeId: input.blockId,
          baseRevisionId: input.baseRevisionId,
          semanticType: "text",
          content: asContent({ ...content, runs: head }),
        },
        {
          op: "createNode",
          ref: "tail",
          semanticType: "text",
          content: asContent({
            ...content,
            order: order.order,
            runs: tail,
          }),
        },
        {
          op: "createRelation",
          relationType: "contains",
          from: { kind: "id", nodeId: input.documentId },
          to: { kind: "node", node: { kind: "ref", ref: "tail" } },
        },
      ],
    },
    actor,
  );
  if (outcome.outcome !== "success") return outcome as GraphOutcome<SplitBlocks>;

  const tailNode = outcome.result.nodes.find((node) => node.ref === "tail");
  return {
    outcome: "success",
    result: {
      blockId: input.blockId,
      revisionId: revisionOf(outcome.result, input.blockId),
      tailBlockId: tailNode?.nodeId as string,
      dataRevision: outcome.result.dataRevision,
    },
  };
}

/**
 * Merges one text block into another, which retires the block that was merged
 * away. A block leaves a document only by becoming retired, so what a merge
 * absorbed stays recoverable rather than becoming unreachable.
 */
export async function mergeTextBlocks(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly intoBlockId: string;
    readonly intoBaseRevisionId: string;
    readonly blockId: string;
  },
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const into = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.intoBlockId,
  );
  const from = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (into === undefined || from === undefined) {
    return refuse("unknownBlock", "Both blocks of a merge are in the document.");
  }
  if (into.kind !== "text" || from.kind !== "text") {
    return refuse(
      "incompatibleMerge",
      `A ${into.kind} block and a ${from.kind} block do not merge.`,
    );
  }
  if (into.blockId === from.blockId) {
    return refuse("incompatibleMerge", "A block does not merge into itself.");
  }

  const content = contentOf(loaded.graph, input.intoBlockId);
  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.intoBlockId,
        baseRevisionId: input.intoBaseRevisionId,
        semanticType: "text",
        content: asContent({
          ...content,
          runs: normalizeRuns([...into.runs, ...from.runs]),
        }),
      },
      { op: "closeRelation", relationId: from.containmentId },
      {
        op: "createRelation",
        relationType: "retired",
        from: { kind: "id", nodeId: input.documentId },
        to: { kind: "node", node: { kind: "id", nodeId: from.blockId } },
      },
    ],
    (written) => ({
      blockId: input.intoBlockId,
      revisionId: revisionOf(written, input.intoBlockId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Moves a block to another placement among its siblings. Ordering lives on the
 * block, so a reorder is one revision and the containment relation is
 * untouched.
 */
export async function moveBlock(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly blockId: string;
    readonly baseRevisionId: string;
    readonly placement: Placement;
  },
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (block === undefined) {
    return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  }
  if (
    ("before" in input.placement && input.placement.before === input.blockId) ||
    ("after" in input.placement && input.placement.after === input.blockId)
  ) {
    return refuse("unknownAnchor", "A block does not move relative to itself.");
  }

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  const node = nodeOf(loaded.graph, input.blockId);
  const content = contentOf(loaded.graph, input.blockId);
  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.blockId,
        baseRevisionId: input.baseRevisionId,
        semanticType: node?.semanticType as string,
        content: asContent({ ...content, order: order.order }),
      },
    ],
    (written) => ({
      blockId: input.blockId,
      revisionId: revisionOf(written, input.blockId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Retires a block: its containment closes and the document records it as
 * retired, so it leaves the reading order while staying reachable from the
 * document it belonged to.
 */
export async function retireBlock(
  db: postgres.Sql,
  input: { readonly documentId: string; readonly blockId: string },
): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === input.blockId,
  );
  if (block === undefined) {
    return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  }

  return commit(
    db,
    [
      { op: "closeRelation", relationId: block.containmentId },
      {
        op: "createRelation",
        relationType: "retired",
        from: { kind: "id", nodeId: input.documentId },
        to: { kind: "node", node: { kind: "id", nodeId: input.blockId } },
      },
    ],
    (written) => ({
      blockId: input.blockId,
      revisionId: revisionOf(written, input.blockId),
      dataRevision: written.dataRevision,
    }),
  );
}

/** The blocks retired from a document, newest position order first read. */
export async function readRetiredBlocks(
  db: postgres.Sql,
  documentId: string,
): Promise<GraphOutcome<readonly BlockView[]>> {
  const loaded = await loadDocument(db, documentId, "retired");
  if (!loaded.ok) return loaded.outcome;
  return { outcome: "success", result: assembleRetired(loaded.graph, documentId) };
}

/**
 * Restores a retired block at a placement, minting a fresh order key rather
 * than assuming the position it used to hold is still free.
 *
 * A block that is already contained is refused: containment is a tree, and a
 * second active parent is exactly what that rules out.
 */
export async function restoreBlock(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly blockId: string;
    readonly placement: Placement;
  },
): Promise<GraphOutcome<WrittenBlock>> {
  const contained = await loadDocument(db, input.documentId);
  if (!contained.ok) return contained.outcome;
  if (
    contained.document.blocks.some(
      (block) => block.blockId === input.blockId,
    )
  ) {
    return refuse(
      "singleParent",
      `Block ${input.blockId} already has an active containment parent.`,
    );
  }

  const loaded = await loadDocument(db, input.documentId, "retired");
  if (!loaded.ok) return loaded.outcome;
  const retired = assembleRetired(loaded.graph, input.documentId).find(
    (block) => block.blockId === input.blockId,
  );
  if (retired === undefined) {
    return refuse(
      "notRetired",
      `Block ${input.blockId} is not retired from document ${input.documentId}.`,
    );
  }

  const order = orderFor(contained.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  const node = nodeOf(loaded.graph, input.blockId);
  const content = contentOf(loaded.graph, input.blockId);
  return commit(
    db,
    [
      {
        op: "reviseNode",
        nodeId: input.blockId,
        baseRevisionId: retired.revisionId,
        semanticType: node?.semanticType as string,
        content: asContent({ ...content, order: order.order }),
      },
      { op: "closeRelation", relationId: retired.containmentId },
      {
        op: "createRelation",
        relationType: "contains",
        from: { kind: "id", nodeId: input.documentId },
        to: { kind: "node", node: { kind: "id", nodeId: input.blockId } },
      },
    ],
    (written) => ({
      blockId: input.blockId,
      revisionId: revisionOf(written, input.blockId),
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * Deletes a document by archiving its established revision.
 *
 * The graph keeps every revision, every relation, and every closed validity:
 * dropping them would rewrite history rather than reclaim space. What changes
 * is that the document has no established truth, so the parentless listing
 * stops answering it and a read of it answers with nothing.
 *
 * Its blocks are left as they stand. A block is reachable only through its
 * document, so archiving each one would multiply the write for no readable
 * difference.
 *
 * Deleting a document that is unknown or already deleted is refused rather
 * than answered as success, because the caller asked about something that is
 * not there.
 */
export async function deleteDocument(
  db: postgres.Sql,
  input: { readonly documentId: string; readonly baseRevisionId: string },
): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  return commit(
    db,
    [
      {
        op: "archiveNode",
        nodeId: input.documentId,
        baseRevisionId: input.baseRevisionId,
      },
    ],
    (written) => ({
      documentId: input.documentId,
      revisionId: input.baseRevisionId,
      dataRevision: written.dataRevision,
    }),
  );
}

/**
 * When a document last changed and how many times.
 *
 * A change is one graph data revision that touched the document: a revision of
 * its own node, of a block in its reading order, or of one of its retired
 * blocks, or the creation of a `contains` or `retired` relation between them.
 * The gateway counts one data revision once however many records it wrote, so
 * a split, which writes two blocks together, is the one change it was.
 *
 * Retired blocks count. They stay recoverable for the life of the document, so
 * they never stopped being the document's, and retiring one writes no node
 * revision at all — it closes a containment and creates a `retired` relation,
 * which is why that relation is named here.
 *
 * A closed relation is not reachable from a current read, and does not need to
 * be: every mutation that closes one also writes a record that is. Retiring
 * creates the `retired` relation, restoring revises the block it puts back,
 * and merging revises the block that survived.
 */
export async function readDocumentChanges(
  db: postgres.Sql,
  documentId: string,
): Promise<GraphOutcome<ChangeSummary>> {
  const contained = await loadDocument(db, documentId);
  if (!contained.ok) return contained.outcome;

  const retired = await loadDocument(db, documentId, "retired");
  if (!retired.ok) return retired.outcome;
  const retiredBlocks = assembleRetired(retired.graph, documentId);

  const nodeIds = [
    documentId,
    ...contained.document.blocks.map((block) => block.blockId),
    ...retiredBlocks.map((block) => block.blockId),
  ];
  const relationIds = [
    ...contained.document.blocks.map((block) => block.containmentId),
    ...retiredBlocks.map((block) => block.containmentId),
  ];

  return readChangeSummary(db, { nodeIds, relationIds });
}

/**
 * What a caller proposes for a document. Each kind carries everything its
 * operation needs, so a human answers one item without the rest of the group.
 */
export type DocumentProposalItem =
  | {
      readonly kind: "replace";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly runs?: readonly Run[];
      readonly role?: TextRole;
    }
  | {
      readonly kind: "insert";
      readonly block: NewBlock;
      readonly placement: Placement;
    }
  | { readonly kind: "remove"; readonly blockId: string }
  | {
      readonly kind: "move";
      readonly blockId: string;
      readonly baseRevisionId: string;
      readonly placement: Placement;
    };

/**
 * Stages a group of proposed changes against one document. Nothing here
 * changes the document: content an item introduces is staged as a candidate
 * revision and the relations placing or retiring a block are written when the
 * item is accepted.
 *
 * Order keys are minted here, against the document as it stands, and each
 * insert accounts for the ones staged before it in the same group. A key
 * always sorts somewhere, so an accepted insert lands where its item said even
 * when the document has moved since.
 */
export async function proposeDocumentChanges(
  db: postgres.Sql,
  input: {
    readonly documentId: string;
    readonly items: NonEmpty<DocumentProposalItem>;
    readonly request?: JSONValue;
  },
  by: GraphActor = actor,
): Promise<GraphOutcome<StagedProposal>> {
  const loaded = await loadDocument(db, input.documentId);
  if (!loaded.ok) return loaded.outcome;

  // Inserts staged earlier in this group are siblings the later ones place
  // themselves among, so two appends do not mint the same key.
  const siblings: BlockView[] = [...loaded.document.blocks];
  const staged: ProposalItemRequest[] = [];

  for (const item of input.items) {
    const compiled = compileProposalItem(loaded, siblings, item);
    if ("failure" in compiled) return compiled.failure;
    staged.push(compiled.item);
  }

  const [first, ...rest] = staged;
  if (first === undefined) {
    return refuse("emptyProposal", "A proposal names at least one change.");
  }
  return stageProposal(
    db,
    calliopaGraphSchema,
    {
      rootNodeId: input.documentId,
      items: [first, ...rest],
      ...(input.request === undefined ? {} : { request: input.request }),
    },
    by,
  );
}

function compileProposalItem(
  loaded: {
    readonly graph: AssembledGraph;
    readonly document: DocumentView;
  },
  siblings: BlockView[],
  item: DocumentProposalItem,
): { readonly item: ProposalItemRequest } | { readonly failure: GraphOutcome<never> } {
  if (item.kind === "insert") {
    const order = orderFor(siblings, item.placement);
    if ("failure" in order) return { failure: order.failure };
    siblings.push({
      blockId: `staged:${order.order}`,
      revisionId: "",
      containmentId: "",
      kind: "divider",
      order: order.order,
    });
    return {
      item: {
        kind: "insert",
        content: {
          of: "newNode",
          semanticType: blockType(item.block),
          content: blockContent(item.block, order.order),
        },
        onAccept: [
          {
            op: "createRelation",
            relationType: "contains",
            from: { kind: "id", nodeId: loaded.document.documentId },
            to: { kind: "stagedNode" },
          },
        ],
      },
    };
  }

  const block = loaded.document.blocks.find(
    (candidate) => candidate.blockId === item.blockId,
  );
  if (block === undefined) {
    return {
      failure: refuse(
        "unknownBlock",
        `Block ${item.blockId} is not in this document.`,
      ),
    };
  }

  if (item.kind === "remove") {
    return {
      item: {
        kind: "remove",
        targetNodeId: item.blockId,
        onAccept: [
          { op: "closeRelation", relationId: block.containmentId },
          {
            op: "createRelation",
            relationType: "retired",
            from: { kind: "id", nodeId: loaded.document.documentId },
            to: { kind: "id", nodeId: item.blockId },
          },
        ],
      },
    };
  }

  const node = nodeOf(loaded.graph, item.blockId);
  const content = contentOf(loaded.graph, item.blockId);

  if (item.kind === "move") {
    if (
      ("before" in item.placement && item.placement.before === item.blockId) ||
      ("after" in item.placement && item.placement.after === item.blockId)
    ) {
      return {
        failure: refuse(
          "unknownAnchor",
          "A block does not move relative to itself.",
        ),
      };
    }
    const order = orderFor(siblings, item.placement);
    if ("failure" in order) return { failure: order.failure };
    return {
      item: {
        kind: "move",
        targetNodeId: item.blockId,
        content: {
          of: "node",
          nodeId: item.blockId,
          baseRevisionId: item.baseRevisionId,
          semanticType: node?.semanticType as string,
          content: asContent({ ...content, order: order.order }),
        },
      },
    };
  }

  return {
    item: {
      kind: "replace",
      targetNodeId: item.blockId,
      content: {
        of: "node",
        nodeId: item.blockId,
        baseRevisionId: item.baseRevisionId,
        semanticType: node?.semanticType as string,
        content: asContent({
          ...content,
          ...(item.runs === undefined
            ? {}
            : { runs: normalizeRuns([...item.runs]) }),
          ...(item.role === undefined
            ? {}
            : item.role === "paragraph"
              ? { role: undefined }
              : { role: item.role }),
        }),
      },
    },
  };
}

/** One proposed change, as the surface reviewing it reads it. */
export interface ProposedChange {
  readonly itemId: string;
  readonly groupId: string;
  readonly kind: string;
  /** The block it concerns: the one it names, or the one it would insert. */
  readonly blockId: string;
  /** What the block would say. Absent for a `remove`, which proposes no content. */
  readonly block: BlockView | null;
}

export interface DocumentProposals {
  readonly documentId: string;
  readonly unanswered: number;
  readonly groups: readonly {
    readonly groupId: string;
    readonly items: readonly ProposedChange[];
  }[];
}

/**
 * The unanswered proposals standing against a document, grouped as they were
 * staged. This is the document's own reading of them: what each item would do
 * and to which block, which is what the editor shows against that block.
 */
export async function readDocumentProposals(
  db: postgres.Sql,
  documentId: string,
): Promise<GraphOutcome<DocumentProposals>> {
  const loaded = await loadDocument(db, documentId);
  if (!loaded.ok) return loaded.outcome;

  const groupIds = await listOpenProposalGroups(db, documentId);
  const groups: { groupId: string; items: ProposedChange[] }[] = [];
  let unanswered = 0;

  for (const groupId of groupIds) {
    const outcome = await readProposalGroup(db, groupId);
    if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
    const items = outcome.result.items
      .filter((item) => item.answer === null)
      .map((item) => ({
        itemId: item.itemId,
        groupId,
        kind: item.kind,
        blockId: (item.targetNodeId ?? item.stagedNodeId) as string,
        block: proposedBlock(item),
      }));
    unanswered += items.length;
    groups.push({ groupId, items });
  }

  return {
    outcome: "success",
    result: { documentId, unanswered, groups },
  };
}

/**
 * The staged content as a block. It goes through the same reader the
 * document's own blocks do, so a proposed block and a stored one cannot come
 * to mean different things, and it carries no containment because the relation
 * placing it is written when the item is accepted.
 */
function proposedBlock(item: ProposalItemView): BlockView | null {
  if (item.stagedContent === null || item.stagedNodeId === null) return null;
  return toBlock(
    {
      nodeId: item.stagedNodeId,
      revisionId: item.stagedRevisionId ?? "",
      semanticType: item.stagedSemanticType ?? "",
      content: item.stagedContent,
      provenance: null,
      schemaVersion: 0,
      dataRevision: "0",
    },
    "",
  );
}

/**
 * Answers one proposed change. Accepting performs it and the document holds it
 * from that moment; rejecting leaves the document exactly as it was.
 */
export async function answerDocumentProposal(
  db: postgres.Sql,
  input: { readonly itemId: string; readonly answer: ProposalAnswer },
): Promise<GraphOutcome<AnsweredItem>> {
  return answerProposalItem(
    db,
    calliopaGraphSchema,
    input.itemId,
    input.answer,
    actor,
  );
}
