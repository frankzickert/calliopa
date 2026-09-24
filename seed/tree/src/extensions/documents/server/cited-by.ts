import { query, type ReadResult } from "~/server/ccgw/client";
import { bareId, contentOf, typeOf } from "~/server/ccgw/nodes";
import type { GraphOutcome } from "~/server/outcome";

import { blocksOf, CONTAINS } from "./assemble";
import { DOCUMENT_TYPE } from "./vocabulary";

/** A document citing a work, with each block of its reading order that does. */
export interface CitingDocument {
  readonly documentId: string;
  readonly title: string;
  readonly citations: readonly { readonly blockId: string; readonly words: string }[];
}

/** How much of a citing block's words the list shows. */
const WORDS = 160;

const wordsOf = (runs: readonly { readonly text: string }[]): string => {
  const words = runs.map((run) => run.text).join("").replace(/\s+/gu, " ").trim();
  return words.length > WORDS ? `${words.slice(0, WORDS - 1).trimEnd()}…` : words;
};

/**
 * The documents citing a work, over one read of every document with its
 * contained text blocks (`BO_0291_023`): a block counts when it stands in the
 * document's reading order — contained, not discarded — and one of its runs
 * carries `cite` naming the work. Documents come in title order, their
 * citing blocks in the document's order, each with its words.
 */
export function citingDocumentsIn(graph: ReadResult, workId: string): CitingDocument[] {
  const citing: CitingDocument[] = [];
  for (const node of graph.nodes) {
    if (typeOf(node) !== DOCUMENT_TYPE || node.revision.status !== "established") continue;
    const documentId = bareId(node.id);
    const citations = blocksOf(graph, documentId, CONTAINS)
      .filter((block) => block.kind === "text" && block.standing !== "discarded" && block.runs.some((run) => run.cite?.work === workId))
      .map((block) => ({ blockId: block.blockId, words: block.kind === "text" ? wordsOf(block.runs) : "" }));
    if (citations.length === 0) continue;
    const title = contentOf(node)["title"];
    citing.push({ documentId, title: typeof title === "string" ? title : "", citations });
  }
  return citing.sort((left, right) => left.title.localeCompare(right.title) || (left.documentId < right.documentId ? -1 : 1));
}

/**
 * *Cited by* for a work (`BO_0291_023`): one unbounded read of every document
 * and the text blocks it contains, filtered here. A citation is an attribute
 * of a run, so the graph answers it in this one query at the pin and nothing
 * maintains an edge beside it: no `cites` relation is written, and none can
 * drift from the words.
 */
export async function documentsCiting(workId: string): Promise<GraphOutcome<readonly CitingDocument[]>> {
  const outcome = await query({
    statement: `MATCH (d:${DOCUMENT_TYPE})-[c:${CONTAINS}]->(b:text) RETURN GRAPH d, c, b`,
    unbounded: true,
    purpose: "documents citing a work",
  });
  if (outcome.outcome === "noResult") return { outcome: "success", result: [] };
  if (outcome.outcome !== "success") return outcome as GraphOutcome<never>;
  return { outcome: "success", result: citingDocumentsIn(outcome.result, workId) };
}
