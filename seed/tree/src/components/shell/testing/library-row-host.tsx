import { $, component$, useStore } from "@builder.io/qwik";

import type { LibraryItem, OpenTarget } from "~/contract";
import type { DragOperation, DragPayload } from "~/lib/drag";
import { LibraryRow, type RowPointing } from "../library-row";

/**
 * Library rows wired in real JSX the way the shell wires them: the listing
 * arrives after the section is drawn, as a re-read does, and a press opens
 * what the row names. Test support, imported by `library-row.test.ts` and
 * nothing that ships. BO_0251_012
 */
export const LibraryRowHost = component$<{
  items: readonly LibraryItem[];
  /** The pointing the rows show, by document: what the shell derives from the
   * session for each row (`BO_0304_014`). Absent, no pointing stands. */
  pointing?: Readonly<Record<string, RowPointing>>;
  /** The row a dragged block is held over, by item. CA_0072_004 */
  held?: string;
  /** What a dragged row offers, as the shell reads it off the view of the
   * row's kind; absent, rows do not drag. DO_0043_002 */
  drags?: readonly DragOperation[];
}>((props) => {
  const library = useStore({
    items: [] as LibraryItem[],
    opened: null as OpenTarget | null,
    marked: null as { document: string; title: string } | null,
    dragged: null as DragPayload | null,
  });
  const drag$ = $((payload: DragPayload) => {
    library.dragged = payload;
  });
  const open$ = $((target: OpenTarget) => {
    library.opened = target;
  });
  const mark$ = $((document: string, title: string) => {
    library.marked = { document, title };
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
            <LibraryRow
              item={item}
              current={false}
              onOpen$={open$}
              pointing={props.pointing?.[item.id]}
              onMark$={mark$}
              held={props.held === item.id}
              drags={props.drags}
              onDrag$={drag$}
            />
          </li>
        ))}
      </ul>
      <output data-opened>{JSON.stringify(library.opened)}</output>
      <output data-marked>{JSON.stringify(library.marked)}</output>
      <output data-dragged>{JSON.stringify(library.dragged)}</output>
    </div>
  );
});
