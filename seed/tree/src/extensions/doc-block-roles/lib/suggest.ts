import type { RoleView } from "./roles";

/**
 * Which roles to suggest for a block (`calliopa-bootstrap`'s `BO_0318_Q3`,
 * folded into `BO_0309_022`): built from the structure and the block's own
 * words, with no model and no cost. A role offered by a role on a block above
 * is ranked by how near the offering block stands; then the block's words
 * are matched against a role's name, its description and its field names, in
 * that weight. At most three roles the block does not carry, and nothing when
 * nothing scores. Pure: computed in the browser when the control opens, and
 * nothing is stored (`BO_0318_Q4`).
 *
 * No dependency on `keywords`, which depends on this extension: the words
 * are lowercased and cut at everything that is not a letter or a digit, and
 * a word matches a role's word when either begins with the other and both
 * have four letters or more, which catches post and posts, or publish and
 * publishing, without a stemmer.
 */

export const SUGGESTIONS = 3;

/** Where a role offered from above comes from: how many steps up the
 * offering block stands, 0 for the nearest. */
export type OfferDistance = ReadonlyMap<string, number>;

/** Words too common to say anything about a role. */
const COMMON = new Set(["the", "and", "for", "with", "that", "this", "from", "our", "your", "its", "are", "was", "has", "have", "not", "but", "all", "any", "can", "into", "what", "when", "which", "who", "how", "der", "die", "das", "und", "mit", "für", "ein", "eine"]);

const tokens = (text: string): readonly string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !COMMON.has(token));

const matches = (word: string, other: string): boolean =>
  word === other ||
  (word.length >= 4 &&
    other.length >= 4 &&
    (word.startsWith(other) || other.startsWith(word)));

/** How many of a role's words the block's words meet, each counted once. */
const overlap = (words: ReadonlySet<string>, text: string): number => {
  let count = 0;
  for (const token of new Set(tokens(text)))
    for (const word of words)
      if (matches(word, token)) {
        count += 1;
        break;
      }
  return count;
};

/**
 * The roles to suggest, by id, best first. `takeable` is the set the block
 * may take (`BO_0309_012`); `distance` how far above each offered role's
 * offering block stands; `taken` the roles the block already carries.
 */
export function suggestRoles(input: {
  readonly roles: readonly RoleView[];
  readonly takeable: readonly string[];
  readonly distance: OfferDistance;
  readonly words: string;
  readonly taken: readonly string[];
}): readonly string[] {
  const words = new Set(tokens(input.words));
  const byId = new Map(input.roles.map((role) => [role.id, role] as const));
  const scored: { id: string; score: number; order: number }[] = [];
  input.takeable.forEach((id, order) => {
    if (input.taken.includes(id)) return;
    const role = byId.get(id);
    if (role === undefined) return;
    const steps = input.distance.get(id);
    // The structure outweighs any word: a role the block above offers is the
    // likeliest, and the nearer the offer the likelier.
    const structure = steps === undefined ? 0 : 100 - Math.min(steps, 50);
    const text =
      words.size === 0
        ? 0
        : overlap(words, role.name) * 6 +
          overlap(words, role.description) * 2 +
          overlap(words, role.fields.map((field) => field.name).join(" "));
    const score = structure + text;
    if (score > 0) scored.push({ id, score, order });
  });
  return scored
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, SUGGESTIONS)
    .map((entry) => entry.id);
}

/**
 * How far above each offered role's offering block stands: `chain` is the
 * roles taken on each block over the block, the nearest first and the
 * document last. A role offered from two places counts the nearer.
 */
export function offerDistance(
  roles: readonly RoleView[],
  chain: readonly (readonly string[])[],
): OfferDistance {
  const byId = new Map(roles.map((role) => [role.id, role] as const));
  const distance = new Map<string, number>();
  chain.forEach((taken, steps) => {
    for (const id of taken)
      for (const offered of byId.get(id)?.offers ?? [])
        if (!distance.has(offered)) distance.set(offered, steps);
  });
  return distance;
}
