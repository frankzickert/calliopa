import { $, component$, useStore } from "@builder.io/qwik";

import type { LibraryFilter, LibraryItem, OpenTarget } from "~/contract";
import type { Layout } from "~/lib/layout";
import { applyFilter, changedFilter, filterChoiceOf, isDefaultChoice, type FilterChange } from "~/lib/library-filter";
import { LibraryFilterRow, LibraryNoMatch } from "../library-filter-row";
import { LibraryRow } from "../library-row";
import { SectionHeader } from "../panel";

const KEY = "documents:documents";

/**
 * An item section with a filter wired in real JSX the way the shell wires it:
 * the header's funnel, the filter row, the rows the choice and the search
 * keep, and the no-match line, the choice stored in the layout's `filters`
 * and the search kept in the page. The listing arrives after the section is
 * drawn, as a re-read does. Test support, imported by
 * `library-filter.test.ts` and nothing that ships. DO_0038_002
 */
export const LibraryFilterHost = component$<{
  filter: LibraryFilter;
  items: readonly LibraryItem[];
  stored?: readonly string[];
}>((props) => {
  const layout = useStore<Layout>({
    left: { shown: true, icon: null },
    right: { shown: false, icon: null },
    sections: {},
    filters: props.stored === undefined ? {} : { [KEY]: [...props.stored] },
    libraryOrder: [],
  });
  const state = useStore({ items: [] as LibraryItem[], open: false, search: "" });
  const choose$ = $((change: FilterChange) => {
    if ("clear" in change) state.search = "";
    layout.filters = { ...layout.filters, [KEY]: [...changedFilter(props.filter, layout.filters[KEY] ?? null, change)] };
  });
  const choice = filterChoiceOf(props.filter, layout.filters[KEY] ?? null);
  const shown = applyFilter(props.filter, choice, state.search, state.items);
  const filtered = !isDefaultChoice(props.filter, choice) || state.search.trim() !== "";
  return (
    <div>
      <button type="button" data-load onClick$={() => (state.items = [...props.items])}>
        load
      </button>
      <SectionHeader
        layout={layout}
        sectionKey={KEY}
        name="documents"
        elementId="library-documents"
        title="Documents"
        collapsible={false}
        createLabel="New document"
        onToggle$={$(() => undefined)}
        onCreate$={$(() => undefined)}
        filter={{ open: state.open, filtered }}
        onFilter$={() => (state.open = !state.open)}
      />
      <LibraryFilterRow
        id="library-documents-filter"
        name="documents"
        filter={props.filter}
        items={state.items}
        choice={choice}
        search={state.search}
        open={state.open}
        onSearch$={(words) => (state.search = words)}
        onToggle$={(group, value) => choose$({ toggle: [group, value] })}
        onOrder$={(order) => choose$({ order })}
      />
      {state.items.length === 0 ? (
        <p class="library-empty" data-library-empty="documents">No documents yet</p>
      ) : shown.length === 0 ? (
        <LibraryNoMatch name="documents" words={props.filter.noMatch} onClear$={() => choose$({ clear: true })} />
      ) : (
        <ul class="library-list">
          {shown.map((item) => (
            <li key={item.id}>
              <LibraryRow item={item} current={false} onOpen$={$((_: OpenTarget) => undefined)} />
            </li>
          ))}
        </ul>
      )}
      <output data-stored>{JSON.stringify(layout.filters[KEY] ?? null)}</output>
    </div>
  );
});
