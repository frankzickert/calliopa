# BO_0238_FIX_release-tag-on-the-published-tree

Status: completed

Requested: 2026-09-11. The user installed `0.3.4` from GitHub and did not get the latest.

## Where This Starts

- **Every release tag names the previous release's tree.** On `frankzickert/calliopa` on 2026-09-11:

| Tag | Commit | `.env.example` pins |
| --- | --- | --- |
| `v0.3.0` | `68202fb` | nothing (the initial commit) |
| `v0.3.1` | `b2c0ad4` | `0.3.0` |
| `v0.3.2` | `3662341` | `0.3.1` |
| `v0.3.3` | `742ced4` | `0.3.2` |
| `v0.3.4` | `c4386ab` | `0.3.3` |

`main` is `f92e2df` and pins `0.3.4`.

- **The cause is the order of the two steps.** `scripts/release-distribution.sh` stage 7 runs `gh release create "v$version"` without `--target`. GitHub then creates the tag at the default branch as it stands, and the default branch is still the previous release. The area is pushed afterwards, by `scripts/publish-distribution.sh`, after the review and the commit. The order was chosen on purpose: the assets exist before a published compose file names them (Release Pipeline, `BO_0211_005`). The tag was the part nobody looked at.

- **What reads the tag gets the old release:**

- the release page's *Source code* archives;

- `git checkout --detach v<version>`, the README's update path;

- the updater (`distribution/scripts/calliopa-updater.sh`), which runs the same checkout when the owner presses update in the Update tab.

The tree then pins the previous version's binaries, so the owner who chose `0.3.4` runs `0.3.3`. A downgrade chosen in the tab lands one release further back than chosen.

- **The one-line install is not affected by the tag.** It clones `main`. But when `~/calliopa` already exists, it runs that checkout's `install.sh` without fetching, so a machine installed before keeps its old release. That is the documented behaviour (*from an existing checkout, run `./install.sh` directly*), though a reader of the one-liner will not expect it.

- **Nobody reported this before.** Every verification so far built from `main`, from a clean copy of the area, or from `CALLIOPA_BINARY_SOURCE`, never from a tag. The first path that reads a tag is the updater, and `BO_0223_012`, its verification, is still open.

## Intent

* A release's tag names the tree that pins that release's binaries: the commit `publish-distribution.sh` pushes for it.

* The assets still exist before any published tree names them.

* The existing tags are corrected, so the tab's release list and the README's commands give what they name.

## The Shape

A proposal for the transfer.

- **Draft first, tag at the publish:**

- Stage 7 creates the release as a draft (`gh release create --draft`), assets attached. GitHub creates no tag for a draft.

- `publish-distribution.sh`, after its push, publishes the draft with `gh release edit "v$version" --draft=false --target <pushed sha>`, reading the version from the area's `.env.example`.

- The tag is created at that moment, on the pushed commit.

- The window in which `main` names assets that are not public shrinks to the seconds between the push and the edit.

- **Checks:**

- The publish refuses when no draft `v<version>` exists, or when the release is already published at another commit.

- After the edit it reads the tag back and fails unless the tag's `.env.example` pins `<version>`.

- **Correcting the tags:** `v0.3.4` → `f92e2df` (done), `v0.3.3` → `c4386ab`, `v0.3.2` → `742ced4`, `v0.3.1` → `3662341`, `v0.3.0` → `b2c0ad4`. Each is one forced ref update on the public repository, and each is the user's act. The change reads every tag back and checks that its `.env.example` pins its own version.

- **Clones that fetched the old tags keep them:** `git fetch --tags` refuses to overwrite an existing tag. The README's update line, and the updater's fetch, become `git fetch --tags --force`, so a moved tag reaches a machine that saw the old one.

- **The one-liner names the release of an existing checkout:** when `install.sh` runs outside a checkout and `~/calliopa` already exists, it still leaves that checkout's release alone and runs its `install.sh`. First it prints:

- the release the checkout is on;

- the latest release, read with `git ls-remote --tags` from the same repository it clones, so no new connection;

- how to update: the Update tab, or `git fetch --tags --force && git checkout --detach v<latest> && ./install.sh`.

When the checkout is on the latest release, it says so in one line. When the remote cannot be read, it says that and goes on.

- **Coordination:** `BO_0237` is reshaping stage 7 of the same script (the release body from the notes, the rolled entry). This change must land after it, or with it, on the same lines.

## Decided

- `v0.3.4` is overwritten in place, not re-released as `0.3.5`. User decision, 2026-09-11, recorded in `homepage`'s `HP_0021` for the licence text the old tree lacked. The user moved the tag to `f92e2df` the same day. An anonymous clone of `v0.3.4` is now byte-identical to `distribution/`: it pins `0.3.4` and carries Core Licence Version 1.1.

- The four earlier tags are corrected as well: `v0.3.3` → `c4386ab`, `v0.3.2` → `742ced4`, `v0.3.1` → `3662341`, `v0.3.0` → `b2c0ad4`. With that, a downgrade chosen in the tab and a release's *Source code* archives give the release they name. Keeping the published history was the alternative. User decision, 2026-09-11. The user moved all four the same day. Read back, each of the five tags pins its own version, and the digest it pins matches the `SHA256SUMS` attached to its release, downloaded without authentication.

- The one-liner keeps an existing checkout's release and says so (The Shape). An install command does not change an instance's release on its own; updating is the Update tab's and the updater's. Updating automatically was rejected because it would undo a deliberate downgrade and can collide with local edits in the checkout; keeping today's silence was rejected because the silence is how an install from GitHub ended up on an old release. User decision, 2026-09-11.

## Where The Work Lives

Transferred on 2026-09-11. [Distribution](../../system/distribution.md), Release Tags, is the authoritative document. It holds the three fixed lines and `BO_0238_001`–`_005` and `_007`:

- the draft in stage 7;

- the publish that tags the pushed commit and refuses before pushing when no release exists;

- `--force` on tag fetches;

- the one-liner's message;

- the docs and the release-notes line;

- the verification.

[UI Shell](../../system/ui-shell.md), Update From The Browser, holds `BO_0238_006`, the settings extension's command text, which lands in the graph. That makes this a change with a graph part: its document is imported under `settings`, and it closes with the graph export.

Two details were settled in the transfer:

- A publish of a version whose release is already published is a republish, such as a README correction, and leaves the tag alone. The Shape above would have refused it.

- The one-liner reads the checkout's release from its `.env.example`.

Nothing above is authoritative; where the two disagree, the system documents are right.

## Where It Stands

Completed 2026-09-11.

- The repository half landed: the draft in stage 7, the publish that tags the pushed commit, the forced tag fetch, and the one-liner's message. It was verified against a local repository holding a moved tag.

- The settings half is served from pin 351.

- Release `0.3.5` proved the draft → publish → tag flow on GitHub. Its tag names the pushed commit `65b0389`, and an anonymous clone of it matches `distribution/`.

- The document stands in the graph under `settings`, and `graph/` is exported.
