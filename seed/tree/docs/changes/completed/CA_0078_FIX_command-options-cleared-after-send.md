# CA_0078_FIX_command-options-cleared-after-send

Status: completed

Reported: 2026-10-02, by the user: sending a command throws in the browser console
`Uncaught (in promise) ReferenceError: commandOptions is not defined`, from
`sendCommand$`.

## Problem

- `BO_0336_051` taught the shell to clear an option set for one send once its command is
  sent: on a started run `sendCommand$` hands the shell's `commandOptions` store to
  `afterSend` and writes back what it keeps (`src/components/shell/shell.tsx`).
- The store is declared further down the component, after `sendCommand$`. Qwik's optimizer
  moves each `$()` closure into its own chunk and passes it only the variables in scope where
  it is captured, so the chunk names a `commandOptions` it was never given and throws once the
  run has started.
- What the person sees: the run starts, but the command's one-send options are not cleared and
  the send ends in an uncaught error rather than returning its result to the view.
- The tests did not catch it: `documents`' `editor-harness.ts` declares its `commandOptions`
  before its own `sendCommand$`, so `command-decorations.test.ts` exercises `afterSend` through
  a harness ordered differently from the shell.

## Shape Of The Fix

- Declare the `commandOptions` store (and `setCommandOption$` with it) before `sendCommand$`
  in `shell.tsx`, so the closure captures it. No behavior changes beyond the one
  `BO_0336_051` already describes.
- A test that fails against today's shell and passes after the fix: one that drives the
  shell's own `sendCommand$`, not the editor harness's, through a started run with an option
  set for one send, and finds it cleared with no error.
- `docs/system/workspace/contribution-contract.md`'s `BO_0336_051` line stays true; it gains
  only the test that proves the shell's own send, if one is added there.
- The fix ships in a `bundled` extension, so it adds a `Fixed` line to
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`.

## Outcome

- Completed 2026-10-02 (`CA_0078_001`): `shell.tsx` declares `commandOptions` and
  `setCommandOption$` above `sendCommand$`. The built `sendCommand` segment now captures the
  store beside `aim`, `run` and `startRun$`.
- A render cannot prove it, since the dev transform the tests run under keeps closures inline. So
  `src/components/shell/shell-captures.test.ts` runs the optimizer as the production build does
  and fails when any segment reads a name of the `Shell` component it did not capture: it named
  `sendCommand: commandOptions` against the old order and passes on the new one.
