import type { ReadNode } from "~/server/ccgw/client";
import { bareId, nodeRef } from "~/server/ccgw/nodes";

import { WORK_TYPE } from "./vocabulary";

/**
 * The works a proposed change carries with it (`BO_0291_036`): a run that
 * cites a work it found proposes the work into the same group as the
 * sentence citing it, and a work is not a block of the document, so it never
 * stands among the document's proposals to answer. Accepting the sentence
 * accepts those works first — user decision, 2026-09-24, after a sentence
 * was accepted whose work stayed a proposal and its citation pointed at
 * nothing. Only works of the same group are carried: a work another group
 * proposes is that group's to answer.
 *
 * `nodes` are the group's members as the group-members read answers them;
 * `members` the item's own node refs. Answers the node refs of the works to
 * accept, in the order the item's runs first cite them.
 */
export function proposedWorksCited(nodes: readonly ReadNode[], members: readonly string[], groupId: string): string[] {
  const inGroup = (node: ReadNode): boolean => node.revision.content?.["_proposal"] === groupId;
  const works = new Set(nodes.filter((node) => inGroup(node) && node.revision.content?.["_type"] === WORK_TYPE).map((node) => bareId(node.id)));
  const out: string[] = [];
  for (const node of nodes) {
    if (!inGroup(node) || !members.includes(node.id)) continue;
    const runs = node.revision.content?.["runs"];
    if (!Array.isArray(runs)) continue;
    for (const run of runs) {
      const work = (run as { cite?: { work?: unknown } } | null)?.cite?.work;
      if (typeof work !== "string" || !works.has(work)) continue;
      const ref = nodeRef(work);
      if (!out.includes(ref)) out.push(ref);
    }
  }
  return out;
}
