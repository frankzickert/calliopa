# DO_0034_FIX_accept-all-answers-the-whole-run

Status: completed

Reported 2026-10-03 on the dev instance, walking `BO_0344`: **"the agent said proposed, but even
after accepted-all, nothing there"**. User statement. Decided the same day: **"the acceptall is
supposed to relate to the agent run"**. User decision.

A run in the document *Calliopa* was asked to create the structure *video-beat*. Its group
`node:run-30270ee2471ad9a6` staged, all members `clean`:

- in *Calliopa*, one inserted block answering the prompt;
- the new document *video-beat* with its first block, its use of *Structure*
  (`hasBlockRole`) and the *Structure* values (`roleFields`);
- the run's `agent.run` record.

*Accept all* on the run chip in *Calliopa* accepted the block in *Calliopa* alone (`accept of 1
members`), and the group stayed open with *video-beat* in it. `answerDocumentGroup`
(`server/documents.ts`) reads the items of the document it is pressed in
(`readDocumentProposalsAgainstTruth(documentId)`) and decides only their members; a document the
run started elsewhere is taken only from that document's own chip (`startedIn`), and that document
is listed nowhere a person could open it — not in the library, not under *Structures*. So nothing
a person can press accepts what a run proposes outside the document it ran in.

## Scope

* *Accept all* on a run's chip answers the run: every member of its group, wherever it lands — the
  document the chip stands in, a document the run started, a structure, a source, a relation.
  User decision, 2026-10-03.
- The owner is `documents` (`answerDocumentGroup`, the run chip in `views/`); the batch of member
  decisions is the kernel's (`BO_0343_002`) and needs no change. A member the kernel keeps behind
  its confirmation stays undecided and is said, as today.
- A started document is taken with its group: its document node first, as `startedIn` does for
  the document's own chip (`BO_0251_009`).
* *Reject all* on a run's chip answers the run the same way: every member of its group, so a
  document the run started elsewhere is discarded with its items here. User decision, 2026-10-03
  (Q1).
* Before the press, the chip names what the run proposes outside this document — *also creates
  the structure video-beat* — each name opening that document. User decision, 2026-10-03 (Q2).
* An item's ✓ and ✗ in the document answer that item alone; only *Accept all* and *Reject all*
  reach the run's work elsewhere. User decision, 2026-10-03 (Q3).
- After *Accept all*, the notice names what landed elsewhere, so a structure the run made is found.
- Verified by a behaviour test: a run's group with an item in the document and a started document
  using *Structure*; the chip names the structure; *Accept all* from the document's chip leaves the
  group with nothing staged, and *Structures* lists the new structure; *Reject all* on a second
  such run leaves nothing of it, the started document included. And by the walk: ask a run in a
  document to create a structure, see it named on the chip, press *Accept all*, find it under
  *Structures*.

## Transfer

Transferred 2026-10-03; the decisions above are fixed lines there:

- `documents`' *Proposed Changes*, *Accept All Answers The Whole Run*: `DO_0034_001` (the whole
  group answered), `DO_0034_002` (the chip's `elsewhere`, and `nameDocuments` beside the guards),
  `DO_0034_003` (the notice), `DO_0034_004` (the proof), `DO_0034_005` (the walk), `DO_0034_006`
  (the release line in `calliopa-bootstrap`).
- `ui.shell`'s *Agent Activity*, *A Run's Work Elsewhere*: `DO_0034_007` (the chip draws it).
- `structures`' system document, *A Structure Is Named On The Chip*: `DO_0034_008`.

## Implementation

Completed 2026-10-03.

- `DO_0034_001`–`009` are truth in their documents: `documents`' *Proposed Changes*, `ui.shell`'s
  *Agent Activity* and `structures`' system document, proven under the kernel harness and in the
  render harness, served from pin 4440.
- Walked at pin 4405: *Accept all* made the run's structures, listed only after a reload; the view
  now asks the shell to read the library's sections again (`DO_0034_009`), walked at pin 4440.
- Left open in *Proposed Changes*: the chip names only documents a run started, not documents it
  changed that already stood.
