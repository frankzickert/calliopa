# Evaluation Is A Service

Status: completed

An evaluation model is something this instance has, not something one skill does. Jev answers
declared questions about supplied state and returns typed answers with probabilities — a choice
from named options, a score on an ordered rubric, a boolean as a likelihood — and that is useful to
anything that has to decide something in a shape rather than in prose. This change makes it a
capability every run can reach, as `evaluate` in the kernel's toolset beside `read_document` and
`read_attachment`, fed mainly by agents and scripts. It collects the user's decisions of
2026-09-22, which answered every question this change opened. Completed 2026-09-23: the party, the
kernel's call, the `evaluate` tool, the endpoint a script posts to, the run's record, the owner's
retention choice and the service row that saves what was typed all stand, refinement's half is
gone, and the whole of it is walked on the instance. What it built is truth in
`docs/system/ui-kernel.md` under Evaluation Is A Service, in `settings`' Channels in the graph and
in `calliopa-refine`'s *Asking The Evaluation Service*.

## Why This Rather Than What Was Built

- `RF_0002` put an evaluation behind `calliopa-refine`'s classification of an edit: the switch, the
  party, the call and the question all belonged to refinement, and the evaluation was asked only
  when a run recorded a `change` judgement. It never once fired, because the change context has
  never reported a block as revised (`RF_0002_012`), and the person asking saw a feature that did
  nothing.
- The deeper fault is not the broken context. A run still decided *whether there was a typed
  decision to make*, which is most of the decision — the opposite of what was decided for it. The
  user's words on 2026-09-22: a *nothing moved* answer should itself be the evaluation's verdict.
- A service nothing has to route around has neither problem. A run that wants a typed answer asks
  for one; a script that wants a hundred asks for a hundred; nothing has to have classified
  something first.

## Decided

The user's decisions of 2026-09-22.

* Evaluation lives in the kernel's toolset. `evaluate` is a tool every run gets, like
  `read_document` and `read_attachment`, and the kernel uses the credential it already holds
  rather than reaching a party through a run's grant. It carries no rules — a state, some
  questions, typed answers back — which is what the kernel's other tools are; the rules stay with
  whoever asks.
* The tool takes Jev's own shape: a `state`, and a map of `questions`, each a `choice` over named
  criteria, a `score` over an ordered rubric, or a `boolean`, answered together in one round trip.
  That is what the model offers, and a caller wanting to classify, rate and check at once should
  not need three changes to do it.
* Refinement's evaluated classification is dropped. `record_judgement` stops asking, and refine
  goes back to reading for itself. It can return later as an ordinary caller of this service, once
  there is an edit for it to classify.
* `settings` declares an `evaluation` party beside `honcho`: a `service` party taking an API key,
  the gateway's root as `fixed` configuration, and the measured `/credits` probe. The record
  `calliopa-refine-evaluation` is deleted with refine's half and the key is entered once into the
  new row — a general service does not keep one extension's name, and a migration that runs once
  would live forever.
* Entering a key is what permits a run to spend. There is no second switch: the party's row says
  plainly that runs may use it, and the owner withholds it by clearing the key. The same answer as
  `BO_0276`, and it is a wider door than that one — every run gets this tool, not one extension's —
  so the row's words are where that is said.
* A script reaches the service through an endpoint of the kernel's own, posted to with the owner's
  session: the same code the tool calls, with the credential never leaving the kernel. The tool
  serves runs and a script has no run, and this is the only shape that does not push the key
  outside or invent a party for scripts to broker through.
* The tool is always offered, and refused at the call in words when no key is entered. A runtime
  keeps the list it first read, so a tool that appeared once a key existed would be invisible to an
  agent already running; a refusal naming the missing key is something a run can report, which
  silence is not.
* A run's record names the party it reached and how many calls it made, exactly as a brokered call
  does (`BO_0276_005`): the tool calls the same hook, so what a run spent reads the same whether it
  went through the broker or the kernel's own tool. Following the user's decision of 2026-09-22 on
  `BO_0276`, not a new one.

## What Is Kept From RF_0002

- The party's shape and its probe. `GET {configuration.address}/credits` expecting `200`, settled
  by measuring: `GET /v1/models` answers `200` with no credential at all, so a probe on it reports
  every key — and no key — as verified. That finding cost a walk and is not to be rediscovered.
- The gateway's root as `fixed` configuration rather than a typed field, so nothing anyone enters
  can send the work somewhere else, and the service party rule that makes that possible
  (`RF_0002_009`, `ui.shell`'s `configurationRefusal`).
- Unavailable is an answer, never an exception at the caller: a bound, a refusal, an unreachable
  gateway, a missing credential, a body that is not what it should be — all come back as words, and
  the caller decides what to do without a failure it did not ask for.
- `providerOptions.gateway` carrying `zeroDataRetention: true` and `only: ["typesafe-ai"]` on every
  request, neither of them a setting.
- The bound and its reasoning: far above one round trip, far below the run that asks, so a gateway
  that has stopped answering costs seconds rather than the run.

## What Is Removed

- `calliopa-refine`'s `server/evaluation.ts`, `server/classify.ts`, `lib/classify-question.ts`,
  its evaluation party and its settings section, the `evaluation` convention on `refine.classify`,
  the `claimBefore`/`claimAfter` inputs on `record_judgement`, and `probability`/`runOutcome` on the
  `judgement` type — unless the last two earn their place when refinement returns as a caller.
- `BO_0276` stays. A run reaching a party the owner signed in is a general mechanism and the right
  one; this change simply does not need it for evaluation, because the kernel holds the credential
  and the tool is the kernel's.

## Where This Came From

- `RF_0002` in `calliopa-refine`, built and deployed 2026-09-22 and never once exercised. Its
  findings stand and are reused above; its wiring into refinement is what this change undoes.

## What Closed It

- Refinement's half went in one proposal (`BO_0280_006`): `calliopa-refine`'s `server/evaluation.ts`
  is a thin caller of `POST /__kernel/evaluate` holding no credential, no switch and no question of
  its own; `lib/classify-question.ts`, `server/classify.ts`, `lib/evaluation.ts`, `lib/settings.ts`,
  `server/settings.ts`, the settings section and its routes, the `calliopa-refine-evaluation` party,
  the `evaluation` convention on `refine.classify`, `claimBefore`/`claimAfter` on `record_judgement`
  and `probability`/`runOutcome` on the `judgement` type went with it. `RF_0002` stands at
  `rejected` with its findings kept, and `RF_0002_012` stays open on its own. `RF_0003`'s
  investigation score moved to the endpoint by the user's decision of 2026-09-22, since it runs
  where a person pressed and the browser's cookie is forwarded.
- The walk finished through the toolset (`BO_0280_007`, 2026-09-23 at pin 1704): a `codex` run asked
  `evaluate` a `choice` and a `boolean` in one call and was answered `precise` at `0.96` with every
  option's probability, its record carrying `parties: {evaluation: 1}`; with the key cleared from
  the row the same run reports the service's own words and its record carries no party, because
  nothing was spent. The script half was walked 2026-09-22 at pins 1487 and 1540, where all three
  question types were answered by the gateway itself.
- The release notes carry the service under Added, in place of the line `RF_0002` wrote for the
  switch that no longer exists.
