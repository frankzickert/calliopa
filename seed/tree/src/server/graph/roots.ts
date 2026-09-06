import type {
  ResolvedRoots,
  RootResolutionOutcome,
  RootResolutionRequest,
} from "./contract";
import { graphScopeId } from "./nodes";
import { describe, validationOutcome } from "./outcome";
import type { GraphReader } from "./transaction";
import { validateRootResolutionRequest } from "./validation";

interface RootRow {
  node_id: string;
}

/**
 * The nodes of one semantic type in the graph scope, as logical identities in
 * creation order.
 *
 * This is not a traversal. It follows no relation and returns no revision
 * content, so it cannot stand in for a read: a consumer that needs content
 * feeds these identities into a rooted read. It exists because a feature
 * listing every node of a kind has no root to name, and the gateway is the
 * only way into the graph.
 *
 * Creation order is the earliest data revision any revision of the node
 * carries, so revising a node never moves it. Identity breaks a tie, which
 * only happens when nodes were created in one transaction.
 *
 * A type with no nodes answers an empty result. An unknown type is
 * indistinguishable from an unused one, so neither is a refusal.
 */
export async function resolveRoots(
  sql: GraphReader,
  request: RootResolutionRequest,
): Promise<RootResolutionOutcome> {
  const invalid = validationOutcome<ResolvedRoots>(
    validateRootResolutionRequest(request),
  );
  if (invalid !== null) return invalid;

  try {
    const scopeId = await graphScopeId(sql);
    const rows = await sql<RootRow[]>`
      select revision.node_id
      from graph_node_revision revision
      join graph_node node on node.id = revision.node_id
      where node.scope_id = ${scopeId}
        and exists (
          select 1
          from graph_node_revision established
          where established.node_id = revision.node_id
            and established.lifecycle = 'established'
            and established.semantic_type = ${request.semanticType}
        )
      group by revision.node_id
      order by min(revision.created_data_revision), revision.node_id
    `;
    return {
      outcome: "success",
      result: {
        semanticType: request.semanticType,
        nodeIds: rows.map((row) => row.node_id),
      },
    };
  } catch (error) {
    return { outcome: "storageError", detail: describe(error) };
  }
}
