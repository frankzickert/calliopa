# The Absence Check Runs Before A Release

Status: completed

Requested: 2026-10-03

Release `0.5.1` was refused twice on 2026-10-03 by the absence check (`docs/system/distribution.md`,
The Absence Check), each time because a `documents` test imported from `structures`, an extension
an owner may switch off: `server/proposed-works.test.ts` at pin 4440 (`RO_0005`, fixed by
`DO_0035`) and `views/title-kept.test.ts` at pin 4534 (`DO_0032`, fixed by `DO_0036`). Both changes
were accepted and promoted without complaint, since promotion builds the tree with every bundled
extension present. The leak surfaced only when a release was cut, and each one cost a fix change,
its acceptances and a second promotion before the release could run again.

The check exists since `BO_0260`, which put it in the release script alone: a leak no longer
ships, but it is still found at the last step, by whoever cuts the release, in work another
session closed earlier.

## The Request

- A leak from a bundled extension into one an owner may switch off is found when the change that
  introduces it is staged or promoted, not when a release is cut.

## The Check

- A static import rule runs wherever code enters the graph: when a proposal is staged into an
  extension and when a pin is promoted (`kernel pin`), refusing in words and naming each offending
  file and import. It runs in seconds, so it refuses synchronously; nothing runs in the background.
  User decision, 2026-10-03.
- The rule: a file under `src/extensions/<a>/` imports from `~/extensions/<b>/` only when `a`
  declares `b` in its manifest's `dependencies`; a root-mapped file (`ui.shell`) imports from no
  extension an owner may switch off — the case `CA_0069` fixed, `focus.test.ts` importing
  `documents`. Test files count, since the build type-checks them.
- It runs on every instance, the same rule everywhere, not on the dev instance alone. On an install
  it also refuses an owner's own `individual` extension that imports a bundled one it does not
  declare as a dependency. User decision, 2026-10-03.
- The full build of every variant (`kernel toolchain absence`) stays the release's gate alone, as
  today: a leak can also arrive through a dependency, which only a build finds.
- An update meeting an owner's existing leak is refused like any other pin, naming the file; the
  instance keeps its current release until the owner declares the dependency or switches the
  extension off. User decision, 2026-10-05.

## System Work

- Transferred 2026-10-03 to `docs/system/ui-kernel.md`, Imports Follow Dependencies, as
  `BO_0347_001`–`BO_0347_006`; `docs/system/distribution.md`, The Absence Check, points there.

## Notes

- The static rule covers both of 2026-10-03's refusals, `BO_0260`'s original one (`settings`'
  `parties.test.ts` importing `publishing`) and `CA_0069`'s.

## Done

- Completed 2026-10-05: the rule, the commit's and the gate's refusals and their verification are
  truth in `calliopa-bootstrap`'s `docs/system/ui-kernel.md`, Imports Follow Dependencies; this
  extension's `create-extension` skill teaches it; the release line and the website record are in
  `docs/release-notes/unreleased.md`.
