import { readCatalogue } from "~/extensions/doc-block-roles/server/roles";
import {
  ALIAS_ROLE,
  DEFINITION_ROLE,
  FIELDS_FOR,
  FIELDS_OF,
  HAS_BLOCK_ROLE,
  KEYWORD_ROLE,
  OFFERS,
  ROLE_FIELDS_TYPE,
  type FieldDeclaration,
  type RoleView,
} from "~/extensions/doc-block-roles/lib/roles";
import { query } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

/**
 * The merge (`calliopa-bootstrap`'s `BO_0310_021`, `BO_0310_Q4`): the roles a
 * person chose in the Keywords section as the keyword, definition and alias
 * roles become the built-ins *Keyword*, *Definition* and *Alias*. Each chosen
 * role's fields are copied onto its built-in — a field whose name the
 * built-in already holds is kept once, its values moved to the built-in's key
 * — what it offers is offered by the built-in, every assignment of it moves
 * to the built-in with its values, and the chosen role is retired, so *Roles*
 * shows no duplicate. An executable migration (`BO_0312_001`): the kernel
 * posts the owner's settings with the call, since a callback carries no
 * session to read them by, and writes the one script answered as truth.
 */

/** A migration's answer: one script, or an empty statement. */
export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** The chosen roles as the settings record kept them. */
export interface ChosenRoles {
  readonly keywordRole: string | null;
  readonly definitionRole: string | null;
  readonly aliasRole: string | null;
}

const idOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/** The chosen roles from the settings the kernel handed the call: the
 * definition was kept as `{kind, id}`. */
export function chosenFrom(settings: unknown): ChosenRoles {
  const record = typeof settings === "object" && settings !== null ? (settings as Record<string, unknown>) : {};
  const definition = record["definitionRole"];
  return {
    keywordRole: idOf(record["keywordRole"]),
    definitionRole: typeof definition === "object" && definition !== null ? idOf((definition as Record<string, unknown>)["id"]) : idOf(definition),
    aliasRole: idOf(record["aliasRole"]),
  };
}

/** One subject's assignment of a role, with the values stored for it. */
export interface Assignment {
  readonly subject: string;
  readonly relationId: string;
}

export interface StoredValues {
  readonly nodeId: string;
  readonly subject: string;
  readonly values: Readonly<Record<string, unknown>>;
  /** The active `fieldsFor` relation to the role. */
  readonly forRelationId: string;
}

/** What hangs on one role: who takes it and the values they hold. */
export interface Holding {
  readonly assignments: readonly Assignment[];
  readonly values: readonly StoredValues[];
}

/** One chosen role and the built-in it becomes. */
export interface MergePair {
  readonly from: RoleView;
  readonly into: RoleView;
  readonly held: Holding;
  readonly intoHeld: Holding;
}

/**
 * The one script (pure): for each pair the built-in's fields widened by the
 * chosen role's, its offers widened, every assignment and its values moved,
 * the chosen role retired. `merged` maps each chosen role to its built-in, so
 * an offer of one chosen role to another becomes nothing — the built-ins
 * already offer each other.
 */
export function mergeStatement(pairs: readonly MergePair[]): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  const merged = new Map(pairs.map((pair) => [pair.from.id, pair.into.id] as const));
  pairs.forEach((pair, index) => {
    const at = `m${index}`;
    const into = pair.into;
    // Fields: the built-in's kept; a chosen field under a name it holds is
    // kept once, its values moved to the built-in's key.
    const byName = new Map(into.fields.map((field) => [field.name.trim().toLowerCase(), field.key] as const));
    const rekey = new Map<string, string>();
    const fields: FieldDeclaration[] = [...into.fields];
    for (const field of pair.from.fields) {
      const same = byName.get(field.name.trim().toLowerCase());
      if (same !== undefined) {
        if (same !== field.key) rekey.set(field.key, same);
        continue;
      }
      if (fields.some((held) => held.key === field.key)) continue;
      fields.push(field);
      byName.set(field.name.trim().toLowerCase(), field.key);
    }
    if (fields.length !== into.fields.length) {
      parameters[`${at}iNodeId`] = nodeRef(into.id);
      parameters[`${at}_fields`] = fields.map((field) => ({ ...field }));
      statements.push(`SET ${at}i.fields = $${at}_fields`);
    }
    // Offers: what the chosen role offers, offered by the built-in.
    pair.from.offers.forEach((offered, offerIndex) => {
      const target = merged.get(offered) ?? offered;
      if (target === into.id || into.offers.includes(target)) return;
      const alias = `${at}o${offerIndex}`;
      parameters[`${alias}from`] = nodeRef(into.id);
      parameters[`${alias}to`] = nodeRef(target);
      statements.push(`RELATE ${alias}from -[${alias}:${OFFERS}]-> ${alias}to`);
    });
    // Assignments: each moves to the built-in, unless the subject takes it.
    const takesInto = new Set(pair.intoHeld.assignments.map((assignment) => assignment.subject));
    pair.held.assignments.forEach((assignment, assignmentIndex) => {
      const alias = `${at}h${assignmentIndex}`;
      parameters[`${alias}RelationId`] = assignment.relationId;
      parameters[`${alias}From`] = nodeRef(assignment.subject);
      statements.push(`CLOSE ${alias}`);
      if (takesInto.has(assignment.subject)) return;
      takesInto.add(assignment.subject);
      parameters[`${alias}s`] = nodeRef(assignment.subject);
      parameters[`${alias}r`] = nodeRef(into.id);
      statements.push(`RELATE ${alias}s -[${alias}n:${HAS_BLOCK_ROLE}]-> ${alias}r`);
    });
    // Values: a subject's node moves to the built-in, rekeyed; a subject that
    // already holds the built-in's values takes the chosen role's beside
    // them, its own kept where both hold one.
    const intoValues = new Map(pair.intoHeld.values.map((stored) => [stored.subject, stored] as const));
    pair.held.values.forEach((stored, valueIndex) => {
      const alias = `${at}v${valueIndex}`;
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(stored.values)) values[rekey.get(key) ?? key] = value;
      const beside = intoValues.get(stored.subject);
      if (beside !== undefined) {
        parameters[`${alias}bNodeId`] = beside.nodeId;
        parameters[`${alias}_values`] = { ...values, ...beside.values };
        statements.push(`SET ${alias}b.values = $${alias}_values`);
        return;
      }
      parameters[`${alias}fNodeId`] = stored.nodeId;
      parameters[`${alias}_role`] = into.id;
      parameters[`${alias}_values`] = values;
      statements.push(`SET ${alias}f.role = $${alias}_role, ${alias}f.values = $${alias}_values`);
      parameters[`${alias}xRelationId`] = stored.forRelationId;
      parameters[`${alias}xFrom`] = stored.nodeId;
      statements.push(`CLOSE ${alias}x`);
      parameters[`${alias}ff`] = stored.nodeId;
      parameters[`${alias}fr`] = nodeRef(into.id);
      statements.push(`RELATE ${alias}ff -[${alias}y:${FIELDS_FOR}]-> ${alias}fr`);
    });
    // The chosen role, retired: nothing offers it, and nothing takes it.
    parameters[`${at}rNodeId`] = nodeRef(pair.from.id);
    statements.push(`SET ${at}r.retired = true`);
  });
  return { statement: statements.join("; "), parameters };
}

/** Who takes a role and the values stored for it. */
async function readHolding(roleId: string): Promise<GraphOutcome<Holding>> {
  const role = nodeRef(roleId);
  const taken = await query({
    statement: `MATCH (s)-[h:${HAS_BLOCK_ROLE}]->(r) RETURN GRAPH s, h, r ROOT r`,
    roots: [role],
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: who takes a keyword role",
  });
  if (taken.outcome !== "success" && taken.outcome !== "noResult") return taken as GraphOutcome<never>;
  const assignments: Assignment[] = (taken.outcome === "success" ? taken.result.relations : [])
    .filter((relation) => relation.type === HAS_BLOCK_ROLE && relation.validity.status === "active" && relation.to.nodeId === role)
    .map((relation) => ({ subject: bareId(relation.fromNodeId), relationId: relation.id }));
  const stored = await query({
    statement: `MATCH (f)-[x:${FIELDS_FOR}]->(r) RETURN GRAPH f, x, r ROOT r`,
    roots: [role],
    unbounded: true,
    purpose: "migration: a keyword role's values",
  });
  if (stored.outcome !== "success" && stored.outcome !== "noResult") return stored as GraphOutcome<never>;
  const nodes = stored.outcome === "success" ? stored.result.nodes : [];
  const forRelations = new Map(
    (stored.outcome === "success" ? stored.result.relations : [])
      .filter((relation) => relation.type === FIELDS_FOR && relation.validity.status === "active" && relation.to.nodeId === role)
      .map((relation) => [relation.fromNodeId, relation.id] as const),
  );
  const fieldNodes = nodes.filter((node) => node.revision.status === "established" && (node.revision.content ?? {})["_type"] === ROLE_FIELDS_TYPE && forRelations.has(node.id));
  if (fieldNodes.length === 0) return { outcome: "success", result: { assignments, values: [] } };
  const subjects = await query({
    statement: `MATCH (f)-[o:${FIELDS_OF}]->(s) RETURN GRAPH f, o, s ROOT f`,
    roots: fieldNodes.map((node) => node.id),
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: whose values",
  });
  if (subjects.outcome !== "success" && subjects.outcome !== "noResult") return subjects as GraphOutcome<never>;
  const subjectOf = new Map(
    (subjects.outcome === "success" ? subjects.result.relations : [])
      .filter((relation) => relation.type === FIELDS_OF && relation.validity.status === "active" && relation.to.nodeId !== undefined)
      .map((relation) => [relation.fromNodeId, bareId(relation.to.nodeId as string)] as const),
  );
  const values: StoredValues[] = [];
  for (const node of fieldNodes) {
    const subject = subjectOf.get(node.id);
    const held = (node.revision.content ?? {})["values"];
    if (subject === undefined) continue;
    values.push({
      nodeId: node.id,
      subject,
      values: typeof held === "object" && held !== null && !Array.isArray(held) ? (held as Record<string, unknown>) : {},
      forRelationId: forRelations.get(node.id) as string,
    });
  }
  return { outcome: "success", result: { assignments, values } };
}

/** The merge as this instance needs it: nothing when nothing was chosen, or
 * when what was chosen is a built-in already. */
export async function mergeKeywordRoles(settings: unknown): Promise<GraphOutcome<MigrationStatement>> {
  const chosen = chosenFrom(settings);
  const wanted: readonly (readonly [string | null, string])[] = [
    [chosen.keywordRole, KEYWORD_ROLE],
    [chosen.definitionRole, DEFINITION_ROLE],
    [chosen.aliasRole, ALIAS_ROLE],
  ];
  if (wanted.every(([from]) => from === null)) return { outcome: "success", result: { statement: "", parameters: {} } };
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const pairs: MergePair[] = [];
  for (const [from, builtin] of wanted) {
    if (from === null) continue;
    // A role kept as a document role before the one type is found by its
    // former id (BO_0309_020).
    const role = catalogue.result.byId.get(from);
    const into = catalogue.result.byId.get(builtin);
    if (role === undefined || into === undefined || role.id === into.id || role.builtin || role.retired) continue;
    const held = await readHolding(role.id);
    if (held.outcome !== "success") return held as GraphOutcome<never>;
    const intoHeld = await readHolding(into.id);
    if (intoHeld.outcome !== "success") return intoHeld as GraphOutcome<never>;
    pairs.push({ from: role, into, held: held.result, intoHeld: intoHeld.result });
  }
  return { outcome: "success", result: mergeStatement(pairs) };
}

/** The migrations this extension runs, by the route segment its member names. */
export const MIGRATIONS: Readonly<Record<string, (settings: unknown) => Promise<GraphOutcome<MigrationStatement>>>> = {
  /** The chosen keyword roles become the built-ins. BO_0310_021 */
  "merge-keyword-roles": mergeKeywordRoles,
};
