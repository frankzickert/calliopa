# The Instruction Chip Is The Size Of The Others

Status: completed

On a phone, the command bar is taller than one line of its buttons. The user reported it on
2026-10-03, with a screenshot taken after `documents`' `DO_0033` (pin 4286).

## What Is Reported

* The command bar takes more height than it should on a phone, although its buttons stand on one
  line. Reported by the user, 2026-10-03.

## Where This Starts

- Measured on the served build at pin 4286, in Chromium at 390 CSS px on a touch screen. The
  command line is 48px high. Every button in it is 24×24 except the instruction chip's toggle
  (`.instruction-chip__toggle`), which is 44×44.
- `views/instructions.css` gives the toggle `min-width: 44px; height: 44px` under
  `@media (pointer: coarse)`. That contradicts `documents`' fixed line in Command Mode, *A
  Contributed Control In The Chip*: a contributed control is drawn like the chip's own, 24px on
  every pointer, with no touch minimum (`BO_0273`, user decision 2026-09-21).

## Proposed Shape

- Remove the coarse-pointer rule. The toggle is then 24px high on every pointer, as its own comment
  says (*an icon the size of the chip's others*), and the line is 28px high.
- A test reads `instructions.css` and asserts that no rule gives the toggle a touch minimum.
  It is then measured on the served build at 390 CSS px on a touch screen: the line is 28px high.

## Boundaries

- `instructions` (`views/instructions.css`, the chip line in its system doc).
- Release notes: *Fixed*, in the same line as `DO_0033`'s command-bar fix.

## Done

Set to ready by the user on 2026-10-03 and carried out the same day. `PF_0002_001` is now truth in
[the system doc](../../system/system.md) (the chip control). `views/views.test.ts` asserts the
toggle's 24px and that no rule gives it a touch minimum; the `instructions` unit suite passes (9).
