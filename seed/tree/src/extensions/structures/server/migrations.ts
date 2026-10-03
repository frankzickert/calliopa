
import { port } from "~/server/port";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { CONTAINS } from "~/extensions/documents/server/assemble";
import { orderBetween } from "~/lib/order";

import {
  BLOCK_STRUCTURE_TYPE,
  BUILTIN_OFFERS,
  BUILTIN_STRUCTURES,
  DEFAULT_SEND_WITH_PROMPT,
  DOCUMENT_STRUCTURE_TYPE,
  FIELDS_FOR,
  FIELDS_OF,
  FIELD_STRUCTURE,
  FIELD_TYPE_LABELS,
  HAS_BLOCK_STRUCTURE,
  HAS_DOCUMENT_STRUCTURE,
  KEYWORD_STRUCTURE,
  OFFERS,
  STRUCTURE_FIELDS_TYPE,
  STRUCTURE_STRUCTURE,
  fieldOf,
  releaseFieldsOf,
  type FieldDeclaration,
  type FieldValue,
} from "../lib/structures";
import { readCatalogue } from "./structures";

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

/** What answers nothing: the instance has nothing to change. */
const NOTHING: MigrationStatement = { statement: "", parameters: {} };

/**
 * A structure as it stood as a `blockRole` node, before it was a document
 * (`RO_0005_002`), with what hangs on it.
 */
export interface StructureNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly retired: boolean;
  readonly order: number;
  /** `false` when blocks may not use it; absent or true when they may. */
  readonly blocks: boolean;
  readonly fields: readonly FieldDeclaration[];
  /** The structures it allowed, by their node ids. */
  readonly offers: readonly string[];
  /** The id it had as a document structure before `BO_0309`. */
  readonly formerId?: string;
  readonly sendWithPrompt?: readonly string[];
  /** Every active `hasBlockRole` to it: the relation and the subject. */
  readonly uses: readonly { readonly relationId: string; readonly subject: string }[];
  /** Every `roleFields` node holding values for it, with its active
   * `fieldsFor` relation to it. */
  readonly values: readonly { readonly nodeId: string; readonly fieldsFor: string | null }[];
}

/** What stands as documents already: the structures' ids, and every id a
 * moved structure had before. */
export interface StandingDocuments {
  readonly ids: ReadonlySet<string>;
  readonly formerIds: ReadonlySet<string>;
}

/** A field as *Field*'s values hold it (`RO_0005`). */
export function fieldValues(field: FieldDeclaration, carrying: (id: string) => string): Record<string, FieldValue> {
  return {
    key: field.key,
    type: FIELD_TYPE_LABELS[field.type],
    ...(field.required ? { required: true } : {}),
    ...(field.many === true ? { many: true } : {}),
    ...(field.options !== undefined && field.options.length > 0 ? { options: field.options.join("\n") } : {}),
    ...(field.default !== undefined && field.default !== null && typeof field.default !== "object" ? { default: String(field.default) } : {}),
    ...(field.suggest !== undefined ? { suggest: field.suggest } : {}),
    ...(field.suggestions !== undefined && field.suggestions.length > 0 ? { suggestions: field.suggestions.join("\n") } : {}),
    ...(field.carrying !== undefined ? { carrying: carrying(field.carrying) } : {}),
  };
}

/**
 * The script that makes every structure a document (`RO_0005_002`). A node's
 * type never changes, so each `blockRole` becomes a new `document` using
 * *Structure*: its name the title — a built-in's the release's, under its
 * fixed id — its description the first block, each field a block using
 * *Field* whose values declare it under the key it had, so every stored value
 * and every reader by key finds it, and *Blocks may use*, *Allows* and what
 * this extension keeps — the order, whether it is retired, *Keyword*'s *Send
 * with prompt*, the ids it had — in its *Structure* values. A built-in's
 * release fields stand in the release's order before a person's. Every
 * `hasBlockRole` to an old node is closed and related again to its document,
 * every `roleFields` for it names the document. The built-ins the instance
 * does not hold are made from the release. The old nodes stay, read by
 * nothing. `mint` names the new ids, so the statement is pure; a structure
 * already moved is left, so a second run answers nothing.
 */
export function structuresAsDocumentsStatement(
  nodes: readonly StructureNode[],
  standing: StandingDocuments,
  mint: () => string = () => port.uuid(),
): MigrationStatement {
  // Every document first, so whatever relates to one finds it standing.
  const heads: string[] = [];
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  let alias = 0;
  const next = (prefix: string): string => `${prefix}${(alias += 1)}`;

  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const newId = new Map<string, string>();
  for (const release of BUILTIN_STRUCTURES) if ("formerId" in release) newId.set(release.formerId, release.id);
  const persons = nodes.filter((node) => !BUILTIN_STRUCTURES.some((release) => "formerId" in release && release.formerId === node.id));
  for (const node of persons) if (!standing.formerIds.has(node.id)) newId.set(node.id, mint());
  const mapped = (id: string): string => newId.get(id) ?? id;

  /** A text block in the document, related; its alias. */
  const block = (document: string, order: string, words: string): string => {
    const id = mint();
    const a = next("b");
    parameters[`${a}_id`] = id;
    parameters[`${a}_order`] = order;
    parameters[`${a}_runs`] = words === "" ? [] : [{ text: words }];
    parameters[`${a}ref`] = nodeRef(id);
    statements.push(
      `CREATE (${a}:text {id: $${a}_id, order: $${a}_order, runs: $${a}_runs, status: "established"})`,
      `RELATE ${document}ref -[${a}c:${CONTAINS}]-> ${a}ref`,
    );
    return a;
  };
  /** The subject uses the structure, with these values. */
  const uses = (subject: string, structure: string, values: Record<string, unknown>): void => {
    const f = next("f");
    const id = mint();
    parameters[`${f}_id`] = id;
    parameters[`${f}_structure`] = structure;
    parameters[`${f}_values`] = values;
    parameters[`${f}ref`] = nodeRef(id);
    parameters[`${f}s`] = nodeRef(structure);
    statements.push(
      `RELATE ${subject}ref -[${f}h:${HAS_BLOCK_STRUCTURE}]-> ${f}s`,
      `CREATE (${f}:${STRUCTURE_FIELDS_TYPE} {id: $${f}_id, role: $${f}_structure, values: $${f}_values, status: "established"})`,
      `RELATE ${f}ref -[${f}o:${FIELDS_OF}]-> ${subject}ref`,
      `RELATE ${f}ref -[${f}r:${FIELDS_FOR}]-> ${f}s`,
    );
  };
  /** A structure's document with its description and its fields. */
  const document = (
    id: string,
    title: string,
    description: string,
    fields: readonly FieldDeclaration[],
    values: Record<string, unknown>,
  ): void => {
    const d = next("d");
    parameters[`${d}_id`] = id;
    parameters[`${d}_title`] = title;
    parameters[`${d}ref`] = nodeRef(id);
    heads.push(`CREATE (${d}:document {id: $${d}_id, title: $${d}_title, status: "established"})`);
    let order = orderBetween("", "");
    block(d, order, description);
    for (const field of fields) {
      order = orderBetween(order, "");
      const b = block(d, order, field.name);
      uses(b, FIELD_STRUCTURE, fieldValues(field, mapped));
    }
    uses(d, STRUCTURE_STRUCTURE, values);
  };

  BUILTIN_STRUCTURES.forEach((release, index) => {
    if (standing.ids.has(release.id)) return;
    const old = "formerId" in release ? byId.get(release.formerId) : undefined;
    const ownFields = releaseFieldsOf(release.id).map((field) => {
      const kept = old?.fields.find((one) => one.key === field.key);
      return kept === undefined
        ? field
        : { ...field, name: kept.name, required: field.required || kept.required, ...(kept.default === undefined ? {} : { default: kept.default }) };
    });
    const added = (old?.fields ?? []).filter((field) => !releaseFieldsOf(release.id).some((one) => one.key === field.key));
    const allows = [
      ...new Set([...BUILTIN_OFFERS.filter(([from]) => from === release.id).map(([, to]) => to), ...(old?.offers ?? []).map(mapped)]),
    ];
    document(release.id, release.name, old !== undefined && old.description !== "" ? old.description : release.description, [...ownFields, ...added], {
      order: index,
      ...(allows.length === 0 ? {} : { allows }),
      ...(release.id === KEYWORD_STRUCTURE ? { sendWithPrompt: (old?.sendWithPrompt ?? DEFAULT_SEND_WITH_PROMPT).map(mapped) } : {}),
    });
  });

  for (const node of persons) {
    if (standing.formerIds.has(node.id)) continue;
    const allows = [...new Set(node.offers.map(mapped))];
    document(mapped(node.id), node.name, node.description, node.fields, {
      order: node.order,
      blocks: node.blocks,
      ...(allows.length === 0 ? {} : { allows }),
      ...(node.retired ? { retired: true } : {}),
      formerIds: [node.id, ...(node.formerId === undefined ? [] : [node.formerId])],
    });
  }

  // What uses an old node uses its document; values for it are its document's.
  for (const node of nodes) {
    const to = mapped(node.id);
    if (to === node.id) continue;
    for (const use of node.uses) {
      const u = next("u");
      parameters[`${u}cRelationId`] = use.relationId;
      parameters[`${u}cFrom`] = nodeRef(use.subject);
      parameters[`${u}s`] = nodeRef(use.subject);
      parameters[`${u}t`] = nodeRef(to);
      statements.push(`CLOSE ${u}c`, `RELATE ${u}s -[${u}n:${HAS_BLOCK_STRUCTURE}]-> ${u}t`);
    }
    for (const held of node.values) {
      const v = next("v");
      parameters[`${v}NodeId`] = nodeRef(held.nodeId);
      parameters[`${v}_role`] = to;
      parameters[`${v}t`] = nodeRef(to);
      parameters[`${v}f`] = nodeRef(held.nodeId);
      statements.push(`SET ${v}.role = $${v}_role`);
      if (held.fieldsFor !== null) {
        parameters[`${v}cRelationId`] = held.fieldsFor;
        parameters[`${v}cFrom`] = nodeRef(held.nodeId);
        statements.push(`CLOSE ${v}c`);
      }
      statements.push(`RELATE ${v}f -[${v}n:${FIELDS_FOR}]-> ${v}t`);
    }
  }
  const all = [...heads, ...statements];
  return all.length === 0 ? NOTHING : { statement: all.join("; "), parameters };
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Every `blockRole` with what hangs on it, as the migration reads them. */
export async function readStructureNodes(): Promise<GraphOutcome<readonly StructureNode[]>> {
  const found = await query({
    statement: `MATCH (r:${BLOCK_STRUCTURE_TYPE}) RETURN GRAPH r`,
    unbounded: true,
    purpose: "migration: structures as nodes",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const nodes = found.result.nodes.filter((node) => isEstablished(node, BLOCK_STRUCTURE_TYPE));
  if (nodes.length === 0) return { outcome: "success", result: [] };
  const roots = nodes.map((node) => node.id);
  const offered = await query({
    statement: `MATCH (r)-[o:${OFFERS}]->(b) RETURN GRAPH r, o, b ROOT r`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: what structures allowed",
  });
  if (offered.outcome !== "success" && offered.outcome !== "noResult") return offered as GraphOutcome<never>;
  const used = await query({
    statement: `MATCH (s)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH s, h, r ROOT r`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: what uses each structure",
  });
  if (used.outcome !== "success" && used.outcome !== "noResult") return used as GraphOutcome<never>;
  const valued = await query({
    statement: `MATCH (f)-[r:${FIELDS_FOR}]->(s) RETURN GRAPH f, r, s ROOT s`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "migration: values held for each structure",
  });
  if (valued.outcome !== "success" && valued.outcome !== "noResult") return valued as GraphOutcome<never>;
  const known = new Set(roots);
  const offers = new Map<string, string[]>();
  for (const relation of offered.outcome === "success" ? offered.result.relations : []) {
    if (relation.type !== OFFERS || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    if (!known.has(relation.fromNodeId) || !known.has(relation.to.nodeId)) continue;
    offers.set(relation.fromNodeId, [...(offers.get(relation.fromNodeId) ?? []), bareId(relation.to.nodeId)]);
  }
  const usesOf = new Map<string, { relationId: string; subject: string }[]>();
  for (const relation of used.outcome === "success" ? used.result.relations : []) {
    if (relation.type !== HAS_BLOCK_STRUCTURE || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    usesOf.set(relation.to.nodeId, [...(usesOf.get(relation.to.nodeId) ?? []), { relationId: relation.id, subject: bareId(relation.fromNodeId) }]);
  }
  const valuesOf = new Map<string, { nodeId: string; fieldsFor: string | null }[]>();
  for (const relation of valued.outcome === "success" ? valued.result.relations : []) {
    if (relation.type !== FIELDS_FOR || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    valuesOf.set(relation.to.nodeId, [...(valuesOf.get(relation.to.nodeId) ?? []), { nodeId: bareId(relation.fromNodeId), fieldsFor: relation.id }]);
  }
  return {
    outcome: "success",
    result: nodes.map((node): StructureNode => {
      const content = node.revision.content ?? {};
      const order = content["order"];
      const send = content["sendWithPrompt"];
      const former = text(content["formerId"]);
      return {
        id: bareId(node.id),
        name: text(content["name"]),
        description: text(content["description"]),
        retired: content["retired"] === true,
        order: typeof order === "number" && Number.isFinite(order) ? order : 0,
        blocks: content["blocks"] !== false,
        fields: Array.isArray(content["fields"])
          ? content["fields"].map(fieldOf).filter((field): field is FieldDeclaration => field !== null)
          : [],
        offers: offers.get(node.id) ?? [],
        ...(former === "" ? {} : { formerId: former }),
        ...(Array.isArray(send) ? { sendWithPrompt: send.filter((entry): entry is string => typeof entry === "string") } : {}),
        uses: usesOf.get(node.id) ?? [],
        values: valuesOf.get(node.id) ?? [],
      };
    }),
  };
}

/** The structures standing as documents already, and the ids they had. */
async function readStandingDocuments(): Promise<GraphOutcome<StandingDocuments>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  return {
    outcome: "success",
    result: {
      ids: new Set(catalogue.result.structures.map((structure) => structure.id)),
      formerIds: new Set(catalogue.result.structures.flatMap((structure) => structure.formerIds ?? [])),
    },
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
  /** Every structure becomes a document, the built-ins made from the release
   * where the instance holds none. RO_0005_002 */
  "structures-as-documents": async () => {
    const nodes = await readStructureNodes();
    if (nodes.outcome !== "success") return nodes as GraphOutcome<never>;
    const standing = await readStandingDocuments();
    if (standing.outcome !== "success") return standing as GraphOutcome<never>;
    return { outcome: "success", result: structuresAsDocumentsStatement(nodes.result, standing.result) };
  },
  // What these made on a `blockRole` — the built-ins, Keyword's offers and
  // Send with prompt, the release fields, Profile's new name — is made on
  // the structures' documents by `structures-as-documents`, from the release.
  // An instance serving a pin that carries them for the first time runs them
  // before it, so they answer nothing (RO_0005_002).
  "builtin-roles": async () => ({ outcome: "success", result: NOTHING }),
  "keyword-builtins": async () => ({ outcome: "success", result: NOTHING }),
  "format-fields": async () => ({ outcome: "success", result: NOTHING }),
  "source-fields": async () => ({ outcome: "success", result: NOTHING }),
  "generation-fields": async () => ({ outcome: "success", result: NOTHING }),
  "builtin-names": async () => ({ outcome: "success", result: NOTHING }),
  /** A built-in added after the structures became documents reaches an
   * instance holding the others: made from the release where it stands
   * nowhere, as `structures-as-documents` makes every built-in. *Format*
   * allows it by the release, which the catalogue reads. ME_0002_002 */
  "input-structure": async () => {
    const standing = await readStandingDocuments();
    if (standing.outcome !== "success") return standing as GraphOutcome<never>;
    return { outcome: "success", result: structuresAsDocumentsStatement([], standing.result) };
  },
};
