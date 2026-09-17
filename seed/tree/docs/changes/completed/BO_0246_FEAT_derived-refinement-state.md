# BO_0246_FEAT_derived-refinement-state

Status: completed

Requested: 2026-09-13, the fifth part of `BO_0243` (decision and refinement). The material's sections 3.3, 15, 16, 17, 18, 41, 54 (rules 1, 5, 16, 17, 18, 23) and 57, and screens 1 and 6: the current synthesis, the frontier — *What matters now* — the main tension, viable alternatives, projected consequences and the best next move, maintained by the system, stable across small edits, challengeable, pinnable.

## Where This Starts

- **Derived kinds exist as vocabulary only.** `BO_0244` declares `synthesis`, `frontier` and `next` as kinds of `text` and `derivedFrom` as an edge; `CA_0046` draws them at the end of the body under *What matters now* and *Next* and gives a focused derived block its *Derived for this root*, *Pin this framing* and *Challenge*. Nothing writes one.

- **System runs exist as a mechanism.** `BO_0245` starts a run under `refine` after a change settles, with the change context, and lets it record a judgement; the `refine.derive` skill is this part's.

- **Pin is a standing.** A pinned block is kept and stands behind every command issued in its document (`BO_0227`, [Standing]); the kernel reads what is pinned at a run's start (`BO_0227_002`).

- **Nothing knows what a reader has read.** The workspace record holds tabs and layout; a tab's scroll and active block are browser-local; marks are device-local. No per-person, per-document read mark exists, and `BO_0232` records that a run does not know who asked for it.

## Intent

* **Derived posture must compress.** A synthesis, a frontier or a next move earns its place only if it adds something the body does not say — a hinge that compresses several blocks, a discrimination between alternatives, a direction. *Revision invalidation remains unresolved* in the body and *Main uncertainty: revision invalidation* beneath it is duplication and is never written (material §16, rule 5).

* **Derived blocks are proposals of the system**, drawn in the body's quiet idiom rather than a proposer's colour, and read at no cost: a reader is never asked to accept a frontier to see it. A derived block becomes the reader's by pinning it or editing it.

* **Derived state changes only on material thresholds**: an unresolved premise accepted, a contradiction appearing, an alternative becoming non-viable, a dependency changing materially, the frontier resolved, a significant consequence emerging. A small edit moves nothing, and every change of a derived block keeps a diffable history (material §18).

* **The frontier is challengeable and never silently reverted.** A pinned frontier — one a person chose — governs; the system may challenge it in words and may not replace it. A reader who says *no, the real issue is auditability* has reframed, and the system explains its disagreement, if any, as a proposal beside the pinned block (material §17).

* **Very few next moves, ranked by expected refinement value**: usually one, at most three, preferring what reduces important uncertainty, discriminates between alternatives, validates critical evidence or enables justified commitment (rules 16, 17).

* **Changed since you last read this** is a quiet marker on a derived block, and on focus it says what the previous framing was, what the new one is, and why it changed.

## The Shape

- **`refine.derive`**, a skill of `calliopa-refine`: the run reads the document, its relations and the change context, decides whether a threshold was crossed, and either records a `threshold` judgement saying which one or that none was (silence) or proposes: one `synthesis` block where the body's position can be compressed into one, one `frontier`, one `tension` where a contradiction, uncertainty or tradeoff turns the work, the `alternative` blocks that remain meaningfully viable, the `consequence` blocks that would materially change if the current proposal were accepted, and one to three `next` blocks — each with `derivedFrom` edges to the blocks and relations it rests on, and a rewrite of an existing derived block rather than a second one. Screens 1 and 6 show the two headings a root most often has; the others render the same way, under their headings, only when written. The skill carries the material's examples verbatim — what to write, what never to write — as conventions.

- **How a derived proposal is drawn.** A candidate `frontier`, `next` or `synthesis` staged by a system run renders in the derived idiom of `CA_0046`, not as an agent proposal in the proposer's colour, with a small *derived* mark on focus; its answer icons are absent. It is answered by use: pinning it, editing it or referencing it in a command accepts it; a later system run that replaces it rejects the old candidate as it stages the new (single open candidate per node holds, since each derived block is its own node). A reader who wants it gone discards it, which rejects it. This is the one place a proposal is not drawn as one, and the reason is the material's: the reader's attention is spent on decisions, not on acknowledging the system's reading.

- **Established derived blocks.** Once accepted by use, a derived block is truth like any block and the next refinement proposes a rewrite of it, drawn as today's proposed rewrite is — beside the block, in the derived idiom — so a pinned frontier is never overwritten: the proposal stands beside it until the reader answers, and a pinned block's rewrite says *challenges the pinned framing* in its accessible name.

- **Thresholds are the run's judgement, recorded.** Every refinement records a `threshold` judgement naming the threshold crossed or that none was, with the blocks it weighed, so the audit of a quiet document reads *the edit reworded the caching claim; no premise moved*.

- **Changed since you last read this.** A per-person read mark per document: the data revision at which this person last had the document open with the derived blocks in view. Kept in the kernel's state record under the person's account (`/__kernel/state/people/<account>/read/<document>`), written by the shell when the derived blocks scroll into view or the tab is left, read with the document. A derived block whose revision is above the mark carries the marker; its focus layer shows the previous revision's words beside the current ones, and the rationale of the refinement that changed it.

- **Challenge.** *Challenge* on a focused derived block puts *Challenge the framing:* into the composer with the block referenced; the run under `refine` answers by proposing a rewrite or, when it disagrees, a `question` block beside the framing that says why, never a revert.

- **Pinned means governing.** The kernel already hands a run the document's pinned blocks; the `refine.derive` skill says a pinned frontier is the frame the synthesis and next moves are derived for, and that the run may challenge but not replace it.

- **Shell half.** The derived idiom's candidate rendering (`readDocumentProposals` learns to tell a system group's derived kinds from an agent's items), the answer-by-use rule, the read mark's write and the marker, the focus layer's before/after; behaviour tests over CCGW and the render harness; a walk on the served build with system runs on.

- **Kernel half.** The read-mark state route per person (`BO_0208`'s accounts give the identity); the change context's `acceptance events` include which derived blocks were pinned or discarded since the last refinement.

## Decided

Answered by the user on 2026-09-13.

* **Answer by use.** A derived candidate is accepted by pinning, editing or referencing it, rejected by discarding it, and never carries answer icons. Drawing it as an agent proposal with ✓ and ✕ was the alternative.

* **The read mark is per person, in the kernel's state record.** Device-local was the alternative.

* **All six derived elements from the first day**: synthesis, frontier, main tension, viable alternatives, projected consequences and the next move. `tension` is a kind of its own (`BO_0244`); a derived alternative or consequence is an `alternative` or `consequence` block with `derivedFrom` edges, drawn in the derived idiom by its provenance. The `refine.derive` skill writes each only where it compresses, discriminates or directs, so a root with no viable alternative carries no alternatives heading. The three-element start was the alternative.

## Transferred

Transferred 2026-09-14. The kernel half is `docs/system/ui-kernel.md`, Derived Refinement State (`BO_0246_001`–`BO_0246_005`). The shell half is in the shell's graph docs (`BO_0246_006`– `BO_0246_010`; the pointers in `docs/system/ui-shell.md`, Derived Refinement State).

## Depends On

- `BO_0244`, `CA_0046`, `BO_0245`.
