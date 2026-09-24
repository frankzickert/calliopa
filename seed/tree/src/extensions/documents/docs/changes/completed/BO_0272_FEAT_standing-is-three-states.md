# BO_0272_FEAT_standing-is-three-states

Status: completed

Requested: 2026-09-20, by the user, after reading the standing scale back from the docs. Simplified
and decided on 2026-09-21.

A standing is three states, not five: **discard**, **keep** and **fixate**. Keep is the state a
block is in unless someone says otherwise — today's neutral, still the absence of a stored value.
Fixate is today's pin renamed, and keeps what pin does: the block stands behind every command
issued in its document. Discard is unchanged. Today's *resolve* and today's *keep* go: a block established
as resolved comes back discarded, and one established as the old keep simply rests, since the
resting state is now called keep. The swipe takes one action each way — left
discards, right fixates — with one threshold and no further state beyond the armed one. The bar
carries an info control that says what the three mean and how to set them, and a proposed rewrite,
insert or move can be swiped too: the swipe accepts it and the block it becomes takes the standing.

## Why This Is A `BO`

The scale is not the `documents` extension's alone. `internal/kernel/agenttools/standing.go` names
the same five values and owns `DispositionMeaning` — the wording shipped into every run's
instructions (`agentbridge/bridge.go`) and into `read_document`'s tool description
(`agenttools/documents.go`) — and the kernel reads `disposition == "pin"` at run start to gather
the blocks that stand behind a command. The change therefore spans the fixed layer, `documents` and
`ui.shell`, and is governed here (`AGENTS.md`, The Docs In The Graph), with the extension halves
enumerated in their own graph docs when this reaches `draft`.

## The Ask

1. **Three states.** The scale is `discard · keep · fixate`, replacing
   `discarded · resolved · neutral · keep · pin`. The `prompt` standing, off the scale and set by
   *Send* alone (`BO_0267_014`), is untouched.
2. **One action each way.** A swipe left discards, a swipe right fixates, and a swipe back from
   either returns the block to keep. The second threshold and the further state its reveal named
   go.
3. **An info control in the bar.** An info icon button says what each of the three states means and
   how to set it.
4. **A swipe on a proposal.** A proposed rewrite, insert or move can be swiped: the swipe accepts
   it, and the block it becomes takes the standing the release committed.

## Decided

### The scale

* The scale is three states: `discard · keep · fixate`. Keep is the resting state, the absence of a
  stored value, and is what neutral was called. Fixate is what pin was called and does what pin
  did: the block is left standing and is context for every command issued in its document. Resolve
  and the old keep are removed. User decision, 2026-09-21.
* The stored values are migrated, not merely renamed: established `pin` becomes `fixate`,
  `resolved` becomes `discarded`, `keep` is cleared — the resting state is what it now means — and
  the `text` declaration's permitted set narrows to `fixate`, `discarded` and `prompt`. Narrowing a permitted set is a breaking class, so the group
  carries an `ext.migration` covering the type (`validation.md`, `BO_0109_004`). User decision,
  2026-09-21.
* A block established as `resolved` comes back as a discarded block: the reader had already set it
  aside, and discard is the remaining state that says so. User decision, 2026-09-21.
* Keep carries no word and no glyph in the gutter, as neutral carried none. A mark means someone
  acted: only a fixated block, and a discarded row where it is revealed, carries one. User
  decision, 2026-09-21.

### The swipe

* One threshold per direction, the same distance each way, set between today's near (18% of the
  room, floored at 64–120px) and far (55%, 200–380px). User decision, 2026-09-21.
* The swipe component takes its thresholds and its action table as configuration rather than
  holding them, so another table can be put back without rewriting the gesture. User decision,
  2026-09-21.

### The info control

* The shell's bar action vocabulary gains a popover kind beside button, toggle, field and choice,
  so any view can hang explanation off a bar control. The `ui.shell` half of this change. User
  decision, 2026-09-21.
* The info control stands whenever the bar does, in a group of its own, rather than following the
  *Standing* group, which is drawn only while a block is active. User decision, 2026-09-21.
* It says the three states and how each one is set — the swipe, `Alt`+`Shift`+arrow, the bar's
  *Standing* choice and the standing toolbar in command mode. User decision, 2026-09-21.

### A proposal's standing

* A proposed rewrite, insert or move can be swiped, and the swipe accepts it before the block it
  becomes takes the standing. A removal, a work item and the *Possible relation* card keep their
  answer icons and take no swipe: a removal retires its block, so accepting one leaves nothing to
  carry a standing, and the others are not text blocks. User decision, 2026-09-21.
* A discard swipe on an agent's proposal accepts it and discards the block. `BO_0246`'s derived
  candidates keep their own rule — *Discard* rejects one, since a derived candidate is answered by
  use and the system re-derives what it needs. User decision, 2026-09-21.
* A proposal carries the same standing toolbar a text block carries, with the same three buttons,
  and that is the path that is not the gesture (`* No gesture is the only path`). The toolbar is
  command mode's, so a proposal's standing is set in reading mode by the swipe and in command mode
  by the toolbar. User decision, 2026-09-21.
* The gesture wins over the standing the block already carries, on a rewrite or a move, and on a
  rewrite of a fixated block: the swipe is the reader letting that rewrite in, and it is the most
  recent thing they said. User decision, 2026-09-21.
- An acceptance that is refused — stale, conflicted or drifted — writes no standing, and the
  refusal is said where the proposal is read, as it is today. *Take back* in the bar's *Document*
  group takes back the standing alone: answering a proposal is a saved operation the undo keystroke
  does not reverse (`proposed-changes.md`), and this gesture does not make it one. Derived from the
  rules already fixed, 2026-09-21; not separately decided by the user.

## Where This Lands

Named so the transfer at `draft` has its targets. Nothing is enumerated as a task yet.

- **The fixed layer, here.** `internal/kernel/agenttools/standing.go`: the constants and
  `DispositionMeaning`, which must name three states and say what each asks of a run; the run-start
  read that gathers `pin` blocks now gathers `fixate`. `agentbridge/bridge.go`'s standing note and
  `agenttools/documents.go`'s `read_document` description follow the one wording, and
  `agentbridge/marked.go` reads `discarded` for what has happened to a reference since it was
  marked. The golden instruction renderings change in that sentence alone. `docs/system/ui-kernel.md`
  carries the tasks.
- **`documents`, in the graph.** `lib/disposition.ts` — `SCALE`, `STANDINGS`, `LABEL`, `DONE`,
  `MARK`, `GLYPH`, `step`, `swipeTargets` — and `lib/swipe.ts`, which becomes configurable;
  `views/block-swipe.ts`, whose `rowOf` learns the proposal row and whose reveal drops its second
  word; `views/standing/`; the bar's *Standing* group and the new info group in
  `views/block-editor.tsx`; the `text` declaration and its migration; `block-editor.md` § Standing,
  `proposed-changes.md` and `block-document-model.md`.
- **`ui.shell`, in the graph.** The bar's action vocabulary — button, toggle, field and choice
  today — and the popover kind added to it (`src/components/shell/view-bar.tsx`, `inspector.tsx`'s
  control table, `src/contract.ts`), and `workspace/layout.md`, The View Bar. `CA_0058` completed
  on 2026-09-21 (walked at pin 698): the dock and its undo line are gone, the console is in the
  right panel, and the editor's take-back is *Take back*, leading the bar's *Document* group. So
  the info group joins a bar that already holds every control this change touches.
- **The release notes.** A *Changed* line for the scale and the swipe, and an *Added* line for the
  info control (`docs/release-notes/unreleased.md`); the migration is worth naming, since it
  rewrites what readers set.

## Transferred

- Transferred on 2026-09-21, fourteen tasks. The kernel's half is this repository's
  [UI Kernel](../system/ui-kernel.md), *The Standing Is Three States*: `BO_0272_001` the three
  constants and the run start's gather, `_002` the one wording and the vocabulary fixture, `_003`
  verification, `_004` the rebuilt image, `_005` the release-notes lines.
- The extension halves are staged into the graph as proposal `node:chg-d74155040b63296b` (base
  dataRevision 724): `documents`' `block-editor.md`, *The Standing Is Three States* — `_006` the
  scale module, `_007` the one configurable threshold, `_009` the bar and the info popover, `_010`
  the toolbar's three buttons, `_012` verification, `_013` the walk — `proposed-changes.md`,
  *A Proposal Takes A Standing* (`_008`), `block-document-model.md` (`_011`, the declaration and
  its `ext.migration`), and `ui.shell`'s `workspace/layout.md`, The View Bar (`_014`, the popover
  kind).
- The fixed lines this change replaces, each named where it stands: the five-state scale and the
  two-threshold swipe in `block-editor.md` § Standing, *Kept and pinned blocks carry their glyph
  and word in the leading gutter*, and the four-button standing toolbar; and `BO_0246`'s *a pinned
  block is never overwritten*, narrowed in `proposed-changes.md` to what a run stages rather than
  what the reader's own gesture accepts.
- Order: `_011`'s migration and the extension halves land before `_004` rebuilds the kernel image,
  since a kernel that knows only `fixate` reads an unmigrated `pin` as no standing.

## Implemented

- Implemented 2026-09-21. The kernel half landed here (`_001`–`_003`, `_005` folded into
  `ui-kernel.md`); the extension halves are staged in the graph as `node:chg-6e984ec25417d1ea`,
  70 files and 2 members — the narrowed `text` declaration and the `ext.migration` Block that
  covers it — with `documents`' and `ui.shell`'s docs folded into truth beside the code.
- One thing was decided on the way, inside the user's decision rather than beside it: the live
  graph carried no block with any disposition when the declaration was narrowed (90 text blocks,
  checked over CCGW), so no content operation travelled with the migration. A value written before
  the narrowing is read as what it became instead — `pin` as fixate, `resolved` as discard, the old
  `keep` as the resting state — by the kernel's `StandingOf` and the shell's `RETIRED`, so an
  instance that does carry one shows what the reader decided, and the next write stores the new
  value.
- Two names followed the state rather than staying behind it: the shell's command chips
  (`Pointing.fixated`, `FixatedBlock`, *Fixated: “…”*) and the derived candidate's control
  (*Fixate this framing*). Both were supporting work, recorded as `BO_0272_015` in
  `ui.shell`'s `commands-and-runs.md`.
- Verified: `go test ./internal/kernel/agentbridge ./internal/kernel/agenttools` green with the
  golden renderings changed in the two standing paragraphs alone; the tree's unit project 117 files
  and 1009 tests, `tsc --noEmit` clean, both bundles built; the shell's behavior suite over a real
  CCGW and a real kernel through `TestShellDocumentsOverCCGW`, 23 files and 117 tests. What is left
  is `_013` (the walk).
- Accepted and served 2026-09-21. The proposal drifted twice while `BO_0258` transferred into
  `block-editor.md` and `proposed-changes.md`; it was re-merged onto each new head by section, so
  that change's own sections stand untouched, and landed as `node:chg-e81a244d9ce53a35`. The shell
  serves it from pin 747, the `text` declaration permits `fixate`, `discarded` and `prompt`, and
  the rebuilt kernel carries the new run wording (`_004`).
- Walked on the served build at pin 747 on 2026-09-21 and it works (`_013`). One thing changed on
  the way: the swipe's reveal named its action only once the travel reached the threshold, which on
  a phone came too late to read — the reader was swiping at nothing. It now names the action from
  the first movement, as a chip at the row's moving edge, quiet until the threshold arms it
  (`BO_0272_016`, in `documents`' `block-editor.md`). The word beside the finger, not in a sliver
  of a strip.

## Open Questions

- None. Every point was answered by the user on 2026-09-21.
