import { randomUUID } from "node:crypto";

import { runsText, type Run } from "~/lib/runs";

import { CONTAINS, type BlockView } from "~/extensions/documents/server/assemble";
import { readDocument } from "~/extensions/documents/server/documents";
import { PROFILE_RECORD } from "~/extensions/documents/lib/profile";
import {
  atDataRevision,
  outsideBranch,
  withBranch,
} from "~/server/ccgw/branch-scope";
import { blobReference, objectIdOfHash, type BlobReference } from "~/server/ccgw/blobs";
import {
  query,
  reachingGroups,
  type ReadNode,
  type ReadRelation,
} from "~/server/ccgw/client";
import { bareId, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { focusOf } from "~/server/focused-work";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";

import {
  BLOCK_ROLE_TYPE,
  BUILTIN_OFFERS,
  BUILTIN_ROLES,
  DEFAULT_SEND_WITH_PROMPT,
  FIELDS_FOR,
  KEYWORD_ROLE,
  PROFILE_ROLE,
  isBuiltinField,
  isBuiltinOffer,
  mintFieldKey,
  FIELDS_OF,
  HAS_BLOCK_ROLE,
  OFFERS,
  ROLE_FIELDS_TYPE,
  UNNAMED_FIELD,
  UNNAMED_ROLE,
  defaultsOf,
  fieldOf,
  inOrder,
  isHeld,
  missingOf,
  takeableFrom,
  blocksAllowed,
  valueFor,
  type DocumentRolesView,
  type FieldDeclaration,
  type FieldType,
  type FieldValue,
  type FileValue,
  type InheritedRole,
  type RoledBlock,
  type RoleView,
  type TakenRole,
} from "../lib/roles";

/**
 * The roles as the graph holds them (`BO_0299`, made one role type by
 * `BO_0309`): the catalogue — every role with the roles it offers and its
 * fields — read as one list; a role created, renamed, described, retired,
 * restored and given fields and offers, each one truth write as the
 * signed-in person; a role taken and cleared on a block or a document, many
 * per subject, written outside any branch because taking a role is the
 * person's direct act, established at once (`BO_0308_Q4`); a field's value
 * written the same way; and `rolesOf`, the one read everything else answers
 * from — the route, the tool and a dependent extension alike.
 *
 * A role is retired, never deleted (`BO_0299_Q4`). A role taken while its
 * offering role stood above stays when that role goes, and says it is not
 * offered (`BO_0299_Q3`). A built-in is never renamed, retired or restored
 * (`BO_0308_Q5`).
 */

export const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const flag = (value: unknown): boolean => value === true;
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const isType = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" &&
  (node.revision.content ?? {})["_type"] === type;

const active = (relation: ReadRelation, type: string): boolean =>
  relation.type === type && relation.validity.status === "active";

const fieldsFrom = (value: unknown): FieldDeclaration[] =>
  Array.isArray(value)
    ? value
        .map(fieldOf)
        .filter((field): field is FieldDeclaration => field !== null)
    : [];

/** The catalogue as one structure. */
export interface Catalogue {
  readonly roles: readonly RoleView[];
  readonly byId: ReadonlyMap<string, RoleView>;
}

/**
 * Every role with its offers and fields. Two reads: the roles by type, then —
 * rooted at them — the `offers` hop, which is where a rooted read answers
 * relations.
 */
export async function readCatalogue(): Promise<GraphOutcome<Catalogue>> {
  const found = await query({
    statement: `MATCH (r:${BLOCK_ROLE_TYPE}) RETURN GRAPH r`,
    unbounded: true,
    purpose: "roles",
  });
  if (found.outcome !== "success" && found.outcome !== "noResult")
    return found as GraphOutcome<never>;
  const nodes =
    found.outcome === "success"
      ? found.result.nodes.filter((node) => isType(node, BLOCK_ROLE_TYPE))
      : [];
  const offers = new Map<string, string[]>();
  const offeredBy = new Map<string, string[]>();
  if (nodes.length > 0) {
    const hop = await query({
      statement: `MATCH (r)-[o:${OFFERS}]->(b) RETURN GRAPH r, o, b ROOT r`,
      roots: nodes.map((node) => node.id),
      unbounded: true,
      metadataOnly: true,
      purpose: "what roles offer",
    });
    if (hop.outcome !== "success" && hop.outcome !== "noResult")
      return hop as GraphOutcome<never>;
    const known = new Set(nodes.map((node) => node.id));
    for (const relation of hop.outcome === "success" ? hop.result.relations : []) {
      if (!active(relation, OFFERS) || relation.to.nodeId === undefined) continue;
      if (!known.has(relation.fromNodeId) || !known.has(relation.to.nodeId))
        continue;
      const from = bareId(relation.fromNodeId);
      const to = bareId(relation.to.nodeId);
      if (!(offers.get(from) ?? []).includes(to))
        offers.set(from, [...(offers.get(from) ?? []), to]);
      if (!(offeredBy.get(to) ?? []).includes(from))
        offeredBy.set(to, [...(offeredBy.get(to) ?? []), from]);
    }
  }
  const unordered: RoleView[] = nodes.map((node) => {
    const content = node.revision.content ?? {};
    const id = bareId(node.id);
    const former = text(content["formerId"]);
    const send = content["sendWithPrompt"];
    return {
      id,
      name: text(content["name"]),
      description: text(content["description"]),
      retired: flag(content["retired"]),
      builtin: flag(content["builtin"]),
      order: number(content["order"]),
      fields: fieldsFrom(content["fields"]),
      offers: offers.get(id) ?? [],
      offeredBy: offeredBy.get(id) ?? [],
      blocks: blocksAllowed(id, content["blocks"]),
      ...(former === "" ? {} : { formerId: former }),
      // Read on Keyword alone: what it means is keywords' (BO_0310_031).
      ...(id === KEYWORD_ROLE && Array.isArray(send)
        ? { sendWithPrompt: send.filter((entry): entry is string => typeof entry === "string") }
        : {}),
    };
  });
  const roles = inOrder(unordered);
  const rank = new Map(roles.map((role, index) => [role.id, index] as const));
  const ranked = (ids: readonly string[]): string[] =>
    [...ids].sort((left, right) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0));
  const listed = roles.map((role) => ({
    ...role,
    offers: ranked(role.offers),
    offeredBy: ranked(role.offeredBy),
  }));
  const byId = new Map<string, RoleView>();
  for (const role of listed) byId.set(role.id, role);
  // A reader still holding the id a role had as a document role finds it.
  for (const role of listed)
    if (role.formerId !== undefined && !byId.has(role.formerId))
      byId.set(role.formerId, role);
  return { outcome: "success", result: { roles: listed, byId } };
}

/** Every role, retired ones included and marked, the built-ins first. */
export async function listRoles(): Promise<GraphOutcome<RoleView[]>> {
  const catalogue = await readCatalogue();
  return catalogue.outcome === "success"
    ? { outcome: "success", result: [...catalogue.result.roles] }
    : (catalogue as GraphOutcome<never>);
}

/** One role, or a refusal naming it. */
export async function readRole(
  roleId: string,
): Promise<GraphOutcome<RoleView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const role = catalogue.result.byId.get(roleId);
  return role === undefined
    ? refuse("unknownRole", `Role ${roleId} is not here.`)
    : { outcome: "success", result: role };
}

const named = (name: string, fallback = UNNAMED_ROLE): string =>
  name.trim() === "" ? fallback : name.trim();

/** A new role, offering nothing and carrying no fields yet, placed last. */
export async function createRole(input: {
  readonly name: string;
  readonly description?: string;
}): Promise<GraphOutcome<RoleView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const id = randomUUID();
  const description = (input.description ?? "").trim();
  const order =
    catalogue.result.roles.reduce((highest, role) => Math.max(highest, role.order), 0) + 1;
  const parameters: Record<string, unknown> = {
    r_id: id,
    r_name: named(input.name),
    r_order: order,
  };
  const fields = ["id: $r_id", "name: $r_name", "order: $r_order"];
  if (description !== "") {
    fields.push("description: $r_description");
    parameters["r_description"] = description;
  }
  const written = await outsideBranch(() =>
    commit(
      `CREATE (r:${BLOCK_ROLE_TYPE} {${fields.join(", ")}, status: "established"})`,
      parameters,
      `create role ${named(input.name)}`,
      async () => undefined,
    ),
  );
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return readRole(id);
}

export type RoleCommand =
  | { readonly command: "rename"; readonly name: string }
  | { readonly command: "describe"; readonly description: string }
  | { readonly command: "retire" }
  | { readonly command: "restore" }
  | { readonly command: "offer"; readonly role: string }
  | { readonly command: "unoffer"; readonly role: string }
  | {
      readonly command: "addField";
      readonly name: string;
      readonly type: FieldType;
      readonly required?: boolean;
      readonly options?: readonly string[];
    }
  | {
      readonly command: "reviseField";
      readonly key: string;
      readonly name?: string;
      readonly type?: FieldType;
      readonly required?: boolean;
      readonly options?: readonly string[];
      /** `null` clears the default. */
      readonly default?: unknown;
    }
  | { readonly command: "removeField"; readonly key: string }
  | { readonly command: "moveField"; readonly key: string; readonly by: -1 | 1 }
  /** One *Send with prompt* switch on *Keyword*: a field's key or an offered
   * role's id, on or off (`BO_0310_031`). */
  | { readonly command: "sendWithPrompt"; readonly entry: string; readonly on: boolean }
  /** Whether blocks may take the role; the document always may (`BO_0332`). */
  | { readonly command: "blocks"; readonly allowed: boolean };

const writeRoleProperty = (
  roleId: string,
  property: string,
  value: unknown,
  rationale: string,
): Promise<GraphOutcome<void>> =>
  outsideBranch(() =>
    commit(
      `SET r.${property} = $value`,
      { rNodeId: nodeRef(roleId), value },
      rationale,
      async () => undefined,
    ),
  );

/** A field as stored: `default` only when there is one. */
const stored = (field: FieldDeclaration): Record<string, unknown> => ({
  key: field.key,
  name: field.name,
  type: field.type,
  required: field.required,
  ...(field.options === undefined ? {} : { options: [...field.options] }),
  ...(field.default === undefined ? {} : { default: field.default }),
});

/** A field revised: a changed type drops a default that no longer fits it. */
function revisedField(
  field: FieldDeclaration,
  command: Extract<RoleCommand, { command: "reviseField" }>,
): FieldDeclaration | { failure: string } {
  const type = command.type ?? field.type;
  const options =
    command.options !== undefined
      ? [...new Set(command.options.map((option) => option.trim()).filter((option) => option !== ""))]
      : field.options;
  const base: FieldDeclaration = {
    key: field.key,
    name: command.name === undefined ? field.name : named(command.name, UNNAMED_FIELD),
    type,
    required: command.required ?? field.required,
    ...(type === "choice" ? { options: options ?? [] } : {}),
  };
  const fallback = command.default === undefined ? field.default : command.default;
  if (fallback === undefined || fallback === null) return base;
  if (type === "file" || type === "reference")
    return command.default === undefined
      ? base
      : { failure: `A ${type} field takes no default.` };
  const read = valueFor(base, fallback);
  if ("failure" in read)
    return command.default === undefined ? base : { failure: read.failure };
  return read.value === null || !isHeld(read.value) ? base : { ...base, default: read.value };
}

/**
 * One act on a role, each one truth write, answering the role as it stands
 * afterwards. A built-in refuses rename, retire and restore in words; adding
 * fields and offered roles is open to it like any role (`BO_0309_014`).
 */
export async function reviseRole(
  roleId: string,
  command: RoleCommand,
): Promise<GraphOutcome<RoleView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const role = catalogue.result.byId.get(roleId);
  if (role === undefined)
    return refuse("unknownRole", `Role ${roleId} is not here.`);
  if (
    role.builtin &&
    (command.command === "rename" ||
      command.command === "retire" ||
      command.command === "restore")
  )
    return refuse(
      "builtinRole",
      `${role.name} is built in: it is never renamed, retired or restored.`,
    );
  const writeFields = (fields: readonly FieldDeclaration[], verb: string) =>
    writeRoleProperty(role.id, "fields", fields.map(stored), `${verb} of role ${role.name}`);
  let written: GraphOutcome<unknown>;
  switch (command.command) {
    case "rename":
      written = await writeRoleProperty(role.id, "name", named(command.name), `rename role ${role.name} to ${named(command.name)}`);
      break;
    case "describe":
      written = await writeRoleProperty(role.id, "description", command.description.trim(), `describe role ${role.name}`);
      break;
    case "retire":
    case "restore":
      written = await writeRoleProperty(role.id, "retired", command.command === "retire", `${command.command} role ${role.name}`);
      break;
    case "offer":
    case "unoffer": {
      const other = catalogue.result.byId.get(command.role);
      if (other === undefined)
        return refuse("unknownRole", `Role ${command.role} is not here.`);
      if (other.id === role.id)
        return refuse("offersItself", `${role.name} cannot offer itself.`);
      const offered = role.offers.includes(other.id);
      if (command.command === "offer") {
        if (offered) return { outcome: "success", result: role };
        written = await outsideBranch(() =>
          commit(
            `RELATE rref -[o:${OFFERS}]-> bref`,
            { rref: nodeRef(role.id), bref: nodeRef(other.id) },
            `${role.name} offers ${other.name}`,
            async () => undefined,
          ),
        );
        break;
      }
      if (!offered) return { outcome: "success", result: role };
      if (isBuiltinOffer(role.id, other.id))
        return refuse(
          "builtinOffer",
          `${role.name} offers ${other.name} on every instance: the offer is built in and stays.`,
        );
      const hop = await query({
        statement: `MATCH (r)-[o:${OFFERS}]->(b) RETURN GRAPH r, o, b ROOT r`,
        roots: [nodeRef(role.id)],
        metadataOnly: true,
        purpose: "the offer to close",
      });
      if (hop.outcome !== "success") return hop as GraphOutcome<never>;
      const relation = hop.result.relations.find(
        (candidate) =>
          active(candidate, OFFERS) &&
          candidate.to.nodeId === nodeRef(other.id),
      );
      if (relation === undefined) return { outcome: "success", result: role };
      written = await outsideBranch(() =>
        commit(
          "CLOSE o",
          { oRelationId: relation.id, oFrom: nodeRef(role.id) },
          `${role.name} no longer offers ${other.name}`,
          async () => undefined,
        ),
      );
      break;
    }
    case "addField": {
      const name = named(command.name, UNNAMED_FIELD);
      const field: FieldDeclaration = {
        key: mintFieldKey(name, role.fields.map((candidate) => candidate.key)),
        name,
        type: command.type,
        required: command.required === true,
        ...(command.type === "choice"
          ? { options: [...new Set((command.options ?? []).map((option) => option.trim()).filter((option) => option !== ""))] }
          : {}),
      };
      written = await writeFields([...role.fields, field], `add field ${field.name}`);
      break;
    }
    case "reviseField": {
      const field = role.fields.find((candidate) => candidate.key === command.key);
      if (field === undefined)
        return refuse("unknownField", `${role.name} has no field ${command.key}.`);
      if (
        isBuiltinField(role.id, field.key) &&
        ((command.type !== undefined && command.type !== field.type) || command.options !== undefined)
      )
        return refuse(
          "builtinField",
          `${role.name}'s ${field.name} is built in: its type and its options are the release's. Add a field beside it.`,
        );
      const revised = revisedField(field, command);
      if ("failure" in revised) return refuse("fieldShape", revised.failure);
      written = await writeFields(
        role.fields.map((candidate) => (candidate.key === field.key ? revised : candidate)),
        `revise field ${field.name}`,
      );
      break;
    }
    case "removeField": {
      // The values stored under the key stay, unread: a field put back under
      // the same key would find them, and nothing is lost by a slip.
      const field = role.fields.find((candidate) => candidate.key === command.key);
      if (field === undefined)
        return refuse("unknownField", `${role.name} has no field ${command.key}.`);
      if (isBuiltinField(role.id, field.key))
        return refuse("builtinField", `${role.name}'s ${field.name} is built in and stays. Add a field beside it.`);
      written = await writeFields(
        role.fields.filter((candidate) => candidate.key !== field.key),
        `remove field ${field.name}`,
      );
      break;
    }
    case "sendWithPrompt": {
      if (role.id !== KEYWORD_ROLE)
        return refuse("sendWithPrompt", `Only Keyword sends its words with a prompt; ${role.name} does not.`);
      const known = role.fields.some((field) => field.key === command.entry) || role.offers.includes(command.entry);
      if (!known)
        return refuse("sendWithPrompt", `${role.name} has no field or offered role ${command.entry}.`);
      const current = role.sendWithPrompt ?? [];
      const next = command.on
        ? current.includes(command.entry) ? current : [...current, command.entry]
        : current.filter((entry) => entry !== command.entry);
      written = await writeRoleProperty(role.id, "sendWithPrompt", next, `${command.on ? "send" : "stop sending"} ${command.entry} with a prompt`);
      break;
    }
    case "blocks": {
      // A built-in's is the release's, as its name is (BO_0332).
      if (role.builtin)
        return refuse(
          "builtinBlocks",
          `${role.name} is built in: ${role.blocks ? "blocks may take it" : "it is taken by documents alone"}, as the release says.`,
        );
      if (role.blocks === command.allowed) return { outcome: "success", result: role };
      written = await writeRoleProperty(
        role.id,
        "blocks",
        command.allowed,
        command.allowed ? `blocks may take role ${role.name}` : `role ${role.name} is taken by documents alone`,
      );
      break;
    }
    case "moveField": {
      const at = role.fields.findIndex((candidate) => candidate.key === command.key);
      if (at < 0)
        return refuse("unknownField", `${role.name} has no field ${command.key}.`);
      const to = at + command.by;
      if (to < 0 || to >= role.fields.length) return { outcome: "success", result: role };
      const fields = [...role.fields];
      const [moved] = fields.splice(at, 1);
      fields.splice(to, 0, moved as FieldDeclaration);
      written = await writeFields(fields, `move field ${command.key}`);
      break;
    }
  }
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return readRole(role.id);
}

/** A subject a role is taken on: a document, or a block in its reading order. */
export interface Subject {
  readonly documentId: string;
  /** Absent for the document's own roles. */
  readonly blockId?: string;
}

const subjectNode = (subject: Subject): string =>
  subject.blockId ?? subject.documentId;

/** A block of the reading order with the block it stands in. */
interface Placed {
  readonly blockId: string;
  readonly kind: string;
  readonly parentId: string | null;
}

/** Every block in reading order, a callout's children after the callout. */
function placed(blocks: readonly BlockView[]): Placed[] {
  const all: Placed[] = [];
  for (const block of blocks) {
    all.push({ blockId: block.blockId, kind: block.kind, parentId: null });
    if (block.kind === "admonition")
      for (const child of block.children)
        all.push({ blockId: child.blockId, kind: child.kind, parentId: block.blockId });
  }
  return all;
}

/** The document as it reads in the caller's scope, or a refusal naming it. */
async function documentOf(documentId: string) {
  const document = await readDocument(documentId);
  if (document.outcome === "noResult")
    return refuse<never>("unknownDocument", `Document ${documentId} is not here.`);
  return document;
}

/** One subject's stored values for one role. */
interface StoredFields {
  readonly nodeId: string;
  readonly role: string;
  readonly subject: string;
  readonly values: Record<string, FieldValue>;
  readonly files: readonly BlobReference[];
}

/** Where the roles and values of a set of subjects stand. */
interface Standing {
  /** Per subject node id: role id → the active relation. */
  readonly taken: ReadonlyMap<string, ReadonlyMap<string, ReadRelation>>;
  /** Per subject node id: role id → the stored values. */
  readonly fields: ReadonlyMap<string, ReadonlyMap<string, StoredFields>>;
  readonly dataRevision: number;
}

const valuesFrom = (value: unknown): Record<string, FieldValue> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const values: Record<string, FieldValue> = {};
  for (const [key, held] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof held === "string" ||
      typeof held === "number" ||
      typeof held === "boolean" ||
      held === null
    )
      values[key] = held;
    else if (typeof held === "object" && !Array.isArray(held)) {
      const file = held as Record<string, unknown>;
      if (typeof file["hash"] === "string" && typeof file["filename"] === "string")
        values[key] = {
          hash: file["hash"],
          filename: file["filename"],
          mediaType: text(file["mediaType"]),
          size: number(file["size"]),
        };
    }
  }
  return values;
};

/** The roles taken on, and the values stored for, a set of subjects. */
async function readStanding(subjects: readonly string[]): Promise<GraphOutcome<Standing>> {
  const taken = new Map<string, Map<string, ReadRelation>>();
  const fields = new Map<string, Map<string, StoredFields>>();
  if (subjects.length === 0)
    return { outcome: "success", result: { taken, fields, dataRevision: 0 } };
  const roots = subjects.map(nodeRef);
  const assigned = await query({
    statement: `MATCH (s)-[h:${HAS_BLOCK_ROLE}]->(r) RETURN GRAPH s, h, r ROOT s`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "roles taken",
  });
  if (assigned.outcome !== "success" && assigned.outcome !== "noResult")
    return assigned as GraphOutcome<never>;
  let dataRevision = assigned.outcome === "success" ? assigned.result.resolvedDataRevision : 0;
  for (const relation of assigned.outcome === "success" ? assigned.result.relations : []) {
    if (!active(relation, HAS_BLOCK_ROLE) || relation.to.nodeId === undefined) continue;
    const held = taken.get(relation.fromNodeId) ?? new Map<string, ReadRelation>();
    held.set(bareId(relation.to.nodeId), relation);
    taken.set(relation.fromNodeId, held);
  }
  const stored = await query({
    statement: `MATCH (f)-[o:${FIELDS_OF}]->(s) RETURN GRAPH f, o, s ROOT s`,
    roots,
    unbounded: true,
    purpose: "role values",
  });
  if (stored.outcome !== "success" && stored.outcome !== "noResult")
    return stored as GraphOutcome<never>;
  if (stored.outcome === "success") {
    dataRevision = Math.max(dataRevision, stored.result.resolvedDataRevision);
    const byId = new Map(stored.result.nodes.map((node) => [node.id, node] as const));
    for (const relation of stored.result.relations) {
      if (!active(relation, FIELDS_OF) || relation.to.nodeId === undefined) continue;
      const node = byId.get(relation.fromNodeId);
      if (node === undefined || !isType(node, ROLE_FIELDS_TYPE)) continue;
      const content = node.revision.content ?? {};
      const role = text(content["role"]);
      if (role === "") continue;
      const held = fields.get(relation.to.nodeId) ?? new Map<string, StoredFields>();
      held.set(role, {
        nodeId: node.id,
        role,
        subject: relation.to.nodeId,
        values: valuesFrom(content["values"]),
        files: Array.isArray(content["files"]) ? (content["files"] as BlobReference[]) : [],
      });
      fields.set(relation.to.nodeId, held);
    }
  }
  return { outcome: "success", result: { taken, fields, dataRevision } };
}

/** What open groups propose on the subjects: roles to take, values to store. */
interface Proposed {
  readonly roles: ReadonlyMap<string, ReadonlySet<string>>;
  readonly values: ReadonlyMap<string, ReadonlySet<string>>;
}

async function readProposed(
  subjects: readonly string[],
  fieldNodes: ReadonlyMap<string, { subject: string; role: string }>,
): Promise<Proposed> {
  const roles = new Map<string, Set<string>>();
  const values = new Map<string, Set<string>>();
  const groups = await reachingGroups([...subjects.map(nodeRef), ...fieldNodes.keys()]);
  if (groups.outcome !== "success") return { roles, values };
  const add = (map: Map<string, Set<string>>, subject: string, role: string) =>
    map.set(subject, new Set([...(map.get(subject) ?? []), role]));
  const wanted = new Set(subjects.map(nodeRef));
  for (const group of groups.result) {
    if (group.rejected === true) continue;
    const staged = group.stagedRelations;
    const newFieldsOf = new Map<string, string>();
    const newFieldsFor = new Map<string, string>();
    for (const relation of staged) {
      const to = nodeRef(relation.toId);
      if (relation.type === HAS_BLOCK_ROLE && wanted.has(relation.fromNodeId))
        add(roles, relation.fromNodeId, bareId(to));
      if (relation.type === FIELDS_OF && wanted.has(to)) newFieldsOf.set(relation.fromNodeId, to);
      if (relation.type === FIELDS_FOR) newFieldsFor.set(relation.fromNodeId, bareId(to));
    }
    for (const [node, subject] of newFieldsOf) {
      const role = newFieldsFor.get(node);
      if (role !== undefined) add(values, subject, role);
    }
    for (const node of group.touchedNodes) {
      const held = fieldNodes.get(nodeRef(node));
      if (held !== undefined && !(group.carryForwardNodes ?? []).includes(node))
        add(values, held.subject, held.role);
    }
  }
  return { roles, values };
}

const takenView = (
  role: RoleView,
  offered: boolean,
  stored: StoredFields | undefined,
  proposed: "role" | "values" | undefined,
  onBlock: boolean,
): TakenRole => {
  const values = stored?.values ?? {};
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    retired: role.retired,
    builtin: role.builtin,
    offered,
    fields: role.fields,
    values,
    missing: missingOf(role.fields, values),
    blocks: role.blocks,
    ...(proposed === undefined ? {} : { proposed }),
    ...(role.sendWithPrompt === undefined ? {} : { sendWithPrompt: role.sendWithPrompt }),
    ...(onBlock && !role.blocks ? { notOnBlock: true as const } : {}),
  };
};

/**
 * A document's roles and each block's, in reading order, with what each
 * may take, at the data revision it was read at (`BO_0309_012`): the one
 * shape a route, a run and a dependent extension read. `scope` names a branch
 * the caller works in, or a data revision to read at; absent, it reads truth
 * as it stands and marks what open groups propose.
 */
export async function rolesOf(
  documentId: string,
  scope: { readonly branch?: string; readonly dataRevision?: number } = {},
): Promise<GraphOutcome<DocumentRolesView>> {
  const read = () =>
    withBranch(scope.branch, () =>
      readRoles(documentId, scope.dataRevision === undefined),
    );
  return scope.dataRevision === undefined
    ? read()
    : atDataRevision(scope.dataRevision, read);
}

async function readRoles(
  documentId: string,
  withProposals: boolean,
): Promise<GraphOutcome<DocumentRolesView>> {
  const document = await documentOf(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const blocks = placed(document.result.blocks);
  const subjects = [documentId, ...blocks.map((block) => block.blockId)];
  const standing = await readStanding(subjects);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const fieldNodes = new Map<string, { subject: string; role: string }>();
  for (const held of standing.result.fields.values())
    for (const stored of held.values())
      fieldNodes.set(stored.nodeId, { subject: stored.subject, role: stored.role });
  const proposed = withProposals
    ? await readProposed(subjects, fieldNodes)
    : { roles: new Map<string, ReadonlySet<string>>(), values: new Map<string, ReadonlySet<string>>() };
  const { byId, roles } = catalogue.result;
  const inherited = await readInherited(documentId, catalogue.result);
  const inheritedIds = [...new Set(inherited.map((role) => role.id))];

  const takenIds = (subject: string): string[] =>
    [...(standing.result.taken.get(nodeRef(subject))?.keys() ?? [])]
      .map((id) => byId.get(id)?.id ?? id)
      .filter((id) => byId.has(id));
  // Whether a role could be taken here, retired or not: the retired flag is
  // said on its own. Only what stands above counts: a role offered by a role
  // on the subject itself is offered to the blocks under it, never to the
  // subject (BO_0309_Q1).
  const offeredHere = (role: RoleView, above: ReadonlySet<string>): boolean =>
    role.offeredBy.length === 0 || role.offeredBy.some((offering) => above.has(offering));
  const viewOf = (subject: string, above: readonly string[], onBlock: boolean) => {
    const own = takenIds(subject);
    const chain = new Set(above);
    const node = nodeRef(subject);
    const stored = standing.result.fields.get(node);
    const proposing = proposed.roles.get(node) ?? new Set<string>();
    const valuing = proposed.values.get(node) ?? new Set<string>();
    const takenRoles: TakenRole[] = [];
    for (const role of roles) {
      const isTaken = own.includes(role.id);
      const isProposed = proposing.has(role.id);
      if (!isTaken && !isProposed) continue;
      takenRoles.push(
        takenView(
          role,
          offeredHere(role, chain),
          stored?.get(role.id),
          isTaken ? (valuing.has(role.id) ? "values" : undefined) : "role",
          onBlock,
        ),
      );
    }
    return { roles: takenRoles, takeable: takeableFrom(roles, chain, onBlock), own };
  };

  const documentView = viewOf(documentId, inheritedIds, false);
  const ownOf = new Map<string, readonly string[]>();
  const roledBlocks: RoledBlock[] = [];
  for (const block of blocks) {
    const above = [
      ...inheritedIds,
      ...documentView.own,
      ...(block.parentId === null ? [] : (ownOf.get(block.parentId) ?? [])),
    ];
    const view = viewOf(block.blockId, above, true);
    ownOf.set(block.blockId, view.own);
    roledBlocks.push({
      blockId: block.blockId,
      kind: block.kind,
      parentId: block.parentId,
      roles: view.roles,
      takeable: view.takeable,
    });
  }
  return {
    outcome: "success",
    result: {
      documentId,
      dataRevision: standing.result.dataRevision,
      roles: documentView.roles,
      takeable: documentView.takeable,
      blocks: roledBlocks,
      inherited,
      referenceTitles: await referenceTitles(documentView.roles),
    },
  };
}

/** Longest a block's words run as a reference's title. */
const REFERENCE_WORDS = 60;

/** How a node a reference names is called: a document by its title, a block
 * by its first words, cut. */
export function titleOfNode(content: Readonly<Record<string, unknown>>, document: boolean): string {
  if (document) return text(content["title"]);
  const words = (Array.isArray(content["runs"]) ? runsText(content["runs"] as readonly Run[]) : text(content["text"]))
    .replace(/\s+/gu, " ")
    .trim();
  return words.length > REFERENCE_WORDS ? `${words.slice(0, REFERENCE_WORDS - 1).trimEnd()}…` : words;
}

/**
 * The titles of the nodes the reference values of these roles name
 * (`DO_0030_005`): one read per distinct id, in the read's own scope. A value
 * naming nothing that reads, or something with no words, is left out.
 */
async function referenceTitles(roles: readonly TakenRole[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const role of roles)
    for (const field of role.fields) {
      const value = role.values[field.key];
      if (field.type === "reference" && typeof value === "string" && value !== "") ids.add(value);
    }
  const titles: Record<string, string> = {};
  await Promise.all(
    [...ids].map(async (id) => {
      const found = await query({
        statement: "MATCH (n {id: $id}) RETURN GRAPH n",
        parameters: { id },
        purpose: "a reference value's title",
      });
      if (found.outcome !== "success") return;
      const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(id));
      if (node === undefined) return;
      const title = titleOfNode(node.revision.content ?? {}, isType(node, "document"));
      if (title !== "") titles[id] = title;
    }),
  );
  return titles;
}

/** The kind `documents` presents a document as, whose focused work a
 * document is. */
const DOCUMENT_KIND = "documents:document";

/** How far up the focus chain is followed: deep enough for any outline a
 * person writes, and a stop for a chain that loops. */
const FOCUS_DEPTH = 16;

/** The callout and the document a block stands in, nearest first. */
async function holdersOf(blockId: string): Promise<readonly { readonly id: string; readonly document: boolean }[]> {
  const holders: { id: string; document: boolean }[] = [];
  let current = nodeRef(blockId);
  for (let step = 0; step < 2; step++) {
    const read = await query({
      statement: `MATCH (p)-[c:${CONTAINS}]->(b) RETURN GRAPH p, c, b ROOT b`,
      roots: [current],
      metadataOnly: true,
      purpose: "where a focused block stands",
    });
    if (read.outcome !== "success") break;
    const edge = read.result.relations.find(
      (relation) => relation.type === CONTAINS && relation.validity.status === "active" && relation.to.nodeId === current,
    );
    const holder = edge === undefined ? undefined : read.result.nodes.find((node) => node.id === edge.fromNodeId);
    if (holder === undefined) break;
    const isDocument = typeOf(holder) === "document";
    holders.push({ id: bareId(holder.id), document: isDocument });
    if (isDocument) break;
    current = holder.id;
  }
  return holders;
}

/**
 * The roles above a document that is a block's focused work (walk finding,
 * 2026-10-01): the block it was opened from is above it, so that block's
 * roles, those of the callout and the document it stands in, and on up the
 * chain, offer their roles to the focused work and its blocks. Nearest
 * first; a chain that loops or goes deeper than `FOCUS_DEPTH` stops there.
 * A focus that cannot be read is no focus: the document then reads as a
 * document of its own.
 */
async function readInherited(documentId: string, catalogue: Catalogue): Promise<readonly InheritedRole[]> {
  const inherited: InheritedRole[] = [];
  const seen = new Set<string>([documentId]);
  let current = documentId;
  for (let step = 0; step < FOCUS_DEPTH; step++) {
    const focus = await focusOf(DOCUMENT_KIND, current).catch(() => null);
    if (focus === null || focus.outcome !== "success" || focus.result === null) break;
    const block = focus.result.blockId;
    const holders = await holdersOf(block);
    const parent = holders.find((holder) => holder.document)?.id;
    if (parent === undefined) break;
    const chain = [block, ...holders.map((holder) => holder.id)];
    const standing = await readStanding(chain);
    if (standing.outcome !== "success") break;
    for (const subject of chain) {
      for (const roleId of standing.result.taken.get(nodeRef(subject))?.keys() ?? []) {
        const role = catalogue.byId.get(roleId);
        if (role === undefined) continue;
        inherited.push({ id: role.id, name: role.name, description: role.description, on: subject, document: parent });
      }
    }
    if (seen.has(parent)) break;
    seen.add(parent);
    current = parent;
  }
  return inherited;
}

/** A statement and its parameters, as a truth write or a run's staging takes it. */
export interface Staged {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
  readonly rationale: string;
}

/** Where a subject stands, read once for an act on it. */
interface Situation {
  readonly catalogue: Catalogue;
  readonly view: DocumentRolesView;
  readonly standing: Standing;
  readonly node: string;
  readonly takeable: readonly string[];
  readonly taken: readonly string[];
}

async function situationOf(subject: Subject): Promise<GraphOutcome<Situation>> {
  const view = await rolesOf(subject.documentId);
  if (view.outcome !== "success") return view as GraphOutcome<never>;
  let takeable = view.result.takeable;
  let taken = view.result.roles.filter((role) => role.proposed !== "role").map((role) => role.id);
  if (subject.blockId !== undefined) {
    const block = view.result.blocks.find((candidate) => candidate.blockId === subject.blockId);
    if (block === undefined)
      return refuse(
        "unknownBlock",
        `Block ${subject.blockId} is not in the reading order of document ${subject.documentId}.`,
      );
    takeable = block.takeable;
    taken = block.roles.filter((role) => role.proposed !== "role").map((role) => role.id);
  }
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const node = subjectNode(subject);
  const standing = await readStanding([node]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  return {
    outcome: "success",
    result: { catalogue: catalogue.result, view: view.result, standing: standing.result, node, takeable, taken },
  };
}

const subjectName = (subject: Subject): string =>
  subject.blockId === undefined ? `document ${subject.documentId}` : `block ${subject.blockId}`;

/**
 * The statement that takes a role on a subject (`BO_0309_012`): the relation,
 * and the role's defaults filled in beside any value already stored
 * (`BO_0318_Q8`). Refused in words for a role that is not here, is retired,
 * or cannot be taken where the subject stands. Null when it is taken already.
 */
function takeStatement(
  situation: Situation,
  subject: Subject,
  roleId: string,
  withDefaults = true,
): GraphOutcome<Staged | null> {
  const role = situation.catalogue.byId.get(roleId);
  if (role === undefined) return refuse("unknownRole", `Role ${roleId} is not here.`);
  if (situation.taken.includes(role.id)) return { outcome: "success", result: null };
  if (role.retired)
    return refuse("retiredRole", `${role.name} is retired and is not offered any more.`);
  // Before the offer: an offer never lets a block take a role blocks may not
  // take (RO_0003_Q5).
  if (subject.blockId !== undefined && !role.blocks)
    return refuse(
      "blockNotAllowed",
      `${role.name} is taken by documents alone: take it on the document${role.offeredBy.length > 0 ? ", or on the focused work of the block that offers it" : ""}.`,
    );
  if (!situation.takeable.includes(role.id)) {
    const offering = role.offeredBy
      .map((id) => situation.catalogue.byId.get(id)?.name ?? "")
      .filter((name) => name !== "");
    return refuse(
      "notOffered",
      `${role.name} is offered by ${offering.join(" or ") || "another role"}, and nothing above this ${subject.blockId === undefined ? "document" : "block"} carries it.`,
    );
  }
  const parameters: Record<string, unknown> = {
    sref: nodeRef(situation.node),
    rref: nodeRef(role.id),
  };
  const statements = [`RELATE sref -[n:${HAS_BLOCK_ROLE}]-> rref`];
  // A document taking *Profile* is a profile, so it carries the record every
  // reader of a profile keys on. BO_0311_015
  if (role.id === PROFILE_ROLE && subject.blockId === undefined) {
    parameters["spNodeId"] = nodeRef(situation.node);
    parameters["sp_record"] = PROFILE_RECORD;
    statements.push("SET sp.record = $sp_record");
  }
  const defaults = withDefaults ? defaultsOf(role.fields) : {};
  const stored = situation.standing.fields.get(nodeRef(situation.node))?.get(role.id);
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => !isHeld(stored?.values[key])),
  );
  if (Object.keys(missing).length > 0) {
    if (stored === undefined) {
      const id = randomUUID();
      parameters["f_id"] = id;
      parameters["f_role"] = role.id;
      parameters["f_values"] = missing;
      parameters["fref"] = nodeRef(id);
      statements.push(
        `CREATE (f:${ROLE_FIELDS_TYPE} {id: $f_id, role: $f_role, values: $f_values, status: "established"})`,
        `RELATE fref -[fo:${FIELDS_OF}]-> sref`,
        `RELATE fref -[ff:${FIELDS_FOR}]-> rref`,
      );
    } else {
      parameters["fNodeId"] = stored.nodeId;
      parameters["f_values"] = { ...stored.values, ...missing };
      statements.push("SET f.values = $f_values");
    }
  }
  return {
    outcome: "success",
    result: {
      statement: statements.join("; "),
      parameters,
      rationale: `${subjectName(subject)} takes the role ${role.name}`,
    },
  };
}

/** The statement that clears a role from a subject; its values stay stored,
 * so taking it again finds them. Null when it is not taken. */
function clearStatement(
  situation: Situation,
  subject: Subject,
  roleId: string,
): GraphOutcome<Staged | null> {
  const role = situation.catalogue.byId.get(roleId);
  const relation = situation.standing.taken
    .get(nodeRef(situation.node))
    ?.get(role?.id ?? roleId);
  if (relation === undefined) return { outcome: "success", result: null };
  // A document clearing *Profile* is no profile any more. BO_0311_015
  const unprofiled = role?.id === PROFILE_ROLE && subject.blockId === undefined;
  return {
    outcome: "success",
    result: {
      // A close names its vantage: the kernel's write gate classifies a closed
      // relation from a node the script touches, and a bare close touches
      // none, so `hFrom` says where it is readable from (`ui-kernel.md`).
      statement: unprofiled ? "CLOSE h; SET sp.record = null" : "CLOSE h",
      parameters: { hRelationId: relation.id, hFrom: nodeRef(situation.node), ...(unprofiled ? { spNodeId: nodeRef(situation.node) } : {}) },
      rationale: `${subjectName(subject)} no longer takes the role ${role?.name ?? roleId}`,
    },
  };
}

/** Whether a node a reference value names is there. */
async function exists(id: string): Promise<boolean> {
  const found = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id },
    metadataOnly: true,
    purpose: "a reference value's node",
  });
  return found.outcome === "success" && found.result.nodes.some((node) => node.id === nodeRef(id));
}

/**
 * The statement that stores values of one role on a subject (`BO_0309_013`):
 * each value read against its field's type, a reference checked to name a
 * node that is there, a file's live blob reference hoisted into `files` at
 * the node's top level, which is where CCGW keeps a blob alive
 * (`binary-content.md`). The subject must take the role.
 */
async function valuesStatement(
  situation: Situation,
  subject: Subject,
  roleId: string,
  entries: Readonly<Record<string, unknown>>,
): Promise<GraphOutcome<Staged | null>> {
  const role = situation.catalogue.byId.get(roleId);
  if (role === undefined) return refuse("unknownRole", `Role ${roleId} is not here.`);
  if (!situation.taken.includes(role.id))
    return refuse("roleNotTaken", `This ${subject.blockId === undefined ? "document" : "block"} does not take ${role.name}.`);
  const stored = situation.standing.fields.get(nodeRef(situation.node))?.get(role.id);
  const values: Record<string, FieldValue> = { ...(stored?.values ?? {}) };
  for (const [key, raw] of Object.entries(entries)) {
    const field = role.fields.find((candidate) => candidate.key === key);
    if (field === undefined) return refuse("unknownField", `${role.name} has no field ${key}.`);
    const read = valueFor(field, raw);
    if ("failure" in read) return refuse("valueShape", read.failure);
    if (field.type === "reference" && typeof read.value === "string" && !(await exists(read.value)))
      return refuse("unknownReference", `${field.name} names ${read.value}, which is not here.`);
    if (read.value === null || read.value === "") delete values[key];
    else values[key] = read.value;
  }
  const files: BlobReference[] = [];
  for (const value of Object.values(values)) {
    if (typeof value !== "object" || value === null) continue;
    const objectId = objectIdOfHash(value.hash);
    if (objectId === null) return refuse("valueShape", `${value.filename} was not uploaded here.`);
    const file: FileValue = value;
    files.push({ ...blobReference(objectId, file.mediaType, file.size), filename: file.filename });
  }
  const parameters: Record<string, unknown> = { f_values: values, f_files: files };
  let statement: string;
  if (stored === undefined) {
    const id = randomUUID();
    Object.assign(parameters, {
      f_id: id,
      f_role: role.id,
      fref: nodeRef(id),
      sref: nodeRef(situation.node),
      rref: nodeRef(role.id),
    });
    statement = [
      `CREATE (f:${ROLE_FIELDS_TYPE} {id: $f_id, role: $f_role, values: $f_values, files: $f_files, status: "established"})`,
      `RELATE fref -[fo:${FIELDS_OF}]-> sref`,
      `RELATE fref -[ff:${FIELDS_FOR}]-> rref`,
    ].join("; ");
  } else {
    parameters["fNodeId"] = stored.nodeId;
    statement = "SET f.values = $f_values, f.files = $f_files";
  }
  return {
    outcome: "success",
    result: { statement, parameters, rationale: `values of ${role.name} on ${subjectName(subject)}` },
  };
}

/** A truth write, tried once more when the kernel's per-node floor refuses a
 * second write to the same node within its 250ms. */
async function writeTruth(staged: Staged): Promise<GraphOutcome<void>> {
  const attempt = () =>
    outsideBranch(() => commit(staged.statement, staged.parameters, staged.rationale, async () => undefined));
  const written = await attempt();
  if (written.outcome === "validationFailure" && written.failures[0]?.rule === "write_too_frequent") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return attempt();
  }
  return written;
}

/**
 * The person takes or clears a role on a document or a block, as truth at
 * once (`BO_0309_012`, `BO_0308_Q4`), and reads the document's roles back.
 */
export async function setRole(input: Subject & {
  readonly role: string;
  readonly taken: boolean;
}): Promise<GraphOutcome<DocumentRolesView>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged = input.taken
    ? takeStatement(situation.result, input, input.role)
    : clearStatement(situation.result, input, input.role);
  if (staged.outcome !== "success") return staged as GraphOutcome<never>;
  if (staged.result !== null) {
    const written = await writeTruth(staged.result);
    if (written.outcome !== "success") return written as GraphOutcome<never>;
  }
  return rolesOf(input.documentId);
}

/** The person stores values of a role on a document or a block (`BO_0309_013`). */
export async function setValues(input: Subject & {
  readonly role: string;
  readonly values: Readonly<Record<string, unknown>>;
}): Promise<GraphOutcome<DocumentRolesView>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged = await valuesStatement(situation.result, input, input.role, input.values);
  if (staged.outcome !== "success") return staged as GraphOutcome<never>;
  if (staged.result !== null) {
    const written = await writeTruth(staged.result);
    if (written.outcome !== "success") return written as GraphOutcome<never>;
  }
  return rolesOf(input.documentId);
}

/**
 * What a run proposes (`BO_0309_016`): roles to take and to clear and values
 * to store on one subject, as statements the kernel stages into the run's
 * group, refused in words where the person's own act would be. A value may
 * be proposed for a role the same proposal takes.
 */
export async function proposeRoles(input: Subject & {
  readonly take: readonly string[];
  readonly clear: readonly string[];
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}): Promise<GraphOutcome<readonly Staged[]>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged: Staged[] = [];
  const { byId } = situation.result.catalogue;
  const valued = new Set(Object.keys(input.values).map((role) => byId.get(role)?.id ?? role));
  const values: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [role, entries] of Object.entries(input.values)) values[byId.get(role)?.id ?? role] = entries;
  let taken = [...situation.result.taken];
  for (const role of input.take) {
    const id = byId.get(role)?.id;
    const newlyTaken = id !== undefined && !taken.includes(id);
    // A role taken with values in the same proposal gets its defaults beside
    // those values in one roleFields node, not a node from each statement.
    const one = takeStatement({ ...situation.result, taken }, input, role, !(id !== undefined && valued.has(id)));
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
    if (id === undefined) continue;
    if (newlyTaken && valued.has(id)) {
      const defaults = defaultsOf(byId.get(id)?.fields ?? []);
      values[id] = { ...defaults, ...(values[id] ?? {}) };
    }
    taken = [...taken, id];
  }
  for (const role of input.clear) {
    const one = clearStatement(situation.result, input, role);
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
  }
  for (const [role, entries] of Object.entries(values)) {
    const one = await valuesStatement({ ...situation.result, taken }, input, role, entries);
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
  }
  return { outcome: "success", result: staged };
}

/**
 * The built-ins an instance does not hold yet (`BO_0309_014`), as one
 * statement creating them, or none. Idempotent: run by the executable
 * migration `builtin-roles` once per instance, and by nothing else.
 */
export async function builtinsStatement(): Promise<GraphOutcome<Staged>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  BUILTIN_ROLES.forEach((role, index) => {
    if (catalogue.result.byId.has(role.id)) return;
    const alias = `b${index}`;
    parameters[`${alias}_id`] = role.id;
    parameters[`${alias}_name`] = role.name;
    parameters[`${alias}_description`] = role.description;
    parameters[`${alias}_order`] = index;
    const fields = "fields" in role ? role.fields : undefined;
    if (fields !== undefined) parameters[`${alias}_fields`] = fields;
    const fieldsProperty = fields === undefined ? "" : `, fields: $${alias}_fields`;
    statements.push(
      `CREATE (${alias}:${BLOCK_ROLE_TYPE} {id: $${alias}_id, name: $${alias}_name, description: $${alias}_description, order: $${alias}_order, builtin: true${fieldsProperty}, status: "established"})`,
    );
  });
  return {
    outcome: "success",
    result: { statement: statements.join("; "), parameters, rationale: "the built-in roles" },
  };
}

/**
 * What *Keyword* needs on an instance beyond the built-ins themselves
 * (`BO_0310_030`, `BO_0310_031`): the offers of *Definition* and *Alias*
 * where they do not stand, and *Send with prompt* set to the definition where
 * it was never set — once, so an upgrade never resets a person's switches.
 * Idempotent: run by the executable migration `keyword-builtins` after the
 * built-ins stand.
 */
export async function keywordBuiltinsStatement(): Promise<GraphOutcome<Staged>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  BUILTIN_OFFERS.forEach(([from, to], index) => {
    const offering = catalogue.result.byId.get(from);
    if (offering === undefined || !catalogue.result.byId.has(to) || offering.offers.includes(to)) return;
    parameters[`o${index}from`] = nodeRef(from);
    parameters[`o${index}to`] = nodeRef(to);
    statements.push(`RELATE o${index}from -[o${index}:${OFFERS}]-> o${index}to`);
  });
  const keyword = catalogue.result.byId.get(KEYWORD_ROLE);
  if (keyword !== undefined && keyword.sendWithPrompt === undefined) {
    parameters["kNodeId"] = nodeRef(KEYWORD_ROLE);
    parameters["kSend"] = [...DEFAULT_SEND_WITH_PROMPT];
    statements.push("SET k.sendWithPrompt = $kSend");
  }
  return {
    outcome: "success",
    result: { statement: statements.join("; "), parameters, rationale: "what Keyword offers and sends" },
  };
}

/** A document carrying a role, as a built-in's row lists it. */
export interface CarryingDocument {
  readonly id: string;
  readonly title: string;
}

/**
 * The documents carrying a role as their own (`BO_0309_015`): what a built-in
 * role's row unfolds to in the Roles category, by title.
 */
export async function documentsCarrying(roleId: string): Promise<GraphOutcome<readonly CarryingDocument[]>> {
  const role = await readRole(roleId);
  if (role.outcome !== "success") return role as GraphOutcome<never>;
  const found = await query({
    statement: `MATCH (d:document)-[h:${HAS_BLOCK_ROLE}]->(r) RETURN GRAPH d, h, r ROOT r`,
    roots: [nodeRef(role.result.id)],
    unbounded: true,
    purpose: "documents carrying a role",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const byId = new Map(found.result.nodes.map((node) => [node.id, node] as const));
  const documents: CarryingDocument[] = [];
  for (const relation of found.result.relations) {
    if (!active(relation, HAS_BLOCK_ROLE)) continue;
    const node = byId.get(relation.fromNodeId);
    if (node === undefined || !isType(node, "document")) continue;
    documents.push({ id: bareId(node.id), title: text((node.revision.content ?? {})["title"]) });
  }
  return {
    outcome: "success",
    result: documents.sort((left, right) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1)),
  };
}
