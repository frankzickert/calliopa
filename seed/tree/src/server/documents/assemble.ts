import type { JSONValue } from "postgres";

import { byOrder, isOrderKey } from "../../lib/order";
import type { AssembledGraph, GraphNodeView } from "../graph/contract";
import { asRecord } from "./content";
import {
  DOCUMENT_TYPE,
  normalizeRuns,
  TEXT_ROLES,
  type Run,
  type TextRole,
} from "./vocabulary";

/**
 * Turning an assembled graph into an ordered document.
 *
 * Assembly is pure, so ordering, role defaulting, and the treatment of a block
 * type this build does not know are settled without a database. The graph read
 * that feeds it lives in `documents.ts`.
 */

interface BlockCommon {
  readonly blockId: string;
  readonly revisionId: string;
  /** The relation placing this block in its document, so a caller closing or
   * moving it does not have to find the relation again. */
  readonly containmentId: string;
  /** The stored order key, or the empty string when the block carries none. */
  readonly order: string;
}

export interface TextBlockView extends BlockCommon {
  readonly kind: "text";
  readonly role: TextRole;
  readonly runs: readonly Run[];
}

export interface DividerBlockView extends BlockCommon {
  readonly kind: "divider";
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
  readonly content: JSONValue;
}

export type BlockView = TextBlockView | DividerBlockView | UnsupportedBlockView;

export interface DocumentView {
  readonly documentId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly blocks: readonly BlockView[];
}

const orderOf = (value: JSONValue): string => {
  const content = asRecord(value);
  if (content === null) return "";
  const order = content["order"];
  return typeof order === "string" && isOrderKey(order) ? order : "";
};

/**
 * One block as the document reads it. Exported because a proposed block is
 * read the same way as a stored one: the surface reviewing an item must not
 * learn a second account of what a block is.
 */
export function toBlock(
  node: GraphNodeView,
  containmentId: string,
): BlockView {
  const order = orderOf(node.content);
  const common = {
    blockId: node.nodeId,
    revisionId: node.revisionId,
    containmentId,
    order,
  };
  const content = asRecord(node.content);

  if (node.semanticType === "text" && content !== null) {
    const runs = Array.isArray(content["runs"])
      ? normalizeRuns(content["runs"] as readonly Run[])
      : [];
    const stored = content["role"];
    const role = TEXT_ROLES.includes(stored as TextRole)
      ? (stored as TextRole)
      : "paragraph";
    return { ...common, kind: "text", role, runs };
  }

  if (node.semanticType === "divider" && content !== null) {
    return { ...common, kind: "divider" };
  }

  return {
    ...common,
    kind: "unsupported",
    semanticType: node.semanticType,
    content: node.content,
  };
}

/**
 * The blocks a relation type attaches to a document, in deterministic order.
 *
 * Blocks carrying a usable order key come first in key order. A block with no
 * usable key — which only a future or malformed block type produces — sorts
 * after them by identity, so it stays visible and lands in the same place on
 * every read.
 */
function blocksOf(
  graph: AssembledGraph,
  documentId: string,
  relationType: string,
): BlockView[] {
  const nodes = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const blocks: BlockView[] = [];

  for (const relation of graph.relations) {
    if (relation.relationType !== relationType) continue;
    if (relation.fromNodeId !== documentId) continue;
    if (relation.target.kind !== "node") continue;
    const node = nodes.get(relation.target.nodeId);
    if (node === undefined) continue;
    blocks.push(toBlock(node, relation.relationId));
  }

  const ordered = blocks.filter((block) => block.order !== "");
  const unplaced = blocks
    .filter((block) => block.order === "")
    .sort((left, right) => (left.blockId < right.blockId ? -1 : 1));
  return [...byOrder(ordered), ...unplaced];
}

/** The document at the root of this graph, with its blocks in order, or null
 * when the graph holds no such document. */
export function assembleDocument(
  graph: AssembledGraph,
  documentId: string,
): DocumentView | null {
  const node = graph.nodes.find(
    (candidate) =>
      candidate.nodeId === documentId &&
      candidate.semanticType === DOCUMENT_TYPE,
  );
  if (node === undefined) return null;

  const title = asRecord(node.content)?.["title"];
  return {
    documentId: node.nodeId,
    revisionId: node.revisionId,
    title: typeof title === "string" ? title : "",
    blocks: blocksOf(graph, documentId, "contains"),
  };
}

/** The blocks retired from this document, in the order they last held. */
export function assembleRetired(
  graph: AssembledGraph,
  documentId: string,
): BlockView[] {
  return blocksOf(graph, documentId, "retired");
}
