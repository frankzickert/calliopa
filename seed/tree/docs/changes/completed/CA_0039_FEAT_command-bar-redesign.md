# CA_0039_FEAT_command-bar-redesign

Status: completed

Requested: 2026-09-10, with a mockup of one bar: a round agent avatar with a chevron at the left; a rounded field reading *Ask Calliopa or add context…*; along the field's bottom edge a paperclip, the chips `#1`, `#3`, `#5` and a `+`; a round play button at the field's right end. **create a change for redesigning the command-bar, here is a layout (apply the base design from calliopa). at the left, there is the agent selector (dropdown with image) then, the references are listed at the bottom of the input field. when clicked, mark the corresponding area in the main doc. remove the "Result dropdown".- Propose into "doc" is the default. but show a thin area right above the input field" with the document title (slightly grayed) where this agent should work. no "+" button in the input field. move the command-mode toggle left to the ative document above the area shown in the image.** User statement.

## Where This Starts

- **The composer is a stack of form rows.** `shell.tsx`'s dock section renders, top to bottom: the handle; the view's contributed action (`DockActions`, for a document the *Command mode* toggle); a visible *Command* label over the textarea (`CommandField`); the *Result* select (`DeliverySelector`, `BO_0226_005`); the marks line opening onto each reference with its words and each pinned block (`PointingDisclosure`, `BO_0227_015`); a visible *Agent* label with its select (`AgentSelector`, `BO_0225_004`); *Run*; the notice line; the attachment chip; the undo line; and, in the console position, the run's activity and the process list (`workspace/commands-and-runs.md`).

- **The attachment is a dead end.** Dragging a process onto the composer sets `attachment` and shows it with a remove button, but `sendGoal$` never posts it: the body is `goal`, `agent` and the command target alone. The chip promises context the run never receives.

- **`BO_0228` (draft) replaces the agent select** with a control showing each agent by the face of a Calliopa character, remembered per instance. By the user's decision of 2026-09-10 that control is a dropdown, not the three-state toggle `BO_0228` first specified; `BO_0228_011` builds it. This change places it.

## Intent

* The composer is one bar: the agent dropdown at the left, then the field, with the command's references listed along the field's bottom edge and *Run* at the field's right end.

* The agent dropdown shows the chosen agent's face (`BO_0228`'s control).

* Pressing a reference in the bar shows the area it points at in the open document.

* There is no *Result* control. A command from an open document proposes into it by default. A thin strip right above the bar names the document the agent will work in, its title slightly grayed.

* The command-mode toggle sits in that strip, left of the document's title.

* The field carries no `+` button.

* The bar takes Calliopa's own design, not the mockup's colours.

## The Shape

### The strip

- **One thin line above the bar holds the view's action and the aim.** On the left, the active view's contributed action, which for a document is the *Command mode* toggle. Beside it, the active document's title in `text-muted`. At its end, a `×` that dismisses the aim. The dock's action area moves into the strip rather than being duplicated there, so the fixed rule that *the dock renders the active view's contributed action* holds, and the strip rides with the composer as the action area does: present at the composer and console positions, absent at the collapsed handle.

- **Dismissing the strip is how a reader asks for words instead of a proposal.** The strip then reads *Answer in the console*, with the title as a control that brings the aim back. The command stays aimed at the document with `delivery: answer`, exactly as today's *Answer in the console*: the run reads the document and the references and stages nothing, and the chips stay, so *what does #3 mean?* is answered in the console. The choice is kept per document, as `DeliveryChoice` keeps it today: another document comes forward on propose, and the first document's dismissal is still there on return. So the delivery is still the reader's to state and the run still never infers it from the command's words (`BO_0226`); only the control changes, from a select to the strip.

- **On a tab that is not a document** there is no title and no `×`, and a command answers in the console as it does today. The strip carries the view's action if it has one, and is absent when there is neither.

- A long title truncates with an ellipsis, and the full title is in the strip's accessible name.

### The bar

- **The agent dropdown sits at the left**, vertically centred on the field: the chosen agent's face in a circle and a chevron, and no name, as `BO_0228_011` specifies it. The visible *Agent* label goes; the control's accessible name carries it (*Agent: Codex*), and the open list shows each agent's name.

- **The field** is rounded and grows with its text up to a bound, then scrolls. The visible *Command* label goes. The placeholder is not a label, so the field keeps a visually hidden one.

- **Run is a round button inside the field at its right end**, with a play glyph and the accessible name *Run*. It keeps today's behaviour: disabled while sending, an empty field starts nothing.

- **The notice line stays directly under the bar**, so a refusal is still shown beside the control that was pressed (`CA_0022_018`). That includes a stale passage refused at *Run* and `BO_0228`'s *opened on Codex* fallback.

- The handle, the undo line and the console with its activity and process list keep their places.

### The references

- **Along the field's bottom edge, one chip per reference in mark order**: `#1`, `#3`, `#5`. After them, one chip per pinned block, carrying a pin icon and no number, since a pinned block is a standing rather than a reference. The chips replace `PointingDisclosure`. The words it listed move into each chip's accessible name (*Reference 3: "…the quote…"*, *Pinned: "…the block's opening…"*) and onto the page, where a press shows them. The chips are built from the same `commandTarget` value the body is, so what the bar shows and what is sent still cannot differ, and a pinned block is still shown and never sent.

- **Pressing a chip (click, tap, `Enter` or `Space`) shows its area in the document.** The document scrolls it into view and briefly emphasizes it: a block's outline, or a passage's highlight. This works in either mode and leaves no trace afterwards. The shell asks the view through a new bridge store, `reveal`, written by the shell and read by the view as `proposed` is, carrying the target, the reference and a sequence number so a second press on the same chip reveals again. `view-types.md` gets it.

- **A stale passage's chip says so** with the `warning` token, an icon and *stale* in its name, never colour alone. Pressing it scrolls to the block that lost its words.

- **Chips carry no `×` and no `+`.** A reference is taken back where it was marked, in the document, which stays the list (`command-mode.md`). The `#` typeahead keeps working, but its offer opens as a list above the field rather than in the chip row, so a chip always does exactly one thing.

- The chips wrap onto a second line when they do not fit. With no references and nothing pinned the row is absent and the field is one line tall.

### What goes

- `DeliverySelector` (the *Result* select) and its test.

- `PointingDisclosure` and its test.

- The visible *Command* and *Agent* labels.

- The drag attachment: the composer stops being a drop target (`data-accepts`), and the attachment chip and the shell's `attach-to-command` handling go, along with the failed-process attachment scenarios in `drag-and-drop.md`. The paperclip in the mockup is not built here. Attaching a file as context is `BO_0229`.

### The design

- **Calliopa's theme, not the mockup's palette.** Only the semantic tokens are used: `panel`, `panel-raised`, `border`, `text`, `text-muted`, `accent` and `warning`, with `--font-ui`, in both themes. Style tests already reject literal colours (`CA_0002_012`). *Run* takes `accent` instead of the mockup's blue, and the agent's face replaces the mockup's purple sparkle.

- **Calm until engaged.** The field is set off by a fine `border` on `panel-raised`, not a card shadow, and chips are `panel` with a `border`. Focus rings follow the shell's.

- **Touch first.** On a coarse pointer the dropdown, every chip, the `×` and *Run* are at least 44px. On a phone the bar spans the width and the strip truncates first.

## Out Of Scope

- Attaching files or process results to a command (`BO_0229`).

- Reordering references. Numbers stay in mark order (`command-mode.md`).

- The console's layout, the handle and the undo line.

- The agent dropdown's own behaviour: its list, the reasons, the remembered choice and the fallback notice are `BO_0228_011`'s.

## Order

- This change lands after `BO_0228`'s shell half and starts from the pin that half is accepted at, because it places `BO_0228_011`'s dropdown. It also needs `BO_0227`'s reference union and pinned blocks, which are on the accepted pin already.

- It bears on `BO_0230` (the dock cannot be closed on a phone). One cause `BO_0230` suspects is the dock's height since `BO_0225`–`BO_0227`, and this change removes three of those rows: the *Result* select, the disclosure and the agent's own row. Whichever change reaches its walk-through second checks the handle on a phone against the other's result.

## Decided

Decided by the user on 2026-09-10, while this change was shaped:

- **Dismissing the strip answers in the console about the document.** The references still travel, as today's *Answer* does. The alternative sent the command aimed at no document, with the chips gone.

- **The paperclip is not built here.** Attaching a file is its own change, `BO_0229`. Leaving the drag attachment in place, or letting the paperclip attach a process result, were the alternatives.

- **The agent control is `BO_0228`'s, as a dropdown.** It shows the face alone when closed, as in the mockup. `BO_0228`'s three-state toggle and a closed control showing the name were the alternatives.

- **Pinned blocks show as pin chips** after the references. Leaving them out of the bar was the alternative.

## Verification

- In Qwik's render harness, pressed as the composer wires it, asserting attributes, with each case shown to bite by deleting what it presses:

- the strip with the toggle and the grayed title on a document tab, and none of it elsewhere;

- the `×` switching the posted delivery to answer, the title bringing propose back, the choice kept per document, and propose again when another document comes forward;

- the chips in mark order, the pin chips after them, and their accessible names carrying the words;

- a chip press writing `reveal` and a second press writing it again;

- the stale chip's state;

- no *Result* select, no disclosure and no drop target.

- The block editor reading `reveal`: it scrolls the block or passage into view and emphasizes it, in command mode and in reading mode.

- `tsc --noEmit` clean, the unit project green, both production bundles built.

- On the instance, on a desktop and on a phone: mark two blocks and a passage and pin one, find `#1`, `#2`, `#3` and a pin in the bar, and press each to see its area. Dismiss the strip, run a command and read `delivery: answer` in the run record; bring it back, run one and read `delivery: propose`. Toggle command mode from the strip.

## Transfer

Transferred on 2026-09-10 as `CA_0039_001`–`CA_0039_007` into the shell's docs, staged as `node:chg-c055b9de74794b26`. The strip, the bar and the reference chips (`_001`–`_003`) and the verification (`_007`) are in `workspace/commands-and-runs.md`; `reveal` on the view bridge (`_004`) is in `workspace/view-types.md`; the editor reading it (`_005`) is in `documents/command-mode.md`; and the composer no longer being a drop target (`_006`) is in `workspace/drag-and-drop.md`. `BO_0228` has landed since this change was shaped: `AgentMenu` already shows the face alone with no visible label, so `_002` places it unchanged and replaces the grid that put *Run* beside the field. `BO_0230` has landed too, so this change is walked second, and `_007` checks the handle on a phone. `BO_0229_010` puts its attachment chips at the start of `_003`'s row. `_004` comes before `_003` and `_005`; `_001`, `_002` and `_006` can go in any order; `_007` comes after promotion. Two technical choices were made at the transfer: the delivery keeps `DeliveryChoice` as it is, and the two new glyphs are Phosphor `play` and `push-pin`, inlined as the shell's icons are.
