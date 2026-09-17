# BO_0241_FIX_update-completes-in-the-tab

Status: completed

Requested: 2026-09-11. The user updated an installation to `0.3.7` from the Update tab. It worked until the kernel restarted.

> the kernel answered 401 -> after reloading the page it works. if a hard reload is required, let's inform the user to do that. after reload, the update wants me to confirm the extension updates. --> ok. but then it says i must confirm the changes, but this gives me: "confirmation_session_mismatch" … i don't want the extra confirmation here. when the user clicks ok, then this is the confirmation

## Where This Starts

- **The 401 is the kernel signing the owner out during the restart.**

- `sessionSurface.resolve` (`internal/kernel/serve/sessions.go`) looks the account up through CCGW on every request. On *any* error it deletes the session: `if err != nil || view.State != "active" { s.store.close(…) }`.

- `install.sh` recreates `app` (CCGW) with `docker compose up -d --wait app` before the seed step, and recreates the kernel only afterwards. For that whole window the old kernel keeps serving while CCGW is down.

- The tab polls `/api/x/settings/update` every two seconds. The first poll in that window fails the lookup, deletes the session, and every later one answers `401 sign_in_required`.

- The tab treats only 5xx and a failed fetch as "restarting" (`read$` in `src/extensions/settings/update.tsx`). A 401 shows as a refusal: *the kernel answered 401*.

- Sessions themselves survive a restart: they are persisted on the kernel's data volume. What a reload fixed was a fresh sign-in, or a later request that resolved.

- **The confirmation refusal comes from where the accept is sent.**

- The tab's accept is a server-side call. `src/server/kernel/update.ts` posts to `${kernelUrl}/__kernel/review/accept`, and `kernelUrl` is `http://127.0.0.1:<port>` (`internal/kernel/serve/tree_env.go`). It forwards the cookie and nothing of the browser's host.

- The kernel names the confirmation page after the request's host (`confirmBase(r.Host)`, `BO_0240_001`). For this call that is the shell's internal `127.0.0.1`, so the link is always `http://127.0.0.1:8091/confirm/<id>`.

- A cookie is scoped to the host. A browser that reached Calliopa at any other host — `localhost`, a LAN or Tailscale address, which is the default since `0.3.7` — confirms with a different cookie, or none, and gets `confirmation_session_mismatch`.

- `src/server/kernel/extensions.ts` makes the same server-side call for an extension import's acceptance, so an import's confirmation fails the same way from any host but `127.0.0.1`.

## Intent

* Pressing *OK* in the Update tab is the owner's acceptance of the release's update proposal. No confirmation page follows it. User decision, 2026-09-11.

- This narrows two fixed lines in `ui-kernel.md`, for this one proposal: an import is established only through the confirmation page *as every group holding an extension member is*, and whole-group acceptance *keeps it everywhere*.

* When the tab needs the page reloaded, it says so and offers the reload. User decision, 2026-09-11.

* The owner's session survives the stack's restart during an update.

* A confirmation link points at the host the owner's browser is on, including for an acceptance the shell's server sends on the owner's behalf. The extension import keeps its confirmation page; only the link changes. User decision, 2026-09-11, taking the import's link into this change rather than a change of its own.

## What The Decision Trades

- The confirmation origin exists because graph-supplied script cannot reach it. The Update tab is graph-supplied code, the settings extension's. Without the page, code running in the owner's signed-in browser can accept a pending release update without the owner's click.

- What it can establish that way is bounded:

- it is only the proposal the kernel itself records as the pending update, the one the seed hook staged from the release the owner chose to install;

- never a proposal the request names;

- and it does not promote, since serving it stays the owner's separate press.

## The Shape

A proposal for the transfer.

- **The kernel keeps a session through a CCGW outage.**

- `resolve` deletes a session only on a definite answer: the principal is absent, or not `active`.

- When CCGW cannot be reached, it answers `503`, *the kernel cannot reach the gateway*, and keeps the session.

- The tab already reads a 503 as a restart in progress, so it keeps waiting.

- **The kernel accepts the update itself.** A new route, `POST /__kernel/update/accept`:

- owner only, same origin, like `/__kernel/update`;

- it accepts the proposal the kernel records as the pending update (`pendingUpdate`), never one named in the request;

- it executes at once as the owner, with the owner's credential, and answers the outcome.

- Every other acceptance through `/__kernel/review/accept` keeps parking.

- **The tab.**

- *OK* calls the new route through `src/server/kernel/update.ts`, and the `confirm` phase and its link go.

- A 401 while following the update reads: *Your session ended while the stack restarted. Reload the page and sign in again.*, with a *Reload* button.

- Once the new release is served, the tab says the page runs the previous release's code until it is reloaded, and offers the reload. The served build changes at the promotion, and the open page still holds the old one.

- **The confirmation link follows the browser for server-side calls.**

- The kernel's proxy already hands the shell the browser's host as `X-Forwarded-Host`.

- `src/server/kernel/extensions.ts` passes it back on its review calls.

- The kernel's `confirmBase` uses it in place of the request's host.

- It trusts the header only on a request from its own served tree, on loopback. A browser's own request, and anything else, keeps using its `Host`, so nothing outside can steer the link.

- **Docs:**

- `ui-kernel.md`: the route, the session rule, the two narrowed fixed lines, and the forwarded host for the confirmation link;

- the settings extension's `settings-surface.md` in the graph;

- `distribution/README.md`'s *Updating*;

- release-notes lines under `Fixed`.

- **Verification:**

- The kernel's session rule: a CCGW that cannot be reached keeps the session and answers 503; an absent or inactive principal still ends it.

- The update route: the owner accepts the recorded pending update, anyone else is refused, and a proposal named in the request is ignored.

- The link: from the served tree with the forwarded host it names that host; a browser's request with a forged header does not steer it.

- A real update on a fresh install through the tab, reached at a host other than `127.0.0.1`: through the restart without a 401, *OK* accepted, promoted, the reload hint shown. Then an extension import confirmed from the same host.

## Decided

- The update's acceptance needs no confirmation page: *OK* in the tab is the confirmation. User decision, 2026-09-11.

- The tab tells the owner when the page must be reloaded, and offers it. User decision, 2026-09-11.

- The extension import's confirmation link is fixed here, not in a change of its own. User decision, 2026-09-11.

## Where The Work Lives

Transferred on 2026-09-11. Nothing above is authoritative; where the two disagree, the system documents are right.

- [UI Kernel](../../system/ui-kernel.md), The Update Completes In The Tab, is the authoritative document for the kernel's half: the three fixed lines, the trade-off, and `BO_0241_001`–`_004`.

- `_001`: the session through a CCGW outage.

- `_002`: the accept route.

- `_003`: the forwarded host.

- `_004`: the kernel's verification.

The two fixed lines on confirmation carry the exception there.

- [UI Shell](../../system/ui-shell.md), Update From The Browser, holds the graph half, which lands in one proposal. So the change document is imported under `settings`, and the change closes with the graph export.

- `BO_0241_005`: the settings tab without the page, and with its reloads.

- `BO_0241_006`: the shell server's calls, `update.ts`, `request-context.ts` and `extensions.ts`.

- [Distribution](../../system/distribution.md), Update From The Browser, holds the rest:

- `BO_0241_007`: the README, `update.md` and the release-notes lines;

- `BO_0241_008`: the verification on a real install. It needs a release carrying the change installed, then the next one chosen in the tab, because the kernel and tab that live through the restart are the installed ones.

- `BO_0223_012`'s wording follows the change, and it records the user's walk on `0.3.7`.

Settled in the transfer:

- **The owner-only check.** The kernel finds the pending update by its rationale, which any principal can write, and CCGW has no group-ownership rule. So the accept route takes the group only when every candidate in it was staged by the owner's principal. Anything else is refused and sent to the ordinary review path.

- **Who may send the forwarded host.** It is honoured only on a loopback request, which in the containerized kernel means its own served tree and CLI.

## Where It Stands

Completed 2026-09-11.

- The kernel's half landed (`_001`–`_004`, `ui-kernel.md`): the session kept through a CCGW outage, `POST /__kernel/update/accept`, and the confirmation link after the browser's host. Tests ran against a real CCGW, each guard shown to bite.

- The graph half (`_005`, `_006`) is served from pin 375.

- The texts and the release-notes lines are written (`_007`).

- The user chose to close with `_008`, the check on a real install, left open in `distribution.md` for the release after next: a release carrying the change installed, then the next one chosen in the tab.

- The document stands in the graph under `settings`, and `graph/` is exported.
