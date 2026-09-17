# BO_0242_FIX_stale-update-proposals

Status: completed

Requested: 2026-09-11. The user's install showed *Installed release: 0.3.7 · serving pin 12 ·
updater idle*, and *Update to 0.3.8* was disabled. Asked to reject the stale proposals:

> there is no reject button or command

## Transferred

- 2026-09-16: `distribution.md`, One Open Update (`BO_0242_001` seed hook, `_002` texts and release notes, `_006` verification); `ui-kernel.md`, One Open Update (`_003` `pending()`, `_004` `extensionTruth` on the update answer); `ui-shell.md` (`_005`, the tab, to enumerate in `settings`' graph docs from a checkout).

## Where This Starts

- **Two stale proposals blocked the update.**
  - The install held two open groups under the seed hook's rationale, both *calliopa update:
    bundled extensions from release 0.3.7*.
  - They were left from the user's update to `0.3.7`, whose acceptance stopped at the refused
    confirmation (`BO_0241`).
  - They were rejected from the kernel container on 2026-09-11, and the update was enabled
    again.
- **The tab blocks on any pending update.**
  - Opening the Update tab with a pending update puts it in the `returned` phase.
  - While the phase is anything but `idle`, `served` or `failed`, the update buttons are
    disabled (`src/extensions/settings/update.tsx`).
  - So an update proposal nobody accepts blocks every later update, whichever release it is for.
  - `0.3.8` behaves the same; `BO_0241` left this logic alone.
- **The kernel names the newest open group under the rationale as pending.**
  - That is `update.go`, `pending()`, whatever the group's version and whatever the installed
    release is.
  - It does not know an older release's group is superseded.
- **Each install run stages another group.**
  - The seed hook (`scripts/seed-run.sh`) diffs the release against the graph's head, meaning
    its accepted content, not against a proposal still open.
  - Every run of `install.sh` for a release while its proposal is open therefore stages another
    group with the same content. The updater runs `install.sh`, and so does a person retrying.
  - Two runs made two groups.
- **An accepted update has no *Promote* after a reload.** On 2026-09-11 the user updated to
  `0.3.8`, still with `0.3.7`'s tab, and confirmed the acceptance in another window.
  - The tab offers *Promote* only in its `accepted` phase, reached in the same page session.
  - Reloaded, or confirmed elsewhere, it shows nothing to promote, while the kernel reports the
    accepted content unserved (`extensionTruth` past the served pin).
  - The instance kept serving pin 50 until the promotion was run from the kernel container.
  - `0.3.8`'s tab behaves the same.
- **The owner has no way out.**
  - The tab offers no way to set a pending update aside.
  - The kernel's reject verb lives inside the kernel container (`kernel proposal reject`), which
    the README never mentions.
  - The user could not reject the groups themselves; an agent did it from the development shell.

## Intent

* A pending update never blocks updating to another release. The owner gets past a pending
  update by updating past it; the tab has no separate way to set one aside. User decision,
  2026-09-11.
* There is never more than one open update proposal. A newer release's proposal supersedes an
  older one's, and the install rejects the older one itself. Running the install again for the
  same release stages nothing new. User decision, 2026-09-11.

## The Shape

A proposal for the transfer.

- **The seed hook keeps one open update.** Before staging, `run.sh` asks CCGW for open groups
  under the seed hook's rationale.
  - An open group for the same release: it stages nothing and says the release's proposal is
    already waiting.
  - A group for another release: it is rejected, with the rationale *superseded by release
    <version>*, as the owner the hook already acts as. Then the new group is staged.
- **The kernel names only the current update as pending.** `pending()` answers only a group
  whose version is the installed release. An older one, left by an install from before this
  change, is not pending: the next update's install rejects it.
- **The tab.** Pending or not, the update buttons stay enabled. Choosing another release while
  one is pending says the pending proposal will be superseded, and the install that follows
  rejects it. No reject control is added.
- **The tab offers *Promote* whenever there is something to serve.** Any time the kernel reports
  accepted content that is not yet served, not only right after an acceptance in the same
  session. A refused promotion shows the gate's words.
- **The README.** *Updating* says a newer release supersedes a pending one, and that choosing it
  in the tab is how a pending update is set aside.

## Decided

- An older release's open update proposal is rejected automatically by the install that stages a
  newer one, with the rationale *superseded by release <version>*. It is superseded by
  construction: the newer release's diff against the accepted graph contains everything the
  older one would have brought. Leaving it to the owner was the alternative. User decision,
  2026-09-11.
- The owner gets past a pending update only by updating past it. The update buttons stay
  enabled, and there is no *Set this update aside* control or kernel reject route. Offering both,
  and offering only a reject, were the alternatives. User decision, 2026-09-11.
  - Consequence: a pending update for the installed release that the owner does not want stays
    open until the next release supersedes it. It blocks nothing meanwhile.
