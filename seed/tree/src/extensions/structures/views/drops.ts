import type { DecorationDrop } from "~/contract";
import { APPLY_A_STRUCTURE } from "~/extensions/documents/lib/instruction";

import type { DocumentStructuresView } from "../lib/structures";
import { announce, detailOf, type Answer } from "./provider";

/**
 * The structure a drop just used, to open on its fields once the editor reads
 * the document again (`BO_0349_037`): taken by the provider of that document,
 * once, so its unfilled required fields are the next thing to do. A value
 * kept in this module rather than an event, since the provider reads it on the
 * read the drop already causes.
 */
let pendingOpening: { readonly documentId: string; readonly subject: string; readonly structure: string } | null = null;

/** Takes the opening a drop left for this document, if any: on one of its
 * blocks for the provider, on the document itself for the title's control. */
export function takeOpening(documentId: string, onDocument: boolean): { readonly subject: string; readonly structure: string } | null {
  if (pendingOpening === null || pendingOpening.documentId !== documentId) return null;
  if ((pendingOpening.subject === "") !== onDocument) return null;
  const opening = { subject: pendingOpening.subject, structure: pendingOpening.structure };
  pendingOpening = null;
  return opening;
}

/** The kind a structure dragged out of the *Structures* sheet carries
 * (`calliopa-bootstrap`'s `BO_0349_002`). */
export const STRUCTURE_DRAG_KIND = "structures:structure";

/** The kind an instruction listed under *Instruction* carries when dragged:
 * `instructions` knows it, and stands the instruction where it lands
 * (`BO_0349_011`). Named here as a word, since this extension does not depend
 * on `instructions`. */
export const INSTRUCTION_DRAG_KIND = "instructions:instruction";

/**
 * A structure dropped on a block's middle or a document's header is used
 * there (`BO_0349_011`, `BO_0349_025`): taken as the person's truth at once,
 * through the same route the typeahead takes it by, so a structure the subject
 * may not use where it stands is refused with the route's own reason. The
 * document's structures it answers are announced, so every control and pill
 * on the page draws them. The refusal in words, or null.
 */
export async function useDroppedStructure(drop: DecorationDrop): Promise<string | null> {
  // Between the rows the structure is applied by a run, not used
  // (BO_0349_012); on a marked passage, to those words alone (BO_0349_038).
  if (drop.body === true || drop.passage !== undefined) return applyDroppedStructure(drop);
  const subject = `/api/x/structures/documents/${encodeURIComponent(drop.documentId)}${
    drop.blockId === undefined ? "" : `/blocks/${encodeURIComponent(drop.blockId)}`
  }`;
  const response = await fetch(`${subject}/structures`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ structure: drop.itemId, taken: true }),
  }).catch(() => null);
  if (response === null) return "The server could not be reached.";
  const answer = (await response.json().catch(() => ({ outcome: "refused" }))) as Answer & { result?: DocumentStructuresView };
  if (response.ok && answer.outcome === "success" && answer.result !== undefined) {
    // The structure opens on its fields once the editor has read the
    // document again with the block edited. BO_0349_037
    pendingOpening = { documentId: drop.documentId, subject: drop.blockId ?? "", structure: drop.itemId };
    announce(answer.result, typeof document === "undefined" ? null : document);
    return null;
  }
  return detailOf(answer, response.status);
}

/**
 * A structure dropped on a document's body, between its rows, is applied to
 * the whole document (`BO_0349_012`): a run under *Apply a structure* proposes
 * the structure on the document with the values its words hold, answered
 * where every proposal is. #1 is the structure's document.
 */
export async function applyDroppedStructure(drop: DecorationDrop): Promise<string | null> {
  if (drop.startRun === undefined) return "This view cannot start a run.";
  const passage = drop.passage;
  return drop.startRun(
    passage === undefined
      ? {
          goal: "Apply the structure #1 to this document: propose it with the values the document's words hold.",
          instruction: APPLY_A_STRUCTURE,
          references: [{ number: 1, kind: "document", document: drop.itemId }],
        }
      : {
          goal: "Apply the structure #1 to the passage #2 alone: propose it on the block holding #2, with the values #2's words hold.",
          instruction: APPLY_A_STRUCTURE,
          references: [
            { number: 1, kind: "document", document: drop.itemId },
            { number: 2, kind: "passage", blockId: passage.blockId, quote: passage.quote },
          ],
        },
  );
}
