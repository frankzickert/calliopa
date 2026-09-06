import type { JSONValue } from "postgres";

import type { RelationTarget } from "./relations";
import type { GraphReader } from "./transaction";

export interface ResolvedNode {
  readonly nodeId: string;
  readonly revisionId: string;
  readonly content: JSONValue;
  readonly semanticType: string;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
  readonly dataRevision: string;
}

export interface RelationValidity {
  readonly status: "active" | "closed";
  readonly establishedDataRevision: string;
  readonly closedDataRevision: string | null;
}

export interface ResolvedRelation {
  readonly relationId: string;
  readonly relationType: string;
  readonly fromNodeId: string;
  readonly target: RelationTarget;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
  readonly dataRevision: string;
  /** The window this relation applied in, as it stood for this read. */
  readonly validity: RelationValidity;
}

interface NodeRow {
  node_id: string;
  revision_id: string;
  content: JSONValue;
  semantic_type: string;
  provenance: JSONValue;
  schema_version: number;
  data_revision: string;
}

interface RelationRow {
  id: string;
  relation_type: string;
  from_node_id: string;
  to_node_id: string | null;
  to_relation_id: string | null;
  provenance: JSONValue;
  schema_version: number;
  data_revision: string;
  status: "active" | "closed";
  established_data_revision: string;
  closed_data_revision: string | null;
}

const toNode = (row: NodeRow): ResolvedNode => ({
  nodeId: row.node_id,
  revisionId: row.revision_id,
  content: row.content,
  semanticType: row.semantic_type,
  provenance: row.provenance,
  schemaVersion: row.schema_version,
  dataRevision: row.data_revision,
});

const toRelation = (row: RelationRow): ResolvedRelation => ({
  relationId: row.id,
  relationType: row.relation_type,
  fromNodeId: row.from_node_id,
  target:
    row.to_node_id === null
      ? { kind: "relation", relationId: row.to_relation_id as string }
      : { kind: "node", nodeId: row.to_node_id },
  provenance: row.provenance,
  schemaVersion: row.schema_version,
  dataRevision: row.data_revision,
  validity: {
    status: row.status,
    establishedDataRevision: row.established_data_revision,
    closedDataRevision: row.closed_data_revision,
  },
});

/**
 * Resolves a node at a point in the graph's history. `asOf` is a data
 * revision; `null` means current state.
 *
 * A revision held truth at a point when it had been established by then and
 * had not been superseded yet. Both halves are read from stamps of their own:
 * a revision staged and accepted later became truth at its establishment
 * rather than at its creation, and one that was never accepted carries no
 * establishment stamp and so held truth at no point at all.
 */
export async function readNodeAsOf(
  sql: GraphReader,
  nodeId: string,
  asOf: string | null,
): Promise<ResolvedNode | null> {
  const [row] = await sql<NodeRow[]>`
    select node_id, id as revision_id, content, semantic_type, provenance,
           schema_version, created_data_revision as data_revision
    from graph_node_revision
    where node_id = ${nodeId}
      and (
        (${asOf}::bigint is null and lifecycle = 'established')
        or (
          ${asOf}::bigint is not null
          and established_data_revision <= ${asOf}::bigint
          and (
            lifecycle = 'established'
            or lifecycle_data_revision > ${asOf}::bigint
          )
        )
      )
  `;
  return row === undefined ? null : toNode(row);
}

/** The revision of a node that currently holds established truth. */
export async function readCurrentNode(
  sql: GraphReader,
  nodeId: string,
): Promise<ResolvedNode | null> {
  return readNodeAsOf(sql, nodeId, null);
}

/**
 * The relations that applied at a point and touch this node, in either
 * direction. `asOf` is a data revision; `null` means current state.
 *
 * A relation is returned only when its endpoints were visible at that point
 * too, and a relation targeting another relation is resolved recursively.
 */
export async function readRelationsAsOf(
  sql: GraphReader,
  nodeId: string,
  asOf: string | null,
): Promise<ResolvedRelation[]> {
  const rows = await sql<RelationRow[]>`
    with recursive established as (
      select node_id, id as revision_id,
             created_data_revision as created
      from graph_node_revision
      where (
        (${asOf}::bigint is null and lifecycle = 'established')
        or (
          ${asOf}::bigint is not null
          and established_data_revision <= ${asOf}::bigint
          and (
            lifecycle = 'established'
            or lifecycle_data_revision > ${asOf}::bigint
          )
        )
      )
    ),
    applies as (
      select rel.id, rel.to_relation_id
      from graph_relation rel
      join graph_relation_validity validity
        on validity.relation_id = rel.id
      join established origin on origin.node_id = validity.origin_node_id
      join graph_node_revision origin_from
        on origin_from.id = validity.origin_from_revision_id
      left join graph_node_revision origin_to
        on origin_to.id = validity.origin_to_revision_id
      where (
          (${asOf}::bigint is null and validity.status = 'active')
          or (
            ${asOf}::bigint is not null
            and validity.established_data_revision <= ${asOf}::bigint
            and (
              validity.status = 'active'
              or validity.closed_data_revision > ${asOf}::bigint
            )
          )
        )
        and origin.created >= origin_from.created_data_revision
        and (
          origin_to.id is null
          or origin.created < origin_to.created_data_revision
        )
        and (
          rel.to_node_id is null
          or exists (
            select 1
            from established target
            join graph_node_revision target_from
              on target_from.id = validity.target_from_revision_id
            left join graph_node_revision target_to
              on target_to.id = validity.target_to_revision_id
            where target.node_id = rel.to_node_id
              and target.created >= target_from.created_data_revision
              and (
                target_to.id is null
                or target.created < target_to.created_data_revision
              )
          )
        )
    ),
    visible as (
      select id from applies where to_relation_id is null
      union
      select applies.id
      from applies
      join visible on visible.id = applies.to_relation_id
    )
    select rel.id, rel.relation_type, rel.from_node_id, rel.to_node_id,
           rel.to_relation_id, rel.provenance, rel.schema_version,
           rel.data_revision, validity.status,
           validity.established_data_revision, validity.closed_data_revision
    from graph_relation rel
    join visible on visible.id = rel.id
    join graph_relation_validity validity on validity.relation_id = rel.id
    where rel.from_node_id = ${nodeId} or rel.to_node_id = ${nodeId}
    order by rel.data_revision, rel.id
  `;
  return rows.map(toRelation);
}

/**
 * The relations that currently apply and touch this node, in either direction.
 * A relation is only returned when its endpoints are visible too.
 */
export async function readCurrentRelations(
  sql: GraphReader,
  nodeId: string,
): Promise<ResolvedRelation[]> {
  return readRelationsAsOf(sql, nodeId, null);
}

export interface RelationSummary {
  readonly relationId: string;
  readonly relationType: string;
  readonly status: "active" | "closed";
}

/**
 * A relation by identity, with whether it still applies. Resolving a relation
 * this way needs no traversal, which is what a write checking an endpoint or a
 * closure wants.
 */
export async function readRelationSummary(
  sql: GraphReader,
  relationId: string,
): Promise<RelationSummary | null> {
  const [row] = await sql<
    { id: string; relation_type: string; status: "active" | "closed" }[]
  >`
    select rel.id, rel.relation_type, validity.status
    from graph_relation rel
    join graph_relation_validity validity on validity.relation_id = rel.id
    where rel.id = ${relationId}
  `;
  return row === undefined
    ? null
    : {
        relationId: row.id,
        relationType: row.relation_type,
        status: row.status,
      };
}
