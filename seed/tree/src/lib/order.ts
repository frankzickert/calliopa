/** Fractional order keys for sibling blocks.
 *
 * A key is a base-36 string compared as an ordinary string, so a key can
 * always be minted strictly between two siblings and one block is written
 * rather than the whole set. Ordering lives on the child block because a
 * relation carries no properties.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
/** The digit a key ends on when neither bound leaves room, and the value
 * `orderBetween('', '')` opens a document with. Mid-alphabet so the first
 * insertion on either side still has depth to work with. */
const MIDPOINT = Math.floor(BASE / 2);

/** Whether a string is a well-formed key. The empty string is not a key; it is
 * how a caller says "no bound on that side". */
export function isOrderKey(value: string): boolean {
  return (
    value.length > 0 &&
    [...value].every((character) => DIGITS.includes(character))
  );
}

function digitAt(key: string, index: number): number {
  return index < key.length ? DIGITS.indexOf(key.charAt(index)) : 0;
}

function requireBound(value: string, name: string): void {
  if (value !== "" && !isOrderKey(value)) {
    throw new RangeError(
      `${name} order key ${JSON.stringify(value)} is not a base-36 order key`,
    );
  }
}

/**
 * A key strictly between `before` and `after`. Either bound may be the empty
 * string, meaning no bound on that side, so `orderBetween('', '')` opens a
 * document, `orderBetween(last, '')` appends, and `orderBetween('', first)`
 * inserts ahead of everything.
 *
 * Refuses rather than returning a key that would not sort where the caller
 * asked for it: bounds that are equal or the wrong way round, a bound that is
 * not a key, and the case where the alphabet leaves no room beneath `after`.
 */
export function orderBetween(before: string, after: string): string {
  requireBound(before, "lower");
  requireBound(after, "upper");
  if (after !== "" && before !== "" && before >= after) {
    throw new RangeError(
      `lower order key ${JSON.stringify(before)} does not sort before upper order key ${JSON.stringify(after)}`,
    );
  }

  let prefix = "";
  for (let index = 0; ; index++) {
    const low = digitAt(before, index);
    const high = index < after.length ? digitAt(after, index) : BASE;
    if (low + 1 < high) {
      // Room between the two digits: take the midpoint and stop.
      return prefix + DIGITS.charAt(Math.floor((low + high) / 2));
    }
    if (index >= before.length && index >= after.length) {
      // Both bounds exhausted without room, which only happens for adjacent
      // keys. Extending is always available, because keys are strings.
      return prefix + DIGITS.charAt(MIDPOINT);
    }
    // No room at this digit, so keep it and look one deeper. Following
    // `before` is what keeps the result greater than it.
    prefix += DIGITS.charAt(low);
    if (after !== "" && prefix >= after) {
      // Only reachable when `after` is a run of zeroes, which nothing beneath
      // it can undercut: no digit sorts below '0'.
      throw new RangeError(`no order key sorts below ${JSON.stringify(after)}`);
    }
  }
}

/** Siblings in ascending key order, which is ordinary string order. Returns a
 * new array and keeps the given order among equal keys. */
export function byOrder<T extends { order: string }>(
  blocks: readonly T[],
): T[] {
  return [...blocks].sort((left, right) =>
    left.order < right.order ? -1 : left.order > right.order ? 1 : 0,
  );
}
