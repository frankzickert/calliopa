# BO_0245_FEAT_system-runs

Status: completed

Requested: 2026-09-13, the fourth part of `BO_0243` (decision and refinement). The material's sections 15, 18, 30, 36, 40, 53 and 55: Calliopa continuously maintains a working interpretation, infers relations during normal work, evaluates pressure, and can explain why it stayed quiet. This part is the mechanism the later parts run on; it derives nothing itself.

## Where This Starts

- **A run starts from the composer and nowhere else.** `POST /__kernel/agent/runs` takes a goal with the reader's agent, intention, artifact, delivery, references and attachments (`ui-kernel.md` `BO_0089_012`, `BO_0226_001`, `BO_0229_003`); the CLI verb `kernel agent run` is the recovery path. No timer, no schedule, no post-commit trigger starts one.

- **One run at a time, refused busy.** *One run is active per console session; a second goal while a run is active is refused as busy, not buffered* (`hermes.md`, fixed); Hermes's MCP configuration is global, so runs are bridge-serialized stack-wide (`BO_0228_005`).

- **The run's contract is fixed.** *Goal in, proposal group out. … Output: zero or one open proposal group per coherent change plus a streamed run trace; a run reports the group id and never reports acceptance.* And: *Hermes opens the group, stages into it, and closes the run naming it; the kernel provides tools but never commits on the agent's behalf* (`hermes.md`). An agent write is proposal-only by identity class (`BO_0089_011`).

- **The enrichment worker cannot do this.** It is the one post-commit process, in-process after a durable commit, eligible for new document-bearing revisions and not for status transitions, writing embeddings under its own principal; fixed: *no model-based mutation of graph content*, *does not infer user intent from prose*, *never triggers further writes* (`enrichment-worker.md` `BO_0005_025`, `BO_0005_069`, `BO_0005_071`, `BO_0005_073`). Acceptance — the change that matters most here — is a status transition it ignores.

- **Nothing subscribes to commits.** The commit log records every change with its affected nodes, GIN-indexed (`commit-log.md` `BO_0020_013`), and *consumers never call the Commit Log directly* (`BO_0004_064`); `GET /v1/head` and the touched-set read are the only polls (`BO_0093_007`). But every human write from the shell and every acceptance passes through the kernel bridge's `write`, `accept` and `commit` verbs, and every run's staging through its toolset: the kernel sees every change a person or a run makes to content.

- **Skills select by intention.** A run's instructions inline the `ext.skill` members of `calliopa-base` and of the extension declaring the run's intention (`BO_0142_005`, `BO_0168`); an intention is an `ext.intention` member with `marks`, `label` and `completionRule`, declared by a bundled or individual extension; an unknown one is refused before the run starts. The instructions are composed in `internal/kernel/agentbridge` (`instructions`, `deliveryNote`).

- **A run's record says what it was told.** The kernel keeps each run as JSON under `agent-runs/` with goal, group, pin, agent, intention, artifact, delivery, references, pinned, `executedBy`, model, billing and status (`bridge.go`); the `agent.run` provenance node staged into the group carries goal, pin, group, verification and skill revisions (`BO_0089_003`). What a run judged and why is in its final words, in the console, and nowhere in the graph.

## Intent

* **The kernel starts runs on its own.** After a change it carried touches a document — a human write, an acceptance, a run's group accepted — the kernel schedules a *system run* for that document: a run under the `refine` intention whose goal is the kernel's, not a person's, whose context is what changed, and whose output is the same zero-or-one proposal group every run produces. Context informs; nothing fences.

* **A person's command always comes first, and is merged with the system's work where it can be.** A system run never refuses a person's command as busy. A queued system run for the same document is folded into the person's run: one run carries the command and the refinement context, so the reader's answer and the system's reading arrive together. A system run already executing cannot take the command, since the pinned runtimes accept no input into a run under way (`agent/pinned-upstream-contract.md`); it is cancelled and rescheduled after the command's run. A queued system run for another document yields. User decision, 2026-09-13 (*merge if possible*), over cancel-always and over making the command wait.

* **A system run is attributable and quiet.** Its record says it was the kernel's, what triggered it — the data revision and the document — and what it concluded; it appears in the process list as a system process, distinguishable from a person's run, and raises no notice of its own: what it stages is seen where it lands, as any proposal is.

* **Silence is recorded.** A system run that stages nothing still leaves its judgement — what it looked at and why nothing followed — readable from the document, so a reader can ask *did anything upstream change?* and get the reason for the quiet (material §40, rule 22).

* **The `refine` intention is graph knowledge.** Its declaration and its skills — the material's rules for deriving, inferring, classifying and evaluating — are members of a bundled extension, `calliopa-refine`, read at the run's pin like every skill, so the rules the system works by are reviewable and revisable through the proposal loop and never baked into the kernel.

* **A system run reasons on the instance's agent** — the agent the reader chose in the composer and the runtime it is signed into — and bills what that agent bills. No run happens while no agent can run; the schedule waits, and the settings surface says so.

## The Shape

- **Trigger.** The review bridge and the agent bridge hand every committed content change to a `refinement` scheduler: the data revision it landed at, the document nodes it touched, and whether it was a person's write, an acceptance or a run's staging. Staging schedules nothing; acceptance and truth writes do. The scheduler debounces per document: a run starts once the document has been quiet for a settle time (30 s proposed, an instance setting), so typing schedules one run, not one per save, and a person's own run against the document is followed by one refinement, not preceded by one.

- **Queue.** One queue in the kernel, persisted beside the run records so a restart loses nothing: a person's commands ahead of system runs, system runs by schedule time, one entry per document (a second trigger for the same document replaces the first's context with the union). The slot rule stays one run at a time; the queue is what makes *busy* a wait instead of a refusal for the kernel's own runs. A person's command still refuses busy when a person's run holds the slot, as today.

- **The change context.** The run receives, in its instructions, what changed since the document's last refinement: the kernel reads the document at the previous refinement's pin and at the trigger's, and hands the run the blocks added, removed and revised with their words, claims and kinds before and after, the relations touched, and the acceptance events. The kernel computes it (`ProjectAt`-style two reads and a per-block diff); the run never reconstructs history from statements. The previous refinement's pin is the document's `refinedAt` fact in the kernel's state record.

- **Identity.** A system run executes as the agent principal every run executes as, in a group whose rationale names the trigger, and its record carries `trigger: system` with the data revision and the document. The `agent.run` provenance node carries the same.

- **What it may establish.** Decided by the user on 2026-09-13 (`BO_0243`, Decided): a `judgement` node type — declared by `calliopa-refine`, non-block, with `about` (`change`, `pressure`, `silence`, `threshold`), `outcome`, `explanation` (runs), the data revision judged and the run — and a `judges` edge to the block or relation it concerns, which a system run writes as truth through a kernel tool `record_judgement` under a `system` identity class that CCGW's policy permits to establish `judgement` and `judges` alone. Every other write of a system run is a proposal. This weakens *the kernel never commits on the agent's behalf* for exactly one type whose meaning is *the system's own record*; the alternative — judgements as candidates nobody answers — was rejected.

- **Skills.** `calliopa-refine` is a bundled extension with the `refine` intention (`marks: refine`, label *Refine*, completion rule: *the document says the strongest useful position, what puts pressure on it, and what should happen next, and nothing derived restates what the body already says*) and one skill per rule family, each carrying the material's words as conventions and examples: `refine.derive` (`BO_0246`), `refine.relate` (`BO_0247`), `refine.classify` and `refine.pressure` (`BO_0248`), `refine.neutral` (`BO_0251`). This part ships the extension with the intention and the shared conventions — compress, discriminate or direct; treat inferred structure as proposed; never restate; explain every judgement in the record — and each later part adds its skill.

- **Console and processes.** A system process is listed with a distinct name and glyph and carries its trigger in its detail; the header's process indicator counts it. The dock does not open for it. The reader can cancel it as any run. The settings surface's agent row shows whether refinement is on and its settle time, and an instance-wide switch turns system runs off; on is the state a fresh install arrives in, so it behaves as the material describes without a setting found, and the owner turns it off from that row. User decision, 2026-09-13.

- **The shell half.** `src/server/agent/bridge.ts` maps `trigger`; the process list and detail say *System* and the trigger; the settings row carries the switch and the settle time (the settings extension's own change document in the graph lists that piece).

- **Verification.** Kernel tests for the scheduler's debounce, the queue's order, a person's command displacing a queued and a running system run, the change context over two pins, and restart recovery; a live test against a signed-in runtime proving one accepted edit produces one system run that reads the context and leaves a judgement.

## Decided

Answered by the user on 2026-09-13.

* **On by default.** A fresh install refines from the first change; the owner turns it off from the agent's settings row. Off-until-turned-on was the alternative.

* **Merge if possible.** A queued system run for the document is folded into the person's command as one run; an executing one is cancelled and rescheduled, because no pinned runtime takes input mid-run. Should a later runtime pin allow it, the executing case merges too.

* **The `system` identity class** establishes `judgement` records alone (`BO_0243`, Decided).

* **A merged run is one run and one group.** It is told the person's goal and the refinement context together and stages into one group; its `agent.run` node says it carried a refinement too, with the trigger. Decided at transfer, 2026-09-14, on the recommendation above.

## Transferred

Transferred 2026-09-14. The kernel half is `docs/system/ui-kernel.md`, System Runs (`BO_0245_001`–`BO_0245_008`), with `BO_0245_005` in `docs/system/ccgw.md` and `BO_0245_007` in `docs/system/extension-model.md`. The shell half is in the shell's graph docs (`BO_0245_009`– `BO_0245_013`; the pointers in `docs/system/ui-shell.md`, System Runs).

## Depends On

- `BO_0244` for the vocabulary a refinement reads and writes. Later parts add the skills; this part with the shared conventions alone produces runs that read the context and record a judgement of `threshold` with no derived output — which is the first observable silence.
