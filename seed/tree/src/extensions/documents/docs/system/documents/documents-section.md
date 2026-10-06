# The Documents Section

## Purpose

- The library's *Documents* section, under the *Docs* icon: the list of the documents nobody
  contains, what each row says, and how the list is filtered and ordered. The listing's reads are
  `block-document-model.md`'s (Implementation, Starting A Document From A Command); the rows and
  the filter row are drawn by the shell ([Contribution Contract](../../../../../../docs/system/workspace/contribution-contract.md#a-filter-on-an-item-section),
  [Layout](../../../../../../docs/system/workspace/layout.md#a-filter-on-an-item-section)).

## Filter And Order

Under `DO_0038` (2026-10-05,
[the change](../../changes/completed/DO_0038_FEAT_filter-and-order-the-documents-list.md)).

* The section carries a filter: title search, document kind, documents an agent started that
  nobody has taken, and documents still carrying the name they were minted with; and an order, one
  of *Title A–Z*, *Title Z–A*, *Last changed first* and *Newest first*. User decisions, 2026-10-05.
* The chosen kinds, the two show/hide choices and the order follow the workspace across reloads
  and devices; the typed search does not. A workspace that never chose lists every document but
  the structures (*Structures In The Filter*, below), ordered by title. User decisions, 2026-10-05
  and 2026-10-06.
* The search matches the title alone, never a document's body. User decision, 2026-10-05.
* When the filter hides every document, the list says *No documents match* with *Clear filter*;
  an empty library still says *No documents yet*. User decision, 2026-10-05.

- `listDocuments` answers each entry's `record` (absent for a plain document), `changedAt` and
  `createdAt` in milliseconds (`ListedDocumentEntry`, `DO_0038_003`). The times come from two
  metadata-only reads over the whole list, beside the reads it makes now and never one per
  document (`listingTimes`): every document with its history, created being the oldest revision of
  the node, and every document's containments with their blocks, last changed being the newest of
  the document's own revisions, its active containments and its blocks' current revisions — so a
  rename and a typed line both move it and neither moves created. A started document nobody has
  taken has both times from its candidate. A read that fails leaves the times out, and the listing
  still answers by title. `tests/behavior/documents.test.ts` proves a plain and a recorded
  document, a rename and a revise each moving last changed and not created, and a started
  document's times, over the kernel harness.
- The Documents section declares its filter, `DOCUMENTS_FILTER` in `lib/library-item.ts`
  (`DO_0038_004`): *Search titles*; a *Kind* group, every document carrying `document` or its
  record, named by the word capitalised (*Document*, *Source*), since no extension contributes a
  glyph for a record; a *Started by an agent* group, carried only by a document a run started that
  nobody has taken, drawn as Phosphor `robot`; an *Unnamed* group, carried only by a document still
  carrying its minted name; the orders *Title A–Z*, *Title Z–A*, *Last changed first* and *Newest
  first*, the last two by `changedAt` and `createdAt` newest first; *Title A–Z* by default, with
  nothing hidden but the structures (`DO_0042_003`, below); and *No documents match*. `documentItem` gives each row its `facets` and, when the
  listing answered both times, its `orderKeys`. `lib/library-item.test.ts` proves each row's
  values and numbers and the section's filter over a listing with nothing stored, an order and two
  values hidden.
- Walked by the user on the served build at pin 4611 and accepted on 2026-10-05 (`DO_0038_005`):
  each filter narrowing the list and the four orders, the choice surviving a reload, *Clear
  filter*, and an open tab of a hidden document staying open. The release note is
  `calliopa-bootstrap`'s `docs/release-notes/unreleased.md` under *Added*.

### Structures In The Filter

Under `DO_0042` (2026-10-06,
[the change](../../changes/completed/DO_0042_FEAT_structures-in-the-documents-filter.md)).

* The filter carries a show/hide toggle for structures: the documents that define a structure —
  every document using *Structure*, a person's and the built-ins. A document that only uses a
  structure is never hidden by it. User decision, 2026-10-06.
* The toggle is off by default: structure documents are not listed until the person shows them,
  and *Clear filter* hides them again. A workspace that stored a choice before this change hides
  them too. User decisions, 2026-10-06.
- The listing answers what an extension names each document, for the whole list at once
  (`DO_0042_002`): `server/guards.ts` holds `nameListedDocuments(name, lister)` beside
  `nameDocuments`, a `DocumentLister` answering every document it names with its word in one read,
  and `namesOfDocuments` asks each registered lister once, the first word winning; `listDocuments`
  reads it beside `listingTimes` and answers the word as `ListedDocumentEntry.named`. A lister that
  fails names nothing and the listing still answers; with none registered — a tree without
  `structures` — no entry is named. `tests/behavior/documents.test.ts` proves, over the kernel
  harness, a document a registered lister names carrying its word, one it does not carrying none,
  and a failing lister beside them.
- The Documents section's filter declares the group (`DO_0042_003`): `DOCUMENTS_FILTER` carries a
  *Structures* group (`structure`) after *Unnamed* and `defaultHidden: ["structure:structure"]`,
  and `documentItem` gives a document named `structure` the facet `structure` labelled
  *Structures*, drawn as the word. The group draws nothing when no listed document is a structure.
  `lib/library-item.test.ts` proves a structure document's facet, a plain one and one named
  otherwise carrying none, and the section hiding the structure document with nothing stored and
  with a choice stored before the group, and listing it once shown.
- `DO_0042_005` was not walked on a served build: the user closed the change on 2026-10-06 while
  the dev instance still served pin 4923, before the change's pin 4967; the tests above are its
  verification.
