import type { ProposedTarget } from "~/contract";
import { query, touchedSet } from "~/server/ccgw/client";
import { bareId, contentOf, nodeRef, typeOf } from "~/server/ccgw/nodes";
import { CONTAINS } from "./assemble";
import { readDocumentProposals } from "./documents";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * The documents a run staged into, as the frame's run detail lists them
 * (`proposedTargets` in `src/contract.ts`). What a group touched means is
 * this extension's to read: the group's touched set says which nodes it
 * staged, a staged relation from a document places or retires a block in it,
 * and a candidate of a block is placed by the containment the block already
 * has, read from the block upward. The unanswered count is the document's own
 * reading of the group, so the detail and the editor cannot disagree.
 * BO_0207_015 BO_0255_007
 */
export async function proposedDocuments(group: string): Promise<readonly ProposedTarget[]> {
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

  const listed: ProposedTarget[] = [];
  for (const documentNode of documents) {
    const documentId = bareId(documentNode);
    const proposals = await readDocumentProposals(documentId);
    if (proposals.outcome !== "success") continue;
    const own = proposals.result.groups.find((candidate) => candidate.groupId === group);
    const title = await titleOf(documentNode);
    listed.push({ itemId: documentId, kind: "document", title, unanswered: own?.items.length ?? 0 });
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
