# BO_0249_FEAT_acceptance-as-a-phase-transition

Status: completed

Requested: 2026-09-13, the eighth part of `BO_0243` (decision and refinement). The material's sections 6, 19, 20, 27, 44 (*Commit*), 46 and rule 19: the proposed/accepted boundary of a position, acceptance as a phase transition with consequences named, language initiating commitment and one explicit confirmation completing it, and governance as a policy of the block.

## Where This Starts

- **Acceptance exists for proposals, not for positions.** A block's revision is accepted or rejected as a member of a group; a whole group is accepted behind the kernel's confirmation page (`BO_0103`). A document has no state saying whether its position is the accepted direction. The material's *Proposed* chip under the intent has no fact behind it.

- **A status transition is already a proposed item.** A change document's `changeStatus` moves by the inspector's select as the signed-in person, or by a run's `status` item accepted (`BO_0222_007`). That is the shape a position's state can take.

- **Consequences are unknown.** Nothing can say what accepting a root would affect; `BO_0244` gives the relations, `BO_0248` the judgements, from which *this would constrain traversal security; replace the current caching proposal; reopen one implementation assumption* can be derived.

- **Governance is the owner.** A human establishes; an agent proposes; `BO_0212` (idea) adds a policy that may refuse a principal accepting its own proposal, attached by extension. Per-block or per-root policy does not exist.

## Intent

* **A root has a state: proposed, accepted or superseded.** Proposed is a safe hypothetical environment; accepted means the wider system may now rely on it; superseded means another root replaced it and says which. The marker under the intent shows the state where it is consequential (material §19, §41).

* **Acceptance is deliberate.** Language may initiate it — *yes, this is the decision* — and the system responds inline: *Establish this as the accepted direction? This would: …*, with the consequences named from the network. One explicit confirmation completes it; language alone never mutates shared state (material §20, §46, rule 19).

* **Proposals may reason over the network; only accepted work may change it.** A projected consequence of a proposed root reads *if accepted, this would affect three related decisions*, and stays hypothetical until the transition (rule 11).

* **Acceptance policy belongs to the block, never to the route.** The default is the owner; a policy object referenced by an explicit relation is the extension point, and a child inherits policy only through such a relation (material §27). Anyone permitted to contribute may propose.

## The Shape

- **`document` gains `state`**, optional, permitted `proposed`, `accepted`, `superseded`; absent reads as proposed. `supersededBy` optional, the successor's id. Declared by `ui.shell` as `change` and `changeStatus` were (`BO_0222_004`).

- **Setting the state** is `setDocumentState` in `documents.ts` with the base compared first, and a `state` item in `propose_document_changes` beside `status`, so a run may propose it and never set it.

- **The transition card.** Accepting is offered in two ways that end in the same card: from the marker under the intent (*Proposed* is a control), and by a run that answers a commit command — *yes, this is the decision*, *treat this as the requirement* — by proposing the `state` item. Either way the shell draws, under the intent, *Establish this as the accepted direction?* with the consequences listed and one button, *Establish*, beside *Not yet*. The consequences are computed by the shell from the relations whose source is a block of this root: what it constrains, supports or contradicts elsewhere, what it supersedes, and which unresolved judgements stand; a run under `refine` may add a sentence in the same card when it proposed the transition. *Establish* writes the state as the reader — a content write, confirmation-free at the bridge, because the press is the confirmation — and, for a run's proposal, accepts the member.

- **Supersede.** A root accepted while another accepted root contradicts it on a declared `contradicts` relation is refused with the other named, unless the card's *and supersede «title»* is chosen, which sets the other's state and `supersededBy` in the same mutation.

- **Consequences after the fact.** Accepting a root is a change the refinement scheduler sees (`BO_0245`): the next system runs re-evaluate the relations from its blocks, so *three related decisions* come under pressure by the ordinary gate (`BO_0248`) rather than by a cascade the transition performs.

- **The card is what the reader sees of the policy.** The owner sees *Establish*; a person the policy does not permit sees the card without it and *Only <policy> may establish this*; a policy that requires another person's acceptance turns *Establish* into *Propose acceptance*, which stages the state as a proposal for that person to accept in place.

- **Policy hook.** The default policy is the instance owner and any human account the instance admits (today's rule); `BO_0212`'s separation of duties applies as it does elsewhere. A `policy` node type and an `acceptedBy` edge from a document to it are declared, with a permitted set of one — `owner` — so the hook is a relation the material asks for and not a policy engine nobody asked for. Named approvers, reviewers and majorities are each their own change.

- **Kernel half.** `state` in the document tools; the change context marks a state transition as an acceptance event.

- **Verification.** Behaviour tests over CCGW for the state write, the stale base, the supersede refusal and the proposed-then-established path; the render harness for the card's consequences from a fixture of relations; Playwright for the two ways in on both form factors; a walk on the served build.

## Decided

Answered by the user on 2026-09-13.

* **The press on _Establish_ is the one deliberate confirmation.** The root's state is content and confirmation-free at the bridge (`BO_0207_001`); the kernel's cross-origin confirmation page is not added on top. Routing the transition through that page was the alternative.

* **Only the root carries a state.** A block's acceptance is its revision's lifecycle and its standing; *locally accepted* is `BO_0250`'s; `text` gains no `state`. Adding one to blocks was the alternative.

* **A change document carries no phase.** Its `changeStatus` is its lifecycle; the transition card never appears on one and *Establish* is never offered there — a change's acceptance is its promotion to ready. Answered 2026-09-15 at transfer (`BO_0249_005`). A phase beside the status, or *Establish* moving the status, were the alternatives.

## Transferred

Transferred 2026-09-15. The kernel half is `docs/system/ui-kernel.md`, Acceptance As A Phase Transition (`BO_0249_001`–`BO_0249_005`; `_005` a functional question on change documents). The shell half is in the shell's graph docs (`BO_0249_006`–`BO_0249_013`; the pointers in `docs/system/ui-shell.md`, Acceptance As A Phase Transition). Revised at transfer: the stored property is `phase`, and the run's item `{kind: "phase"}`, because `state` already names a document's derived refinement state in the reads and a relation's state in the `state` item (`BO_0248`); the shape above keeps its words as the request was made.

## Depends On

- `BO_0244`, `CA_0046`; `BO_0248` for the consequences to include unresolved judgements.
