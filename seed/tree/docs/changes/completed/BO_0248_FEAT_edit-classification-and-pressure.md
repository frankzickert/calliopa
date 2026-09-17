# BO_0248_FEAT_edit-classification-and-pressure

Status: completed

Requested: 2026-09-13, the seventh part of `BO_0243` (decision and refinement). The material's sections 7, 32, 33, 35–40 and 55, rules 10, 12, 22 and 25, product scenarios 3A–3D, and screen 5 (pressure on a dependent block after an upstream change): edits classified as rewording, clarification or material change; relations with a lifecycle and a track record; pressure that travels only through a reason that still applies; silence that can be audited.

## Where This Starts

- **A relation survives every edit of its ends.** Validity is anchored open-ended at the endpoint's revision, so revising a block's content keeps its relations visible (`data-model.md`, [Block Document Model], Containment Validity). The graph has no notion that an edit changed a block's meaning; every revision is equal.

- **Drift is judged by revision, never by content.** CCGW's acceptance refuses a member whose block has any established revision past the group's base (`BO_0113_002`); the shell tells a standing-only drift from a words drift by comparing content (`CA_0042_002`). That is the one place anything asks *did this change matter*, and it asks it of a proposal, not of truth.

- **Nothing reacts to a change.** No process reads the commit log for what a change touched (`BO_0004_064`); `BO_0245` gives the kernel the trigger and the change context.

- **Vocabulary from `BO_0244`, mechanism from `BO_0245`**: relations with claims at both ends, `state` on a relation node, `judgement` records with `about`, `outcome` and `explanation`.

## Intent

* **Edits are classified**: rewording — meaning materially the same, no pressure propagates; clarification, narrowing or broadening — meaning shifted, relevant relations re-evaluated; material assertion change — accepted meaning changed enough that dependent reasoning may not hold, propagation considered. The classification is a judgement, recorded, and inspectable: *this edit was treated as changing the accepted assertion "one stable revision per request" to "a request may advance revision during execution"* (material §7).

* **Pressure rises only through the gate.** Consequential pressure is considered only when a propagation-capable relation exists, the source assertion underwent semantic change rather than rewording, the relation's reason is still applicable, the change touches the condition the reason expresses, the target assertion still exists in a form the relation applies to, and the target would be materially affected (material §36). *Did anything related change* is never the question.

* **Pressure is explained with the exact premise and reason involved.** Never *something changed upstream*: the previous claim, the current claim, the effect on the target, the source in words, and a way to the source change (rule 12, screen 5).

* **Uncertainty produces inspection, not urgency.** *Possibly relevant* reads as *this change may be relevant to the caching discussion*; only an accepted, propagation-capable relation creates consequential pressure (material §38).

* **A root becomes under pressure when a relevant accepted dependency changed materially, and needs review only when a concrete accepted premise, relation or condition no longer holds or is directly contradicted** (material §39).

* **Silence is auditable.** A change that raised no pressure still leaves the reason on record, and *did anything upstream change?* is answered from it (material §40, rule 22).

* **Relations have a lifecycle and a track record**: declared, exercised, needs review, orphaned, retired — and a record of the changes that correctly triggered pressure, correctly stayed quiet, and the corrections a person made (material §32, §33). Dead edges do not fire forever.

## The Shape

- **`refine.classify`**, a skill of `calliopa-refine`: for each block whose words changed in the change context and that carries a claim or a relation, the run judges the edit's class and records a `judgement` with `about: change`, `outcome` in `reworded`, `clarified`, `narrowed`, `broadened` or `changed`, and an explanation naming the claim before and after. For `changed`, `narrowed` and `broadened` it proposes the block's new `claim` (a `claim` item), so the accepted assertion moves only by the reader's acceptance and the wording moves freely. Rewording proposes nothing.

- **`refine.pressure`**, a skill of `calliopa-refine`: for each relation whose source claim moved by an accepted `claim` revision, the run walks the six conditions and records one `judgement` with `about: pressure`, `outcome` in `unaffected`, `possiblyRelevant`, `material` or `invalidated`, the explanation in the material's three registers, a `judges` edge to the relation and one to the target block. `unaffected` is the recorded silence. The run then proposes what follows: a `state` item setting the relation to `exercised` (correctly fired or correctly quiet) or `needsReview` (the reason may no longer apply), and, for `material` or `invalidated`, a rewrite of the derived frontier (`BO_0246`).

- **Pressure on the block** (screen 5). A target block with an unresolved `material` or `invalidated` judgement carries a quiet marker at rest — *Changed upstream* in the trailing gutter — and, on focus, the pressure layer before every other: *A dependent premise has changed*, then *Previous*, *Current*, *Effect*, *Source* with the source's route and *Open source change*, then *This block depends on the changed premise (declared relation). Last evaluated 2 hours ago.* A `possiblyRelevant` judgement shows no marker at rest and reads on focus as *this change may be relevant here*.

- **Resolution.** A pressure judgement is resolved by a later judgement on the same relation, or by the reader: editing the target block, re-pointing or retiring the relation, or *Seen* on the layer, which revises the judgement's `resolved` property as the reader. Nothing resolves on its own.

- **Root state.** A document is *under pressure* while any of its blocks carries an unresolved `material` judgement, and *needs review* while one carries `invalidated`. The root's marker under the intent says so beside its state (`CA_0046`, `BO_0249`); the library's row carries the glyph. Both are derived from judgements, never stored.

- **Audit.** *Did anything upstream change?* in the composer is answered from the document's judgements by the run, in the console, as the material's example reads: the accepted change, what it changed, what the relation's reason concerns, why it was unaffected. The focus layer *History* of a block with relations lists its judgements.

- **Track record.** A relation's focus layer reads its judgements as a record: fired correctly on N changes, stayed quiet on M, corrected by a person once. A relation whose target's claim moved so that the reason no longer applies (scenario 3D) is judged `needsReview`; the run proposes retiring it or a narrower one, and the retired relation keeps its record.

- **Orphaned.** A relation whose end block was retired or discarded is set `orphaned` by the next refinement's judgement and drawn only in the surviving block's history layer.

- **Kernel half.** The change context includes, per revised block, the claim before and after and whether the revision was accepted or written as truth; `record_judgement` (`BO_0245`) takes the `judges` edges; `read_document` answers unresolved judgements per block and the root's derived state.

- **Verification.** The four scenarios of material §56.3 as behaviour tests over CCGW with a scripted refinement and as a live run each: 3A raises `material` with the exact premise; 3B records `unaffected` and draws nothing; 3C records `clarified` and no pressure; 3D sets `needsReview` and retires. The render harness for the layer and the markers; a walk on the served build.

## Decided

Answered by the user on 2026-09-13.

* **A claim moves by acceptance.** The run proposes the claim's new wording as a `claim` item and the reader accepts it; the accepted assertion never changes under a typing hand, and a rewording the run misjudged is corrected by rejecting. Letting the run's judgement move the claim was the alternative.

* **A person corrects a classification on the block.** The block whose edit was classified carries the correction control: in its depth, under the classification's line — *Treated as a material change · Reword · Clarification · Material* — never on the resting surface, which stays content-only (`BO_0243`, the fixed principle). Choosing records a judgement as the person's, the relation's record counts the correction, and a pressure judgement that rested on the corrected class is re-evaluated by the next refinement. Correcting in the composer was the alternative and stays possible as any command is.

## Transferred

Transferred 2026-09-14. The kernel half is `docs/system/ui-kernel.md`, Edit Classification And Pressure (`BO_0248_001`–`BO_0248_007`; `_007` resumes `BO_0247_010`'s sharpening). The shell half is in the shell's graph docs (`BO_0248_008`–`BO_0248_016`; the pointers in `docs/system/ui-shell.md`, Edit Classification And Pressure).

## Depends On

- `BO_0244`, `CA_0046`, `BO_0245`; `BO_0246` for the frontier rewrite that follows material pressure.
