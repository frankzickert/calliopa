# An Inbox Of Decisions

Status: completed

Requested: 2026-10-05, by the user. It was split out of `BO_0349` (curation by drop) the same day,
because it can land on its own. Later the same day it grew into the gesture-first way of working:
the person decides and does not work on the content, and a background Hermes prepares what comes
next (user decision, 2026-10-05).

AI answers are treated as a GTD inbox, not as a transcript. The person only ever sees one screen of
open decisions. Unlike GTD, acting on an item produces more content. The agent may lay out a path,
but only the next unresolved forks are shown. Everything else collapses into what the person has
already confirmed. The person navigates, orders and structures by gesture: swipe, pinch and drag
(`BO_0349`). Typing happens now and then, and what is typed names the thing being worked on.

## The Request

- **An active tray:** three to seven cards, each with the same three answers.
  - *Reject* removes the card from the path and leaves a trace.
  - *Keep for later* moves it to a deferred pile.
  - *Double down* turns it into the next command: elaborate, test, gather evidence, or split it into
    smaller decisions.
- **A path lens:** doubling down focuses that branch and dims the others. The way back to the
  previous summary always stays open.
- The product question: is Calliopa mainly for deciding what deserves attention next, or for keeping
  what has already become knowledge? The first screen picks one: active attention in front, and the
  accumulated knowledge one gesture behind.
- **No waiting:** the interface answers a gesture at once, so the AI has to have prepared the likely
  next actions before the person makes them.

## Gestures, Not New Controls

* This change adds no button and no menu. Every new act is a gesture: swipe, pinch, drag, or typing.
  The controls that stand today stay until experience shows they can go, and are then retired by
  later changes. User decision, 2026-10-05.
- The vocabulary mostly stands already. A right swipe keeps a block and accepts a proposal, and a
  left swipe removes a block and rejects a proposal, leaving a trace that *Show removed* reads back
  (`BO_0315`). A pinch on a block deepens (in) or gathers (out) as a run with no words (`BO_0322`).
  A drop on a block's middle nests, and `BO_0349` extends it.
* `BO_0349`'s field choice is no menu. While a block is dragged over a block that uses a structure,
  the target's fields show as drop zones, and the drop lands on one. User decision, 2026-10-05
  (`BO_0350_Q8`). The field choice landed as a popover under `BO_0349` (`wip`) the same day, so it
  is a control that stands: it stays until experience retires it, and the drop zones are what
  replace it then. `BO_0349` itself is not revised by this change.

## One Proposal Is One Decision

- Today a pinch-in run stages a rewrite plus new blocks below, each its own item, so one gesture
  costs the person as many swipes as the run made blocks. That is work, not deciding.
- A run proposes cards. A card is one decision: it may carry several blocks, and one swipe answers
  all of it. A right swipe puts it into the body, a left swipe dismisses it with a trace.
* A pinch on a card changes how finely the person decides. Zooming in splits the card into smaller
  decisions, each its own card. Zooming out merges them back into one. On a block, the pinch keeps
  deepening and gathering. Focused work keeps opening by its control and returning by *Back* and the
  crumbs, so no pinch navigates. User decision, 2026-10-05.
* On a desktop, a trackpad pinch over a card splits or merges it as a touch pinch does, and so does
  a key pair on the active card. User decision, 2026-10-05 (`BO_0350_Q10`).
- Only the next three to seven cards are drawn. What was swiped right is simply the document.
* A card stands in one place. A run stages one proposal group for each place it works on — a
  deepen's rewrite with the blocks it adds below, a gather on its block — and each group is a card,
  drawn where it applies. User decision, 2026-10-05 (`BO_0350_Q11`).
* Zooming in on a card that holds one item deepens it: a run refines that proposal with more detail,
  and the refined proposal stands as the card. Hermes may prepare it like any pinch. User decision,
  2026-10-05 (`BO_0350_Q15`).
- A card is a proposal group drawn collapsed. A swipe on it answers the whole group, as *Accept all*
  and *Reject all* do. Zooming in shows the group's items, each answered on its own, as items are
  today; zooming out draws the card again. Technical reading of `BO_0350_Q11`.

## The Tray Is In The Work

* A card is answered in the document it applies to, against the blocks it concerns, where every
  proposal is answered today. No surface judges cards away from their document, so `documents`'
  rejection of a review tab — one that judges a block's text away from the document it lives in —
  still stands. User decision, 2026-10-05.
* *Keep for later* is the person's mark on an unanswered item: who deferred it and when. It is
  written as truth, like every human write. The proposal underneath stays staged and unchanged. A
  deferred item leaves the tray for the deferred pile, and it comes back when its block changes.
  Otherwise it waits in the pile until the person opens it. User decision, 2026-10-05 (`BO_0350_Q1`).
* The person defers a card by dragging it onto the deferred pile. The pile shows at the screen's
  edge only while a card is dragged, and goes when the drag ends. Deferring asks for no reason; the
  person may type one on the deferred card later. User decision, 2026-10-05 (`BO_0350_Q5`).
* The existing *Show proposed changes* toggle also draws the deferred cards, in place and marked
  deferred. No other way opens the pile. User decision, 2026-10-05 (`BO_0350_Q12`).
* The cards stand only in the work they apply to. No place gathers them across documents; Hermes
  decides which work to bring forward. User decision, 2026-10-05 (`BO_0350_Q2`).
* Hermes brings work forward by marking it: the tab that holds it, or its library entry when it is
  not open. Opening a tab stays the person's act. User decision, 2026-10-05 (`BO_0350_Q16`).
* A card names the run it came from: the command and the block it was given from. There is no path
  strip. The route stays navigation only (`CA_0047`, rule 20). User decision, 2026-10-05
  (`BO_0350_Q3`).
- Nothing in the current frame draws a composer with nothing open. The composer and a command given
  with nothing open went with the dock (`workspace/commands-and-runs.md`), and the run list lives
  in the inspector's *Execution*, opened from the header's pill. `CA_0048`, which still describes a
  composer and a process sheet, is `idea`.

## Typing Names The Work

* The intent of the work is the document's title, as it is today, and only the person writes it.
  Nothing renames a document on its own. Hermes reads the title and the words of the person's
  commands as the direction to prepare for. User decision, 2026-10-05 (`BO_0350_Q13`).

## Hermes Prepares, The Agents Work

* Hermes leaves the agents a person sends commands to. It becomes the one assistant running in the
  background. It observes what the person does and which direction they are currently pursuing, and
  it learns how the person works, kept in Honcho. User decision, 2026-10-05.
* Hermes writes no content. It orchestrates: it decides which likely next actions to prepare, has
  the working agents run them, and structures what the person is shown. How much to prepare is
  Hermes's call, not a fixed budget. User decision, 2026-10-05.
* Hermes observes the person's acts — gestures, typed intents, what was kept, dismissed or deferred
  — and not reading time, scrolling or keystrokes. The person can read what it learned and erase
  it. User decision, 2026-10-05 (`BO_0350_Q6`).
* What Hermes learned is read in a category of its own in the right panel, one row for each thing
  learned. A row is erased by the left swipe, and by Delete on a desktop. User decision, 2026-10-05
  (`BO_0350_Q14`).
* On its own, Hermes chooses which cards are drawn and in what order, and how the work is presented:
  what is collapsed and what is dimmed, as the path lens does. It never changes the document's
  order or content. Those change only by the person's gestures, and a reordering Hermes wants is a
  card like any other. User decision, 2026-10-05 (`BO_0350_Q7`).
* Hermes picks the agent that runs each prepared action, on that agent's sign-in like any run. The
  card names the agent that made it, and no choice is swapped silently (`BO_0089_006`). User
  decision, 2026-10-05 (`BO_0350_Q9`).
- A prepared run stages a group that stays hidden. A gesture that matches it reveals the group at
  once instead of starting a run. A group whose base block has changed since is dropped, and the
  gesture runs live, streaming its first card. Preparing spends compute, and only showing a card
  spends the person's attention (`BO_0349`'s cost model).
- The gesture set is finite: on any block the next acts are the two pinches and the drops
  `BO_0349`'s table allows. Typing is the one input that cannot be prepared for, and it is what sets
  the direction of the next preparation.
- This collides with what stands. Hermes is one of three agents in the agent toggle (`hermes.md`,
  Agent Toggle, `BO_0228`). Its contract is *goal in, proposal group out*. Honcho runs under the
  `memory` profile and is wired to nothing (`hermes.md`, Scope Boundary). The Hermes container also
  hosts the Codex and Claude runners, and they stay.

## What Accumulates

- What builds up is not a pile of accepted answers but the structure the person confirmed over them:
  the accepted relations, the structures used and the instructions shaped (`BO_0349`). The tray is
  the proposals not yet judged, and the knowledge view would be that confirmed structure: the same
  object, read at two distances.
* The knowledge view is not part of this change. It belongs to `relations`, as its answer to
  `BO_0324_Q7`: how a person reads a block's relations back. User decision, 2026-10-05
  (`BO_0350_Q4`).

## Questions

- No functional question stands open.

## Where It Lands

- In the graph: `documents`' [Block Editor](../../graph/tree/src/extensions/documents/docs/system/documents/block-editor.md),
  *An Inbox Of Decisions* — the card, its swipe and pinch, the deferred pile, the arrangement drawn
  and the prepared pinch (`BO_0350_001`–`BO_0350_014`); the shell's Drag And Drop, Commands And
  Runs, Layout, Memory and Tabs — the edge pile, the agent menu without Hermes, the right panel's
  category of what Hermes learned and bringing work forward (`BO_0350_020`–`BO_0350_025`).
- In this repository: `docs/system/ccgw.md`, *An Inbox Of Decisions* — the `prepared` and `deferred`
  marks (`BO_0350_040`–`BO_0350_042`); `docs/system/ui-kernel.md`, *An Inbox Of Decisions* —
  prepared runs, the acts Hermes observes, the arrangement and the card convention
  (`BO_0350_050`–`BO_0350_059`, `BO_0350_065`; `BO_0350_055` moved to `BO_0351`); `docs/system/hermes.md`, *Hermes Prepares, The Agents Work* — the
  background loop, Honcho and leaving the agent menu (`BO_0350_060`–`BO_0350_064`).
- The change document stands in the graph as a member of `documents`, the extension where the cards
  are drawn, at the status it holds here.
- What the person sees changes in `bundled` extensions and the fixed layer, so it carries a release
  line under *Added* when it lands (`BO_0350_012`).

## Completion

- Completed 2026-10-05 by the user's decision without the walks: the Playwright walks on a desktop
  and a phone (`BO_0350_010`, `BO_0350_025`), the user's walk (`BO_0350_011`), the live walk behind
  real gestures (`BO_0350_064`) and the end-to-end verification (`BO_0350_057`) were not run. What
  stands proven is the unit and render suites, the kernel and core suites over CCGW, the
  orchestrator's suite, and one live call to the orchestrator on the dev stack, which answered
  preparations and an arrangement within the document it was shown. Nothing has been watched
  working end to end in a browser.

## Depends On

- `BO_0349` for drops as a source of proposals; the tray stands without it.
- `BO_0322` for the pinch on a block, and `BO_0315` for the swipe.
- `hermes.md` for the agent service, its toggle and Honcho.
- One card per place, `BO_0350_Q11`'s staging half, is `BO_0351` (idea), moved out on 2026-10-05 so
  this change completes with a card drawn in each place a run's group stands.
