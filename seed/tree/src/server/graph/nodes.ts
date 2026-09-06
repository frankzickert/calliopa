import type { JSONValue } from "postgres";

import type { GraphReader, GraphTransaction } from "./transaction";

export interface RevisionContent {
  readonly content: JSONValue;
  readonly semanticType: string;
  readonly provenance: JSONValue;
  readonly schemaVersion: number;
}

export interface WrittenRevision {
  readonly nodeId: string;
  readonly revisionId: string;
}

/** The scope every record written to this graph carries. */
export async function graphScopeId(sql: GraphReader): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select id from graph_scope where name = 'calliopa'
  `;
  if (row === undefined) {
    throw new Error("The graph has no provisioned scope.");
  }
  return row.id;
}

/** The revision of a node that currently holds established truth. */
export async function establishedRevisionId(
  sql: GraphReader,
  nodeId: string,
): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`
    select id from graph_node_revision
    where node_id = ${nodeId} and lifecycle = 'established'
  `;
  return row?.id ?? null;
}

/**
 * The state a revision is created in. A revision is written as truth or staged
 * for review; `archived` and `rejected` are answers, never starting points.
 */
type CreatedLifecycle = "candidate" | "established";

async function insertRevision(
  { sql, dataRevision }: GraphTransaction,
  nodeId: string,
  scopeId: string,
  parentRevisionId: string | null,
  revision: RevisionContent,
  lifecycle: CreatedLifecycle,
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into graph_node_revision (
      node_id, scope_id, content, semantic_type, lifecycle, parent_revision_id,
      provenance, schema_version, created_data_revision,
      lifecycle_data_revision, established_data_revision, established_at
    ) values (
      ${nodeId}, ${scopeId}, ${sql.json(revision.content)},
      ${revision.semanticType}, ${lifecycle}, ${parentRevisionId},
      ${sql.json(revision.provenance)}, ${revision.schemaVersion},
      ${dataRevision}, ${dataRevision},
      ${lifecycle === "established" ? dataRevision : null},
      ${lifecycle === "established" ? sql`now()` : null}
    ) returning id
  `;
  if (row === undefined) {
    throw new Error("The revision was not written.");
  }
  return row.id;
}

/** The scope of a node that exists, refusing one that does not. */
async function nodeScopeId(
  sql: GraphReader,
  nodeId: string,
): Promise<string> {
  const [node] = await sql<{ scope_id: string }[]>`
    select scope_id from graph_node where id = ${nodeId}
  `;
  if (node === undefined) {
    throw new Error(`No node ${nodeId} in this graph.`);
  }
  return node.scope_id;
}

async function insertNode(
  transaction: GraphTransaction,
  revision: RevisionContent,
  lifecycle: CreatedLifecycle,
): Promise<WrittenRevision> {
  const { sql } = transaction;
  const scopeId = await graphScopeId(sql);
  const [node] = await sql<{ id: string }[]>`
    insert into graph_node (scope_id) values (${scopeId}) returning id
  `;
  if (node === undefined) {
    throw new Error("The node was not written.");
  }
  return {
    nodeId: node.id,
    revisionId: await insertRevision(
      transaction,
      node.id,
      scopeId,
      null,
      revision,
      lifecycle,
    ),
  };
}

/**
 * Creates a node and its first established revision. Identity is minted here
 * and never changes again, whatever happens to the content.
 */
export async function createNode(
  transaction: GraphTransaction,
  revision: RevisionContent,
): Promise<WrittenRevision> {
  return insertNode(transaction, revision, "established");
}

/**
 * Creates a node whose first revision is staged rather than true. The node
 * exists and holds no established truth, so nothing reads it until the
 * candidate is established.
 */
export async function stageNode(
  transaction: GraphTransaction,
  revision: RevisionContent,
): Promise<WrittenRevision> {
  return insertNode(transaction, revision, "candidate");
}

/**
 * Archives a revision. This is the only lifecycle transition the graph
 * performs: it restates how the revision stands and never touches its content.
 */
export async function archiveRevision(
  { sql, dataRevision }: GraphTransaction,
  revisionId: string,
): Promise<void> {
  const rows = await sql`
    update graph_node_revision
    set lifecycle = 'archived', lifecycle_data_revision = ${dataRevision}
    where id = ${revisionId} and lifecycle = 'established'
    returning id
  `;
  if (rows.length === 0) {
    throw new Error(
      `No established revision ${revisionId} to archive in this graph.`,
    );
  }
}

/**
 * Adds a revision to an existing node. The outgoing revision is archived
 * before the incoming one is inserted, because at most one revision of a node
 * is established and the database checks that per statement.
 */
export async function reviseNode(
  transaction: GraphTransaction,
  nodeId: string,
  revision: RevisionContent,
): Promise<WrittenRevision> {
  const { sql } = transaction;
  const scopeId = await nodeScopeId(sql, nodeId);

  const parentRevisionId = await establishedRevisionId(sql, nodeId);
  if (parentRevisionId !== null) {
    await archiveRevision(transaction, parentRevisionId);
  }

  return {
    nodeId,
    revisionId: await insertRevision(
      transaction,
      nodeId,
      scopeId,
      parentRevisionId,
      revision,
      "established",
    ),
  };
}

/**
 * Stages a revision of an existing node. Established truth is left exactly
 * where it stands: the candidate names it as its parent and supersedes nothing
 * until it is established. A node may hold several candidates at once.
 */
export async function stageRevision(
  transaction: GraphTransaction,
  nodeId: string,
  revision: RevisionContent,
): Promise<WrittenRevision> {
  const { sql } = transaction;
  const scopeId = await nodeScopeId(sql, nodeId);

  return {
    nodeId,
    revisionId: await insertRevision(
      transaction,
      nodeId,
      scopeId,
      await establishedRevisionId(sql, nodeId),
      revision,
      "candidate",
    ),
  };
}

/**
 * Establishes a candidate revision. The revision the node currently holds is
 * archived first, for the reason superseding already archives first: at most
 * one revision of a node is established and the database checks it per
 * statement.
 */
export async function establishRevision(
  transaction: GraphTransaction,
  revisionId: string,
): Promise<void> {
  const { sql, dataRevision } = transaction;
  const [candidate] = await sql<{ node_id: string }[]>`
    select node_id from graph_node_revision
    where id = ${revisionId} and lifecycle = 'candidate'
  `;
  if (candidate === undefined) {
    throw new Error(
      `No candidate revision ${revisionId} to establish in this graph.`,
    );
  }

  const outgoing = await establishedRevisionId(sql, candidate.node_id);
  if (outgoing !== null) {
    await archiveRevision(transaction, outgoing);
  }

  await sql`
    update graph_node_revision
    set lifecycle = 'established',
        lifecycle_data_revision = ${dataRevision},
        established_data_revision = ${dataRevision},
        established_at = now()
    where id = ${revisionId} and lifecycle = 'candidate'
  `;
}

/**
 * Rejects a candidate revision. The content stays exactly where it is, because
 * a rejected item that vanished would lose the record of what was asked for.
 */
export async function rejectRevision(
  { sql, dataRevision }: GraphTransaction,
  revisionId: string,
): Promise<void> {
  const rows = await sql`
    update graph_node_revision
    set lifecycle = 'rejected', lifecycle_data_revision = ${dataRevision}
    where id = ${revisionId} and lifecycle = 'candidate'
    returning id
  `;
  if (rows.length === 0) {
    throw new Error(
      `No candidate revision ${revisionId} to reject in this graph.`,
    );
  }
}
