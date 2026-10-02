import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { WORK_FIELDS, WORK_KINDS, WORK_TYPE, readWorkRecord, storedKey, type WorkRecord } from "../lib/work";
import { mintSourceIds, sourceStatements, type SourceIds } from "./works";

/**
 * `bibliography`'s executable migration (`BO_0313_023`, on the path
 * `calliopa-bootstrap`'s `BO_0312_001` opened): the kernel posts to the route
 * when it serves a pin carrying the `ext.migration` member naming it, and
 * writes the statement answered as one truth change set under the owner,
 * once per instance — the dogfood instance and every install taking the
 * release (`BO_0312_Q7`). It runs after *Source*'s release fields stand
 * (`structures`' `source-fields`).
 */

/** What a migration route answers: one script and its parameters, or an
 * empty statement when this instance has nothing to change. */
export interface MigrationStatement {
  readonly statement: string;
  readonly parameters: Record<string, unknown>;
}

/** A `work` as the migration finds it: its identity and its record. */
export interface FormerWork {
  readonly id: string;
  readonly record: WorkRecord;
}

/** A text block citing a work, with its runs as they stand. */
export interface CitingBlock {
  readonly id: string;
  readonly runs: readonly unknown[];
}

const contentOf = (node: ReadNode): Record<string, unknown> => node.revision.content ?? {};

/**
 * A `work` node's record, read under the names it was stored by
 * (`containerTitle`, `publisherPlace`). A record that no longer reads keeps
 * its title and a kind CSL names, so no cited work is left behind.
 */
export function formerRecord(content: Readonly<Record<string, unknown>>): WorkRecord {
  const candidate: Record<string, unknown> = {};
  for (const key of ["title", "kind", ...WORK_FIELDS]) {
    const stored = content[storedKey(key)] ?? content[key];
    if (stored !== undefined && stored !== null) candidate[key] = stored;
  }
  const read = readWorkRecord(candidate);
  if ("record" in read) return read.record;
  const title = typeof content["title"] === "string" && content["title"].trim() !== "" ? content["title"] : "Untitled source";
  const kind = WORK_KINDS.find((one) => one === content["kind"]) ?? "document";
  return { title, kind };
}

/** The runs with every citation of a migrated work naming its document;
 * null when none does. */
export function rewrittenRuns(runs: readonly unknown[], documentOf: ReadonlyMap<string, string>): unknown[] | null {
  let changed = false;
  const out = runs.map((run) => {
    if (typeof run !== "object" || run === null) return run;
    const cite = (run as { cite?: unknown }).cite;
    if (typeof cite !== "object" || cite === null) return run;
    const work = (cite as { work?: unknown }).work;
    const document = typeof work === "string" ? documentOf.get(bareId(work)) : undefined;
    if (document === undefined) return run;
    changed = true;
    return { ...(run as Record<string, unknown>), cite: { ...(cite as Record<string, unknown>), work: document } };
  });
  return changed ? out : null;
}

/**
 * The script that makes every work a source document (`BO_0313_023`): each
 * becomes a document with its title and `record: source`, an empty paragraph
 * for notes, *Source* taken and its fields filled from the record, its file
 * moved to *File*; every citation of it in a text block is rewritten to name
 * the new document, so reference lists read as before; and the work is
 * retired. `mint` names the new ids, so the statement is pure.
 */
export function sourcesStatement(
  works: readonly FormerWork[],
  blocks: readonly CitingBlock[],
  mint: () => SourceIds = mintSourceIds,
): MigrationStatement {
  if (works.length === 0) return { statement: "", parameters: {} };
  const statements: string[] = [];
  const parameters: Record<string, unknown> = {};
  const documentOf = new Map<string, string>();
  works.forEach((work, index) => {
    const ids = mint();
    documentOf.set(work.id, ids.documentId);
    statements.push(...sourceStatements(work.record, ids, parameters, true, `w${index}`));
    parameters[`x${index}NodeId`] = nodeRef(work.id);
    statements.push(`RETIRE x${index}`);
  });
  blocks.forEach((block, index) => {
    const runs = rewrittenRuns(block.runs, documentOf);
    if (runs === null) return;
    parameters[`c${index}NodeId`] = nodeRef(block.id);
    parameters[`c${index}_runs`] = runs;
    statements.push(`SET c${index}.runs = $c${index}_runs`);
  });
  return { statement: statements.join("; "), parameters };
}

/** Every work standing, and every text block whose runs cite one. */
export async function readFormerWorks(): Promise<GraphOutcome<{ readonly works: readonly FormerWork[]; readonly blocks: readonly CitingBlock[] }>> {
  const found = await query({ statement: `MATCH (w:${WORK_TYPE}) RETURN GRAPH w`, unbounded: true, purpose: "migration: works" });
  if (found.outcome !== "success" && found.outcome !== "noResult") return found as GraphOutcome<never>;
  const works = (found.outcome === "success" ? found.result.nodes : [])
    .filter((node) => node.revision.status === "established" && contentOf(node)["_type"] === WORK_TYPE)
    .map((node) => ({ id: bareId(node.id), record: formerRecord(contentOf(node)) }))
    .sort((left, right) => (left.id < right.id ? -1 : 1));
  if (works.length === 0) return { outcome: "success", result: { works, blocks: [] } };
  const cited = new Set(works.map((work) => work.id));
  const texts = await query({ statement: "MATCH (b:text) RETURN GRAPH b", unbounded: true, purpose: "migration: citing blocks" });
  if (texts.outcome !== "success" && texts.outcome !== "noResult") return texts as GraphOutcome<never>;
  const blocks = (texts.outcome === "success" ? texts.result.nodes : [])
    .filter((node) => node.revision.status === "established")
    .flatMap((node): CitingBlock[] => {
      const runs = contentOf(node)["runs"];
      if (!Array.isArray(runs)) return [];
      const cites = runs.some((run) => {
        const work = (run as { cite?: { work?: unknown } } | null)?.cite?.work;
        return typeof work === "string" && cited.has(bareId(work));
      });
      return cites ? [{ id: bareId(node.id), runs }] : [];
    })
    .sort((left, right) => (left.id < right.id ? -1 : 1));
  return { outcome: "success", result: { works, blocks } };
}

/** The migrations this extension runs, by the route segment its member names. */
export const MIGRATIONS: Readonly<Record<string, () => Promise<GraphOutcome<MigrationStatement>>>> = {
  /** Every work becomes a source document and every citation names it. BO_0313_023 */
  "sources-are-documents": async () => {
    const former = await readFormerWorks();
    if (former.outcome !== "success") return former as GraphOutcome<never>;
    return { outcome: "success", result: sourcesStatement(former.result.works, former.result.blocks) };
  },
};
