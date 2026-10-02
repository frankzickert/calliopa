import type { ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";

import { CONTAINS } from "./assemble";
import { DOCUMENT_TYPE, SOURCE_RECORD } from "./vocabulary";

/** The `roleFields` relation from a role's values to what holds them —
 * `doc-block-roles`' vocabulary, named here only to find a proposed source's
 * values among its group's staged relations. */
const FIELDS_OF = "fieldsOf";

/** A relation the group stages, as the touched set names it. */
export interface StagedEdge {
  readonly type: string;
  readonly fromNodeId: string;
  readonly toId: string;
}

/**
 * The sources a proposed change carries with it (`BO_0291_036`, reshaped by
 * `BO_0313_030`): a run that cites a source it found proposes the source
 * document into the same group as the sentence citing it, and that document
 * is not a block of the citing document, so it never stands among its
 * proposals to answer. Accepting the sentence accepts those sources first —
 * user decision, 2026-09-24, after a sentence was accepted whose work stayed
 * a proposal and its citation pointed at nothing. Only sources of the same
 * group are carried: one another group proposes is that group's to answer.
 *
 * `nodes` are the group's members as the group-members read answers them;
 * `members` the item's own node refs; `edges` the group's staged relations.
 * Answers the node refs to accept, in the order the item's runs first cite
 * the sources: each source document, then the paragraph it contains and the
 * values *Source* holds on it, whose relations travel with them.
 */
export function proposedWorksCited(nodes: readonly ReadNode[], members: readonly string[], groupId: string, edges: readonly StagedEdge[] = []): string[] {
  const inGroup = (node: ReadNode): boolean => node.revision.content?.["_proposal"] === groupId;
  const sources = new Set(
    nodes
      .filter((node) => inGroup(node) && node.revision.content?.["_type"] === DOCUMENT_TYPE && node.revision.content?.["record"] === SOURCE_RECORD)
      .map((node) => bareId(node.id)),
  );
  const grouped = new Set(nodes.filter(inGroup).map((node) => node.id));
  const out: string[] = [];
  const add = (ref: string) => {
    if (!out.includes(ref)) out.push(ref);
  };
  for (const node of nodes) {
    if (!inGroup(node) || !members.includes(node.id)) continue;
    const runs = node.revision.content?.["runs"];
    if (!Array.isArray(runs)) continue;
    for (const run of runs) {
      const work = (run as { cite?: { work?: unknown } } | null)?.cite?.work;
      if (typeof work !== "string" || !sources.has(work)) continue;
      const ref = nodeRef(work);
      if (out.includes(ref)) continue;
      add(ref);
      for (const edge of edges) {
        if (edge.type === CONTAINS && edge.fromNodeId === ref && grouped.has(nodeRef(edge.toId))) add(nodeRef(edge.toId));
        if (edge.type === FIELDS_OF && nodeRef(edge.toId) === ref && grouped.has(edge.fromNodeId)) add(edge.fromNodeId);
      }
    }
  }
  return out;
}
