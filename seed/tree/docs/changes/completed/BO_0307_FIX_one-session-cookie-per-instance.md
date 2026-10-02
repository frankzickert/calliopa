# BO_0307_FIX_one-session-cookie-per-instance

Status: completed

Two Calliopa instances reached on the same host sign each other out. Each instance should keep its own session cookie.

## The problem

- Every kernel names its session cookie `calliopa_session` (`internal/kernel/serve/sessions.go`, `ui-kernel.md`). Browsers keep cookies by host, not by port, so two instances on one host — the owner's prod kernel on `:9000` and the dogfood kernel on `:8090`, or any two installs behind one hostname — write the same cookie.
- Since `BO_0305_001` every authenticated response sets the cookie again. With a tab open on each instance, each one's polling overwrites the other's session id every few seconds. The other instance then finds no such session and answers 401 to every request. The session itself is still open in its store.
- What the person sees: everything already on screen keeps working, but whatever reads next fails. A document opened then shows only "This document could not be read." under the run chips (the editor's fallback for an answer that is not an outcome). A reload re-establishes that instance's cookie until the other tab polls again. Before `BO_0305` the cookie was only written at sign-in, so the collision needed a sign-in on the other instance.
- Observed 2026-09-29: the dogfood session was last used at 10:49:42.041 and prod opened a new session at 10:49:42.045. Prod shows five sign-ins between 10:42 and 10:49, most used for only a second or two. Both stores still held every session.

## Direction

- Each instance names its session cookie with an identifier of its own: `calliopa_session_<id>`. The id is generated once, kept on the kernel's data volume beside `sessions.json`, and unchanged across restarts and updates.
- The name cannot come from the port. The candidate and confirmation listeners are the same kernel on other ports of the same host and must read the same session (`BO_0103_003`, `BO_0241`).
- Nothing is sent from the browser to identify the instance: the cookie name alone separates them, and every cookie stays `HttpOnly`, `SameSite=Strict`, opaque.
- The shell already forwards the browser's whole `Cookie` header to the kernel, so its calls carry the new name without change. Only the behaviour-suite fallback that builds `calliopa_session=<id>` from `CALLIOPA_KERNEL_SESSION` (`ui.shell`'s `src/server/request-context.ts`) names the cookie. The kernel harness hands that fallback the cookie's name as well, so this change has a small graph half in `ui.shell`.
- Sign-out clears the instance's own cookie. It leaves any other instance's cookie alone.
- The owner's goal is to work in the dogfood instance and prod side by side in one browser without either signing the other out. User decision, 2026-09-29.
- The update that brings this signs everyone out once. The kernel reads only its own new cookie name, and a leftover `calliopa_session` is ignored. It carries no transition code. User decision, 2026-09-29.
- A request without a valid session is refused with the plain `sign_in_required`, as today. The kernel never reads or names another instance's cookie. User decision, 2026-09-29.
- The release notes say that everyone signs in once after the update.

## Separate finding, not in scope

- The extension view's staged-changes read (`GET /__kernel/extensions/<id>/groups`) takes 10–16 s. It reads each open proposal group one after another. The documents `proposals` read walks them too, and both queue on CCGW's five Postgres connections. That is a different change.

## Transfer

- The fixed-layer tasks are `BO_0307_001`–`_003` and `_005` in `docs/system/ui-kernel.md`, Human Accounts And Sessions. The shell's task is `BO_0307_004` in `ui.shell`'s graph docs (`docs/system/identity/api-authentication.md`), staged 2026-09-29 as `node:chg-2ea432e9c761705f` from head 3127.

## Result

- Completed 2026-09-29. The kernel names its session cookie `calliopa_session_<id>` per instance (`BO_0307_001`), and the harness and the shell forward the whole cookie pair (`BO_0307_002`, `BO_0307_004`). The verification and the owner's walk of prod and the dogfood instance side by side (`BO_0307_003`) passed. The release notes carry the line under *Fixed* (`BO_0307_005`).
