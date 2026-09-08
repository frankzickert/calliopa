# CA_0024_FIX_dock-handle-first-tap

Status: completed

Requested: 2026-08-31

## Intent

The first tap on the command dock's handle can be read as a downward swipe and
collapse the dock instead of cycling it. It is intermittent, it is a real
user-facing behaviour rather than a test artefact, and it was found by a gate
run rather than by anyone using the shell.

## What Happens

[Workspace Shell](../../system/workspace/frame.md)'s dock handle carries three
handlers. `onPointerDown$` records where the pointer went down, `onPointerUp$`
treats a vertical movement of 40 pixels or more as a swipe, and `onClick$`
cycles the dock one position.

- The store initialises `dockY` to `0` (`shell.tsx:141`).
- `onPointerUp$` computes `delta = event.clientY - mobile.dockY` and calls
  `dockAfterSwipe` whenever `|delta| >= 40` (`shell.tsx:866`).
- Nothing records whether a pointer-down was actually seen.

So if `onPointerUp$` runs while `dockY` is still `0` — which is what happens
when Qwik has not yet resolved the `onPointerDown$` chunk on the very first
interaction — then `delta` is the pointer's absolute Y, several hundred pixels
near the bottom of the viewport. That is a downward swipe, and
`dockAfterSwipe` moves the dock one position *back* rather than forward.

- The bug is the initial value standing in for a measurement that never
  happened. `0` is a legitimate coordinate, so the handler cannot tell "the
  pointer went down at the top of the screen" from "no pointer went down".

## Evidence

- `pnpm run verify` on 2026-08-31, `tests/browser/drag.spec.ts:106` (desktop):
  the scenario taps the handle expecting `data-dock="console"` and the shell
  went to `collapsed` instead. Playwright's call log shows the element
  resolving first as `data-dock="composer"` and then twenty-two times as
  `data-dock="collapsed"` — the dock moved backwards from its starting
  position rather than forwards.
- It reproduces rarely: several gate runs the same day passed the same
  scenario. That is consistent with a race on first-interaction handler
  resolution rather than with a deterministic fault.
- Two other browser scenarios failed intermittently on the same day
  (`layout.spec.ts` mobile scrolling, `tabs.spec.ts` active tab). The first was
  a measurement helper that did not wait and is fixed. Whether the `tabs.spec`
  failure is this bug or a third cause is not known, and this change should not
  assume it.

## Shape Of A Fix

The two questions this change had to ask are answered, and both answers are
transferred into [Workspace Shell](../../system/workspace/frame.md)'s command dock
section as fixed lines.

- A pointer-up with no recorded pointer-down is not a swipe. The handler
  records that a press happened rather than choosing a better sentinel, because
  no coordinate can mean "no press".
- A tap and a swipe are exclusive. A release under the threshold is a tap and
  cycles the dock forward; a release at or beyond it is a swipe and suppresses
  the tap, so one interaction always moves the dock exactly one position.

- `CA_0024_001` through `CA_0024_003` carried the work, and are folded into
  [Workspace Shell](../../system/workspace/frame.md), which holds the truth: the
  release is the one reading of a pointer's gesture, the press is recorded
  rather than assumed, and the click a pointer leaves behind is left alone.

## Why Not Folded Into CA_0022

The agent layer change was in progress when this was found, and its author had
no claimed task covering the shell's dock gestures. Implementing a fix there
would have been a feature-implicating change outside any claimed task. The
finding is recorded here instead so it is not lost with the session that found
it.

## Verification Impact

- The existing scenario at `tests/browser/drag.spec.ts:106` already fails when
  the bug bites; what it lacks is a way to bite reliably.
- A scenario that drives pointer-down and pointer-up as separate events with a
  known offset would exercise the swipe path deterministically, and a scenario
  that taps without any pointer movement would prove a tap is never read as a
  swipe.
- The scenario that lacked a way to bite now has one: a release dispatched with
  no press before it is the race made deterministic, and it fails against the
  old handler on both form factors.
- `pnpm run verify` gates the result.
