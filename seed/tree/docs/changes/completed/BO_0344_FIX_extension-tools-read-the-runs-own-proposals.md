# BO_0344_FIX_extension-tools-read-the-runs-own-proposals

Status: completed

Reported 2026-10-03: **"i asked the agent to create a calliopa structure named "video-beat". it
said, it did, but no structure appears in the section"**, and on the dev instance: **"even when i
accept the change, it doesn't create it"**. User statements.

A run cannot build on what it proposed earlier in the same run when the next step is an extension's
tool. The kernel's own document tools read *at the run's pin with the run's own group laid over
truth once it has staged* (`ui-kernel.md`, `BO_0207_004`). An extension's tool does not: the kernel
hands it `run.group` and `run.pin` (`internal/kernel/agenttools`), and the tools read at the pin or
at head, never through the group (`structures`, `keywords`, `bibliography`, `manuscripts` in the
graph; `media` stages into a group of its own).

The reported case is `structures`. Its skill convention `aStructureIsADocument` tells a run to
*start a document for it and propose Structure on that document with propose_structures*
(`RO_0005_Q5`). The run starts the document, which stands only in its group; `propose_structures`
reads the document outside the group (`kernel/tools/[tool]` → `proposeStructures` → `situationOf`
→ `structuresOf` → `documentOf`) and refuses with `unknownDocument`, staging nothing. Accepting the
run's proposals then makes a plain document named "video-beat" and no structure, so *Structures*
never lists it. Read from the code at head 4271; the dev run itself was not read, so the fix's test
is what confirms it. The tests propose *Structure* only on an established document
(`tests/behavior/structures.test.ts`), so the gap was never exercised.

The run then told the person it had made the structure, although the tool refused.

This change replaces the idea `RO_0006_FIX_a-run-proposes-a-structure-it-starts`, staged in the
graph as `node:chg-644915b99cb234e5` and widened here by the user's answer to its Q1.

## Scope

* Every extension tool reads as the kernel's own tools do: at the run's pin with the run's own
  group laid over truth, so a document, a block, a structure or a value the same run proposed
  earlier stands for it. What it stages still goes into the run's group and lands only when the
  person accepts the run's proposals. A person's acts and the extensions' routes keep reading as
  they do. User decision, 2026-10-03 (`RO_0006_Q1`: kernel-wide, as a `BO` change).
* A refused tool call stays an answer to the run, in words, as today; the run's chip does not list
  refusals. The `structures` skill adds to `aStructureIsADocument` that a refusal means nothing was
  proposed, and the run says so to the person rather than reporting the structure made. User
  decision, 2026-10-03 (`RO_0006_Q2`: the skill's sentence only).
- The fixed layer carries the run's read scope to the tool: the kernel sends the run's pin and,
  once the run has staged, its group as headers on every run-bound callback; the shell's dispatch
  (`src/server/registry.ts`, `src/server/ccgw/branch-scope.ts`) sets the scope around a
  `kernelCallback` route that carries them, so no extension threads it by hand, and the extensions
  drop their own `atDataRevision(call.run.pin, …)` where the scope now does it. CCGW already answers
  a read naming a pin and an overlay together, as the kernel's document tools read; it needs no
  change (settled at transfer).
- `structures`: `propose_structures` and `read_document_structures` answer a document the run
  started, and a block the run proposed in a structure's document can be given *Field* with its
  values. `keywords`, `bibliography` and `manuscripts` are checked by the same test shape and
  fixed where they refuse.
- Verified by a behaviour test over CCGW per affected tool: a run's group starts a document and
  proposes into it through the tool; the tool stages without refusal; nothing stands before
  acceptance; after accepting the group it stands. For `structures`, the structure is listed in the
  catalogue with its field. And by a walk on the dev instance: ask a run to create a structure,
  accept, and see it under *Structures*.
- The graph half lands in `ui.shell` (the tool callback) and the extensions; the change document
  stands in the graph as a change of `ui.shell`, whose contract the callback is.
- Release notes: a *Fixed* line — an agent asked to make a structure, or to add to a document it
  just started, now does.

## Transfer

Transferred 2026-10-03; the decisions above are fixed lines there:

- `ui-kernel.md`, *An Extension Tool Reads What Its Run Proposed*: `BO_0344_001` (the kernel sends
  `X-Calliopa-Run-Pin` and, once the run has staged, `X-Calliopa-Run-Overlay` with every run-bound
  callback), `BO_0344_002` (the walk on the dev instance), `BO_0344_003` (the release line).
- In the graph: `ui.shell`'s *Contribution Contract*, *A Run's Callback Reads What The Run
  Proposed*: `BO_0344_004` (`dispatch` sets the run's read scope from the headers, `asRun`);
  `structures`: `BO_0344_005` (the tools in the scope), `BO_0344_006` (the skill's sentence on a
  refusal), `BO_0344_007` (the behaviour test); `keywords` `BO_0344_008`, `bibliography`
  `BO_0344_009`, `manuscripts` `BO_0344_010` (each drops its own pin read and is proven reading the
  run's proposals).
- This document stands in the graph as a change of `ui.shell`, in the proposal carrying the
  transfer.

## Implementation

Completed 2026-10-03.

- The kernel half landed in this repository (`BO_0344_001`, `ui-kernel.md`), with the release line
  (`BO_0344_003`).
- The graph half — the shell's run scope (`BO_0344_004`), `structures` (`BO_0344_005`–`007`),
  `keywords`, `bibliography` and `manuscripts` (`BO_0344_008`–`010`) — was proven under the kernel
  harness and accepted with the transfer as one proposal, `node:chg-825312d250e50abf` (base 4303),
  served from pin 4307.
- Proving `BO_0344_007` found the cause the report saw, beside the one this document first named:
  outside the run's group the document the run started stands without its blocks, and the
  *Structure* a run proposes was refused at staging, since `structures` wrote the `roleFields`
  node it creates with `status: "established"`, which the core refuses in a proposal. No run could
  ever propose a structure. Fixed as `structures`' `BO_0344_011`.
- Walked on the dev instance (`BO_0344_002`): the run proposed *video-beat* without a refusal, and
  it stood as a structure once the run's group was accepted. The run chip's *Accept all* reached
  only the run's block in the document it ran in; answering the whole run from the chip is
  `documents`' `DO_0034`.
