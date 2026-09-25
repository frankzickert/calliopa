# References Across Documents

Status: completed

Requested: 2026-09-25. A command written in a block of a document can point at other blocks of
the same document: command mode marks them, they are numbered in mark order, `#n` names them in
the prompt, and the run is told each one as it was marked (`documents`' Command Mode,
`ui-kernel.md` Blocks As Commands, `BO_0226`, `BO_0227`, `BO_0263`, `BO_0267`). The person wants
the same pointing to reach other documents: a whole document, and blocks or passages inside it.
This document shapes the change; it authorizes no implementation.

## What Is Asked

* From a prompt block in one document, the reader can reference another document, and blocks
  inside that other document, as they reference blocks of the prompt's own document today. The
  request is the user's, 2026-09-25.
* A reference to another document, or into it, is a reference like the ones that exist: it is
  numbered in the same sequence as the prompt's other marks, in mark order; `#n` in the prompt
  names it; it is a chip on the prompt's command control; it belongs to the prompt block and is
  reused when the block is sent again; each run gets a copy of the marks as they stood at its
  send. Command Mode's fixed lines are not weakened for it.
* A reference across documents is pointing, never a fence, as every reference is
  (`ui-kernel.md`, `BO_0226`). The run is told what was pointed at and where it stands; the
  command's words say what to do with it.
* A reference is what was marked (`BO_0263`), across documents too: a block of another document
  that is retired, discarded, rewritten or whose document has since gone stays as what was
  marked, and the run is told what has happened to it since.
* The reader points at another document by going there: command mode follows the reader across
  tabs. While a prompt is pointing, a press on any drawn row of any open document marks it for
  that prompt, in the one number sequence, and a selection there references a passage; a
  document's row in the library and a document tab's title mark the document whole. A picker in
  the prompt offering documents by title is not part of this change. User decision, 2026-09-25
  (`BO_0304_Q1`).
* A run proposes only into the command's document, as today. A referenced document is read, not
  written; a run that would change it is a later change of its own. User decision, 2026-09-25
  (`BO_0304_Q2`).
* A whole-document reference tells the run the document's title and identity and that
  `read_document` reads it; none of its words are quoted into the instructions. User decision,
  2026-09-25 (`BO_0304_Q3`).
* A reference into another document renders on the prompt's command control as `#n` with that
  document's title beside the number, and a whole-document reference as `#n` with the title
  alone. In the other document the marked row carries the same gutter number and treatment a
  mark carries today. User decision, 2026-09-25 (`BO_0304_Q4`).

## Where This Sits

- The pointing is the `documents` extension's (marking, the record per prompt, the rows that
  draw a mark) and `ui.shell`'s (the chips, `reveal`, the tabs and the library the reader points
  through, `SentReference` and the body the run route posts). Reading what was marked from
  another document at run start, and telling the run about it, is the kernel's
  (`agentbridge/bridge.go` `Reference`, `readMarked`, `deliveryNote`). Work spans this
  repository and the graph, so it is a `BO` change here; its graph tasks are enumerated in the
  extensions' docs at draft, with the task lines here pointing there.

## Proposed Shape

- **Pointing follows the reader across tabs.** Command mode is entered from `◎` on the prompt
  block and is the pointing of that one prompt. While it is on, the reader may switch to, or
  open, another document's tab; that view is in command mode for the same prompt: a press on any
  drawn row there — a block, a proposal, a retired or discarded row — marks it as the prompt's
  next reference, numbered in the one sequence, and a selection there references a passage under
  `BO_0227`'s rules. Marks made in the other document are drawn there, with their numbers,
  while the pointing is on, and leave no trace when it ends, as marks do today. Coming back to
  the prompt's tab finds it still edited and still pointing. `◎` on the prompt, or `Escape` in
  any view in the mode, ends the pointing. Every open view then reads again as the reading
  surface it was.
- **A whole document is a reference.** While pointing, a document's row in the library's
  `Documents` category, and a document tab's title, are markable: a press marks the document
  itself as the next reference, and a press again unmarks it. It renders as `#n` beside the row
  and the tab, in the treatment a marked block carries, so what was marked reads back in the
  library and the tab strip as it reads back in a document.
- **One pointing at a time.** There is one pointing prompt across the workspace, not one per
  view: a view whose own block is being edited while another document's prompt is pointing shows
  no second `◎` pressed. Entering pointing from a second prompt while one is pointing ends the
  first, its marks kept as today.
- **The chip says where it points.** A reference into another document renders on the prompt's
  command control as `#n` with that document's title beside the number, and a reference to a
  document itself as `#n` with the title alone. Pressing the chip brings that document forward
  — its open tab, or a new tab through `retarget$`'s route the way focused work opens a block —
  and reveals the block or passage as `reveal` does today; a whole-document chip brings the
  document forward at its top.
- **The record.** A reference in the prompt's record (`lib/references.ts`, `Reference`) carries
  the document it points into when that is not the prompt's; absent, it is the prompt's document,
  so every record and every caller that exists reads unchanged. A reference into a document the
  reader can no longer open is kept as what was marked, as a reference whose row has gone is, and
  is taken back from its chip's ×.
- **The intake.** `Reference` in `agentbridge/bridge.go` gains `Document` — absent for the
  command's document, as every caller that exists sends; otherwise the identity `read_document`
  takes — and a kind for a document marked whole. The kernel reads each reference from the
  document it names, under the run's principal, the way `readMarked` reads the command's own
  document today: the words and the state of what was marked are graph facts, so the kernel reads
  them and never takes them from the client (`BO_0227`, `BO_0263`). A reference into a document
  the principal cannot read is refused by name at *Send*, as a stale passage is.
- **The instructions.** A reference into another document renders among the rest in mark order
  as `#n → block <id> of document "<title>" (<document id>): "<words>"`, a passage and a marked
  proposal or retired block with the same *of document* clause; a whole document as
  `#n → document "<title>" (<document id>)`, with the note that `read_document` reads it. The
  delivery is unchanged: the run proposes into the command's document, and the instructions
  say that a referenced document is read, not written (`BO_0304_Q2`).
- **Nothing new is stored.** Marks stay device-local presentation state per prompt; the graph
  gains no reference node and no relation. A reference across documents is part of a run's
  record as references are today.

## Functional Questions

- None open. `BO_0304_Q1`–`BO_0304_Q4` are answered in What Is Asked, 2026-09-25.

## Acceptance Examples To Shape At Draft

- Given a prompt block in document A pointing (`◎` pressed), when the reader opens document B's
  tab and presses one of its blocks, then that block is marked `#k` in B, the prompt's command
  control in A carries a chip `#k · B`, and A's own marks keep their numbers.
- Given a mark made in B for A's prompt, when the reader returns to A's tab, then the prompt is
  still being edited and still pointing, and the chip stands.
- Given a chip `#k · B` on A's prompt, when the reader presses it, then B comes forward and the
  block scrolls into view ringed as `reveal` rings a block today.
- Given the pointing on, when the reader presses document C's row in the library, then C is
  marked whole as `#m`, the row shows `#m`, and the chip reads `#m · C`.
- Given A's prompt reads *compare #1 with #2*, where `#1` is a block of A and `#2` a block of B,
  when the reader sends it, then the run's instructions render both in mark order, `#2` with
  *of document "B"* and its words as B holds them at the send, and the run proposes into A.
- Given a passage selected in B while pointing from A, when the reader presses **Reference**,
  then the passage is anchored by its words in B's block, numbered in the one sequence, and
  rendered to the run as a passage *of document "B"*.
- Given a block of B marked for A's prompt, when B's block is retired before the send, then the
  chip stays, says *since retired*, and the run is told the words as they were marked and that
  the block is retired since.
- Given the pointing ended with `◎`, then no view shows a mark, a number or a pressed `◎`, and
  the marks come back when A's prompt is edited again.
- Given the reader cannot open document D, then no row of D is offered to mark, and a record
  naming D is kept as what was marked and taken back from its chip's ×.
- Given a prompt that carries no reference into another document, the body the run route posts
  and the kernel's instructions are byte-identical to today's.

## Transferred

Set to ready by the user on 2026-09-25, skipping draft; transferred and claimed the same day.

- `docs/system/ui-kernel.md`, *References Across Documents*: `BO_0304_001`–`BO_0304_006` — the
  intake, the read of each referenced document, the instructions, the verification, the rebuild
  and the release note.
- `documents`' `command-mode.md`, *References Across Documents*: `BO_0304_007`–`BO_0304_012` — the
  record, the pointing session across tabs, the report and the chips' reveal, the guest rows, the
  verification, the walk.
- `ui.shell`'s `commands-and-runs.md`, *References Across Documents*: `BO_0304_013`–`BO_0304_015`
  — the body and the chips, the session and the request on the view bridge, the verification.
- Decided at transfer: the library row's and the tab's press keep opening and switching, since a
  reader points into a document by going there; the whole-document mark is a control of its own on
  the row and the tab, shown while a pointing stands.
- This document stands in the graph as a change of `documents`, whose pointing the change extends,
  at the same status.

## Implemented

Implemented on 2026-09-25, the day it was set to ready.

- **The fixed layer, here:** `BO_0304_001`–`BO_0304_004` landed — `Reference.Document` and the
  `document` kind in the intake, `readReferenced` reading each referenced document once at the
  pin and checking its references against it, the instructions naming the document of every
  reference that points elsewhere and closing with *read, not written*, and
  `agentbridge/across_test.go` over a real CCGW. Open here: `BO_0304_005` (the rebuild, the
  user's) and `BO_0304_006` (the release note after the walk).
- **The graph:** `BO_0304_007`–`BO_0304_011` in `documents` — the record with `document`,
  `documentTitle` and the `document` kind, the pointing session held by the shell and mirrored by
  a guest view, the report and the chips opening the other document, the guest rows, the suites
  — and `BO_0304_013`–`BO_0304_015` in `ui.shell` — the body and the chips with the title, the
  `pointing` and `across` stores on the view bridge, *Mark document* on library rows and document
  tabs. Open there: `BO_0304_012`, the walk.
- **Found on the way:** only the active tab's view is mounted, so the marks of a pointing cannot
  stay in the prompt's view while the reader is in another document; the shell holds them, as an
  opaque record the pointing view serializes, for as long as the pointing stands. A helper a `$`
  closure reaches must be module-level, or Qwik refuses to serialize the closure. A reveal aimed
  at a document whose view is not mounted waits: the view acts on it at mount, once its document
  has loaded, and clears it.

- **Walked by the user at pin 2864 (2026-09-25, "works")**, with one finding: once a prompt carried
  a mark, its `#` list lost the document's figures, tables and headings — `BO_0300_Q2`'s rule that
  a prompt's `#` means the mark. The user revised it (`BO_0304_016`): a prompt's `#` list opens
  with its marks and continues with the document's blocks, and choosing a block marks it and
  writes its number, the picker `BO_0304_Q1` deferred, done as marking. Landed the same day.
- **The second walk (pin 2878) found** that returning to the prompt's tab left the prompt pointing
  but not edited, so the `#` list was out of reach. Fixed the same day (`BO_0304_018`): the view
  mounting into a standing pointing activates the session's prompt for editing.
- **Walked by the user at pin 2896 (2026-09-25, "works")**: back on the prompt's tab the prompt is
  being edited and pointing, and `#` offers its marks and then the document's blocks. The walk
  also found documents slow to open and blocks slow to activate; the cause is not this change but
  the proposals read, which reads the touched set of every open proposal group in the instance —
  158 that day — on every document open (`BO_0257_008`), a change of its own.
- Completed 2026-09-25. The release note stands under *Added*.

## What Is Not In This Change

- A link in the words of a block to another document or block — authored content, a `link` run
  the reader follows while reading. This change is about pointing for a command, which stores
  nothing in the document.
- A picker in the prompt offering other documents and their blocks by title; `BO_0304_016` gives
  the prompt's list the blocks of its own document, and other documents are pointed at by going
  there.
- A run proposing into a referenced document (`BO_0304_Q2`), proposals across documents in one
  group, dragging a block between documents, transclusion, and backlinks from a referenced
  document to the prompts that point at it.
- References from a run's own proposals into other documents, and a reference to a document the
  run creates.
- Numbering of figures, tables and equations across documents (`BO_0290`, `BO_0295` leave a
  reference across documents out for the same reason: it is this change's).
