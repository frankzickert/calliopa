# CA_0052_FIX_agent-menu-follows-sign-in

Status: completed

Completed 2026-09-18. The agent menu reads the list again whenever it opens, and when a view says the agents changed
(`agentsChanged$`), which `settings` does when a sign-in ends; the instance's remembered agent comes back once it can run
(`CA_0052_001`–`_003`). Served from pin 70 and walked by the user with a Codex sign-in, no reload (`_004`); the
release-notes line is in `calliopa-bootstrap`.

Requested: 2026-09-18. The user signed Claude Code in with the subscription from the settings row, then chose Claude in the
command bar's agent menu: it still read *"Claude Code is not signed in."* After a reload of the page it could be chosen.
A change of `ui.shell`, whose frame holds the composer and its agent menu ([Commands And Runs](../../system/workspace/commands-and-runs.md)).
`settings` takes one call, to the view bridge's new `agentsChanged$`, when a sign-in it followed ends.

## Where This Starts

- **The list is read once.** `src/components/shell/shell.tsx` reads `GET /api/agent/runtimes` in a `useVisibleTask$` when
  the shell mounts and keeps the answer in `run.runtimes`; `AgentMenu` (`composer.tsx`) lists that copy, dimmed with its
  reason, for as long as the page lives. Nothing reads it again.
- **The server already answers the truth.** `selectableRuntimes` (`src/server/agent/adapters.ts`) judges each agent from
  what the agent container and the kernel report at the moment it is asked, so the same request after the sign-in answers
  Claude Code selectable. Only the page's copy is stale.
- **A sign-in can happen anywhere.** The settings row in the same tab, another tab or device, or the operator at the
  agent container: a refresh raised only by the settings row would miss the others, and an agent can also stop being
  selectable (signed out, the Claude runner not answering) while the page is open.

## Intent

- The agent menu offers what can run now: opening it shows each agent's current state and reason, without a reload.
- A choice or a command is never refused on a state the server no longer reports.
- A sign-in finished from the settings row updates the command bar at once, closed menu included: an agent the page
  opened away from because it could not run comes back as the choice once it can.

## Proposed Approach

- Re-read `/api/agent/runtimes` when the agent menu opens, and update `run.runtimes` from the answer; the list shown while
  the read is in flight is the last one, so opening stays instant.
- Choosing an agent the stored list marks unavailable re-reads the list first and honours the choice if the answer now
  says it can run, so a press that races the refresh is not lost.
- The view bridge gains `agentsChanged$` (`src/components/shell/view-bridge.ts`): a view tells the shell that what the
  agents can do has changed, and the shell re-reads `/api/agent/runtimes`. `settings` calls it when a sign-in flow it
  followed ends, whatever the end, beside the `read$()` it already does then — the server, not the flow's last state,
  says whether the runtime is now signed in.
- A re-read after the page opened away from the instance's remembered choice (`openingAgent`'s notice) applies the
  remembered choice once it can run and lowers the notice; a choice the reader made on this page is never overridden.
- Behavior tests through `testing/agent-menu-host.tsx` (or the composer host): the list answers Claude Code not signed
  in, the answer changes, and opening the menu shows it selectable and lets it be chosen; and `agentsChanged$` raised
  with the menu closed brings the remembered agent back and lowers the notice.
- A release-notes line in `calliopa-bootstrap`'s `docs/release-notes/unreleased.md`, since `ui.shell` is bundled.

## Decided 2026-09-18

- **The shell also re-reads the list after the settings row reports a sign-in,** so the closed menu is current too, not
  only the open one. Re-reading on open stays, for sign-ins made anywhere else.

## Transferred

- 2026-09-18: `ui.shell`'s [Commands And Runs](../../system/workspace/commands-and-runs.md), The Agent List Follows Sign-In
  (`CA_0052_001` re-read on open, `_002` `agentsChanged$` and the remembered choice, `_004` verification and the
  release-notes line); `settings`' [Agent Sign In](../../../src/extensions/settings/docs/system/agent-sign-in.md), Sign-In
  Requests (`CA_0052_003` the call when a sign-in ends).
