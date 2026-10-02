# RO_0001 — Story role through focused work

Status: completed

## Scope

When a block carrying the Story role opens focused work, the parent block continues to show its Story role. Every block in the focused-work document is offered Hook when Story offers Hook. Offering Hook makes it available to take; it does not assign Hook automatically.

## Acceptance scenarios

- Given a parent block carries Story, when focused work is opened from it, then Story remains visible on the parent block.
- Given that Story offers Hook and its parent block opens focused work, when the role control is opened on any block in that focused-work document, then Hook is offered as takeable.
- Given Hook is offered on a focused-work block, when the person does not take it, then the block remains without Hook.

## System task

- `RO_0001_001` in `system.md` enumerates the behavior and implementation work.

## Resolution

- Closed 2026-10-01 without a code change of its own. The behavior was already true at pin 3387:
  `BO_0309`'s walk fix added `readInherited` and the line under the focused work's title, which the user
  confirmed in that walk. `RO_0001_001` is folded into `system.md` as the truth line *Focused work
  under a roled block*.
