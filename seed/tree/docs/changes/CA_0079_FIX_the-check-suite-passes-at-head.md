# CA_0079_FIX_the-check-suite-passes-at-head

Status: ready

Requested: 2026-10-02, by the user, after `CA_0078`: `pnpm check` at head fails tests that the
change did not touch, so a regression like `CA_0078`'s can land among them unnoticed.

## What Fails

Found on head 4066 and again on 4077, on the dev instance's tree with a frozen install.

- The full `pnpm check` run fails 9–10 tests and then exits 134: Node runs out of memory
  (`OOMErrorHandler`), after an unhandled `TypeError: win.addEventListener is not a function`.
- Run file by file, these fail every time:
  - `documents`' `server/vocabulary.test.ts`: the committed vocabulary now carries `admonition`
    (`CA_0070`), and the expected list does not.
  - `documents`' `views/bar.test.ts`, *the block controls are icons in one settled order*: it
    expects a `block-add-admonition` control in the bar. Since `CA_0071`, an admonition is chosen
    from the block-type picker (`documents`' `block-editor.md`, Admonitions), and the bar has no
    such control.
  - `bar.test.ts`, *the link toggle pressed*: *the editor did not settle*, waiting for the
    address field.
  - `views/handover.test.ts`, *characters typed into the tail before its split lands*: *waited,
    and it did not happen*, waiting for the tail's `revise`.
  - `views/reference-math.test.ts`, *offers the document's numbered equations*: *the editor did
    not settle*, waiting for the `block-reference-equation` control.
  - `tests/behavior/theme-tokens.test.ts`: `documents`' `views/admonition.css` sets a literal
    `--admonition-color: #607d8b` and mixes `background` from it, which the semantic-token rule
    refuses.
- These pass on their own and fail only in the full run, so they belong to the memory and
  leakage problem, not to their own code: `surface-typeset.test.ts`, `reference-math.test.ts`'s
  *editing an equation that stands in a sentence*, `equation-popover.test.ts` and
  `bibliography`'s `server/render.test.ts`.

## What Is Asked

- `pnpm check` passes at head, in one run, without exhausting memory. Where a test is behind the
  code, the test changes; where the code is behind the docs, the code changes. Which is which is
  settled per test against the owning extension's docs before anything changes.
- The full run's memory: find what leaks across files (the `win.addEventListener` error points
  at a view torn down with timers or listeners still running) and fix it, rather than raising the
  heap limit.
- The three timeouts are diagnosed: each is either a test waiting on something the editor no
  longer does, or a real regression in `documents` that becomes its own fix.
- The admonition colour either takes a semantic token or is exempted in words the suite repeats,
  as the open line in `verification.md` already asks for the editor's shadow.
- `ui.shell`'s `docs/system/foundation/verification.md` carries two open lines that no longer
  describe head: `DO_0009_007` (the `documents` view suites now load) and the `theme-tokens` line
  naming `block-editor.css`. They are rewritten or folded into this change.

## Ownership

- Most of the work is in `documents`' tests and stylesheet, so its system tasks would sit in
  `documents`' docs. The goal is the shell's `check` suite (`verification.md`), so the change is
  `ui.shell`'s.
- Nothing here changes what a person sees, unless a timeout turns out to be a real regression. In
  that case the regression is named here and fixed on its own, and it adds a `Fixed` release-note
  line.
