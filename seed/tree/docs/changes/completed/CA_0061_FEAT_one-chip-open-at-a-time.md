# CA_0061_FEAT_one-chip-open-at-a-time

Status: completed

Requested: 2026-09-22, by the user: "when there are multiple chips of agentic changes, minimize
them: only the agent-image, the number of changes (only the number, no text), and the two
icon-buttons. when clicking the agent icon, expand that chip (and collapse all other chips)"

One chip says what a run left in the document, and it says it well. Several say it at the cost of
the line they stand on: each carries its words and both labelled answers, the line wraps, and the
wrapped line pushes the document further down the more runs the reader has going. This change makes
a crowded line minimal — a face, a number and two icons each — and makes the expanded chip the one
the reader is reading: expanding it shows that change in the document and collapses every other.

## Where This Starts

- **The line is the shell's to draw, its words the view's to report.** `RunChips`
  (`src/components/shell/run-chips.tsx`) draws the active tab's target's chips under the view bar
  and publishes its height as `--view-chips-height`, which the view adds to what it keeps clear
  ([Agent Activity](../system/workspace/agent-activity.md), `CA_0055_001`). Each chip is a
  `RunChip` on the view bridge: `key`, `group`, `face`, `tone`, `name`, one line of `text`,
  `ended`, `shown`, and for the reader's own proposal `session`, `working` and `accepts`.
- **A chip is a face, its words and two labelled answers.** The face and the words are one toggle
  button (`.run-chip__toggle`, `CA_0055_002`); once the run has ended, `.run-chip__answers` holds
  *Reject all* (the `x` sign and the words) and *Accept all* (`checks` and the words), or, under
  separation of duties, *Someone else accepts it.* in place of the accept (`CA_0057_003`). A
  session chip carries a pencil between them, which puts the tab to work in that proposal
  (`CA_0057_014`).
- **The words are a count, in words.** An ended group's `text` is `summaryWords` in `documents`'
  `lib/agent-at-work.ts` — *3 rewrites, 1 insert*, its unanswered items by kind. A running run's is
  `runningWords` — *Starting*, *Reading the document*, *Proposing changes*. A session's is
  *Proposal · yours · 14:32*.
- **The press shows or hides that one change.** It writes `toggleRun`, which the view answers
  through `shownGroups`/`hiddenGroups` (`CA_0055_006`): each change is shown or hidden on its own,
  so several may be shown at once. A shown chip takes its proposer's ground and reads as pressed; a
  hidden one is dashed with muted words (`CA_0057_015`).
- **The bar's toggle sets every change.** *Show proposed changes* shows or hides them all and
  clears what the chips set.
- **A running run's items stand whatever the chips hold.** A command run's proposals appear at
  their targets as it stages them and stay until they are answered, and its group joins
  `shownGroups` the first time it stages (`BO_0265_012`, `CA_0055_006`).
- **The line wraps and has no touch minimum.** `.run-chips` is a wrapping flex row; the chips lost
  their `min-height` under a coarse pointer, so the line is as high as its words (`CA_0057_002`).
  Nothing about the line changes with the number of chips on it.

## What Should Change

### A Second Chip Minimizes The Line

- With one chip nothing changes: it is drawn as it is today, face, words and labelled answers.
- With two or more, every chip that is not expanded stands minimized — the face, the number of open
  changes as a bare number, and the two answers as their signs alone. No words: not the summary,
  not *Reject all*, not *Accept all*.
- The number is what the words count today, summed: *3 rewrites, 1 insert* is **4**. It is the
  group's unanswered items, so it falls as they are answered and the chip goes with its last one.
- What the reader loses in words they keep in the accessible name. A minimized chip's toggle is
  still named for whose proposals and what they are, and each answer keeps *Reject all of <name>'s
  proposals*, so nothing is lost to a screen reader or to a hovering pointer.
- The line falling back to one chip draws that chip in full again, and changes nothing about what
  is shown.

### The Expanded Chip Is The One Being Read

- Pressing a minimized chip's face expands it: it takes back its words and its labelled answers,
  its change is shown in the document, and every other chip collapses and hides its change.
- Pressing the expanded chip's face collapses it again and hides its change. The line may stand
  with every chip collapsed and no proposals drawn at all.
- A collapsed chip is not highlighted: no proposer's ground, no pressed state. Only the expanded
  chip carries the tint that says its change is on the page.
- *Show proposed changes* keeps its place as the one control over the whole line: turned on it
  expands the newest chip and shows that change alone; turned off it collapses every chip and hides
  every change.
- One change at a time is the rule the line now holds to, and it is what makes the minimal chip
  honest: the reader is reading one run's proposals, and the chip that is open is the one they
  belong to.

### A Running Run Keeps Its Words

- A run that is still going is never minimized. It has no number to show — nothing of it is
  answerable yet — and what it is doing is the one thing worth the room, so it keeps *Starting*,
  *Reading the document* or *Proposing changes* while the ended chips minimize around it.
- Its items keep appearing as it stages them, whatever the other chips hold. A run at work is not
  the reader's reading, and the rule that its proposals show as they land is untouched
  (`BO_0265_012`).
- When it ends, its chip takes the expansion: its items are already on the page and stay there, and
  whatever was expanded collapses and hides. A run the reader has just watched work is the run they
  are about to answer.

### Your Own Proposals Minimize Too

- A session chip minimizes like a run chip — face, number, the two answers as signs — and keeps its
  pencil beside them, so putting the tab to work in a proposal stays one press away.
- Where *Someone else accepts it.* stands today, a minimized chip shows a warning sign
  (Phosphor `warning`) in the accept's place, titled with those words. The chip keeps the shape
  every other chip has, and the sign says the accept is not the reader's to give.
- The chip the tab works in is unchanged: its toggle stays disabled, since that session is the
  document the tab reads, and it keeps the accent that marks it (`CA_0057_014`).

Decided by the user, 2026-09-22: the line minimizes only from the second chip; a face's press
expands that chip, shows its change and collapses the rest; pressing the expanded chip collapses it
and shows nothing; a collapsed chip carries no highlight; the bar's toggle expands the newest; a
running run is never minimized and takes the expansion when it ends; and a session chip minimizes
with its pencil kept.

## Technical Notes

- The number has to come from the view: `RunChip` gains a count beside its `text`, which
  `runChipsOf` (`documents`' `lib/agent-at-work.ts`) fills from the same items `summaryWords`
  counts. The shell must not parse the words to find a number in them.
- One expanded chip at a time is a smaller state than the two sets the view keeps: `shownGroups`
  and `hiddenGroups` exist because each change is shown on its own (`CA_0055_006`), which this
  change replaces on a line of several. Whether the view keeps one expanded key or keeps the sets
  and holds them to one entry is the draft's to settle; the shell reports the press and the view
  answers it, as it does today.
- The expanded chip is the view's state, not the shell's, for the same reason the pressed state is:
  the shell files chips by target and the view decides what is shown. So `RunChip` carries whether
  it is expanded, and the existing `toggleRun` press is enough — no new bridge message.
- Minimizing is not a media query. It follows the number of chips on the line, which the shell
  knows as it draws them, so `.run-chips` marks the line and `.run-chip` the chip, and the words
  and labels go by CSS rather than by a second render path.
- The room the line takes shrinks with it, and `--view-chips-height` is already measured by a
  `ResizeObserver`, so the document follows without new work. The render harness cannot parse a
  custom property, so that stays the walk-through's to see (`CA_0055_001`).
- The suites to extend: `run-chips.test.ts` over `testing/run-chips-host.tsx` for the minimal chip,
  the number, the icons alone, the expansion collapsing the rest and the warning sign; `documents`'
  `agent-at-work.test.ts` and `lib/agent-at-work.test.ts` for the count, the one-at-a-time state
  and the ending run taking the expansion.
- The docs to change when this is drafted: `ui.shell`'s `workspace/agent-activity.md` — *The Agent
  At Work In The Document*, *Run Chips Under The View Bar* and *Proposal Sessions As Chips*, whose
  chip description and `CA_0055_002` press rule this rewrites — and `documents`'
  `documents/agent-at-work.md`, *The Agent At Work In The Document*, for what `runChipsOf` reports
  and what the toggle now means.
- It ships in a release: the line for `docs/release-notes/unreleased.md` belongs under *Changed*.
