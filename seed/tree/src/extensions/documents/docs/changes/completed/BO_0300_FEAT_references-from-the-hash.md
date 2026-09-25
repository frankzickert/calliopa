# References From The Hash

Status: completed

Requested: 2026-09-25, during the walk of `BO_0293`. In the user's words: *referencing works, but
is not usable. remove the "referencing" from the toolbar. it should go into the text and work like
"#..." when pointing to other blocks. so, extend "#" list. in fact, also "generalize" the #-block
reference. this is also valuable for manuscripts when i point to somewhere else in the text.* This
document shapes the change; it authorizes no implementation.

## What Is Asked

* A reference is written where the sentence is: typing `#` in the block being edited opens the
  one list, and choosing an entry writes the reference at the caret. The three bar choices —
  *Reference an equation*, *Reference a figure*, *Reference a table* — go.
* The list offers more than the numbered blocks. A reference may point at any block of the
  document — a section by its heading, a paragraph, a table, a picture, an equation — so a sentence
  can say *see Section 2* or *as argued above* with a reference that follows the block, as a
  figure reference follows its number today.
* A manuscript carries every such reference: a numbered block as its number (`Figure 3`,
  `Table 1`, `(2)`), a section as `Section 2`, and whatever the answers below decide for a block a
  paper cannot number.

## Where This Starts

At head 2665 of the dogfood instance, release 0.4.0 plus the walk fixes.

- **`#` already opens a list in the block being edited.** Under `BO_0267` (*Typing `#` in the block
  being edited offers its references by number, as the command field did*, user decision
  2026-09-18) the list holds command mode's references — the blocks and passages a reader marked
  for a prompt, numbered in mark order, `#1`, `#2` — and choosing one writes that number into a
  prompt. Those numbers are pointing for a command, retired with their marks, and mean nothing to
  a reader of the finished document ([Command Mode](../../graph/tree/src/extensions/documents/docs/system/documents/command-mode.md)).
- **Three reference runs exist, each written from the bar.** `equationRef` (`BO_0290_025`),
  `figureRef` and `tableRef` (`BO_0295_012`) are runs carrying a block's identity; the read
  resolves each to the number the document's order gives the block and draws it as *Figure 3*,
  *Table 2*, *(1)*, or *(figure gone)* when the block left the reading order. The kernel's run
  schema names the three (`internal/kernel/agenttools/figures.go`, `BO_0290`'s reason for a `BO`
  change), and a run may write them.
- **The manuscript projects the three as LaTeX references** (`manuscripts`' `server/project.ts`):
  `Figure~\ref{fig:<id>}`, `Table~\ref{tab:<id>}`, `\eqref{eq:<id>}`, each pointing at the label
  the block's float or equation carries. A heading is a Pandoc `Header` with the block's id as its
  identifier, so it already has something a `\ref` could point at; a paragraph has nothing.
- **A block has no name but its position.** Headings are the one block kind a reader names by
  words. A paragraph is named by the section it stands in, or not at all.

## The Shape

- **One list, one gesture.** `#` opens a list of what can be referred to: the numbered figures,
  tables and equations by number and caption, the headings by their words, and the other blocks by
  their first words. Choosing writes one reference run at the caret. The command-mode entries
  (marked blocks for a prompt) stay in the same list when the block is a prompt, since pointing
  is a reference too; how the two are told apart is a question below.
- **One run kind for all blocks, resolved by what the block is.** A `blockRef` run carries the
  block's identity, and the read answers what it is drawn as: the figure, table or equation
  number when the block is numbered, *Section 2* (or the heading's words) for a heading, and the
  answer to `BO_0300_Q1` for anything else. The three existing run kinds are read as `blockRef`
  from then on, or kept and joined by the fourth; a technical decision at transfer, but the kernel
  schema names whatever a run may write.
- **The manuscript labels every referenced block.** A referenced heading takes a `\label` and is
  cited as `Section~\ref`; a referenced paragraph takes whatever `BO_0300_Q1` decides.
- **Nothing is renumbered.** Section numbers are the venue's (LaTeX numbers sections); the
  editor draws a heading reference by the heading's words or its position, never by a number the
  document does not hold.

## Decided

Answered by the user on 2026-09-25. Each line is a requirement of the change and is transferred
as tasks at draft.

* **A referenced paragraph becomes a marked unit** (`BO_0300_Q1`). Any block may be referred to.
  A plain paragraph that is referenced is, in the manuscript, set apart with a marker of its own
  — the way a lemma is: named, numbered, labelled — so the reference reads as that marker and its
  number and the reader finds it on the page. A paragraph nobody refers to is set as prose, as
  today. In the editor the reference reads as the same marker and number.
- The marker's name is a technical default at transfer — *Remark* unless the venue's template
  names otherwise — set as a numbered environment the templates define, numbered in the order the
  referenced paragraphs stand in the reading order; the same reader-facing word is drawn in the
  editor.
* **In a prompt, `#` keeps meaning the mark** (`BO_0300_Q2`). One list; what is written depends on
  the block: choosing a marked block while a prompt is typed writes the mark number the run
  understands, as today; choosing any block in any other block writes a reference. Nothing new
  reaches the run, and the run schema is widened only by the reference run a person's text
  carries.
* **A reference reads as its kind and number and is clickable** (`BO_0300_Q3`). It is drawn as
  *Figure 3*, *Table 1*, *(2)*, *Remark 2*, or a section by its heading's words, exactly as the
  manuscript prints it, and a click on it takes the reader to the block it points at. Nothing is
  stored beside the block's identity, so a renamed heading updates every reference to it.
* **A reference to a block outside the reading order reads as gone, and comes back with it**
  (`BO_0300_Q4`). A retired, discarded or prompt target draws the reference as *(gone)* and the
  manuscript leaves it out with a line in what was left out; the reference itself is never
  removed, so when the block returns to the reading order the reference is live again with the
  block's current number.

## Transferred

Promoted to draft by the user on 2026-09-25 and transferred the same day.

- `docs/system/ui-kernel.md`, *References From The Hash*: `BO_0300_001`–`BO_0300_004` — the run
  schema names `blockRef` and `read_document` answers every reference as it is drawn, the
  verification, the rebuild, the release note under *Changed* after the walk.
- `docs/system/typesetting-service.md`: `BO_0300_013` — the venues' templates define the `remark`
  environment a referenced paragraph is set in.
- `documents`' `block-editor.md`, *References From The Hash*: `BO_0300_005`–`BO_0300_009` — the
  `#` list offering every block, the three bar choices removed, the drawing and the click, the
  verification, the walk. Staged in a proposal of its own, since the file is the busiest in the
  graph.
- `documents`' `block-document-model.md`, *References From The Hash*: `BO_0300_010`, `BO_0300_011`
  — the run kind, its resolution in the read with the remark numbers, the skill's convention, the
  verification.
- `manuscripts`' `system.md`: `BO_0300_012` — the projection carrying a section, a remark and a
  gone reference.
- This document stands in the graph as a change of `documents`, whose reference the change is,
  at the same status.

## Implemented

Set to ready by the user on 2026-09-25 and implemented the same day.

- **The fixed layer, here:** `BO_0300_001` and `BO_0300_002` landed — `blockRef` in the run schema,
  `read_document` answering every reference's label or `missing`, the checks, and the test over a
  real CCGW. `BO_0300_013` landed — both templates define `remark` with LaTeX's own `\newtheorem`,
  and the service's fourteen tests pass inside the running image. Open here: `BO_0300_003` (the
  rebuild, the user's) and `BO_0300_004` (the release note after the walk).
- **The graph:** `BO_0300_005`–`BO_0300_008` in `documents`' editor — the `#` list drawn by the
  command control, the three bar choices gone, the reference as a link that reveals its block, the
  harness cases — `BO_0300_010` and `BO_0300_011` in the model — `blockRef` in `ui.shell`'s run
  primitives, `labelReferences` in the read, the skill's `structure` convention — and
  `BO_0300_012` in `manuscripts`' projection. Open there: `BO_0300_009`, the walk.
- **Found on the way:** the `#` list `BO_0267` decided in 2026-09-18 existed only for a prompt's
  marks, drawn by the command control below the block being edited; this change built the block
  list into the same control, so one key opens one list wherever a block is edited. The reveal
  scrolls the target's row into view and focuses its reading element; the harness cannot see focus,
  so its case asserts the row brought into view.

- **The walk found two faults, fixed the same day (2026-09-25):** the `#` list had no styles — the
  composer whose classes it wore is gone since `CA_0039` — and now stands as a raised, scrolling
  panel; and the caret was measured in `runsText`, which drops every atom, so a reference chosen
  after a citation ate the words before it and two references could not follow each other.
  `runsPoints` (one point per atom) measures it now, and a `#` may follow an atom directly.

- **Walked by the user at pin 2848 (2026-09-25, "works")** after the two faults above were fixed:
  the `#` list as a panel, references to a heading, a figure, an equation and a paragraph, the
  click, the retire and restore, a prompt's `#` still pointing at its marks, the bar without the
  three choices, and the manuscript. `BO_0300_009` is folded in `documents`' `block-editor.md`;
  the release note stands under *Changed*.

## Depends On

- `BO_0293` (a manuscript out of the record), wip: the projection this extends.
- `BO_0295` (figures and tables numbered), wip: the two reference runs this generalizes.
- `BO_0290` (math in documents), wip: the first reference run and its idiom.
- `BO_0267` (blocks as commands), completed: the `#` list this extends.
