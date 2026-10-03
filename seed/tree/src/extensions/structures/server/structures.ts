
import { port } from "~/server/port";
import { orderBetween } from "~/lib/order";
import { runsText, type Run } from "~/lib/runs";

import { CONTAINS, type BlockView } from "~/extensions/documents/server/assemble";
import { readDocument } from "~/extensions/documents/server/documents";
import { INSTRUCTION_RECORD } from "~/extensions/documents/lib/instruction";
import {
  atDataRevision,
  currentRun,
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
import type { Fixed } from "~/extensions/documents/lib/fixed";

import {
  BUILTIN_OFFERS,
  BUILTIN_STRUCTURES,
  FIELDS_FOR,
  FIELD_STRUCTURE,
  KEYWORD_STRUCTURE,
  INSTRUCTION_STRUCTURE,
  STRUCTURE_STRUCTURE,
  isBuiltinField,
  mintFieldKey,
  FIELDS_OF,
  HAS_BLOCK_STRUCTURE,
  STRUCTURE_FIELDS_TYPE,
  UNNAMED_STRUCTURE,
  declaredFor,
  defaultsOf,
  fieldFromBlock,
  inOrder,
  isHeld,
  missingOf,
  releaseFieldsOf,
  takeableFrom,
  blocksAllowed,
  valueFor,
  type DocumentStructuresView,
  type FieldDeclaration,
  type FieldValue,
  type FileValue,
  type InheritedStructure,
  type StructuredBlock,
  type StructureView,
  type TakenStructure,
} from "../lib/structures";

/**
 * The structures as the graph holds them (`BO_0299`, made one structure type by
 * `BO_0309`, documents by `RO_0005`): the catalogue — every structure's
 * document read as the structure, with what it allows and its fields — read as
 * one list; a structure created as a document using *Structure*, retired and
 * restored, each one truth write as the signed-in person; a structure taken and cleared on a block or a document, many
 * per subject, written outside any branch because taking a structure is the
 * person's direct act, established at once (`BO_0308_Q4`); a field's value
 * written the same way; and `structuresOf`, the one read everything else answers
 * from — the route, the tool and a dependent extension alike.
 *
 * A structure is retired, never deleted (`BO_0299_Q4`): `documents` asks this
 * extension's guard before a deletion (`guardOf`). A structure taken while its
 * allowing structure stood above stays when that structure goes, and says it
 * is not allowed (`BO_0299_Q3`). A built-in is never renamed, retired or
 * restored (`BO_0308_Q5`).
 */

export const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const isType = (node: ReadNode, type: string): boolean =>
  node.revision.status === "established" &&
  (node.revision.content ?? {})["_type"] === type;

const active = (relation: ReadRelation, type: string): boolean =>
  relation.type === type && relation.validity.status === "active";

/** The catalogue as one structure. */
export interface Catalogue {
  readonly structures: readonly StructureView[];
  readonly byId: ReadonlyMap<string, StructureView>;
}

/** A block of a structure's document, in reading order. */
interface StructureBlock {
  readonly node: string;
  readonly blockId: string;
  readonly order: string;
  readonly words: string;
}

/** Ids a value lists, a list reference's (`RO_0005_Q3`). */
const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === "string" && one !== "") : [];

/**
 * Every structure (`RO_0005`): the documents using *Structure*, each read as
 * a structure — its title the name (a built-in's the release's), its blocks
 * not using *Field* the description, its blocks using *Field* the fields in
 * reading order, its *Structure* values whether blocks may use it, what it
 * allows and what this extension keeps beside them. Four reads, rooted where
 * a read answers relations: the documents using *Structure*, their blocks,
 * the blocks using *Field*, and the values of both.
 */
export async function readCatalogue(): Promise<GraphOutcome<Catalogue>> {
  const using = await query({
    statement: `MATCH (d)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH d, h, r ROOT r`,
    roots: [nodeRef(STRUCTURE_STRUCTURE)],
    unbounded: true,
    purpose: "structures",
  });
  if (using.outcome === "noResult") return { outcome: "success", result: { structures: [], byId: new Map() } };
  if (using.outcome !== "success") return using as GraphOutcome<never>;
  const documents = new Map<string, ReadNode>();
  const byNode = new Map(using.result.nodes.map((node) => [node.id, node] as const));
  for (const relation of using.result.relations) {
    if (!active(relation, HAS_BLOCK_STRUCTURE) || relation.to.nodeId !== nodeRef(STRUCTURE_STRUCTURE)) continue;
    const node = byNode.get(relation.fromNodeId);
    if (node !== undefined && isType(node, "document")) documents.set(node.id, node);
  }
  if (documents.size === 0) return { outcome: "success", result: { structures: [], byId: new Map() } };

  const contained = await query({
    statement: `MATCH (d)-[c:${CONTAINS}]->(b) RETURN GRAPH d, c, b ROOT d`,
    roots: [...documents.keys()],
    unbounded: true,
    purpose: "structures' blocks",
  });
  if (contained.outcome !== "success" && contained.outcome !== "noResult") return contained as GraphOutcome<never>;
  const blocksOf = new Map<string, StructureBlock[]>();
  if (contained.outcome === "success") {
    const nodes = new Map(contained.result.nodes.map((node) => [node.id, node] as const));
    for (const relation of contained.result.relations) {
      if (!active(relation, CONTAINS) || relation.to.nodeId === undefined || !documents.has(relation.fromNodeId)) continue;
      const block = nodes.get(relation.to.nodeId);
      if (block === undefined || block.revision.status !== "established") continue;
      const content = block.revision.content ?? {};
      blocksOf.set(relation.fromNodeId, [
        ...(blocksOf.get(relation.fromNodeId) ?? []),
        {
          node: block.id,
          blockId: bareId(block.id),
          order: text(content["order"]),
          words: Array.isArray(content["runs"]) ? runsText(content["runs"] as readonly Run[]) : "",
        },
      ]);
    }
  }
  for (const [document, blocks] of blocksOf)
    blocksOf.set(document, [...blocks].sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0)));

  const fielded = await query({
    statement: `MATCH (b)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH b, h, r ROOT r`,
    roots: [nodeRef(FIELD_STRUCTURE)],
    unbounded: true,
    metadataOnly: true,
    purpose: "the blocks that are fields",
  });
  if (fielded.outcome !== "success" && fielded.outcome !== "noResult") return fielded as GraphOutcome<never>;
  const inDocuments = new Set([...blocksOf.values()].flatMap((blocks) => blocks.map((block) => block.node)));
  const fieldBlocks = new Set(
    (fielded.outcome === "success" ? fielded.result.relations : [])
      .filter((relation) => active(relation, HAS_BLOCK_STRUCTURE) && inDocuments.has(relation.fromNodeId))
      .map((relation) => relation.fromNodeId),
  );

  const standing = await readStanding([...[...documents.keys()].map(bareId), ...[...fieldBlocks].map(bareId)]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const valuesOf = (node: string, structure: string): Readonly<Record<string, FieldValue>> =>
    standing.result.fields.get(node)?.get(structure)?.values ?? {};

  const unordered: StructureView[] = [...documents.values()].map((node) => {
    const id = bareId(node.id);
    const release = BUILTIN_STRUCTURES.find((candidate) => candidate.id === id);
    const values = valuesOf(node.id, STRUCTURE_STRUCTURE);
    const blocks = blocksOf.get(node.id) ?? [];
    const words = blocks
      .filter((block) => !fieldBlocks.has(block.node))
      .map((block) => block.words.trim())
      .filter((one) => one !== "");
    const declared = blocks
      .filter((block) => fieldBlocks.has(block.node))
      .map((block) => fieldFromBlock(block.blockId, block.words, valuesOf(block.node, FIELD_STRUCTURE)));
    const fields = release === undefined ? declared : withReleaseFields(id, declared);
    const title = text((node.revision.content ?? {})["title"]).trim();
    const send = values["sendWithPrompt"];
    const formerIds = release !== undefined && "formerId" in release ? [release.formerId] : idsOf(values["formerIds"]);
    return {
      id,
      name: release?.name ?? (title === "" ? UNNAMED_STRUCTURE : title),
      description: words[0] ?? release?.description ?? "",
      text: words.length > 0 ? words.join("\n\n") : (release?.description ?? ""),
      retired: release === undefined && values["retired"] === true,
      builtin: release !== undefined,
      order: release === undefined ? number(values["order"]) : BUILTIN_STRUCTURES.indexOf(release),
      fields,
      offers: [...new Set([...BUILTIN_OFFERS.filter(([from]) => from === id).map(([, to]) => to), ...idsOf(values["allows"])])],
      offeredBy: [],
      blocks: release === undefined ? values["blocks"] !== false : blocksAllowed(id, undefined),
      ...(formerIds.length === 0 ? {} : { formerIds }),
      // Read on Keyword alone: what it means is keywords' (BO_0310_031).
      ...(id === KEYWORD_STRUCTURE && Array.isArray(send)
        ? { sendWithPrompt: send.filter((entry): entry is string => typeof entry === "string") }
        : {}),
    };
  });
  const byFormer = new Map<string, string>();
  for (const structure of unordered) for (const former of structure.formerIds ?? []) byFormer.set(former, structure.id);
  const known = new Set(unordered.map((structure) => structure.id));
  const resolve = (id: string): string | undefined => (known.has(id) ? id : byFormer.get(id));
  const offeredBy = new Map<string, string[]>();
  const resolved = unordered.map((structure) => {
    const offers = [...new Set(structure.offers.map(resolve).filter((to): to is string => to !== undefined && to !== structure.id))];
    for (const to of offers) offeredBy.set(to, [...(offeredBy.get(to) ?? []), structure.id]);
    return { ...structure, offers };
  });
  const structures = inOrder(resolved.map((structure) => ({ ...structure, offeredBy: offeredBy.get(structure.id) ?? [] })));
  const rank = new Map(structures.map((structure, index) => [structure.id, index] as const));
  const ranked = (ids: readonly string[]): string[] =>
    [...ids].sort((left, right) => (rank.get(left) ?? 0) - (rank.get(right) ?? 0));
  const listed = structures.map((structure) => ({
    ...structure,
    offers: ranked(structure.offers),
    offeredBy: ranked(structure.offeredBy),
  }));
  const byId = new Map<string, StructureView>();
  for (const structure of listed) byId.set(structure.id, structure);
  // A reader still holding an id a structure had before it was a document
  // finds it by that id.
  for (const structure of listed)
    for (const former of structure.formerIds ?? []) if (!byId.has(former)) byId.set(former, structure);
  return { outcome: "success", result: { structures: listed, byId } };
}

/**
 * A built-in's fields: its release fields as the release declares them —
 * type, options, suggestions and limit — each under the name and the
 * *Required* its block gives it, in its block's place, a release field no
 * block declares after them; then the fields a person added (`RO_0005`).
 */
function withReleaseFields(structureId: string, declared: readonly FieldDeclaration[]): FieldDeclaration[] {
  const release = releaseFieldsOf(structureId);
  const placed = declared.map((field) => {
    const own = release.find((candidate) => candidate.key === field.key);
    if (own === undefined) return field;
    return {
      ...own,
      name: field.name,
      required: own.required || field.required,
      ...(field.blockId === undefined ? {} : { blockId: field.blockId }),
      ...(field.default === undefined ? {} : { default: field.default }),
    };
  });
  const missing = release.filter((field) => !declared.some((one) => one.key === field.key));
  return [...placed, ...missing];
}

/** Every structure, retired ones included and marked, the built-ins first. */
export async function listStructures(): Promise<GraphOutcome<StructureView[]>> {
  const catalogue = await readCatalogue();
  return catalogue.outcome === "success"
    ? { outcome: "success", result: [...catalogue.result.structures] }
    : (catalogue as GraphOutcome<never>);
}

/** One structure, or a refusal naming it. */
export async function readStructure(
  structureId: string,
): Promise<GraphOutcome<StructureView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const structure = catalogue.result.byId.get(structureId);
  return structure === undefined
    ? refuse("unknownStructure", `Structure ${structureId} is not here.`)
    : { outcome: "success", result: structure };
}

const named = (name: string, fallback = UNNAMED_STRUCTURE): string =>
  name.trim() === "" ? fallback : name.trim();

/**
 * A new structure (`RO_0005_003`): a document using *Structure*, titled as
 * named, its first block the description when one is given and empty
 * otherwise, blocks allowed to use it, allowing nothing and carrying no
 * field yet, placed last. One truth write, so a structure never stands
 * without being one.
 */
export async function createStructure(input: {
  readonly name: string;
  readonly description?: string;
}): Promise<GraphOutcome<StructureView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const id = port.uuid();
  const blockId = port.uuid();
  const fieldsId = port.uuid();
  const description = (input.description ?? "").trim();
  const order =
    catalogue.result.structures.reduce((highest, structure) => Math.max(highest, structure.order), 0) + 1;
  const written = await outsideBranch(() =>
    commit(
      [
        `CREATE (d:document {id: $d_id, title: $d_title, status: "established"})`,
        `CREATE (b:text {id: $b_id, order: $b_order, runs: $b_runs, status: "established"})`,
        `RELATE dref -[c:${CONTAINS}]-> bref`,
        `RELATE dref -[h:${HAS_BLOCK_STRUCTURE}]-> sref`,
        `CREATE (f:${STRUCTURE_FIELDS_TYPE} {id: $f_id, role: $f_structure, values: $f_values, status: "established"})`,
        `RELATE fref -[fo:${FIELDS_OF}]-> dref`,
        `RELATE fref -[ff:${FIELDS_FOR}]-> sref`,
      ].join("; "),
      {
        d_id: id,
        d_title: named(input.name),
        b_id: blockId,
        b_order: orderBetween("", ""),
        b_runs: description === "" ? [] : [{ text: description }],
        f_id: fieldsId,
        f_structure: STRUCTURE_STRUCTURE,
        f_values: { blocks: true, order },
        dref: nodeRef(id),
        bref: nodeRef(blockId),
        sref: nodeRef(STRUCTURE_STRUCTURE),
        fref: nodeRef(fieldsId),
      },
      `create structure ${named(input.name)}`,
      async () => undefined,
    ),
  );
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return readStructure(id);
}

/**
 * The acts on a structure that are not its document's (`RO_0005_003`): its
 * name, description, fields and what it allows are written in its document
 * like any document's; what stays an act is retiring and restoring it
 * (`RO_0005_Q7`), and *Keyword*'s *Send with prompt*.
 */
export type StructureCommand =
  | { readonly command: "retire" }
  | { readonly command: "restore" }
  /** One *Send with prompt* switch on *Keyword*: a field's key or an allowed
   * structure's id, on or off (`BO_0310_031`). */
  | { readonly command: "sendWithPrompt"; readonly entry: string; readonly on: boolean };

/**
 * Values this extension keeps on a structure's *Structure* values beside the
 * ones a person sets — `retired`, `sendWithPrompt` — written as one truth
 * write, merged over what is stored.
 */
async function keepStructureValues(
  structureId: string,
  patch: Readonly<Record<string, unknown>>,
  rationale: string,
): Promise<GraphOutcome<void>> {
  const standing = await readStanding([structureId]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const stored = standing.result.fields.get(nodeRef(structureId))?.get(STRUCTURE_STRUCTURE);
  if (stored !== undefined)
    return writeTruth({
      statement: "SET f.values = $f_values",
      parameters: { fNodeId: stored.nodeId, f_values: { ...stored.values, ...patch } },
      rationale,
    });
  const id = port.uuid();
  return writeTruth({
    statement: [
      `CREATE (f:${STRUCTURE_FIELDS_TYPE} {id: $f_id, role: $f_structure, values: $f_values, status: "established"})`,
      `RELATE fref -[fo:${FIELDS_OF}]-> sref`,
      `RELATE fref -[ff:${FIELDS_FOR}]-> rref`,
    ].join("; "),
    parameters: {
      f_id: id,
      f_structure: STRUCTURE_STRUCTURE,
      f_values: patch,
      fref: nodeRef(id),
      sref: nodeRef(structureId),
      rref: nodeRef(STRUCTURE_STRUCTURE),
    },
    rationale,
  });
}

/**
 * One act on a structure, one truth write, answering the structure as it
 * stands afterwards. A built-in refuses retire and restore in words.
 */
export async function reviseStructure(
  structureId: string,
  command: StructureCommand,
): Promise<GraphOutcome<StructureView>> {
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const structure = catalogue.result.byId.get(structureId);
  if (structure === undefined)
    return refuse("unknownStructure", `Structure ${structureId} is not here.`);
  let written: GraphOutcome<unknown>;
  switch (command.command) {
    case "retire":
    case "restore":
      if (structure.builtin)
        return refuse("builtinStructure", `${structure.name} is built in: it is never retired or restored.`);
      if (structure.retired === (command.command === "retire")) return { outcome: "success", result: structure };
      written = await keepStructureValues(structure.id, { retired: command.command === "retire" }, `${command.command} structure ${structure.name}`);
      break;
    case "sendWithPrompt": {
      if (structure.id !== KEYWORD_STRUCTURE)
        return refuse("sendWithPrompt", `Only Keyword sends its words with a prompt; ${structure.name} does not.`);
      const known = structure.fields.some((field) => field.key === command.entry) || structure.offers.includes(command.entry);
      if (!known)
        return refuse("sendWithPrompt", `${structure.name} has no field or allowed structure ${command.entry}.`);
      const current = structure.sendWithPrompt ?? [];
      const next = command.on
        ? current.includes(command.entry) ? current : [...current, command.entry]
        : current.filter((entry) => entry !== command.entry);
      written = await keepStructureValues(structure.id, { sendWithPrompt: next }, `${command.on ? "send" : "stop sending"} ${command.entry} with a prompt`);
      break;
    }
  }
  if (written.outcome !== "success") return written as GraphOutcome<never>;
  return readStructure(structure.id);
}

/** A subject a structure is taken on: a document, or a block in its reading order. */
export interface Subject {
  readonly documentId: string;
  /** Absent for the document's own structures. */
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

/** One subject's stored values for one structure. */
interface StoredFields {
  readonly nodeId: string;
  readonly structure: string;
  readonly subject: string;
  readonly values: Record<string, FieldValue>;
  readonly files: readonly BlobReference[];
}

/** Where the structures and values of a set of subjects stand. */
interface Standing {
  /** Per subject node id: structure id → the active relation. */
  readonly taken: ReadonlyMap<string, ReadonlyMap<string, ReadRelation>>;
  /** Per subject node id: structure id → the stored values. */
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
    else if (Array.isArray(held))
      // A reference holding several, and the lists this extension keeps
      // beside the values (RO_0005).
      values[key] = held.filter((one): one is string => typeof one === "string");
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

/** The structures taken on, and the values stored for, a set of subjects. */
async function readStanding(subjects: readonly string[]): Promise<GraphOutcome<Standing>> {
  const taken = new Map<string, Map<string, ReadRelation>>();
  const fields = new Map<string, Map<string, StoredFields>>();
  if (subjects.length === 0)
    return { outcome: "success", result: { taken, fields, dataRevision: 0 } };
  const roots = subjects.map(nodeRef);
  const assigned = await query({
    statement: `MATCH (s)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH s, h, r ROOT s`,
    roots,
    unbounded: true,
    metadataOnly: true,
    purpose: "structures taken",
  });
  if (assigned.outcome !== "success" && assigned.outcome !== "noResult")
    return assigned as GraphOutcome<never>;
  let dataRevision = assigned.outcome === "success" ? assigned.result.resolvedDataRevision : 0;
  for (const relation of assigned.outcome === "success" ? assigned.result.relations : []) {
    if (!active(relation, HAS_BLOCK_STRUCTURE) || relation.to.nodeId === undefined) continue;
    const held = taken.get(relation.fromNodeId) ?? new Map<string, ReadRelation>();
    held.set(bareId(relation.to.nodeId), relation);
    taken.set(relation.fromNodeId, held);
  }
  const stored = await query({
    statement: `MATCH (f)-[o:${FIELDS_OF}]->(s) RETURN GRAPH f, o, s ROOT s`,
    roots,
    unbounded: true,
    purpose: "structure values",
  });
  if (stored.outcome !== "success" && stored.outcome !== "noResult")
    return stored as GraphOutcome<never>;
  if (stored.outcome === "success") {
    dataRevision = Math.max(dataRevision, stored.result.resolvedDataRevision);
    const byId = new Map(stored.result.nodes.map((node) => [node.id, node] as const));
    for (const relation of stored.result.relations) {
      if (!active(relation, FIELDS_OF) || relation.to.nodeId === undefined) continue;
      const node = byId.get(relation.fromNodeId);
      if (node === undefined || !isType(node, STRUCTURE_FIELDS_TYPE)) continue;
      const content = node.revision.content ?? {};
      const structure = text(content["role"]);
      if (structure === "") continue;
      const held = fields.get(relation.to.nodeId) ?? new Map<string, StoredFields>();
      held.set(structure, {
        nodeId: node.id,
        structure,
        subject: relation.to.nodeId,
        values: valuesFrom(content["values"]),
        files: Array.isArray(content["files"]) ? (content["files"] as BlobReference[]) : [],
      });
      fields.set(relation.to.nodeId, held);
    }
  }
  return { outcome: "success", result: { taken, fields, dataRevision } };
}

/** What open groups propose on the subjects: structures to take, values to store. */
interface Proposed {
  readonly structures: ReadonlyMap<string, ReadonlySet<string>>;
  readonly values: ReadonlyMap<string, ReadonlySet<string>>;
}

async function readProposed(
  subjects: readonly string[],
  fieldNodes: ReadonlyMap<string, { subject: string; structure: string }>,
): Promise<Proposed> {
  const structures = new Map<string, Set<string>>();
  const values = new Map<string, Set<string>>();
  const groups = await reachingGroups([...subjects.map(nodeRef), ...fieldNodes.keys()]);
  if (groups.outcome !== "success") return { structures, values };
  const add = (map: Map<string, Set<string>>, subject: string, structure: string) =>
    map.set(subject, new Set([...(map.get(subject) ?? []), structure]));
  const wanted = new Set(subjects.map(nodeRef));
  for (const group of groups.result) {
    if (group.rejected === true) continue;
    const staged = group.stagedRelations;
    const newFieldsOf = new Map<string, string>();
    const newFieldsFor = new Map<string, string>();
    for (const relation of staged) {
      const to = nodeRef(relation.toId);
      if (relation.type === HAS_BLOCK_STRUCTURE && wanted.has(relation.fromNodeId))
        add(structures, relation.fromNodeId, bareId(to));
      if (relation.type === FIELDS_OF && wanted.has(to)) newFieldsOf.set(relation.fromNodeId, to);
      if (relation.type === FIELDS_FOR) newFieldsFor.set(relation.fromNodeId, bareId(to));
    }
    for (const [node, subject] of newFieldsOf) {
      const structure = newFieldsFor.get(node);
      if (structure !== undefined) add(values, subject, structure);
    }
    for (const node of group.touchedNodes) {
      const held = fieldNodes.get(nodeRef(node));
      if (held !== undefined && !(group.carryForwardNodes ?? []).includes(node))
        add(values, held.subject, held.structure);
    }
  }
  return { structures, values };
}

const takenView = (
  structure: StructureView,
  offered: boolean,
  stored: StoredFields | undefined,
  proposed: "structure" | "values" | undefined,
  onBlock: boolean,
): TakenStructure => {
  const values = stored?.values ?? {};
  const fields = declaredFor(structure.id, structure.fields, values);
  return {
    id: structure.id,
    name: structure.name,
    description: structure.description,
    ...(structure.text === structure.description ? {} : { text: structure.text }),
    retired: structure.retired,
    builtin: structure.builtin,
    offered,
    fields,
    values,
    missing: missingOf(fields, values),
    blocks: structure.blocks,
    ...(proposed === undefined ? {} : { proposed }),
    ...(structure.sendWithPrompt === undefined ? {} : { sendWithPrompt: structure.sendWithPrompt }),
    ...(onBlock && !structure.blocks ? { notOnBlock: true as const } : {}),
  };
};

/**
 * A document's structures and each block's, in reading order, with what each
 * may take, at the data revision it was read at (`BO_0309_012`): the one
 * shape a route, a run and a dependent extension read. `scope` names a branch
 * the caller works in, or a data revision to read at; absent, it reads truth
 * as it stands and marks what open groups propose.
 */
export async function structuresOf(
  documentId: string,
  scope: { readonly branch?: string; readonly dataRevision?: number } = {},
): Promise<GraphOutcome<DocumentStructuresView>> {
  // Other groups' proposals are marked for a person; a run reads its own
  // through its group and marks none. BO_0344_005
  const read = () =>
    withBranch(scope.branch, () =>
      readStructures(documentId, scope.dataRevision === undefined && currentRun() === undefined),
    );
  return scope.dataRevision === undefined
    ? read()
    : atDataRevision(scope.dataRevision, read);
}

async function readStructures(
  documentId: string,
  withProposals: boolean,
): Promise<GraphOutcome<DocumentStructuresView>> {
  const document = await documentOf(documentId);
  if (document.outcome !== "success") return document as GraphOutcome<never>;
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const blocks = placed(document.result.blocks);
  const subjects = [documentId, ...blocks.map((block) => block.blockId)];
  const standing = await readStanding(subjects);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  const fieldNodes = new Map<string, { subject: string; structure: string }>();
  for (const held of standing.result.fields.values())
    for (const stored of held.values())
      fieldNodes.set(stored.nodeId, { subject: stored.subject, structure: stored.structure });
  const proposed = withProposals
    ? await readProposed(subjects, fieldNodes)
    : { structures: new Map<string, ReadonlySet<string>>(), values: new Map<string, ReadonlySet<string>>() };
  const { byId, structures } = catalogue.result;
  const inherited = await readInherited(documentId, catalogue.result);
  const inheritedIds = [...new Set(inherited.map((structure) => structure.id))];

  const takenIds = (subject: string): string[] =>
    [...(standing.result.taken.get(nodeRef(subject))?.keys() ?? [])]
      .map((id) => byId.get(id)?.id ?? id)
      .filter((id) => byId.has(id));
  // Whether a structure could be taken here, retired or not: the retired flag is
  // said on its own. Only what stands above counts: a structure offered by a structure
  // on the subject itself is offered to the blocks under it, never to the
  // subject (BO_0309_Q1).
  const offeredHere = (structure: StructureView, above: ReadonlySet<string>): boolean =>
    structure.offeredBy.length === 0 || structure.offeredBy.some((offering) => above.has(offering));
  const viewOf = (subject: string, above: readonly string[], onBlock: boolean) => {
    const own = takenIds(subject);
    const chain = new Set(above);
    const node = nodeRef(subject);
    const stored = standing.result.fields.get(node);
    const proposing = proposed.structures.get(node) ?? new Set<string>();
    const valuing = proposed.values.get(node) ?? new Set<string>();
    const takenStructures: TakenStructure[] = [];
    for (const structure of structures) {
      const isTaken = own.includes(structure.id);
      const isProposed = proposing.has(structure.id);
      if (!isTaken && !isProposed) continue;
      takenStructures.push(
        takenView(
          structure,
          offeredHere(structure, chain),
          stored?.get(structure.id),
          isTaken ? (valuing.has(structure.id) ? "values" : undefined) : "structure",
          onBlock,
        ),
      );
    }
    return { structures: takenStructures, takeable: takeableFrom(structures, chain, onBlock), own };
  };

  const documentView = viewOf(documentId, inheritedIds, false);
  const ownOf = new Map<string, readonly string[]>();
  const structuredBlocks: StructuredBlock[] = [];
  for (const block of blocks) {
    const above = [
      ...inheritedIds,
      ...documentView.own,
      ...(block.parentId === null ? [] : (ownOf.get(block.parentId) ?? [])),
    ];
    const view = viewOf(block.blockId, above, true);
    ownOf.set(block.blockId, view.own);
    structuredBlocks.push({
      blockId: block.blockId,
      kind: block.kind,
      parentId: block.parentId,
      structures: view.structures,
      takeable: view.takeable,
    });
  }
  return {
    outcome: "success",
    result: {
      documentId,
      dataRevision: standing.result.dataRevision,
      structures: documentView.structures,
      takeable: documentView.takeable,
      blocks: structuredBlocks,
      inherited,
      // A block's references too: a field's Limited to names a structure (RO_0005).
      referenceTitles: await referenceTitles([...documentView.structures, ...structuredBlocks.flatMap((block) => block.structures)]),
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
 * The titles of the nodes the reference values of these structures name
 * (`DO_0030_005`): one read per distinct id, in the read's own scope. A value
 * naming nothing that reads, or something with no words, is left out.
 */
async function referenceTitles(structures: readonly TakenStructure[]): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const structure of structures)
    for (const field of structure.fields) {
      const value = structure.values[field.key];
      if (field.type !== "reference") continue;
      if (typeof value === "string" && value !== "") ids.add(value);
      if (Array.isArray(value)) for (const one of value) ids.add(one);
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
 * The structures above a document that is a block's focused work (walk finding,
 * 2026-10-01): the block it was opened from is above it, so that block's
 * structures, those of the callout and the document it stands in, and on up the
 * chain, offer their structures to the focused work and its blocks. Nearest
 * first; a chain that loops or goes deeper than `FOCUS_DEPTH` stops there.
 * A focus that cannot be read is no focus: the document then reads as a
 * document of its own.
 */
async function readInherited(documentId: string, catalogue: Catalogue): Promise<readonly InheritedStructure[]> {
  const inherited: InheritedStructure[] = [];
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
      for (const structureId of standing.result.taken.get(nodeRef(subject))?.keys() ?? []) {
        const structure = catalogue.byId.get(structureId);
        if (structure === undefined) continue;
        inherited.push({ id: structure.id, name: structure.name, description: structure.description, on: subject, document: parent });
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
  readonly view: DocumentStructuresView;
  readonly standing: Standing;
  readonly node: string;
  readonly takeable: readonly string[];
  readonly taken: readonly string[];
  /** The subject block's words and the keys its document's fields hold, a
   * field's key being minted from them as the block takes *Field*
   * (`RO_0005`); empty for the document. */
  readonly words: string;
  readonly fieldKeys: readonly string[];
}

async function situationOf(subject: Subject): Promise<GraphOutcome<Situation>> {
  const view = await structuresOf(subject.documentId);
  if (view.outcome !== "success") return view as GraphOutcome<never>;
  let takeable = view.result.takeable;
  let taken = view.result.structures.filter((structure) => structure.proposed !== "structure").map((structure) => structure.id);
  if (subject.blockId !== undefined) {
    const block = view.result.blocks.find((candidate) => candidate.blockId === subject.blockId);
    if (block === undefined)
      return refuse(
        "unknownBlock",
        `Block ${subject.blockId} is not in the reading order of document ${subject.documentId}.`,
      );
    takeable = block.takeable;
    taken = block.structures.filter((structure) => structure.proposed !== "structure").map((structure) => structure.id);
  }
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const node = subjectNode(subject);
  const standing = await readStanding([node]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  let words = "";
  if (subject.blockId !== undefined) {
    const document = await documentOf(subject.documentId);
    if (document.outcome !== "success") return document as GraphOutcome<never>;
    const block = document.result.blocks.find((candidate) => candidate.blockId === subject.blockId);
    words = block !== undefined && block.kind === "text" ? runsText(block.runs) : "";
  }
  const fieldKeys = view.result.blocks.flatMap((block) =>
    block.structures
      .filter((structure) => structure.id === FIELD_STRUCTURE)
      .map((structure) => structure.values["key"])
      .filter((key): key is string => typeof key === "string"),
  );
  return {
    outcome: "success",
    result: { catalogue: catalogue.result, view: view.result, standing: standing.result, node, takeable, taken, words, fieldKeys },
  };
}

const subjectName = (subject: Subject): string =>
  subject.blockId === undefined ? `document ${subject.documentId}` : `block ${subject.blockId}`;

/**
 * The statement that takes a structure on a subject (`BO_0309_012`): the relation,
 * and the structure's defaults filled in beside any value already stored
 * (`BO_0318_Q8`). Refused in words for a structure that is not here, is retired,
 * or cannot be taken where the subject stands. Null when it is taken already.
 */
/**
 * The status a created node carries: a person's write is truth at once; a
 * run's is staged into its group, where the core refuses an explicit status
 * and makes the node a candidate (`calliopa-bootstrap`'s `BO_0344`).
 */
const establishedUnless = (byRun: boolean): string => (byRun ? "" : ', status: "established"');

function takeStatement(
  situation: Situation,
  subject: Subject,
  structureId: string,
  withDefaults = true,
  /** A run proposing a structure gives its document *Structure*, the one
   * place it is taken outside Structures' `+` (`RO_0005_005`). */
  structureByRun = false,
): GraphOutcome<Staged | null> {
  const structure = situation.catalogue.byId.get(structureId);
  if (structure === undefined) return refuse("unknownStructure", `Structure ${structureId} is not here.`);
  if (situation.taken.includes(structure.id)) return { outcome: "success", result: null };
  // A structure is made from Structures' `+`, never by giving a document
  // Structure (RO_0005_Q9).
  if (structure.id === STRUCTURE_STRUCTURE && !(structureByRun && subject.blockId === undefined))
    return refuse("structureFromStructures", "A structure is made with the + of Structures; Structure is never given to a document by hand.");
  // Structure and Field define structures, and take no field a person adds
  // (RO_0005_Q6).
  if (structure.id === FIELD_STRUCTURE && (subject.documentId === STRUCTURE_STRUCTURE || subject.documentId === FIELD_STRUCTURE))
    return refuse("builtinField", "Structure and Field define structures themselves: they take no field of a person's.");
  if (structure.retired)
    return refuse("retiredStructure", `${structure.name} is retired and is not allowed any more.`);
  // Before the offer: an offer never lets a block take a structure blocks may not
  // take (RO_0003_Q5).
  if (subject.blockId !== undefined && !structure.blocks)
    return refuse(
      "blockNotAllowed",
      `${structure.name} is used by documents alone: use it on the document${structure.offeredBy.length > 0 ? ", or on the focused work of the block that allows it" : ""}.`,
    );
  // Structure is in no typeahead, so a run's proposal of it is not asked
  // what the document may use (RO_0005_005).
  if (structure.id !== STRUCTURE_STRUCTURE && !situation.takeable.includes(structure.id)) {
    const offering = structure.offeredBy
      .map((id) => situation.catalogue.byId.get(id)?.name ?? "")
      .filter((name) => name !== "");
    return refuse(
      "notOffered",
      `${structure.name} is allowed by ${offering.join(" or ") || "another structure"}, and nothing above this ${subject.blockId === undefined ? "document" : "block"} uses it.`,
    );
  }
  const parameters: Record<string, unknown> = {
    sref: nodeRef(situation.node),
    rref: nodeRef(structure.id),
  };
  const statements = [`RELATE sref -[n:${HAS_BLOCK_STRUCTURE}]-> rref`];
  // A document taking *Instruction* is an instruction, so it carries the record every
  // reader of an instruction keys on. BO_0311_015 BO_0338
  if (structure.id === INSTRUCTION_STRUCTURE && subject.blockId === undefined) {
    parameters["spNodeId"] = nodeRef(situation.node);
    parameters["sp_record"] = INSTRUCTION_RECORD;
    statements.push("SET sp.record = $sp_record");
  }
  const defaults: Record<string, FieldValue> = withDefaults ? defaultsOf(structure.fields) : {};
  // A field's key, minted once from the block's words and never changed, so
  // a rename keeps every value (RO_0005).
  if (structure.id === FIELD_STRUCTURE) defaults["key"] = mintFieldKey(situation.words, situation.fieldKeys);
  const stored = situation.standing.fields.get(nodeRef(situation.node))?.get(structure.id);
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => !isHeld(stored?.values[key])),
  );
  if (Object.keys(missing).length > 0) {
    if (stored === undefined) {
      const id = port.uuid();
      parameters["f_id"] = id;
      parameters["f_structure"] = structure.id;
      parameters["f_values"] = missing;
      parameters["fref"] = nodeRef(id);
      statements.push(
        `CREATE (f:${STRUCTURE_FIELDS_TYPE} {id: $f_id, role: $f_structure, values: $f_values${establishedUnless(structureByRun)}})`,
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
      rationale: `${subjectName(subject)} uses the structure ${structure.name}`,
    },
  };
}

/** The statement that clears a structure from a subject; its values stay stored,
 * so taking it again finds them. Null when it is not taken. */
function clearStatement(
  situation: Situation,
  subject: Subject,
  structureId: string,
): GraphOutcome<Staged | null> {
  const structure = situation.catalogue.byId.get(structureId);
  const relation = situation.standing.taken
    .get(nodeRef(situation.node))
    ?.get(structure?.id ?? structureId);
  if (relation === undefined) return { outcome: "success", result: null };
  // A structure stops being one by being retired, never by clearing
  // Structure (RO_0005_Q9).
  if (structure?.id === STRUCTURE_STRUCTURE)
    return refuse("structureFromStructures", "A structure stays one: retire it rather than clearing Structure.");
  const release = structure?.id === FIELD_STRUCTURE ? releaseFieldAt(situation, subject) : null;
  if (release !== null)
    return refuse("builtinField", `${release.owner.name}'s ${release.field.name} is built in and stays a field. Add a field beside it.`);
  // A document clearing *Profile* is no profile any more. BO_0311_015
  const unprofiled = structure?.id === INSTRUCTION_STRUCTURE && subject.blockId === undefined;
  return {
    outcome: "success",
    result: {
      // A close names its vantage: the kernel's write gate classifies a closed
      // relation from a node the script touches, and a bare close touches
      // none, so `hFrom` says where it is readable from (`ui-kernel.md`).
      statement: unprofiled ? "CLOSE h; SET sp.record = null" : "CLOSE h",
      parameters: { hRelationId: relation.id, hFrom: nodeRef(situation.node), ...(unprofiled ? { spNodeId: nodeRef(situation.node) } : {}) },
      rationale: `${subjectName(subject)} no longer uses the structure ${structure?.name ?? structureId}`,
    },
  };
}

/** A held file, as against a list of ids. */
const isFileValue = (value: FieldValue): value is FileValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The entries of these keys alone. */
const pick = (entries: Readonly<Record<string, unknown>>, keys: readonly string[]): Record<string, FieldValue> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => keys.includes(key))) as Record<string, FieldValue>;

/** The release field a block of a built-in's document declares, if it
 * declares one (`RO_0005`). */
function releaseFieldAt(situation: Situation, subject: Subject): { readonly owner: StructureView; readonly field: FieldDeclaration } | null {
  const owner = situation.catalogue.byId.get(subject.documentId);
  if (owner === undefined || !owner.builtin || subject.blockId === undefined) return null;
  const field = owner.fields.find((candidate) => candidate.blockId === subject.blockId);
  return field !== undefined && isBuiltinField(owner.id, field.key) ? { owner, field } : null;
}

/**
 * What only the release sets (`RO_0005`): on a built-in's document, whether
 * blocks may use it and the structures it allows by release; on a release
 * field's block, what the field holds — a person renames it, marks it
 * required and gives it a default, as before.
 */
function releaseRefusal(
  situation: Situation,
  subject: Subject,
  structureId: string,
  entries: Readonly<Record<string, unknown>>,
): GraphOutcome<never> | null {
  const owner = situation.catalogue.byId.get(subject.documentId);
  if (owner === undefined || !owner.builtin) return null;
  if (structureId === STRUCTURE_STRUCTURE && subject.blockId === undefined) {
    if ("blocks" in entries)
      return refuse(
        "builtinBlocks",
        `${owner.name} is built in: ${owner.blocks ? "blocks may use it" : "it is used by documents alone"}, as the release says.`,
      );
    if ("allows" in entries) {
      const next = Array.isArray(entries["allows"]) ? (entries["allows"] as readonly unknown[]) : [];
      const dropped = BUILTIN_OFFERS.filter(([from, to]) => from === owner.id && !next.includes(to)).map(
        ([, to]) => situation.catalogue.byId.get(to)?.name ?? to,
      );
      if (dropped.length > 0)
        return refuse("builtinOffer", `${owner.name} allows ${dropped.join(" and ")} on every instance: that is built in and stays.`);
    }
  }
  const release = structureId === FIELD_STRUCTURE ? releaseFieldAt(situation, subject) : null;
  if (release !== null && Object.keys(entries).some((key) => key !== "required" && key !== "default"))
    return refuse(
      "builtinField",
      `${release.owner.name}'s ${release.field.name} is built in: its type, its options and what it suggests are the release's. Add a field beside it.`,
    );
  return null;
}

/**
 * What this extension keeps a document's guards to (`RO_0005_020`,
 * `documents`' `guardDocuments`): a structure's document is never deleted,
 * and a built-in's title and its release fields' blocks stay as the release
 * says. A document using no *Structure* is not read further.
 */
/**
 * What a document is, for `documents`' namer (`DO_0034_008`): a document
 * using *Structure* — established, or staged in the group read through — is a
 * *structure*; anything else this extension leaves unnamed.
 */
export async function structureKindOf(documentId: string, group?: string): Promise<string | undefined> {
  const read = await query({
    statement: `MATCH (d)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH d, h, r ROOT d`,
    roots: [nodeRef(documentId)],
    ...(group === undefined ? {} : { proposalOverlay: group }),
    purpose: "what a document is",
  });
  if (read.outcome !== "success") return undefined;
  const uses = read.result.relations.some(
    (relation) => active(relation, HAS_BLOCK_STRUCTURE) && relation.fromNodeId === nodeRef(documentId) && relation.to.nodeId === nodeRef(STRUCTURE_STRUCTURE),
  );
  return uses ? "structure" : undefined;
}

export async function guardOf(documentId: string): Promise<GraphOutcome<Fixed>> {
  const standing = await readStanding([documentId]);
  if (standing.outcome !== "success") return standing as GraphOutcome<never>;
  if (standing.result.taken.get(nodeRef(documentId))?.has(STRUCTURE_STRUCTURE) !== true)
    return { outcome: "success", result: { blocks: {} } };
  const catalogue = await readCatalogue();
  if (catalogue.outcome !== "success") return catalogue as GraphOutcome<never>;
  const structure = catalogue.result.byId.get(documentId);
  if (structure === undefined || structure.id !== documentId) return { outcome: "success", result: { blocks: {} } };
  const blocks: Record<string, string> = {};
  if (structure.builtin)
    for (const field of structure.fields)
      if (field.blockId !== undefined && isBuiltinField(structure.id, field.key))
        blocks[field.blockId] = `${field.name} is a field ${structure.name} carries on every instance: it stays, and its words may change.`;
  return {
    outcome: "success",
    result: {
      undeletable: `${structure.name} is a structure: retire it rather than deleting it, so what uses it keeps it.`,
      ...(structure.builtin ? { title: `${structure.name} is built in: its name is the release's.` } : {}),
      blocks,
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
 * The statement that stores values of one structure on a subject (`BO_0309_013`):
 * each value read against its field's type, a reference checked to name a
 * node that is there, a file's live blob reference hoisted into `files` at
 * the node's top level, which is where CCGW keeps a blob alive
 * (`binary-content.md`). The subject must take the structure.
 */
async function valuesStatement(
  situation: Situation,
  subject: Subject,
  structureId: string,
  entries: Readonly<Record<string, unknown>>,
  byRun = false,
): Promise<GraphOutcome<Staged | null>> {
  const structure = situation.catalogue.byId.get(structureId);
  if (structure === undefined) return refuse("unknownStructure", `Structure ${structureId} is not here.`);
  if (!situation.taken.includes(structure.id))
    return refuse("structureNotTaken", `This ${subject.blockId === undefined ? "document" : "block"} does not use ${structure.name}.`);
  const stored = situation.standing.fields.get(nodeRef(situation.node))?.get(structure.id);
  const values: Record<string, FieldValue> = { ...(stored?.values ?? {}) };
  // A field's Default is read against the Type the same write gives it.
  const fields = declaredFor(structure.id, structure.fields, { ...values, ...pick(entries, ["type", "options"]) });
  const refused = releaseRefusal(situation, subject, structure.id, entries);
  if (refused !== null) return refused;
  for (const [key, raw] of Object.entries(entries)) {
    const field = fields.find((candidate) => candidate.key === key);
    if (field === undefined) return refuse("unknownField", `${structure.name} has no field ${key}.`);
    const read = valueFor(field, raw);
    if ("failure" in read) return refuse("valueShape", read.failure);
    if (field.type === "reference" && typeof read.value === "string" && !(await exists(read.value)))
      return refuse("unknownReference", `${field.name} names ${read.value}, which is not here.`);
    if (field.type === "reference" && Array.isArray(read.value))
      for (const one of read.value)
        if (!(await exists(one))) return refuse("unknownReference", `${field.name} names ${one}, which is not here.`);
    // A structure never allows itself (RO_0005).
    if (structure.id === STRUCTURE_STRUCTURE && key === "allows" && Array.isArray(read.value) && read.value.includes(subject.documentId))
      return refuse("offersItself", "A structure cannot allow itself.");
    // A reference limited to a structure takes only a document carrying it. BO_0336_011
    const named = typeof read.value === "string" ? [read.value] : Array.isArray(read.value) ? read.value : [];
    if (field.type === "reference" && field.carrying !== undefined && named.length > 0) {
      const carrying = await documentsCarrying(field.carrying);
      if (carrying.outcome !== "success") return carrying as GraphOutcome<never>;
      if (!named.every((one) => carrying.result.some((document) => document.id === one))) {
        const wanted = situation.catalogue.byId.get(field.carrying)?.name ?? field.carrying;
        return refuse("notCarrying", `${field.name} names a document using ${wanted}, and this one does not.`);
      }
    }
    if (!isHeld(read.value)) delete values[key];
    else values[key] = read.value;
  }
  const files: BlobReference[] = [];
  for (const value of Object.values(values)) {
    if (!isFileValue(value)) continue;
    const objectId = objectIdOfHash(value.hash);
    if (objectId === null) return refuse("valueShape", `${value.filename} was not uploaded here.`);
    const file: FileValue = value;
    files.push({ ...blobReference(objectId, file.mediaType, file.size), filename: file.filename });
  }
  const parameters: Record<string, unknown> = { f_values: values, f_files: files };
  let statement: string;
  if (stored === undefined) {
    const id = port.uuid();
    Object.assign(parameters, {
      f_id: id,
      f_structure: structure.id,
      fref: nodeRef(id),
      sref: nodeRef(situation.node),
      rref: nodeRef(structure.id),
    });
    statement = [
      `CREATE (f:${STRUCTURE_FIELDS_TYPE} {id: $f_id, role: $f_structure, values: $f_values, files: $f_files${establishedUnless(byRun)}})`,
      `RELATE fref -[fo:${FIELDS_OF}]-> sref`,
      `RELATE fref -[ff:${FIELDS_FOR}]-> rref`,
    ].join("; ");
  } else {
    parameters["fNodeId"] = stored.nodeId;
    statement = "SET f.values = $f_values, f.files = $f_files";
  }
  return {
    outcome: "success",
    result: { statement, parameters, rationale: `values of ${structure.name} on ${subjectName(subject)}` },
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
 * The person takes or clears a structure on a document or a block, as truth at
 * once (`BO_0309_012`, `BO_0308_Q4`), and reads the document's structures back.
 */
export async function setStructure(input: Subject & {
  readonly structure: string;
  readonly taken: boolean;
}): Promise<GraphOutcome<DocumentStructuresView>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged = input.taken
    ? takeStatement(situation.result, input, input.structure)
    : clearStatement(situation.result, input, input.structure);
  if (staged.outcome !== "success") return staged as GraphOutcome<never>;
  if (staged.result !== null) {
    const written = await writeTruth(staged.result);
    if (written.outcome !== "success") return written as GraphOutcome<never>;
  }
  return structuresOf(input.documentId);
}

/** The person stores values of a structure on a document or a block (`BO_0309_013`). */
export async function setValues(input: Subject & {
  readonly structure: string;
  readonly values: Readonly<Record<string, unknown>>;
}): Promise<GraphOutcome<DocumentStructuresView>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged = await valuesStatement(situation.result, input, input.structure, input.values);
  if (staged.outcome !== "success") return staged as GraphOutcome<never>;
  if (staged.result !== null) {
    const written = await writeTruth(staged.result);
    if (written.outcome !== "success") return written as GraphOutcome<never>;
  }
  return structuresOf(input.documentId);
}

/**
 * What a run proposes (`BO_0309_016`): structures to take and to clear and values
 * to store on one subject, as statements the kernel stages into the run's
 * group, refused in words where the person's own act would be. A value may
 * be proposed for a structure the same proposal takes.
 */
export async function proposeStructures(input: Subject & {
  readonly take: readonly string[];
  readonly clear: readonly string[];
  readonly values: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}): Promise<GraphOutcome<readonly Staged[]>> {
  const situation = await situationOf(input);
  if (situation.outcome !== "success") return situation as GraphOutcome<never>;
  const staged: Staged[] = [];
  const { byId } = situation.result.catalogue;
  const valued = new Set(Object.keys(input.values).map((structure) => byId.get(structure)?.id ?? structure));
  const values: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [structure, entries] of Object.entries(input.values)) values[byId.get(structure)?.id ?? structure] = entries;
  let taken = [...situation.result.taken];
  for (const structure of input.take) {
    const id = byId.get(structure)?.id;
    const newlyTaken = id !== undefined && !taken.includes(id);
    // A structure taken with values in the same proposal gets its defaults beside
    // those values in one roleFields node, not a node from each statement.
    const one = takeStatement({ ...situation.result, taken }, input, structure, !(id !== undefined && valued.has(id)), true);
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
    if (id === undefined) continue;
    if (newlyTaken && valued.has(id)) {
      const defaults = defaultsOf(byId.get(id)?.fields ?? []);
      values[id] = { ...defaults, ...(values[id] ?? {}) };
    }
    taken = [...taken, id];
  }
  for (const structure of input.clear) {
    const one = clearStatement(situation.result, input, structure);
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
  }
  for (const [structure, entries] of Object.entries(values)) {
    const one = await valuesStatement({ ...situation.result, taken }, input, structure, entries, true);
    if (one.outcome !== "success") return one as GraphOutcome<never>;
    if (one.result !== null) staged.push(one.result);
  }
  return { outcome: "success", result: staged };
}

/** A document carrying a structure, as a built-in's row lists it. */
export interface CarryingDocument {
  readonly id: string;
  readonly title: string;
}

/**
 * The documents carrying a structure as their own (`BO_0309_015`): what a built-in
 * structure's row unfolds to in the Structures category, by title.
 */
export async function documentsCarrying(structureId: string): Promise<GraphOutcome<readonly CarryingDocument[]>> {
  const structure = await readStructure(structureId);
  if (structure.outcome !== "success") return structure as GraphOutcome<never>;
  const found = await query({
    statement: `MATCH (d:document)-[h:${HAS_BLOCK_STRUCTURE}]->(r) RETURN GRAPH d, h, r ROOT r`,
    roots: [nodeRef(structure.result.id)],
    unbounded: true,
    purpose: "documents carrying a structure",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const byId = new Map(found.result.nodes.map((node) => [node.id, node] as const));
  const documents: CarryingDocument[] = [];
  for (const relation of found.result.relations) {
    if (!active(relation, HAS_BLOCK_STRUCTURE)) continue;
    const node = byId.get(relation.fromNodeId);
    if (node === undefined || !isType(node, "document")) continue;
    documents.push({ id: bareId(node.id), title: text((node.revision.content ?? {})["title"]) });
  }
  return {
    outcome: "success",
    result: documents.sort((left, right) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1)),
  };
}
