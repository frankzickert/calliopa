# CA_0046_FEAT_work-root-view

Status: completed

Requested: 2026-09-13, the second part of `BO_0243` (decision and refinement, a change of this repository). The material's sections 2, 5, 6, 8, 10–16, 41, 47, 54 and 57, and screens 1 (resting root view), 2 (focused body block with inline depth) and 6 (focused frontier). A `ui.shell` change: it alters the block editor view and nothing outside the shell.

## Where This Starts

At head 391, served pin 387.

- **The resting surface is already quiet.** A document opens reading, with no block active, no per-block chrome, no bar until a block is activated; the title is the headline, edited in place ([Block Editor View], `CA_0013_003`, `CA_0031_001`). The material's *minimum expression* is this surface plus three things it lacks: a state marker under the intent, derived blocks drawn in their own idiom, and depth on focus.

- **Focus means edit.** Activating a block turns it into an editor; there is no state between reading and editing where a block is focused and its context shown. Command mode marks blocks for a command; it reveals nothing about them.

- **Depth lives in drawers.** A document's facts — save state, last change, count, unanswered proposals, delete, the three toggles, a change document's status — are the inspector's ([Document Panel]). Nothing about a block — who wrote it, what it rests on, what depends on it — is drawn anywhere.

- **Kinds and provenance exist only once `BO_0244` lands.** Until then a block has a role and a standing; relations, claims, kinds and `derivedFrom` are not in the graph, and the history that says who wrote each revision is never read by the editor.

- **Standing already has a gutter mark.** A kept or pinned block carries its glyph and word in the leading gutter ([Standing]); a proposed block carries its proposer's face on its left border. The depth affordance has to stand apart from both.

## Intent

* **The document is a work root.** It renders the intent — the title — with its state marker beneath it where the state is consequential; then the body; then, only when they compress, discriminate or direct, the derived blocks — the synthesis, *What matters now*, the tension, the viable alternatives, what accepting would change, and *Next* — drawn as body blocks in a quiet idiom, never as a panel. One composer below. Nothing else of its own.

* **Depth is invisible while reading and discoverable while interacting.** Focusing a block — a tap, a click, keyboard focus — without starting to edit it reveals a restrained line naming only the categories that hold material: *Evidence · Related work · History*. No empty section, no counts, no permanent inspector.

* **Focus expands beneath the block, in layers that each add a distinct kind of meaning**, in this order and only where material exists: why this matters now; provenance; evidence — supporting, contradicting, untested; the relation mechanism, with its reason; history, only when it materially matters or is asked for; and *Open as focused work →*. No layer restates another (material §13).

* **The block's visual anchor is preserved.** Expanding moves the focused block by nothing; the expansion unfolds below and the viewport compensates. On a phone the focused block may pin near the top while depth expands under it (material §47).

* **Provenance is shown on focus, never as a badge.** *Human-authored*, *system-drafted*, *system-drafted, human-edited*, *system-maintained from …* in words, read from the block's history.

* **Evidence is not a list of support.** The layer surfaces contradicting and untested material before supporting material when a tension exists (material §14, rule 7).

* **Derived material is visibly derived, and challengeable.** A frontier or a next move says on focus that it is derived for this root, from what, and since when; it can be pinned or challenged from there (`BO_0246` carries what pinning and challenging do).

* **Editing stays what it is.** A second press, Enter, or typing on a focused block makes it the editor as today; every editing rule in [Block Editor View] holds unchanged.

## The Shape

- **Focus is a third fact about the surface, not a third mode.** The surface stays reading or command; within reading, one block may be *focused* — the tab's fact, like the active block, cleared when the tab is left, never persisted. A press on a reading row focuses it; a second press, Enter, or a key that would type activates it. Keyboard focus on the row focuses it as well, so tabbing through the document reveals the affordance line block by block.

- **The affordance line** renders under the focused block's text, out of the flow's geometry — the row reserves nothing — as a single muted line: the categories that hold material, separated by middle dots, each a button. It is absent when no category has material, so a plain paragraph in a document with no relations shows nothing on focus but its focus ring.

- **The expansion** renders below the affordance line as a rail of layers, each with its glyph and heading (screen 2): *Why this matters now* (from the frontier's `derivedFrom` edges naming this block, `BO_0246`), *Provenance* (`readBlockProvenance`, `BO_0244`), *Evidence* (relations of kind `supports` and `contradicts` whose target is one of the block's claims, each with its source's words and its acceptance — *Accepted*, *Proposed*, *Not yet tested* for an open question that names it), *Relations* (every other declared relation on the block's claims: kind, the other end's words, the reason; a block asserting several claims groups them by claim), *History* (only on request from the affordance line, or when `BO_0248` has recorded a material change to the claim), and *Open as focused work →* (`CA_0047`). A layer with nothing to say is not drawn.

- **The anchor.** Expanding writes the expansion below the row and adjusts the scroll container's `scrollTop` by the height that landed above the viewport's reference, in the same frame, so the block's top edge stays where it was; the technique the bar's scroll margin already relies on. Measured, not assumed: a Playwright scenario reads the row's bounding box before and after.

- **The state marker** under the title: *Proposed* by default, *Accepted*, *Superseded* — the document's `state` once `BO_0249` declares it; until then the marker is not drawn, since nothing consequential exists to mark. It is a chip in the muted idiom with the status icon table's glyph, never colour alone.

- **Derived blocks** render at the end of the body under small headings, each block with its glyph in the leading gutter and its words in the body's typography: `frontier` under *What matters now* (a target), `tension` under *Tension*, derived `alternative` blocks under *Alternatives*, derived `consequence` blocks under *If accepted*, and `next` under *Next* (an arrow), a next move's second line, muted, being its expected value. The screens show the two headings a root most often has; the others render the same way. They take the ordinary block row, so they focus, expand, pin and are edited like any block. A `synthesis` block renders in the body where it sits with no heading. A heading renders only when a derived block of that kind exists (`BO_0246`, all six elements from the first day, user decision 2026-09-13).

- **Focused derived block** (screen 6): its layers are *Derived for this root* (the `derivedFrom` sources in words), *Changed since you last read this* (`BO_0246`), *Provenance*, and two buttons at the end, *Pin this framing* and *Challenge* — the first sets the standing to pin, the second puts *Challenge:* into the composer with the block referenced, so the reader says in words what the framing gets wrong.

- **Mobile.** Under 640px the focused block gets `scroll-margin-top` of the bar's height and the expansion scrolls beneath it; the affordance line wraps. Pinning the focused row is a `position: sticky` on the focused row while its expansion is open, measured on the editor's own markup as `CA_0045` measured.

- **Command mode is untouched**: focus is a reading-mode fact, and entering command mode clears it as it clears the active block.

- **What moves out of the inspector**: nothing in this part. The document's facts stay contributed; `CA_0048` decides the inspector's fate.

- **Verification**: the render harness for focus, the affordance line's presence per material, the layer order, layers absent without material, and pin/challenge; Playwright for the anchor on both form factors, keyboard reach, and the axe scan with an expansion open; a walk on the served build.

## Decided

* **A first press focuses; a second edits.** On a reading row a first press focuses the block and reveals its depth affordance; a second press, Enter, or a key that would type activates the editor, so reading a document's depth costs no accidental edits. A drag selecting text still activates at once, as today. Keeping the first press an activation, with focus on a modifier or a hover-only affordance that does not exist on a phone, was the alternative. User decision, 2026-09-13.

* **_History_ is a layer**, drawn only on request from the affordance line or when a material change to one of the block's claims is on record (`BO_0248`), listing the claim's revisions with who and when. Answering *what changed here* in the console through a command was the alternative. User decision, 2026-09-13.

## Depends On

- `BO_0244` for kinds, claims, relations, `derivedFrom` and provenance. The view can land before `BO_0246`–`BO_0248` fill the derived layers; a layer without material is not drawn.
