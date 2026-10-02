
import { port } from "~/server/port";
import { normalizeRuns, type Run } from "~/lib/runs";
import { query, type ReadNode, type ReadResult } from "~/server/ccgw/client";
import type { GraphOutcome } from "~/server/outcome";
import { CONTAINS, type DocumentView } from "./assemble";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * The relation between two blocks as this extension stages and draws it
 * (`BO_0244`, anchored on blocks since `BO_0288_002`): a `relation` node
 * carrying its kind, its reason, its origin and its state, joined to its
 * source and target blocks by `source` and `target` edges. A relation is a
 * node because a `Relation` stores no properties and the reason is what
 * carries consequence; its edges leave the relation node, so staging one
 * revises neither block. The vocabulary is `relations`'; this module compiles
 * the proposal items a run or a reader stages against it and reads them back
 * for review, and `work-ops.ts` writes a relation's reason and state as truth.
 */

export const RELATION_TYPE = "relation";
export const SOURCE = "source";
export const TARGET = "target";

/** What a relation says the source does to the target (`BO_0244`). */
export const RELATION_KINDS = [
  "dependsOn",
  "supports",
  "contradicts",
  "qualifies",
  "constrains",
  "implements",
  "supersedes",
  "evidences",
  "opensQuestionIn",
  "affectedBy",
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const RELATION_ORIGINS = ["declared", "derived", "inferred"] as const;
export type RelationOrigin = (typeof RELATION_ORIGINS)[number];

/** A relation's lifecycle state, as `relations` declares it. */
export const RELATION_STATES = ["declared", "exercised", "needsReview", "orphaned", "retired"] as const;
export type RelationState = (typeof RELATION_STATES)[number];

export const isRelationKind = (value: unknown): value is RelationKind =>
  typeof value === "string" && (RELATION_KINDS as readonly string[]).includes(value);
export const isRelationOrigin = (value: unknown): value is RelationOrigin =>
  typeof value === "string" && (RELATION_ORIGINS as readonly string[]).includes(value);
export const isRelationState = (value: unknown): value is RelationState =>
  typeof value === "string" && (RELATION_STATES as readonly string[]).includes(value);

/** One end of a relation: the block, its words, and the document holding it,
 * wherever it is. */
export interface RelationEnd {
  readonly blockId: string;
  readonly documentId: string;
  readonly documentTitle: string;
  readonly text: readonly Run[];
}

export interface RelationView {
  readonly relationId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly kind: string;
  readonly reason: readonly Run[];
  readonly origin: string;
  readonly state: RelationState;
  readonly source: RelationEnd;
  readonly target: RelationEnd;
}

const runsOf = (value: unknown): readonly Run[] =>
  Array.isArray(value) ? normalizeRuns(value as readonly Run[]) : [];

const stateOf = (value: unknown): RelationState => (isRelationState(value) ? value : "declared");

/** A rooted read, empty rather than a refusal when nothing is reached. */
async function rooted(
  statement: string,
  roots: readonly string[],
  purpose: string,
  proposalOverlay?: string,
): Promise<GraphOutcome<ReadResult>> {
  if (roots.length === 0) {
    return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  }
  const outcome = await query({
    statement,
    roots,
    unbounded: true,
    purpose,
    ...(proposalOverlay === undefined ? {} : { proposalOverlay }),
  });
  if (outcome.outcome === "noResult") {
    return { outcome: "success", result: { roots: [], nodes: [], relations: [], resolvedDataRevision: 0 } };
  }
  return outcome;
}

/** The relation nodes standing on the given blocks, by either end. */
export async function relationsOnBlocks(
  blockRefs: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<readonly string[]>> {
  const reverse = await rooted(
    `MATCH (r:${RELATION_TYPE})-[e]->(b) RETURN GRAPH r, e, b ROOT b`,
    [...blockRefs].sort(),
    "relations on blocks",
    proposalOverlay,
  );
  if (reverse.outcome !== "success") return reverse as GraphOutcome<never>;
  return { outcome: "success", result: reverse.result.nodes.filter((node) => typeOf(node) === RELATION_TYPE).map((node) => node.id).sort() };
}

/** The given relation nodes with their source and target block refs. */
export async function readRelationEnds(
  relationRefs: readonly string[],
  proposalOverlay?: string,
): Promise<GraphOutcome<readonly { readonly node: ReadNode; readonly source: string; readonly target: string }[]>> {
  const forward = await rooted(
    `MATCH (r:${RELATION_TYPE})-[e]->(b) RETURN GRAPH r, e, b ROOT r`,
    [...relationRefs].sort(),
    "relation ends",
    proposalOverlay,
  );
  if (forward.outcome !== "success") return forward as GraphOutcome<never>;
  const nodes = new Map(forward.result.nodes.map((node) => [node.id, node]));
  const ends = new Map<string, { source: string; target: string }>();
  for (const relation of forward.result.relations) {
    if ((relation.type !== SOURCE && relation.type !== TARGET) || relation.validity.status !== "active") continue;
    if (relation.to.nodeId === undefined || nodes.get(relation.fromNodeId) === undefined) continue;
    const pair = ends.get(relation.fromNodeId) ?? { source: "", target: "" };
    pair[relation.type] = relation.to.nodeId;
    ends.set(relation.fromNodeId, pair);
  }
  return {
    outcome: "success",
    result: [...ends.entries()]
      .filter(([ref]) => typeOf(nodes.get(ref) as ReadNode) === RELATION_TYPE)
      .map(([ref, pair]) => ({ node: nodes.get(ref) as ReadNode, ...pair }))
      .sort((left, right) => (left.node.id < right.node.id ? -1 : 1)),
  };
}

export function relationOf(node: ReadNode, source: RelationEnd, target: RelationEnd): RelationView {
  const content = contentOf(node);
  return {
    relationId: bareId(node.id),
    revisionId: node.revision.id,
    status: node.revision.status,
    kind: typeof content["kind"] === "string" ? content["kind"] : "",
    reason: runsOf(content["reason"]),
    origin: typeof content["origin"] === "string" ? content["origin"] : "",
    state: stateOf(content["state"]),
    source,
    target,
  };
}

/** One end of a relation as a caller names it: a block. */
export interface RelationEndInput {
  readonly blockId: string;
}

export interface RelationInput {
  readonly kind: RelationKind;
  readonly reason: readonly Run[];
  readonly origin?: RelationOrigin;
  readonly source: RelationEndInput;
  readonly target: RelationEndInput;
}

/** The statements that create a relation node between two blocks. */
export function relationScript(
  alias: string,
  relation: { readonly kind: string; readonly reason: readonly Run[]; readonly origin: string },
  sourceBlockId: string,
  targetBlockId: string,
  parameters: Record<string, unknown>,
  established: boolean,
): { readonly relationId: string; readonly statements: readonly string[] } {
  const relationId = port.uuid();
  parameters[`${alias}_id`] = relationId;
  parameters[`${alias}_kind`] = relation.kind;
  parameters[`${alias}_reason`] = normalizeRuns([...relation.reason]);
  parameters[`${alias}_origin`] = relation.origin;
  parameters[`${alias}rs`] = nodeRef(relationId);
  parameters[`${alias}rt`] = nodeRef(relationId);
  parameters[`${alias}bs`] = nodeRef(sourceBlockId);
  parameters[`${alias}bt`] = nodeRef(targetBlockId);
  const status = established ? `, status: "established"` : "";
  return {
    relationId,
    statements: [
      `CREATE (${alias}:${RELATION_TYPE} {id: $${alias}_id, kind: $${alias}_kind, reason: $${alias}_reason, origin: $${alias}_origin${status}})`,
      `RELATE ${alias}rs -[${alias}es:${SOURCE}]-> ${alias}bs`,
      `RELATE ${alias}rt -[${alias}et:${TARGET}]-> ${alias}bt`,
    ],
  };
}

/**
 * A block another document holds, as a relation end may name one: it must
 * stand at head and be held by an active containment — a retired block holds
 * no anchor. Answers its words and its document.
 */
export async function farBlock(blockId: string): Promise<GraphOutcome<RelationEnd>> {
  const ref = nodeRef(blockId);
  const held = await rooted(`MATCH (d:${DOCUMENT_TYPE})-[k:${CONTAINS}]->(b) RETURN GRAPH d, k, b ROOT b`, [ref], "relation end");
  if (held.outcome !== "success") return held as GraphOutcome<never>;
  const node = held.result.nodes.find((candidate) => candidate.id === ref);
  if (node === undefined) {
    return { outcome: "noResult", detail: `Block ${blockId} is not in the graph.` };
  }
  const containment = held.result.relations.find(
    (relation) => relation.type === CONTAINS && relation.validity.status === "active" && relation.to.nodeId === ref,
  );
  if (containment === undefined) {
    return { outcome: "validationFailure", failures: [{ operation: null, rule: "retiredBlock", detail: `Block ${blockId} is retired; a relation never anchors on a retired block.` }] };
  }
  const holder = held.result.nodes.find((candidate) => candidate.id === containment.fromNodeId);
  const title = holder === undefined ? undefined : contentOf(holder)["title"];
  return {
    outcome: "success",
    result: {
      blockId,
      documentId: holder === undefined ? "" : bareId(holder.id),
      documentTitle: typeof title === "string" ? title : "",
      text: runsOf(contentOf(node)["runs"]),
    },
  };
}

/** A block of the given document as a relation end. */
export const endHere = (document: DocumentView, blockId: string): RelationEnd | null => {
  const block = document.blocks.find((candidate) => candidate.blockId === blockId);
  if (block === undefined) return null;
  return { blockId, documentId: document.documentId, documentTitle: document.title, text: block.kind === "text" ? block.runs : [] };
};
