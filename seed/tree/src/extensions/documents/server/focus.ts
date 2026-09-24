import { randomUUID } from "node:crypto";

import type { ChildFace, ChildPlan, FocusedWorkContribution } from "~/contract";
import { orderBetween } from "~/lib/order";
import { runsText, type Run } from "~/lib/runs";
import { properties } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { nodeRef } from "~/server/ccgw/nodes";
import { CONTAINS, type BlockView } from "./assemble";
import { readDocument } from "./documents";
import { readClaims } from "./work";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * What a `document` child is, for the shell's focused-work capability.
 *
 * Opening a block as its own work root is the frame's (`CA_0065`, user
 * decision 2026-09-23): the `focuses` edge, the one-child rule, the reads and
 * the retarget are `src/server/focused-work.ts`. What stays here is the
 * vocabulary — a child of a `document` is a `document` with a first `text`
 * block it `contains`, and its title is this extension's rule — planned as
 * statements the shell commits with the edge in one script, never committed
 * here. CA_0065_008
 */

/** The qualified target kind a document tab carries, which the shell reaches
 * this contribution by. */
export const DOCUMENT_TARGET_KIND = "documents:document";

const refuse = <T>(rule: string, detail: string): GraphOutcome<T> => ({
  outcome: "validationFailure",
  failures: [{ operation: null, rule, detail }],
});

/** A child's title: the one claim the block asserts when it asserts exactly
 * one, else the block's words to the first sentence. User decision,
 * 2026-09-13. */
export function childTitle(blockWords: string, claims: readonly { readonly text: readonly Run[] }[]): string {
  if (claims.length === 1) {
    const claim = runsText(claims[0]?.text ?? []).trim();
    if (claim !== "") return claim;
  }
  const sentence = /^(.*?[.!?])(\s|$)/u.exec(blockWords.trim());
  const words = (sentence?.[1] ?? blockWords).trim();
  return words === "" ? "Focused work" : words;
}

/**
 * The child a block of a document would open as: a document of its own with
 * one empty text block, titled by the rule above. A block this extension
 * cannot open as a work root is refused in words — the shell shows the
 * refusal and writes nothing. CA_0065_008
 */
async function planDocumentChild(input: {
  readonly targetId: string;
  readonly blockId: string;
}): Promise<GraphOutcome<ChildPlan>> {
  const parent = await readDocument(input.targetId);
  if (parent.outcome !== "success") return parent as GraphOutcome<never>;
  const block = parent.result.blocks.find((candidate) => candidate.blockId === input.blockId);
  if (block === undefined) return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  if (block.kind !== "text") return refuse("blockKind", `A ${block.kind} block does not open as focused work.`);
  const claims = await readClaims([input.blockId]);
  if (claims.outcome !== "success") return claims as GraphOutcome<never>;
  const title = childTitle(runsText(block.runs), claims.result.byBlock[input.blockId] ?? []);
  const documentId = randomUUID();
  const blockId = randomUUID();
  const parameters: Record<string, unknown> = { cd: nodeRef(documentId), cb: nodeRef(blockId) };
  const statements = [
    `CREATE (d:${DOCUMENT_TYPE} {${properties("d", { id: documentId, title }, parameters)}})`,
    `CREATE (b:text {${properties("b", { id: blockId, order: orderBetween("", ""), runs: [] }, parameters)}})`,
    `RELATE cd -[c:${CONTAINS}]-> cb`,
  ];
  return { outcome: "success", result: { itemId: documentId, title, statements, parameters } };
}

/**
 * What each of these documents says for itself on the block it focuses: its
 * title and its `synthesis` block's words when it holds one. CA_0065_008
 */
async function documentFaces(itemIds: readonly string[]): Promise<GraphOutcome<readonly ChildFace[]>> {
  const faces: ChildFace[] = [];
  for (const itemId of itemIds) {
    const read = await readDocument(itemId);
    if (read.outcome !== "success") continue;
    const synthesis = read.result.blocks.find(
      (block) => block.kind === "text" && block.blockKind === "synthesis",
    ) as (BlockView & { kind: "text" }) | undefined;
    faces.push({
      itemId,
      title: read.result.title,
      face: synthesis === undefined ? null : synthesis.runs,
    });
  }
  return { outcome: "success", result: faces };
}

/** The blocks a document holds, in reading order. CA_0065_003 */
async function documentBlocks(targetId: string): Promise<GraphOutcome<readonly string[]>> {
  const read = await readDocument(targetId);
  if (read.outcome !== "success") return read as GraphOutcome<never>;
  return { outcome: "success", result: read.result.blocks.map((block) => block.blockId) };
}

/** What this extension contributes for its one target kind. CA_0065_008 */
export const documentFocusedWork: FocusedWorkContribution = {
  childType: DOCUMENT_TYPE,
  plan: planDocumentChild,
  faces: documentFaces,
  blocksOf: documentBlocks,
};
