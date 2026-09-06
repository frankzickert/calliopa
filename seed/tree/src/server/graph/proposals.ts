import type postgres from "postgres";
import type { JSONValue } from "postgres";

import type {
  AnsweredItem,
  GraphActor,
  GraphOutcome,
  GraphSchema,
  ProposalAnswer,
  ProposalAnswerOutcome,
  ProposalGroupOutcome,
  ProposalItemRequest,
  ProposalItemView,
  ProposalRelationOperation,
  ProposalStageOutcome,
  ProposalStageRequest,
  StagedItem,
  StagedProposal,
  ValidationFailure,
} from "./contract";
import {
  establishRevision,
  establishedRevisionId,
  rejectRevision,
  stageNode,
  stageRevision,
} from "./nodes";
import {
  describe,
  refusal,
  refused,
  validationOutcome,
} from "./outcome";
import { readCurrentNode, readRelationSummary } from "./reads";
import { closeRelation, createRelation } from "./relations";
import { inGraphTransaction, type GraphTransaction } from "./transaction";
import type { GraphReader } from "./transaction";

/** Carries a refusal out of the transaction, rolling every write back with it. */
class Refused extends Error {
  constructor(readonly outcome: GraphOutcome<never>) {
    super("The proposal operation was refused.");
  }
}

const provenanceFor = (actor: GraphActor): JSONValue =>
  actor.kind === "application"
    ? { actor: "application" }
    : { actor: "apiClient", clientId: actor.clientId };

/** Only a caller that may write truth may answer a proposal on its own. */
const mayWriteTruth = (actor: GraphActor): boolean =>
  actor.kind === "application" || actor.identityClass === "writer";

interface GroupRow {
  id: string;
  root_node_id: string;
  base_data_revision: string;
  staged_by: JSONValue;
  request: JSONValue | null;
}

interface ItemRow {
  id: string;
  group_id: string;
  kind: string;
  target_node_id: string | null;
  staged_revision_id: string | null;
  base_revision_id: string | null;
  accept_operations: readonly ProposalRelationOperation[];
  answer: ProposalAnswer | null;
}

/**
 * Stages a group against one root. Nothing here changes established truth:
 * content an item introduces is written as a candidate revision, and the
 * relations an item proposes are recorded to be written when it is accepted.
 *
 * The group pins the data revision it was staged against, which is what lets
 * acceptance tell whether the graph moved underneath an item.
 */
export async function stageProposal(
  db: postgres.Sql,
  schema: GraphSchema,
  request: ProposalStageRequest,
  actor: GraphActor,
): Promise<ProposalStageOutcome> {
  const invalid = validateStageRequest(schema, request);
  if (invalid !== null) return invalid;

  const provenance = provenanceFor(actor);
  try {
    return await inGraphTransaction(db, async (transaction) => {
      const root = await readCurrentNode(transaction.sql, request.rootNodeId);
      if (root === null) {
        throw new Refused(
          refusal(
            "unknownRoot",
            `No node ${request.rootNodeId} for a proposal to be staged against.`,
          ),
        );
      }
      return stage(transaction, schema, request, provenance);
    });
  } catch (error) {
    if (error instanceof Refused) return error.outcome;
    return { outcome: "storageError", detail: describe(error) };
  }
}

function validateStageRequest(
  schema: GraphSchema,
  request: ProposalStageRequest,
): ProposalStageOutcome | null {
  const failures: ValidationFailure[] = [];

  request.items.forEach((item, index) => {
    if (item.kind.trim() === "") {
      failures.push({
        operation: index,
        rule: "itemKind",
        detail: "An item names the kind of change it proposes.",
      });
    }
    if (item.content === undefined && (item.onAccept ?? []).length === 0) {
      failures.push({
        operation: index,
        rule: "emptyItem",
        detail: `Item ${index} proposes nothing: it stages no content and accepting it would do nothing.`,
      });
    }
    const content = item.content;
    if (content !== undefined) {
      const definition = schema.nodes[content.semanticType];
      if (definition === undefined) {
        failures.push({
          operation: index,
          rule: "unknownNodeType",
          detail: `No node type ${content.semanticType} is defined.`,
        });
      } else {
        const message = definition.validate(content.content);
        if (message !== null) {
          failures.push({
            operation: index,
            rule: "nodeContent",
            detail: message,
          });
        }
      }
    }
    for (const operation of item.onAccept ?? []) {
      if (
        operation.op === "createRelation" &&
        schema.relations[operation.relationType] === undefined
      ) {
        failures.push({
          operation: index,
          rule: "unknownRelationType",
          detail: `No relation type ${operation.relationType} is defined.`,
        });
      }
      if (
        operation.op === "createRelation" &&
        item.content === undefined &&
        (operation.from.kind === "stagedNode" ||
          operation.to.kind === "stagedNode")
      ) {
        failures.push({
          operation: index,
          rule: "noStagedNode",
          detail: `Item ${index} names its staged node and stages none.`,
        });
      }
    }
  });

  return validationOutcome<StagedProposal>(failures);
}

async function stage(
  transaction: GraphTransaction,
  schema: GraphSchema,
  request: ProposalStageRequest,
  provenance: JSONValue,
): Promise<ProposalStageOutcome> {
  const { sql, dataRevision } = transaction;
  const [scope] = await sql<{ scope_id: string }[]>`
    select scope_id from graph_node where id = ${request.rootNodeId}
  `;
  const scopeId = (scope as { scope_id: string }).scope_id;

  const [group] = await sql<{ id: string }[]>`
    insert into graph_proposal_group (
      scope_id, root_node_id, base_data_revision, staged_by, request,
      created_data_revision
    ) values (
      ${scopeId}, ${request.rootNodeId}, ${dataRevision}, ${sql.json(provenance)},
      ${request.request === undefined ? null : sql.json(request.request)},
      ${dataRevision}
    ) returning id
  `;
  const groupId = (group as { id: string }).id;

  const staged: StagedItem[] = [];
  for (const [ordinal, item] of request.items.entries()) {
    staged.push(
      await stageItem(transaction, schema, groupId, scopeId, ordinal, item, provenance),
    );
  }

  return {
    outcome: "success",
    result: {
      groupId,
      rootNodeId: request.rootNodeId,
      baseDataRevision: dataRevision,
      dataRevision,
      items: staged,
    },
  };
}

async function stageItem(
  transaction: GraphTransaction,
  schema: GraphSchema,
  groupId: string,
  scopeId: string,
  ordinal: number,
  item: ProposalItemRequest,
  provenance: JSONValue,
): Promise<StagedItem> {
  const { sql } = transaction;
  let stagedNodeId: string | null = null;
  let stagedRevisionId: string | null = null;
  let baseRevisionId: string | null = null;

  const content = item.content;
  if (content !== undefined) {
    const definition = schema.nodes[content.semanticType] as {
      schemaVersion: number;
    };
    const revision = {
      content: content.content,
      semanticType: content.semanticType,
      provenance,
      schemaVersion: definition.schemaVersion,
    };
    if (content.of === "newNode") {
      const written = await stageNode(transaction, revision);
      stagedNodeId = written.nodeId;
      stagedRevisionId = written.revisionId;
    } else {
      const established = await establishedRevisionId(sql, content.nodeId);
      if (established === null) {
        throw new Refused(
          refusal(
            "staleItem",
            `Node ${content.nodeId} holds no established truth to stage against.`,
          ),
        );
      }
      const written = await stageRevision(transaction, content.nodeId, revision);
      stagedNodeId = written.nodeId;
      stagedRevisionId = written.revisionId;
      baseRevisionId = content.baseRevisionId;
    }
  }

  // The staged node is known now, so the relations acceptance will write name
  // it by identity. An operation stored with a placeholder in it would have to
  // be resolved again by whoever ran it later.
  const onAccept = (item.onAccept ?? []).map((operation) =>
    operation.op === "closeRelation"
      ? operation
      : {
          op: "createRelation" as const,
          relationType: operation.relationType,
          from:
            operation.from.kind === "stagedNode"
              ? { kind: "id" as const, nodeId: stagedNodeId as string }
              : operation.from,
          to:
            operation.to.kind === "stagedNode"
              ? { kind: "id" as const, nodeId: stagedNodeId as string }
              : operation.to,
        },
  );

  const [row] = await sql<{ id: string }[]>`
    insert into graph_proposal_item (
      group_id, scope_id, ordinal, kind, target_node_id, staged_revision_id,
      base_revision_id, accept_operations
    ) values (
      ${groupId}, ${scopeId}, ${ordinal}, ${item.kind},
      ${item.targetNodeId ?? null}, ${stagedRevisionId}, ${baseRevisionId},
      ${sql.json(onAccept as unknown as JSONValue)}
    ) returning id
  `;

  return {
    itemId: (row as { id: string }).id,
    kind: item.kind,
    targetNodeId: item.targetNodeId ?? null,
    stagedNodeId,
    stagedRevisionId,
  };
}

/**
 * Reads one group with its items. A group is open while an item of it is
 * unanswered, which is derived rather than stored so the group cannot hold a
 * second account of its items that disagrees with them.
 */
export async function readProposalGroup(
  sql: GraphReader,
  groupId: string,
): Promise<ProposalGroupOutcome> {
  let group: GroupRow | undefined;
  let items: (ItemRow & {
    staged_content: JSONValue | null;
    staged_semantic_type: string | null;
    staged_node_id: string | null;
  })[];
  try {
    [group] = await sql<GroupRow[]>`
      select id, root_node_id, base_data_revision, staged_by, request
        from graph_proposal_group where id = ${groupId}
    `;
    if (group === undefined) {
      return { outcome: "noResult", detail: `No proposal group ${groupId}.` };
    }
    items = await sql`
      select i.id, i.group_id, i.kind, i.target_node_id, i.staged_revision_id,
             i.base_revision_id, i.accept_operations, i.answer,
             r.content as staged_content, r.semantic_type as staged_semantic_type,
             r.node_id as staged_node_id
        from graph_proposal_item i
        left join graph_node_revision r on r.id = i.staged_revision_id
       where i.group_id = ${groupId}
       order by i.ordinal
    `;
  } catch (error) {
    return { outcome: "storageError", detail: describe(error) };
  }

  const views: ProposalItemView[] = items.map((row) => ({
    itemId: row.id,
    kind: row.kind,
    targetNodeId: row.target_node_id,
    stagedNodeId: row.staged_node_id,
    stagedRevisionId: row.staged_revision_id,
    stagedSemanticType: row.staged_semantic_type,
    stagedContent: row.staged_content,
    answer: row.answer,
  }));

  return {
    outcome: "success",
    result: {
      groupId: group.id,
      rootNodeId: group.root_node_id,
      baseDataRevision: group.base_data_revision,
      stagedBy: group.staged_by,
      request: group.request,
      state: views.some((item) => item.answer === null) ? "open" : "closed",
      items: views,
    },
  };
}

/** The open groups staged against one root, oldest first. */
export async function listOpenProposalGroups(
  sql: GraphReader,
  rootNodeId: string,
): Promise<readonly string[]> {
  const rows = await sql<{ id: string }[]>`
    select g.id from graph_proposal_group g
     where g.root_node_id = ${rootNodeId}
       and exists (
         select 1 from graph_proposal_item i
          where i.group_id = g.id and i.answer is null
       )
     order by g.created_data_revision, g.id
  `;
  return rows.map((row) => row.id);
}

/**
 * Answers one item. Accepting establishes the content it staged and writes the
 * relations it proposed, together in one transaction; rejecting moves that
 * content to `rejected` and changes no established truth.
 *
 * An item is answered once. An item whose base has moved since it was staged
 * conflicts rather than overwriting, and one naming a node or relation that is
 * no longer there is refused as stale.
 */
export async function answerProposalItem(
  db: postgres.Sql,
  schema: GraphSchema,
  itemId: string,
  answer: ProposalAnswer,
  actor: GraphActor,
): Promise<ProposalAnswerOutcome> {
  if (!mayWriteTruth(actor)) {
    return refused<AnsweredItem>(
      "Answering a proposal is a human action, and this caller may only propose.",
    );
  }

  const provenance = provenanceFor(actor);
  try {
    return await inGraphTransaction(db, async (transaction) => {
      const { sql, dataRevision } = transaction;
      const [item] = await sql<ItemRow[]>`
        select id, group_id, kind, target_node_id, staged_revision_id,
               base_revision_id, accept_operations, answer
          from graph_proposal_item where id = ${itemId} for update
      `;
      if (item === undefined) {
        throw new Refused({
          outcome: "noResult",
          detail: `No proposal item ${itemId}.`,
        });
      }
      if (item.answer !== null) {
        throw new Refused(
          refusal(
            "alreadyAnswered",
            `Item ${itemId} was already ${item.answer}.`,
          ),
        );
      }

      if (answer === "accepted") {
        await accept(transaction, schema, item, provenance);
      } else if (item.staged_revision_id !== null) {
        await rejectRevision(transaction, item.staged_revision_id);
      }

      await sql`
        update graph_proposal_item
           set answer = ${answer}, answered_data_revision = ${dataRevision}
         where id = ${itemId}
      `;
      const [open] = await sql<{ n: number }[]>`
        select count(*)::int as n from graph_proposal_item
         where group_id = ${item.group_id} and answer is null
      `;

      return {
        outcome: "success",
        result: {
          itemId,
          answer,
          dataRevision,
          groupState: (open as { n: number }).n > 0 ? "open" : "closed",
        },
      } satisfies ProposalAnswerOutcome;
    });
  } catch (error) {
    if (error instanceof Refused) return error.outcome;
    return { outcome: "storageError", detail: describe(error) };
  }
}

/**
 * Performs the item: the conflict and staleness checks first, then the content
 * it staged, then the relations it proposed. Nothing is written until every
 * check has passed, so a refusal leaves the graph exactly as it was.
 */
async function accept(
  transaction: GraphTransaction,
  schema: GraphSchema,
  item: ItemRow,
  provenance: JSONValue,
): Promise<void> {
  const { sql } = transaction;
  const stagedNodeId =
    item.staged_revision_id === null
      ? null
      : await nodeOfRevision(sql, item.staged_revision_id);

  if (item.base_revision_id !== null && stagedNodeId !== null) {
    const current = await establishedRevisionId(sql, stagedNodeId);
    if (current !== item.base_revision_id) {
      throw new Refused({
        outcome: "conflict",
        conflicts: [
          {
            nodeId: stagedNodeId,
            expectedRevisionId: item.base_revision_id,
            currentRevisionId: current,
          },
        ],
      });
    }
  }

  if (item.target_node_id !== null) {
    const target = await readCurrentNode(sql, item.target_node_id);
    if (target === null) {
      throw new Refused(
        refusal(
          "staleItem",
          `Node ${item.target_node_id} is no longer in this graph, so the item names something that has gone.`,
        ),
      );
    }
  }

  for (const operation of item.accept_operations) {
    if (operation.op === "closeRelation") {
      const summary = await readRelationSummary(sql, operation.relationId);
      if (summary === null || summary.status !== "active") {
        throw new Refused(
          refusal(
            "staleItem",
            `Relation ${operation.relationId} is no longer open, so the graph has already moved past this item.`,
          ),
        );
      }
      continue;
    }
    for (const endpoint of [operation.from, operation.to]) {
      // The node this item staged holds no established revision until the
      // establish below, so it is the one endpoint not read as truth here.
      if (endpoint.kind !== "id" || endpoint.nodeId === stagedNodeId) continue;
      if ((await readCurrentNode(sql, endpoint.nodeId)) === null) {
        throw new Refused(
          refusal(
            "staleItem",
            `Node ${endpoint.nodeId} is no longer in this graph, so the relation this item proposes has nothing to attach to.`,
          ),
        );
      }
    }
  }

  // The candidate is established before its relations are written, because a
  // relation refuses an endpoint holding no established revision.
  if (item.staged_revision_id !== null) {
    await establishRevision(transaction, item.staged_revision_id);
  }

  for (const operation of item.accept_operations) {
    if (operation.op === "closeRelation") {
      await closeRelation(transaction, operation.relationId, provenance);
      continue;
    }
    const definition = schema.relations[operation.relationType] as {
      schemaVersion: number;
    };
    await createRelation(transaction, {
      relationType: operation.relationType,
      fromNodeId: (operation.from as { nodeId: string }).nodeId,
      target: {
        kind: "node",
        nodeId: (operation.to as { nodeId: string }).nodeId,
      },
      provenance,
      schemaVersion: definition.schemaVersion,
    });
  }
}

async function nodeOfRevision(
  sql: GraphReader,
  revisionId: string,
): Promise<string> {
  const [row] = await sql<{ node_id: string }[]>`
    select node_id from graph_node_revision where id = ${revisionId}
  `;
  return (row as { node_id: string }).node_id;
}
