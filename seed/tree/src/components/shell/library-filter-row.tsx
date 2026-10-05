import { component$, type QRL } from "@builder.io/qwik";

import type { LibraryFilter, LibraryItem } from "~/contract";
import { facetKey, groupValues, type FilterChoice } from "~/lib/library-filter";
import { Icon } from "./icons";

/**
 * The filter row an item section's funnel reveals (`DO_0038_002`), in the
 * Extensions category's idiom: the search field when the filter searches,
 * per group a row of toggles — one per value the listed items carry, pressed
 * while its rows show — and the order chooser. The shell stores a toggle or
 * an order at once; the typed words stay in the page.
 *
 * The items are passed whole, never as `item.field`, so a re-read listing
 * reaches the toggles (`qwik-member-props-freeze`).
 */
export const LibraryFilterRow = component$<{
  id: string;
  name: string;
  filter: LibraryFilter;
  items: readonly LibraryItem[];
  choice: FilterChoice;
  search: string;
  open: boolean;
  onSearch$: QRL<(search: string) => void>;
  onToggle$: QRL<(group: string, value: string) => void>;
  onOrder$: QRL<(order: string) => void>;
}>((props) => (
  <div id={props.id} class="library-filter" data-library-filter={props.name} hidden={!props.open}>
    {props.filter.search !== undefined && (
      <input
        type="search"
        class="library-filter__search"
        aria-label={props.filter.search}
        placeholder={props.filter.search}
        value={props.search}
        data-filter-search
        onInput$={(_, element) => props.onSearch$(element.value)}
      />
    )}
    {props.filter.groups.map((group) => {
      const values = groupValues(props.items, group.name);
      if (values.length === 0) return null;
      return (
        <div key={group.name} class="library-filter__group" role="group" aria-label={group.label}>
          {values.map((facet) => (
            <button
              key={facet.value}
              type="button"
              class={["library-action", facet.icon === undefined ? "library-filter__word" : "library-action--icon"]}
              aria-label={facet.icon === undefined ? undefined : facet.label}
              title={facet.label}
              aria-pressed={!props.choice.hidden.includes(facetKey(group.name, facet.value))}
              data-filter-value={facetKey(group.name, facet.value)}
              onClick$={() => props.onToggle$(group.name, facet.value)}
            >
              {facet.icon === undefined ? facet.label : <Icon name={facet.icon} />}
            </button>
          ))}
        </div>
      );
    })}
    {props.filter.orders.length > 1 && (
      <select
        class="library-filter__order"
        aria-label="Order"
        data-filter-order
        onChange$={(_, element) => props.onOrder$(element.value)}
      >
        {props.filter.orders.map((order) => (
          <option key={order.id} value={order.id} selected={order.id === props.choice.order}>
            {order.label}
          </option>
        ))}
      </select>
    )}
  </div>
));

/** What an item section's body says when its filter hides every row, with the
 * control that stores the default and empties the search. DO_0038_002 */
export const LibraryNoMatch = component$<{ name: string; words: string; onClear$: QRL<() => void> }>((props) => (
  <div class="library-empty library-no-match" data-library-no-match={props.name}>
    <p>{props.words}</p>
    <button type="button" class="library-action" data-clear-filter={props.name} onClick$={() => props.onClear$()}>
      Clear filter
    </button>
  </div>
));
