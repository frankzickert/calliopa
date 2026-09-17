# BO_0212_FEAT_separation-of-duties

Status: completed

Completed 2026-09-17. The core (`BO_0212_001`–`_006`: migration 0019, `internal/separation`, the
owner's routes, `stagers`, the content-only scope walk, the refusals) and the kernel
(`_007`–`_010`: `requestedBy` on agent stagings, `kernel policy separation`, the core's codes through
the stage and write verbs) are truth in `docs/system/ccgw.md` §15 and `ui-kernel.md`. The editor
(`_011`–`_013`) is truth in `documents`' `block-editor.md` in the graph, served at pin 1381. The walk
on this instance found that a save refused on leaving the block lost its text; the editor now keeps
the refused save and makes it again into the proposal (`node:chg-3c3c390d149b2bab`).

Requested: 2026-09-07, spun out of `BO_0208` by the user's decision.

## Intent

* The core can refuse acceptance of a proposal by the principal that staged it: a policy
  attached to a scope, evaluated on CCGW's acceptance path, with the default off — accepting
  your own proposal is permitted unless a policy says otherwise.

It arrived as a capability rather than as part of the gate, and it is required by neither
`BO_0206` nor `BO_0208`; it depends on both, because a staging principal and an accepting
principal are only distinguishable once every mutation resolves to one and a second human
exists to accept.

Reviewed 2026-09-16 for Calliopa's purpose as a general workplace: kept, since four-eyes review
is a property of any shared workplace, not of the decision system. It is the core's rule over
proposal groups and nothing more. The `policy` block type and the `acceptedBy` relation that
`BO_0249` added as a policy hook on a root's phase belong to `calliopa-refine` and are not this
change's scope or its mechanism.

## Answered By BO_0208

Decided by the user on 2026-09-07, when the questions were still `BO_0208`'s.

- **A policy attaches to an extension.** The same registration shape as the elevated-review
  policy (`BO_0099_003`), which is the nearest precedent and the cheapest: a row in CCGW's
  database, scope by extension id, set at runtime rather than by rebuilding the code-configured
  list the elevated policy is today. Content-level marking — a namespace, a block type, a
  marked subtree — is more expressive and more expensive and waits for someone to ask.
- **The owner sets it**, through the administrative verbs `BO_0208` gives the kernel and the
  CCGW binary, and setting it is not subject to it: a policy is an administrative act on the
  instance, not a proposal, so there is nothing for the rule to apply to.
- **It is free.** The licence sells the second seat; a rule about who may accept is a property
  of the core that is worthless with one person and needs no entitlement of its own. This keeps
  `BO_0204`'s entitlement set a single flag.

## Shape

- The refusal sits on CCGW's acceptance path, where the staging principal is already carried
  on the group's provenance and the accepting principal is authenticated (`BO_0206_002`). A
  group whose touched set reaches a scoped extension, answered by the principal that staged it,
  is refused by name; a per-member decision is refused by the same walk (`BO_0113_001`).
- The shell may grey out a button; the core is what refuses. The rule to carry into review is
  `BO_0206`'s: the core refuses it, or it is not enforced.

## Decided 2026-09-16

User decisions at the transfer:

- **The scope stays an extension**, and a policy on an extension covers every node and relation
  whose type it declares as well as its subtree, so a policy on `documents` covers every document.
  A workspace or a document as the scope were the alternatives.
- **The requester counts.** The person whose command made an agent stage a group may not accept
  it; otherwise asking an agent would bypass review. Counting only the literal staging principal
  was the alternative.
- **Anyone who staged or asked for any part of a group** may accept neither the group nor any of
  its members. Checking each member against its own stager was the alternative.
- **Direct edits of scoped content go through a proposal.** The core refuses a truth write into a
  scoped extension, and the editor stages every edit into the person's branch while the policy
  stands. Letting direct edits through, which would let anyone bypass review by editing, was the
  alternative.

## Decided 2026-09-17

- **The policy covers content only.** It binds the nodes and relations of the types an extension
  declares; the extension's subtree — manifest, code and vocabulary — keeps the elevated review
  and the owner, so a release update into a scoped bundled extension proceeds as before. Exempting
  updates while covering the subtree, and making updates wait for a second person, were the
  alternatives. User decision, answering the question the transfer left open.

## Transferred

2026-09-16:

- **The core**, `docs/system/ccgw.md` §15 Separation of duties (`BO_0212_001`–`_006`): the policy
  row, the owner's routes and the schema field, `stagers` and `requestedBy` on the group, the scope
  walk widened to declared types, the refusals on acceptance, `COMMIT PROPOSAL` and truth writes,
  verification. One functional question stays open there: whether a release update into a scoped
  bundled extension needs a second person.
- **The kernel**, `docs/system/ui-kernel.md`, Separation Of Duties (`_007`–`_010`): agent
  stagings carry the run's person as `requestedBy`, `kernel policy separation`, the refusal codes
  passed through, verification. `_007` needs `BO_0232_001` (the run records its person).
- **`documents`** (graph), `documents/block-editor.md`, Separation Of Duties (`_011`–`_013`):
  every edit staged into the person's branch under a policy, the refusal explained, tests and the
  walk. It builds on `BO_0250`'s branch.
- `extension-model.md`, Elevated Review, and `ui-shell.md` point at these.
- This document is carried into the graph as a member of `documents` no later than completion.

## Not In This Change

- Roles, permissions and per-record authorization.
- A screen for setting the policy; the owner uses `kernel policy separation`.
