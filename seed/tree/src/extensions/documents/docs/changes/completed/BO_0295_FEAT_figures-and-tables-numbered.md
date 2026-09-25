# Figures And Tables Are Numbered

Status: completed

Requested: 2026-09-23, as the answer to `BO_0293_Q4`, its two questions answered by the user the
same day: a manuscript needs *Figure 3* and a sentence that refers to it, and the manuscript must
never number what the record does not. So a document numbers its figures and tables the way it
numbers its equations (`BO_0290`), and this change lands before `BO_0293`'s projection reads the
numbers. This document shapes the change; it authorizes no implementation.

## What Is Asked

- An `image` block carries a caption, as a `table` already does.
- An image and a table can be numbered on request, the numbers running in reading order over the
  numbered ones of each kind alone — figures and tables counted apart, as a paper counts them —
  so a note holding one incidental picture carries no stray number.
- A sentence can refer to a numbered figure or table: the reference draws the current number and
  follows it when the numbering shifts, as an equation reference does.
- The number is derived on the read, never stored; retired and discarded blocks carry none and
  consume none; a block in an open proposal is numbered as it would be were the proposal accepted.

## Where This Starts

At head 2179 of the dogfood instance.

- `BO_0290` gives the whole idiom: `numbered` on the block as the author's ask, `numberEquations`
  in the document read, `equationNumbers` answered by the read, `equationRef` as a run with empty
  text kept by normalization, the kernel's run schema naming it so a run can read and propose one,
  and the bar's *Reference an equation*. Every piece has a figure and a table twin.
- `table` permits `caption`; `image` permits `reference`, `alt`, `width`, `height` and `source`,
  and no caption. An `output` block's pictures are figures a manuscript wants numbered too
  (`BO_0293_Q5`); whether an output picture is numbered in the document, or only where the
  manuscript projects it, is a question below.
- It is a `BO` change, not a `DO` one, for `BO_0290`'s reason: the kernel's document tools
  declare runs with `additionalProperties: false`, so a reference a person can write is one a run
  can neither read nor propose until the schema names `figureRef` and `tableRef`, and the tools'
  content shape must carry an image's caption and the `numbered` ask.

## The Shape

- `image` permits `caption` and `numbered`; `table` permits `numbered`; `output` permits `caption`
  and `numbered`, its first picture being the figure. Two run attributes, `figureRef` and
  `tableRef`, each the identity of the block it names, empty text, atoms.
- The read answers `figureNumbers` and `tableNumbers` beside `equationNumbers`.
- The editor: a caption field beneath a picture, drawn as the table's is; *Number this* in the bar
  for an image and a table; *Reference a figure* and *Reference a table* in the Text group beside
  *Reference an equation*; a reference drawn as *Figure 3* and *Table 2*.
- The kernel: the run schema and the content shape, the reads, the harness copy, the tests, the
  rebuild — the tasks `BO_0290_001`–`BO_0290_006` took.

## Decided

Answered by the user on 2026-09-23. Each line is a requirement of the change and is transferred
as tasks at draft.

* **An execution's output picture is numbered in the document** (`BO_0295_Q1`). An accepted
  `output` block permits `numbered` and `caption`, set by the person after acceptance as on any
  block — the kernel writes neither, since it writes the output as a proposal and the ask is a
  person's — and its first picture is the figure, counted with the images in one sequence. A
  sentence refers to it with `figureRef`, and the manuscript projects the number the document
  shows (`BO_0293`).
* **A number needs no caption** (`BO_0295_Q2`). The number is the author's ask and nothing else: a
  numbered figure or table without a caption is drawn as *Figure 3* or *Table 2* alone, and the
  manuscript projects it with an empty caption. No refusal couples the two properties.

## Transferred

Promoted to draft by the user on 2026-09-23 and transferred the same day.

- `docs/system/ui-kernel.md`, *Figures And Tables Are Numbered*: `BO_0295_001`–`BO_0295_005`. The
  harness copy, the reads answering captions, asks and numbers, the run schema naming `figureRef`
  and `tableRef` with its refusals, the verification, and the rebuild with the release-notes line.
- The graph, staged from a checkout at dataRevision 2239 as `node:chg-e364b9a2b6baf186`, two
  files of `documents` and nothing else (34 additions, no removals), accepted by the user on 2026-09-23: `block-document-model.md`
  gains *Figures And Tables Are Numbered* with the decisions and `BO_0295_006`–`BO_0295_009` (the
  declarations, the run primitives, the numbering in the read with the revises, the `structure`
  convention); `block-editor.md` gains the same section with `BO_0295_010`–`BO_0295_014` (the
  caption, *Number this*, the two references, the render-harness proof, the walk). Tasks only.
- The change document stays in this repository only until it completes, then stands in the graph
  as a member of `documents`, whose code it changes, as `BO_0290`'s does.

### Technical decisions taken at transfer

- Figures are one sequence over `image` and `output` blocks, tables another over `table` blocks;
  equations keep their own.
- An output's caption and ask are set by a command refused on a proposed output, so the kernel's
  staging of an output stays the only write an execution makes.

## Implemented

Set to ready by the user on 2026-09-23 and implemented the same day.

- The kernel half landed here (`BO_0295_001`–`BO_0295_004`, `ui-kernel.md`): `agenttools/figures.go`
  and its test, the fixture widened. The published run schema now also names `math` and
  `equationRef`, which `BO_0290_003` admitted in the handler but never published.
- The graph half (`BO_0295_006`–`BO_0295_013`) is staged from head 2373 as
  `node:chg-0e0b13de0822c561`: 23 files and 4 members, projected and compared byte for byte.
  The first staging, `node:chg-59a098a08d374de5` from 2268, could not be accepted: truth had moved
  under four of its files. It was rebased by reapplying the same patch, with one import added by
  hand where head had reordered `block-text.tsx`'s imports. `node:chg-fe2d40a46a826073` was
  rejected.
- The graph half was accepted on 2026-09-24 and served from pin 2414; the kernel was rebuilt the
  same day with `BO_0293_009`'s rebuild.

## Walked

2026-09-25, at pin 2552, by a class-agent probe (`bo0295`, retired after) in its own proposal branch
on the *Test* document, driven by Playwright from the stack's network (`.local/walk-0295/`): a probe
stages and never establishes, so the branch is where its numbering could be read. Numbering and
captioning the picture, adding and numbering a table, writing a figure and a table reference from
the bar, inserting and numbering a table above them with the reference following to *Table 2*,
retiring the table and the picture with each reference saying so, and a Claude Code run proposing
a sentence with a `figureRef` run into the branch all held.

- One fault, fixed the same day and proven in the render harness: the label of a block already
  numbered did not follow when a block was numbered above it — the row is keyed by revision and its
  block is set at mount, while a number changes no revision — so the sentence said *Table 2* and the
  table said *Table 1.* until a reload. Every numbered view now takes its number from the read's map,
  the equation's included (`block-editor.md`, Figures And Tables Are Numbered).
- The release-notes line is written under *Added* (`BO_0295_005`).
- The owner walked the rest at pin 2625 on 2026-09-25 ("works") and `BO_0295_014` is folded into
  `block-editor.md`; the graph was exported and the change set to completed the same day.

## Depends On

- `BO_0290` (math in documents), wip: the idiom, and `BO_0290_017`'s bar controls that the figure
  and table references join.
- `BO_0293` (a manuscript out of the record) depends on this change, not the other way around.
