import { component$, type QRL } from "@builder.io/qwik";

/**
 * The grip every drawn row carries while it is not the active block
 * (BO_0263_013): the ⠿ handle a drag starts from and the ↑↓ arrows that
 * step it one row, drawn on a desktop while the pointer is over the row and
 * on a phone on the focused row (`block-editor.css`, `.block-grip--idle`).
 *
 * In the gutters, as the active block's grips are, on a row that holds them
 * open — a block of the document, a proposal — or in the row's own line, on
 * a retired or discarded row, whose line has room for it. It takes no tab
 * stop: the keyboard reorders through the active block's arrows and a
 * proposal's face. Moving answers nothing; what each row's move does is the
 * editor's (`stepRow$`, the drop task).
 */
export const RowGrip = component$<{
  /** What the row is, in the words its controls are named with. */
  label: string;
  /** In the gutters, or in the row's own line. */
  inline?: boolean;
  first: boolean;
  last: boolean;
  drag$: QRL<(event: PointerEvent) => void>;
  step$: QRL<(direction: -1 | 1) => void>;
}>(({ label, inline, first, last, drag$, step$ }) => {
  const handle = (
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
  );
  const arrows = (
    <>
      <button type="button" tabIndex={-1} aria-label={`Move ${label} up`} data-row-up disabled={first} onClick$={() => step$(-1)}>
        ↑
      </button>
      <button type="button" tabIndex={-1} aria-label={`Move ${label} down`} data-row-down disabled={last} onClick$={() => step$(1)}>
        ↓
      </button>
    </>
  );
  if (inline === true) {
    return (
      <div class="block-grip block-grip--idle block-grip--inline" role="group" aria-label={`Move ${label}`} data-row-grip>
        {handle}
        {arrows}
      </div>
    );
  }
  return (
    <>
      <div class="block-grip block-grip--start block-grip--idle" role="group" aria-label={`Move ${label}`} data-row-grip>
        {handle}
      </div>
      <div class="block-grip block-grip--end block-grip--idle" role="group" aria-label={`Reorder ${label}`}>
        {arrows}
      </div>
    </>
  );
});
