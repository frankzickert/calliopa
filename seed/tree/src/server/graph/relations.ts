import type { JSONValue } from "postgres";

import { establishedRevisionId, graphScopeId } from "./nodes";
import type { GraphTransaction } from "./transaction";

export type RelationTarget =
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "relation"; readonly relationId: string };

export interface RelationInput {
  readonly relationType: string;
  readonly fromNodeId: string;
  readonly target: RelationTarget;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
}

/** The revision a relation's endpoint is anchored to when it is created. */
async function anchorRevisionId(
  transaction: GraphTransaction,
  nodeId: string,
  role: string,
): Promise<string> {
  const revisionId = await establishedRevisionId(transaction.sql, nodeId);
  if (revisionId === null) {
    throw new Error(
      `The ${role} node ${nodeId} has no established revision to relate.`,
    );
  }
  return revisionId;
}

async function assertTargetRelationVisible(
  { sql }: GraphTransaction,
  relationId: string,
): Promise<void> {
  const [row] = await sql<{ status: string }[]>`
    select status from graph_relation_validity where relation_id = ${relationId}
  `;
  if (row === undefined || row.status !== "active") {
    throw new Error(
      `The target relation ${relationId} is not active and cannot be related.`,
    );
  }
}

/**
 * Creates a relation and opens its validity against the revisions its
 * endpoints hold now. The relation itself never changes again; changing what
 * it says means closing this one and creating another.
 */
export async function createRelation(
  transaction: GraphTransaction,
  input: RelationInput,
): Promise<string> {
  const { sql, dataRevision } = transaction;
  const scopeId = await graphScopeId(sql);
  const originRevisionId = await anchorRevisionId(
    transaction,
    input.fromNodeId,
    "origin",
  );

  let targetNodeId: string | null = null;
  let targetRevisionId: string | null = null;
  let targetRelationId: string | null = null;
  if (input.target.kind === "node") {
    targetNodeId = input.target.nodeId;
    targetRevisionId = await anchorRevisionId(
      transaction,
      targetNodeId,
      "target",
    );
  } else {
    targetRelationId = input.target.relationId;
    await assertTargetRelationVisible(transaction, targetRelationId);
  }

  const [relation] = await sql<{ id: string }[]>`
    insert into graph_relation (
      scope_id, relation_type, from_node_id, to_node_id, to_relation_id,
      provenance, schema_version, data_revision
    ) values (
      ${scopeId}, ${input.relationType}, ${input.fromNodeId}, ${targetNodeId},
      ${targetRelationId}, ${sql.json(input.provenance)},
      ${input.schemaVersion}, ${dataRevision}
    ) returning id
  `;
  if (relation === undefined) {
    throw new Error("The relation was not written.");
  }

  await sql`
    insert into graph_relation_validity (
      relation_id, scope_id, status, origin_node_id, origin_from_revision_id,
      target_node_id, target_from_revision_id, target_relation_id,
      established_by, established_data_revision
    ) values (
      ${relation.id}, ${scopeId}, 'active', ${input.fromNodeId},
      ${originRevisionId}, ${targetNodeId}, ${targetRevisionId},
      ${targetRelationId}, ${sql.json(input.provenance)}, ${dataRevision}
    )
  `;

  return relation.id;
}

/**
 * Closes a relation's validity. The relation row survives untouched, so
 * history keeps saying that this relation once applied.
 */
export async function closeRelation(
  { sql, dataRevision }: GraphTransaction,
  relationId: string,
  closedBy: JSONValue,
): Promise<void> {
  const rows = await sql`
    update graph_relation_validity
    set status = 'closed', closed_by = ${sql.json(closedBy)},
        closed_data_revision = ${dataRevision}, updated_at = now()
    where relation_id = ${relationId} and status = 'active'
    returning relation_id
  `;
  if (rows.length === 0) {
    throw new Error(`No active relation ${relationId} to close in this graph.`);
  }
}
