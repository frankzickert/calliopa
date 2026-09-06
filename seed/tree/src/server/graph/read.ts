import type { JSONValue } from "postgres";

import type {
  AssembledGraph,
  GraphNodeView,
  GraphReadOutcome,
  GraphReadRequest,
  GraphRelationView,
} from "./contract";
import { describe, validationOutcome } from "./outcome";
import type { ResolvedNode, ResolvedRelation } from "./reads";
import type { GraphReader } from "./transaction";
import { traverseGraph } from "./traverse";
import { validateReadRequest } from "./validation";

/** Data revisions are monotonic integers, so they order numerically. */
const byRevisionThenId = (
  leftRevision: string,
  leftId: string,
  rightRevision: string,
  rightId: string,
): number => {
  const left = BigInt(leftRevision);
  const right = BigInt(rightRevision);
  if (left !== right) return left < right ? -1 : 1;
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
};

const toNodeView = (node: ResolvedNode): GraphNodeView => ({
  nodeId: node.nodeId,
  revisionId: node.revisionId,
  semanticType: node.semanticType,
  content: node.content,
  provenance: node.provenance,
  schemaVersion: node.schemaVersion,
  dataRevision: node.dataRevision,
});

const toRelationView = (relation: ResolvedRelation): GraphRelationView => ({
  relationId: relation.relationId,
  relationType: relation.relationType,
  fromNodeId: relation.fromNodeId,
  target:
    relation.target.kind === "node"
      ? { kind: "node", nodeId: relation.target.nodeId }
      : { kind: "relation", relationId: relation.target.relationId },
  provenance: relation.provenance,
  schemaVersion: relation.schemaVersion,
  dataRevision: relation.dataRevision,
  validity: {
    status: relation.validity.status,
    establishedDataRevision: relation.validity.establishedDataRevision,
    closedDataRevision: relation.validity.closedDataRevision,
  },
});

/**
 * Reads a rooted, bounded graph and assembles it into the one response shape.
 *
 * Roots keep the order they were asked for. Nodes and relations are ordered by
 * data revision and then identity, so the same graph and the same request read
 * back the same way every time.
 *
 * A read whose roots all fail to resolve is no result rather than an empty
 * success: the consumer asked about something that is not there. A read whose
 * roots resolve is a success even when the traversal finds nothing more.
 */
export async function readGraph(
  sql: GraphReader,
  request: GraphReadRequest,
): Promise<GraphReadOutcome> {
  const invalid = validationOutcome<AssembledGraph>(validateReadRequest(request));
  if (invalid !== null) return invalid;

  let traversal;
  try {
    traversal = await traverseGraph(sql, request);
  } catch (error) {
    return { outcome: "storageError", detail: describe(error) };
  }

  if (traversal.roots.length === 0) {
    return {
      outcome: "noResult",
      detail: `No root of this read resolves at the selected revision: ${request.roots.join(", ")}.`,
    };
  }

  const nodes = [...traversal.nodes.values()]
    .sort((left, right) =>
      byRevisionThenId(
        left.dataRevision,
        left.nodeId,
        right.dataRevision,
        right.nodeId,
      ),
    )
    .map(toNodeView);

  const relations = [...traversal.relations.values()]
    .sort((left, right) =>
      byRevisionThenId(
        left.dataRevision,
        left.relationId,
        right.dataRevision,
        right.relationId,
      ),
    )
    .map(toRelationView);

  if (request.proposalGroupId === undefined) {
    const result: AssembledGraph = { roots: traversal.roots, nodes, relations };
    return { outcome: "success", result };
  }

  let overlay;
  try {
    overlay = await stagedRevisionsOf(sql, request.proposalGroupId);
  } catch (error) {
    return { outcome: "storageError", detail: describe(error) };
  }

  return {
    outcome: "success",
    result: { roots: traversal.roots, relations, ...layOver(nodes, overlay) },
  };
}

/**
 * Lays a group's staged items over the truth a read assembled. A node the
 * group staged content for answers from that content; a node the group staged
 * into being appears even though no relation reaches it yet, because the
 * relation placing it is written when the item is accepted.
 *
 * The staged nodes keep the order the rest of the read is in, so a caller
 * reading its own group back reads it the same way every time.
 */
function layOver(
  nodes: readonly GraphNodeView[],
  overlay: ReadonlyMap<string, GraphNodeView>,
): { nodes: readonly GraphNodeView[]; fromProposal: readonly string[] } {
  const seen = new Set<string>();
  const laid = nodes.map((node) => {
    const staged = overlay.get(node.nodeId);
    if (staged === undefined) return node;
    seen.add(node.nodeId);
    return staged;
  });

  const introduced = [...overlay.values()].filter(
    (node) => !seen.has(node.nodeId),
  );
  const all = [...laid, ...introduced].sort((left, right) =>
    byRevisionThenId(
      left.dataRevision,
      left.nodeId,
      right.dataRevision,
      right.nodeId,
    ),
  );

  return { nodes: all, fromProposal: [...overlay.keys()] };
}

interface StagedRow {
  node_id: string;
  revision_id: string;
  semantic_type: string;
  content: JSONValue;
  provenance: JSONValue;
  schema_version: number;
  data_revision: string;
}

/** The candidate revisions one group has staged and not yet had answered. */
async function stagedRevisionsOf(
  sql: GraphReader,
  groupId: string,
): Promise<ReadonlyMap<string, GraphNodeView>> {
  const rows = await sql<StagedRow[]>`
    select r.node_id, r.id as revision_id, r.semantic_type, r.content,
           r.provenance, r.schema_version,
           r.created_data_revision as data_revision
      from graph_proposal_item i
      join graph_node_revision r on r.id = i.staged_revision_id
     where i.group_id = ${groupId} and i.answer is null
     order by i.ordinal
  `;
  return new Map(
    rows.map((row) => [
      row.node_id,
      {
        nodeId: row.node_id,
        revisionId: row.revision_id,
        semanticType: row.semantic_type,
        content: row.content,
        provenance: row.provenance,
        schemaVersion: row.schema_version,
        dataRevision: row.data_revision,
      },
    ]),
  );
}
