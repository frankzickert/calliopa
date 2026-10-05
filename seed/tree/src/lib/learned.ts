/**
 * What Hermes learned of the reader (`calliopa-bootstrap`'s `BO_0350_062`),
 * as the right panel's category reads it: one row for each conclusion, newest
 * first, and whether the memory is on at all. Pure, so what the category
 * draws is settled without a browser. BO_0350_023
 */

export interface Learned {
  readonly id: string;
  readonly words: string;
  readonly at: string;
}

export interface LearnedRead {
  readonly memory: "on" | "off";
  readonly learned: readonly Learned[];
}

export const NOTHING_LEARNED: LearnedRead = { memory: "off", learned: [] };

/** The kernel's answer, or the memory off when it says nothing readable. */
export function readLearned(value: unknown): LearnedRead {
  if (typeof value !== "object" || value === null) return NOTHING_LEARNED;
  const body = value as Record<string, unknown>;
  const rows = Array.isArray(body["learned"]) ? body["learned"] : [];
  const learned = rows.flatMap((row): Learned[] => {
    if (typeof row !== "object" || row === null) return [];
    const entry = row as Record<string, unknown>;
    return typeof entry["id"] === "string" && entry["id"] !== "" && typeof entry["words"] === "string"
      ? [{ id: entry["id"], words: entry["words"], at: typeof entry["at"] === "string" ? entry["at"] : "" }]
      : [];
  });
  return { memory: body["memory"] === "on" ? "on" : "off", learned };
}

/** How far a row travels left before its release erases it, as a share of
 * its width; less springs back. */
export const ERASE_SHARE = 0.35;

/** Whether a horizontal release on a row of this width erases it: a left
 * swipe past the share. A right swipe never erases. */
export const erasesAt = (dx: number, width: number): boolean => width > 0 && dx < 0 && -dx >= width * ERASE_SHARE;

/** When a conclusion was formed, as the row says it: the day, or nothing. */
export const learnedOn = (at: string): string => (/^\d{4}-\d{2}-\d{2}/u.test(at) ? at.slice(0, 10) : "");
