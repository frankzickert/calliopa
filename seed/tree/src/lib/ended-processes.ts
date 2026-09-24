import type { FollowedRun } from "./followed-runs";
import { isTerminal, type ProcessRecord } from "./process";

/**
 * The processes that ended for a document since the poll last looked, so the
 * view showing that document reads what they proposed. A process of any kind
 * — a sender's, a system run's, a run started in another session — since the
 * record alone says that it ended and which document it was for. A run this
 * session follows is left out: it tells its own end from its events
 * (`BO_0226_007`). A process without an item, one still going and one told
 * already answer nothing. Pure, so the shell and its tests cannot disagree.
 * CA_0063_001
 */
export interface EndedForDocuments {
  /** Every process told so far, the newly ended ones appended in the poll's order. */
  readonly announced: readonly string[];
  /** The documents to raise the proposed signal for, in the poll's order, each once. */
  readonly itemIds: readonly string[];
}

export function endedForDocuments(
  items: readonly Pick<ProcessRecord, "id" | "state" | "itemId" | "runId">[],
  announced: readonly string[],
  followed: readonly Pick<FollowedRun, "id">[],
): EndedForDocuments {
  const told = [...announced];
  const itemIds: string[] = [];
  for (const item of items) {
    if (item.itemId === null || !isTerminal(item.state) || told.includes(item.id)) continue;
    if (item.runId !== undefined && item.runId !== "" && followed.some((run) => run.id === item.runId)) continue;
    told.push(item.id);
    if (!itemIds.includes(item.itemId)) itemIds.push(item.itemId);
  }
  return { announced: told, itemIds };
}
