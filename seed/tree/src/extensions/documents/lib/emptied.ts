import type { EmptiedWork } from "~/components/shell/view-bridge";

/**
 * A focused work a write emptied, read off the write's answer, and how the
 * block that left it goes back (`CA_0083`). The server answers `emptied`
 * beside the write when the write took the last standing block out of a
 * focused work and the shell removed it (`server/api.ts`, `emptiedBy`).
 */

/** Nothing to put back: the focused work went by an answer to a proposal,
 * which names no block the reader moved. */
export const NOTHING_LEFT: EmptiedWork["left"] = { blockIds: [], wentTo: null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What went, when the write's answer says a focused work did; `null`
 * otherwise. CA_0083_005 */
export function emptiedOf(outcome: { readonly outcome: string; readonly result?: unknown }): Omit<EmptiedWork, "left"> | null {
  if (outcome.outcome !== "success" || !isRecord(outcome.result)) return null;
  const emptied = outcome.result["emptied"];
  if (!isRecord(emptied)) return null;
  const { itemId, blockId, parent, kept } = emptied;
  if (typeof itemId !== "string" || typeof blockId !== "string" || !isRecord(kept)) return null;
  const named =
    isRecord(parent) && typeof parent["itemId"] === "string" && typeof parent["title"] === "string"
      ? { itemId: parent["itemId"], title: parent["title"] }
      : null;
  return { itemId, blockId, parent: named, kept };
}

/** The blocks a structural command took out of a document, and where they
 * went: removed, or moved into `documentId` from the one they left.
 * CA_0083_006 */
export function leftBy(command: Record<string, unknown>, documentId: string): EmptiedWork["left"] {
  switch (command["command"]) {
    case "retire":
      return typeof command["blockId"] === "string" ? { blockIds: [command["blockId"]], wentTo: null } : NOTHING_LEFT;
    case "retireBlocks": {
      const blocks = Array.isArray(command["blocks"]) ? command["blocks"] : [];
      const blockIds = blocks.flatMap((block: unknown) => (isRecord(block) && typeof block["blockId"] === "string" ? [block["blockId"]] : []));
      return { blockIds, wentTo: null };
    }
    case "moveIn":
      return typeof command["blockId"] === "string" ? { blockIds: [command["blockId"]], wentTo: documentId } : NOTHING_LEFT;
    default:
      return NOTHING_LEFT;
  }
}
