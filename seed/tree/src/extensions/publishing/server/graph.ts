import { query, type ReadNode, type ReadResult } from "~/server/ccgw/client";
import { EMPTY } from "~/server/ccgw/script";
import { typeOf } from "~/server/ccgw/nodes";
import { bareId, contentOf, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

export { allOfType, commit, commitEach, matching, one, properties, revise } from "~/server/ccgw/script";

/**
 * The work layer's rooted reads over the one graph, and the statement shapes
 * every gesture is written with. CCGW's pattern grammar takes one relation hop
 * untyped, so a read follows every relation one hop from its roots and the
 * assembler keeps the types it means; a two-hop read is two rooted queries,
 * the second seeded with the first's targets. PU_0002_002
 */

export function merge(left: ReadResult, right: ReadResult): ReadResult {
  const nodes = new Map(left.nodes.map((node) => [node.id, node]));
  for (const node of right.nodes) nodes.set(node.id, node);
  const relations = new Map(left.relations.map((relation) => [relation.id, relation]));
  for (const relation of right.relations) relations.set(relation.id, relation);
  return {
    roots: [...new Set([...left.roots, ...right.roots])],
    nodes: [...nodes.values()],
    relations: [...relations.values()],
    resolvedDataRevision: Math.max(left.resolvedDataRevision, right.resolvedDataRevision),
  };
}

/** Every relation leaving the roots, one hop, with both endpoints. */
export async function outgoing(rootIds: readonly string[]): Promise<GraphOutcome<ReadResult>> {
  if (rootIds.length === 0) return { outcome: "success", result: EMPTY };
  const outcome = await query({
    statement: "MATCH (r)-[x]->(m) RETURN GRAPH r, x, m ROOT r",
    roots: rootIds.map(nodeRef),
    unbounded: true,
    purpose: "work read",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: EMPTY };
  return outcome;
}

/** Every relation arriving at the roots, one hop, with both endpoints. */
export async function incoming(rootIds: readonly string[]): Promise<GraphOutcome<ReadResult>> {
  if (rootIds.length === 0) return { outcome: "success", result: EMPTY };
  const outcome = await query({
    statement: "MATCH (x)-[r]->(n) RETURN GRAPH x, r, n ROOT n",
    roots: rootIds.map(nodeRef),
    unbounded: true,
    purpose: "work read",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: EMPTY };
  return outcome;
}

/** The node of one identity in a read, when it is there. */
export const nodeIn = (graph: ReadResult, id: string): ReadNode | undefined =>
  graph.nodes.find((node) => node.id === nodeRef(id));

/** Every node of one semantic type in a read. */
export const nodesOfType = (graph: ReadResult, semanticType: string): ReadNode[] =>
  graph.nodes.filter((node) => typeOf(node) === semanticType);

/** The bare ids the active relations of one type from one node point at. */
export function activeTargets(graph: ReadResult, fromId: string, relationType: string): readonly string[] {
  const from = nodeRef(fromId);
  return graph.relations
    .filter(
      (relation) =>
        relation.type === relationType &&
        relation.fromNodeId === from &&
        relation.validity.status === "active" &&
        relation.to.kind === "node" &&
        relation.to.nodeId !== undefined,
    )
    .map((relation) => bareId(relation.to.nodeId as string));
}

/** The bare ids of the nodes whose active relations of one type point at one node. */
export function activeSources(graph: ReadResult, toId: string, relationType: string): readonly string[] {
  const to = nodeRef(toId);
  return graph.relations
    .filter(
      (relation) =>
        relation.type === relationType &&
        relation.validity.status === "active" &&
        relation.to.kind === "node" &&
        relation.to.nodeId === to,
    )
    .map((relation) => bareId(relation.fromNodeId));
}

/** The active relation of one type from one node to one node, when it stands. */
export function activeRelation(
  graph: ReadResult,
  fromId: string,
  relationType: string,
  toId: string,
): { readonly id: string } | undefined {
  const from = nodeRef(fromId);
  const to = nodeRef(toId);
  return graph.relations.find(
    (relation) =>
      relation.type === relationType &&
      relation.fromNodeId === from &&
      relation.validity.status === "active" &&
      relation.to.kind === "node" &&
      relation.to.nodeId === to,
  );
}

/** One relation to close, named by its own alias, its id and its origin. */
export function close(alias: string, relationId: string, fromId: string, parameters: Record<string, unknown>): string {
  parameters[`${alias}RelationId`] = relationId;
  parameters[`${alias}From`] = nodeRef(fromId);
  return `CLOSE ${alias}`;
}

/** One relation to create between two existing nodes. */
export function relate(
  alias: string,
  relationType: string,
  fromId: string,
  toId: string,
  parameters: Record<string, unknown>,
): string {
  parameters[`${alias}from`] = nodeRef(fromId);
  parameters[`${alias}to`] = nodeRef(toId);
  return `RELATE ${alias}from -[${alias}:${relationType}]-> ${alias}to`;
}

/** One node to retire. */
export function retire(alias: string, nodeId: string, parameters: Record<string, unknown>): string {
  parameters[`${alias}NodeId`] = nodeRef(nodeId);
  return `RETIRE ${alias}`;
}

export function refuse<T>(rule: string, detail: string): GraphOutcome<T> {
  return { outcome: "validationFailure", failures: [{ operation: null, rule, detail }] };
}

export const conflict = <T>(nodeId: string, expected: string, current: string): GraphOutcome<T> => ({
  outcome: "conflict",
  conflicts: [{ nodeId: nodeRef(nodeId), expectedRevisionId: expected, currentRevisionId: current }],
});

/** A node's own content, its bare id and its revision, for an assembler. */
export const read = (node: ReadNode): { readonly id: string; readonly revisionId: string; readonly content: Record<string, unknown> } => ({
  id: bareId(node.id),
  revisionId: node.revision.id,
  content: contentOf(node),
});

export const text = (content: Record<string, unknown>, key: string): string => {
  const value = content[key];
  return typeof value === "string" ? value : "";
};

export const number = (content: Record<string, unknown>, key: string): number | null => {
  const value = content[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
