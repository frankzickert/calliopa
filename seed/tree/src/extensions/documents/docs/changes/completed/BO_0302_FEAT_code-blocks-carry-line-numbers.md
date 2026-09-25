# Code Blocks Carry Line Numbers

Status: completed

Requested: 2026-09-25. In the user's words: *in code blocks, i want line numbers. these should be
toggleable in the doc*, and, the same morning, *i want the option on a block to continue
numbering from the previous.* A code block in a document is drawn in its language's colours today
(`BO_0296`) and nothing beside it says which line is which, so a traceback's *line 3*, a review's
*the loop on line 12* and a run's answer about a block all point at nothing the eye can find. This
document shapes the change; it authorizes no implementation.

## What Is Asked

* A code block shows a number beside each of its lines. The request is the user's, 2026-09-25.
* Whether the numbers are shown is switched per document — *toggleable in the doc* — the way
  *Format code* is: one control governs every code block in that document, and there is no
  per-block flag. The request is the user's, 2026-09-25.
* A document that has never touched the switch shows its numbers: on by default, off when
  switched off, as *Format code* leans. User decision, 2026-09-25 (`BO_0302_Q1`).
* The switch reaches the manuscript: with it on, the PDF's supplementary code is numbered; with it
  off, not. User decision, 2026-09-25 (`BO_0302_Q2`).
* The switch is drawing only. Nothing about it reaches the run schema or the document tools, as
  nothing about `formatCode` does; no tool sets it and no run is told it. User decision,
  2026-09-25 (`BO_0302_Q3`).
* A code block has an option to continue its numbering from the previous code block: with it set,
  the block's first line takes the number after the previous code block's last, so a program cut
  into several blocks with prose between them reads as one listing. The request is the user's,
  2026-09-25.
* The option lives in the block's head, beside the language, shown while the reader may write
  the block. User decision, 2026-09-25 (`BO_0302_Q4`).
* With the document's switch off, a block set to continue keeps its setting and its option is
  still shown; no number is drawn, and switching back on restores the numbering as it was. User
  decision, 2026-09-25 (`BO_0302_Q5`).

## Where This Starts

At head 2674 of the dogfood instance, as exported into `graph/`.

- **The code block is two shapes, and both are one `<pre>`.** `documents`' `views/code-block.tsx`
  (`BO_0289_018`, `BO_0296_018`) draws a block the reader may write as a `<pre>` painted in the
  language's colours behind a `<textarea>` whose text is transparent, the two sharing every
  metric — font, size, padding, line height, tab size — so the caret sits on its letter; and a
  block the reader may not write (a proposal's chip row, command mode) as a `<pre><code>` holding
  the read's markup. Lines never wrap (`white-space: pre`); a long line scrolls sideways inside
  the block and the paint follows the field's scroll. So a *line* of a code block is a source
  line, and a number per source line is a number per drawn line.
- **The markup is not split by line.** `lib/highlight.ts` answers `highlight.js`' HTML: escaped
  text and `<span class="hljs-…">` elements, and a span may cross a line break (a multi-line
  string, a block comment). Numbering by wrapping each line in an element of its own would have
  to cut those spans; numbering in a gutter beside the source does not touch the markup at all.
- **The document already carries one such switch.** `formatCode` is a flag on the document's
  root (`BO_0296_013`): absent or `true` means on, `false` means off, written on the document's
  base as a person's own edit through `setFormatCode`, mirrored in the kernel harness's fixture
  `internal/kernel/serve/testdata/documents-vocabulary.json`, read by `formatsCode` in
  `server/assemble.ts`, and drawn as *Format code*, first in the bar's document group, pressed
  while on (`BO_0296_021`). Nothing about it reaches the run schema or the document tools. A
  second per-document switch has this road to follow, and the fixture in this repository is
  why the change is a `BO` change and not a `DO` one.
- **The manuscript sets code through Pandoc's own highlighter** (`BO_0296_020`, `manuscripts`'
  `server/project.ts`): a `CodeBlock` carrying the language as its class, coloured by the
  macros the venues' templates carry, under `-no-shell-escape`. The typeset image's Pandoc
  (2.17.1.1) numbers lines by itself when the block carries the `numberLines` class — checked
  on `calliopa-typeset:0.4.0` on 2026-09-25, which writes `\begin{Highlighting}[numbers=left,,]`
  from it, through `fancyvrb`, which the templates already load. So print can follow the switch
  at the cost of one class, with no new package and no change to the fixed layer.
- **The block declares two properties.** The `sourcecode` type carries `source` and `language`
  (`BO_0289`, declared by `documents`; the kernel fixture mirrors it). An option on the block is a
  third, declared the same way. Pandoc numbers from any first line when the block carries
  `startFrom` — checked on the same image, which writes `firstnumber=40` into the
  `Highlighting` options — so a continued block prints continued at the cost of one attribute.
- **An output block is not code.** A traceback is coloured by its shape (`BO_0296_019`) and its
  frames name lines of the code block; it has no lines of its own worth numbering.

## The Shape

A mutable starting point for the transfer, not a decision.

- **A gutter, not a rewrite of the markup.** The numbers stand in a column left of the source,
  one per source line, in the code face, the muted colour and the same line height, so the
  number and its line sit on one baseline; the column is as wide as the longest number and never
  moves the code as a block grows from nine lines to ten. The markup stays what the read set,
  so the writing view's overlay (`BO_0296_018`) — the paint's text identical to the field's,
  character for character — is untouched, and the same column serves both shapes: beside the
  paint-and-field pair while writing, beside the read `<pre>` on a proposal's chip row and in
  command mode. It follows the block's vertical extent as the field grows and does not scroll
  sideways with a long line.
- **The numbers are not text.** They are never copied with the code, never found by a search of
  the page, and never read aloud: the column is `user-select: none` and hidden from assistive
  technology, and a block copied out of the document pastes as its source alone, as it does
  today. Proven by a test that selects across a numbered block and reads back the source.
- **The switch is a property of the document's root**, as `formatCode` is: a flag, on unless
  stored `false`, declared as a member revision of the `document` type through `kernel commit --members`,
  mirrored in the kernel harness's fixture, refused in `documents`' words when it is not a boolean
  (`vocabulary.ts`), written on the document's base as the reader's own edit through a
  `setLineNumbers` beside `setFormatCode`, with the read (`assemble.ts`) carrying it to the view.
  Switching on clears the property rather than writing `true`, so a document that never touched
  the switch and one switched back on both store nothing, as with `formatCode`.
- **The control is a toggle in the bar's document group**, beside *Format code* — *Line numbers*,
  pressed while shown and released while hidden, its name saying which so the state reads at a
  glance, sending the write and reading the document back. It governs how every code block in the
  document is drawn from that moment, existing ones included, since the numbers are drawing and
  not content; nothing is revised. A change document carries no such switch, as it carries no
  *Format code*.
- **A proposed code block is numbered exactly as an accepted one is**, on its chip's row, since
  both draw from the same document and the same switch; accepting a proposal changes nothing
  about how its lines are counted.
- **Continuing is a flag on the block, resolved by the read.** `sourcecode` gains `continues`, a
  boolean absent by default, declared as a member revision of the type and mirrored in the kernel
  fixture, refused in `documents`' words when it is not a boolean. It is written on the block's
  base as the reader's own edit through a write of its own (`setCodeContinues`), not through
  `reviseCode`, so a settled edit of the source stays the one whole-block revision it is and
  `data-code-sending` keeps gating the send. The read (`assemble.ts`) resolves every code block's
  first number as it assembles the document, in reading order: a block that does not continue
  starts at one; a block that continues starts after the last line of the nearest code block
  above it, whatever stands between them and whatever its language; a chain of continuing blocks
  counts on; a continuing block with no code block above it starts at one. So `CodeBlockView`
  carries `firstLine`, the gutter counts from it, and removing or moving a block re-resolves the
  ones below on the next read — nothing is stored but the flag. A proposed code block on its chip
  row takes its number from the reading it would join: the code block above its place.
- **The option is a small toggle in the block's head**, beside the language field, in the same
  muted face — *Continue numbering*, pressed while set — shown while the block is writable and
  drawn as a word on a proposal's chip row; it is shown whether or not the document's switch is
  on (`Q5`), since the flag is content of the block and the switch is drawing.
- **The manuscript continues too**: the `CodeBlock` `manuscripts` emits carries `startFrom` with
  the block's first number when it is not one. The supplementary material prints only the code
  that produced a figure or a table, so a printed block may start at forty with no block before it
  on the page; the numbers are the document's and the print shows them as they are.
- **No tool carries the flag.** A run's proposed code block does not continue; a person sets the
  option after acceptance, or before, on any block of their own. This follows `Q3` and is not
  asked for; a tool can carry it later if a run ever needs to say it.
- **An output block, a traceback and an inline `code` mark carry no numbers.** The traceback's
  `line 3` points at the code block's gutter, which is the point of the change.
- **The manuscript follows the switch**: `manuscripts`' `server/project.ts` adds
  `numberLines` to the `CodeBlock`'s classes when the document's switch is on, and Pandoc does
  the rest through the macros already carried; nothing in the typesetting service changes.
- **Nothing starts from a chosen number, and no block hides its numbers on its own.** A block
  starting at line 40 because it was lifted from a file, and a document numbering one block and
  not another, are not asked for and are not shaped here; the only per-block setting is
  continuing from the previous.
- **What lands where.** The document's property, the block's flag, the two writes, the read that
  resolves first numbers, the gutter and the two toggles are `documents`', enumerated in its `block-document-model.md` and `block-editor.md` at draft; the
  class and the attribute are `manuscripts`'; the fixture is this repository's `internal/kernel/serve/`; the
  release note is this repository's, since `documents` and `manuscripts` are bundled. The change
  document stands in the graph as a member of `documents`, at the change's status, no later than
  its completion.

## Transferred

Promoted to draft by the user on 2026-09-25 and transferred the same day.

### The fixed layer, in this repository

- `docs/system/ui-kernel.md`, *Code Lines Are Numbered*: the decisions, the two rules the kernel
  states — the switch is a property of the document's root and the continuation a property of
  the block — and `BO_0302_001`, the kernel harness's fixture mirroring both declarations.
- `docs/system/distribution.md`, *Code Formatting*: `BO_0302_002`, the release note.

### The graph

Staged from head 2745 as `node:chg-5d08218224ee6890` (4 files, 0 removals): `documents`' `block-document-model.md` gains `BO_0302_003` (`lineNumbers`
on the document), `BO_0302_004` (`continues` on the block) and `BO_0302_005` (the read resolves
every block's first line); its `block-editor.md` gains `BO_0302_006` (the gutter), `BO_0302_007`
(*Line numbers* in the bar), `BO_0302_008` (*Continue numbering* in the block's head) and the walk
`BO_0302_009`; `manuscripts`' `system.md` gains `BO_0302_010` (`numberLines` and `startFrom`); and
this document stands as a member of `documents` at `draft`.

## Implemented

Landed on 2026-09-25, in this repository and in one proposal in the graph:

- **The fixture mirrors both declarations** (`BO_0302_001`): `lineNumbers` on `document`,
  `continues` on `sourcecode`. Staging found the instance's `document` declaration without
  `formatCode` — `BO_0296_013`'s member revision had never landed, though the fixture and the
  docs said it had — so the members revision this change stages restores it beside `lineNumbers`.
- **The document's switch and the block's flag** (`BO_0302_003`, `BO_0302_004`): `setLineNumbers`
  and `setCodeContinues` in `documents`' `server/documents.ts`, reached through the command API,
  validated in `vocabulary.ts`; a revise of the source sets `source` and `language` alone, so the
  flag stands through it.
- **The read resolves every block's first line** (`BO_0302_005`): `numberCodeLines` in
  `assemble.ts` after the figures are numbered, `placeCodeLines` for a proposed insert, and
  `lib/code-lines.ts` counting a line per newline-ended run so a formatted block counts what a
  reader sees.
- **The gutter and the two toggles** (`BO_0302_006`–`BO_0302_008`): a flex body with a numbers
  column outside the paint and the field, `aria-hidden` and unselectable; *Line numbers* second in
  the bar's document group; *Continue numbering* first in the block's head, pressed while set and
  a word on a chip row; the proposal row carries the document's switch to its code block.
- **The manuscript numbers its code** (`BO_0302_010`): `numberLines` and `startFrom` on the
  `CodeBlock` `manuscripts` emits.

- **Two walk findings, 2026-09-25, fixed the same day.** A block set to continue kept its numbers
  when a line was added above it: the row is keyed by its revision and a changed number changes
  no revision (`BO_0295`'s frozen-row fault), so the editor now resolves every block's first line
  itself, over the document and the line counts being typed, and hands it to the block apart from
  the block — the numbers below follow the caret before the edit settles. And one code block took
  no write any more, refused with `multiple_established_revisions`: two presses of *Continue
  numbering* 1.5 s apart, the first write still running, landed as revisions 2780 and 2781 on
  one base and the gateway established both. The shell's half: the control is disabled while its
  write is on its way, a settle in flight lands first, and the write is registered as the tab's so
  nothing lands beside it. The gateway's half is open work in `docs/system/ccgw.md`, Write
  Compiler: two `SET`s on one node in flight together must conflict, not both establish. The
  block is repaired by archiving the earlier of its two established revisions, a decision left to
  the user.

Verified: `tsc` clean on the tree; the documents server, lib, manuscripts and code unit suites
(412 tests), the code block, bar, branch and proposal view suites, and the behaviour project's
theme-token check green; the kernel's `ImportAppContent` and `ReviewVerification` suites seed the
fixture. Walked by the user on 2026-09-25 at pins 2775 and 2828 (`BO_0302_009`, the two findings above checked again at 2828: "works"); the release note stands under *Added* (`BO_0302_002`). Completed 2026-09-25.

## Depends On

- `BO_0296` (completed 2026-09-25, walked at pins 2592 to 2711): the coloured block, its overlay
  and the `formatCode` switch are what this change draws beside and copies the shape of.
- `BO_0293` (wip) for the manuscript half: the supplementary code is what gets numbered in print.
