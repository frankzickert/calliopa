import { component$, type QRL } from "@builder.io/qwik";

/**
 * The handle every drawn row carries while it is not the active block
 * (BO_0263_013): the ⠿ a drag starts from, alone, drawn on a desktop while the
 * pointer is over the row and on a phone on the focused row
 * (`block-editor.css`, `.block-grip--idle`). The ↑ and ↓ stand only in the
 * active row's bar (`block-bar.tsx`, BO_0315_014).
 *
 * In the leading gutter, as the active block's handle is, on a row that holds
 * one open — a block of the document, a proposal — or in the row's own line,
 * on a removed row, whose line has room for it. It takes no tab stop: the
 * keyboard reorders through the bar's arrows. Moving answers nothing; what
 * each row's move does is the editor's (the drop task).
 */
export const RowGrip = component$<{
  /** What the row is, in the words its handle is named with. */
  label: string;
  /** In the gutter, or in the row's own line. */
  inline?: boolean;
  drag$: QRL<(event: PointerEvent) => void>;
}>(({ label, inline, drag$ }) => (
  <div
    class={inline === true ? "block-grip block-grip--idle block-grip--inline" : "block-grip block-grip--start block-grip--idle"}
    role="group"
    aria-label={`Move ${label}`}
    data-row-grip
  >
    <button
      type="button"
      class="block-handle"
      tabIndex={-1}
      aria-label={`Drag ${label}`}
      data-row-handle
      onPointerDown$={(event: PointerEvent) => drag$(event)}
    >
      ⠿
    </button>
  </div>
));
