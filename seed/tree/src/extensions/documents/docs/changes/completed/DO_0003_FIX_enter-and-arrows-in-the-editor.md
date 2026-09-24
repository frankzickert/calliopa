# DO_0003_FIX_enter-and-arrows-in-the-editor

Status: completed

Requested: 2026-09-18, by the user: "when in editing mode in a doc, when i press enter or
shift+enter i want to create a new block or a new line. neither works. further: navigating with
arrows up/down should only consider the visible (according to toggles) blocks".

While a block is being edited, Enter makes a new block below it, and Shift+Enter makes a new line
inside it. The arrow keys move from one block to the next only through the blocks the document
shows.

## Where This Starts

- **Enter throws in the browser.** When a split is drawn, the editor mints the tail's identity with
  `crypto.randomUUID()` (`views/block-editor.tsx`, `split$`, `CA_0045_005`). Browsers provide that
  call only in a secure context, meaning HTTPS or `localhost`. The instance is reached over plain
  HTTP at its network address (`BO_0240`), so the call is missing and the press ends in
  `TypeError: crypto.randomUUID is not a function` before anything is drawn. It was seen in a
  browser walk against the served build at head 306. The render harness runs in Node, which always
  has the call, so `handover.test.ts` stays green. It is the only browser-side use of the call in
  the tree.
- **Shift+Enter has never made a line.** The editor sends every Enter without Ctrl/Cmd to the
  split, with or without Shift. A block has no line break of its own:
  - the active block is a single-line textbox (`aria-multiline="false"`)
  - `runsFrom` drops `<br>`
  - reading text collapses whitespace

  So Shift+Enter fails the same way Enter does today, and once Enter is fixed it would split the
  block.
- **The arrow keys walk hidden blocks.** At a block's start or end, `step$` takes the previous or
  next text block in `document.blocks`. That list includes blocks the document does not draw: a
  block set aside as discarded while *Show discarded* is off, and a prompt while *Show prompts* is
  off. The rows are drawn from `readingOrder(…, discardedOpen, promptsOpen)` instead, which is the
  order the reader sees.

## Shape

- Enter splits the block on screen at once, as `CA_0045_005` fixes, on every origin the instance is
  served from. The tail's identity is minted from `crypto.getRandomValues`, which exists in any
  context, as a version 4 UUID, which is what the server checks (`CA_0045_004`).
- Shift+Enter puts a line break at the caret inside the block being edited. The block stays one
  block, and the line break is a character of its text, stored as `\n` in the run it falls in. The
  block is drawn with its lines in reading and while being edited. The caret, Backspace and Delete
  treat a line break as one character, the way they treat any other.
- Ctrl/Cmd+Enter stays the surface's (`BO_0267_012`), with or without Shift.
- ArrowUp on the block's first line leaves the block, wherever the caret stands on that line, and
  ArrowDown on its last line does the same. A line here is a line as drawn: one a line break
  ends, and one the block's width wraps. The caret lands on the nearest line of the next block the
  document draws (its last line going up, its first going down) at the same horizontal position,
  or at that line's end when the line is shorter. Within the block, Up and Down move between
  its lines as the browser does. ArrowLeft at a block's start and ArrowRight at its end keep
  today's rule. User decision, 2026-09-18.
- The block the caret leaves for is the nearest text block the document draws, in the order it
  draws them. That order follows *Show discarded* and *Show prompts*. Retired rows and proposal
  rows take no caret and are passed over, as dividers are today.
- A line break reaches every other reader of the text as `\n`. Publishing draws it as a line
  break. An agent's reads and the change view of a proposal keep the character as it is. User
  decision, 2026-09-18.
- Paste keeps inserting the clipboard's plain text at the caret, newlines included. A pasted text of
  several lines stays in one block and shows its lines. User decision, 2026-09-18.

## Proposed Tasks

- `DO_0003_001`: the split mints the tail's identity without `crypto.randomUUID`. A test runs the
  split with the call absent.
- `DO_0003_002`: the arrow keys step through the drawn reading order, and Up and Down leave a
  block from its whole first or last drawn line, keeping the caret's horizontal position. The
  harness tests cover a discarded block and a prompt, each passed over with its toggle off and
  stepped into with its toggle on, and Up and Down from the middle of a first line, a last line
  and a middle line. The browser measures the lines, so the walk in `_004` is what proves the
  wrapped case.
- `DO_0003_003`: Shift+Enter inserts a line break stored as `\n`. The editor paints and reads it
  back, and reading draws it. It needs harness tests for insert, caret offset, save and Backspace
  across it. `block-document-model.md` gains the line break as part of a text run.
- `DO_0003_004`: walk the served build over plain HTTP at the network address: Enter, typing
  straight on, Shift+Enter, a multi-line paste, Up and Down across a line break and across a
  wrapped line, and the arrow keys with each toggle.
- `DO_0003_005`: a `\n` in a prose body's run reaches the site unchanged, and the site draws it as
  a line break. Publishing passes runs on as they are, so its half is a test. homepage's prose body
  draws run text as plain text, which collapses the line break, so drawing it there is a change in
  the homepage repository under that repository's own process.

## Transferred

Transferred 2026-09-18 on draft:
- `_001`, `_002`, `_003` and `_004` are under Structural Gestures in `block-editor.md`.
- `_003` also sits under Vocabulary in `block-document-model.md`.
- `_005` sits after the entry contract in publishing's `channels/website.md`.

## Implemented

Implemented 2026-09-18 at head 362 (`block-editor.md`, Implementation):
- `_001`, `_002`, `_003` and publishing's half of `_005` are truth.
- `_004`, the walk on the served build, is claimed.
- homepage's half of `_005` is open.

A discarded row takes no caret even under *Show discarded*, since it offers only *Reopen*, so the
arrows pass over it as over a retired row.

## Completed

Completed 2026-09-19. The user walked the build served at pin 381 and it works (`_004`). What
remains open is homepage's half of `_005`, which is an open line in publishing's
`channels/website.md`.
