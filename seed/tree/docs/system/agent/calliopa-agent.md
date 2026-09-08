# Calliopa Agent

## Purpose

- This document is the authoritative description of Calliopa's agent layer: the roles, the runtimes and their billing asymmetry, the pinned upstream contract, subscription sign-in and credential custody, confinement, memory, the tool surface the agent reaches, and the run lifecycle.
- `CA_0022_FEAT_agent-layer` is the originating change.
- The compose services, their ports, the Postgres image, and the generated API key live in [Application Foundation](../foundation/development-environment.md). The agent console lives in [Workspace Shell](../workspace/command-dock.md). The tool surface over the authenticated boundary lives in [Graph Gateway](../content-store/external-api.md). None of them are restated here.
- The design is taken from what ran in `_calliopa-old/calliopa-bootstrap`, not from what was specified elsewhere. Honcho is the one part taken from `studio`.

## Roles

* Hermes is Calliopa's agent and the only agent the human talks to.
* Codex is Hermes's controller runtime: `model.provider: openai-codex` with `model.openai_runtime: codex_app_server` hands each turn to a Codex app-server subprocess authenticated by the user's ChatGPT subscription.
* Claude Code is a delegated coding worker on the user's Max subscription, invoked through Hermes's bundled skill, not as a controller.
* Honcho is the agent's memory. It runs self-hosted, so agent memory never leaves the machine.
* The agent reaches Calliopa's content only through the kernel toolset over CCGW, bound per run by the kernel (`BO_0207_015`). It never writes to Postgres or Garage directly.

## Runtimes And Billing

The runtime selection chooses the model *under* Hermes — the conversation loop's own LLM — and it is not symmetric between the two subscriptions.

* The default runtime is `codex`, and it needs no model API key at all. The ChatGPT subscription is the reasoning credential.
* `claude-code` is a delegated worker, never the controller. Hermes's own Anthropic OAuth provider bills extra-usage credits rather than the plan allowance, and is deliberately not used.
* The active runtime is stamped as executed-by fact. An unavailable selection is a structured failure carrying a setup action, never a silent substitution of agent or billing mode.

- A third runtime, `provider`, runs an explicit API-key model as controller. It is kept as a configuration path and left unconfigured: it is the fallback if a subscription runtime breaks, and Calliopa ships with no model API key.
- Choosing `codex` as the default means Hermes's reasoning depends on the ChatGPT subscription being signed in. When it is not, the agent is `unconfigured`, which is a defined healthy state rather than a failure.

## Out Of Scope

- The Agent Client Protocol. Hermes reaches Codex and Claude Code through its own runtimes, which is how it worked, and no ACP client exists in the pinned release.
- Mock agents. If a CLI, a subscription, or a model is absent, the affected surface says so by name and offers nothing.
- A second credential system. The inbound half is [API Authentication](../identity/api-authentication.md), the outbound half is the connection store, and the subscription logins live in the agent's own store.
- Durable, resumable, or forkable sessions, and an interactive approval broker.
- A skill-authoring surface.
- Concurrent runs, per-run tool-server scoping, and Hermes profiles.
- Acceptance of what a run proposes, which is a human action described in [Graph Gateway](../content-store/proposals.md) and reviewed in [Block Editor View](../documents/proposed-changes.md).
