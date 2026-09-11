# Calliopa Agent

## Purpose

- This document is the authoritative description of Calliopa's agent layer: the roles, the runtimes and their billing asymmetry, the pinned upstream contract, subscription sign-in and credential custody, confinement, memory, the tool surface the agent reaches, and the run lifecycle.
- `CA_0022_FEAT_agent-layer` is the originating change.
- The compose services, their ports, the Postgres image, and the generated API key live in [Application Foundation](../foundation/development-environment.md). The agent console lives in [Workspace Shell](../workspace/command-dock.md). The tool surface over the authenticated boundary lives in [Graph Gateway](../content-store/external-api.md). None of them are restated here.
- The design is taken from what ran in `_calliopa-old/calliopa-bootstrap`, not from what was specified elsewhere. Honcho is the one part taken from `studio`.

## Roles

* A command goes to one of three agents, and the reader chooses which in the composer's agent dropdown (`BO_0228`): Codex, Claude Code or Hermes. All three receive the same instructions, hold the same kernel toolset and stage into the run's one group; what differs is who reasons.
* Codex runs through the Hermes gateway: `model.provider: openai-codex` with `model.openai_runtime: codex_app_server` hands each turn to a Codex app-server subprocess authenticated by the user's ChatGPT subscription.
* Hermes is the gateway's own loop and tool dispatch (`model.openai_runtime: auto`), reasoning on the ChatGPT subscription or, when the instance is set to it, the API-key model.
* Claude Code runs as itself, beside the gateway rather than under it: the Claude runner in the agent container starts one `claude -p` per run on the user's Claude subscription (`CLAUDE_CODE_OAUTH_TOKEN`) and speaks the part of the gateway's runs API the kernel bridge uses. Until `BO_0228` it was a delegated coding worker under the API-key controller, invoked through Hermes's bundled skill, which on an instance with no API key meant it could not run at all.
* Honcho is the agent's memory. It runs self-hosted, so agent memory never leaves the machine.
* The agent reaches Calliopa's content only through the kernel toolset over CCGW, bound per run by the kernel (`BO_0207_015`). It never writes to Postgres or Garage directly.

## Runtimes And Billing

For the two gateway agents the runtime selection chooses the model *under* Hermes — the conversation loop's own LLM. Claude Code is not a gateway selection, and switching to it restarts nothing.

* The default runtime is `codex`, and it needs no model API key at all. The ChatGPT subscription is the reasoning credential.
* `hermes` reasons on the ChatGPT subscription by default, and on the API-key model only when the instance is explicitly set to it from the agent's settings row — never as a fallback from one to the other (`BO_0228_002`).
* Claude Code bills the Claude plan because the CLI is what calls Anthropic. Hermes's own Anthropic OAuth provider bills extra-usage credits rather than the plan allowance, and is deliberately not used. The runner reads the CLI's own rate-limit report, and the run records `billing: plan` or `extra-usage`.
* The active runtime is stamped as executed-by fact, and a Claude run records the model its CLI named. An unavailable selection is a structured failure carrying a setup action, never a silent substitution of agent or billing mode.

- The runtime `provider` runs an explicit API-key model as controller. It is kept as a configuration path the CLI intake verb can still name, and left unconfigured: Calliopa ships with no model API key.
- Choosing `codex` as the default means Hermes's reasoning depends on the ChatGPT subscription being signed in. When it is not, the agent is `unconfigured`, which is a defined healthy state rather than a failure.

## Out Of Scope

- The Agent Client Protocol. Codex is reached through Hermes's own runtime and Claude Code through the Claude runner's `claude -p`, which is how both work, and no ACP client exists in the pinned release.
- Mock agents. If a CLI, a subscription, or a model is absent, the affected surface says so by name and offers nothing.
- A second credential system. The inbound half is [API Authentication](../identity/api-authentication.md), the outbound half is the connection store, and the subscription logins live in the agent's own store.
- Durable, resumable, or forkable sessions, and an interactive approval broker.
- A skill-authoring surface.
- Concurrent runs, per-run tool-server scoping, and Hermes profiles.
- Acceptance of what a run proposes, which is a human action described in [Graph Gateway](../content-store/proposals.md) and reviewed in [Block Editor View](../documents/proposed-changes.md).
