
import { port } from "~/server/port";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import {
  BLOCK_STRUCTURE_TYPE,
  DOCUMENT_STRUCTURE_TYPE,
  FORMAT_STRUCTURE,
  HAS_BLOCK_STRUCTURE,
  HAS_DOCUMENT_STRUCTURE,
  OFFERS,
  BUILTIN_STRUCTURES,
  INSTRUCTION_STRUCTURE,
  releaseFieldsOf,
  SOURCE_STRUCTURE,
  VARIATION_STRUCTURE,
  type FieldDeclaration,
} from "../lib/structures";
import { builtinsStatement, keywordBuiltinsStatement, readCatalogue } from "./structures";

/**
 * `structures`' executable migrations (`calliopa-bootstrap`'s
 * `BO_0312_001`): the kernel posts `{pin, migration}` to a route here when it
 * serves a pin that carries the `ext.migration` member naming it, and writes
 * the statement answered as one truth change set under the instance's owner.
 * Each runs once per instance, on the dogfood instance and on every install
 * that takes the release (`BO_0312_Q7`).
 */

/** What a migration route answers: one script and its parameters, or an
 * empty statement when this instance has nothing to change. */
export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** A document structure as the migration finds it, with what hangs on it. */
export interface FormerStructure {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly retired: boolean;
  /** The active `offers` relations from it, with the block structure each reaches. */
  readonly offers: readonly { readonly relationId: string; readonly to: string }[];
  /** The active `hasDocumentRole` relations to it, with the document each
   * comes from. */
  readonly documents: readonly { readonly relationId: string; readonly from: string }[];
}

/**
 * The script that makes every document structure a structure of the one type
 * (`BO_0309_011`). A node's type never changes (`node_type_change`), so each
 * becomes a new `blockRole` carrying its name, description and retired flag,
 * placed after the structures already there, and `formerId`, the id it had, by
 * which a reader still holding the old id finds it. Each `offers` from it is
 * closed and related again from the new structure, each `hasDocumentRole` to it
 * closed and related again as the document's `hasBlockRole`, and the old node
 * retired. `mint` names the new ids, so the statement is pure.
 */
export function oneStructureTypeStatement(
  structures: readonly FormerStructure[],
  firstOrder: number,
  mint: () => string = () => port.uuid(),
): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  structures.forEach((structure, index) => {
    const alias = `n${index}`;
    const id = mint();
    parameters[`${alias}_id`] = id;
    parameters[`${alias}_name`] = structure.name;
    parameters[`${alias}_order`] = firstOrder + index;
    parameters[`${alias}_former`] = structure.id;
    parameters[`${alias}ref`] = nodeRef(id);
    const pairs = [
      `id: $${alias}_id`,
      `name: $${alias}_name`,
      `order: $${alias}_order`,
      `formerId: $${alias}_former`,
    ];
    if (structure.description !== "") {
      parameters[`${alias}_description`] = structure.description;
      pairs.push(`description: $${alias}_description`);
    }
    if (structure.retired) pairs.push("retired: true");
    statements.push(`CREATE (${alias}:${BLOCK_STRUCTURE_TYPE} {${pairs.join(", ")}, status: "established"})`);
    structure.offers.forEach((offer, offerIndex) => {
      const close = `o${index}_${offerIndex}`;
      parameters[`${close}RelationId`] = offer.relationId;
      parameters[`${close}From`] = nodeRef(structure.id);
      parameters[`${close}to`] = nodeRef(offer.to);
      statements.push(`CLOSE ${close}`, `RELATE ${alias}ref -[${close}n:${OFFERS}]-> ${close}to`);
    });
    structure.documents.forEach((held, heldIndex) => {
      const close = `h${index}_${heldIndex}`;
      parameters[`${close}RelationId`] = held.relationId;
      parameters[`${close}From`] = nodeRef(held.from);
      parameters[`${close}doc`] = nodeRef(held.from);
      statements.push(`CLOSE ${close}`, `RELATE ${close}doc -[${close}n:${HAS_BLOCK_STRUCTURE}]-> ${alias}ref`);
    });
    parameters[`d${index}NodeId`] = nodeRef(structure.id);
    statements.push(`RETIRE d${index}`);
  });
  return { statement: statements.join("; "), parameters };
}

const isEstablished = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" &&
  (node.revision.content ?? {})["_type"] === type;

/** Every document structure still standing, with its offers and its documents,
 * and the highest order a structure of the one type holds. */
export async function readFormerStructures(): Promise<
  GraphOutcome<{ readonly structures: readonly FormerStructure[]; readonly highestOrder: number }>
> {
  const found = await query({
    statement: `MATCH (r:${DOCUMENT_STRUCTURE_TYPE}) RETURN GRAPH r`,
    unbounded: true,
    purpose: "migration: document structures",
  });
  if (found.outcome !== "success" && found.outcome !== "noResult") return found as GraphOutcome<never>;
  const nodes = found.outcome === "success" ? found.result.nodes.filter((node) => isEstablished(node, DOCUMENT_STRUCTURE_TYPE)) : [];
  const existing = await query({
    statement: `MATCH (r:${BLOCK_STRUCTURE_TYPE}) RETURN GRAPH r`,
    unbounded: true,
    purpose: "migration: structures of the one type",
  });
  if (existing.outcome !== "success" && existing.outcome !== "noResult") return existing as GraphOutcome<never>;
  const highestOrder = (existing.outcome === "success" ? existing.result.nodes : []).reduce((highest, node) => {
    const order = (node.revision.content ?? {})["order"];
    return typeof order === "number" && Number.isFinite(order) ? Math.max(highest, order) : highest;
  }, 0);
  if (nodes.length === 0) return { outcome: "success", result: { structures: [], highestOrder } };
  const roots = nodes.map((node) => node.id);
  const offered = await query({
    statement: `MATCH (r)-[o:${OFFERS}]->(b) RETURN GRAPH r, o, b ROOT r`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: what document structures offer",
  });
  if (offered.outcome !== "success" && offered.outcome !== "noResult") return offered as GraphOutcome<never>;
  const held = await query({
    statement: `MATCH (d)-[h:${HAS_DOCUMENT_STRUCTURE}]->(r) RETURN GRAPH d, h, r ROOT r`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: documents carrying a document structure",
  });
  if (held.outcome !== "success" && held.outcome !== "noResult") return held as GraphOutcome<never>;
  const offersOf = new Map<string, { relationId: string; to: string }[]>();
  for (const relation of offered.outcome === "success" ? offered.result.relations : []) {
    if (relation.type !== OFFERS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    offersOf.set(relation.fromNodeId, [...(offersOf.get(relation.fromNodeId) ?? []), { relationId: relation.id, to: bareId(relation.to.nodeId) }]);
  }
  const documentsOf = new Map<string, { relationId: string; from: string }[]>();
  for (const relation of held.outcome === "success" ? held.result.relations : []) {
    if (relation.type !== HAS_DOCUMENT_STRUCTURE || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    documentsOf.set(relation.to.nodeId, [...(documentsOf.get(relation.to.nodeId) ?? []), { relationId: relation.id, from: bareId(relation.fromNodeId) }]);
  }
  const text = (value: unknown): string => (typeof value === "string" ? value : "");
  const structures = [...nodes]
    .sort((left, right) => text((left.revision.content ?? {})["name"]).localeCompare(text((right.revision.content ?? {})["name"])) || (left.id < right.id ? -1 : 1))
    .map((node): FormerStructure => {
      const content = node.revision.content ?? {};
      return {
        id: bareId(node.id),
        name: text(content["name"]),
        description: text(content["description"]),
        retired: content["retired"] === true,
        offers: offersOf.get(node.id) ?? [],
        documents: documentsOf.get(node.id) ?? [],
      };
    });
  return { outcome: "success", result: { structures, highestOrder } };
}

/**
 * The statement that puts a built-in's release fields on it, each by its key
 * in place of what stands under that key or after the fields there, and
 * leaves every field a person added as it is. Empty when they stand already.
 */
export async function releaseFieldsStatement(structureId: string): Promise<GraphOutcome<MigrationStatement>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const structure = catalogue.result.byId.get(structureId);
  if (structure === undefined) return { outcome: "success", result: { statement: "", parameters: {} } };
  const fields: FieldDeclaration[] = [...structure.fields];
  for (const field of releaseFieldsOf(structureId)) {
    const at = fields.findIndex((one) => one.key === field.key);
    if (at < 0) fields.push(field);
    else fields[at] = field;
  }
  if (JSON.stringify(fields) === JSON.stringify(structure.fields))
    return { outcome: "success", result: { statement: "", parameters: {} } };
  return {
    outcome: "success",
    result: { statement: "SET r.fields = $fields", parameters: { rNodeId: nodeRef(structure.id), fields } },
  };
}

/** The migrations this extension runs, by the route segment its member names. */
export const MIGRATIONS: Readonly<Record<string, () => Promise<GraphOutcome<MigrationStatement>>>> = {
  /** Document structures become structures of the one type. BO_0309_011 */
  "one-role-type": async () => {
    const former = await readFormerStructures();
    if (former.outcome !== "success") return former as GraphOutcome<never>;
    return { outcome: "success", result: oneStructureTypeStatement(former.result.structures, former.result.highestOrder + 1) };
  },
  /** The built-in structures stand on this instance. BO_0309_014 */
  "builtin-roles": async () => {
    const staged = await builtinsStatement();
    if (staged.outcome !== "success") return staged as GraphOutcome<never>;
    return { outcome: "success", result: { statement: staged.result.statement, parameters: staged.result.parameters } };
  },
  /** Keyword offers Definition and Alias, and sends the definition with a
   * prompt, on every instance. BO_0310_030 BO_0310_031 */
  "keyword-builtins": async () => {
    const staged = await keywordBuiltinsStatement();
    if (staged.outcome !== "success") return staged as GraphOutcome<never>;
    return { outcome: "success", result: { statement: staged.result.statement, parameters: staged.result.parameters } };
  },
  /** Format's release fields, preserving fields a person added beside them. BO_0312_010 */
  "format-fields": () => releaseFieldsStatement("builtin:format"),
  /** Source's release fields, the CSL record of a source document, preserving
   * fields a person added beside them. BO_0313_010 */
  "source-fields": () => releaseFieldsStatement(SOURCE_STRUCTURE),
  /** What a format makes a picture or a video with, the profile's format and
   * *Variation* offered by *Format* (`calliopa-bootstrap`'s `BO_0336_013`,
   * `BO_0336_014`), after `builtin-structures` has created *Variation*. */
  "generation-fields": generationFieldsStatement,
  /** Each built-in's name and description as the release says them, where the
   * graph keeps an older wording: *Profile* becomes *Instruction*
   * (`calliopa-bootstrap`'s `BO_0338_022`). A person cannot rename a built-in,
   * so the release's words are the only ones it has. */
  "builtin-names": builtinNamesStatement,
};

/**
 * One script setting every built-in's name and description to the release's
 * where the stored ones differ, the node, its id and everything that uses it
 * kept. Empty when all match. BO_0338_022
 */
export async function builtinNamesStatement(): Promise<GraphOutcome<MigrationStatement>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  return { outcome: "success", result: builtinNamesFor(catalogue.result.byId) };
}

/** The script `builtinNamesStatement` answers, from the structures read by id. */
export function builtinNamesFor(byId: ReadonlyMap<string, { readonly id: string; readonly name: string; readonly description: string }>): MigrationStatement {
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  BUILTIN_STRUCTURES.forEach((release, index) => {
    const stored = byId.get(release.id);
    if (stored === undefined || stored.id !== release.id) return;
    if (stored.name === release.name && stored.description === release.description) return;
    parameters[`n${index}NodeId`] = nodeRef(release.id);
    parameters[`n${index}Name`] = release.name;
    parameters[`n${index}Description`] = release.description;
    statements.push(`SET n${index}.name = $n${index}Name, n${index}.description = $n${index}Description`);
  });
  return { statement: statements.join("; "), parameters };
}

/**
 * One script for `BO_0336`: *Format* offering *Variation* where it does not,
 * and the release fields of *Format*, *Profile* and *Variation* installed or
 * repaired by key, every field a person added kept. Empty when all stand.
 */
export async function generationFieldsStatement(): Promise<GraphOutcome<MigrationStatement>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  const format = catalogue.result.byId.get(FORMAT_STRUCTURE);
  if (format !== undefined && catalogue.result.byId.has(VARIATION_STRUCTURE) && !format.offers.includes(VARIATION_STRUCTURE)) {
    parameters["vFrom"] = nodeRef(FORMAT_STRUCTURE);
    parameters["vTo"] = nodeRef(VARIATION_STRUCTURE);
    statements.push(`RELATE vFrom -[vo:${OFFERS}]-> vTo`);
  }
  for (const [alias, structureId] of [["gf", FORMAT_STRUCTURE], ["gp", INSTRUCTION_STRUCTURE], ["gv", VARIATION_STRUCTURE]] as const) {
    const one = await releaseFieldsStatement(structureId);
    if (one.outcome !== "success") return one;
    if (one.result.statement === "") continue;
    parameters[`${alias}NodeId`] = one.result.parameters["rNodeId"];
    parameters[`${alias}Fields`] = one.result.parameters["fields"];
    statements.push(`SET ${alias}.fields = $${alias}Fields`);
  }
  return { outcome: "success", result: { statement: statements.join("; "), parameters } };
}
