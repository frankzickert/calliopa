/**
 * What Hermes arranged on a document for the person reading it
 * (`calliopa-bootstrap`'s `BO_0350_054`): the cards drawn and their order, the
 * blocks collapsed and dimmed, and the documents put forward. Presentation
 * only: nothing here changes a document's order or words. Pure, so which
 * groups a document draws is settled without a browser. BO_0350_005
 */

export interface Arrangement {
  /** Whether Hermes arranged this document at all. */
  readonly arranged: boolean;
  readonly cards: readonly string[];
  readonly collapsed: readonly string[];
  readonly dimmed: readonly string[];
  readonly forward: readonly string[];
}

export const NO_ARRANGEMENT: Arrangement = { arranged: false, cards: [], collapsed: [], dimmed: [], forward: [] };

/** One screen of decisions: the cards a document draws at most when nothing
 * was arranged, as many as an arrangement may hold. */
export const CARDS_AT_MOST = 7;

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry !== "") : [];

/** An arrangement as the kernel answers it, or none. */
export function readArrangementBody(value: unknown): Arrangement {
  if (typeof value !== "object" || value === null) return NO_ARRANGEMENT;
  const body = value as Record<string, unknown>;
  return {
    arranged: body["arranged"] === true,
    cards: strings(body["cards"]),
    collapsed: strings(body["collapsed"]),
    dimmed: strings(body["dimmed"]),
    forward: strings(body["forward"]),
  };
}

export interface GroupStanding {
  readonly groupId: string;
  readonly deferred?: boolean;
}

/**
 * Which groups a document draws, of those shown (BO_0350_005, BO_0350_007):
 * the ones the arrangement names, in its order, or with none arranged the
 * first seven in the order they stand; a group the reader showed on their own
 * — a chip pressed, their own run staging — whatever the arrangement says. A
 * deferred group leaves the flow, and *Show proposed changes* draws it.
 */
export function drawnGroups(
  groups: readonly GroupStanding[],
  shown: (groupId: string) => boolean,
  chosen: readonly string[],
  proposalsOpen: boolean,
  arrangement: Arrangement,
): ReadonlySet<string> {
  const drawn = new Set<string>();
  const flowing = groups.filter((group) => shown(group.groupId) && group.deferred !== true);
  const capped = arrangement.arranged
    ? arrangement.cards.filter((card) => flowing.some((group) => group.groupId === card))
    : flowing.slice(0, CARDS_AT_MOST).map((group) => group.groupId);
  for (const card of capped) drawn.add(card);
  for (const group of flowing) if (chosen.includes(group.groupId)) drawn.add(group.groupId);
  if (proposalsOpen) for (const group of groups) if (group.deferred === true && shown(group.groupId)) drawn.add(group.groupId);
  return drawn;
}
