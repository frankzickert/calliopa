# BO_0225_FEAT_agent-runtime-selection

Status: completed

Requested: 2026-09-09, after a command run from a document failed with *no step reported*. **When the user signs in to codex or claude, I want hermes to connect automatically to them. Further, I want a selector inside the calliopa command area, where I can select the agent that should perform the command. Optionally: can we let hermes work with multiple subscriptions — let hermes decide which provider/model is best for the given command?** User statement.

## Where This Starts

- **A run names its runtime, and the browser never names one.** `Run.Agent` is *"the user's explicit runtime selection for the run: `provider` (the configured API-key model), `claude-code`, or `codex`. Selection is explicit per run — never automatic routing"* (`internal/kernel/agentbridge/bridge.go:44`, `BO_0089_006`), a rule `BO_0168` leaned on again when it recorded the intention beside it. The whole path for naming one exists: `sendGoal$` posts to `/api/workspaces/{id}/runs`, the route reads `body.agent`, `conductRun` takes it, `startBridgeRun` sends it, the bridge switches the controller for it. Only the first link is missing — `shell.tsx:326` posts `JSON.stringify({ goal })` and nothing else, so `conductRun` always falls to its default: `input.agent ?? (await agentStatus())?.runtime ?? "codex"` (`conductor.ts:62`), the runtime the agent container last stamped.

- **The stamp is what the gateway started under, not what can run.** The hermes entrypoint writes `active-runtime.json` as `{"runtime": …, "kernelCredential": …, "kernelToolset": …}` at the end of `write_config` (`infra/hermes/entrypoint.sh:204`), from `CALLIOPA_AGENT_RUNTIME` on the shared volume. It stamps the selection *as fact for the surfaces that report them*, and the selection is not checked against what the container can configure.

- **Only `codex` produces a model.** `write_config`'s case block writes `model:\n  default: …\n  provider: openai-codex\n  openai_runtime: codex_app_server` for `codex`, and for every other runtime — the `provider` and `claude-code` selections both — writes a model line *only* when `CALLIOPA_AGENT_MODEL` is set (`infra/hermes/entrypoint.sh:165-188`), which the comment there calls *"a configuration path and normally unconfigured; Calliopa ships with no model API key"*. The kernel submits `input` and `instructions` alone (`internal/kernel/agentbridge/hermes.go:66`); the model is resolved by Hermes from `config.yaml`. A selection with no model line is therefore a gateway that accepts no run at all: `HTTP 400: model: String should have at least 1 character`.

- **Nothing moves the selection back to a runtime that works.** `runtime.env` is written in exactly one place — `setRuntime` (`internal/kernel/serve/agent.go:56`) — and called from exactly one place: `StartRun`, when the run's own `agent` names a controller different from the active one (`bridge.go:167`). Since the browser names no agent, the run's agent *is* the active runtime, the controllers always match, and no switch is ever requested. An instance stamped `provider` with no model can therefore never leave that state from the browser. This instance was in it: every run failed for four days across two runs on record.

- **Signing in does not reach the selection either.** The login broker runs the runtimes' own flows and writes what they are into `adapters.json` — installed, version, authenticated, billing (`infra/hermes/login_broker.py`, `CA_0022_006`) — and never `runtime.env`. The gateway restarts on an mtime change of `runtime.env`, `provider.env` or `claude.env` alone (`entrypoint.sh:214`, `:243`), so a completed Codex sign-in changes nothing the loop watches: the credential lands and the gateway keeps running the configuration it started with. The Claude flow restarts only incidentally, because its captured token is written to `claude.env`.

- **Health reports ready anyway.** `Bridge.Health` calls `configured()` (`internal/kernel/serve/agent.go:189`), which answers true when *any* adapter is installed and authenticated — not when the active runtime is one of them. With Codex and Claude both signed in and `provider` active with no model, the bridge reports `state: ready` while every run it accepts fails. The settings surface is more honest by accident: `asAgent` reads `reported[stamped.runtime]?.authenticated ?? false` (`connections.ts:146`), and `provider` is not a key `adapters.json` carries, so the Hermes row reads *unconfigured* — with no error text, because that branch sets `lastError: null`.

- **Both subscriptions are already pooled in Hermes.** `hermes auth list` in the running container answers `anthropic — CLAUDE_CODE_OAUTH_TOKEN oauth` and `openai-codex — device_code oauth`. Nothing is missing credential-wise for either; what is missing is a `model:` block naming them.

- **Hermes 0.19.0 does not route by task.** `hermes fallback` is *"the fallback provider chain … tried in order when the primary model fails with rate-limit, overload, or connection errors"* — resilience, not judgment — and `hermes moa` configures the slots used by an explicit `/moa <prompt>`. There is one default model per gateway configuration.

- **The console could not report any of this.** `followBridgeEvents` was the one bridge call that did not forward the browser's session (`bridge.ts:178`), because it cannot go through `ask` — it needs the body unread. The prod listener's `anonymousGate` refuses every session-less request (`internal/kernel/serve/proxy.go:133`), so the stream answered `401`, `followRun` failed the process with the transport's words, and the run's own `run.failed` event — the sentence naming the missing model — never reached the reader.

## Intent

* Signing in to a runtime connects the agent to it. The person pressed *Sign in* on Codex; they should not then have to discover that the gateway is still reasoning as something else, or that nothing will restart until an unrelated file's mtime changes.

* The command area says which agent will perform the command, and lets the person choose another before pressing Run. A runtime that cannot run is offered as what it is — named, unselectable, with the reason in words — rather than omitted or offered and then failing.

* An instance can never again be stranded on a runtime that accepts no run: the gateway resolves the selection against what it can actually configure, and says in its stamp when the two differ.

* The kernel stops reporting `ready` for an agent whose active runtime cannot run.

## The Shape

- **A runtime is configurable or it is not, and the answer lives where the answer is already made.** `write_config` is the one place that decides whether a `model:` block can be written. It gains `runtime_configurable`, over the same two facts it already reads — the runtime name and `CALLIOPA_AGENT_MODEL` — and `resolve_runtime`, which answers the selection when it is configurable and otherwise the first configurable runtime there is. Nothing else in the system re-derives the rule.

- **The stamp gains what it was missing: what was chosen, beside what is running.** `active-runtime.json` becomes `{"runtime": <resolved>, "selected": <chosen>, "reason": <why they differ, or absent>, "kernelCredential": …, "kernelToolset": …}`. `runtime` keeps its meaning — what the gateway is running, which is what `conductRun` must default to — so the resolution corrects the default rather than adding a second source for it. A fallback is never silent: `selected` and `reason` are what the surfaces read to say so.

- **Signing in writes the selection.** On a sign-in the broker reports as successful, it writes `CALLIOPA_AGENT_RUNTIME=<runtime>` to `runtime.env` — the human's explicit choice, made by the act of signing in — which is also the mtime change the watch loop needs to rebuild `config.yaml` and restart the gateway. The broker does not decide whether the runtime can run; `resolve_runtime` does, on the restart the write triggers, and stamps the disagreement.

- **The command area gains a selector.** `GET /api/agent/runtimes` answers `{runtimes: [{id, label, selectable, reason}], active}` from `runtimeStatuses()`, the stamp, and the presence of a controller model — all three already readable from the shell's own config directory, so the kernel gains no endpoint. The composer renders a `<select>` beside the Run button, defaulted to `active`, its unselectable options disabled and carrying their reason; `sendGoal$` posts `{goal, agent}`. Everything behind the post already exists.

- **`configured()` asks about the active runtime.** It answers true when a `provider.env` is present, as it does today, and otherwise when the *stamped active* runtime is installed and authenticated — rather than when any runtime is. An instance whose active runtime cannot run reports `unconfigured`, which is the state the console already renders with the setup action.

### Out Of Scope

- **Hermes deciding which provider or model suits a command.** Hermes 0.19.0 offers no such routing — `fallback` is a failover chain and `moa` is an explicit prompt — and it is refused independently of that: `Run.Agent` says selection is *never automatic routing* (`BO_0089_006`), and `BO_0168` recorded the intention beside the agent for the same reason, that a run's behaviour cannot be judged against a choice nobody can read back. A router would make every run's reasoning unattributable. A fallback chain for rate-limit and overload errors is a separate change and is not this one.

- **Claude as the controller.** `claude-code` keeps the `provider` controller and needs a model block for it; the pooled Anthropic OAuth credential would serve one, but the entrypoint's comment records the decision that *"hermes's own Anthropic OAuth path bills extra-usage credits and is deliberately not used"*. Reversing that is a cost decision the user declined for now, so `claude-code` is offered in the selector as unselectable with that reason, and no Anthropic model block is written.

- Per-run model choice within a runtime, and any second model configured at once.

- Changing what a gateway restart costs. A controller switch still restarts the gateway and the bridge still waits for it (`bridge.go:170`); the selector spends that when the person chooses a different runtime, and the wait is what it is.

### Decided

Decided by the user on 2026-09-09:

- **Codex-only selector for now.** Both runtimes are listed; `claude-code` is disabled with its billing reason shown, until the extra-usage question is answered. Accepting extra-usage billing, and configuring an API key for the controller, were the alternatives and were not chosen.

- **The running instance is not touched.** The fix reaches it as a built image and a promoted shell, not as an edit to the agent-config volume. Its runs keep failing until then.

## Verification

- In the agent container, over the real entrypoint: a selection of `provider` with no `CALLIOPA_AGENT_MODEL` resolves to `codex` and stamps `selected: provider` with a reason; a selection of `codex` resolves to itself and stamps no reason; a selection with nothing configurable resolves to itself and leaves the surface to report `unconfigured`.

- In the kernel, `configured()` against a stamp naming a runtime `adapters.json` does not carry, and against one it carries authenticated.

- In the shell, `selectableRuntimes()` over the three states, and `followBridgeEvents` carrying the session — the last already proven, failing against the unfixed call and passing against the fixed one.

- In the browser, the composer's selector pressed in Qwik's render harness before promotion, per `BO_0224`'s lesson.

## Implementation

- 2026-09-09. `followBridgeEvents` forwards the session cookie (`distribution/seed/tree/src/server/agent/bridge.ts`), with a unit test that fails against the unfixed call. This is what made the failure legible at all; it is recorded here rather than as its own change because it is the same report.

- 2026-09-09. The agent container's half (`BO_0225_001`, `BO_0225_002`): `runtime_configurable` and `resolve_runtime` in `infra/hermes/entrypoint.sh`, the stamp carrying `selected` and `reason` beside `runtime`, and `select_runtime` in `infra/hermes/login_broker.py`, which writes the selection a completed sign-in makes and is also the mtime the watch loop needs. `internal/config/agent_runtime_resolution_test.go` lifts the two functions out of the shipped entrypoint and runs them under a real shell, so the assertions are about the text that runs in the image. The recipe copies under `distribution/build/hermes/` are in step, as `scripts/release-distribution.sh` keeps them.

- 2026-09-09. The kernel's half (`BO_0225_003`): `configured()` asks about the stamped active runtime rather than about any signed-in one, proven over five stamps in `internal/kernel/serve/agent_configured_verification_test.go`. The whole `serve` package passes against a live Postgres.

- 2026-09-09. The shell's half (`BO_0225_004`): `selectableRuntimes()` and the stamp's new fields in `src/server/agent/adapters.ts`, `GET /api/agent/runtimes`, the `AgentSelector` component and its row in the composer's grid, and `sendGoal$` sending the chosen runtime. The selector is its own component so that it can be pressed: `agent-selector.test.ts` renders it in Qwik's harness, reads the options' attributes and changes the control, after `BO_0224_009`. The harness earned it twice — `option.value` there falls back to the option's text and `option.selected` is undefined, so a property-shaped assertion would have reported a defect the browser does not have, and the empty option's value is proven by changing the control instead. 249 unit tests and the typecheck pass.

- 2026-09-09. The agent and kernel halves are deployed: `docker compose --profile kernel up -d --build app kernel hermes`. The instance left the state it could not leave on its own — the stamp now reads `{"runtime": "codex", "selected": "provider", "reason": "the provider runtime names no model, so it accepts no run; …"}`, the entrypoint logged *agent configuration written for runtime codex instead of provider*, and `hermes status` answers *Model: gpt-5.5, Provider: OpenAI Codex* against a configuration that had named no model for four days. No sign-in was needed to recover it.

- 2026-09-09. The shell half is staged as proposal `node:chg-2884ae2badcac365`, ten files, committed from a checkout of head (dataRevision 155) with `--map-root ui.shell`, which is what discovers the four new root-level files — `kernel diff` lists only the six changed ones. The checkout's own suite passes there: 363 tests, 34 files, and a clean typecheck. `tsconfig.tsbuildinfo` is written by the typecheck and must be removed before the commit, as in `BO_0223`.

- 2026-09-09. Accepted and promoted: **release pin 157**. The promotion's build reported `Duplicate key "value" in object literal` from `agent-selector.tsx` — a warning, so the pin advanced, but one this change put there. The cause is the conditional JSX spread that set `title`: Qwik's optimizer materializes props as getters when a spread is present, so every option carried a `value` getter beside the signal-wrapped `value`. Bisected against the shipped build — the prop's name and the `key` were both innocent, the spread alone reproduces it. The `title` was redundant anyway, since the reason is in the option's text where a touch screen can read it, so removing it is the whole fix. Staged as `node:chg-56ac18cfd6a88953`, one file, committed from a fresh checkout of head (dataRevision 158); the SSR build in that tree is clean.

- 2026-09-09. The follow-up was accepted and promoted: **release pin 160** (dataRevision 161). The promotion's own build carried no `Duplicate key` line, and the served tree's `agent-selector.tsx` mentions `title` only in the comment that says why it has none.

- Completed 2026-09-10. The user walked the served shell at pin 160 and reported the composer's selector working: it stands beside Run, defaults to Codex, and a command run on it completed — the last line of Verification. The task rows were never transferred before implementation, since the change went from the user's report straight to work; they are folded into truth now, `BO_0225_001`–`BO_0225_002` in `docs/system/hermes.md` (Runtime Selection), `BO_0225_003` in `ui-kernel.md` and `BO_0225_004` with the `followBridgeEvents` fix in `ui-shell.md`. One correction to Decided: `claude-code` is disabled with the reason that follows from the billing decision rather than the billing sentence itself — *Claude Code reasons through the API-key controller, which has no model configured* — because the selector states what keeps a runtime from running, and the unwritten model block is that. The copy of the shell half under `distribution/seed/tree/` is redundant: the seed is regenerated from the accepted pin by `scripts/release-distribution.sh` and will be replaced by the graph's version at the next release. Left open, each outside this change: the Claude extra-usage question, a fallback chain for rate-limit and overload errors, and a change document for the kernel image's CA-certificates fix that was committed with this one.
