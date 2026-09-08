# BO_0218_FEAT_extension-activation

Status: wip

Requested: 2026-09-08. **Extensions are (de-)activatable. An opened extension carries a
toggle at the top that changes its status. The four existing core extensions cannot be
deactivated — they are required to run the tool — but in the future other core extensions
might be. When the status changes, the tool is rebuilt to reflect it.** User statement.

## Where This Starts

- The graph holds five extensions: `ui.shell`, `settings`, `calliopa-base` and
  `calliopa-extension` as `category: bundled` — the four the Extensions section lists under
  _Core_ — and `calliopa-video` as the first `individual` one (`BO_0203`). Every one of them
  is served: the shell resolves at build time what the extensions **present in the tree**
  contribute (`ui-shell.md`, Contribution Contract, `BO_0202`), and the tree the pin promotes
  holds every extension the graph holds. Presence is the only switch there is, and the only
  way to flip it today is to retire the subtree.
- Absence is proven to work: `BO_0202_011` removed `src/extensions/settings/` from a copy of
  the tree, regenerated the registry, typechecked, built, and served with no settings control
  and its API answering _no extension `settings` contributes an API_. Deactivation is that
  proof turned into a switch.
- An extension opens as a read-only owner document (`src/components/views/extension.tsx`,
  `BO_0201_007`) with an inspector reporting version, category, elevation, provenance, served
  pin and dependencies — _no actions_. The shell writes nothing to the graph on this surface;
  the bridge's `write` verb refuses every `ext.*` and `kernel.*` target (`BO_0134_001`), so a
  toggle needs a route of its own.
- Two fixed lines say what the toggle must not be. `ui-shell.md`'s Fixed Constraints: the
  shell loads nothing at runtime — _no dynamic import, no graph-source materialization, no
  enable/disable flow, no dependency resolution in the running application_ — and the graph's
  own contribution-contract topic says the same under _Not Here_. Its Scope Boundary adds
  that there is _no promotion surface in this shell_. Both stand; the shape below is a
  build-time absence and a promotion, never a runtime flow, and the lines gain a sentence
  saying so, the way `BO_0202_009` revised them once.
- Rebuilding is promotion. Prod mode polls the release pin, and when it moves re-materializes,
  builds and swaps the proxied backend (`BO_0095_005`); `kernel pin --to head` promotes only
  a candidate that builds, typechecks and survives the serve probe (`BO_0095_006`,
  `BO_0131_001`, `BO_0132_001`). Nothing in the browser promotes today; the loop is the CLI's.

## Intent

- A person opens an extension and sees whether it is active. Flipping the toggle deactivates
  or reactivates it, and the served shell is rebuilt so the change is what the browser shows:
  a deactivated extension contributes nothing — no sections, no views, no API, no parties,
  no migrations — and a reactivated one contributes again. The extension's content stays in
  the graph untouched either way; deactivation deploys less, it deletes nothing.
- The four required extensions show the toggle on and locked, with the reason. The set of
  required extensions is a fixed-layer fact, not a graph property, so that the loop it
  protects cannot switch it off; other bundled extensions of later releases may be
  deactivatable without any change to the rule.

## The Shape

- **Activation state is a kernel-owned singleton, not a manifest field.** A
  `kernel.extensionstate` Block, registered beside `kernel.releasepin` in the bootstrap
  schema, carries the set of **inactive** extension ids; absence of the Block, and absence
  of an id from it, means active. It is truth-written through CCGW with human provenance by
  the kernel, exactly as the release pin is (`BO_0095_003`), so its history is its revision
  history and a rollback of the pin restores the activation state the earlier pin was built
  from. It neither materializes nor ships: a release's export never sees it, so an update
  cannot revert an install's choice as a locally modified file (`BO_0197_006`), and a fresh
  install arrives with everything active. A manifest field (`status: inactive`) was
  considered — `ext.manifest` has an `OptionalProperties` slot the registration could
  declare and Validation would enforce — and rejected for exactly those two reasons: the
  manifest materializes and ships, and a bundled manifest carrying an instance's runtime
  choice would travel with the next release and be staged back on update.
- **The required set is code-registered in the kernel**, mirroring the elevated-review set
  (`extension-model.md`, Elevated Review; `BO_0099_001`): initially `ui.shell`, `settings`,
  `calliopa-base` and `calliopa-extension`. The kernel refuses to deactivate a required id at
  the route and at the CLI, and — the backstop — the materializer never omits a required
  extension whatever the Block says, so a hand-written Block cannot produce a tree without
  the shell. The set is reflected read-only to the shell (below), never stored in the graph;
  `category: bundled` stays what it is, the release export's rule, and is deliberately not
  the required rule, since the user expects bundled extensions that may be switched off.
- **The materializer honours the state at the pin.** The projection (`project` in
  `internal/kernel/materializer/project.go`) reads `kernel.extensionstate` at the same
  pinned revision as the manifests and skips an inactive extension's subtree: its manifest,
  sources, contributions and any root-mapped file it owns (none today — only `ui.shell` may
  claim root paths, and it is required). The skip applies to the **promotion and prod
  materializations only** — the staging tree `kernel pin` gates and the tree prod mode
  serves. `kernel checkout` for authoring stays complete, so an inactive extension can still
  be read, edited and committed, and its members are never seen as deletions: the working
  tree's contract is unchanged. `Options` gains the flag; the two kernel-owned callers pass
  it.
- **The build then does the rest.** With the directory absent, `pnpm gen` scans a registry
  without the extension (`BO_0202_001`), its behaviour tests are not included
  (`src/extensions/*/tests/behavior/`), its migrations are not in the sequence, and its
  library section keys, tab kinds and parties are simply not contributed — the states
  `BO_0202` already defined for absence apply: a stored layout keeps the key and a tab of a
  kind nothing contributes opens visibly in `context`. No shell code branches on activation.
- **Dependencies are checked before anything is written.** Deactivating an extension that an
  active one depends on (`dependsOn`, incoming) is refused naming the dependents — the
  scan's `dependency_missing` would refuse the build by name anyway, and the toggle should
  say so before promotion is attempted rather than after. Reactivating one whose own
  dependency is inactive is refused the same way. This is the rule the commit path already
  applies to removal — a manifest another manifest depends on cannot be retired
  (`ui-kernel.md`, Open Work) — restated for the switch.
- **One kernel route, acting as the signed-in person.**
  `POST /__kernel/extensions/<id>/state` with `{"active": false|true}` resolves the session as
  the account routes do (`BO_0214`), requires the **human** identity class — deployment is an
  operator act, like `kernel pin`; an agent-class person is refused as `stage_only` refuses
  their `write` — writes the state Block with that person's own credential, and then
  promotes head through the full gate (materialize the staging tree with the skip, build,
  typecheck, serve probe) in the same code path `kernel pin --to head` uses, so nothing
  promotes around the gate. The gate lives in `cmd/kernel/pin.go` today (`gateCandidate`)
  and moves into a package the serving kernel and the CLI both call, so there is one gate
  rather than a copy. The response says what happened: the new state, the promoted
  pin, or the gate's refusal in the `BO_0127_002` failure shape (the failed step, its exit
  code, the last output line). `GET /__kernel/extensions` answers every established
  manifest with its id, whether it is active, whether it is required, and its dependents —
  read from the component that enforces the rules, the way `elevatedExtensions` is read from
  CCGW (`BO_0099_004`).
- **A refused promotion leaves the state written and says so.** The order is write, then
  gate. If the gate refuses, the graph now says inactive while the served pin still carries
  the extension; the extension view shows both — _inactive since revision N, served pin still
  carries it, promotion refused: …_ — and the toggle flips it back, which is a second write
  and a second promotion. Writing after the gate would need the gate to build a tree that
  reflects a state not yet in the graph, which is a second source of truth for the
  materializer; reverting automatically would hide the failure that is the interesting
  information. What promotes is **head**, so a toggle also deploys everything accepted since
  the served pin, which the section's dot already announces; the view says so beside the
  toggle when head is past the pin.
- **The CLI has the same verb**, `kernel extension activate|deactivate <id>` and
  `kernel extension list`, under the owner's credential like `kernel pin` — the permanent
  recovery path (`ui-kernel.md`, Fixed Constraints) for the day a deactivation breaks the
  shell that would otherwise show the toggle to undo it. Both verbs write and then promote
  head; `--no-promote` writes only.
- **The shell's half.** The extension view gains the toggle at the top of the document —
  between the view's frame and the owner document's article in
  `src/components/views/extension.tsx`, above the `h1` that names the extension — _Active_ /
  _Inactive_ — reading from `GET /__kernel/extensions` through the shell's server
  side as the accounts surface does, and calling the route on change. While the promotion
  runs the toggle is disabled and the view reports _rebuilding_ from `/__kernel/healthz`
  (`building`, then `serving` at the new pin), after which the page reloads: the served shell
  is a different build, and the extension's contributions are gone or back. A required
  extension renders the toggle on and locked with _required to run Calliopa_; an extension
  with active dependents renders the refusal reason before the person tries. The Extensions
  section marks an inactive row (_inactive_), in the same group it was in
  (`extensions-section.tsx` groups by `category`, which does not change). The inspector's
  facts (`extensionFacts` in `src/lib/owner-docs/render.ts`) gain _Active_ and _Required_;
  its actions stay empty, the toggle being the one control. This is `ui.shell` content in
  the graph, a `CA` change coordinated here, carrying its own copy of the change document
  beside the code as `BO_0202_010` requires.

### Out Of Scope

- Deactivating a member of an extension, or a single contribution. Activation is per
  extension; the contract resolves per extension.
- Removing an extension. Retirement of the subtree stays the kernel CLI's and the agent's
  work; deactivation deletes nothing.
- Changing what `category: bundled` means for the release export, and a per-release list of
  which bundled extensions an install may switch off. The required set is the only fixed
  rule; everything not in it may be switched off.
- An agent toggling activation through the toolset. Deployment stays a human act here, as
  promotion is.

### Decided

Decided by the user on 2026-09-08, answering the open points the shape raised:

- **A truth write, no proposal.** The state is operational, like the release pin, and is
  written as the signed-in human in one act; its history is the Block's revision history.
  A proposal a human accepts first was rejected as a two-step act for a switch.
- **The toggle promotes head**, carrying every change accepted since the served pin. The
  view says so beside the toggle when head is past the pin, as the section's dot already
  does. Refusing the toggle while head is ahead was rejected: one action, one rebuild.
- **Human-class people only.** Deployment is an operator act, like `kernel pin`; an
  agent-class account sees the state and a locked toggle, and the route refuses it.
- **A refused gate leaves the state written**, and the view shows both the graph's state and
  the served pin's, with the refusal detail; the toggle flips it back. An automatic revert was
  rejected because it hides the failure that is the interesting information.
- **The required set lives in the kernel**, beside the materializer that honours it and the
  route that refuses; a hand-written Block cannot produce a tree without the shell. CCGW
  policy enforcement at the mutation path was rejected as more machinery for the same
  outcome; the elevated set stays where it is.

## Verification

- Materializer: a graph holding an inactive extension projects the staging tree without its
  subtree under the skip and with it under the plain checkout; a required id in the Block is
  ignored by the projection; a fixture pin below the state write projects the earlier state.
- Kernel routes and CLI against a real CCGW and a real `kernel serve`, no mocks, beside
  `accounts_verification_test.go`: a human deactivates `calliopa-video` and the pin advances
  to a tree whose registry names four extensions; the section keys and the API answer
  absence as `BO_0202_011` saw; reactivation brings them back at the next pin; a required
  id is refused by name; an agent-class session is refused; a dependent refusal names the
  dependents; a gate refusal (the `leaky-tree` fixture as the deactivated tree's neighbour
  or a broken candidate) leaves the state written and reports the failure shape; rollback
  to the pin before the deactivation serves the extension again.
- On the instance: open `calliopa-video`, switch it off, watch `healthz` go `building` then
  `serving` at the new pin with the Episodes, Standing Assets and Destinations sections gone
  and `/api/x/calliopa-video/...` answering 404 in words; switch it on and see them return;
  open `ui.shell` and see the toggle locked with its reason.

## Transfer

Transferred on 2026-09-08 as `BO_0218_001`–`BO_0218_012`: the state Block, the required set,
the materializer's skip, the shared gate with its consistency check, the routes, the CLI and
the kernel verification in `docs/system/ui-kernel.md` under Boot And CLI (`_001`–`_007`); the
fixed lines, the toggle, the section and inspector, and the on-instance verification in
`docs/system/ui-shell.md` under Extensions Section And Owner Document (`_008`–`_011`); the
model's statement in `docs/system/extension-model.md` (`_012`). The shell rows are `ui.shell`
content in the graph, landing through the proposal loop with their own copy of this document.

## Implementation

Claimed and implemented 2026-09-08. The kernel half landed in this repository and is
verified (`BO_0218_001`–`BO_0218_007` in `docs/system/ui-kernel.md`, folded to truth):
`kernel.extensionstate`, the required set, the materializer's served projection, the shared
gate in `internal/kernel/promote`, the routes, the `kernel extension` verbs. One deviation
from the transferred row, decided while implementing: the route promotes head _after_ its
answer and reports the outcome on the listing, since a build takes minutes and a browser
request that long is fragile; the answer still states the new state, and the listing the
promoted pin or the refusal, with the state left written.

The shell half is implemented in the checkout `.local/tree-0218` (head 99) with its unit
tests, build and the kernel harness green, and is **not yet staged**: staging needs the
`claude` credential under `CALLIOPA_SECRET_DIR`, which this session could not read. The
proposal is staged with

```sh
CALLIOPA_SECRET_DIR=<dir holding credentials/claude> .local/bin/kernel commit \
  --tree .local/tree-0218 --ccgw http://127.0.0.1:8080 --principal claude \
  --identity agent --map-root ui.shell --members .local/members-0218.json \
  -m "BO_0218 BO_0219 extension activation and versions in the shell"
```

Then accept it, rebuild the kernel and app images from this tree, promote head, and run
the on-instance verification (`BO_0218_011`, `BO_0219_008`).
