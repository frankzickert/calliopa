# BO_0227_FEAT_passage-references-and-dispositions

Status: completed

Requested: 2026-09-10, beside `BO_0226`, which gives command mode's marks their first consumer. **In the command mode, I want to have the ability to mark (highlight / refer to) passages, mark entire blocks to reference, swipe to keep or to pin, etc. That all worked in some other implementation.** Then: **Create a new change 0227 that follows 0226. I want to restore the entire feature. But I want to adhere to coding best practices.** User statements.

## Where This Starts

- **It worked, in the shell `BO_0200` retired.** The old `artifact` extension carried all of it: command mode with whole-block chips (`BO_0136`, pin 292), passage references anchored by quote with staleness and repair (`BO_0137`, pin 312), and the five-state disposition scale with its two-threshold swipe, a menu, the context-menu key, an Undo notice, discarded blocks out of the flow and pin as standing command context (`BO_0138`, closed at pin 569 on the user's own phone and desktop). The documents under `docs/changes/completed/` record every decision and every alternative rejected; this change does not reopen them without saying so.

- **The source is recoverable, and most of it should not be.** `86fb487` (`BO_0200`) deleted it from the seed tree; `git show 86fb487^:distribution/seed/tree/src/extensions/artifact/<path>` reads any file back. The pure halves are worth porting: `lib/passage.ts` (120 lines: anchor, resolve, key), `lib/disposition.ts` (78: the scale, its labels, the steps). The rest is not: `lib/swipe.ts` (409 lines) mixes the threshold physics with DOM writes, and everything visible lived in `components/reading.tsx` — **12,174 lines in one file**, with 2,667 lines of CSS beside it. Three of that surface's worst defects came from exactly that shape: a selection killed by a re-render of the component that rendered the text (`BO_0137`), a component-scope helper captured in a QRL and refused at runtime (`BO_0138`), and a `contenteditable` orphaned by one handler that never asked what another had decided the gesture was (`BO_0153`).

- **`~/projects/studio` carried a later port, and it confirms the scale travels.** `src/components/shell/document/block-swipe.ts`, `swipeOutcome` and `dispositionStep` in `src/lib/block-drag.ts`, `Alt`+`Shift`+arrow chords, and an ask field that sends the pinned and kept blocks as context (`src/lib/block-ask.ts`). It never had passages.

- **The shell today has the whole-block half only.** `CA_0020`: `src/lib/references.ts`, the dock toggle, numbers in mark order, the document as the list. `command-mode.md` excludes the rest by name — *"Not a passage reference"*, *"Not comments, annotations, or disposition"* — and `block-editor.md`'s *Later Editor Slices* lists *"passage anchors and passage-level references, disposition"* as changes still to come. `BO_0226` keeps the exclusion: its references are `{number, blockId}`, and `BO_0226_001` refuses two references sharing a block, which a block marked whole beside a passage inside it would be.

- **Read in the tree at head (`.local/tree-0226`, 2026-09-10), and confirmed at the transfer by reading the code** (the command-mode defect is measured on the served shell as part of `BO_0227_007`):

- **`BO_0137`'s defect is back.** In command mode the row's `onClick$` toggles the block's mark (`block-editor.tsx:2017`) and asks nothing about a selection, and a browser fires a click on the common ancestor of a press and a release — so a drag selecting a sentence in command mode marks its block. Fixing that is this change's first behaviour, as it was `BO_0137`'s.

- **The one pointer arbiter has no swipe.** `pointerIntent` (`src/lib/drag.ts:50`) answers any touch that moves before `LONG_PRESS_MS` (400) as `scroll`, measuring distance and not axis. A horizontal swipe has nowhere to be decided except a second arbiter, which is the arrangement `BO_0153` paid for.

- **The vocabulary can now say what the old one could not.** The `text` declaration requires `id`, `order` and `runs` and permits `role` from a set. Optional properties with permitted values are landed (`BO_0142_002`, used by `changeStatus`), so `disposition` can be declared with its four values — where the old graph validated `disposition: "banana"` (`BO_0138`, *System Tasks*).

- **A disposition would survive typing.** `reviseTextBlock` writes `SET b.runs = $runs, b.role = $role` (`src/server/documents/documents.ts:642`) and a split's head `SET b.runs = $head` (`:700`): property writes, so a property set by its own write is not erased by the next save.

- **A run could not see it.** `read_document` builds each block from `order`, `role` and `runs` alone (`internal/kernel/agenttools/documents.go:381`).

- **Undo is the dock's, and a view cannot offer one.** `shell.tsx` keeps one `undo` signal for a tab move (*Moved «title» · Undo*), and `command-dock.md` keeps undo among the things a view never renders into.

- **The component that would receive all this is already large.** `BlockEditorView` runs from `block-editor.tsx:380` to `:1761` in a 2,609-line file, and the marking state, its persistence task, the mode transition and the row's marking props all live inside it.

## Intent

* Everything the old surface did with pointing and standing comes back: a passage is referenced as precisely as a block; a block carries one standing on the scale discarded · resolved · neutral · keep · pin, set by a swipe on touch and reachable without one; every change of standing can be taken back; discarded blocks leave the reading flow without leaving the document.

* This time it reaches the run. What the reader pointed at — blocks and passages — travels with the command, and what they pinned stands behind every command issued in that document. The old slices built pointing and standing for a send that never existed.

* A passage never silently retargets. A reference matches its words or says it no longer does, keeps its number, and is repaired by pointing again.

* It is built to be maintained. Decisions live in pure, unit-tested modules; the DOM is touched by thin adapters; each gesture has one owner; the block editor gets smaller rather than larger. **Codebase Standards** below is binding on this change, not advice to it.

## The Shape

### Groundwork, landing before any behaviour

- **Marking leaves `BlockEditorView`.** The marking record, its recovery and persistence tasks, `setMode$`, `toggleReference$` and the row's marking props move into their own module (a `useMarking` hook and a context the row reads), with no behaviour changed. The existing tests are the proof that nothing moved but code. Passages and dispositions then extend that module and their own, never the view component.

- **One arbiter learns the swipe.** `pointerIntent` gains `swipe`: on a coarse pointer, movement before the long press whose horizontal travel clearly dominates its vertical travel is a swipe, where today it is a scroll. Vertical intent still scrolls and a mouse never swipes. The shell's drag coordinator and the editor's swipe then ask the same function, so they cannot disagree about one gesture. The dominance ratio and lock distance are constants beside the tolerance already there, carrying their reasons.

- **Command mode's press is decided once.** A press and release that did not move marks the block; a press that dragged selects text and marks nothing; a release that ended a swipe marks nothing and consumes the click it leaves behind. One handler reads the arbiter's answer. This closes the defect above before passages give the selection a meaning.

### Passages

- **Native selection, then an explicit act** (`BO_0137`, unchanged). Pointer drag, double-click, `Shift`+arrows; on touch, long press with the platform's own handles. Selecting adds nothing. A **Reference** control appears beside a selection inside one block while in command mode, takes the selection on `pointerdown` before a press can collapse it, and `Enter` does the same from the keyboard — `Enter` on a row with a live selection references the passage rather than toggling the block, decided by the same single handler.

- **One block per passage.** A selection dragged past a block's edge is clamped to the block it began in.

- **Quote-anchored, never offset-anchored.** The anchor is the block's identity, the exact quote, up to 32 characters either side to tell repeated occurrences apart, and a position hint that only orders identical candidates. It is re-validated each time it is drawn and each time it would be sent. `lib/passage.ts`'s `anchorAt` and `resolvePassage` port nearly as they stand, with the unit tests they never had. The offsets come from `editor-dom.ts`'s `selectionIn`, which already counts a rendered `<br>` as the stored `\n`.

- **One reference list, kinds told apart by type.** `Reference` becomes a discriminated union — a block reference, or a passage reference carrying its anchor — held in the one marking record in mark order. A record written before this change has no kind on its entries and reads as block references, so every stored session survives.

- **One number sequence for both kinds.** A passage takes the next number in mark order exactly as a block does — a block marked and then a passage read `#1` and `#2` — so there is one number space, and the rules `CA_0020` keeps for numbers (retired with the mark, never reissued while any mark stands) hold across kinds unchanged.

- **The document stays the list.** A resolved passage is drawn where it sits, with its number, by the CSS Custom Highlight API: a `Highlight` over a `Range` paints the words without writing a node into the text, which the rule every old slice relearned — nothing that changes while a selection is live may re-render the text — asks for. The number sits beside the range, out of the flow. The treatment is visibly not the whole-block outline, not the active block and not authored formatting, does not rest on colour alone, and leaves no trace when the mode ends.

- **Stale is a state, never a deletion.** A passage whose words are gone keeps its number and shows `#n stale` in its block's gutter, with its anchored quote in its accessible name. A selection in that block then offers **Re-point #n** beside **Reference**, and re-anchors the same reference under the same number, because the command may already name it. A reference whose *block* has gone is dropped, as `CA_0020` already rules for blocks.

- **A block and a passage inside it coexist** as two references (`BO_0137`, settled 2026-08-05). They say different things: *this paragraph* and *this clause of it*.

### Dispositions

- **One property, declared.** The `text` declaration is revised to permit an optional `disposition` of `keep`, `pin`, `resolved` or `discarded`; neutral is its absence, as `paragraph` is `role`'s. Validation then refuses an undeclared value at the write rather than storing it. The set starts at the four the scale needs, because narrowing a permitted set is breaking.

- **Its own write.** A `setDisposition` command on the documents API, parsed at the boundary like every other command, compiles to one `SET b.disposition = $disposition` through the bridge, a null clearing it, with the caller's base compared first. It is a change to the document and counts as one, as any revision does (`block-document-model.md`, *What A Document's Change Count Counts*). A split keeps the disposition on both halves, as it keeps the role; a merge keeps the surviving block's own.

- **The scale is one module.** `lib/disposition.ts` ports the scale, the labels and the verbs (`LABEL`, `DONE`) and the step rule — the near step from keep or pin goes to neutral before resolving, and from resolved or discarded to neutral before keeping. Every surface that names a state — the swipe's reveal, the bar's control, the announcement, the undo line, the accessible names — reads these tables, so a state cannot be called two things.

- **The swipe, on touch.** The two-threshold physics `BO_0138` closed on: the row follows the finger; near at 18% of the room with a 64px floor, far at 55% with a 200px floor, the room being the smaller of the row and the viewport and the far threshold capped at 72% of the viewport; reversal walks back through the states; release in the neutral zone commits nothing; a flick commits what is revealed and never the next state along. The reveal names the armed action at the block's moving edge and the further one beyond it, outward. The decision is a pure function of numbers (`swipeOutcome(current, dx, room, velocity)`) with its tests; the adapter that moves the row keeps its state outside Qwik, writes the transform directly, and hands the surface one committed state at release. It works on a reading row in reading and in command mode, never on the active block, and never while a native selection is live.

- **Paths without a gesture.** No gesture is the only path to a durable action. The bar carries a **Standing** control for the active block, because every other control acting on the active block lives there (`block-editor.md`, *Presentation*); and a keyboard chord steps a focused reading row along the scale — `Alt`+`Shift`+`ArrowLeft`/`ArrowRight`, as studio used, since a bare `Alt`+arrow is the browser's history. Confirmed unbound in this editor at the transfer. The chord never acts on the active block: there `Option`+`Shift`+arrow is macOS's word selection, so the bar is the active block's path. A pointer in command mode gets no path of its own: the chord reaches a focused row in either mode, and a mouse leaves the mode, activates the block and uses the bar — the marks survive leaving. No menu is added to a block.

- **Undo is the shell's, offered by the view.** The view bridge gains a way to offer an undo — the words and the inverse — and the shell shows it in the dock's existing undo line, replacing whatever stood there and cleared on a tab switch like the dock's action. One line says a thing can be taken back, whether the thing was a tab move or a disposition. The inverse writes the previous value; it is the separately named action `block-editor.md`'s *Undo* requires, never the undo keystroke.

- **What each state does.** Keep and pin mark the block in the leading gutter by glyph and word, not by the 2px-versus-3px bar that `BO_0138` recorded as the weakest thing it shipped; the mark sits beside a reference number when both stand. Resolved stays in place, quieted. Discarded leaves the drawn flow, stays in the document and its order, and is not markable; discarding a marked block takes its references with it, and the undo puts them back.

- **Discarded blocks come back in place.** The panel gains *Show discarded blocks* beside *Show retired blocks*, and with it on, each discarded block is drawn where it sits, dimmed, named as discarded, offering *Reopen* — the call `document-panel.md`'s *Retired Blocks In Place* made for retired blocks, for the same reason: the position is what makes it mean anything. Which blocks are drawn is one pure function over the reading order and the two toggles, beside `readingOrder` and `placeProposals`.

- **Discard and retire both stay.** Discard keeps the block's place in the order and is one swipe back; retire takes it out of the order and comes back through *Restore*. Every state is part of the row's accessible name.

### What Travels With A Command

- **The pointing widens.** `setPointing$` (`BO_0226_006`) carries the union; the route's body (`BO_0226_004`) and the kernel intake (`BO_0226_001`) take a passage as its block, its number and its quote. The intake's rules widen with it: two references still never share a number, two *block* references never share a block, and passages may share a block with each other and with a block reference. A quote is bounded, and a passage whose quote is not in its block's current text is refused at the intake — the kernel reads the artifact anyway (below), so a stale passage cannot reach a run even from a client that did not check.

- **A stale passage stops the command, visibly.** The composer refuses to send while a reference it would carry is stale, naming it beside `Run`, where the composer's refusals already show (`CA_0022_018`). Dropping it silently would send a command whose words name `#3` with no `#3` behind them.

- **Pinned blocks travel from where they are true.** A mark is device-local, so the client is its only source; a disposition is graph truth, so the kernel reads it. At run start, when the run names an artifact, the bridge reads the artifact's pinned blocks through the read the document tools use and records them on the run — what stood behind the command is then on the record, which is `BO_0173`'s reason for recording the artifact at all.

- **The instructions say both.** References render in mark order, a passage as `#3 → <blockId> "<quote>"`; pinned blocks render in reading order as the standing context the reader pinned for every command in this document. Rendering stays deterministic (`skill_selection_test.go:197`).

- **The run sees standing.** `read_document` reports each block's `disposition`, and the instructions say what each standing means to a run: discarded and resolved are set aside by the reader, not material to build on unless the command asks; a kept block is one the reader wants left standing, so the run proposes neither removing nor rewriting it unless the command names it; a pinned block is kept and is also the standing context above.

- **The composer names what it will send.** The marks line `BO_0226_006` adds counts blocks, passages and pinned blocks, and typing `#` in the composer offers the active document's standing references by number and inserts the one chosen. Typing a number that does not exist creates nothing.

- **The composer shows exactly what it will send.** The marks line is a disclosure: opened, it lists each reference by number with its words — a passage's quote, a block's opening — and each pinned block, in the order the instructions will carry them. It is built from the same value the post body is built from, so what it shows and what is sent cannot differ. The document is still the list of what was marked; the disclosure is the command.

## Codebase Standards

Binding on this change, and checked at review against the proposal's file list:

- **The view component shrinks.** `block-editor.tsx` ends this change with fewer lines than it started with. Every behaviour here lands in a module of its own; the view composes them.

- **Pure decisions, thin effects.** What a gesture means, where a quote resolves, which step the scale takes and what a record parses to are pure functions in `src/lib/` with `*.test.ts` beside them. DOM adapters hold no decisions; components hold no parsing.

- **One owner per event.** Every press, release, click and key a gesture produces is decided by one handler that reads one arbiter. Two handlers never arbitrate one event.

- **Nothing a gesture changes is read where text renders.** Gesture state lives outside Qwik; the selection affordance is its own component reading its own signal; only a committed state goes through render.

- **Types carry the cases.** References and outcomes are discriminated unions with exhaustive switches ending in a `never` check. Every value crossing a boundary — `localStorage`, a route body, the kernel intake — is parsed there and nowhere assumed. No `any`, and no cast from `unknown` without the parser that justifies it.

- **One source for words.** A state's label, verb and accessible phrasing come from one table.

- **Helpers at module scope.** A function a QRL uses is imported, never a component-scope closure (`BO_0138`'s runtime refusal).

- **Constants named, with their reason.** Thresholds, context length and quote bound are named where they are defined, each with the measurement that set it.

- **Port the logic, not the file.** `passage.ts` and `disposition.ts` are ported and given tests; `swipe.ts` is split into the pure outcome and a thin adapter; nothing of `reading.tsx` is copied.

- **No speculative shape.** No configuration for thresholds, no disposition node, no plugin point for gestures: `BO_0138`'s YAGNI calls stand until something needs otherwise.

- **Tests at every layer they belong to, each proven not vacuous** by breaking the thing it guards. Format the changed paths, not the tree (`BO_0137`'s slip).

## Out Of Scope

- **Disposition on a passage or a range.** Standing is a whole-block fact.

- **Disposition on a divider or an unsupported block.** The property is declared on `text` alone, as it was; a later change widens it if a divider needs standing.

- **Passage anchors in the graph, comments, annotations, persistent highlights.** A passage reference is command context and device-local, as marks are.

- **Fuzzy re-anchoring and repair by suggestion.** A quote matches or the reference is stale; offering the closest survivor is silent retargeting behind a dialog (`BO_0137`).

- **A passage across blocks.**

- **A run setting a disposition.** `propose_document_changes` proposes text and structure; a run proposing standing is its own change once there is a reason for it.

- **Iteration.** *Create an iteration from the kept blocks* is a command this change does not add.

- **A structural undo stack.** One line, one inverse, as `BO_0138` scoped it.

## Decided

Decided by the user on 2026-09-10, on the five points this change could not settle for itself. Each took the lean the document proposed; the alternatives are recorded so they are not re-proposed without new evidence.

- **A discarded block comes back in place, from the panel.** *Show discarded blocks* beside *Show retired blocks*, each discarded block drawn where it sits with *Reopen*. Declined: the old surface's count at the end of the flow, which loses where each block sat; and folding discard into retire, which would make setting a block aside cost its place in the order and a *Restore* to undo.

- **A pointer in command mode gets no path of its own.** The chord on a focused row and the bar's *Standing* control cover every state. Declined: a menu on secondary click, which would be the first control on a block that is not one of its grips; and a trackpad's horizontal swipe, which a mouse without horizontal scroll never has and which meets the browser's back-and-forward gesture.

- **The composer shows exactly what it will send**, as a disclosure under the marks line. A passage's reference is its quote, and pinned context is invisible in the document while the reader types in the dock. Declined: the count alone.

- **Keep tells a run to preserve.** A kept block is left standing: the run proposes neither removing nor rewriting it unless the command names it. Declined: keep as a marker the run is told nothing about, which is what `BO_0138` shipped for want of iteration; and keep as a weaker pin, which would leave the two barely apart.

- **Passages share the one mark-order sequence.** A passage is `#2` like a block, so there is one number space and `BO_0226_001`'s rule that no two references share a number holds unchanged. Declined: the old `#7.1`, whose first half named the block's document position — which this shell does not number by — and which a passage in an unmarked block would not have.

## Verification

- **Unit, in the tree:** the arbiter answering tap, selection, swipe, scroll and long press on both pointer kinds; `resolvePassage` over a unique quote, a repeated quote told apart by its context, a quote gone, astral characters and a `\n`; the marking record's union, its numbering and retirement across kinds — a block then a passage reading `#1`, `#2` — and a `CA_0020` record reading back unchanged; the scale's steps and reversal; `swipeOutcome` walked in steps at a 172px column and a 414px viewport, with a flick at the near threshold committing near and never far; which blocks are drawn under each combination of the retired and discarded toggles.

- **In Qwik's render harness** (`BO_0224_009`), each proven not vacuous by deleting what it presses: the Reference control appearing with a selection and absent without one; Re-point on a stale passage; the Standing control in the bar; a keyboard chord stepping a focused row; the *Show discarded blocks* toggle drawing a discarded block in place with *Reopen*; the composer's marks line, its refusal while a reference is stale, and its disclosure listing the references and pinned blocks in the same order as the post body it sends.

- **Behaviour, over a scratch graph** (`TestShellDocumentsOverCCGW`): `setDisposition` landing and clearing; a stale base refused with nothing written; an undeclared value refused by Validation; a save after pinning leaving the pin; a split keeping it on both halves.

- **In the kernel:** the intake taking a passage and refusing a shared number, a shared block between block references, an unbounded quote and a quote not in its block; pinned blocks read at run start and recorded; the instructions rendering passages and pinned blocks and saying what discarded, resolved, kept and pinned mean, identical across two renderings; `read_document` reporting disposition.

- **On the instance, and on a phone** — the half no harness answers, as `BO_0138` found three times: reference one sentence mid-paragraph beside a whole other block and read both on the page; edit the sentence and find `#n stale`; re-point it under the same number. Swipe right to keep, on to pin, back to neutral before release; swipe left past both thresholds to discard, take it back from the dock's undo line, discard again and reopen it in place from the panel's toggle. Reach all five states from the keyboard and from the bar on a desktop. Then issue a command naming the passage by number with a block pinned, and read the run record carrying the passage and the pinned block, its `read_document` call reporting standing, and its staged items against the passage's block. Last, keep a block and issue a command that would plausibly rewrite the whole document without naming it, and read that nothing is staged against the kept block.

## Transfer

Transferred on 2026-09-10 as `BO_0227_001`–`BO_0227_018`, each under a section *Passages And Dispositions*: the intake, the run start's read of the artifact, the instructions, `read_document`'s standing and the kernel verification in `docs/system/ui-kernel.md` (`_001`–`_005`); the groundwork, the arbiter, the passage models and page, the vocabulary member and write, the scale and swipe, the paths without a gesture, the offered undo, discarded blocks in place, the composer, the graph's docs, the tree tests and the on-instance verification in `docs/system/ui-shell.md` (`_006`–`_018`), the shell section repeating **Codebase Standards** as binding on every row. The graph-side docs the shell rows amend are `command-mode.md`, `block-editor.md`, `block-document-model.md`, `document-panel.md`, `command-dock.md`, `view-types.md` and `drag-and-drop.md`. This document travels into the graph as a `ui.shell` document through `kernel import-changes --file` when the work lands (`BO_0222_013`).

It follows `BO_0226` and starts from that change's accepted pin — its reference shape, `setPointing$`, `aim.pointing` and the composer's marks line are this change's base — never from `.local/tree-0226`, where that change was implemented.

**What the transfer found, beside confirming the list under _Where This Starts_:**

- **The editor cannot yet be pressed in Qwik's render harness.** `BO_0226_009` recorded it: the load task reaches the global `document` for the scroll restore, which the harness's DOM does not install. Every control this change adds sits in the editor, so the groundwork (`_006`) moves that reach behind a module the harness renders around — closing `BO_0226`'s gap on the way rather than proving this change's controls only on the instance.

- **The chord is narrower than the shape first said.** `Alt`+`Shift`+arrow is unbound in this editor, but inside an editable block it is macOS's word selection, so it steps a focused reading row only, and the bar is the active block's path (`_012`).

- **The run start already reads the graph** — for skill selection and intention resolution (`agentbridge/bridge.go:776`, `:907`) — and `agenttools`' `readDocument` is the read the tool makes. Exporting that one read for the bridge gives the pinned blocks, the reference check and the stale-passage check without a second way to read a document (`_002`). The same read makes a reference into a block the document does not hold refusable at the intake, which `BO_0226_001` could not check.

- **`BO_0226` wrote an invariant this change's third decision supersedes**: *"The composer says how many blocks are marked and in which document, never an enumeration of them"* (`ui-shell.md`, *Commands From The Open Document*). `_015` says so where it builds the disclosure, and `_016` carries it into `command-dock.md`.

- **A split already copies the role to its tail** (`splitTextBlock`, `documents.ts`), so the disposition follows the same line rather than a rule of its own (`_010`).

Order: `_001` before `_002`, `_003` after both, `_004` with them, `_005` last on the kernel side. `_006` lands first and alone, so the proof it changed nothing is not mixed with anything that does; `_007` next; `_008`–`_009` are the passages and `_010`–`_014` the standing, the two independent of each other; `_015` needs `_008` and reaches a run only once `_001`–`_003` are served; `_016` and `_017` go with their rows, and `_018` needs everything, a rebuilt kernel image, an accepted proposal and a promotion.

## Closed (2026-09-10)

**Completed on the user's word — "passed for now" — after the walk-through on the instance.** The kernel half (`BO_0227_001`–`005`) runs on the kernel image rebuilt with `scripts/stack-up.sh`; the shell half was staged in two proposals — the groundwork alone (`node:chg-58f64ecf32fe7b7d`), then `_007`–`_017` with the `text` member permitting `disposition` (`node:chg-b08b4fda52165190`) — and promoted at pin 176.

The walk-through found five defects, each fixed, verified and promoted before the next step:

- **The dock's Command mode toggle showed no state** (pin 179): `aria-pressed` was set, but every dock button shares a transparent rest, so the mode could be on with nothing showing it — and a reader who believed it on selected words in reading mode, where selecting opens the editor.

- **The composer's disclosure opened onto nothing, and the `#` offer offered nothing** (pins 182, 185, 190): both took `.references` of the view's report as a prop. The optimizer compiles a prop written as `object.field` through `_wrapProp`, reactive only when the object is a store, and before anything is marked the report is the plain `NO_POINTING` — so both lists were taken once, empty, and kept. Every harness test passed because tests built elements with `jsx()`, which the optimizer never rewrites; the reader's `outerHTML` found it. Both now take the report, and `composer-late-marks.test.ts` proves them through the shell's own JSX.

- **Nothing in the page took a passage back, and a command could name a `#n` that no longer stood** (pin 193): a passage is taken back by pressing its number or selecting its words again, and *Run* refuses a number whose mark is gone.

Not walked, and left as they stand: the phone swipe's feel under a thumb, and the two runs of steps 8 and 9 (the run record carrying passages and `pinned`; a kept block left unproposed). The kernel half those exercise is proven in its packages and the byte-identity check.

Follow-ups from the walk-through are their own changes: `BO_0230` (the dock cannot be closed on mobile) and `BO_0231` (standing in command mode, as icon buttons at a block's border — reversing this change's decision that a pointer in command mode needs no path of its own).
