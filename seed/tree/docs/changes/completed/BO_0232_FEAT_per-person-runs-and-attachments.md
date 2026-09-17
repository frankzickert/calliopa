# BO_0232_FEAT_per-person-runs-and-attachments

Status: completed

Completed 2026-09-17. The kernel half (`BO_0232_001`–`_005`) is truth in
`docs/system/ui-kernel.md`, Per-Person Runs — restored there first, since an overwrite of that file
on 2026-09-16 had dropped the transferred section. The shell half (`_006`–`_010`) is truth in
`ui.shell`'s `workspace/processes.md`, served since pin 1361; `agent/run-lifecycle.md`'s busy line
says a run another person holds is named by its age alone. The walk (`_010`) ran on this instance
with two probe accounts; the owner's view stands on the kernel's verification. The proposals read
of a process the kernel does not serve answers an empty list rather than `404`, since the process
itself is already unknown to the caller.
Found on the way, outside this change: `settings`' behavior test `parties.test.ts` imports
`publishing`, so a tree with `publishing` inactive fails its typecheck and no pin builds; the user
re-activated `publishing` on 2026-09-17.

Requested: 2026-09-10, at `BO_0229`'s transfer. Asked what *attachments are readable by
whoever can see the run* should mean, once it turned out that every signed-in account can read
every run, the user answered: **instance-wide, but create follow-up change to solve this issue
for multi-user setups.** User statement.

Reviewed 2026-09-16 for Calliopa's purpose as a general workplace: kept, since a workplace with
several people needs a person's commands and files to be theirs. The scope is runs a person
starts from the composer. Runs the kernel starts on its own after a change (`BO_0245`, system
runs) serve `calliopa-refine`, have no requester, and are not this change's.

## Where This Starts

Measured at `BO_0229`'s transfer (`ui-kernel.md`, Command File Attachments):

- **A run does not know who asked for it.** The bridge's run routes (`/__kernel/agent/runs`,
  `…/{id}`, `…/{id}/events`, `…/cancel`, `…/archive`, `agentbridge/http.go`) check no
  principal. `Run.Principal` is the agent's (`agent:hermes`), and the person who started the
  run is not recorded anywhere.
- **The only gate is being signed in.** In prod, `anonymousGate` (`serve/proxy.go`) admits any
  active account to the whole kernel surface and discards who it is. In dev nothing is gated.
- **Any signed-in person can therefore read, follow, cancel and archive any run**, and under
  `BO_0229` open any attachment.
- **The graph's reads are open behind the kernel.** CCGW's query routes and `GET /v1/blobs/{hash}`
  need no credential (`ccgw.md`). Only mutations are gated by principal (`BO_0206`). A browser
  reaches them only through the kernel and the shell, so what a person can see is what those
  two choose to answer.
- **An attachment is an `attachment` node** written as the person who sent the command
  (`BO_0229_009`), so its revision's author is known even though the run's requester is not.

## Intent

* On an instance with several people, a run and what it carries belong to the person who
  started it. Others cannot read them, follow them, cancel them or open their attachments,
  unless a rule below lets them.
* An instance with one person behaves exactly as today.

## Decided 2026-09-16

User decisions at the transfer:

- **The person and the owner** see a person's runs. Nobody else, and everyone sharing a workspace,
  were the alternatives.
- **A run's proposals stay shared.** Privacy covers the run's record, events, process and
  attachments; what it proposes into a document is reviewable by others, so separation of duties
  (`BO_0212`) stays possible.
- **Runs from before the change are the owner's.** Readable by everyone, and hidden, were the
  alternatives.
- **The kernel's and the shell's routes refuse**; CCGW's reads and blob door stay open behind the
  kernel. Refusing per person in CCGW was the alternative.

Found at the transfer: every person shares the default workspace, and the `processes` state
records carry no account, so a person's processes are listed in everyone's console; the
process record gains the account as well as the run.

## Transferred

2026-09-16:

- **The kernel**, `docs/system/ui-kernel.md`, Per-Person Runs (`BO_0232_001`–`_005`): the run
  records its person, the bridge's routes and the process records filtered and refused per
  person, attachments through their run, verification.
- **The shell** (graph, `ui.shell`), `workspace/processes.md`, Per-Person Runs (`_006`–`_010`): the
  process's account, refusals kept in their status, the busy refusal without another person's goal,
  the attachment file route through the run, tests and the walk with two accounts.
- `_004` and `_008` land with or after `BO_0229`. `BO_0212_007` needs `_001`.
- `ui-shell.md` points at the shell half. This document is carried into the graph as a member of
  `ui.shell` no later than completion.

## Out Of Scope

- System runs and reconcile runs (`BO_0245`, `BO_0250_006`), which belong to `calliopa-refine`.
- `BO_0229` itself. It ships with attachments readable instance-wide, by the user's decision
  of 2026-09-10.
