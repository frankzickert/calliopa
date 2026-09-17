# BO_0247_FEAT_inferred-relations

Status: completed

Requested: 2026-09-13, the sixth part of `BO_0243` (decision and refinement). The material's sections 29, 30, 31, 34 and rule 25, and screen 4 (an inferred relation proposed on the caching block): the network grows as a side effect of work, because Calliopa infers likely relations during normal work and the reader confirms, edits or dismisses each with its reason visible.

## Where This Starts

- **Relations can be declared and proposed** once `BO_0244` lands: a `relation` node with kind, reason, origin and state, proposed by a run through `propose_document_changes`'s `relate` item and reviewed in place. Nothing infers one.

- **System runs exist** (`BO_0245`) and carry the change context; the `refine.relate` skill is this part's.

- **Provenance of a relation is in its history.** The relation node's revisions say who drafted the reason and who edited it; the group's member decision says who confirmed it. Read by nothing yet.

## Intent

* **The network does not depend on users creating edges.** During normal work — after a change settles — Calliopa infers likely relations between blocks, within a root and across roots, and proposes each with a drafted reason (material §30).

* **The reason is visible before confirmation, and editing it is as easy as accepting it.** An inferred relation is drawn on its source block as *Possible relation*: the claim, the kind, the target quoted with its document, the reason, and three answers — *Edit reason*, *Confirm relation*, *Not related* (screen 4).

* **Confirmation does not launder provenance.** A confirmed relation reads *Declared* at rest and, on focus, *system-inferred · system-drafted reason · confirmed by Alice · later edited by Ben* (material §31).

* **Inferred relations never propagate pressure.** Only a declared or derived relation is propagation-capable; an inferred one is a proposal until confirmed (material §29, rule 8).

* **Broad relations sharpen over time.** A coarse derived relation — *implementation X implements decision Y* — is scaffolding; the first time it fires meaningfully, the system proposes the narrower reason-bearing relation that should carry the pressure (material §34, rule 25).

## The Shape

- **`refine.relate`**, a skill of `calliopa-refine`: given the change context, the run looks for relations the changed blocks plausibly bear to blocks in this document and, through `list_documents` and `read_document`, in others, and stages each as a `relate` item with `origin: inferred` and a reason in one sentence naming the condition that connects them — *cache reuse is safe only while the authorization context remains unchanged during the request* — never *these seem related*. Every relation the run finds plausible is staged, the strongest first; a run that finds none records that in its judgement. What bounds the number is the reason rule, not a count: a relation the run cannot give a condition for is not plausible. User decision, 2026-09-13, over a cap of three. The skill's conventions carry the material's example and its refusal of generic relatedness (rule 10).

- **`origin: derived`** is for a relation the run establishes mechanically from structure — `implements`, `supersedes` between a block and the root it came from, `focuses`-derived edges — and is stated as such with its derivation as the reason; it propagates once accepted because the derivation is inspectable.

- **Review in place.** A candidate `relation` with `origin: inferred` renders under its source block as the *Possible relation* card of screen 4, in the derived idiom with an *Inferred* chip, the two lines *Origin: system-inferred* and *Reason: system-drafted*, and the three buttons. *Confirm relation* accepts the member; *Edit reason* opens the reason for editing, and leaving it accepts with the edit on top as editing a rewrite does (`BO_0233`); *Not related* rejects. The card is drawn on the source block in the source's document; a cross-document relation appears once, on its source, and the target's document counts it among its unanswered items without drawing it.

- **Relation provenance on focus.** The relation layer of `CA_0046` gains a second line under a declared relation, read from the relation node's history and its group's decision: origin, reason authorship, confirmer, later editors, in that order, in words.

- **Sharpening.** `refine.pressure` (`BO_0248`) records when a derived relation fired; the next `refine.relate` run, seeing a fired coarse relation in its context, proposes the narrower relation between the specific claims involved and, on its acceptance, proposes retiring the coarse one with *superseded by* in the reason.

- **Kernel half.** `read_document` answers relation provenance in the shape the shell draws; the change context marks relations that fired. `propose_document_changes` needs nothing new beyond `BO_0244`'s `relate` and `reason`.

- **Verification.** Behaviour tests over CCGW for the three answers and the provenance read; the render harness for the card; a live run against a signed-in agent proving one edit that introduces an assumption produces one inferred relation with a reason naming a condition; a walk on the served build.

## Decided

Answered by the user on 2026-09-13.

* **Every plausible inferred relation is staged**, the strongest first, bounded by the reason rule rather than a count. A cap of three was the alternative.

* **Inference crosses roots from the first cut.** Confining it to one document was the alternative.

* **Cards in quantity: the first two in full, the rest collapsed** to one line — *and 4 more possible relations* — that opens them. Decided at transfer, 2026-09-14, since no refinement had yet staged relations; the walk confirms or revises it once one does.

## Transferred

Transferred 2026-09-14. The kernel half is `docs/system/ui-kernel.md`, Inferred Relations (`BO_0247_001`–`BO_0247_004`, and `BO_0247_010` for the sharpening that waits on `BO_0248`). The shell half is in the shell's graph docs (`BO_0247_005`–`BO_0247_009`; the pointers in `docs/system/ui-shell.md`, Inferred Relations).

## Depends On

- `BO_0244`, `CA_0046`, `BO_0245`. Sharpening depends on `BO_0248`.
