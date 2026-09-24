import type { Citation } from "~/lib/runs";

/**
 * What a citation is drawn as (`BO_0291_025`): the work's number in this
 * document, numbered in first-citation order by the read, with its locator —
 * `[3]`, `[3, p. 12]` — the numeric style a document draws whatever the
 * bibliography answers later. A citation whose work is not at the pin draws
 * as words saying so, never as a stale number; one the read has not numbered
 * yet — just written, not yet saved — draws as a placeholder that the next
 * read replaces.
 */
export function citeLabel(cite: Citation, number: number | undefined, missing: boolean): string {
  if (missing) return "[source gone]";
  const locator = cite.locator === undefined || cite.locator.trim() === "" ? "" : `, ${cite.locator.trim()}`;
  return number === undefined ? `[…${locator}]` : `[${number}${locator}]`;
}

/** What a work is called where it is chosen: who, when, what. Local to the
 * editor, which may not import the bibliography's own words. */
export function workLine(record: { readonly title?: unknown; readonly author?: unknown; readonly editor?: unknown; readonly issued?: unknown }): string {
  const names = (Array.isArray(record.author) && record.author.length > 0 ? record.author : Array.isArray(record.editor) ? record.editor : []) as { family?: string; literal?: string }[];
  const who = names.map((name) => name.literal ?? name.family ?? "").filter((name) => name !== "");
  const lead = who.length === 0 ? "" : who.length === 1 ? (who[0] as string) : who.length === 2 ? `${who[0]} and ${who[1]}` : `${who[0]} et al.`;
  const parts = (record.issued as { "date-parts"?: unknown[][] } | undefined)?.["date-parts"]?.[0]?.[0];
  const year = parts === undefined ? "" : String(parts);
  const title = typeof record.title === "string" ? record.title : "";
  const head = [lead, year !== "" ? `(${year})` : ""].filter((part) => part !== "").join(" ");
  return head === "" ? title : `${head} — ${title}`;
}
