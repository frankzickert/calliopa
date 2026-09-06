import type postgres from "postgres";
import type { JSONValue } from "postgres";

import type {
  GraphActor,
  GraphMutationOutcome,
  GraphMutationRequest,
  GraphMutationResult,
  GraphOperation,
  GraphSchema,
  NodeRef,
  RevisionConflict,
  ValidationFailure,
  WrittenNode,
  WrittenRelation,
} from "./contract";
import {
  archiveRevision,
  createNode,
  establishedRevisionId,
  reviseNode,
} from "./nodes";
import {
  conflictOutcome,
  describe,
  refused,
  validationOutcome,
} from "./outcome";
import { readCurrentNode, readRelationSummary } from "./reads";
import {
  closeRelation,
  createRelation,
  type RelationTarget,
} from "./relations";
import { inGraphTransaction, type GraphTransaction } from "./transaction";
import { validateOperations } from "./validation";

/** Carries a refusal out of the transaction, rolling every write back with it. */
class Refused extends Error {
  constructor(readonly outcome: GraphMutationOutcome) {
    super("The mutation was refused.");
  }
}

const provenanceFor = (actor: GraphActor): JSONValue =>
  actor.kind === "application"
    ? { actor: "application" }
    : { actor: "apiClient", clientId: actor.clientId };

/**
 * Applies an ordered list of operations as one graph transaction.
 *
 * Nothing is written until every operation has been checked. The caller's
 * identity class is checked first of all, before the request is even read: a
 * caller that may only propose is refused here rather than reaching an
 * operation. Schema membership and content are settled before the transaction
 * opens; base revisions, endpoint shapes, and type stability need the graph as
 * it stands, so they are checked inside the transaction before its first
 * write. Either the whole list commits or none of it does.
 */
export async function mutateGraph(
  db: postgres.Sql,
  schema: GraphSchema,
  request: GraphMutationRequest,
  actor: GraphActor,
): Promise<GraphMutationOutcome> {
  if (actor.kind === "apiClient" && actor.identityClass === "proposer") {
    return refused<GraphMutationResult>(
      "This caller may only stage proposals, not write truth directly.",
    );
  }

  const invalid = validationOutcome<GraphMutationResult>(
    validateOperations(schema, request.operations),
  );
  if (invalid !== null) return invalid;

  const provenance = provenanceFor(actor);
  try {
    return await inGraphTransaction(db, async (transaction) => {
      await check(transaction, schema, request.operations);
      return apply(transaction, schema, request.operations, provenance);
    });
  } catch (error) {
    if (error instanceof Refused) return error.outcome;
    return { outcome: "storageError", detail: describe(error) };
  }
}

/** The semantic type each operation leaves a node holding, in order. */
type TypeIndex = Map<string, string>;

const refKey = (ref: string): string => `ref:${ref}`;
const idKey = (nodeId: string): string => `id:${nodeId}`;

async function nodeTypeOf(
  transaction: GraphTransaction,
  types: TypeIndex,
  ref: NodeRef,
): Promise<string | null> {
  const key = ref.kind === "ref" ? refKey(ref.ref) : idKey(ref.nodeId);
  const known = types.get(key);
  if (known !== undefined) return known;
  if (ref.kind === "ref") return null;

  const node = await readCurrentNode(transaction.sql, ref.nodeId);
  if (node === null) return null;
  types.set(key, node.semanticType);
  return node.semanticType;
}

/**
 * Reads the graph as it stands and refuses the whole mutation when an
 * operation cannot apply to it. Runs before `apply`, so a refusal leaves no
 * write behind even inside the open transaction.
 */
async function check(
  transaction: GraphTransaction,
  schema: GraphSchema,
  operations: readonly GraphOperation[],
): Promise<void> {
  const types: TypeIndex = new Map();
  const relationTypes = new Map<string, string>();
  const conflicts: RevisionConflict[] = [];
  const failures: ValidationFailure[] = [];

  for (const [index, operation] of operations.entries()) {
    switch (operation.op) {
      case "createNode": {
        types.set(refKey(operation.ref), operation.semanticType);
        break;
      }
      case "reviseNode": {
        const current = await establishedRevisionId(
          transaction.sql,
          operation.nodeId,
        );
        if (current !== operation.baseRevisionId) {
          conflicts.push({
            nodeId: operation.nodeId,
            expectedRevisionId: operation.baseRevisionId,
            currentRevisionId: current,
          });
          break;
        }
        const node = await readCurrentNode(transaction.sql, operation.nodeId);
        if (node !== null && node.semanticType !== operation.semanticType) {
          failures.push({
            operation: index,
            rule: "typeStability",
            detail: `Node ${operation.nodeId} is ${node.semanticType} and a revision cannot make it ${operation.semanticType}.`,
          });
        }
        types.set(idKey(operation.nodeId), operation.semanticType);
        break;
      }
      case "createRelation": {
        const definition = schema.relations[operation.relationType];
        if (definition === undefined) break;
        if (operation.ref !== undefined) {
          relationTypes.set(operation.ref, operation.relationType);
        }

        const originType = await nodeTypeOf(transaction, types, operation.from);
        if (originType === null) {
          failures.push(missingEndpoint(index, "origin", operation.from));
        } else if (!definition.fromNodes.includes(originType)) {
          failures.push({
            operation: index,
            rule: "relationShape",
            detail: `${operation.relationType} runs from ${definition.fromNodes.join(" or ")}, not from ${originType}.`,
          });
        }

        if (operation.to.kind === "node") {
          const targetType = await nodeTypeOf(
            transaction,
            types,
            operation.to.node,
          );
          if (targetType === null) {
            failures.push(missingEndpoint(index, "target", operation.to.node));
          } else if (definition.toNodes === undefined) {
            failures.push({
              operation: index,
              rule: "relationShape",
              detail: `${operation.relationType} does not point at a node.`,
            });
          } else if (!definition.toNodes.includes(targetType)) {
            failures.push({
              operation: index,
              rule: "relationShape",
              detail: `${operation.relationType} points at ${definition.toNodes.join(" or ")}, not at ${targetType}.`,
            });
          }
        } else {
          const target = operation.to.relation;
          const targetType =
            target.kind === "ref"
              ? relationTypes.get(target.ref)
              : (await readRelationSummary(transaction.sql, target.relationId))
                  ?.relationType;
          if (targetType === undefined) {
            failures.push({
              operation: index,
              rule: "unknownEndpoint",
              detail: "The target relation is not in this graph.",
            });
          } else if (definition.toRelations === undefined) {
            failures.push({
              operation: index,
              rule: "relationShape",
              detail: `${operation.relationType} does not point at a relation.`,
            });
          } else if (!definition.toRelations.includes(targetType)) {
            failures.push({
              operation: index,
              rule: "relationShape",
              detail: `${operation.relationType} points at ${definition.toRelations.join(" or ")}, not at ${targetType}.`,
            });
          }
        }
        break;
      }
      case "archiveNode": {
        const current = await establishedRevisionId(
          transaction.sql,
          operation.nodeId,
        );
        if (current !== operation.baseRevisionId) {
          conflicts.push({
            nodeId: operation.nodeId,
            expectedRevisionId: operation.baseRevisionId,
            currentRevisionId: current,
          });
        }
        break;
      }
      case "closeRelation": {
        const summary = await readRelationSummary(
          transaction.sql,
          operation.relationId,
        );
        if (summary === null) {
          failures.push({
            operation: index,
            rule: "unknownRelation",
            detail: `No relation ${operation.relationId} in this graph.`,
          });
        } else if (summary.status !== "active") {
          failures.push({
            operation: index,
            rule: "relationClosed",
            detail: `Relation ${operation.relationId} is already closed.`,
          });
        }
        break;
      }
    }
  }

  const refusal =
    validationOutcome<GraphMutationResult>(failures) ??
    conflictOutcome<GraphMutationResult>(conflicts);
  if (refusal !== null) throw new Refused(refusal);
}

const missingEndpoint = (
  index: number,
  role: string,
  ref: NodeRef,
): ValidationFailure => ({
  operation: index,
  rule: "unknownEndpoint",
  detail: `The ${role} node ${ref.kind === "id" ? ref.nodeId : ref.ref} is not in this graph.`,
});

/** Writes the checked operations in the order they were given. */
async function apply(
  transaction: GraphTransaction,
  schema: GraphSchema,
  operations: readonly GraphOperation[],
  provenance: JSONValue,
): Promise<GraphMutationOutcome> {
  const nodeIds = new Map<string, string>();
  const relationIds = new Map<string, string>();
  const nodes: WrittenNode[] = [];
  const relations: WrittenRelation[] = [];
  const closedRelations: string[] = [];
  const archivedNodes: string[] = [];

  const nodeIdOf = (ref: NodeRef): string =>
    ref.kind === "id" ? ref.nodeId : (nodeIds.get(ref.ref) as string);

  for (const operation of operations) {
    switch (operation.op) {
      case "createNode": {
        const definition = schema.nodes[operation.semanticType] as {
          schemaVersion: number;
        };
        const written = await createNode(transaction, {
          content: operation.content,
          semanticType: operation.semanticType,
          provenance,
          schemaVersion: definition.schemaVersion,
        });
        nodeIds.set(operation.ref, written.nodeId);
        nodes.push({ ref: operation.ref, ...written });
        break;
      }
      case "reviseNode": {
        const definition = schema.nodes[operation.semanticType] as {
          schemaVersion: number;
        };
        const written = await reviseNode(transaction, operation.nodeId, {
          content: operation.content,
          semanticType: operation.semanticType,
          provenance,
          schemaVersion: definition.schemaVersion,
        });
        nodes.push({ ref: null, ...written });
        break;
      }
      case "createRelation": {
        const definition = schema.relations[operation.relationType] as {
          schemaVersion: number;
        };
        const target: RelationTarget =
          operation.to.kind === "node"
            ? { kind: "node", nodeId: nodeIdOf(operation.to.node) }
            : {
                kind: "relation",
                relationId:
                  operation.to.relation.kind === "id"
                    ? operation.to.relation.relationId
                    : (relationIds.get(operation.to.relation.ref) as string),
              };
        const relationId = await createRelation(transaction, {
          relationType: operation.relationType,
          fromNodeId: nodeIdOf(operation.from),
          target,
          provenance,
          schemaVersion: definition.schemaVersion,
        });
        if (operation.ref !== undefined) {
          relationIds.set(operation.ref, relationId);
        }
        relations.push({ ref: operation.ref ?? null, relationId });
        break;
      }
      case "closeRelation": {
        await closeRelation(transaction, operation.relationId, provenance);
        closedRelations.push(operation.relationId);
        break;
      }
      case "archiveNode": {
        await archiveRevision(transaction, operation.baseRevisionId);
        archivedNodes.push(operation.nodeId);
        break;
      }
    }
  }

  return {
    outcome: "success",
    result: {
      dataRevision: transaction.dataRevision,
      nodes,
      relations,
      closedRelations,
      archivedNodes,
    },
  };
}
