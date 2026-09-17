import { $, component$, useStore } from "@builder.io/qwik";

import type { LibraryItem, OpenTarget } from "~/contract";
import { LibraryRow } from "../library-row";

/**
 * Library rows wired in real JSX the way the shell wires them: the listing
 * arrives after the section is drawn, as a re-read does, and a press opens
 * what the row names. Test support, imported by `library-row.test.ts` and
 * nothing that ships. BO_0251_012
 */
export const LibraryRowHost = component$<{ items: readonly LibraryItem[] }>((props) => {
  const library = useStore({ items: [] as LibraryItem[], opened: null as OpenTarget | null });
  const open$ = $((target: OpenTarget) => {
    library.opened = target;
  });
  return (
    <div>
      <button
        type="button"
        data-load
        onClick$={() => {
          library.items = [...props.items];
        }}
      >
        load
      </button>
      <ul class="library-list">
        {library.items.map((item) => (
          <li key={item.id}>
            <LibraryRow item={item} current={false} onOpen$={open$} />
          </li>
        ))}
      </ul>
      <output data-opened>{JSON.stringify(library.opened)}</output>
    </div>
  );
});
