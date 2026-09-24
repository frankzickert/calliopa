# Acceptance Names A Claim

Status: completed

A document carries one phase — proposed, accepted, superseded — on its root, and nothing smaller
carries any. Accepting therefore accepts a whole document, including the prose that asserts nothing,
and it names no revision, so every later edit silently changes what was accepted and nothing says so.
The machinery that acceptance exists to feed — relations, pressure, judgements — already works one
level down, on claims. This change collects the problem and the direction the user chose for it on
2026-09-21. It authorizes no implementation and transfers no system tasks.

## Scope

- Three owners, which is why it is a `BO` change rather than one extension's:
  - `documents` holds the stored property, the phase write and the transition card
    (`setDocumentPhase`, `server/phase.ts`, `lib/phase.ts`, `block-document-model.md`,
    `document-panel.md`).
  - `calliopa-refine` draws the line and the card on the root's chrome and owns the commit
    convention that proposes a transition (`views/decision/provider.tsx`, `views/phase/`,
    its `docs/system/system.md`).
  - The kernel holds the `phase` item of `propose_document_changes`, `read_document`'s `phase`
    and the `[accepted]` mark on document leads (`docs/system/ui-kernel.md`, `BO_0249`).
- Not in scope:
  - A block's standing, discard · keep · fixate (`BO_0272`). Fixate is a reader's gesture inside
    one document; acceptance is a declaration to everything outside it. They are not the same scale
    and this change does not merge them.
  - Branch-local acceptance (`BO_0250`), a change document's `changeStatus` (`BO_0249_005`), and a
    relation's `state` lifecycle. None of them is the root's phase.
- Extension sources were read from the graph export at head 868 (`graph/tree/`), not from a live
  checkout.

## What Is True Today

- The stored fact is `phase` on the document node, with `supersededBy` beside it; absent reads as
  proposed, and only the root carries one — *a block's acceptance is its revision's lifecycle and its
  standing, and `text` gains no phase* (`ui-kernel.md`, `BO_0249`).
- `setDocumentPhase` writes the property alone. `baseRevisionId` is a staleness guard, as a rename's
  is; no revision is recorded as the one accepted, in the shell or in the kernel.
- The one behavioral consequence is the contradiction check: `accepted` is refused while another
  accepted root contradicts this one on a declared `contradicts` relation, unless `supersede` names
  that root, which is then set `superseded` with `supersededBy` in the same mutation.
- The rest is addressed to agents: `read_document` answers the phase, and the leads of other
  documents render *[accepted]* or *[superseded]* so a run reads which roots the wider system may
  rely on. Nothing else in the shell, in `documents`, in `publishing` or in the release path reads
  the property.
- The transition card's consequences are already claim-grained: they are the established relations
  reaching this root's **blocks**, each named by the far claim's opening words, plus the unresolved
  pressure judgements standing on those blocks.
- Relations anchor on claims, never on documents; `conflictsOf` lifts claim-level `contradicts` up to
  the root to answer a document-level question.
- The reader's line is drawn under the title of every document, and a document that has never had a
  decision taken in it reads *Proposed*, since absent reads as proposed.

## Why It Does Not Hold

- **The unit is too big.** A document holding one decision and nine paragraphs of thinking-aloud
  accepts all ten. What another document relies on is one assertion, not the page that carries it.
- **It is unpinned in time.** After acceptance the document stays fully editable, the line keeps
  reading *Accepted*, and the system cannot answer *has what I accepted changed?* — at any grain,
  because no revision was recorded. Refine's pressure fires when a premise under a relation moves,
  not when the accepted root itself is rewritten.
- **The vocabulary already presumes the smaller unit.** `BO_0244` introduced claims precisely so that
  *a rewording of the block and a change of its meaning can be told apart, and a block that says two
  things can be depended on for one of them*, and refine's rule §7 requires a material change to be
  inspectable in exactly these words: *This edit was treated as changing the accepted assertion "…"
  to "…"*. There is no per-claim acceptance for that sentence to be about.
- **It costs a line on every document to say nothing.** *Proposed* under the title is the default
  state of a document nobody has decided anything about.

## The Direction

User decisions, 2026-09-21:

* **The act stays one press on the root; the record gains a revision.** *Establish* writes the phase
  and `acceptedAt`, the dataRevision the acceptance was made at. That stamp is the only fact the
  acceptance stores.
* **What has moved since is derived and stored nowhere, and the unit is the block.** Any block says
  something, so what matters is not whether it carries a claim but whether what it says moved: a
  block reads as changed when `calliopa-refine` judged an edit to it material — `changed`,
  `narrowed`, `broadened` — since the stamp, and a rewording or a clarification is not reported; a
  block whose claim contradicts a claim accepted in another root reads as not accepted. User
  decision, 2026-09-21, from the walk. The first shape counted claims, and the walk retired it the
  same day: a document nobody has refined holds no claims at all, so an accepted page could be
  rewritten under the reader while its line went on reading *Accepted*. Claims stay what they are —
  what relations anchor on.
* **A press accepts what it can and reports the rest.** The report names the claims it could not
  take, where they live and what they collide with; *Establish and supersede* stays available for a
  collision the person wants to resolve that way. Because the exception is derived rather than
  stored, a collision that is later resolved clears itself, and one that arises later shows up the
  same way.
* **Nothing retracts silently.** A revised accepted claim stays accepted and reads as changed until
  someone answers it; refine records the judgement naming both wordings (rule §7) and the existing
  pressure path carries it to what depends on it. Pressing *Establish* again re-stamps. An accepted
  claim stays freely editable — the consequence is the mark, not a gate in the writing path.
* **The line appears only when it has something to say.** *Establish…* moves to the view bar's
  *Document* group, beside the document-level acts already there, and the line under the title is
  drawn only for a document that has been decided. Its words name each kind and drop the clause that
  is empty: *Accepted*, *Accepted · 2 changed*, *Accepted · 1 not accepted*, *Accepted · 2 changed,
  1 not accepted*, *Superseded by «title»*. A document nobody has decided anything about draws
  nothing above its first block.
* **A run reads two words in the leads**: `[accepted]` where nothing has changed and nothing is
  excepted, `[accepted · changed]` where a claim has moved since the stamp, `[superseded]` as now,
  and nothing for a document that was never decided. `read_document` carries the precision:
  `acceptedAt`, and per claim whether it is accepted, changed or not accepted.
- **Supersession stays stored on the root.** Replacing one direction with another is a document-level
  act with no claim-level equivalent.
- **Blocks that assert no claim are neither accepted nor unaccepted.** That is the correct answer for
  prose, and it is what removes the ten-paragraph acceptance.
- The instance holds 16 claims across 6 documents at head 868, so whatever migration this needs is
  small enough not to shape the design.

## What This Removes

- `setDocumentPhase`'s `contradicted` refusal. A press no longer fails because an accepted root
  contradicts this one; it succeeds, and the colliding claim is derived as not accepted. `supersede`
  stays, as the way a person replaces one direction with another rather than as an escape from a
  refusal.
- The line under the title of every undecided document, and with it *Proposed* as a word the reader
  sees. Absent no longer reads as proposed; it reads as nothing, and the act lives in the bar.

## Technical Notes For The Transfer

- The derivation does not recurse. A far claim counts as accepted when its own root is accepted and
  it has not been revised since that root's stamp; the far claim's own collisions are not walked.
  Two accepted roots whose claims contradict each other therefore read as not accepted on both
  sides, which is the honest answer while they stand in conflict.
- The comparison needs a data revision per claim, the way the document read already carries
  `revisedAt` per block and the history read carries the claims' revisions. That the claim read
  answers one cheaply is to be confirmed at transfer, and shapes nothing above if it does not.
- A run cannot know the revision its proposal will be accepted at, so the stamp is written at the
  press rather than by the pre-staged statement a `phase` member carries today. How that lands —
  the card's *Establish* answering the member and writing the stamp, against the member carrying the
  write — is a technical decision for the transfer. The `phase` item of `propose_document_changes`
  keeps its shape either way: a run proposes a transition and never writes one.
- Roots already accepted on this instance are stamped at their current revision when this lands, so
  they read *Accepted* rather than *Accepted · changed since unknown*.

## Implemented

- Implemented 2026-09-21, `_001`–`_008` and `_010`–`_012`, folded into truth in this repository's
  `docs/system/ui-kernel.md` (*Acceptance Names A Claim*) and, in the graph, in `ui.shell`'s
  `docs/system/workspace/layout.md`, `documents`' `block-document-model.md` and
  `document-panel.md`, and `calliopa-refine`'s `docs/system/system.md`.
- What landed: the press stores `phase` and `acceptedAt` and nothing else; every claim's standing is
  derived from that stamp and from the `contradicts` relations, judged on the claim's words at the
  stamp rather than on its revision, because a carry-forward re-establishes a claim without altering
  a word; the `contradicted` refusal is gone, so a press accepts what it can and the card reports
  the rest; the line under the title is drawn only for a decided root and names each kind that is
  not accepted; *Establish…* — *Re-establish…* on an accepted root — stands in the bar's *Document*
  group, contributed through a new decoration bar on the shell's bridge; a run's phase proposal is
  accepted and then stamped, since a run cannot know the revision its proposal will be accepted at;
  the leads carry `[accepted]` and `[accepted · changed]`; and the change context names the claims
  that have moved since the stamp.
- Verified: `tsc --noEmit` clean; the unit project green at 121 files and 1055 tests, with the new
  assertions shown to bite; `go test ./internal/kernel/agenttools` green with two new scenarios,
  also shown to bite; and the derivation's read half run against the live graph over every document
  holding claims, at three stamps each. Three pre-existing failures are untouched by this change and
  were confirmed on an unmodified checkout of head: a Qwik *Must be same function* unhandled
  rejection that appears only in a full unit run, the Garage-gated `graphbackup` and `materializer`
  suites, and `serve`'s `TestVocabularyGivenNoCalliopaVideoThenItsTypesAreUnknown`, whose fixture
  counts 15 members for `ui.shell` where it wants 13.
- Open, and why the change stays `wip`: `BO_0274_009`, the walk on the served build, and
  `BO_0274_014`, the write half of `tests/behavior/phase.test.ts`, which is written and typechecks
  but needs the instance's one human seat — a class-agent account is told `stage_only`, and the
  licence admits no second human — so it waits for the owner.
- Release notes: nothing added, and the reason is recorded rather than the line. Everything this
  change makes reachable is drawn by `calliopa-refine`, which is `individual`, so no release ships
  it; the halves that do ship — the kernel's `acceptedAt` and claim standing, `documents`' write and
  derivation, the shell's decoration bar — are inert on an instance with no decision extension, the
  way the `0.3.9` cut treated refine's phases. If the user judges otherwise, the line belongs under
  *Changed*.

## Revised By The Walk

- Walked on the served build at pin 976 on 2026-09-21. The line, the bar's *Establish…*, the press
  and the stamp all behaved; what the walk found was in the decision, not the code: an established
  document whose block the user had rewritten reported nothing, because the document asserts no
  claims — the instance's `Test` document has one block and none. Measured on the instance: 12 live
  claims across nine documents, all written by refinement runs, and no control in the shell creates
  one.
- The user's reframe, and the decision that followed: *any block is some kind of claim; the question
  is whether it matters for the doc*. What answers that is already in the system — `refine.classify`
  judges every edit `reworded`, `clarified`, `narrowed`, `broadened` or `changed` — and it was not
  connected to acceptance. So an accepted document now reports the edits the refinement judged
  material, over every block, and ignores rewordings. User decision, 2026-09-21.
- What that changed in the code: `acceptanceOf` derives over blocks from the document's judgements
  and the collisions, `materialSince` in `lib/phase.ts` holds the rule purely, the card's report
  carries the refinement's own sentence, the leads and the change context follow, and the kernel's
  per-claim standing is gone — refinement left the kernel with `BO_0264`, so the tools answer the
  stamp and nothing more (`BO_0274_016`). The claim-words-at-the-stamp derivation and its history
  read went with it.
- Verified again after the revision: `tsc --noEmit` clean, the unit project green at 125 files and
  1095 tests, `materialSince` shown to fail when the material filter is taken out, and
  `go test ./internal/kernel/agenttools` green.
- Still open: `BO_0274_009`, the walk of the revised behaviour — which now needs a refinement run to
  judge an edit before the line can count it — and `BO_0274_014`, the write half of the behaviour
  suite, which needs the owner's seat.

## Revised Again, By The Trigger's Absence

- `BO_0258` removed the refinement trigger the same day (`server/trigger.ts` is gone; refinement is
  invited by gesture), which the first revision had not accounted for: reporting only what a
  refinement judged meant reporting nothing at all until someone invited one. The user named the
  answer — *why don't I request a judgement?* — and it is a fifth gesture rather than a new
  mechanism.
- Decided, 2026-09-21: the line carries a free hint — *Accepted · 3 blocks edited since*, from the
  block revisions the document read already holds — and *Has this moved since it was accepted?*,
  drawn in the root's chrome for an accepted root alone, invites `refine.classify` to judge the
  edits made since the stamp. A judgement replaces the hint for its block: material outcomes read
  with the refinement's own sentence, a rewording or a clarification takes the block off the list,
  and a judgement overtaken by a later edit gives way to the hint again.
- Landed as `BO_0274_017` (the hint and the rules, pure in `lib/phase.ts` as `judgedSince` and
  `standingFor`) and `BO_0274_018` (the gesture, its goal carrying the stamp, its skill, and the
  chrome drawing it only for an accepted root). Verified: `tsc --noEmit` clean, the unit project
  green at 128 files and 1115 tests, and both new rules shown to fail when taken out.
- Noted while there: `lib/gestures.ts` said the gestures live in the chrome because no contract lets
  another extension contribute a bar group. One does now — `BO_0274_004`'s decoration bar, which
  carries *Establish…* — so the line was corrected. Moving the gestures there is nobody's open task.

## Closed

- Walked on the served build at pin 1033 on 2026-09-21 and the user said it works: a block edited
  reading *Accepted · 1 block edited since* with nothing running, *Has this moved since it was
  accepted?* raising the refinement that judged it, the judgement answered moving the line to what
  changed, and *Re-establish…* clearing it. `BO_0274_009` is truth in `documents`'
  `document-panel.md`, and `BO_0249_016` went with it — it walked the surface this change removed.
- One task stays open, as a `[ ]` follow-up rather than as part of this change:
  `BO_0274_014`, the write half of `tests/behavior/phase.test.ts`. It is written and typechecks, and
  it needs the instance's one human seat — a class-agent account is told `stage_only` and the
  licence admits no second human — so it runs when the owner runs it.
- Release notes: nothing added, and the reason stands as recorded above. Everything this change
  makes reachable is drawn by `calliopa-refine`, which is `individual` and ships in no release; the
  halves that do ship — the kernel's `acceptedAt`, `documents`' write and derivation, the shell's
  decoration bar — are inert on an instance with no decision extension.
