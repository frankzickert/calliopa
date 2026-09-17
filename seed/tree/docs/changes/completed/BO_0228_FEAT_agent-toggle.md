# BO_0228_FEAT_agent-toggle

Status: completed

Requested: 2026-09-10, after asking whether Claude would work if commands went to it directly. **The claude subscription does not work with the hermes agent in the tool. Would claude work, if I sent the user commands directly to it?** Then: **create a change doc 0228: let the user decide in the command shell with a three-state toggle (openai-icon, claude-icon, hermes-agent-icon) which agent the command should be sent to.** User statements.

## Where This Starts

- **The composer already sends a choice, but only one of its three choices can run.** `AgentSelector` (`src/components/shell/agent-selector.tsx`, `BO_0225_004`) is a native `select` listing Codex, Claude Code and the API-key model, with an empty *Choose an agent* option first. On this instance only Codex is selectable. Claude Code is disabled because *"Claude Code reasons through the API-key controller, which has no model configured"* (`src/server/agent/adapters.ts:138`), and the API-key model is disabled because there is no `provider.env`.

- **Claude is a worker under someone else's controller, and that is the reason it cannot run.** `StartRun` maps every selection except `codex` to the `provider` controller (`internal/kernel/agentbridge/bridge.go:254`). For `claude-code`, the instructions then tell that controller to shell out: *"perform this goal's implementation work by running the Claude Code CLI through your terminal tool — for example: claude -p …"* (`bridge.go:971`). Whether that happened is inferred afterwards by matching `claude` in a tool preview (`bridge.go:371`, `run.Delegated`). The controller needs `CALLIOPA_AGENT_MODEL`, and Calliopa ships without a model API key, so the Claude subscription alone runs nothing.

- **The Claude subscription is not the problem. Hermes's way of using it is.** Hermes's own Anthropic OAuth provider bills extra-usage credits rather than the plan allowance. That was verified against a live billing refusal and is deliberately not used (`hermes.md`, Pinned Upstream Contract). The Claude Code CLI with `CLAUDE_CODE_OAUTH_TOKEN` runs on the plan: `BO_0089_010` observed it as the delegated worker, and fresh Claude session artifacts on the state volume confirmed Max-subscription execution. The login broker already captures that token into `claude.env` (`infra/hermes/login_broker.py:375`).

- **The CLI can be the agent itself.** At the version installed in the agent container (`claude --version`: `2.1.251`), `claude -p` takes `--output-format stream-json`, `--mcp-config` with `--strict-mcp-config`, `--tools ""` (no built-in tools), `--allowedTools`, `--append-system-prompt`, and `--permission-mode dontAsk`. That is a headless agent that holds the kernel toolset and nothing else, and it never asks for approval. The Dockerfile installs `@anthropic-ai/claude-code` unpinned (`infra/hermes/Dockerfile:33`).

- **The bridge's upstream contract is small, and nothing in it is specific to Hermes.** The bridge uses five calls: `POST /v1/runs` with `{input, instructions}`, `GET /v1/runs/{id}`, `GET /v1/runs/{id}/events`, `POST /v1/runs/{id}/stop` and `GET /health` (`internal/kernel/agentbridge/hermes.go`). It normalizes a handful of event names: `response.output_text.delta`, `tool.started`, `tool.completed` with a boolean `error`, `run.completed` with `output`, `run.failed` and `run.cancelled` (`bridge.go`, `consume`). Each run's principal, pin and group are bound inside the Calliopa tool server, not in Hermes, because Hermes's MCP client carries no per-call identity. Any process that reaches the kernel toolset with its bearer during a bridge-started run therefore acts as that run.

- **Hermes has an agent of its own, distinct from Codex.** The OpenAI selection runs Hermes as a gateway around `model.openai_runtime: codex_app_server`, which *"hand[s] the entire turn to a `codex app-server` subprocess so terminal/file-ops/patching/sandboxing run inside Codex's own runtime instead of Hermes' tool dispatch"*. The default, `openai_runtime: auto`, is Hermes's own loop (`codex_responses`) on the same `openai-codex` provider (`hermes_cli/runtime_provider.py`, `codex_runtime_switch.py` in hermes-agent 0.19.0). So *Codex* and *Hermes* can be two different agents on the one ChatGPT subscription. Switching between them rewrites `config.yaml` and restarts the gateway, and the bridge already waits up to 90 seconds for that (`bridge.go:270`).

- **A Claude sign-in moves the gateway somewhere it cannot go.** `select_runtime` writes the signed-in runtime to `runtime.env` (`login_broker.py:395`, `BO_0225_002`). For `claude-code`, `resolve_runtime` then falls back to `codex` and stamps *"the claude-code runtime names no model"*. Today that is true. Once Claude stops needing a gateway model, it stops being true.

## Intent

* The person chooses, per command, which of three agents performs it: Codex, Claude Code or Hermes. The choice is a dropdown in the composer, each agent shown by a face.

* Choosing Claude runs Claude Code itself on the person's Claude subscription. There is no API key, no controller model underneath, and no extra-usage billing.

* All three agents do the same job. They receive the same instructions, hold the same kernel toolset, stage into the run's one group, and write the same record. The only difference is who reasons.

* Anything that keeps an agent from running is still said in words the person can read without hovering (`BO_0225`). A choice is never swapped silently (`BO_0089_006`).

## The Shape

### The agent dropdown

- **`AgentMenu` replaces `AgentSelector` in the composer.** It is its own component, so that it can be pressed in Qwik's render harness (`BO_0224_009`). Closed, it shows the chosen agent's face in a circle and a chevron, and its accessible name says which agent it is (*Agent: Codex*). Open, it lists all three agents, each with its face and its name (*Codex*, *Claude Code*, *Hermes*); for Hermes the name includes the model it reasons with (*Hermes · gpt-5.5*). Each image's `alt` is left empty, so the name is read once. A native `select` cannot show a face, so the control follows the select-only combobox pattern: a button with `aria-haspopup="listbox"` and `aria-expanded`, and a `listbox` of `option`s that opens upward from the dock. The arrow keys, `Home`, `End` and typing a name move through it, `Enter` chooses, and `Escape` or a press outside closes it with the choice unchanged. Targets are at least 44px, so the dropdown works on the phone the rest of the composer already works on. Where it sits in the composer is `CA_0039`'s: left of the field.

- **An agent that cannot run is listed and explains itself.** It is dimmed and desaturated, and its reason stands as text under its name, so it is read without hovering. It is marked `aria-disabled` rather than removed, so it is still reached and its reason read. Choosing it leaves the choice where it was. The reason text comes from `selectableRuntimes()`, as it does today.

- **There is no empty state.** *Choose an agent* goes away, and `sendGoal$` always posts `agent`.

- **The dropdown opens on the instance's last choice.** Choosing an agent writes the choice to `agent-choice.json` in the agent-config directory, which the shell already writes to for `login/request.json`. `GET /api/agent/runtimes` answers it as `chosen`, beside `active`, `selected` and `reason`, so every device opens on the same agent. Writing the choice restarts nothing: a gateway switch still happens only when a command is sent to an agent the gateway is not running (`bridge.go:254`). If nothing is chosen yet, the dropdown opens on the gateway's running runtime (the stamp's `runtime`). If the chosen agent cannot run, it opens on the running runtime and says so in the notice line (*"Claude Code is not signed in — opened on Codex"*), so that fallback is never silent either.

- **The faces are the agents' characters from `calliopa-video`**, not the vendors' logos. Codex is Codey, Claude Code is Clauderic, and Hermes is, for now, the Fairytales barista robot (`library/characters/`). Each face is a square crop, cut once and scaled down:

- Codey: the top-left panel (front, neutral) of `codey/codey_face.png`.

- Clauderic: the top-left panel (front, neutral) of `clauderic/clauderic_face.png`.

- The robot: the head of the front view in `ftrobot/ftrobot_turnaround.png`. There is no face plate for it, and the visor is its face by canon (`barista-robot.md`: *"No face"*).

The plates run 2 to 4.5 MB, so the crops ship as small WebP files at twice the display size under `public/agents/`, served beside `public/laurel.png`. They land in the graph as binary `ext.source` Blocks, which the materializer already carries (`language: "binary"`). Shown in a circle, each keeps its own ground, so they read the same in light and dark. A dimmed, desaturated face marks an agent that cannot run, and a ring marks the chosen one. A comment beside the images records each crop's source file and panel, so the faces can be cut again when the characters change.

### The Claude runner

- **A small process in the agent container runs Claude Code, and it speaks the subset of Hermes's runs API the bridge already uses.** `infra/hermes/claude_runner.py` sits beside the login broker. The entrypoint's supervision loop starts it, and it answers on the compose network under the same API bearer as the gateway. It lives in that container because the CLI, the Claude home on `hermes-data` and `claude.env` are already there. Speaking Hermes's protocol means the bridge's event normalization, its status-poll backstop (`BO_0089_012`), its busy refusal and its record keeping all apply unchanged.

- **Each run is one `claude -p` process:** `--output-format stream-json --verbose --tools "WebSearch,WebFetch" --strict-mcp-config --mcp-config <file> --allowedTools mcp__calliopa-kernel WebSearch WebFetch --permission-mode dontAsk --append-system-prompt <instructions>`. The goal arrives on stdin, and the working directory is an empty per-run directory. The MCP config names the kernel toolset's URL, with the bearer taken from the environment rather than written into the file, the same way Codex's registration does it. A tool call outside the allowed set fails; it never pauses for approval (`BO_0089_007`). Neither `--dangerously-skip-permissions` nor `bypassPermissions` is ever passed.

- **Claude gets the kernel toolset plus web search and web fetch**, matching what Codex's `web_search` gives it. The terminal, the file tools and every other built-in tool stay off. Two things follow from giving it the web:

- What a fetched page says is data, and anything it stages still waits for a human to accept it.

- `WebFetch` runs inside the agent container, so it can reach the compose network. It sends a URL, never a header, so the kernel toolset's bearer cannot travel with it, and every kernel route it could reach without that bearer answers `401`. Verification checks that at the pinned version rather than assuming it.

- **The runner translates the CLI's stream into the event names `consume` reads.** A `tool_use` block becomes `tool.started`, its `tool_result` becomes `tool.completed` with `error`, and intermediate assistant text becomes `response.output_text.delta`. The final `result` travels once, as `run.completed`'s `output`, the way Hermes sends it. A non-zero exit or an error result becomes `run.failed` with the CLI's own words. If the CLI's `init` event does not report `calliopa-kernel` as connected, the run fails there, before the model spends a turn. Stop sends `SIGTERM` to the process group, then `SIGKILL`. Tool names arrive as `mcp__calliopa-kernel__<tool>`, which the bridge's suffix checks (`calliopa_workspace_check`, `calliopa_workspace_build`) already match.

- **The CLI version is pinned** at the one these flags were verified against, and it is re-verified at every bump, the way the hermes elicitation patch is.

### The kernel

- **`StartRun` chooses the upstream by agent.** `Config` gains a second runs client pointed at the runner. The type is renamed for what it now is: a runs-API client, of which Hermes is one. `claude-code` goes to the runner and requests no gateway switch. `codex` and `hermes` go to the gateway and switch its configuration when it is running the other one, as today. The record names which upstream a run went to, so `Cancel`, `consume` and the backstop poll reach the right one. Runs stay serialized stack-wide, because the tool binding is global (Pinned Upstream Contract). A Claude run and a gateway run never overlap, even though they use different processes.

- **The delegated worker is retired.** The instruction sentence at `bridge.go:971`, the tool-preview sniffing that sets `Delegated`, and `executedBy`'s *"was not observed delegating"* branch are removed. For a Claude run, `executedBy` is `claude-code` plus the model the CLI's `init` event names, which the runner reports. Records written before this change keep their `delegated` field and its meaning.

- **The instructions name the agent they address.** *"You are Hermes working inside Calliopa"* becomes a sentence that names whoever received the run. The rest does not change, because it already describes the `calliopa_*` tools and not any one agent's terminal. The rendering stays deterministic (`skill_selection_test.go`).

- **This change builds on `BO_0226`'s request struct and lands after it.** The composer's layout is `CA_0039`'s, which lands after this change. It places the dropdown left of the field and replaces the delivery control that `BO_0226_005` added.

### The agent container

- **A Claude sign-in stops writing the gateway's selection.** `select_runtime` skips `claude-code`, because Claude no longer runs through the gateway. The dropdown carries the choice per command, and `claude.env`'s new mtime still restarts the loop so the runner picks up the token.

- **`hermes` is a new gateway runtime: Hermes's own loop.** By default it reasons on the ChatGPT subscription, and `write_config` writes `provider: openai-codex` with `openai_runtime: auto` and the same `CALLIOPA_CODEX_MODEL`. Hermes's own tool dispatch runs under the gateway's default approvals, as the API-key path always did (`BO_0089_010`), and Hermes's own loop applies a run's instructions natively, so `BO_0226_011`'s patch, which exists because the Codex app server dropped them, is not involved. The settings surface offers the API-key model from `provider.env` as the explicit alternative; it is never an automatic fallback. The choice between the two is written to `runtime.env` as `CALLIOPA_HERMES_MODEL=subscription|provider`. `runtime_configurable` answers `hermes` by that choice: the subscription needs Codex signed in, and the API-key model needs `CALLIOPA_AGENT_MODEL`. The intake keeps accepting `provider` for the CLI, where it means Hermes on the API-key model, as it always has. `claude-code` is dropped from the controller comment in `write_config`.

- **`selectableRuntimes()` checks each agent against what it actually needs.** Claude Code needs the CLI installed, signed in, and the runner healthy; the controller-model condition is removed. Hermes needs whatever its chosen model needs, and the dropdown names that model.

## Out Of Scope

- **Hermes or anything else choosing the agent.** `BO_0225` already refused automatic routing on `BO_0089_006`'s grounds, and Hermes 0.19.0 offers no such routing anyway. The Hermes state means Hermes's own agent loop with one configured model. It does not mean "let Hermes decide".

- **Codex without Hermes.** The OpenAI state stays Codex through the gateway, which has been verified since pin 160. Symmetry with the Claude runner is not reason enough to rebuild a path that works.

- **Hermes's Anthropic OAuth provider.** It is still unused, for the billing reason recorded in `hermes.md`.

- **Concurrent runs across agents,** for the tool-binding reason above.

- **A per-run model choice within an agent** (Opus or Sonnet, `gpt-5.5` or another). `BO_0225` excluded it, and this change leaves it excluded. Whether Hermes reasons on the subscription or the API-key model is an instance setting, not something chosen per command.

- **Whether the distribution may offer Claude sign-in to other operators.** That is a terms question that predates this change, since `BO_0089_006` already offers the sign-in. This change is about the operator's own subscription on their own instance.

## Decided

Decided by the user on 2026-09-10, on the four points this change could not settle for itself:

- **Hermes reasons on the ChatGPT subscription, with the API-key model as the explicit alternative in settings.** Hermes's own loop needs no key. Whether OpenAI bills that loop to the plan, as it does the Codex app server, is checked on the instance before the change ships. The alternatives were the API-key model alone, and the subscription with no alternative. Anthropic OAuth stays declined, as in `BO_0225`.

- **The faces are Calliopa's own characters, not the vendors' logos:** Codey for Codex, Clauderic for Claude Code, and, for now, the Fairytales barista robot for Hermes. A Hermes character of its own can replace the robot later without touching the dropdown. The vendors' marks and a monogram were the alternatives and were not chosen.

- **The dropdown opens on the last choice, per instance.** It is stored beside the stamp, so phone and desktop agree. The alternatives were remembering it per device, and following the gateway, which would snap back to Codex after every Claude choice.

- **Claude gets web search and web fetch beside the kernel toolset**, matching Codex's `web_search`. The risk `BO_0226` records, a run that searched the web and answered in the console, is `BO_0226`'s delivery rule to govern and not a reason to withhold the tools. The alternative was the kernel toolset alone.

Decided by the user later on 2026-09-10, while shaping the command bar's redesign (`CA_0039`):

- **The agent control is a dropdown showing the chosen agent's face, not a three-state toggle.** It sits left of the command field. The toggle's three radio inputs were the alternative, and this document specified them until then.

## Verification

- **The runner**, over recorded `stream-json` transcripts from the pinned CLI: a run that calls a kernel tool and completes, one that fails, one that is stopped, and one whose `init` reports the toolset missing. For each, check the events the bridge normalizes and the status its backstop poll reads. A second run while one is active is refused as busy.

- **The kernel:** `claude-code` goes to the runner and requests no switch. `codex` and `hermes` switch the gateway as today. `Cancel` reaches the right upstream. The instructions for a Claude run carry no delegation sentence and are identical across two renderings. `executedBy` reads the runner's report. A record written before the change still loads and reads the same.

- **The agent container,** over the shipped entrypoint and broker as `BO_0225` did it: a Claude sign-in leaves `runtime.env` alone. `hermes` on the subscription writes `openai-codex` with `openai_runtime: auto` and no `approvals` block. `hermes` on the API-key model writes the model line, and falls back with a stamped reason when `CALLIOPA_AGENT_MODEL` is unset.

- **The shell:** the dropdown pressed in Qwik's render harness. Check that the closed control names the chosen agent; that the list opens with three options carrying their names and faces; that an unavailable one shows its reason and, when chosen, leaves the choice unchanged; that the arrow keys and `Enter` choose and `Escape` closes with the choice unchanged; that `sendGoal$` posts the choice; and that choosing writes `agent-choice.json`. On opening, the dropdown takes `chosen`, or falls back to `active` with the notice when the chosen agent cannot run. The test must be shown not to be vacuous by deleting the control.

- **On the instance:** one command on each of the three agents, reading `agent` and `executedBy` from each record. The Claude run must complete with no model API key configured and with extra usage still unavailable to the account. The refusal Hermes's OAuth path met is what makes that completion the proof of plan billing. Hermes on the subscription must complete a run, and the ChatGPT account's usage must show it counted against the plan and not as separate API billing. If it does not, the Hermes default changes before shipping. Switching from Codex to Hermes restarts the gateway, and the run waits for it. A Claude command sent while the gateway is running Codex leaves the gateway's stamp untouched. A choice made on the desktop is the one the phone opens on. A Claude run's `WebSearch` shows in its tool events, and a `WebFetch` of a kernel route answers `401`.

## Transfer

Transferred on 2026-09-10 as `BO_0228_001`–`BO_0228_015`, each under a section *Agent Toggle*:

- **The agent container**, in `docs/system/hermes.md` (`_001`–`_004`): the Claude runner, `hermes` as a gateway runtime, the broker's sign-in no longer selecting `claude-code`, and their verification.

- **The kernel**, in `docs/system/ui-kernel.md` (`_005`–`_008`): the bridge choosing the upstream by agent, the retired delegated worker and the instructions naming their agent, the agent surface's `configured()` and `hermesModel`, and their verification.

- **The shell**, in `docs/system/ui-shell.md` (`_009`–`_015`): the runtimes route and the choice file, the faces, `AgentMenu`, the settings extension's Hermes row, the graph's docs, the tree tests, and the on-instance verification.

The transfer fixed four names this document left open:

- the runner's address, `CALLIOPA_CLAUDE_RUNNER_URL`, default `http://hermes:8643`;

- the record's `upstream` field;

- the stamp's `hermesModel`;

- the choice route, `PUT /api/agent/choice`.

This document travels into the graph as a `ui.shell` document through `kernel import-changes --file` when the work lands (`BO_0222_013`).

Order:

- `_001`–`_003` need nothing, and `_004` follows them.

- `_005`–`_007` need the runner's protocol from `_001` but not its code, since their tests use stand-in upstreams; `_008` follows them.

- `_009` needs `_007`'s `hermesModel` in the stamp, and `_010` needs nothing.

- `_011` needs `_009` and `_010`, and `_012` needs `_007`.

- `_013` and `_014` go with their rows.

- `_015` needs everything: rebuilt kernel and agent images, and accepted and promoted shell and settings proposals.

The shell rows start from `BO_0226`'s accepted pin.

## Implementation

- 2026-09-10. Claimed on the user's promotion to ready; `Status: wip`.

- 2026-09-10. Before writing the runner, three streams were recorded from the pinned CLI in the agent container, so the translation reads real output rather than a guess at it: a completed run, a bad model's error result, and an `init` whose toolset failed. They settled four things the design had assumed: `${VAR}` expands in `--mcp-config` headers; tool names arrive as `mcp__calliopa-kernel__*`; an error result says `subtype: success` with `is_error: true` and exit 1; and every run reports its own billing in a `rate_limit_event` (`isUsingOverage`), which became the record's `billing` — per-run evidence the plan paid, which `_015`'s proof can read instead of inferring. `--append-system-prompt-file` exists at this version, and the runner uses it, because one argument is capped at 128 KiB and the instructions carry whole skills.

- 2026-09-10. The agent container's half (`BO_0228_001`–`_004`) and the kernel's (`_005`–`_008`) landed in this repository, uncommitted: `infra/hermes/claude_runner.py`, the entrypoint's `hermes` runtime and runner supervision, the broker, both Dockerfiles, the compose files and the release script; `agentbridge` (`RunsClient`, `Config.Claude`, `Run.Upstream`, `Model`, `Billing`, `agentName`) and `serve` (`claudeRunnerURL`, `writeRuntimeEnv`, `hermesModel`). Twenty-two mutations across them, each failing its test. The tests found two real defects on the way: the runner left a refusal's and a stop's request bodies unread, which a kept-alive connection would parse as the next request. One claim in `_008` was wrong about the bridge it names — no backstop poll crosses a kernel restart; a record left `running` is marked `failed` at start — and the row says so. The runner then ran once for real in the running agent container, reaching the kernel toolset and completing on the plan.

- 2026-09-10. The shell's half (`BO_0228_009`–`_014`) is staged as proposal `node:chg-a20eb0581aceee91`, thirty files, committed as `claude` from inside the kernel container from a fresh checkout of head (dataRevision 200), with the build output and generated registry removed first. Its overlay checkout compared equal to the tree, the faces byte for byte, and passed there as in the tree: the typecheck, 519 unit tests, both bundles. One finding beyond the rows: the settings row read the stamp's runtime as the party that reasons, and nothing reports on one called `hermes`, so an instance running Hermes would have read as not signed in — `reasoningParty` now reads it as Codex's sign-in. The harness cannot press outside the dropdown (it dispatches `on:` listeners only), so that press joins `_015`'s walk-through.

- 2026-09-10. The user rebuilt the images and accepted and promoted the shell half: **release pin 202**. In the agent container the runner listened on `:8643` with the pinned CLI, the stamp carried `hermesModel: subscription` and `hermesModelName: gpt-5.5`, and the kernel reached the runner. The served runtimes route listed the three agents, all selectable. The first look found a defect this change made worse: the reader saw the dropdown and no Run button. Run had been left to auto-placement below the rows between it and the field, as a bare word under `.dock button`'s borderless style. The fix places it beside the field as the primary action — proposal `node:chg-38e78d937fd317ba` (`ui-shell.md` `BO_0228_011`).

- 2026-09-10. The Run fix was accepted and promoted at **release pin 205**, and the user walked `_015` there. Claude (`arun-76bab81a2d197c5e`) ran on the Claude runner on `claude-sonnet-5`, `billing: plan`, and staged, while the gateway stayed on Codex; Hermes (`arun-bb08a3903e9971f4`) switched the gateway to its own loop, waited for the restart, ran on `gpt-5.5` and staged — and the user's ChatGPT usage showed it against the plan with nothing billed as API usage, so the subscription stays Hermes's default; Codex (`arun-5864e903a7c5ca7f`) switched it back and staged. The three agents name the kernel's tools three ways, each its own. The phone opened on the choice last made on the desktop; a press outside closed the open dropdown; a Claude run searched the web three times and staged (`arun-218ccbcc87c209f2`); and every kernel route a `WebFetch` could name answered an anonymous request `401`, the toolset too without its bearer. One reading surfaced on the way: *staged by agent:hermes* on the Claude run's proposal names the agent account every run stages under, not the agent that reasoned, which only the run's provenance Block says — offered to the user as a follow-up.

- Completed 2026-09-10. The task rows were transferred at draft and are checked in place: `hermes.md` `BO_0228_001`–`_004`, `ui-kernel.md` `_005`–`_008`, `ui-shell.md` `_009`–`_015`, each section's header dated. The repository half is uncommitted, for the user to commit; this document travels into the graph through `kernel import-changes --file` (`BO_0222_013`).
