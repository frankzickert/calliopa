/**
 * The work Hermes puts forward for the reader (`calliopa-bootstrap`'s
 * `BO_0350_059`): its documents are marked — the tab that holds one, or its
 * library entry while no tab does — and opening one clears its mark for the
 * session. Nothing opens a tab: opening stays the reader's act. Pure, so what
 * is marked is settled without a browser. BO_0350_024
 */

/** The documents to mark: what Hermes puts forward, less what the reader has
 * opened since. */
export const forwardMarked = (forward: readonly string[], seen: readonly string[]): ReadonlySet<string> =>
  new Set(forward.filter((document) => !seen.includes(document)));

/** Whether a library entry carries the mark: its document is marked and no
 * tab holds it, since the tab carries it then. */
export const entryMarked = (marked: ReadonlySet<string>, document: string | null, inTabs: readonly (string | null | undefined)[]): boolean =>
  document !== null && marked.has(document) && !inTabs.includes(document);

/** The documents Hermes puts forward, as the shell's route answers them. */
export function readForward(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null) return [];
  const forward = (value as Record<string, unknown>)["forward"];
  return Array.isArray(forward) ? forward.filter((entry): entry is string => typeof entry === "string" && entry !== "") : [];
}
