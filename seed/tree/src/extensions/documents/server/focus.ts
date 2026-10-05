
import { port } from "~/server/port";
import type { ChildFace, ChildPlan, FocusedWorkContribution } from "~/contract";
import { orderBetween } from "~/lib/order";
import { runsText } from "~/lib/runs";
import { properties } from "~/server/ccgw/script";
import type { GraphOutcome } from "~/server/outcome";
import { nodeRef } from "~/server/ccgw/nodes";
import { CONTAINS } from "./assemble";
import { readDocument } from "./documents";
import { DOCUMENT_TYPE } from "./vocabulary";

/**
 * What a `document` child is, for the shell's focused-work capability.
 *
 * Opening a block as its own work root is the frame's (`CA_0065`, user
 * decision 2026-09-23): the `focuses` edge, the one-child rule and the reads
 * are `src/server/focused-work.ts`. What stays here is the
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

/** A child's title: the block's words to the first sentence. User decision,
 * 2026-09-13. */
export function childTitle(blockWords: string): string {
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
  readonly blank?: boolean;
}): Promise<GraphOutcome<ChildPlan>> {
  const parent = await readDocument(input.targetId);
  if (parent.outcome !== "success") return parent as GraphOutcome<never>;
  const block = parent.result.blocks.find((candidate) => candidate.blockId === input.blockId);
  if (block === undefined) return refuse("unknownBlock", `Block ${input.blockId} is not in this document.`);
  if (block.kind !== "text") return refuse("blockKind", `A ${block.kind} block does not open as focused work.`);
  const title = childTitle(runsText(block.runs));
  const documentId = port.uuid();
  const blockId = port.uuid();
  const parameters: Record<string, unknown> = { cd: nodeRef(documentId), cb: nodeRef(blockId) };
  // A child a nest opens holds no block of its own: the dragged block moves
  // in as its first, so the work never starts with an empty one above it.
  // BO_0349_019
  const statements =
    input.blank === true
      ? [`CREATE (d:${DOCUMENT_TYPE} {${properties("d", { id: documentId, title }, parameters)}})`]
      : [
          `CREATE (d:${DOCUMENT_TYPE} {${properties("d", { id: documentId, title }, parameters)}})`,
          `CREATE (b:text {${properties("b", { id: blockId, order: orderBetween("", ""), runs: [] }, parameters)}})`,
          `RELATE cd -[c:${CONTAINS}]-> cb`,
        ];
  if (input.blank === true) {
    delete parameters["cd"];
    delete parameters["cb"];
  }
  return { outcome: "success", result: { itemId: documentId, title, statements, parameters } };
}

/** How many of a child's blocks its face lists, and how far each runs. */
export const FACE_LINES = 5;
const FACE_WORDS = 80;

/** A block's first words as a face lists them: one line, cut. */
export function faceLine(words: string): string {
  const flat = words.replace(/\s+/gu, " ").trim();
  return flat.length > FACE_WORDS ? `${flat.slice(0, FACE_WORDS - 1).trimEnd()}…` : flat;
}

/**
 * What each of these documents says for itself on the block it focuses: its
 * title, and the first words of the blocks it holds, so the parent shows what
 * was put into the work under the block it came from rather than the block's
 * own words again (`calliopa-bootstrap`'s `BO_0349_019`, user decision from the
 * walk, 2026-10-05). An empty block is left out; past `FACE_LINES` the rest is
 * counted. CA_0065_008
 */
async function documentFaces(itemIds: readonly string[]): Promise<GraphOutcome<readonly ChildFace[]>> {
  const faces: ChildFace[] = [];
  for (const itemId of itemIds) {
    const read = await readDocument(itemId);
    if (read.outcome !== "success") continue;
    const said = read.result.blocks
      .map((block) => faceLine(block.kind === "text" ? runsText(block.runs) : ""))
      .filter((line) => line !== "");
    const lines = said.length > FACE_LINES ? [...said.slice(0, FACE_LINES), `+${said.length - FACE_LINES} more`] : said;
    faces.push({ itemId, title: read.result.title, face: null, lines });
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
