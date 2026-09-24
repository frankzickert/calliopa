# Concurrent And Faster Agent Runs

Status: completed

Requested by the user on 2026-09-19: several agent runs should be able to run at the same time, and Claude Code and Hermes runs should take about as long as Codex runs, not several times longer.

## 1. Several Runs At Once

### What Happens Today

- The bridge has one run slot for the whole stack (`agentbridge/bridge.go` `claimSlot`, `BO_0245_002`). A second command while a person's run holds the slot is refused as busy (*"The agent is busy with another person's run …"*, `http.go` `busyFor`). A person's command cancels a system run and takes the slot.
- The rule comes from the tool server. Hermes's MCP client sends only the tool name and arguments with a call, with no run or session identity (`hermes.md`, Pinned Upstream Contract). The kernel toolset therefore holds one `binding` (principal, class, pin, group, run id) and applies it to every call. If two runs were active at once, the second run's binding would replace the first. Calls from the first run would then read at the wrong pin and stage into the wrong group.
- The gateway runs one controller configuration at a time. A Codex or Hermes run that needs a different controller from the active one rewrites the configuration, restarts the gateway and waits up to 90 s (`bridge.go`, around `SetRuntime`). Code comments call this safe because runs are serialized. Two gateway runs on different controllers cannot run side by side under one gateway.
- The Claude runner (`infra/hermes/claude_runner.py`) starts one `claude -p` process per run and does not depend on the gateway's configuration.

### Direction To Shape

- Bind each tool call to its own run. Give every run its own toolset endpoint or bearer, for example `/__kernel/agent-tools/<run>` or a per-run token that the kernel resolves to the binding. The Claude runner already writes an MCP config for each run. Codex reads its bearer from an environment variable, and Hermes's MCP registration is global, so those two runtimes need a per-run mechanism of their own. `hermes.md` names Hermes profiles (`/p/<profile>/`) as the widening path. Check that path against the pinned release before choosing it.
- Replace the single slot with a set of active runs. The busy refusal goes away, and nothing is queued.
- Keep a gateway runtime switch from interrupting a running run. Options are one gateway process per controller, or a switch that waits until the gateway has no runs on the other controller. Claude runs never wait on a switch.
- Concurrent runs never share a group or a tree. That rule is already true (`BO_0089_009`) and holds without change.
- The shell's run chip, the agent mark in the document and the composer assume one active run. They need to show each run separately. That half is shell work in the graph.

### Decisions

User decisions, 2026-09-19:

- Concurrency covers both cases: one person may have several runs active, and different people run at the same time.
- Two runs may work in the same document at once. Each one stages its own group, and the document shows both runs' proposals, each marked by its run. If accepting one run's proposal makes the other's stale, the existing drift and stale-proposal handling applies, and the person decides.
- There is no limit on concurrent runs, per instance, person or runtime. The subscriptions' own rate limits are the only bound, and a run refused by one fails with the provider's reason.
- System runs (refinement, triggered runs) run beside people's commands and are never displaced. The displacement rule of `BO_0245_002` (a person's command cancels an active system run) goes away with the single slot.

## 2. Claude Code And Hermes Runs Take Far Longer Than Codex

### Measured On This Instance

The kernel's run records (`/var/lib/calliopa-kernel/agent-runs/`, 23 runs on 2026-09-19, all document commands and refinements):

| Agent | Runs | Duration | First tool call | Tool calls |
|---|---|---|---|---|
| Codex (gpt-5.5, app-server) | 18 | 20–74 s, most 26–40 s | 10–27 s | 3–12 |
| Claude Code | 4 | 107–171 s | 3–4 s | 2–7 |
| Hermes (own loop, gpt-5.5) | 1 | 261 s | 248 s | 2 |

- The Claude runs start at once: `read_document` is called after about 4 s. Then the run shows nothing for 60–160 s until the one `propose_document_changes` call. In `arun-0598b85cb15883d4`, the read was at 4 s, the propose at 166 s and the end at 171 s. Almost all of that time goes to one model turn that writes the proposal.
- The runner passes no `--model` and no effort setting, so Claude Code uses the plan's default model and default thinking. The runner reads stream-json as whole messages, not partial ones (`--include-partial-messages`), so nothing reaches the document while that turn is written.
- The Hermes run spent 248 s before its first tool call and 13 s after it. What it did in that time has not been measured. There is only one Hermes run, so this is a single observation.

### Direction To Shape

- The composer offers a speed choice on every command: *Fast* or *Thorough*, for every agent. Each agent maps the choice to its own model and effort. For Claude Code that is `--model` and the thinking effort. For Codex and Hermes it is the model and the reasoning effort in the run's configuration. Fast is preselected, and the last choice is remembered for each person. Thorough is today's behavior.
- Measure what Fast and Thorough map to for each agent on the same commands before fixing the mapping. Read how long the proposal the model writes is too, since a long tool input is written token by token.
- Stream what the model writes (partial messages) so a long turn shows as progress in the document instead of silence. This shortens how long the run feels, not how long it takes.
- Hermes: split the 248 s before the first tool call into gateway start, Hermes's own preparation (skills, memory, Honcho) and the model turn. Find which part is Calliopa's configuration and which part is upstream behavior.
- If Hermes's slowness turns out to be upstream behavior that Calliopa cannot configure away, Hermes stays on offer. The agent menu tells the person that it is the slower agent.
- Measure each change on the same commands for all three agents. The run records hold the timings, so no new telemetry is needed.

### Decisions

User decisions, 2026-09-19:

- The speed choice is per command, covers all agents, preselects Fast and remembers the person's last choice.
- A Hermes that stays slow for upstream reasons is kept and named the slower agent in the agent menu, not removed.

## Scope

- Touches the fixed layer (bridge, kernel toolset, agent image) and the shell in the graph. The shell's half becomes a change document of `ui.shell` in the graph when it lands there.
- Both parts ship in the distribution, so each needs a release-notes line when it completes.
- The two parts are independent. Either can move to draft without the other, or be split into its own change.
