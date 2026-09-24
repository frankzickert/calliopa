# Extension Development In The App

Status: completed

Today an extension is administered from the app and developed from outside it. A person creates,
imports, exports, activates, pins and promotes an extension in the browser; but writing its change
document, claiming its tasks, changing its code, running its tests, judging the result and
previewing it all happen through `kernel` verbs in a terminal, from a checkout. This change collects
what would have to become true for the whole loop to happen inside Calliopa, and where the boundary
honestly is.

## What Is Already Inside

- **Administration.** The Extensions section creates an extension (manifest plus
  `docs/system/system.md`, arriving switched off), imports and exports an archive, and the extension
  view toggles activation, flips the served version and promotes through the gate, reporting a
  refusal in the kernel's own words (`BO_0218`, `BO_0219`, `BO_0224`).
- **Reading.** An extension opens as a read-only network of its `docs/` members — purpose, topics,
  requirements with their commitment and state, changes with their `Status:` line, questions,
  history (`BO_0201`, `BO_0254`).
- **Runs.** A person sends commands from the composer to Codex, Claude Code or Hermes, at two
  speeds, side by side, per person, with attachments (`BO_0228`, `BO_0232`, `BO_0269`).
- **The code tools already exist and are already served.** `WorkspaceRoot` is set whenever the
  kernel has a data directory, so every bound run is offered
  `calliopa_workspace_checkout|build|check|list|read|edit|create|delete|diff|commit` — a materialized
  `(pin, own group)` tree, `pnpm install` + build + typecheck, the tree's `check` script, and a
  whole-tree commit into the run's group (`BO_0089_014`, `internal/kernel/agenttools/workspace.go`).
- **Acceptance from the browser.** The review bridge parks an `accept` and answers its confirmation
  URL; the extension-import tab already walks a person through accept → switch on → serve.

So the machinery is much closer than the daily practice suggests. What is missing is mostly the
surfaces around it, one skill, and three kernel verbs.

## What Is Missing

### 1. The change document cannot be written in the app

`BO_0254` made an extension's change documents read-only `ext.source` members, written by an agent
from a checkout in the proposal that carries the code, and removed the section's create control.
Promoting one to `draft` or `ready` is therefore a checkout, a `sed` and a `kernel commit` in a
terminal — which is the step this repository's scratchpad records most often. Claiming a task
(`[ ]` → `[x]`) and folding it into truth are the same edit through the same route.

Needed: a person establishes a change's status from the extension row, and a run writes and revises
change documents and `docs/` members as part of the proposal that carries its code (Decided). Both
keep the two rules the protocol rests on — only a person promotes to `draft` and `ready`, and the
status is established by accepting the proposal that changes the line.

### 2. Nothing tells a run to do code work

Skill selection is by intention. The `extend` intention exists and `calliopa-extension`'s
`create-extension` skill teaches the conventions, but its `docs` convention still states that *a run
working from the composer holds no checkout and so writes none*, and its `authoringRoutes`
convention describes the materializer round-trip as a human's. No skill names the workspace tools as
the route a composer run takes.

Needed: the skill says what a code run does, in order — read the change document and the topics it
names, check out, edit, build, check, test, commit into the group, write the docs and the `Status:`
line in the same commit. And the run has to know which extension and which change it is working on,
the way a document run knows its document.

### 3. The toolset cannot run the tests

`build` is install + build + typecheck and `check` is the tree's format/lint gate. There is no verb
for the tree's `test` script, so every unit and behaviour suite is run outside today. A whole suite
is also slow, so a verb that can run one project or one file is worth more than one that cannot.

### 4. Nothing in the app says what a staged change is

*A review of code in the shell* is a stated **Not Here** in the contribution contract, and it stays
one: a person does not read code to judge a change (Decided). What is missing is therefore not a
diff but the evidence that stands in its place — the gates' results, the run's account of what it
did, the counts of what was touched, and a way to try the thing. Today none of that is gathered
anywhere a person looks, so a code proposal is accepted on trust alone or judged from a terminal.

### 5. There is no way to try a change before accepting it

The overlay preview with its non-forgeable banner is `kernel serve --mode dev`; an instance serves
prod. The promotion gate already materializes, installs, builds, type-checks and serve-probes a
candidate in a throwaway tree, so building `(pin + this group)` and letting a person open it is close
to machinery that exists — but nothing exposes it. The shape is a candidate served beside the
instance rather than an overlay on it (Decided), so the banner's trust posture is not moved: the
whole-instance overlay and its non-forgeable banner stay where they are, in dev mode.

### 6. A new npm dependency is an elevated change

`package.json`, the lockfile, `vite.config` and `tsconfig` are root-mapped `ext.source` members of
`ui.shell`, and only elevated extensions may claim root-mapped paths. So an extension that needs a
dependency the tree does not already hold cannot get it without a change to `ui.shell`, whose
acceptance requires human identity class. This is correct and should stay; it should be *said* in
the app, rather than discovered as a refusal.

## Where The Boundary Honestly Is

- **The fixed layer stays outside.** The kernel, CCGW and the cell, the compose stacks, the seed and
  the distribution are Go and compose in this repository, shipped as images. Nothing about moving
  extension development into the app moves them, and the change should not pretend otherwise.
- **`kernel diagnose` stays a CLI verb** by the `BO_0205` decision, and the confirmation page stays a
  second origin by the `BO_0103` decision. Both are in the browser; neither is in the shell.
- **A `bundled` extension is only partly in.** Its change still owes a line to
  `docs/release-notes/unreleased.md` here, and the release is still cut here. For an `individual`
  extension — which is what a person building their own extension has — nothing outside is required
  once the gaps above close. That asymmetry is the first scope (Decided).
- **`ui.shell` is elevated.** Developing the shell from inside the shell is possible in principle and
  is where the preview and the last-known-good floor earn their keep, but it is the hardest case and
  is explicitly not the first one (Decided).

## Decided

User decisions, 2026-09-23, in the order they were taken.

* **A person does not read code to judge a change.** There is no diff surface — not in the shell,
  not on the confirmation page, not anywhere. Judgement rests on four things instead: the change
  document saying what the work should do, the run's own account of what it did, the gates being
  green (build, typecheck, the tree's `check`, the tests), and the served candidate the person can
  try. *A review of code in the shell* stays a **Not Here** in the contribution contract, unmoved.
* **The kernel's confirmation page stays exactly as it is.** `BO_0103`'s anchor is untouched: the
  human-mutation gate on the app origin, the parked `accept`, the second listener, the token that
  exists only in the confirmation page. In-app acceptance was considered and declined once the chain
  it opens was stated — the served shell is graph content, so a script on the app origin that could
  accept could also promote, and an agent's staged code would become the shell with no human in the
  loop. Nothing in this change reshapes it, and there is no separate change to do so.
* **A change document's body is written by a run, its status established by a person.** The run
  writes and revises `docs/changes/*.md` from its workspace checkout, in the proposal that carries
  the code — which is what the protocol already says. The person's half is the `Status:` line alone:
  a control on the extension's change row stages a one-line proposal changing it, and accepting that
  proposal establishes the status. `ui.shell` gains no text editor and declares no dependency on
  `documents`, so `BO_0254`'s reason for existing is preserved.
* **A staged change is previewed as a candidate served beside the instance, never as an overlay on
  it.** The promotion gate already materializes, installs, builds, type-checks and serve-probes a
  candidate in a throwaway tree; its serve process is kept alive on its own address for a bounded
  time, reachable by the person who asked for it. No other session changes. The dev-mode
  whole-instance overlay and its banner stay where they are.
* **The first scope is `individual` extensions.** They ship in no release, so they owe no release
  note and no release cut, and everything they need can close inside the app. A `bundled`
  extension's release half stays in this repository; `ui.shell` — elevated, root-mapping, and the
  thing the app is made of — is explicitly not the first case.
* **A change's runs share one group and one build tree.** A run working on a change stages into that
  change's open proposal group rather than opening its own, and so reaches the same workspace with
  its warm `node_modules`; the materializer already does this for an overlaid tree (`BO_0089_013`).
  The change arrives as one proposal to judge rather than three, which matters more now that a
  proposal is judged whole rather than read hunk by hunk.

- What the shell shows beside all this, following from the first decision: the kernel's summary in
  the extension view — the counts of files and members touched, the gate results, the run's account,
  and the link to the served candidate — reusing the shape the import summary already renders. The
  confirmation page keeps the wording it has.

## Open

- [ ] Functional question: may a run working from the composer hold a workspace checkout? `AGENTS.md`
      and `calliopa-extension`'s `docs` convention both record, as a user decision of 2026-09-16
      (`BO_0254`), that *a composer run holds no checkout and so writes none* — while the kernel
      serves the whole workspace toolset to every bound run, so mechanically it already can. Two of
      the decisions above rest on it: a run cannot write a change document or share a build tree
      without one. The decision needs to be either reaffirmed, in which case those two decisions need
      another shape, or replaced with the rule that a code run does hold one.

## Verification Shape

- The loop's proof is the existing open task `BO_0200_010` (`hermes.md`): a run that holds the kernel
  toolset, stages a proposal group in the extension namespace through the workspace tools, is
  reviewed, accepted and promoted. It has never been run, and running it once is the cheapest way to
  learn which of the gaps above are real and which are already closed.
- Nothing here is implementable until the change is `draft` and its work is enumerated in
  `docs/system/` with identifiers; the extension halves belong in `ui.shell`'s and
  `calliopa-extension`'s graph docs.
