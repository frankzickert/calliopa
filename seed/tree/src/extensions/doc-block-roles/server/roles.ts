import { randomUUID } from "node:crypto";

import { readDocument } from "~/extensions/documents/server/documents";
import {
  atDataRevision,
  outsideBranch,
  withBranch,
} from "~/server/ccgw/branch-scope";
import {
  query,
  type ReadNode,
  type ReadRelation,
  type ReadResult,
} from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";

import {
  BLOCK_ROLE_TYPE,
  DOCUMENT_ROLE_TYPE,
  HAS_BLOCK_ROLE,
  HAS_DOCUMENT_ROLE,
  OFFERS,
  UNNAMED_ROLE,
  type AssignedBlockRole,
  type BlockRoleView,
  type DocumentRolesView,
  type DocumentRoleView,
  type RoleSummary,
} from "../lib/roles";

/**
 * The roles as the graph holds them (`BO_0299_012`, `BO_0299_013`,
 * `BO_0299_016`): the catalogue — every document role with the block roles
 * it offers — read as one list; a role created, renamed, described, retired
 * and restored, each one truth write as the signed-in person; a document's
 * role and a block's role assigned as relations, one active per subject,
 * written outside any branch because an assignment is the person's direct
 * act, established at once (`BO_0299_Q2`); and `rolesOf`, the one read
 * everything else answers from — the route, the tool and a dependent
 * extension alike.
 *
 * A role is retired, never deleted (`BO_0299_Q4`): a retired role stays
 * readable, the choices stop offering it and an assignment naming it says
 * so. A block role assigned under an earlier document role stays too and
 * says it is not offered (`BO_0299_Q3`).
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const flag = (value: unknown): boolean => value === true;
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const summaryOf = (node: ReadNode): RoleSummary => {
  const content = node.revision.content ?? {};
  return {
    id: bareId(node.id),
    name: text(content["name"]),
    description: text(content["description"]),
    retired: flag(content["retired"]),
  };
};

const isType = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" &&
  (node.revision.content ?? {})["_type"] === type;

const active = (relation: ReadRelation, type: string): boolean =>
  relation.type === type && relation.validity.status === "active";

/** The catalogue as one structure, plus which document role offers each block role. */
interface Catalogue {
  readonly roles: readonly DocumentRoleView[];
  readonly blockRoles: ReadonlyMap<string, BlockRoleView>;
  readonly offeredBy: ReadonlyMap<string, string>;
}

/**
 * Every document role and the block roles each offers. Two reads: the
 * document roles by type, then — rooted at them — the `offers` hop to their
 * block roles, which is where a rooted read answers relations.
 */
async function readCatalogue(): Promise<GraphOutcome<Catalogue>> {
  const found = await query({
    statement: `MATCH (r:${DOCUMENT_ROLE_TYPE}) RETURN GRAPH r`,
    unbounded: true,
    purpose: "document roles",
  });
  if (found.outcome !== "success" && found.outcome !== "noResult")
    return found as GraphOutcome<never>;
  const roleNodes =
    found.outcome === "success"
      ? found.result.nodes.filter((node) => isType(node, DOCUMENT_ROLE_TYPE))
      : [];
  const roles = new Map<
    string,
    { summary: RoleSummary; blockRoles: BlockRoleView[] }
  >();
  for (const node of roleNodes)
    roles.set(node.id, { summary: summaryOf(node), blockRoles: [] });
  const blockRoles = new Map<string, BlockRoleView>();
  const offeredBy = new Map<string, string>();
  if (roles.size > 0) {
    const offered = await query({
      statement: `MATCH (r)-[o:${OFFERS}]->(b) RETURN GRAPH r, o, b ROOT r`,
      roots: [...roles.keys()],
      unbounded: true,
      purpose: "block roles",
    });
    if (offered.outcome !== "success" && offered.outcome !== "noResult")
      return offered as GraphOutcome<never>;
    if (offered.outcome === "success") {
      const byId = new Map(
        offered.result.nodes.map((node) => [node.id, node] as const),
      );
      for (const relation of offered.result.relations) {
        if (!active(relation, OFFERS) || relation.to.nodeId === undefined)
          continue;
        const role = roles.get(relation.fromNodeId);
        const node = byId.get(relation.to.nodeId);
        if (
          role === undefined ||
          node === undefined ||
          !isType(node, BLOCK_ROLE_TYPE)
        )
          continue;
        const view: BlockRoleView = {
          ...summaryOf(node),
          order: number((node.revision.content ?? {})["order"]),
        };
        role.blockRoles.push(view);
        blockRoles.set(view.id, view);
        offeredBy.set(view.id, role.summary.id);
      }
    }
  }
  const listed: DocumentRoleView[] = [...roles.values()]
    .map(({ summary, blockRoles: offered }) => ({
      ...summary,
      blockRoles: offered.sort(
        (left, right) =>
          left.order - right.order || left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    outcome: "success",
    result: { roles: listed, blockRoles, offeredBy },
  };
}

/** Every document role with its block roles, retired ones included and marked. */
export async function listDocumentRoles(): Promise<
  GraphOutcome<DocumentRoleView[]>
> {
  const catalogue = await readCatalogue();
  return catalogue.outcome === "success"
    ? { outcome: "success", result: [...catalogue.result.roles] }
    : (catalogue as GraphOutcome<never>);
}

/** One document role with its block roles, or a refusal naming it. */
export async function readDocumentRole(
  roleId: string,
): Promise<GraphOutcome<DocumentRoleView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const role = catalogue.result.roles.find(
    (candidate) => candidate.id === roleId,
  );
  return role === undefined
    ? refuse("unknownRole", `Document role ${roleId} is not here.`)
    : { outcome: "success", result: role };
}

const named = (name: string): string =>
  name.trim() === "" ? UNNAMED_ROLE : name.trim();

/** A new document role, offering nothing yet. */
export async function createDocumentRole(input: {
  readonly name: string;
  readonly description?: string;
}): Promise<GraphOutcome<DocumentRoleView>> {
  const id = randomUUID();
  const description = (input.description ?? "").trim();
  const parameters: Record<string, unknown> = {
    r_id: id,
    r_name: named(input.name),
  };
  const fields = ["id: $r_id", "name: $r_name"];
  if (description !== "") {
    fields.push("description: $r_description");
    parameters["r_description"] = description;
  }
  return outsideBranch(() =>
    commit(
      `CREATE (r:${DOCUMENT_ROLE_TYPE} {${fields.join(", ")}, status: "established"})`,
      parameters,
      `create document role ${named(input.name)}`,
      async () => ({
        id,
        name: named(input.name),
        description,
        retired: false,
        blockRoles: [],
      }),
    ),
  );
}

/** One property of a role set, as the signed-in person's truth. */
async function setRoleProperty(
  alias: string,
  roleId: string,
  property: string,
  value: unknown,
  rationale: string,
): Promise<GraphOutcome<void>> {
  return outsideBranch(() =>
    commit(
      `SET ${alias}.${property} = $value`,
      { [`${alias}NodeId`]: nodeRef(roleId), value },
      rationale,
      async () => undefined,
    ),
  );
}

export type RoleCommand =
  | { readonly command: "rename"; readonly name: string }
  | { readonly command: "describe"; readonly description: string }
  | { readonly command: "retire" }
  | { readonly command: "restore" }
  | {
      readonly command: "addBlockRole";
      readonly name: string;
      readonly description?: string;
    }
  | {
      readonly command: "renameBlockRole";
      readonly blockRole: string;
      readonly name: string;
    }
  | {
      readonly command: "describeBlockRole";
      readonly blockRole: string;
      readonly description: string;
    }
  | { readonly command: "retireBlockRole"; readonly blockRole: string }
  | { readonly command: "restoreBlockRole"; readonly blockRole: string }
  | { readonly command: "reorder"; readonly blockRoles: readonly string[] };

/**
 * One act on a document role or on a block role it offers, each one truth
 * write, answering the role as it stands afterwards.
 */
export async function reviseDocumentRole(
  roleId: string,
  command: RoleCommand,
): Promise<GraphOutcome<DocumentRoleView>> {
  const before = await readDocumentRole(roleId);
  if (before.outcome !== "success") return before;
  const role = before.result;
  const blockRoleOf = (id: string): BlockRoleView | undefined =>
    role.blockRoles.find((candidate) => candidate.id === id);
  let written: GraphOutcome<unknown>;
  switch (command.command) {
    case "rename":
      written = await setRoleProperty(
        "r",
        roleId,
        "name",
        named(command.name),
        `rename document role ${role.name} to ${named(command.name)}`,
      );
      break;
    case "describe":
      written = await setRoleProperty(
        "r",
        roleId,
        "description",
        command.description.trim(),
        `describe document role ${role.name}`,
      );
      break;
    case "retire":
      written = await setRoleProperty(
        "r",
        roleId,
        "retired",
        true,
        `retire document role ${role.name}`,
      );
      break;
    case "restore":
      written = await setRoleProperty(
        "r",
        roleId,
        "retired",
        false,
        `restore document role ${role.name}`,
      );
      break;
    case "addBlockRole": {
      const id = randomUUID();
      const description = (command.description ?? "").trim();
      const order =
        role.blockRoles.reduce(
          (highest, blockRole) => Math.max(highest, blockRole.order),
          0,
        ) + 1;
      const parameters: Record<string, unknown> = {
        b_id: id,
        b_name: named(command.name),
        b_order: order,
        rref: nodeRef(roleId),
        bref: nodeRef(id),
      };
      const fields = ["id: $b_id", "name: $b_name", "order: $b_order"];
      if (description !== "") {
        fields.push("description: $b_description");
        parameters["b_description"] = description;
      }
      written = await outsideBranch(() =>
        commit(
          [
            `CREATE (b:${BLOCK_ROLE_TYPE} {${fields.join(", ")}, status: "established"})`,
            `RELATE rref -[o:${OFFERS}]-> bref`,
          ].join("; "),
          parameters,
          `add block role ${named(command.name)} to ${role.name}`,
          async () => undefined,
        ),
      );
      break;
    }
    case "renameBlockRole":
    case "describeBlockRole":
    case "retireBlockRole":
    case "restoreBlockRole": {
      const blockRole = blockRoleOf(command.blockRole);
      if (blockRole === undefined)
        return refuse(
          "unknownBlockRole",
          `${role.name} offers no block role ${command.blockRole}.`,
        );
      const [property, value, verb] =
        command.command === "renameBlockRole"
          ? (["name", named(command.name), "rename"] as const)
          : command.command === "describeBlockRole"
            ? (["description", command.description.trim(), "describe"] as const)
            : command.command === "retireBlockRole"
              ? (["retired", true, "retire"] as const)
              : (["retired", false, "restore"] as const);
      written = await setRoleProperty(
        "b",
        blockRole.id,
        property,
        value,
        `${verb} block role ${blockRole.name} of ${role.name}`,
      );
      break;
    }
    case "reorder": {
      const ids = [...new Set(command.blockRoles)];
      const known = ids.filter((id) => blockRoleOf(id) !== undefined);
      if (known.length !== ids.length)
        return refuse(
          "unknownBlockRole",
          `${role.name} offers no block role ${ids.find((id) => blockRoleOf(id) === undefined) ?? ""}.`,
        );
      // Every block role keeps a place: the ones the order leaves out follow
      // the ones it names, in the order they had.
      const rest = role.blockRoles
        .filter((blockRole) => !known.includes(blockRole.id))
        .map((blockRole) => blockRole.id);
      const ordered = [...known, ...rest];
      const parameters: Record<string, unknown> = {};
      const statements = ordered.map((id, index) => {
        parameters[`b${index}NodeId`] = nodeRef(id);
        parameters[`o${index}`] = index + 1;
        return `SET b${index}.order = $o${index}`;
      });
      if (statements.length === 0) return before;
      written = await outsideBranch(() =>
        commit(
          statements.join("; "),
          parameters,
          `reorder the block roles of ${role.name}`,
          async () => undefined,
        ),
      );
      break;
    }
  }
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return readDocumentRole(roleId);
}

/** The one active relation of a type from a root, with the node it reaches. */
function activeHop(
  result: ReadResult,
  from: string,
  type: string,
): { readonly relation: ReadRelation; readonly node: ReadNode } | null {
  for (const relation of result.relations) {
    if (
      relation.fromNodeId !== from ||
      !active(relation, type) ||
      relation.to.nodeId === undefined
    )
      continue;
    const node = result.nodes.find(
      (candidate) => candidate.id === relation.to.nodeId,
    );
    if (node !== undefined) return { relation, node };
  }
  return null;
}

/** Where a document's or a block's role assignment stands. */
async function readAssignment(
  subject: string,
  type: string,
): Promise<
  GraphOutcome<{
    readonly relation: ReadRelation;
    readonly node: ReadNode;
  } | null>
> {
  const found = await query({
    statement: `MATCH (s)-[h:${type}]->(r) RETURN GRAPH s, h, r ROOT s`,
    roots: [nodeRef(subject)],
    purpose: "role assignment",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: null };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  return {
    outcome: "success",
    result: activeHop(found.result, nodeRef(subject), type),
  };
}

/**
 * The assignment written: the previous relation closed and the new one
 * related in one script, so one is active per subject; nothing written when
 * the choice is what already stands.
 */
async function assign(
  subject: string,
  type: string,
  roleId: string | null,
  rationale: string,
): Promise<GraphOutcome<void>> {
  const standing = await readAssignment(subject, type);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const current =
    standing.result === null ? null : bareId(standing.result.node.id);
  if (current === roleId) return { outcome: "success", result: undefined };
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  if (standing.result !== null) {
    // A close names its vantage: the kernel's write gate classifies a closed
    // relation from a node the script touches, and a bare close — *No role*
    // — touches none, so `hFrom` says where the relation is readable from
    // (`ui-kernel.md`, a bare CLOSE names its vantage). Found on the served
    // build in the walk, 2026-09-25: clearing the document's role was refused
    // as `write_close_unverifiable`.
    statements.push("CLOSE h");
    parameters["hRelationId"] = standing.result.relation.id;
    parameters["hFrom"] = nodeRef(subject);
  }
  if (roleId !== null) {
    statements.push(`RELATE sref -[n:${type}]-> rref`);
    parameters["sref"] = nodeRef(subject);
    parameters["rref"] = nodeRef(roleId);
  }
  return outsideBranch(() =>
    commit(statements.join("; "), parameters, rationale, async () => undefined),
  );
}

/** The document as it reads in the caller's scope, or a refusal naming it. */
async function documentOf(documentId: string) {
  const document = await readDocument(documentId);
  if (document.outcome === "noResult")
    return refuse<never>(
      "unknownDocument",
      `Document ${documentId} is not here.`,
    );
  return document;
}

/**
 * A document's role and each block's, in reading order, at the data revision
 * it was read at (`BO_0299_016`): the one shape a route, a run and a
 * dependent extension read. `scope` names a branch the caller works in, or
 * a data revision to read at; absent, it reads truth as it stands.
 */
export async function rolesOf(
  documentId: string,
  scope: { readonly branch?: string; readonly dataRevision?: number } = {},
): Promise<GraphOutcome<DocumentRolesView>> {
  const read = () => withBranch(scope.branch, () => readRoles(documentId));
  return scope.dataRevision === undefined
    ? read()
    : atDataRevision(scope.dataRevision, read);
}

async function readRoles(
  documentId: string,
): Promise<GraphOutcome<DocumentRolesView>> {
  const document = await documentOf(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const roles = new Map(
    catalogue.result.roles.map((role) => [role.id, role] as const),
  );
  const documentRole = await readAssignment(documentId, HAS_DOCUMENT_ROLE);
  if (documentRole.outcome !== "success")
    return documentRole as GraphOutcome<never>;
  const chosen =
    documentRole.result === null
      ? null
      : (roles.get(bareId(documentRole.result.node.id)) ?? null);
  const blocks = document.result.blocks;
  const assigned = new Map<string, string>();
  let dataRevision = 0;
  if (blocks.length > 0) {
    const found = await query({
      statement: `MATCH (b)-[h:${HAS_BLOCK_ROLE}]->(r) RETURN GRAPH b, h, r ROOT b`,
      roots: blocks.map((block) => nodeRef(block.blockId)),
      unbounded: true,
      purpose: "block roles of a document",
    });
    if (found.outcome !== "success" && found.outcome !== "noResult")
      return found as GraphOutcome<never>;
    if (found.outcome === "success") {
      dataRevision = found.result.resolvedDataRevision;
      for (const relation of found.result.relations) {
        if (
          active(relation, HAS_BLOCK_ROLE) &&
          relation.to.nodeId !== undefined
        )
          assigned.set(relation.fromNodeId, bareId(relation.to.nodeId));
      }
    }
  }
  const roleOf = (blockId: string): AssignedBlockRole | null => {
    const id = assigned.get(nodeRef(blockId));
    const blockRole =
      id === undefined ? undefined : catalogue.result.blockRoles.get(id);
    const offeringRole =
      id === undefined ? undefined : catalogue.result.offeredBy.get(id);
    if (blockRole === undefined || offeringRole === undefined) return null;
    return {
      ...blockRole,
      documentRole: offeringRole,
      offered: chosen !== null && chosen.id === offeringRole,
    };
  };
  return {
    outcome: "success",
    result: {
      documentId,
      dataRevision,
      documentRole:
        chosen === null
          ? null
          : {
              id: chosen.id,
              name: chosen.name,
              description: chosen.description,
              retired: chosen.retired,
            },
      blocks: blocks.map((block) => ({
        blockId: block.blockId,
        kind: block.kind,
        blockRole: roleOf(block.blockId),
      })),
    },
  };
}

/**
 * The person's choice of a document's role: a document role's id, or null
 * for *No role*, written as truth at once (`BO_0299_013`). A role that is
 * not here or is retired is refused in words before anything is written.
 */
export async function setDocumentRole(input: {
  readonly documentId: string;
  readonly documentRole: string | null;
}): Promise<GraphOutcome<DocumentRolesView>> {
  const document = await documentOf(input.documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (input.documentRole !== null) {
    const role = await readDocumentRole(input.documentRole);
    if (role.outcome !== "success") return role as GraphOutcome<never>;
    if (role.result.retired)
      return refuse(
        "retiredRole",
        `${role.result.name} is retired and is not offered any more.`,
      );
  }
  const written = await assign(
    input.documentId,
    HAS_DOCUMENT_ROLE,
    input.documentRole,
    `give document ${input.documentId} the role ${input.documentRole ?? "none"}`,
  );
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return rolesOf(input.documentId);
}

/**
 * The person's choice of a block's role: a block role's id the document's
 * current role offers, or null for *No role*, written as truth at once
 * (`BO_0299_013`). A block outside the document's reading order, a role that
 * is not here or is retired, and one the document's role does not offer are
 * each refused in words.
 */
export async function setBlockRole(input: {
  readonly documentId: string;
  readonly blockId: string;
  readonly blockRole: string | null;
}): Promise<GraphOutcome<DocumentRolesView>> {
  const document = await documentOf(input.documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  if (
    !document.result.blocks.some((block) => block.blockId === input.blockId)
  ) {
    return refuse(
      "unknownBlock",
      `Block ${input.blockId} is not in the reading order of document ${input.documentId}.`,
    );
  }
  if (input.blockRole !== null) {
    const catalogue = await readCatalogue();
    if (catalogue.outcome !== "success")
      return catalogue as GraphOutcome<never>;
    const blockRole = catalogue.result.blockRoles.get(input.blockRole);
    const offeringRole = catalogue.result.offeredBy.get(input.blockRole);
    if (blockRole === undefined || offeringRole === undefined)
      return refuse(
        "unknownBlockRole",
        `Block role ${input.blockRole} is not here.`,
      );
    if (blockRole.retired)
      return refuse(
        "retiredRole",
        `${blockRole.name} is retired and is not offered any more.`,
      );
    const standing = await readAssignment(input.documentId, HAS_DOCUMENT_ROLE);
    if (standing.outcome !== "success") return standing as GraphOutcome<never>;
    const current =
      standing.result === null ? null : bareId(standing.result.node.id);
    if (current !== offeringRole) {
      const offering = catalogue.result.roles.find(
        (role) => role.id === offeringRole,
      );
      return refuse(
        "notOffered",
        `${blockRole.name} is offered by ${offering?.name ?? "another document role"}, not by the document's role.`,
      );
    }
  }
  const written = await assign(
    input.blockId,
    HAS_BLOCK_ROLE,
    input.blockRole,
    `give block ${input.blockId} the role ${input.blockRole ?? "none"}`,
  );
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return rolesOf(input.documentId);
}
