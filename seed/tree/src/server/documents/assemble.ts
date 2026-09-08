import { byOrder, isOrderKey } from "../../lib/order";
import type { ReadNode, ReadResult } from "../ccgw/client";
import {
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

export const nodeRef = (id: string): string =>
  id.startsWith("node:") ? id : `node:${id}`;
export const bareId = (nodeId: string): string =>
  nodeId.startsWith("node:") ? nodeId.slice("node:".length) : nodeId;

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
  readonly content: Record<string, unknown>;
}

export type BlockView = TextBlockView | DividerBlockView | UnsupportedBlockView;

export interface DocumentView {
  readonly documentId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly blocks: readonly BlockView[];
}

/** The semantic type a CCGW revision carries, from its content or its metadata. */
export const typeOf = (node: ReadNode): string => {
  const content = node.revision.content;
  const stored = content === undefined ? node.revision.type : content["_type"];
  return typeof stored === "string" ? stored : "";
};

/** A revision's content without the reserved keys the core stamps into it. */
export function contentOf(node: ReadNode): Record<string, unknown> {
  const content = node.revision.content ?? {};
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith("_") || key === "id") continue;
    own[key] = value;
  }
  return own;
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
  };

  if (semanticType === "text") {
    const runs = Array.isArray(content["runs"])
      ? normalizeRuns(content["runs"] as readonly Run[])
      : [];
    const stored = content["role"];
    const role = TEXT_ROLES.includes(stored as TextRole)
      ? (stored as TextRole)
      : "paragraph";
    return { ...common, kind: "text", role, runs };
  }

  if (semanticType === "divider") {
    return { ...common, kind: "divider" };
  }

  return {
    ...common,
    kind: "unsupported",
    semanticType,
    content,
  };
}

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
  return graph.nodes.find(
    (candidate) =>
      candidate.id === id &&
      typeOf(candidate) === DOCUMENT_TYPE &&
      candidate.revision.status === "established",
  );
}

/** The document at the root of this graph, with its blocks in order, or null
 * when the graph holds no such document. */
export function assembleDocument(
  graph: ReadResult,
  documentId: string,
): DocumentView | null {
  const node = documentNodeOf(graph, documentId);
  if (node === undefined) return null;

  const title = contentOf(node)["title"];
  return {
    documentId: bareId(node.id),
    revisionId: node.revision.id,
    title: typeof title === "string" ? title : "",
    blocks: blocksOf(graph, documentId, CONTAINS),
  };
}

/** The blocks retired from this document, in the order they last held. */
export function assembleRetired(
  graph: ReadResult,
  documentId: string,
): BlockView[] {
  return blocksOf(graph, documentId, RETIRED);
}
