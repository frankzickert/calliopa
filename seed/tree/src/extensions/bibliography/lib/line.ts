import type { WorkRecord } from "./work";

/** A work as a person names it where it is chosen or hovered: who, when, what. */
export function workLineOf(record: Pick<WorkRecord, "title" | "author" | "editor" | "issued">): string {
  const names = (record.author !== undefined && record.author.length > 0 ? record.author : (record.editor ?? [])).map((name) => name.literal ?? name.family ?? "").filter((name) => name !== "");
  const lead = names.length === 0 ? "" : names.length === 1 ? (names[0] as string) : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} et al.`;
  const part = record.issued?.["date-parts"]?.[0]?.[0];
  const year = part === undefined ? "" : String(part);
  const head = [lead, year !== "" ? `(${year})` : ""].filter((piece) => piece !== "").join(" ");
  return head === "" ? record.title : `${head} — ${record.title}`;
}
