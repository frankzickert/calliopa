import { isBlobReference, objectIdOfHash } from "~/server/ccgw/blobs";
import { query, type ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { MANUSCRIPT_TYPE, isOutcome, type ManuscriptFile, type ManuscriptView } from "../lib/manuscript";

/**
 * The kept manuscripts (`BO_0293_021`): every `manuscript` node of the
 * instance, read as one list — a document's are the ones that name it — and
 * one by identity. A node this build cannot read as a manuscript is left out
 * rather than drawn wrong.
 */

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

const words = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

/** One manuscript as the graph holds it, or null. */
export function toManuscript(node: ReadNode): ManuscriptView | null {
  const content = node.revision.content ?? {};
  if (content["_type"] !== MANUSCRIPT_TYPE) return null;
  const of = content["of"];
  const outcome = content["outcome"];
  if (typeof of !== "string" || !isOutcome(outcome)) return null;
  const files: ManuscriptFile[] = [];
  for (const entry of Array.isArray(content["files"]) ? content["files"] : []) {
    if (!isBlobReference(entry)) continue;
    const objectId = objectIdOfHash(entry.hash);
    const filename = (entry as { filename?: unknown }).filename;
    if (objectId === null || typeof filename !== "string") continue;
    files.push({ objectId, filename, mediaType: entry.mediaType, size: entry.size });
  }
  return {
    manuscriptId: bareId(node.id),
    revisionId: node.revision.id,
    of,
    title: typeof content["title"] === "string" ? content["title"] : "",
    revision: typeof content["revision"] === "number" ? content["revision"] : 0,
    venue: typeof content["venue"] === "string" ? content["venue"] : "",
    files,
    made: typeof content["made"] === "string" ? content["made"] : "",
    by: typeof content["by"] === "string" ? content["by"] : "",
    outcome,
    log: words(content["log"]),
    omitted: words(content["omitted"]),
  };
}

/** Every kept manuscript, newest first; a document's when `of` is given. */
export async function listManuscripts(of?: string): Promise<GraphOutcome<ManuscriptView[]>> {
  const found = await query({ statement: `MATCH (m:${MANUSCRIPT_TYPE}) RETURN GRAPH m`, purpose: "manuscripts" });
  if (found.outcome === "noResult") return { outcome: "success", result: [] };
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const all = found.result.nodes.map(toManuscript).filter((manuscript): manuscript is ManuscriptView => manuscript !== null);
  const listed = of === undefined ? all : all.filter((manuscript) => manuscript.of === of);
  return { outcome: "success", result: listed.sort((left, right) => (left.made < right.made ? 1 : left.made > right.made ? -1 : 0)) };
}

/** One kept manuscript, or a refusal naming it. */
export async function readManuscript(manuscriptId: string): Promise<GraphOutcome<ManuscriptView>> {
  const found = await query({ statement: "MATCH (m) RETURN GRAPH m ROOT m", roots: [nodeRef(manuscriptId)], purpose: "manuscript" });
  if (found.outcome === "noResult") return refuse("unknownManuscript", `Manuscript ${manuscriptId} is not kept here.`);
  if (found.outcome !== "success") return found as GraphOutcome<never>;
  const node = found.result.nodes.find((candidate) => candidate.id === nodeRef(manuscriptId));
  const manuscript = node === undefined ? null : toManuscript(node);
  if (manuscript === null) return refuse("unknownManuscript", `Manuscript ${manuscriptId} is not kept here.`);
  return { outcome: "success", result: manuscript };
}
