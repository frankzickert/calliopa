import type { BlockView } from "../server/assemble";
import type { SentRun } from "../lib/command-choices";
import type { ProposalRow } from "./reading-order";
import { SWIPEABLE_PROPOSALS } from "./block-swipe";

/**
 * The card (BO_0350_001): an open proposal group is one decision, and the rows
 * it draws next to each other are drawn and answered as one card. Pure, so
 * which rows make a card is settled without a browser.
 *
 * A card is the rows a swipe may answer — a rewrite, an insert, a move or a
 * gather — of one group, drawn next to each other. Any other row between them
 * ends the card; a group the reading order splits is a card in each place, and
 * a swipe on any of them answers the whole group. A card is folded unless the
 * reader unfolded it, which a pinch in does and a pinch out undoes
 * (BO_0350_003); unfolded, each row is answered on its own, as items are.
 */

export type CardEdge = "only" | "first" | "middle" | "last";

export interface CardPlace {
  readonly group: string;
  readonly edge: CardEdge;
  readonly folded: boolean;
  /** Which card of the group this is, counted in reading order: a group the
   * reading order splits is a card in each place, each answered on its own.
   * BO_0351_024 */
  readonly segment: number;
}

const cardable = (row: ProposalRow): row is Extract<ProposalRow, { kind: "proposal" }> =>
  row.kind === "proposal" && SWIPEABLE_PROPOSALS.includes(row.item.kind) && row.item.elsewhere !== true;

/** Each card row's place in its card, by item. A row not in the map is no
 * card's. */
export function cardPlaces(rows: readonly ProposalRow[], unfolded: readonly string[]): ReadonlyMap<string, CardPlace> {
  const places = new Map<string, CardPlace>();
  const segments = new Map<string, number>();
  let run: Extract<ProposalRow, { kind: "proposal" }>[] = [];
  const close = () => {
    const group = run[0]?.item.groupId;
    if (group === undefined) return;
    const segment = segments.get(group) ?? 0;
    segments.set(group, segment + 1);
    run.forEach((row, index) => {
      const edge: CardEdge =
        run.length === 1 ? "only" : index === 0 ? "first" : index === run.length - 1 ? "last" : "middle";
      places.set(row.item.itemId, { group, edge, folded: !unfolded.includes(group), segment });
    });
    run = [];
  };
  for (const row of rows) {
    if (!cardable(row)) {
      close();
      continue;
    }
    if (run.length > 0 && run[0]?.item.groupId !== row.item.groupId) close();
    run.push(row);
  }
  close();
  return places;
}

/** The group a pinch, a key or a swipe on a row reaches, when the row is a
 * card's: read from the row's own attribute, so the adapters outside Qwik ask
 * the DOM nothing else. */
export const CARD_GROUP = "data-card-group";
export const CARD_FOLDED = "data-card-folded";

/** The items of the card an item stands in: its group's items in the same
 * place, which a swipe or Delete on the card answers together. BO_0351_024 */
export function cardItems(places: ReadonlyMap<string, CardPlace>, itemId: string): readonly string[] {
  const place = places.get(itemId);
  if (place === undefined) return [itemId];
  return [...places].filter(([, other]) => other.group === place.group && other.segment === place.segment).map(([id]) => id);
}

/** What a pinch or a key does to a card: in unfolds it, out folds it. */
export function refold(unfolded: readonly string[], group: string, zoom: "in" | "out"): readonly string[] {
  if (zoom === "in") return unfolded.includes(group) ? unfolded : [...unfolded, group];
  return unfolded.filter((held) => held !== group);
}

/** How many characters of a block a card quotes when it names where its
 * command was given. */
const QUOTED = 32;

const firstWords = (block: BlockView | undefined): string => {
  if (block === undefined || !("runs" in block)) return "";
  const text = (block.runs ?? []).map((run) => run.text).join("").trim().replace(/\s+/gu, " ");
  return text.length > QUOTED ? `${text.slice(0, QUOTED - 1)}…` : text;
};

/**
 * What a card names its run by (BO_0350_013): the first line of the command
 * that made it, and the block the command was given from, by its first words.
 * Null for a group no run of this document's list staged — a person's own
 * proposal, or a run the list no longer holds.
 */
export function cardOrigin(groupId: string, runs: readonly SentRun[], blocks: readonly BlockView[]): string | null {
  const run = runs.find((candidate) => candidate.group === groupId);
  const command = run?.goal?.trim().split("\n")[0]?.trim() ?? "";
  if (run === undefined || command === "") return null;
  const from = firstWords(blocks.find((block) => block.blockId === run.source));
  return from === "" ? command : `${command} — from “${from}”`;
}
