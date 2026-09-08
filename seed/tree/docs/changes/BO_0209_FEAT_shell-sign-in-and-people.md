# BO_0209_FEAT_shell-sign-in-and-people

Status: completed

Requested: 2026-09-07

## Intent

* The shell presents sign-in, the people who hold authority in this instance, and who staged
  and who accepted each proposal. It presents them and gates nothing.
* This change exists to be the demonstration of `BO_0206`'s rule rather than an exception to
  it: every screen here draws state the core owns, and every action it offers is one the core
  independently refuses. A fork that redraws all of it changes nothing about what is accepted.

Transferred to `docs/system/` on 2026-09-08 as `BO_0209_001` (the kernel's licence route, in
`ui-kernel.md`) and `BO_0209_002`–`BO_0209_009` (`ui-shell.md`, Sign-In And People), after the
user set `Status: ready` the same day; claimed the same day. `BO_0209_001`–`_008` landed 2026-09-08 and
the shell half landed as proposals `node:chg-94ac9f1ae71cc8a4` (pin 91) and `node:chg-fa8b40b4fb78cdab`
(pin 94), both accepted and promoted by the user the same day; `BO_0209_009` closed the same day.

## Position

- `BO_0208` is the precondition: it owns the accounts and the sessions. Until it lands there is
  no session to render. It does **not** own every endpoint this change consumes: the kernel's
  reserved prefix carries only session status, sign-in and sign-out, and the admin surface on
  CCGW needs a bearer the shell's server never holds. `BO_0214` supplies the kernel routes this
  change reads and calls, and is the second precondition. Corrected 2026-09-08.
- The implementation is `ui.shell` content and lands in the graph. Per the change process this
  document is authored here and carried into the shell's own `docs/changes/` as part of the
  implementation, same id and same status (`BO_0202_010`). The prefix it carries there is the
  shell's.
- The people surface is `settings`' and the sign-in chrome and review authorship are
  `ui.shell`'s; one proposal group touches both, and this document lands in `ui.shell`'s
  `docs/changes/`, which owns the subject. Decided 2026-09-08.

## The Rule This Change Is Built To Obey

* Nothing on any screen here is load-bearing. Every one of these views can be wrong, hostile,
  or absent, and the instance is exactly as governed as it was.

- A sign-in form that skips the check produces no session. A people list that hides a suspended
  account does not un-suspend it. A review surface that offers an accept button to someone whose
  class is `agent` produces a refusal from the core. That is the difference between this change
  and the shell's retired proposal lifecycle, which was the gate for content it also drew.
- The review question for every view added here, from `BO_0204`: *does the core refuse this, or
  does the shell merely not offer it?* If the answer is the second, the view is fine and the
  missing refusal is a defect in `BO_0206` or `BO_0208`, not here.

## What It Draws

- **Sign-in and sign-out**, against `BO_0208`'s kernel endpoints, and the signed-in person's
  identity in the interface so a person can tell whose authority they are acting under before
  they act. Acting as the wrong person is the mistake multi-party review exists to make
  visible.
- **The people list**: each principal's name, kind, class, state, and the last time its
  credential or session was used. The last-used stamp is what lets an operator tell a live
  account from a dormant one before retiring it. The list view today answers name, kind,
  class, state and owner only; the stamps are `BO_0214`'s to surface.
- **Account actions**: create, suspend, resume, retire, and move a person between the classes
  that may and may not establish truth. Each is a call to a kernel endpoint that refuses on its
  own terms — including the licence refusal when activating a second authority-holding human
  without a licence, which must surface as what it is rather than as a generic failure.
- **Authorship and acceptance in review**: who staged a proposal group and who accepted or
  rejected it, beside the agent-authorship flag the confirmation already renders
  (`BO_0103_004`). The graph already carries this; with one operator it was not worth showing.
- **Licence state and expiry warnings** at 60, 30, 14, 7 and 1 days and through the 30-day
  grace, which `BO_0204` requires in the interface. `BO_0208` carries the CLI half and
  `BO_0213` the state the interface reads — the expiry beside the epoch on the head route, the
  licensee and the effective state on the licence route. A surprise here is the licensor's
  fault, so the warning is not a dismissible toast.
- **Sign-in as the only anonymous view.** The kernel's public port in prod mode answers an
  anonymous browser with its sign-in page and nothing else (`BO_0214`); the shell's sign-in
  screen is the nicer face on that gate, not the gate.

## What It Must Not Do

- Decide anything. No screen holds a rule the core does not also hold.
- Hold a credential or a session secret. The session is kernel-held and the browser carries an
  opaque reference (`BO_0208`).
- Reimplement the people list as shell-side state. It is read from the kernel per request; a
  cached copy is a stale copy of the thing that decides who may write.
- Grow a permission model. Authorization is out of scope in `BO_0206` and `BO_0208` alike, and
  a screen is the worst place for it to arrive by accident.

## Answered

Decided by the user on 2026-09-08, accepting the recommendations.

- **Split.** Sign-in, sign-out and the signed-in identity live in `ui.shell`'s header, which
  already carries an identity row; authorship and acceptance live in `ui.shell`'s review
  surface; the people list is a third section of the `settings` view beside Connections and
  Channels. One proposal group carries both, and the change document lands in `ui.shell`.
- **An anonymous visitor sees sign-in and nothing else, enforced by the kernel.** A shell-side
  wall is presentation a fork removes, which is fine on loopback and not fine on the LAN
  address a team instance binds to, where every read of the graph would be open to the
  network. The kernel's public port gates the served tree behind a session in prod mode and
  serves only the session routes, its own sign-in page and the confirmation origin without
  one (`BO_0214`). Reads stay unauthenticated at CCGW on the compose network, as `BO_0206`
  decided; the gate is the product's port, not the gateway.
- **The interface shows the licence state and the active count, never a count against a
  licence figure.** `BO_0204` decided on 2026-09-08 that the licence carries no seat count, so
  there is no number the customer states at renewal to display. Unlicensed: one of one, and
  the activation refusal names the licence. Licensed: the active count of authority-holding
  humans on its own, with the licensee and the expiry. The five warning marks and the grace
  are shown as `BO_0204` requires.
- **Direct creation, with a self-service password change.** The operator sets the initial
  password and hands it over out of band, matching `BO_0208`'s create and recovery verbs.
  Because the password verb on the admin surface is the owner's alone, a person cannot today
  change the password the owner chose; `BO_0214` adds the change of one's own password, and
  the settings view offers it to the signed-in person.
- **No separation-of-duties surface here.** `BO_0212` is `idea`, the policy is per extension
  and owner-set through the admin verbs, and review is the only place it becomes visible.
  When `BO_0212` lands it adds its own line to the People section and its refusal reason to
  review.

## Settled

Decided by the user on 2026-09-07.

* The presentation is a separate change from the mechanism, and lands after it.

Decided by the user on 2026-09-08.

* The people surface is `settings`'; sign-in and review authorship are `ui.shell`'s.
* The kernel, not the shell, gates the public port behind a session in prod mode.
* The interface shows licence state and the active count; there is no licence count to show.
* Accounts are created directly; a person may change their own password.
* Separation of duties gets no surface until `BO_0212`.
* `BO_0214_FEAT_kernel-account-routes` is a precondition beside `BO_0208` and `BO_0213`.
