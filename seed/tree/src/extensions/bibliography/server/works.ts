
import { port } from "~/server/port";
import { CONTAINS } from "~/extensions/documents/server/assemble";
import { blockContentFor } from "~/extensions/documents/server/documents";
import {
  FIELDS_FOR,
  FIELDS_OF,
  HAS_BLOCK_STRUCTURE,
  STRUCTURE_FIELDS_TYPE,
  SOURCE_STRUCTURE,
  type FieldValue,
  type FileValue,
} from "~/extensions/structures/lib/structures";
import { orderBetween } from "~/lib/order";
import { currentBranch } from "~/server/ccgw/branch-scope";
import { blobReference, objectIdOfHash, type BlobReference } from "~/server/ccgw/blobs";
import { query, type ReadNode, type ReadResult } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { commit } from "~/server/ccgw/script";
import { respond, type GraphOutcome, type OutcomeResponse } from "~/server/outcome";

import { SOURCE_RECORD, duplicateOf, fieldsOfRecord, readWorkRecord, recordOfSource, type WorkRecord } from "../lib/work";

/**
 * The sources of the instance (`BO_0291_016`, reshaped by `BO_0313_020`): a
 * source is a document carrying `record: source` and the built-in *Source*,
 * its CSL record its title and *Source*'s fields. Read as one whole — the
 * sources are few and one read at the pin answers every duplicate question —
 * and added like a document: the person's `addWork` is a human content write
 * through the depth, truth outside a branch and staged in the tab's branch,
 * and a run only ever proposes one. The identifier is the identity for
 * duplicates: a DOI, an ISBN or a URL a source already holds adds nothing and
 * answers the existing source. A source's fields are edited where every
 * role's are, in the inspector (`structures`), and it is deleted as the
 * document it is.
 */

const DOCUMENT_TYPE = "document";

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

export interface WorkView {
  /** The source document's identity, which a citation names. */
  readonly workId: string;
  /** The source document's revision. */
  readonly revisionId: string;
  readonly record: WorkRecord;
}

export interface WrittenWork {
  readonly workId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

const contentOf = (node: ReadNode): Record<string, unknown> => node.revision.content ?? {};

/** Whether a node is a source document. */
export const isSourceDocument = (node: ReadNode): boolean =>
  contentOf(node)["_type"] === DOCUMENT_TYPE && contentOf(node)["record"] === SOURCE_RECORD;

/** *Source*'s values on each document, from a read of `fieldsOf` rooted at them. */
function sourceValues(read: ReadResult | null): Map<string, { readonly nodeId: string; readonly values: Record<string, FieldValue> }> {
  const out = new Map<string, { nodeId: string; values: Record<string, FieldValue> }>();
  if (read === null) return out;
  const byId = new Map(read.nodes.map((node) => [node.id, node] as const));
  for (const relation of read.relations) {
    if (relation.type !== FIELDS_OF || relation.validity.status !== "active" || relation.to.nodeId === undefined) continue;
    const node = byId.get(relation.fromNodeId);
    if (node === undefined || contentOf(node)["_type"] !== STRUCTURE_FIELDS_TYPE || contentOf(node)["role"] !== SOURCE_STRUCTURE) continue;
    const values = contentOf(node)["values"];
    out.set(relation.to.nodeId, {
      nodeId: node.id,
      values: typeof values === "object" && values !== null && !Array.isArray(values) ? (values as Record<string, FieldValue>) : {},
    });
  }
  return out;
}

/** One source as the graph holds it; null when its record no longer reads,
 * which a build behind the declaration tolerates rather than drops. */
export function toWork(node: ReadNode, values: Readonly<Record<string, FieldValue>>): WorkView | null {
  if (!isSourceDocument(node)) return null;
  const title = contentOf(node)["title"];
  const read = recordOfSource(typeof title === "string" && title.trim() !== "" ? title : "Untitled", values);
  if ("failure" in read) return null;
  return { workId: bareId(node.id), revisionId: node.revision.id, record: read.record };
}

async function readSources(documents: readonly ReadNode[]): Promise<GraphOutcome<WorkView[]>> {
  const sources = documents.filter(isSourceDocument);
  if (sources.length === 0) return { outcome: "success", result: [] };
  const fields = await query({
    statement: `MATCH (f)-[o:${FIELDS_OF}]->(s) RETURN GRAPH f, o, s ROOT s`,
    roots: sources.map((node) => node.id),
    unbounded: true,
    purpose: "sources' fields",
  });
  if (fields.outcome !== "success" && fields.outcome !== "noResult") return fields as GraphOutcome<never>;
  const values = sourceValues(fields.outcome === "success" ? fields.result : null);
  return {
    outcome: "success",
    result: sources.map((node) => toWork(node, values.get(node.id)?.values ?? {})).filter((work): work is WorkView => work !== null),
  };
}

/** Every source at the pin, in no particular order. */
export async function listWorks(): Promise<GraphOutcome<WorkView[]>> {
  const found = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE} {record: $record}) RETURN GRAPH d`,
    parameters: { record: SOURCE_RECORD },
    unbounded: true,
    purpose: "sources",
  });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  return readSources(found.result.nodes);
}

/** One source by identity, or a refusal naming it. */
export async function readWork(workId: string): Promise<GraphOutcome<WorkView>> {
  const found = await query({ statement: "MATCH (d) RETURN GRAPH d ROOT d", roots: [nodeRef(workId)], purpose: "source" });
  if (found.outcome === "noResult") return refuse("unknownWork", `${workId} is not a source.`);
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const read = await readSources(found.result.nodes.filter((node) => node.id === nodeRef(workId)));
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  const work = read.result[0];
  if (work === undefined) return refuse("unknownWork", `${workId} is not a source.`);
  return { outcome: "success", result: work };
}

/**
 * A source's read as its routes answer it: a document that is no source is an
 * ordinary answer, `200` with `noResult`, rather than a refusal, since a
 * source's places ask it of every document opened and the browser logs every
 * `4xx` as a failed request (`BI_0001`). Every other outcome answers as
 * `respond` answers it.
 */
export function sourceAnswer<T>(outcome: GraphOutcome<T>): OutcomeResponse<T> {
  if (outcome.outcome === "validationFailure" && outcome.failures.some((failure) => failure.rule === "unknownWork")) {
    return { status: 200, body: { outcome: "noResult", detail: outcome.failures[0]?.detail ?? "not a source" } };
  }
  return respond(outcome);
}

/** The live blob references a set of values holds, which CCGW keeps a blob
 * alive by at the node's top level (`binary-content.md`). */
export function filesOf(values: Readonly<Record<string, FieldValue>>): BlobReference[] {
  const files: BlobReference[] = [];
  for (const value of Object.values(values)) {
    if (typeof value !== "object" || value === null) continue;
    const file: FileValue = value;
    const objectId = objectIdOfHash(file.hash);
    if (objectId !== null) files.push({ ...blobReference(objectId, file.mediaType, file.size), filename: file.filename });
  }
  return files;
}

/** The identities a new source document is written under. */
export interface SourceIds {
  readonly documentId: string;
  readonly blockId: string;
  readonly fieldsId: string;
}

export const mintSourceIds = (): SourceIds => ({ documentId: port.uuid(), blockId: port.uuid(), fieldsId: port.uuid() });

/**
 * The statements that write one source document (`BO_0313_020`): the
 * document with its title and `record: source`, an empty paragraph to hold
 * the person's notes, *Source* taken, and its values. `prefix` keeps the
 * aliases of several sources in one script apart; `established` is false in
 * a branch and for a run's staging, where the kernel refuses an explicit
 * status.
 */
export function sourceStatements(
  record: WorkRecord,
  ids: SourceIds,
  parameters: Record<string, unknown>,
  established: boolean,
  prefix = "s",
): string[] {
  const status = established ? ', status: "established"' : "";
  const values = fieldsOfRecord(record);
  const block = blockContentFor({ kind: "text" }, orderBetween("", ""));
  Object.assign(parameters, {
    [`${prefix}d_id`]: ids.documentId,
    [`${prefix}d_title`]: record.title,
    [`${prefix}d_record`]: SOURCE_RECORD,
    [`${prefix}b_id`]: ids.blockId,
    [`${prefix}b_order`]: block["order"],
    [`${prefix}b_runs`]: block["runs"],
    [`${prefix}f_id`]: ids.fieldsId,
    [`${prefix}f_role`]: SOURCE_STRUCTURE,
    [`${prefix}f_values`]: values,
    [`${prefix}f_files`]: filesOf(values),
    [`${prefix}dref`]: nodeRef(ids.documentId),
    [`${prefix}bref`]: nodeRef(ids.blockId),
    [`${prefix}fref`]: nodeRef(ids.fieldsId),
    [`${prefix}rref`]: nodeRef(SOURCE_STRUCTURE),
  });
  return [
    `CREATE (${prefix}d:${DOCUMENT_TYPE} {id: $${prefix}d_id, title: $${prefix}d_title, record: $${prefix}d_record${status}})`,
    `CREATE (${prefix}b:text {id: $${prefix}b_id, order: $${prefix}b_order, runs: $${prefix}b_runs${status}})`,
    `RELATE ${prefix}dref -[${prefix}c:${CONTAINS}]-> ${prefix}bref`,
    `RELATE ${prefix}dref -[${prefix}h:${HAS_BLOCK_STRUCTURE}]-> ${prefix}rref`,
    `CREATE (${prefix}f:${STRUCTURE_FIELDS_TYPE} {id: $${prefix}f_id, role: $${prefix}f_role, values: $${prefix}f_values, files: $${prefix}f_files${status}})`,
    `RELATE ${prefix}fref -[${prefix}fo:${FIELDS_OF}]-> ${prefix}dref`,
    `RELATE ${prefix}fref -[${prefix}ff:${FIELDS_FOR}]-> ${prefix}rref`,
  ];
}

const duplicateRefusal = <T>(duplicate: WorkView): GraphOutcome<T> =>
  refuse("duplicateWork", `This source is already here as ${duplicate.workId}: ${duplicate.record.title}.`);

/**
 * Adds a source document. A record sharing a DOI, an ISBN or a URL with a
 * source already here is refused by naming it, so the surface shows the
 * existing one instead of writing a second.
 */
export async function addWork(input: { readonly record: unknown }): Promise<GraphOutcome<WrittenWork>> {
  const read = readWorkRecord(input.record);
  if ("failure" in read) return refuse("recordShape", read.failure);
  const existing = await listWorks();
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  const duplicate = duplicateOf(read.record, existing.result);
  if (duplicate !== undefined) return duplicateRefusal(duplicate);
  const ids = mintSourceIds();
  const parameters: Record<string, unknown> = {};
  const statements = sourceStatements(read.record, ids, parameters, currentBranch() === undefined);
  return commit(statements.join("; "), parameters, `add the source ${read.record.title}`, async (dataRevision, revisionOf) => ({
    workId: ids.documentId,
    revisionId: await revisionOf(ids.documentId),
    dataRevision,
  }));
}

/**
 * Fills a source from a fetched record (`BO_0313_021`, *Fill from
 * identifier*): the title and every field the record holds are written over
 * what stands, and the fields it does not hold — the file, a person's notes
 * on the record, the fields a person added — are kept. Compared with the
 * base the caller read, so a stale fill never overwrites a newer title.
 */
export async function fillWork(input: {
  readonly workId: string;
  readonly baseRevisionId: string;
  readonly record: unknown;
}): Promise<GraphOutcome<WrittenWork>> {
  const read = readWorkRecord(input.record);
  if ("failure" in read) return refuse("recordShape", read.failure);
  const current = await readWork(input.workId);
  if (current.outcome !== "success") return current as GraphOutcome<never>;
  if (current.result.revisionId !== input.baseRevisionId) {
    return { outcome: "conflict", conflicts: [{ nodeId: input.workId, expectedRevisionId: input.baseRevisionId, currentRevisionId: current.result.revisionId }] };
  }
  const others = await listWorks();
  if (others.outcome !== "success") return others as GraphOutcome<never>;
  const duplicate = duplicateOf(read.record, others.result.filter((work) => work.workId !== input.workId));
  if (duplicate !== undefined) return duplicateRefusal(duplicate);
  const fields = await query({
    statement: `MATCH (f)-[o:${FIELDS_OF}]->(s) RETURN GRAPH f, o, s ROOT s`,
    roots: [nodeRef(input.workId)],
    unbounded: true,
    purpose: "a source's fields",
  });
  if (fields.outcome !== "success" && fields.outcome !== "noResult") return fields as GraphOutcome<never>;
  const stored = sourceValues(fields.outcome === "success" ? fields.result : null).get(nodeRef(input.workId));
  const values: Record<string, FieldValue> = { ...(stored?.values ?? {}), ...fieldsOfRecord(read.record) };
  const parameters: Record<string, unknown> = {
    dNodeId: nodeRef(input.workId),
    d_title: read.record.title,
    f_values: values,
    f_files: filesOf(values),
  };
  const statements = ["SET d.title = $d_title"];
  if (stored === undefined) {
    const id = port.uuid();
    const status = currentBranch() === undefined ? ', status: "established"' : "";
    Object.assign(parameters, { f_id: id, f_role: SOURCE_STRUCTURE, fref: nodeRef(id), sref: nodeRef(input.workId), rref: nodeRef(SOURCE_STRUCTURE) });
    statements.push(
      `CREATE (f:${STRUCTURE_FIELDS_TYPE} {id: $f_id, role: $f_role, values: $f_values, files: $f_files${status}})`,
      `RELATE fref -[fo:${FIELDS_OF}]-> sref`,
      `RELATE fref -[ff:${FIELDS_FOR}]-> rref`,
    );
  } else {
    parameters["fNodeId"] = stored.nodeId;
    statements.push("SET f.values = $f_values, f.files = $f_files");
  }
  return commit(statements.join("; "), parameters, `fill the source ${read.record.title}`, async (dataRevision, revisionOf) => ({
    workId: input.workId,
    revisionId: await revisionOf(input.workId),
    dataRevision,
  }));
}
