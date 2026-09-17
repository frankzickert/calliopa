# CA_0045_FIX_mobile-block-editing

Status: completed

Requested: 2026-09-11 by the user. *On mobile: The block text should take the entire horizontal space, except for a small margin left for the drag handle. The up and down buttons must not overlay the text, but sit at the top border. When switching the edited block, the screen blinks (it seems to reload a lot, also the onscreen keyboard closes and reopens), especially when adding a new block (enter). The last one is the hardest, but maybe the order of things helps?* User statement.

## Where This Starts

This is the code at dataRevision 377. The geometry below is worked out from the served stylesheet, not measured in a browser.

- **The text column gives up about a quarter of a phone's width.** The editor cancels the tab region's inset (`--workspace-inset`, 1.25rem on a phone) and puts it back on `.block-surface`, plus 0.25rem on each side. `.block-row` then keeps its leading gutter open (`--block-grip-gutter`, 1.75rem). Under 640px it drops only the trailing one. `.block-text` adds a 1px border and 0.35rem of padding. So the text starts about 59px from the screen's left edge and ends about 31px from its right edge. On a 360px screen that leaves a line of about 271px.

- **The arrows sit on top of the text.** Under 640px, `.block-grip--end` is absolutely positioned at `top: 0.4rem` on the row's trailing edge. It is opaque on `--panel-raised`, so its two buttons hide the end of the active block's first line. `block-editor.md` states this as intended: "the arrows overlay the block's trailing edge, opaque, because the text runs underneath them" (`CA_0029_001`). Its Implementation line still says the gutter is `0` under 640px, which `CA_0029_001` changed.

- **Enter removes the focused editor, then reads the document three times before it builds a new one.** In `split$`, the steps run in this order:

1. `save$`.

2. `freshBlock$` reads the document (read 1) and replaces the document in hand, so the whole block list renders again.

3. The split command is sent.

4. The editor is idled and `activeBlockId` is set to `null`. That unmounts `ActiveBlockText`, focus falls to the page, and the keyboard closes.

5. `reload$` reads again (read 2). The head block now has a new revision, and rows are keyed by revision, so its row becomes a new DOM node.

6. `activate$(tail)` calls `freshBlock$` again (read 3), and the list renders once more.

7. `ActiveBlockText` mounts in the tail, and its visible task focuses it. The keyboard opens again.

In total that is three round trips with no editable element focused, and four renders of the list.

- **A tap on another block also takes focus away from the editor.** The reading row is `tabIndex={0}` with `role="button"`, so the tap focuses it at once. It is not editable, so the keyboard closes. Then:

1. `activate$` saves the outgoing block.

2. It reads the document. The outgoing block's saved revision changes its row's key while that row is still active, so its editor remounts and takes focus for a moment.

3. `activeBlockId` switches to the tapped block, and a new editor mounts and focuses. The keyboard opens again.

- **Every gesture that ends in another block goes through the same idle and reread.** That covers `step$` (the arrow keys across a boundary), `merge$`, and `structural$` (the bar's inserts and retire).

- **The server names the new block.** `splitTextBlock` picks the tail's id with `randomUUID()` (`documents.ts`). Its answer, `SplitBlocks`, carries the head's new revision and the tail's id, but not the tail's revision.

## Intent

* On a phone, a block's text runs across the full width of the screen. The only margin is a small one on the left, which holds the drag handle.

* On a phone, move up and move down sit on the active block's top border, at its trailing end. They never cover its text.

* Switching the edited block keeps the on-screen keyboard open. That holds for a tap on another block, the arrow keys across a boundary, a merge, and Enter. Focus passes directly from one editable block to the next, never through anything that is not editable.

* Switching repaints only the blocks it changes. The rest of the document is not redrawn.

* Enter splits the block on screen at once. The head keeps the text before the caret. The new block below takes the text after it, with the caret at its start, and what the reader types next goes into the new block before the graph has answered. User decision, 2026-09-11: an instant split, chosen over waiting one round trip for the graph to create the block.

* A split the graph refuses after the screen has shown it folds back. The new block's text, including anything typed after Enter, goes back into the block it came from, at the split point. The editor stays in that block, and the refusal is named on it the way a refused save is. Nothing typed is lost. User decision, 2026-09-11.

- The handover order and the instant split are one path on every form factor. Only the layout is phone-only, under the existing 640px query. The phone is where the blink and the keyboard show, but a desktop loses the extra renders too.

## The Shape

### Width

- **The surface stops putting the region's inset back on a phone.**

- Leading side: `.block-surface` puts back none, and the row's leading gutter is the whole margin.

- Trailing side: it puts back a hairline of 0.25rem, so the active block's accent border does not touch the screen edge. User decision, 2026-09-11.

- The headline keeps its left edge in line with the text.

- **`--block-grip-gutter` gets a phone value just wide enough for the handle.** That is 1.25rem, about 20px, measured so the ⠿ glyph clears the text by a small gap. User decision, 2026-09-11. One number still governs both the room the row reserves and the box the grip sits in.

- **Everything else in the leading gutter follows the same number and is checked to fit:**

- the standing glyph (`.block-standing`, 1.4rem today, so it has to narrow);

- the command mode's reference number;

- a proposal's gutter and face (`CA_0043`).

- **The handle keeps a finger-sized target without taking width.** Its hit area is the gutter's width and at least 44px tall, and it runs down the row, out of the flow.

### Arrows

- **On a phone, `.block-grip--end` sits on the top border.** It uses `top: 0` and `translateY(-55%)` at the trailing end, the way the command mode's `.standing-toolbar` sits on a block's top border. It stays opaque on `--panel-raised` with its border. It hangs into the space above the block, so it covers none of the block's own text.

- Blocks are about 0.7rem apart, so the arrows' upper half may cover the right end of the previous block's last line, which is not being edited. That overlap is accepted. User decision, 2026-09-11. The measurement reports how much, and the walk-through confirms it.

- **A block row's scroll margin grows on a phone by the height the arrows rise above the row.** This keeps activation from placing them under the bar. The margin stays one expression with `--block-bar-height`.

- **The desktop is unchanged.** Its arrows stay in the trailing gutter.

### The handover

- **One handover serves every gesture that ends in another block:** tap, step, merge, split and `structural$`. `activeBlockId` goes from the outgoing block to the incoming one in a single step. It is never `null` in between, so the `Object.assign(editor, idleEditor())` followed by `activeBlockId = null` in `split$` and `structural$` goes. The incoming `ActiveBlockText` mounts and takes focus while the outgoing one still holds it. Nothing is awaited between the two.

- **A tap on a reading row does not take focus while a block is active.**

- The surface already owns document-level listeners (`CA_0028_001`). One more of them cancels the focus that a touch press on a reading row would take.

- It cancels synchronously, because a Qwik handler's `preventDefault` runs after the default has already happened.

- It applies to touch only. The desktop's drag-to-select inside a reading block has to keep working.

- The outgoing editor keeps focus and the keyboard while its save runs. A refused save still keeps the reader in the refused block, as it does today.

- **A row stays the same node while it is active.** While active, its key is the block's identity alone. A revision that the editor itself wrote therefore does not remount the editor under the caret. When the row leaves, its key takes the revision again, so its reading text is the graph's. The `CA_0008` reason for keying by revision still holds for every row that is not being edited.

- **The document in hand is replaced at most once per gesture.** Rows whose revision did not change keep their DOM nodes.

### Instant split

- **The split command takes an optional `tailBlockId` that the editor chose,** with `crypto.randomUUID()` in the browser.

- The server uses it in place of its own `randomUUID()`.

- An id that already names a node is refused as a conflict.

- The answer gains `tailRevisionId`, the revision the new block's first save is based on.

- Callers that name no id are unchanged.

- This is a change to the shell's own document transport, `POST /api/x/ui.shell/documents/[id]/commands`.

- **On Enter, the editor does its part before any request is sent:**

1. It splits its runs at the caret with `splitRuns` from `runs.ts`, the same code the server runs.

2. It adds the tail after the head to the document in hand, as a pending block under the chosen id.

3. It hands the editor to the tail with the caret at 0.

4. It paints the head's shortened text as reading.

After that, the head's pending save and the split go out in order in the background.

- **Typing in a pending block edits the editor's model as usual.** The save that the typing schedules waits for the split's answer, which supplies its base revision.

- **Structural commands leave in the order the reader gave them.** A second Enter in a pending block splits on screen at once. Its command waits for the first split's answer.

- **A refused split folds back.** The editor joins the tail's runs, as typed, onto the head at the split point and drops the pending tail from the document in hand. It stays in the head with the caret at the join, and names the refusal on it the way `BlockFailure` names a refused save. Splits queued behind it are not sent and fold back with it, in order, so every pending block's text returns to the head. Nothing is written automatically after it: the head holds the folded text unsaved against the base that was refused, as a block whose save was refused does, because the editor must not silently overwrite or resolve a conflict itself (Conflict, in `documents/block-editor.md`).

## Proposed Tasks

These are transferred into the shell's graph docs when the user sets the change to draft.

- `CA_0045_001` (`documents/block-editor.md`): on a phone, the text runs from the handle's margin to a hairline from the right edge.

- `--block-grip-gutter` gets its phone value, and everything in the leading gutter fits it.

- The Implementation line about the gutter under 640px is rewritten to the current truth.

- Proven by a Playwright layout measurement at 360 and 390 CSS px, following the `CA_0041` fixture-host recipe. It checks the text box's left and right edges against the screen, and that the handle, the standing glyph and a proposal face do not intersect the text.

- `CA_0045_002` (`documents/block-editor.md`): on a phone, the arrows sit on the active block's top border at the trailing end, and the row's scroll margin clears them.

- The `CA_0029_001` line about the arrows overlaying the trailing edge is rewritten.

- Proven by the same measurement: the arrows' box does not intersect the active block's text, and a block activated under the bar puts neither the text nor the arrows beneath it.

- `CA_0045_003` (`documents/block-editor.md`): the handover. That covers one step from the outgoing block to the incoming one, no focus taken by a touch on a reading row, the active row keyed by identity, and one document read per gesture.

- Proven in the render harness for tap, step, merge and Enter:

- A `focusout`/`focusin` log shows `document.activeElement` is always an editable block.

- A `MutationObserver` shows that no row outside the blocks the gesture changed is replaced.

- `CA_0045_004` (`documents/block-document-model.md`, `documents/block-editor.md`): the split command takes an editor-chosen `tailBlockId` and answers `tailRevisionId`.

- Proven in `tests/behavior/documents.test.ts`: the chosen id is kept, an id that already exists is refused with nothing written, and an omitted id behaves as it does today.

- `CA_0045_005` (`documents/block-editor.md`): the instant split. That covers the pending tail, saves that wait for the answer, commands sent in order, and a refused split folding back.

- Proven in the render harness:

- After Enter, the tail is active with the caret at 0 before the command resolves.

- Characters typed into it reach the graph under the tail's id.

- Two quick Enters produce three blocks in order.

- A refused split folds the typed text back into the head at the split point, with the refusal named on it, and loses no character.

- `CA_0045_006`: the walk-through on a phone against the served build: width, arrows, a tap on another block, arrow keys, Backspace at a start, and repeated Enter, with the keyboard never closing.

## Overlap

- No other open change touches the block editor. The only open `ui.shell` change is `CA_0035_BUILD_production-backups` (idea), and it does not touch these files.

- `documents/block-editor.md` is a whole-file member. A change that is accepted on it between this change's transfer and its implementation makes the later proposal drift, so the transfer should be accepted before other work lands on that file.
