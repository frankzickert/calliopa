import { randomUUID } from "node:crypto";

import { bareId, nodeRef } from "~/server/ccgw/nodes";
import { query, type ReadNode } from "~/server/ccgw/client";
import { commit } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";

import { WORK_FIELDS, WORK_TYPE, duplicateOf, readWorkRecord, storedKey, type WorkRecord } from "../lib/work";

/**
 * The works of the instance's bibliography (`BO_0291_016`): read as one
 * whole — the bibliography is small and one query at the pin answers every
 * duplicate question — and written like a block: a person's `addWork`,
 * `reviseWork` and `retireWork` are human content writes through the depth,
 * as every content write is, and a run only ever proposes one. The
 * identifier is the identity for duplicates: a DOI, an ISBN or a URL the
 * bibliography already holds adds nothing and answers the existing work.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

export interface WorkView {
  readonly workId: string;
  readonly revisionId: string;
  readonly record: WorkRecord;
}

export interface WrittenWork {
  readonly workId: string;
  readonly revisionId: string;
  readonly dataRevision: string;
}

/** One work as the graph holds it; null when the node is not a work or its
 * record no longer reads, which a build behind the declaration tolerates
 * rather than drops. */
export function toWork(node: ReadNode): WorkView | null {
  const content = node.revision.content ?? {};
  if (content["_type"] !== WORK_TYPE) return null;
  const candidate: Record<string, unknown> = {};
  for (const key of ["title", "kind", ...WORK_FIELDS]) {
    const stored = content[storedKey(key)] ?? content[key];
    if (stored !== undefined) candidate[key] = stored;
  }
  const read = readWorkRecord(candidate);
  if ("failure" in read) return null;
  return { workId: bareId(node.id), revisionId: node.revision.id, record: read.record };
}

/** Every work of the bibliography at the pin, in no particular order. */
export async function listWorks(): Promise<GraphOutcome<WorkView[]>> {
  const found = await query({ statement: `MATCH (w:${WORK_TYPE}) RETURN GRAPH w`, purpose: "bibliography" });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  return { outcome: "success", result: found.result.nodes.map(toWork).filter((work): work is WorkView => work !== null) };
}

/** One work by identity, or a refusal naming it. */
export async function readWork(workId: string): Promise<GraphOutcome<WorkView>> {
  const found = await query({ statement: "MATCH (w) RETURN GRAPH w ROOT w", roots: [nodeRef(workId)], purpose: "work" });
  if (found.outcome === "noResult") return refuse("unknownWork", `Work ${workId} is not in the bibliography.`);
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(workId));
  const work = node === undefined ? null : toWork(node);
  if (work === null) return refuse("unknownWork", `Work ${workId} is not in the bibliography.`);
  return { outcome: "success", result: work };
}

/** The property pairs a work's record is written as, under the graph's names. */
export const pairsOf = (record: WorkRecord, alias: string, parameters: Record<string, unknown>): string[] => {
  const pairs: string[] = [];
  for (const key of ["title", "kind", ...WORK_FIELDS]) {
    const value = (record as unknown as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const stored = storedKey(key);
    const name = `${alias}_${stored}`;
    parameters[name] = value;
    pairs.push(`${stored}: $${name}`);
  }
  return pairs;
};

/**
 * Adds a work as truth. A record sharing a DOI, an ISBN or a URL with a work
 * the bibliography already holds is refused by naming that work, so the
 * surface shows the existing one instead of writing a second.
 */
export async function addWork(input: { readonly record: unknown }): Promise<GraphOutcome<WrittenWork>> {
  const read = readWorkRecord(input.record);
  if ("failure" in read) return refuse("recordShape", read.failure);
  const existing = await listWorks();
  if (existing.outcome !== "success") return existing as GraphOutcome<never>;
  const duplicate = duplicateOf(read.record, existing.result);
  if (duplicate !== undefined) {
    return refuse("duplicateWork", `The bibliography already holds this work as ${duplicate.workId}: ${duplicate.record.title}.`);
  }
  const workId = randomUUID();
  const parameters: Record<string, unknown> = { w_id: workId };
  const pairs = ["id: $w_id", ...pairsOf(read.record, "w", parameters), 'status: "established"'];
  return commit(
    `CREATE (w:${WORK_TYPE} {${pairs.join(", ")}})`,
    parameters,
    `add the work ${read.record.title}`,
    async (dataRevision, revisionOf) => ({ workId, revisionId: await revisionOf(workId), dataRevision }),
  );
}

/**
 * Revises a work's record whole, compared with the base the caller read, so a
 * stale form never overwrites a newer record. Every permitted field is set
 * by property, an absent one to nothing, so a cleared field clears.
 */
export async function reviseWork(input: {
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
  if (duplicate !== undefined) {
    return refuse("duplicateWork", `The bibliography already holds this work as ${duplicate.workId}: ${duplicate.record.title}.`);
  }
  const parameters: Record<string, unknown> = { wNodeId: nodeRef(input.workId) };
  const assignments: string[] = [];
  for (const key of ["title", "kind", ...WORK_FIELDS]) {
    const stored = storedKey(key);
    const name = `w_${stored}`;
    parameters[name] = (read.record as unknown as Record<string, unknown>)[key] ?? null;
    assignments.push(`w.${stored} = $${name}`);
  }
  return commit(
    `SET ${assignments.join(", ")}`,
    parameters,
    `revise the work ${read.record.title}`,
    async (dataRevision, revisionOf) => ({ workId: input.workId, revisionId: await revisionOf(input.workId), dataRevision }),
  );
}

/** Retires a work, compared with the base the caller read. Its citations
 * then draw as missing (`documents`' `missingWorks`), never as a stale number. */
export async function retireWork(input: { readonly workId: string; readonly baseRevisionId: string }): Promise<GraphOutcome<WrittenWork>> {
  const current = await readWork(input.workId);
  if (current.outcome !== "success") return current as GraphOutcome<never>;
  if (current.result.revisionId !== input.baseRevisionId) {
    return { outcome: "conflict", conflicts: [{ nodeId: input.workId, expectedRevisionId: input.baseRevisionId, currentRevisionId: current.result.revisionId }] };
  }
  return commit(
    "RETIRE w",
    { wNodeId: nodeRef(input.workId) },
    `retire the work ${current.result.record.title}`,
    async (dataRevision) => ({ workId: input.workId, revisionId: input.baseRevisionId, dataRevision }),
  );
}

/**
 * Sets or clears a work's file (`BO_0291_018`): the core's blob reference,
 * uploaded a moment before, written by property against the base the caller
 * read. A fetched record never brings a file; a person's upload does.
 */
export async function setWorkFile(input: {
  readonly workId: string;
  readonly baseRevisionId: string;
  readonly file: Readonly<Record<string, unknown>> | null;
}): Promise<GraphOutcome<WrittenWork>> {
  const current = await readWork(input.workId);
  if (current.outcome !== "success") return current as GraphOutcome<never>;
  if (current.result.revisionId !== input.baseRevisionId) {
    return { outcome: "conflict", conflicts: [{ nodeId: input.workId, expectedRevisionId: input.baseRevisionId, currentRevisionId: current.result.revisionId }] };
  }
  return commit(
    "SET w.file = $w_file",
    { wNodeId: nodeRef(input.workId), w_file: input.file },
    input.file === null ? `drop the file of ${current.result.record.title}` : `keep the file of ${current.result.record.title}`,
    async (dataRevision, revisionOf) => ({ workId: input.workId, revisionId: await revisionOf(input.workId), dataRevision }),
  );
}
