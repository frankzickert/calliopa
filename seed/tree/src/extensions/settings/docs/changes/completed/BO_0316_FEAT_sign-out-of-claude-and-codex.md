# Sign Out Of Claude And Codex

Status: completed

Requested: 2026-09-30, by the user. The settings page can sign in to Claude Code and to Codex, but
not out again. The user wants to sign out of either one there too. The questions were answered the
same day.

This is a `BO` change. The sign-out itself runs in the agent container's login broker
(`infra/hermes/login_broker.py`, `docs/system/hermes.md`, *Sign-In Requests*), which is the fixed
layer. The control, the request and the row are in the `settings` extension in the graph
(`agent-sign-in.md`, *Subscription Sign-In* and *Sign-In Requests*). So this document is carried
into `settings`' `docs/changes/` no later than its completion.

Transferred 2026-09-30. The broker's and the gateway's tasks are `BO_0316_001`–`_003` in
`docs/system/hermes.md`, *Sign-Out*. The kernel's and the release notes' are `_004`–`_005` in
`docs/system/ui-kernel.md`, *Sign-Out*. `settings`' tasks are `_006`–`_008` in its graph docs
(`agent-sign-in.md`, *Sign-Out*), staged with this document at `draft`. One technical decision
came with the transfer: a Claude sign-in or sign-out no longer restarts the gateway
(`BO_0316_002`). Otherwise removing `claude.env` would stop every Codex and Hermes run in flight.

Completed 2026-10-01. Implemented 2026-09-30 and walked on the instance on 2026-10-01 after the
images were rebuilt and the settings half was pinned. The walk signed Claude Code out while a
Codex run went, and then Codex itself, and the user signed both back in afterwards. The
implementation also fixed a crash in the login broker (`BO_0316_003`): two threads writing the
state at once took the broker down partway through a flow. The walk found `claude.env` already
missing after the rebuild, for a reason not established; that is left open in
`docs/system/hermes.md`, *Sign-Out*.

## What Stands Today

- A status row (`codex`, `claude-code`) offers **Sign in** only while its runtime is not signed in,
  and offers nothing once it is (`agent-sign-in.md`, `CA_0022_007`).
- Each credential is held in more than one place on the agent's data volume:
  - Codex: the CLI's `~/.codex/auth.json`, plus the copy the broker adopts into Hermes's own
    auth store as its `openai-codex` provider.
  - Claude Code: the CLI's own store when `claude auth status` reports `loggedIn`, and
    `claude.env`, which holds the token `claude setup-token` printed. The Claude runner reads that
    token at the start of each run.
- The probe calls a runtime signed in when either of the Claude copies is present. So a sign-out
  that removes only one of them would still show the row as signed in.
- Hermes reasons on the ChatGPT subscription by default (`BO_0228_002`). With Codex signed out,
  `resolve_runtime` falls back and records the reason in the stamp: *Codex is not signed in; sign
  in to Codex to use it*.
- The command bar's agent menu already reads the agent list again when a sign-in flow ends
  (`CA_0052_003`).

## Behavior

- **Sign out on a signed-in row.** While `codex` or `claude-code` is signed in, its row offers
  **Sign out** where it would offer **Sign in**.
- **Sign-out removes every copy on the instance.** Afterwards the runtime's own status call
  reports it signed out, and no copy is left for a run to use:
  - Codex: `codex logout` and the adopted Hermes credential.
  - Claude Code: `claude auth logout` and `claude.env`.
- **The row reports what the runtime says.** As with a sign-in, the broker probes again and only
  then publishes. The row shows *signed out* when the runtime agrees, not when the command exits.
- **What follows from a sign-out is shown, not hidden.** The agent menu drops the runtime. If the
  gateway's runtime falls back, the `hermes` row shows the reason in the stamp, as it does for any
  fallback (`BO_0089_006`).
- **Sign out asks first, and names what follows.** Pressing **Sign out** asks for confirmation
  before anything is removed. On `codex` the confirmation says that Hermes reasons on the Codex
  sign-in and will fall back. On `claude-code` it says that Claude Code leaves the agent menu.
  User decision, 2026-09-30.
- **No sign-out while that runtime has a run going.** While a run on the runtime is in flight,
  **Sign out** is disabled, with a line saying why. It becomes available once the runs end. No run
  is interrupted by a sign-out. For Codex this also covers Hermes's runs, since both run in the
  gateway that the sign-out restarts. User decision, 2026-09-30.
- **The sign-out is local.** It removes every copy on the instance and does nothing with Anthropic
  or OpenAI. The row says nothing about revoking the token with the provider. User decision,
  2026-09-30.
- **Whoever may sign in may sign out.** No new permission rule. User decision, 2026-09-30.
