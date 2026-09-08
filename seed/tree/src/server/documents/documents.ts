import { randomBytes, randomUUID } from "node:crypto";

import type { DocumentSummary } from "../../lib/library";
import { orderBetween } from "../../lib/order";
import {
  decide,
  query,
  stage,
  touchedSet,
  write,
  type ReadNode,
  type ReadResult,
} from "../ccgw/client";
import type { GraphOutcome, NonEmpty } from "../outcome";
import {
  assembleDocument,
  assembleRetired,
  bareId,
  CONTAINS,
  contentOf,
  documentNodeOf,
  nodeRef,
  RETIRED,
  toBlock,
  typeOf,
  type BlockView,
  type DocumentView,
} from "./assemble";
import { sameRuns } from "../../lib/runs";
import {
  DOCUMENT_TYPE,
  normalizeRuns,
  splitRuns,
  type Run,
  type TextRole,
} from "./vocabulary";

/**
 * The document and block operations the editor works through, over the one
 * graph. `BO_0207_012`
 *
 * Every read is a rooted, bounded CCGW statement at the current head. Every
 * structural gesture compiles into one mutation script carried by the
 * kernel's `write` verb, so a refusal leaves the document exactly as it was
 * and what the shell may establish is the core's decision. Proposals stage
 * through the kernel's `stage` verb into a CCGW group and are answered per
 * member through its `accept` and `reject` verbs.
 *
 * Conflict on a stale base is the shell's check before it writes: CCGW's
 * direct truth write archives and replaces whatever stands, so the operation
 * compares the base the caller names with the revision the read found. The
 * window between that read and the write is the one the shell's own gateway
 * already had (`CA_0007_011`), and a proposal's staleness is CCGW's per-member
 * drift judgement at acceptance rather than anything decided here.
 */

/**
 * Blocks hang directly off their document. The first container block type
 * raises this, and the read that walks it is already written in terms of
 * relations rather than one level.
 */
const CONTAINMENT_PATTERN = (relation: string, include = ""): string =>
  `MATCH (d:${DOCUMENT_TYPE})-[c:${relation}]->(b) RETURN GRAPH d, c, b ROOT d${include}`;

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

/**
 * How many times a document has been written, and when last.
 *
 * A data revision is one transaction, so a write that touched several of the
 * document's records counts once however many it left behind.
 */
export interface ChangeSummary {
  readonly changeCount: number;
  /** Null only when nothing of the document has ever been written. */
  readonly lastWrittenAt: string | null;
}

function refuse<T>(rule: string, detail: string): GraphOutcome<T> {
  return {
    outcome: "validationFailure",
    failures: [{ operation: null, rule, detail }],
  };
}

function conflict<T>(nodeId: string, expected: string, current: string | null): GraphOutcome<T> {
  return {
    outcome: "conflict",
    conflicts: [{ nodeId, expectedRevisionId: expected, currentRevisionId: current }],
  };
}

const nodeOf = (graph: ReadResult, id: string): ReadNode | undefined =>
  graph.nodes.find((candidate) => candidate.id === nodeRef(id));

const blockContent = (block: NewBlock, order: string): Record<string, unknown> =>
  block.kind === "divider"
    ? { order }
    : {
        order,
        runs: normalizeRuns(block.runs ?? []),
        ...(block.role !== undefined && block.role !== "paragraph"
          ? { role: block.role }
          : {}),
      };

const blockType = (block: NewBlock): string => block.kind;

/**
 * Reads a document and the graph it came from. Callers that only need the
 * ordered document use `readDocument`; the operations need the raw graph too,
 * so a revision can preserve content this build does not model.
 */
async function loadDocument(
  documentId: string,
  relationType: typeof CONTAINS | typeof RETIRED = CONTAINS,
): Promise<
  | { readonly ok: true; readonly graph: ReadResult; readonly document: DocumentView }
  | { readonly ok: false; readonly outcome: GraphOutcome<never> }
> {
  const outcome = await query({
    statement: CONTAINMENT_PATTERN(relationType),
    roots: [nodeRef(documentId)],
    unbounded: true,
    purpose: "document read",
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

/**
 * The revision a node carries at a data revision. A write answers only the
 * data revision it landed at, so the revision the next write must name is
 * read back at that pin.
 */
async function revisionAt(id: string, dataRevision: string): Promise<string> {
  const outcome = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id: bareId(id) },
    dataRevision: Number(dataRevision),
    purpose: "revision after write",
  });
  if (outcome.outcome !== "success") return "";
  return nodeOf(outcome.result, id)?.revision.id ?? "";
}

/** Runs one content truth script and reads back the revisions it established. */
async function commit<T>(
  statement: string,
  parameters: Record<string, unknown>,
  rationale: string,
  result: (dataRevision: string, revisionOf: (id: string) => Promise<string>) => Promise<T>,
): Promise<GraphOutcome<T>> {
  const written = await write(statement, parameters, rationale);
  if (written.outcome !== "success") return written as GraphOutcome<T>;
  const dataRevision = written.result.dataRevision;
  return {
    outcome: "success",
    result: await result(dataRevision, (id) => revisionAt(id, dataRevision)),
  };
}

/** The properties a CREATE writes, as statement text over named parameters. */
const properties = (
  alias: string,
  content: Record<string, unknown>,
  parameters: Record<string, unknown>,
  established: boolean,
): string => {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (value === undefined) continue;
    const name = `${alias}_${key}`;
    parameters[name] = value;
    pairs.push(`${key}: $${name}`);
  }
  if (established) pairs.push(`status: "established"`);
  return pairs.join(", ");
};

/**
 * Creates a document and its first block as one script, so a document never
 * exists without somewhere to type. Identities are minted here and are the
 * ids the API hands out: CCGW names the node `node:<id>` and the shell keeps
 * the bare form.
 */
export async function createDocument(input: {
  readonly title: string;
  readonly block?: NewBlock;
}): Promise<GraphOutcome<CreatedDocument>> {
  const block = input.block ?? { kind: "text" as const };
  const documentId = randomUUID();
  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(documentId),
    bref: nodeRef(blockId),
  };
  const statement = [
    `CREATE (d:${DOCUMENT_TYPE} {${properties("d", { id: documentId, title: input.title }, parameters, true)}})`,
    `CREATE (b:${blockType(block)} {${properties("b", { id: blockId, ...blockContent(block, orderBetween("", "")) }, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> bref`,
  ].join("; ");

  return commit(statement, parameters, `create document ${documentId}`, async (dataRevision) => ({
    documentId,
    blockId,
    dataRevision,
  }));
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
 * A `document` is never the target of a containment today, so the parentless
 * filter currently keeps every document. It is written as the rule so nesting
 * documents later narrows this listing rather than rewriting it. A deleted
 * document is retired in the graph and absent from a current read, so it
 * never appears here.
 */
export async function listDocuments(): Promise<GraphOutcome<readonly DocumentSummary[]>> {
  const outcome = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE}) RETURN GRAPH d`,
    unbounded: true,
    purpose: "document listing",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: [] };
  if (outcome.outcome !== "success") {
    return outcome as GraphOutcome<readonly DocumentSummary[]>;
  }

  const contained = await query({
    statement: `MATCH (p)-[c:${CONTAINS}]->(d:${DOCUMENT_TYPE}) RETURN GRAPH p, c, d`,
    unbounded: true,
    purpose: "contained documents",
  });
  const containedIds = new Set(
    contained.outcome === "success"
      ? contained.result.relations
          .filter((relation) => relation.type === CONTAINS && relation.validity.status === "active")
          .map((relation) => relation.to.nodeId ?? "")
      : [],
  );

  const summaries: DocumentSummary[] = [];
  const seen = new Set<string>();
  for (const node of outcome.result.nodes) {
    if (typeOf(node) !== DOCUMENT_TYPE) continue;
    if (node.revision.status !== "established") continue;
    if (containedIds.has(node.id) || seen.has(node.id)) continue;
    seen.add(node.id);
    const title = contentOf(node)["title"];
    summaries.push({
      documentId: bareId(node.id),
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
  documentId: string,
  range?: DocumentRange,
): Promise<GraphOutcome<DocumentView>> {
  const loaded = await loadDocument(documentId);
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
 * A stale base is a conflict rather than a silent overwrite.
 */
export async function renameDocument(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
  readonly title: string;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }

  return commit(
    "SET d.title = $title",
    { dNodeId: nodeRef(input.documentId), title: input.title },
    `rename document ${input.documentId}`,
    async (dataRevision, revisionOf) => ({
      documentId: input.documentId,
      revisionId: await revisionOf(input.documentId),
      dataRevision,
    }),
  );
}

/**
 * One block of a document with everything it contains. A block holds no
 * children until a container block type exists, so today this is the block
 * itself, read without pulling in its siblings.
 */
export async function readBlock(
  documentId: string,
  blockId: string,
): Promise<GraphOutcome<BlockView>> {
  const loaded = await loadDocument(documentId);
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
export async function insertBlock(input: {
  readonly documentId: string;
  readonly block: NewBlock;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  const blockId = randomUUID();
  const parameters: Record<string, unknown> = {
    dref: nodeRef(input.documentId),
    bref: nodeRef(blockId),
  };
  const statement = [
    `CREATE (b:${blockType(input.block)} {${properties("b", { id: blockId, ...blockContent(input.block, order.order) }, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> bref`,
  ].join("; ");

  return commit(statement, parameters, `insert block into ${input.documentId}`, async (dataRevision, revisionOf) => ({
    blockId,
    revisionId: await revisionOf(blockId),
    dataRevision,
  }));
}

/** The block named by an operation, refused when it is not in the document
 * or when the base the caller names is no longer the block's revision. */
function locate(
  document: DocumentView,
  blockId: string,
  baseRevisionId?: string,
): { readonly block: BlockView } | { readonly failure: GraphOutcome<never> } {
  const block = document.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) {
    return { failure: refuse("unknownBlock", `Block ${blockId} is not in this document.`) };
  }
  if (baseRevisionId !== undefined && block.revisionId !== baseRevisionId) {
    return { failure: conflict(blockId, baseRevisionId, block.revisionId) };
  }
  return { block };
}

/** Revises a text block's runs and role, keeping its identity and position. */
export async function reviseTextBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly runs: readonly Run[];
  readonly role?: TextRole;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (located.block.kind !== "text") {
    return refuse(
      "blockKind",
      `Block ${input.blockId} is a ${located.block.kind} block and carries no runs.`,
    );
  }

  const role = input.role ?? located.block.role;
  return commit(
    "SET b.runs = $runs, b.role = $role",
    {
      bNodeId: nodeRef(input.blockId),
      runs: normalizeRuns(input.runs),
      // A null clears the property: an ordinary paragraph stores no role.
      role: role === "paragraph" ? null : role,
    },
    `revise block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Splits a text block at a character position. The head keeps the block's
 * identity and the tail becomes a new block directly after it, carrying the
 * same role: a split is a structural gesture, and changing what the
 * continuation is called is a separate decision the editor makes.
 */
export async function splitTextBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly at: number;
}): Promise<GraphOutcome<SplitBlocks>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  const block = located.block;
  if (block.kind !== "text") {
    return refuse("blockKind", `A ${block.kind} block does not split.`);
  }
  if (!Number.isInteger(input.at) || input.at < 0) {
    return refuse("splitPoint", "A split happens at a character position.");
  }

  const [head, tail] = splitRuns(block.runs, input.at);
  const order = orderFor(loaded.document.blocks, { after: input.blockId });
  if ("failure" in order) return order.failure;

  const tailBlockId = randomUUID();
  const parameters: Record<string, unknown> = {
    bNodeId: nodeRef(input.blockId),
    head,
    dref: nodeRef(input.documentId),
    tref: nodeRef(tailBlockId),
  };
  const tailContent: Record<string, unknown> = {
    id: tailBlockId,
    order: order.order,
    runs: tail,
    ...(block.role === "paragraph" ? {} : { role: block.role }),
  };
  const statement = [
    "SET b.runs = $head",
    `CREATE (t:text {${properties("t", tailContent, parameters, true)}})`,
    `RELATE dref -[c:${CONTAINS}]-> tref`,
  ].join("; ");

  return commit(statement, parameters, `split block ${input.blockId}`, async (dataRevision, revisionOf) => ({
    blockId: input.blockId,
    revisionId: await revisionOf(input.blockId),
    tailBlockId,
    dataRevision,
  }));
}

/**
 * Merges one text block into another, which retires the block that was merged
 * away. A block leaves a document only by becoming retired, so what a merge
 * absorbed stays recoverable rather than becoming unreachable.
 */
export async function mergeTextBlocks(input: {
  readonly documentId: string;
  readonly intoBlockId: string;
  readonly intoBaseRevisionId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
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
  if (into.revisionId !== input.intoBaseRevisionId) {
    return conflict(into.blockId, input.intoBaseRevisionId, into.revisionId);
  }

  return commit(
    ["SET i.runs = $runs", "CLOSE c", `RELATE dref -[r:${RETIRED}]-> fref`].join("; "),
    {
      iNodeId: nodeRef(input.intoBlockId),
      runs: normalizeRuns([...into.runs, ...from.runs]),
      cRelationId: from.containmentId,
      dref: nodeRef(input.documentId),
      fref: nodeRef(from.blockId),
    },
    `merge block ${input.blockId} into ${input.intoBlockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.intoBlockId,
      revisionId: await revisionOf(input.intoBlockId),
      dataRevision,
    }),
  );
}

/**
 * Moves a block to another placement among its siblings. Ordering lives on the
 * block, so a reorder is one revision and the containment relation is
 * untouched.
 */
export async function moveBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly baseRevisionId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId, input.baseRevisionId);
  if ("failure" in located) return located.failure;
  if (
    ("before" in input.placement && input.placement.before === input.blockId) ||
    ("after" in input.placement && input.placement.after === input.blockId)
  ) {
    return refuse("unknownAnchor", "A block does not move relative to itself.");
  }

  const order = orderFor(loaded.document.blocks, input.placement);
  if ("failure" in order) return order.failure;

  return commit(
    "SET b.order = $order",
    { bNodeId: nodeRef(input.blockId), order: order.order },
    `move block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Retires a block: its containment closes and the document records it as
 * retired, so it leaves the reading order while staying reachable from the
 * document it belonged to. The close and the relation travel in one script
 * with the document as an endpoint, which is what lets the kernel's gate
 * verify the close against content it can see.
 */
export async function retireBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<WrittenBlock>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  const located = locate(loaded.document, input.blockId);
  if ("failure" in located) return located.failure;

  return commit(
    ["CLOSE c", `RELATE dref -[r:${RETIRED}]-> bref`].join("; "),
    {
      cRelationId: located.block.containmentId,
      dref: nodeRef(input.documentId),
      bref: nodeRef(input.blockId),
    },
    `retire block ${input.blockId}`,
    async (dataRevision) => ({
      blockId: input.blockId,
      revisionId: located.block.revisionId,
      dataRevision,
    }),
  );
}

/** The blocks retired from a document, newest position order first read. */
export async function readRetiredBlocks(
  documentId: string,
): Promise<GraphOutcome<readonly BlockView[]>> {
  const loaded = await loadDocument(documentId, RETIRED);
  if (!loaded.ok) return loaded.outcome;
  return { outcome: "success", result: assembleRetired(loaded.graph, documentId) };
}

/**
 * Restores a retired block at a placement, minting a fresh order key rather
 * than assuming the position it used to hold is still free.
 *
 * A block that is already contained is refused: containment is a tree, and a
 * second active parent is exactly what that rules out. Validation does not
 * hold this line for graph-declared types, so the shell checks it before it
 * writes (`block-document-model.md`).
 */
export async function restoreBlock(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly placement: Placement;
}): Promise<GraphOutcome<WrittenBlock>> {
  const contained = await loadDocument(input.documentId);
  if (!contained.ok) return contained.outcome;
  if (contained.document.blocks.some((block) => block.blockId === input.blockId)) {
    return refuse(
      "singleParent",
      `Block ${input.blockId} already has an active containment parent.`,
    );
  }

  const loaded = await loadDocument(input.documentId, RETIRED);
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

  return commit(
    ["SET b.order = $order", "CLOSE r", `RELATE dref -[c:${CONTAINS}]-> bref`].join("; "),
    {
      bNodeId: nodeRef(input.blockId),
      order: order.order,
      rRelationId: retired.containmentId,
      dref: nodeRef(input.documentId),
      bref: nodeRef(input.blockId),
    },
    `restore block ${input.blockId}`,
    async (dataRevision, revisionOf) => ({
      blockId: input.blockId,
      revisionId: await revisionOf(input.blockId),
      dataRevision,
    }),
  );
}

/**
 * Deletes a document by retiring its node: the established revision is
 * archived and the node leaves current reads.
 *
 * The graph keeps every revision, every relation, and every closed validity:
 * dropping them would rewrite history rather than reclaim space. Its blocks
 * are left as they stand. A block is reachable only through its document, so
 * retiring each one would multiply the write for no readable difference.
 *
 * Deleting a document that is unknown or already deleted is refused rather
 * than answered as success, because the caller asked about something that is
 * not there.
 */
export async function deleteDocument(input: {
  readonly documentId: string;
  readonly baseRevisionId: string;
}): Promise<GraphOutcome<WrittenDocument>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;
  if (loaded.document.revisionId !== input.baseRevisionId) {
    return conflict(input.documentId, input.baseRevisionId, loaded.document.revisionId);
  }

  return commit(
    "RETIRE d",
    { dNodeId: nodeRef(input.documentId) },
    `delete document ${input.documentId}`,
    async (dataRevision) => ({
      documentId: input.documentId,
      revisionId: input.baseRevisionId,
      dataRevision,
    }),
  );
}

/**
 * When a document last changed and how many times.
 *
 * A change is one graph data revision that touched the document: a revision
 * of its own node, of a block in its reading order or among its retired
 * blocks, or the creation or closing of a containment or retirement between
 * them. The stamps are read from CCGW's own history — metadata only, no
 * content — and a data revision is counted once however many records it
 * wrote, so a split, which writes two blocks together, is the one change it
 * was.
 */
export async function readDocumentChanges(
  documentId: string,
): Promise<GraphOutcome<ChangeSummary>> {
  const revisions = new Set<number>();
  let lastWrittenAt = 0;
  const stamp = (dataRevision: number | undefined, at: number | undefined): void => {
    if (dataRevision !== undefined && dataRevision > 0) revisions.add(dataRevision);
    if (at !== undefined && at > lastWrittenAt) lastWrittenAt = at;
  };

  for (const relation of [CONTAINS, RETIRED] as const) {
    const outcome = await query({
      statement: CONTAINMENT_PATTERN(relation, " INCLUDE HISTORY"),
      roots: [nodeRef(documentId)],
      unbounded: true,
      metadataOnly: true,
      purpose: "document changes",
    });
    if (outcome.outcome === "noResult") continue;
    if (outcome.outcome !== "success") return outcome as GraphOutcome<ChangeSummary>;
    if (relation === CONTAINS && documentNodeOf(outcome.result, documentId) === undefined) {
      return { outcome: "noResult", detail: `No document ${documentId} in this graph.` };
    }
    for (const node of outcome.result.nodes) {
      stamp(node.revision.dataRevision, node.revision.createdAt);
      for (const prior of node.history ?? []) stamp(prior.dataRevision, prior.createdAt);
    }
    for (const rel of outcome.result.relations) {
      stamp(rel.dataRevision, rel.createdAt);
      stamp(rel.validity.dataRevision, rel.validity.updatedAt);
    }
  }

  return {
    outcome: "success",
    result: {
      changeCount: revisions.size,
      lastWrittenAt: lastWrittenAt === 0 ? null : new Date(lastWrittenAt).toISOString(),
    },
  };
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

export interface StagedItem {
  readonly itemId: string;
  readonly kind: DocumentProposalItem["kind"];
  /** The block it concerns: the one it names, or the one it would insert. */
  readonly blockId: string;
}

export interface StagedProposal {
  readonly groupId: string;
  readonly items: readonly StagedItem[];
  readonly dataRevision: string;
}

/**
 * An item's identity, as the surface hands it back to be answered: the group,
 * the kind, and the members the decision covers. A replace, move or insert is
 * one member — the staged node, whose containment travels with it — while a
 * remove is two, the retirement relation the proposal stages and the
 * containment its close intent names, decided in that order.
 */
const itemId = (groupId: string, kind: string, members: readonly string[]): string =>
  [groupId, kind, ...members].join("|");

const parseItemId = (
  id: string,
): { readonly groupId: string; readonly kind: string; readonly members: readonly string[] } | null => {
  const [groupId, kind, ...members] = id.split("|");
  if (groupId === undefined || kind === undefined || members.length === 0) return null;
  return { groupId, kind, members };
};

/**
 * Stages a group of proposed changes against one document. Nothing here
 * changes the document: content an item introduces is staged as a candidate
 * revision, and the relations placing or retiring a block are staged beside
 * it, written into truth when the item is accepted.
 *
 * Order keys are minted here, against the document as it stands, and each
 * insert accounts for the ones staged before it in the same group. A key
 * always sorts somewhere, so an accepted insert lands where its item said even
 * when the document has moved since. Staleness of a replace or a move is
 * CCGW's per-member drift judgement at acceptance.
 */
export async function proposeDocumentChanges(input: {
  readonly documentId: string;
  readonly items: NonEmpty<DocumentProposalItem>;
  readonly request?: unknown;
}): Promise<GraphOutcome<StagedProposal>> {
  const loaded = await loadDocument(input.documentId);
  if (!loaded.ok) return loaded.outcome;

  const groupId = `node:chg-${randomBytes(8).toString("hex")}`;
  const siblings: BlockView[] = [...loaded.document.blocks];
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  const staged: StagedItem[] = [];
  const documentNode = nodeRef(input.documentId);

  const isOutcome = (value: unknown): value is GraphOutcome<never> =>
    typeof value === "object" && value !== null && "outcome" in value;
  try {
  input.items.forEach((item, index) => {
    const alias = `i${index}`;
    if (item.kind === "insert") {
      const order = orderFor(siblings, item.placement);
      if ("failure" in order) throw order.failure;
      siblings.push({
        blockId: `staged:${order.order}`,
        revisionId: "",
        containmentId: "",
        kind: "divider",
        order: order.order,
      });
      const blockId = randomUUID();
      parameters[`${alias}d`] = documentNode;
      parameters[`${alias}n`] = nodeRef(blockId);
      statements.push(
        `CREATE (${alias}:${blockType(item.block)} {${properties(alias, { id: blockId, ...blockContent(item.block, order.order) }, parameters, false)}})`,
        `RELATE ${alias}d -[${alias}c:${CONTAINS}]-> ${alias}n`,
      );
      staged.push({ itemId: itemId(groupId, "insert", [nodeRef(blockId)]), kind: "insert", blockId });
      return;
    }

    const block = loaded.document.blocks.find((candidate) => candidate.blockId === item.blockId);
    if (block === undefined) {
      throw refuse("unknownBlock", `Block ${item.blockId} is not in this document.`);
    }
    const target = nodeRef(item.blockId);

    if (item.kind === "remove") {
      parameters[`${alias}cRelationId`] = block.containmentId;
      parameters[`${alias}d`] = documentNode;
      parameters[`${alias}b`] = target;
      statements.push(`CLOSE ${alias}c`, `RELATE ${alias}d -[${alias}r:${RETIRED}]-> ${alias}b`);
      // The retirement relation's id is only known once staged; the item is
      // named by the block and resolved to its members when read back.
      staged.push({ itemId: itemId(groupId, "remove", [target, block.containmentId]), kind: "remove", blockId: item.blockId });
      return;
    }

    if (item.kind === "move") {
      if (
        ("before" in item.placement && item.placement.before === item.blockId) ||
        ("after" in item.placement && item.placement.after === item.blockId)
      ) {
        throw refuse("unknownAnchor", "A block does not move relative to itself.");
      }
      const order = orderFor(siblings, item.placement);
      if ("failure" in order) throw order.failure;
      parameters[`${alias}NodeId`] = target;
      parameters[`${alias}order`] = order.order;
      statements.push(`SET ${alias}.order = $${alias}order`);
      staged.push({ itemId: itemId(groupId, "move", [target]), kind: "move", blockId: item.blockId });
      return;
    }

    const assignments: string[] = [];
    parameters[`${alias}NodeId`] = target;
    if (item.runs !== undefined) {
      parameters[`${alias}runs`] = normalizeRuns([...item.runs]);
      assignments.push(`${alias}.runs = $${alias}runs`);
    }
    if (item.role !== undefined) {
      parameters[`${alias}role`] = item.role === "paragraph" ? null : item.role;
      assignments.push(`${alias}.role = $${alias}role`);
    }
    if (assignments.length === 0) {
      throw refuse("emptyReplace", `A replace of ${item.blockId} names runs or a role.`);
    }
    statements.push(`SET ${assignments.join(", ")}`);
    staged.push({ itemId: itemId(groupId, "replace", [target]), kind: "replace", blockId: item.blockId });
  });
  } catch (failure) {
    if (isOutcome(failure)) return failure;
    throw failure;
  }

  const rationale =
    input.request === undefined
      ? `proposal against document ${input.documentId}`
      : `proposal against document ${input.documentId}: ${JSON.stringify(input.request)}`;
  const outcome = await stage(groupId, statements.join("; "), parameters, rationale);
  if (outcome.outcome !== "success") return outcome as GraphOutcome<StagedProposal>;
  return {
    outcome: "success",
    result: { groupId, items: staged, dataRevision: outcome.result.dataRevision },
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
    /** Who staged the group's candidates — the core's `createdBy` stamps, sorted. BO_0209_006 */
    readonly stagedBy: readonly string[];
  }[];
}

/** The open proposal groups of the graph, by id. */
async function openGroups(): Promise<GraphOutcome<readonly string[]>> {
  const outcome = await query({
    statement: "MATCH (g:ProposalGroup) RETURN GRAPH g",
    unbounded: true,
    purpose: "open proposals",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: [] };
  if (outcome.outcome !== "success") return outcome as GraphOutcome<readonly string[]>;
  return {
    outcome: "success",
    result: outcome.result.nodes
      .filter((node) => node.revision.content?.["status"] === "open")
      .map((node) => node.id),
  };
}

/**
 * The unanswered proposals standing against a document, grouped as they were
 * staged. This is the document's own reading of them: what each item would do
 * and to which block, which is what the editor shows against that block.
 *
 * A group names no document. Its members do: a staged relation from the
 * document places or retires a block, and a candidate revision of a block in
 * the document rewrites or moves it. A candidate whose content equals the
 * block's established content is the carry-forward anchor a staged relation
 * hangs on, not a change, and is not shown.
 */
export async function readDocumentProposals(
  documentId: string,
): Promise<GraphOutcome<DocumentProposals>> {
  const loaded = await loadDocument(documentId);
  if (!loaded.ok) return loaded.outcome;
  const groupIds = await openGroups();
  if (groupIds.outcome !== "success") return groupIds as GraphOutcome<never>;

  const documentNode = nodeRef(documentId);
  const established = new Map(loaded.document.blocks.map((block) => [nodeRef(block.blockId), block]));
  const groups: { groupId: string; items: ProposedChange[]; stagedBy: string[] }[] = [];
  let unanswered = 0;

  for (const groupId of groupIds.result) {
    const touched = await touchedSet(groupId);
    if (touched.outcome !== "success") return touched as GraphOutcome<never>;
    const candidates = await query({
      statement: "MATCH (n) WHERE n._proposal = $g RETURN GRAPH n ROOT n INCLUDE CANDIDATES",
      parameters: { g: groupId },
      proposalOverlay: groupId,
      unbounded: true,
      purpose: "proposal members",
    });
    if (candidates.outcome === "storageError") return candidates as GraphOutcome<never>;
    const staged = new Map(
      candidates.outcome === "success"
        ? candidates.result.nodes
            .filter((node) => node.revision.content?.["_proposal"] === groupId)
            .map((node) => [node.id, node])
        : [],
    );

    const items: ProposedChange[] = [];
    const named = new Set<string>();

    for (const relation of touched.result.stagedRelations) {
      if (relation.fromNodeId !== documentNode) continue;
      const target = relation.toId;
      if (relation.type === CONTAINS && !established.has(target)) {
        const node = staged.get(target);
        if (node === undefined) continue;
        named.add(target);
        items.push({
          itemId: itemId(groupId, "insert", [target]),
          groupId,
          kind: "insert",
          blockId: bareId(target),
          block: toBlock(node, ""),
        });
      }
      if (relation.type === RETIRED && established.has(target)) {
        const block = established.get(target) as BlockView;
        named.add(target);
        items.push({
          itemId: itemId(groupId, "remove", [relation.id, block.containmentId]),
          groupId,
          kind: "remove",
          blockId: block.blockId,
          block: null,
        });
      }
    }

    for (const [nodeId, node] of staged) {
      if (named.has(nodeId)) continue;
      const block = established.get(nodeId);
      if (block === undefined) continue;
      const proposed = toBlock(node, block.containmentId);
      if (sameBlock(block, proposed)) continue;
      const kind = onlyOrderDiffers(block, proposed) ? "move" : "replace";
      items.push({
        itemId: itemId(groupId, kind, [nodeId]),
        groupId,
        kind,
        blockId: block.blockId,
        block: proposed,
      });
    }

    if (items.length === 0) continue;
    unanswered += items.length;
    // Authorship is the graph's: the stager is whoever the core stamped on
    // the candidates, never a name the shell asserts. BO_0209_006
    const stagedBy = [...new Set([...staged.values()].map((node) => node.revision.createdBy))]
      .filter((name) => name !== "")
      .sort();
    groups.push({ groupId, items, stagedBy });
  }

  return {
    outcome: "success",
    result: { documentId, unanswered, groups },
  };
}

const sameBlock = (left: BlockView, right: BlockView): boolean =>
  left.kind === right.kind &&
  left.order === right.order &&
  (left.kind !== "text" ||
    right.kind !== "text" ||
    (left.role === right.role && sameRuns(left.runs, right.runs)));

const onlyOrderDiffers = (left: BlockView, right: BlockView): boolean =>
  left.kind === right.kind &&
  left.order !== right.order &&
  (left.kind !== "text" ||
    right.kind !== "text" ||
    (left.role === right.role && sameRuns(left.runs, right.runs)));

export type ProposalAnswer = "accepted" | "rejected";

export interface AnsweredItem {
  readonly itemId: string;
  readonly answer: ProposalAnswer;
  readonly dataRevision: string;
  /** The group after this answer, so a caller learns it closed without asking. */
  readonly groupState: "open" | "closed";
}

/**
 * Answers one proposed change through the kernel. Accepting performs it and
 * the document holds it from that moment; rejecting leaves the document
 * exactly as it was. A remove is two member decisions in order — the
 * retirement relation first, so the block is never detached without being
 * recorded as retired — and a decision the kernel keeps behind its
 * confirmation answers as refused rather than half-done.
 */
export async function answerDocumentProposal(input: {
  readonly itemId: string;
  readonly answer: ProposalAnswer;
  readonly override?: boolean;
}): Promise<GraphOutcome<AnsweredItem>> {
  const parsed = parseItemId(input.itemId);
  if (parsed === null) {
    return refuse("itemShape", `${input.itemId} does not name a proposed change.`);
  }
  const decision = input.answer === "accepted" ? "accept" : "reject";
  for (const member of parsed.members) {
    const outcome = await decide(decision, parsed.groupId, member, `${parsed.kind} ${input.itemId}`, input.override ?? false);
    if (outcome.outcome !== "success") return outcome as GraphOutcome<AnsweredItem>;
  }

  const state = await query({
    statement: "MATCH (g:ProposalGroup {id: $gid}) RETURN GRAPH g",
    parameters: { gid: bareId(parsed.groupId) },
    purpose: "group state after answer",
  });
  const open =
    state.outcome === "success" &&
    state.result.nodes.some((node) => node.revision.content?.["status"] === "open");
  return {
    outcome: "success",
    result: {
      itemId: input.itemId,
      answer: input.answer,
      dataRevision: state.outcome === "success" ? String(state.result.resolvedDataRevision) : "",
      groupState: open ? "open" : "closed",
    },
  };
}

