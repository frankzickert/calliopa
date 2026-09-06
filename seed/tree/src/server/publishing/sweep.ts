import type postgres from "postgres";

import { supersededObjectIds } from "../production/production";
import { deleteObject, objectKey } from "../object-store";
import { publishedObjectIds } from "./publications";

/**
 * The sweep over bytes nothing needs any more.
 *
 * An object any publication sent is permanent, because a publication must
 * always be able to say what it published. A rendition's bytes are sweepable
 * only when the asset has stopped pointing at it — a newer export superseded it
 * — **and** no log entry names it.
 *
 * It reports before it removes, and removing is a deliberate act rather than a
 * background process: deleting bytes is the one operation here that no undo
 * covers, so it does not happen while nobody is looking.
 */

export interface SweepPlan {
  /** Objects a superseded rendition holds that no publication protects. */
  readonly removable: readonly string[];
  /** Superseded objects a publication sent, which are never removed. */
  readonly protected: readonly string[];
}

export async function planSweep(db: postgres.Sql): Promise<SweepPlan> {
  const superseded = await supersededObjectIds(db);
  const published = await publishedObjectIds(db);

  const removable: string[] = [];
  const kept: string[] = [];
  for (const objectId of [...superseded].sort()) {
    (published.has(objectId) ? kept : removable).push(objectId);
  }
  return { removable, protected: kept };
}

export interface SweepResult extends SweepPlan {
  readonly removed: readonly string[];
}

/**
 * Removes what the plan named. A store with nothing superseded removes nothing,
 * which is the ordinary case and is not an error.
 */
export async function sweep(db: postgres.Sql): Promise<SweepResult> {
  const plan = await planSweep(db);
  const removed: string[] = [];
  for (const objectId of plan.removable) {
    await deleteObject(objectId);
    removed.push(objectId);
  }
  return { ...plan, removed };
}

export { objectKey };
