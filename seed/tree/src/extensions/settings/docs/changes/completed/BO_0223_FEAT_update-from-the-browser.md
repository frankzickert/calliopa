# BO_0223_FEAT_update-from-the-browser

Status: completed

Requested: 2026-09-08. **When the user starts Calliopa (signs in in the browser) and is the owner, check GitHub for a newer version. If there is one, show a hint in the top header. Clicking it opens the update tab, which is also reachable from settings. The tab shows the version that is installed and the newest version available on GitHub per release type — major, minor, patch, so anything that could make sense to install — with an option to see all versions. From that screen the user can start the update process.** User statement.

## Where This Starts

- **The update is a host-side, two-command affair today.** `distribution/README.md`: pull the checkout, run `./install.sh` again. The seed hook (`distribution/seed/run.sh`, `BO_0197_001`/`_004`) stages the release's bundled extensions as a **proposal** and moves no pin; it ends with *accept the proposal in Calliopa, then promote it to serve the new release*. So an update already has a browser half — review, accept, promote — and a host half the browser cannot perform.

- **Nothing inside the stack can run the host half.** `distribution/docker-compose.yml` mounts no Docker socket, grants no privilege, and binds no host directory at all — every volume is a named one. The checkout under `~/calliopa` (`CALLIOPA_HOME`) is the host's. `git fetch` and `docker compose build` happen outside every container by design: the images are built from released binaries on the user's machine (`BO_0211`), and a stack that could rebuild and restart itself would hold the host's Docker, which is root.

- **The installer's re-run is unattended by construction.** `install.sh` asks its two questions — the owner's name and the port — only on the run that creates `.env` (`BO_0220`, `BO_0221`); a re-run reads `.env`, repairs, rebuilds and restarts without a terminal. A process on the host can therefore run it.

- **The installer does not refresh the release pin on a re-run.** `install.sh`'s `.env` loop appends keys that are *absent* and leaves present ones alone (`distribution/install.sh`, the missing-key loop under *Configuration*). An installed `.env` already carries `CALLIOPA_RELEASE_VERSION` and `CALLIOPA_RELEASE_SHA256SUMS`, so after a checkout of the new release the images are rebuilt at the **old** release while the seed bundle from the new checkout is staged: new graph content proposed against old binaries. The README's *the new release's pins land in `.env`* is not what the script does. Found reading the script for this change, 2026-09-08; `docs/system/distribution.md` records the three releases `0.3.1`–`0.3.3` and no re-run of `install.sh` on an installed machine across a release pin, so nothing has exercised the gap yet.

- **The stack knows its release version in one place.** The kernel service's environment carries `CALLIOPA_RELEASE_VERSION` (`docker-compose.yml`, the kernel's `environment:`; `kernel diagnose` already reads it). The cell does not: `CALLIOPA_VERSION` (`internal/config`) is unset in the distribution compose and reads `dev`. The seed bundle names its release in `seed/bundle.json` (`version`, `pin`), and the commit rationale of an update proposal names it (`calliopa update: bundled extensions from release <version>`). No route answers a version to the browser today: `GET /__kernel/session` says `name`, `kind`, `class` and nothing about the owner; `/__kernel/healthz` says whether the kernel serves.

- **Who the owner is, the kernel knows and the shell infers.** `Config.OwnerPrincipal` (`BO_0217_002`) is `CALLIOPA_OWNER_PRINCIPAL`. The shell's `People` section learns it indirectly, by listing accounts and finding the row with `owner: true` that matches the session's name — a listing the core refuses to anyone but the owner. There is no *am I the owner* answer a header could ask on load.

- **Releases are GitHub Releases named `v<major>.<minor>.<patch>`** on the public `calliopa` repository (`scripts/release-distribution.sh`: `gh release create "v$version"`), each a git tag on the same checkout `install.sh` clones, so a specific version is `git fetch --tags && git checkout v<version>`. The release list is public JSON at `https://api.github.com/repos/frankzickert/calliopa/releases`, unauthenticated at sixty requests an hour per address, and answers browser requests cross-origin.

- **The licence says the Core makes no update checks.** `distribution/LICENSE-CORE.md` §6, a term and not a policy: *It sends no telemetry, no usage data, no diagnostics, no crash reports, no update checks and no licence validation request* — the section's subject is communication *with the Licensor*, and the next line allows connections to services the user configures. `distribution/README.md` says *nothing leaves it unless you send it* and that the only thing reaching the makers is the diagnostic file. `docs/system/distribution.md` records install-time egress to Docker Hub and GitHub as the user's own connections, and *the product opens nothing to the Licensor at any point*. A running instance asking GitHub for the release list is a new runtime connection, to GitHub rather than the Licensor, and the texts must say so before it exists.

- **Settings is one contributed tab kind** (`settings:settings`, a synthetic instance-wide target, opened from a header control; `settings-surface.md`, `tabs.md`). The header is the row for instance chrome — theme, layout, the process indicator, the settings control — and a hint belongs to it by the same rule. A second tab kind from the settings extension is the contribution contract's ordinary case (`BO_0202`).

- **The docs name no operating system.** The README's requirements are Docker Engine 25 with Compose 2.24 and `git`; the install has been verified on Linux and WSL2. A process the install leaves running on the host is the first thing in the distribution that differs by platform.

- **The parked public page is stale.** `docs/material/public-docs/update.md` still describes updating as moving `CALLIOPA_*_IMAGE` pins, which `BO_0211` retired for the release version and checksum.

## Intent

* When the owner signs in, Calliopa finds out whether a newer release exists on GitHub. When one does, the header shows a hint. Nobody but the owner sees it.

* The hint opens an **Update** tab, also reachable from settings. It shows the installed release and the newest release per type above it — the newest patch of the installed minor, the newest minor of the installed major, the newest major — each with its date and its release notes, and offers to show every release.

* From that tab the owner starts the update with one press, and the tab is where the update is followed through to the instance serving the new release.

* A person who is not the owner sees no hint and no Update tab.

## The Shape

- **Where the check runs: in the owner's browser, never in the Core.** The shell, once the session is the owner's, asks GitHub for the release list from the browser and computes the candidates there. The kernel and the cell open no connection to GitHub: the licence's sentence stays true by construction, and an air-gapped or offline instance shows no hint and no error. The check runs once per sign-in — the shell's first load under a session it has not checked under, remembered in the browser so a reload does not ask again — and the tab's *Check again* asks on demand. It is **on by default**; `CALLIOPA_UPDATE_CHECK=off` in `.env` turns it off, the kernel passes the value to the shell, and `.env.example` and the README say so.

- **What the kernel answers.** `GET /__kernel/session` gains `owner: true|false` — the session's name compared with `Config.OwnerPrincipal`, read the way the setup window reads it. A new `GET /__kernel/update` answers the installed release (`CALLIOPA_RELEASE_VERSION`, the string the images were built from), the served release pin, whether the check is enabled, the updater's state (below), and — so the tab can say *an update is waiting for review* — the open update proposal when the seed hook staged one: the group whose rationale names a `calliopa update` release, with that version. `POST /__kernel/update` with a version asks the host to install it. Both are session-gated like every `/__kernel/` route and refuse anyone but the owner: the release is the owner's operational fact, and the update is hers alone to start.

- **The candidates.** From the release list: drafts and prereleases dropped, tags parsed as `v<major>.<minor>.<patch>`, anything not parseable ignored. With the installed version `M.m.p`: the newest `M.m.x` with `x > p` (a patch), the newest `M.y.x` with `y > m` (a minor), and the newest `X.y.x` with `X > M` (a major). A candidate that is the same release as another is listed once under its highest type. No candidate means no hint. *Show all versions* lists every release newest first, the installed one marked; an older release is offered too, labelled **downgrade**, with the README's sentence that graph content does not roll back with the images — the documented rollback, from the same screen. Each row links its GitHub release page for the notes; the shell renders no release body.

- **The hint.** A header control beside the settings control, in the chrome idiom, reading *Update available* with the highest candidate's version, shown only while a candidate exists and the session is the owner's. It opens the Update tab; the tab kind is `settings:update`, a synthetic instance-wide target like settings, so a second press reveals the open tab. Settings gains an `Update` entry that opens the same tab and, without a candidate, says the instance is on the newest release, or that the check is off, or that GitHub could not be reached.

- **The updater: a process on the host that the install leaves behind.** `install.sh` installs `scripts/calliopa-updater.sh` from the checkout as a user-level service — a `systemd --user` unit where `systemctl --user` answers, a launchd agent on macOS — running as the person who installed, with their Docker access and their checkout, and re-installs it on every run so it follows the release. It watches one directory, `~/calliopa/updater/` (ignored by git), which the compose file **bind-mounts into the kernel container** at `/var/lib/calliopa-updater`: the first and only host path the stack sees, holding nothing but the request and the status. The kernel writes `request.json` — the version, who asked, when — on the owner's `POST`; the updater keeps `status.json` current — `idle` with a heartbeat, or `running` with the step it is on and the tail of its log, or `failed` with the exit line — and the kernel reports it back through `GET /__kernel/update`, marking the updater *absent* when the heartbeat is stale. Nothing else crosses: no socket, no credential, no shell.

- **What the updater does with a request,** exactly what the README's update path did by hand, and nothing else: it checks the version against `^\d+\.\d+\.\d+$` and refuses anything else; `git fetch --tags`; `git checkout --detach v<version>`; `./install.sh`, unattended, its output into the log. The install rebuilds the images at the release's pins, restarts the stack and stages the release's extensions as a proposal, as today. The updater does not accept, promote, or touch the graph. A failed step ends the run as `failed` with the line that failed; the stack is wherever `install.sh` left it, which the installer's ordering already makes a running stack or a build failure on the old images (`BO_0211_004`).

- **Starting the update.** The owner presses *Update to <version>* (or *Downgrade to*). The tab posts the request and follows `status.json` through the kernel: the checkout, the build, the restart — during which the kernel goes away and the tab waits for it, retrying until it answers again — and the kernel back reporting the chosen release. Then the tab moves to its second step and offers **Review** — the proposal's staged diff through the review surface the shell already has — and **Accept and promote**, which accepts the group and promotes the release pin through the kernel's review and extension routes, the path the seed hook's closing lines describe. The tab ends on *serving <version>* when the served pin carries the new release. Nothing here decides anything the review path would not: a refused build leaves the pin where it was and the tab says so in the kernel's words.

- **Where no updater runs, the tab shows the commands.** WSL without systemd, a host where the service could not be installed, or an updater that has stopped: `GET /__kernel/update` says *absent*, the button becomes the three lines to copy —

```
  cd ~/calliopa
  git fetch --tags && git checkout --detach v<version>
  ./install.sh
```

— and the tab's second step is the same once the kernel returns on the new release. `install.sh` says at its end whether the updater was installed, and names the fallback when it was not.

- **The installer refreshes the pins.** `install.sh`'s re-run rewrites `CALLIOPA_RELEASE_VERSION` and `CALLIOPA_RELEASE_SHA256SUMS` in `.env` from `.env.example` on every run, the way `BO_0221` rewrites the derived confirmation port, under a comment saying so. They are the release's pins, written by the release script, not the user's configuration, so the *never overwrites your configuration* promise holds. `CALLIOPA_BINARY_SOURCE` stays as the user set it: an air-gapped site points it at its own host deliberately. Without this line nothing above updates anything but graph content.

- **The texts.** `LICENSE-CORE.md` §6 gains a line naming the check: the application, in the owner's browser, asks GitHub which releases exist when the owner signs in, the Core sends nothing, and `CALLIOPA_UPDATE_CHECK=off` stops it. `distribution/README.md` says the same in one sentence beside *nothing leaves it unless you send it*, and its update section becomes: open the Update tab; the commands stay as the path without an updater. `docs/system/distribution.md` adds the connection to its egress lines and the updater beside the installer. `docs/material/public-docs/update.md` is rewritten around the release version and the tab, dropping the retired image keys.

### Why the browser and not the kernel

- The kernel could check on the owner's sign-in and cache the answer, and would give one answer to every browser the owner uses. It was rejected: the Core would then contain an update check, which §6 of the licence says it does not, and the amendment the licence gets anyway would have to say the Core reaches GitHub rather than that the browser does. A browser check is the user's own connection in the licence's sense, like the ones to the model providers.

### Why a directory and not a socket, a token, or a port

- The Docker socket in the kernel container hands the stack the host, and was rejected first. A token the updater presents to a kernel route would need the token generated on the host and carried into the secrets volume, and a route reachable from the published port. A directory carries one file each way, needs no secret, works offline, and keeps the authorization where it already is — the kernel's owner-only session gate on the write — while the host side reads one validated version string and runs the script it would have run by hand.

- The updater is the first thing the install leaves running on the host, and the first platform-specific piece. It is a user service rather than a system one so it needs no root and runs with the installing user's Docker access; where no service manager answers, the install says so and the tab shows the commands, so the feature degrades to the README's path rather than failing.

### Out Of Scope

- Automatic updates, or any update the owner did not start. The updater acts on a request and on nothing else.

- Updating the base images the recipes pull by digest, or Garage and Honcho: they move with the release the tab installs, not on their own.

- Release notes rendered in the shell. The GitHub page is the notes.

- A hint for anyone but the owner, or a per-person setting. The instance has one owner and one update.

- A Windows host outside WSL, which the distribution does not run on today.

### Decided

Decided by the user on 2026-09-09, answering the open points the shape raised:

- **The tab's button runs the host half itself, through a host-side updater** installed by `install.sh`, with copy-the-command as the fallback where no updater runs. Copy-the-command alone was rejected: *start the update process from this screen* means one press.

- **§6 of the licence names the check.** Leaving it as written was rejected: the licence is read by people deciding whether to trust the product, and *no update checks* beside a header hint saying *update available* reads as a contradiction even when it is not one.

- **The check is on by default**, `CALLIOPA_UPDATE_CHECK=off` the opt-out. Off-until-enabled was rejected: the hint is the feature, and an owner who installed with `curl | bash` never opens `.env`. The README sentence is the disclosure.

- **An older release may be chosen, labelled downgrade**, with the sentence that graph content does not roll back with the images. Forward-only was rejected: the README already documents the rollback, and the tab is where the update lives.

## Verification

- Against a real installed instance from a released checkout, signed in as the owner: a newer release on GitHub shows the hint naming it; the tab lists the patch, minor and major candidates for a fabricated installed version with several releases above it (the shell's behaviour tests over a captured release list, since GitHub cannot be told what to answer), the same release under one type only, none when the installed release is the newest, and every release under *all versions* with the installed one marked and an older one offered as a downgrade.

- A second person, class human or agent, signed in: no hint, no Update entry, `GET` and `POST /__kernel/update` refused `forbidden`.

- `CALLIOPA_UPDATE_CHECK=off`: no request leaves the browser (the browser test asserts no request to `api.github.com`), the tab says the check is off. GitHub unreachable: no hint, the tab says so, nothing logged as an error.

- The updater, against a real checkout and a stand-in `install.sh`: a request with a malformed version refused and recorded; a well-formed one running fetch, checkout and the install with the log in `status.json`; a failing install ending `failed` with the line; a stale heartbeat reported as *absent* by the kernel. The service installed by `install.sh` on a systemd host and re-installed on a re-run without interrupting a run in progress; a host without `systemctl --user` told so at the end of the install.

- The whole path once, on a real instance: the next release cut from this tree chosen in the tab, the updater checking it out and running the install, `.env`'s two pins rewritten, the images rebuilt at the new release, the tab waiting through the restart, the kernel back reporting it, the tab moving to review with the update proposal, *Accept and promote* landing the pin, the tab ending on *serving <version>*. Then the previous release chosen as a downgrade, the images rolled back and the graph content left where it was.

- `install.sh` re-run on an installed `.env`: the two pins rewritten, `CALLIOPA_BINARY_SOURCE` and everything else untouched; `docker compose build` rebuilding at the new release.

## Transfer

Transferred on 2026-09-09 as `BO_0223_001`–`BO_0223_016`, each under a section *Update From The Browser*: the session's owner flag, the two `update` routes, the directory contract and the kernel verification in `docs/system/ui-kernel.md` (`_001`–`_005`); the installer's pin rewrite, the updater script, its service install, the bind mount and compose variables, the licence line, the texts and the host-side and whole-path verification in `docs/system/distribution.md` (`_006`–`_012`); the header hint and release module in `ui.shell`, the Update tab in `settings`, their tests and the on-instance verification in `docs/system/ui-shell.md` (`_013`–`_016`), as pointers whose graph-side enumeration lands as `CA` tasks in the extensions' docs in the implementing proposal, the way `BO_0219` did. `BO_0223_010`, the licence line, is blocked until the user provides the text in the content repository: legal text is placed verbatim and never drafted here (`distribution.md`, Licences). This document travels into `settings`' `docs/changes/` when the work lands (`BO_0202_010`, or as a change document under `BO_0222` once that lands).

Order: `_001`–`_004` and `_006`–`_009` have no dependency among them; `_013` needs `_001`, `_014` needs `_002`–`_004`; the whole-path verification (`_012`, `_016`) needs everything and a release cut from this tree.

## Implementation

Landed 2026-09-09 and completed the same day after the user's browser walk-through on pin 131. Kernel half in the repository (`BO_0223_001`–`_005` folded into `docs/system/ui-kernel.md`): the owner flag on the session, the update surface with its four routes, the directory contract, the serve flags, and the verification against a real CCGW. Distribution half (`BO_0223_006`–`_009`, `_011` folded into `docs/system/distribution.md`): the installer's pin rewrite, the updater script verified against a stand-in install, the service install written but not exercised here (this shell is a container without systemd or launchd), the bind mount and variables in both compose files, the README, the public update page and the egress line. Shell half staged as proposal `node:chg-058317d34de65aa0` from a checkout at dataRevision 129 (`BO_0223_013`–`_015` folded into `docs/system/ui-shell.md`): the hint, the release module, the Update tab, its routes, the settings entry, the tests and the graph docs; typecheck, unit, harness behaviour and build all green.

Two lines stay open in `docs/system/distribution.md` as follow-up work rather than as this change's claims: `BO_0223_010`, the licence line, waiting on the user's text; and `BO_0223_012`, the service install on a systemd host and the whole path with a release cut from this tree. `BO_0223_016`, the walk-through, is folded into `docs/system/ui-shell.md`. The user rebuilt the app and kernel images, accepted the proposal and promoted head the same day: pin 131 is served. The walk-through passed. What remains for the user: the licence text (`BO_0223_010`) and the next release for the whole path (`BO_0223_012`).
