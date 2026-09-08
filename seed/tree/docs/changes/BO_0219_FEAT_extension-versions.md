# BO_0219_FEAT_extension-versions

Status: wip

Requested: 2026-09-08, as the direct follow-up of `BO_0218`. **As a user, I also want to see
the available versions of an extension and activate one of them — flip the version.** User
statement.

## Where This Starts

- Which version of an extension is deployed is which version of its subtree is pinned
  (`extension-model.md`, Purpose) — and today there is exactly one pin for the whole graph.
  The release pin is a single `dataRevision` (`kernel.releasepin`, `BO_0095_003`); the prod
  materialization projects every manifest and every member as they stood at that revision
  (`project` in `internal/kernel/materializer/project.go`, one pinned read); and
  `kernel rollback` moves the whole graph back, never one extension. An extension has no pin
  of its own.
- An extension's versions exist and are visible, but not as a choice. Its manifest carries
  `version` (semver, `extension-model.md`); the owner document reads the manifest and every
  member with `INCLUDE HISTORY` (`src/server/extensions.ts`, `BO_0201_008`) and renders a
  History section listing each accepted group with its revision; and the section's dot says
  the newest established revision is past the served pin (`BO_0201_005`). Nothing lets a
  person pick one of those points and serve it.
- `BO_0218` gives the kernel the pieces this needs: a kernel-owned `kernel.extensionstate`
  Block written as the signed-in human, a materialization that reads that Block at the pin
  and shapes the tree accordingly, a route that writes and then promotes head through the
  gate, the `kernel extension` CLI verb, and a control at the top of the extension view. This
  change adds a second dimension to each of them and introduces no new mechanism.
- Versions are this graph's. There is no registry (`distribution.md`, `BO_0211`): a
  bundled extension's versions arrive as release updates staged for review
  (`BO_0197_001`), an `individual` extension's as the proposals its authors land. _Available_
  means _established in this graph's history_, never _fetchable from somewhere_.

## Intent

- A person opens an extension and sees which version is served, and the versions that exist
  in this graph — each with when and by whom it was established. Choosing one flips the
  extension to that version and rebuilds the tool, so the served shell carries that
  extension at that version while every other extension stays where it was. Choosing
  _current_ lets the extension follow the release pin again.
- Flipping is deployment, not editing: the graph's history is untouched, nothing is retired
  or re-established, and the same person can flip forward again. A held version survives
  updates — a release that lands a newer version of a bundled extension does not move a
  pinned one until the pin is released.

## The Shape

- **A version is a point in the subtree's history, labelled by the manifest.** The
  _available versions_ of an extension are the distinct `version` values its manifest has
  carried, established revisions only, each resolved to the newest established revision of
  any member — manifest, source, contribution — while the manifest read that value: the
  subtree as it last stood under that label. The newest is _current_. Two revisions under
  the same label are one version, its last state; an author who wants a choosable point
  bumps `version`, which is the convention the skill teaches. Every entry carries the
  revision, the group and rationale that established it, who, and when — the History read
  already yields all of it.
- **The pin is per extension, in the same Block.** `kernel.extensionstate` (`BO_0218`)
  gains `pins`, a map of extension id to `dataRevision`; an id absent from the map follows
  the release pin, which is every extension's state on a fresh install. A pin is a
  revision, not a label, so it names one exact subtree state and survives a later manifest
  that reuses the label. Truth-written as the signed-in human, no proposal, history in the
  Block's revisions — the posture `BO_0218` decided.
- **The materializer projects a pinned extension at its own revision.** For the promotion
  and prod materializations, the projection reads the state Block at the release pin, then
  reads each pinned extension's manifest and members — the same `partOf` resolution — at
  the extension's revision instead of the global one, and everything else at the global pin
  as today. The lockfile already records `(blockId, revision)` per file, so a mixed tree is
  an ordinary tree to the commit path and to `kernel status`. The authoring checkout stays
  at head: a pin changes what is served, never what is edited.
- **Only what materializes is pinned.** Block types, relation types, skills, intentions and
  migrations do not project to the tree; Validation enforces the established definitions
  and Hermes reads the established skills, at head, whatever the served code's version. A
  flip therefore changes the built shell and nothing the graph enforces or teaches. The
  extension view says so beside the version control when the extension carries such
  members, and vocabulary pinning stays deferred until a version flip needs it — which is
  the day a definition changes shape between two versions of the same extension.
- **Dependencies are ranges, and the flip checks them.** A manifest declares
  `dependencies` as semver ranges (`extension-model.md`), and the registry scan checks
  presence only (`BO_0202_007`). The flip route resolves, for the extension at the chosen
  revision, each dependency's version as it will be served — its own pin or the global pin
  — and refuses a flip that leaves a range unsatisfied, naming the dependency and the
  range; the same check runs on the dependents of the flipped extension. Combined with
  `BO_0218`'s activation check, one function answers _would this tree be consistent_
  before anything is written. The gate stays the backstop for what a range cannot say.
- **The same route family and CLI.** `POST /__kernel/extensions/<id>/version` with
  `{"revision": N}` or `{"follow": true}`; `GET /__kernel/extensions` gains, per extension,
  the served revision and version, whether it is pinned, and the available versions with
  their provenance. Human class only; write, then promote head through the gate; a refused
  gate leaves the pin written and reports the failure shape — all as `BO_0218` decided.
  `kernel extension pin <id> --to <revision|version>` and `kernel extension unpin <id>` are
  the CLI, `--no-promote` writes only; `kernel extension list` shows the pins.
- **Rollback and updates behave without new rules.** `kernel rollback` re-pins the release
  pin, and the state Block is read at that pin, so the per-extension pins come back with it.
  A release update stages a bundled extension's new version as a proposal; accepting it
  establishes a new _available_ version and moves nothing served while the extension is
  pinned; releasing the pin (_follow current_) is what deploys it. An inactive extension
  keeps its pin and serves the pinned version when reactivated.
- **The shell's half.** The control at the top of the extension view (`BO_0218`) becomes a
  row: the activation toggle, then the served version with a _pinned_ mark when it is, then
  a version selector listing the available versions newest first — label, revision, date,
  who, the group's rationale as the hint — with _current (follow the release pin)_ at the
  top; choosing one runs the flip and shows the rebuilding state as the toggle does. The
  Extensions section shows the served version in each row and marks a pinned row; the dot
  keeps its meaning — there is established content newer than what is served — which for
  a pinned extension is the expected state and is drawn as _pinned_ rather than as a
  warning. The inspector's facts gain _Served version_ and _Pinned at_. `ui.shell` content in
  the graph, a `CA` change coordinated here, carrying its own copy of this document.

### Out Of Scope

- Fetching a version from another instance or a package source. There is no registry.
- Pinning vocabulary, skills or intentions. Stated as a limit above and deferred.
- Editing at a pinned version. The authoring checkout and the proposal loop stay at head; a
  fix to an old version is a new revision of head, labelled as the author sees fit.
- Diffs between two versions in the browser. `kernel proposal diff` and the History
  section stay what they are.

### Decided

Decided by the user on 2026-09-08, answering the open points the shape raised:

- **Versions are the manifest's labels.** The available versions are the distinct `version`
  values the manifest has carried, each at the subtree's last established state under that
  label; an author bumps `version` to create a choosable point. Making every accepted group
  a flip target was rejected: many unlabelled entries, and a target that reads as a
  rationale rather than a version. The History section stays what it is.
- **Any extension may be pinned, `ui.shell` included; the gate decides.** Pinning the shell
  pins the build root every other extension builds under, at head; a combination that does
  not build, typecheck or survive the probe is refused at the gate and the pin stays
  written as `BO_0218` decided. Refusing pins on `ui.shell` and leaving an older shell to
  `kernel rollback` was rejected. The view says, when `ui.shell` is chosen, that the flip
  changes the toolchain for every extension.
- **The range check runs twice.** The kernel refuses a flip whose semver ranges are
  unsatisfied before writing, and the registry scan gains `dependency_out_of_range` beside
  `dependency_missing`, so a tree assembled by any path fails by name at build — a `CA`
  task in the graph, covered by the scan's fixture tests. The kernel alone was rejected.

## Verification

- The version list: over the recorded history of this instance (`src/server/fixtures/`),
  an extension whose manifest carried two labels lists two versions, each resolved to the
  last member revision under its label; an extension never bumped lists one, _current_.
- Materializer: a fixture graph with `calliopa-video` at two versions and a pin on the
  first projects the first's sources beside every other extension at the global pin, the
  lockfile carrying the mixed revisions; without the pin, the second; `kernel checkout`
  unchanged at head in both.
- Kernel route and CLI against a real CCGW and a real `kernel serve`: a human pins
  `calliopa-video` to its first version and the promoted pin serves it, `healthz` reporting
  the new release pin and the extension's served revision; _follow_ returns it to head at
  the next pin; a range violation is refused naming the dependency; an agent-class session
  is refused; a gate refusal leaves the pin written and reports the failure; a rollback of
  the release pin restores the pins as they were; a release update accepted while pinned
  moves nothing served.
- On the instance: open `calliopa-video`, see `0.1.0` as served and current; after a
  staged and accepted bump to `0.2.0`, see both, flip to `0.1.0`, watch the rebuild, see the
  old views and API served while `settings` and `ui.shell` are at head; flip back to
  current and see `0.2.0`.

## Transfer

Transferred on 2026-09-08 as `BO_0219_001`–`BO_0219_008`: the `pins` map and version
resolution, the pinned projection, the range check, the route and CLI, and the kernel
verification in `docs/system/ui-kernel.md` under Boot And CLI (`_001`–`_005`); the version
selector, the scan's `dependency_out_of_range` and the on-instance verification in
`docs/system/ui-shell.md` under Extensions Section And Owner Document (`_006`–`_008`). The
model's line on versions rides on `BO_0218_012` in `docs/system/extension-model.md`. Every row
depends on its `BO_0218` counterpart landing first.

## Implementation

Claimed and implemented 2026-09-08 together with `BO_0218`, on which every row depends. The
kernel half — `pins` in the state Block, the version catalog from history, the pinned
projection, the range check in both places, the version route and the `pin`/`unpin` verbs —
landed in this repository and is verified (`BO_0219_001`–`BO_0219_005` in
`docs/system/ui-kernel.md`, folded to truth). One thing implementing taught: CCGW re-stamps a
revision's `dataRevision` when a later write archives it, so revision entries now carry
`createdDataRevision` (`docs/system/ccgw.md` §5.1) and the catalog reads that.

The shell half — the version selector, the scan's `dependency_out_of_range`, the skill's
convention — is implemented in `.local/tree-0218` beside `BO_0218`'s and is staged with it
(the command in `BO_0218`'s Implementation section); the on-instance verification
(`BO_0219_008`) follows the promotion.
