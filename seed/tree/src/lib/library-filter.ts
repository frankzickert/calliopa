import type { LibraryFacet, LibraryFilter, LibraryItem } from "~/contract";

/**
 * The pure rules behind the filter an item section declares (`LibraryFilter`):
 * the choice read back from the section's stored set, the set a choice is
 * stored as, a toggle, the values the listed items carry, and the rows a
 * choice and a search keep, in its order. Settled without a page, so the
 * drawer's shape is provable on its own. DO_0038_001
 *
 * The stored set is in the section's own vocabulary: each value hidden as
 * `<group>:<value>` and the order as `order:<id>`. A hidden value no item
 * carries any more is kept, since the item that carried it may come back;
 * an order the filter no longer declares reads as its default.
 */

export interface FilterChoice {
  /** The values hidden, as `<group>:<value>`. */
  readonly hidden: readonly string[];
  readonly order: string;
}

const ORDER = "order:";

export const facetKey = (group: string, value: string): string => `${group}:${value}`;

/** The choice a stored set carries, or the default when nothing was stored. */
export function filterChoiceOf(filter: LibraryFilter, stored: readonly string[] | null | undefined): FilterChoice {
  if (stored === null || stored === undefined) return defaultChoice(filter);
  const named = stored.filter((value) => value.startsWith(ORDER)).map((value) => value.slice(ORDER.length));
  const order = named.find((id) => filter.orders.some((candidate) => candidate.id === id)) ?? filter.defaultOrder;
  const hidden = stored.filter((value) => !value.startsWith(ORDER));
  return { hidden: [...new Set(hidden)], order };
}

export function defaultChoice(filter: LibraryFilter): FilterChoice {
  return { hidden: [...(filter.defaultHidden ?? [])], order: filter.defaultOrder };
}

/** The set a choice is stored as. */
export function storedChoice(choice: FilterChoice): readonly string[] {
  return [...choice.hidden, `${ORDER}${choice.order}`];
}

/** Whether a choice differs from the default, which is when the funnel reads as
 * active. The order of the hidden values does not matter; membership does. */
export function isDefaultChoice(filter: LibraryFilter, choice: FilterChoice): boolean {
  const fallback = defaultChoice(filter);
  return (
    choice.order === fallback.order &&
    choice.hidden.length === fallback.hidden.length &&
    fallback.hidden.every((value) => choice.hidden.includes(value))
  );
}

/** The choice with one value shown or hidden. */
export function toggleFacet(choice: FilterChoice, group: string, value: string): FilterChoice {
  const key = facetKey(group, value);
  return {
    ...choice,
    hidden: choice.hidden.includes(key) ? choice.hidden.filter((candidate) => candidate !== key) : [...choice.hidden, key],
  };
}

/** The values the listed items carry for one group, each once, by label. */
export function groupValues(items: readonly LibraryItem[], group: string): readonly LibraryFacet[] {
  const seen = new Map<string, LibraryFacet>();
  for (const item of items) {
    const facet = item.facets?.[group];
    if (facet !== undefined && !seen.has(facet.value)) seen.set(facet.value, facet);
  }
  return [...seen.values()].sort((left, right) => compareLabels(left.label, right.label));
}

/** The words of a search, lowercased; an empty search has none. */
const searchWords = (search: string): readonly string[] =>
  search.toLowerCase().split(/\s+/u).filter((word) => word !== "");

/** Labels compare as the Documents listing does: case-insensitively by code unit. */
function compareLabels(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The rows the choice and the search keep, in the choice's order. The sort is
 * stable over the order the reader answered, so rows the order ties keep it. */
export function applyFilter(
  filter: LibraryFilter,
  choice: FilterChoice,
  search: string,
  items: readonly LibraryItem[],
): readonly LibraryItem[] {
  const words = filter.search === undefined ? [] : searchWords(search);
  const kept = items.filter((item) => {
    for (const group of filter.groups) {
      const facet = item.facets?.[group.name];
      if (facet !== undefined && choice.hidden.includes(facetKey(group.name, facet.value))) return false;
    }
    const label = item.label.toLowerCase();
    return words.every((word) => label.includes(word));
  });
  const order = filter.orders.find((candidate) => candidate.id === choice.order);
  if (order === undefined) return kept;
  const id = order.id;
  const key = (item: LibraryItem): number | undefined => item.orderKeys?.[id];
  return [...kept].sort((left, right) => {
    switch (order.by) {
      case "label-ascending":
        return compareLabels(left.label, right.label);
      case "label-descending":
        return compareLabels(right.label, left.label);
      default: {
        const a = key(left);
        const b = key(right);
        if (a === undefined || b === undefined) return a === undefined ? (b === undefined ? 0 : 1) : -1;
        return order.by === "key-descending" ? b - a : a - b;
      }
    }
  });
}

/** What the filter row asks for: a value shown or hidden, an order, or the
 * default back. DO_0038_002 */
export type FilterChange =
  | { readonly toggle: readonly [group: string, value: string] }
  | { readonly order: string }
  | { readonly clear: true };

/** The set stored after a change to the choice the section's stored set carries. */
export function changedFilter(
  filter: LibraryFilter,
  stored: readonly string[] | null | undefined,
  change: FilterChange,
): readonly string[] {
  const current = filterChoiceOf(filter, stored);
  const next =
    "clear" in change
      ? defaultChoice(filter)
      : "toggle" in change
        ? toggleFacet(current, change.toggle[0], change.toggle[1])
        : { ...current, order: change.order };
  return storedChoice(next);
}
