import { isRecordId } from "../uuid";
import {
  MAX_TRAVERSAL_DEPTH,
  type ChangeSummaryRequest,
  type GraphOperation,
  type GraphReadRequest,
  type GraphSchema,
  type RootResolutionRequest,
  type ValidationFailure,
} from "./contract";

const DATA_REVISION = /^\d+$/;

const failure = (
  operation: number | null,
  rule: string,
  detail: string,
): ValidationFailure => ({ operation, rule, detail });

/**
 * Checks a root resolution before it reaches the database. A type this build
 * does not know is not a failure here: it answers an empty result, the same as
 * a known type nothing has been created under.
 */
export function validateRootResolutionRequest(
  request: RootResolutionRequest,
): ValidationFailure[] {
  return request.semanticType === ""
    ? [failure(null, "semanticType", "Root resolution names a node type.")]
    : [];
}

/**
 * Checks a change summary before it reaches the database. Naming nothing is a
 * refusal rather than an empty answer: a caller that meant to ask about
 * something and built an empty list would otherwise read "never changed".
 */
export function validateChangeSummaryRequest(
  request: ChangeSummaryRequest,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const nodeIds = request.nodeIds ?? [];
  const relationIds = request.relationIds ?? [];

  if (nodeIds.length === 0 && relationIds.length === 0) {
    failures.push(
      failure(
        null,
        "namedIdentities",
        "A change summary names at least one node or relation.",
      ),
    );
  }
  for (const nodeId of nodeIds) {
    if (!isRecordId(nodeId)) {
      failures.push(
        failure(null, "recordId", `${nodeId} is not a node identifier.`),
      );
    }
  }
  for (const relationId of relationIds) {
    if (!isRecordId(relationId)) {
      failures.push(
        failure(null, "recordId", `${relationId} is not a relation identifier.`),
      );
    }
  }
  return failures;
}

/**
 * Checks a read before it reaches the database: identifiers are well formed,
 * every step states a usable depth, and the request stays inside the traversal
 * ceiling. Roots cannot be empty here because the contract cannot express it.
 */
export function validateReadRequest(
  request: GraphReadRequest,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (request.roots.length === 0) {
    failures.push(failure(null, "rootedRead", "A read names at least one root."));
  }
  for (const root of request.roots) {
    if (!isRecordId(root)) {
      failures.push(failure(null, "recordId", `${root} is not a node identifier.`));
    }
  }

  let total = 0;
  for (const [index, step] of (request.traverse ?? []).entries()) {
    if (!Number.isInteger(step.depth) || step.depth < 1) {
      failures.push(
        failure(index, "stepDepth", "A traversal step goes at least one hop."),
      );
      continue;
    }
    total += step.depth;
    if (step.relationTypes?.length === 0) {
      failures.push(
        failure(
          index,
          "relationTypes",
          "Narrowing to no relation type matches nothing; omit it to match every type.",
        ),
      );
    }
  }
  if (total > MAX_TRAVERSAL_DEPTH) {
    failures.push(
      failure(
        null,
        "traversalDepth",
        `A read traverses at most ${MAX_TRAVERSAL_DEPTH} hops; this one asks for ${total}.`,
      ),
    );
  }

  const selection = request.selection;
  if (
    selection?.at === "dataRevision" &&
    !DATA_REVISION.test(selection.dataRevision)
  ) {
    failures.push(
      failure(
        null,
        "dataRevision",
        `${selection.dataRevision} is not a data revision.`,
      ),
    );
  }

  return failures;
}

/**
 * Checks every operation against the committed schema before any storage
 * change: known types, acceptable content, well-formed identifiers, and
 * references that name something the same mutation created earlier.
 *
 * Endpoint shapes and type stability need the node types already in the graph,
 * so they are checked inside the transaction before it writes anything.
 */
export function validateOperations(
  schema: GraphSchema,
  operations: readonly GraphOperation[],
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const nodeRefs = new Set<string>();
  const relationRefs = new Set<string>();
  const revised = new Set<string>();

  if (operations.length === 0) {
    failures.push(failure(null, "operations", "A mutation carries at least one operation."));
  }

  for (const [index, operation] of operations.entries()) {
    switch (operation.op) {
      case "createNode": {
        if (operation.ref.trim() === "") {
          failures.push(failure(index, "ref", "A created node carries a reference."));
        } else if (nodeRefs.has(operation.ref)) {
          failures.push(
            failure(index, "ref", `The reference ${operation.ref} is already used.`),
          );
        } else {
          nodeRefs.add(operation.ref);
        }
        checkNodeType(schema, index, operation.semanticType, operation.content, failures);
        break;
      }
      case "reviseNode": {
        checkRecordId(index, operation.nodeId, "node", failures);
        checkRecordId(index, operation.baseRevisionId, "revision", failures);
        if (revised.has(operation.nodeId)) {
          failures.push(
            failure(
              index,
              "oneRevisionPerNode",
              `A mutation revises a node once; ${operation.nodeId} is revised twice. Nothing could name the revision the earlier operation is about to mint.`,
            ),
          );
        }
        revised.add(operation.nodeId);
        checkNodeType(schema, index, operation.semanticType, operation.content, failures);
        break;
      }
      case "archiveNode": {
        checkRecordId(index, operation.nodeId, "node", failures);
        checkRecordId(index, operation.baseRevisionId, "revision", failures);
        if (revised.has(operation.nodeId)) {
          failures.push(
            failure(
              index,
              "oneRevisionPerNode",
              `A mutation writes a node once; ${operation.nodeId} is written twice. Archiving a revision an earlier operation is about to replace names a revision that will not be established by the time it runs.`,
            ),
          );
        }
        revised.add(operation.nodeId);
        break;
      }
      case "createRelation": {
        const definition = schema.relations[operation.relationType];
        if (definition === undefined) {
          failures.push(
            failure(
              index,
              "unknownRelationType",
              `No definition covers the relation type ${operation.relationType}.`,
            ),
          );
        }
        if (operation.ref !== undefined) {
          if (relationRefs.has(operation.ref)) {
            failures.push(
              failure(index, "ref", `The reference ${operation.ref} is already used.`),
            );
          } else {
            relationRefs.add(operation.ref);
          }
        }
        checkNodeRef(index, operation.from, nodeRefs, failures);
        if (operation.to.kind === "node") {
          checkNodeRef(index, operation.to.node, nodeRefs, failures);
        } else if (operation.to.relation.kind === "ref") {
          if (!relationRefs.has(operation.to.relation.ref)) {
            failures.push(
              failure(
                index,
                "unknownRef",
                `No earlier operation created the relation ${operation.to.relation.ref}.`,
              ),
            );
          }
        } else {
          checkRecordId(index, operation.to.relation.relationId, "relation", failures);
        }
        break;
      }
      case "closeRelation": {
        checkRecordId(index, operation.relationId, "relation", failures);
        break;
      }
    }
  }

  return failures;
}

function checkRecordId(
  index: number,
  id: string,
  kind: string,
  failures: ValidationFailure[],
): void {
  if (!isRecordId(id)) {
    failures.push(failure(index, "recordId", `${id} is not a ${kind} identifier.`));
  }
}

function checkNodeType(
  schema: GraphSchema,
  index: number,
  semanticType: string,
  content: Parameters<GraphSchema["nodes"][string]["validate"]>[0],
  failures: ValidationFailure[],
): void {
  const definition = schema.nodes[semanticType];
  if (definition === undefined) {
    failures.push(
      failure(
        index,
        "unknownNodeType",
        `No definition covers the node type ${semanticType}.`,
      ),
    );
    return;
  }
  const message = definition.validate(content);
  if (message !== null) {
    failures.push(failure(index, "content", message));
  }
}

function checkNodeRef(
  index: number,
  ref: { kind: "id"; nodeId: string } | { kind: "ref"; ref: string },
  nodeRefs: ReadonlySet<string>,
  failures: ValidationFailure[],
): void {
  if (ref.kind === "id") {
    checkRecordId(index, ref.nodeId, "node", failures);
    return;
  }
  if (!nodeRefs.has(ref.ref)) {
    failures.push(
      failure(index, "unknownRef", `No earlier operation created the node ${ref.ref}.`),
    );
  }
}
