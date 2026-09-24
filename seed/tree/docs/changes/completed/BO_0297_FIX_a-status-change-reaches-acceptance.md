# A Status Change Reaches Acceptance

Status: completed

Requested: 2026-09-24. In the user's words: *whenever i change the status of a change in the app,
i get: Staged. It reads draft once the change is accepted. but it does never apply the state.* This
document shapes the change; it authorizes no implementation.

The change's code lands in `ui.shell` (the status control) and in the kernel (the operation that
stages the status), so it is a `BO` change, and its document is carried into `ui.shell`'s
`docs/changes/` no later than its completion.

## Where This Starts

At the dogfood instance on 2026-09-24.

- **The status is staged, and nothing leads to its acceptance.** `ChangeStatus`
  (`ui.shell`'s `src/components/views/change-status.tsx`, `BO_0282_009`) posts to
  `extensions/[id]/change-status`. The kernel's `SetChangeStatus`
  (`internal/kernel/extensions/status.go`, `BO_0282_005`) rewrites the `Status:` line and stages it
  as the person under a fresh group, answering that group. The control drops the group: it shows
  *Staged. It reads … once the change is accepted.* and offers neither an accept nor the kernel's
  confirmation. Its `confirmUrl` state is declared and never set or drawn. The only ways to
  establish the status are the extension page's *Staged changes* list, which the tab does not
  point at, and `kernel proposal accept` from the host.
- **The note does not survive the tab.** The note is component state. Reopening the change shows the
  old status and no sign that a move is waiting, so the person tries again.
- **Every try stages another group.** The document still reads the old status, so each choice
  passes the no-op check and opens a new group. On 2026-09-24 seven were open:
  `node:chg-7f2d326315f3dc23`, `node:chg-9064b3536bbabb3e`, `node:chg-f4ec7fc7589e0b6e` (CA_0066
  to ready), `node:chg-961625f81ebb3364` (CA_0066 to draft), `node:chg-90dba8e024ed15dd`
  (CA_0067 to ready), `node:chg-97edf688461feae2` and `node:chg-e9c0e0a4ae4f57e2` (DO_0016 to
  draft).
- **A waiting status move carries the whole document.** The staged edit is
  `SET s.code = $code` with the full text read at staging time, not the one line. CCGW refuses to
  accept a group whose node moved past the group's base, so a move over a document that changed
  since is refused rather than applied. It can never land as it stands, which is its own dead end.
  All seven above are stale in this way: CA_0066 and CA_0067 are `completed`, and DO_0016 has
  since moved to draft and ready with its transfer edits.

## What The Change Should Make True

- Choosing a status on a change's tab stages the move, asks for its acceptance and shows the
  kernel's confirmation link on the tab, the way *Staged changes* leads to it (`extension-groups.tsx`, `BO_0103_003`). Acceptance
  stays the person's act on the kernel's confirmation page; `BO_0254`'s rule is kept.
- The tab shows a move that is waiting after a reload: the status it will read, and the way to
  confirm it.
- A document has at most one waiting status move. A new choice does not open a second group
  beside the first.
- A status move never establishes anything but its one line. Accepting it over a document that
  has changed since staging moves only the `Status:` line, and never restores the rest of the text
  as it was at staging time.

## Decided

Answered by the user on 2026-09-24.

- **Choose, then confirm.** Choosing a status stages the move and asks for its acceptance at once,
  and the tab shows the kernel's confirmation link. That is two acts: the choice on the tab, and
  the confirmation on the kernel's page. There is no separate *Accept* press in between.
- **The last choice replaces the waiting one.** Choosing while a move waits rejects the waiting
  group in the person's name and stages the new one, so a document never has more than one waiting
  move.
- **Only the line moves.** Accepting a move changes only the `Status:` line of the document as it
  stands at acceptance, whatever else changed since staging. The staged edit carries the line, not
  a snapshot of the whole text.
- **The change sweeps the stale moves.** The seven groups listed above stay open until this change
  lands. Landing rejects every waiting status move staged in the old whole-text shape, and the
  replace rule keeps each document at one move from then on. Until then, accepting one of the
  seven is refused by CCGW for the drift.

## Outcome

Completed 2026-09-24. The kernel half is `docs/system/ui-kernel.md`, *A Status Change Reaches
Acceptance* (`BO_0297_001`–`_006`). The shell half is `ui.shell`'s `docs/system/workspace/layout.md`
beside `ChangeStatus` (`BO_0297_007`–`_009`), accepted as `node:chg-006d24cc7a7ec99a`. The user
walked it at pin 2454 and said it works. On its first start, the rebuilt kernel rejected the seven
whole-text moves listed above.
