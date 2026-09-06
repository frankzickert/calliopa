import type { JSONValue } from "postgres";

import type {
  GraphMutationRequest,
  GraphOperation,
  GraphReadRequest,
  MutationEndpoint,
  NodeRef,
  NonEmpty,
  ProposalContent,
  ProposalItemRequest,
  ProposalNodeRef,
  ProposalRelationOperation,
  ProposalStageRequest,
  RelationRef,
  RevisionSelection,
  TraversalDirection,
  TraversalStep,
  ValidationFailure,
} from "./contract";

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failures: NonEmpty<ValidationFailure> };

/**
 * Turns a decoded JSON body into the typed contract, or says exactly where it
 * stopped being one. The external API accepts nothing it has not read into the
 * same types an in-process consumer passes, so both sides mean one thing.
 */
class Malformed extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
  ) {
    super(`${path} is not ${expected}`);
  }
}

const fail = (path: string, expected: string): never => {
  throw new Malformed(path, expected);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const object = (value: unknown, path: string): Record<string, unknown> =>
  isObject(value) ? value : fail(path, "an object");

const text = (value: unknown, path: string): string =>
  typeof value === "string" && value !== "" ? value : fail(path, "a string");

const number = (value: unknown, path: string): number =>
  typeof value === "number" ? value : fail(path, "a number");

const list = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : fail(path, "an array");

function nonEmpty<T>(values: T[], path: string): NonEmpty<T> {
  const [first, ...rest] = values;
  return first === undefined ? fail(path, "a non-empty array") : [first, ...rest];
}

const DIRECTIONS: readonly TraversalDirection[] = [
  "outgoing",
  "incoming",
  "both",
];

function direction(value: unknown, path: string): TraversalDirection {
  const found = DIRECTIONS.find((candidate) => candidate === value);
  return found ?? fail(path, `one of ${DIRECTIONS.join(", ")}`);
}

function step(value: unknown, path: string): TraversalStep {
  const raw = object(value, path);
  const types = raw["relationTypes"];
  const base = {
    direction: direction(raw["direction"], `${path}.direction`),
    depth: number(raw["depth"], `${path}.depth`),
  };
  return types === undefined
    ? base
    : {
        ...base,
        relationTypes: list(types, `${path}.relationTypes`).map((entry, index) =>
          text(entry, `${path}.relationTypes[${index}]`),
        ),
      };
}

function selection(value: unknown, path: string): RevisionSelection {
  const raw = object(value, path);
  if (raw["at"] === "current") return { at: "current" };
  if (raw["at"] === "dataRevision") {
    return {
      at: "dataRevision",
      dataRevision: text(raw["dataRevision"], `${path}.dataRevision`),
    };
  }
  return fail(`${path}.at`, "current or dataRevision");
}

function readRequest(body: unknown): GraphReadRequest {
  const raw = object(body, "body");
  const roots = nonEmpty(
    list(raw["roots"], "body.roots").map((entry, index) =>
      text(entry, `body.roots[${index}]`),
    ),
    "body.roots",
  );
  const traverse = raw["traverse"];
  const at = raw["selection"];
  return {
    roots,
    ...(traverse === undefined
      ? {}
      : {
          traverse: list(traverse, "body.traverse").map((entry, index) =>
            step(entry, `body.traverse[${index}]`),
          ),
        }),
    ...(at === undefined ? {} : { selection: selection(at, "body.selection") }),
    ...(raw["proposalGroupId"] === undefined
      ? {}
      : {
          proposalGroupId: text(
            raw["proposalGroupId"],
            "body.proposalGroupId",
          ),
        }),
  };
}

function nodeRef(value: unknown, path: string): NodeRef {
  const raw = object(value, path);
  if (raw["kind"] === "id") {
    return { kind: "id", nodeId: text(raw["nodeId"], `${path}.nodeId`) };
  }
  if (raw["kind"] === "ref") {
    return { kind: "ref", ref: text(raw["ref"], `${path}.ref`) };
  }
  return fail(`${path}.kind`, "id or ref");
}

function relationRef(value: unknown, path: string): RelationRef {
  const raw = object(value, path);
  if (raw["kind"] === "id") {
    return {
      kind: "id",
      relationId: text(raw["relationId"], `${path}.relationId`),
    };
  }
  if (raw["kind"] === "ref") {
    return { kind: "ref", ref: text(raw["ref"], `${path}.ref`) };
  }
  return fail(`${path}.kind`, "id or ref");
}

function endpoint(value: unknown, path: string): MutationEndpoint {
  const raw = object(value, path);
  if (raw["kind"] === "node") {
    return { kind: "node", node: nodeRef(raw["node"], `${path}.node`) };
  }
  if (raw["kind"] === "relation") {
    return {
      kind: "relation",
      relation: relationRef(raw["relation"], `${path}.relation`),
    };
  }
  return fail(`${path}.kind`, "node or relation");
}

/** Content is whatever JSON the caller sent; the schema decides if it is right. */
const content = (value: unknown, path: string): JSONValue =>
  value === undefined ? fail(path, "present") : (value as JSONValue);

function operation(value: unknown, path: string): GraphOperation {
  const raw = object(value, path);
  switch (raw["op"]) {
    case "createNode":
      return {
        op: "createNode",
        ref: text(raw["ref"], `${path}.ref`),
        semanticType: text(raw["semanticType"], `${path}.semanticType`),
        content: content(raw["content"], `${path}.content`),
      };
    case "reviseNode":
      return {
        op: "reviseNode",
        nodeId: text(raw["nodeId"], `${path}.nodeId`),
        baseRevisionId: text(raw["baseRevisionId"], `${path}.baseRevisionId`),
        semanticType: text(raw["semanticType"], `${path}.semanticType`),
        content: content(raw["content"], `${path}.content`),
      };
    case "createRelation": {
      const ref = raw["ref"];
      return {
        op: "createRelation",
        ...(ref === undefined ? {} : { ref: text(ref, `${path}.ref`) }),
        relationType: text(raw["relationType"], `${path}.relationType`),
        from: nodeRef(raw["from"], `${path}.from`),
        to: endpoint(raw["to"], `${path}.to`),
      };
    }
    case "closeRelation":
      return {
        op: "closeRelation",
        relationId: text(raw["relationId"], `${path}.relationId`),
      };
    case "archiveNode":
      return {
        op: "archiveNode",
        nodeId: text(raw["nodeId"], `${path}.nodeId`),
        baseRevisionId: text(raw["baseRevisionId"], `${path}.baseRevisionId`),
      };
    default:
      return fail(
        `${path}.op`,
        "createNode, reviseNode, archiveNode, createRelation, or closeRelation",
      );
  }
}

function mutationRequest(body: unknown): GraphMutationRequest {
  const raw = object(body, "body");
  return {
    operations: nonEmpty(
      list(raw["operations"], "body.operations").map((entry, index) =>
        operation(entry, `body.operations[${index}]`),
      ),
      "body.operations",
    ),
  };
}

function attempt<T>(parse: () => T): Parsed<T> {
  try {
    return { ok: true, value: parse() };
  } catch (error) {
    if (error instanceof Malformed) {
      return {
        ok: false,
        failures: [
          {
            operation: null,
            rule: "requestShape",
            detail: `${error.path} is not ${error.expected}.`,
          },
        ],
      };
    }
    throw error;
  }
}

function proposalNodeRef(value: unknown, path: string): ProposalNodeRef {
  const raw = object(value, path);
  if (raw["kind"] === "stagedNode") return { kind: "stagedNode" };
  return { kind: "id", nodeId: text(raw["nodeId"], `${path}.nodeId`) };
}

function proposalRelation(
  value: unknown,
  path: string,
): ProposalRelationOperation {
  const raw = object(value, path);
  if (raw["op"] === "closeRelation") {
    return {
      op: "closeRelation",
      relationId: text(raw["relationId"], `${path}.relationId`),
    };
  }
  if (raw["op"] !== "createRelation") {
    return fail(`${path}.op`, "createRelation or closeRelation");
  }
  return {
    op: "createRelation",
    relationType: text(raw["relationType"], `${path}.relationType`),
    from: proposalNodeRef(raw["from"], `${path}.from`),
    to: proposalNodeRef(raw["to"], `${path}.to`),
  };
}

function proposalContent(value: unknown, path: string): ProposalContent {
  const raw = object(value, path);
  const semanticType = text(raw["semanticType"], `${path}.semanticType`);
  const content = raw["content"] as JSONValue;
  if (raw["of"] === "newNode") {
    return { of: "newNode", semanticType, content };
  }
  if (raw["of"] !== "node") return fail(`${path}.of`, "newNode or node");
  return {
    of: "node",
    nodeId: text(raw["nodeId"], `${path}.nodeId`),
    baseRevisionId: text(raw["baseRevisionId"], `${path}.baseRevisionId`),
    semanticType,
    content,
  };
}

function proposalItem(value: unknown, path: string): ProposalItemRequest {
  const raw = object(value, path);
  const onAccept = raw["onAccept"];
  return {
    kind: text(raw["kind"], `${path}.kind`),
    ...(raw["targetNodeId"] === undefined
      ? {}
      : { targetNodeId: text(raw["targetNodeId"], `${path}.targetNodeId`) }),
    ...(raw["content"] === undefined
      ? {}
      : { content: proposalContent(raw["content"], `${path}.content`) }),
    ...(onAccept === undefined
      ? {}
      : {
          onAccept: list(onAccept, `${path}.onAccept`).map((entry, index) =>
            proposalRelation(entry, `${path}.onAccept[${index}]`),
          ),
        }),
  };
}

function stageRequest(body: unknown): ProposalStageRequest {
  const raw = object(body, "body");
  return {
    rootNodeId: text(raw["rootNodeId"], "body.rootNodeId"),
    items: nonEmpty(
      list(raw["items"], "body.items").map((entry, index) =>
        proposalItem(entry, `body.items[${index}]`),
      ),
      "body.items",
    ),
    ...(raw["request"] === undefined
      ? {}
      : { request: raw["request"] as JSONValue }),
  };
}

export const parseReadRequest = (body: unknown): Parsed<GraphReadRequest> =>
  attempt(() => readRequest(body));

export const parseStageRequest = (
  body: unknown,
): Parsed<ProposalStageRequest> => attempt(() => stageRequest(body));

export const parseMutationRequest = (
  body: unknown,
): Parsed<GraphMutationRequest> => attempt(() => mutationRequest(body));
