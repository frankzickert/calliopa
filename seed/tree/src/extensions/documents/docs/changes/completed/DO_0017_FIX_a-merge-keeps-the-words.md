# A Merge Keeps The Words

Status: completed

Typing after a merge wrote a block's words away. The user reported it on 2026-09-24, in the
document *Qc*: "i asked the agent and it gave an answer. i accepted and fixated one piece and
referenced this in the next prompt. that one block is gone now."

The block is not gone. It is the block they accepted and fixated, and it now holds the prompt they
typed next instead of the words they accepted. Nothing refused the write, and nothing in the shell
offers the words back.

## What The Graph Says

The document is `node:1ee6eece-c80a-4356-87ee-39f16c2cf91f`, and the block is
`node:76014f16-893e-46e3-9df0-1de4defb3376`. Every step is a commit of the reader's own principal,
in one minute:

- `2329` 05:07:35 — the reader accepts the insert of the block from run `ff175a7df69624aa`. It
  carries 652 characters, starting *That distinction does more work than the physics does…*.
- `2330` 05:07:42 — the reader fixates it. `disposition: fixate`, the words unchanged.
- `2332` 05:08:16 — an `insert` adds an empty paragraph to the document, order `zv`.
- `2333` 05:08:29 — `merge block 7ae043da… into 76014f16…`. The merge is correct: the revision it
  writes holds the 652 characters, since the absorbed block held none.
- `2334` 05:08:31 — a `revise` of the same block, against the revision the merge just wrote, whose
  whole content is `shape t` — the first characters of the next prompt. The 652 characters are
  gone from the block in one write.
- `2335`–`2353` — the prompt is typed out in that block, keystroke by keystroke. It still carries
  `disposition: fixate` and the `_proposal` of the run it came from.

The words survive as the archived revision the merge wrote (`created_data_revision` 2333), so this
is recoverable by hand, not by anything the reader can reach.

- The same reader has merged eight times since 2026-09-21. The one at `1138` behaved: the absorbed
  block had words, the merge joined 81 + 232 characters, and the next keystroke appended to 313.
  Three others absorbed an empty block into an empty block, where there was nothing to lose. This
  one is the first merge that kept a long text and then lost it.

## What The Code Does Today

- `input$` (`views/block-editor.tsx`) sets `editor.runs = runsFrom(element)`: the block's whole
  content becomes whatever the element that fired the event holds. `write$` then sends exactly
  that as a `revise` against `editor.baseRevisionId`. So a keystroke in an element that does not
  hold the block's words replaces them, and the write is well-formed — the base revision is right,
  so the graph has no reason to refuse it.
- `paintRuns` replaces the element's children whole, and it is the only thing that puts the words
  there. It runs from `ActiveBlockText`'s own visible task, tracking `editor.paint`.
- `adopt$` resets the editor through `idleEditor()` and then sets `editor.paint += 1`, so `paint`
  is 1 after every activation — it is a repaint signal, not a rising count.
- `merge$` saves, re-reads the document, sends the merge, and `structural$` reads the document back
  with the caret at `runsLength(survivor.runs)` — the join, which for an empty absorbed block is
  the end of everything the survivor holds. By design the editor that was active stays mounted
  until the render that mounts its successor (`CA_0045_003`), so between the merge's read and that
  render the focused element is the one the reader was in, and it holds nothing.
- Nothing anywhere guards a save against writing away words the reader never touched.

- The reproduction is not in hand. Three cases in the render harness all keep the words: the plain
  merge of an empty block into a long one, a proposal re-read while a block is open, and a
  keystroke delivered to the element the merge left behind (Qwik's delegation does not reach a
  detached element, so that one proves nothing). The harness is domino and settles its renders, so
  the window the instance shows is closed there. Judging it needs a browser walk on the instance.

## What Was Also True Of That Document

- The insert at `2332` took order `zv`, which is the order key of an unanswered candidate of run
  `258aacd0e06b35c0` (`node:fda89485…`); the fixated block's `zr` is the key of another
  (`node:9f022a08…`). Tied order keys are what makes rows jump (`DO_0004`), and where a new block
  lands among drawn proposal rows is `DO_0016`'s subject. Whether either of them is part of what
  the reader met here is open.

## What The User Decided

The user answered on 2026-09-24, on the report of the *Qc* loss.

* A save may not write away words the reader never touched. The editor knows what the block held
  when it opened it, so content that shares nothing with that, with no edit of the reader's in
  between, is not written as it is today.
* `Backspace` at the start of an empty block removes that block and puts the caret at the end of
  the block above it, rather than merging into it. A merge of an empty block changes no words and
  writes a revision of the block above for nothing.
* A reader can take an earlier revision of a block back from the shell — the words a merge or a
  keystroke wrote away.
* The cause is walked in a browser on the instance before any of it is shaped. The render harness
  cannot see the window this went through, so a fix shaped from the reading above would answer the
  shape of the defect rather than the defect.
* The words lost in *Qc* go back into the block that held them, with its fixate untouched, and the
  prompt typed over them moves into a block of its own directly below it. Done at dataRevision 2426
  (`change:e1ba2f56cdfffffb`), run by the reader: `76014f16…` holds its 652 characters again with its
  `disposition: fixate` and its `_proposal` intact, and the prompt stands as
  `node:b7b5e1de-3d24-4b9f-9a8f-2c3d3f5f4a61` at order `zu` directly below it.
* **The guard is at the input, not at the save.** A keystroke with a collapsed caret cannot make a
  block shorter, so a reading that comes back shorter with nothing selected is arithmetic that does
  not add up: `input$` drops that reading and repaints the element from the model. Nothing is
  refused and nothing is confirmed — at most one keystroke is lost. A selection accounts for what
  it replaces, so selecting a block's words and retyping them stays legal. User decision,
  2026-09-24.
* **Taking an earlier revision back is a control in the bar's block group**, on the subject block,
  listing its recent revisions to take one back from. `BlockHistory` (`server/work.ts`) already
  serves them. Not the retired list, which lists rows that are gone rather than revisions of a row
  that is there, and not a history panel of its own. User decision, 2026-09-24.
- Taking back writes forward: a new revision holding the earlier words. History is never rewritten.
  Technical decision, since nothing about it is visible beyond the words coming back.
* **A fixated block, and one accepted from a proposal, gets no protection an ordinary block does
  not.** Standing belongs to reading (`DO_0014`), so fixate is a reading mark and not a lock, and
  the guard above covers every block. Because a fixated block is standing context for a run, it
  reports when its words changed after it was fixated, the way `BO_0274` derives `edited`. User
  decision, 2026-09-24.

## What Is Left

- [ ] Walk the cause on the instance, before anything is shaped. Two paragraphs, the second empty,
  no agent and no proposals: caret in the empty one, `Backspace`, then type one character. If the
  first paragraph's words go, the merge loses them on its own and the proposals, the accept and the
  fixate had nothing to do with it. If they survive, walk it as *Qc* went — ask the agent, accept
  one insert, fixate it, add a block below the last row, `Backspace`, type.
- After the `Backspace` and before typing, three readings in the browser's console decide it:
  `document.querySelector('[data-block-editor]').textContent.length` (652 when painted, 0 when the
  element is empty), `document.getSelection().toString().length` (0 when the caret is collapsed) and
  `document.getSelection().anchorOffset`. An empty element puts the fix in the handover between the
  merge and the paint; a painted element with the whole block selected puts it in where the caret is
  put; a painted element with a collapsed caret means the account above is wrong.
- `DO_0017_001` and `DO_0017_002` are truth, 2026-09-24: the guard is `couldBeOneEdit` in
  `lib/runs.ts`, called by `input$`, and an empty block is retired rather than merged by `merge$`.
  Five tests in `views/merge-keeps-the-words.test.ts` and three in `lib/runs.test.ts`; the whole
  documents suite passes but for `never-waits.test.ts`, which fails the same way on pristine head and
  belongs to nobody here. `DO_0017_005` is truth too: walked at pin 2487 the same day, the words
  stay and the route is gone. `DO_0017_004` is **not** part of this change: the user dropped the
  hint for now (2026-09-24) once the shape of its cost came out, and the task stays in
  `block-document-model.md` with that cost written down.
- `DO_0017_003` is not part of this change either. Taking an earlier revision back recovers from a
  loss where `_001` and `_002` prevent one, and it carries a read that does not exist yet and a
  control of its own; it stays open in `block-editor.md` for a change that reaches `ready`. So this
  change closes on what stops the loss: the guard, the removal, and the walk that showed them
  working.
- The work was enumerated, 2026-09-24: `DO_0017_001`–`DO_0017_003` and `DO_0017_005` in
  `block-editor.md`, *A Merge Keeps The Words*; `DO_0017_004` in `block-document-model.md`, *A
  Fixated Block Says Its Words Moved*. `_005` is the walk, and it is the one that may add a task —
  the guard and the removal are worth doing whatever it says, so they did not wait for it.
