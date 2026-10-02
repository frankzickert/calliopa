import { runsPoints, type Run } from "~/lib/runs";

/**
 * Inline triggers (`calliopa-bootstrap`'s `BO_0310_011`): a character an
 * extension registers — `@` for keywords — which, typed in the words of a
 * block being edited at the start or after a space or an opening bracket,
 * opens a list of what the extension offers for the words typed after it.
 * Choosing replaces the character and the words with the run the extension
 * answers. `#` stays the editor's own. Pure, so where a pending trigger
 * begins and what it offers is settled without an editor.
 */

/** One thing a trigger offers: an identity, what the list shows, and the
 * names the words typed are matched against. */
export interface TriggerEntry {
  readonly id: string;
  readonly label: string;
  readonly names: readonly string[];
  readonly detail?: string;
}

/** A trigger being typed before the caret: where its character stands, in the
 * points the editor counts (an atom one each), and the words after it. */
export interface PendingTrigger {
  readonly character: string;
  readonly start: number;
  readonly typed: string;
}

/** The longest words a trigger reads after its character. */
const WORDS = 60;

const escaped = (character: string): string => character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * The trigger being typed at the caret, for one of the registered characters:
 * the character at the start of the words or after whitespace, an opening
 * bracket or an atom, then words running to the caret — several, since a
 * keyword may be named by more than one — with no line break, no second
 * trigger character and no two spaces in a row.
 */
export function pendingTrigger(runs: readonly Run[], caret: number, characters: readonly string[]): PendingTrigger | null {
  if (characters.length === 0) return null;
  const points = [...runsPoints(runs)];
  const before = points.slice(0, caret).join("");
  const set = characters.map(escaped).join("");
  const match = new RegExp(`(^|[\\s(\\[\\uFFFC])([${set}])([^\\n\\uFFFC${set}]{0,${WORDS}})$`, "u").exec(before);
  if (match === null) return null;
  const character = match[2] ?? "";
  const typed = match[3] ?? "";
  if (/\s\s/u.test(typed) || /^\s/u.test(typed)) return null;
  return { character, start: [...before].length - [...typed].length - 1, typed };
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");

/**
 * The entries holding every word typed, each at the start of one of their
 * names' words, in the order given; every entry while nothing is typed.
 */
export function matchingEntries(entries: readonly TriggerEntry[], typed: string): readonly TriggerEntry[] {
  const asked = words(typed);
  if (asked.length === 0) return entries;
  return entries.filter((entry) =>
    entry.names.some((name) => {
      const held = words(name);
      return asked.every((word) => held.some((candidate) => candidate.startsWith(word)));
    }),
  );
}

/**
 * Whether the list offers to create an entry for the words typed: when words
 * were typed and no entry is named exactly by them. A pending trigger whose
 * words hold a space and match nothing is ordinary writing that followed the
 * character, and draws no list at all.
 */
export function offersCreate(entries: readonly TriggerEntry[], matched: readonly TriggerEntry[], typed: string): boolean {
  const asked = typed.trim();
  if (asked === "") return false;
  if (matched.length === 0 && /\s/u.test(asked)) return false;
  const exact = asked.toLowerCase();
  return !entries.some((entry) => entry.names.some((name) => name.trim().toLowerCase() === exact));
}
