# DO_0039_FIX_formatting-a-selection-on-a-phone

Status: completed

Reported 2026-10-05 by the user: "text formatting does not work on mobile, bold italics". On a
phone, selecting words in the block being edited and pressing *Bold* or *Italic* in the bar's
*Format* group leaves the words as they were.

## Cause

- Read from the code at head 4611. `toggleMark$` (`views/block-editor.tsx`) applies the mark to
  `editor.start`–`editor.end`, the selection the editor last read. The block being edited reads the
  live selection into that state only on `keyup` and `mouseup` (`select$`). A selection made by
  touch — a long press, then dragging the handles — fires neither: the browser reports it through
  `selectionchange` alone. The editor therefore still holds the collapsed caret the tap left, and
  the mark is applied to an empty range, which changes nothing. The same stale range reaches every
  other control that acts on the selection: *Strikethrough*, *Code*, *Link*, *Cite* and the inline
  equation, and the toggles' pressed state, which shows the marks at the caret rather than those of
  the selected words.
- A desktop does not show it because a mouse drag ends in `mouseup` and a keyboard selection in
  `keyup`. No test makes a touch selection: the tree holds no browser spec (the
  `tests/browser/block-editor.spec.ts` that Block Editor View's Verification names is not in it),
  and the render-harness tests reach the toggles with the editor's range already set.

## Scope

- The owner is documents, which owns the block editor and its *Format* group; the change uses its
  `DO` prefix.
- On a phone, words selected by touch in the block being edited are what *Bold*, *Italic*,
  *Strikethrough*, *Code*, *Link*, *Cite* and the inline equation act on, as a mouse or keyboard
  selection is on a desktop; the *Format* toggles show the selected words' marks.
- Technically: the block being edited follows `selectionchange` on its own document while it is
  mounted, taking a range only when it falls inside its element, the way `marked-rows.ts` and
  `passages/use-passages.ts` already follow it; `keyup` and `mouseup` become redundant.
- To confirm on a phone while doing it: that a tap on a *Format* button keeps the selection in
  the text. The buttons prevent the default of `mousedown` only (`keepsSelection`,
  `components/shell/inspector.tsx`); if a touch still collapses the range or hides the keyboard
  first, the press must also keep it on `pointerdown`.
- Verified by a render-harness test that changes the selection inside the block without a
  `keyup` or `mouseup`, dispatches `selectionchange`, presses *Bold* and *Italic*, and finds the
  marks on the selected words; and by the user on a phone.
- Set to draft by the user on 2026-10-05; the work is enumerated as `DO_0039_001`–`DO_0039_003` in
  [Block Editor View](../../system/documents/block-editor.md#a-selection-made-by-touch).
- Set to ready by the user on 2026-10-05. `DO_0039_001` and `DO_0039_002` landed the same day and
  stand as truth in Block Editor View.
- Completed 2026-10-05: the user walked it on a phone at pin 4642, and `DO_0039_003` stands as
  truth.
