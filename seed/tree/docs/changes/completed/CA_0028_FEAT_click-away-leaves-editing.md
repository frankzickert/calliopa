# CA_0028_FEAT_click-away-leaves-editing

Status: completed

Requested: 2026-09-03

## Intent

In a document tab, a press that lands outside the active block ends the edit and the
document returns to reading presentation.

[Block Editor View](../../system/documents/block-editor.md) fixes that reading is the resting
state and that activating a block is what leaves it. Today the ways back to that resting
state are all explicit — a control, a key, or activating something else. Pressing
anywhere that is not itself an activation leaves the block open, so the reader who has
stopped editing is still in an editor.

## Current Truth

- `deactivate$` (`src/components/views/block-editor.tsx:593`) is the one way out. It
  commits through `save$`, re-reads the document through `reload$` so the reading
  presentation shows what was just typed, idles the editor, clears `state.activeBlockId`,
  and publishes the cleared selection through `bridge.setSelection$`.
- Five gestures reach it: `Done editing` in the bar (`block-editor.tsx:1705`), `Escape`
  inside the active block (`block-editor.tsx:2089`), entering command mode through
  `setMode$`, activating another block (`activate$` commits the outgoing block first),
  and `startWriting$` on the blank page or the area below the last block.
- Nothing else does. A press on the document title, on the editor's own padding, on the
  notice, on the shell header, the library, the tab strip, the inspector, or the command
  dock leaves the block active and the bar up.
- `save$` writes nothing when the runs match what was saved (`block-editor.tsx:462`): it
  reports `saved` and returns. `deactivate$` reloads either way, so leaving a block
  nobody changed costs a round trip and a repaint that buy nothing.
- A refused save sets `editor.failure`, which `BlockFailure` renders against the active
  block, and reports `unsaved` to the tab through `bridge.setSaveState$`. `deactivate$`
  ignores what `save$` returned and idles the editor, so the reason goes down with the
  bar while the tab's `unsaved` state survives it.
- The bar's controls carry `preventdefault:mousedown` (`block-editor.tsx:1612`,
  `block-editor.tsx:1623`) so that pressing one does not take the caret out of the block.
  They still receive the press; only its default is suppressed.
- The surface already owns one document-level listener, for `Ctrl`/`Cmd`+`Enter` and
  `Escape` (`block-editor.tsx:1264`). It ignores an event while the view sits inside an
  `[inert]` subtree, which is what keeps a message holding the floor first in line. Its
  comment states the rule this change must not break: the surface owns the gesture, and
  two handlers may never arbitrate one event.

## Intended Outcome

- While a block is active, a press that lands outside that block's editor and outside the
  bar ends the edit. The document returns to reading presentation with no block active
  and no bar, exactly as `Done editing` leaves it.
- Outside means anywhere in the shell, not only inside the document tab. Pressing the
  inspector, the shell header, or the command dock's composer ends the edit first. The
  cost is accepted: reaching for the dock while editing commits the block and closes it
  before the composer takes the caret.
- Navigating away from the tab is not leaving the block. The tab strip and the library are
  not outside, because a press on either takes the reader to another tab and
  [Workspace Shell](../../system/workspace/frame.md) fixes that a tab retains its own
  selection. Ending the edit there would clear that selection on the way out and leave the
  returning tab with nothing to come back to, making a fixed line unreachable rather than
  merely changed. The unmount flush already commits what was typed, so nothing is lost by
  not deactivating.
- The bar is not outside. Pressing any control in it keeps the block active, because
  every control in it acts on that block.
- The active block's own grips are not outside. They are the block's edges.
- Pressing another block's reading row still activates that row, and one place decides
  that: activation must not run alongside a deactivation of the same press.
- Pressing the blank page or the area below the last block while a block is active only
  ends the edit. Writing there then takes a second press. Every outside press means
  leave, and none of them also means start writing.
- Pressing the document title ends the edit and lands the caret at the character the
  press landed on, resolved before the surface repaints, the way activating a block by
  click already resolves a point to an offset. Leaving the block and arriving in the
  title where the reader aimed is one gesture.
- A press away whose commit is refused still leaves. The refusal's reason moves from the
  block to the view's notice, which renders above the surface and is visible with no
  block active, so the tab's `unsaved` state finally says why and where. Leaving is never
  blocked: `Escape` and `Done editing` reach the same commit, and a reader who cannot
  leave a conflicted block is sealed into an editor with no way out.
- Only presses end the edit. Focus moving out of the block by keyboard leaves it active,
  because `Escape` is already the keyboard's way out and tabbing to the bar's controls is
  how the keyboard uses them.
- Reading presentation stays the resting state, and no fixed line in
  [Block Editor View](../../system/documents/block-editor.md) changes. What changes is how many
  gestures reach it.

## How The Gesture Works

These are technical decisions, recorded here so the implementation does not re-open them.

- The gesture is a `click`, not a `pointerdown`. A touch scroll begins with a pointer
  down on the reading surface and produces no click, so the browser already separates the
  tap that means leave from the scroll that does not, and this change needs none of the
  movement-threshold guesswork `CA_0024_FIX_dock-handle-first-tap` is stuck in on the
  dock handle.
- A `pointerdown` records where the gesture began, and the click ends the edit only when
  both ends were outside. A press inside the block released outside — a text selection
  dragged past its edge — fires its click on a common ancestor that is outside, and
  without the record it would read as leaving.
- Ending on release rather than on press keeps the browser's own focus placement intact:
  the dock composer takes the caret on mouse down, and the deactivation that follows does
  not take it back.
- The listener is document-level, because the scope is the whole shell, and it belongs to
  the surface beside the keydown listener at `block-editor.tsx:1264` — same visible task,
  same cleanup, same `[inert]` guard. One place decides, no block arbitrates its own
  press, and a listener registered at mount is resolved before the first interaction,
  which is the race `CA_0024` records.
- `deactivate$` re-reads only when there is something to re-read. `save$` already
  short-circuits when the runs match what was saved; the reading presentation matches the
  graph in that case, so the reload is skipped. That removes the repaint from the common
  press-away entirely, and leaves the title's caret restoration to handle only the case
  where something was actually typed.

## Still Open

- `CA_0028_003`, the press on the title, is built but not reachable. The bar is docked at
  the top of the tab region and opaque, and the title is the first thing in the surface
  that scrolls under it, so while a block is active the title is underneath the bar at
  every scroll position. The offset resolution and the restoration are in place and cost
  nothing; what is missing is a title a reader can press. This is the same overlap as the
  unowned notice line in [Block Editor View](../../system/documents/block-editor.md), and
  `CA_0031_FIX_title-under-editor-bar` owns the arrangement that would clear it. The task
  is open in that document with the dependency named.


- `CA_0008_012` in [Block Editor View](../../system/documents/block-editor.md) owns the recovery
  path for a conflicted block. This change decides only that an outside press may leave
  one and that its reason survives the leaving; it does not build the re-read.

## System Work

The specification lives in `docs/system/`. This section is the coordination record only.

- `CA_0028_001` in [Block Editor View](../../system/documents/block-editor.md), Presentation: the
  outside press ends the edit, what counts as outside, and the gesture that carries it.
- `CA_0028_002` in the same section: the blank page and the area below the last block leave
  rather than write while a block is active, revising the line that says they start writing.
  Depends on `CA_0028_001`.
- `CA_0028_003` in the same section: a press on the title ends the edit and lands the caret
  where it landed. Depends on `CA_0028_001`.
- `CA_0028_004` in the same document, Editing And Saving: leaving re-reads only when
  something was typed.
- `CA_0028_005` in the same section: a refused save outlives the block it happened to,
  carrying its reason to the notice.

## Verification Impact

- `tests/browser/block-editor.spec.ts` proves leaving through `Done editing` in scenario
  after scenario and never proves leaving by pressing away, on either form factor.
- Scenarios now proven there, beside the block-move ones: a press on the shell outside the
  view committing what was typed and taking the bar down; a press in the bar keeping the
  block active; a scroll of the reading surface keeping it active; a text selection dragged
  out past the block's edge keeping it active; a press on the blank area below the last
  block ending the edit and creating no block, with writing there taking a second press;
  a block nobody changed leaving without a write; focus leaving the block by keyboard
  keeping it active; a press on the tab strip keeping the block for the returning tab; a
  refused commit leaving the block with the reason readable in the notice.
- The title scenario is the one not proven, because the gesture is not reachable while the
  bar covers the title. It belongs to `CA_0028_003`, which carries it.
- `pnpm run verify` gates the result.
