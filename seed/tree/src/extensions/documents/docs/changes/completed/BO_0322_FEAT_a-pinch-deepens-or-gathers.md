# A Pinch Deepens Or Gathers

Status: completed

Requested: 2026-09-30, by the user. A pinch on a block asks for work on that block, with no prompt to write. Zooming in adds detail. Zooming out adds structure. Shaped in the graph as `documents`' `DO_0027`, which the user set to draft on 2026-10-01. It became this `BO` change on 2026-10-01 by the user's decision, because the kernel has to let a run propose gathering blocks into a block's focused work. The graph copy is `documents`' `docs/changes/BO_0322_FEAT_a-pinch-deepens-or-gathers.md`, and `DO_0027` leaves the graph. This document shapes the change. It does not authorize implementation.

In this document, *zoom in* means the fingers spread apart (the content grows), and *zoom out* means the fingers close (the content shrinks). The docs today call the first a pinch *outward* and the second a pinch *inward*.

## Behavior

### The Gesture

- The pinch is the core navigation metaphor on touch, and it is spatial. Zooming in dives into a block: it asks for the next useful layer of content. Zooming out rises to the layer around the block: it turns the content that has built up back into a shape someone can scan, share, or hand to an agent.
- Zooming in on a block no longer opens it as focused work. Focused work is reached through its control on the block's border. User decision, 2026-09-30 (Q1).
- No pinch goes back out of focused work. *Back* and the crumbs do. User decision, 2026-09-30 (Q11).
- Without a pinch, for a mouse and a keyboard, the same two runs are started from the block's command line. User decision, 2026-09-30 (Q2).
- A pinch runs with the agent and speed on the block's command line. The block's *Keep as content* toggle does not apply, since the block sends no words. User decision, 2026-09-30 (Q10).
- Each pinch sends its own working mode (`BO_0306`). The mode on the block's command line does not apply to a pinch, so the chip's warning that a run strayed from its mode keeps its meaning. User decision, 2026-09-30 (Q6).
- The run proposes; it does not write. What comes back is a proposal, reviewed like any other: accept, edit, or discard.
- No words are needed. A person who wants something else writes a custom instruction on the command line, as today.

### Zooming In: The Next Layer Of Content

- Zooming in on a block offers no choice and shows no ring. Releasing past the threshold starts one run on the block that does several things at once. User decision, 2026-09-30.
  - **Update**: it searches the internet for news on the block's subject. It adds newer facts or newer sources, or warns that the block may be stale.
  - **Deepen**: it adds detail at the same level of intent, such as examples, edge cases, mechanisms, trade-offs, or why it matters.
  - **Complete and clarify**: afterwards the block has to be clear and complete. The run finishes a fragmentary thought, keeping its direction, and restates what is vague, splits mixed ideas, and names the implied assumption. No one asks for this separately.
- The run proposes a rewrite of the block, which completes and clarifies it, and new blocks below it for what the search and the deepening found, each its own proposal. User decision, 2026-09-30 (Q20).
- The run sends explore + create, since it searches outside the block and adds to it. User decision, 2026-09-30 (Q19).
- Make, Connect and Challenge are dropped. User decision, 2026-09-30 (Q18).
- It is `documents`' own and replaces nothing: `calliopa-refine`'s *has anything under this moved?* (`BO_0258`) stays refine's. User decision, 2026-09-30 (Q9).

### Zooming Out: More Structure

- Zooming out on a block offers no choice and shows no ring either. Releasing past the threshold starts one run that summarizes and groups at once. User decision, 2026-09-30.
  - The block becomes the summary: its words are rewritten into a shorter form, such as a title, claim, takeaway, decision, todo, or one-line gist, covering itself and the blocks it gathers.
  - The surrounding blocks related to it become its children: they move out of the document's flow into the block's focused work. The block's face is the summary, the way focused work already shows a child on its parent. User decision, 2026-09-30 (Q12, Q13, as revised).
- The run reaches out from the block in both directions, one neighbour at a time, and gathers each neighbour that fits. At the first neighbour that does not fit, it stops in that direction. So what it gathers is always one unbroken stretch of the document around the block. User decision, 2026-09-30 (Q17).
- The block's original words are not lost. In the focused work, they are a child in their own place, between what was gathered above and below it, so the children keep the document's order. User decision, 2026-09-30 (Q21).
- The run sends consolidate + understand. User decision, 2026-09-30 (Q22).
- While the fingers close, the neighbours next to the block tighten on screen toward it. This is drawn only, as a hint. What is actually gathered comes from the run. User decision, 2026-09-30 (Q15).
- A block that already has focused work gathers into it: the gathered blocks join the existing focused work, in their order, and the summary covers the old child and the new blocks. User decision, 2026-10-01.
- The zoom-out proposal is reviewed whole: the summary, the focused work and every move are accepted or discarded together. Discarding leaves the document as it was, so nothing is half-gathered or duplicated. User decision, 2026-10-01.
- A gather is its run's whole proposal, and accepting or rejecting it takes the whole group in one step, without the kernel's confirmation page, when every member is content. This adds a second exception to the fixed rule that a whole-group acceptance is confirmed. User decision, 2026-10-01, at implementation.
- There are no separate Summarize, Group, Abstract, Map or Hide Detail choices. User decision, 2026-09-30.

## Replaces

- Two fixed lines are revised, and the user's decisions above are what that needs.
  - `ui.shell` `docs/system/workspace/focused-work.md`, *What Focused Work Is*: *"… on touch a pinch outward on a block — zooming in — does the same [opens it as focused work]; back, or a pinch inward, returns to the containing work"* (user decision, 2026-09-14). Zooming in now starts the run (Q1). Zooming out on a block now starts the summarizing run, and no pinch goes back (Q11).
  - `documents` `block-editor.md`, *Focused Work*, says the same of the adapter in `views/block-pinch.ts` (`CA_0047_006`, `CA_0065_011`).
- Another fixed line stays and binds the design: *"No gesture is the only path"* (the material's §42, §43). The command line is the path without a gesture (Q2).

## Functional Questions

- All answered by the user on 2026-09-30 and folded into *Behavior*.

## Transfer

Transferred on 2026-10-01, after the user set the change to draft, as `BO_0322_001`–`BO_0322_017`:
- `_001`–`_009` in `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, *A Pinch Deepens Or Gathers*: the pinch on the run's intake, its instruction line, the `gather` item, the reads, the base skill's `deepen` and `gather` conventions, verification, the release notes and the stack-up.
- `_010`, `_011`, `_014` and `_015` in `documents`' `block-editor.md`, *A Pinch Deepens Or Gathers*: the adapter, the hint, the behaviour test and the walk.
- `_012` in `documents`' `command-mode.md`, *A Pinch From The Command Line*. Its fixed line on the order of the command line is revised: *Deepen* and *Gather* stand just before *Send* (user decision, 2026-10-01).
- `_013` in `documents`' `proposed-changes.md`, *A Gather Is Answered Whole*. Its fixed line listing the item kinds gains `gather`.
- `_016` in `ui.shell`'s `commands-and-runs.md`, *A Pinch Is A Command*. `_017` in `ui.shell`'s `focused-work.md`, *No Pinch Opens Or Returns*, whose three fixed lines naming the pinch are revised there (`Q1`, `Q11`).

Order: `_001`–`_006`, then `_008`; `_016` and `_017`; `_010`–`_014`; `_007` before completion, and `_015` after promotion.

## Implementation

Completed 2026-10-01. The kernel half (`_001`–`_009`) is truth in `ui-kernel.md`; the graph half (`_010`–`_017`) is truth in `documents`' and `ui.shell`'s docs, accepted as `node:chg-da6814c97cd76cc5` and promoted at pin 3530. The user walked both pinches on the served build on 2026-10-01: each started its run, and each run did its job (`BO_0322_015`).

## Notes

- The code today: `src/lib/pinch.ts` (the shell's, pure: spread, the quarter threshold, `pinchOutcome`, `pinchProgress`) and `views/block-pinch.ts` (the adapter, which sets `data-pinch` and `--pinch` and presses the shell's focused-work control). With no ring, `pinchOutcome` keeps its two outcomes and the adapter maps them to the two runs instead of opening and going back.
- The zoom-in run's search uses the agent's search tool (`BO_0284`, the search service).
- Today a run moves a block only within its document (`propose_document_changes`' `move` sets `order`), and only a person creates focused work (`openFocusedWork`, the shell's). Gathering needs a new item kind in the kernel's document tools, which is why this is a `BO` change.
- The chip line *"Strayed from the mode: consolidating, it added 9 new blocks and withdrew or refined 0 proposals"* is the drift line of `BO_0306`. It shows why Q6 matters: a pinch has to send the mode its work implies, or its runs are flagged as having strayed.
- `CA_0073` (focused work opens its own tab, completed 2026-09-30) changed what opening focused work does. After Q1 the pinch no longer opens it, and zooming out becomes a new way to create focused work (Q12, Q13).
- The change touches the kernel (the gather item kind, the pinch on the run, the base skill's conventions), `documents` (the owner in the graph: the gesture on its block and the gather proposal) and `ui.shell` (`focused-work.md`, the send). `documents` is `bundled`, so a line in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` is due at completion.
