# DO_0040_FIX_deleting-a-proposed-document

Status: completed

Reported 2026-10-05 by the user: "i am trying to delete a source proposed by an agent. but
clicking the trash can has no effect". The user wants the trash can to work on it.

## Cause

- Read from the code at head 4642. A source a run proposes is a started document (`BO_0251_008`):
  its node is a candidate of the run's group and nothing of it is established. The editor reads it
  through `readStarted` and draws it as the run's proposal, *Proposed by «proposer»* under the
  title, and its bar still offers *Delete* (`delete-document` in `views/block-editor.tsx`).
- *Delete* sends the `delete` command, and `deleteDocument` (`server/documents.ts`) reads the
  document from the truth only (`loadDocument`). A started document is not there, so the command
  answers `noResult`, *No document … in this graph.*, and nothing changes. The editor puts that in
  the notice above the title; at the bottom of a long source, or read past, the press looks like
  it did nothing.
- Nothing decided what *Delete* means on a started document: Block Editor View names how one is
  taken (an accepted item, a retitle) and how it goes (its last item rejected), and offers no
  third way. A source cited by a proposed sentence is also not among that document's items to
  answer, and rejecting the sentence leaves the source proposed (`BO_0291_036`), so the trash can
  is the control a person reaches for.

## Scope

- The owner is documents, which owns the editor's bar and the `delete` command; the change uses
  its `DO` prefix. Bibliography's *Source* view is a document's and needs nothing of its own.
- *Delete* on a started document — a source or any other document a run started — rejects what
  the run proposed of that document, and only that: the document node, the blocks it `CONTAINS`
  in the group, and the relations staged on them (a source's `roleFields` and their field values),
  member by member, the way accepting a cited source takes it whole (`proposedWorksCited`).
  Everything else in the run's group stays open: its other sources, other documents, and a
  proposed sentence citing this source, which, accepted later, draws the citation as missing.
  User decision, 2026-10-05.
- The tab then reads `noResult` and every tab showing the document closes, as a delete of an
  established one does (`bridge.targetGone$`); the library no longer lists it.
- The confirmation keeps its shape. Its words say what happens: the document is a proposal, and
  deleting it rejects it. A started document a guard keeps (`fixed.undeletable`) offers no
  *Delete*, as an established one does not.
- A delete that fails — the group answered meanwhile, a member that will not reject — answers in
  words, and the editor shows them where the press is seen, not only in the notice above the title.
- Technically: `deleteDocument` falls back to `startedIn` when the truth read answers `noResult`,
  gathers the document's members from the group's staged relations as `proposed-works.ts` does for
  acceptance, and `decide("reject", …)` each, the document node last so no block is left in a
  group without its document.
- Verified by a server test under the kernel harness: a run proposes a source and a sentence
  citing it, *Delete* on the source rejects the source's members, the source reads `noResult`
  and leaves the listing, and the sentence's item is still open; and by a render-harness test
  pressing *Delete* on a started document and finding its tab gone; and by the user on the
  instance.
- Set to draft by the user on 2026-10-05; the work is enumerated as `DO_0040_001` in
  [Block Document Model](../../system/documents/block-document-model.md#deleting-a-started-document)
  and `DO_0040_002`–`DO_0040_003` in
  [Block Editor View](../../system/documents/block-editor.md#a-started-document).
- Set to ready by the user on 2026-10-05. `DO_0040_001` and `DO_0040_002` landed the
  same day and stand as truth in Block Document Model and Block Editor View; `DO_0040_003`, the walk
  on the instance, remains.
- Completed 2026-10-05: the user walked it on the instance, and `DO_0040_003` stands as truth in
  Block Editor View.
