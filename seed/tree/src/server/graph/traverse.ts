import type { GraphReadRequest, TraversalDirection } from "./contract";
import {
  readNodeAsOf,
  readRelationsAsOf,
  type ResolvedNode,
  type ResolvedRelation,
} from "./reads";
import type { GraphReader } from "./transaction";

export interface Traversal {
  readonly roots: readonly string[];
  readonly nodes: ReadonlyMap<string, ResolvedNode>;
  readonly relations: ReadonlyMap<string, ResolvedRelation>;
}

/** Whether a relation runs the asked-for way round the node being expanded. */
function runs(
  relation: ResolvedRelation,
  nodeId: string,
  direction: TraversalDirection,
): boolean {
  const outgoing = relation.fromNodeId === nodeId;
  const incoming =
    relation.target.kind === "node" && relation.target.nodeId === nodeId;
  if (direction === "outgoing") return outgoing;
  if (direction === "incoming") return incoming;
  return outgoing || incoming;
}

/** The nodes a relation touches. A relation target contributes no node. */
function endpointNodes(relation: ResolvedRelation): string[] {
  return relation.target.kind === "node"
    ? [relation.fromNodeId, relation.target.nodeId]
    : [relation.fromNodeId];
}

/**
 * Walks the graph from the declared roots, one step at a time, following each
 * step for the hops it asks for. A step's filter applies to every hop it
 * makes, so a node reached under one step is expanded again under the next.
 *
 * Every relation kept brings its endpoint nodes with it, even when they sit
 * past the last hop, so the result never holds a relation pointing at
 * something absent.
 */
export async function traverseGraph(
  sql: GraphReader,
  request: GraphReadRequest,
): Promise<Traversal> {
  const asOf =
    request.selection?.at === "dataRevision"
      ? request.selection.dataRevision
      : null;

  const nodes = new Map<string, ResolvedNode>();
  const relations = new Map<string, ResolvedRelation>();
  const roots: string[] = [];

  for (const rootId of request.roots) {
    if (nodes.has(rootId)) continue;
    const node = await readNodeAsOf(sql, rootId, asOf);
    if (node === null) continue;
    nodes.set(node.nodeId, node);
    roots.push(node.nodeId);
  }

  let frontier: string[] = [...roots];
  for (const step of request.traverse ?? []) {
    const expanded = new Set<string>();
    for (let hop = 0; hop < step.depth; hop += 1) {
      const next: string[] = [];
      for (const nodeId of frontier) {
        if (expanded.has(nodeId)) continue;
        expanded.add(nodeId);

        for (const relation of await readRelationsAsOf(sql, nodeId, asOf)) {
          if (!runs(relation, nodeId, step.direction)) continue;
          if (
            step.relationTypes !== undefined &&
            !step.relationTypes.includes(relation.relationType)
          ) {
            continue;
          }
          relations.set(relation.relationId, relation);

          for (const endpointId of endpointNodes(relation)) {
            if (nodes.has(endpointId)) continue;
            const node = await readNodeAsOf(sql, endpointId, asOf);
            if (node === null) continue;
            nodes.set(endpointId, node);
            next.push(endpointId);
          }
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
  }

  dropDangling(nodes, relations);
  return { roots, nodes, relations };
}

/**
 * Removes relations whose endpoints are not in the result. A relation
 * qualifying another relation is only meaningful alongside it, and a relation
 * whose target relation fell outside the read's bounds is dropped rather than
 * returned pointing at nothing. Dropping one can strand another, so this
 * repeats until nothing more falls out.
 */
function dropDangling(
  nodes: ReadonlyMap<string, ResolvedNode>,
  relations: Map<string, ResolvedRelation>,
): void {
  let settled = false;
  while (!settled) {
    settled = true;
    for (const [id, relation] of relations) {
      const missingNode = endpointNodes(relation).some(
        (nodeId) => !nodes.has(nodeId),
      );
      const missingRelation =
        relation.target.kind === "relation" &&
        !relations.has(relation.target.relationId);
      if (missingNode || missingRelation) {
        relations.delete(id);
        settled = false;
      }
    }
  }
}
