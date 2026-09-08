import { query, touchedSet } from "../ccgw/client";
import { bareId, CONTAINS, contentOf, nodeRef, typeOf } from "../documents/assemble";
import { readDocumentProposals } from "../documents/documents";
import { DOCUMENT_TYPE } from "../documents/vocabulary";
import { readBridgeRun } from "./bridge";

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

/**
 * What a run proposed, indexed by the documents it touched. `BO_0207_015`
 *
 * A run is found on its group through the bridge's own record of the run,
 * and the group's touched set says which nodes it staged. A staged relation
 * from a document places or retires a block in it; a candidate of a block is
 * placed by the containment the block already has, read from the block
 * upward. The unanswered count is the document's own reading of the group
 * (`readDocumentProposals`), so the detail and the editor cannot disagree.
 */
export async function runProposals(runId: string): Promise<readonly ProposedDocument[]> {
  const run = await readBridgeRun(runId);
  if (!run.ok || !run.value.group) return [];
  const group = run.value.group;

  const touched = await touchedSet(group);
  if (touched.outcome !== "success") return [];

  const documents = new Set<string>();
  for (const relation of touched.result.stagedRelations) {
    if (relation.type === CONTAINS || relation.type === "retired") {
      documents.add(relation.fromNodeId);
    }
  }
  for (const nodeId of touched.result.touchedNodes) {
    const parent = await query({
      statement: `MATCH (d:${DOCUMENT_TYPE})-[c:${CONTAINS}]->(b) RETURN GRAPH d, c, b ROOT b`,
      roots: [nodeId],
      purpose: "run proposals",
    });
    if (parent.outcome !== "success") continue;
    for (const relation of parent.result.relations) {
      if (relation.type === CONTAINS && relation.to.nodeId === nodeId && relation.validity.status === "active") {
        documents.add(relation.fromNodeId);
      }
    }
  }

  const listed: ProposedDocument[] = [];
  for (const documentNode of documents) {
    const documentId = bareId(documentNode);
    const proposals = await readDocumentProposals(documentId);
    if (proposals.outcome !== "success") continue;
    const own = proposals.result.groups.find((candidate) => candidate.groupId === group);
    const title = await titleOf(documentNode);
    listed.push({ documentId, title, unanswered: own?.items.length ?? 0 });
  }
  return listed.sort((left, right) => left.title.localeCompare(right.title));
}

async function titleOf(documentNode: string): Promise<string> {
  const outcome = await query({
    statement: "MATCH (n {id: $id}) RETURN GRAPH n",
    parameters: { id: bareId(documentNode) },
    purpose: "run proposals",
  });
  if (outcome.outcome !== "success") return "";
  const node = outcome.result.nodes.find((candidate) => candidate.id === nodeRef(documentNode));
  if (node === undefined || typeOf(node) !== DOCUMENT_TYPE) return "";
  const title = contentOf(node)["title"];
  return typeof title === "string" ? title : "";
}
