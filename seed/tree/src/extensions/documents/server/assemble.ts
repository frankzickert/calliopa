import { readStanding, type Standing } from "~/extensions/documents/lib/disposition";
import type { Proposer } from "~/extensions/documents/lib/proposals";
import { byOrder, isOrderKey } from "~/lib/order";
import type { ReadNode, ReadResult } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import {
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
}

export interface TextBlockView extends BlockCommon {
  readonly kind: "text";
  readonly role: TextRole;
  readonly runs: readonly Run[];
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
  /** The root's phase, absent while proposed (`BO_0249`). */
  readonly phase?: Phase;
  /** The root that superseded this one, with `phase` superseded. */
  readonly supersededBy?: string;
  readonly blocks: readonly BlockView[];
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
    return {
      ...common,
      kind: "text",
      role,
      runs,
      standing,
      ...(typeof blockKind === "string" && blockKind !== "" ? { blockKind } : {}),
    };
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
export function assembleDocument(
  graph: ReadResult,
  documentId: string,
): DocumentView | null {
  const node = documentNodeOf(graph, documentId);
  if (node === undefined) return null;

  const content = contentOf(node);
  const title = content["title"];
  const phase = content[PHASE_PROPERTY];
  const supersededBy = content[SUPERSEDED_BY_PROPERTY];
  return {
    documentId: bareId(node.id),
    revisionId: node.revision.id,
    title: typeof title === "string" ? title : "",
    ...(isPhase(phase) && phase !== "proposed" ? { phase } : {}),
    ...(typeof supersededBy === "string" && supersededBy !== "" ? { supersededBy } : {}),
    blocks: blocksOf(graph, documentId, CONTAINS),
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
