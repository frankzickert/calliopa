import type postgres from "postgres";

import { db } from "../db";
import type { NonEmpty } from "../graph/contract";
import { readGraph } from "../graph/read";
import { asRecord } from "../documents/content";
import { DOCUMENT_TYPE } from "../documents/vocabulary";

/**
 * One document a run staged a group against, as the run's detail lists it.
 *
 * The count is of items still unanswered, because that is the only number a
 * reader can act on: an answered item is already truth or already rejected, and
 * either way there is nothing left to open the document for.
 */
export interface ProposedDocument {
  readonly documentId: string;
  readonly title: string;
  readonly unanswered: number;
}

interface Row {
  readonly root_node_id: string;
  readonly unanswered: number;
}

/**
 * What a run proposed, indexed by the documents it touched.
 *
 * A run is found on a group through the provenance it staged with rather than
 * through a table joining the two. The graph already carries why a write
 * exists, and a second record of the same fact is one that can disagree with
 * it.
 */
export async function runProposals(
  runId: string,
  sql: postgres.Sql = db(),
): Promise<readonly ProposedDocument[]> {
  const rows = await sql<Row[]>`
    select g.root_node_id,
           count(i.id) filter (where i.answer is null)::int as unanswered
    from graph_proposal_group g
    left join graph_proposal_item i on i.group_id = g.id
    where g.request ->> 'runId' = ${runId}
    group by g.root_node_id
  `;

  const [first, ...rest] = rows.map((row) => row.root_node_id);
  if (first === undefined) {
    return [];
  }

  // Titles come through the gateway rather than out of the node tables, for
  // the reason every other read does: nothing outside `src/server/graph/`
  // reads graph content directly.
  const roots: NonEmpty<string> = [first, ...rest];
  const outcome = await readGraph(sql, { roots });
  const titles = new Map<string, string>();
  if (outcome.outcome === "success") {
    for (const node of outcome.result.nodes) {
      if (node.semanticType !== DOCUMENT_TYPE) continue;
      const title = asRecord(node.content)?.["title"];
      titles.set(node.nodeId, typeof title === "string" ? title : "");
    }
  }

  return rows
    .map((row) => ({
      documentId: row.root_node_id,
      title: titles.get(row.root_node_id) ?? "",
      unanswered: row.unanswered,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}
